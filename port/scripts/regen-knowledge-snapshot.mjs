#!/usr/bin/env node
/**
 * Regenerate the committed knowledge-graph snapshot from the live Supabase
 * tables. Run AFTER a full `knowledge-sync` so `lib/knowledge/graph-data.ts`
 * (the /brain fallback) reflects the merged human+agent graph, then commit.
 *
 *   node scripts/regen-knowledge-snapshot.mjs
 *
 * Reads SUPABASE_URL + SUPABASE_SECRET_KEY from .env.local. Rewrites only the
 * `export const GRAPH_DATA = {...}` block, preserving the file's imports and
 * re-exports above it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function env(key) {
  const line = readFileSync(resolve(root, ".env.local"), "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`${key} not in .env.local`);
  return line.slice(key.length + 1).replace(/^["']|["']$/g, "").trim();
}

const url = env("NEXT_PUBLIC_SUPABASE_URL");
const key = env("SUPABASE_SECRET_KEY");

async function all(table, select) {
  const res = await fetch(`${url}/rest/v1/${table}?select=${select}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

const nodeRows = await all("knowledge_nodes", "id,label,category,kind,source,canonical_key,description,attrs,last_seen_at");
const edgeRows = await all("knowledge_edges", "source_id,target_id,relationship,source");

const nodes = nodeRows.map((r) => ({
  id: r.id,
  label: r.label,
  agent: (r.attrs && r.attrs.agent) || "shared",
  category: r.category,
  description: r.description || "",
  kind: r.kind,
  source: r.source,
  canonicalKey: r.canonical_key,
  lastSeenAt: r.last_seen_at,
}));
const edges = edgeRows.map((e) => ({
  source: e.source_id,
  target: e.target_id,
  relationship: e.relationship,
  kind: e.source,
}));

const file = resolve(root, "lib/knowledge/graph-data.ts");
const src = readFileSync(file, "utf8");
const marker = "export const GRAPH_DATA";
const head = src.slice(0, src.indexOf(marker));
const block = `export const GRAPH_DATA: GraphData = ${JSON.stringify({ nodes, edges }, null, 2)};\n`;
writeFileSync(file, head + block);

console.log(`snapshot regenerated: ${nodes.length} nodes, ${edges.length} edges → lib/knowledge/graph-data.ts`);
