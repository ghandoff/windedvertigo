"use client";

import { useTransition, useState } from "react";
import { updateBiographyAction } from "./actions";

export function BiographyForm({ personId, initialNotes }: { personId: string; initialNotes: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(initialNotes ?? "");

  if (!isEditing) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">biography / story</h3>
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs text-primary hover:underline"
          >
            edit
          </button>
        </div>
        {notes ? (
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{notes}</p>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            no biography yet — click edit to add this person&apos;s story
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      data-1p-ignore autoComplete="off"
      action={(formData) => {
        startTransition(async () => {
          await updateBiographyAction(personId, formData);
          setNotes(formData.get("notes") as string);
          setIsEditing(false);
        });
      }}
      className="rounded-lg border border-border bg-card p-4 space-y-3"
    >
      <h3 className="text-sm font-semibold text-foreground">biography / story</h3>
      <textarea
        name="notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={8}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed resize-y"
        placeholder="write about this person's life, stories, memories..."
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "saving..." : "save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setNotes(initialNotes ?? "");
            setIsEditing(false);
          }}
          className="rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/80"
        >
          cancel
        </button>
      </div>
    </form>
  );
}
