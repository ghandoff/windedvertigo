import { signIn } from "@windedvertigo/auth";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            w.v ancestry
          </h1>
          <p className="text-sm text-muted-foreground">
            sign in to view your family tree
          </p>
        </div>
        {/* Primary: server action form (requires JS hydration) */}
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            sign in with google
          </button>
        </form>
        {/* Fallback: direct link to Auth.js built-in sign-in page.
            Works even if JS fails to hydrate (older browsers, slow connections). */}
        <p className="text-center text-xs text-muted-foreground">
          button not working?{" "}
          <Link
            href="/api/auth/signin?callbackUrl=/"
            className="underline hover:text-foreground transition-colors"
          >
            try here
          </Link>
        </p>
      </div>
    </div>
  );
}
