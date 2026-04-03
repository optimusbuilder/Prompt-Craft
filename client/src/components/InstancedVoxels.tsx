import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import type { SceneObject } from "@promptcraft/shared";
import { playPop, playDelete } from "../utils/audio";

const BLOCK_REVEAL_DELAY = 0.04;
const POP_DURATION = 0.22;
const MAX_ANIMATION_AGE_MS = 25000;

type InstancedVoxelsProps = {
  objects: SceneObject[];
  featuredId: string | null;
  onObjectDelete?: (objectId: string) => void;
};

type VoxelInstance = {
  position: [number, number, number];
  scale: number;
  revealDelay: number;
  createdAt: number;
  objectId: string;
};

type VoxelBatch = {
  key: string;
  color: string;
  emissive: string;
  emissiveIntensity: number;
  roughness: number;
  metalness: number;
  instances: VoxelInstance[];
};

function buildBatches(objects: SceneObject[]): VoxelBatch[] {
  const batchMap = new Map<
    string,
    {
      config: Omit<VoxelBatch, "instances" | "key">;
      instances: VoxelInstance[];
    }
  >();
  const now = Date.now();

  for (const obj of objects) {
    const animate = now - obj.createdAt < MAX_ANIMATION_AGE_MS;
    const sortedVoxels = [...obj.voxels].sort(
      (a, b) => a.y - b.y || a.x - b.x || a.z - b.z
    );

    sortedVoxels.forEach((voxel, index) => {
      const batchKey = `${voxel.color}_${obj.material.emissive}_${obj.material.roughness}_${obj.material.metalness}`;

      if (!batchMap.has(batchKey)) {
        batchMap.set(batchKey, {
          config: {
            color: voxel.color,
            emissive: obj.material.emissive,
            emissiveIntensity: obj.material.bloom,
            roughness: obj.material.roughness,
            metalness: obj.material.metalness,
          },
          instances: [],
        });
      }

      batchMap.get(batchKey)!.instances.push({
        position: [
          obj.position.x + voxel.x,
          obj.position.y + voxel.y,
          obj.position.z + voxel.z,
        ],
        scale: voxel.scale,
        revealDelay: animate ? index * BLOCK_REVEAL_DELAY : -1,
        createdAt: obj.createdAt,
        objectId: obj.id,
      });
    });
  }

  return Array.from(batchMap.entries()).map(([key, { config, instances }]) => ({
    key,
    ...config,
    instances,
  }));
}

function VoxelBatchMesh({ batch, onDelete }: { batch: VoxelBatch; onDelete?: (id: string) => void }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const isStaticRef = useRef(false);
  const lastPoppedIndex = useRef<number>(-1);
  const maxRevealDelay = useMemo(
    () =>
      batch.instances.reduce(
        (max, instance) => Math.max(max, instance.revealDelay),
        -1
      ),
    [batch.instances]
  );

  useEffect(() => {
    if (!meshRef.current || batch.instances.length === 0) return;
    const mesh = meshRef.current;

    isStaticRef.current = maxRevealDelay < 0;
    for (let i = 0; i < batch.instances.length; i++) {
      const instance = batch.instances[i];
      dummy.position.set(...instance.position);
      dummy.scale.setScalar(instance.revealDelay < 0 ? instance.scale : 0.0001);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  }, [batch.instances, dummy, maxRevealDelay]);

  useFrame(() => {
    if (!meshRef.current || batch.instances.length === 0 || isStaticRef.current) return;
    const mesh = meshRef.current;
    const nowSeconds = Date.now() * 0.001;
    let allVisible = true;

    for (let i = 0; i < batch.instances.length; i++) {
      const instance = batch.instances[i];
      const localAge = nowSeconds - instance.createdAt * 0.001 - instance.revealDelay;
      let currentScale = instance.scale;

      if (localAge <= 0) {
        currentScale = 0.0001;
        allVisible = false;
      } else if (localAge < POP_DURATION) {
        if (i > lastPoppedIndex.current) {
          lastPoppedIndex.current = i;
          playPop();
        }
        const progress = localAge / POP_DURATION;
        const eased = 1 - Math.pow(1 - progress, 3);
        const pop = 1 + Math.sin(progress * Math.PI) * 0.22;
        currentScale = Math.max(0.0001, instance.scale * eased * pop);
        allVisible = false;
      }

      dummy.position.set(...instance.position);
      dummy.scale.setScalar(currentScale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;

    if (allVisible && nowSeconds - batch.instances[0].createdAt * 0.001 > maxRevealDelay + POP_DURATION) {
      isStaticRef.current = true;
    }
  });

  if (batch.instances.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, batch.instances.length]}
      castShadow
      receiveShadow
      onClick={(e) => {
        if (e.instanceId !== undefined && onDelete) {
          e.stopPropagation();
          playDelete();
          onDelete(batch.instances[e.instanceId].objectId);
        }
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={batch.color}
        emissive={batch.emissive}
        emissiveIntensity={batch.emissiveIntensity}
        roughness={batch.roughness}
        metalness={batch.metalness}
      />
    </instancedMesh>
  );
}

function StructureLabel({ object }: { object: SceneObject }) {
  const labelY = Math.max(...object.voxels.map((v) => v.y)) + object.position.y + 2.5;

  return (
    <Billboard position={[object.position.x + 1, labelY, object.position.z + 1]}>
      <Text
        color={object.accentColor}
        anchorX="center"
        anchorY="middle"
        fontSize={0.45}
        maxWidth={8}
        outlineWidth={0.03}
        outlineColor="#000000"
      >
        {object.prompt}
      </Text>
    </Billboard>
  );
}

function StructureBeacon({ object }: { object: SceneObject }) {
  const beaconRef = useRef<THREE.Mesh>(null);
  const maxY = Math.max(...object.voxels.map((v) => v.y)) + object.position.y;

  // Static beacon with no bobbing to prevent drifting UI visuals
  return (
    <mesh
      ref={beaconRef}
      position={[object.position.x + 1, maxY + 6, object.position.z + 1]}
    >
      <cylinderGeometry args={[0.05, 0.25, 12, 4, 1, true]} />
      <meshBasicMaterial
        color={object.material.emissive}
        transparent
        opacity={0.15}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function InstancedVoxels({ objects, featuredId, onObjectDelete }: InstancedVoxelsProps) {
  const batches = useMemo(() => buildBatches(objects), [objects]);

  return (
    <group>
      {batches.map((batch) => (
        <VoxelBatchMesh key={batch.key} batch={batch} onDelete={onObjectDelete} />
      ))}
      {objects.map((obj) => (
        <group key={obj.id}>
          <StructureBeacon object={obj} />
          {obj.id === featuredId && <StructureLabel object={obj} />}
        </group>
      ))}
    </group>
  );
}
