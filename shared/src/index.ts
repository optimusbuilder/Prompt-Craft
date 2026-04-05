export type Vector3 = { x: number; y: number; z: number };
export type Quaternion = { x: number; y: number; z: number; w: number };

export type PlayerState = {
  id: string;
  name: string;
  color: string;
  position: Vector3;
  quaternion: Quaternion;
  velocity: Vector3;
  health: number;
  kills: number;
  deaths: number;
  isBot?: boolean;
};

export type ProjectileState = {
  id: string;
  ownerId: string;
  position: Vector3;
  velocity: Vector3;
  createdAt: number;
};

export type KillEvent = {
  killerId: string;
  killerName: string;
  killerColor: string;
  victimId: string;
  victimName: string;
  victimColor: string;
  timestamp: number;
};

export type WorldMetrics = {
  playerCount: number;
  projectileCount: number;
  sessionAgeSeconds: number;
};

export type WorldSnapshot = {
  players: PlayerState[];
  projectiles: ProjectileState[];
  metrics: WorldMetrics;
  chatHistory: ChatMessage[];
  worldCode: string;
  recentKills: KillEvent[];
};

export type ChatMessage = {
  id: string;
  sender: string;
  senderColor: string;
  text: string;
  timestamp: number;
  isSystem: boolean;
};

export type PlayerInput = {
  position: Vector3;
  quaternion: Quaternion;
  velocity: Vector3;
};
