"use client";

import type {
  ReportData,
  PersonSummary,
  FamilyGroupSheetData,
  AncestorReportData,
  DescendantReportData,
} from "./actions";
import dynamic from "next/dynamic";

const PdfExportButton = dynamic(
  () => import("./pdf-export").then((m) => m.PdfExportButton),
  { ssr: false, loading: () => <span className="text-xs text-muted-foreground">loading…</span> },
);

function EventList({ events }: { events: PersonSummary["events"] }) {
  if (events.length === 0) return null;
  return (
    <ul className="text-sm text-muted-foreground space-y-0.5 mt-1">
      {events.map((e, i) => (
        <li key={i}>
          <span className="font-medium text-foreground">{e.type}</span>
          {e.date && <span className="ml-2">{e.date}</span>}
          {e.description && <span className="ml-2 italic">{e.description}</span>}
        </li>
      ))}
    </ul>
  );
}

function PersonBlock({ person, label }: { person: PersonSummary; label?: string }) {
  return (
    <div className="py-2">
      {label && (
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      )}
      <p className="font-medium text-foreground">
        {person.name}
        {person.sex && (
          <span className="ml-2 text-xs text-muted-foreground">({person.sex})</span>
        )}
        {person.isLiving && (
          <span className="ml-2 text-xs text-green-600">living</span>
        )}
      </p>
      <EventList events={person.events} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// family group sheet
// ---------------------------------------------------------------------------

function FamilyGroupSheet({ data }: { data: FamilyGroupSheetData }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground print:text-xl">
        family group sheet
      </h2>

      <section>
        <PersonBlock person={data.principal} label="principal" />
      </section>

      {data.spouses.map((s, i) => (
        <section key={i} className="border-t border-border pt-4">
          <PersonBlock person={s.person} label="spouse / partner" />
          {s.children.length > 0 && (
            <div className="ml-4 mt-2 border-l-2 border-border pl-4">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                children
              </span>
              {s.children.map((c) => (
                <PersonBlock key={c.id} person={c} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ancestor report (ahnentafel)
// ---------------------------------------------------------------------------

function generationLabel(gen: number): string {
  const labels = ["self", "parents", "grandparents", "great-grandparents", "2x great-grandparents", "3x great-grandparents"];
  return labels[gen] ?? `${gen - 2}x great-grandparents`;
}

function AncestorReport({ data }: { data: AncestorReportData }) {
  // group by generation
  const byGen = new Map<number, typeof data.ancestors>();
  for (const a of data.ancestors) {
    const list = byGen.get(a.generation) ?? [];
    list.push(a);
    byGen.set(a.generation, list);
  }
  const gens = [...byGen.keys()].sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground print:text-xl">
        ancestor report (ahnentafel)
      </h2>

      <section>
        <PersonBlock person={data.principal} label="1. self" />
      </section>

      {gens.map((gen) => (
        <section key={gen} className="border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">
            generation {gen} &mdash; {generationLabel(gen)}
          </h3>
          {byGen.get(gen)!.map((a) => (
            <div key={a.number} className="ml-4">
              <PersonBlock
                person={a.person}
                label={`${a.number}.`}
              />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// descendant report
// ---------------------------------------------------------------------------

function DescendantReport({ data }: { data: DescendantReportData }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground print:text-xl">
        descendant report
      </h2>

      <section>
        <PersonBlock person={data.principal} label="root" />
      </section>

      {data.descendants.map((d, i) => (
        <div
          key={i}
          className="border-l-2 border-border"
          style={{ marginLeft: `${d.depth * 1.5}rem`, paddingLeft: "1rem" }}
        >
          <PersonBlock person={d.person} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// viewer wrapper
// ---------------------------------------------------------------------------

export function ReportViewer({ data }: { data: ReportData }) {
  return (
    <div>
      {/* toolbar — hidden when printing */}
      <div className="mb-4 print:hidden flex gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 transition-opacity"
        >
          print
        </button>
        <PdfExportButton data={data} />
      </div>

      {/* report body — print-friendly */}
      <div className="print:font-serif print:text-black print:bg-white">
        {data.type === "family_group_sheet" && <FamilyGroupSheet data={data} />}
        {data.type === "ancestor_report" && <AncestorReport data={data} />}
        {data.type === "descendant_report" && <DescendantReport data={data} />}
      </div>
    </div>
  );
}
