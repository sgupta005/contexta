import type { WebSocket } from "ws";

import type {
  ConversationMessage,
  PipelineState,
  Scenario,
  ServerMessage,
} from "../lib/types.js";
import { extractCompleteSentence } from "../lib/utils.js";
import {
  DeepgramSTTService,
  type FluxTranscriptEvent,
} from "../services/deepgram-stt.js";
import { DeepgramTTSLive } from "../services/deepgram-tts.js";
import { streamResponse } from "../services/llm.js";

export interface VoicePipelineConfig {
  socket: WebSocket;
  scenario: Scenario;
  sessionId: string;
}

export class VoicePipeline {
  private socket: WebSocket;
  private sessionId: string;
  private scenario: Scenario;

  private state: PipelineState = "IDLE";

  private conversationHistory: ConversationMessage[] = [];

  private deepgramTTS: DeepgramTTSLive | null = null;

  private deepgramSTT: DeepgramSTTService | null = null;
  // if STT is not ready, buffer audio chunks until it is
  private sttReady = false;
  // buffer audio chunks until STT is ready so that header received in fist chunk can be preserved
  private audioBuffer: Buffer[] = [];

  private greetingSent = false;

  private turnAbort: AbortController | null = null;

  constructor(config: VoicePipelineConfig) {
    this.socket = config.socket;
    this.scenario = config.scenario;
    this.sessionId = config.sessionId;

    console.log(
      `[VoicePipeline] Initialized for session="${this.sessionId}" scenario="${this.scenario.id}"`
    );

    this.sendMessage({ type: "state", state: this.state });
  }

  handleMessage(data: Buffer | string, isBinary: boolean): void {
    if (isBinary) {
      this.handleAudioChunk(data as Buffer);
    } else {
      this.handleControlMessage(data.toString());
    }
  }

  private handleAudioChunk(audio: Buffer): void {
    if (!this.sttReady) {
      this.audioBuffer.push(audio);
      return;
    }

    if (this.deepgramSTT) {
      this.deepgramSTT.send(audio);
    }
  }

  private handleControlMessage(raw: string): void {
    try {
      const msg = JSON.parse(raw);
      console.log(`[VoicePipeline] Control message:`, msg);

      switch (msg.type) {
        case "start":
          this.handleStart();
          break;

        case "stop":
          this.handleStop();
          break;

        case "audio_playback_complete":
          if (this.state === "SPEAKING") {
            this.setState("LISTENING");
          }
          break;

        default:
          console.warn(`[VoicePipeline] Unknown message type: ${msg.type}`);
      }
    } catch {
      console.error(`[VoicePipeline] Invalid control message: ${raw}`);
    }
  }

  private async handleStart(): Promise<void> {
    if (this.greetingSent) {
      console.log("[VoicePipeline] Greeting already sent, resuming listening");
      this.setState("LISTENING");
      return;
    }

    this.connectSTT();
    this.connectTTS();

    try {
      await this.deepgramTTS!.waitUntilReady();

      console.log("[VoicePipeline] Generating greeting TTS...");
      this.setState("SPEAKING");

      await this.deepgramTTS!.speak(this.scenario.greeting);

      this.sendMessage({ type: "audio_end" });

      this.greetingSent = true;
      this.conversationHistory.push({
        role: "assistant",
        content: this.scenario.greeting,
      });
      this.sendMessage({
        type: "agent_response",
        text: this.scenario.greeting,
      });

      // Before the greeting is sent, we only need the first chunk because it has the opus/webm header, so remove any other chunks
      if (this.audioBuffer.length > 1) {
        this.audioBuffer = this.audioBuffer.slice(0, 1);
      }
    } catch (err) {
      console.error("[VoicePipeline] Greeting failed:", err);
      this.closeSTT();
      this.closeTTS();
      this.setState("IDLE");
    }
  }

  private handleStop(): void {
    this.closeSTT();
    this.closeTTS();
    this.setState("IDLE");
  }

  private connectSTT(): void {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      console.error("[VoicePipeline] Missing DEEPGRAM_API_KEY");
      return;
    }

    this.closeSTT();
    this.sttReady = false;

    this.deepgramSTT = new DeepgramSTTService(apiKey);

    this.deepgramSTT.on("open", () => {
      this.sttReady = true;

      // the first chunk has the opus/webm header, so send it to the STT
      const firstChunk = this.audioBuffer[0];
      if (firstChunk) {
        this.deepgramSTT!.send(firstChunk);
      }
      // the subsequent chunks are the actual user audio and are only to be sent after the greeting
      if (this.greetingSent) {
        for (let i = 1; i < this.audioBuffer.length; i++) {
          const chunk = this.audioBuffer[i];
          if (chunk) this.deepgramSTT!.send(chunk);
        }
      }
      // clear the buffer
      // if greeting is not sent, the buffer will be cleared except the first message (it has the opus/webm header) so that we don't send the greeting audio to STT
      this.audioBuffer = [];
    });

    this.deepgramSTT.on("update", (event: FluxTranscriptEvent) => {
      if (this.state !== "LISTENING") return;
      this.sendMessage({
        type: "transcript",
        text: event.transcript,
        isFinal: false,
      });
    });

    this.deepgramSTT.on("end_of_turn", (event: FluxTranscriptEvent) => {
      if (this.state !== "LISTENING") return;
      this.handleEndOfTurn(event.transcript);
    });

    this.deepgramSTT.on("start_of_turn", () => {
      if (this.state === "SPEAKING" || this.state === "THINKING") {
        this.handleBargeIn();
      }
    });

    this.deepgramSTT.on("error", (err: Error) => {
      console.error("[VoicePipeline] STT error:", err.message);
    });

    this.deepgramSTT.on("close", () => {
      console.log("[VoicePipeline] STT connection closed");
      this.sttReady = false;
    });

    this.deepgramSTT.connect();
  }

  private async handleEndOfTurn(transcript: string): Promise<void> {
    if (!transcript) return;

    this.sendMessage({ type: "transcript", text: transcript, isFinal: true });

    this.conversationHistory.push({ role: "user", content: transcript });

    this.setState("THINKING");

    this.turnAbort = new AbortController();
    const { signal } = this.turnAbort;

    try {
      let fullResponse = "";
      let sentenceBuffer = "";
      let speakingStarted = false;

      for await (const token of streamResponse(
        this.scenario.systemPrompt,
        this.conversationHistory
      )) {
        if (signal.aborted) break;

        this.sendMessage({ type: "agent_response", text: token });

        fullResponse += token;
        sentenceBuffer += token;

        const boundary = extractCompleteSentence(sentenceBuffer);
        if (boundary) {
          const [sentence, remaining] = boundary;
          sentenceBuffer = remaining;

          if (!speakingStarted) {
            await this.deepgramTTS!.waitUntilReady();
            this.setState("SPEAKING");
            speakingStarted = true;
          }

          await this.deepgramTTS!.speak(sentence);
          if (signal.aborted) break;
        }
      }

      if (fullResponse) {
        this.conversationHistory.push({
          role: "assistant",
          content: fullResponse,
        });
      }

      if (!signal.aborted) {
        if (sentenceBuffer.trim()) {
          if (!speakingStarted) {
            await this.deepgramTTS!.waitUntilReady();
            this.setState("SPEAKING");
          }
          await this.deepgramTTS!.speak(sentenceBuffer.trim());
        }

        this.sendMessage({ type: "audio_end" });
      }
    } catch (err) {
      if (!signal.aborted) {
        console.error("[VoicePipeline] Turn processing failed:", err);
        this.sendMessage({ type: "audio_end" });
      }
    } finally {
      this.turnAbort = null;
    }
  }

  private handleBargeIn(): void {
    console.log("[VoicePipeline] Barge-in! Interrupting agent.");

    if (this.turnAbort) {
      this.turnAbort.abort();
    }

    this.closeTTS();
    this.connectTTS();

    this.sendMessage({ type: "barge_in" });
    this.setState("LISTENING");
  }

  private setState(newState: PipelineState): void {
    const oldState = this.state;
    this.state = newState;
    console.log(`[VoicePipeline] State: ${oldState} → ${newState}`);
    this.sendMessage({ type: "state", state: newState });
  }

  private sendMessage(msg: ServerMessage): void {
    if (this.socket.readyState === this.socket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    }
  }

  private sendBinary(data: Buffer): void {
    if (this.socket.readyState === this.socket.OPEN) {
      this.socket.send(data);
    }
  }

  private closeSTT(): void {
    this.sttReady = false;
    this.audioBuffer = [];
    if (this.deepgramSTT) {
      this.deepgramSTT.removeAllListeners();
      this.deepgramSTT.close();
      this.deepgramSTT = null;
    }
  }

  private connectTTS(): void {
    this.closeTTS();

    this.deepgramTTS = new DeepgramTTSLive((chunk) => {
      this.sendBinary(chunk);
    });
  }

  private closeTTS(): void {
    if (this.deepgramTTS) {
      this.deepgramTTS.close();
      this.deepgramTTS = null;
    }
  }

  destroy(): void {
    console.log(
      `[VoicePipeline] Destroying pipeline for session="${this.sessionId}"`
    );
    this.closeSTT();
    this.closeTTS();
    this.state = "IDLE";
  }

  getState(): PipelineState {
    return this.state;
  }
}
