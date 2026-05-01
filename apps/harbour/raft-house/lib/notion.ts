import { Client } from "@notionhq/client";
import type { Activity, ActivityConfig, ActivityType } from "./types";

const DATABASE_ID = "8ed2d02fc2e647cf9d108a66fef9306e";
const RESULTS_DATABASE_ID = "6bcdec6d77b84eb6870d83ba59720f04";

export interface NotionSession {
  name: string;
  slug: string;
  description: string;
  template: string;
  activities: Activity[] | null;
  activityCount: number;
  duration: number;
  audience: string;
  tags: string[];
  groupSize: string;
  facilitatorNotes: string;
  order: number;
  icon: string;
  interactionModels: string[];
  socialStructures: string[];
  tempo: string;
}

// map common template names / slugs to icons
const ICON_MAP: Record<string, string> = {
  // legacy templates
  "play-as-pedagogy": "\u{1F3AD}",
  "the-sunk-cost-trap": "\u2693",
  "opportunity-cost-demo": "\u{1F4B0}",
  "opportunity-cost": "\u{1F4B0}",
  "systems-thinking": "\u{1F310}",
  // original 12
  "orbit.lab": "\u{1FA90}",
  "proof.garden": "\u{1F33F}",
  "signal.flow": "\u{1F4E1}",
  "bias.lens": "\u{1F50D}",
  "scale.shift": "\u2696\uFE0F",
  "pattern.weave": "\u{1F9F6}",
  "market.mind": "\u{1F4C8}",
  "rhythm.lab": "\u{1F3B6}",
  "code.weave": "\u{1F9EC}",
  "time.prism": "\u{1F52E}",
  "liminal.pass": "\u{1F6AA}",
  "emerge.box": "\u{1F4E6}",
  // mathematics
  "fold.space": "\u{1F4D0}",
  "infinity.hotel": "\u{1F3E8}",
  "variable.engine": "\u2699\uFE0F",
  // computer science
  "race.condition": "\u{1F3C1}",
  "type.tower": "\u{1F5FC}",
  "state.craft": "\u{1F916}",
  // physics
  "frame.shift": "\u{1F30C}",
  "entropy.garden": "\u{1F331}",
  "field.canvas": "\u{1F9F2}",
  // biology
  "selection.pressure": "\u{1F98E}",
  "express.ion": "\u{1F9EC}",
  "web.pulse": "\u{1F578}\uFE0F",
  // chemistry
  "bond.craft": "\u269B\uFE0F",
  "equilibrium.dance": "\u{1FA69}",
  "reaction.path": "\u{1F9EA}",
  // economics
  "margin.call": "\u{1F4B9}",
  "trade.winds": "\u26F5",
  "commons.game": "\u{1F33E}",
  // psychology
  "mirror.maze": "\u{1FA9E}",
  "anchor.drift": "\u2693",
  "story.self": "\u{1F4D6}",
  // philosophy
  "ought.machine": "\u{1F914}",
  "circle.read": "\u{1F504}",
  "lens.shift": "\u{1F453}",
  // music
  "tone.field": "\u{1F3B5}",
  "voice.weave": "\u{1F3BC}",
  "sound.color": "\u{1F3A8}",
  // visual arts & design
  "space.between": "\u25FB\uFE0F",
  "hue.shift": "\u{1F308}",
  "grid.break": "\u{1F4CF}",
  // writing & language
  "reader.ghost": "\u{1F47B}",
  "draft.loop": "\u{1F501}",
  "genre.shift": "\u{1F4DD}",
};

function iconForSlug(slug: string): string {
  return ICON_MAP[slug] ?? "\u{1F9ED}";
}

// ── helpers to read Notion property values ──────────────────────

function richTextToString(prop: unknown): string {
  const arr = (prop as { rich_text?: { plain_text: string }[] })?.rich_text;
  if (!arr || arr.length === 0) return "";
  return arr.map((t) => t.plain_text).join("");
}

function titleToString(prop: unknown): string {
  const arr = (prop as { title?: { plain_text: string }[] })?.title;
  if (!arr || arr.length === 0) return "";
  return arr.map((t) => t.plain_text).join("");
}

function numberValue(prop: unknown): number {
  return (prop as { number?: number | null })?.number ?? 0;
}

function selectValue(prop: unknown): string {
  return (prop as { select?: { name: string } | null })?.select?.name ?? "";
}

function multiSelectValues(prop: unknown): string[] {
  const opts = (prop as { multi_select?: { name: string }[] })?.multi_select;
  if (!opts) return [];
  return opts.map((o) => o.name);
}

// ── normalize Notion activity JSON → typed Activity ─────────────
// Notion stores a flat config object; the app expects a discriminated
// union with nested keys (e.g. { type: "sorting", sorting: {...} }).
// This function bridges the two shapes at the system boundary.

interface RawNotionActivity {
  id: string;
  type: string;
  phase?: string;
  label?: string;
  config: Record<string, unknown>;
  timeLimit?: number;
  hints?: string[];
  mechanic?: Record<string, unknown>;
}

function toId(s: string, i: number): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-") || `item-${i}`;
}

function normalizeConfig(
  type: ActivityType,
  raw: Record<string, unknown>,
): ActivityConfig {
  switch (type) {
    case "poll": {
      const options = Array.isArray(raw.options)
        ? raw.options.map((o: unknown, i: number) =>
            typeof o === "string"
              ? { id: toId(o, i), label: o }
              : (o as { id: string; label: string }),
          )
        : [];
      return {
        type: "poll",
        poll: {
          question: (raw.question ?? raw.prompt ?? "") as string,
          options,
          allowMultiple: raw.allowMultiple as boolean | undefined,
        },
      };
    }

    case "prediction": {
      const options = Array.isArray(raw.options)
        ? raw.options.map((o: unknown, i: number) =>
            typeof o === "string"
              ? { id: toId(o, i), label: o }
              : (o as { id: string; label: string }),
          )
        : undefined;
      return {
        type: "prediction",
        prediction: {
          question: (raw.question ?? raw.prompt ?? "") as string,
          type: (raw.type as "number" | "text" | "choice") ?? (options ? "choice" : "text"),
          options,
          answer: raw.answer as string | number | undefined,
          unit: raw.unit as string | undefined,
        },
      };
    }

    case "reflection":
      return {
        type: "reflection",
        reflection: {
          prompt: (raw.prompt ?? "") as string,
          minLength: raw.minLength as number | undefined,
          shareWithGroup: raw.shareWithGroup as boolean | undefined,
        },
      };

    case "open-response":
      return {
        type: "open-response",
        openResponse: {
          prompt: (raw.prompt ?? "") as string,
          responseType: (raw.responseType as "text" | "drawing") ?? "text",
          anonymous: raw.anonymous as boolean | undefined,
        },
      };

    case "puzzle": {
      const pieces = Array.isArray(raw.pieces)
        ? raw.pieces.map((p: unknown, i: number) =>
            typeof p === "string"
              ? { id: toId(p, i), content: p }
              : (p as { id: string; content: string; hint?: string }),
          )
        : [];
      return {
        type: "puzzle",
        puzzle: {
          prompt: (raw.prompt ?? "") as string,
          pieces,
          solution: (raw.solution ?? []) as string[],
          revealOrder: raw.revealOrder as boolean | undefined,
        },
      };
    }

    case "asymmetric": {
      const roles = Array.isArray(raw.roles)
        ? raw.roles.map((r: unknown, i: number) => {
            if (typeof r === "string")
              return { id: toId(r, i), label: r, info: "", question: "" };
            return r as { id: string; label: string; info: string; question: string };
          })
        : [];
      return {
        type: "asymmetric",
        asymmetric: {
          scenario: (raw.scenario ?? raw.prompt ?? "") as string,
          roles,
          discussionPrompt: (raw.discussionPrompt ?? "") as string,
          revealPrompt: raw.revealPrompt as string | undefined,
        },
      };
    }

    case "canvas": {
      return {
        type: "canvas",
        canvas: {
          prompt: (raw.prompt ?? "") as string,
          width: (raw.width as number) ?? 800,
          height: (raw.height as number) ?? 600,
          xLabel: raw.xLabel as string | undefined,
          yLabel: raw.yLabel as string | undefined,
          allowNote: raw.allowNote as boolean | undefined,
        },
      };
    }

    case "sorting": {
      // Notion may use items: string[] instead of cards: SortingCard[]
      const cards = Array.isArray(raw.cards)
        ? raw.cards.map((c: unknown, i: number) =>
            typeof c === "string"
              ? { id: toId(c, i), content: c }
              : (c as { id: string; content: string; hint?: string }),
          )
        : Array.isArray(raw.items)
          ? (raw.items as string[]).map((s, i) => ({
              id: toId(s, i),
              content: s,
            }))
          : [];

      const categories = Array.isArray(raw.categories)
        ? raw.categories.map((c: unknown, i: number) =>
            typeof c === "string"
              ? { id: toId(c, i), label: c }
              : (c as { id: string; label: string; description?: string }),
          )
        : [];

      return {
        type: "sorting",
        sorting: {
          prompt: (raw.prompt ?? "") as string,
          cards,
          categories,
          solution: raw.solution as Record<string, string> | undefined,
        },
      };
    }

    case "rule-sandbox": {
      const parameters = Array.isArray(raw.parameters)
        ? (raw.parameters as Array<Record<string, unknown>>).map((p, i) => ({
            id: (p.id as string) ?? `param-${i}`,
            label: (p.label as string) ?? "",
            min: (p.min as number) ?? 0,
            max: (p.max as number) ?? 100,
            step: (p.step as number) ?? 1,
            defaultValue: (p.defaultValue as number) ?? 0,
            unit: p.unit as string | undefined,
          }))
        : [];
      return {
        type: "rule-sandbox",
        ruleSandbox: {
          prompt: (raw.prompt ?? "") as string,
          parameters,
          formula: (raw.formula ?? "") as string,
          outputLabel: (raw.outputLabel ?? "") as string,
          outputUnit: raw.outputUnit as string | undefined,
          reflectionPrompt: (raw.reflectionPrompt ?? "") as string,
        },
      };
    }
  }
}

function normalizeActivity(raw: RawNotionActivity): Activity | null {
  const actType = raw.type as ActivityType;
  const validTypes: ActivityType[] = [
    "poll", "prediction", "reflection", "open-response",
    "puzzle", "asymmetric", "canvas", "sorting", "rule-sandbox",
  ];
  if (!validTypes.includes(actType)) return null;

  // If config already has the discriminated union shape, pass through
  if (raw.config && "type" in raw.config && raw.config.type === actType) {
    const configKey = actType === "open-response"
      ? "openResponse"
      : actType === "rule-sandbox"
        ? "ruleSandbox"
        : actType;
    if (configKey in raw.config) {
      return raw as unknown as Activity;
    }
  }

  return {
    id: raw.id,
    type: actType,
    config: normalizeConfig(actType, raw.config),
    phase: (raw.phase ?? "encounter") as Activity["phase"],
    label: raw.label ?? "",
    timeLimit: raw.timeLimit,
    hints: raw.hints,
    mechanic: raw.mechanic as Activity["mechanic"],
  };
}

// ── fetch sessions from Notion ──────────────────────────────────

export async function fetchSessionsFromNotion(): Promise<NotionSession[]> {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    throw new Error("NOTION_API_KEY is not set");
  }

  const notion = new Client({ auth: apiKey });

  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      property: "Status",
      select: { equals: "ready" },
    },
    sorts: [{ property: "Order", direction: "ascending" }],
  });

  return response.results.map((page) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const props = (page as any).properties as Record<string, unknown>;

    const slug = richTextToString(props["Slug"]);
    const activitiesRaw = richTextToString(props["Activities"]);

    let activities: Activity[] | null = null;
    if (activitiesRaw) {
      try {
        const parsed = JSON.parse(activitiesRaw) as RawNotionActivity[];
        const normalized = parsed
          .map(normalizeActivity)
          .filter((a): a is Activity => a !== null);
        activities = normalized.length > 0 ? normalized : null;
      } catch {
        // invalid JSON — will fall back to template-generated activities
        activities = null;
      }
    }

    return {
      name: titleToString(props["Name"]),
      slug,
      description: richTextToString(props["Description"]),
      template: selectValue(props["Template"]),
      activities,
      activityCount: numberValue(props["Activity Count"]),
      duration: numberValue(props["Duration"]),
      audience: richTextToString(props["Audience"]),
      tags: multiSelectValues(props["Tags"]),
      groupSize: richTextToString(props["Group Size"]),
      facilitatorNotes: richTextToString(props["Facilitator Notes"]),
      order: numberValue(props["Order"]),
      icon: iconForSlug(slug),
      interactionModels: multiSelectValues(props["Interaction Model"]),
      socialStructures: multiSelectValues(props["Social Structure"]),
      tempo: selectValue(props["Tempo"]),
    };
  });
}

// ── session results: write + read ──────────────────────────────

export interface SessionResultPayload {
  sessionName: string;
  code: string;
  template: string;
  facilitator: string;
  participantCount: number;
  activityCount: number;
  date: string; // ISO-8601
  results: string; // markdown report
}

export async function saveSessionResults(
  payload: SessionResultPayload,
): Promise<string> {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) throw new Error("NOTION_API_KEY is not set");

  const notion = new Client({ auth: apiKey });

  // Notion rich_text has a 2000-char limit per block — truncate if needed
  const resultsText =
    payload.results.length > 2000
      ? payload.results.slice(0, 1997) + "..."
      : payload.results;

  const response = await notion.pages.create({
    parent: { database_id: RESULTS_DATABASE_ID },
    properties: {
      Session: { title: [{ text: { content: payload.sessionName } }] },
      Code: { rich_text: [{ text: { content: payload.code } }] },
      Template: { rich_text: [{ text: { content: payload.template } }] },
      Facilitator: {
        rich_text: [{ text: { content: payload.facilitator } }],
      },
      Participants: { number: payload.participantCount },
      Activities: { number: payload.activityCount },
      Date: { date: { start: payload.date } },
      Status: { select: { name: "completed" } },
      Results: { rich_text: [{ text: { content: resultsText } }] },
    },
  });

  return response.id;
}

export interface SessionHistoryEntry {
  id: string;
  sessionName: string;
  code: string;
  template: string;
  facilitator: string;
  participantCount: number;
  activityCount: number;
  date: string;
  status: string;
}

export async function fetchSessionHistory(): Promise<SessionHistoryEntry[]> {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) throw new Error("NOTION_API_KEY is not set");

  const notion = new Client({ auth: apiKey });

  const response = await notion.databases.query({
    database_id: RESULTS_DATABASE_ID,
    sorts: [{ property: "Date", direction: "descending" }],
    page_size: 50,
  });

  return response.results.map((page) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const props = (page as any).properties as Record<string, unknown>;

    return {
      id: page.id,
      sessionName: titleToString(props["Session"]),
      code: richTextToString(props["Code"]),
      template: richTextToString(props["Template"]),
      facilitator: richTextToString(props["Facilitator"]),
      participantCount: numberValue(props["Participants"]),
      activityCount: numberValue(props["Activities"]),
      date: dateValue(props["Date"]),
      status: selectValue(props["Status"]),
    };
  });
}

export async function fetchSessionResult(
  pageId: string,
): Promise<{ entry: SessionHistoryEntry; results: string } | null> {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) throw new Error("NOTION_API_KEY is not set");

  const notion = new Client({ auth: apiKey });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = (await notion.pages.retrieve({ page_id: pageId })) as any;
    const props = page.properties as Record<string, unknown>;

    return {
      entry: {
        id: page.id,
        sessionName: titleToString(props["Session"]),
        code: richTextToString(props["Code"]),
        template: richTextToString(props["Template"]),
        facilitator: richTextToString(props["Facilitator"]),
        participantCount: numberValue(props["Participants"]),
        activityCount: numberValue(props["Activities"]),
        date: dateValue(props["Date"]),
        status: selectValue(props["Status"]),
      },
      results: richTextToString(props["Results"]),
    };
  } catch {
    return null;
  }
}

function dateValue(prop: unknown): string {
  return (prop as { date?: { start?: string } | null })?.date?.start ?? "";
}
