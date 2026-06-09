import { db } from "@workspace/db";
import { incidentsTable } from "@workspace/db";
import { broadcast } from "./websocket";
import { blackBoxState } from "./state";
import { takeSnapshot } from "./snapshot";
import { deployDeception } from "./deception";
import { logEvent } from "./flightRecorder";
import { logger } from "../lib/logger";
import { v4 as uuidv4 } from "uuid";

export async function initiateLockdown(): Promise<void> {
  if (blackBoxState.lockdown.active) {
    logger.info("Lockdown already active");
    return;
  }

  blackBoxState.lockdown.active = true;
  blackBoxState.lockdown.phase = 0;
  blackBoxState.lockdown.initiatedAt = new Date().toISOString();

  const incidentId = uuidv4();
  blackBoxState.currentIncidentId = incidentId;

  await db.insert(incidentsTable).values({
    id: incidentId,
    startTime: new Date(),
    peakRiskScore: blackBoxState.riskScore,
    threatStateReached: blackBoxState.threatState,
    timeline: "[]",
    breakersTripped: "[]",
    deceptionTriggered: false,
    honeyfilesAccessed: "[]",
    snapshotId: null,
    summary: "Manual lockdown initiated",
    resolved: false,
  });

  broadcast("LOCKDOWN_PHASE", { phase: 0, message: "Lockdown initiated" });

  (async () => {
    try {
      blackBoxState.lockdown.phase = 1;
      broadcast("LOCKDOWN_PHASE", { phase: 1, message: "Phase 1: Evidence preservation" });
      const snapshotId = await takeSnapshot(blackBoxState.riskScore);
      blackBoxState.lockdown.snapshotId = snapshotId;
      await logEvent({ eventType: "LOCKDOWN_PHASE1_COMPLETE", user: "system", source: "lockdown", riskDeltaOverride: 0 });
      logger.info("Lockdown Phase 1 complete");

      await new Promise((r) => setTimeout(r, 1500));

      blackBoxState.lockdown.phase = 2;
      broadcast("LOCKDOWN_PHASE", { phase: 2, message: "Phase 2: Trust severance" });
      Object.keys(blackBoxState.breakers).forEach((name) =>
        blackBoxState.tripBreaker(name, "Lockdown Phase 2")
      );
      broadcast("BREAKER_TRIPPED", { breakers: Object.values(blackBoxState.breakers) });
      await logEvent({ eventType: "LOCKDOWN_PHASE2_COMPLETE", user: "system", source: "lockdown", riskDeltaOverride: 0 });
      logger.info("Lockdown Phase 2 complete");

      await new Promise((r) => setTimeout(r, 1500));

      blackBoxState.lockdown.phase = 3;
      broadcast("LOCKDOWN_PHASE", { phase: 3, message: "Phase 3: Asset protection & deception" });
      await deployDeception();
      await logEvent({ eventType: "LOCKDOWN_PHASE3_COMPLETE", user: "system", source: "lockdown", riskDeltaOverride: 0 });
      logger.info("Lockdown Phase 3 complete");

      broadcast("LOCKDOWN_COMPLETE", { lockdown: blackBoxState.lockdown });
    } catch (err) {
      logger.error({ err }, "Lockdown error");
    }
  })();
}
