# BlackBox

### Autonomous Cyber Governance, Containment, Deception & Recovery

> **BlackBox is a real-time cybersecurity mission-control prototype that models how a security team can detect suspicious activity, quantify risk, sever trust paths, preserve forensic state, deploy deception, and reset compromised identities from one operational surface.**

![BlackBox](./artifacts/blackbox/public/opengraph.jpg)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Drizzle-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![WebSockets](https://img.shields.io/badge/Realtime-WebSockets-010101?logo=websocket&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

---

## The idea

Traditional dashboards often stop at **detection**.

BlackBox is designed around the next question:

> **What should the system do after the signal appears?**

The project turns security telemetry into an operational response loop:

```text
Telemetry
   ↓
Risk Scoring
   ↓
Threat State
   ↓
Trust Analysis
   ↓
Containment
   ↓
Forensics + Deception
   ↓
Identity Recovery
   ↓
Incident Reconstruction
```

Instead of treating an incident as a collection of alerts, BlackBox models it as a **changing trust environment** where users, devices, applications, and critical assets are connected by paths that can be monitored or severed.

---

## What BlackBox can do

| Capability | What it models |
|---|---|
| **Real-time risk engine** | Maintains a 0–100 risk score and maps it to GREEN / YELLOW / ORANGE / RED threat states |
| **Flight recorder** | Generates and persists security events while streaming live updates to connected clients |
| **Circuit breakers** | Controls five trust paths and automatically trips selected breakers as risk rises |
| **Lockdown protocol** | Runs a four-phase response workflow for preservation, trust severance, protection, and identity recovery |
| **Forensic snapshots** | Captures point-in-time memory, network, file, and user state |
| **Deception layer** | Deploys honeyfiles and decoy credentials and records triggered deception assets |
| **Identity reset** | Simulates password/API-key rotation and session/token revocation |
| **Trust graph** | Visualizes User → Device → Application → Asset relationships and supports path severance |
| **Trust analytics** | Calculates active paths, compromised paths, severed paths, node health, and overall trust health |
| **File access governance** | Models file classifications, grants, access attempts, and user containment state |
| **Incident timeline** | Reconstructs events into a chronological incident narrative with significance levels |
| **Attack simulation** | Runs an end-to-end simulated attack and streams the response sequence over WebSockets |
| **Live dashboard** | Presents risk, events, breakers, identity state, trust paths, snapshots, and response status in one UI |

---

## Threat model inside the prototype

BlackBox starts from a baseline risk score of **20** and classifies system state using these thresholds:

| Risk score | Threat state |
|---:|---|
| `0–40` | 🟢 **GREEN** |
| `41–70` | 🟡 **YELLOW** |
| `71–90` | 🟠 **ORANGE** |
| `91–100` | 🔴 **RED** |

Risk is affected by simulated security events. Examples include:

```text
FILE_ACCESS         +0.5
FILE_CREATE         +1
FILE_MODIFY         +2
PROCESS_CREATE      +3
LOGIN               +4
FILE_DELETE         +5
DECOY_CRED_USED     +35
HONEYFILE_TRIGGERED +40
```

The risk engine keeps a rolling history for the dashboard and can automatically trip breakers as the score crosses containment thresholds.

---

## Trust-path circuit breakers

BlackBox models containment around **five trust paths** rather than generic on/off switches:

```text
┌─────────────────────────────┐
│       Trust Controls        │
├─────────────────────────────┤
│ User → Asset                │
│ Device → Asset              │
│ App → Asset                 │
│ Remote Access               │
│ External Transfer           │
└─────────────────────────────┘
```

Automatic trip points in the prototype are:

```text
Risk > 70   → External Transfer
Risk > 85   → Remote Access
Risk > 95   → User → Asset
              Device → Asset
              App → Asset
```

Operators can also manually trip or reset individual breakers with a reason that becomes part of the event stream.

---

## 4-phase Lockdown Protocol

The central response workflow is intentionally visible and sequential.

### Phase 1 · State Preservation

A forensic snapshot is created before deeper containment actions begin.

```text
Snapshot
├── Memory state
├── Network state
├── File state
└── User state
```

### Phase 2 · Trust Severance

Compromised trust paths are identified and severed. Circuit breakers are tripped and the trust graph is updated.

### Phase 3 · Asset Protection & Deception

BlackBox deploys its deception layer, including honeyfiles and decoy credentials designed to expose continued attacker interaction inside the simulated environment.

### Phase 4 · Identity Reset

The prototype simulates recovery actions such as:

```text
Password rotation
API key rotation
Session revocation
Token revocation
Access key reset
```

Every stage is broadcast to the dashboard so the operator can watch the response unfold in real time.

---

## Trust Graph

The trust graph is one of the core ideas behind BlackBox.

Instead of looking at a compromised user in isolation, the system models relationships such as:

```text
User
  │
  ▼
Device
  │
  ▼
Application
  │
  ▼
Critical Asset
```

Example paths seeded by the project include:

```text
admin → WKSTN-ADMIN-01 → Excel → Payroll_2026.xlsx
analyst → WKSTN-ANALYST-02 → SSH Client → CustomerDatabase.db
unknown_user → UNKNOWN-DEVICE → cmd.exe → /etc/shadow
attacker → UNKNOWN-DEVICE → cmd.exe → AWS_AccessKeys.csv
```

Trust scores and risk states allow the dashboard to distinguish **NORMAL**, **DEGRADED**, and **COMPROMISED** nodes, while severed edges are retained as part of the incident story.

---

## Deception layer

The project ships with a simulated deception registry containing:

### Honeyfiles

```text
/tmp/blackbox_watch/Payroll_2026.xlsx
/tmp/blackbox_watch/ExecutivePasswords.txt
/tmp/blackbox_watch/CryptoWalletBackup.txt
/tmp/blackbox_watch/AWS_AccessKeys.csv
```

### Decoy credentials

```text
admin_backup
 db_root
svc_account
```

A triggered honeyfile generates a **DECEPTION_TRIGGERED** event and contributes a large risk increase, making deception part of the detection-and-response loop rather than a passive list of fake files.

> The credential values and assets in this repository are **simulated demo data**. They are not intended to represent production credentials.

---

## Real-time architecture

```mermaid
flowchart LR
    UI[React Mission Control] <-->|WebSocket /api/ws| API[Express API]
    UI -->|REST| API
    API --> Risk[Risk + State Engine]
    API --> Flight[Flight Recorder]
    API --> Trust[Trust Graph Engine]
    API --> Lock[Lockdown Engine]
    API --> Deception[Deception Engine]
    API --> Forensics[Snapshot Engine]
    API --> Identity[Identity Reset Engine]
    API --> Sim[Attack Simulation]
    API --> DB[(PostgreSQL)]
    API --> Spec[OpenAPI + Zod]
```

### Why WebSockets?

Security operations are event-driven. The application therefore avoids forcing the UI to repeatedly poll for every state transition.

The API server exposes `/api/ws` and broadcasts events such as:

```text
NEW_EVENT
RISK_UPDATE
BREAKER_TRIPPED
LOCKDOWN_PHASE
LOCKDOWN_COMPLETE
IDENTITY_RESET
DECEPTION_DEPLOYED
DECEPTION_TRIGGERED
TRUST_UPDATE
USER_TRUST_UPDATED
SIMULATION_RESET
```

That allows the dashboard to animate the response sequence while the backend is processing it.

---

## Tech stack

### Frontend

- React 19.1
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui / Radix UI primitives
- TanStack Query
- Framer Motion
- Recharts
- Lucide React
- Wouter

### Backend

- Node.js 24
- Express 5
- WebSockets via `ws`
- Pino / pino-http logging
- Zod validation
- UUID-based identifiers

### Data layer

- PostgreSQL
- Drizzle ORM
- Drizzle Kit

### API contract

- OpenAPI specification in `lib/api-spec/openapi.yaml`
- Generated TypeScript API client
- Generated Zod schemas
- Orval-based code generation

### Workspace

- pnpm workspaces
- TypeScript project references
- esbuild

---

## Repository structure

```text
BlackBox/
├── artifacts/
│   ├── api-server/
│   │   └── src/
│   │       ├── engines/
│   │       │   ├── deception.ts
│   │       │   ├── fileAccess.ts
│   │       │   ├── flightRecorder.ts
│   │       │   ├── identityReset.ts
│   │       │   ├── identityResetStatus.ts
│   │       │   ├── lockdown.ts
│   │       │   ├── narrative.ts
│   │       │   ├── simulation.ts
│   │       │   ├── snapshot.ts
│   │       │   ├── state.ts
│   │       │   ├── trustGraph.ts
│   │       │   └── websocket.ts
│   │       ├── routes/
│   │       ├── app.ts
│   │       ├── index.ts
│   │       └── seed.ts
│   │
│   └── blackbox/
│       └── src/
│           ├── components/
│           ├── hooks/
│           ├── lib/
│           ├── App.tsx
│           └── main.tsx
│
├── lib/
│   ├── api-client-react/
│   ├── api-spec/
│   │   └── openapi.yaml
│   ├── api-zod/
│   └── db/
│       └── src/schema/
│           ├── deception.ts
│           ├── events.ts
│           ├── fileAccess.ts
│           ├── incidents.ts
│           ├── snapshots.ts
│           └── trust.ts
│
├── scripts/
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.json
```

---

## Getting started

### Prerequisites

Make sure you have:

- Node.js 24+
- pnpm
- PostgreSQL

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd BlackBox
```

### 2. Install dependencies

```bash
pnpm install
```

The workspace intentionally enforces **pnpm** and uses a minimum package release age policy to reduce exposure to newly published malicious packages.

### 3. Configure the database

Create a PostgreSQL database and set:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
```

The application also requires a runtime `PORT` environment variable for the API server.

### 4. Push the schema

```bash
pnpm --filter @workspace/db run push
```

### 5. Start the API server

```bash
PORT=8080 pnpm --filter @workspace/api-server run dev
```

### 6. Start the dashboard

In another terminal:

```bash
pnpm --filter @workspace/blackbox run dev
```

Vite serves the frontend on the port printed by the development server.

### 7. Validate the workspace

```bash
pnpm run typecheck
pnpm run build
```

---

## Demo workflow

The fastest way to understand the project is to run the built-in simulation.

### Start a simulated attack

```http
POST /api/simulate/attack
Content-Type: application/json

{
  "attacker": "attacker",
  "severity": "HIGH"
}
```

Supported severities:

```text
LOW
MEDIUM
HIGH
```

The simulation progressively changes the security state and streams updates to connected dashboard clients.

### Reset the environment

```http
POST /api/simulate/reset
```

Resetting returns risk, breakers, trust state, incidents, snapshots, deception state, and generated event data to the demo baseline.

---

## API surface

BlackBox exposes its REST API under `/api`.

| Area | Example endpoints |
|---|---|
| Health | `GET /api/health` |
| Events | `GET /api/events` |
| Risk | `GET /api/risk/score` · `GET /api/risk/history` |
| Breakers | `GET /api/breakers` · `POST /api/breakers/:name/trip` |
| Lockdown | `GET /api/lockdown` · `POST /api/lockdown/initiate` |
| Snapshots | `GET /api/snapshots` · `GET /api/snapshots/:id` |
| Deception | `GET /api/deception` and related trigger/deploy actions |
| Incidents | `GET /api/incidents` |
| Users | `GET /api/users` |
| Trust | `GET /api/trust/graph` · `GET /api/trust/analytics` · `POST /api/trust/edges/:id/sever` |
| Assets | `GET /api/assets/classified` |
| Identity | Identity reset/status endpoints |
| File access | File governance and access-attempt endpoints |
| Narrative | `GET /api/narrative` |
| Simulation | `POST /api/simulate/attack` · `POST /api/simulate/reset` |
| WebSocket | `/api/ws` |

The OpenAPI contract lives at:

```text
lib/api-spec/openapi.yaml
```

---

## Data model

The PostgreSQL layer persists the operational history needed to reconstruct a simulated incident.

```text
Events
  ├── timestamp
  ├── event type
  ├── user
  ├── source
  ├── details
  ├── risk delta
  └── threat state

Snapshots
  ├── memory snapshot
  ├── network snapshot
  ├── file snapshot
  └── user snapshot

Incidents
  ├── start / end time
  ├── peak risk
  ├── threat state reached
  ├── timeline
  ├── breakers tripped
  ├── deception state
  └── resolution state

Trust Graph
  ├── nodes
  └── edges

File Access Governance
  ├── files
  ├── grants
  ├── containment state
  └── access attempts

Deception Registry
  ├── honeyfiles
  └── decoy credentials
```

---

## Engineering decisions

### In-memory security state + persisted history

High-frequency operational state such as risk score, threat state, breaker state, lockdown phase, and user trust scores is kept in memory for fast reads and immediate WebSocket broadcasts.

Longer-lived incident evidence is persisted in PostgreSQL.

### One HTTP server for REST + WebSockets

The application creates one Node HTTP server and attaches the WebSocket server to it, keeping `/api` requests and `/api/ws` on the same runtime.

### Event-driven simulation

The attack simulation runs asynchronously and returns while the dashboard receives incremental state changes over WebSockets. This produces a more realistic operator experience than a single blocking request that returns the final result only.

### Defense-in-depth dependency policy

The workspace configuration includes `minimumReleaseAge` and several dependency overrides intended to reduce supply-chain exposure and pin known patched versions.

---

## Security scope & responsible use

**BlackBox is a cybersecurity research and demonstration prototype.**

The repository intentionally models containment and recovery behavior without claiming to be a production EDR, IAM platform, SIEM, SOAR, or network firewall.

In particular:

- Circuit breakers are **stateful prototype controls**. They do not actually terminate real network connections.
- Identity reset actions are **simulated**. They do not rotate real credentials.
- Attack simulation is **contained within the application's demo environment**.
- Honeyfiles and decoy credentials are **synthetic demonstration assets**.
- Seed data includes fictional users, assets, IP addresses, credentials, and security events.

Use the project only in environments you own or are explicitly authorized to test.

---

## Screenshots

Recommended portfolio screenshots for this repository:

```text
1. Main mission-control dashboard
2. RED threat state + active circuit breakers
3. Trust graph with severed paths
4. 4-phase lockdown sequence
5. Attack simulation timeline
6. Deception / honeyfile trigger
7. Identity reset progress
8. Incident reconstruction
```

Place them in:

```text
screenshots/
```

and link them here as the project evolves.

---

## Why this project exists

BlackBox explores a security architecture built around a simple principle:

> **Detection is only the beginning of incident response.**

A useful security control should help an operator answer five questions:

```text
What happened?
     ↓
How risky is it?
     ↓
What can be trusted?
     ↓
What should be isolated?
     ↓
How do we recover and explain it?
```

BlackBox puts those questions into one interactive system so the incident can be watched as a **state transition**, not merely a list of alerts.

---

## Roadmap

Potential next steps for the project:

- [ ] Persistent authentication and RBAC for operators
- [ ] Real SIEM ingestion adapters
- [ ] ATT&CK technique mapping for event classification
- [ ] More granular policy-based breaker rules
- [ ] Real audit-log export
- [ ] Configurable trust models
- [ ] Pluggable detection rules
- [ ] Production-grade secrets management
- [ ] Multi-tenant incident isolation
- [ ] Automated tests for engines and API routes
- [ ] CI security checks and dependency scanning

---

## License

This project is licensed under the **MIT License**.

---

<p align="center">
  <strong>BLACKBOX</strong><br/>
  <sub>Observe · Score · Sever · Deceive · Recover</sub>
</p>
