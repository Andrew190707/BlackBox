import { pgTable, uuid, timestamp, doublePrecision, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const snapshotsTable = pgTable("snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  triggerRiskScore: doublePrecision("trigger_risk_score").notNull().default(0),
  memorySnapshot: text("memory_snapshot").notNull().default("{}"),
  networkSnapshot: text("network_snapshot").notNull().default("{}"),
  fileSnapshot: text("file_snapshot").notNull().default("{}"),
  userSnapshot: text("user_snapshot").notNull().default("{}"),
});

export const insertSnapshotSchema = createInsertSchema(snapshotsTable).omit({ id: true, timestamp: true });
export type InsertSnapshot = z.infer<typeof insertSnapshotSchema>;
export type Snapshot = typeof snapshotsTable.$inferSelect;
