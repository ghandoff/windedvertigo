export type PathStep = { personId: string; edgeLabel: string };

/**
 * Converts a BFS path through a family tree into a human-readable kinship label.
 *
 * Edge labels in the path are one of:
 *   "child -> parent" (going up)
 *   "parent -> child" (going down)
 *   "spouse"          (lateral)
 */
export function calculateRelationship(path: PathStep[]): string {
  if (!path || path.length === 0) return "unknown";
  if (path.length === 1) return "self";

  // split path into segments separated by spouse edges
  const segments: { ups: number; downs: number }[] = [];
  let spouseCount = 0;
  let currentUps = 0;
  let currentDowns = 0;

  for (let i = 1; i < path.length; i++) {
    const label = path[i].edgeLabel;
    if (label === "spouse") {
      segments.push({ ups: currentUps, downs: currentDowns });
      currentUps = 0;
      currentDowns = 0;
      spouseCount++;
    } else if (label === "child \u2192 parent") {
      currentUps++;
    } else if (label === "parent \u2192 child") {
      currentDowns++;
    }
  }
  segments.push({ ups: currentUps, downs: currentDowns });

  // direct spouse (only a spouse edge, no ups/downs)
  if (spouseCount === 1 && segments.every((s) => s.ups === 0 && s.downs === 0)) {
    return "spouse";
  }

  // compute totals across all segments
  const totalUps = segments.reduce((sum, s) => sum + s.ups, 0);
  const totalDowns = segments.reduce((sum, s) => sum + s.downs, 0);

  const label = describeKinship(totalUps, totalDowns);

  if (spouseCount > 0) {
    return label ? `${label}-in-law` : "spouse";
  }

  return label || "unknown";
}

function describeKinship(ups: number, downs: number): string {
  // no movement
  if (ups === 0 && downs === 0) return "";

  // direct ancestors
  if (ups > 0 && downs === 0) return ancestorLabel(ups);

  // direct descendants
  if (ups === 0 && downs > 0) return descendantLabel(downs);

  // collateral — both ups and downs
  return collateralLabel(ups, downs);
}

function ancestorLabel(ups: number): string {
  if (ups === 1) return "parent";
  if (ups === 2) return "grandparent";
  // 3 = great-grandparent, 4 = great-great-grandparent, etc.
  return "great-".repeat(ups - 2) + "grandparent";
}

function descendantLabel(downs: number): string {
  if (downs === 1) return "child";
  if (downs === 2) return "grandchild";
  return "great-".repeat(downs - 2) + "grandchild";
}

function collateralLabel(ups: number, downs: number): string {
  // sibling
  if (ups === 1 && downs === 1) return "sibling";

  // uncle/aunt: 2 up, 1 down (or more greats)
  if (ups > 1 && downs === 1) {
    if (ups === 2) return "uncle/aunt";
    return "great-".repeat(ups - 2) + "uncle/aunt";
  }

  // nephew/niece: 1 up, 2+ down (or more greats)
  if (ups === 1 && downs > 1) {
    if (downs === 2) return "nephew/niece";
    return "great-".repeat(downs - 2) + "nephew/niece";
  }

  // cousins: min determines degree, difference determines removal
  const minGen = Math.min(ups, downs);
  const degree = minGen - 1;
  const removed = Math.abs(ups - downs);

  if (degree < 1) return "unknown";

  const ordinal = formatOrdinal(degree);
  const base = `${ordinal} cousin`;

  if (removed === 0) return base;
  return `${base} ${formatRemoved(removed)}`;
}

function formatOrdinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

function formatRemoved(n: number): string {
  if (n === 1) return "once removed";
  if (n === 2) return "twice removed";
  return `${n} times removed`;
}
