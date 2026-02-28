export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";
export const RECORDER_TIMESLICE_MS = 80;

export const STATUS_CONFIG = {
  idle: { label: "Ready", color: "bg-muted-foreground" },
  connecting: { label: "Connecting…", color: "bg-yellow-500" },
  connected: { label: "Connected", color: "bg-emerald-500" },
  error: { label: "Connection failed", color: "bg-destructive" },
} as const;
