/**
 * MaterialIllustration — deterministic SVG icon per material form category.
 *
 * Each of the 12 form categories gets a unique, hand-crafted mini illustration
 * that evokes the material's physicality. Colors use the creaseworks design
 * tokens so everything feels part of the same visual language.
 */

const COLORS = {
  champagne: "#ffebd2",
  sienna: "#cb7858",
  redwood: "#b15043",
  cadet: "#273248",
  sage: "#9ca89c",
};

interface MaterialIllustrationProps {
  /** The form_primary value from materials_cache */
  formPrimary: string;
  /** Icon size in px (default 28) */
  size?: number;
  /** Optional className for the wrapper */
  className?: string;
}

/**
 * Map each form_primary category to a small SVG icon.
 * All icons use a 24Ã24 viewBox for consistency.
 */
function renderIcon(category: string): string {
  const cat = category.toLowerCase();

  // ââ discrete small parts ââ buttons, beads, pebbles
  if (cat.includes("discrete") || cat.includes("small parts")) {
    return `
      <circle cx="6" cy="8" r="3" fill="${COLORS.sienna}" opacity="0.7"/>
      <circle cx="14" cy="6" r="2.5" fill="${COLORS.redwood}" opacity="0.6"/>
      <circle cx="10" cy="14" r="3.5" fill="${COLORS.champagne}" stroke="${COLORS.sienna}" stroke-width="0.5"/>
      <circle cx="18" cy="12" r="2" fill="${COLORS.cadet}" opacity="0.5"/>
      <circle cx="17" cy="18" r="2.5" fill="${COLORS.sienna}" opacity="0.5"/>
      <circle cx="5" cy="17" r="1.5" fill="${COLORS.redwood}" opacity="0.4"/>
    `;
  }

  // ââ sheet goods / surfaces ââ paper, cardboard, fabric sheets
  if (cat.includes("sheet") || cat.includes("surface")) {
    return `
      <rect x="3" y="5" width="14" height="10" rx="0.5" fill="${COLORS.champagne}" stroke="${COLORS.sienna}" stroke-width="0.6" transform="rotate(-5 10 10)"/>
      <rect x="6" y="8" width="14" height="10" rx="0.5" fill="white" stroke="${COLORS.cadet}" stroke-width="0.5" opacity="0.8" transform="rotate(3 13 13)"/>
      <line x1="8" y1="11" x2="17" y2="11" stroke="${COLORS.cadet}" stroke-width="0.3" opacity="0.3"/>
      <line x1="8" y1="13.5" x2="15" y2="13.5" stroke="${COLORS.cadet}" stroke-width="0.3" opacity="0.3"/>
    `;
  }

  // ââ volumes / substrates ââ clay, dough, sand
  if (cat.includes("volume") || cat.includes("substrate")) {
    return `
      <ellipse cx="12" cy="16" rx="8" ry="3" fill="${COLORS.sienna}" opacity="0.3"/>
      <path d="M7 14 Q9 6 12 5 Q15 6 17 14 Z" fill="${COLORS.sienna}" opacity="0.6"/>
      <path d="M8.5 13 Q10 8 12 7 Q14 8 15.5 13 Z" fill="${COLORS.champagne}" opacity="0.5"/>
    `;
  }

  // ââ containers / vessels ââ cups, boxes, tubes
  if (cat.includes("container") || cat.includes("vessel")) {
    return `
      <path d="M6 7 L5 17 Q5 19 12 19 Q19 19 19 17 L18 7 Z" fill="none" stroke="${COLORS.cadet}" stroke-width="0.8" opacity="0.7"/>
      <ellipse cx="12" cy="7" rx="6" ry="2" fill="${COLORS.champagne}" stroke="${COLORS.cadet}" stroke-width="0.5"/>
      <path d="M7 12 Q12 14 17 12" stroke="${COLORS.sienna}" stroke-width="0.5" fill="none" opacity="0.5"/>
    `;
  }

  // ââ linear / filament ââ string, wire, ribbon
  if (cat.includes("linear") || cat.includes("filament")) {
    return `
      <path d="M4 18 Q8 4 12 12 Q16 20 20 6" stroke="${COLORS.sienna}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <path d="M6 16 Q10 8 14 14 Q18 18 21 8" stroke="${COLORS.redwood}" stroke-width="0.8" fill="none" opacity="0.5" stroke-linecap="round"/>
    `;
  }

  // ââ wearables / embodied props ââ hats, capes, masks
  if (cat.includes("wearable") || cat.includes("embodied")) {
    return `
      <ellipse cx="12" cy="10" rx="7" ry="5" fill="none" stroke="${COLORS.cadet}" stroke-width="0.7"/>
      <path d="M5 10 Q5 16 12 18 Q19 16 19 10" fill="${COLORS.champagne}" opacity="0.5"/>
      <circle cx="9" cy="9" r="1" fill="${COLORS.cadet}" opacity="0.6"/>
      <circle cx="15" cy="9" r="1" fill="${COLORS.cadet}" opacity="0.6"/>
      <path d="M10 12 Q12 13.5 14 12" stroke="${COLORS.redwood}" stroke-width="0.5" fill="none"/>
    `;
  }

  // ââ found objects / evocative artifacts ââ sticks, shells, leaves
  if (cat.includes("found") || cat.includes("evocative") || cat.includes("artifact")) {
    return `
      <path d="M8 19 L12 4" stroke="${COLORS.sienna}" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M12 6 Q16 5 17 8 Q16 10 12 10" fill="${COLORS.sage}" opacity="0.6"/>
      <path d="M12 10 Q16 11 16 14 Q15 16 12 14" fill="${COLORS.sage}" opacity="0.4"/>
      <circle cx="6" cy="15" r="2.5" fill="none" stroke="${COLORS.redwood}" stroke-width="0.6" opacity="0.5"/>
    `;
  }

  // ââ mark-making media ââ crayons, paint, ink
  if (cat.includes("mark") || cat.includes("media")) {
    return `
      <rect x="10" y="3" width="4" height="14" rx="1" fill="${COLORS.redwood}" opacity="0.7" transform="rotate(15 12 12)"/>
      <line x1="5" y1="18" x2="19" y2="16" stroke="${COLORS.sienna}" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
      <line x1="4" y1="20" x2="16" y2="19" stroke="${COLORS.redwood}" stroke-width="1.5" stroke-linecap="round" opacity="0.3"/>
    `;
  }

  // ââ joining / fastening ââ tape, glue, clips
  if (cat.includes("joining") || cat.includes("fastening")) {
    return `
      <rect x="3" y="10" width="18" height="4" rx="0.5" fill="${COLORS.champagne}" stroke="${COLORS.sienna}" stroke-width="0.5" opacity="0.7"/>
      <line x1="3" y1="12" x2="21" y2="12" stroke="${COLORS.sienna}" stroke-width="0.3" stroke-dasharray="2 1"/>
      <circle cx="7" cy="12" r="1.5" fill="${COLORS.cadet}" opacity="0.4"/>
      <circle cx="17" cy="12" r="1.5" fill="${COLORS.cadet}" opacity="0.4"/>
    `;
  }

  // ââ overlay / translucency media ââ tissue paper, cellophane
  if (cat.includes("overlay") || cat.includes("translucen")) {
    return `
      <rect x="4" y="4" width="10" height="12" rx="0.5" fill="${COLORS.champagne}" opacity="0.5"/>
      <rect x="8" y="7" width="10" height="12" rx="0.5" fill="${COLORS.sienna}" opacity="0.25"/>
      <rect x="10" y="9" width="8" height="8" rx="0.5" fill="${COLORS.redwood}" opacity="0.15"/>
    `;
  }

  // ââ cutting / dividing ââ scissors, tearing
  if (cat.includes("cutting") || cat.includes("dividing")) {
    return `
      <path d="M6 6 L13 12 L6 18" stroke="${COLORS.cadet}" stroke-width="1" fill="none" stroke-linecap="round"/>
      <path d="M18 6 L11 12 L18 18" stroke="${COLORS.cadet}" stroke-width="1" fill="none" stroke-linecap="round"/>
      <circle cx="6" cy="6" r="2" fill="none" stroke="${COLORS.redwood}" stroke-width="0.7"/>
      <circle cx="6" cy="18" r="2" fill="none" stroke="${COLORS.redwood}" stroke-width="0.7"/>
    `;
  }

  // ââ modules / construction units ââ blocks, bricks, LEGO-like
  if (cat.includes("module") || cat.includes("construction unit")) {
    return `
      <rect x="3" y="12" width="8" height="6" rx="0.5" fill="${COLORS.redwood}" opacity="0.6"/>
      <rect x="9" y="12" width="8" height="6" rx="0.5" fill="${COLORS.sienna}" opacity="0.5"/>
      <rect x="6" y="6" width="8" height="6" rx="0.5" fill="${COLORS.champagne}" stroke="${COLORS.sienna}" stroke-width="0.5"/>
      <rect x="12" y="6" width="6" height="6" rx="0.5" fill="${COLORS.cadet}" opacity="0.3"/>
    `;
  }

  // ââ fallback ââ generic circle
  return `
    <circle cx="12" cy="12" r="6" fill="${COLORS.champagne}" stroke="${COLORS.sienna}" stroke-width="0.6"/>
    <circle cx="12" cy="12" r="2" fill="${COLORS.sienna}" opacity="0.5"/>
  `;
}

export function MaterialIllustration({
  formPrimary,
  size = 28,
  className,
}: MaterialIllustrationProps) {
  const icon = renderIcon(formPrimary);

  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <g dangerouslySetInnerHTML={{ __html: icon }} />
    </svg>
  );
}
