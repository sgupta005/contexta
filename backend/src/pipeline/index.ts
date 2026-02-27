import type { WebSocket } from "ws";

import type { PipelineState, Scenario } from "../types.js";

export interface VoicePipelineConfig {
  socket: WebSocket;
  scenario: Scenario;
  sessionId: string;
}

export class VoicePipeline {
  private state: PipelineState = "IDLE";
  private socket: WebSocket;
  private scenario: Scenario;
  private sessionId: string;
  private conversationHistory: {
    role: "user" | "assistant";
    content: string;
  }[] = [];

  constructor(config: VoicePipelineConfig) {
    this.socket = config.socket;
    this.scenario = config.scenario;
    this.sessionId = config.sessionId;

    console.log(
      `[VoicePipeline] Initialized for session="${this.sessionId}" scenario="${this.scenario.id}"`
    );

    // Send the initial state to the client
    this.sendToClient({
      type: "state",
      state: this.state,
    });
  }

  handleMessage(data: Buffer | string, isBinary: boolean): void {
    if (isBinary) {
      this.handleAudioChunk(data as Buffer);
    } else {
      this.handleControlMessage(data.toString());
    }
  }

  private handleAudioChunk(audio: Buffer): void {
    if (this.state === "IDLE") {
      // Auto-transition to LISTENING when audio arrives
      this.setState("LISTENING");
    }

    if (this.state !== "LISTENING") {
      // If we're THINKING or SPEAKING and receive audio, that's a barge-in
      if (this.state === "SPEAKING" || this.state === "THINKING") {
        console.log(`[VoicePipeline] Barge-in detected during ${this.state}`);
        // TODO: Cancel current TTS/LLM and restart
        this.setState("LISTENING");
      }
    }

    // TODO: Forward audio to Deepgram STT
    // this.deepgramConnection.send(audio);
    console.log(
      `[VoicePipeline] Received audio chunk: ${audio.byteLength} bytes`
    );
  }

  private handleControlMessage(raw: string): void {
    try {
      const msg = JSON.parse(raw);
      console.log(`[VoicePipeline] Control message:`, msg);

      switch (msg.type) {
        case "start":
          this.setState("LISTENING");
          // TODO: Open Deepgram STT connection
          break;

        case "stop":
          this.setState("IDLE");
          // TODO: Close Deepgram STT connection
          break;

        case "barge-in":
          if (this.state === "SPEAKING") {
            console.log(`[VoicePipeline] Client requested barge-in`);
            // TODO: Cancel ElevenLabs TTS, stop audio playback
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

  private setState(newState: PipelineState): void {
    const oldState = this.state;
    this.state = newState;
    console.log(`[VoicePipeline] State: ${oldState} → ${newState}`);

    this.sendToClient({
      type: "state",
      state: newState,
    });
  }

  private sendToClient(msg: Record<string, unknown>): void {
    if (this.socket.readyState === this.socket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    }
  }

  destroy(): void {
    console.log(
      `[VoicePipeline] Destroying pipeline for session="${this.sessionId}"`
    );
    this.state = "IDLE";
    // TODO: deepgramConnection.close()
    // TODO: cancel pending LLM request
    // TODO: cancel pending TTS request
  }

  getState(): PipelineState {
    return this.state;
  }
}
