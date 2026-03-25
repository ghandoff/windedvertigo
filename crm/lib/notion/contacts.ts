/**
 * Contacts (people) data layer.
 */

import {
  getTitle,
  getText,
  getSelect,
  getEmail,
  getPhone,
  getUrl,
  getDate,
  getCheckbox,
  getRelation,
  getPerson,
  queryDatabase,
  buildTitle,
  buildRichText,
  buildSelect,
  buildEmail,
  buildPhone,
  buildUrl,
  buildCheckbox,
  buildDate,
  buildRelation,
  buildPerson,
  type PageObjectResponse,
} from "@windedvertigo/notion";

import { notion, CRM_DB, CONTACT_PROPS } from "./client";
import type { Contact, ContactFilters, PaginationParams, SortParams } from "./types";
import {
  buildSelectFilter,
  buildCheckboxFilter,
  buildTitleSearch,
  buildCompoundFilter,
} from "./filters";

const P = CONTACT_PROPS;

function mapPageToContact(page: PageObjectResponse): Contact {
  const props = page.properties;
  return {
    id: page.id,
    name: getTitle(props[P.name]),
    email: getEmail(props[P.email]),
    role: getText(props[P.role]),
    contactType: getSelect(props[P.contactType]) as Contact["contactType"],
    contactWarmth: getSelect(props[P.contactWarmth]) as Contact["contactWarmth"],
    responsiveness: getSelect(props[P.responsiveness]) as Contact["responsiveness"],
    referralPotential: getCheckbox(props[P.referralPotential]),
    relationshipStage: getSelect(props[P.relationshipStage]) as Contact["relationshipStage"],
    lastContacted: getDate(props[P.lastContacted]),
    nextAction: getText(props[P.nextAction]),
    linkedin: getUrl(props[P.linkedin]),
    phoneNumber: getPhone(props[P.phoneNumber]),
    organizationIds: getRelation(props[P.organization]),
    nodeUserIds: getPerson(props[P.node]),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function queryContacts(
  filters?: ContactFilters,
  pagination?: PaginationParams,
  sort?: SortParams,
) {
  const nf: ReturnType<typeof buildSelectFilter>[] = [];

  if (filters) {
    if (filters.contactType) nf.push(buildSelectFilter(P.contactType, filters.contactType));
    if (filters.contactWarmth) nf.push(buildSelectFilter(P.contactWarmth, filters.contactWarmth));
    if (filters.responsiveness) nf.push(buildSelectFilter(P.responsiveness, filters.responsiveness));
    if (filters.referralPotential !== undefined) nf.push(buildCheckboxFilter(P.referralPotential, filters.referralPotential));
    if (filters.relationshipStage) nf.push(buildSelectFilter(P.relationshipStage, filters.relationshipStage));
    if (filters.search) nf.push(buildTitleSearch(P.name, filters.search));
  }

  const result = await queryDatabase(notion, {
    database_id: CRM_DB.contacts,
    filter: buildCompoundFilter(nf),
    sorts: sort
      ? [{ property: sort.property, direction: sort.direction }]
      : [{ timestamp: "last_edited_time", direction: "descending" }],
    start_cursor: pagination?.cursor,
    page_size: pagination?.pageSize ?? 50,
    label: "queryContacts",
  });

  return {
    data: result.pages.map(mapPageToContact),
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  };
}

export async function getContact(id: string): Promise<Contact> {
  const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse;
  return mapPageToContact(page);
}

export async function createContact(
  fields: Partial<Contact> & Pick<Contact, "name">,
): Promise<Contact> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    [P.name]: buildTitle(fields.name),
  };

  if (fields.email) properties[P.email] = buildEmail(fields.email);
  if (fields.role) properties[P.role] = buildRichText(fields.role);
  if (fields.contactType) properties[P.contactType] = buildSelect(fields.contactType);
  if (fields.contactWarmth) properties[P.contactWarmth] = buildSelect(fields.contactWarmth);
  if (fields.responsiveness) properties[P.responsiveness] = buildSelect(fields.responsiveness);
  if (fields.referralPotential !== undefined) properties[P.referralPotential] = buildCheckbox(fields.referralPotential);
  if (fields.relationshipStage) properties[P.relationshipStage] = buildSelect(fields.relationshipStage);
  if (fields.lastContacted) properties[P.lastContacted] = buildDate(fields.lastContacted);
  if (fields.nextAction) properties[P.nextAction] = buildRichText(fields.nextAction);
  if (fields.linkedin) properties[P.linkedin] = buildUrl(fields.linkedin);
  if (fields.phoneNumber) properties[P.phoneNumber] = buildPhone(fields.phoneNumber);
  if (fields.organizationIds) properties[P.organization] = buildRelation(fields.organizationIds);
  if (fields.nodeUserIds) properties[P.node] = buildPerson(fields.nodeUserIds);

  const page = (await notion.pages.create({
    parent: { data_source_id: CRM_DB.contacts },
    properties,
  })) as PageObjectResponse;

  return mapPageToContact(page);
}

export async function updateContact(
  id: string,
  fields: Partial<Contact>,
): Promise<Contact> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};

  if (fields.name !== undefined) properties[P.name] = buildTitle(fields.name);
  if (fields.email !== undefined) properties[P.email] = buildEmail(fields.email);
  if (fields.role !== undefined) properties[P.role] = buildRichText(fields.role);
  if (fields.contactType !== undefined) properties[P.contactType] = buildSelect(fields.contactType);
  if (fields.contactWarmth !== undefined) properties[P.contactWarmth] = buildSelect(fields.contactWarmth);
  if (fields.responsiveness !== undefined) properties[P.responsiveness] = buildSelect(fields.responsiveness);
  if (fields.referralPotential !== undefined) properties[P.referralPotential] = buildCheckbox(fields.referralPotential);
  if (fields.relationshipStage !== undefined) properties[P.relationshipStage] = buildSelect(fields.relationshipStage);
  if (fields.lastContacted !== undefined) properties[P.lastContacted] = buildDate(fields.lastContacted);
  if (fields.nextAction !== undefined) properties[P.nextAction] = buildRichText(fields.nextAction);
  if (fields.linkedin !== undefined) properties[P.linkedin] = buildUrl(fields.linkedin);
  if (fields.phoneNumber !== undefined) properties[P.phoneNumber] = buildPhone(fields.phoneNumber);
  if (fields.organizationIds !== undefined) properties[P.organization] = buildRelation(fields.organizationIds);
  if (fields.nodeUserIds !== undefined) properties[P.node] = buildPerson(fields.nodeUserIds);

  const page = (await notion.pages.update({
    page_id: id,
    properties,
  })) as PageObjectResponse;

  return mapPageToContact(page);
}

export async function archiveContact(id: string): Promise<void> {
  await notion.pages.update({ page_id: id, archived: true });
}
