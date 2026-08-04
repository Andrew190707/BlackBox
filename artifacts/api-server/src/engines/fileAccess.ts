import { db } from "@workspace/db";
import {
  companyFilesTable,
  companyUserProfilesTable,
  fileAccessAttemptsTable,
  fileAccessGrantsTable,
  fileUserContainmentsTable,
  trustEdgesTable,
  trustNodesTable,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { broadcast } from "./websocket";
import { blackBoxState } from "./state";
import { logEvent } from "./flightRecorder";
import { logger } from "../lib/logger";

export const TRUST_BASELINE = 70;
export const TRUST_CONTAINMENT_THRESHOLD = 45;
export const EFFECTIVE_THREAT_THRESHOLD = 80;

const GAMMA = 0.85;
const BETA = 4;
const KAPPA = 0.6;
const REWARD_RATE = 0.08;
const LAMBDA = 0.05;
const PENALTY_RATE: Record<string, number> = {
  unauthorized_access: 12,
  action_not_permitted: 14,
  restricted_download: 10,
  restricted_copy: 12,
  restricted_share: 16,
  top_secret_access: 20,
  mass_download: 10,
  multi_file_access: 8,
  unknown_device: 5,
  odd_hour: 3,
  blocked_user: 18,
};
const INDICATOR_WEIGHT: Record<string, number> = {
  unauthorized_access: 22,
  action_not_permitted: 24,
  restricted_download: 20,
  restricted_copy: 24,
  restricted_share: 28,
  top_secret_access: 32,
  mass_download: 28,
  multi_file_access: 18,
  unknown_device: 12,
  odd_hour: 10,
  blocked_user: 35,
};
const CRITICALITY_COST: Record<string, number> = {
  PUBLIC: 1,
  INTERNAL: 1.5,
  CONFIDENTIAL: 2,
  RESTRICTED: 2.5,
  CRITICAL: 3,
  "TOP SECRET": 4,
};
const ROLE_ORDER = ["admin", "analyst", "dev_lead", "hr_admin", "cfo", "ceo", "unknown_user", "attacker"];

type AccessInput = {
  userName: string;
  fileId: string;
  action: string;
  device?: string;
  application?: string;
  bytesMb?: number;
  fileCount?: number;
};

type ThreatMemory = { score: number; lastActivity: number };
const threatMemory = new Map<string, ThreatMemory>();

function clip(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function isOddHour() {
  const hour = new Date().getHours();
  return hour < 6 || hour >= 22;
}

function isActionPermitted(accessLevel: string | undefined, action: string) {
  if (!accessLevel || accessLevel === "DENIED") return false;
  if (action === "READ" || action === "VIEW") return true;
  if (action === "DOWNLOAD") return ["READ", "READ_WRITE", "FULL"].includes(accessLevel);
  if (action === "COPY" || action === "SHARE") return ["READ_WRITE", "FULL"].includes(accessLevel);
  return false;
}

function deriveIndicators(input: AccessInput, file: typeof companyFilesTable.$inferSelect, granted: boolean, contained: boolean) {
  const indicators: string[] = [];
  if (!granted) indicators.push("unauthorized_access");
  if (contained) indicators.push("blocked_user");
  if (!granted && input.action === "DOWNLOAD") indicators.push("restricted_download");
  if (!granted && input.action === "COPY") indicators.push("restricted_copy");
  if (!granted && input.action === "SHARE") indicators.push("restricted_share");
  if (!granted && file.classification === "TOP SECRET") indicators.push("top_secret_access");
  if ((input.bytesMb ?? 0) >= 100 || (input.fileCount ?? 1) >= 10 || input.action === "MASS_DOWNLOAD") {
    indicators.push("mass_download");
  }
  if ((input.fileCount ?? 1) >= 3 || input.action === "MULTI_FILE_ACCESS") {
    indicators.push("multi_file_access");
  }
  if (input.device === "UNKNOWN-DEVICE") indicators.push("unknown_device");
  if (isOddHour()) indicators.push("odd_hour");
  return [...new Set(indicators)].filter((indicator) => indicator !== "odd_hour" || !granted);
}

function roleForUser(userName: string) {
  if (userName === "admin") return "admin";
  if (userName === "ceo") return "ceo";
  if (userName === "cfo") return "cfo";
  if (userName === "hr_admin") return "hr_admin";
  if (userName === "dev_lead") return "dev_lead";
  if (userName === "analyst") return "analyst";
  return "untrusted";
}

function grantForFile(userName: string, file: typeof companyFilesTable.$inferSelect) {
  const role = roleForUser(userName);
  const name = file.name.toLowerCase();
  if (role === "admin") return { role, accessLevel: "FULL", granted: true };
  if (role === "ceo") {
    const granted = !name.includes("auth-service") && !name.includes("firewall") && !name.includes("payroll");
    return { role, accessLevel: granted ? "READ" : "DENIED", granted };
  }
  if (role === "analyst") {
    const granted = name.includes("access-audit") || name.includes("security") || name.includes("threat") || name.includes("incident") || file.name.toLowerCase().includes("log");
    return { role, accessLevel: granted ? "READ" : "DENIED", granted };
  }
  if (role === "hr_admin") {
    const granted = name.includes("payroll") || name.includes("salary") || name.includes("employee") || name.includes("policy");
    return { role, accessLevel: granted ? "READ_WRITE" : "DENIED", granted };
  }
  if (role === "dev_lead") {
    const granted = name.includes("source") || name.includes("code") || name.includes("dev-doc") || name.includes("roadmap") || name.includes("firewall");
    return { role, accessLevel: granted ? "READ_WRITE" : "DENIED", granted };
  }
  if (role === "cfo") {
    const granted = name.includes("financial") || name.includes("salary") || name.includes("payroll") || name.includes("vendor") || name.includes("audit");
    return { role, accessLevel: granted ? "READ" : "DENIED", granted };
  }
  return { role, accessLevel: "DENIED", granted: false };
}

export async function seedFileAccessData() {
  const seededUserProfiles = [
    ["admin", 100, "NORMAL"],
    ["analyst", 98, "NORMAL"],
    ["hr_admin", 95, "NORMAL"],
    ["dev_lead", 97, "NORMAL"],
    ["ceo", 99, "NORMAL"],
    ["cfo", 99, "NORMAL"],
    ["unknown_user", 70, "DEGRADED"],
    ["attacker", 100, "NORMAL"],
  ] as const;
  for (const [name, trustScore, riskState] of seededUserProfiles) {
    const [existingUser] = await db
      .select({ id: trustNodesTable.id })
      .from(trustNodesTable)
      .where(and(eq(trustNodesTable.type, "USER"), eq(trustNodesTable.name, name)))
      .limit(1);
    if (existingUser) continue;
    await db.insert(trustNodesTable).values({
      id: `user-${name}`,
      type: "USER",
      name,
      trustScore,
      classification: null,
      riskState,
    }).onConflictDoNothing();
  }

  const files = [
    ["file-board-strategy", "Board Strategy FY27.docx", "/company/executive/board-strategy-fy27.docx", "Executive", "CONFIDENTIAL", 2.4, "ceo", "Annual strategy, board decisions, and long-range operating priorities."],
    ["file-customer-master", "Customer Master Export.csv", "/company/sales/customer-master-export.csv", "Sales", "CONFIDENTIAL", 84, "admin", "Customer identities, account metadata, and lifecycle status."],
    ["file-employee-payroll", "Employee Payroll 2026.xlsx", "/company/hr/employee-payroll-2026.xlsx", "Human Resources", "CRITICAL", 12.8, "hr_admin", "Compensation, tax, and payment details for active employees."],
    ["file-auth-service", "Auth Service Source.ts", "/company/engineering/auth-service.ts", "Engineering", "CRITICAL", 0.18, "dev_lead", "Authentication service source code and session policy implementation."],
    ["file-access-audit", "Access Audit Log.log", "/company/security/access-audit.log", "Security", "INTERNAL", 236, "admin", "Immutable file access, policy decisions, and containment audit trail."],
    ["file-firewall-config", "Network Firewall Config.conf", "/company/security/network-firewall.conf", "Security", "CONFIDENTIAL", 0.06, "admin", "Production network segmentation and egress control configuration."],
    ["file-quarterly-financials", "Quarterly Financials Q2.xlsx", "/company/finance/quarterly-financials-q2.xlsx", "Finance", "CONFIDENTIAL", 4.6, "cfo", "Management accounts, forecast variance, and cash planning workbook."],
    ["file-product-roadmap", "Product Roadmap H2.pptx", "/company/product/product-roadmap-h2.pptx", "Product", "INTERNAL", 8.1, "dev_lead", "Upcoming releases, dependencies, and launch sequencing."],
    ["file-vendor-contracts", "Vendor Contracts Register.pdf", "/company/legal/vendor-contracts-register.pdf", "Legal", "CONFIDENTIAL", 18.2, "cfo", "Renewal dates, service terms, and commercial obligations."],
    ["file-brand-guidelines", "Public Brand Guidelines.pdf", "/company/marketing/public-brand-guidelines.pdf", "Marketing", "PUBLIC", 6.3, "admin", "Approved public identity, logo, and communications guidance."],
    ["file-financial-report", "Financial_Report_2026.xlsx", "/company/finance/financial-report-2026.xlsx", "Finance", "CONFIDENTIAL", 5.2, "cfo", "Annual revenue, margin, forecast, and operating performance."],
    ["file-employee-salaries", "Employee_Salaries.xlsx", "/company/hr/employee-salaries.xlsx", "Human Resources", "RESTRICTED", 3.8, "hr_admin", "Individual compensation bands and salary history."],
    ["file-payroll", "Payroll.pdf", "/company/hr/payroll.pdf", "Human Resources", "RESTRICTED", 9.4, "hr_admin", "Payroll processing summary and payment controls."],
    ["file-soc-logs", "SOC_Logs.zip", "/company/security/soc-logs.zip", "Security", "INTERNAL", 480, "analyst", "Security operations alerts, triage, and analyst notes."],
    ["file-incident-report", "Incident_Report.pdf", "/company/security/incident-report.pdf", "Security", "CONFIDENTIAL", 2.1, "analyst", "Post-incident findings, evidence, and remediation plan."],
    ["file-customer-database", "Customer_Database.sql", "/company/sales/customer-database.sql", "Sales", "RESTRICTED", 920, "admin", "Customer records and account-level data export."],
    ["file-hr-employees", "HR_Employees.docx", "/company/hr/hr-employees.docx", "Human Resources", "CONFIDENTIAL", 1.4, "hr_admin", "Employee directory and workforce records."],
    ["file-source-code", "Source_Code.zip", "/company/engineering/source-code.zip", "Engineering", "RESTRICTED", 740, "dev_lead", "Product source tree and build configuration."],
    ["file-api-keys", "API_Keys.txt", "/company/engineering/api-keys.txt", "Engineering", "TOP SECRET", 0.01, "admin", "Production API credentials and rotation notes."],
    ["file-dev-docs", "Dev_Docs.pdf", "/company/engineering/dev-docs.pdf", "Engineering", "INTERNAL", 12.5, "dev_lead", "Architecture and developer onboarding documentation."],
    ["file-threat-intelligence", "Threat_Intelligence.pdf", "/company/security/threat-intelligence.pdf", "Security", "CONFIDENTIAL", 7.8, "analyst", "Threat actor profiles, indicators, and intelligence assessments."],
    ["file-network-diagram", "Network_Diagram.vsdx", "/company/security/network-diagram.vsdx", "Security", "RESTRICTED", 4.2, "admin", "Production network topology and trust boundaries."],
    ["file-cloud-credentials", "Cloud_Credentials.json", "/company/cloud/cloud-credentials.json", "Infrastructure", "TOP SECRET", 0.02, "admin", "Cloud service principals and emergency access material."],
    ["file-security-policies", "Security_Policies.pdf", "/company/security/security-policies.pdf", "Security", "INTERNAL", 3.2, "admin", "Corporate security standards and acceptable-use policies."],
    ["file-executive-strategy", "Executive_Strategy.pdf", "/company/executive/executive-strategy.pdf", "Executive", "CONFIDENTIAL", 6.7, "ceo", "Executive priorities, market strategy, and board commitments."],
    ["file-audit-report", "Audit_Report.pdf", "/company/finance/audit-report.pdf", "Finance", "CONFIDENTIAL", 2.8, "cfo", "External audit findings and control attestations."],
    ["file-vpn-config", "VPN_Config.ovpn", "/company/security/vpn-config.ovpn", "Security", "RESTRICTED", 0.03, "admin", "Remote access configuration and certificate references."],
    ["file-pci-compliance", "PCI_Compliance.pdf", "/company/compliance/pci-compliance.pdf", "Compliance", "CONFIDENTIAL", 8.9, "cfo", "Payment-card compliance evidence and control mappings."],
    ["file-production-backup", "Production_Backup.tar", "/company/infrastructure/production-backup.tar", "Infrastructure", "TOP SECRET", 2400, "admin", "Encrypted production backup archive."],
  ] as const;

  for (const [id, name, path, department, classification, sizeMb, owner, description] of files) {
    await db.insert(companyFilesTable).values({ id, name, path, department, classification, sizeMb, owner, description }).onConflictDoNothing();
  }

  const currentUsers = await db.select({ name: trustNodesTable.name }).from(trustNodesTable).where(eq(trustNodesTable.type, "USER"));
  const userNames = [...new Set([...currentUsers.map((user) => user.name), ...ROLE_ORDER])];
  const storedFiles = await db.select().from(companyFilesTable);
  for (const userName of userNames) {
    for (const file of storedFiles) {
      const grant = grantForFile(userName, file);
      await db.insert(fileAccessGrantsTable).values({
        id: `grant-${userName}-${file.id}`,
        fileId: file.id,
        userName,
        role: grant.role,
        accessLevel: grant.accessLevel,
        granted: grant.granted,
      }).onConflictDoNothing();
    }
    await db.insert(fileUserContainmentsTable).values({
      userName,
      active: false,
      reason: "No active containment",
      severedConnections: "[]",
    }).onConflictDoNothing();
  }
  const profiles = [
    ["admin", "Admin", "Administrator", "IT & Governance", "10.0.0.10", "New York, US", "TRUSTED"],
    ["analyst", "SOC Analyst", "Security Operations", "Security", "10.0.0.21", "Austin, US", "TRUSTED"],
    ["dev_lead", "Security Engineer", "Security Engineering", "Security", "10.0.0.32", "Seattle, US", "TRUSTED"],
    ["hr_admin", "HR Manager", "Human Resources", "Human Resources", "10.0.0.44", "Chicago, US", "TRUSTED"],
    ["cfo", "Finance Manager", "Finance", "Finance", "10.0.0.51", "New York, US", "TRUSTED"],
    ["ceo", "Executive", "Executive Leadership", "Executive", "10.0.0.5", "New York, US", "TRUSTED"],
    ["unknown_user", "Intern", "Internship Program", "People Operations", "10.0.0.77", "Boston, US", "ELEVATED"],
    ["attacker", "Guest", "External Access", "Unassigned", "203.0.113.44", "Unknown", "COMPROMISED"],
  ] as const;
  for (const [userName, displayName, role, department, currentIp, currentLocation, riskStatus] of profiles) {
    await db.insert(companyUserProfilesTable).values({
      userName,
      displayName,
      role,
      department,
      lastLogin: new Date(),
      currentIp,
      currentLocation,
      riskStatus,
    }).onConflictDoNothing();
  }
  await db.update(companyUserProfilesTable)
    .set({ riskStatus: "TRUSTED" })
    .where(eq(companyUserProfilesTable.userName, "attacker"));
  logger.info({ files: storedFiles.length, users: userNames.length }, "File access dataset seeded");
}

export async function getFileAccessPolicy() {
  const [files, grants, containments, attempts, profiles, nodes] = await Promise.all([
    db.select().from(companyFilesTable).orderBy(companyFilesTable.classification, companyFilesTable.name),
    db.select().from(fileAccessGrantsTable),
    db.select().from(fileUserContainmentsTable),
    db.select().from(fileAccessAttemptsTable).orderBy(desc(fileAccessAttemptsTable.createdAt)).limit(25),
    db.select().from(companyUserProfilesTable),
    db.select({ name: trustNodesTable.name, trustScore: trustNodesTable.trustScore, riskState: trustNodesTable.riskState }).from(trustNodesTable).where(eq(trustNodesTable.type, "USER")),
  ]);
  const users = [...new Set(grants.map((grant) => grant.userName))].sort(
    (a, b) => (ROLE_ORDER.indexOf(a) === -1 ? 99 : ROLE_ORDER.indexOf(a)) - (ROLE_ORDER.indexOf(b) === -1 ? 99 : ROLE_ORDER.indexOf(b)),
  );
  return {
    files,
    grants,
    containments,
    attempts,
    users,
    profiles: profiles.map((profile) => {
      const node = nodes.find((candidate) => candidate.name === profile.userName);
      return { ...profile, trustScore: node?.trustScore ?? TRUST_BASELINE, riskStatus: node?.riskState ?? profile.riskStatus };
    }),
    scoring: {
      trustBaseline: TRUST_BASELINE,
      trustContainmentThreshold: TRUST_CONTAINMENT_THRESHOLD,
      effectiveThreatThreshold: EFFECTIVE_THREAT_THRESHOLD,
      gamma: GAMMA,
      beta: BETA,
      kappa: KAPPA,
      rewardRate: REWARD_RATE,
      lambda: LAMBDA,
      penaltyRates: PENALTY_RATE,
      criticalityCosts: CRITICALITY_COST,
    },
  };
}

async function severUserTrustPaths(userName: string) {
  const nodes = await db.select().from(trustNodesTable);
  const userNode = nodes.find((node) => node.type === "USER" && node.name === userName);
  if (!userNode) return [];
  const component = new Set([userNode.id]);
  let changed = true;
  while (changed) {
    changed = false;
    const edges = await db.select().from(trustEdgesTable);
    for (const edge of edges) {
      if (component.has(edge.fromNodeId) || component.has(edge.toNodeId)) {
        const before = component.size;
        component.add(edge.fromNodeId);
        component.add(edge.toNodeId);
        changed ||= component.size !== before;
      }
    }
  }
  const edges = await db.select().from(trustEdgesTable);
  const affected = edges.filter((edge) => component.has(edge.fromNodeId) && component.has(edge.toNodeId) && !edge.severed);
  for (const edge of affected) {
    await db.update(trustEdgesTable).set({ severed: true, severedAt: new Date() }).where(eq(trustEdgesTable.id, edge.id));
  }
  return affected.map((edge) => edge.id);
}

async function containUser(userName: string, reason: string) {
  const severedConnections = await severUserTrustPaths(userName);
  await db.update(trustNodesTable).set({ riskState: "COMPROMISED" }).where(and(eq(trustNodesTable.type, "USER"), eq(trustNodesTable.name, userName)));
  await db.update(fileUserContainmentsTable).set({
    active: true,
    reason,
    severedConnections: JSON.stringify(severedConnections),
    startedAt: new Date(),
    liftedAt: null,
  }).where(eq(fileUserContainmentsTable.userName, userName));
  blackBoxState.userTrustScores[userName] = 0;
  broadcast("USER_CONTAINED", { userName, reason, severedConnections });
  broadcast("TRUST_UPDATE", { type: "USER_CONTAINED", userName, severedConnections });
  return severedConnections;
}

export async function evaluateFileAccess(input: AccessInput) {
  const [file] = await db.select().from(companyFilesTable).where(eq(companyFilesTable.id, input.fileId)).limit(1);
  if (!file) return { status: 404 as const, error: "File not found" };
  const [grant] = await db.select().from(fileAccessGrantsTable).where(and(eq(fileAccessGrantsTable.fileId, input.fileId), eq(fileAccessGrantsTable.userName, input.userName))).limit(1);
  const [containment] = await db.select().from(fileUserContainmentsTable).where(eq(fileUserContainmentsTable.userName, input.userName)).limit(1);
  const trustBefore = blackBoxState.userTrustScores[input.userName] ?? TRUST_BASELINE;
  const grantExists = Boolean(grant?.granted);
  const actionPermitted = isActionPermitted(grant?.accessLevel, input.action);
  const granted = grantExists && actionPermitted && !containment?.active;
  const indicators = deriveIndicators(input, file, granted, Boolean(containment?.active));
  if (grantExists && !actionPermitted && !containment?.active) indicators.push("action_not_permitted");
  const prior = threatMemory.get(input.userName) ?? { score: 0, lastActivity: Date.now() };
  const threatScore = GAMMA * prior.score + indicators.reduce((sum, indicator) => sum + (INDICATOR_WEIGHT[indicator] ?? 0), 0) + BETA * (2 ** indicators.length);
  const effectiveThreatScore = threatScore * (1 + KAPPA * (1 - trustBefore / 100));
  const criticalityCost = CRITICALITY_COST[file.classification] ?? 1;
  const penalty = indicators.reduce((sum, indicator) => sum + (PENALTY_RATE[indicator] ?? 0) * criticalityCost, 0);
  const reward = granted && indicators.length === 0 ? REWARD_RATE : 0;
  const idle = indicators.length === 0 && Date.now() - prior.lastActivity > 30 * 60 * 1000;
  const trustAfter = clip(trustBefore + reward * (1 - trustBefore / 100) - penalty - LAMBDA * (trustBefore - TRUST_BASELINE) * (idle ? 1 : 0));
  const suspicious = indicators.length > 0 || effectiveThreatScore >= EFFECTIVE_THREAT_THRESHOLD;
  const shouldContain = !granted || suspicious
    ? trustAfter <= TRUST_CONTAINMENT_THRESHOLD || effectiveThreatScore >= EFFECTIVE_THREAT_THRESHOLD
    : false;

  threatMemory.set(input.userName, { score: threatScore, lastActivity: Date.now() });
  blackBoxState.userTrustScores[input.userName] = trustAfter;
  await db.update(trustNodesTable).set({
    trustScore: trustAfter,
    riskState: shouldContain ? "COMPROMISED" : trustAfter < 70 ? "DEGRADED" : "NORMAL",
  }).where(and(eq(trustNodesTable.type, "USER"), eq(trustNodesTable.name, input.userName)));

  const contained = shouldContain ? await containUser(input.userName, `File access policy threshold reached: trust ${trustAfter.toFixed(1)}, effective threat ${effectiveThreatScore.toFixed(1)}`) : [];
  const allowed = granted && indicators.filter((indicator) => indicator !== "odd_hour").length === 0 && !shouldContain;
  const violationType = indicators.length ? indicators.join(",") : null;
  const [attempt] = await db.insert(fileAccessAttemptsTable).values({
    id: uuidv4(),
    userName: input.userName,
    fileId: input.fileId,
    action: input.action,
    allowed,
    violationType,
    device: input.device ?? "WKSTN-ADMIN-01",
    application: input.application ?? "File Explorer",
    bytesMb: input.bytesMb ?? file.sizeMb,
    fileCount: input.fileCount ?? 1,
    indicators: JSON.stringify(indicators),
    threatScore,
    effectiveThreatScore,
    trustBefore,
    trustAfter,
    contained: contained.length > 0 || Boolean(containment?.active),
  }).returning();

  if (indicators.length > 0) {
    await logEvent({
      eventType: shouldContain ? "USER_CONTAINED" : "FILE_ACCESS_VIOLATION",
      user: input.userName,
      source: file.path,
      details: { file: file.name, indicators, threatScore, effectiveThreatScore, trustBefore, trustAfter, contained: shouldContain },
      riskDeltaOverride: Math.min(20, Math.max(2, effectiveThreatScore / 10)),
    });
  } else {
    await logEvent({
      eventType: "FILE_ACCESS_ALLOWED",
      user: input.userName,
      source: file.path,
      details: { file: file.name, accessLevel: grant?.accessLevel ?? "DENIED" },
      riskDeltaOverride: 0,
    });
  }
  broadcast("FILE_ACCESS_DECISION", { attempt, file, allowed, indicators, contained: contained.length > 0 });
  return {
    status: 200 as const,
    allowed,
    file,
    grant: grant ?? null,
    attempt,
    indicators,
    contained: contained.length > 0 || Boolean(containment?.active),
    message: allowed ? `${input.userName} access approved for ${file.name}` : `${input.userName} access denied and flagged: ${violationType ?? "contained user"}`,
  };
}
