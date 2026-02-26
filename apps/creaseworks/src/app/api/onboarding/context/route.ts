/**
 * API route: /api/onboarding/context
 *
 * POST   — create or update a named play context
 * DELETE — remove a named play context
 * PATCH  — switch the active context
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { sql } from "@/lib/db";
import { parseJsonBody } from "@/lib/api-helpers";

const VALID_AGE_GROUPS = ["toddler", "preschool", "school-age", "older", "mixed"];
const VALID_CONTEXTS = ["home", "classroom", "outdoors", "travel"];
const VALID_ENERGY = ["chill", "medium", "active", "any"];
const MAX_CONTEXTS = 8;

interface PlayContext {
  name: string;
  age_groups: string[];
  contexts: string[];
  energy: string;
  created_at: string;
}

/* ── POST: create or update a named context ── */
export async function POST(req: NextRequest) {
  const session = await requireAuth();

  const parsed = await parseJsonBody(req);
  if (parsed instanceof NextResponse) return parsed;
  const body = parsed as Record<string, unknown>;

  const ageGroups: string[] = Array.isArray(body.ageGroups)
    ? (body.ageGroups as string[]).filter((v) => VALID_AGE_GROUPS.includes(v))
    : [];
  const contexts: string[] = Array.isArray(body.contexts)
    ? (body.contexts as string[]).filter((v) => VALID_CONTEXTS.includes(v))
    : [];
  const energy: string = VALID_ENERGY.includes(body.energy as string)
    ? (body.energy as string)
    : "any";
  const contextName = ((body.contextName as string) ?? "default").trim().slice(0, 40);
  const originalContextName = body.originalContextName
    ? ((body.originalContextName as string)).trim()
    : null;

  // Fetch current contexts
  const { rows } = await sql.query(
    `SELECT play_contexts FROM users WHERE id = $1`,
    [session.userId],
  );
  const existing: PlayContext[] = (rows[0]?.play_contexts ?? []) as PlayContext[];

  // Build the new context entry
  const newContext: PlayContext = {
    name: contextName,
    age_groups: ageGroups,
    contexts,
    energy,
    created_at: new Date().toISOString(),
  };

  let updated: PlayContext[];

  if (originalContextName) {
    // Editing an existing context — replace by original name
    const idx = existing.findIndex((c) => c.name === originalContextName);
    if (idx >= 0) {
      updated = [...existing];
      updated[idx] = newContext;
    } else {
      // Original not found — append as new
      updated = [...existing, newContext];
    }
  } else {
    // Check if a context with this name already exists
    const idx = existing.findIndex((c) => c.name === contextName);
    if (idx >= 0) {
      updated = [...existing];
      updated[idx] = newContext;
    } else {
      if (existing.length >= MAX_CONTEXTS) {
        return NextResponse.json(
          { error: `maximum of ${MAX_CONTEXTS} contexts reached` },
          { status: 400 },
        );
      }
      updated = [...existing, newContext];
    }
  }

  // Also update play_preferences with the active context for backward compat
  const prefs = { age_groups: ageGroups, contexts, energy };

  await sql.query(
    `UPDATE users
        SET onboarding_completed = TRUE,
            play_contexts = $1,
            active_context_name = $2,
            play_preferences = $3,
            updated_at = NOW()
      WHERE id = $4`,
    [
      JSON.stringify(updated),
      contextName,
      JSON.stringify(prefs),
      session.userId,
    ],
  );

  return NextResponse.json({ success: true, contexts: updated, active: contextName });
}

/* ── PATCH: switch active context ── */
export async function PATCH(req: NextRequest) {
  const session = await requireAuth();

  const parsed = await parseJsonBody(req);
  if (parsed instanceof NextResponse) return parsed;
  const body = parsed as Record<string, unknown>;

  const contextName = ((body.contextName as string) ?? "").trim();
  if (!contextName) {
    return NextResponse.json({ error: "contextName is required" }, { status: 400 });
  }

  // Verify context exists
  const { rows } = await sql.query(
    `SELECT play_contexts FROM users WHERE id = $1`,
    [session.userId],
  );
  const existing: PlayContext[] = (rows[0]?.play_contexts ?? []) as PlayContext[];
  const target = existing.find((c) => c.name === contextName);

  if (!target) {
    return NextResponse.json({ error: "context not found" }, { status: 404 });
  }

  // Update active context and also sync play_preferences for backward compat
  const prefs = {
    age_groups: target.age_groups,
    contexts: target.contexts,
    energy: target.energy,
  };

  await sql.query(
    `UPDATE users
        SET active_context_name = $1,
            play_preferences = $2,
            updated_at = NOW()
      WHERE id = $3`,
    [contextName, JSON.stringify(prefs), session.userId],
  );

  return NextResponse.json({ success: true, active: contextName, preferences: prefs });
}

/* ── DELETE: remove a named context ── */
export async function DELETE(req: NextRequest) {
  const session = await requireAuth();

  const parsed = await parseJsonBody(req);
  if (parsed instanceof NextResponse) return parsed;
  const body = parsed as Record<string, unknown>;

  const contextName = ((body.contextName as string) ?? "").trim();
  if (!contextName) {
    return NextResponse.json({ error: "contextName is required" }, { status: 400 });
  }

  const { rows } = await sql.query(
    `SELECT play_contexts, active_context_name FROM users WHERE id = $1`,
    [session.userId],
  );
  const existing: PlayContext[] = (rows[0]?.play_contexts ?? []) as PlayContext[];
  const activeContextName = rows[0]?.active_context_name;

  const updated = existing.filter((c) => c.name !== contextName);
  if (updated.length === existing.length) {
    return NextResponse.json({ error: "context not found" }, { status: 404 });
  }

  // If we just deleted the active context, switch to the first remaining one
  const newActive =
    contextName === activeContextName
      ? updated[0]?.name ?? null
      : activeContextName;

  const newPrefs = newActive
    ? (() => {
        const ctx = updated.find((c) => c.name === newActive);
        return ctx
          ? { age_groups: ctx.age_groups, contexts: ctx.contexts, energy: ctx.energy }
          : null;
      })()
    : null;

  await sql.query(
    `UPDATE users
        SET play_contexts = $1,
            active_context_name = $2,
            play_preferences = $3,
            updated_at = NOW()
      WHERE id = $4`,
    [
      JSON.stringify(updated),
      newActive,
      newPrefs ? JSON.stringify(newPrefs) : null,
      session.userId,
    ],
  );

  return NextResponse.json({ success: true, contexts: updated, active: newActive });
}
