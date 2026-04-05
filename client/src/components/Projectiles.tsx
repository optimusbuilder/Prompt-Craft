import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ProjectileState } from "@promptcraft/shared";
import { useMemo, useRef } from "react";

export function Projectiles({ projectiles }: { projectiles: ProjectileState[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const now = Date.now();
    projectiles.forEach((p, i) => {
      const age = (now - p.createdAt) / 1000;
      dummy.position.set(
        p.position.x + p.velocity.x * age,
        p.position.y + p.velocity.y * age,
        p.position.z + p.velocity.z * age
      );
      dummy.scale.set(1, 1, 10);
      dummy.lookAt(dummy.position.clone().add(new THREE.Vector3(p.velocity.x, p.velocity.y, p.velocity.z)));
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.count = projectiles.length;
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 1000]}>
      <boxGeometry args={[0.2, 0.2, 10]} />
      <meshBasicMaterial color="#ffdd00" />
    </instancedMesh>
  );
}
