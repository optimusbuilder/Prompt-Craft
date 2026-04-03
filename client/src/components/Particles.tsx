import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 200;

export function Particles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    return Array.from({ length: PARTICLE_COUNT }, () => ({
      x: (Math.random() - 0.5) * 80,
      y: Math.random() * 30 + 2,
      z: (Math.random() - 0.5) * 80,
      speed: 0.1 + Math.random() * 0.3,
      phase: Math.random() * Math.PI * 2,
      size: 0.04 + Math.random() * 0.08,
    }));
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = particles[i];
      dummy.position.set(
        p.x + Math.sin(t * p.speed + p.phase) * 2,
        p.y + Math.sin(t * 0.3 + p.phase) * 1.5,
        p.z + Math.cos(t * p.speed + p.phase) * 2
      );
      dummy.scale.setScalar(p.size * (0.8 + Math.sin(t * 2 + p.phase) * 0.2));
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial color="#ffffcc" transparent opacity={0.5} />
    </instancedMesh>
  );
}
