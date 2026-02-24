import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-helpers";
import { getPackBySlug, getPackBySlugCollective, isPlaydateInPack } from "@/lib/queries/packs";
import { checkEntitlement } from "@/lib/queries/entitlements";
import { logAccess } from "@/lib/queries/audit";
import {
  getEntitledPlaydateBySlug,
  getCollectivePlaydateBySlug,
  getTeaserMaterialsForPlaydate,
} from "@/lib/queries/playdates";
import EntitledPlaydateView from "@/components/ui/entitled-playdate-view";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string; playdateSlug: string }>;
}

export default async function EntitledPlaydatePage({ params }: Props) {
  const session = await requireAuth();
  const { slug: packSlug, playdateSlug } = await params;

  // resolve pack — collective can see draft packs
  const pack = session.isInternal
    ? await getPackBySlugCollective(packSlug)
    : await getPackBySlug(packSlug);
  if (!pack) return notFound();

  // check entitlement — collective auto-entitled
  const isEntitled =
    session.isInternal || (await checkEntitlement(session.orgId, pack.id));
  if (!isEntitled) return notFound();

  // resolve playdate — collective gets extra fields + can see drafts
  const playdate = session.isInternal
    ? await getCollectivePlaydateBySlug(playdateSlug)
    : await getEntitledPlaydateBySlug(playdateSlug);
  if (!playdate) return notFound();

  // verify playdate belongs to this pack
  const inPack = await isPlaydateInPack(playdate.id, pack.id);
  if (!inPack) return notFound();

  // fetch materials
  const materials = await getTeaserMaterialsForPlaydate(playdate.id);

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
    ...(session.isInternal
      ? ["design_rationale", "developmental_notes", "author_notes"]
      : []),
  ].filter((f) => playdate[f] != null);

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await logAccess(
    session.userId,
    session.orgId,
    playdate.id,
    pack.id,
    session.isInternal ? "view_collective" : "view_entitled",
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
        {playdate.title}
      </h1>

      <EntitledPlaydateView
        playdate={playdate}
        materials={materials}
        packSlug={packSlug}
      />
    </main>
  );
}
