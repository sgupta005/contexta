export interface Scenario {
  id: string;
  name: string;
  greeting: string;
  description: string;
  systemPrompt: string;
}

/**
 * IDLE      → Waiting for user to start speaking
 * LISTENING → Receiving audio from the browser, streaming to Deepgram Flux STT
 * THINKING  → EndOfTurn received, generating LLM response
 * SPEAKING  → LLM response being synthesized via Deepgram Aura-2 TTS,
 *             audio sent back to the browser
 */
export type PipelineState = "IDLE" | "LISTENING" | "THINKING" | "SPEAKING";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export type ServerMessage =
  | { type: "state"; state: PipelineState }
  | { type: "transcript"; text: string; isFinal: boolean }
  | { type: "agent_response"; text: string }
  | { type: "audio_end" };
