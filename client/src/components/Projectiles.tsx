import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ProjectileState } from "@promptcraft/shared";
import { useMemo, useRef } from "react";

export function Projectiles({ projectiles }: { projectiles: ProjectileState[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    if (!meshRef.current) return;
    const now = Date.now();
    const count = Math.min(projectiles.length, 500);

    projectiles.slice(0, count).forEach((p, i) => {
      const age = (now - p.createdAt) / 1000;
      dummy.position.set(
        p.position.x + p.velocity.x * age,
        p.position.y + p.velocity.y * age,
        p.position.z + p.velocity.z * age
      );
      const dir = new THREE.Vector3(p.velocity.x, p.velocity.y, p.velocity.z);
      dummy.lookAt(dummy.position.clone().add(dir));
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
      if (glowRef.current) {
        dummy.scale.set(3, 3, 0.5);
        dummy.updateMatrix();
        glowRef.current.setMatrixAt(i, dummy.matrix);
      }
    });

    meshRef.current.count = count;
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (glowRef.current) {
      glowRef.current.count = count;
      glowRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      {/* Tracer core */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, 500]}>
        <boxGeometry args={[0.15, 0.15, 6]} />
        <meshBasicMaterial color="#ffee44" toneMapped={false} />
      </instancedMesh>
      {/* Tracer glow */}
      <instancedMesh ref={glowRef} args={[undefined, undefined, 500]}>
        <boxGeometry args={[0.15, 0.15, 6]} />
        <meshBasicMaterial color="#ff8800" transparent opacity={0.2} toneMapped={false} />
      </instancedMesh>
    </>
  );
}
