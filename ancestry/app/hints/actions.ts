"use server";

import { auth } from "@windedvertigo/auth";
import { revalidatePath } from "next/cache";
import {
  getOrCreateTree,
  updateHintStatus,
  getHintsForTree,
  createPerson,
  createSource,
  createCitation,
  logActivity,
} from "@/lib/db/queries";
import type { Hint, HintMatchData } from "@/lib/types";

async function getTreeForUser() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("unauthorized");
  const tree = await getOrCreateTree(session.user.email);
  return { session, tree };
}

/** find a hint by id from the user's tree */
async function getHintById(hintId: string): Promise<Hint | null> {
  const { tree } = await getTreeForUser();
  const hints = await getHintsForTree(tree.id);
  return hints.find((h) => h.id === hintId) ?? null;
}

/** create a person record from hint match data */
async function createPersonFromMatchData(
  treeId: string,
  matchData: HintMatchData,
): Promise<string> {
  const personId = await createPerson({
    treeId,
    sex: matchData.sex ?? "U",
    isLiving: false,
    givenNames: matchData.givenNames ?? "",
    middleName: matchData.middleName ?? undefined,
    surname: matchData.surname ?? "",
    birthDate: matchData.birthDate ?? undefined,
    birthPlace: matchData.birthPlace ?? undefined,
    deathDate: matchData.deathDate ?? undefined,
  });
  return personId;
}

/** create a source record citing the external database */
async function createExternalSource(
  treeId: string,
  hint: Hint,
): Promise<string | null> {
  const sourceLabels: Record<string, string> = {
    familysearch: "FamilySearch Tree",
    familysearch_records: "FamilySearch Records",
    wikidata: "Wikidata",
    chronicling_america: "Newspaper Archive",
    nara: "National Archives",
    dpla: "Digital Public Library of America",
  };
  const sourceLabel = sourceLabels[hint.source_system] ?? hint.source_system;

  const displayName = hint.match_data.displayName ||
    [hint.match_data.givenNames, hint.match_data.surname].filter(Boolean).join(" ");

  const sourceId = await createSource(treeId, {
    title: `${sourceLabel} — ${displayName}`.trim(),
    sourceType: "online",
    url: hint.match_data.sourceUrl ?? null,
    notes: `imported via hint match (${hint.confidence}% confidence). external id: ${hint.external_id}`,
  });

  return sourceId;
}

export async function acceptHintAction(formData: FormData) {
  const hintId = formData.get("hintId") as string;
  if (!hintId) throw new Error("hintId is required");

  const { session, tree } = await getTreeForUser();
  const hint = await getHintById(hintId);
  if (!hint) throw new Error("hint not found");

  // 1. update hint status
  await updateHintStatus(hintId, "accepted");

  const isRecordHint = ["familysearch_records", "chronicling_america", "nara", "dpla"].includes(hint.source_system);
  let importedPersonId: string | null = null;

  if (isRecordHint) {
    // record hints: attach as source/citation to existing person (don't create new person)
    const sourceId = await createExternalSource(tree.id, hint);
    if (sourceId) {
      await createCitation({
        sourceId,
        eventId: null,
        confidence: hint.confidence >= 70 ? "primary" : "secondary",
        extract: hint.match_data.snippet ?? null,
        notes: `attached from ${hint.source_system} hint (${hint.confidence}% match)`,
      });
    }
  } else {
    // person hints: import the person
    if (hint.source_system === "familysearch") {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ??
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

        const res = await fetch(`${baseUrl}/api/familysearch/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personId: hint.external_id,
            includeFamily: false,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          importedPersonId = data.primaryPersonId;
        } else {
          importedPersonId = await createPersonFromMatchData(tree.id, hint.match_data);
        }
      } catch {
        importedPersonId = await createPersonFromMatchData(tree.id, hint.match_data);
      }
    } else {
      importedPersonId = await createPersonFromMatchData(tree.id, hint.match_data);
    }

    // create source citation for imported person
    if (importedPersonId) {
      const sourceId = await createExternalSource(tree.id, hint);
      if (sourceId) {
        await createCitation({
          sourceId,
          eventId: null,
          confidence: hint.confidence >= 70 ? "primary" : "secondary",
          notes: `auto-linked from ${hint.source_system} hint (${hint.confidence}% match)`,
        });
      }
    }
  }

  const displayName = hint.match_data.displayName ||
    [hint.match_data.givenNames, hint.match_data.surname].filter(Boolean).join(" ");

  await logActivity({
    treeId: tree.id,
    actorEmail: session.user!.email!,
    action: "hint_accepted",
    targetType: "hint",
    targetId: hintId,
    targetName: displayName,
    details: {
      source: hint.source_system,
      confidence: hint.confidence,
      importedPersonId: importedPersonId ?? undefined,
      isRecordHint,
    },
  });

  revalidatePath("/hints");
  revalidatePath("/");
  revalidatePath(`/person/${hint.person_id}`);
}

export async function rejectHintAction(formData: FormData) {
  const hintId = formData.get("hintId") as string;
  if (!hintId) throw new Error("hintId is required");

  const { session, tree } = await getTreeForUser();
  const hint = await getHintById(hintId);
  if (!hint) throw new Error("hint not found");

  await updateHintStatus(hintId, "rejected");

  const displayName = hint.match_data.displayName ||
    [hint.match_data.givenNames, hint.match_data.surname].filter(Boolean).join(" ");

  await logActivity({
    treeId: tree.id,
    actorEmail: session.user!.email!,
    action: "hint_rejected",
    targetType: "hint",
    targetId: hintId,
    targetName: displayName,
  });

  revalidatePath("/hints");
  revalidatePath(`/person/${hint.person_id}`);
}

export async function refreshHintsAction() {
  const { tree } = await getTreeForUser();

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  try {
    await fetch(`${baseUrl}/api/hints/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ treeId: tree.id }),
    });
  } catch {
    // hint generation API may not exist yet — that's ok
  }

  revalidatePath("/hints");
}
