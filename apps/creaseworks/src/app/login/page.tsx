import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import LoginForm from "@/components/ui/login-form";

export const metadata = { title: "sign in \u2014 creaseworks" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verify?: string; callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  // Already logged in — honour the callbackUrl or go home
  if (session?.user) {
    const cb = params.callbackUrl;
    // Only allow relative paths to prevent open-redirect attacks
    const target = cb && cb.startsWith("/") ? cb : "/";
    redirect(target);
  }

  const isVerify = params.verify === "1";
  const error = params.error;

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "var(--wv-champagne)" }}
    >
      <div
        className="w-full max-w-md p-8 rounded-2xl shadow-lg"
        style={{ backgroundColor: "var(--wv-white)" }}
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--wv-cadet)" }}>
            creaseworks
          </h1>
          <p className="text-sm" style={{ color: "var(--wv-cadet)", opacity: 0.7 }}>
            co-design pattern platform
          </p>
        </div>

        {error && (
          <div
            className="mb-6 p-3 rounded-lg text-sm text-center"
            style={{ backgroundColor: "var(--wv-champagne)", color: "var(--wv-redwood)" }}
          >
            {error === "Verification"
              ? "the magic link has expired or was already used. please request a new one."
              : "something went wrong. please try again."}
          </div>
        )}

        {isVerify ? (
          <div className="text-center space-y-4">
            <div
              className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
              style={{ backgroundColor: "var(--wv-champagne)" }}
            >
              <span className="text-2xl">\u2709</span>
            </div>
            <h2 className="text-xl font-bold" style={{ color: "var(--wv-cadet)" }}>
              check your email
            </h2>
            <p style={{ color: "var(--wv-cadet)" }}>
              we sent you a magic link.
              <br />
              click it to sign in \u2014 no password needed.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <LoginForm callbackUrl={params.callbackUrl} />
          </div>
        )}

        <div className="mt-8 text-center">
          <a
            href="/"
            className="text-xs underline"
            style={{ color: "var(--wv-cadet)", opacity: 0.5 }}
          >
            ← back to home
          </a>
        </div>
      </div>
    </main>
  );
}
