"use client";

import { useState } from "react";

interface Props {
  url: string;
  /** Optional label override; defaults to "copy" / "copied ✓". */
  label?: string;
}

export function CopyLinkButton({ url, label }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Older browsers / no permission — fallback: select-and-prompt
      window.prompt("copy this link:", url);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline whitespace-nowrap"
      aria-label={`copy link to ${url}`}
    >
      {copied ? "copied ✓" : (label ?? "copy")}
    </button>
  );
}
