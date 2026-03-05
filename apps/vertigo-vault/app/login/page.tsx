import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import LoginForm from "@/components/ui/login-form";

export const metadata = { title: "sign in — vertigo.vault" };

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
    <main className="min-h-screen flex items-center justify-center px-4">
      <div
        className="w-full max-w-md p-8 rounded-2xl shadow-lg"
        style={{ backgroundColor: "var(--vault-card-bg)" }}
      >
        <div className="text-center mb-8">
          <h1
            className="text-2xl font-bold mb-2"
            style={{ color: "var(--vault-text)" }}
          >
            vertigo.vault
          </h1>
          <p className="text-sm" style={{ color: "var(--vault-text-muted)" }}>
            activities, energizers, and reflective exercises
          </p>
        </div>

        {error && (
          <div
            className="mb-6 p-3 rounded-lg text-sm text-center"
            style={{ backgroundColor: "rgba(175,79,65,0.15)", color: "#d4836f" }}
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
              style={{ backgroundColor: "rgba(175,79,65,0.12)" }}
            >
              <span className="text-2xl">{"✉"}</span>
            </div>
            <h2
              className="text-xl font-bold"
              style={{ color: "var(--vault-text)" }}
            >
              check your email
            </h2>
            <p style={{ color: "var(--vault-text-muted)" }}>
              we sent you a magic link.
              <br />
              click it to sign in — no password needed.
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
            style={{ color: "var(--vault-text-muted)" }}
          >
            ← back to vault
          </a>
        </div>
      </div>
    </main>
  );
}
