import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html, Trail } from "@react-three/drei";

export function Jet({
  color = "#ffffff",
  position,
  quaternion,
  velocity,
  name,
  health,
  isLocal = false,
  isBot = false,
}: {
  color?: string;
  position: { x: number; y: number; z: number };
  quaternion: { x: number; y: number; z: number; w: number };
  velocity?: { x: number; y: number; z: number };
  name?: string;
  health?: number;
  isLocal?: boolean;
  isBot?: boolean;
}) {
  const trailRef = useRef<THREE.Mesh>(null);
  const trailRef2 = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const targetQuat = useRef(new THREE.Quaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w));

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    
    if (isBot && velocity) {
      const vel = new THREE.Vector3(velocity.x, velocity.y, velocity.z);
      if (vel.lengthSq() > 0.1) {
        vel.normalize();
        const up = new THREE.Vector3(0, 1, 0);
        targetQuat.current.setFromUnitVectors(new THREE.Vector3(0, 0, -1), vel);
      }
    } else {
      targetQuat.current.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    }

    if (groupRef.current) {
      groupRef.current.quaternion.slerp(targetQuat.current, delta * 15);
    }

    if (glowRef.current) {
      glowRef.current.scale.setScalar(0.8 + Math.sin(t * 12) * 0.2);
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(t * 8) * 0.2;
    }
    if (trailRef.current) {
      trailRef.current.scale.z = 1 + Math.sin(t * 15) * 0.3;
      (trailRef.current.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(t * 10) * 0.1;
    }
    if (trailRef2.current) {
      trailRef2.current.scale.z = 1 + Math.cos(t * 15) * 0.3;
      (trailRef2.current.material as THREE.MeshBasicMaterial).opacity = 0.2 + Math.cos(t * 10) * 0.1;
    }
  });

  return (
    <group
      ref={groupRef}
      position={[position.x, position.y, position.z]}
    >
      {/* Fuselage */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.5, 5, 6]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Cockpit canopy */}
      <mesh position={[0, 0.35, -0.6]} rotation={[-0.3, 0, 0]}>
        <sphereGeometry args={[0.35, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#88bbff" roughness={0.1} metalness={0.9} transparent opacity={0.7} />
      </mesh>

      {/* Left wing */}
      <mesh position={[-1.8, -0.1, 0.3]} rotation={[0, 0, -0.05]}>
        <boxGeometry args={[3, 0.08, 1.4]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.65} />
      </mesh>

      {/* Right wing */}
      <mesh position={[1.8, -0.1, 0.3]} rotation={[0, 0, 0.05]}>
        <boxGeometry args={[3, 0.08, 1.4]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.65} />
      </mesh>

      {/* Vertical stabilizer */}
      <mesh position={[0, 0.8, 1.8]} rotation={[-0.15, 0, 0]}>
        <boxGeometry args={[0.08, 1.4, 1]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.65} />
      </mesh>

      {/* Left horizontal stabilizer */}
      <mesh position={[-0.8, 0, 2]} rotation={[0, 0, -0.05]}>
        <boxGeometry args={[1.2, 0.06, 0.6]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.65} />
      </mesh>

      {/* Right horizontal stabilizer */}
      <mesh position={[0.8, 0, 2]} rotation={[0, 0, 0.05]}>
        <boxGeometry args={[1.2, 0.06, 0.6]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.65} />
      </mesh>

      {/* Engine glow */}
      <mesh ref={glowRef} position={[0, 0, 2.5]}>
        <circleGeometry args={[0.35, 12]} />
        <meshBasicMaterial color="#ff8800" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* Engine exhaust trail left */}
      <mesh ref={trailRef} position={[-0.2, 0, 4]}>
        <coneGeometry args={[0.15, 3, 6]} />
        <meshBasicMaterial color="#ff6600" transparent opacity={0.3} />
      </mesh>

      {/* Engine exhaust trail right */}
      <mesh ref={trailRef2} position={[0.2, 0, 4]}>
        <coneGeometry args={[0.15, 3, 6]} />
        <meshBasicMaterial color="#ff4400" transparent opacity={0.2} />
      </mesh>

      {/* Wing tip lights and Contrails */}
      <Trail width={0.3} length={12} color="#ffffff" attenuation={(t) => t * t}>
        <mesh position={[-3.3, -0.1, 0.3]}>
          <sphereGeometry args={[0.08, 6, 6]} />
          <meshBasicMaterial color="#ff0000" />
        </mesh>
      </Trail>
      <Trail width={0.3} length={12} color="#ffffff" attenuation={(t) => t * t}>
        <mesh position={[3.3, -0.1, 0.3]}>
          <sphereGeometry args={[0.08, 6, 6]} />
          <meshBasicMaterial color="#00ff00" />
        </mesh>
      </Trail>

      {/* Nametag (for remote players only) */}
      {!isLocal && name && (
        <Html position={[0, 3, 0]} center distanceFactor={80} sprite>
          <div style={{
            color: color,
            fontSize: "11px",
            fontFamily: "'Press Start 2P', monospace",
            textShadow: "1px 1px 3px rgba(0,0,0,0.9)",
            whiteSpace: "nowrap",
            userSelect: "none",
            textAlign: "center",
          }}>
            {name}
            {health !== undefined && (
              <div style={{
                marginTop: "3px",
                fontSize: "8px",
                color: health < 30 ? "#ff4444" : "#5dff7e",
              }}>
                {Math.round(health)}%
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}
