/**
 * @windedvertigo/notion — shared types
 */

import type {
  PageObjectResponse,
  RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";

// Re-export for consumers
export type { PageObjectResponse, RichTextItemResponse };

/**
 * Loose property type — Notion SDK unions are unwieldy;
 * runtime checks in extractors keep this safe.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Prop = any;

/** Standard date range returned by getDate() */
export interface DateRange {
  start: string;
  end: string | null;
}

/** Place data from Notion's place property type */
export interface Place {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}
