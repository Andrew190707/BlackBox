import { db } from "@workspace/db";
import { eventsTable, deceptionAssetsTable, incidentsTable } from "@workspace/db";
import { broadcast } from "./websocket";
import { blackBoxState } from "./state";
import { logEvent, randomFile } from "./flightRecorder";
import { takeSnapshot } from "./snapshot";
import { deployDeception } from "./deception";
import { logger } from "../lib/logger";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function runAttackSimulation() {
  if (blackBoxState.simulationRunning) {
    return { success: false, message: "Simulation already running" };
  }

  blackBoxState.reset();
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
      addTimeline("Attack simulation initiated", "medium");

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

      for (let i = 0; i < 200; i++) {
        await logEvent({
          eventType: "FILE_ACCESS",
          user: "unknown_user",
          source: randomFile(),
          details: { bulk: true, volume: "high" },
          riskDeltaOverride: 0.22,
        });
        if (i % 25 === 0) await sleep(250);
      }
      addTimeline("Mass file access — 200 FILE_ACCESS events detected", "high");
      await sleep(1500);

      await logEvent({
        eventType: "LOGIN",
        user: "unknown_user",
        source: "192.168.99.200",
        details: { location: "Unknown", hour: 3, suspicious: true },
        riskDeltaOverride: 18,
      });
      addTimeline("LOGIN at 03:00 from unknown location — risk spikes", "high");
      await sleep(1000);

      await logEvent({
        eventType: "FILE_ACCESS",
        user: "unknown_user",
        source: "/etc/shadow",
        details: { sensitive: true },
        riskDeltaOverride: 6,
      });

      broadcast("RISK_UPDATE", {
        score: blackBoxState.riskScore,
        threatState: blackBoxState.threatState,
        updatedAt: new Date().toISOString(),
      });
      addTimeline("Risk hits 91 — circuit breakers auto-tripped", "high");
      await sleep(1200);

      await logEvent({
        eventType: "FILE_ACCESS",
        user: "attacker",
        source: "/var/data/customer_db.sql",
        details: { data_exfil: true },
        riskDeltaOverride: 4,
      });

      broadcast("RISK_UPDATE", {
        score: blackBoxState.riskScore,
        threatState: blackBoxState.threatState,
        updatedAt: new Date().toISOString(),
      });
      addTimeline("Risk hits 95 — ALL breakers trip — Lockdown Protocol initiates", "high");
      await sleep(800);

      blackBoxState.lockdown.active = true;
      blackBoxState.lockdown.initiatedAt = new Date().toISOString();
      blackBoxState.lockdown.phase = 1;
      broadcast("LOCKDOWN_PHASE", { phase: 1, message: "Phase 1: Evidence preservation" });

      const snapshotId = await takeSnapshot(blackBoxState.riskScore);
      blackBoxState.lockdown.snapshotId = snapshotId;
      await logEvent({
        eventType: "LOCKDOWN_PHASE1_COMPLETE",
        user: "system",
        source: "lockdown",
        details: { snapshotId },
        riskDeltaOverride: 0,
      });
      addTimeline("Lockdown Phase 1 complete — forensic snapshot captured", "high");
      await sleep(1500);

      blackBoxState.lockdown.phase = 2;
      broadcast("LOCKDOWN_PHASE", { phase: 2, message: "Phase 2: Trust severance" });
      Object.keys(blackBoxState.breakers).forEach((name) =>
        blackBoxState.tripBreaker(name, "Lockdown Phase 2")
      );
      broadcast("BREAKER_TRIPPED", { breakers: Object.values(blackBoxState.breakers) });
      await logEvent({
        eventType: "LOCKDOWN_PHASE2_COMPLETE",
        user: "system",
        source: "lockdown",
        details: { breakersTripped: Object.keys(blackBoxState.breakers) },
        riskDeltaOverride: 0,
      });
      addTimeline("Lockdown Phase 2 complete — all circuit breakers tripped", "high");
      await sleep(1500);

      blackBoxState.lockdown.phase = 3;
      broadcast("LOCKDOWN_PHASE", { phase: 3, message: "Phase 3: Asset protection & deception" });
      await deployDeception();
      await logEvent({
        eventType: "LOCKDOWN_PHASE3_COMPLETE",
        user: "system",
        source: "lockdown",
        details: { deceptionDeployed: true },
        riskDeltaOverride: 0,
      });
      addTimeline("Lockdown Phase 3 complete — honeyfiles deployed", "high");
      await sleep(2000);

      await logEvent({
        eventType: "HONEYFILE_TRIGGERED",
        user: "attacker",
        source: "/tmp/blackbox_watch/Payroll_2026.xlsx",
        details: { honeyfile: "Payroll_2026.xlsx", attackerIp: "192.168.99.200" },
        riskDeltaOverride: 0,
      });

      await db
        .update(deceptionAssetsTable)
        .set({ triggered: true, triggeredAt: new Date() })
        .where(eq(deceptionAssetsTable.path, "/tmp/blackbox_watch/Payroll_2026.xlsx"));

      broadcast("DECEPTION_TRIGGERED", {
        asset: "Payroll_2026.xlsx",
        attacker: "unknown_user",
        message: "HONEYFILE ACCESSED — attacker identity confirmed",
      });
      addTimeline("DECEPTION TRIGGERED — attacker accessed Payroll_2026.xlsx", "high");
      await sleep(1000);

      addTimeline("Incident timeline reconstructed — attack sequence complete", "medium");

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
          summary: `Automated attack simulation: mass file exfiltration detected, 3AM login anomaly, risk reached ${Math.round(peakScore)}/100 (${threatReached}). All circuit breakers tripped. Honeyfile Payroll_2026.xlsx accessed by attacker at 192.168.99.200. Full forensic snapshot captured.`,
          resolved: true,
        })
        .where(eq(incidentsTable.id, incidentId));

    } catch (err) {
      logger.error({ err }, "Simulation error");
    } finally {
      blackBoxState.simulationRunning = false;
    }
  })();

  return { success: true, message: "Attack simulation started — watch the dashboard for real-time updates" };
}
