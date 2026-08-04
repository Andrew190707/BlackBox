import { Router } from "express";
import { blackBoxState } from "../engines/state";
import { db } from "@workspace/db";
import { companyUserProfilesTable, trustNodesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const AVATAR_COLORS = [
  "#00ff88", "#00ccff", "#ff6b6b", "#ffcc00", "#cc44ff", "#44aaff", "#ff8844", "#88ff44",
];
const USER_ORDER = ["admin", "analyst", "dev_lead", "hr_admin", "cfo", "ceo", "unknown_user", "attacker"];

function avatarSvg(name: string, color: string): string {
  const initial = name.charAt(0).toUpperCase();
  const bg = color;
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="${encodeURIComponent(bg)}"/><text x="50" y="58" font-size="48" font-family="monospace" font-weight="bold" text-anchor="middle" fill="%23000">${initial}</text></svg>`;
}

router.get("/users", async (_req, res) => {
  const [profiles, nodeUsers] = await Promise.all([
    db.select().from(companyUserProfilesTable),
    db.select().from(trustNodesTable).where(eq(trustNodesTable.type, "USER")),
  ]);
  const users = [...profiles]
    .sort((a, b) => USER_ORDER.indexOf(a.userName) - USER_ORDER.indexOf(b.userName))
    .map((profile, idx) => {
    const node = nodeUsers.find((candidate) => candidate.name === profile.userName);
    const name = profile.userName;
    const trustScore = blackBoxState.userTrustScores[name] ?? node?.trustScore ?? 50;
    const riskScore = 100 - trustScore;
    const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];

    return {
      id: node?.id ?? `user-${name}`,
      name,
      displayName: profile.displayName,
      empId: `EMP-${1000 + idx * 23}`,
      department: profile.department,
      status: node?.riskState === "COMPROMISED" || profile.riskStatus === "COMPROMISED" ? "Offline" : "Online",
      riskScore: Math.round(riskScore),
      trustScore: Math.round(trustScore),
      avatar: avatarSvg(name, color),
    };
    });

  res.json(users);
});

export default router;
