import { Router } from "express";
import { getTrustGraph, severTrustPath, getTrustAnalytics, getComputedTrustScore, getClassifiedAssets } from "../engines/trustGraph";
import { blackBoxState } from "../engines/state";
import { logger } from "../lib/logger";

const router = Router();

router.get("/trust/graph", async (req, res) => {
  try {
    const graph = await getTrustGraph();
    res.json(graph);
  } catch (err) {
    logger.error({ err }, "Failed to get trust graph");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/trust/edges/:id/sever", async (req, res) => {
  try {
    const edge = await severTrustPath(req.params.id);
    if (!edge) {
      res.status(404).json({ error: "Edge not found" });
      return;
    }
    res.json(edge);
  } catch (err) {
    logger.error({ err }, "Failed to sever trust path");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/trust/analytics", async (req, res) => {
  try {
    const analytics = await getTrustAnalytics();
    res.json(analytics);
  } catch (err) {
    logger.error({ err }, "Failed to get trust analytics");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/trust/score", async (req, res) => {
  try {
    const { score, level } = await getComputedTrustScore(blackBoxState.userTrustScores);
    res.json({ score, level, updatedAt: new Date().toISOString() });
  } catch (err) {
    logger.error({ err }, "Failed to get trust score");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/assets/classified", async (req, res) => {
  try {
    const assets = await getClassifiedAssets();
    res.json(assets);
  } catch (err) {
    logger.error({ err }, "Failed to get classified assets");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
