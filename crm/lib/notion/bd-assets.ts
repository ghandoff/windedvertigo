/**
 * BD Assets data layer.
 */

import {
  getTitle,
  getText,
  getSelect,
  getMultiSelect,
  getStatus,
  getUrl,
  getNumber,
  getCheckbox,
  getRelation,
  queryDatabase,
  buildTitle,
  buildRichText,
  buildSelect,
  buildMultiSelect,
  buildStatus,
  buildUrl,
  buildNumber,
  buildCheckbox,
  buildRelation,
  type PageObjectResponse,
} from "@windedvertigo/notion";

import { notion, CRM_DB, BD_ASSET_PROPS } from "./client";
import type { BdAsset, PaginationParams, SortParams } from "./types";
import { buildTitleSearch, buildCompoundFilter } from "./filters";

const P = BD_ASSET_PROPS;

function mapPageToBdAsset(page: PageObjectResponse): BdAsset {
  const props = page.properties;
  return {
    id: page.id,
    asset: getTitle(props[P.asset]),
    assetType: getSelect(props[P.assetType]),
    readiness: getStatus(props[P.readiness]) as BdAsset["readiness"],
    description: getText(props[P.description]),
    slug: getText(props[P.slug]),
    tags: getMultiSelect(props[P.tags]),
    url: getUrl(props[P.url]),
    thumbnailUrl: getUrl(props[P.thumbnailUrl]),
    icon: getText(props[P.icon]),
    featured: getCheckbox(props[P.featured]),
    showInPortfolio: getCheckbox(props[P.showInPortfolio]),
    showInPackageBuilder: getCheckbox(props[P.showInPackageBuilder]),
    passwordProtected: getCheckbox(props[P.passwordProtected]),
    organizationIds: getRelation(props[P.groups]),
    createdTime: page.created_time,
  };
}

export async function queryBdAssets(
  filters?: { search?: string; readiness?: string },
  pagination?: PaginationParams,
  sort?: SortParams,
) {
  const nf: ReturnType<typeof buildTitleSearch>[] = [];

  if (filters?.search) nf.push(buildTitleSearch(P.asset, filters.search));

  const result = await queryDatabase(notion, {
    database_id: CRM_DB.bdAssets,
    filter: buildCompoundFilter(nf),
    sorts: sort
      ? [{ property: sort.property, direction: sort.direction }]
      : [{ timestamp: "last_edited_time", direction: "descending" }],
    start_cursor: pagination?.cursor,
    page_size: pagination?.pageSize ?? 50,
    label: "queryBdAssets",
  });

  return {
    data: result.pages.map(mapPageToBdAsset),
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  };
}

export async function getBdAsset(id: string): Promise<BdAsset> {
  const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse;
  return mapPageToBdAsset(page);
}

export async function createBdAsset(
  fields: Partial<BdAsset> & Pick<BdAsset, "asset">,
): Promise<BdAsset> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    [P.asset]: buildTitle(fields.asset),
  };

  if (fields.assetType) properties[P.assetType] = buildSelect(fields.assetType);
  if (fields.readiness) properties[P.readiness] = buildStatus(fields.readiness);
  if (fields.description) properties[P.description] = buildRichText(fields.description);
  if (fields.slug) properties[P.slug] = buildRichText(fields.slug);
  if (fields.tags) properties[P.tags] = buildMultiSelect(fields.tags);
  if (fields.url) properties[P.url] = buildUrl(fields.url);
  if (fields.thumbnailUrl) properties[P.thumbnailUrl] = buildUrl(fields.thumbnailUrl);
  if (fields.icon) properties[P.icon] = buildRichText(fields.icon);
  if (fields.featured !== undefined) properties[P.featured] = buildCheckbox(fields.featured);
  if (fields.showInPortfolio !== undefined) properties[P.showInPortfolio] = buildCheckbox(fields.showInPortfolio);
  if (fields.showInPackageBuilder !== undefined) properties[P.showInPackageBuilder] = buildCheckbox(fields.showInPackageBuilder);
  if (fields.organizationIds) properties[P.groups] = buildRelation(fields.organizationIds);

  const page = (await notion.pages.create({
    parent: { data_source_id: CRM_DB.bdAssets },
    properties,
  })) as PageObjectResponse;

  return mapPageToBdAsset(page);
}

export async function updateBdAsset(
  id: string,
  fields: Partial<BdAsset>,
): Promise<BdAsset> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};

  if (fields.asset !== undefined) properties[P.asset] = buildTitle(fields.asset);
  if (fields.assetType !== undefined) properties[P.assetType] = buildSelect(fields.assetType);
  if (fields.readiness !== undefined) properties[P.readiness] = buildStatus(fields.readiness);
  if (fields.description !== undefined) properties[P.description] = buildRichText(fields.description);
  if (fields.slug !== undefined) properties[P.slug] = buildRichText(fields.slug);
  if (fields.tags !== undefined) properties[P.tags] = buildMultiSelect(fields.tags);
  if (fields.url !== undefined) properties[P.url] = buildUrl(fields.url);
  if (fields.thumbnailUrl !== undefined) properties[P.thumbnailUrl] = buildUrl(fields.thumbnailUrl);
  if (fields.icon !== undefined) properties[P.icon] = buildRichText(fields.icon);
  if (fields.featured !== undefined) properties[P.featured] = buildCheckbox(fields.featured);
  if (fields.showInPortfolio !== undefined) properties[P.showInPortfolio] = buildCheckbox(fields.showInPortfolio);
  if (fields.organizationIds !== undefined) properties[P.groups] = buildRelation(fields.organizationIds);

  const page = (await notion.pages.update({
    page_id: id,
    properties,
  })) as PageObjectResponse;

  return mapPageToBdAsset(page);
}

export async function archiveBdAsset(id: string): Promise<void> {
  await notion.pages.update({ page_id: id, archived: true });
}
