import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

import { handleWebsocketConnection } from "./websocket/handle-websocket-connection.js";

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

wss.on("connection", handleWebsocketConnection);

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
