"use client";

import { useState, useTransition, useMemo } from "react";
import type { Person, PersonName, PersonEvent } from "@/lib/types";
import { mergeWithSelectionsAction, type MergeSelections } from "./actions";

type Props = {
  personA: Person;
  personB: Person;
  onComplete: () => void;
  onCancel: () => void;
};

type Step = 1 | 2 | 3;

type FieldChoice = "a" | "b" | "combine";

type Selections = {
  keepNameIds: Set<string>;
  keepEventIds: Set<string>;
  sex: FieldChoice;
  isLiving: FieldChoice;
  thumbnail: FieldChoice;
  notes: FieldChoice;
  keepRecordId: string;
};

function getDisplayName(p: Person): string {
  const primary = p.names.find((n) => n.is_primary) ?? p.names[0];
  return primary?.display ?? [primary?.given_names, primary?.surname].filter(Boolean).join(" ") ?? "unnamed";
}

function formatDate(e: PersonEvent): string {
  if (e.date) return e.date.display;
  if (e.sort_date) return e.sort_date;
  return "";
}

function eventSummary(e: PersonEvent): string {
  const parts = [e.event_type];
  const d = formatDate(e);
  if (d) parts.push(d);
  if (e.description) parts.push(e.description);
  return parts.join(" — ");
}

/** check if two events look like duplicates (same type, similar date within ~1yr) */
function arePossibleDuplicateEvents(a: PersonEvent, b: PersonEvent): boolean {
  if (a.event_type !== b.event_type) return false;
  if (!a.sort_date || !b.sort_date) return a.event_type === b.event_type;
  const ya = new Date(a.sort_date).getFullYear();
  const yb = new Date(b.sort_date).getFullYear();
  return Math.abs(ya - yb) <= 1;
}

/** count how many "filled in" fields a person has */
function dataScore(p: Person): number {
  let s = 0;
  s += p.names.length;
  s += p.events.length;
  if (p.sex && p.sex !== "U") s += 1;
  if (p.thumbnail_url) s += 1;
  if (p.notes) s += 1;
  return s;
}

export function MergeWizard({ personA, personB, onComplete, onCancel }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [merging, startMerge] = useTransition();

  // smart default: prefer the person with more data
  const defaultPref = dataScore(personA) >= dataScore(personB) ? "a" : "b";

  const [selections, setSelections] = useState<Selections>(() => {
    // all names checked by default
    const allNameIds = new Set([
      ...personA.names.map((n) => n.id),
      ...personB.names.map((n) => n.id),
    ]);

    // all events checked by default
    const allEventIds = new Set([
      ...personA.events.map((e) => e.id),
      ...personB.events.map((e) => e.id),
    ]);

    return {
      keepNameIds: allNameIds,
      keepEventIds: allEventIds,
      sex: defaultPref,
      isLiving: defaultPref,
      thumbnail: personA.thumbnail_url ? "a" : personB.thumbnail_url ? "b" : "a",
      notes: personA.notes && personB.notes ? "combine" : personA.notes ? "a" : "b",
      keepRecordId: defaultPref === "a" ? personA.id : personB.id,
    };
  });

  // find possible duplicate event pairs for visual flagging
  const duplicateEventPairs = useMemo(() => {
    const pairs: Set<string> = new Set();
    for (const a of personA.events) {
      for (const b of personB.events) {
        if (arePossibleDuplicateEvents(a, b)) {
          pairs.add(a.id);
          pairs.add(b.id);
        }
      }
    }
    return pairs;
  }, [personA.events, personB.events]);

  function toggleName(id: string) {
    setSelections((prev) => {
      const next = new Set(prev.keepNameIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, keepNameIds: next };
    });
  }

  function toggleEvent(id: string) {
    setSelections((prev) => {
      const next = new Set(prev.keepEventIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, keepEventIds: next };
    });
  }

  function handleConfirmMerge() {
    const keepId = selections.keepRecordId;
    const removeId = keepId === personA.id ? personB.id : personA.id;

    const sexVal = selections.sex === "a" ? personA.sex : personB.sex;
    const livingVal = selections.sex === "a" ? personA.is_living : personB.is_living;
    const thumbVal = selections.thumbnail === "a" ? personA.thumbnail_url : personB.thumbnail_url;

    let notesVal: string | null = null;
    if (selections.notes === "a") notesVal = personA.notes;
    else if (selections.notes === "b") notesVal = personB.notes;
    else notesVal = [personA.notes, personB.notes].filter(Boolean).join("\n\n---\n\n") || null;

    const mergeData: MergeSelections = {
      keepNames: Array.from(selections.keepNameIds),
      keepEvents: Array.from(selections.keepEventIds),
      sex: sexVal ?? "U",
      isLiving: selections.isLiving === "a" ? personA.is_living : personB.is_living,
      thumbnailUrl: thumbVal,
      notes: notesVal,
    };

    startMerge(async () => {
      await mergeWithSelectionsAction(keepId, removeId, mergeData);
      onComplete();
    });
  }

  // -------------------------------------------------------------------------
  // merged preview for step 3
  // -------------------------------------------------------------------------
  const preview = useMemo(() => {
    const allNames = [...personA.names, ...personB.names];
    const keptNames = allNames.filter((n) => selections.keepNameIds.has(n.id));
    const allEvents = [...personA.events, ...personB.events];
    const keptEvents = allEvents.filter((e) => selections.keepEventIds.has(e.id));

    const sex = selections.sex === "a" ? personA.sex : personB.sex;
    const isLiving = selections.isLiving === "a" ? personA.is_living : personB.is_living;
    const thumbnail = selections.thumbnail === "a" ? personA.thumbnail_url : personB.thumbnail_url;

    let notes: string | null = null;
    if (selections.notes === "a") notes = personA.notes;
    else if (selections.notes === "b") notes = personB.notes;
    else notes = [personA.notes, personB.notes].filter(Boolean).join("\n\n---\n\n") || null;

    return { keptNames, keptEvents, sex, isLiving, thumbnail, notes };
  }, [selections, personA, personB]);

  const nameA = getDisplayName(personA);
  const nameB = getDisplayName(personB);

  // -------------------------------------------------------------------------
  // render
  // -------------------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50">
      <div className="min-h-full flex items-start justify-center p-4 pt-8 pb-8">
        <div className="bg-card border border-border rounded-lg w-full max-w-3xl shadow-xl">
          {/* header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">merge wizard</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                step {step} of 3 — {step === 1 ? "compare" : step === 2 ? "resolve" : "confirm"}
              </p>
            </div>
            <div className="flex gap-1.5">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 w-6 rounded-full transition-colors ${
                    s <= step ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* ----------------------------------------------------------- */}
            {/* STEP 1: COMPARE                                              */}
            {/* ----------------------------------------------------------- */}
            {step === 1 && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  side-by-side comparison of the two person records.
                  differences are highlighted.
                </p>

                <div className="grid grid-cols-[1fr_1fr] gap-3 text-sm">
                  {/* column headers */}
                  <div className="font-medium text-foreground text-xs uppercase tracking-wide pb-1 border-b border-border">
                    {nameA}
                  </div>
                  <div className="font-medium text-foreground text-xs uppercase tracking-wide pb-1 border-b border-border">
                    {nameB}
                  </div>

                  {/* thumbnail */}
                  <CompareRow label="photo" differs={personA.thumbnail_url !== personB.thumbnail_url}>
                    <Thumb url={personA.thumbnail_url} />
                    <Thumb url={personB.thumbnail_url} />
                  </CompareRow>

                  {/* sex */}
                  <CompareRow label="sex" differs={personA.sex !== personB.sex}>
                    <span className="text-sm">{personA.sex ?? "unknown"}</span>
                    <span className="text-sm">{personB.sex ?? "unknown"}</span>
                  </CompareRow>

                  {/* living */}
                  <CompareRow label="living" differs={personA.is_living !== personB.is_living}>
                    <span className="text-sm">{personA.is_living ? "yes" : "no"}</span>
                    <span className="text-sm">{personB.is_living ? "yes" : "no"}</span>
                  </CompareRow>

                  {/* names */}
                  <CompareRow label="names" differs={false}>
                    <NameList names={personA.names} />
                    <NameList names={personB.names} />
                  </CompareRow>

                  {/* events */}
                  <CompareRow label="events" differs={false}>
                    <EventList events={personA.events} />
                    <EventList events={personB.events} />
                  </CompareRow>

                  {/* notes */}
                  <CompareRow label="notes" differs={personA.notes !== personB.notes}>
                    <span className="text-xs whitespace-pre-wrap">{personA.notes ?? "—"}</span>
                    <span className="text-xs whitespace-pre-wrap">{personB.notes ?? "—"}</span>
                  </CompareRow>
                </div>
              </div>
            )}

            {/* ----------------------------------------------------------- */}
            {/* STEP 2: RESOLVE                                              */}
            {/* ----------------------------------------------------------- */}
            {step === 2 && (
              <div className="space-y-5">
                <p className="text-xs text-muted-foreground">
                  choose which data to keep for each field. defaults prefer the
                  record with more complete data.
                </p>

                {/* sex */}
                <FieldSection label="sex">
                  <RadioRow
                    name="sex"
                    value={selections.sex}
                    onChange={(v) => setSelections((s) => ({ ...s, sex: v }))}
                    labelA={personA.sex ?? "unknown"}
                    labelB={personB.sex ?? "unknown"}
                    showCombine={false}
                  />
                </FieldSection>

                {/* living */}
                <FieldSection label="living status">
                  <RadioRow
                    name="isLiving"
                    value={selections.isLiving}
                    onChange={(v) => setSelections((s) => ({ ...s, isLiving: v }))}
                    labelA={personA.is_living ? "yes" : "no"}
                    labelB={personB.is_living ? "yes" : "no"}
                    showCombine={false}
                  />
                </FieldSection>

                {/* thumbnail */}
                <FieldSection label="photo">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setSelections((s) => ({ ...s, thumbnail: "a" }))}
                      className={`rounded-md border-2 p-1 transition-colors ${
                        selections.thumbnail === "a"
                          ? "border-primary"
                          : "border-transparent hover:border-muted"
                      }`}
                    >
                      <Thumb url={personA.thumbnail_url} size={48} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelections((s) => ({ ...s, thumbnail: "b" }))}
                      className={`rounded-md border-2 p-1 transition-colors ${
                        selections.thumbnail === "b"
                          ? "border-primary"
                          : "border-transparent hover:border-muted"
                      }`}
                    >
                      <Thumb url={personB.thumbnail_url} size={48} />
                    </button>
                  </div>
                </FieldSection>

                {/* names */}
                <FieldSection label="names">
                  <p className="text-[11px] text-muted-foreground mb-2">
                    check which names to keep (you can keep all)
                  </p>
                  <div className="space-y-1.5">
                    {personA.names.map((n) => (
                      <NameCheckbox
                        key={n.id}
                        name={n}
                        checked={selections.keepNameIds.has(n.id)}
                        onChange={() => toggleName(n.id)}
                        badge="A"
                      />
                    ))}
                    {personB.names.map((n) => (
                      <NameCheckbox
                        key={n.id}
                        name={n}
                        checked={selections.keepNameIds.has(n.id)}
                        onChange={() => toggleName(n.id)}
                        badge="B"
                      />
                    ))}
                  </div>
                </FieldSection>

                {/* events */}
                <FieldSection label="events">
                  <p className="text-[11px] text-muted-foreground mb-2">
                    uncheck duplicate events you don&apos;t want to keep
                  </p>
                  <div className="space-y-1.5">
                    {personA.events.map((e) => (
                      <EventCheckbox
                        key={e.id}
                        event={e}
                        checked={selections.keepEventIds.has(e.id)}
                        onChange={() => toggleEvent(e.id)}
                        badge="A"
                        isDuplicate={duplicateEventPairs.has(e.id)}
                      />
                    ))}
                    {personB.events.map((e) => (
                      <EventCheckbox
                        key={e.id}
                        event={e}
                        checked={selections.keepEventIds.has(e.id)}
                        onChange={() => toggleEvent(e.id)}
                        badge="B"
                        isDuplicate={duplicateEventPairs.has(e.id)}
                      />
                    ))}
                  </div>
                </FieldSection>

                {/* notes */}
                <FieldSection label="notes">
                  <RadioRow
                    name="notes"
                    value={selections.notes}
                    onChange={(v) => setSelections((s) => ({ ...s, notes: v }))}
                    labelA={personA.notes ? `"${personA.notes.slice(0, 40)}${personA.notes.length > 40 ? "..." : ""}"` : "none"}
                    labelB={personB.notes ? `"${personB.notes.slice(0, 40)}${personB.notes.length > 40 ? "..." : ""}"` : "none"}
                    showCombine={!!(personA.notes && personB.notes)}
                  />
                </FieldSection>
              </div>
            )}

            {/* ----------------------------------------------------------- */}
            {/* STEP 3: CONFIRM                                              */}
            {/* ----------------------------------------------------------- */}
            {step === 3 && (
              <div className="space-y-5">
                <p className="text-xs text-muted-foreground">
                  preview of the merged record. choose which person ID to keep.
                </p>

                {/* keep record selector */}
                <FieldSection label="keep record">
                  <div className="flex gap-2">
                    <label className="flex items-center gap-2 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/50 transition-colors flex-1">
                      <input
                        type="radio"
                        name="keepRecord"
                        checked={selections.keepRecordId === personA.id}
                        onChange={() => setSelections((s) => ({ ...s, keepRecordId: personA.id }))}
                        className="accent-primary"
                      />
                      <span className="text-sm">{nameA}</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/50 transition-colors flex-1">
                      <input
                        type="radio"
                        name="keepRecord"
                        checked={selections.keepRecordId === personB.id}
                        onChange={() => setSelections((s) => ({ ...s, keepRecordId: personB.id }))}
                        className="accent-primary"
                      />
                      <span className="text-sm">{nameB}</span>
                    </label>
                  </div>
                </FieldSection>

                {/* preview card */}
                <div className="rounded-md border border-border p-4 space-y-3 bg-muted/20">
                  <div className="flex items-center gap-3">
                    <Thumb url={preview.thumbnail} size={40} />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {preview.keptNames.length > 0
                          ? (preview.keptNames.find((n) => n.is_primary) ?? preview.keptNames[0])?.display ??
                            [
                              (preview.keptNames.find((n) => n.is_primary) ?? preview.keptNames[0])?.given_names,
                              (preview.keptNames.find((n) => n.is_primary) ?? preview.keptNames[0])?.surname,
                            ].filter(Boolean).join(" ")
                          : "unnamed"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {preview.sex ?? "unknown"} · {preview.isLiving ? "living" : "deceased"}
                      </p>
                    </div>
                  </div>

                  {preview.keptNames.length > 1 && (
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground mb-1">names</p>
                      <div className="space-y-0.5">
                        {preview.keptNames.map((n) => (
                          <p key={n.id} className="text-xs text-foreground">
                            {n.display ?? [n.given_names, n.surname].filter(Boolean).join(" ")}
                            <span className="text-muted-foreground ml-1">({n.name_type})</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {preview.keptEvents.length > 0 && (
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground mb-1">events</p>
                      <div className="space-y-0.5">
                        {preview.keptEvents.map((e) => (
                          <p key={e.id} className="text-xs text-foreground">
                            {eventSummary(e)}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {preview.notes && (
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground mb-1">notes</p>
                      <p className="text-xs text-foreground whitespace-pre-wrap">{preview.notes}</p>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-orange-500">
                  this action is permanent. the removed record cannot be recovered.
                </p>
              </div>
            )}
          </div>

          {/* footer buttons */}
          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <button
              type="button"
              onClick={step === 1 ? onCancel : () => setStep((s) => (s - 1) as Step)}
              disabled={merging}
              className="rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/80 transition-colors min-h-[28px]"
            >
              {step === 1 ? "cancel" : "back"}
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as Step)}
                className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors min-h-[28px]"
              >
                next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirmMerge}
                disabled={merging}
                className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors min-h-[28px]"
              >
                {merging ? "merging..." : "confirm merge"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// sub-components
// ---------------------------------------------------------------------------

function CompareRow({
  label,
  differs,
  children,
}: {
  label: string;
  differs: boolean;
  children: [React.ReactNode, React.ReactNode];
}) {
  const bg = differs ? "bg-amber-500/5" : "";
  return (
    <>
      <div className={`col-span-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide pt-2`}>
        {label}
        {differs && <span className="ml-1 text-amber-500 normal-case">(different)</span>}
      </div>
      <div className={`rounded-md p-2 ${bg}`}>{children[0]}</div>
      <div className={`rounded-md p-2 ${bg}`}>{children[1]}</div>
    </>
  );
}

function Thumb({ url, size = 32 }: { url: string | null; size?: number }) {
  if (!url) {
    return (
      <div
        className="rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs"
        style={{ width: size, height: size }}
      >
        ?
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}

function NameList({ names }: { names: PersonName[] }) {
  if (names.length === 0) return <span className="text-xs text-muted-foreground">none</span>;
  return (
    <div className="space-y-0.5">
      {names.map((n) => (
        <p key={n.id} className="text-xs">
          {n.display ?? [n.given_names, n.surname].filter(Boolean).join(" ")}
          {n.is_primary && <span className="text-muted-foreground ml-1">(primary)</span>}
          {n.name_type !== "birth" && <span className="text-muted-foreground ml-1">({n.name_type})</span>}
        </p>
      ))}
    </div>
  );
}

function EventList({ events }: { events: PersonEvent[] }) {
  if (events.length === 0) return <span className="text-xs text-muted-foreground">none</span>;
  return (
    <div className="space-y-0.5">
      {events.map((e) => (
        <p key={e.id} className="text-xs">{eventSummary(e)}</p>
      ))}
    </div>
  );
}

function FieldSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
        {label}
      </p>
      {children}
    </div>
  );
}

function RadioRow({
  name,
  value,
  onChange,
  labelA,
  labelB,
  showCombine,
}: {
  name: string;
  value: FieldChoice;
  onChange: (v: FieldChoice) => void;
  labelA: string;
  labelB: string;
  showCombine: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <label className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors text-xs min-h-[28px]">
        <input
          type="radio"
          name={name}
          checked={value === "a"}
          onChange={() => onChange("a")}
          className="accent-primary"
        />
        <span className="font-medium text-primary/70 mr-1">A</span>
        {labelA}
      </label>
      <label className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors text-xs min-h-[28px]">
        <input
          type="radio"
          name={name}
          checked={value === "b"}
          onChange={() => onChange("b")}
          className="accent-primary"
        />
        <span className="font-medium text-primary/70 mr-1">B</span>
        {labelB}
      </label>
      {showCombine && (
        <label className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors text-xs min-h-[28px]">
          <input
            type="radio"
            name={name}
            checked={value === "combine"}
            onChange={() => onChange("combine")}
            className="accent-primary"
          />
          combine
        </label>
      )}
    </div>
  );
}

function NameCheckbox({
  name,
  checked,
  onChange,
  badge,
}: {
  name: PersonName;
  checked: boolean;
  onChange: () => void;
  badge: string;
}) {
  return (
    <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/30 rounded px-2 py-1 transition-colors min-h-[28px]">
      <input type="checkbox" checked={checked} onChange={onChange} className="accent-primary" />
      <span className="inline-block rounded bg-muted px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
        {badge}
      </span>
      <span className="text-foreground">
        {name.display ?? [name.given_names, name.surname].filter(Boolean).join(" ")}
      </span>
      <span className="text-muted-foreground">({name.name_type})</span>
      {name.is_primary && <span className="text-muted-foreground">(primary)</span>}
    </label>
  );
}

function EventCheckbox({
  event,
  checked,
  onChange,
  badge,
  isDuplicate,
}: {
  event: PersonEvent;
  checked: boolean;
  onChange: () => void;
  badge: string;
  isDuplicate: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-2 text-xs cursor-pointer rounded px-2 py-1 transition-colors min-h-[28px] ${
        isDuplicate ? "bg-yellow-500/10 hover:bg-yellow-500/15" : "hover:bg-muted/30"
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onChange} className="accent-primary" />
      <span className="inline-block rounded bg-muted px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
        {badge}
      </span>
      <span className="text-foreground">{eventSummary(event)}</span>
      {isDuplicate && (
        <span className="text-[10px] text-yellow-600 font-medium">possible duplicate</span>
      )}
    </label>
  );
}
