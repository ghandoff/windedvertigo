/**
 * Custom 404 page — shown when a route doesn't match or notFound() is called.
 *
 * Uses the vault dark theme colour palette and lowercase style.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1
        className="text-6xl font-bold tracking-tight mb-2"
        style={{ color: "var(--vault-accent)" }}
      >
        404
      </h1>

      <p
        className="text-lg font-medium mb-1"
        style={{ color: "var(--vault-text)" }}
      >
        page not found
      </p>

      <p
        className="text-sm mb-8 max-w-sm"
        style={{ color: "var(--vault-text-muted)" }}
      >
        the activity or page you&apos;re looking for doesn&apos;t exist or has
        been moved.
      </p>

      <a
        href="/"
        className="px-4 py-2 text-sm font-medium rounded hover:opacity-80 transition-opacity"
        style={{ backgroundColor: "var(--vault-accent)", color: "#fff" }}
      >
        back to vault
      </a>
    </main>
  );
}
