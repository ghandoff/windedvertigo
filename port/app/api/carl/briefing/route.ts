import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { getCarlDecisions, getCarlMemory, getCarlFindings } from "@/lib/supabase/carl";

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  try {
    const [decisions, memory, recentFindings] = await Promise.all([
      getCarlDecisions({ days: 14 }),
      getCarlMemory(),
      getCarlFindings({ limit: 20 }),
    ]);

    const lines: string[] = [];
    lines.push("# cARL briefing");
    lines.push(`_generated ${new Date().toISOString().slice(0, 10)}_`);
    lines.push("");

    lines.push("## working state");
    for (const m of memory) {
      lines.push(`- **${m.key}**: ${m.value} _(updated ${m.updated_at.slice(0, 10)} by ${m.updated_by})_`);
    }
    lines.push("");

    if (recentFindings.length > 0) {
      lines.push("## recent library additions");
      const byDomain: Record<string, typeof recentFindings> = {};
      for (const f of recentFindings) {
        (byDomain[f.domain] ??= []).push(f);
      }
      for (const [domain, findings] of Object.entries(byDomain)) {
        lines.push(`### ${domain}`);
        for (const f of findings) {
          lines.push(`- **${f.title}** — ${f.summary.slice(0, 120)}${f.summary.length > 120 ? "…" : ""}`);
          if (f.relevance) lines.push(`  _relevance: ${f.relevance}_`);
        }
      }
      lines.push("");
    }

    if (decisions.length === 0) {
      lines.push("## recent conversations (14 days)");
      lines.push("_no conversations recorded yet_");
    } else {
      lines.push("## recent conversations (14 days)");
      for (const d of decisions) {
        const date = d.created_at.slice(0, 10);
        lines.push(`### ${date} · ${d.who} (${d.session_type})`);
        lines.push(d.summary);
        if (d.decisions?.length) {
          for (const dec of d.decisions) lines.push(`- ${dec}`);
        }
        if (d.tags?.length) lines.push(`_tags: ${d.tags.join(", ")}_`);
        lines.push("");
      }
    }

    return json({
      briefing: lines.join("\n"),
      decisions_count: decisions.length,
      memory_count: memory.length,
      findings_count: recentFindings.length,
    });
  } catch (err) {
    console.error("[api/carl/briefing] GET failed:", err);
    return error("failed to generate briefing", 500);
  }
}
