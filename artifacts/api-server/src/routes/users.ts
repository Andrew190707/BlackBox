import { Router } from "express";
import { blackBoxState } from "../engines/state";
import { db } from "@workspace/db";
import { trustNodesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

const DEPARTMENTS: Record<string, string> = {
  admin: "IT Security",
  analyst: "Threat Intelligence",
  hr_admin: "Human Resources",
  dev_lead: "Engineering",
  ceo: "Executive",
  cfo: "Finance",
  unknown_user: "Unknown",
  attacker: "Unknown",
};

const AVATAR_COLORS = [
  "#00ff88", "#00ccff", "#ff6b6b", "#ffcc00", "#cc44ff", "#44aaff", "#ff8844", "#88ff44",
];

function avatarSvg(name: string, color: string): string {
  const initial = name.charAt(0).toUpperCase();
  const bg = color;
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="${encodeURIComponent(bg)}"/><text x="50" y="58" font-size="48" font-family="monospace" font-weight="bold" text-anchor="middle" fill="%23000">${initial}</text></svg>`;
}

router.get("/users", async (_req, res) => {
  const nodeUsers = await db
    .select()
    .from(trustNodesTable)
    .where(eq(trustNodesTable.type, "USER"));

  const users = nodeUsers.map((node, idx) => {
    const name = node.name;
    const trustScore = blackBoxState.userTrustScores[name] ?? 50;
    const riskScore = 100 - trustScore;
    const isOnline = Math.random() > 0.3;
    const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];

    return {
      id: node.id,
      name,
      empId: `EMP-${1000 + idx * 23}`,
      department: DEPARTMENTS[name] || "Unknown",
      status: isOnline ? "Online" : "Offline",
      riskScore: Math.round(riskScore),
      trustScore: Math.round(trustScore),
      avatar: avatarSvg(name, color),
    };
  });

  res.json(users);
});

export default router;
