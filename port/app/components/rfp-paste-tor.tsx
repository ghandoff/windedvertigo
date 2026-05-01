"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  rfpId: string;
}

const MIN_CHARS = 100;

/**
 * Paste-TOR-as-file block for the edit page. Collects pasted plain text,
 * POSTs to /api/rfp-radar/{id}/document/paste which stores the text as a
 * .txt in R2 and attaches it to the RFP (same effect as uploading a file).
 */
export function RfpPasteTor({ rfpId }: Props) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "done">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const charCount = text.length;
  const tooShort = charCount > 0 && charCount < MIN_CHARS;
  const canSave = charCount >= MIN_CHARS && saveState !== "saving";

  async function handleSave() {
    if (charCount < MIN_CHARS) return;
    setSaveState("saving");
    setSaveError(null);

    try {
      const res = await fetch(`/api/rfp-radar/${rfpId}/document/paste`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data: { error?: string; ok?: boolean } = await res
        .json()
        .catch(() => ({ error: "server returned invalid response" }));

      if (res.ok) {
        setSaveState("done");
        setTimeout(() => {
          setText("");
          setSaveState("idle");
          // router.refresh picks up the new rfpDocumentUrl on sibling components
          router.refresh();
        }, 2000);
      } else {
        setSaveState("idle");
        setSaveError(data.error ?? `save failed (${res.status})`);
      }
    } catch (err) {
      setSaveState("idle");
      setSaveError(err instanceof Error ? err.message : "save failed — network error");
    }
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ClipboardPaste className="h-3.5 w-3.5" />
        paste TOR text instead
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3 bg-muted/20">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          paste the full TOR text — saved as a .txt file and attached to this RFP.
        </p>
        <button
          type="button"
          onClick={() => { setExpanded(false); setText(""); setSaveError(null); }}
          className="text-[10px] text-muted-foreground hover:text-foreground"
        >
          cancel
        </button>
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="paste the full TOR text here…"
        rows={10}
        className="resize-y font-mono text-xs"
        disabled={saveState === "saving"}
      />
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[10px] ${
            tooShort ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {charCount.toLocaleString()} chars
          {tooShort && ` — need at least ${MIN_CHARS}`}
        </span>
        <Button
          type="button"
          size="sm"
          className="gap-2"
          disabled={!canSave}
          onClick={handleSave}
        >
          {saveState === "saving" ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> saving…</>
          ) : saveState === "done" ? (
            <><CheckCircle2 className="h-3.5 w-3.5 text-green-200" /> saved!</>
          ) : (
            "save as TOR"
          )}
        </Button>
      </div>
      {saveError && (
        <div className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{saveError}</span>
        </div>
      )}
    </div>
  );
}
