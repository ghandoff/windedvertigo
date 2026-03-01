/**
 * Notion block content → HTML converter.
 *
 * Fetches the block children of a Notion page and converts the tree
 * into semantic HTML. Used by the sync pipeline to cache rendered
 * page body content alongside property data.
 *
 * Supported block types:
 *   paragraph, heading_1/2/3, bulleted_list_item, numbered_list_item,
 *   to_do, toggle, quote, callout, divider, image, code, bookmark,
 *   embed, table, table_row
 *
 * Unsupported blocks render as HTML comments for debugging.
 *
 * Images within blocks are synced to R2 using syncImageToR2() with
 * a deterministic slot key based on the block ID.
 */

import { Client } from "@notionhq/client";
import type {
  BlockObjectResponse,
  RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { delay, RATE_LIMIT_DELAY_MS } from "@/lib/notion";
import { syncImageToR2, imageUrl } from "./sync-image";

/* ------------------------------------------------------------------ */
/*  rich text segment → HTML (inline formatting)                       */
/* ------------------------------------------------------------------ */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

function richTextToHtml(segments: RichTextItemResponse[]): string {
  return segments
    .map((seg) => {
      const text = seg.plain_text ?? "";
      if (!text) return "";

      let html = escapeHtml(text);
      const ann = seg.annotations;

      if (ann.code) html = `<code>${html}</code>`;
      if (ann.strikethrough) html = `<s>${html}</s>`;
      if (ann.underline) html = `<u>${html}</u>`;
      if (ann.italic) html = `<em>${html}</em>`;
      if (ann.bold) html = `<strong>${html}</strong>`;

      if (ann.color && ann.color !== "default") {
        html = `<span data-color="${ann.color}">${html}</span>`;
      }

      if (seg.href) {
        html = `<a href="${escapeAttr(seg.href)}">${html}</a>`;
      }

      return html;
    })
    .join("");
}

/* ------------------------------------------------------------------ */
/*  fetch all blocks (recursive, with pagination)                      */
/* ------------------------------------------------------------------ */

async function fetchAllBlocks(
  client: Client,
  blockId: string,
  maxDepth = 3,
  currentDepth = 0,
): Promise<BlockObjectResponse[]> {
  if (currentDepth >= maxDepth) return [];

  const blocks: BlockObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    await delay(RATE_LIMIT_DELAY_MS);
    const response = await client.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const block of response.results) {
      const b = block as BlockObjectResponse;
      blocks.push(b);

      // Recursively fetch children for blocks that have them
      if (b.has_children) {
        const children = await fetchAllBlocks(
          client,
          b.id,
          maxDepth,
          currentDepth + 1,
        );
        // Tag children onto block for rendering
        (b as any)._children = children;
      }
    }

    cursor = response.has_more
      ? (response.next_cursor ?? undefined)
      : undefined;
  } while (cursor);

  return blocks;
}

/* ------------------------------------------------------------------ */
/*  block → HTML rendering                                             */
/* ------------------------------------------------------------------ */

async function renderBlock(
  block: BlockObjectResponse,
  notionPageId: string,
): Promise<string> {
  const b = block as any;
  const type = b.type;
  const data = b[type];

  switch (type) {
    case "paragraph":
      return `<p>${richTextToHtml(data.rich_text)}</p>`;

    case "heading_1":
      return `<h1>${richTextToHtml(data.rich_text)}</h1>`;
    case "heading_2":
      return `<h2>${richTextToHtml(data.rich_text)}</h2>`;
    case "heading_3":
      return `<h3>${richTextToHtml(data.rich_text)}</h3>`;

    case "bulleted_list_item": {
      const content = richTextToHtml(data.rich_text);
      const children = b._children
        ? await renderBlocks(b._children, notionPageId)
        : "";
      return `<li>${content}${children}</li>`;
    }

    case "numbered_list_item": {
      const content = richTextToHtml(data.rich_text);
      const children = b._children
        ? await renderBlocks(b._children, notionPageId)
        : "";
      return `<li>${content}${children}</li>`;
    }

    case "to_do": {
      const checked = data.checked ? " checked" : "";
      return `<div class="todo"><input type="checkbox"${checked} disabled /> ${richTextToHtml(data.rich_text)}</div>`;
    }

    case "toggle": {
      const summary = richTextToHtml(data.rich_text);
      const children = b._children
        ? await renderBlocks(b._children, notionPageId)
        : "";
      return `<details><summary>${summary}</summary>${children}</details>`;
    }

    case "quote":
      return `<blockquote>${richTextToHtml(data.rich_text)}</blockquote>`;

    case "callout": {
      const icon = data.icon?.emoji ?? "";
      return `<div class="callout" data-icon="${escapeAttr(icon)}">${richTextToHtml(data.rich_text)}</div>`;
    }

    case "divider":
      return "<hr />";

    case "image": {
      // Sync inline image to R2
      const imgUrl =
        data.type === "external"
          ? data.external?.url
          : data.file?.url;

      if (imgUrl) {
        const slot = `block-${block.id.replace(/-/g, "").slice(0, 12)}`;
        const r2Key = await syncImageToR2(imgUrl, notionPageId, slot);
        const publicUrl = imageUrl(r2Key);
        const caption = data.caption
          ? richTextToHtml(data.caption)
          : "";
        if (publicUrl) {
          return `<figure><img src="${escapeAttr(publicUrl)}" alt="${escapeAttr(caption)}" />${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
        }
      }
      return "<!-- image sync failed -->";
    }

    case "code": {
      const lang = data.language ?? "";
      return `<pre><code data-language="${escapeAttr(lang)}">${escapeHtml(
        data.rich_text?.map((t: any) => t.plain_text).join("") ?? "",
      )}</code></pre>`;
    }

    case "bookmark": {
      const url = data.url ?? "";
      const caption = data.caption
        ? richTextToHtml(data.caption)
        : url;
      return `<a href="${escapeAttr(url)}" class="bookmark">${caption}</a>`;
    }

    case "embed": {
      const url = data.url ?? "";
      return `<div class="embed"><a href="${escapeAttr(url)}">${escapeHtml(url)}</a></div>`;
    }

    case "table": {
      const children = b._children ?? [];
      const rows = await Promise.all(
        children.map((row: any) => renderBlock(row, notionPageId)),
      );
      return `<table>${rows.join("")}</table>`;
    }

    case "table_row": {
      const cells = (data.cells ?? [])
        .map((cell: any) => `<td>${richTextToHtml(cell)}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    }

    // child_page, child_database, synced_block, etc. — skip gracefully
    default:
      return `<!-- unsupported block: ${type} -->`;
  }
}

/* ------------------------------------------------------------------ */
/*  render a list of blocks, wrapping adjacent list items              */
/* ------------------------------------------------------------------ */

async function renderBlocks(
  blocks: BlockObjectResponse[],
  notionPageId: string,
): Promise<string> {
  const parts: string[] = [];
  let currentListType: "ul" | "ol" | null = null;

  for (const block of blocks) {
    const type = (block as any).type;

    // Handle list grouping
    if (type === "bulleted_list_item") {
      if (currentListType !== "ul") {
        if (currentListType) parts.push(`</${currentListType}>`);
        parts.push("<ul>");
        currentListType = "ul";
      }
    } else if (type === "numbered_list_item") {
      if (currentListType !== "ol") {
        if (currentListType) parts.push(`</${currentListType}>`);
        parts.push("<ol>");
        currentListType = "ol";
      }
    } else {
      if (currentListType) {
        parts.push(`</${currentListType}>`);
        currentListType = null;
      }
    }

    parts.push(await renderBlock(block, notionPageId));
  }

  // Close any trailing list
  if (currentListType) {
    parts.push(`</${currentListType}>`);
  }

  return parts.join("\n");
}

/* ------------------------------------------------------------------ */
/*  public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Fetch the full body content of a Notion page and render it as HTML.
 *
 * Returns null if the page has no content blocks or if fetching fails.
 * Never throws — block content is supplementary and should not block
 * the property sync.
 */
export async function fetchPageBodyHtml(
  client: Client,
  pageId: string,
): Promise<string | null> {
  try {
    const blocks = await fetchAllBlocks(client, pageId);
    if (blocks.length === 0) return null;

    const html = await renderBlocks(blocks, pageId);
    return html.trim() || null;
  } catch (err) {
    console.warn(
      `[blocks] error fetching body for page ${pageId}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
