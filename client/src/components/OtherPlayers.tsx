import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import type { PlayerState } from "@promptcraft/shared";

type OtherPlayersProps = {
  players: PlayerState[];
  localId: string | null;
};

function PlayerAvatar({ player }: { player: PlayerState }) {
  const groupRef = useRef<THREE.Group>(null);
  const targetPos = useRef(new THREE.Vector3(player.position.x, player.position.y, player.position.z));

  useFrame(() => {
    if (!groupRef.current) return;

    targetPos.current.set(player.position.x, player.position.y, player.position.z);
    groupRef.current.position.lerp(targetPos.current, 0.15);

    // Face direction based on rotation
    groupRef.current.rotation.y = player.rotation.y;
  });

  return (
    <group ref={groupRef} position={[player.position.x, player.position.y, player.position.z]}>
      {/* Body */}
      <mesh position={[0, -0.45, 0]} castShadow>
        <boxGeometry args={[0.6, 0.9, 0.35]} />
        <meshStandardMaterial color={player.color} roughness={0.7} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#e8c99b" roughness={0.8} />
      </mesh>

      {/* Eyes */}
      <mesh position={[-0.12, 0.28, 0.26]}>
        <boxGeometry args={[0.08, 0.08, 0.02]} />
        <meshBasicMaterial color="#222222" />
      </mesh>
      <mesh position={[0.12, 0.28, 0.26]}>
        <boxGeometry args={[0.08, 0.08, 0.02]} />
        <meshBasicMaterial color="#222222" />
      </mesh>

      {/* Left arm */}
      <mesh position={[-0.45, -0.45, 0]} castShadow>
        <boxGeometry args={[0.25, 0.85, 0.25]} />
        <meshStandardMaterial color={player.color} roughness={0.7} />
      </mesh>

      {/* Right arm */}
      <mesh position={[0.45, -0.45, 0]} castShadow>
        <boxGeometry args={[0.25, 0.85, 0.25]} />
        <meshStandardMaterial color={player.color} roughness={0.7} />
      </mesh>

      {/* Left leg */}
      <mesh position={[-0.15, -1.25, 0]} castShadow>
        <boxGeometry args={[0.25, 0.75, 0.3]} />
        <meshStandardMaterial color="#3a3a5c" roughness={0.8} />
      </mesh>

      {/* Right leg */}
      <mesh position={[0.15, -1.25, 0]} castShadow>
        <boxGeometry args={[0.25, 0.75, 0.3]} />
        <meshStandardMaterial color="#3a3a5c" roughness={0.8} />
      </mesh>

      {/* Nametag */}
      <Billboard position={[0, 0.8, 0]}>
        <Text
          color="#ffffff"
          fontSize={0.2}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.015}
          outlineColor="#000000"
        >
          {player.name}
        </Text>
      </Billboard>
    </group>
  );
}

export function OtherPlayers({ players, localId }: OtherPlayersProps) {
  const others = players.filter((p) => p.id !== localId);

  return (
    <group>
      {others.map((player) => (
        <PlayerAvatar key={player.id} player={player} />
      ))}
    </group>
  );
}
