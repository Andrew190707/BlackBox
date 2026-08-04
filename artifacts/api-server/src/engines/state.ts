import { v4 as uuidv4 } from "uuid";

export type ThreatState = "GREEN" | "YELLOW" | "ORANGE" | "RED";

export interface BreakerState {
  name: string;
  label: string;
  status: "CLOSED" | "TRIPPED" | "RESET";
  trippedAt: string | null;
  reason: string | null;
}

export interface LockdownState {
  active: boolean;
  phase: number;
  initiatedAt: string | null;
  liftedAt: string | null;
  snapshotId: string | null;
}

export interface RiskHistoryPoint {
  timestamp: string;
  score: number;
  threatState: ThreatState;
}

const BREAKERS: Array<{ name: string; label: string }> = [
  { name: "user_to_asset",        label: "User → Asset" },
  { name: "device_to_asset",      label: "Device → Asset" },
  { name: "application_to_asset", label: "App → Asset" },
  { name: "remote_access",        label: "Remote Access" },
  { name: "external_transfer",    label: "External Transfer" },
];

class BlackBoxState {
  riskScore = 20;
  threatState: ThreatState = "GREEN";
  riskHistory: RiskHistoryPoint[] = [];

  breakers: Record<string, BreakerState> = Object.fromEntries(
    BREAKERS.map(({ name, label }) => [
      name,
      { name, label, status: "CLOSED" as const, trippedAt: null, reason: null },
    ])
  );

  lockdown: LockdownState = {
    active: false,
    phase: 0,
    initiatedAt: null,
    liftedAt: null,
    snapshotId: null,
  };

  userTrustScores: Record<string, number> = {
    admin: 100,
    analyst: 98,
    hr_admin: 95,
    dev_lead: 97,
    ceo: 99,
    cfo: 99,
    unknown_user: 70,
    attacker: 100,
  };

  simulationRunning = false;
  currentIncidentId: string | null = null;
  currentAttacker: string | null = null;

  updateRiskScore(delta: number) {
    this.riskScore = Math.max(0, Math.min(100, this.riskScore + delta));
    this.threatState = this.computeThreatState(this.riskScore);
    this.riskHistory.push({
      timestamp: new Date().toISOString(),
      score: this.riskScore,
      threatState: this.threatState,
    });
    if (this.riskHistory.length > 60) {
      this.riskHistory = this.riskHistory.slice(-60);
    }
  }

  setRiskScore(score: number) {
    this.riskScore = Math.max(0, Math.min(100, score));
    this.threatState = this.computeThreatState(this.riskScore);
    this.riskHistory.push({
      timestamp: new Date().toISOString(),
      score: this.riskScore,
      threatState: this.threatState,
    });
    if (this.riskHistory.length > 60) {
      this.riskHistory = this.riskHistory.slice(-60);
    }
  }

  computeThreatState(score: number): ThreatState {
    if (score <= 40) return "GREEN";
    if (score <= 70) return "YELLOW";
    if (score <= 90) return "ORANGE";
    return "RED";
  }

  tripBreaker(name: string, reason: string) {
    if (!this.breakers[name]) return false;
    this.breakers[name] = {
      ...this.breakers[name],
      status: "TRIPPED",
      trippedAt: new Date().toISOString(),
      reason,
    };
    return true;
  }

  resetBreaker(name: string) {
    if (!this.breakers[name]) return false;
    this.breakers[name] = {
      ...this.breakers[name],
      status: "RESET",
      trippedAt: null,
      reason: null,
    };
    return true;
  }

  autoTripBreakers(score: number) {
    const tripped: string[] = [];
    if (score > 70) {
      ["external_transfer"].forEach((b) => {
        if (this.breakers[b]?.status === "CLOSED") {
          this.tripBreaker(b, `Auto-tripped at risk score ${score}`);
          tripped.push(b);
        }
      });
    }
    if (score > 85) {
      ["remote_access"].forEach((b) => {
        if (this.breakers[b]?.status === "CLOSED") {
          this.tripBreaker(b, `Auto-tripped at risk score ${score}`);
          tripped.push(b);
        }
      });
    }
    if (score > 95) {
      ["user_to_asset", "device_to_asset", "application_to_asset"].forEach((b) => {
        if (this.breakers[b]?.status === "CLOSED") {
          this.tripBreaker(b, `Auto-tripped at risk score ${score}`);
          tripped.push(b);
        }
      });
    }
    return tripped;
  }

  reset() {
    this.riskScore = 20;
    this.threatState = "GREEN";
    this.riskHistory = [];
    this.breakers = Object.fromEntries(
      BREAKERS.map(({ name, label }) => [
        name,
        { name, label, status: "CLOSED" as const, trippedAt: null, reason: null },
      ])
    );
    this.lockdown = {
      active: false,
      phase: 0,
      initiatedAt: null,
      liftedAt: null,
      snapshotId: null,
    };
    this.userTrustScores = {
      admin: 100,
      analyst: 98,
      hr_admin: 95,
      dev_lead: 97,
      ceo: 99,
      cfo: 99,
      unknown_user: 70,
      attacker: 100,
    };
    this.simulationRunning = false;
    this.currentIncidentId = null;
    this.currentAttacker = null;
  }
}

export const blackBoxState = new BlackBoxState();
export { uuidv4 };
