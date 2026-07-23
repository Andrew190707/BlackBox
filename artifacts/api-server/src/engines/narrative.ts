import { db } from "@workspace/db";
import { eventsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { blackBoxState } from "./state";

function ago(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export async function generateNarrative(): Promise<{ summary: string; generatedAt: string; eventCount: number }> {
  const recent = await db
    .select()
    .from(eventsTable)
    .orderBy(desc(eventsTable.timestamp))
    .limit(40);

  const state    = blackBoxState;
  const parts: string[] = [];
  const now      = new Date().toISOString();

  const threatState = state.threatState;
  const riskScore   = Math.round(state.riskScore);

  const threatSentence: Record<string, string> = {
    GREEN:  ` lac`,
    YELLOW: `BlackBox has elevated the threat condition to YELLOW — Threat Score ${riskScore}/100. Anomalous activity is being tracked.`,
    ORANGE: `BlackBox governance layer is operating in ORANGE condition — Threat Score ${riskScore}/100. Trust degradation detected.`,
    RED:    `BlackBox has declared a RED threat condition — Threat Score ${riskScore}/100. Active attack behavior in progress.`,
  };
  parts.push(threatSentence[threatState] ?? `Threat Score: ${riskScore}/100.`);

  const userScores = state.userTrustScores;
  const degradedUsers = Object.entries(userScores)
    .filter(([, s]) => s < 70)
    .sort(([, a], [, b]) => a - b);
  if (degradedUsers.length > 0) {
    const [topUser, topScore] = degradedUsers[0];
    parts.push(`Trust degradation detected for ${topUser} (Trust Score: ${Math.round(topScore)}).`);
  }

  const deceptionEvents = recent.filter((e) => e.eventType === "DECEPTION_TRIGGERED");
  if (deceptionEvents.length > 0) {
    const e = deceptionEvents[0];
    parts.push(`Honeyfile access recorded — deception asset triggered by ${e.user} ${ago(e.timestamp.toISOString())}.`);
  }

  const breakersTripped = Object.values(state.breakers).filter((b) => b.status === "TRIPPED");
  if (breakersTripped.length > 0) {
    const labels = breakersTripped.map((b) => b.label ?? b.name).join(", ");
    parts.push(`${breakersTripped.length} trust path circuit breaker${breakersTripped.length > 1 ? "s" : ""} tripped: ${labels}.`);
  }

  const lockdown = state.lockdown;
  if (lockdown.active) {
    const phaseNames = ["", "State Preservation", "Trust Severance", "Asset Protection", "Identity Reset"];
    parts.push(`BlackBox Lockdown Protocol active — currently executing Phase ${lockdown.phase}: ${phaseNames[lockdown.phase] ?? "Unknown"}.`);
  }

  const idResetEvents = recent.filter((e) => e.eventType === "IDENTITY_RESET_COMPLETED");
  if (idResetEvents.length > 0) {
    parts.push(`Identity Reset Protocol completed ${ago(idResetEvents[0].timestamp.toISOString())} — all credentials rotated and sessions revoked.`);
  }

  const snapshotEvents = recent.filter((e) => e.eventType === "SNAPSHOT_CREATED");
  if (snapshotEvents.length > 0) {
    parts.push(`State Preservation snapshot captured ${ago(snapshotEvents[0].timestamp.toISOString())} at Threat Score ${riskScore}.`);
  }

  const anomalyCount = recent.filter((e) => e.eventType.includes("ANOMALY") || e.eventType.includes("FAILED")).length;
  if (anomalyCount > 3) {
    parts.push(`${anomalyCount} anomalous governance events detected in the recent activity window.`);
  }

  if (parts.length === 1) {
    parts.push("No governance actions required at this time. Trust paths and identity controls nominal.");
  }

  return {
    summary: parts.join(" "),
    generatedAt: now,
    eventCount: recent.length,
  };
}
