import { Router } from "express";
import { db } from "@workspace/db";
import { incidentsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { GetIncidentReportParams } from "@workspace/api-zod";

const router = Router();

router.get("/incidents", async (_req, res) => {
  const rows = await db.select().from(incidentsTable).orderBy(desc(incidentsTable.startTime));
  res.json(
    rows.map((i) => ({
      id: i.id,
      startTime: i.startTime.toISOString(),
      endTime: i.endTime ? i.endTime.toISOString() : null,
      peakRiskScore: i.peakRiskScore,
      threatStateReached: i.threatStateReached,
      resolved: i.resolved,
    }))
  );
});

router.get("/incidents/:id/report", async (req, res) => {
  const parsed = GetIncidentReportParams.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });

  const [incident] = await db.select().from(incidentsTable).where(eq(incidentsTable.id, parsed.data.id)).limit(1);
  if (!incident) return res.status(404).json({ error: "Not found" });

  let timeline: Array<{ time: string; event: string; significance: string }> = [];
  let breakersTripped: string[] = [];
  let honeyfilesAccessed: string[] = [];
  try {
    timeline = JSON.parse(incident.timeline);
    breakersTripped = JSON.parse(incident.breakersTripped);
    honeyfilesAccessed = JSON.parse(incident.honeyfilesAccessed);
  } catch {}

  return res.json({
    incidentId: incident.id,
    startTime: incident.startTime.toISOString(),
    endTime: incident.endTime ? incident.endTime.toISOString() : null,
    peakRiskScore: incident.peakRiskScore,
    threatStateReached: incident.threatStateReached,
    timeline,
    breakersTripped,
    deceptionTriggered: incident.deceptionTriggered,
    honeyfilesAccessed,
    snapshotId: incident.snapshotId,
    summary: incident.summary,
  });
});

export default router;
