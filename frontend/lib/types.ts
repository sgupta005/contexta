export type VoiceAgentStatus = "idle" | "connecting" | "connected" | "error";

export type PipelineState = "IDLE" | "LISTENING" | "THINKING" | "SPEAKING";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export type Scenario = {
  id: string;
  name: string;
  description: string;
};
