import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

import { VoicePipeline } from "./pipeline/index.js";
import { getScenario, getScenarioIds } from "./scenarios/index.js";

const app = express();
const server = createServer(app);

const PORT = Number(process.env.PORT) || 8000;

// Health Check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    activeConnections: wss.clients.size,
  });
});

// WebSocket Server
const wss = new WebSocketServer({ server });

wss.on("connection", (socket, req) => {
  // Parse query parameters from the upgrade URL
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  const scenarioId = url.searchParams.get("scenarioId");
  const sessionId = url.searchParams.get("sessionId") || crypto.randomUUID();

  console.log(
    `[WS] New connection — scenarioId="${scenarioId}" sessionId="${sessionId}"`
  );

  // Validate scenario
  if (!scenarioId) {
    console.warn(
      `[WS] Rejected: missing scenarioId. Valid IDs: ${getScenarioIds().join(", ")}`
    );
    socket.close(4001, "Missing required query param: scenarioId");
    return;
  }

  const scenario = getScenario(scenarioId);
  if (!scenario) {
    console.warn(
      `[WS] Rejected: unknown scenarioId="${scenarioId}". Valid IDs: ${getScenarioIds().join(", ")}`
    );
    socket.close(
      4002,
      `Unknown scenarioId: ${scenarioId}. Valid: ${getScenarioIds().join(", ")}`
    );
    return;
  }

  // Initialize voice pipeline for this connection
  const pipeline = new VoicePipeline({
    socket,
    scenario,
    sessionId,
  });

  // Route messages to the pipeline
  socket.on("message", (data, isBinary) => {
    pipeline.handleMessage(data as Buffer | string, isBinary);
  });

  socket.on("close", (code, reason) => {
    console.log(
      `[WS] Client disconnected — session="${sessionId}" code=${code} reason="${reason}"`
    );
    pipeline.destroy();
  });

  socket.on("error", (error) => {
    console.error(`[WS] Socket error — session="${sessionId}":`, error);
    pipeline.destroy();
  });
});

wss.on("error", (error) => {
  console.error("[WS] Server error:", error);
});

// Start Server
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(
    `WebSocket endpoint: ws://localhost:${PORT}?scenarioId=<id>&sessionId=<optional>`
  );
});
