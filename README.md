# Aero-Craft

Aero-Craft is a multiplayer jet dogfight game built with React Three Fiber, Express, and Socket.io. The current codebase already supports real-time room-based play, procedural terrain, bots, chat, score tracking, and a strong audiovisual identity.

This README is now both:

- a project overview for contributors
- a phased roadmap for turning the current prototype into a game people actually want to play, replay, and recommend

## Vision

Build Aero-Craft into a fast, social, easy-to-join multiplayer air-combat game with:

- instant room-based play
- fair and readable combat
- short, replayable matches
- strong first-session onboarding
- enough progression and social glue to create repeat usage

## Current State

### What already works

- Room-based multiplayer using 4-character world codes
- Real-time player state sync over Socket.io
- Bots that can fly, target, shoot, die, and respawn
- Procedural terrain with a shared deterministic client seed
- Dynamic sky, day/night cycle, HUD, scoreboard, chat, audio, and explosions
- A monorepo layout with shared types between client and server

### What still blocks real adoption

- No true match loop yet
  - There are kills and respawns, but no round start, round end, win condition, rematch flow, or match summary
- Combat is not yet fully server-authoritative
  - The client still performs some hit detection, which creates fairness and cheating risks
- No persistence layer
  - Stats, unlocks, settings, and player identity are not stored
- No onboarding or tutorial
  - A first-time player is dropped into a room without structured learning
- No production analytics or operational tooling
  - There is no telemetry, abuse handling, moderation workflow, or release readiness checklist

## Repo Layout

```text
.
|-- client/   # React + Vite + React Three Fiber frontend
|-- server/   # Express + Socket.io game server
|-- shared/   # Shared TypeScript types for events and snapshots
`-- README.md
```

## Product Principles

Every phase below should move the game closer to these goals:

1. Time to fun under 30 seconds
2. Deaths feel fair and understandable
3. A single match creates memorable moments
4. Players can easily invite someone else
5. Returning players feel visible progress

## Success Metrics

These are the top-level metrics the project should eventually track:

- First session completion rate
- Percentage of players who finish one full match
- Average match duration
- Rematch rate
- D1 and D7 retention
- Invite-to-join conversion
- Median and p95 latency during matches
- Crash-free session rate

## Development Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env`.

3. Run both apps:

```bash
npm run dev
```

The client starts at `http://localhost:5173` and expects the backend at `VITE_SERVER_URL` which defaults to `http://localhost:3001`.

## Environment Variables

```bash
VITE_SERVER_URL=http://localhost:3001
CLIENT_ORIGIN=http://localhost:5173
PORT=3001
```

## Controls

| Key | Action |
|---|---|
| Mouse | Pitch and yaw |
| A / D | Roll |
| Left Shift | Boost |
| Left Ctrl | Brake |
| Left Click | Fire |
| T / Enter | Open chat |
| Tab | Hold scoreboard |
| ESC | Release cursor |

## Build

```bash
npm run build
```

## Deployment

- `client/` -> Vercel or another static host
- `server/` -> Render or another Node web-service host

## Roadmap

The roadmap is intentionally sequential. Each phase should have a clear exit condition before the next phase becomes the primary focus.

---

## Phase 0: Engineering Baseline

### Goal

Create enough engineering discipline that new gameplay work does not become chaos.

### Work to do

- Document the current architecture and event flow
- Add a simple contributor guide for local setup and code ownership
- Add project conventions for server events, shared types, and state updates
- Introduce linting and formatting if the team wants automated consistency
- Add a lightweight issue board or milestone tracker aligned with the phases below
- Add a basic risk log for networking, cheating, performance, and retention

### Relevant implementation areas

- `README.md`
- `package.json`
- `client/package.json`
- `server/package.json`
- `shared/src/index.ts`

### Tests for this phase

- Validate that a fresh clone can run with `npm install` and `npm run dev`
- Validate that a full build passes with `npm run build`
- Validate that `npm run typecheck` succeeds at the root
- Add a checklist test for developer onboarding
  - One teammate or future contributor should be able to get the project running from the README alone

### Exit criteria

- The repo is understandable without tribal knowledge
- A contributor can build and run the project in under 15 minutes
- Shared types and event names have documented ownership rules

---

## Phase 1: Core Match Loop

### Goal

Turn freeform flying into a real game loop with a beginning, middle, and end.

### Work to do

- Add explicit match states
  - `lobby`
  - `countdown`
  - `in_progress`
  - `round_end`
  - `rematch`
- Add one primary mode for launch
  - Recommended: free-for-all first to 10 kills
- Add round timer and victory conditions
- Add spawn protection and clear respawn timing
- Add end-of-match summary
  - winner
  - kills
  - deaths
  - accuracy if tracked
  - rematch prompt
- Add server-managed rematch vote or auto-restart flow
- Make the HUD reflect match state clearly
- Add pre-match messaging and post-match messaging in chat/system announcements

### Relevant implementation areas

- `server/src/world.ts`
- `server/src/index.ts`
- `shared/src/index.ts`
- `client/src/App.tsx`
- `client/src/components/FlightHUD.tsx`
- `client/src/components/Scoreboard.tsx`

### Tests for this phase

#### Automated tests

- Unit tests for match state transitions
  - lobby -> countdown -> in_progress -> round_end -> rematch
- Unit tests for win-condition rules
  - first to score cap
  - timer expiration
  - tie handling
- Unit tests for respawn timers and spawn protection
- Unit tests for snapshot payload shape after match state changes

#### Manual tests

- Start a room with one player and verify the match can progress from lobby to active play
- Join with two players and verify the scoreboard updates correctly
- Reach the score cap and verify the round ends exactly once
- Verify players cannot continue farming kills after match end
- Verify rematch resets health, score, projectiles, timers, and recent round-only state

#### UX tests

- A first-time observer should understand within 10 seconds:
  - whether the round has started
  - who is winning
  - how to win

### Exit criteria

- The game has a full playable round structure
- Players can clearly tell when they won, lost, or should rematch
- Match state is controlled by the server, not inferred only on the client

---

## Phase 2: Fair Multiplayer and Combat Authority

### Goal

Make combat trustworthy enough that competitive or repeated play feels fair.

### Work to do

- Move projectile simulation and hit detection fully to the server
- Add authoritative damage application and kill attribution
- Keep client-side prediction and interpolation for responsiveness
- Add reconciliation rules for remote player movement
- Add server-side firing rate validation
- Add basic anti-abuse guards
  - impossible movement rejection
  - fire-rate clamping
  - invalid room/event payload rejection
- Add disconnect handling during combat
  - cleanup of projectiles
  - cleanup of stale room membership
- Add better bot interactions under the same authoritative rules as players

### Relevant implementation areas

- `server/src/world.ts`
- `server/src/index.ts`
- `shared/src/index.ts`
- `client/src/App.tsx`
- `client/src/components/Projectiles.tsx`
- `client/src/components/JetControls.tsx`

### Tests for this phase

#### Automated tests

- Unit tests for server-side projectile lifetime, movement, and collision
- Unit tests for damage application and kill attribution
- Unit tests for invalid fire events
  - impossible owner
  - impossible projectile velocity
  - too-frequent firing
- Unit tests for disconnect cleanup
- Serialization tests for all real-time socket payloads

#### Integration tests

- Simulate two or more clients connected to the same room
- Verify both clients observe the same hit and kill outcome
- Verify duplicate hit reports do not double-apply damage
- Verify latency-tolerant behavior under delayed packet conditions

#### Manual tests

- Shoot bots and human players repeatedly and verify no double hits
- Verify kills still resolve correctly under poor network conditions
- Verify a user cannot increase damage by manipulating the client
- Verify dead players cannot fire or move until respawn rules permit it

#### Performance tests

- Run a room with multiple bots and players and measure update stability at 20hz
- Measure p95 server tick time under sustained projectile load

### Exit criteria

- The server is the source of truth for combat outcomes
- Two clients no longer disagree about whether a hit happened
- Basic cheating vectors are blocked or reduced

---

## Phase 3: Flight Feel, Readability, and Moment-to-Moment Fun

### Goal

Make flying and fighting feel satisfying enough to carry the game even before progression is added.

### Work to do

- Tune jet handling
  - turn rate
  - roll feel
  - boost/brake response
  - recovery from dives
- Improve aiming readability
  - muzzle origin
  - tracer visibility
  - target readability
  - hit feedback
- Add stronger feedback loops
  - hit markers
  - damage direction indicators
  - better audio differentiation
  - stronger kill confirmations
- Improve crash handling and terrain readability
- Tune bot behavior to create fun rather than only technical correctness
  - aggression
  - target switching
  - retreat behavior
  - difficulty presets
- Add camera polish
  - subtle shake
  - speed feedback
  - FOV response to boost if desired

### Relevant implementation areas

- `client/src/components/JetControls.tsx`
- `client/src/components/Jet.tsx`
- `client/src/components/Projectiles.tsx`
- `client/src/components/ExplosionEffect.tsx`
- `client/src/components/FlightHUD.tsx`
- `client/src/utils/audio.ts`
- `client/src/components/Terrain.tsx`

### Tests for this phase

#### Manual gameplay tests

- Verify the default jet controls are understandable without explanation
- Verify players can track targets visually during high-speed turns
- Verify being hit feels noticeable but not visually overwhelming
- Verify kills feel celebratory and losses feel readable rather than confusing

#### Playtest prompts

- Ask 5 to 10 players:
  - Did flying feel intuitive?
  - Did you understand why you died?
  - Did you feel in control of the aircraft?
  - Would you play another round immediately?

#### Tuning tests

- Compare multiple control presets in short play sessions
- Log average kills, crashes, and session duration by tuning branch
- Track whether bot difficulty creates close matches or frustration

### Exit criteria

- Players can explain why the game feels fun in one sentence
- At least one control profile feels consistently good in small playtests
- Combat feedback is readable at normal engagement distances

---

## Phase 4: First-Time User Experience and Onboarding

### Goal

Reduce first-session confusion and make new players feel competent quickly.

### Work to do

- Add a first-time tutorial or guided solo practice mode
- Add bot-only practice room entry from the main menu
- Add clear preflight instructions
  - controls
  - objective
  - chat
  - invite flow
- Improve join flow
  - create room
  - join room
  - copy/share code
  - invalid code messaging
- Save basic player preferences
  - callsign
  - sensitivity
  - audio settings
  - invert controls if added
- Improve accessibility
  - text contrast
  - colorblind-safe team/target indicators
  - rebinding plan or at least a documented future slot for it

### Relevant implementation areas

- `client/src/App.tsx`
- `client/src/styles.css`
- `client/src/components/FlightHUD.tsx`
- `client/src/components/Scoreboard.tsx`
- New tutorial or practice components and state files

### Tests for this phase

#### First-time user tests

- Observe 5 new players with no explanation
- Measure time to:
  - join a room
  - start flying
  - fire a weapon
  - get one kill or meaningful hit

#### Manual QA

- Verify invalid room codes fail gracefully
- Verify a player can leave and rejoin a room using the same code
- Verify tutorial flow can be completed without pointer-lock confusion
- Verify settings persist between sessions if persistence is added locally

#### Accessibility checks

- Verify HUD remains readable at common laptop screen sizes
- Verify key information is not color-only
- Verify chat and menus are usable without accidental gameplay lockups

### Exit criteria

- A new player can successfully play one full round without outside help
- The join flow is obvious and resilient
- Practice mode exists and teaches core actions

---

## Phase 5: Progression, Identity, and Retention

### Goal

Give players a reason to come back after the novelty of the first few matches.

### Work to do

- Add player identity
  - stable player ID
  - callsign profile
  - optional cosmetics later
- Add persistence
  - lifetime kills
  - deaths
  - matches played
  - wins
  - streaks
- Add lightweight rewards
  - achievements
  - unlockable trails, skins, badges, titles
- Add progression messaging
  - level-up or milestone moments
  - post-match stat improvements
- Add daily or weekly goals only if the core loop is already solid
- Add a basic backend data model if accounts or durable profiles are introduced

### Relevant implementation areas

- `server/src/index.ts`
- `server/src/world.ts`
- `shared/src/index.ts`
- New persistence modules and storage integration
- `client/src/App.tsx`
- `client/src/components/Scoreboard.tsx`
- New profile and post-match UI components

### Tests for this phase

#### Automated tests

- Unit tests for stat accumulation
- Unit tests for unlock conditions
- Unit tests for persistence reads and writes
- Migration tests if a database is introduced

#### Integration tests

- Complete matches and verify stats persist after reconnect
- Verify duplicate events do not double-count progress
- Verify offline or failed persistence does not break live matches

#### Manual tests

- Verify players can understand what they earned after a match
- Verify unlocks feel achievable and visible
- Verify profile state remains stable across sessions and deployments

### Exit criteria

- Returning players can see progress from prior sessions
- Match outcomes update player history correctly
- Retention systems do not interfere with core match quality

---

## Phase 6: Social Features, Community, and Matchmaking Quality

### Goal

Make the game easier to share, easier to replay with friends, and healthier for a small community.

### Work to do

- Improve invite flow
  - copy room code
  - share direct join link
  - clear "play with friends" CTA
- Add party-friendly quality-of-life features
  - quick rematch
  - stay-with-group
  - spectate if joining mid-round
- Add moderation basics
  - mute
  - report
  - rate limits for chat
- Add Discord/community operating plan
  - feedback channels
  - bug reporting template
  - playtest announcements
- Decide whether public matchmaking is needed after private rooms are stable
- Add basic trust and safety logging if public play is introduced

### Relevant implementation areas

- `client/src/App.tsx`
- `client/src/styles.css`
- `server/src/index.ts`
- `server/src/world.ts`
- Community and ops documentation outside code if needed

### Tests for this phase

#### Manual tests

- Verify a player can create a room and invite another player within one minute
- Verify join links or shared codes work from a fresh browser session
- Verify spectate or late-join behavior is understandable if supported
- Verify chat rate limits do not break normal social use

#### Community tests

- Run scheduled playtests and collect:
  - join success rate
  - rematch rate
  - number of rooms created
  - number of invites sent

#### Safety tests

- Verify muted users cannot continue spamming locally or server-side
- Verify malformed or oversized chat payloads are rejected

### Exit criteria

- Sharing a match with a friend is simple and reliable
- Basic moderation tools exist before public community scaling
- Community playtests generate structured feedback

---

## Phase 7: Production Readiness and Live Operations

### Goal

Prepare the game for a wider launch without collapsing under bugs, performance issues, or missing support workflows.

### Work to do

- Add structured logging
- Add metrics and dashboards
  - active rooms
  - players per room
  - disconnect rate
  - tick rate health
  - server CPU and memory
- Add error tracking for client and server
- Add feature flags for risky rollouts
- Add release process and rollback plan
- Add load testing for realistic concurrency
- Add abuse-response and incident-response documentation
- Verify deployment config, environment handling, and health checks
- Add backup plan for persistence if introduced

### Relevant implementation areas

- `server/src/index.ts`
- hosting configuration such as `render.yaml`
- deployment scripts
- any future monitoring or analytics integration

### Tests for this phase

#### Reliability tests

- Load test multiple concurrent rooms
- Verify health endpoint remains accurate under load
- Verify the server recovers cleanly from restarts
- Verify rooms fail gracefully if the server disconnects clients

#### Release tests

- Smoke test production build before every deploy
- Verify environment variable validation on boot
- Verify observability dashboards receive expected events
- Verify rollback steps are documented and can be executed quickly

#### Security tests

- Validate input sanitization for all socket events
- Validate CORS configuration against intended client origins
- Validate rate limits and payload size handling

### Exit criteria

- The game can support repeated external playtests without major firefighting
- The team can diagnose production issues quickly
- Releases are routine rather than stressful

---

## Phase 8: Launch, Content Cadence, and Post-Launch Learning

### Goal

Ship confidently, then learn fast without losing product focus.

### Work to do

- Prepare a launch slice
  - one polished mode
  - stable servers
  - good onboarding
  - basic progression
- Create launch assets
  - trailer
  - screenshots
  - landing page copy
  - FAQ
- Plan a small content cadence
  - one new map variant
  - one new mode
  - one new progression layer
- Build a feedback loop from analytics plus community feedback
- Prioritize only the changes that improve:
  - retention
  - shareability
  - fairness
  - clarity

### Tests for this phase

- Run external playtests with a fixed script and survey
- Compare retention and rematch rate before and after launch changes
- Verify support volume and bug reports are manageable
- Review post-launch metrics weekly for the first month

### Exit criteria

- The launch version is coherent, stable, and easy to recommend
- The post-launch roadmap is driven by player behavior, not guesswork

## Cross-Phase Testing Strategy

The project should gradually adopt a layered testing approach:

### 1. Static verification

- `npm run typecheck`
- future linting if introduced
- schema and payload validation where helpful

### 2. Unit tests

Best for:

- match rules
- scoring logic
- respawn timers
- projectile simulation
- persistence logic
- payload validation

### 3. Integration tests

Best for:

- socket event flows
- room join and leave behavior
- multi-client synchronization
- reconnect and disconnect behavior

### 4. Manual gameplay QA

Best for:

- feel
- clarity
- pacing
- onboarding
- HUD readability
- bot quality

### 5. Playtests

Best for:

- fun
- retention
- onboarding quality
- social friction
- progression usefulness

## Suggested Immediate Priority Order

If the team needs a shortest path to "actually fun and usable," do this first:

1. Phase 1: Core Match Loop
2. Phase 2: Fair Multiplayer and Combat Authority
3. Phase 3: Flight Feel, Readability, and Moment-to-Moment Fun
4. Phase 4: First-Time User Experience and Onboarding
5. Phase 5: Progression, Identity, and Retention

## Technical Playable Core Plan

This section is the engineering translation of the roadmap above. It is intentionally concrete and focused on what we need to implement in code to make gameplay fair, stable, and repeatable.

### T0: Test Harness and Dev Reliability

#### Technical work

- Add a test stack for each workspace
- Add root scripts for `test`, `test:server`, `test:client`, and `test:integration`
- Add deterministic utility helpers for simulation tests
- Add fixture factories for player state, projectiles, snapshots, and room state
- Add CI checks that run `typecheck`, `build`, and tests on pull requests

#### Relevant files

- `package.json`
- `server/package.json`
- `client/package.json`
- `shared/package.json`
- New test setup files under `server/` and `client/`

#### Tests and gates

- `npm run typecheck` succeeds at root
- `npm run build` succeeds at root
- `npm test` runs on CI and fails correctly on broken assertions
- A new contributor can run all checks with one documented command sequence

### T1: Shared Protocol and Runtime Validation

#### Technical work

- Expand shared event contracts in `shared/src/index.ts`
- Add a strict event envelope for real-time messages
  - event name
  - schema version
  - payload
  - optional sequence or tick metadata
- Add runtime payload validation at the server boundary
- Reject invalid client events without crashing the room loop
- Add server-side sanitization for chat and player-provided strings

#### Relevant files

- `shared/src/index.ts`
- `server/src/index.ts`
- `server/src/world.ts`

#### Tests and gates

- Unit tests for payload validators
- Integration tests for malformed events
  - invalid types
  - oversized values
  - missing required fields
- Server remains healthy after malformed input bursts

### T2: Server-Authoritative Combat and Simulation

#### Technical work

- Move projectile simulation entirely to the server
- Move hit detection entirely to the server
- Move damage and kill attribution entirely to the server
- Keep client prediction for immediate local responsiveness
- Add server tick simulation ownership for combat-critical state
- Add fire-rate limiting and impossible-state guards
- Add respawn and spawn-protection logic server-side

#### Relevant files

- `server/src/world.ts`
- `server/src/index.ts`
- `shared/src/index.ts`
- `client/src/App.tsx`
- `client/src/components/Projectiles.tsx`

#### Tests and gates

- Unit tests for projectile lifecycle
  - spawn
  - advance
  - collision
  - expire
- Unit tests for damage and kill rules
- Integration tests with 2+ clients observing identical outcomes
- Latency simulation tests showing no duplicate damage under delayed packets
- Manual exploit checks that modified client payloads cannot force fake kills

### T3: Match State Machine and Round Rules

#### Technical work

- Implement explicit server-owned match states
  - lobby
  - countdown
  - in_progress
  - round_end
  - rematch
- Add a rules engine for win conditions
  - score cap
  - timer expiration
  - tie handling
- Add server-broadcast round events for start, end, and reset
- Add reset logic that clears round state while preserving intended persistent state
- Prevent combat mutations after round end

#### Relevant files

- `server/src/world.ts`
- `server/src/index.ts`
- `shared/src/index.ts`
- `client/src/App.tsx`
- `client/src/components/FlightHUD.tsx`
- `client/src/components/Scoreboard.tsx`

#### Tests and gates

- Transition-table unit tests for all match-state transitions
- Edge-case tests for simultaneous final kills
- Tests that round-end triggers exactly once
- Tests that rematch resets only round-scoped fields
- Manual test that a full match can be completed start to finish without admin intervention

### T4: Client Netcode, Prediction, and Reconciliation

#### Technical work

- Introduce client input sequencing and server acknowledgement flow
- Add local prediction for flight controls
- Add reconciliation against authoritative server snapshots
- Add interpolation buffer for remote players and projectiles
- Smooth correction for desync without sudden teleporting
- Expose network quality indicators for debugging and QA

#### Relevant files

- `client/src/components/JetControls.tsx`
- `client/src/App.tsx`
- `client/src/components/Jet.tsx`
- `client/src/components/Projectiles.tsx`
- `shared/src/index.ts`

#### Tests and gates

- Unit tests for interpolation and reconciliation math
- Integration tests with artificial jitter and packet delay
- Manual tests that controls remain responsive during network fluctuation
- Manual tests that remote players do not visibly stutter at normal latency

### T5: Performance, Stability, and Operational Guardrails

#### Technical work

- Add server tick metrics
  - average tick duration
  - p95 tick duration
  - queue backlog
- Add room-level counters
  - active players
  - projectile count
  - messages per second
- Add memory and CPU instrumentation for load sessions
- Add graceful handling for disconnect spikes and reconnect bursts
- Add safe limits for room size and projectile count

#### Relevant files

- `server/src/index.ts`
- `server/src/world.ts`
- `render.yaml`
- Any new observability modules

#### Tests and gates

- Load tests for multiple concurrent rooms
- Soak tests for long-running server sessions
- Verify no runaway projectile or chat growth in memory
- Verify `/health` remains responsive under load
- Define and enforce latency and tick-time budgets for alpha

### T6: Technical Alpha Release Gate

#### Required technical checklist

- Combat is fully server-authoritative
- Match loop is complete and deterministic at rule level
- All socket payloads are validated at runtime
- CI runs build, typecheck, and tests on every pull request
- Load tests pass target concurrency budget
- Crash loops and severe desync bugs are resolved

#### Final validation runs

- Full multiplayer smoke test with at least 4 human players
- One scripted regression pass for join, play, kill, death, respawn, rematch
- One network-degraded pass with added latency and packet jitter
- One 60-minute soak session with bots enabled

## Definition of Done for a Playable Alpha

Aero-Craft should be considered ready for a broader alpha only when all of the following are true:

- A new player can join and finish a match without help
- Match victory conditions are clear and reliable
- Combat outcomes are server-authoritative
- Bugs do not regularly end or corrupt matches
- At least one progression or identity system exists
- The team can observe production health and fix issues quickly

## Notes for Future Contributors

- Prefer adding new gameplay event shapes in `shared/src/index.ts` before wiring them into client and server independently
- Keep match rules server-owned whenever fairness matters
- Treat perceived feel as a product requirement, not a cosmetic nice-to-have
- When in doubt, optimize for shorter time-to-fun and lower friction to invite a friend
