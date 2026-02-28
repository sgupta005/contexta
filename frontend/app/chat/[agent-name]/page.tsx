"use client";

import { use, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { useVoiceAgent } from "@/hooks/use-voice-agent";
import { STATUS_CONFIG } from "@/lib/constants";
import type { PipelineState } from "@/lib/types";

const PIPELINE_LABELS: Record<PipelineState, string> = {
  IDLE: "Idle",
  LISTENING: "Listening...",
  THINKING: "Thinking...",
  SPEAKING: "Speaking...",
};

const PIPELINE_COLORS: Record<PipelineState, string> = {
  IDLE: "bg-muted-foreground",
  LISTENING: "bg-emerald-500",
  THINKING: "bg-amber-500",
  SPEAKING: "bg-blue-500",
};

export default function Page({
  params,
}: {
  params: Promise<{ "agent-name": string }>;
}) {
  const { "agent-name": agentName } = use(params);
  const {
    isStreamingResponse,
    status,
    pipelineState,
    messages,
    currentTranscript,
    connect,
    disconnect,
  } = useVoiceAgent();

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, currentTranscript]);

  const isActive = status === "connected" || status === "connecting";
  const { label: statusLabel, color: statusColor } = STATUS_CONFIG[status];

  function handleClick() {
    if (isActive) {
      disconnect();
    } else {
      connect(agentName);
    }
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold capitalize">
            {agentName.replace(/-/g, " ")}
          </h1>
          <div className="flex items-center gap-4">
            {/* Pipeline state */}
            {isActive && (
              <div className="flex items-center gap-2 text-sm">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${PIPELINE_COLORS[pipelineState]}`}
                />
                <span className="text-muted-foreground">
                  {PIPELINE_LABELS[pipelineState]}
                </span>
              </div>
            )}
            {/* Connection status */}
            <div className="flex items-center gap-2 text-sm">
              <span
                className={`inline-block h-2 w-2 rounded-full ${statusColor}`}
              />
              <span className="text-muted-foreground">{statusLabel}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {msg.content}{" "}
                {isStreamingResponse ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  ""
                )}
              </div>
            </div>
          ))}

          {/* Live interim transcript */}
          {currentTranscript && (
            <div className="flex justify-end">
              <div className="text-muted-foreground max-w-[80%] rounded-2xl border border-dashed px-4 py-2.5 text-sm italic">
                {currentTranscript}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <footer className="border-t px-6 py-4">
        <div className="flex justify-center">
          <Button
            size="lg"
            variant={isActive ? "destructive" : "default"}
            onClick={handleClick}
            disabled={status === "connecting"}
          >
            {isActive ? "End Conversation" : "Start Conversation"}
          </Button>
        </div>
      </footer>
    </div>
  );
}
