import type { ChatMessage, KillEvent, PlayerState, ProjectileState, Vector3, WorldMetrics, WorldSnapshot, PlayerInput } from "@promptcraft/shared";

const WORLD_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function createRoomName(worldCode: string) {
  return `world:${worldCode}`;
}

export function normalizeWorldCode(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

export function isValidWorldCode(value: string | null | undefined): value is string {
  return normalizeWorldCode(value).length === 4;
}

const PLAYER_COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c", "#e67e22", "#e91e63", "#00bcd4", "#8bc34a"];

const CALLSIGNS = [
  "Maverick", "Viper", "Iceman", "Goose", "Jester",
  "Phoenix", "Rooster", "Hangman", "Merlin", "Cougar",
  "Ghost", "Reaper", "Blaze", "Storm", "Hawk",
  "Raven", "Cobra", "Wolf", "Ace", "Shadow"
];

export class WorldState {
  private readonly worldCode: string;
  private players = new Map<string, PlayerState>();
  private projectiles = new Map<string, ProjectileState>();
  private chatHistory: ChatMessage[] = [];
  private recentKills: KillEvent[] = [];
  private sessionStartedAt = Date.now();
  private playerColorIndex = 0;
  private callsignIndex = 0;

  constructor(worldCode: string) {
    this.worldCode = worldCode;
    this.createSystemMessage(`Airspace ${worldCode} online — weapons hot`);
  }

  getWorldCode() { return this.worldCode; }

  getMetrics(now = Date.now()): WorldMetrics {
    return {
      playerCount: this.players.size,
      projectileCount: this.projectiles.size,
      sessionAgeSeconds: Math.floor((now - this.sessionStartedAt) / 1000),
    };
  }

  getSnapshot(): WorldSnapshot {
    return {
      players: Array.from(this.players.values()),
      projectiles: Array.from(this.projectiles.values()),
      metrics: this.getMetrics(),
      chatHistory: [...this.chatHistory],
      worldCode: this.worldCode,
      recentKills: [...this.recentKills],
    };
  }

  addPlayer(id: string) {
    const color = PLAYER_COLORS[this.playerColorIndex % PLAYER_COLORS.length];
    this.playerColorIndex++;
    const name = CALLSIGNS[this.callsignIndex % CALLSIGNS.length];
    this.callsignIndex++;
    const position = { x: (Math.random() - 0.5) * 500, y: 300 + Math.random() * 100, z: (Math.random() - 0.5) * 500 };
    const player: PlayerState = {
      id, name, color,
      position,
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      velocity: { x: 0, y: 0, z: -50 },
      health: 100,
      kills: 0,
      deaths: 0,
    };
    this.players.set(id, player);
    const msg = this.createSystemMessage(`${name} entered airspace`);
    return { player, message: msg };
  }

  removePlayer(id: string) {
    const player = this.players.get(id);
    if (!player) return null;
    this.players.delete(id);
    return this.createSystemMessage(`${player.name} left airspace`);
  }

  updatePlayer(id: string, input: PlayerInput) {
    const player = this.players.get(id);
    if (!player) return;
    player.position = input.position;
    player.quaternion = input.quaternion;
    player.velocity = input.velocity;
  }
  
  damagePlayer(id: string, amount: number) {
    const player = this.players.get(id);
    if (!player) return;
    player.health -= amount;
    if (player.health < 0) player.health = 0;
  }

  recordKill(killerId: string, victimId: string): KillEvent | null {
    const killer = this.players.get(killerId);
    const victim = this.players.get(victimId);
    if (!killer || !victim) return null;

    killer.kills++;
    victim.deaths++;

    const event: KillEvent = {
      killerId: killer.id,
      killerName: killer.name,
      killerColor: killer.color,
      victimId: victim.id,
      victimName: victim.name,
      victimColor: victim.color,
      timestamp: Date.now(),
    };

    this.recentKills.push(event);
    if (this.recentKills.length > 10) this.recentKills.shift();

    return event;
  }

  respawnPlayer(id: string) {
    const player = this.players.get(id);
    if (!player) return;
    player.health = 100;
    player.position = { x: (Math.random() - 0.5) * 500, y: 300 + Math.random() * 100, z: (Math.random() - 0.5) * 500 };
    return this.createSystemMessage(`🔄 ${player.name} back in the air`);
  }

  addProjectile(p: ProjectileState) {
    this.projectiles.set(p.id, p);
    setTimeout(() => {
      this.projectiles.delete(p.id);
    }, 3000);
  }
  
  getProjectiles() {
    return Array.from(this.projectiles.values());
  }

  getPlayers() {
    return Array.from(this.players.values());
  }

  createChatMessage(senderId: string, text: string) {
    const player = this.players.get(senderId);
    if (!player) return null;
    const msg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sender: player.name, senderColor: player.color, text,
      timestamp: Date.now(), isSystem: false,
    };
    this.chatHistory.push(msg);
    if (this.chatHistory.length > 50) this.chatHistory.shift();
    return msg;
  }

  createSystemMessage(text: string) {
    const msg: ChatMessage = {
      id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sender: "AWACS", senderColor: "#ffff55", text,
      timestamp: Date.now(), isSystem: true,
    };
    this.chatHistory.push(msg);
    if (this.chatHistory.length > 50) this.chatHistory.shift();
    return msg;
  }
}

export class WorldDirectory {
  private worlds = new Map<string, WorldState>();
  private socketToWorld = new Map<string, string>();
  private generatedCodes = 0;

  createWorldCode() {
    let attempts = 0;
    while (attempts < WORLD_CODE_CHARS.length ** 2) {
      let value = this.generatedCodes++ + 17;
      let code = "";
      for (let i = 0; i < 4; i++) {
        value = (value * 31 + 7) % WORLD_CODE_CHARS.length ** 2;
        code += WORLD_CODE_CHARS[value % WORLD_CODE_CHARS.length];
      }
      if (!this.worlds.has(code)) return code;
      attempts++;
    }
    throw new Error("Unable to create code");
  }

  getOrCreateWorld(requestedCode?: string | null) {
    const normalized = isValidWorldCode(requestedCode) ? normalizeWorldCode(requestedCode) : this.createWorldCode();
    let world = this.worlds.get(normalized);
    if (!world) {
      world = new WorldState(normalized);
      this.worlds.set(normalized, world);
    }
    return { roomName: createRoomName(normalized), world, worldCode: normalized };
  }

  joinWorld(socketId: string, requestedCode?: string | null) {
    const membership = this.getOrCreateWorld(requestedCode);
    this.socketToWorld.set(socketId, membership.worldCode);
    const joinResult = membership.world.addPlayer(socketId);
    return { ...membership, ...joinResult };
  }

  leaveWorld(socketId: string) {
    const membership = this.getWorldForSocket(socketId);
    this.socketToWorld.delete(socketId);
    if (!membership) return null;
    return { ...membership, message: membership.world.removePlayer(socketId) };
  }

  getWorldForSocket(socketId: string) {
    const worldCode = this.socketToWorld.get(socketId);
    if (!worldCode) return null;
    const world = this.worlds.get(worldCode);
    if (!world) return null;
    return { worldCode, world, roomName: createRoomName(worldCode) };
  }

  getWorlds() { return Array.from(this.worlds.values()); }
  getTotalPlayerCount() { return this.getWorlds().reduce((s, w) => s + w.getPlayers().length, 0); }
}
