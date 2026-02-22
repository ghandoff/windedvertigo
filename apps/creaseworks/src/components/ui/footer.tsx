/**
 * Shared footer — renders the canonical footer.html from @windedvertigo/tokens.
 * This is the SAME HTML used by the static site. One source, zero reconstruction.
 *
 * The footer HTML lives at packages/tokens/footer.html and is the single source
 * of truth for every winded.vertigo property. The TS wrapper is auto-generated
 * by scripts/sync-footer.mjs — run `npm run sync:footer` after editing footer.html.
 */

import { WV_FOOTER_HTML } from "@windedvertigo/tokens";

export default function Footer() {
  return <div dangerouslySetInnerHTML={{ __html: WV_FOOTER_HTML }} />;
}
