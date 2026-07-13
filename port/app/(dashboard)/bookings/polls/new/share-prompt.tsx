"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CopyLinkButton } from "@/app/(dashboard)/bookings/components/copy-link-button";
import { sendPollInvitesAction } from "./actions";

interface Props {
  shareUrl: string;
  slug: string;
  pollId: string;
}

export function SharePrompt({ shareUrl, slug, pollId }: Props) {
  const router = useRouter();
  const [emails, setEmails] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSendInvites() {
    const emailList = emails.split(/[,\n]+/).map(e => e.trim()).filter(Boolean);
    if (!emailList.length) return;
    setSending(true);
    await sendPollInvitesAction(pollId, emailList);
    setSending(false);
    setSent(true);
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="space-y-2">
        <p className="text-sm font-medium">poll created!</p>
        <p className="text-xs text-muted-foreground">share this link so people can respond.</p>
      </div>

      <div className="rounded-md border bg-muted/30 p-3 space-y-2">
        <p className="text-xs font-mono break-all text-muted-foreground">{shareUrl}</p>
        <CopyLinkButton url={shareUrl} label="copy share link" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="invite-emails" className="text-xs">
          invite by email{" "}
          <span className="text-muted-foreground font-normal">(optional — comma or newline separated)</span>
        </Label>
        {sent ? (
          <p className="text-xs text-green-600 dark:text-green-400">invites sent ✓</p>
        ) : (
          <>
            <Textarea
              id="invite-emails"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="alice@example.com, bob@example.com"
              rows={3}
              className="text-sm"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleSendInvites}
              disabled={sending || !emails.trim()}
            >
              {sending ? "sending…" : "send invites"}
            </Button>
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Link
          href={`/bookings/polls/${slug}`}
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          view poll →
        </Link>
        <button
          type="button"
          onClick={() => router.push("/bookings/polls")}
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          done
        </button>
      </div>
    </div>
  );
}
