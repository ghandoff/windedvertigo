"use client";

/**
 * Root-level error boundary — catches errors in the root layout itself.
 *
 * Unlike error.tsx, global-error.tsx replaces the ENTIRE page (including
 * <html> and <body>) so we must provide those tags here.  This boundary
 * is rarely triggered — only when layout.tsx or providers.tsx throw.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          backgroundColor: "#0f1923",
          color: "#e8edf3",
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          margin: 0,
        }}
      >
        <main
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "1.5rem",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              fontSize: "2.5rem",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#AF4F41",
              marginBottom: "1rem",
            }}
          >
            something went wrong
          </h1>

          <p style={{ fontSize: "0.875rem", opacity: 0.55, marginBottom: "2rem", maxWidth: "28rem" }}>
            a critical error occurred. you can try again, or reload the page.
          </p>

          {process.env.NODE_ENV === "development" && error?.message && (
            <pre
              style={{
                fontSize: "0.75rem",
                opacity: 0.4,
                marginBottom: "1.5rem",
                maxWidth: "32rem",
                overflow: "auto",
                whiteSpace: "pre-wrap",
              }}
            >
              {error.message}
            </pre>
          )}

          <div style={{ display: "flex", gap: "1rem" }}>
            <button
              onClick={() => reset()}
              style={{
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                borderRadius: "0.375rem",
                backgroundColor: "#AF4F41",
                color: "#fff",
                border: "none",
                cursor: "pointer",
              }}
            >
              try again
            </button>

            <a
              href="/"
              style={{
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                borderRadius: "0.375rem",
                border: "1px solid #AF4F41",
                color: "#AF4F41",
                textDecoration: "none",
              }}
            >
              back to vault
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
