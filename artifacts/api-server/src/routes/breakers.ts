import { Router } from "express";
import { blackBoxState } from "../engines/state";
import { broadcast } from "../engines/websocket";
import { logEvent } from "../engines/flightRecorder";
import { TripBreakerBody, TripBreakerParams, ResetBreakerParams } from "@workspace/api-zod";

const router = Router();

router.get("/breakers", (_req, res) => {
  res.json({ breakers: Object.values(blackBoxState.breakers) });
});

router.post("/breakers/:name/trip", async (req, res) => {
  const paramParsed = TripBreakerParams.safeParse(req.params);
  const bodyParsed = TripBreakerBody.safeParse(req.body);

  if (!paramParsed.success) return res.status(400).json({ error: "Invalid params" });
  if (!bodyParsed.success) return res.status(400).json({ error: "reason is required" });

  const { name } = paramParsed.data;
  const { reason } = bodyParsed.data;

  if (!blackBoxState.breakers[name]) return res.status(404).json({ error: "Breaker not found" });

  blackBoxState.tripBreaker(name, reason);
  const breaker = blackBoxState.breakers[name];

  await logEvent({
    eventType: "BREAKER_MANUAL_TRIP",
    user: "operator",
    source: name,
    details: { reason },
    riskDeltaOverride: 0,
  });

  broadcast("BREAKER_TRIPPED", breaker);

  return res.json(breaker);
});

router.post("/breakers/:name/reset", async (req, res) => {
  const parsed = ResetBreakerParams.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid params" });

  const { name } = parsed.data;
  if (!blackBoxState.breakers[name]) return res.status(404).json({ error: "Breaker not found" });

  blackBoxState.resetBreaker(name);
  const breaker = blackBoxState.breakers[name];

  await logEvent({
    eventType: "BREAKER_MANUAL_RESET",
    user: "operator",
    source: name,
    details: {},
    riskDeltaOverride: 0,
  });

  broadcast("BREAKER_RESET", breaker);

  return res.json(breaker);
});

export default router;
