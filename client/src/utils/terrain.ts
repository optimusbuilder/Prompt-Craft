import { createNoise2D } from "simplex-noise";

// In a real multiplayer game we would seed this with a shared seed,
// but for now, since it runs completely on the client, we just need
// a single shared instance so collision matches visuals.
// Actually, since players might have different terrains if they don't share a seed,
// let's use a very simple custom LCG random function based on a fixed seed 
// so every client gets the SAME terrain geometry!

function mulberry32(a: number) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

// Fixed seed for now so everyone is playing on the same map
const randomFunc = mulberry32(1337); 
const noise2D = createNoise2D(randomFunc);

export const TERRAIN_SIZE = 8000;
export const MAX_HEIGHT = 420;
export const WATER_LEVEL = 0;

export function getTerrainHeight(x: number, z: number): number {
  let height = 0;
  height += noise2D(x * 0.0003, z * 0.0003) * MAX_HEIGHT;
  height += noise2D(x * 0.0008, z * 0.0008) * (MAX_HEIGHT * 0.4);
  height += noise2D(x * 0.002, z * 0.002) * (MAX_HEIGHT * 0.15);
  height += noise2D(x * 0.006, z * 0.006) * (MAX_HEIGHT * 0.05);

  const edgeDist = Math.max(
    Math.abs(x) / (TERRAIN_SIZE * 0.5),
    Math.abs(z) / (TERRAIN_SIZE * 0.5)
  );
  const edgeFade = Math.max(0, 1 - Math.pow(edgeDist, 3));
  height *= edgeFade;

  if (edgeDist > 0.7) {
    height -= (edgeDist - 0.7) * 300;
  }

  return height;
}

export { noise2D };
