import { Router } from "express";
import { generateNarrative } from "../engines/narrative";
import { logger } from "../lib/logger";

const router = Router();

router.get("/narrative", async (req, res) => {
  try {
    const narrative = await generateNarrative();
    res.json(narrative);
  } catch (err) {
    logger.error({ err }, "Failed to generate narrative");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
