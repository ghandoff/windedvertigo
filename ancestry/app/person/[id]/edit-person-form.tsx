"use client";

import { useTransition, useState } from "react";
import type { Person } from "@/lib/types";
import { updatePersonAction, addEventAction, deleteEventAction } from "./actions";
import { formatFuzzyDate } from "@/lib/db";

const SEX_OPTIONS = [
  { value: "M", label: "male ♂" },
  { value: "F", label: "female ♀" },
  { value: "X", label: "non-binary ⚧" },
  { value: "U", label: "unknown" },
];

const EVENT_TYPES = [
  "birth", "death", "marriage", "divorce", "immigration", "emigration",
  "naturalization", "census", "residence", "military", "education",
  "occupation", "graduation", "retirement", "burial", "baptism",
  "confirmation", "ordination", "other",
];

const EVENT_ICONS: Record<string, string> = {
  birth: "🌱",
  death: "✝",
  marriage: "💍",
  divorce: "⚖",
  immigration: "🚢",
  emigration: "✈",
  naturalization: "📜",
  census: "📋",
  residence: "🏠",
  military: "⚔",
  education: "📚",
  occupation: "💼",
  graduation: "🎓",
  retirement: "🏖",
  burial: "⚱",
  baptism: "💧",
  confirmation: "✋",
  ordination: "📿",
  other: "·",
};

export function EditPersonForm({ person }: { person: Person }) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [sex, setSex] = useState<string>(person.sex ?? "U");

  const primaryName = person.names.find((n) => n.is_primary) ?? person.names[0];
  const birthName = person.names.find((n) => n.name_type === "birth");
  const marriedName = person.names.find((n) => n.name_type === "married");

  // maiden name is the birth name's surname when it differs from current primary surname
  const existingMaidenName = birthName?.surname !== primaryName?.surname ? birthName?.surname : (marriedName ? birthName?.surname : null);
  const isFemale = sex === "F";

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
      >
        edit
      </button>
    );
  }

  return (
    <div className="space-y-6">
      {/* person details form */}
      <form
        action={(formData) => {
          startTransition(async () => {
            await updatePersonAction(person.id, formData);
            setIsEditing(false);
          });
        }}
        className="rounded-lg border border-border bg-card p-4 space-y-4"
      >
        <h3 className="text-sm font-semibold text-foreground">edit person</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">given names</label>
            <input
              name="givenNames"
              defaultValue={primaryName?.given_names ?? ""}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">surname</label>
            <input
              name="surname"
              defaultValue={primaryName?.surname ?? ""}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">sex</label>
            <select
              name="sex"
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              {SEX_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">living status</label>
            <select
              name="isLiving"
              defaultValue={person.is_living ? "true" : "false"}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="true">living</option>
              <option value="false">deceased</option>
            </select>
          </div>
        </div>

        {isFemale && (
          <div>
            <label className="block text-xs text-muted-foreground mb-1">maiden name (birth surname)</label>
            <input
              name="maidenName"
              defaultValue={existingMaidenName ?? ""}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              placeholder="surname before marriage"
            />
          </div>
        )}

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
            onClick={() => setIsEditing(false)}
            className="rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/80"
          >
            cancel
          </button>
        </div>
      </form>

      {/* events section */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">events</h3>
          <button
            onClick={() => setShowAddEvent(!showAddEvent)}
            className="text-xs text-primary hover:underline"
          >
            {showAddEvent ? "cancel" : "+ add event"}
          </button>
        </div>

        {showAddEvent && (
          <form
            action={(formData) => {
              startTransition(async () => {
                await addEventAction(person.id, formData);
                setShowAddEvent(false);
              });
            }}
            className="space-y-3 border-b border-border pb-3"
          >
            <div>
              <label className="block text-xs text-muted-foreground mb-1">event type</label>
              <select
                name="eventType"
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">date</label>
                <input
                  name="date"
                  type="date"
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">description</label>
                <input
                  name="description"
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  placeholder="optional details"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "adding..." : "add event"}
            </button>
          </form>
        )}

        {person.events.length === 0 && !showAddEvent && (
          <p className="text-xs text-muted-foreground">no events recorded</p>
        )}

        <ul className="space-y-2">
          {person.events.map((evt) => (
            <li key={evt.id} className="flex items-start gap-2 text-sm">
              <span className="shrink-0 w-5 text-center" title={evt.event_type}>
                {EVENT_ICONS[evt.event_type] ?? "·"}
              </span>
              <div className="flex-1 min-w-0">
                <span className="font-medium">{evt.event_type}</span>
                {evt.date && (
                  <span className="text-muted-foreground ml-1.5">
                    {formatFuzzyDate(evt.date)}
                  </span>
                )}
                {evt.description && (
                  <span className="text-muted-foreground ml-1.5">— {evt.description}</span>
                )}
              </div>
              <button
                onClick={() => {
                  startTransition(async () => {
                    await deleteEventAction(evt.id, person.id);
                  });
                }}
                disabled={isPending}
                className="shrink-0 text-xs text-destructive hover:underline disabled:opacity-50"
                title="delete event"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
