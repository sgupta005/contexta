"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RECORDER_TIMESLICE_MS, WS_URL } from "@/lib/constants";
import type { Message, PipelineState, VoiceAgentStatus } from "@/lib/types";

export function useVoiceAgent() {
  const [status, setStatus] = useState<VoiceAgentStatus>("idle");
  const [pipelineState, setPipelineState] = useState<PipelineState>("IDLE");

  // all the messages that have been exchanged between user and agent
  const [messages, setMessages] = useState<Message[]>([]);
  // user's speach that is currently being transcribed
  const [currentTranscript, setCurrentTranscript] = useState("");

  const socketRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // audio chunks that are received from the server
  const audioChunksRef = useRef<Blob[]>([]);
  // audio that is currently playing
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const playAudio = useCallback(() => {
    const chunks = audioChunksRef.current;
    if (chunks.length === 0) return;

    const blob = new Blob(chunks, { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    currentAudioRef.current = audio;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      currentAudioRef.current = null;
      setPipelineState("LISTENING");
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      currentAudioRef.current = null;
      setPipelineState("LISTENING");
      console.error("[Audio] Playback error");
    };

    audio.play().catch((err) => {
      console.error("[Audio] Failed to play:", err);
      URL.revokeObjectURL(url);
      currentAudioRef.current = null;
      setPipelineState("LISTENING");
    });

    audioChunksRef.current = [];
  }, []);

  const handleServerMessage = useCallback(
    (event: MessageEvent) => {
      if (event.data instanceof Blob) {
        audioChunksRef.current.push(event.data);
        return;
      }

      try {
        const msg = JSON.parse(event.data as string);

        switch (msg.type) {
          case "state": {
            const newState = msg.state as PipelineState;
            if (newState === "LISTENING" && currentAudioRef.current) {
              break;
            }
            setPipelineState(newState);
            break;
          }

          case "transcript":
            if (msg.isFinal) {
              setMessages((prev) => [
                ...prev,
                { role: "user", content: msg.text },
              ]);
              setCurrentTranscript("");
            } else {
              setCurrentTranscript(msg.text);
            }
            break;

          case "agent_response":
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: msg.text },
            ]);
            break;

          case "audio_end":
            playAudio();
            break;
        }
      } catch {
        console.error("[WS] Failed to parse message");
      }
    },
    [playAudio]
  );

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async (ws: WebSocket) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;

    const recorder = new MediaRecorder(stream, {
      mimeType: "audio/webm;codecs=opus",
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
        ws.send(e.data);
      }
    };

    recorder.start(RECORDER_TIMESLICE_MS);
    mediaRecorderRef.current = recorder;
    console.log("[Mic] Recording started");
  }, []);

  const connect = useCallback(
    (scenarioId: string) => {
      if (socketRef.current) {
        return;
      }

      setStatus("connecting");
      setMessages([]);
      setCurrentTranscript("");
      setPipelineState("IDLE");

      const url = `${WS_URL}?scenarioId=${encodeURIComponent(scenarioId)}&sessionId=${encodeURIComponent(sessionIdRef.current)}`;
      const ws = new WebSocket(url);
      ws.binaryType = "blob";

      ws.onopen = async () => {
        setStatus("connected");
        console.log("[WS] Connected to voice agent");

        ws.send(JSON.stringify({ type: "start" }));

        try {
          await startRecording(ws);
        } catch (err) {
          console.error("[Mic] Failed to start recording:", err);
          setStatus("error");
          ws.close(4000, "Microphone access denied");
        }
      };

      ws.onmessage = handleServerMessage;

      ws.onclose = (event) => {
        console.log(
          `[WS] Disconnected — code=${event.code} reason="${event.reason}"`
        );
        stopRecording();
        socketRef.current = null;
        setStatus("idle");
        setPipelineState("IDLE");
      };

      ws.onerror = (event) => {
        console.error("[WS] Connection error:", event);
        setStatus("error");
      };

      socketRef.current = ws;
    },
    [startRecording, stopRecording, handleServerMessage]
  );

  const disconnect = useCallback(() => {
    stopRecording();

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    if (socketRef.current) {
      if (socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "stop" }));
      }
      socketRef.current.close(1000, "User ended conversation");
      socketRef.current = null;
      setStatus("idle");
      setPipelineState("IDLE");
    }
  }, [stopRecording]);

  useEffect(() => {
    return () => {
      stopRecording();
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close(1000, "Component unmounted");
        socketRef.current = null;
      }
    };
  }, [stopRecording]);

  return {
    status,
    pipelineState,
    messages,
    currentTranscript,
    connect,
    disconnect,
  };
}
