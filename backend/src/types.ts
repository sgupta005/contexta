export interface Scenario {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
}

/**
 * IDLE      → Waiting for user to start speaking
 * LISTENING → Receiving audio from the browser, streaming to Deepgram STT
 * THINKING  → Final transcript received, streaming to Groq LLM
 * SPEAKING  → LLM response being synthesized via ElevenLabs TTS,
 *             audio chunks streamed back to the browser
 */
export type PipelineState = "IDLE" | "LISTENING" | "THINKING" | "SPEAKING";
