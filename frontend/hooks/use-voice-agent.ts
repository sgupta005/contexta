"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RECORDER_TIMESLICE_MS, WS_URL } from "@/lib/constants";
import type { Message, PipelineState, VoiceAgentStatus } from "@/lib/types";

const TTS_SAMPLE_RATE = 24000;

export function useVoiceAgent() {
  const [status, setStatus] = useState<VoiceAgentStatus>("idle");
  const [pipelineState, setPipelineState] = useState<PipelineState>("IDLE");

  // all the messages that have been exchanged between user and agent
  const [messages, setMessages] = useState<Message[]>([]);
  // user's speach that is currently being transcribed
  const [currentTranscript, setCurrentTranscript] = useState("");
  // true while we are streaming agent response
  const isStreamingAgentRef = useRef(false);

  const socketRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  // keep track of the time when the next chunk should be played
  const nextPlayTimeRef = useRef(0);
  // keep track of number of audio chunks that are yet to be played
  const activeSourceCountRef = useRef(0);
  const audioEndReceivedRef = useRef(false);

  const stopAudioPlayback = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    nextPlayTimeRef.current = 0;
    activeSourceCountRef.current = 0;
    audioEndReceivedRef.current = false;
  }, []);

  const checkPlaybackComplete = useCallback(() => {
    if (activeSourceCountRef.current === 0 && audioEndReceivedRef.current) {
      audioEndReceivedRef.current = false;
      const ws = socketRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "audio_playback_complete" }));
      }
    }
  }, []);

  const scheduleAudioChunk = useCallback(
    (pcmData: ArrayBuffer) => {
      const ctx = audioContextRef.current;
      if (!ctx || pcmData.byteLength === 0) return;

      const int16 = new Int16Array(pcmData);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }

      const buffer = ctx.createBuffer(1, float32.length, TTS_SAMPLE_RATE);
      buffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      const startTime = Math.max(nextPlayTimeRef.current, now);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + buffer.duration;

      activeSourceCountRef.current++;
      source.onended = () => {
        activeSourceCountRef.current--;
        checkPlaybackComplete();
      };
    },
    [checkPlaybackComplete]
  );

  const handleServerMessage = useCallback(
    (event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        scheduleAudioChunk(event.data);
        return;
      }

      try {
        const msg = JSON.parse(event.data as string);

        switch (msg.type) {
          case "state":
            setPipelineState(msg.state as PipelineState);
            break;

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
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (isStreamingAgentRef.current && last?.role === "assistant") {
                return [
                  ...prev.slice(0, -1),
                  { role: "assistant", content: last.content + msg.text },
                ];
              }
              isStreamingAgentRef.current = true;
              return [...prev, { role: "assistant", content: msg.text }];
            });
            break;

          case "audio_end":
            isStreamingAgentRef.current = false;
            audioEndReceivedRef.current = true;
            checkPlaybackComplete();
            break;

          case "barge_in":
            stopAudioPlayback();
            audioContextRef.current = new AudioContext({
              sampleRate: TTS_SAMPLE_RATE,
            });
            isStreamingAgentRef.current = false;
            break;
        }
      } catch {
        console.error("[WS] Failed to parse message");
      }
    },
    [scheduleAudioChunk, checkPlaybackComplete, stopAudioPlayback]
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
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
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
      isStreamingAgentRef.current = false;

      // Create AudioContext early — requires user gesture context
      stopAudioPlayback();
      audioContextRef.current = new AudioContext({
        sampleRate: TTS_SAMPLE_RATE,
      });

      const url = `${WS_URL}?scenarioId=${encodeURIComponent(scenarioId)}&sessionId=${encodeURIComponent(sessionIdRef.current)}`;
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";

      ws.onopen = async () => {
        setStatus("connected");
        console.log("[WS] Connected to voice agent");

        try {
          await startRecording(ws);
        } catch (err) {
          console.error("[Mic] Failed to start recording:", err);
          setStatus("error");
          ws.close(4000, "Microphone access denied");
        }

        ws.send(JSON.stringify({ type: "start" }));
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
    [startRecording, stopRecording, stopAudioPlayback, handleServerMessage]
  );

  const disconnect = useCallback(() => {
    stopRecording();
    stopAudioPlayback();

    if (socketRef.current) {
      if (socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "stop" }));
      }
      socketRef.current.close(1000, "User ended conversation");
      socketRef.current = null;
      setStatus("idle");
      setPipelineState("IDLE");
    }
  }, [stopRecording, stopAudioPlayback]);

  useEffect(() => {
    return () => {
      stopRecording();
      stopAudioPlayback();
      if (socketRef.current) {
        socketRef.current.close(1000, "Component unmounted");
        socketRef.current = null;
      }
    };
  }, [stopRecording, stopAudioPlayback]);

  return {
    isStreamingResponse: isStreamingAgentRef.current,
    status,
    pipelineState,
    messages,
    currentTranscript,
    connect,
    disconnect,
  };
}
