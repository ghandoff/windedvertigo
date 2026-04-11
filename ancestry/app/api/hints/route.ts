import { NextRequest, NextResponse } from "next/server";
import { auth } from "@windedvertigo/auth";
import { getOrCreateTree, getHintsForTree, getPerson } from "@/lib/db/queries";
import { formatFuzzyDate } from "@/lib/db";
import type { HintStatus } from "@/lib/types";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tree = await getOrCreateTree(session.user.email);
  const status = req.nextUrl.searchParams.get("status") as HintStatus | null;

  const hints = await getHintsForTree(tree.id, status ?? undefined);

  // enrich with person data for display
  const personIds = [...new Set(hints.map((h) => h.person_id))];
  const personLookup = new Map<string, {
    displayName: string;
    givenNames: string;
    surname: string;
    birthDate: string | null;
    birthPlace: string | null;
    deathDate: string | null;
    thumbnailUrl: string | null;
  }>();

  await Promise.all(
    personIds.map(async (pid) => {
      const person = await getPerson(pid);
      if (!person) return;
      const primary = person.names.find((n) => n.is_primary) ?? person.names[0];
      const displayName = primary?.display ??
        [primary?.given_names, primary?.surname].filter(Boolean).join(" ") ?? "unnamed";
      const birth = person.events.find((e) => e.event_type === "birth");
      const death = person.events.find((e) => e.event_type === "death");
      personLookup.set(pid, {
        displayName,
        givenNames: primary?.given_names ?? "",
        surname: primary?.surname ?? "",
        birthDate: birth?.date ? formatFuzzyDate(birth.date) : null,
        birthPlace: birth?.description ?? null,
        deathDate: death?.date ? formatFuzzyDate(death.date) : null,
        thumbnailUrl: person.thumbnail_url ?? null,
      });
    }),
  );

  const enriched = hints.map((h) => ({
    ...h,
    person: personLookup.get(h.person_id) ?? null,
  }));

  return NextResponse.json({ hints: enriched });
}
