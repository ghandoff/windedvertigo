import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function NotFound() {
  return (
    <>
      <SiteHeader />

      <main id="main-content">
        <div className="container" style={{ textAlign: "center", padding: "var(--space-3xl) 0" }}>
          <h2 className="hero-title">404</h2>
          <p style={{ fontSize: "1.2rem", marginBottom: "var(--space-xl)" }}>
            this page doesn&apos;t exist — but there&apos;s plenty more to explore.
          </p>
          <div style={{ display: "flex", gap: "var(--space-lg)", justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/"
              style={{
                padding: "12px 24px",
                background: "var(--accent)",
                color: "var(--wv-white)",
                borderRadius: 8,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              go home
            </Link>
            <Link
              href="/quadrants/"
              style={{
                padding: "12px 24px",
                border: "1px solid rgba(255,235,210,0.3)",
                color: "var(--wv-white)",
                borderRadius: 8,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              see what we do
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
