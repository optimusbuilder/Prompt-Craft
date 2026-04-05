import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 60;

export function ExplosionEffect({ position, createdAt }: { position: THREE.Vector3; createdAt: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    return Array.from({ length: PARTICLE_COUNT }, () => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const speed = 20 + Math.random() * 40;
      return {
        dir: new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.sin(phi) * Math.sin(theta),
          Math.cos(phi)
        ),
        speed,
        size: 1 + Math.random() * 2,
      };
    });
  }, []);

  useFrame(() => {
    if (!meshRef.current || !materialRef.current) return;
    const age = (Date.now() - createdAt) / 1000;
    
    // Fade out after 1.5 seconds
    if (age > 1.5) {
      meshRef.current.visible = false;
      return;
    }

    const progress = age / 1.5;
    materialRef.current.opacity = 1 - progress;
    // Shift color from bright yellow-white to dark orange/red as it cools
    materialRef.current.color.lerpColors(
      new THREE.Color("#ffffff"),
      new THREE.Color("#ff4400"),
      Math.min(1, progress * 3)
    );

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i];
        // Slow down over time (drag)
        const currentDistance = p.speed * age * Math.exp(-age * 2);
        
        dummy.position.copy(position).add(p.dir.clone().multiplyScalar(currentDistance));
        // Expand then shrink
        const currentSize = p.size * (1 + age * 2) * (1 - progress);
        dummy.scale.setScalar(currentSize);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial ref={materialRef} transparent opacity={1} depthWrite={false} color="#ffffff" />
    </instancedMesh>
  );
}
