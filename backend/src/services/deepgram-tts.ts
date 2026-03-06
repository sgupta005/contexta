import { createClient, LiveTTSEvents } from "@deepgram/sdk";
import type { SpeakLiveClient } from "@deepgram/sdk";

const TTS_MODEL = "aura-2-thalia-en";
export const TTS_SAMPLE_RATE = 24000;

type AudioChunkHandler = (audio: Buffer) => void;

export class DeepgramTTSLive {
  private connection: SpeakLiveClient;
  // we are passing sendBinary as onAudioChunk to send the audio chunk to the frontend via ws as soon as it arrives
  private onAudioChunk: AudioChunkHandler;
  private flushResolve: (() => void) | null = null;
  private openResolve: (() => void) | null = null;
  private ready = false;
  // for latency logging
  private speakStartTime: number | null = null;

  constructor(onAudioChunk: AudioChunkHandler) {
    this.onAudioChunk = onAudioChunk;

    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

    this.connection = deepgram.speak.live({
      model: TTS_MODEL,
      encoding: "linear16",
      sample_rate: TTS_SAMPLE_RATE,
    });

    this.connection.on(LiveTTSEvents.Open, () => {
      console.log("[DeepgramTTS] Live connection opened");
      this.ready = true;
      if (this.openResolve) {
        this.openResolve();
        this.openResolve = null;
      }
    });

    this.connection.on(LiveTTSEvents.Audio, (data: Buffer) => {
      if (this.speakStartTime !== null) {
        const latencyMs = Math.round(Date.now() - this.speakStartTime);
        console.log(`[DeepgramTTS] First audio chunk latency: ${latencyMs}ms`);
        this.speakStartTime = null;
      }
      this.onAudioChunk(data);
    });

    // this event means deepgram has finished generating audio
    this.connection.on(LiveTTSEvents.Flushed, () => {
      if (this.flushResolve) {
        this.flushResolve();
        this.flushResolve = null;
      }
    });

    this.connection.on(LiveTTSEvents.Error, (err: unknown) => {
      console.error("[DeepgramTTS] Error:", err);
    });

    this.connection.on(LiveTTSEvents.Close, () => {
      console.log("[DeepgramTTS] Live connection closed");
      this.ready = false;
      if (this.flushResolve) {
        this.flushResolve();
        this.flushResolve = null;
      }
    });
  }

  waitUntilReady(): Promise<void> {
    if (this.ready) return Promise.resolve();
    return new Promise((resolve) => {
      this.openResolve = resolve;
    });
  }

  speak(text: string): Promise<void> {
    if (!this.ready) {
      return Promise.reject(new Error("[DeepgramTTS] Connection not ready"));
    }

    this.speakStartTime = Date.now();

    return new Promise<void>((resolve) => {
      this.flushResolve = resolve;
      this.connection.sendText(text);
      // tell deepgram to start generating audio
      // without flush, deepgram can keep waiting for more text
      this.connection.flush();
    });
  }

  close(): void {
    this.ready = false;
    if (this.flushResolve) {
      this.flushResolve();
      this.flushResolve = null;
    }
    this.connection.removeAllListeners();
    this.connection.requestClose();
  }
}
