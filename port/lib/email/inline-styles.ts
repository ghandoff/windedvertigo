/**
 * Inline CSS styles for email-safe HTML.
 *
 * Email clients (Gmail, Apple Mail, Outlook) strip <style> blocks and class
 * attributes. Only inline style="..." attributes survive reliably.
 *
 * This post-processes Tiptap HTML to add inline styles on block elements so
 * the email renders consistently across clients.
 */

/** Default inline style to inject per tag (only if property not already set). */
const TAG_STYLES: Record<string, string> = {
  p:          "margin:0 0 1em 0;",
  h1:         "font-size:2em;font-weight:700;line-height:1.2;margin:0 0 0.75em 0;",
  h2:         "font-size:1.5em;font-weight:700;line-height:1.3;margin:0 0 0.75em 0;",
  ul:         "list-style-type:disc;padding-left:1.5em;margin:0 0 1em 0;",
  ol:         "list-style-type:decimal;padding-left:1.5em;margin:0 0 1em 0;",
  li:         "margin:0 0 0.3em 0;",
  blockquote: "border-left:3px solid #e5e7eb;padding-left:1em;margin:0 0 1em 1em;color:#6b7280;",
  a:          "color:#6366f1;text-decoration:underline;",
  code:       "font-family:ui-monospace,monospace;background:#f3f4f6;padding:0.1em 0.3em;border-radius:3px;font-size:0.875em;",
  pre:        "background:#f3f4f6;padding:1em;border-radius:6px;margin:0 0 1em 0;overflow:auto;",
  hr:         "border:none;border-top:1px solid #e5e7eb;margin:1.5em 0;",
};

/**
 * Given an opening HTML tag string (e.g. `<p class="foo">`),
 * merge `additionalStyles` into its style attribute.
 * Only adds CSS properties not already present.
 */
function mergeIntoTag(tag: string, additionalStyles: string): string {
  // Parse existing style attribute if any
  const styleAttrRe = /\bstyle="([^"]*)"/i;
  const existingMatch = tag.match(styleAttrRe);
  const existing = existingMatch ? existingMatch[1] : "";

  // Determine which new properties to add
  const existingProps = new Set(
    existing.split(";").map((r) => r.split(":")[0].trim().toLowerCase()).filter(Boolean)
  );
  const toAdd = additionalStyles
    .split(";")
    .filter(Boolean)
    .filter((rule) => {
      const prop = rule.split(":")[0].trim().toLowerCase();
      return prop && !existingProps.has(prop);
    })
    .join(";");

  if (!toAdd) return tag;

  if (existingMatch) {
    const merged = existing ? `${existing};${toAdd}` : toAdd;
    return tag.replace(styleAttrRe, `style="${merged}"`);
  }

  // Insert style attribute before the closing >
  return tag.replace(/(\s*\/?>)$/, ` style="${toAdd}"$1`);
}

export function inlineEmailStyles(html: string): string {
  // Match any opening tag: <tagname ...> or <tagname .../>
  return html.replace(/<([a-z][a-z0-9]*)((?:\s[^>]*)?)\s*\/?>/gi, (match, tagName: string, attrs: string) => {
    const styles = TAG_STYLES[tagName.toLowerCase()];
    if (!styles) return match;
    return mergeIntoTag(match, styles);
  });
}
