import { db } from "@workspace/db";
import { eventsTable, deceptionAssetsTable, incidentsTable } from "@workspace/db";
import { broadcast } from "./websocket";
import { blackBoxState } from "./state";
import { logEvent, randomFile } from "./flightRecorder";
import { takeSnapshot } from "./snapshot";
import { deployDeception } from "./deception";
import { executeIdentityReset } from "./identityReset";
import { severAllCompromisedPaths, resetTrustGraph } from "./trustGraph";
import { logger } from "../lib/logger";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function runAttackSimulation(attacker?: string) {
  if (blackBoxState.simulationRunning) {
    return { success: false, message: "Simulation already running" };
  }

  const attackerName = attacker ?? "unknown_user";
  blackBoxState.reset();
  blackBoxState.currentAttacker = attackerName;
  await resetTrustGraph();
  blackBoxState.simulationRunning = true;
  const incidentId = uuidv4();
  blackBoxState.currentIncidentId = incidentId;

  await db.insert(incidentsTable).values({
    id: incidentId,
    startTime: new Date(),
    peakRiskScore: 0,
    threatStateReached: "GREEN",
    timeline: "[]",
    breakersTripped: "[]",
    deceptionTriggered: false,
    honeyfilesAccessed: "[]",
    snapshotId: null,
    summary: "Incident in progress...",
    resolved: false,
  });

  const timelineEntries: Array<{ time: string; event: string; significance: string }> = [];

  const addTimeline = (event: string, significance: "high" | "medium" | "low") => {
    timelineEntries.push({ time: new Date().toISOString(), event, significance });
    broadcast("SIMULATION_STEP", { event, significance, timestamp: new Date().toISOString() });
  };

  (async () => {
    try {
      addTimeline(`Attack simulation initiated — attacker: ${attackerName}`, "medium");

      // Phase 1: Normal baseline
      for (let i = 0; i < 5; i++) {
        await logEvent({
          eventType: "FILE_ACCESS",
          user: "analyst",
          source: randomFile(),
          details: { normal: true, step: "baseline" },
          riskDeltaOverride: 0.5,
        });
        await sleep(300);
      }
      addTimeline("Normal file access patterns — risk GREEN ~20", "low");
      await sleep(2000);

      // Phase 2: Mass file access — YELLOW
      for (let i = 0; i < 200; i++) {
        await logEvent({
          eventType: "FILE_ACCESS",
          user: attackerName,
          source: randomFile(),
          details: { bulk: true, volume: "high", attacker: true },
          riskDeltaOverride: 0.22,
        });
        if (i % 25 === 0) await sleep(250);
      }
      addTimeline(`Mass file access — 200 FILE_ACCESS events by ${attackerName} — risk YELLOW`, "high");
      await sleep(1500);

      // Phase 3: Suspicious login — ORANGE
      await logEvent({
        eventType: "LOGIN",
        user: attackerName,
        source: "192.168.99.200",
        details: { location: "Unknown", hour: 3, suspicious: true, attacker: true },
        riskDeltaOverride: 18,
      });
      addTimeline(`LOGIN by ${attackerName} at 03:00 from unknown location — risk spikes ORANGE`, "high");
      await sleep(1000);

      // External transfer auto-trip
      await logEvent({
        eventType: "FILE_ACCESS",
        user: attackerName,
        source: "/etc/shadow",
        details: { sensitive: true, attacker: true },
        riskDeltaOverride: 6,
      });
      broadcast("RISK_UPDATE", {
        score: blackBoxState.riskScore,
        threatState: blackBoxState.threatState,
        updatedAt: new Date().toISOString(),
      });
      addTimeline("Risk > 70 — EXTERNAL_TRANSFER breaker auto-tripped", "high");
      await sleep(1200);

      await logEvent({
        eventType: "FILE_ACCESS",
        user: attackerName,
        source: "/var/data/customer_db.sql",
        details: { data_exfil: true, attacker: true },
        riskDeltaOverride: 4,
      });
      broadcast("RISK_UPDATE", {
        score: blackBoxState.riskScore,
        threatState: blackBoxState.threatState,
        updatedAt: new Date().toISOString(),
      });
      addTimeline("Risk > 85 — REMOTE_ACCESS breaker auto-tripped", "high");
      await sleep(800);

      // Push to RED and trigger full lockdown
      await logEvent({
        eventType: "FILE_ACCESS",
        user: attackerName,
        source: "/home/admin/.ssh/id_rsa",
        details: { data_exfil: true, ssh_key: true, attacker: true },
        riskDeltaOverride: 5,
      });
      addTimeline("Risk hits RED — ALL breakers trip — Lockdown Protocol initiates", "high");
      await sleep(600);

      // Lockdown Phase 1: State preservation
      blackBoxState.lockdown.active = true;
      blackBoxState.lockdown.initiatedAt = new Date().toISOString();
      blackBoxState.lockdown.phase = 1;
      broadcast("LOCKDOWN_PHASE", { phase: 1, message: "Phase 1: State preservation" });
      const snapshotId = await takeSnapshot(blackBoxState.riskScore);
      blackBoxState.lockdown.snapshotId = snapshotId;
      await logEvent({ eventType: "LOCKDOWN_PHASE1_COMPLETE", user: "system", source: "lockdown", details: { snapshotId }, riskDeltaOverride: 0 });
      addTimeline("Lockdown Phase 1 complete — forensic snapshot captured", "high");
      await sleep(1500);

      // Lockdown Phase 2: Trust severance
      blackBoxState.lockdown.phase = 2;
      broadcast("LOCKDOWN_PHASE", { phase: 2, message: "Phase 2: Trust severance" });
      Object.keys(blackBoxState.breakers).forEach((name) =>
        blackBoxState.tripBreaker(name, "Lockdown Phase 2")
      );
      await severAllCompromisedPaths();
      broadcast("BREAKER_TRIPPED", { breakers: Object.values(blackBoxState.breakers) });
      await logEvent({ eventType: "LOCKDOWN_PHASE2_COMPLETE", user: "system", source: "lockdown", details: { breakersTripped: Object.keys(blackBoxState.breakers) }, riskDeltaOverride: 0 });
      addTimeline("Lockdown Phase 2 complete — all trust paths severed", "high");
      await sleep(1500);

      // Lockdown Phase 3: Asset protection + deception
      blackBoxState.lockdown.phase = 3;
      broadcast("LOCKDOWN_PHASE", { phase: 3, message: "Phase 3: Asset protection & deception" });
      await deployDeception();
      await logEvent({ eventType: "LOCKDOWN_PHASE3_COMPLETE", user: "system", source: "lockdown", details: { deceptionDeployed: true }, riskDeltaOverride: 0 });
      addTimeline("Lockdown Phase 3 complete — honeyfiles deployed", "high");
      await sleep(2000);

      // Honeyfile triggered
      await logEvent({
        eventType: "HONEYFILE_TRIGGERED",
        user: attackerName,
        source: "/tmp/blackbox_watch/Payroll_2026.xlsx",
        details: { honeyfile: "Payroll_2026.xlsx", attackerIp: "192.168.99.200", attacker: true },
        riskDeltaOverride: 0,
      });
      await db
        .update(deceptionAssetsTable)
        .set({ triggered: true, triggeredAt: new Date() })
        .where(eq(deceptionAssetsTable.path, "/tmp/blackbox_watch/Payroll_2026.xlsx"));
      broadcast("DECEPTION_TRIGGERED", {
        asset: "Payroll_2026.xlsx",
        attacker: attackerName,
        message: `HONEYFILE ACCESSED — ${attackerName} identity confirmed`,
      });
      addTimeline(`DECEPTION TRIGGERED — ${attackerName} accessed Payroll_2026.xlsx`, "high");
      await sleep(1000);

      // Lockdown Phase 4: Identity reset
      blackBoxState.lockdown.phase = 4;
      broadcast("LOCKDOWN_PHASE", { phase: 4, message: "Phase 4: Identity reset" });
      await executeIdentityReset();
      await logEvent({ eventType: "LOCKDOWN_PHASE4_COMPLETE", user: "system", source: "lockdown", details: { credentialsRotated: true }, riskDeltaOverride: 0 });
      addTimeline("Lockdown Phase 4 complete — all credentials rotated, sessions revoked", "high");
      await sleep(1000);

      addTimeline("Incident reconstruction complete — full attack sequence documented", "medium");

      const peakScore = blackBoxState.riskScore;
      const threatReached = blackBoxState.threatState;

      await db
        .update(incidentsTable)
        .set({
          endTime: new Date(),
          peakRiskScore: peakScore,
          threatStateReached: threatReached,
          timeline: JSON.stringify(timelineEntries),
          breakersTripped: JSON.stringify(Object.keys(blackBoxState.breakers)),
          deceptionTriggered: true,
          honeyfilesAccessed: JSON.stringify(["Payroll_2026.xlsx"]),
          snapshotId: snapshotId,
          summary: `Automated attack simulation: mass file exfiltration by ${attackerName} detected, 3AM login anomaly, risk reached ${Math.round(peakScore)}/100 (${threatReached}). All circuit breakers tripped. Trust paths severed. Honeyfile Payroll_2026.xlsx accessed by ${attackerName} at 192.168.99.200. Identity reset complete. Full forensic snapshot captured.`,
          resolved: true,
        })
        .where(eq(incidentsTable.id, incidentId));

      broadcast("LOCKDOWN_COMPLETE", { lockdown: blackBoxState.lockdown });
    } catch (err) {
      logger.error({ err }, "Simulation error");
    } finally {
      blackBoxState.simulationRunning = false;
    }
  })();

  return { success: true, message: `Attack simulation started — attacker: ${attackerName}`, attacker: attackerName };
}
