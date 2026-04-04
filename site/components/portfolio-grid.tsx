import Link from "next/link";

/**
 * Spinning four-quadrant grid that replaces the period after "do" in the nav.
 * Sized in em units so it matches the period at any font-size.
 * Links to /portfolio/ — a subtle Easter egg.
 */
export function PortfolioGrid() {
  return (
    <Link href="/quadrants/" className="portfolio-dot" aria-label="quadrants">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <rect x="1" y="1" width="10" height="10" rx="1" />
        <rect x="13" y="1" width="10" height="10" rx="1" />
        <rect x="1" y="13" width="10" height="10" rx="1" />
        <rect x="13" y="13" width="10" height="10" rx="1" />
      </svg>
    </Link>
  );
}
