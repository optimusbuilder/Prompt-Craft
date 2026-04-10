import { Canvas } from "@react-three/fiber";
import type { PlayerState, ProjectileState } from "@promptcraft/shared";
import { SkyWorld } from "./SkyWorld";
import { Terrain } from "./Terrain";
import { JetControls } from "./JetControls";
import { Jet } from "./Jet";
import { Projectiles } from "./Projectiles";
import { PostProcessing } from "./PostProcessing";
import { ExplosionEffect } from "./ExplosionEffect";
import * as THREE from "three";

type WorldSceneProps = {
  players: PlayerState[];
  projectiles: ProjectileState[];
  explosions: { id: string; position: THREE.Vector3; createdAt: number }[];
  localPlayerId: string | null;
  cameraMode: "first_person" | "third_person";
  pointerLocked: boolean;
  health: number;
  localPlayerTransform: {
    position: { x: number; y: number; z: number };
    quaternion: { x: number; y: number; z: number; w: number };
    velocity: { x: number; y: number; z: number };
  } | null;
  localPlayerColor: string;
  onPointerLockChange: (locked: boolean) => void;
  onPositionChange: (pos: { position: THREE.Vector3; quaternion: THREE.Quaternion; velocity: THREE.Vector3 }) => void;
  onFire: (pos: THREE.Vector3, vel: THREE.Vector3) => void;
  onCrash: () => void;
};

export function WorldScene({
  players,
  projectiles,
  explosions,
  localPlayerId,
  cameraMode,
  pointerLocked,
  health,
  localPlayerTransform,
  localPlayerColor,
  onPointerLockChange,
  onPositionChange,
  onFire,
  onCrash
}: WorldSceneProps) {
  return (
    <div className="scene-shell">
      <Canvas camera={{ fov: 75, near: 0.1, far: 12000 }} shadows gl={{ antialias: true, alpha: false }}>
        <fog attach="fog" args={["#b8d5ea", 500, 6000]} />
        <SkyWorld />
        <Terrain />
        
        <JetControls 
          locked={pointerLocked} 
          cameraMode={cameraMode}
          onPositionChange={onPositionChange} 
          health={health}
          onFire={onFire}
          onCrash={onCrash}
        />

        {cameraMode === "third_person" && localPlayerTransform && health > 0 && (
          <Jet
            key="local-player-jet"
            color={localPlayerColor}
            position={localPlayerTransform.position}
            quaternion={localPlayerTransform.quaternion}
            velocity={localPlayerTransform.velocity}
            isLocal
            name="YOU"
            health={health}
          />
        )}

        {players.map(p => (
          p.id !== localPlayerId && p.health > 0 && (
            <Jet
              key={p.id}
              color={p.color}
              position={p.position}
              quaternion={p.quaternion}
              velocity={p.velocity}
              isBot={p.isBot}
              name={p.name}
              health={p.health}
            />
          )
        ))}

        {explosions.map(e => (
          <ExplosionEffect key={e.id} position={e.position} createdAt={e.createdAt} />
        ))}

        <Projectiles projectiles={projectiles} />
        <PostProcessing />
      </Canvas>
    </div>
  );
}
