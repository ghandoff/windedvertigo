/**
 * ttoc_gate — score an opportunity/commitment/campaign against winded.vertigo's
 * Transformative Theory of Change rubric (Must Have / Should Have / Clear
 * Rejections) plus a survival-vs-mission tag.
 *
 * PLACEHOLDER RUBRIC — see docs/cmo/ttoc-rubric.md. The RUBRIC constant below
 * is a copy of that doc (kept in sync manually, same pattern as the repo's
 * design-token sync — CF Workers doesn't reliably support reading arbitrary
 * files at request time). The source is an unconfirmed Notion draft; Garrett
 * flagged that Jamie's canonical TToC material may live elsewhere (Drive/Word
 * docs, Slack). Do not treat a verdict from this tool as authoritative until
 * that's confirmed and both copies are updated.
 */

import { callClaude, parseJsonResponse } from "./client";

export interface TtocGateInput {
  kind: "opportunity" | "commitment" | "campaign";
  title: string;
  description: string;
}

export interface TtocVerdict {
  mustHave: {
    servesTransformativeOutcome: boolean;
    centresJustice: boolean;
    alignedWithMission: boolean;
    teamEnergised: boolean;
  };
  /** All four Must Haves true. A false here is the strongest signal in the card. */
  mustHavePass: boolean;
  shouldHave: string[];
  rejections: string[];
  tag: "survival" | "mission" | "mixed";
  rationale: string;
}

const RUBRIC = `## Must Have (Non-negotiable)
- Serves at least one Transformative Outcome clearly
- Centres justice or explicitly refuses to reproduce oppression
- Aligned with Mission Destination (aliveness, connection, regeneration, uncertainty embrace)
- Team is genuinely energised (not just revenue-driven)

## Should Have (Strongly Preferred)
- Incorporates play as mechanism or infrastructure
- Brings together multiple Transformative Outcomes
- Builds practitioner/community capacity, not just delivers service
- Generates evidence or learning that informs broader strategy
- Creates leverage for systemic change
- Includes most-affected communities in design and leadership

## Clear Rejections (Do not Do)
- Reproduces neoliberal ideology (individualises systemic problems)
- Benefits only privileged communities
- Extractive (takes from communities without giving back)
- Contradicts core values for profit
- Requires team to compromise integrity
- Creates dependency rather than self-determination
- Aestheticises justice without structural change

## Survival vs. mission
Survival work is legitimate — winded.vertigo takes on work that pays but
isn't fully mission-aligned. The requirement is that it's labelled, not that
it's refused. Tag every scored item as one of: "mission" (clearly advances
one or more Transformative Outcomes), "survival" (legitimate but not
mission-driven — keeps the lights on), or "mixed" (some of both).`;

const SYSTEM = `you are scoring one opportunity/commitment/campaign for winded.vertigo against their Transformative Theory of Change (TToC) rubric.

${RUBRIC}

be honest, not generous — a "mustHavePass: false" is a normal, useful outcome, not a failure to avoid. ground the rationale in the specific title/description given, not generic TToC language.

return ONLY json, no prose:
{
  "mustHave": {
    "servesTransformativeOutcome": true,
    "centresJustice": true,
    "alignedWithMission": true,
    "teamEnergised": true
  },
  "shouldHave": ["which should-have bullets apply, verbatim or close to it"],
  "rejections": ["which clear-rejection bullets apply, if any — empty array if none"],
  "tag": "mission",
  "rationale": "2-3 sentences grounding the verdict in specifics from the input, in TToC terms"
}`;

export async function scoreTtocGate(input: TtocGateInput, requestedBy: string): Promise<TtocVerdict> {
  const res = await callClaude({
    feature: "ttoc-gate",
    userId: requestedBy,
    system: SYSTEM,
    userMessage: `kind: ${input.kind}\ntitle: ${input.title}\ndescription: ${input.description}`,
    maxTokens: 500,
    temperature: 0,
  });

  const parsed = parseJsonResponse<Omit<TtocVerdict, "mustHavePass">>(res.text);
  const mustHavePass = Object.values(parsed.mustHave).every(Boolean);
  return { ...parsed, mustHavePass };
}
