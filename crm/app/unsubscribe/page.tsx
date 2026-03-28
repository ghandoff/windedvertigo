"use client";

/**
 * Public unsubscribe confirmation page.
 * No auth required — reachable directly from email footer links.
 */

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Status = "loading" | "success" | "error";

function UnsubscribeContent() {
  const params = useSearchParams();
  const token = params.get("t");
  const [status, setStatus] = useState<Status>("loading");
  const [orgName, setOrgName] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    fetch(`/api/unsubscribe?t=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setOrgName(data.orgName ?? "");
          setStatus("success");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <>
      {status === "loading" && (
        <p style={{ color: "#6b7280", fontSize: "1rem" }}>Processing…</p>
      )}

      {status === "success" && (
        <>
          <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✓</p>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem", color: "#111" }}>
            You&rsquo;ve been unsubscribed
          </h1>
          {orgName && (
            <p style={{ color: "#6b7280", marginBottom: "1rem" }}>
              {orgName} has been removed from our outreach list.
            </p>
          )}
          <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
            You won&rsquo;t receive any more emails from winded.vertigo.
            If this was a mistake, reply to any previous email and we&rsquo;ll re-add you.
          </p>
        </>
      )}

      {status === "error" && (
        <>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem", color: "#111" }}>
            Link expired or invalid
          </h1>
          <p style={{ color: "#6b7280" }}>
            If you&rsquo;d like to unsubscribe, reply to the email with &ldquo;unsubscribe&rdquo;
            and we&rsquo;ll remove you immediately.
          </p>
        </>
      )}
    </>
  );
}

export default function UnsubscribePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f4f4f1",
        fontFamily: "Georgia, serif",
        padding: "2rem",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          textAlign: "center",
          padding: "3rem 2rem",
          background: "#fff",
          borderRadius: 8,
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        }}
      >
        <Suspense fallback={<p style={{ color: "#6b7280" }}>Loading…</p>}>
          <UnsubscribeContent />
        </Suspense>

        <p style={{ marginTop: "2rem", fontSize: "0.75rem", color: "#d1d5db" }}>
          winded.vertigo
        </p>
      </div>
    </div>
  );
}
