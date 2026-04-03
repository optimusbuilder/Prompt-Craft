import dotenv from "dotenv";
import path from "node:path";
dotenv.config({ path: path.resolve(import.meta.dirname, "../../.env") });
import http from "node:http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import type { PromptSubmission } from "@promptcraft/shared";
import { WorldDirectory, isValidWorldCode, normalizeWorldCode } from "./world";

const port = Number(process.env.PORT ?? 3001);
const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: clientOrigin,
  },
});

const worlds = new WorldDirectory();

app.use(
  cors({
    origin: clientOrigin,
  })
);
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    worlds: worlds.getWorlds().length,
    players: worlds.getTotalPlayerCount(),
    objects: worlds.getWorlds().reduce((sum, world) => sum + world.getSnapshot().objects.length, 0),
  });
});

function emitPlayers() {
  for (const world of worlds.getWorlds()) {
    const players = world.getPlayers();
    if (players.length > 0) {
      io.to(`world:${world.getWorldCode()}`).emit("players:update", players);
    }
  }
}

function emitMetrics() {
  for (const world of worlds.getWorlds()) {
    io.to(`world:${world.getWorldCode()}`).emit("world:status", world.getMetrics());
  }
}

const playerTicker = setInterval(emitPlayers, 100);
const metricsTicker = setInterval(emitMetrics, 5000);

io.on("connection", (socket) => {
  const requestedCode = normalizeWorldCode(socket.handshake.auth?.worldCode as string | undefined);
  const joined = worlds.joinWorld(socket.id, isValidWorldCode(requestedCode) ? requestedCode : undefined);

  socket.join(joined.roomName);
  socket.emit("world:snapshot", joined.world.getSnapshot());
  io.to(joined.roomName).emit("chat:message", joined.message);
  io.to(joined.roomName).emit("world:status", joined.world.getMetrics());

  socket.on("prompt:submit", async (submission: PromptSubmission) => {
    const membership = worlds.getWorldForSocket(socket.id);
    if (!membership || !submission.prompt.trim()) return;

    const genMsg = membership.world.createChatMessage(
      socket.id,
      `Generating: "${submission.prompt}"...`
    );
    if (genMsg) io.to(membership.roomName).emit("chat:message", genMsg);

    const { object, metrics, usedAI } = await membership.world.addPrompt(submission);
    io.to(membership.roomName).emit("world:objectAdded", object);
    io.to(membership.roomName).emit("world:status", metrics);

    const label = usedAI ? "🤖 AI Built" : "⚒️ Built";
    const buildMsg = membership.world.createChatMessage(
      socket.id,
      `${label}: ${submission.prompt} (${object.voxels.length} blocks)`
    );
    if (buildMsg) io.to(membership.roomName).emit("chat:message", buildMsg);
  });

  socket.on(
    "player:move",
    (data: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number } }) => {
      const membership = worlds.getWorldForSocket(socket.id);
      membership?.world.updatePlayerPosition(socket.id, data.position, data.rotation);
    }
  );

  socket.on("disconnect", () => {
    const left = worlds.leaveWorld(socket.id);
    if (!left) return;

    if (left.message) {
      io.to(left.roomName).emit("chat:message", left.message);
    }
    io.to(left.roomName).emit("world:status", left.world.getMetrics());
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Prompt-Craft server listening on http://0.0.0.0:${port}`);
});

function shutdown() {
  clearInterval(playerTicker);
  clearInterval(metricsTicker);
  io.close();
  server.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
