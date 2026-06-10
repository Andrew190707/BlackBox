import { broadcast } from "./websocket";
import { logEvent } from "./flightRecorder";
import { logger } from "../lib/logger";
import { identityResetStatus } from "./identityResetStatus";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

const ROTATIONS = [
  { credential: "admin_password",         action: "PASSWORD_ROTATION",  label: "admin password rotated" },
  { credential: "analyst_password",       action: "PASSWORD_ROTATION",  label: "analyst password rotated" },
  { credential: "hr_admin_password",      action: "PASSWORD_ROTATION",  label: "hr_admin password rotated" },
  { credential: "dev_lead_api_key",       action: "API_KEY_ROTATION",   label: "dev_lead API key rotated" },
  { credential: "hr_admin_api_key",       action: "API_KEY_ROTATION",   label: "hr_admin API key rotated" },
  { credential: "ALL_SESSION_TOKENS",     action: "TOKEN_REVOCATION",   label: "all session tokens revoked" },
  { credential: "ALL_ACTIVE_SESSIONS",    action: "SESSION_REVOCATION", label: "all active sessions revoked" },
  { credential: "access_key_AKIAIOSFOD",  action: "ACCESS_KEY_RESET",   label: "AWS access key reset" },
];

export async function executeIdentityReset(): Promise<void> {
  logger.info("Identity Reset Protocol starting");
  identityResetStatus.startReset();
  broadcast("IDENTITY_RESET", { status: "STARTED", message: "Identity Reset Protocol initiated — rotating all credentials" });
  await logEvent({ eventType: "IDENTITY_RESET_STARTED", user: "system", source: "identity_reset", riskDeltaOverride: 0 });

  await sleep(500);

  for (const r of ROTATIONS) {
    identityResetStatus.recordAction(r.label);
    await logEvent({
      eventType: r.action,
      user: "system",
      source: "identity_reset",
      details: { credential: r.credential, simulated: true },
      riskDeltaOverride: 0,
    });
    broadcast("IDENTITY_RESET", {
      status: "IN_PROGRESS",
      action: r.action,
      credential: r.credential,
      progressPercent: identityResetStatus.progressPercent,
      completedActions: identityResetStatus.completedActions,
    });
    await sleep(350);
  }

  identityResetStatus.completeReset();
  await logEvent({ eventType: "IDENTITY_RESET_COMPLETED", user: "system", source: "identity_reset", riskDeltaOverride: 0 });
  broadcast("IDENTITY_RESET", {
    status: "COMPLETED",
    message: "All credentials rotated — all sessions revoked",
    progressPercent: 100,
    completedActions: identityResetStatus.completedActions,
  });
  logger.info("Identity Reset Protocol complete");
}
