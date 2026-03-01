"use client";

import { Bot, User } from "lucide-react";

import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ScrollArea } from "./scroll-area";

export interface ConversationHistoryProps {
  messages: Message[];
}

export function ConversationHistory({ messages }: ConversationHistoryProps) {
  if (messages.length === 0) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Conversation</SheetTitle>
          <SheetDescription>
            No messages yet. Start talking to see the conversation here.
          </SheetDescription>
        </SheetHeader>
      </>
    );
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Conversation</SheetTitle>
      </SheetHeader>
      <div className="min-h-0 flex-1">
        <ScrollArea className="h-full">
          <ul className="flex flex-col gap-4 px-4 pb-4">
            {messages.map((msg, i) => (
              <li
                key={i}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                <span
                  className={cn(
                    "text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full",
                    msg.role === "user"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                  aria-hidden
                >
                  {msg.role === "user" ? (
                    <User className="size-4" />
                  ) : (
                    <Bot className="size-4" />
                  )}
                </span>
                <div
                  className={cn(
                    "flex max-w-[85%] flex-col gap-0.5 rounded-lg px-3 py-2",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "text-xs font-medium tracking-wider uppercase",
                      msg.role === "user"
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground"
                    )}
                  >
                    {msg.role === "user" ? "You" : "Agent"}
                  </span>
                  <p className="text-sm wrap-break-word whitespace-pre-wrap">
                    {msg.content}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </div>
    </>
  );
}
