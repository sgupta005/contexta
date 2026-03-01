"use client";

import { use } from "react";

import { Mic } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConversationHistory } from "@/components/ui/conversation-history";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { VoiceOrb } from "@/components/ui/voice-orb";
import { useVoiceAgent } from "@/hooks/use-voice-agent";
import type { PipelineState } from "@/lib/types";
import { cn } from "@/lib/utils";

const PIPELINE_LABELS: Record<PipelineState, string> = {
  IDLE: "System Idle",
  LISTENING: "Listening...",
  THINKING: "Processing...",
  SPEAKING: "Responding...",
};

export default function Page({
  params,
}: {
  params: Promise<{ "agent-name": string }>;
}) {
  const { "agent-name": agentName } = use(params);
  const {
    status,
    pipelineState,
    currentTranscript,
    connect,
    disconnect,
    messages,
  } = useVoiceAgent();

  const isActive = status === "connected" || status === "connecting";

  function handleClick() {
    if (isActive) {
      disconnect();
    } else {
      connect(agentName);
    }
  }

  const lastMessage = messages[messages.length - 1];
  const previewContent =
    ((isActive && currentTranscript) || lastMessage?.content) ?? "";
  const isPreviewFromUser =
    (isActive && !!currentTranscript) || lastMessage?.role === "user";

  return (
    <main className="flex flex-col items-center justify-center gap-12">
      <div className="text-xl font-light tracking-widest uppercase">
        {agentName.replaceAll("-", " ")}
      </div>
      <div className="flex flex-col items-center justify-center gap-8">
        <Badge variant="outline" className="p-4 tracking-widest uppercase">
          {isActive ? PIPELINE_LABELS[pipelineState] : "System Idle"}
        </Badge>
        <VoiceOrb isActive={isActive} pipelineState={pipelineState} />
        {messages.length === 0 && !currentTranscript ? (
          <p className="text-muted-foreground text-2xl font-light">
            "Ready when you are."
          </p>
        ) : (
          <Sheet>
            <SheetTrigger className="cursor-pointer">
              <span
                className={cn(
                  "line-clamp-2 max-w-md",
                  isPreviewFromUser ? "text-primary" : "text-muted-foreground"
                )}
              >
                {previewContent}
              </span>
            </SheetTrigger>
            <SheetContent className="min-w-sm sm:min-w-md md:min-w-xl">
              <ConversationHistory messages={messages} />
            </SheetContent>
          </Sheet>
        )}
      </div>
      <div className="flex flex-col items-center justify-center gap-4">
        <Button
          onClick={handleClick}
          disabled={status === "connecting"}
          className="gap-2 px-12 py-6"
        >
          <Mic className="size-5" />
          <span className="text-sm font-medium tracking-[0.2em] uppercase">
            {isActive ? "End Conversation" : "Start Conversation"}
          </span>
        </Button>

        <div className="flex items-center space-x-8 text-xs tracking-widest uppercase opacity-40">
          <div className="flex items-center space-x-2">
            <span
              className={`size-2 rounded-full ${isActive ? "bg-green-500" : "bg-muted-foreground"}`}
            />
            <span>Microphone {isActive ? "Active" : "Inactive"}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span
              className={`size-2 rounded-full ${status === "connected" ? "bg-primary" : "bg-muted-foreground"}`}
            />
            <span>Network {status === "connected" ? "Stable" : "Idle"}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
