import { NextRequest } from "next/server";
import { auth } from "@windedvertigo/auth";
import { getOrCreateTree, getTreePersons } from "@/lib/db/queries";
import { generateHintsForPerson } from "@/lib/hints/engine";
import { isConfigured as isFSConfigured } from "@/lib/familysearch/client";

/** SSE streaming endpoint — emits progress events per person */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const tree = await getOrCreateTree(session.user.email);
  if (!tree) {
    return new Response(JSON.stringify({ error: "no tree found" }), { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const personId = body.personId as string | undefined;

  const persons = await getTreePersons(tree.id);

  // single-person mode — fast, no streaming needed
  if (personId) {
    const person = persons.find((p) => p.id === personId);
    if (!person) {
      return new Response(JSON.stringify({ error: "person not found" }), { status: 404 });
    }
    const generated = await generateHintsForPerson(tree.id, person, persons);
    return new Response(JSON.stringify({ generated, personId }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // tree-wide mode — stream progress via SSE
  const encoder = new TextEncoder();
  const abortSignal = req.signal;

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      // warn if FamilySearch isn't configured
      if (!isFSConfigured()) {
        send({ type: "warning", message: "FamilySearch not configured — searching Wikidata + newspaper archives only" });
      } else {
        send({ type: "warning", message: "searching FamilySearch (tree + records), Wikidata, and newspaper archives" });
      }

      const startTime = Date.now();
      let generated = 0;
      let skipped = 0;

      // filter to persons with names
      const searchable = persons.filter((p) => {
        const primary = p.names.find((n) => n.is_primary) ?? p.names[0];
        return primary?.given_names || primary?.surname;
      });
      const total = searchable.length;
      skipped = persons.length - total;

      for (let i = 0; i < searchable.length; i++) {
        // check if client disconnected
        if (abortSignal.aborted) {
          send({ type: "cancelled", generated, processed: i });
          break;
        }

        const person = searchable[i];
        const primary = person.names.find((n) => n.is_primary) ?? person.names[0];
        const displayName = primary?.display ??
          [primary?.given_names, primary?.surname].filter(Boolean).join(" ") ?? "unnamed";

        send({
          type: "progress",
          personName: displayName,
          personId: person.id,
          current: i + 1,
          total,
          hintsFound: generated,
        });

        try {
          const count = await generateHintsForPerson(tree.id, person, persons);
          generated += count;
        } catch (err) {
          send({
            type: "error",
            personName: displayName,
            message: err instanceof Error ? err.message : "unknown error",
          });
        }
      }

      const elapsed = Date.now() - startTime;
      send({ type: "complete", generated, skipped, total, elapsed });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
