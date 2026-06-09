import { pgTable, text, real, boolean, timestamp } from "drizzle-orm/pg-core";

export const trustNodesTable = pgTable("trust_nodes", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  trustScore: real("trust_score").notNull().default(100),
  classification: text("classification"),
  riskState: text("risk_state").notNull().default("NORMAL"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const trustEdgesTable = pgTable("trust_edges", {
  id: text("id").primaryKey(),
  fromNodeId: text("from_node_id").notNull(),
  toNodeId: text("to_node_id").notNull(),
  trustScore: real("trust_score").notNull().default(100),
  severed: boolean("severed").notNull().default(false),
  severedAt: timestamp("severed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type TrustNode = typeof trustNodesTable.$inferSelect;
export type TrustEdge = typeof trustEdgesTable.$inferSelect;
