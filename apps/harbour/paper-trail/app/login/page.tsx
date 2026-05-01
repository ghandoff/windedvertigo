import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import LoginForm from "@/components/login-form";

export const metadata = { title: "sign in — paper.trail" };

const ERROR_MESSAGES: Record<string, string> = {
  Verification:
    "the magic link has expired or was already used. please request a new one.",
  OAuthAccountNotLinked:
    "that email is already linked to a different sign-in method. try using the same method you used before.",
  AccessDenied:
    "access was denied. your google workspace may restrict third-party apps.",
  OAuthCallback: "google sign-in was interrupted. please try again.",
  OAuthCallbackError: "google sign-in was interrupted. please try again.",
  OAuthSignin: "could not connect to google. please try again.",
  Configuration:
    "sign-in is temporarily unavailable. please try again later.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verify?: string; callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  if (session?.user) {
    const cb = params.callbackUrl;
    const target = cb && cb.startsWith("/") ? cb : "/harbour/paper-trail";
    redirect(target);
  }

  const isVerify = params.verify === "1";
  const error = params.error;

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div
        className="w-full max-w-md p-8 rounded-2xl shadow-lg"
        style={{ backgroundColor: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)" }}
      >
        <div className="text-center mb-8">
          <h1
            className="text-2xl font-bold mb-2"
            style={{ color: "var(--color-text-on-dark)" }}
          >
            paper.trail
          </h1>
          <p className="text-sm" style={{ color: "var(--color-text-on-dark-muted)" }}>
            a physical-digital bridge
          </p>
        </div>

        {error && (
          <div
            className="mb-6 p-3 rounded-lg text-sm text-center"
            style={{ backgroundColor: "rgba(177, 80, 67, 0.15)", color: "#d4836f" }}
          >
            {ERROR_MESSAGES[error] ?? "something went wrong. please try again."}
          </div>
        )}

        {isVerify ? (
          <div className="text-center space-y-4">
            <div
              className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(177, 80, 67, 0.12)" }}
            >
              <span className="text-2xl">{"\u2709"}</span>
            </div>
            <h2
              className="text-xl font-bold"
              style={{ color: "var(--color-text-on-dark)" }}
            >
              check your email
            </h2>
            <p style={{ color: "var(--color-text-on-dark-muted)" }}>
              we sent you a magic link.
              <br />
              click it to sign in &mdash; no password needed.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <LoginForm callbackUrl={params.callbackUrl} />
          </div>
        )}

        <div className="mt-8 text-center">
          <a
            href="/harbour/paper-trail"
            className="text-xs underline"
            style={{ color: "var(--color-text-on-dark-muted)" }}
          >
            &larr; back to paper.trail
          </a>
        </div>
      </div>
    </main>
  );
}
