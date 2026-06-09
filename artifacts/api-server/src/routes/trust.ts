import { Router } from "express";
import { getTrustGraph, severTrustPath } from "../engines/trustGraph";
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

export default router;
