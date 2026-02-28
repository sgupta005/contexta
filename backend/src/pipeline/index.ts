import type { WebSocket } from "ws";

import type {
  ConversationMessage,
  PipelineState,
  Scenario,
  ServerMessage,
} from "../lib/types.js";
import {
  DeepgramSTTService,
  type FluxTranscriptEvent,
} from "../services/deepgram-stt.js";
import { textToSpeech } from "../services/deepgram-tts.js";
import { generateResponse } from "../services/llm.js";

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

  private deepgramSTT: DeepgramSTTService | null = null;
  // if STT is not ready, buffer audio chunks until it is
  private sttReady = false;
  // buffer audio chunks until STT is ready so that header received in fist chunk can be preserved
  private audioBuffer: Buffer[] = [];

  private greetingSent = false;

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

    if (this.state === "LISTENING" && this.deepgramSTT) {
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

    try {
      console.log("[VoicePipeline] Generating greeting TTS...");
      const greetingAudio = await textToSpeech(this.scenario.greeting);

      this.setState("SPEAKING");

      this.sendBinary(greetingAudio);
      this.sendMessage({ type: "audio_end" });

      this.greetingSent = true;
      this.conversationHistory.push({
        role: "assistant",
        content: this.scenario.greeting,
      });

      if (this.sttReady) {
        this.setState("LISTENING");
      }
    } catch (err) {
      console.error("[VoicePipeline] Greeting failed:", err);
      this.closeSTT();
      this.setState("IDLE");
    }
  }

  private handleStop(): void {
    this.closeSTT();
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

      for (const chunk of this.audioBuffer) {
        this.deepgramSTT!.send(chunk);
      }
      this.audioBuffer = [];

      if (this.greetingSent) {
        this.setState("LISTENING");
      }
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
      console.log(
        `[VoicePipeline] StartOfTurn during ${this.state} (barge-in logged, not acted on in v1)`
      );
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

    try {
      const response = await generateResponse(
        this.scenario.systemPrompt,
        this.conversationHistory
      );

      this.conversationHistory.push({ role: "assistant", content: response });

      this.sendMessage({ type: "agent_response", text: response });

      const responseAudio = await textToSpeech(response);

      this.setState("SPEAKING");

      this.sendBinary(responseAudio);
      this.sendMessage({ type: "audio_end" });

      this.setState("LISTENING");
    } catch (err) {
      console.error("[VoicePipeline] Turn processing failed:", err);
      this.setState("LISTENING");
    }
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

  destroy(): void {
    console.log(
      `[VoicePipeline] Destroying pipeline for session="${this.sessionId}"`
    );
    this.closeSTT();
    this.state = "IDLE";
  }

  getState(): PipelineState {
    return this.state;
  }
}
