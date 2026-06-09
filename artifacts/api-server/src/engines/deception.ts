import { db } from "@workspace/db";
import { deceptionAssetsTable } from "@workspace/db";
import { broadcast } from "./websocket";
import { logger } from "../lib/logger";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";

const HONEYFILES = [
  "/tmp/blackbox_watch/Payroll_2026.xlsx",
  "/tmp/blackbox_watch/ExecutivePasswords.txt",
  "/tmp/blackbox_watch/CryptoWalletBackup.txt",
  "/tmp/blackbox_watch/AWS_AccessKeys.csv",
];

export async function deployDeception(): Promise<void> {
  const existing = await db.select().from(deceptionAssetsTable).limit(1);
  if (existing.length > 0) {
    await db.update(deceptionAssetsTable).set({ deployed: true });
    const assets = await db.select().from(deceptionAssetsTable);
    broadcast("DECEPTION_DEPLOYED", { assets });
    return;
  }

  for (const path of HONEYFILES) {
    await db.insert(deceptionAssetsTable).values({
      id: uuidv4(),
      type: "HONEYFILE",
      path,
      deployed: true,
      triggered: false,
      triggeredAt: null,
    });
  }

  const decoyCredPaths = [
    "admin_backup:Adm1n@2026!",
    "db_root:DBr00t#Secure",
    "svc_account:Svc@cc0unt99",
  ];

  for (const cred of decoyCredPaths) {
    await db.insert(deceptionAssetsTable).values({
      id: uuidv4(),
      type: "DECOY_CREDENTIAL",
      path: cred,
      deployed: true,
      triggered: false,
      triggeredAt: null,
    });
  }

  const assets = await db.select().from(deceptionAssetsTable);
  broadcast("DECEPTION_DEPLOYED", { assets });
  logger.info({ count: assets.length }, "Deception assets deployed");
}

export async function triggerHoneyfile(path: string): Promise<void> {
  await db
    .update(deceptionAssetsTable)
    .set({ triggered: true, triggeredAt: new Date() })
    .where(eq(deceptionAssetsTable.path, path));

  broadcast("DECEPTION_TRIGGERED", {
    asset: path,
    message: "HONEYFILE ACCESSED — attacker identity confirmed",
  });
  logger.warn({ path }, "Honeyfile triggered");
}
