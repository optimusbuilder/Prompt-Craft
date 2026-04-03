import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Voxel, StructureArchetype, MaterialSettings } from "@promptcraft/shared";

const apiKey = (process.env.GEMINI_API_KEY ?? process.env.AI_API_KEY ?? "").replace(/"/g, "");

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const SYSTEM_PROMPT = `You are the World Architect for Prompt-Craft, a Minecraft-style voxel game. Players type natural language descriptions and you convert them into voxel structures.

Return ONLY a valid JSON object with this exact schema (no markdown, no code fences, just raw JSON):

{
  "archetype": "house",
  "voxels": [
    { "x": 0, "y": 0, "z": 0, "color": "#5da83a", "scale": 1 }
  ],
  "material": {
    "roughness": 0.6,
    "metalness": 0.15,
    "emissive": "#000000",
    "bloom": 0.3
  },
  "accentColor": "#5da83a"
}

Valid archetype values: "house", "tree", "pyramid", "arch", "fountain", "wall", "tower", "bridge", "bloom", "citadel", "dome", "relay", "spire"

Rules:
- Generate 40-150 voxels to create a recognizable structure
- Each voxel is a 1x1x1 cube at integer coordinates
- y=0 is ground level, build upward
- Use hex color strings like "#ff0000"
- Make structures that visually match the description
- Be creative with shapes and make them interesting
- Use emissive colors and higher bloom values for glowing parts
- Keep structures within a 15x20x15 bounding box
- Add architectural details (windows, doors, trim, decorations)

Examples:
- "red barn" → barn shape with red walls (#cc3333), brown roof (#6b4400), white door (#ffffff)
- "crystal tower" → tall tapered shape with cyan (#44ddff) and blue (#2266cc), high bloom
- "cherry blossom tree" → brown trunk (#6b4400), pink canopy (#ffaacc)
- "lighthouse" → tall white cylinder (#eeeeee), red bands (#cc2222), yellow light at top with bloom=0.9`;

type AIResult = {
  archetype: StructureArchetype;
  voxels: Voxel[];
  material: MaterialSettings;
  accentColor: string;
};

export async function generateStructureFromPrompt(prompt: string): Promise<AIResult | null> {
  if (!genAI) {
    console.log("[AI] No API key configured, using deterministic fallback");
    return null;
  }

  try {
    console.log(`[AI] Generating structure for: "${prompt}"`);

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent(
      `${SYSTEM_PROMPT}\n\nPlayer prompt: "${prompt}"\n\nReturn ONLY the JSON object, nothing else:`
    );

    const response = result.response;
    const text = response.text().trim();

    // Strip markdown code fences if present
    const cleaned = text
      .replace(/^```json?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();

    const parsed = JSON.parse(cleaned) as AIResult;

    // Validate voxels exist
    if (!parsed.voxels || !Array.isArray(parsed.voxels) || parsed.voxels.length === 0) {
      console.log("[AI] Invalid response: no voxels");
      return null;
    }

    // Cap at 200 voxels
    if (parsed.voxels.length > 200) {
      parsed.voxels = parsed.voxels.slice(0, 200);
    }

    // Filter and normalize voxels
    parsed.voxels = parsed.voxels
      .filter(
        (v) =>
          typeof v.x === "number" &&
          typeof v.y === "number" &&
          typeof v.z === "number" &&
          typeof v.color === "string"
      )
      .map((v) => ({
        x: Math.round(v.x),
        y: Math.round(v.y),
        z: Math.round(v.z),
        color: v.color,
        scale: typeof v.scale === "number" ? v.scale : 1,
      }));

    if (parsed.voxels.length === 0) {
      console.log("[AI] No valid voxels after filtering");
      return null;
    }

    // Ensure material exists with defaults
    parsed.material = {
      roughness: parsed.material?.roughness ?? 0.6,
      metalness: parsed.material?.metalness ?? 0.15,
      emissive: parsed.material?.emissive ?? "#000000",
      bloom: parsed.material?.bloom ?? 0.3,
    };

    if (!parsed.accentColor) {
      parsed.accentColor = parsed.voxels[0].color;
    }

    console.log(`[AI] ✓ Generated ${parsed.voxels.length} voxels, archetype: ${parsed.archetype}`);
    return parsed;
  } catch (error) {
    console.error("[AI] Generation failed:", error);
    return null;
  }
}
