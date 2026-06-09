import { Router } from "express";
import { blackBoxState } from "../engines/state";

const router = Router();

router.get("/risk/score", (_req, res) => {
  res.json({
    score: blackBoxState.riskScore,
    threatState: blackBoxState.threatState,
    updatedAt: new Date().toISOString(),
  });
});

router.get("/risk/history", (_req, res) => {
  res.json(blackBoxState.riskHistory);
});

export default router;
