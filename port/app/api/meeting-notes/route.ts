/**
 * POST /api/meeting-notes
 *
 * Creates a new page in the port meetings Notion database with a
 * structured body template (agenda, notes, action items, decisions).
 *
 * Discovers the target database's property schema at runtime so the
 * payload can match property names and types, with sensible fallbacks
 * ("Name", "Date", "Attendees", "Project") if discovery fails.
 */

import { NextRequest } from "next/server";
import { notion } from "@/lib/notion/client";
import { json, error, withNotionError } from "@/lib/api-helpers";

const MEETINGS_DB_ID = "224e4ee74ba48174b095e91e32c88f81";

type NotionProperty = {
  id: string;
  name: string;
  type: string;
};

interface SchemaShape {
  titleProp: string;
  dateProp: string | null;
  attendeesProp: string | null;
  attendeesType: "people" | "relation" | "multi_select" | null;
  projectProp: string | null;
}

// Cache the schema for 5 minutes to avoid hitting the retrieve endpoint
// on every create call.
let cachedSchema: { at: number; shape: SchemaShape } | null = null;
const SCHEMA_TTL_MS = 5 * 60 * 1000;

async function resolveSchema(): Promise<SchemaShape> {
  if (cachedSchema && Date.now() - cachedSchema.at < SCHEMA_TTL_MS) {
    return cachedSchema.shape;
  }

  // Reasonable fallback defaults — used if retrieve fails.
  const fallback: SchemaShape = {
    titleProp: "Name",
    dateProp: "Date",
    attendeesProp: "Attendees",
    attendeesType: "people",
    projectProp: "Project",
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = await notion.databases.retrieve({ database_id: MEETINGS_DB_ID });
    const props = db.properties as Record<string, NotionProperty>;

    let titleProp = fallback.titleProp;
    let dateProp: string | null = null;
    let attendeesProp: string | null = null;
    let attendeesType: SchemaShape["attendeesType"] = null;
    let projectProp: string | null = null;

    for (const [name, p] of Object.entries(props)) {
      const lower = name.toLowerCase();
      if (p.type === "title") titleProp = name;
      if (p.type === "date" && (lower === "date" || lower.includes("date")) && !dateProp) {
        dateProp = name;
      }
      if (
        (p.type === "people" || p.type === "relation" || p.type === "multi_select") &&
        (lower.includes("attendee") || lower.includes("participant") || lower === "people")
      ) {
        attendeesProp = name;
        attendeesType = p.type as SchemaShape["attendeesType"];
      }
      if (p.type === "relation" && (lower.includes("project"))) {
        projectProp = name;
      }
    }

    const shape: SchemaShape = {
      titleProp,
      dateProp,
      attendeesProp,
      attendeesType,
      projectProp,
    };
    cachedSchema = { at: Date.now(), shape };
    return shape;
  } catch (err) {
    console.warn("[meeting-notes] schema discovery failed, using fallbacks:", err);
    return fallback;
  }
}

function bodyTemplate() {
  const heading = (text: string) => ({
    object: "block",
    type: "heading_2",
    heading_2: { rich_text: [{ type: "text", text: { content: text } }] },
  });
  const emptyPara = () => ({
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: [] },
  });
  return [
    heading("agenda"),
    emptyPara(),
    heading("notes"),
    emptyPara(),
    heading("action items"),
    emptyPara(),
    heading("decisions"),
    emptyPara(),
  ];
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.title || typeof body.title !== "string") {
    return error("title is required");
  }

  const title: string = body.title.trim();
  const date: string | undefined = body.date;
  const attendeeIds: string[] = Array.isArray(body.attendeeIds) ? body.attendeeIds : [];
  const projectId: string | undefined = body.projectId;

  return withNotionError(async () => {
    const schema = await resolveSchema();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: Record<string, any> = {
      [schema.titleProp]: {
        title: [{ type: "text", text: { content: title } }],
      },
    };

    if (date && schema.dateProp) {
      properties[schema.dateProp] = { date: { start: date } };
    }

    if (attendeeIds.length > 0 && schema.attendeesProp && schema.attendeesType) {
      if (schema.attendeesType === "people") {
        properties[schema.attendeesProp] = {
          people: attendeeIds.map((id) => ({ id })),
        };
      } else if (schema.attendeesType === "relation") {
        properties[schema.attendeesProp] = {
          relation: attendeeIds.map((id) => ({ id })),
        };
      } else if (schema.attendeesType === "multi_select") {
        // fallback — attendee ids interpreted as names (unlikely but safe)
        properties[schema.attendeesProp] = {
          multi_select: attendeeIds.map((name) => ({ name })),
        };
      }
    }

    if (projectId && schema.projectProp) {
      properties[schema.projectProp] = {
        relation: [{ id: projectId }],
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page: any = await notion.pages.create({
      parent: { database_id: MEETINGS_DB_ID },
      properties,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      children: bodyTemplate() as any,
    });

    return json(
      {
        pageId: page.id,
        pageUrl: page.url,
        schema,
      },
      201,
    );
  });
}
