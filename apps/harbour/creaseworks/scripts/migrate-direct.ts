import { readFileSync } from "fs";
import { resolve } from "path";

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
  console.log("loaded .env.local");
} catch { console.warn("no .env.local found"); }

import { sql } from "@vercel/postgres";

const sqlPath = resolve(process.cwd(), "migrations", "001_initial_schema.sql");
const migration = readFileSync(sqlPath, "utf-8");

const cleaned = migration
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

const statements = cleaned
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

async function main() {
  console.log("parsed " + statements.length + " SQL statements\n");
  for (let i = 0; i < statements.length; i++) {
    const preview = statements[i].slice(0, 60).replace(/\s+/g, " ");
    console.log("[" + (i + 1) + "/" + statements.length + "] " + preview);
    try {
      await sql.query(statements[i]);
      console.log("    ok");
    } catch (err: any) {
      console.error("    FAILED: " + err.message);
      process.exit(1);
    }
  }
  console.log("\nall migrations complete.");
  process.exit(0);
}

main();
