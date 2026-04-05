import { useCallback, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { ChatMessage, PlayerState, ProjectileState, WorldMetrics, WorldSnapshot } from "@promptcraft/shared";
import { WorldScene } from "./components/WorldScene";
import { FlightHUD } from "./components/FlightHUD";
import * as THREE from "three";

const serverUrl = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";
const WORLD_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function sanitizeWorldCode(value: string) { return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4); }
function generateWorldCode() { return Array.from({ length: 4 }, () => WORLD_CODE_CHARS[Math.floor(Math.random() * WORLD_CODE_CHARS.length)]).join(""); }
function getInitialWorldCode() {
  if (typeof window === "undefined") return null;
  const code = sanitizeWorldCode(new URL(window.location.href).searchParams.get("world") ?? "");
  return code.length === 4 ? code : null;
}
function updateWorldUrl(worldCode: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (worldCode) url.searchParams.set("world", worldCode);
  else url.searchParams.delete("world");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [projectiles, setProjectiles] = useState<ProjectileState[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [metrics, setMetrics] = useState<WorldMetrics>({ playerCount: 0, projectileCount: 0, sessionAgeSeconds: 0 });
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [worldCode, setWorldCode] = useState<string | null>(() => getInitialWorldCode());
  const [worldCodeInput, setWorldCodeInput] = useState(() => getInitialWorldCode() ?? "");
  const [worldMenuMode, setWorldMenuMode] = useState<"menu" | "join">("menu");
  
  const [health, setHealth] = useState(100);
  const [speed, setSpeed] = useState(0);
  const [altitude, setAltitude] = useState(0);

  useEffect(() => { updateWorldUrl(worldCode); }, [worldCode]);

  useEffect(() => {
    document.exitPointerLock?.();
    setPointerLocked(false);
    setPlayers([]); setProjectiles([]); setMessages([]); setLocalPlayerId(null); setIsConnected(false);

    if (!worldCode) { setSocket(null); return; }

    const nextSocket = io(serverUrl, { transports: ["websocket", "polling"], auth: { worldCode } });

    nextSocket.on("connect", () => { setIsConnected(true); setLocalPlayerId(nextSocket.id ?? null); });
    nextSocket.on("disconnect", () => { setIsConnected(false); });

    nextSocket.on("world:snapshot", (snapshot: WorldSnapshot) => {
      setPlayers(snapshot.players);
      setProjectiles(snapshot.projectiles);
      setMetrics(snapshot.metrics);
      setMessages(snapshot.chatHistory || []);
      if (snapshot.worldCode && snapshot.worldCode !== worldCode) { setWorldCode(snapshot.worldCode); setWorldCodeInput(snapshot.worldCode); }
    });

    nextSocket.on("world:state", (state: { players: PlayerState[], projectiles: ProjectileState[] }) => {
      setPlayers(state.players);
      setProjectiles(state.projectiles);
    });

    nextSocket.on("projectile:fired", (p: ProjectileState) => {
      setProjectiles(prev => [...prev.slice(-300), p]);
    });

    nextSocket.on("player:respawned", (p: PlayerState) => {
      if (p.id === nextSocket.id) setHealth(100);
    });

    nextSocket.on("chat:message", (msg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev.slice(-50), msg];
      });
    });

    setSocket(nextSocket);
    return () => { nextSocket.disconnect(); setSocket(c => c === nextSocket ? null : c); };
  }, [worldCode]);

  useEffect(() => {
    // Basic Client-Side Collision
    if (!socket || health <= 0 || !localPlayerId) return;
    const localP = players.find(p => p.id === localPlayerId);
    if (!localP) return;

    for (const p of projectiles) {
      if (p.ownerId === localPlayerId) continue;
      // Interpolate projectile position based on age
      const age = (Date.now() - p.createdAt) / 1000;
      const currentPos = new THREE.Vector3(
        p.position.x + p.velocity.x * age,
        p.position.y + p.velocity.y * age,
        p.position.z + p.velocity.z * age
      );

      const dist = Math.sqrt(
        Math.pow(currentPos.x - localP.position.x, 2) + 
        Math.pow(currentPos.y - localP.position.y, 2) + 
        Math.pow(currentPos.z - localP.position.z, 2)
      );
      if (dist < 8) {
        socket.emit("player:hit", { targetId: localPlayerId, damage: 20 });
        setHealth(h => Math.max(0, h - 20));
      }
    }
  }, [projectiles, socket, health, localPlayerId, players]);

  const handleShellClick = useCallback(() => {
    if (!pointerLocked && worldCode) document.body.requestPointerLock();
  }, [pointerLocked, worldCode]);

  const handlePointerLockChange = useCallback((locked: boolean) => setPointerLocked(locked), []);

  const handlePlayerMove = useCallback((state: any) => {
    setSpeed(state.velocity.length());
    setAltitude(state.position.y);
    socket?.emit("player:input", state);
  }, [socket]);

  const handleFire = useCallback((pos: THREE.Vector3, vel: THREE.Vector3) => {
    if (!socket) return;
    socket.emit("player:fire", {
      id: `proj_${Date.now()}_${Math.random()}`,
      ownerId: localPlayerId,
      position: pos,
      velocity: vel,
      createdAt: Date.now()
    });
  }, [socket, localPlayerId]);

  return (
    <div className="app-shell" onClick={handleShellClick}>
      {worldCode && (
        <WorldScene
          players={players}
          projectiles={projectiles}
          localPlayerId={localPlayerId}
          pointerLocked={pointerLocked}
          health={health}
          onPointerLockChange={handlePointerLockChange}
          onPositionChange={handlePlayerMove}
          onFire={handleFire}
        />
      )}

      {worldCode && (
        <div className="hud-top-left">
          <div className="game-title">Aero-Craft</div>
          <div className="hud-world-code">ROOM {worldCode}</div>
          <div className="hud-stats">
            <span className={`connection-dot ${isConnected ? "connected" : ""}`} />
            <span>{metrics.playerCount} pilot{metrics.playerCount !== 1 ? "s" : ""}</span>
          </div>
        </div>
      )}

      {worldCode && pointerLocked && (
        <FlightHUD health={health} speed={speed} altitude={altitude} targets={players.filter(p => p.id !== localPlayerId)} />
      )}

      {!worldCode && (
        <div className="world-gate">
          <div className="world-card">
            <div className="world-card__eyebrow">Dogfight Arena</div>
            <h1>Aero-Craft</h1>
            <p>High-speed multiplayer flight combat. Spin up a room or join with a 4-character code.</p>
            <div className="world-card__actions">
              <button className="world-button world-button--primary" onClick={() => { const code = generateWorldCode(); setWorldCodeInput(code); setWorldCode(code); }}>Deploy Airspace</button>
              <button className="world-button world-button--secondary" onClick={() => setWorldMenuMode("join")}>Join Airspace</button>
            </div>
            {worldMenuMode === "join" && (
              <div className="world-join-panel">
                <label>Airspace Code</label>
                <div className="world-join-panel__row">
                  <input className="world-code-input" value={worldCodeInput} onChange={(e) => setWorldCodeInput(sanitizeWorldCode(e.target.value))} onKeyDown={(e) => { if (e.key === "Enter" && sanitizeWorldCode(worldCodeInput).length === 4) setWorldCode(sanitizeWorldCode(worldCodeInput)); }} placeholder="AB12" maxLength={4} />
                  <button className="world-button world-button--primary" onClick={() => setWorldCode(sanitizeWorldCode(worldCodeInput))} disabled={sanitizeWorldCode(worldCodeInput).length !== 4}>Enter</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {worldCode && !pointerLocked && (
        <div className="enter-world-hint">
          <div>Airspace {worldCode} ready</div>
          <span>Click to deploy</span>
        </div>
      )}

      <div className={`chat-overlay chat-overlay--visible`}>
        <div className="chat-messages">
          {messages.slice(-5).map((msg) => (
            <div key={msg.id} className={`chat-msg ${msg.isSystem ? "chat-msg--system" : ""}`}>
              {msg.isSystem ? <span>{msg.text}</span> : <span><span style={{color: msg.senderColor}}>{msg.sender}: </span>{msg.text}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
