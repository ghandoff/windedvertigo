/**
 * Seed the domain_blocklist table with common consumer email domains.
 *
 * These domains are blocked from org-verified-domain sign-up to prevent
 * individuals from masquerading as organisations.
 *
 * Run:  npx tsx scripts/seed-blocklist.ts
 *
 * Loads .env.local automatically so POSTGRES_URL is available
 * outside of Next.js runtime.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local so @vercel/postgres can find POSTGRES_URL
const envPath = resolve(process.cwd(), ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.warn("no .env.local found — relying on existing env vars");
}

import { sql } from "@vercel/postgres";

const CONSUMER_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "hotmail.co.uk",
  "outlook.com",
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "protonmail.com",
  "proton.me",
  "zoho.com",
  "yandex.com",
  "mail.com",
  "gmx.com",
  "gmx.net",
  "fastmail.com",
  "tutanota.com",
  "tuta.com",
];

async function main() {
  console.log(`seeding ${CONSUMER_DOMAINS.length} consumer domains…`);

  for (const domain of CONSUMER_DOMAINS) {
    await sql`
      INSERT INTO domain_blocklist (domain, enabled, reason)
      VALUES (${domain}, TRUE, 'consumer email provider')
      ON CONFLICT (domain) DO NOTHING
    `;
  }

  console.log("done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
