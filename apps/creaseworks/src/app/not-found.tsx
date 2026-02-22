/**
 * Custom 404 page — shown when a route doesn't match.
 *
 * Branded with the creaseworks colour palette and lowercase style.
 */
export default function NotFound() {
  return (
    <main
      className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center"
      style={{ color: "#ffebd2" }}
    >
      <h1
        className="text-6xl font-bold tracking-tight mb-2"
        style={{ color: "#cb7858" }}
      >
        404
      </h1>

      <p className="text-lg font-medium mb-1">page not found</p>

      <p className="text-sm opacity-60 mb-8 max-w-sm">
        the page you’re looking for doesn’t exist or has been moved.
      </p>

      <a
        href="/"
        className="px-4 py-2 text-sm font-medium rounded hover:opacity-80 transition-opacity"
        style={{ backgroundColor: "#cb7858", color: "#273248" }}
      >
        back to homepage
      </a>
    </main>
  );
}
