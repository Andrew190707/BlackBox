import { Router } from "express";
import { blackBoxState } from "../engines/state";

const router = Router();

const POLICIES = [
  { resource: "customer_db", allowedUsers: ["admin", "analyst"], maxVolumeMb: 100 },
  { resource: "payroll_data", allowedUsers: ["hr_admin"], maxVolumeMb: 50 },
  { resource: "source_code", allowedUsers: ["dev_lead", "admin"], maxVolumeMb: 500 },
  { resource: "executive_docs", allowedUsers: ["ceo", "cfo"], maxVolumeMb: 10 },
];

router.get("/governance/policies", (_req, res) => {
  res.json(POLICIES);
});

router.get("/governance/trust", (_req, res) => {
  const scores = Object.entries(blackBoxState.userTrustScores).map(([user, score]) => ({
    user,
    score,
    lastActivity: new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString(),
  }));
  res.json(scores);
});

export default router;
