import { db } from "@workspace/db";
import { snapshotsTable, eventsTable } from "@workspace/db";
import { blackBoxState } from "./state";
import { logger } from "../lib/logger";
import { v4 as uuidv4 } from "uuid";
import { desc, eq } from "drizzle-orm";
import os from "os";

export async function takeSnapshot(triggerRiskScore: number): Promise<string> {
  const id = uuidv4();

  const recentModified = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.eventType, "FILE_MODIFY"))
    .orderBy(desc(eventsTable.timestamp))
    .limit(50);

  const recentDeleted = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.eventType, "FILE_DELETE"))
    .orderBy(desc(eventsTable.timestamp))
    .limit(20);

  const memorySnapshot = JSON.stringify({
    running_processes: [
      { pid: process.pid, name: "node", memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) },
      { pid: 1001, name: "postgres", memory_mb: 45 },
      { pid: 1042, name: "nginx", memory_mb: 12 },
    ],
    process_count: 3,
    memory_usage_mb: Math.round(os.totalmem() / 1024 / 1024),
    free_memory_mb: Math.round(os.freemem() / 1024 / 1024),
  });

  const networkSnapshot = JSON.stringify({
    active_connections: [
      { local: "0.0.0.0:5000", remote: "192.168.1.50:54321", state: "ESTABLISHED" },
      { local: "0.0.0.0:5000", remote: "192.168.99.200:33891", state: "ESTABLISHED" },
      { local: "127.0.0.1:5432", remote: "127.0.0.1:51234", state: "ESTABLISHED" },
    ],
    open_ports: [5000, 5432, 80, 443],
    suspicious_connections: [{ remote: "192.168.99.200:33891", note: "Unknown external host" }],
  });

  const fileSnapshot = JSON.stringify({
    recently_modified: recentModified.map((e) => ({
      path: e.source,
      user: e.user,
      timestamp: e.timestamp,
    })),
    recently_deleted: recentDeleted.map((e) => ({
      path: e.source,
      user: e.user,
      timestamp: e.timestamp,
    })),
  });

  const userSnapshot = JSON.stringify({
    active_users: Object.keys(blackBoxState.userTrustScores),
    trust_scores: blackBoxState.userTrustScores,
  });

  await db.insert(snapshotsTable).values({
    id,
    triggerRiskScore,
    memorySnapshot,
    networkSnapshot,
    fileSnapshot,
    userSnapshot,
  });

  logger.info({ snapshotId: id, triggerRiskScore }, "Forensic snapshot taken");
  return id;
}
