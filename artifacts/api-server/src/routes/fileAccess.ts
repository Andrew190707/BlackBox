import { Router } from "express";
import { evaluateFileAccess, getFileAccessPolicy } from "../engines/fileAccess";
import { logger } from "../lib/logger";

const router = Router();

router.get("/file-access/policy", async (_req, res) => {
  try {
    res.json(await getFileAccessPolicy());
  } catch (err) {
    logger.error({ err }, "Failed to load file access policy");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/file-access/attempt", async (req, res) => {
  const body = req.body ?? {};
  if (typeof body.userName !== "string" || typeof body.fileId !== "string" || typeof body.action !== "string") {
    res.status(400).json({ error: "userName, fileId, and action are required" });
    return;
  }
  try {
    const result = await evaluateFileAccess({
      userName: body.userName,
      fileId: body.fileId,
      action: body.action,
      device: typeof body.device === "string" ? body.device : undefined,
      application: typeof body.application === "string" ? body.application : undefined,
      bytesMb: typeof body.bytesMb === "number" ? body.bytesMb : undefined,
      fileCount: typeof body.fileCount === "number" ? body.fileCount : undefined,
    });
    if (result.status === 404) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Failed to evaluate file access");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;