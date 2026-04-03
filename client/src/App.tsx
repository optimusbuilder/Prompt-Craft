import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type {
  ChatMessage,
  PlayerState,
  SceneObject,
  WorldMetrics,
  WorldSnapshot,
} from "@promptcraft/shared";
import { WorldScene } from "./components/WorldScene";
import { PromptConsole } from "./components/PromptConsole";
import { Hotbar } from "./components/Hotbar";

const serverUrl = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";
const WORLD_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const defaultMetrics: WorldMetrics = {
  objectCount: 0,
  totalPrompts: 0,
  districtCount: 0,
  archetypeVariety: 0,
  paletteVariety: 0,
  sessionAgeSeconds: 0,
  playerCount: 0,
};

function sanitizeWorldCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

function generateWorldCode() {
  return Array.from({ length: 4 }, () => {
    const index = Math.floor(Math.random() * WORLD_CODE_CHARS.length);
    return WORLD_CODE_CHARS[index];
  }).join("");
}

function getInitialWorldCode() {
  if (typeof window === "undefined") return null;
  const code = sanitizeWorldCode(new URL(window.location.href).searchParams.get("world") ?? "");
  return code.length === 4 ? code : null;
}

function updateWorldUrl(worldCode: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (worldCode) {
    url.searchParams.set("world", worldCode);
  } else {
    url.searchParams.delete("world");
  }
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [objects, setObjects] = useState<SceneObject[]>([]);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [metrics, setMetrics] = useState<WorldMetrics>(defaultMetrics);
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0, z: 0 });
  const [playerRot, setPlayerRot] = useState({ x: 0, y: 0 });
  const [worldCode, setWorldCode] = useState<string | null>(() => getInitialWorldCode());
  const [worldCodeInput, setWorldCodeInput] = useState(() => getInitialWorldCode() ?? "");
  const [worldMenuMode, setWorldMenuMode] = useState<"menu" | "join">("menu");
  const [buildPulse, setBuildPulse] = useState(0);
  const positionThrottle = useRef(0);

  useEffect(() => {
    updateWorldUrl(worldCode);
  }, [worldCode]);

  useEffect(() => {
    document.exitPointerLock?.();
    setPointerLocked(false);
    setChatOpen(false);
    setObjects([]);
    setPlayers([]);
    setMetrics(defaultMetrics);
    setMessages([]);
    setLocalPlayerId(null);
    setIsConnected(false);

    if (!worldCode) {
      setSocket(null);
      return;
    }

    const nextSocket = io(serverUrl, {
      transports: ["websocket", "polling"],
      auth: { worldCode },
    });

    nextSocket.on("connect", () => {
      setIsConnected(true);
      setLocalPlayerId(nextSocket.id ?? null);
    });

    nextSocket.on("disconnect", () => {
      setIsConnected(false);
    });

    nextSocket.on("world:snapshot", (snapshot: WorldSnapshot) => {
      setObjects(snapshot.objects);
      setMetrics(snapshot.metrics);
      setPlayers(snapshot.players || []);
      setMessages(snapshot.chatHistory || []);
      if (snapshot.worldCode && snapshot.worldCode !== worldCode) {
        setWorldCode(snapshot.worldCode);
        setWorldCodeInput(snapshot.worldCode);
      }
    });

    nextSocket.on("world:objectAdded", (object: SceneObject) => {
      setObjects((current) => [...current.filter((entry) => entry.id !== object.id), object]);
    });

    nextSocket.on("world:status", (nextMetrics: WorldMetrics) => {
      setMetrics(nextMetrics);
    });

    nextSocket.on("players:update", (playerList: PlayerState[]) => {
      setPlayers(playerList);
    });

    nextSocket.on("chat:message", (msg: ChatMessage) => {
      setMessages((prev) => [...prev.slice(-50), msg]);
    });

    setSocket(nextSocket);

    return () => {
      nextSocket.disconnect();
      setSocket((current) => (current === nextSocket ? null : current));
    };
  }, [worldCode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "t" || e.key === "T" || e.key === "/") && !chatOpen && pointerLocked && worldCode) {
        e.preventDefault();
        setChatOpen(true);
        document.exitPointerLock();
      }

      if (e.key === "F3") {
        e.preventDefault();
        setShowDebug((prev) => !prev);
      }

      const num = Number.parseInt(e.key, 10);
      if (num >= 1 && num <= 9 && !chatOpen && worldCode) {
        setSelectedSlot(num - 1);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [chatOpen, pointerLocked, worldCode]);

  const handlePointerLockChange = useCallback((locked: boolean) => {
    setPointerLocked(locked);
  }, []);

  const handlePlayerMove = useCallback(
    (position: { x: number; y: number; z: number }, rotation: { x: number; y: number }) => {
      setPlayerPos(position);
      setPlayerRot(rotation);

      const now = Date.now();
      if (now - positionThrottle.current > 100) {
        positionThrottle.current = now;
        socket?.emit("player:move", { position, rotation });
      }
    },
    [socket]
  );

  const handlePromptSubmit = useCallback(
    (prompt: string) => {
      if (!worldCode) return;
      socket?.emit("prompt:submit", { prompt, position: playerPos, rotation: playerRot });
      setBuildPulse((pulse) => pulse + 1);
      setChatOpen(false);

      setTimeout(() => {
        document.body.requestPointerLock();
      }, 100);
    },
    [socket, playerPos, worldCode]
  );

  const handleObjectDelete = useCallback((objectId: string) => {
    socket?.emit("prompt:delete", { objectId });
  }, [socket]);

  const handleChatClose = useCallback(() => {
    setChatOpen(false);
    setTimeout(() => {
      document.body.requestPointerLock();
    }, 100);
  }, []);

  const handleCreateWorld = useCallback(() => {
    const nextCode = generateWorldCode();
    setWorldCodeInput(nextCode);
    setWorldCode(nextCode);
  }, []);

  const handleJoinWorld = useCallback(() => {
    const nextCode = sanitizeWorldCode(worldCodeInput);
    if (nextCode.length !== 4) return;
    setWorldCodeInput(nextCode);
    setWorldCode(nextCode);
  }, [worldCodeInput]);

  const featuredObject = useMemo(
    () =>
      objects.reduce<SceneObject | null>(
        (latest, object) => (!latest || object.createdAt > latest.createdAt ? object : latest),
        null
      ),
    [objects]
  );

  const recentBuilds = useMemo(
    () => [...objects].sort((a, b) => b.createdAt - a.createdAt).slice(0, 9),
    [objects]
  );

  const localPlayerColor = useMemo(
    () => players.find((player) => player.id === localPlayerId)?.color ?? "#f39c12",
    [players, localPlayerId]
  );

  const sharePath = worldCode ? `?world=${worldCode}` : "";

  return (
    <div className="app-shell">
      <WorldScene
        objects={objects}
        metrics={metrics}
        featuredObject={featuredObject}
        players={players}
        localPlayerId={localPlayerId}
        pointerLocked={pointerLocked}
        localPlayerColor={localPlayerColor}
        buildPulse={buildPulse}
        onPointerLockChange={handlePointerLockChange}
        onPlayerMove={handlePlayerMove}
        onObjectDelete={handleObjectDelete}
      />

      {pointerLocked && worldCode && <div className="crosshair" />}

      {worldCode && (
        <div className="hud-top-left">
          <div className="game-title">Prompt-Craft</div>
          <div className="hud-world-code">WORLD {worldCode}</div>
          <div className="hud-stats">
            <span className={`connection-dot ${isConnected ? "connected" : ""}`} />
            <span>{metrics.playerCount} player{metrics.playerCount !== 1 ? "s" : ""}</span>
            <span className="hud-divider">·</span>
            <span>{metrics.objectCount} builds</span>
          </div>
          <div className="hud-share-link">{sharePath}</div>
        </div>
      )}

      {showDebug && worldCode && (
        <div className="debug-overlay">
          <div>Prompt-Craft v0.2.0</div>
          <div>World: {worldCode}</div>
          <div>XYZ: {playerPos.x} / {playerPos.y} / {playerPos.z}</div>
          <div>Objects: {metrics.objectCount}</div>
          <div>Players: {metrics.playerCount}</div>
          <div>Archetypes: {metrics.archetypeVariety}</div>
          <div>Palettes: {metrics.paletteVariety}</div>
        </div>
      )}

      {!chatOpen && pointerLocked && worldCode && (
        <div className="prompt-hint-overlay">
          Press <kbd>T</kbd> to build
        </div>
      )}

      {worldCode && !pointerLocked && !chatOpen && (
        <div className="enter-world-hint">
          <div>World {worldCode} ready</div>
          <span>Click the scene to explore and build</span>
        </div>
      )}

      {!worldCode && (
        <div className="world-gate">
          <div className="world-card">
            <div className="world-card__eyebrow">Multiplayer Rooms</div>
            <h1>Prompt-Craft</h1>
            <p>Spin up a new shared world or jump into one with a 4-character code.</p>

            <div className="world-card__actions">
              <button className="world-button world-button--primary" onClick={handleCreateWorld}>
                Create World
              </button>
              <button
                className="world-button world-button--secondary"
                onClick={() => setWorldMenuMode("join")}
              >
                Join World
              </button>
            </div>

            {worldMenuMode === "join" && (
              <div className="world-join-panel">
                <label htmlFor="world-code-input">World Code</label>
                <div className="world-join-panel__row">
                  <input
                    id="world-code-input"
                    className="world-code-input"
                    value={worldCodeInput}
                    onChange={(event) => setWorldCodeInput(sanitizeWorldCode(event.target.value))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") handleJoinWorld();
                    }}
                    placeholder="AB12"
                    autoComplete="off"
                    maxLength={4}
                  />
                  <button
                    className="world-button world-button--primary"
                    onClick={handleJoinWorld}
                    disabled={sanitizeWorldCode(worldCodeInput).length !== 4}
                  >
                    Enter
                  </button>
                </div>
                <span className="world-join-panel__hint">
                  Codes are shareable links and reconnect on refresh.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {worldCode && (
        <>
          <PromptConsole
            disabled={!socket}
            visible={chatOpen}
            messages={messages}
            onSubmit={handlePromptSubmit}
            onClose={handleChatClose}
          />

          <Hotbar
            recentBuilds={recentBuilds}
            selectedSlot={selectedSlot}
            onSelectSlot={setSelectedSlot}
          />
        </>
      )}
    </div>
  );
}
