import Link from "next/link";
import { JoinForm } from "@/components/join-form";

export default function JoinPage() {
  return (
    <div className="min-h-[90vh] flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md w-full">
        {/* brand */}
        <p className="text-5xl mb-4">{"\u{1F6F6}"}</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
          join a session
        </h1>
        <p className="text-sm text-[var(--rh-text-muted)] mb-10">
          enter the room code from your facilitator
        </p>

        {/* join form */}
        <JoinForm />

        {/* back to games */}
        <div className="mt-10">
          <Link
            href="/"
            className="text-sm text-[var(--rh-text-muted)] hover:text-[var(--rh-cyan)] transition-colors"
          >
            &larr; browse all games
          </Link>
        </div>
      </div>
    </div>
  );
}
