import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { ChatMessage, KillEvent, MatchState, PlayerState, ProjectileState, WorldMetrics, WorldSnapshot, WorldStateUpdate } from "@promptcraft/shared";
import { WorldScene } from "./components/WorldScene";
import { FlightHUD } from "./components/FlightHUD";
import { Scoreboard } from "./components/Scoreboard";
import { startEngine, stopEngine, updateEngine, playGunfire, playDamage, playExplosion, playRespawn } from "./utils/audio";
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

const DEFAULT_MATCH_STATE: MatchState = {
  phase: "lobby",
  roundNumber: 1,
  scoreToWin: 10,
  roundDurationSeconds: 300,
  countdownRemainingSeconds: 0,
  roundRemainingSeconds: 0,
  winnerId: null,
  winnerName: null,
  winnerColor: null,
  nextRoundInSeconds: 0,
};

function formatClock(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [projectiles, setProjectiles] = useState<ProjectileState[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [metrics, setMetrics] = useState<WorldMetrics>({ playerCount: 0, projectileCount: 0, sessionAgeSeconds: 0 });
  const [match, setMatch] = useState<MatchState>(DEFAULT_MATCH_STATE);
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [killFeed, setKillFeed] = useState<KillEvent[]>([]);
  const [explosions, setExplosions] = useState<{ id: string; position: THREE.Vector3; createdAt: number }[]>([]);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [worldCode, setWorldCode] = useState<string | null>(() => getInitialWorldCode());
  const [worldCodeInput, setWorldCodeInput] = useState(() => getInitialWorldCode() ?? "");
  const [playerName, setPlayerName] = useState(() => (typeof localStorage !== "undefined" ? localStorage.getItem("playerName") || "" : ""));
  const [worldMenuMode, setWorldMenuMode] = useState<"menu" | "join">("menu");
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  
  const [health, setHealth] = useState(100);
  const [speed, setSpeed] = useState(0);
  const [altitude, setAltitude] = useState(0);
  const [heading, setHeading] = useState(0);
  const [kills, setKills] = useState(0);
  const [deaths, setDeaths] = useState(0);
  const localPositionRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const [localPosition, setLocalPosition] = useState<{ x: number; y: number; z: number } | null>(null);
  const engineStarted = useRef(false);

  useEffect(() => { updateWorldUrl(worldCode); }, [worldCode]);

  // Engine audio lifecycle
  useEffect(() => {
    if (pointerLocked && !engineStarted.current) {
      startEngine();
      engineStarted.current = true;
    }
    if (!pointerLocked && engineStarted.current) {
      stopEngine();
      engineStarted.current = false;
    }
    return () => {
      if (engineStarted.current) {
        stopEngine();
        engineStarted.current = false;
      }
    };
  }, [pointerLocked]);

  useEffect(() => {
    document.exitPointerLock?.();
    setPointerLocked(false);
    setPlayers([]); setProjectiles([]); setMessages([]); setKillFeed([]); setExplosions([]);
    setLocalPlayerId(null); setIsConnected(false);
    setKills(0); setDeaths(0); setHealth(100);
    setMatch(DEFAULT_MATCH_STATE);

    if (!worldCode) { setSocket(null); return; }

    if (typeof localStorage !== "undefined") {
      localStorage.setItem("playerName", playerName);
    }

    const nextSocket = io(serverUrl, { transports: ["websocket", "polling"], auth: { worldCode, playerName } });

    nextSocket.on("connect", () => { setIsConnected(true); setLocalPlayerId(nextSocket.id ?? null); });
    nextSocket.on("disconnect", () => { setIsConnected(false); });

    nextSocket.on("world:snapshot", (snapshot: WorldSnapshot) => {
      setPlayers(snapshot.players);
      setProjectiles(snapshot.projectiles);
      setMetrics(snapshot.metrics);
      setMatch(snapshot.match ?? DEFAULT_MATCH_STATE);
      setMessages(snapshot.chatHistory || []);
      setKillFeed(snapshot.recentKills || []);
      if (snapshot.worldCode && snapshot.worldCode !== worldCode) {
        setWorldCode(snapshot.worldCode);
        setWorldCodeInput(snapshot.worldCode);
      }
      // Restore our score from snapshot
      const me = snapshot.players.find(p => p.id === nextSocket.id);
      if (me) {
        setKills(me.kills);
        setDeaths(me.deaths);
        setHealth(me.health);
      }
    });

    nextSocket.on("world:state", (state: WorldStateUpdate) => {
      setPlayers(state.players);
      setProjectiles(state.projectiles);
      setMetrics(state.metrics);
      setMatch(state.match);
      // Update our score from state
      const me = state.players.find(p => p.id === nextSocket.id);
      if (me) {
        setKills(me.kills);
        setDeaths(me.deaths);
        setHealth(me.health);
      }
    });

    nextSocket.on("projectile:fired", (p: ProjectileState) => {
      setProjectiles(prev => [...prev.slice(-300), p]);
    });

    nextSocket.on("kill:event", (event: KillEvent) => {
      setKillFeed(prev => [...prev.slice(-10), event]);
    });

    nextSocket.on("player:destroyed", (data: { id: string }) => {
      if (data.id === nextSocket.id) {
        setHealth(0);
        playExplosion();
      }
      setPlayers(prev => {
        const p = prev.find(p => p.id === data.id);
        if (p) {
          setExplosions(ex => [...ex.slice(-20), { 
            id: `exp_${data.id}_${Date.now()}`, 
            position: new THREE.Vector3(p.position.x, p.position.y, p.position.z), 
            createdAt: Date.now() 
          }]);
        }
        return prev;
      });
    });

    nextSocket.on("player:respawned", (p: PlayerState) => {
      if (p.id === nextSocket.id) {
        setHealth(100);
        playRespawn();
      }
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

  // Client-side collision detection
  useEffect(() => {
    if (!socket || health <= 0 || !localPlayerId || match.phase !== "in_progress") return;
    const localP = players.find(p => p.id === localPlayerId);
    if (!localP) return;

    for (const p of projectiles) {
      if (p.ownerId === localPlayerId) continue;
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
        playDamage();
      }
    }
  }, [projectiles, socket, health, localPlayerId, players, match.phase]);

  const handleShellClick = useCallback(() => {
    if (!pointerLocked && worldCode) document.body.requestPointerLock();
  }, [pointerLocked, worldCode]);

  const handlePointerLockChange = useCallback((locked: boolean) => setPointerLocked(locked), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        setShowScoreboard(true);
      } else if (e.key === "t" || e.key === "T" || e.key === "Enter") {
        // If we are playing, not chatting, and hit T, open chat
        if (pointerLocked) {
          e.preventDefault();
          document.exitPointerLock?.();
          setIsChatting(true);
          setPointerLocked(false);
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        setShowScoreboard(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const handlePlayerMove = useCallback((state: any) => {
    const spd = state.velocity.length();
    setSpeed(spd);
    setAltitude(state.position.y);
    
    // Calculate heading from quaternion
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(state.quaternion);
    const hdg = Math.atan2(forward.x, -forward.z);
    setHeading(hdg);
    
    localPositionRef.current = { x: state.position.x, y: state.position.y, z: state.position.z };
    setLocalPosition({ x: state.position.x, y: state.position.y, z: state.position.z });

    updateEngine(spd);
    socket?.emit("player:input", state);
  }, [socket]);

  const handleFire = useCallback((pos: THREE.Vector3, vel: THREE.Vector3) => {
    if (!socket || match.phase !== "in_progress" || health <= 0) return;
    playGunfire();
    socket.emit("player:fire", {
      position: { x: pos.x, y: pos.y, z: pos.z },
      velocity: { x: vel.x, y: vel.y, z: vel.z },
    });
  }, [socket, match.phase, health]);

  const handleCrash = useCallback(() => {
    if (!socket || !localPlayerId || health <= 0 || match.phase !== "in_progress") return;
    socket.emit("player:hit", { targetId: localPlayerId, damage: 1000 });
  }, [socket, localPlayerId, health, match.phase]);

  const isRoundActive = match.phase === "in_progress";
  const bannerTitle =
    match.phase === "countdown"
      ? `ROUND ${match.roundNumber} STARTING`
      : match.phase === "in_progress"
      ? `ROUND ${match.roundNumber} LIVE`
      : match.winnerName
      ? `ROUND ${match.roundNumber} WINNER: ${match.winnerName.toUpperCase()}`
      : `ROUND ${match.roundNumber} DRAW`;
  const bannerMeta =
    match.phase === "countdown"
      ? `T-${match.countdownRemainingSeconds}s | First to ${match.scoreToWin}`
      : match.phase === "in_progress"
      ? `${formatClock(match.roundRemainingSeconds)} | First to ${match.scoreToWin}`
      : `Next round in ${match.nextRoundInSeconds}s`;

  return (
    <div className="app-shell" onClick={handleShellClick}>
      {worldCode && (
        <WorldScene
          players={players}
          projectiles={projectiles}
          explosions={explosions}
          localPlayerId={localPlayerId}
          pointerLocked={pointerLocked}
          health={health}
          onPointerLockChange={handlePointerLockChange}
          onPositionChange={handlePlayerMove}
          onFire={handleFire}
          onCrash={handleCrash}
        />
      )}

      {worldCode && (
        <div className="hud-top-left">
          <div className="game-title">AERO-CRAFT</div>
          <div className="hud-world-code">ROOM {worldCode}</div>
          <div className={`hud-match-phase hud-match-phase--${match.phase}`}>
            {match.phase.replace("_", " ").toUpperCase()}
          </div>
          <div className="hud-stats">
            <span className={`connection-dot ${isConnected ? "connected" : ""}`} />
            <span>{metrics.playerCount} pilot{metrics.playerCount !== 1 ? "s" : ""}</span>
          </div>
        </div>
      )}

      {worldCode && (
        <div className={`match-banner match-banner--${match.phase}`}>
          <div className="match-banner__title">{bannerTitle}</div>
          <div className="match-banner__meta">{bannerMeta}</div>
        </div>
      )}

      {worldCode && pointerLocked && isRoundActive && (
        <FlightHUD
          health={health}
          speed={speed}
          altitude={altitude}
          heading={heading}
          kills={kills}
          deaths={deaths}
          targets={players.filter(p => p.id !== localPlayerId && p.health > 0)}
          localPosition={localPosition}
          localPlayerId={localPlayerId}
          killFeed={killFeed}
        />
      )}

      {worldCode && showScoreboard && (
        <Scoreboard players={players} localPlayerId={localPlayerId} match={match} />
      )}

      {!worldCode && (
        <div className="world-gate">
          <div className="world-card">
            <div className="world-card__eyebrow">Multiplayer Dogfight</div>
            <h1>AERO-CRAFT</h1>
            <p>High-speed jet combat in a shared airspace. Spin up a room or join with a 4-character code.</p>
            
            <div className="world-player-info">
              <label>Callsign (Optional)</label>
              <input className="world-name-input" value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Maverick" maxLength={16} />
            </div>

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
            <div className="world-card__controls">
              <div className="controls-grid">
                <kbd>Mouse</kbd><span>Pitch & Yaw</span>
                <kbd>A / D</kbd><span>Roll</span>
                <kbd>Shift</kbd><span>Boost</span>
                <kbd>Ctrl</kbd><span>Brake</span>
                <kbd>Click</kbd><span>Fire</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {worldCode && !pointerLocked && !isChatting && (
        <div className="enter-world-hint">
          <div>Airspace {worldCode}</div>
          <span>Click to deploy</span>
        </div>
      )}

      <div className={`chat-overlay ${isChatting ? "chat-overlay--active" : "chat-overlay--visible"}`}>
        <div className="chat-messages">
          {messages.slice(-6).map((msg) => (
            <div key={msg.id} className={`chat-msg ${msg.isSystem ? "chat-msg--system" : ""}`}>
              {msg.isSystem ? <span>{msg.text}</span> : <span><span style={{color: msg.senderColor}}>{msg.sender}: </span>{msg.text}</span>}
            </div>
          ))}
        </div>
        {isChatting && (
          <div className="chat-input-container">
            <input
              autoFocus
              type="text"
              className="chat-input-field"
              placeholder="Send message..."
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (chatDraft.trim() && socket) {
                    socket.emit("chat:send", chatDraft.trim());
                  }
                  setChatDraft("");
                  setIsChatting(false);
                } else if (e.key === "Escape") {
                  setChatDraft("");
                  setIsChatting(false);
                }
              }}
              onBlur={() => {
                if (!chatDraft) setIsChatting(false);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
