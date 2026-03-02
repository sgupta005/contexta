import type { LucideIcon } from "lucide-react";
import { Brain, CircleDashed, Ear, Volume2 } from "lucide-react";

import type { PipelineState } from "./types";

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";
export const RECORDER_TIMESLICE_MS = 80;

export const PIPELINE_LABELS: Record<PipelineState, string> = {
  IDLE: "System Idle",
  LISTENING: "Listening...",
  THINKING: "Processing...",
  SPEAKING: "Responding...",
};

export const PIPELINE_ICONS: Record<PipelineState, LucideIcon> = {
  IDLE: CircleDashed,
  LISTENING: Ear,
  THINKING: Brain,
  SPEAKING: Volume2,
};

export const PIPELINE_BADGE_CLASSES: Record<PipelineState, string> = {
  IDLE: "border-muted-foreground/40 text-muted-foreground",
  LISTENING: "border-blue-500/60 text-blue-500",
  THINKING: "border-amber-500/60 text-amber-500",
  SPEAKING: "border-emerald-500/60 text-emerald-500",
};
