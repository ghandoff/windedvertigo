/**
 * port-jobs/src/lib/proposal-bundle-writer.ts
 *
 * RFP Pipeline v2 Phase 2 — writes a Markdown bundle for a generated proposal
 * to the ghandoff/wv-proposals GitHub repo and opens a PR.
 *
 * Why this lives in port-jobs (not port):
 *   - The CF Worker queue consumer is the only thing that calls this. Keeping
 *     the GitHub-API code in the Worker keeps the secret (a fine-grained PAT
 *     scoped to one repo) close to its single consumer.
 *
 * Why GitHub REST API (not `gh` shell-out):
 *   - CF Workers have no shell, no `git`, no `gh`. Native fetch is the only
 *     way to talk to GitHub from a Worker.
 *
 * Why Git Data API (not Contents API):
 *   - Contents API requires one PUT per file → multi-commit PR with messy
 *     history. Git Data API lets us build a single tree of N blobs, one
 *     commit, one branch ref, one PR — clean history regardless of bundle
 *     size.
 *
 * Strategy (5 calls):
 *   1. GET  /repos/{owner}/{repo}/git/ref/heads/main          → base SHA
 *   2. POST /repos/{owner}/{repo}/git/trees                   → tree of blobs
 *   3. POST /repos/{owner}/{repo}/git/commits                 → commit object
 *   4. POST /repos/{owner}/{repo}/git/refs                    → new branch
 *   5. POST /repos/{owner}/{repo}/pulls                       → open PR
 *
 * Failure mode:
 *   - All errors caught at the call site (port-jobs/src/index.ts) — the
 *     Notion sub-pages are still the safety net. A failed bundle write
 *     does NOT roll back the proposal.
 */

import type { ProposalDeliverable } from "@/lib/ai/proposal-generator";
import type { RfpRequirement } from "@/lib/supabase/rfp-requirements";

// ── Types ─────────────────────────────────────────────────────────────────

export interface BundleWriterEnv {
  GITHUB_PROPOSALS_TOKEN: string;
}

export interface WriteProposalBundleInput {
  /** Stable RFP identifier — Notion page id. Used to build the directory slug. */
  rfpId: string;
  /** Human-readable RFP name (e.g., "Oxfam Denmark — Education Evaluation"). */
  rfpName: string;
  /** ISO date string for the submission deadline, or null if unknown. */
  deadline: string | null;
  /** Final deliverables array from the generator. Each entry's `content` is Markdown. */
  deliverables: ProposalDeliverable[];
  /**
   * Approved requirement rows from rfp_requirements (Phase 1). Persisted into
   * `_meta.json` so Cowork skills can re-validate the bundle against the spec.
   */
  requirements: RfpRequirement[];
  /**
   * The TOR excerpt(s) the generator used. Persisted as `_research.md` so
   * skills like `align-narrative-across-deliverables` and `inject-evidence`
   * can compare the draft against source-of-truth quotes.
   */
  research: string | null;
  /**
   * The model identifier used for this generation (e.g.,
   * "claude-haiku-4-5-20251001"). Useful for postmortem comparisons.
   */
  model: string;
  /** Worker env — must contain GITHUB_PROPOSALS_TOKEN. */
  env: BundleWriterEnv;
}

export interface WriteProposalBundleResult {
  prUrl: string;
  prNumber: number;
  branchName: string;
  bundleDir: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const REPO_OWNER = "ghandoff";
const REPO_NAME = "wv-proposals";
const REPO_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
const BASE_BRANCH = "main";
const USER_AGENT = "wv-port-jobs/proposal-bundle-writer";

// Sort-order lookup for deliverable filenames. Anything not in this map keeps
// its original index (offset by the highest known prefix).
const LABEL_SORT_ORDER: Array<[RegExp, number, string]> = [
  [/cover\s*letter|transmittal/i,         0, "cover"],
  [/technical\s*proposal|^proposal$/i,    1, "technical-proposal"],
  [/expression\s*of\s*interest|\beoi\b|capability/i, 2, "eoi"],
  [/financial|budget|cost\s*proposal/i,   3, "financial"],
  [/team\s*cv|cvs/i,                       4, "team-cvs"],
  [/methodology/i,                         5, "methodology"],
  [/work\s*plan|workplan|timeline/i,       6, "workplan"],
  [/compliance|certificate/i,              7, "compliance"],
];

// ── Public entry point ────────────────────────────────────────────────────

export async function writeProposalBundle(
  input: WriteProposalBundleInput,
): Promise<WriteProposalBundleResult> {
  if (!input.env.GITHUB_PROPOSALS_TOKEN) {
    throw new Error(
      "[bundle-writer] GITHUB_PROPOSALS_TOKEN is missing — add it via " +
      "`wrangler secret put GITHUB_PROPOSALS_TOKEN --name wv-port-jobs`.",
    );
  }
  if (!Array.isArray(input.deliverables) || input.deliverables.length === 0) {
    throw new Error("[bundle-writer] deliverables array is empty — nothing to write.");
  }

  const slug = buildBundleSlug(input.rfpId, input.rfpName);
  const branchName = `proposal/${slug}`;
  const bundleDir = `proposal-${slug}`;

  // 1. Compose the file map: { path → utf-8 string }
  const files = composeBundleFiles({ ...input, bundleDir });

  // 2. Get base ref SHA
  const baseSha = await getBaseRefSha(input.env);

  // 3. Build tree + commit
  const treeSha = await createTree(input.env, baseSha, files);
  const commitSha = await createCommit(input.env, {
    message: `proposal: ${input.rfpName}`,
    treeSha,
    parentSha: baseSha,
  });

  // 4. Create branch ref pointing at the new commit
  await createBranchRef(input.env, branchName, commitSha);

  // 5. Open PR
  const pr = await openPullRequest(input.env, {
    title: `proposal: ${input.rfpName}`,
    head: branchName,
    base: BASE_BRANCH,
    body: buildPrBody(input, bundleDir),
  });

  return {
    prUrl: pr.html_url,
    prNumber: pr.number,
    branchName,
    bundleDir,
  };
}

// ── Bundle composition ────────────────────────────────────────────────────

interface FileMapEntry { path: string; content: string }

function composeBundleFiles(
  input: WriteProposalBundleInput & { bundleDir: string },
): FileMapEntry[] {
  const files: FileMapEntry[] = [];
  const used = new Set<string>();
  let fallbackIdx = 90; // anything not in the sort map ends up at 90+

  // Markdown files — one per deliverable
  for (const d of input.deliverables) {
    const { prefix, slug } = labelToFilenameParts(d.label, () => fallbackIdx++);
    let baseName = `${pad2(prefix)}-${slug}.md`;
    // De-duplicate if two deliverables collide on the same slug
    if (used.has(baseName)) {
      baseName = `${pad2(prefix)}-${slug}-${used.size}.md`;
    }
    used.add(baseName);
    files.push({
      path: `${input.bundleDir}/${baseName}`,
      content: renderDeliverableMarkdown(d, input.rfpName),
    });
  }

  // _meta.json — machine-readable bundle index
  files.push({
    path: `${input.bundleDir}/_meta.json`,
    content: JSON.stringify(
      {
        rfpId: input.rfpId,
        rfpName: input.rfpName,
        deadline: input.deadline,
        model: input.model,
        generated_at: new Date().toISOString(),
        deliverables: input.deliverables.map((d) => ({
          label: d.label,
          requirementId: d.requirementId ?? null,
          pageLimit: d.pageLimit ?? null,
          wordLimit: d.wordLimit ?? null,
          format: d.format ?? null,
        })),
        requirements: input.requirements.map((r) => ({
          id: r.id,
          kind: r.kind,
          label: r.label,
          required: r.required,
          approvedAt: r.approvedAt,
          pageLimit: r.pageLimit,
          wordLimit: r.wordLimit,
          format: r.format,
          requiredSections: r.requiredSections,
          weightPct: r.weightPct,
        })),
      },
      null,
      2,
    ) + "\n",
  });

  // _research.md — TOR excerpts the generator saw
  files.push({
    path: `${input.bundleDir}/_research.md`,
    content: renderResearchMd(input),
  });

  return files;
}

function renderDeliverableMarkdown(d: ProposalDeliverable, rfpName: string): string {
  const fm: string[] = ["---"];
  fm.push(`label: ${jsonString(d.label)}`);
  fm.push(`rfp: ${jsonString(rfpName)}`);
  if (d.requirementId) fm.push(`requirementId: ${jsonString(d.requirementId)}`);
  if (d.pageLimit) fm.push(`pageLimit: ${d.pageLimit}`);
  if (d.wordLimit) fm.push(`wordLimit: ${d.wordLimit}`);
  if (d.format) fm.push(`format: ${jsonString(d.format)}`);
  fm.push("---", "");
  // Body: title heading + content
  return [
    fm.join("\n"),
    `# ${d.label}`,
    "",
    d.content?.trim() ?? "",
    "",
  ].join("\n");
}

function renderResearchMd(input: WriteProposalBundleInput): string {
  const lines: string[] = [];
  lines.push(`# Research context — ${input.rfpName}`, "");
  lines.push(
    "> The TOR excerpts the generator used as primary context for this bundle.",
    "> Cowork skills (`align-narrative-across-deliverables`, " +
    "`inject-evidence-from-port`) read this file to compare drafts against " +
    "source-of-truth quotes.",
    "",
  );
  if (input.deadline) {
    lines.push(`**Submission deadline:** ${input.deadline}`, "");
  }
  if (input.research && input.research.trim().length > 0) {
    lines.push("## TOR excerpt", "", input.research.trim(), "");
  } else {
    lines.push(
      "_No TOR excerpt was attached to the generation context — see the " +
      "Notion RFP record for the full attachment chain._",
      "",
    );
  }

  // Approved requirement source quotes — one per row, if present
  const withQuotes = input.requirements.filter((r) => r.sourceQuote);
  if (withQuotes.length > 0) {
    lines.push("## Source quotes (per approved requirement)", "");
    for (const r of withQuotes) {
      lines.push(`### ${r.kind} — ${r.label}`, "");
      lines.push(`> ${r.sourceQuote!.trim().replace(/\n/g, "\n> ")}`, "");
      if (r.extractionConfidence != null) {
        lines.push(`_extraction confidence: ${r.extractionConfidence}_`, "");
      }
    }
  }

  return lines.join("\n");
}

function buildPrBody(
  input: WriteProposalBundleInput,
  bundleDir: string,
): string {
  const lines: string[] = [];
  lines.push(`## ${input.rfpName}`, "");
  if (input.deadline) lines.push(`**Deadline:** ${input.deadline}`, "");
  lines.push(`**RFP id:** \`${input.rfpId}\``, "");
  lines.push(`**Model:** \`${input.model}\``, "");
  lines.push("");
  lines.push("### Deliverables", "");
  for (const d of input.deliverables) {
    const spec: string[] = [];
    if (d.pageLimit) spec.push(`≤${d.pageLimit}p`);
    if (d.wordLimit) spec.push(`≤${d.wordLimit}w`);
    if (d.format && d.format !== "either") spec.push(d.format);
    const suffix = spec.length ? ` — ${spec.join(" · ")}` : "";
    lines.push(`- **${d.label}**${suffix}`);
  }
  lines.push("", "### Iterate this bundle", "");
  lines.push(`\`\`\`bash`);
  lines.push(`git fetch && git checkout proposal/${bundleDir.replace(/^proposal-/, "")}`);
  lines.push(`cd ${bundleDir}`);
  lines.push(`# in Cowork:`);
  lines.push(`#   /align-narrative-across-deliverables`);
  lines.push(`#   /tighten-to-page-limit 01-technical-proposal.md 8`);
  lines.push(`#   /export-to-indesign`);
  lines.push(`\`\`\``);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(
    "🤖 Generated by `wv-port-jobs` consumer. " +
    "See `/Users/garrettjaeger/.claude/plans/generic-popping-bubble.md` for the Phase 2 plan.",
  );
  return lines.join("\n");
}

// ── GitHub API calls ──────────────────────────────────────────────────────

interface GitHubRefRes { object: { sha: string } }
interface GitHubTreeRes { sha: string }
interface GitHubCommitRes { sha: string }
interface GitHubPullRes { number: number; html_url: string }

async function getBaseRefSha(env: BundleWriterEnv): Promise<string> {
  const res = await ghFetch<GitHubRefRes>(
    env,
    `${REPO_BASE}/git/ref/heads/${BASE_BRANCH}`,
  );
  return res.object.sha;
}

async function createTree(
  env: BundleWriterEnv,
  baseSha: string,
  files: FileMapEntry[],
): Promise<string> {
  // For small bundles (<5MB total) we can pass content inline rather than
  // creating blobs first. Saves one round-trip per file.
  const tree = files.map((f) => ({
    path: f.path,
    mode: "100644" as const,
    type: "blob" as const,
    content: f.content,
  }));
  const res = await ghFetch<GitHubTreeRes>(env, `${REPO_BASE}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseSha, tree }),
  });
  return res.sha;
}

async function createCommit(
  env: BundleWriterEnv,
  opts: { message: string; treeSha: string; parentSha: string },
): Promise<string> {
  const res = await ghFetch<GitHubCommitRes>(env, `${REPO_BASE}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: opts.message,
      tree: opts.treeSha,
      parents: [opts.parentSha],
    }),
  });
  return res.sha;
}

async function createBranchRef(
  env: BundleWriterEnv,
  branchName: string,
  commitSha: string,
): Promise<void> {
  await ghFetch<unknown>(env, `${REPO_BASE}/git/refs`, {
    method: "POST",
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: commitSha,
    }),
  });
}

async function openPullRequest(
  env: BundleWriterEnv,
  opts: { title: string; head: string; base: string; body: string },
): Promise<GitHubPullRes> {
  return ghFetch<GitHubPullRes>(env, `${REPO_BASE}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title: opts.title,
      head: opts.head,
      base: opts.base,
      body: opts.body,
    }),
  });
}

async function ghFetch<T>(
  env: BundleWriterEnv,
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": USER_AGENT,
      "Authorization": `Bearer ${env.GITHUB_PROPOSALS_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "<no body>");
    throw new Error(
      `[bundle-writer] ${init.method ?? "GET"} ${url} → ${res.status}: ${txt.slice(0, 500)}`,
    );
  }
  return res.json() as Promise<T>;
}

// ── Helpers ───────────────────────────────────────────────────────────────

export function buildBundleSlug(rfpId: string, rfpName: string): string {
  // First 8 chars of the (likely UUID-shaped) rfpId, lowercased + de-hyphenated
  // for compactness. Falls back to a hash-like short form for non-UUID ids.
  const shortId = rfpId.replace(/-/g, "").slice(0, 8).toLowerCase();
  const namePart = kebab(rfpName).slice(0, 40).replace(/-+$/, "");
  return namePart ? `${shortId}-${namePart}` : shortId;
}

function labelToFilenameParts(
  label: string,
  fallbackPrefix: () => number,
): { prefix: number; slug: string } {
  for (const [pattern, prefix, slug] of LABEL_SORT_ORDER) {
    if (pattern.test(label)) return { prefix, slug };
  }
  return { prefix: fallbackPrefix(), slug: kebab(label) || "deliverable" };
}

function kebab(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function jsonString(s: string): string {
  // YAML-frontmatter-safe quoting — JSON.stringify covers \n, ", \\, etc.
  return JSON.stringify(s);
}
