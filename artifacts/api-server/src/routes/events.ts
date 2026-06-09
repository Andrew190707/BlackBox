import { Router } from "express";
import { db } from "@workspace/db";
import { eventsTable } from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";
import { ListEventsQueryParams, GetEventParams } from "@workspace/api-zod";

const router = Router();

router.get("/events", async (req, res) => {
  const parsed = ListEventsQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 100) : 100;
  const offset = parsed.success ? (parsed.data.offset ?? 0) : 0;
  const type = parsed.success ? parsed.data.type : undefined;

  let query = db.select().from(eventsTable).orderBy(desc(eventsTable.timestamp)).limit(limit).offset(offset);

  const rows = await query;
  const filteredRows = type ? rows.filter((r) => r.eventType === type) : rows;

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(eventsTable);

  res.json({
    events: filteredRows.map((e) => ({
      id: e.id,
      timestamp: e.timestamp.toISOString(),
      eventType: e.eventType,
      user: e.user,
      source: e.source,
      details: e.details,
      riskDelta: e.riskDelta,
      threatState: e.threatState,
    })),
    total: Number(count),
  });
});

router.get("/events/:id", async (req, res) => {
  const parsed = GetEventParams.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, parsed.data.id)).limit(1);
  if (!event) return res.status(404).json({ error: "Not found" });

  return res.json({
    id: event.id,
    timestamp: event.timestamp.toISOString(),
    eventType: event.eventType,
    user: event.user,
    source: event.source,
    details: event.details,
    riskDelta: event.riskDelta,
    threatState: event.threatState,
  });
});

export default router;
