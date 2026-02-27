import type { IncomingMessage } from "http";
import type { WebSocket } from "ws";

import { VoicePipeline } from "../pipeline/index.js";
import { getScenario, getScenarioIds } from "../scenarios/index.js";

export function handleWebsocketConnection(
  socket: WebSocket,
  req: IncomingMessage
) {
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
}
