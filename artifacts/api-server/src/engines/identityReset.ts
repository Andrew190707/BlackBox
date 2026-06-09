import { broadcast } from "./websocket";
import { logEvent } from "./flightRecorder";
import { logger } from "../lib/logger";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

const ROTATIONS = [
  { credential: "admin_password",         action: "PASSWORD_ROTATION" },
  { credential: "analyst_password",       action: "PASSWORD_ROTATION" },
  { credential: "hr_admin_password",      action: "PASSWORD_ROTATION" },
  { credential: "dev_lead_api_key",       action: "API_KEY_ROTATION" },
  { credential: "hr_admin_api_key",       action: "API_KEY_ROTATION" },
  { credential: "ALL_SESSION_TOKENS",     action: "TOKEN_REVOCATION" },
  { credential: "ALL_ACTIVE_SESSIONS",    action: "SESSION_REVOCATION" },
  { credential: "access_key_AKIAIOSFOD",  action: "ACCESS_KEY_RESET" },
];

export async function executeIdentityReset(): Promise<void> {
  logger.info("Identity Reset Protocol starting");
  broadcast("IDENTITY_RESET", { status: "STARTED", message: "Identity Reset Protocol initiated — rotating all credentials" });
  await logEvent({ eventType: "IDENTITY_RESET_STARTED", user: "system", source: "identity_reset", riskDeltaOverride: 0 });

  await sleep(500);

  for (const r of ROTATIONS) {
    await logEvent({
      eventType: r.action,
      user: "system",
      source: "identity_reset",
      details: { credential: r.credential, simulated: true },
      riskDeltaOverride: 0,
    });
    broadcast("IDENTITY_RESET", { status: "IN_PROGRESS", action: r.action, credential: r.credential });
    await sleep(350);
  }

  await logEvent({ eventType: "IDENTITY_RESET_COMPLETED", user: "system", source: "identity_reset", riskDeltaOverride: 0 });
  broadcast("IDENTITY_RESET", { status: "COMPLETED", message: "All credentials rotated — all sessions revoked" });
  logger.info("Identity Reset Protocol complete");
}
