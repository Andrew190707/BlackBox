import { pgTable, uuid, timestamp, doublePrecision, text, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const incidentsTable = pgTable("incidents", {
  id: uuid("id").primaryKey().defaultRandom(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull().defaultNow(),
  endTime: timestamp("end_time", { withTimezone: true }),
  peakRiskScore: doublePrecision("peak_risk_score").notNull().default(0),
  threatStateReached: text("threat_state_reached").notNull().default("GREEN"),
  timeline: text("timeline").notNull().default("[]"),
  breakersTripped: text("breakers_tripped").notNull().default("[]"),
  deceptionTriggered: boolean("deception_triggered").notNull().default(false),
  honeyfilesAccessed: text("honeyfiles_accessed").notNull().default("[]"),
  snapshotId: text("snapshot_id"),
  summary: text("summary").notNull().default(""),
  resolved: boolean("resolved").notNull().default(false),
});

export const insertIncidentSchema = createInsertSchema(incidentsTable).omit({ id: true, startTime: true });
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidentsTable.$inferSelect;
