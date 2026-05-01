"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

interface ContactAvatarProps {
  contactId: string;
  name: string;
  photoUrl?: string;
  size?: "sm" | "md" | "lg";
  showEnrich?: boolean;
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

const SIZE = {
  sm: { ring: "h-8 w-8", text: "text-xs", btn: "h-4 w-4" },
  md: { ring: "h-10 w-10", text: "text-sm", btn: "h-3.5 w-3.5" },
  lg: { ring: "h-16 w-16", text: "text-lg", btn: "h-4 w-4" },
};

export function ContactAvatar({
  contactId,
  name,
  photoUrl: initialPhotoUrl,
  size = "md",
  showEnrich = false,
}: ContactAvatarProps) {
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);
  const [enriching, setEnriching] = useState(false);
  const [enrichNote, setEnrichNote] = useState<string | null>(null);

  async function handleEnrich() {
    setEnriching(true);
    setEnrichNote(null);
    try {
      const res = await fetch(`/api/contacts/${contactId}/enrich`, { method: "POST" });
      const data = await res.json();
      if (data.photoUrl) {
        setPhotoUrl(data.photoUrl);
        setEnrichNote(null);
      } else {
        setEnrichNote("no photo found");
      }
    } catch {
      setEnrichNote("error fetching photo");
    } finally {
      setEnriching(false);
    }
  }

  const s = SIZE[size];

  return (
    <div className="flex items-center gap-3">
      {/* Avatar ring */}
      <div className={`relative shrink-0 ${s.ring} rounded-full overflow-hidden bg-muted border border-border`}>
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={name}
            className="h-full w-full object-cover"
            onError={() => setPhotoUrl(undefined)}
          />
        ) : (
          <span className={`flex h-full w-full items-center justify-center font-semibold text-muted-foreground ${s.text}`}>
            {initials(name)}
          </span>
        )}
      </div>

      {/* Enrich button */}
      {showEnrich && (
        <div className="flex flex-col gap-0.5">
          <button
            onClick={handleEnrich}
            disabled={enriching}
            title="Fetch profile photo from LinkedIn / Gravatar"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Sparkles className={`${s.btn} shrink-0`} />
            {enriching ? "fetching photo…" : photoUrl ? "refresh photo" : "fetch photo"}
          </button>
          {enrichNote && (
            <span className="text-[10px] text-muted-foreground">{enrichNote}</span>
          )}
        </div>
      )}
    </div>
  );
}
