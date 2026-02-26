/**
 * Co-play join page.
 *
 * Landing page when someone visits with an invite code.
 * Shows the playdate and prompts to join.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-helpers";
import { getRunByInviteCode } from "@/lib/queries/co-play-page";
import { CoPlayJoinForm } from "@/components/co-play-join-form";

interface CoPlayPageProps {
  params: Promise<{ code: string }>;
}

export default async function CoPlayPage({ params }: CoPlayPageProps) {
  const { code } = await params;
  const session = await getSession();

  // Fetch run details by invite code
  const run = await getRunByInviteCode(code);

  if (!run) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <h1 className="text-2xl font-bold mb-2 text-gray-900">
            Invalid Code
          </h1>
          <p className="text-gray-600 mb-6">
            This co-play invite code wasn't found or has expired.
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

  // If already logged in and already a participant, go to reflection form
  if (
    session &&
    (run.created_by === session.userId ||
      run.co_play_parent_id === session.userId)
  ) {
    redirect(`/co-play/${code}/reflections`);
  }

  // If not logged in
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h1 className="text-2xl font-bold mb-2 text-gray-900">
            Join Co-Play
          </h1>
          <p className="text-gray-600 mb-4">
            <strong>{run.created_by_name}</strong> invited you to share
            reflections on{" "}
            <strong>{run.title}</strong>.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Sign in to accept the invitation and share your reflections.
          </p>
          <Link
            href={`/login?redirect=/co-play/${code}/reflections`}
            className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium mb-3"
          >
            Sign In
          </Link>
          <p className="text-xs text-gray-500 text-center">
            Don't have an account?{" "}
            <Link
              href={`/signup?redirect=/co-play/${code}/reflections`}
              className="text-blue-600 hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // Already logged in — show join form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold mb-2 text-gray-900">
          Join Co-Play
        </h1>
        <p className="text-gray-600 mb-6">
          <strong>{run.created_by_name}</strong> invited you to share
          reflections on <strong>{run.title}</strong>.
        </p>

        <CoPlayJoinForm
          inviteCode={code}
          onSuccess={() => {
            redirect(`/co-play/${code}/reflections`);
          }}
        />
      </div>
    </div>
  );
}
