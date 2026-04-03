import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { createNoise2D } from "simplex-noise";

const CHUNK_SIZE = 16;
const RENDER_DISTANCE = 4;
const WATER_LEVEL = 2;
const TREE_TARGET_COUNT = 54;
const TREE_CELL_SIZE = 12;
const FLOWER_CELL_SIZE = 8;
const WORLD_MIN = -RENDER_DISTANCE * CHUNK_SIZE;
const WORLD_MAX = (RENDER_DISTANCE + 1) * CHUNK_SIZE - 1;

const BLOCK_COLORS: Record<string, string> = {
  grass_top: "#5da83a",
  dirt: "#8b6914",
  stone: "#7a7a7a",
  sand: "#d4c589",
  snow: "#e8edf0",
};

const VEGETATION_COLORS = {
  oakLeaf: "#4f8f33",
  oakLeafAccent: "#76b852",
  birchTrunk: "#f1eee7",
  birchTrunkAccent: "#303030",
  birchLeaf: "#8fc95b",
  pineTrunk: "#735331",
  pineLeaf: "#2f6b35",
  pineLeafAccent: "#4a8d4b",
  flowerRed: "#ff5470",
  flowerYellow: "#ffd84d",
  flowerBlue: "#75b9ff",
  flowerPink: "#ff99d4",
  flowerLavender: "#c6a2ff",
} as const;

type SurfaceType = "grass" | "sand" | "snow";

type ChunkData = {
  key: string;
  matrices: Float32Array;
  colors: Float32Array;
  count: number;
};

type DecorationBlock = {
  x: number;
  y: number;
  z: number;
  color: string;
  scale?: number;
};

function createSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const terrainNoise = createNoise2D(createSeededRandom(1));
const detailNoise = createNoise2D(createSeededRandom(2));
const microNoise = createNoise2D(createSeededRandom(3));
const treeScoreNoise = createNoise2D(createSeededRandom(4));
const treeTypeNoise = createNoise2D(createSeededRandom(5));
const treeOffsetNoise = createNoise2D(createSeededRandom(6));
const flowerScoreNoise = createNoise2D(createSeededRandom(7));
const flowerSpreadNoise = createNoise2D(createSeededRandom(8));

function getTerrainHeight(worldX: number, worldZ: number): number {
  const scale1 = 0.02;
  const scale2 = 0.06;
  const scale3 = 0.15;

  const base = terrainNoise(worldX * scale1, worldZ * scale1) * 12;
  const detail = detailNoise(worldX * scale2, worldZ * scale2) * 5;
  const micro = microNoise(worldX * scale3, worldZ * scale3) * 2;

  return Math.floor(base + detail + micro + 6);
}

function getSurfaceType(surfaceY: number): SurfaceType {
  if (surfaceY <= WATER_LEVEL) return "sand";
  if (surfaceY > 16) return "snow";
  return "grass";
}

function getBlockColor(y: number, surfaceY: number): string | null {
  if (y > surfaceY) return null;
  if (y === surfaceY) {
    const surface = getSurfaceType(surfaceY);
    if (surface === "sand") return BLOCK_COLORS.sand;
    if (surface === "snow") return BLOCK_COLORS.snow;
    return BLOCK_COLORS.grass_top;
  }
  if (y >= surfaceY - 3) return BLOCK_COLORS.dirt;
  return BLOCK_COLORS.stone;
}

function createBatch(key: string, blocks: DecorationBlock[]): ChunkData {
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const matrices: number[] = [];
  const colors: number[] = [];

  for (const block of blocks) {
    dummy.position.set(block.x, block.y, block.z);
    dummy.scale.setScalar(block.scale ?? 1);
    dummy.updateMatrix();
    matrices.push(...dummy.matrix.elements);

    color.set(block.color);
    const variation = ((block.x * 17 + block.z * 11 + block.y * 5) % 20) / 220 - 0.04;
    colors.push(
      THREE.MathUtils.clamp(color.r + variation, 0, 1),
      THREE.MathUtils.clamp(color.g + variation, 0, 1),
      THREE.MathUtils.clamp(color.b + variation, 0, 1)
    );
  }

  return {
    key,
    matrices: new Float32Array(matrices),
    colors: new Float32Array(colors),
    count: blocks.length,
  };
}

function generateChunk(chunkX: number, chunkZ: number): ChunkData {
  const blocks: DecorationBlock[] = [];

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const worldX = chunkX * CHUNK_SIZE + lx;
      const worldZ = chunkZ * CHUNK_SIZE + lz;
      const surfaceY = getTerrainHeight(worldX, worldZ);
      const startY = Math.max(0, surfaceY - 1);

      for (let y = startY; y <= surfaceY; y++) {
        const blockColor = getBlockColor(y, surfaceY);
        if (!blockColor) continue;
        blocks.push({ x: worldX, y, z: worldZ, color: blockColor });
      }
    }
  }

  return createBatch(`${chunkX}_${chunkZ}`, blocks);
}

function createOakTree(baseX: number, baseY: number, baseZ: number): DecorationBlock[] {
  const blocks: DecorationBlock[] = [];
  const trunkHeight = 4 + ((baseX + baseZ) % 2);

  for (let y = 0; y < trunkHeight; y++) {
    blocks.push({ x: baseX, y: baseY + y, z: baseZ, color: "#6b4400" });
  }

  for (let x = -2; x <= 2; x++) {
    for (let z = -2; z <= 2; z++) {
      for (let y = 0; y <= 2; y++) {
        const dist = Math.abs(x) + Math.abs(z) + y;
        if (dist <= 4 && !(x === 0 && z === 0 && y === 2)) {
          blocks.push({
            x: baseX + x,
            y: baseY + trunkHeight - 1 + y,
            z: baseZ + z,
            color: dist < 2 ? VEGETATION_COLORS.oakLeafAccent : VEGETATION_COLORS.oakLeaf,
          });
        }
      }
    }
  }

  return blocks;
}

function createBirchTree(baseX: number, baseY: number, baseZ: number): DecorationBlock[] {
  const blocks: DecorationBlock[] = [];
  const trunkHeight = 5;

  for (let y = 0; y < trunkHeight; y++) {
    blocks.push({ x: baseX, y: baseY + y, z: baseZ, color: VEGETATION_COLORS.birchTrunk });
    if (y % 2 === 1) {
      blocks.push({
        x: baseX,
        y: baseY + y,
        z: baseZ + (y % 4 === 1 ? 0.02 : -0.02),
        color: VEGETATION_COLORS.birchTrunkAccent,
        scale: 0.35,
      });
    }
  }

  for (let x = -2; x <= 2; x++) {
    for (let z = -2; z <= 2; z++) {
      const ring = Math.abs(x) + Math.abs(z);
      if (ring <= 3) {
        blocks.push({
          x: baseX + x,
          y: baseY + trunkHeight,
          z: baseZ + z,
          color: ring <= 1 ? VEGETATION_COLORS.oakLeafAccent : VEGETATION_COLORS.birchLeaf,
        });
      }
      if (ring <= 2) {
        blocks.push({
          x: baseX + x,
          y: baseY + trunkHeight + 1,
          z: baseZ + z,
          color: VEGETATION_COLORS.birchLeaf,
        });
      }
    }
  }

  return blocks;
}

function createPineTree(baseX: number, baseY: number, baseZ: number): DecorationBlock[] {
  const blocks: DecorationBlock[] = [];
  const trunkHeight = 7;

  for (let y = 0; y < trunkHeight; y++) {
    blocks.push({ x: baseX, y: baseY + y, z: baseZ, color: VEGETATION_COLORS.pineTrunk });
  }

  for (let layer = 0; layer < 4; layer++) {
    const radius = Math.max(1, 3 - layer);
    const y = baseY + trunkHeight - 3 + layer;

    for (let x = -radius; x <= radius; x++) {
      for (let z = -radius; z <= radius; z++) {
        const dist = Math.abs(x) + Math.abs(z);
        if (dist <= radius + 1) {
          blocks.push({
            x: baseX + x,
            y,
            z: baseZ + z,
            color: layer === 3 ? VEGETATION_COLORS.pineLeafAccent : VEGETATION_COLORS.pineLeaf,
          });
        }
      }
    }
  }

  blocks.push({
    x: baseX,
    y: baseY + trunkHeight + 1,
    z: baseZ,
    color: VEGETATION_COLORS.pineLeafAccent,
  });

  return blocks;
}

function createFlowerPatch(baseX: number, baseZ: number, seed: number): DecorationBlock[] {
  const colors = [
    VEGETATION_COLORS.flowerRed,
    VEGETATION_COLORS.flowerYellow,
    VEGETATION_COLORS.flowerBlue,
    VEGETATION_COLORS.flowerPink,
    VEGETATION_COLORS.flowerLavender,
  ];
  const blocks: DecorationBlock[] = [];

  for (let i = 0; i < 5; i++) {
    const offsetX = Math.round(flowerSpreadNoise((baseX + i) * 0.5, baseZ * 0.35) * 2);
    const offsetZ = Math.round(flowerSpreadNoise(baseX * 0.35, (baseZ + i) * 0.5) * 2);
    const flowerX = baseX + offsetX;
    const flowerZ = baseZ + offsetZ;
    const surfaceY = getTerrainHeight(flowerX, flowerZ);

    if (getSurfaceType(surfaceY) !== "grass") continue;
    blocks.push({
      x: flowerX,
      y: surfaceY + 1,
      z: flowerZ,
      color: colors[(seed + i) % colors.length],
      scale: 0.45 + ((seed + i) % 3) * 0.08,
    });
  }

  return blocks;
}

function buildVegetationBatches(): ChunkData[] {
  const treeCandidates: { x: number; z: number; y: number; score: number }[] = [];

  for (let cellX = WORLD_MIN; cellX <= WORLD_MAX; cellX += TREE_CELL_SIZE) {
    for (let cellZ = WORLD_MIN; cellZ <= WORLD_MAX; cellZ += TREE_CELL_SIZE) {
      const centerX = cellX + TREE_CELL_SIZE / 2;
      const centerZ = cellZ + TREE_CELL_SIZE / 2;
      const offsetX = Math.round(treeOffsetNoise(centerX * 0.12, centerZ * 0.12) * 4);
      const offsetZ = Math.round(treeOffsetNoise(centerX * 0.15, centerZ * 0.15) * 4);
      const x = THREE.MathUtils.clamp(Math.round(centerX + offsetX), WORLD_MIN, WORLD_MAX);
      const z = THREE.MathUtils.clamp(Math.round(centerZ + offsetZ), WORLD_MIN, WORLD_MAX);
      const y = getTerrainHeight(x, z);

      if (getSurfaceType(y) !== "grass") continue;

      treeCandidates.push({
        x,
        z,
        y,
        score: treeScoreNoise(centerX * 0.08, centerZ * 0.08),
      });
    }
  }

  treeCandidates.sort((a, b) => b.score - a.score);
  const selectedTrees = treeCandidates.slice(0, TREE_TARGET_COUNT);
  const vegetationBlocks: DecorationBlock[] = [];

  for (const tree of selectedTrees) {
    const typeValue = treeTypeNoise(tree.x * 0.09, tree.z * 0.09);
    const baseY = tree.y + 1;
    const blocks =
      typeValue > 0.28
        ? createPineTree(tree.x, baseY, tree.z)
        : typeValue < -0.12
          ? createBirchTree(tree.x, baseY, tree.z)
          : createOakTree(tree.x, baseY, tree.z);
    vegetationBlocks.push(...blocks);
  }

  for (let cellX = WORLD_MIN; cellX <= WORLD_MAX; cellX += FLOWER_CELL_SIZE) {
    for (let cellZ = WORLD_MIN; cellZ <= WORLD_MAX; cellZ += FLOWER_CELL_SIZE) {
      const score = flowerScoreNoise(cellX * 0.14, cellZ * 0.14);
      if (score < 0.58) continue;

      const baseX = Math.round(cellX + FLOWER_CELL_SIZE / 2 + flowerSpreadNoise(cellX * 0.2, cellZ * 0.2) * 3);
      const baseZ = Math.round(cellZ + FLOWER_CELL_SIZE / 2 + flowerSpreadNoise(cellX * 0.25, cellZ * 0.25) * 3);
      const tooCloseToTree = selectedTrees.some(
        (tree) => Math.abs(tree.x - baseX) + Math.abs(tree.z - baseZ) < 6
      );
      if (tooCloseToTree) continue;

      vegetationBlocks.push(...createFlowerPatch(baseX, baseZ, cellX + cellZ));
    }
  }

  const batches = new Map<string, DecorationBlock[]>();
  for (const block of vegetationBlocks) {
    const key = block.color;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key)!.push(block);
  }

  return Array.from(batches.entries()).map(([color, blocks]) => createBatch(`veg_${color}`, blocks));
}

function InstancedColorMesh({ batch }: { batch: ChunkData }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!meshRef.current || batch.count === 0) return;
    const mesh = meshRef.current;
    const mat4 = new THREE.Matrix4();
    const color = new THREE.Color();

    for (let i = 0; i < batch.count; i++) {
      mat4.fromArray(batch.matrices, i * 16);
      mesh.setMatrixAt(i, mat4);
      color.setRGB(batch.colors[i * 3], batch.colors[i * 3 + 1], batch.colors[i * 3 + 2]);
      mesh.setColorAt(i, color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [batch]);

  if (batch.count === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, batch.count]} receiveShadow castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.85} metalness={0.05} />
    </instancedMesh>
  );
}

function WaterPlane() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y =
        WATER_LEVEL + 0.35 + Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
    }
  });

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, WATER_LEVEL + 0.35, 0]}
    >
      <planeGeometry args={[CHUNK_SIZE * RENDER_DISTANCE * 2.5, CHUNK_SIZE * RENDER_DISTANCE * 2.5]} />
      <meshStandardMaterial
        color="#2277bb"
        transparent
        opacity={0.55}
        roughness={0.15}
        metalness={0.3}
      />
    </mesh>
  );
}

export function Terrain() {
  const chunks = useMemo(() => {
    const result: ChunkData[] = [];
    for (let cx = -RENDER_DISTANCE; cx <= RENDER_DISTANCE; cx++) {
      for (let cz = -RENDER_DISTANCE; cz <= RENDER_DISTANCE; cz++) {
        result.push(generateChunk(cx, cz));
      }
    }
    return result;
  }, []);

  const vegetationBatches = useMemo(() => buildVegetationBatches(), []);

  return (
    <group>
      {chunks.map((chunk) => (
        <InstancedColorMesh key={chunk.key} batch={chunk} />
      ))}
      {vegetationBatches.map((batch) => (
        <InstancedColorMesh key={batch.key} batch={batch} />
      ))}
      <WaterPlane />
    </group>
  );
}

export { getTerrainHeight, WATER_LEVEL };
