import * as THREE from "three";

export function Jet({ color = "#ffffff", position, quaternion }: { color?: string; position: { x: number; y: number; z: number }; quaternion: { x: number; y: number; z: number; w: number } }) {
  return (
    <group position={[position.x, position.y, position.z]} quaternion={[quaternion.x, quaternion.y, quaternion.z, quaternion.w]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.6, 4, 4]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.5]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.1, 5, 3]} />
        <meshStandardMaterial color={"#333"} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.6, 1.5]} rotation={[-0.2, 0, 0]}>
        <boxGeometry args={[0.1, 1, 0.8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0, 1.8]}>
        <circleGeometry args={[0.3, 8]} />
        <meshBasicMaterial color="#ffaa00" />
      </mesh>
    </group>
  );
}
