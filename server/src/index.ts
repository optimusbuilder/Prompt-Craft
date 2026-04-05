import dotenv from "dotenv";
import path from "node:path";
dotenv.config({ path: path.resolve(import.meta.dirname, "../../.env") });
import http from "node:http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { WorldDirectory, isValidWorldCode, normalizeWorldCode } from "./world";
import type { PlayerInput, ProjectileState } from "@promptcraft/shared";

const port = Number(process.env.PORT ?? 3001);
const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: clientOrigin } });

const worlds = new WorldDirectory();

app.use(cors({ origin: clientOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, players: worlds.getTotalPlayerCount(), worlds: worlds.getWorlds().length });
});

function emitState() {
  for (const world of worlds.getWorlds()) {
    const players = world.getPlayers();
    const projectiles = world.getProjectiles();
    if (players.length > 0) {
      io.to(`world:${world.getWorldCode()}`).emit("world:state", { players, projectiles });
    }
  }
}

const stateTicker = setInterval(emitState, 50); // 20hz sync

io.on("connection", (socket) => {
  const requestedCode = normalizeWorldCode(socket.handshake.auth?.worldCode as string | undefined);
  const joined = worlds.joinWorld(socket.id, isValidWorldCode(requestedCode) ? requestedCode : undefined);

  socket.join(joined.roomName);
  socket.emit("world:snapshot", joined.world.getSnapshot());
  io.to(joined.roomName).emit("chat:message", joined.message);

  socket.on("player:input", (data: PlayerInput) => {
    const membership = worlds.getWorldForSocket(socket.id);
    if (membership) membership.world.updatePlayer(socket.id, data);
  });

  socket.on("player:fire", (data: ProjectileState) => {
    const membership = worlds.getWorldForSocket(socket.id);
    if (membership) {
      membership.world.addProjectile(data);
      io.to(membership.roomName).emit("projectile:fired", data);
    }
  });

  socket.on("player:hit", (data: { targetId: string; damage: number }) => {
    const membership = worlds.getWorldForSocket(socket.id);
    if (!membership) return;
    
    membership.world.damagePlayer(data.targetId, data.damage);
    const p = membership.world.getPlayers().find(p => p.id === data.targetId);
    if (p && p.health <= 0) {
      const killEvent = membership.world.recordKill(socket.id, data.targetId);
      if (killEvent) {
        io.to(membership.roomName).emit("kill:event", killEvent);
        const killMsg = membership.world.createSystemMessage(`☠️ ${killEvent.killerName} shot down ${killEvent.victimName}`);
        io.to(membership.roomName).emit("chat:message", killMsg);
      }
      io.to(membership.roomName).emit("player:destroyed", { id: data.targetId });
      setTimeout(() => {
        const respawnMsg = membership.world.respawnPlayer(data.targetId);
        if (respawnMsg) io.to(membership.roomName).emit("chat:message", respawnMsg);
        const respawned = membership.world.getPlayers().find(p => p.id === data.targetId);
        if (respawned) io.to(membership.roomName).emit("player:respawned", respawned);
      }, 3000);
    }
  });

  socket.on("chat:send", (text: string) => {
    const membership = worlds.getWorldForSocket(socket.id);
    if (membership) {
      const msg = membership.world.createChatMessage(socket.id, text);
      if (msg) io.to(membership.roomName).emit("chat:message", msg);
    }
  });

  socket.on("disconnect", () => {
    const left = worlds.leaveWorld(socket.id);
    if (left && left.message) {
      io.to(left.roomName).emit("chat:message", left.message);
    }
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Aero-Craft server listening on port ${port}`);
});

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
