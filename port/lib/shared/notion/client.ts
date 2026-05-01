/**
 * @windedvertigo/notion — client factory
 */

import { Client } from "@notionhq/client";

/**
 * Create a Notion client instance with the given auth token.
 * Each app (harbour, port) calls this with its own token.
 */
export function createNotionClient(auth: string): Client {
  return new Client({ auth });
}
