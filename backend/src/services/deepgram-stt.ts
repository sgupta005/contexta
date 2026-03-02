import { EventEmitter } from "events";
import WebSocket from "ws";

const DEEPGRAM_FLUX_URL =
  "wss://api.deepgram.com/v2/listen?model=flux-general-en";

export interface FluxTranscriptEvent {
  transcript: string;
}

export class DeepgramSTTService extends EventEmitter {
  private ws: WebSocket | null = null;
  private apiKey: string;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  connect(): void {
    if (this.ws) {
      this.close();
    }

    this.ws = new WebSocket(DEEPGRAM_FLUX_URL, [], {
      headers: { Authorization: `Token ${this.apiKey}` },
    });

    this.ws.on("open", () => {
      console.log("[DeepgramSTT] Connected to Flux");
      this.emit("open");
    });

    this.ws.on("message", (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleFluxMessage(msg);
      } catch (err) {
        console.error("[DeepgramSTT] Failed to parse message:", err);
      }
    });

    this.ws.on("close", (code: number, reason: Buffer) => {
      console.log(
        `[DeepgramSTT] Connection closed — code=${code} reason="${reason.toString()}"`
      );
      this.ws = null;
      this.emit("close");
    });

    this.ws.on("error", (err: Error) => {
      console.error("[DeepgramSTT] WebSocket error:", err.message);
      this.emit("error", err);
    });
  }

  send(audio: Buffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(audio);
    }
  }

  close(): void {
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, "Client closing");
      }
      this.ws = null;
    }
  }

  private handleFluxMessage(msg: Record<string, unknown>): void {
    if (msg.type === "TurnInfo") {
      const event = msg.event as string;
      const transcript = ((msg.transcript as string) ?? "").trim();

      switch (event) {
        case "Update":
          if (transcript) {
            this.emit("update", { transcript } satisfies FluxTranscriptEvent);
          }
          break;

        case "EndOfTurn":
          if (transcript) {
            this.emit("end_of_turn", {
              transcript,
            } satisfies FluxTranscriptEvent);
          }
          break;

        case "StartOfTurn":
          this.emit("start_of_turn");
          break;

        case "EagerEndOfTurn":
        case "TurnResumed":
          break;

        default:
          console.warn(`[DeepgramSTT] Unknown TurnInfo event: ${event}`);
      }
    } else if (msg.type === "Connected") {
      console.log("[DeepgramSTT] Flux session established");
    } else if (msg.type === "Error") {
      console.error(
        `[DeepgramSTT] Fatal error — code=${msg.code} description="${msg.description}"`
      );
    }
  }
}
