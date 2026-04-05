import { useMemo } from "react";
import * as THREE from "three";
import { createNoise2D } from "simplex-noise";

const TERRAIN_SIZE = 8000;
const SEGMENTS = 256;
const MAX_HEIGHT = 420;
const WATER_LEVEL = 0;

function getTerrainColor(height: number): THREE.Color {
  if (height < WATER_LEVEL - 5) return new THREE.Color("#1a4a7a");
  if (height < WATER_LEVEL + 2) return new THREE.Color("#c2a868");
  if (height < 60) return new THREE.Color("#4a7a3a");
  if (height < 140) return new THREE.Color("#3d6b2e");
  if (height < 240) return new THREE.Color("#6b6b6b");
  if (height < 340) return new THREE.Color("#8a8a8a");
  return new THREE.Color("#e8e8ef");
}

export function Terrain() {
  const { geometry, waterGeometry } = useMemo(() => {
    const noise2D = createNoise2D();
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, SEGMENTS, SEGMENTS);
    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position;
    const colors = new Float32Array(positions.count * 3);

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);

      // Multi-octave noise for natural-looking terrain
      let height = 0;
      height += noise2D(x * 0.0003, z * 0.0003) * MAX_HEIGHT;
      height += noise2D(x * 0.0008, z * 0.0008) * (MAX_HEIGHT * 0.4);
      height += noise2D(x * 0.002, z * 0.002) * (MAX_HEIGHT * 0.15);
      height += noise2D(x * 0.006, z * 0.006) * (MAX_HEIGHT * 0.05);

      // Flatten near edges to create ocean border
      const edgeDist = Math.max(
        Math.abs(x) / (TERRAIN_SIZE * 0.5),
        Math.abs(z) / (TERRAIN_SIZE * 0.5)
      );
      const edgeFade = Math.max(0, 1 - Math.pow(edgeDist, 3));
      height *= edgeFade;

      // Push below water level at edges
      if (edgeDist > 0.7) {
        height -= (edgeDist - 0.7) * 300;
      }

      positions.setY(i, height);

      const color = getTerrainColor(height);
      // Add slight variation
      const variation = (noise2D(x * 0.01, z * 0.01) * 0.05);
      colors[i * 3] = Math.min(1, Math.max(0, color.r + variation));
      colors[i * 3 + 1] = Math.min(1, Math.max(0, color.g + variation));
      colors[i * 3 + 2] = Math.min(1, Math.max(0, color.b + variation));
    }

    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    // Water plane
    const water = new THREE.PlaneGeometry(TERRAIN_SIZE * 1.5, TERRAIN_SIZE * 1.5);
    water.rotateX(-Math.PI / 2);

    return { geometry: geo, waterGeometry: water };
  }, []);

  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial
          vertexColors
          roughness={0.85}
          metalness={0.05}
          flatShading
        />
      </mesh>

      <mesh geometry={waterGeometry} position={[0, WATER_LEVEL - 5, 0]}>
        <meshStandardMaterial
          color="#1a5a8a"
          roughness={0.2}
          metalness={0.3}
          transparent
          opacity={0.82}
        />
      </mesh>
    </group>
  );
}
