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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <h1 className="text-2xl font-bold mb-2 text-gray-900">
            Session Not Found
          </h1>
          <p className="text-gray-600 mb-6">
            This co-play session wasn't found or has expired.
          </p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Home
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
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <Link
            href={`/runs/${run.id}`}
            className="text-blue-600 hover:underline text-sm mb-6 inline-block"
          >
            ← Back to playdate
          </Link>

          <h1 className="text-3xl font-bold mb-2 text-gray-900">
            Share Your Reflections
          </h1>
          <p className="text-gray-600 mb-8">
            Tell us what you observed and experienced during{" "}
            <strong>{run.title}</strong>.
          </p>

          <CoPlayReflectionForm runId={run.id} />
        </div>
      </div>
    </div>
  );
}
