/**
 * Convert simple Markdown (from Notion blocks) to HTML.
 *
 * Ported from the vanilla JS markdownToHtml() in the original
 * vertigo-vault index.html — handles headings, bold, italic,
 * ordered/unordered lists, and paragraph wrapping.
 */
export function markdownToHtml(md: string): string {
  if (!md) return "";

  const lines = md.split("\n");
  let html = "";
  let inUl = false;
  let inOl = false;

  function closeLists(): void {
    if (inUl) {
      html += "</ul>";
      inUl = false;
    }
    if (inOl) {
      html += "</ol>";
      inOl = false;
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // blank line → close any open list
    if (!trimmed) {
      closeLists();
      continue;
    }

    // headings
    if (trimmed.startsWith("### ")) {
      closeLists();
      html += `<h3>${formatInline(trimmed.slice(4))}</h3>`;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      closeLists();
      html += `<h2>${formatInline(trimmed.slice(3))}</h2>`;
      continue;
    }

    // unordered list
    if (trimmed.startsWith("- ")) {
      if (inOl) {
        html += "</ol>";
        inOl = false;
      }
      if (!inUl) {
        html += "<ul>";
        inUl = true;
      }
      html += `<li>${formatInline(trimmed.slice(2))}</li>`;
      continue;
    }

    // ordered list
    const olMatch = trimmed.match(/^\d+\.\s/);
    if (olMatch) {
      if (inUl) {
        html += "</ul>";
        inUl = false;
      }
      if (!inOl) {
        html += "<ol>";
        inOl = true;
      }
      html += `<li>${formatInline(trimmed.slice(olMatch[0].length))}</li>`;
      continue;
    }

    // paragraph
    closeLists();
    html += `<p>${formatInline(trimmed)}</p>`;
  }

  closeLists();
  return html;
}

/** Escape HTML entities to prevent XSS from untrusted content. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Bold + italic inline formatting (applied after HTML escaping). */
function formatInline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}
