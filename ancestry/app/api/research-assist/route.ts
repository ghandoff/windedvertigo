import { auth } from "@windedvertigo/auth";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getPerson, getPersonRelatives, getOrCreateTree } from "@/lib/db/queries";
import { formatFuzzyDate } from "@/lib/db/utils";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI research assistant not configured (missing ANTHROPIC_API_KEY)" }, { status: 503 });
  }

  const { personId } = await req.json();
  if (!personId) {
    return NextResponse.json({ error: "personId required" }, { status: 400 });
  }

  const tree = await getOrCreateTree(session.user.email);
  const person = await getPerson(personId);
  if (!person || person.tree_id !== tree.id) {
    return NextResponse.json({ error: "person not found" }, { status: 404 });
  }

  const relatives = await getPersonRelatives(personId, tree.id);

  // build a structured profile for the AI
  const primaryName = person.names.find((n) => n.is_primary) ?? person.names[0];
  const displayName = primaryName?.display ?? [primaryName?.given_names, primaryName?.surname].filter(Boolean).join(" ") ?? "unnamed";
  const altNames = person.names.filter((n) => !n.is_primary).map((n) => n.display ?? [n.given_names, n.surname].filter(Boolean).join(" "));

  const events = person.events.map((e) => ({
    type: e.event_type,
    date: e.date ? formatFuzzyDate(e.date) : null,
    description: e.description,
  }));

  const family = {
    parents: relatives.parents.map((r) => r.displayName),
    spouses: relatives.spouses.map((r) => r.displayName),
    children: relatives.children.map((r) => r.displayName),
    siblings: relatives.siblings.map((r) => r.displayName),
  };

  const profile = {
    name: displayName,
    alternateNames: altNames,
    sex: person.sex,
    isLiving: person.is_living,
    events,
    family,
    notes: person.notes,
  };

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are a genealogy research assistant. Analyze this person's profile and suggest specific research directions. Be concise and actionable.

Person profile:
${JSON.stringify(profile, null, 2)}

Provide:
1. **gaps**: what key information is missing (dates, places, parents, etc.)
2. **suggestions**: 3-5 specific records or sources to search (e.g., "search 1920 US census for [name] in [location]", "check [state] vital records for death certificate")
3. **connections**: potential leads from the family data (naming patterns, migration patterns, etc.)

Keep each section to 2-4 bullet points. Be specific to this person's time period and location when possible.`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  return NextResponse.json({
    analysis: text,
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    },
  });
}
