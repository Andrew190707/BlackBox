import { db } from "@workspace/db";
import { eventsTable, type InsertEvent } from "@workspace/db";
import { broadcast } from "./websocket";
import { blackBoxState } from "./state";
import { logger } from "../lib/logger";
import { v4 as uuidv4 } from "uuid";

const USERS = ["admin", "analyst", "hr_admin", "dev_lead", "ceo", "cfo", "unknown_user"];
const FILE_PATHS = [
  "/var/data/customer_db.sql",
  "/etc/payroll_data.csv",
  "/src/core/auth.ts",
  "/docs/executive_strategy.docx",
  "/tmp/export_12043.zip",
  "/var/log/access.log",
  "/home/admin/.ssh/id_rsa",
  "/etc/shadow",
];
const PROCESSES = ["python3", "node", "bash", "scp", "curl", "wget", "nc", "nmap", "mysqldump"];

export function makeEventRiskDelta(eventType: string): number {
  switch (eventType) {
    case "FILE_DELETE": return 5;
    case "FILE_MODIFY": return 2;
    case "FILE_CREATE": return 1;
    case "FILE_ACCESS": return 0.5;
    case "PROCESS_CREATE": return 3;
    case "LOGIN": return 4;
    case "HONEYFILE_TRIGGERED": return 40;
    case "DECOY_CRED_USED": return 35;
    case "LOCKDOWN_PHASE1_COMPLETE": return 0;
    case "LOCKDOWN_PHASE2_COMPLETE": return 0;
    case "LOCKDOWN_PHASE3_COMPLETE": return 0;
    case "LOCKDOWN_PHASE4_COMPLETE": return 0;
    case "IDENTITY_RESET_STARTED":   return 0;
    case "IDENTITY_RESET_COMPLETED": return 0;
    case "PASSWORD_ROTATION":        return 0;
    case "API_KEY_ROTATION":         return 0;
    case "TOKEN_REVOCATION":         return 0;
    case "SESSION_REVOCATION":       return 0;
    case "ACCESS_KEY_RESET":         return 0;
    case "BREAKER_AUTO_TRIPPED":     return 0;
    default: return 1;
  }
}

export async function logEvent(params: {
  eventType: string;
  user: string;
  source: string;
  details?: Record<string, unknown>;
  riskDeltaOverride?: number;
}): Promise<void> {
  const { eventType, user, source, details = {}, riskDeltaOverride } = params;

  const riskDelta = riskDeltaOverride ?? makeEventRiskDelta(eventType);
  blackBoxState.updateRiskScore(riskDelta);

  const autoTripped = blackBoxState.autoTripBreakers(blackBoxState.riskScore);
  for (const name of autoTripped) {
    await logEvent({
      eventType: "BREAKER_AUTO_TRIPPED",
      user: "system",
      source: name,
      details: { reason: `Auto-tripped at risk score ${blackBoxState.riskScore}` },
      riskDeltaOverride: 0,
    });
    broadcast("BREAKER_TRIPPED", blackBoxState.breakers[name]);
  }

  if (blackBoxState.riskScore >= 95 && !blackBoxState.lockdown.active && !blackBoxState.simulationRunning) {
    blackBoxState.lockdown.active = true;
    broadcast("LOCKDOWN_PHASE", { phase: 0, message: "Lockdown auto-initiated" });
  }

  const threatState = blackBoxState.threatState;
  const event: InsertEvent = {
    eventType,
    user,
    source,
    details: JSON.stringify(details),
    riskDelta,
    threatState,
  };

  try {
    const [inserted] = await db.insert(eventsTable).values(event).returning();
    broadcast("NEW_EVENT", {
      id: inserted.id,
      timestamp: inserted.timestamp.toISOString(),
      eventType: inserted.eventType,
      user: inserted.user,
      source: inserted.source,
      details: inserted.details,
      riskDelta: inserted.riskDelta,
      threatState: inserted.threatState,
    });
    broadcast("RISK_UPDATE", {
      score: blackBoxState.riskScore,
      threatState: blackBoxState.threatState,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Failed to persist event");
  }
}

export function randomUser() {
  return USERS[Math.floor(Math.random() * USERS.length)];
}
export function randomFile() {
  return FILE_PATHS[Math.floor(Math.random() * FILE_PATHS.length)];
}
export function randomProcess() {
  return PROCESSES[Math.floor(Math.random() * PROCESSES.length)];
}

let flightInterval: ReturnType<typeof setInterval> | null = null;

export function startFlightRecorder() {
  if (flightInterval) return;
  flightInterval = setInterval(async () => {
    if (blackBoxState.simulationRunning) return;
    const rand = Math.random();
    if (rand < 0.3) {
      const types = ["FILE_ACCESS", "FILE_CREATE", "FILE_MODIFY", "PROCESS_CREATE", "FILE_DELETE"];
      const eventType = types[Math.floor(Math.random() * types.length)];
      await logEvent({
        eventType,
        user: randomUser(),
        source: eventType.includes("FILE") ? randomFile() : randomProcess(),
        details: { auto: true },
        riskDeltaOverride: 0.2,
      });
    }
  }, 5000);
  logger.info("Flight recorder started");
}
