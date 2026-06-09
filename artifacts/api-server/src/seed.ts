import { db } from "@workspace/db";
import { eventsTable, incidentsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./lib/logger";
import { v4 as uuidv4 } from "uuid";

const SEED_USERS = ["admin", "analyst", "hr_admin", "dev_lead", "ceo", "unknown_user"];
const SEED_FILES = [
  "/var/data/customer_db.sql",
  "/etc/payroll_data.csv",
  "/src/core/auth.ts",
  "/docs/executive_strategy.docx",
  "/var/log/access.log",
  "/home/admin/.ssh/id_rsa",
];
const SEED_PROCESSES = ["python3", "node", "bash", "scp", "curl"];
const EVENT_TYPES = ["FILE_ACCESS", "FILE_MODIFY", "FILE_CREATE", "PROCESS_CREATE", "LOGIN", "FILE_DELETE"];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3600 * 1000);
}

export async function seedData() {
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(eventsTable);
  if (Number(count) > 0) {
    logger.info({ count }, "DB already seeded, skipping");
    return;
  }

  logger.info("Seeding initial BlackBox data...");

  const seedEvents = [];
  for (let i = 0; i < 50; i++) {
    const eventType = rand(EVENT_TYPES);
    const isProcess = eventType === "PROCESS_CREATE";
    const source = isProcess ? rand(SEED_PROCESSES) : rand(SEED_FILES);
    const hoursBack = 48 - i * 0.8;
    const riskDelta = eventType === "FILE_DELETE" ? 5 : eventType === "PROCESS_CREATE" ? 2 : 0.5;

    seedEvents.push({
      id: uuidv4(),
      timestamp: hoursAgo(hoursBack),
      eventType,
      user: rand(SEED_USERS),
      source,
      details: JSON.stringify({ seed: true, batch: Math.floor(i / 10) }),
      riskDelta,
      threatState: i < 30 ? "GREEN" : i < 40 ? "YELLOW" : "ORANGE",
    });
  }

  for (const evt of seedEvents) {
    await db.insert(eventsTable).values(evt);
  }

  const pastIncidentId = uuidv4();
  await db.insert(incidentsTable).values({
    id: pastIncidentId,
    startTime: hoursAgo(24),
    endTime: hoursAgo(23),
    peakRiskScore: 78,
    threatStateReached: "ORANGE",
    timeline: JSON.stringify([
      { time: hoursAgo(24).toISOString(), event: "Unusual file access pattern detected", significance: "medium" },
      { time: hoursAgo(23.8).toISOString(), event: "Multiple LOGIN attempts from unknown_user", significance: "high" },
      { time: hoursAgo(23.5).toISOString(), event: "Risk score reached YELLOW (45)", significance: "medium" },
      { time: hoursAgo(23.2).toISOString(), event: "Bulk FILE_ACCESS — 50 files in 5 minutes", significance: "high" },
      { time: hoursAgo(23).toISOString(), event: "Incident contained — risk stabilized at 78", significance: "medium" },
    ]),
    breakersTripped: JSON.stringify(["uploads"]),
    deceptionTriggered: false,
    honeyfilesAccessed: JSON.stringify([]),
    snapshotId: null,
    summary: "Anomalous file access by unknown_user 24 hours ago. Risk reached ORANGE (78). uploads circuit breaker auto-tripped. Incident resolved without lockdown.",
    resolved: true,
  });

  logger.info("Seed complete: 50 events + 1 historical incident");
}
