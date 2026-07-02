"use client";

import { useState } from "react";
import { sendPollReminderAction } from "./actions";

interface Props {
  pollId: string;
  inviteeEmails: string[];
  respondentNames: string[]; // names of people who already responded
}

export function RemindSection({ pollId, inviteeEmails, respondentNames }: Props) {
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());

  // Heuristic: an invitee has responded if their email's local-part appears in any respondent_name
  function hasResponded(email: string): boolean {
    const localPart = email.split("@")[0].toLowerCase();
    return respondentNames.some((n) => n.toLowerCase().includes(localPart));
  }

  const nonResponders = inviteeEmails.filter((e) => !hasResponded(e));

  async function remind(email: string) {
    setSending(email);
    await sendPollReminderAction(pollId, [email]);
    setSent((prev) => new Set([...prev, email]));
    setSending(null);
  }

  async function remindAll() {
    setSending("all");
    await sendPollReminderAction(pollId, nonResponders);
    setSent(new Set(nonResponders));
    setSending(null);
  }

  if (inviteeEmails.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">invitees</p>
        {nonResponders.length > 0 && (
          <button
            type="button"
            onClick={remindAll}
            disabled={sending !== null}
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline disabled:opacity-50"
          >
            {sending === "all" ? "sending…" : `remind all (${nonResponders.length})`}
          </button>
        )}
      </div>

      <ul className="space-y-1.5">
        {inviteeEmails.map((email) => {
          const responded = hasResponded(email);
          const wasSent = sent.has(email);
          return (
            <li key={email} className="flex items-center justify-between text-xs">
              <span className={responded ? "text-muted-foreground line-through" : "text-foreground"}>
                {email}
              </span>
              <span className="flex items-center gap-2">
                {responded ? (
                  <span className="text-muted-foreground">responded ✓</span>
                ) : wasSent ? (
                  <span className="text-green-600 dark:text-green-400">reminded ✓</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => remind(email)}
                    disabled={sending !== null}
                    className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline disabled:opacity-50"
                  >
                    {sending === email ? "sending…" : "remind"}
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
