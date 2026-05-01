"use client";

/**
 * Public unsubscribe confirmation page.
 * No auth required — reachable directly from email footer links.
 *
 * Flow: confirm → loading → success | error
 * The API call only fires after the user clicks the confirm button,
 * preventing accidental unsubscribes from email client prefetch.
 */

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

type Status = "confirm" | "loading" | "success" | "resubscribed" | "error";

function UnsubscribeContent() {
  const params = useSearchParams();
  const token = params.get("t");
  const [status, setStatus] = useState<Status>("confirm");
  const [orgName, setOrgName] = useState<string>("");

  function handleConfirm() {
    if (!token) { setStatus("error"); return; }
    setStatus("loading");

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
  }

  if (!token) {
    return (
      <>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem", color: "#111" }}>
          Link expired or invalid
        </h1>
        <p style={{ color: "#6b7280" }}>
          If you&rsquo;d like to unsubscribe, reply to the email with &ldquo;unsubscribe&rdquo;
          and we&rsquo;ll remove you immediately.
        </p>
      </>
    );
  }

  return (
    <>
      {status === "confirm" && (
        <>
          <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✉️</p>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem", color: "#111" }}>
            Unsubscribe from winded.vertigo?
          </h1>
          <p style={{ color: "#6b7280", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
            You won&rsquo;t receive any more outreach emails from us.
          </p>
          <button
            onClick={handleConfirm}
            style={{
              background: "#111",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "0.6rem 1.5rem",
              fontSize: "0.9rem",
              cursor: "pointer",
              marginBottom: "0.75rem",
              width: "100%",
            }}
          >
            Yes, unsubscribe me
          </button>
          <p style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
            Changed your mind?{" "}
            <span style={{ color: "#6b7280" }}>Just close this tab.</span>
          </p>
        </>
      )}

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
            <p style={{ color: "#6b7280", marginBottom: "1.25rem" }}>
              {orgName} has been removed from our outreach list.
            </p>
          )}
          <button
            onClick={() => {
              setStatus("loading");
              fetch(`/api/resubscribe?t=${encodeURIComponent(token!)}`, { method: "POST" })
                .then((r) => r.json())
                .then((data) => setStatus(data.success ? "resubscribed" : "error"))
                .catch(() => setStatus("error"));
            }}
            style={{
              background: "transparent",
              color: "#6b7280",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              padding: "0.5rem 1.25rem",
              fontSize: "0.8rem",
              cursor: "pointer",
              marginBottom: "0.5rem",
            }}
          >
            Actually, re-subscribe me
          </button>
        </>
      )}

      {status === "resubscribed" && (
        <>
          <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>👋</p>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem", color: "#111" }}>
            You&rsquo;re back on the list
          </h1>
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
            Good to have you. You may continue to receive emails from winded.vertigo.
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
