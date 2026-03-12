/**
 * SafeHtml — render trusted, admin-controlled HTML synced from Notion.
 *
 * SECURITY: The HTML stored in the database originates from Notion's
 * structured rich_text segments, pre-processed at sync time by
 * creaseworks's extractRichTextHtml() which escapes all text via
 * escapeHtml() and only emits a fixed set of safe tags (<strong>,
 * <em>, <a>, etc.). The source is admin-controlled (only windedvertigo
 * team members can edit Notion).
 *
 * Light styling via Tailwind's prose-like utilities keeps rendered
 * HTML consistent with the surrounding brand typography.
 */

interface SafeHtmlProps {
  html: string | null | undefined;
  fallback: React.ReactNode;
  className?: string;
  /** HTML element to render. Defaults to "p". */
  as?: "p" | "span" | "div";
}

export default function SafeHtml({
  html,
  fallback,
  className = "",
  as: Tag = "p",
}: SafeHtmlProps) {
  if (html) {
    return (
      <Tag
        className={`notion-rich-text ${className}`}
        // Safe: HTML generated from Notion's structured API with escapeHtml()
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  // If fallback is a string with newlines, convert to <br> so paragraph
  // breaks render. Content is escaped first — safe for dangerouslySetInnerHTML
  // because the source is our own database (admin-controlled Notion content).
  if (typeof fallback === "string" && fallback.includes("\n")) {
    const escaped = fallback
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
    return (
      <Tag
        className={className}
        // Safe: text is escaped above — only <br> tags are injected
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: escaped }}
      />
    );
  }

  return <Tag className={className}>{fallback}</Tag>;
}
