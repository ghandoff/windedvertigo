import { fetchSessionsFromNotion } from "@/lib/notion";
import type { NotionSession } from "@/lib/notion";
import { DEMO_SESSION, playAsPedagogy, sunkCostTrap, systemsThinking } from "@/lib/templates";
import type { Activity } from "@/lib/types";
import FacilitateClient from "./facilitate-client";
import type { SessionTemplate } from "./facilitate-client";

export const revalidate = 3600; // ISR — revalidate every hour

// ── hardcoded fallback templates ────────────────────────────────

const FALLBACK_TEMPLATES: SessionTemplate[] = [
  {
    name: "play as pedagogy",
    description:
      "cross the threshold from 'play is a vehicle for learning' to 'play IS the cognitive mechanism of learning.' asymmetric perspectives from huizinga, vygotsky, papert, and mcgonigal.",
    activities: playAsPedagogy(),
    icon: "\u{1F3AD}",
  },
  {
    name: "the sunk cost trap",
    description:
      "why do we keep going when we should stop? prediction, puzzle sequencing, asymmetric role-play (founder vs advisor vs user vs engineer), and a personal reckoning.",
    activities: sunkCostTrap(),
    icon: "\u2693",
  },
  {
    name: "systems thinking",
    description:
      "why do more workers not mean more output? explore diminishing returns with live sliders, sort linear vs systemic assumptions, then map where your project sits on the cynefin framework.",
    activities: systemsThinking(),
    icon: "\u{1F310}",
  },
  {
    name: "opportunity cost (demo)",
    description:
      "a classic crossing session about the threshold concept of opportunity cost. predict \u2192 explore \u2192 reveal \u2192 reflect \u2192 apply.",
    activities: DEMO_SESSION,
    icon: "\u{1F4B0}",
  },
];

// ── slug → template function fallback map ───────────────────────

const SLUG_TO_ACTIVITIES: Record<string, () => Activity[]> = {
  "play-as-pedagogy": playAsPedagogy,
  "the-sunk-cost-trap": sunkCostTrap,
  "systems-thinking": systemsThinking,
  "opportunity-cost-demo": () => DEMO_SESSION,
};

function notionSessionToTemplate(session: NotionSession): SessionTemplate {
  // use Notion-provided activities if they exist, otherwise fall back to
  // template functions keyed by slug
  let activities: Activity[];
  if (session.activities && session.activities.length > 0) {
    activities = session.activities;
  } else if (SLUG_TO_ACTIVITIES[session.slug]) {
    activities = SLUG_TO_ACTIVITIES[session.slug]();
  } else {
    // no activities from Notion and no matching template — empty array
    activities = [];
  }

  return {
    name: session.name,
    description: session.description,
    activities,
    icon: session.icon,
  };
}

// ── server component ────────────────────────────────────────────

export default async function FacilitatePage() {
  let templates: SessionTemplate[];

  try {
    const sessions = await fetchSessionsFromNotion();
    if (sessions.length === 0) {
      // no sessions with Status = "ready" — use fallback
      templates = FALLBACK_TEMPLATES;
    } else {
      templates = sessions.map(notionSessionToTemplate);
    }
  } catch {
    // Notion fetch failed — use hardcoded fallback
    templates = FALLBACK_TEMPLATES;
  }

  return <FacilitateClient templates={templates} />;
}
