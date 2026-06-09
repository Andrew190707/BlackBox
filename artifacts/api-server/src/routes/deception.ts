import { Router } from "express";
import { db } from "@workspace/db";
import { deceptionAssetsTable } from "@workspace/db";
import { deployDeception } from "../engines/deception";
import { desc } from "drizzle-orm";

const router = Router();

router.get("/deception/assets", async (_req, res) => {
  const assets = await db.select().from(deceptionAssetsTable).orderBy(desc(deceptionAssetsTable.createdAt));
  res.json(
    assets.map((a) => ({
      id: a.id,
      type: a.type,
      path: a.path,
      deployed: a.deployed,
      triggered: a.triggered,
      triggeredAt: a.triggeredAt ? a.triggeredAt.toISOString() : null,
    }))
  );
});

router.post("/deception/deploy", async (_req, res) => {
  await deployDeception();
  const assets = await db.select().from(deceptionAssetsTable);
  res.json(
    assets.map((a) => ({
      id: a.id,
      type: a.type,
      path: a.path,
      deployed: a.deployed,
      triggered: a.triggered,
      triggeredAt: a.triggeredAt ? a.triggeredAt.toISOString() : null,
    }))
  );
});

export default router;
