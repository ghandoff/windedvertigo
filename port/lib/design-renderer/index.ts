/**
 * Design renderer entry point (W2).
 *
 * Dispatches a (template, content, frontmatter) tuple to the right React-PDF
 * component, renders, and returns a PDF buffer. Add new templates by:
 *   1. Drop a new .tsx in templates/
 *   2. Add a case in the switch below
 *
 * Templates today: proposal-v1.
 */

import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { ProposalV1, type ProposalV1Frontmatter } from "./templates/proposal-v1";

export type TemplateKey = "proposal-v1";

export interface RenderInput {
  template: TemplateKey | string;
  title: string;
  contentMarkdown: string;
  frontmatter?: Record<string, unknown>;
}

export async function renderDesignDoc(input: RenderInput): Promise<Buffer> {
  switch (input.template) {
    case "proposal-v1":
      return renderToBuffer(
        React.createElement(ProposalV1, {
          title: input.title,
          contentMarkdown: input.contentMarkdown,
          frontmatter: (input.frontmatter ?? {}) as ProposalV1Frontmatter,
        }),
      );
    default:
      throw new Error(`Unknown template: ${input.template}`);
  }
}
