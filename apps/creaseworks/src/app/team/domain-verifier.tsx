"use client";

/**
 * Domain verification manager — org admin UI for adding and managing
 * verified domains. Displayed on the /team page for org admins.
 *
 * Session 12: self-service domain verification.
 *
 * Flow:
 *   1. Org admin enters a domain (e.g. "stanford.edu")
 *   2. Optionally enters a verification email (defaults to their own
 *      if their email matches the domain)
 *   3. API sends a verification email with a one-click link
 *   4. Recipient clicks link → domain is verified
 *   5. Future sign-ins with @domain emails auto-join the org
 */

import { useState } from "react";

/* ------------------------------------------------------------------ */
/*  types                                                              */
/* ------------------------------------------------------------------ */

interface VerifiedDomain {
  id: string;
  domain: string;
  verified: boolean;
  verification_email: string | null;
  verified_at: string | null;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  component                                                          */
/* ------------------------------------------------------------------ */

export default function DomainVerifier({
  initialDomains,
  userEmail,
}: {
  initialDomains: VerifiedDomain[];
  userEmail: string;
}) {
  const [domains, setDomains] = useState<VerifiedDomain[]>(initialDomains);
  const [newDomain, setNewDomain] = useState("");
  const [verifyEmail, setVerifyEmail] = useState("");
  const [showEmailField, setShowEmailField] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // check if user's email domain matches the entered domain
  const userDomain = userEmail.split("@")[1]?.toLowerCase() || "";
  const enteredDomain = newDomain.toLowerCase().trim().replace(/^@/, "");
  const emailMatchesDomain = userDomain === enteredDomain;

  async function handleAdd() {
    const domain = enteredDomain;
    if (!domain || !domain.includes(".")) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const body: Record<string, string> = { domain };
      // include verification email if it differs from user's email
      if (showEmailField && verifyEmail.trim()) {
        body.verificationEmail = verifyEmail.trim();
      }

      const res = await fetch("/api/team/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed to add domain");

      // add to local state
      if (data.domain) {
        setDomains((prev) => {
          // replace if exists (re-sent verification), otherwise add
          const exists = prev.findIndex((d) => d.domain === data.domain.domain);
          if (exists >= 0) {
            const next = [...prev];
            next[exists] = data.domain;
            return next;
          }
          return [...prev, data.domain].sort((a, b) =>
            a.domain.localeCompare(b.domain),
          );
        });
      }

      setSuccess(data.message || "verification email sent");
      setNewDomain("");
      setVerifyEmail("");
      setShowEmailField(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend(domain: VerifiedDomain) {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const body: Record<string, string> = { domain: domain.domain };
      if (domain.verification_email) {
        body.verificationEmail = domain.verification_email;
      }

      const res = await fetch("/api/team/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed to resend");

      // update local state with new record
      if (data.domain) {
        setDomains((prev) =>
          prev.map((d) => (d.domain === domain.domain ? data.domain : d)),
        );
      }

      setSuccess(data.message || "verification email re-sent");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(domainId: string, domainName: string) {
    if (
      !confirm(
        `remove ${domainName}? new users with @${domainName} emails will no longer auto-join your organisation. existing members are not affected.`,
      )
    )
      return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/team/domains", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed to remove domain");

      setDomains((prev) => prev.filter((d) => d.id !== domainId));
      setSuccess(`${domainName} removed`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* ---- feedback messages ---- */}
      {error && (
        <div
          className="rounded-xl border px-4 py-3 mb-4"
          style={{
            borderColor: "rgba(177, 80, 67, 0.2)",
            backgroundColor: "rgba(177, 80, 67, 0.05)",
          }}
        >
          <p className="text-sm" style={{ color: "#b15043" }}>
            {error}
          </p>
        </div>
      )}
      {success && (
        <div
          className="rounded-xl border px-4 py-3 mb-4"
          style={{
            borderColor: "rgba(42, 157, 80, 0.2)",
            backgroundColor: "rgba(42, 157, 80, 0.05)",
          }}
        >
          <p className="text-sm" style={{ color: "#2a9d50" }}>
            {success}
          </p>
        </div>
      )}

      {/* ---- add domain form ---- */}
      <div
        className="rounded-xl border p-4 sm:p-5 mb-6"
        style={{
          borderColor: "rgba(39, 50, 72, 0.1)",
          backgroundColor: "rgba(255, 235, 210, 0.15)",
        }}
      >
        <h3
          className="text-sm font-semibold mb-1"
          style={{ color: "#273248", opacity: 0.8 }}
        >
          add a domain
        </h3>
        <p
          className="text-xs mb-3"
          style={{ color: "#273248", opacity: 0.45 }}
        >
          anyone who signs in with an email at this domain will
          automatically join your organisation.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <input
            type="text"
            placeholder="e.g. stanford.edu"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="rounded-lg border px-4 py-3 sm:px-3 sm:py-2 text-sm flex-1 min-w-0 outline-none focus:ring-2"
            style={{
              borderColor: "rgba(39, 50, 72, 0.15)",
              color: "#273248",
              minHeight: 44,
            }}
          />
          <button
            onClick={handleAdd}
            disabled={
              loading || !enteredDomain || !enteredDomain.includes(".")
            }
            className="rounded-lg px-5 py-3 sm:py-2 text-sm font-medium text-white disabled:opacity-40 transition-all active:scale-[0.98]"
            style={{ backgroundColor: "#b15043", minHeight: 44 }}
          >
            {loading ? "sending…" : "verify domain"}
          </button>
        </div>

        {/* show email field toggle when domain doesn't match user's email */}
        {enteredDomain &&
          enteredDomain.includes(".") &&
          !emailMatchesDomain && (
            <div className="mt-3">
              {!showEmailField ? (
                <p className="text-xs" style={{ color: "#273248", opacity: 0.5 }}>
                  your email ({userEmail}) doesn&apos;t match @{enteredDomain}.{" "}
                  <button
                    type="button"
                    onClick={() => setShowEmailField(true)}
                    className="underline"
                    style={{ color: "#b15043" }}
                  >
                    enter a verification email
                  </button>
                </p>
              ) : (
                <input
                  type="email"
                  placeholder={`someone@${enteredDomain}`}
                  value={verifyEmail}
                  onChange={(e) => setVerifyEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  className="w-full rounded-lg border px-4 py-3 sm:px-3 sm:py-2 text-sm outline-none focus:ring-2"
                  style={{
                    borderColor: "rgba(39, 50, 72, 0.15)",
                    color: "#273248",
                    minHeight: 44,
                  }}
                />
              )}
            </div>
          )}

        {/* hint when domain matches user's email */}
        {enteredDomain && emailMatchesDomain && (
          <p
            className="text-xs mt-2"
            style={{ color: "#273248", opacity: 0.45 }}
          >
            we&apos;ll send a verification email to {userEmail}
          </p>
        )}
      </div>

      {/* ---- existing domains list ---- */}
      {domains.length > 0 && (
        <div className="space-y-2">
          {domains.map((d) => (
            <div
              key={d.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border p-4 gap-2 sm:gap-4"
              style={{ borderColor: "rgba(39, 50, 72, 0.1)" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                {/* status indicator */}
                <span
                  className="flex-shrink-0 w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: d.verified ? "#2a9d50" : "#cb7858",
                  }}
                />
                <span
                  className="font-mono text-sm truncate"
                  style={{ color: "#273248" }}
                >
                  @{d.domain}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-xs flex-shrink-0"
                  style={{
                    backgroundColor: d.verified
                      ? "rgba(42, 157, 80, 0.1)"
                      : "rgba(203, 120, 88, 0.1)",
                    color: d.verified ? "#2a9d50" : "#cb7858",
                  }}
                >
                  {d.verified ? "verified" : "pending"}
                </span>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                {!d.verified && (
                  <button
                    onClick={() => handleResend(d)}
                    disabled={loading}
                    className="text-xs transition-opacity hover:opacity-80 disabled:opacity-40"
                    style={{ color: "#b15043" }}
                  >
                    resend email
                  </button>
                )}
                {d.verified && d.verified_at && (
                  <span
                    className="text-xs"
                    style={{ color: "#273248", opacity: 0.4 }}
                  >
                    verified{" "}
                    {new Date(d.verified_at).toLocaleDateString("en-GB")}
                  </span>
                )}
                <button
                  onClick={() => handleRemove(d.id, d.domain)}
                  disabled={loading}
                  className="text-xs transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{ color: "#273248", opacity: 0.4 }}
                >
                  remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {domains.length === 0 && (
        <p
          className="text-sm"
          style={{ color: "#273248", opacity: 0.4 }}
        >
          no verified domains yet. add one above so colleagues can
          auto-join when they sign in.
        </p>
      )}
    </div>
  );
}
