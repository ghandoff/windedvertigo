"use client";

/**
 * Subtle toggle that reveals the grownup management sections
 * (team, analytics) on the profile page.
 *
 * Uses a URL param (?manage=true) so the state survives page
 * refreshes and the domain verification callback redirect.
 */

import { useRouter, useSearchParams } from "next/navigation";

export default function ProfileManageToggle({
  isOpen,
}: {
  isOpen: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const toggle = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (isOpen) {
      params.delete("manage");
    } else {
      params.set("manage", "true");
    }
    const qs = params.toString();
    router.push(`/profile${qs ? `?${qs}` : ""}`);
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 text-xs font-medium transition-colors group"
      style={{ color: "rgba(39, 50, 72, 0.35)" }}
    >
      <span
        className="inline-block w-4 h-4 rounded-full border flex items-center justify-center transition-colors"
        style={{
          borderColor: "rgba(39, 50, 72, 0.15)",
          backgroundColor: isOpen ? "rgba(39, 50, 72, 0.06)" : "transparent",
        }}
      >
        <svg
          width="8"
          height="8"
          viewBox="0 0 8 8"
          fill="none"
          className="transition-transform"
          style={{ transform: isOpen ? "rotate(90deg)" : "none" }}
        >
          <path
            d="M2 1L6 4L2 7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="group-hover:text-cadet/50 transition-colors">
        {isOpen ? "hide" : "manage account"}
      </span>
    </button>
  );
}
