import { Router } from "express";
import { db } from "@workspace/db";
import { snapshotsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { GetSnapshotParams } from "@workspace/api-zod";

const router = Router();

router.get("/snapshots", async (_req, res) => {
  const rows = await db.select().from(snapshotsTable).orderBy(desc(snapshotsTable.timestamp));
  res.json(
    rows.map((s) => ({
      id: s.id,
      timestamp: s.timestamp.toISOString(),
      triggerRiskScore: s.triggerRiskScore,
    }))
  );
});

router.get("/snapshots/:id", async (req, res) => {
  const parsed = GetSnapshotParams.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });

  const [snap] = await db.select().from(snapshotsTable).where(eq(snapshotsTable.id, parsed.data.id)).limit(1);
  if (!snap) return res.status(404).json({ error: "Not found" });

  return res.json({
    id: snap.id,
    timestamp: snap.timestamp.toISOString(),
    triggerRiskScore: snap.triggerRiskScore,
    memorySnapshot: snap.memorySnapshot,
    networkSnapshot: snap.networkSnapshot,
    fileSnapshot: snap.fileSnapshot,
    userSnapshot: snap.userSnapshot,
  });
});

export default router;
