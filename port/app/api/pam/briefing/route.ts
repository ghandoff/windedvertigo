import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { getPamDecisions, getPamMemory, getPamCommitments } from "@/lib/supabase/pam";

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  try {
    const today = new Date().toISOString().slice(0, 10);
    const [decisions, memory, activeCommitments, overdueCommitments] = await Promise.all([
      getPamDecisions({ days: 14 }),
      getPamMemory(),
      getPamCommitments({ due_after: today }),
      getPamCommitments({ due_before: today }),
    ]);

    const active = activeCommitments.filter((c) => !["done", "parked"].includes(c.status));
    const overdue = overdueCommitments.filter(
      (c) => !["done", "parked"].includes(c.status) && c.due_date,
    );
    const blocked = active.filter((c) => c.status === "blocked");

    const lines: string[] = [];
    lines.push("# PaM briefing");
    lines.push(`_generated ${today}_`);
    lines.push("");

    lines.push("## working state");
    for (const m of memory) {
      lines.push(`- **${m.key}**: ${m.value} _(updated ${m.updated_at.slice(0, 10)} by ${m.updated_by})_`);
    }
    lines.push("");

    if (overdue.length > 0) {
      lines.push("## ⚠ overdue");
      for (const c of overdue) {
        lines.push(`- **${c.who}**: ${c.what} (due ${c.due_date})${c.blocker ? ` — blocked: ${c.blocker}` : ""}`);
      }
      lines.push("");
    }

    if (blocked.length > 0) {
      lines.push("## blocked");
      for (const c of blocked) {
        lines.push(`- **${c.who}**: ${c.what} — ${c.blocker ?? "blocker not specified"}`);
      }
      lines.push("");
    }

    if (active.length > 0) {
      lines.push("## active commitments");
      const byPerson: Record<string, typeof active> = {};
      for (const c of active) {
        (byPerson[c.who] ??= []).push(c);
      }
      for (const [who, items] of Object.entries(byPerson)) {
        lines.push(`### ${who}`);
        for (const c of items) {
          const due = c.due_date ? ` (due ${c.due_date})` : "";
          lines.push(`- [${c.status}] ${c.what}${due}`);
        }
      }
      lines.push("");
    } else {
      lines.push("## active commitments");
      lines.push("_no active commitments_");
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
      active_commitments: active.length,
      overdue_count: overdue.length,
    });
  } catch (err) {
    console.error("[api/pam/briefing] GET failed:", err);
    return error("failed to generate briefing", 500);
  }
}
