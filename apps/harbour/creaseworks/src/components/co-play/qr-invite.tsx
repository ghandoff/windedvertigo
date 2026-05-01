"use client";

/**
 * QR invite card — displays a co-play invite code prominently
 * with copy-link and share buttons.
 *
 * No external QR library; uses a free API fallback for the QR image
 * and degrades gracefully if the image fails to load.
 */

import { useCallback, useState } from "react";

const APP_BASE_URL = "https://windedvertigo.com/harbour/creaseworks";

interface QrInviteProps {
  inviteCode: string;
}

export function QrInvite({ inviteCode }: QrInviteProps) {
  const [copied, setCopied] = useState(false);
  const [qrError, setQrError] = useState(false);

  const joinUrl = `${APP_BASE_URL}/co-play/${inviteCode}`;

  // QR code via free API (no dependency needed)
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(joinUrl)}&margin=8&format=svg`;

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = joinUrl;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [joinUrl]);

  const handleShare = useCallback(async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: "co-play invite",
        text: `join my co-play session! use code ${inviteCode}`,
        url: joinUrl,
      });
    } catch {
      // User cancelled or share failed — no action needed
    }
  }, [inviteCode, joinUrl]);

  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <div
      className="rounded-xl border p-6 text-center"
      style={{
        backgroundColor: "white",
        borderColor: "var(--wv-sienna)",
        borderWidth: 2,
      }}
    >
      {/* heading */}
      <p
        className="text-xs font-semibold uppercase tracking-widest mb-4"
        style={{ color: "var(--wv-sienna)" }}
      >
        co-play invite
      </p>

      {/* QR code (degrades gracefully) */}
      {!qrError && (
        <div className="flex justify-center mb-4">
          <img
            src={qrSrc}
            alt={`QR code linking to ${joinUrl}`}
            width={160}
            height={160}
            className="rounded-lg"
            style={{
              border: "1px solid var(--wv-champagne)",
              padding: 4,
              backgroundColor: "white",
            }}
            onError={() => setQrError(true)}
          />
        </div>
      )}

      {/* invite code — large, spaced-out, monospace */}
      <div
        className="inline-flex items-center gap-1 rounded-lg px-5 py-3 mb-4"
        style={{ backgroundColor: "var(--wv-cream)" }}
      >
        {inviteCode.split("").map((char, i) => (
          <span
            key={i}
            className="text-3xl font-mono font-bold"
            style={{
              color: "var(--wv-redwood)",
              letterSpacing: "0.15em",
              lineHeight: 1,
            }}
          >
            {char}
          </span>
        ))}
      </div>

      <p className="text-xs mb-5" style={{ color: "var(--wv-cadet)", opacity: 0.5 }}>
        share this code or scan the QR to join
      </p>

      {/* action buttons */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={handleCopyLink}
          className="rounded-lg px-4 py-2.5 text-sm font-medium transition-all"
          style={{
            backgroundColor: copied ? "var(--wv-cadet)" : "var(--wv-sienna)",
            color: "white",
            minHeight: 44,
          }}
        >
          {copied ? "copied!" : "copy link"}
        </button>

        {canShare && (
          <button
            onClick={handleShare}
            className="rounded-lg px-4 py-2.5 text-sm font-medium border transition-all hover:opacity-80"
            style={{
              borderColor: "var(--wv-sienna)",
              color: "var(--wv-sienna)",
              backgroundColor: "transparent",
              minHeight: 44,
            }}
          >
            share
          </button>
        )}
      </div>
    </div>
  );
}
