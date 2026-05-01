/**
 * @windedvertigo/notion — shared Notion API utilities
 *
 * Property extractors, builders, retry, fallback, and pagination
 * for all winded.vertigo apps that talk to Notion.
 */

// types
export type { Prop, DateRange, Place, PageObjectResponse, RichTextItemResponse } from "./types";

// client factory
export { createNotionClient } from "./client";

// extractors (Notion → TypeScript)
export {
  getText,
  getTitle,
  getRichTextAsMarkdown,
  getSelect,
  getMultiSelect,
  getUrl,
  getNumber,
  getEmail,
  getPhone,
  getDate,
  getCheckbox,
  getStatus,
  getRelation,
  getPerson,
  getPeopleNames,
  getCreatedTime,
  getLastEditedTime,
  getEditedBy,
  getPlace,
  toSlug,
} from "./extractors";

// builders (TypeScript → Notion)
export {
  buildRichText,
  buildTitle,
  buildSelect,
  buildMultiSelect,
  buildStatus,
  buildUrl,
  buildEmail,
  buildPhone,
  buildNumber,
  buildCheckbox,
  buildDate,
  buildRelation,
  buildPerson,
} from "./builders";

// retry & fallback
export { withRetry } from "./retry";
export { withFallback, readFallback } from "./fallback";

// pagination
export { queryDatabase } from "./pagination";
export type { PaginatedResult } from "./pagination";
