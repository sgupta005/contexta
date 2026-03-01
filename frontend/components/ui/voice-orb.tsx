"use client";

import { PipelineState } from "@/lib/types";

export function VoiceOrb({
  isActive,
  pipelineState,
}: {
  isActive: boolean;
  pipelineState: PipelineState;
}) {
  return (
    <div
      className="relative cursor-pointer transition-transform duration-700"
      role="button"
      tabIndex={0}
      aria-label={
        isActive
          ? `Voice orb: ${pipelineState.toLowerCase()}`
          : "Voice orb: idle"
      }
    >
      <div className="bg-primary/20 pointer-events-none absolute -inset-10 animate-[pulse_4s_cubic-bezier(0.4,0,0.6,1)_infinite] rounded-full opacity-20 blur-3xl" />
      <div className="orb-container rounded-full">
        <div className="orb-ring border-primary/30 animate-pulse rounded-full" />
        <div className="orb-inner rounded-full opacity-100" />
        <div className="orb-overlay rounded-full" />
        <div className="bg-primary-foreground absolute z-30 size-2 rounded-full shadow-[0_0_10px_var(--primary-foreground)]" />
      </div>
    </div>
  );
}
