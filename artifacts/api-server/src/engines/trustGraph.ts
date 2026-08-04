import { db } from "@workspace/db";
import { trustNodesTable, trustEdgesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { broadcast } from "./websocket";
import { logger } from "../lib/logger";

export async function seedTrustGraph(): Promise<void> {
  const existing = await db.select().from(trustNodesTable).limit(1);
  if (existing.length > 0) {
    await ensureGuestTrustConnections();
    return;
  }

  const nodes = [
    { id: uuidv4(), type: "USER",        name: "admin",              trustScore: 100, classification: null,         riskState: "NORMAL" },
    { id: uuidv4(), type: "USER",        name: "analyst",            trustScore: 98,  classification: null,         riskState: "NORMAL" },
    { id: uuidv4(), type: "USER",        name: "dev_lead",            trustScore: 97,  classification: null,         riskState: "NORMAL" },
    { id: uuidv4(), type: "USER",        name: "hr_admin",           trustScore: 95,  classification: null,         riskState: "NORMAL" },
    { id: uuidv4(), type: "USER",        name: "cfo",                 trustScore: 99,  classification: null,         riskState: "NORMAL" },
    { id: uuidv4(), type: "USER",        name: "ceo",                 trustScore: 99,  classification: null,         riskState: "NORMAL" },
    { id: uuidv4(), type: "USER",        name: "unknown_user",       trustScore: 70,  classification: null,         riskState: "DEGRADED" },
    { id: uuidv4(), type: "USER",        name: "attacker",           trustScore: 100, classification: null,         riskState: "NORMAL" },
    { id: uuidv4(), type: "DEVICE",      name: "WKSTN-ADMIN-01",     trustScore: 100, classification: null,         riskState: "NORMAL" },
    { id: uuidv4(), type: "DEVICE",      name: "WKSTN-ANALYST-02",   trustScore: 95,  classification: null,         riskState: "NORMAL" },
    { id: uuidv4(), type: "DEVICE",      name: "UNKNOWN-DEVICE",     trustScore: 40,  classification: null,         riskState: "COMPROMISED" },
    { id: uuidv4(), type: "APPLICATION", name: "Excel",              trustScore: 100, classification: null,         riskState: "NORMAL" },
    { id: uuidv4(), type: "APPLICATION", name: "SSH Client",         trustScore: 88,  classification: null,         riskState: "DEGRADED" },
    { id: uuidv4(), type: "APPLICATION", name: "cmd.exe",            trustScore: 50,  classification: null,         riskState: "COMPROMISED" },
    { id: uuidv4(), type: "ASSET",       name: "Payroll_2026.xlsx",  trustScore: 100, classification: "CRITICAL",   riskState: "NORMAL" },
    { id: uuidv4(), type: "ASSET",       name: "CustomerDatabase.db",trustScore: 100, classification: "CRITICAL",   riskState: "NORMAL" },
    { id: uuidv4(), type: "ASSET",       name: "/etc/shadow",        trustScore: 100, classification: "CRITICAL",   riskState: "COMPROMISED" },
    { id: uuidv4(), type: "ASSET",       name: "EmployeeHandbook.pdf",trustScore: 100,classification: "INTERNAL",   riskState: "NORMAL" },
    { id: uuidv4(), type: "ASSET",       name: "AWS_AccessKeys.csv", trustScore: 100, classification: "CRITICAL",   riskState: "NORMAL" },
  ];

  await db.insert(trustNodesTable).values(nodes);

  const m = Object.fromEntries(nodes.map((n) => [n.name, n.id]));

  const edges = [
    { id: uuidv4(), fromNodeId: m["admin"],        toNodeId: m["WKSTN-ADMIN-01"],      trustScore: 100, severed: false, severedAt: null },
    { id: uuidv4(), fromNodeId: m["WKSTN-ADMIN-01"],toNodeId: m["Excel"],              trustScore: 100, severed: false, severedAt: null },
    { id: uuidv4(), fromNodeId: m["Excel"],         toNodeId: m["Payroll_2026.xlsx"],   trustScore: 100, severed: false, severedAt: null },
    { id: uuidv4(), fromNodeId: m["Excel"],         toNodeId: m["AWS_AccessKeys.csv"],  trustScore: 80,  severed: false, severedAt: null },
    { id: uuidv4(), fromNodeId: m["analyst"],       toNodeId: m["WKSTN-ANALYST-02"],    trustScore: 95,  severed: false, severedAt: null },
    { id: uuidv4(), fromNodeId: m["WKSTN-ANALYST-02"],toNodeId: m["SSH Client"],        trustScore: 90,  severed: false, severedAt: null },
    { id: uuidv4(), fromNodeId: m["dev_lead"],       toNodeId: m["SSH Client"],          trustScore: 95,  severed: false, severedAt: null },
    { id: uuidv4(), fromNodeId: m["SSH Client"],    toNodeId: m["CustomerDatabase.db"], trustScore: 88,  severed: false, severedAt: null },
    { id: uuidv4(), fromNodeId: m["cfo"],           toNodeId: m["Excel"],               trustScore: 95,  severed: false, severedAt: null },
    { id: uuidv4(), fromNodeId: m["ceo"],           toNodeId: m["Excel"],               trustScore: 95,  severed: false, severedAt: null },
    { id: uuidv4(), fromNodeId: m["hr_admin"],      toNodeId: m["WKSTN-ADMIN-01"],      trustScore: 90,  severed: false, severedAt: null },
    { id: uuidv4(), fromNodeId: m["hr_admin"],      toNodeId: m["Excel"],               trustScore: 90,  severed: false, severedAt: null },
    { id: uuidv4(), fromNodeId: m["unknown_user"],  toNodeId: m["UNKNOWN-DEVICE"],      trustScore: 40,  severed: false, severedAt: null },
    { id: uuidv4(), fromNodeId: m["UNKNOWN-DEVICE"],toNodeId: m["cmd.exe"],             trustScore: 40,  severed: false, severedAt: null },
    { id: uuidv4(), fromNodeId: m["cmd.exe"],       toNodeId: m["/etc/shadow"],         trustScore: 30,  severed: false, severedAt: null },
    { id: uuidv4(), fromNodeId: m["attacker"],      toNodeId: m["UNKNOWN-DEVICE"],      trustScore: 100, severed: false, severedAt: null },
    { id: uuidv4(), fromNodeId: m["cmd.exe"],       toNodeId: m["AWS_AccessKeys.csv"],  trustScore: 25,  severed: false, severedAt: null },
  ];

  await db.insert(trustEdgesTable).values(edges);
  await ensureGuestTrustConnections();
  logger.info("Trust graph seeded");
}

async function ensureGuestTrustConnections() {
  const nodes = await db.select().from(trustNodesTable);
  const guest = nodes.find((node) => node.type === "USER" && node.name === "attacker");
  if (!guest) return;

  await db.update(trustNodesTable)
    .set({ trustScore: 100, riskState: "NORMAL" })
    .where(eq(trustNodesTable.id, guest.id));

  const guestEdges = await db.select().from(trustEdgesTable).where(eq(trustEdgesTable.fromNodeId, guest.id));
  for (const node of nodes) {
    if (node.id === guest.id) continue;

    const existingEdge = guestEdges.find((edge) => edge.toNodeId === node.id);
    if (existingEdge) {
      await db.update(trustEdgesTable)
        .set({ trustScore: 100, severed: false, severedAt: null })
        .where(eq(trustEdgesTable.id, existingEdge.id));
      continue;
    }

    await db.insert(trustEdgesTable).values({
      id: uuidv4(),
      fromNodeId: guest.id,
      toNodeId: node.id,
      trustScore: 100,
      severed: false,
      severedAt: null,
    });
  }
}

export async function getTrustGraph() {
  const nodes = await db.select().from(trustNodesTable);
  const edges = await db.select().from(trustEdgesTable);
  return { nodes, edges };
}

export async function severTrustPath(edgeId: string) {
  await db
    .update(trustEdgesTable)
    .set({ severed: true, severedAt: new Date() })
    .where(eq(trustEdgesTable.id, edgeId));
  const [edge] = await db.select().from(trustEdgesTable).where(eq(trustEdgesTable.id, edgeId));
  broadcast("TRUST_UPDATE", { type: "PATH_SEVERED", edgeId, edge });
  return edge;
}

export async function severAllCompromisedPaths(): Promise<void> {
  const compromised = await db
    .select()
    .from(trustNodesTable)
    .where(eq(trustNodesTable.riskState, "COMPROMISED"));

  for (const node of compromised) {
    const edges = await db
      .select()
      .from(trustEdgesTable)
      .where(eq(trustEdgesTable.fromNodeId, node.id));
    for (const edge of edges) {
      if (!edge.severed) {
        await db
          .update(trustEdgesTable)
          .set({ severed: true, severedAt: new Date() })
          .where(eq(trustEdgesTable.id, edge.id));
      }
    }
  }
  broadcast("TRUST_UPDATE", { type: "ALL_COMPROMISED_SEVERED" });
}

export async function resetTrustGraph(): Promise<void> {
  await db.delete(trustEdgesTable);
  await db.delete(trustNodesTable);
  await seedTrustGraph();
  broadcast("TRUST_UPDATE", { type: "GRAPH_RESET" });
}

export async function getTrustAnalytics() {
  const nodes = await db.select().from(trustNodesTable);
  const edges = await db.select().from(trustEdgesTable);
  const activePaths      = edges.filter((e) => !e.severed).length;
  const severedPaths     = edges.filter((e) => e.severed).length;
  const compromisedNodes = nodes.filter((n) => n.riskState === "COMPROMISED").length;
  const degradedNodes    = nodes.filter((n) => n.riskState === "DEGRADED").length;
  const compromisedPaths = edges.filter((e) => {
    const from = nodes.find((n) => n.id === e.fromNodeId);
    return !e.severed && from?.riskState === "COMPROMISED";
  }).length;
  const totalPaths = edges.length;
  const trustHealthPercent = totalPaths > 0
    ? Math.round(((activePaths - compromisedPaths) / totalPaths) * 100)
    : 100;
  return { activePaths, compromisedPaths, severedPaths, trustHealthPercent, totalNodes: nodes.length, compromisedNodes, degradedNodes };
}

export async function getComputedTrustScore(userTrustScores: Record<string, number>): Promise<{ score: number; level: string }> {
  const nodes = await db.select().from(trustNodesTable);
  const nodeAvg = nodes.length
    ? nodes.reduce((s, n) => s + n.trustScore, 0) / nodes.length
    : 100;
  const userScores = Object.values(userTrustScores);
  const userAvg = userScores.length
    ? userScores.reduce((s, v) => s + v, 0) / userScores.length
    : 100;
  const score = Math.round((nodeAvg * 0.6 + userAvg * 0.4));
  const level = score >= 70 ? "HEALTHY" : score >= 40 ? "DEGRADED" : "CRITICAL";
  return { score, level };
}

export async function getClassifiedAssets() {
  const nodes = await db.select().from(trustNodesTable);
  return nodes
    .filter((n) => n.type === "ASSET" && n.classification)
    .map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      classification: n.classification!,
      riskState: n.riskState,
      trustScore: n.trustScore,
    }));
}
