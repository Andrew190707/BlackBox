import { Router } from "express";
import { blackBoxState } from "../engines/state";
import { initiateLockdown } from "../engines/lockdown";
import { logEvent } from "../engines/flightRecorder";

const router = Router();

router.get("/lockdown", (_req, res) => {
  res.json(blackBoxState.lockdown);
});

router.post("/lockdown/initiate", async (_req, res) => {
  await initiateLockdown();
  res.json(blackBoxState.lockdown);
});

router.post("/lockdown/lift", async (_req, res) => {
  blackBoxState.lockdown.active = false;
  blackBoxState.lockdown.liftedAt = new Date().toISOString();
  blackBoxState.lockdown.phase = 0;

  await logEvent({
    eventType: "LOCKDOWN_LIFTED",
    user: "operator",
    source: "lockdown",
    details: {},
    riskDeltaOverride: 0,
  });

  res.json(blackBoxState.lockdown);
});

export default router;
