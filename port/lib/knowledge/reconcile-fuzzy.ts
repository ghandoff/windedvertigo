/**
 * Fuzzy reconciliation — grows the human↔agent merge beyond exact key match.
 *
 * Pipeline:
 *  1. blocking — pair human capabilities (skill/method/framework) with agent
 *     concepts that share a DISTINCTIVE token (skips generic high-frequency
 *     tokens like "learning" / "design" that aren't discriminative).
 *  2. cache — skip canonical-key pairs already judged (stable + cheap).
 *  3. judge — Haiku decides same/not-same for the remaining pairs.
 *  4. bridge — write `same-as` (source: derived, reason: fuzzy) + mark shared.
 *
 * Runs after the exact reconciler, reading the live table so it sees every source.
 */

import { supabase } from "@/lib/supabase/client";
import { judgePairs, type JudgePair } from "@/lib/ai/reconcile-judge";
import { upsertEdges, type EdgeInput } from "./supabase";

interface MiniNode {
  id: string;
  kind: "human" | "agent" | "shared";
  category: string;
  label: string;
  canonical_key: string;
}

export interface FuzzyResult {
  candidates: number;
  judged: number;
  cachedHits: number;
  fuzzyBridges: number;
  sharedNodes: number;
  capped: boolean;
}

const MAX_DF = 15; // skip tokens shared by more than this many nodes (too generic)
const MAX_JUDGE = 400; // cost ceiling on new pairs judged per run
const MIN_CONFIDENCE = 0.6;
const CAP_CATEGORIES = new Set(["skill", "method", "framework"]);

const tokens = (key: string) => key.split(" ").filter((t) => t.length >= 4);
const pairKey = (a: string, b: string) => (a <= b ? `${a}::${b}` : `${b}::${a}`);

export async function reconcileFuzzy(syncTs: string, userId = "knowledge-sync"): Promise<FuzzyResult> {
  const { data, error } = await supabase
    .from("knowledge_nodes")
    .select("id, kind, category, label, canonical_key");
  if (error) throw new Error(`[reconcile-fuzzy] read: ${error.message}`);
  const nodes = (data ?? []) as MiniNode[];

  const caps = nodes.filter((n) => CAP_CATEGORIES.has(n.category) && (n.kind === "human" || n.kind === "shared"));
  const concepts = nodes.filter((n) => n.category === "concept" && (n.kind === "agent" || n.kind === "shared"));
  if (caps.length === 0 || concepts.length === 0) {
    return { candidates: 0, judged: 0, cachedHits: 0, fuzzyBridges: 0, sharedNodes: 0, capped: false };
  }

  // document frequency per token (over caps + concepts) to drop generic tokens
  const df = new Map<string, number>();
  [...caps, ...concepts].forEach((n) => {
    new Set(tokens(n.canonical_key)).forEach((t) => df.set(t, (df.get(t) ?? 0) + 1));
  });

  // inverted index on distinctive tokens only
  const capsByTok = new Map<string, MiniNode[]>();
  const conByTok = new Map<string, MiniNode[]>();
  const index = (list: MiniNode[], target: Map<string, MiniNode[]>) =>
    list.forEach((n) =>
      new Set(tokens(n.canonical_key)).forEach((t) => {
        if ((df.get(t) ?? 0) > MAX_DF) return;
        (target.get(t) ?? target.set(t, []).get(t)!).push(n);
      }),
    );
  index(caps, capsByTok);
  index(concepts, conByTok);

  // candidate node-pairs (distinct, different keys) + their canonical-key pairs
  const candNodePairs = new Map<string, { cap: MiniNode; con: MiniNode; pk: string }>();
  for (const [tok, capList] of capsByTok) {
    const conList = conByTok.get(tok);
    if (!conList) continue;
    for (const cap of capList) {
      for (const con of conList) {
        if (cap.canonical_key === con.canonical_key) continue; // exact handles these
        const npk = `${cap.id}|${con.id}`;
        if (!candNodePairs.has(npk)) {
          candNodePairs.set(npk, { cap, con, pk: pairKey(cap.canonical_key, con.canonical_key) });
        }
      }
    }
  }
  const candidates = candNodePairs.size;
  if (candidates === 0) {
    return { candidates: 0, judged: 0, cachedHits: 0, fuzzyBridges: 0, sharedNodes: 0, capped: false };
  }

  // load cache for the distinct canonical-key pairs in play
  const keyPairs = new Map<string, { a: string; b: string; aLabel: string; bLabel: string }>();
  for (const { cap, con, pk } of candNodePairs.values()) {
    if (!keyPairs.has(pk)) {
      const [a, b] = pk.split("::");
      keyPairs.set(pk, {
        a,
        b,
        aLabel: cap.canonical_key === a ? cap.label : con.label,
        bLabel: cap.canonical_key === b ? cap.label : con.label,
      });
    }
  }

  const verdict = new Map<string, boolean>(); // pk → same
  const allKeys = [...new Set([...keyPairs.keys()].flatMap((pk) => pk.split("::")))];
  const cacheRows = new Map<string, { same: boolean }>();
  for (let i = 0; i < allKeys.length; i += 400) {
    const { data: rows } = await supabase
      .from("knowledge_fuzzy_cache")
      .select("key_a, key_b, same")
      .in("key_a", allKeys.slice(i, i + 400));
    (rows ?? []).forEach((r: { key_a: string; key_b: string; same: boolean }) =>
      cacheRows.set(pairKey(r.key_a, r.key_b), { same: r.same }),
    );
  }

  let cachedHits = 0;
  const toJudge: JudgePair[] = [];
  for (const [pk, info] of keyPairs) {
    const cached = cacheRows.get(pk);
    if (cached) {
      cachedHits++;
      verdict.set(pk, cached.same);
    } else {
      toJudge.push({ id: pk, a: info.aLabel, b: info.bLabel });
    }
  }

  // cost ceiling on fresh judgements
  const capped = toJudge.length > MAX_JUDGE;
  const judgeBatch = capped ? toJudge.slice(0, MAX_JUDGE) : toJudge;
  const judged = await judgePairs(judgeBatch, userId);

  // persist verdicts to cache + record same/not-same
  const cacheUpserts = judgeBatch.map((p) => {
    const v = judged.get(p.id);
    const [a, b] = p.id.split("::");
    const same = !!v?.same && (v?.confidence ?? 0) >= MIN_CONFIDENCE;
    verdict.set(p.id, same);
    return { key_a: a, key_b: b, same, confidence: v?.confidence ?? 0, judged_at: syncTs };
  });
  for (let i = 0; i < cacheUpserts.length; i += 500) {
    await supabase
      .from("knowledge_fuzzy_cache")
      .upsert(cacheUpserts.slice(i, i + 500), { onConflict: "key_a,key_b" });
  }

  // build bridges for every node-pair whose key-pair is "same"
  const bridges: EdgeInput[] = [];
  const sharedIds = new Set<string>();
  for (const { cap, con, pk } of candNodePairs.values()) {
    if (!verdict.get(pk)) continue;
    bridges.push({
      sourceId: cap.id,
      targetId: con.id,
      relationship: "same-as",
      source: "derived",
      attrs: { reason: "fuzzy" },
    });
    sharedIds.add(cap.id);
    sharedIds.add(con.id);
  }
  await upsertEdges(bridges, syncTs);

  const ids = [...sharedIds];
  for (let i = 0; i < ids.length; i += 500) {
    await supabase
      .from("knowledge_nodes")
      .update({ kind: "shared", updated_at: syncTs })
      .in("id", ids.slice(i, i + 500));
  }

  return { candidates, judged: judgeBatch.length, cachedHits, fuzzyBridges: bridges.length, sharedNodes: sharedIds.size, capped };
}
