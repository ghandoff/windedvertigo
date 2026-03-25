/**
 * Reusable Notion filter builders for CRM queries.
 *
 * Each builder returns a single Notion filter object.
 * buildCompoundFilter combines multiple filters into an AND group.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NotionFilter = any;

export function buildSelectFilter(property: string, value: string): NotionFilter {
  return { property, select: { equals: value } };
}

export function buildStatusFilter(property: string, value: string): NotionFilter {
  return { property, status: { equals: value } };
}

export function buildMultiSelectContains(property: string, value: string): NotionFilter {
  return { property, multi_select: { contains: value } };
}

export function buildTextSearch(property: string, value: string): NotionFilter {
  return { property, rich_text: { contains: value } };
}

export function buildTitleSearch(property: string, value: string): NotionFilter {
  return { property, title: { contains: value } };
}

export function buildEmailSearch(property: string, value: string): NotionFilter {
  return { property, email: { contains: value } };
}

export function buildCheckboxFilter(property: string, value: boolean): NotionFilter {
  return { property, checkbox: { equals: value } };
}

export function buildDateAfter(property: string, date: string): NotionFilter {
  return { property, date: { on_or_after: date } };
}

export function buildDateBefore(property: string, date: string): NotionFilter {
  return { property, date: { on_or_before: date } };
}

export function buildRelationContains(property: string, id: string): NotionFilter {
  return { property, relation: { contains: id } };
}

/**
 * Build an OR group from multiple values for the same property.
 * If only one value, returns a single filter (no OR wrapper).
 */
export function buildSelectOrGroup(
  property: string,
  values: string | string[],
  builder: (prop: string, val: string) => NotionFilter = buildSelectFilter,
): NotionFilter | undefined {
  const arr = Array.isArray(values) ? values : [values];
  if (arr.length === 0) return undefined;
  if (arr.length === 1) return builder(property, arr[0]);
  return { or: arr.map((v) => builder(property, v)) };
}

/**
 * Combine an array of filter objects into a Notion compound AND filter.
 * Returns undefined if no filters are provided (no filtering).
 */
export function buildCompoundFilter(
  filters: NotionFilter[],
): NotionFilter | undefined {
  const valid = filters.filter(Boolean);
  if (valid.length === 0) return undefined;
  if (valid.length === 1) return valid[0];
  return { and: valid };
}
