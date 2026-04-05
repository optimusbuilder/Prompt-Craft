import type {
  ChatMessage,
  KillEvent,
  MatchPhase,
  MatchState,
  PlayerInput,
  PlayerState,
  ProjectileState,
  Vector3,
  WorldMetrics,
  WorldSnapshot,
  WorldStateUpdate,
} from "@promptcraft/shared";
import { v4 as uuidv4 } from "uuid";

const WORLD_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MATCH_COUNTDOWN_SECONDS = 5;
const MATCH_ROUND_SECONDS = 300;
const MATCH_ROUND_END_SECONDS = 8;
const MATCH_SCORE_TO_WIN = 10;
const RESPAWN_DELAY_MS = 3000;

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
  "Raven", "Cobra", "Wolf", "Ace", "Shadow",
];

const BOT_NAMES = [
  "Alpha", "Bravo", "Charlie", "Delta", "Echo",
  "Foxtrot", "Golf", "Hotel", "India", "Juliet",
];

type PendingEvent = { type: string; payload: unknown };

export type HitResult = {
  destroyedPlayerId: string | null;
  killEvent: KillEvent | null;
  systemMessage: ChatMessage | null;
  shouldRespawn: boolean;
  roundEnded: boolean;
};

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
  public pendingEvents: PendingEvent[] = [];

  private matchPhase: MatchPhase = "lobby";
  private roundNumber = 1;
  private winnerId: string | null = null;
  private countdownEndsAt: number | null = null;
  private roundEndsAt: number | null = null;
  private roundResultEndsAt: number | null = null;

  constructor(worldCode: string) {
    this.worldCode = worldCode;
    this.createSystemMessage(`Airspace ${worldCode} online - weapons hot`);
  }

  getWorldCode() {
    return this.worldCode;
  }

  canAcceptCombat() {
    return this.matchPhase === "in_progress";
  }

  private createSpawnPosition(): Vector3 {
    return {
      x: (Math.random() - 0.5) * 500,
      y: 300 + Math.random() * 100,
      z: (Math.random() - 0.5) * 500,
    };
  }

  private resetPlayerForRound(player: PlayerState) {
    player.position = this.createSpawnPosition();
    player.quaternion = { x: 0, y: 0, z: 0, w: 1 };
    player.velocity = { x: 0, y: 0, z: -50 };
    player.health = 100;
    player.kills = 0;
    player.deaths = 0;
  }

  private countHumans() {
    let humans = 0;
    for (const player of this.players.values()) {
      if (!player.isBot) humans++;
    }
    return humans;
  }

  private removeAllBots() {
    for (const player of this.players.values()) {
      if (player.isBot) this.players.delete(player.id);
    }
  }

  private resetToLobbyState() {
    this.matchPhase = "lobby";
    this.countdownEndsAt = null;
    this.roundEndsAt = null;
    this.roundResultEndsAt = null;
    this.winnerId = null;
    this.projectiles.clear();
    this.recentKills = [];
  }

  private getRoundLeader(): PlayerState | null {
    const sorted = this.getPlayers().sort((a, b) => {
      if (b.kills !== a.kills) return b.kills - a.kills;
      return a.deaths - b.deaths;
    });
    return sorted[0] ?? null;
  }

  private getWinnerByScore(): PlayerState | null {
    for (const player of this.players.values()) {
      if (player.kills >= MATCH_SCORE_TO_WIN) return player;
    }
    return null;
  }

  private startCountdown(now = Date.now()) {
    this.matchPhase = "countdown";
    this.countdownEndsAt = now + MATCH_COUNTDOWN_SECONDS * 1000;
    this.roundEndsAt = null;
    this.roundResultEndsAt = null;
    this.winnerId = null;
    this.recentKills = [];
    this.projectiles.clear();
    const msg = this.createSystemMessage(`Round ${this.roundNumber} starts in ${MATCH_COUNTDOWN_SECONDS}...`);
    this.pendingEvents.push({ type: "chat:message", payload: msg });
  }

  private startRound(now = Date.now()) {
    for (const player of this.players.values()) {
      this.resetPlayerForRound(player);
    }
    this.matchPhase = "in_progress";
    this.countdownEndsAt = null;
    this.roundEndsAt = now + MATCH_ROUND_SECONDS * 1000;
    this.roundResultEndsAt = null;
    this.winnerId = null;
    this.recentKills = [];
    this.projectiles.clear();
    const msg = this.createSystemMessage(`Round ${this.roundNumber} is live. First to ${MATCH_SCORE_TO_WIN} kills.`);
    this.pendingEvents.push({ type: "chat:message", payload: msg });
  }

  private endRound(winnerId: string | null, now = Date.now()) {
    if (this.matchPhase !== "in_progress") return false;
    this.matchPhase = "round_end";
    this.winnerId = winnerId;
    this.countdownEndsAt = null;
    this.roundEndsAt = null;
    this.roundResultEndsAt = now + MATCH_ROUND_END_SECONDS * 1000;
    this.projectiles.clear();
    const winner = winnerId ? this.players.get(winnerId) : null;
    const msg = this.createSystemMessage(
      winner
        ? `Round ${this.roundNumber} complete - ${winner.name} wins.`
        : `Round ${this.roundNumber} complete - draw.`,
    );
    this.pendingEvents.push({ type: "chat:message", payload: msg });
    return true;
  }

  private updateMatch(now = Date.now()) {
    const humanCount = this.countHumans();
    if (humanCount === 0) {
      this.removeAllBots();
      this.resetToLobbyState();
      return;
    }

    switch (this.matchPhase) {
      case "lobby": {
        this.startCountdown(now);
        break;
      }
      case "countdown": {
        if (this.countdownEndsAt !== null && now >= this.countdownEndsAt) {
          this.startRound(now);
        }
        break;
      }
      case "in_progress": {
        const scoreWinner = this.getWinnerByScore();
        if (scoreWinner) {
          this.endRound(scoreWinner.id, now);
          break;
        }
        if (this.roundEndsAt !== null && now >= this.roundEndsAt) {
          const roundLeader = this.getRoundLeader();
          this.endRound(roundLeader?.id ?? null, now);
        }
        break;
      }
      case "round_end": {
        if (this.roundResultEndsAt !== null && now >= this.roundResultEndsAt) {
          this.roundNumber += 1;
          this.startCountdown(now);
        }
        break;
      }
    }
  }

  getMatchState(now = Date.now()): MatchState {
    const winner = this.winnerId ? this.players.get(this.winnerId) : null;
    const countdownRemainingSeconds =
      this.matchPhase === "countdown" && this.countdownEndsAt !== null
        ? Math.max(0, Math.ceil((this.countdownEndsAt - now) / 1000))
        : 0;
    const roundRemainingSeconds =
      this.matchPhase === "in_progress" && this.roundEndsAt !== null
        ? Math.max(0, Math.ceil((this.roundEndsAt - now) / 1000))
        : 0;
    const nextRoundInSeconds =
      this.matchPhase === "round_end" && this.roundResultEndsAt !== null
        ? Math.max(0, Math.ceil((this.roundResultEndsAt - now) / 1000))
        : 0;

    return {
      phase: this.matchPhase,
      roundNumber: this.roundNumber,
      scoreToWin: MATCH_SCORE_TO_WIN,
      roundDurationSeconds: MATCH_ROUND_SECONDS,
      countdownRemainingSeconds,
      roundRemainingSeconds,
      winnerId: winner?.id ?? null,
      winnerName: winner?.name ?? null,
      winnerColor: winner?.color ?? null,
      nextRoundInSeconds,
    };
  }

  getMetrics(now = Date.now()): WorldMetrics {
    return {
      playerCount: this.players.size,
      projectileCount: this.projectiles.size,
      sessionAgeSeconds: Math.floor((now - this.sessionStartedAt) / 1000),
    };
  }

  getStateUpdate(now = Date.now()): WorldStateUpdate {
    return {
      players: Array.from(this.players.values()),
      projectiles: Array.from(this.projectiles.values()),
      metrics: this.getMetrics(now),
      match: this.getMatchState(now),
    };
  }

  getSnapshot(now = Date.now()): WorldSnapshot {
    return {
      ...this.getStateUpdate(now),
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
    const player: PlayerState = {
      id,
      name,
      color,
      position: this.createSpawnPosition(),
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
    const msg = this.createSystemMessage(`${player.name} left airspace`);
    if (this.countHumans() === 0) {
      this.removeAllBots();
      this.resetToLobbyState();
    }
    return msg;
  }

  updatePlayer(id: string, input: PlayerInput) {
    const player = this.players.get(id);
    if (!player) return;
    player.position = input.position;
    player.quaternion = input.quaternion;
    player.velocity = input.velocity;
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

  addProjectile(projectile: ProjectileState) {
    if (!this.canAcceptCombat()) return false;
    const owner = this.players.get(projectile.ownerId);
    if (!owner || owner.health <= 0) return false;

    this.projectiles.set(projectile.id, projectile);
    setTimeout(() => {
      this.projectiles.delete(projectile.id);
    }, 3000);
    return true;
  }

  applyHit(attackerId: string, targetId: string, damage: number): HitResult | null {
    if (!this.canAcceptCombat()) return null;

    const target = this.players.get(targetId);
    if (!target || target.health <= 0) return null;

    const clampedDamage = Math.max(1, Math.min(1000, Math.floor(damage)));
    target.health = Math.max(0, target.health - clampedDamage);
    if (target.health > 0) {
      return {
        destroyedPlayerId: null,
        killEvent: null,
        systemMessage: null,
        shouldRespawn: false,
        roundEnded: false,
      };
    }

    let killEvent: KillEvent | null = null;
    let systemMessage: ChatMessage | null = null;
    if (attackerId === targetId || !this.players.has(attackerId)) {
      target.deaths++;
      systemMessage = this.createSystemMessage(`${target.name} was lost in action.`);
    } else {
      killEvent = this.recordKill(attackerId, targetId);
      if (killEvent) {
        systemMessage = this.createSystemMessage(`☠️ ${killEvent.killerName} shot down ${killEvent.victimName}`);
      }
    }

    let roundEnded = false;
    const scoreWinner = this.matchPhase === "in_progress" ? this.getWinnerByScore() : null;
    if (scoreWinner) {
      roundEnded = this.endRound(scoreWinner.id);
    }

    return {
      destroyedPlayerId: targetId,
      killEvent,
      systemMessage,
      shouldRespawn: !roundEnded && this.canAcceptCombat(),
      roundEnded,
    };
  }

  respawnPlayer(id: string) {
    if (!this.canAcceptCombat()) return null;
    const player = this.players.get(id);
    if (!player) return null;
    player.health = 100;
    player.position = this.createSpawnPosition();
    player.velocity = { x: 0, y: 0, z: -50 };
    player.quaternion = { x: 0, y: 0, z: 0, w: 1 };
    return this.createSystemMessage(`Respawned: ${player.name}`);
  }

  getProjectiles() {
    return Array.from(this.projectiles.values());
  }

  getPlayers() {
    return Array.from(this.players.values());
  }

  tick(dt: number) {
    this.updateMatch();
    this.updateBots(dt);
  }

  updateBots(dt: number) {
    const bots = this.getPlayers().filter((p) => p.isBot);
    const humans = this.getPlayers().filter((p) => !p.isBot);

    if (humans.length > 0 && this.players.size < 4 && Math.random() < 0.05) {
      const newBotMatch = this.addPlayer(`bot_${uuidv4()}`, null, true);
      this.pendingEvents.push({ type: "chat:message", payload: newBotMatch.message });
    }

    if (!this.canAcceptCombat()) return;

    const MIN_SPEED = 50;
    const MAX_SPEED = 140;

    for (const bot of bots) {
      if (bot.health <= 0 || !this.canAcceptCombat()) continue;

      let targetPlayer: PlayerState | null = null;
      let closestDist = Infinity;

      for (const proj of this.projectiles.values()) {
        if (proj.ownerId === bot.id) continue;

        const age = (Date.now() - proj.createdAt) / 1000;
        const cx = proj.position.x + proj.velocity.x * age;
        const cy = proj.position.y + proj.velocity.y * age;
        const cz = proj.position.z + proj.velocity.z * age;

        const bdx = cx - bot.position.x;
        const bdy = cy - bot.position.y;
        const bdz = cz - bot.position.z;
        const dist = Math.sqrt(bdx * bdx + bdy * bdy + bdz * bdz);

        if (dist < 8) {
          this.projectiles.delete(proj.id);
          const hitResult = this.applyHit(proj.ownerId, bot.id, 20);
          if (hitResult?.destroyedPlayerId) {
            if (hitResult.killEvent) {
              this.pendingEvents.push({ type: "kill:event", payload: hitResult.killEvent });
            }
            if (hitResult.systemMessage) {
              this.pendingEvents.push({ type: "chat:message", payload: hitResult.systemMessage });
            }
            this.pendingEvents.push({ type: "player:destroyed", payload: { id: bot.id } });
            if (hitResult.shouldRespawn) {
              setTimeout(() => {
                const respawnMsg = this.respawnPlayer(bot.id);
                if (!respawnMsg) return;
                this.pendingEvents.push({ type: "chat:message", payload: respawnMsg });
                const respawned = this.players.get(bot.id);
                if (respawned) this.pendingEvents.push({ type: "player:respawned", payload: respawned });
              }, RESPAWN_DELAY_MS);
            }
            if (hitResult.roundEnded) return;
            break;
          }
        }
      }

      if (bot.health <= 0 || !this.canAcceptCombat()) continue;

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

      let tx = 0;
      let ty = 0;
      let tz = -1;
      let targetDist = 1;
      let shouldFire = false;

      if (targetPlayer) {
        tx = targetPlayer.position.x + targetPlayer.velocity.x * 0.5 - bot.position.x;
        ty = targetPlayer.position.y + targetPlayer.velocity.y * 0.5 - bot.position.y;
        tz = targetPlayer.position.z + targetPlayer.velocity.z * 0.5 - bot.position.z;
        targetDist = Math.sqrt(tx * tx + ty * ty + tz * tz);

        if (targetDist > 0) {
          tx /= targetDist;
          ty /= targetDist;
          tz /= targetDist;
        }

        if (targetDist < 1200) {
          const vx = bot.velocity.x;
          const vy = bot.velocity.y;
          const vz = bot.velocity.z;
          const speed = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
          const dot = (vx / speed) * tx + (vy / speed) * ty + (vz / speed) * tz;
          if (dot > 0.95 && Math.random() < 0.2) {
            shouldFire = true;
          }
        }
      } else {
        tx = bot.velocity.x;
        ty = 0;
        tz = bot.velocity.z;
        const roamTargetDist = Math.sqrt(tx * tx + ty * ty + tz * tz);
        if (roamTargetDist > 0) {
          tx /= roamTargetDist;
          ty /= roamTargetDist;
          tz /= roamTargetDist;
        }
      }

      if (bot.position.y < 200) {
        ty = 1;
        tx *= 0.5;
        tz *= 0.5;
        const len = Math.sqrt(tx * tx + ty * ty + tz * tz);
        tx /= len;
        ty /= len;
        tz /= len;
      }

      const STEER_RATE = targetPlayer ? 3.0 : 1.0;
      bot.velocity.x += (tx * MAX_SPEED - bot.velocity.x) * dt * STEER_RATE;
      bot.velocity.y += (ty * MAX_SPEED - bot.velocity.y) * dt * STEER_RATE;
      bot.velocity.z += (tz * MAX_SPEED - bot.velocity.z) * dt * STEER_RATE;

      const vlen = Math.sqrt(bot.velocity.x ** 2 + bot.velocity.y ** 2 + bot.velocity.z ** 2);
      let newSpd = vlen;
      if (vlen > MAX_SPEED) newSpd = MAX_SPEED;
      if (vlen < MIN_SPEED) newSpd = MIN_SPEED;
      if (vlen > 0) {
        bot.velocity.x = (bot.velocity.x / vlen) * newSpd;
        bot.velocity.y = (bot.velocity.y / vlen) * newSpd;
        bot.velocity.z = (bot.velocity.z / vlen) * newSpd;
      }

      bot.position.x += bot.velocity.x * dt;
      bot.position.y += bot.velocity.y * dt;
      bot.position.z += bot.velocity.z * dt;

      if (Math.abs(bot.position.x) > 3000) bot.velocity.x *= -0.5;
      if (Math.abs(bot.position.z) > 3000) bot.velocity.z *= -0.5;

      if (shouldFire && this.canAcceptCombat()) {
        const velLen = Math.sqrt(bot.velocity.x ** 2 + bot.velocity.y ** 2 + bot.velocity.z ** 2) || 1;
        const fNormX = bot.velocity.x / velLen;
        const fNormY = bot.velocity.y / velLen;
        const fNormZ = bot.velocity.z / velLen;

        const bulletVel = {
          x: fNormX * 1000 + bot.velocity.x,
          y: fNormY * 1000 + bot.velocity.y,
          z: fNormZ * 1000 + bot.velocity.z,
        };

        const proj: ProjectileState = {
          id: `proj_bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ownerId: bot.id,
          position: { ...bot.position },
          velocity: bulletVel,
          createdAt: Date.now(),
        };
        if (this.addProjectile(proj)) {
          this.pendingEvents.push({ type: "projectile:fired", payload: proj });
        }
      }
    }
  }

  createChatMessage(senderId: string, text: string) {
    const player = this.players.get(senderId);
    if (!player) return null;
    const msg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sender: player.name,
      senderColor: player.color,
      text,
      timestamp: Date.now(),
      isSystem: false,
    };
    this.chatHistory.push(msg);
    if (this.chatHistory.length > 50) this.chatHistory.shift();
    return msg;
  }

  createSystemMessage(text: string) {
    const msg: ChatMessage = {
      id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sender: "AWACS",
      senderColor: "#ffff55",
      text,
      timestamp: Date.now(),
      isSystem: true,
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

  getWorlds() {
    return Array.from(this.worlds.values());
  }

  getTotalPlayerCount() {
    return this.getWorlds().reduce((sum, world) => sum + world.getPlayers().length, 0);
  }
}
