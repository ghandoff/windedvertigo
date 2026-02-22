import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-helpers";
import { getPackBySlug, isPatternInPack } from "@/lib/queries/packs";
import { checkEntitlement } from "@/lib/queries/entitlements";
import { logAccess } from "@/lib/queries/audit";
import {
  getEntitledPatternBySlug,
  getTeaserMaterialsForPattern,
} from "@/lib/queries/patterns";
import EntitledPatternView from "@/components/ui/entitled-pattern-view";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string; patternSlug: string }>;
}

export default async function EntitledPatternPage({ params }: Props) {
  const session = await requireAuth();
  const { slug: packSlug, patternSlug } = await params;

  // resolve pack
  const pack = await getPackBySlug(packSlug);
  if (!pack) return notFound();

  // check entitlement
  const isEntitled = await checkEntitlement(session.orgId, pack.id);
  if (!isEntitled) return notFound();

  // resolve pattern
  const pattern = await getEntitledPatternBySlug(patternSlug);
  if (!pattern) return notFound();

  // verify pattern belongs to this pack
  const inPack = await isPatternInPack(pattern.id, pack.id);
  if (!inPack) return notFound();

  // fetch materials
  const materials = await getTeaserMaterialsForPattern(pattern.id);

  // log access
  const fieldsAccessed = [
    "find",
    "fold",
    "unfold",
    "rails_sentence",
    "find_again_mode",
    "find_again_prompt",
    "slots_notes",
    "substitutions_notes",
  ].filter((f) => pattern[f] != null);

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await logAccess(
    session.userId,
    session.orgId,
    pattern.id,
    pack.id,
    "view_entitled",
    ip,
    fieldsAccessed,
  );

  return (
    <main className="min-h-screen px-6 py-16 max-w-3xl mx-auto">
      <Link
        href={`/packs/${packSlug}`}
        className="text-sm text-cadet/50 hover:text-cadet mb-6 inline-block"
      >
        &larr; back to {pack.title}
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight mb-4">
        {pattern.title}
      </h1>

      <EntitledPatternView
        pattern={pattern}
        materials={materials}
        packSlug={packSlug}
      />
    </main>
  );
}
