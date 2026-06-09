# BlackBox

Autonomous Cyber Governance, Containment, Deception & Recovery dashboard — a real-time mission-control system for security operators to monitor threats, trip circuit breakers, initiate lockdowns, and reconstruct incidents.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/blackbox run dev` — run the frontend (port 19147)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (auto-provisioned)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + ws (WebSockets)
- DB: PostgreSQL + Drizzle ORM
- Frontend: React 18 + Vite + Tailwind CSS + shadcn/ui
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `lib/db/src/schema/` — Drizzle tables: events, snapshots, deception_assets, incidents
- `artifacts/api-server/src/engines/` — BlackBox engine modules
  - `state.ts` — In-memory risk score, circuit breakers, lockdown state
  - `websocket.ts` — WebSocket broadcast manager
  - `flightRecorder.ts` — Event logger + file/process monitoring
  - `snapshot.ts` — Forensic snapshot engine
  - `deception.ts` — Honeyfile + decoy credential deployment
  - `lockdown.ts` — BlackBox Lockdown Protocol (3-phase)
  - `simulation.ts` — End-to-end attack simulation demo
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/seed.ts` — Historical seed data (50 events + 1 past incident)
- `artifacts/blackbox/src/` — React dashboard frontend

## Architecture decisions

- In-memory state for risk score, breakers, lockdown (not DB) — enables sub-millisecond reads and real-time WS broadcasts without DB round-trips
- WebSocket path `/api/ws` is served on the same Express HTTP server via `http.createServer(app)` + `WebSocketServer({ server })`
- Circuit breakers are pure state — they don't kill real connections (prototype constraint)
- Honeyfiles are tracked in DB; triggering bumps risk score +40 and fires DECEPTION_TRIGGERED WS event
- Attack simulation runs as a detached async chain — returns immediately, streams updates via WebSocket

## Product (v2.0)

BlackBox is a single-page mission control dashboard with:
- **Threat State Banner** — full-width GREEN/YELLOW/ORANGE/RED with pulse on RED
- **Risk Score Gauge** — animated SVG 0-100, color-coded by threat state
- **Live Event Feed** — auto-scrolling, newest first, 100 max, special styling per event type
- **Circuit Breakers** — 5 trust-path breakers (user_to_asset, device_to_asset, application_to_asset, remote_access, external_transfer) with auto-trip thresholds and manual override
- **Lockdown Protocol (4 phases)** — Phase 1: State Preservation → Phase 2: Trust Severance → Phase 3: Asset Protection → Phase 4: Identity Reset; each phase visible in real time
- **Identity Reset Engine** — simulates password rotation, API key rotation, token/session revocation on Phase 4
- **Attack Simulation** — full 4-phase automated demo with real-time WS updates
- **Forensic Snapshots** — point-in-time memory/network/file/user captures
- **Deception Assets** — honeyfiles and decoy credentials with triggered status
- **Incident Timeline** — chronological attack reconstruction with significance levels
- **User Trust Scores** — per-user behavioral trust scoring with progress bars
- **Trust Graph** — DB-backed SVG visualization of User→Device→App→Asset trust paths; nodes color-coded NORMAL/DEGRADED/COMPROMISED; edges show trust score; severed paths shown dashed red

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing `lib/db/src/schema/`, always run `pnpm run typecheck:libs` before typechecking artifacts
- WebSocket is at `/api/ws`, not `/ws` — must match the paths array in artifact.toml if adding explicitly
- The simulation modifies in-memory state and DB; use POST /api/simulate/reset to return to baseline
- Flight recorder auto-generates random events every 5s when simulation is NOT running
- `seedTrustGraph` is idempotent (checks for existing nodes); called before the events seed guard so it always runs on startup
- Circuit breakers renamed in v2.0: old names (vpn/database/api_tokens/uploads/remote_sessions) are gone — use new trust-path names
- BreakerState now includes a `label` field (e.g. "User → Asset") for display; use `breaker.label` in the frontend

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
