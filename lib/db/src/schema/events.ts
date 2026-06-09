import { pgTable, text, uuid, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventsTable = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  eventType: text("event_type").notNull(),
  user: text("user").notNull(),
  source: text("source").notNull(),
  details: text("details").notNull().default("{}"),
  riskDelta: doublePrecision("risk_delta").notNull().default(0),
  threatState: text("threat_state").notNull().default("GREEN"),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({ id: true, timestamp: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type SecurityEvent = typeof eventsTable.$inferSelect;
