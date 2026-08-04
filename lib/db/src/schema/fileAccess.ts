import { pgTable, text, real, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companyFilesTable = pgTable("company_files", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  path: text("path").notNull().unique(),
  department: text("department").notNull(),
  classification: text("classification").notNull(),
  sizeMb: real("size_mb").notNull(),
  owner: text("owner").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const companyUserProfilesTable = pgTable("company_user_profiles", {
  userName: text("user_name").primaryKey(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull(),
  department: text("department").notNull(),
  lastLogin: timestamp("last_login", { withTimezone: true }).notNull(),
  currentIp: text("current_ip").notNull(),
  currentLocation: text("current_location").notNull(),
  riskStatus: text("risk_status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const fileAccessGrantsTable = pgTable("file_access_grants", {
  id: text("id").primaryKey(),
  fileId: text("file_id").notNull(),
  userName: text("user_name").notNull(),
  role: text("role").notNull(),
  accessLevel: text("access_level").notNull(),
  granted: boolean("granted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const fileAccessAttemptsTable = pgTable("file_access_attempts", {
  id: text("id").primaryKey(),
  userName: text("user_name").notNull(),
  fileId: text("file_id").notNull(),
  action: text("action").notNull(),
  allowed: boolean("allowed").notNull(),
  violationType: text("violation_type"),
  device: text("device").notNull(),
  application: text("application").notNull(),
  bytesMb: real("bytes_mb").notNull().default(0),
  fileCount: integer("file_count").notNull().default(1),
  indicators: text("indicators").notNull().default("[]"),
  threatScore: real("threat_score").notNull().default(0),
  effectiveThreatScore: real("effective_threat_score").notNull().default(0),
  trustBefore: real("trust_before").notNull(),
  trustAfter: real("trust_after").notNull(),
  contained: boolean("contained").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const fileUserContainmentsTable = pgTable("file_user_containments", {
  userName: text("user_name").primaryKey(),
  active: boolean("active").notNull().default(false),
  reason: text("reason").notNull(),
  severedConnections: text("severed_connections").notNull().default("[]"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  liftedAt: timestamp("lifted_at", { withTimezone: true }),
});

export const insertCompanyFileSchema = createInsertSchema(companyFilesTable);
export type CompanyFile = typeof companyFilesTable.$inferSelect;
export type CompanyUserProfile = typeof companyUserProfilesTable.$inferSelect;
export type FileAccessGrant = typeof fileAccessGrantsTable.$inferSelect;
export type FileAccessAttempt = typeof fileAccessAttemptsTable.$inferSelect;
export type FileUserContainment = typeof fileUserContainmentsTable.$inferSelect;
export type InsertCompanyFile = z.infer<typeof insertCompanyFileSchema>;