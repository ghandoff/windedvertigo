"use client";

/**
 * Polished pill-button toggle that reveals the management sections
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
      className="flex items-center gap-2.5 text-xs font-semibold tracking-wide rounded-lg border px-4 py-2.5 transition-all duration-200"
      style={{
        backgroundColor: isOpen
          ? "rgba(255, 235, 210, 0.2)"
          : "rgba(39, 50, 72, 0.04)",
        borderColor: isOpen
          ? "rgba(203, 120, 88, 0.2)"
          : "rgba(39, 50, 72, 0.1)",
        color: isOpen ? "var(--wv-sienna)" : "rgba(39, 50, 72, 0.45)",
      }}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        className="transition-transform duration-200"
        style={{ transform: isOpen ? "rotate(90deg)" : "none" }}
      >
        <path
          d="M2.5 1L7.5 5L2.5 9"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>{isOpen ? "hide management" : "manage account"}</span>
    </button>
  );
}
