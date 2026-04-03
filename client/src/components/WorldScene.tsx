import { Canvas } from "@react-three/fiber";
import type { SceneObject, WorldMetrics, PlayerState } from "@promptcraft/shared";
import { Terrain } from "./Terrain";
import { Sky } from "./Sky";
import { PlayerControls } from "./PlayerControls";
import { InstancedVoxels } from "./InstancedVoxels";
import { OtherPlayers } from "./OtherPlayers";
import { PostProcessing } from "./PostProcessing";
import { Particles } from "./Particles";

type WorldSceneProps = {
  objects: SceneObject[];
  metrics: WorldMetrics;
  featuredObject: SceneObject | null;
  players: PlayerState[];
  localPlayerId: string | null;
  pointerLocked: boolean;
  localPlayerColor: string;
  buildPulse: number;
  onPointerLockChange: (locked: boolean) => void;
  onPlayerMove?: (position: { x: number; y: number; z: number }, rotation: { x: number; y: number }) => void;
  onObjectDelete?: (objectId: string) => void;
};

export function WorldScene({
  objects,
  metrics,
  featuredObject,
  players,
  localPlayerId,
  pointerLocked,
  localPlayerColor,
  buildPulse,
  onPointerLockChange,
  onPlayerMove,
  onObjectDelete,
}: WorldSceneProps) {
  return (
    <div className="scene-shell">
      <Canvas
        camera={{ fov: 70, near: 0.1, far: 500 }}
        shadows
        gl={{ antialias: true, alpha: false }}
      >
        <Sky />

        <fog attach="fog" args={["#b8cce0", 40, 160]} />

        <PlayerControls
          locked={pointerLocked}
          onLockChange={onPointerLockChange}
          onPositionChange={onPlayerMove}
          armColor={localPlayerColor}
          buildPulse={buildPulse}
          objects={objects}
        />

        <Terrain />

        <InstancedVoxels
          objects={objects}
          featuredId={featuredObject?.id ?? null}
          onObjectDelete={onObjectDelete}
        />

        <OtherPlayers players={players} localId={localPlayerId} />

        <Particles />

        <PostProcessing />
      </Canvas>
    </div>
  );
}
