import { Router } from "express";
import { runAttackSimulation } from "../engines/simulation";
import { blackBoxState } from "../engines/state";
import { db } from "@workspace/db";
import { eventsTable, snapshotsTable, deceptionAssetsTable, incidentsTable } from "@workspace/db";
import { broadcast } from "../engines/websocket";

const router = Router();

router.post("/simulate/attack", async (_req, res) => {
  const result = await runAttackSimulation();
  res.json(result);
});

router.post("/simulate/reset", async (_req, res) => {
  blackBoxState.reset();

  await db.delete(eventsTable);
  await db.delete(snapshotsTable);
  await db.delete(deceptionAssetsTable);
  await db.delete(incidentsTable);

  broadcast("RISK_UPDATE", {
    score: blackBoxState.riskScore,
    threatState: blackBoxState.threatState,
    updatedAt: new Date().toISOString(),
  });
  broadcast("SIMULATION_RESET", { message: "All state reset to baseline" });

  await seedEvents();

  res.json({ success: true, message: "State reset to baseline" });
});

async function seedEvents() {
  const { logEvent } = await import("../engines/flightRecorder");
  const users = ["admin", "analyst", "hr_admin", "dev_lead"];
  const files = ["/var/data/customer_db.sql", "/src/core/auth.ts", "/docs/report.docx", "/var/log/access.log"];
  const types = ["FILE_ACCESS", "FILE_MODIFY", "FILE_CREATE", "PROCESS_CREATE", "LOGIN"];
  for (let i = 0; i < 8; i++) {
    await logEvent({
      eventType: types[i % types.length],
      user: users[i % users.length],
      source: files[i % files.length],
      details: { seed: true },
      riskDeltaOverride: 0.2,
    });
    await new Promise((r) => setTimeout(r, 50));
  }
}

export default router;
