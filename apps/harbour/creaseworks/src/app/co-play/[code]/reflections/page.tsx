/**
 * Co-play reflections page.
 *
 * After joining a co-play session, the partner fills out reflection form here.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-helpers";
import { getRunByInviteCode } from "@/lib/queries/co-play-page";
import { CoPlayReflectionForm } from "@/components/co-play-reflection-form";
import CharacterSlot from "@windedvertigo/characters";

interface CoPlayReflectionsPageProps {
  params: Promise<{ code: string }>;
}

export default async function CoPlayReflectionsPage({
  params,
}: CoPlayReflectionsPageProps) {
  const session = await requireAuth();
  const { code } = await params;

  // Fetch run by invite code
  const run = await getRunByInviteCode(code);

  if (!run) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div
          className="max-w-md w-full rounded-lg p-6 text-center"
          style={{ background: "var(--wv-cream)", border: "1.5px solid rgba(39, 50, 72, 0.08)" }}
        >
          <h1 className="text-2xl font-bold font-serif mb-2 text-cadet">
            session not found
          </h1>
          <p className="text-cadet/60 mb-6">
            This co-play session wasn't found or has expired.
          </p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-redwood text-white rounded-lg hover:bg-redwood/90"
          >
            back to home
          </Link>
        </div>
      </div>
    );
  }

  // User must be the co-play partner
  if (run.co_play_parent_id !== session.userId) {
    redirect(`/co-play/${code}`);
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div
          className="rounded-lg p-8"
          style={{ background: "var(--wv-cream)", border: "1.5px solid rgba(39, 50, 72, 0.08)" }}
        >
          <Link
            href={`/runs/${run.id}`}
            className="text-redwood hover:underline text-sm mb-6 inline-block"
          >
            ← back to playdate
          </Link>

          <div className="flex justify-center mb-4" aria-hidden="true">
            <CharacterSlot character="jugs" size={52} animate={false} variant="kid" />
          </div>
          <h1 className="text-3xl font-bold font-serif mb-2 text-cadet">
            share your reflections
          </h1>
          <p className="text-cadet/60 mb-8">
            tell us what you observed and experienced during{" "}
            <strong>{run.title}</strong>.
          </p>

          <CoPlayReflectionForm runId={run.id} />
        </div>
      </div>
    </div>
  );
}
