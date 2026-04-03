import type {
  ChatMessage,
  PlayerState,
  PromptSubmission,
  SceneObject,
  StructureArchetype,
  Vector3,
  Voxel,
  WorldMetrics,
  WorldSnapshot,
} from "@promptcraft/shared";
import { generateStructureFromPrompt } from "./ai";

/* ========== Color Palettes ========== */

const PALETTES = {
  tidal: { base: "#61d5ff", accent: "#b5f3ff", emissive: "#54c6ff" },
  ember: { base: "#f29f67", accent: "#ffd0a8", emissive: "#ff9b54" },
  grove: { base: "#5da83a", accent: "#8bce5f", emissive: "#4a9e32" },
  velvet: { base: "#c7a6ff", accent: "#f1dcff", emissive: "#ba8dff" },
  lunar: { base: "#9ec0ff", accent: "#ffffff", emissive: "#b1c8ff" },
  rose: { base: "#ff8fab", accent: "#ffd8e2", emissive: "#ff7194" },
  obsidian: { base: "#3a3a4a", accent: "#6a6a8a", emissive: "#4a4a6a" },
  gold: { base: "#d4a023", accent: "#ffe066", emissive: "#c89b20" },
  crimson: { base: "#cc3333", accent: "#ff6666", emissive: "#bb2222" },
  arctic: { base: "#d0e8f0", accent: "#f0f8ff", emissive: "#a0c8e0" },
} as const;

type Palette = (typeof PALETTES)[keyof typeof PALETTES];

type WorldMembership = {
  roomName: string;
  world: WorldState;
  worldCode: string;
};

/* ========== Helpers ========== */

function hashPrompt(prompt: string) {
  return Array.from(prompt).reduce((sum, c) => sum + c.charCodeAt(0), 0);
}

function fill(voxels: Voxel[], x: number, y: number, z: number, color: string, scale = 1) {
  voxels.push({ x, y, z, color, scale });
}

function fillBox(
  voxels: Voxel[],
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  color: string, scale = 1
) {
  for (let x = x1; x <= x2; x++) {
    for (let y = y1; y <= y2; y++) {
      for (let z = z1; z <= z2; z++) {
        fill(voxels, x, y, z, color, scale);
      }
    }
  }
}

function fillHollow(
  voxels: Voxel[],
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  color: string, scale = 1
) {
  for (let x = x1; x <= x2; x++) {
    for (let y = y1; y <= y2; y++) {
      for (let z = z1; z <= z2; z++) {
        if (x === x1 || x === x2 || y === y1 || y === y2 || z === z1 || z === z2) {
          fill(voxels, x, y, z, color, scale);
        }
      }
    }
  }
}

/* ========== Palette Selection ========== */

function getPromptPalette(prompt: string, seed: number): Palette {
  const t = prompt.toLowerCase();
  if (/(moon|ice|frost|silver|glacier|crystal|arctic)/.test(t)) return PALETTES.arctic;
  if (/(ember|desert|amber|gold|sun|lantern|fire)/.test(t)) return PALETTES.ember;
  if (/(garden|forest|teal|jade|verdant|nature|tree)/.test(t)) return PALETTES.grove;
  if (/(rose|velvet|dream|violet|neon|arcane|pink)/.test(t)) return seed % 2 === 0 ? PALETTES.velvet : PALETTES.rose;
  if (/(obsidian|dark|shadow|void|black)/.test(t)) return PALETTES.obsidian;
  if (/(gold|royal|king|queen|palace|crown)/.test(t)) return PALETTES.gold;
  if (/(red|lava|blood|crimson|ruby)/.test(t)) return PALETTES.crimson;
  if (/(ocean|water|sea|wave|tidal|blue)/.test(t)) return PALETTES.tidal;
  if (/(moon|lunar|night|star)/.test(t)) return PALETTES.lunar;
  return Object.values(PALETTES)[seed % Object.values(PALETTES).length];
}

/* ========== Archetype Detection ========== */

function getArchetype(prompt: string): StructureArchetype {
  const t = prompt.toLowerCase();
  if (/(house|cabin|cottage|hut|home|shelter)/.test(t)) return "house";
  if (/(tree|oak|pine|birch|willow|bonsai)/.test(t)) return "tree";
  if (/(pyramid|triangle|ancient|egyptian)/.test(t)) return "pyramid";
  if (/(arch|gateway|portal|entrance)/.test(t)) return "arch";
  if (/(fountain|well|pool|spring|water\s*feature)/.test(t)) return "fountain";
  if (/(wall|fence|barrier|border|rampart)/.test(t)) return "wall";
  if (/(tower|watchtower|lookout|lighthouse|tall|skyscraper)/.test(t)) return "tower";
  if (/(bridge|walkway|span|overpass)/.test(t)) return "bridge";
  if (/(bloom|garden|coral|canopy|flower)/.test(t)) return "bloom";
  if (/(shrine|temple|pagoda|castle|citadel|fortress)/.test(t)) return "citadel";
  if (/(dome|orb|sanctum|halo|sphere|globe)/.test(t)) return "dome";
  if (/(signal|antenna|relay|beacon|radio)/.test(t)) return "relay";
  return "spire";
}

/* ========== Structure Generators ========== */

function createHouse(seed: number, p: Palette): Voxel[] {
  const v: Voxel[] = [];
  const w = 5 + (seed % 3);
  const d = 4 + (seed % 2);
  const h = 4;

  fillHollow(v, 0, 0, 0, w, h - 1, d, p.base);
  fillBox(v, 0, 0, 0, w, 0, d, "#8b6914");

  for (let i = 0; i <= Math.ceil(w / 2); i++) {
    fillBox(v, i, h + i, -1, w - i, h + i, d + 1, p.accent);
  }

  fill(v, Math.floor(w / 2), 1, 0, "#6b4400");
  fill(v, Math.floor(w / 2), 2, 0, "#6b4400");

  if (w > 3) {
    fill(v, 1, 2, 0, "#aaddff");
    fill(v, w - 1, 2, 0, "#aaddff");
  }

  return v;
}

function createTree(seed: number, p: Palette): Voxel[] {
  const v: Voxel[] = [];
  const trunk = 4 + (seed % 4);
  const radius = 2 + (seed % 2);

  for (let y = 0; y < trunk; y++) {
    fill(v, 0, y, 0, "#6b4400");
    if (seed % 3 === 0 && y > 1) fill(v, 1, y, 0, "#6b4400");
  }

  for (let x = -radius; x <= radius; x++) {
    for (let z = -radius; z <= radius; z++) {
      for (let y = 0; y <= radius; y++) {
        const dist = Math.sqrt(x * x + z * z + y * y);
        if (dist <= radius + 0.5 && (dist < radius - 0.3 || (x + z + y + seed) % 3 !== 0)) {
          fill(v, x, trunk + y, z, y === radius && dist < 1.5 ? p.accent : p.base);
        }
      }
    }
  }

  return v;
}

function createPyramid(seed: number, p: Palette): Voxel[] {
  const v: Voxel[] = [];
  const size = 6 + (seed % 4);
  for (let y = 0; y < size; y++) {
    const r = size - y;
    for (let x = -r; x <= r; x++) {
      for (let z = -r; z <= r; z++) {
        if (Math.abs(x) === r || Math.abs(z) === r || y === 0) {
          fill(v, x, y, z, y === size - 1 ? p.accent : p.base);
        }
      }
    }
  }
  fill(v, 0, size, 0, p.accent);
  return v;
}

function createArch(seed: number, p: Palette): Voxel[] {
  const v: Voxel[] = [];
  const h = 5 + (seed % 3);
  const w = 4 + (seed % 3);

  fillBox(v, 0, 0, 0, 0, h, 1, p.base);
  fillBox(v, w, 0, 0, w, h, 1, p.base);

  for (let x = 0; x <= w; x++) {
    const archY = h + 1 + Math.round(Math.sin((x / w) * Math.PI) * 2);
    fillBox(v, x, archY, 0, x, archY, 1, p.accent);
    fillBox(v, x, archY - 1, 0, x, archY - 1, 1, p.base);
  }

  return v;
}

function createFountain(seed: number, p: Palette): Voxel[] {
  const v: Voxel[] = [];
  const r = 3 + (seed % 2);

  for (let x = -r; x <= r; x++) {
    for (let z = -r; z <= r; z++) {
      const dist = Math.sqrt(x * x + z * z);
      if (dist <= r + 0.2) {
        fill(v, x, 0, z, p.base);
        if (dist >= r - 1) {
          fill(v, x, 1, z, p.base);
        } else {
          fill(v, x, 0, z, "#4488cc");
        }
      }
    }
  }

  for (let y = 1; y <= 3; y++) fill(v, 0, y, 0, p.accent);

  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (Math.abs(dx) + Math.abs(dz) <= 1) fill(v, dx, 4, dz, "#66bbff");
    }
  }

  return v;
}

function createWall(seed: number, p: Palette): Voxel[] {
  const v: Voxel[] = [];
  const length = 8 + (seed % 6);
  const h = 3 + (seed % 2);

  for (let x = 0; x < length; x++) {
    for (let y = 0; y < h; y++) {
      fill(v, x, y, 0, (x + y) % 3 === 0 ? p.accent : p.base);
    }
  }

  for (let x = 0; x < length; x += 2) {
    fill(v, x, h, 0, p.accent);
  }

  return v;
}

function createTower(seed: number, p: Palette): Voxel[] {
  const v: Voxel[] = [];
  const h = 8 + (seed % 6);
  const w = 2 + (seed % 2);

  for (let y = 0; y < h; y++) {
    fillHollow(v, -w, y, -w, w, y, w, y % 4 === 0 ? p.accent : p.base);
  }

  for (let x = -w - 1; x <= w + 1; x++) {
    for (let z = -w - 1; z <= w + 1; z++) {
      if (Math.abs(x) === w + 1 || Math.abs(z) === w + 1) fill(v, x, h, z, p.accent);
    }
  }

  for (let x = -w - 1; x <= w + 1; x += 2) {
    for (let z = -w - 1; z <= w + 1; z += 2) {
      if (Math.abs(x) === w + 1 || Math.abs(z) === w + 1) fill(v, x, h + 1, z, p.accent);
    }
  }

  for (let y = 2; y < h; y += 3) {
    fill(v, 0, y, -w, "#aaddff");
    fill(v, 0, y, w, "#aaddff");
    fill(v, -w, y, 0, "#aaddff");
    fill(v, w, y, 0, "#aaddff");
  }

  return v;
}

function createCitadel(seed: number, p: Palette): Voxel[] {
  const v: Voxel[] = [];
  const w = 3 + (seed % 2);
  const h = 5 + (seed % 3);

  fillHollow(v, 0, 0, 0, w * 2, h, w * 2, p.base);

  for (const [cx, cz] of [[0, 0], [w * 2, 0], [0, w * 2], [w * 2, w * 2]] as const) {
    for (let y = 0; y <= h + 2; y++) {
      fill(v, cx, y, cz, p.accent);
      fill(v, cx + 1, y, cz, p.accent);
      fill(v, cx, y, cz + 1, p.accent);
    }
  }

  fill(v, w, 1, 0, "#6b4400");
  fill(v, w, 2, 0, "#6b4400");
  fill(v, w, 3, 0, p.accent);
  return v;
}

function createBridge(seed: number, p: Palette): Voxel[] {
  const v: Voxel[] = [];
  const span = 6 + (seed % 5);
  const arch = 3 + (seed % 2);

  for (let x = 0; x < span; x++) {
    for (let z = 0; z < 3; z++) {
      fill(v, x, arch, z, x % 2 === 0 ? p.base : p.accent);
    }
  }

  for (let y = 0; y < arch; y++) {
    fillBox(v, 0, y, 0, 1, y, 2, p.base);
    fillBox(v, span - 2, y, 0, span - 1, y, 2, p.base);
  }

  for (let x = 0; x < span; x += 2) {
    fill(v, x, arch + 1, 0, p.accent);
    fill(v, x, arch + 1, 2, p.accent);
  }

  return v;
}

function createBloom(seed: number, p: Palette): Voxel[] {
  const v: Voxel[] = [];
  const radius = 3 + (seed % 2);
  const height = 2 + ((seed >> 1) % 2);

  for (let y = 0; y < height; y++) fill(v, 0, y, 0, "#5c8a3a");

  for (let x = -radius; x <= radius; x++) {
    for (let z = -radius; z <= radius; z++) {
      const d = Math.abs(x) + Math.abs(z);
      if (d <= radius + (seed % 2)) {
        fill(v, x, height, z, d === 0 ? p.accent : p.base, d === 0 ? 1 : 0.8);
        if ((d + seed) % 3 === 0 && d < radius) fill(v, x, height + 1, z, p.accent, 0.6);
      }
    }
  }

  return v;
}

function createDome(seed: number, p: Palette): Voxel[] {
  const v: Voxel[] = [];
  const r = 3 + (seed % 2);

  for (let x = -r; x <= r; x++) {
    for (let z = -r; z <= r; z++) {
      const distH = Math.sqrt(x * x + z * z);
      if (distH > r + 0.2) continue;
      const maxY = Math.round(Math.sqrt(Math.max(0, r * r - x * x - z * z)));
      for (let y = 0; y <= maxY; y++) {
        const isShell = y === maxY || distH >= r - 0.5 || y === 0;
        if (isShell) fill(v, x, y, z, y === maxY && distH < 1 ? p.accent : p.base);
      }
    }
  }

  return v;
}

function createRelay(seed: number, p: Palette): Voxel[] {
  const v: Voxel[] = [];
  const h = 7 + (seed % 4);

  for (let y = 0; y < h; y++) fill(v, 0, y, 0, y % 2 === 0 ? p.base : p.accent);

  for (const offset of [-2, -1, 1, 2]) {
    fill(v, offset, h - 2, 0, p.accent);
    fill(v, 0, h - 2, offset, p.accent);
    fill(v, offset, h - 4, 0, p.accent);
    fill(v, 0, h - 4, offset, p.accent);
  }

  fill(v, 0, h, 0, p.accent);
  fill(v, 0, h + 1, 0, p.accent);
  return v;
}

function createSpire(seed: number, p: Palette): Voxel[] {
  const v: Voxel[] = [];
  const h = 6 + (seed % 5);

  for (let y = 0; y < h; y++) {
    const w = Math.max(1, 3 - Math.floor(y / 3));
    for (let x = 0; x < w; x++) {
      for (let z = 0; z < w; z++) {
        if (w > 1 && x === 1 && z === 1 && y < h - 1) continue;
        fill(v, x, y, z, y >= h - 2 ? p.accent : p.base);
      }
    }
  }

  fill(v, 0, h, 0, p.accent);
  return v;
}

/* ========== Voxel Cluster Dispatcher ========== */

function createVoxelCluster(seed: number, archetype: StructureArchetype, palette: Palette): Voxel[] {
  switch (archetype) {
    case "house": return createHouse(seed, palette);
    case "tree": return createTree(seed, palette);
    case "pyramid": return createPyramid(seed, palette);
    case "arch": return createArch(seed, palette);
    case "fountain": return createFountain(seed, palette);
    case "wall": return createWall(seed, palette);
    case "tower": return createTower(seed, palette);
    case "bridge": return createBridge(seed, palette);
    case "bloom": return createBloom(seed, palette);
    case "citadel": return createCitadel(seed, palette);
    case "dome": return createDome(seed, palette);
    case "relay": return createRelay(seed, palette);
    default: return createSpire(seed, palette);
  }
}

/* ========== Object Creation ========== */

function createObjectFromPrompt(prompt: string, index: number, position?: Vector3): SceneObject {
  const seed = hashPrompt(prompt);
  const archetype = getArchetype(prompt);
  const palette = getPromptPalette(prompt, seed);

  let x: number;
  let y: number;
  let z: number;

  if (position) {
    x = Math.round(position.x) + 3;
    y = Math.round(position.y) - 1;
    z = Math.round(position.z) + 3;
  } else {
    const orbit = index * 1.8;
    const ring = 8 + Math.floor(index / 6) * 6;
    x = Math.round(Math.cos(orbit) * ring);
    z = Math.round(Math.sin(orbit) * ring);
    y = 8;
  }

  return {
    id: `obj_${Date.now()}_${index}`,
    prompt,
    archetype,
    position: { x, y, z },
    voxels: createVoxelCluster(seed, archetype, palette),
    material: {
      roughness: archetype === "dome" ? 0.3 : 0.6,
      metalness: archetype === "relay" ? 0.4 : 0.15,
      emissive: palette.emissive,
      bloom: archetype === "relay" ? 0.9 : archetype === "tower" ? 0.5 : 0.35,
    },
    accentColor: palette.accent,
    createdAt: Date.now(),
  };
}

function createObjectFromAI(
  prompt: string,
  aiResult: {
    archetype: StructureArchetype;
    voxels: Voxel[];
    material: { roughness: number; metalness: number; emissive: string; bloom: number };
    accentColor: string;
  },
  position?: Vector3
): SceneObject {
  let x: number;
  let y: number;
  let z: number;

  if (position) {
    x = Math.round(position.x) + 3;
    y = Math.round(position.y) - 1;
    z = Math.round(position.z) + 3;
  } else {
    x = 0;
    y = 8;
    z = 0;
  }

  return {
    id: `obj_${Date.now()}_ai`,
    prompt,
    archetype: aiResult.archetype || "spire",
    position: { x, y, z },
    voxels: aiResult.voxels,
    material: aiResult.material,
    accentColor: aiResult.accentColor,
    createdAt: Date.now(),
  };
}

/* ========== Player Colors ========== */

const PLAYER_COLORS = [
  "#e74c3c",
  "#3498db",
  "#2ecc71",
  "#f39c12",
  "#9b59b6",
  "#1abc9c",
  "#e67e22",
  "#e91e63",
  "#00bcd4",
  "#8bc34a",
];

const WORLD_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function createRoomName(worldCode: string) {
  return `world:${worldCode}`;
}

function createSeededCode(index: number) {
  let value = index + 17;
  let code = "";
  for (let i = 0; i < 4; i++) {
    value = (value * 31 + 7) % WORLD_CODE_CHARS.length ** 2;
    code += WORLD_CODE_CHARS[value % WORLD_CODE_CHARS.length];
  }
  return code;
}

export function normalizeWorldCode(value: string | null | undefined): string {
  return (value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
}

export function isValidWorldCode(value: string | null | undefined): value is string {
  return normalizeWorldCode(value).length === 4;
}

/* ========== World State ========== */

export class WorldState {
  private readonly worldCode: string;
  private objects = new Map<string, SceneObject>();
  private players = new Map<string, PlayerState>();
  private totalPrompts = 0;
  private sessionStartedAt = Date.now();
  private chatHistory: ChatMessage[] = [];
  private playerColorIndex = 0;

  constructor(worldCode: string) {
    this.worldCode = worldCode;
    const starter = createObjectFromPrompt("welcome citadel with teal glow", 0);
    this.objects.set(starter.id, starter);
    this.totalPrompts = 1;
    this.createSystemMessage(`World ${worldCode} is ready for building`);
  }

  getWorldCode() {
    return this.worldCode;
  }

  getMetrics(now = Date.now()): WorldMetrics {
    const objects = Array.from(this.objects.values());
    return {
      objectCount: this.objects.size,
      totalPrompts: this.totalPrompts,
      districtCount: this.objects.size === 0 ? 0 : Math.ceil(this.objects.size / 5),
      archetypeVariety: new Set(objects.map((o) => o.archetype)).size,
      paletteVariety: new Set(objects.map((o) => o.accentColor)).size,
      sessionAgeSeconds: Math.floor((now - this.sessionStartedAt) / 1000),
      playerCount: this.players.size,
    };
  }

  getSnapshot(): WorldSnapshot {
    return {
      objects: Array.from(this.objects.values()),
      metrics: this.getMetrics(),
      players: Array.from(this.players.values()),
      chatHistory: [...this.chatHistory],
      worldCode: this.worldCode,
    };
  }

  async addPrompt(submission: PromptSubmission) {
    const now = Date.now();
    this.totalPrompts += 1;

    const aiResult = await generateStructureFromPrompt(submission.prompt);
    const object = aiResult
      ? createObjectFromAI(submission.prompt, aiResult, submission.position)
      : createObjectFromPrompt(submission.prompt, this.totalPrompts - 1, submission.position);

    this.objects.set(object.id, object);

    return {
      object,
      metrics: this.getMetrics(now),
      usedAI: !!aiResult,
    };
  }

  addPlayer(id: string): { player: PlayerState; message: ChatMessage } {
    const color = PLAYER_COLORS[this.playerColorIndex % PLAYER_COLORS.length];
    this.playerColorIndex += 1;
    const name = `Builder-${id.slice(-4)}`;

    const player: PlayerState = {
      id,
      position: { x: 0, y: 12, z: 0 },
      rotation: { x: 0, y: 0 },
      color,
      name,
    };

    this.players.set(id, player);
    const msg = this.createSystemMessage(`${name} joined world ${this.worldCode}`);
    return { player, message: msg };
  }

  removePlayer(id: string): ChatMessage | null {
    const player = this.players.get(id);
    if (!player) return null;
    this.players.delete(id);
    return this.createSystemMessage(`${player.name} left world ${this.worldCode}`);
  }

  updatePlayerPosition(
    id: string,
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number }
  ) {
    const player = this.players.get(id);
    if (!player) return;
    player.position = position;
    player.rotation = rotation;
  }

  getPlayers(): PlayerState[] {
    return Array.from(this.players.values());
  }

  getPlayer(id: string): PlayerState | undefined {
    return this.players.get(id);
  }

  createChatMessage(senderId: string, text: string): ChatMessage | null {
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
    if (this.chatHistory.length > 100) this.chatHistory.shift();
    return msg;
  }

  private createSystemMessage(text: string): ChatMessage {
    const msg: ChatMessage = {
      id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sender: "Server",
      senderColor: "#ffff55",
      text,
      timestamp: Date.now(),
      isSystem: true,
    };

    this.chatHistory.push(msg);
    if (this.chatHistory.length > 100) this.chatHistory.shift();
    return msg;
  }
}

/* ========== Room Directory ========== */

export class WorldDirectory {
  private worlds = new Map<string, WorldState>();
  private socketToWorld = new Map<string, string>();
  private generatedCodes = 0;

  createWorldCode() {
    let attempts = 0;
    while (attempts < WORLD_CODE_CHARS.length ** 2) {
      const code = createSeededCode(this.generatedCodes++);
      if (!this.worlds.has(code)) return code;
      attempts += 1;
    }
    throw new Error("Unable to create a unique world code");
  }

  getOrCreateWorld(requestedCode?: string | null): WorldMembership {
    const normalized = isValidWorldCode(requestedCode)
      ? normalizeWorldCode(requestedCode)
      : this.createWorldCode();

    let world = this.worlds.get(normalized);
    if (!world) {
      world = new WorldState(normalized);
      this.worlds.set(normalized, world);
    }

    return {
      roomName: createRoomName(normalized),
      world,
      worldCode: normalized,
    };
  }

  joinWorld(socketId: string, requestedCode?: string | null) {
    const membership = this.getOrCreateWorld(requestedCode);
    this.socketToWorld.set(socketId, membership.worldCode);
    const joinResult = membership.world.addPlayer(socketId);

    return {
      ...membership,
      ...joinResult,
    };
  }

  leaveWorld(socketId: string) {
    const membership = this.getWorldForSocket(socketId);
    this.socketToWorld.delete(socketId);
    if (!membership) return null;

    return {
      ...membership,
      message: membership.world.removePlayer(socketId),
    };
  }

  getWorldForSocket(socketId: string): WorldMembership | null {
    const worldCode = this.socketToWorld.get(socketId);
    if (!worldCode) return null;
    const world = this.worlds.get(worldCode);
    if (!world) return null;

    return {
      worldCode,
      world,
      roomName: createRoomName(worldCode),
    };
  }

  getWorlds() {
    return Array.from(this.worlds.values());
  }

  getTotalPlayerCount() {
    return this.getWorlds().reduce((sum, world) => sum + world.getPlayers().length, 0);
  }
}
