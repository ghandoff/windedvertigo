"use client";

import { signIn } from "next-auth/react";
import { useState, FormEvent } from "react";

interface LoginFormProps {
  callbackUrl?: string;
}

export default function LoginForm({ callbackUrl }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleGoogleSignIn() {
    await signIn("google", { callbackUrl: callbackUrl || "/" });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      const r = await signIn("resend", {
        email: email.toLowerCase().trim(),
        redirect: false,
      });
      if (r?.error) {
        setStatus("error");
        setErrorMsg("something went wrong. please try again.");
      } else {
        setStatus("sent");
      }
    } catch {
      setStatus("error");
      setErrorMsg("something went wrong. please try again.");
    }
  }

  if (status === "sent") {
    return (
      <div className="text-center space-y-4">
        <div
          className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
          style={{ backgroundColor: "var(--wv-champagne)" }}
        >
          <span className="text-2xl">{"\u2709"}</span>
        </div>
        <h2 className="text-xl font-bold" style={{ color: "var(--wv-cadet)" }}>
          check your email
        </h2>
        <p style={{ color: "var(--wv-cadet)" }}>
          we sent a magic link to <strong>{email}</strong>.
          <br />
          click it to sign in &mdash; no password needed.
        </p>
        <button
          onClick={() => {
            setStatus("idle");
            setEmail("");
          }}
          className="text-sm underline"
          style={{ color: "var(--wv-redwood)" }}
        >
          use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-sm">
      {/* google sign-in */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="w-full flex items-center justify-center gap-3 py-3 rounded-lg border font-medium text-sm transition-colors hover:bg-gray-50"
        style={{ borderColor: "var(--wv-cadet)", color: "var(--wv-cadet)" }}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        sign in with google
      </button>

      {/* separator */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ backgroundColor: "var(--wv-cadet)", opacity: 0.15 }} />
        <span className="text-xs" style={{ color: "var(--wv-cadet)", opacity: 0.4 }}>or</span>
        <div className="flex-1 h-px" style={{ backgroundColor: "var(--wv-cadet)", opacity: 0.15 }} />
      </div>

      {/* magic link form */}
      <form onSubmit={handleSubmit} className="space-y-4" aria-label="sign in with email">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium mb-1"
            style={{ color: "var(--wv-cadet)" }}
          >
            email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourorg.edu"
            className="w-full px-4 py-3 rounded-lg border text-base outline-none transition-colors"
            style={{
              borderColor: "var(--wv-cadet)",
              color: "var(--wv-cadet)",
              backgroundColor: "var(--wv-white)",
            }}
            disabled={status === "loading"}
            aria-describedby={status === "error" ? "login-error" : undefined}
          />
        </div>
        {status === "error" && (
          <p id="login-error" className="text-sm" style={{ color: "var(--wv-redwood)" }}>
            {errorMsg}
          </p>
        )}
        <button
          type="submit"
          disabled={status === "loading" || !email}
          className="w-full py-3 rounded-lg font-medium text-white transition-opacity disabled:opacity-50"
          style={{ backgroundColor: "var(--wv-redwood)" }}
        >
          {status === "loading" ? "sending..." : "send magic link"}
        </button>
        <p
          className="text-xs text-center"
          style={{ color: "var(--wv-cadet)", opacity: 0.6 }}
        >
          we&apos;ll email you a link to sign in.
          <br />
          no password required.
        </p>
      </form>
    </div>
  );
}
