"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceAgentStatus = "idle" | "connecting" | "connected" | "error";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

export function useVoiceAgent() {
  const [status, setStatus] = useState<VoiceAgentStatus>("idle");
  const socketRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  const connect = useCallback((scenarioId: string) => {
    // Don't open a new connection if one already exists
    if (socketRef.current) {
      return;
    }

    setStatus("connecting");

    const url = `${WS_URL}?scenarioId=${encodeURIComponent(scenarioId)}&sessionId=${encodeURIComponent(sessionIdRef.current)}`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setStatus("connected");
      console.log("[WS] Connected to voice agent");
    };

    ws.onclose = (event) => {
      console.log(
        `[WS] Disconnected — code=${event.code} reason="${event.reason}"`,
      );
      socketRef.current = null;
      setStatus("idle");
    };

    ws.onerror = (event) => {
      console.error("[WS] Connection error:", event);
      setStatus("error");
    };

    socketRef.current = ws;
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close(1000, "User ended conversation");
      socketRef.current = null;
      setStatus("idle");
    }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close(1000, "Component unmounted");
        socketRef.current = null;
      }
    };
  }, []);

  return { status, connect, disconnect };
}
