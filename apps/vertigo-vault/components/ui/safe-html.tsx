/**
 * SafeHtml — render trusted, admin-controlled HTML from Notion.
 *
 * Used for rich-text fields that pass through extractRichTextHtml(),
 * which escapes all text content and only adds structural tags
 * (<strong>, <em>, <a>, etc.) based on Notion's annotations API.
 *
 * SECURITY: The HTML comes from Notion's structured rich_text segments,
 * processed by extractRichTextHtml() which escapes all text via
 * escapeHtml() and only emits a fixed set of safe tags. The source
 * is admin-controlled (only windedvertigo team members can edit Notion).
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

  return <Tag className={className}>{fallback}</Tag>;
}
