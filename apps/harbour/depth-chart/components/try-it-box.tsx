"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const placeholder =
  "students will evaluate the ethical implications of AI in healthcare...";

export default function TryItBox() {
  const router = useRouter();
  const [text, set_text] = useState("");
  const [loading, set_loading] = useState(false);

  const handle_submit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    set_loading(true);
    // navigate to upload page with pre-filled text via query param
    const params = new URLSearchParams({ q: trimmed });
    router.push(`/upload?${params.toString()}`);
  }, [text, loading, router]);

  return (
    <div className="max-w-xl mx-auto w-full">
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => set_text(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handle_submit();
            }
          }}
          placeholder={placeholder}
          rows={2}
          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 pr-24 text-sm text-[var(--color-text-on-dark)] placeholder:text-white/30 resize-none focus:border-[var(--wv-champagne)] focus:outline-none transition-colors"
        />
        <button
          onClick={handle_submit}
          disabled={!text.trim() || loading}
          className="absolute right-2 bottom-2 px-4 py-1.5 rounded-lg bg-[var(--wv-champagne)] text-[var(--wv-cadet)] text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          {loading ? "..." : "try it →"}
        </button>
      </div>
      <p className="text-[10px] text-[var(--color-text-on-dark-muted)] mt-2 text-center">
        paste a learning objective or short lesson excerpt — no sign-up needed
      </p>
    </div>
  );
}
