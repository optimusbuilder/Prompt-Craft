import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Voxel, StructureArchetype, MaterialSettings } from "@promptcraft/shared";

function getGenAI() {
  const apiKey = (process.env.GEMINI_API_KEY ?? process.env.AI_API_KEY ?? "").replace(/"/g, "");
  return apiKey ? new GoogleGenerativeAI(apiKey) : null;
}

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
- Generate 300 to 800 voxels to create a MAGNIFICENT, HIGHLY DETAILED, and RECOGNIZABLE structure.
- Each voxel is a 1x1x1 cube at integer coordinates.
- y=0 is ground level, build upward.
- Use hex color strings like "#ff0000".
- Be immensely creative and architectural. Include details like walls with thickness, hollow interiors, battlements, large tree branches, textured floors, windows, trims, and decorations.
- DO NOT just make a solid cube. Use layers!
- Use emissive colors and higher bloom values for glowing magical or illuminated parts.
- Keep structures within a 40x40x40 bounding box.

Examples:
- "blue castle" → A massive tiered fortress with dark blue stone walls (#224488), cyan parapets (#44ccff), hollow courtyard, and glowing central spire.
- "crystal monument" → Huge floating obelisk with a dense base, tapering intricately towards the top, high bloom.`;

type AIResult = {
  archetype: StructureArchetype;
  voxels: Voxel[];
  material: MaterialSettings;
  accentColor: string;
};

export async function generateStructureFromPrompt(prompt: string): Promise<AIResult | null> {
  const genAI = getGenAI();
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

    // Cap at 1000 voxels
    if (parsed.voxels.length > 1000) {
      parsed.voxels = parsed.voxels.slice(0, 1000);
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
