/**
 * Human-side ingestion — the 7 Notion CV collections → nodes/edges.
 *
 * Deterministic: every edge is an already-authored Notion relation. Tagged
 * source: notion-cv, kind: human. Node ids are `cv:<category>:<pageid>` with
 * dashes stripped so relation ids and page ids match consistently.
 *
 * IMPORTANT: traverse `CV Entries (canonical)` only — never the deprecated
 * `CV Entries` relation (a broken migration left it pointing at dead rows).
 */

import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { notion } from "@/lib/notion/client";
import { queryDatabase } from "@/lib/shared/notion/pagination";
import {
  getTitle,
  getText,
  getSelect,
  getMultiSelect,
  getCheckbox,
  getNumber,
  getRelation,
  getDate,
} from "@/lib/shared/notion/extractors";
import { canonicalKey } from "./types";
import type { NodeInput, EdgeInput } from "./supabase";

// ── data-source ids (collection UUIDs) ───────────────────────
const DS = {
  members: "cc118d3a-960e-4cb6-b78e-f2709f3c64b7",
  skills: "f8217826-9e87-40f7-bd52-1ccc68ab97ef",
  methods: "7662ac4c-5d69-4271-99f8-9460e7725a5a",
  frameworks: "44c781fb-5a83-4cec-9ba5-5854fa81f7a1",
  populations: "92526e4a-c186-48d2-905a-ab115afa7693",
  services: "927d263d-9cdc-4be4-bf71-c8cdbddfbc14",
  entries: "40460923-745a-475a-b42b-aa5f215f6b75",
} as const;

type Props = PageObjectResponse["properties"];

/** strip dashes so a relation id and a page id are the same string */
const normId = (id: string) => id.replace(/-/g, "");
const nodeId = (cat: string, pageId: string) => `cv:${cat}:${normId(pageId)}`;

/** find the title property regardless of its column name */
function autoTitle(props: Props): string {
  for (const v of Object.values(props)) {
    if ((v as { type?: string }).type === "title") return getTitle(v as never);
  }
  return "";
}

async function fetchAll(dataSourceId: string, label: string): Promise<PageObjectResponse[]> {
  const { pages } = await queryDatabase(notion, {
    database_id: dataSourceId,
    fetchAll: true,
    page_size: 100,
    label,
  });
  return pages;
}

function baseNode(
  category: NodeInput["category"],
  page: PageObjectResponse,
  label: string,
  description: string,
  attrs: Record<string, unknown>,
): NodeInput {
  return {
    id: nodeId(category, page.id),
    kind: "human",
    category,
    label: label || "(untitled)",
    canonicalKey: canonicalKey(label),
    source: "notion-cv",
    sourceRef: page.url,
    description,
    attrs,
  };
}

/** build edges from a relation property to a target category */
function relEdges(
  fromId: string,
  props: Props,
  prop: string,
  targetCat: string,
  relationship: string,
): EdgeInput[] {
  return getRelation(props[prop] as never).map((relId) => ({
    sourceId: fromId,
    targetId: nodeId(targetCat, relId),
    relationship,
    source: "notion-cv" as const,
  }));
}

export interface NotionIngestResult {
  nodes: NodeInput[];
  edges: EdgeInput[];
  counts: Record<string, number>;
}

// Former collective members — excluded from the knowledge graph permanently.
// IDs are the normId(page.id) values (dashes stripped), matching the cv:member:<id> node format.
const FORMER_MEMBER_IDS = new Set([
  "184125678aee4186817e2b573574b6d6", // apoorva shivaram, phd
  "1b2f59613704483a9c814da4389585ef", // marietta monge
]);

export async function ingestNotionCv(): Promise<NotionIngestResult> {
  const nodes: NodeInput[] = [];
  const edges: EdgeInput[] = [];
  const counts: Record<string, number> = {};

  // ── members (human actors) ─────────────────────────────────
  const members = await fetchAll(DS.members, "kg:members");
  for (const p of members) {
    if (FORMER_MEMBER_IDS.has(normId(p.id))) continue;
    const props = p.properties;
    const label = getTitle(props["first & last name"]);
    const id = nodeId("member", p.id);
    nodes.push(
      baseNode("member", p, label, getText(props["bio"]) || getText(props["Pull Quote"]), {
        agent: "shared",
        role: getText(props["company role"]),
        active: getCheckbox(props["active"]),
        orientation: getMultiSelect(props["Methodological Orientation"]),
        sectors: getMultiSelect(props["Sectors of Deepest Experience"]),
        geographies: getMultiSelect(props["Geographies of Deepest Experience"]),
        languages: getMultiSelect(props["Languages with Proficiency"]),
        theoreticalOrientation: getText(props["Theoretical Orientation"]),
      }),
    );
    edges.push(
      ...relEdges(id, props, "Skills", "skill", "holds-skill"),
      ...relEdges(id, props, "Methodological Strengths", "method", "uses-method"),
      ...relEdges(id, props, "CV Entries (canonical)", "cv-entry", "authored"),
      ...relEdges(id, props, "Services Led", "service", "leads-service"),
      ...relEdges(id, props, "Services Supporting", "service", "supports-service"),
    );
  }
  counts.members = members.length;

  // ── skills ─────────────────────────────────────────────────
  const skills = await fetchAll(DS.skills, "kg:skills");
  for (const p of skills) {
    const props = p.properties;
    const label = getTitle(props["Skill"]) || autoTitle(props);
    const id = nodeId("skill", p.id);
    nodes.push(
      baseNode("skill", p, label, getText(props["Description"]) || getText(props["Standard Claim Language"]), {
        category: getSelect(props["Category"]),
        family: getSelect(props["Skill Family"]),
        publicFacing: getCheckbox(props["Public-facing"]),
        priority: getNumber(props["Priority"]),
        claim: getText(props["Standard Claim Language"]),
      }),
    );
    edges.push(
      ...relEdges(id, props, "Related Methods & Tools", "method", "related-method"),
      ...relEdges(id, props, "Related Frameworks", "framework", "related-framework"),
      ...relEdges(id, props, "Service Offerings", "service", "supports-service"),
    );
  }
  counts.skills = skills.length;

  // ── methods & tools (leaves; relations come from the other side) ──
  const methods = await fetchAll(DS.methods, "kg:methods");
  for (const p of methods) {
    nodes.push(
      baseNode("method", p, autoTitle(p.properties), getText(p.properties["Description"]), {
        kind: getSelect(p.properties["Kind"]),
        publicFacing: getCheckbox(p.properties["Public-facing"]),
      }),
    );
  }
  counts.methods = methods.length;

  // ── frameworks & intellectual assets (the theories) ────────
  const frameworks = await fetchAll(DS.frameworks, "kg:frameworks");
  for (const p of frameworks) {
    nodes.push(
      baseNode("framework", p, autoTitle(p.properties), getText(p.properties["Description"]), {
        authorship: getSelect(p.properties["Authorship"]),
        originatingOrg: getText(p.properties["Originating Org"]),
      }),
    );
  }
  counts.frameworks = frameworks.length;

  // ── populations & audiences ────────────────────────────────
  const populations = await fetchAll(DS.populations, "kg:populations");
  for (const p of populations) {
    nodes.push(baseNode("population", p, autoTitle(p.properties), getText(p.properties["Description"]), {}));
  }
  counts.populations = populations.length;

  // ── service offerings ──────────────────────────────────────
  const services = await fetchAll(DS.services, "kg:services");
  for (const p of services) {
    nodes.push(
      baseNode("service", p, autoTitle(p.properties), getText(p.properties["Description"]), {
        priority: getNumber(p.properties["Priority"]),
        publicOnWebsite: getCheckbox(p.properties["Public-on-website"]),
      }),
    );
  }
  counts.services = services.length;

  // ── canonical cv entries (the evidence) ────────────────────
  const entries = await fetchAll(DS.entries, "kg:entries");
  for (const p of entries) {
    const props = p.properties;
    const label = getTitle(props["Entry"]) || autoTitle(props);
    const id = nodeId("cv-entry", p.id);
    const endDate = getDate(props["End Date"])?.start ?? getDate(props["Start Date"])?.start ?? null;
    nodes.push(
      baseNode("cv-entry", p, label, getText(props["Description"]) || getText(props["Proposal-Ready Blurb"]), {
        type: getSelect(props["Type"]),
        subType: getSelect(props["Sub-type"]),
        status: getSelect(props["Status"]),
        visibility: getSelect(props["Visibility"]),
        confidence: getSelect(props["Confidence Level"]),
        clientType: getSelect(props["Client or Funder Type"]),
        country: getText(props["Country"]),
        geography: getMultiSelect(props["Geography"]),
        domain: getMultiSelect(props["Domain"]),
        tags: getMultiSelect(props["Tags"]),
        quantifiedImpact: getText(props["Quantified Impact"]),
        organization: getText(props["Organization"]),
        includeByDefault: getCheckbox(props["Include by Default"]),
        startDate: getDate(props["Start Date"])?.start ?? null,
        endDate,
      }),
    );
    edges.push(
      ...relEdges(id, props, "Skills Demonstrated", "skill", "demonstrates"),
      ...relEdges(id, props, "Methods & Tools Used", "method", "uses-method"),
      ...relEdges(id, props, "Frameworks Applied", "framework", "applies-framework"),
      ...relEdges(id, props, "Populations Served", "population", "serves-population"),
      ...relEdges(id, props, "Service Offering", "service", "exemplifies"),
    );
  }
  counts.entries = entries.length;

  return { nodes, edges, counts };
}
