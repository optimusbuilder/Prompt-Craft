import { Canvas } from "@react-three/fiber";
import type { PlayerState, ProjectileState } from "@promptcraft/shared";
import { SkyWorld } from "./SkyWorld";
import { Terrain } from "./Terrain";
import { JetControls } from "./JetControls";
import { Jet } from "./Jet";
import { Projectiles } from "./Projectiles";
import { PostProcessing } from "./PostProcessing";
import * as THREE from "three";

type WorldSceneProps = {
  players: PlayerState[];
  projectiles: ProjectileState[];
  localPlayerId: string | null;
  pointerLocked: boolean;
  health: number;
  onPointerLockChange: (locked: boolean) => void;
  onPositionChange: (pos: { position: THREE.Vector3; quaternion: THREE.Quaternion; velocity: THREE.Vector3 }) => void;
  onFire: (pos: THREE.Vector3, vel: THREE.Vector3) => void;
};

export function WorldScene({
  players,
  projectiles,
  localPlayerId,
  pointerLocked,
  health,
  onPointerLockChange,
  onPositionChange,
  onFire
}: WorldSceneProps) {
  return (
    <div className="scene-shell">
      <Canvas camera={{ fov: 75, near: 0.1, far: 12000 }} shadows gl={{ antialias: true, alpha: false }}>
        <fog attach="fog" args={["#b8d5ea", 500, 6000]} />
        <SkyWorld />
        <Terrain />
        
        <JetControls 
          locked={pointerLocked} 
          onPositionChange={onPositionChange} 
          health={health}
          onFire={onFire}
        />

        {players.map(p => (
          p.id !== localPlayerId && p.health > 0 && (
            <Jet
              key={p.id}
              color={p.color}
              position={p.position}
              quaternion={p.quaternion}
              name={p.name}
              health={p.health}
            />
          )
        ))}

        <Projectiles projectiles={projectiles} />
        <PostProcessing />
      </Canvas>
    </div>
  );
}
