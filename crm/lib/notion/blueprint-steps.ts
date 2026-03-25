/**
 * Blueprint steps data layer.
 */

import {
  getTitle,
  getText,
  getSelect,
  getNumber,
  getRelation,
  queryDatabase,
  type PageObjectResponse,
} from "@windedvertigo/notion";

import { notion, CRM_DB, BLUEPRINT_STEP_PROPS } from "./client";
import type { BlueprintStep } from "./types";
import { buildRelationContains } from "./filters";

const P = BLUEPRINT_STEP_PROPS;

function mapPageToBlueprintStep(page: PageObjectResponse): BlueprintStep {
  const props = page.properties;
  return {
    id: page.id,
    name: getTitle(props[P.name]),
    blueprintIds: getRelation(props[P.blueprint]),
    stepNumber: getNumber(props[P.stepNumber]) ?? 0,
    channel: getSelect(props[P.channel]) as BlueprintStep["channel"],
    templateIds: getRelation(props[P.template]),
    delayDays: getNumber(props[P.delayDays]) ?? 0,
    delayReference: getSelect(props[P.delayReference]) as BlueprintStep["delayReference"],
    notes: getText(props[P.notes]),
  };
}

/** Get all steps for a blueprint, sorted by step number. */
export async function getStepsForBlueprint(blueprintId: string): Promise<BlueprintStep[]> {
  const result = await queryDatabase(notion, {
    database_id: CRM_DB.blueprintSteps,
    filter: buildRelationContains(P.blueprint, blueprintId),
    sorts: [{ property: P.stepNumber, direction: "ascending" }],
    page_size: 20,
    label: "getStepsForBlueprint",
  });

  return result.pages.map(mapPageToBlueprintStep);
}
