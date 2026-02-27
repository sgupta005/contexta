import "dotenv/config";
import express from "express";
import { createServer } from "http";

const app = express();
const server = createServer(app);

const PORT = Number(process.env.PORT) || 8000;

// Health Check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(
    `Server listening on http://localhost:${PORT}`
  );
});
