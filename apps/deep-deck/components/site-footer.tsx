import { WV_FOOTER_HTML } from "@windedvertigo/tokens/footer-html";

/**
 * Site footer — renders the shared winded.vertigo footer
 * (copyright + social links) using the canonical HTML from @windedvertigo/tokens.
 */
export function SiteFooter() {
  return <div dangerouslySetInnerHTML={{ __html: WV_FOOTER_HTML }} />;
}
