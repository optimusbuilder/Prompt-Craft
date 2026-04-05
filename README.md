# Aero-Craft

Aero-Craft is a multiplayer jet dogfight game built with React Three Fiber and Socket.io. Spin up a room, share the 4-character code, and duke it out in the sky.

## Features

- Real-time multiplayer jet combat
- Procedural mountainous terrain
- Dynamic day/night cycle with sun, moon, stars, and clouds
- Flight HUD with radar, compass, speed, altitude
- Kill tracking and scoring
- Room-based matchmaking with shareable codes
- Synthesized combat audio (engine hum, gunfire, explosions)

## Tech Stack

- **Frontend**: React + React Three Fiber (Vite)
- **Backend**: Node.js (Express) + Socket.io
- **Shared**: TypeScript types for state and events

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env`.

3. Run both apps:

```bash
npm run dev
```

The client starts at `http://localhost:5173` and expects the backend at `VITE_SERVER_URL` (default `http://localhost:3001`).

## Environment Variables

```bash
VITE_SERVER_URL=http://localhost:3001
CLIENT_ORIGIN=http://localhost:5173
PORT=3001
```

## Controls

| Key | Action |
|---|---|
| Mouse | Pitch & Yaw |
| A / D | Roll |
| Left Shift | Boost |
| Left Ctrl | Brake |
| Left Click | Fire |
| ESC | Release cursor |

## Build

```bash
npm run build
```

## Deployment

- `client/` → Vercel (static hosting)
- `server/` → Render (Node web service)
