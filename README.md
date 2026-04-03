# Prompt-Craft

Prompt-Craft is a multiplayer voxel sandbox where players type natural language prompts to spawn structures into a shared world. This scaffold uses a split deployment model:

- `client/` for the Vercel-hosted React + React Three Fiber frontend
- `server/` for the Render-hosted Express + Socket.io backend
- `shared/` for scene schema and socket payload types

## What is Working

- React Three Fiber scene scaffold
- Socket.io server scaffold
- Shared object schema
- In-memory world snapshot and decay ticker
- Prompt input that spawns deterministic voxel structures
- Basic HUD with connection state and vibe meter

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Copy env values from `.env.example`.

3. Run both apps:

```bash
npm run dev
```

4. Or run each side separately:

```bash
npm run dev:client
npm run dev:server
```

The client expects the backend at `VITE_SERVER_URL`, which defaults to `http://localhost:3001`.

## Environment Variables

```bash
VITE_SERVER_URL=http://localhost:3001
CLIENT_ORIGIN=http://localhost:5173
PORT=3001
AI_API_KEY=your-provider-key
REDIS_URL=
```

## Build

```bash
npm run build
```

## Next Steps

- Replace deterministic prompt spawning with an AI scene compiler
- Move world state from memory to Redis
- Add object validation with Zod
- Add richer decay visuals and multiplayer UX polish

