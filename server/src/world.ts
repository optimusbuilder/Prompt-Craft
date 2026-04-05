import type { ChatMessage, KillEvent, PlayerState, ProjectileState, Vector3, WorldMetrics, WorldSnapshot, PlayerInput } from "@promptcraft/shared";
import { v4 as uuidv4 } from "uuid";

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

const BOT_NAMES = [
  "Alpha", "Bravo", "Charlie", "Delta", "Echo",
  "Foxtrot", "Golf", "Hotel", "India", "Juliet"
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
  private botNameIndex = 0;
  public pendingEvents: { type: string; payload: any }[] = [];

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

  addPlayer(id: string, customName?: string | null, isBot: boolean = false) {
    const color = PLAYER_COLORS[this.playerColorIndex % PLAYER_COLORS.length];
    this.playerColorIndex++;
    let name = customName?.trim();
    if (!name) {
      if (isBot) {
        name = `[BOT] ${BOT_NAMES[this.botNameIndex % BOT_NAMES.length]}`;
        this.botNameIndex++;
      } else {
        name = CALLSIGNS[this.callsignIndex % CALLSIGNS.length];
        this.callsignIndex++;
      }
    } else {
      name = name.slice(0, 16);
    }
    const position = { x: (Math.random() - 0.5) * 500, y: 300 + Math.random() * 100, z: (Math.random() - 0.5) * 500 };
    const player: PlayerState = {
      id, name, color,
      position,
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      velocity: { x: 0, y: 0, z: -50 },
      health: 100,
      kills: 0,
      deaths: 0,
      isBot,
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

  updateBots(dt: number) {
    const bots = this.getPlayers().filter(p => p.isBot);
    const humans = this.getPlayers().filter(p => !p.isBot);
    
    // Spawn bots if we have humans but few total players
    if (humans.length > 0 && this.players.size < 4 && Math.random() < 0.05) {
      const newBotMatch = this.addPlayer(`bot_${uuidv4()}`, null, true);
      this.pendingEvents.push({ type: "chat:message", payload: newBotMatch.message });
      const snap = this.getSnapshot();
      this.pendingEvents.push({ type: "world:snapshot", payload: snap }); // force full sync
    }

    const MIN_SPEED = 50;
    const MAX_SPEED = 140;

    for (const bot of bots) {
      if (bot.health <= 0) continue;
      
      let targetPlayer: PlayerState | null = null;
      let closestDist = Infinity;
      
      // Check bot collisions against projectiles
      for (const proj of this.projectiles.values()) {
        if (proj.ownerId === bot.id) continue;
        
        const age = (Date.now() - proj.createdAt) / 1000;
        const cx = proj.position.x + proj.velocity.x * age;
        const cy = proj.position.y + proj.velocity.y * age;
        const cz = proj.position.z + proj.velocity.z * age;
        
        const bdx = cx - bot.position.x;
        const bdy = cy - bot.position.y;
        const bdz = cz - bot.position.z;
        const dist = Math.sqrt(bdx*bdx + bdy*bdy + bdz*bdz);
        
        if (dist < 8) {
          bot.health -= 20;
          this.projectiles.delete(proj.id); // Destroy bullet
          if (bot.health <= 0) {
            bot.health = 0;
            // Record kill
            const killer = this.players.get(proj.ownerId);
            if (killer) {
              const killEvent = this.recordKill(killer.id, bot.id);
              if (killEvent) {
                this.pendingEvents.push({ type: "kill:event", payload: killEvent });
                const killMsg = this.createSystemMessage(`☠️ ${killEvent.killerName} shot down ${killEvent.victimName}`);
                this.pendingEvents.push({ type: "chat:message", payload: killMsg });
              }
            }
            this.pendingEvents.push({ type: "player:destroyed", payload: { id: bot.id } });
            
            // Schedule bot respawn
            setTimeout(() => {
              if (this.players.has(bot.id)) {
                this.respawnPlayer(bot.id);
                this.pendingEvents.push({ type: "player:respawned", payload: bot });
                this.pendingEvents.push({ type: "world:snapshot", payload: this.getSnapshot() });
              }
            }, 3000);
            
            break; // Bot is dead, stop checking projectiles
          }
        }
      }
      
      if (bot.health <= 0) continue;
      
      // Find closest enemy target (can be a human or another bot)
      for (const other of this.players.values()) {
        if (other.id === bot.id || other.health <= 0) continue;
        const dx = other.position.x - bot.position.x;
        const dy = other.position.y - bot.position.y;
        const dz = other.position.z - bot.position.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq < closestDist) {
          closestDist = distSq;
          targetPlayer = other;
        }
      }

      let tx = 0, ty = 0, tz = -1;
      let targetDist = 1;
      let shouldFire = false;

      if (targetPlayer) {
        // Simple prediction based on target velocity
        tx = targetPlayer.position.x + (targetPlayer.velocity.x * 0.5) - bot.position.x;
        ty = targetPlayer.position.y + (targetPlayer.velocity.y * 0.5) - bot.position.y;
        tz = targetPlayer.position.z + (targetPlayer.velocity.z * 0.5) - bot.position.z;
        targetDist = Math.sqrt(tx * tx + ty * ty + tz * tz);
        
        if (targetDist > 0) {
          tx /= targetDist; ty /= targetDist; tz /= targetDist;
        }
        
        // Shoot logic: target is close and in front of us
        if (targetDist < 1200) {
          const vx = bot.velocity.x; const vy = bot.velocity.y; const vz = bot.velocity.z;
          const speed = Math.sqrt(vx*vx + vy*vy + vz*vz) || 1;
          const dot = (vx/speed * tx) + (vy/speed * ty) + (vz/speed * tz);
          if (dot > 0.95 && Math.random() < 0.2) {
            shouldFire = true;
          }
        }
      } else {
        // Just fly around horizontally
        tx = bot.velocity.x; ty = 0; tz = bot.velocity.z;
        const targetDist = Math.sqrt(tx * tx + ty * ty + tz * tz);
        if (targetDist > 0) {
          tx /= targetDist; ty /= targetDist; tz /= targetDist;
        }
      }
      
      // Avoid ground (simplified)
      if (bot.position.y < 200) {
        ty = 1; tx *= 0.5; tz *= 0.5; // pitch up strongly
        const len = Math.sqrt(tx*tx + ty*ty + tz*tz);
        tx /= len; ty /= len; tz /= len;
      }

      // Steer velocity towards desired direction
      const STEER_RATE = targetPlayer ? 3.0 : 1.0;
      bot.velocity.x += (tx * MAX_SPEED - bot.velocity.x) * dt * STEER_RATE;
      bot.velocity.y += (ty * MAX_SPEED - bot.velocity.y) * dt * STEER_RATE;
      bot.velocity.z += (tz * MAX_SPEED - bot.velocity.z) * dt * STEER_RATE;

      // Restrict speed
      const vlen = Math.sqrt(bot.velocity.x**2 + bot.velocity.y**2 + bot.velocity.z**2);
      let newSpd = vlen;
      if (vlen > MAX_SPEED) newSpd = MAX_SPEED;
      if (vlen < MIN_SPEED) newSpd = MIN_SPEED;
      if (vlen > 0) {
         bot.velocity.x = (bot.velocity.x / vlen) * newSpd;
         bot.velocity.y = (bot.velocity.y / vlen) * newSpd;
         bot.velocity.z = (bot.velocity.z / vlen) * newSpd;
      }

      // Update position
      bot.position.x += bot.velocity.x * dt;
      bot.position.y += bot.velocity.y * dt;
      bot.position.z += bot.velocity.z * dt;

      // Keep bot in bounds (turn back if out of bounds)
      if (Math.abs(bot.position.x) > 3000) bot.velocity.x *= -0.5;
      if (Math.abs(bot.position.z) > 3000) bot.velocity.z *= -0.5;
      
      if (shouldFire) {
        const velLen = Math.sqrt(bot.velocity.x**2 + bot.velocity.y**2 + bot.velocity.z**2);
        const fNormX = bot.velocity.x / velLen;
        const fNormY = bot.velocity.y / velLen;
        const fNormZ = bot.velocity.z / velLen;
        
        const bulletVel = {
          x: fNormX * 1000 + bot.velocity.x,
          y: fNormY * 1000 + bot.velocity.y,
          z: fNormZ * 1000 + bot.velocity.z
        };
        
        const proj: ProjectileState = {
          id: `proj_bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ownerId: bot.id,
          position: { ...bot.position },
          velocity: bulletVel,
          createdAt: Date.now()
        };
        this.addProjectile(proj);
        this.pendingEvents.push({ type: "projectile:fired", payload: proj });
      }
    }
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

  joinWorld(socketId: string, requestedCode?: string | null, playerName?: string | null) {
    const membership = this.getOrCreateWorld(requestedCode);
    this.socketToWorld.set(socketId, membership.worldCode);
    const joinResult = membership.world.addPlayer(socketId, playerName);
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
