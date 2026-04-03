🎯 The Vision
"Prompt-Craft" is a multiplayer web experience where nothing is pre-built. Players use an AI command line to "vibe" objects, architecture, and environments into existence. However, the world is subject to Entropy—if players stop contributing creative energy, the world slowly glitches, dissolves, and eventually vanishes.

🛠️ Technical Stack (The 90% AI-Gen Plan)
Frontend: Three.js with React Three Fiber (R3F) for high-performance 3D rendering.

Backend: Node.js (Express) with Socket.io for real-time multiplayer state synchronization.

Database: Redis (for lightning-fast voxel state and vitality tracking).

AI Engine: Integration with Gemini 1.5 Flash (via API) to translate natural language into a custom JSON Scene Schema.

🏗️ Core Systems to Build
1. The World Architect (LLM Integration)

Input: Player commands like /spawn a floating cyberpunk pagoda with blue neon.

Output: A structured JSON object defining:

geometry: Voxel coordinates and scales.

material: Hex colors, roughness, metalness, and "bloom" intensity.

metadata: Persistence duration and "Vitality" points.

Logic: The AI agent must act as a compiler, turning prose into geometric data the Three.js engine can batch-render.

2. The Entropy Engine (The Decay)

Vitality Variable: Every object starts with vitality: 1.0.

The Ticker: A server-side loop that decrements vitality every minute.

Visual Decay (Shader): As vitality drops:

1.0 – 0.7: Vibrant, solid, glowing.

0.7 – 0.3: Textures start to "glitch" (Vertex displacement shaders).

0.3 – 0.1: Voxels begin to drift apart like digital dust.

0.0: Object is purged from the database.

3. Multiplayer Sync (The "Vibeverse")

Use Socket.io to broadcast new "spawns" and "decay states" to all connected clients.

Implement a Global Vibe Meter UI that shows the total health of the current instance.

🎨 Aesthetic & Vibe
Art Style: Low-poly / Voxel Art with heavy post-processing (Bloom, God-rays, Fog).

Sound: Ambient, generative lo-fi (potentially using a music AI API).

Accessibility: Zero-auth (guest sessions only), instant-load, hosted on a custom subdomain.

🚀 Prompt for your Coding Agent:
"I am building 'Prompt-Craft' for a Game Jam. It is a Three.js + Node.js multiplayer sandbox. I need you to generate a system where players type natural language prompts to spawn 3D voxel structures. The core logic must involve an LLM returning a JSON schema of the objects, which our Three.js engine renders. We also need an 'Entropy' mechanic where objects decay and disappear over time unless new prompts are made. Start by scaffolding the Three.js scene and the Socket.io server logic."

---

## Execution Plan

### 1. MVP Goal
Build a playable multiplayer prototype where:

- A guest joins instantly.
- The player types a prompt into an in-world command line.
- The server turns that prompt into a validated scene JSON payload.
- The client renders the spawned voxel object in a shared world.
- Each object loses vitality over time and disappears at zero vitality.
- Every connected player sees new objects and decay updates in real time.

If those five things work, the core loop is proven.

### 2. Hosting Strategy
Use a split deployment by default:

- Frontend on Vercel
- Realtime backend on Render
- Redis on Upstash or Render Key Value later if needed

This project is not a good fit for an all-in Vercel deployment because the multiplayer loop depends on persistent realtime connections and a long-running server process. Vercel is still a strong choice for the frontend because it gives fast static hosting, previews, and simple environment management.

#### Recommended Deployment Layout
- `client/` deployed to Vercel
- `server/` deployed to Render as a Node web service
- `shared/` used by both apps for schema and event types

#### Why This Setup
- Vercel is ideal for the React frontend.
- Render is better suited for Socket.io and a server ticker.
- We can start without Redis and use in-memory state on the Render service.
- We can add Redis only after multiplayer spawning and decay feel good.

#### Cost Strategy
- Prototype/internal testing:
  - Vercel Hobby
  - Render free web service
  - No Redis or a tiny external Redis plan
- Public demo / jam judging:
  - Vercel Hobby or Pro
  - Paid Render web service to avoid cold starts
  - Upstash Redis or paid Render Key Value if persistence matters

#### Hosting Risks
- Render free instances can sleep when inactive, which is bad for live demos.
- In-memory state will reset on backend restart.
- Cross-origin setup must be configured carefully between Vercel and Render.

#### Hosting Decision
Build for `Vercel + Render` now. Treat `all-on-Render` as the backup option if we want simpler operations later.

### 3. Scope Guardrails
To keep this game-jam friendly, treat these as stretch goals instead of day-one requirements:

- Advanced shaders for decay
- God-rays and heavy cinematic post-processing
- Generative music integration
- Complex architecture generation
- Rich persistence across restarts

For the first working version, favor cubes, simple palettes, and deterministic object templates over visual complexity.

### 4. Build Order

#### Phase 1: Foundation
- Create a monorepo or two-app layout: `client/` and `server/`.
- Scaffold the React + R3F scene with a camera, lighting, fog, and a simple ground plane.
- Scaffold the Node.js server with Express and Socket.io.
- Add shared TypeScript types for scene schema, objects, and socket events.
- Add environment config for API keys and server URLs.

#### Phase 2: Shared World Rendering
- Render a static voxel object from hardcoded JSON.
- Implement an object registry keyed by `objectId`.
- Render many voxels efficiently with instancing or merged geometry.
- Add labels or lightweight metadata for debugging vitality and IDs.

#### Phase 3: Multiplayer Core
- Connect client to server via Socket.io.
- On join, send the current world snapshot to the client.
- Broadcast newly spawned objects to all connected clients.
- Broadcast vitality updates and removals on a regular server tick.
- Add a simple global vibe meter derived from average or total vitality.

#### Phase 4: AI World Architect
- Define a strict JSON schema for prompt results.
- Add a server-side AI adapter that converts natural language into schema output.
- Validate AI responses before saving or broadcasting.
- If the AI fails or returns invalid data, fall back to predefined voxel templates.
- Log raw prompts, parsed output, and validation failures for debugging.

#### Phase 5: Entropy Loop
- Give every object `createdAt`, `lastTouchedAt`, `vitality`, and `decayRate`.
- Run a server ticker every few seconds for smoother visual updates.
- Reduce vitality server-side and emit the updated state.
- Remove objects when vitality reaches zero.
- Map vitality bands to simple visual states on the client:
  - `healthy`
  - `glitching`
  - `fragmenting`
  - `dead`

#### Phase 6: UX Polish
- Add a terminal-style prompt input overlay.
- Show spawn success, validation errors, and fallback messages.
- Improve lighting, bloom, fog, and atmosphere.
- Add subtle object animation and decay effects.
- Improve mobile and lower-power browser behavior if time allows.

### 5. Recommended System Design

#### Client Responsibilities
- Render the world and all objects.
- Accept player prompts.
- Show connection state, vibe meter, and object decay.
- Apply visual interpretation of vitality values received from the server.

#### Server Responsibilities
- Own the source of truth for world state.
- Handle prompt submission.
- Call the AI provider.
- Validate, normalize, and store scene objects.
- Run decay logic and broadcast updates.

#### Shared Schema
Each spawned object should look roughly like this:

```json
{
  "id": "obj_123",
  "prompt": "floating cyberpunk pagoda with blue neon",
  "position": { "x": 4, "y": 0, "z": -2 },
  "voxels": [
    { "x": 0, "y": 0, "z": 0, "color": "#44ccff", "scale": 1 }
  ],
  "material": {
    "roughness": 0.5,
    "metalness": 0.2,
    "emissive": "#2244ff",
    "bloom": 0.8
  },
  "vitality": 1,
  "decayRate": 0.02,
  "createdAt": 0,
  "lastTouchedAt": 0
}
```

Keep the first schema intentionally small. It is easier to extend than to rescue an overly ambitious format.

### 6. Suggested Milestones

#### Milestone A: First Light
- App boots.
- 3D scene renders.
- One hardcoded voxel structure appears.

#### Milestone B: Shared Spawn
- Two browsers can connect.
- One player spawns an object.
- Both players see it instantly.

#### Milestone C: AI Spawn
- A prompt reaches the server.
- The AI returns valid scene JSON.
- The object renders correctly in the shared world.

#### Milestone D: Living Decay
- Objects visibly weaken over time.
- The vibe meter updates.
- Dead objects are removed cleanly.

#### Milestone E: Jam-Ready Demo
- Prompt input feels good.
- Visuals are atmospheric.
- Error states do not break the loop.

### 7. First Sprint Tasks

#### Repo Setup
- Initialize client and server apps.
- Add TypeScript, ESLint, and shared config.
- Add `.env.example`.
- Add deployment env vars for:
  - `VITE_SERVER_URL`
  - `CLIENT_ORIGIN`
  - `AI_API_KEY`
  - `REDIS_URL` when persistence is added

#### Client
- Set up R3F canvas and lighting.
- Build `WorldScene`, `VoxelObject`, and `PromptConsole` components.
- Add socket connection and world store.

#### Server
- Set up Express and Socket.io.
- Add `worldState` in memory first; move to Redis after the loop works.
- Build `POST /prompt` or socket-driven `prompt:submit` handling.
- Build a decay ticker service.

#### AI Layer
- Create `generateSceneFromPrompt(prompt)` service.
- Add schema validation with Zod or JSON Schema.
- Add deterministic fallback templates.

### 8. Risk Management

#### Biggest Risks
- AI output is inconsistent.
- Rendering too many separate meshes hurts performance.
- Real-time sync becomes noisy if updates are too frequent.
- Redis adds setup overhead before the gameplay loop is proven.
- Deployment friction between Vercel frontend and Render backend.

#### Mitigations
- Validate every AI response and normalize before broadcast.
- Start with instanced voxels or capped voxel counts per object.
- Tick decay at a coarse interval and interpolate visuals client-side.
- Begin with in-memory state, then add Redis once the loop feels good.
- Define CORS, env vars, and socket URLs early so deployment does not block the demo.

### 9. Definition of Done for the Prototype
A prototype is done when a new player can open the site, type a prompt, see a spawned object in a shared 3D world, watch it decay, and see that same behavior mirrored for another connected player without manual setup.

### 10. Best Immediate Next Step
Start with Phase 1 and Milestone A only:

1. Scaffold the React Three Fiber client.
2. Scaffold the Express + Socket.io server.
3. Render one hardcoded voxel object from shared schema types.
4. Confirm the client can connect to the server.
5. Deploy the client to Vercel and the server to Render as soon as the first connection works locally.

Once that works, add multiplayer spawning before touching the AI integration.
