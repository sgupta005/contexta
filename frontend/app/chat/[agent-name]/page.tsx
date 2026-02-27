"use client";

import { use } from "react";

import { Button } from "@/components/ui/button";
import { useVoiceAgent } from "@/hooks/use-voice-agent";

const STATUS_CONFIG = {
  idle: { label: "Ready", color: "bg-muted-foreground" },
  connecting: { label: "Connecting…", color: "bg-yellow-500" },
  connected: { label: "Connected", color: "bg-emerald-500" },
  error: { label: "Connection failed", color: "bg-destructive" },
} as const;

export default function Page({
  params,
}: {
  params: Promise<{ "agent-name": string }>;
}) {
  const { "agent-name": agentName } = use(params);
  const { status, connect, disconnect } = useVoiceAgent();

  const isActive = status === "connected" || status === "connecting";

  function handleClick() {
    if (isActive) {
      disconnect();
    } else {
      connect(agentName);
    }
  }

  const { label, color } = STATUS_CONFIG[status];

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6">
      <Button
        size="lg"
        variant={isActive ? "destructive" : "default"}
        onClick={handleClick}
        disabled={status === "connecting"}
      >
        {isActive ? "End Conversation" : "Start Conversation"}
      </Button>

      {/* Status indicator */}
      <div className="flex items-center gap-2 text-sm">
        <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
        <span className="text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}