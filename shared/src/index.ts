export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

export type Voxel = {
  x: number;
  y: number;
  z: number;
  color: string;
  scale: number;
};

export type MaterialSettings = {
  roughness: number;
  metalness: number;
  emissive: string;
  bloom: number;
};

export type StructureArchetype =
  | "spire"
  | "bridge"
  | "bloom"
  | "citadel"
  | "dome"
  | "relay"
  | "house"
  | "tree"
  | "pyramid"
  | "arch"
  | "fountain"
  | "wall"
  | "tower";

export type SceneObject = {
  id: string;
  prompt: string;
  archetype: StructureArchetype;
  position: Vector3;
  voxels: Voxel[];
  material: MaterialSettings;
  accentColor: string;
  createdAt: number;
};

export type WorldMetrics = {
  objectCount: number;
  totalPrompts: number;
  districtCount: number;
  archetypeVariety: number;
  paletteVariety: number;
  sessionAgeSeconds: number;
  playerCount: number;
};

export type WorldSnapshot = {
  objects: SceneObject[];
  metrics: WorldMetrics;
  players: PlayerState[];
  chatHistory: ChatMessage[];
  worldCode: string;
};

export type PromptSubmission = {
  prompt: string;
  position?: Vector3;
};

export type PlayerState = {
  id: string;
  position: Vector3;
  rotation: { x: number; y: number };
  color: string;
  name: string;
};

export type ChatMessage = {
  id: string;
  sender: string;
  senderColor: string;
  text: string;
  timestamp: number;
  isSystem: boolean;
};
