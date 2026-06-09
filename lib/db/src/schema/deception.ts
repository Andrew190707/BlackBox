import { pgTable, uuid, timestamp, text, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const deceptionAssetsTable = pgTable("deception_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(),
  path: text("path").notNull(),
  deployed: boolean("deployed").notNull().default(false),
  triggered: boolean("triggered").notNull().default(false),
  triggeredAt: timestamp("triggered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDeceptionAssetSchema = createInsertSchema(deceptionAssetsTable).omit({ id: true, createdAt: true });
export type InsertDeceptionAsset = z.infer<typeof insertDeceptionAssetSchema>;
export type DeceptionAsset = typeof deceptionAssetsTable.$inferSelect;
