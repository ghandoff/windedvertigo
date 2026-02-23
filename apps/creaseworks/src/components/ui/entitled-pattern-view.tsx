import DownloadButton from "@/components/ui/download-button";

interface EntitledPatternViewProps {
  pattern: any;
  materials: any[];
  packSlug: string | null;
}

/**
 * Full entitled-tier pattern display.
 * Shows find, fold, unfold flow, rails sentence,
 * find again mode + prompt, slots notes, substitutions notes.
 */
export default function EntitledPatternView({
  pattern,
  materials,
  packSlug,
}: EntitledPatternViewProps) {
  return (
    <div className="space-y-8">
      {/* headline */}
      {pattern.headline && (
        <p className="text-lg text-cadet/60">{pattern.headline}</p>
      )}

      {/* at a glance — playful, parent-readable summary */}
      <section className="rounded-xl border border-cadet/10 bg-champagne/30 p-6">
        <h2 className="text-sm font-semibold text-cadet/80 mb-4">
          at a glance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {pattern.primary_function && (
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none mt-px">🎯</span>
              <div>
                <p className="text-cadet/45 text-xs font-medium">what&apos;s it about</p>
                <p className="text-cadet/80">{pattern.primary_function}</p>
              </div>
            </div>
          )}
          {pattern.friction_dial !== null && (
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none mt-px">🎚️</span>
              <div>
                <p className="text-cadet/45 text-xs font-medium">energy level</p>
                <p className="text-cadet/80">
                  {pattern.friction_dial <= 2
                    ? `chill (${pattern.friction_dial}/5)`
                    : pattern.friction_dial <= 3
                      ? `medium (${pattern.friction_dial}/5)`
                      : `high energy (${pattern.friction_dial}/5)`}
                </p>
              </div>
            </div>
          )}
          {pattern.start_in_120s && (
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none mt-px">⚡</span>
              <div>
                <p className="text-cadet/45 text-xs font-medium">setup time</p>
                <p className="text-cadet/80">ready in under 2 minutes</p>
              </div>
            </div>
          )}
          {(pattern.arc_emphasis as string[])?.length > 0 && (
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none mt-px">🌱</span>
              <div>
                <p className="text-cadet/45 text-xs font-medium">what kids practise</p>
                <p className="text-cadet/80">{(pattern.arc_emphasis as string[]).join(", ")}</p>
              </div>
            </div>
          )}
          {(pattern.required_forms as string[])?.length > 0 && (
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none mt-px">✂️</span>
              <div>
                <p className="text-cadet/45 text-xs font-medium">what you&apos;ll gather</p>
                <p className="text-cadet/80">{(pattern.required_forms as string[]).join(", ")}</p>
              </div>
            </div>
          )}
          {(pattern.slots_optional as string[])?.length > 0 && (
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none mt-px">🧩</span>
              <div>
                <p className="text-cadet/45 text-xs font-medium">nice to have</p>
                <p className="text-cadet/80">{(pattern.slots_optional as string[]).join(", ")}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* rails sentence */}
      {pattern.rails_sentence && (
        <section className="rounded-xl border border-cadet/10 bg-white p-6">
          <h2 className="text-sm font-semibold text-cadet/80 mb-2">
            the big idea
          </h2>
          <p className="text-sm text-cadet/80 italic">
            {pattern.rails_sentence}
          </p>
        </section>
      )}

      {/* find, fold, unfold */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-cadet/80">
          how to play
        </h2>

        {pattern.find && (
          <div className="rounded-xl border border-cadet/10 bg-white p-5">
            <h3 className="text-xs font-bold text-redwood uppercase tracking-wider mb-2">
              find
            </h3>
            <p className="text-sm text-cadet/80 whitespace-pre-line">
              {pattern.find}
            </p>
          </div>
        )}

        {pattern.fold && (
          <div className="rounded-xl border border-cadet/10 bg-white p-5">
            <h3 className="text-xs font-bold text-sienna uppercase tracking-wider mb-2">
              fold
            </h3>
            <p className="text-sm text-cadet/80 whitespace-pre-line">
              {pattern.fold}
            </p>
          </div>
        )}

        {pattern.unfold && (
          <div className="rounded-xl border border-cadet/10 bg-white p-5">
            <h3 className="text-xs font-bold text-cadet uppercase tracking-wider mb-2">
              unfold
            </h3>
            <p className="text-sm text-cadet/80 whitespace-pre-line">
              {pattern.unfold}
            </p>
          </div>
        )}
      </section>

      {/* find again */}
      {pattern.find_again_mode && (
        <section className="rounded-xl border border-redwood/20 bg-redwood/5 p-6">
          <h2 className="text-sm font-semibold text-redwood mb-2">
            find again — {pattern.find_again_mode}
          </h2>
          {pattern.find_again_prompt && (
            <p className="text-sm text-cadet/80 whitespace-pre-line">
              {pattern.find_again_prompt}
            </p>
          )}
        </section>
      )}

      {/* slots notes */}
      {pattern.slots_notes && (
        <section className="rounded-xl border border-cadet/10 bg-champagne/20 p-6">
          <h2 className="text-sm font-semibold text-cadet/80 mb-2">
            timing and space tips
          </h2>
          <p className="text-sm text-cadet/70 whitespace-pre-line">
            {pattern.slots_notes}
          </p>
        </section>
      )}

      {/* substitutions notes */}
      {pattern.substitutions_notes && (
        <section className="rounded-xl border border-cadet/10 bg-champagne/20 p-6">
          <h2 className="text-sm font-semibold text-cadet/80 mb-2">
            swap ideas
          </h2>
          <p className="text-sm text-cadet/70 whitespace-pre-line">
            {pattern.substitutions_notes}
          </p>
        </section>
      )}

      {/* materials */}
      {materials.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-cadet/80 mb-3">
            what you'll need
          </h2>
          <ul className="space-y-2">
            {materials.map((m: any) => (
              <li key={m.id} className="flex items-center gap-2 text-sm">
                <span className="inline-block rounded-full bg-cadet/5 px-2.5 py-0.5 text-xs font-medium">
                  {m.form_primary}
                </span>
                <span>{m.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* download */}
      <section className="pt-4 border-t border-cadet/10">
        <DownloadButton
          patternId={pattern.id}
          packSlug={packSlug}
          patternTitle={pattern.title}
        />
      </section>

      {/* ── collective-only sections ── */}
      {/* these fields are only present when fetched at collective tier */}
      {(pattern.design_rationale ||
        pattern.developmental_notes ||
        pattern.author_notes) && (
        <div className="mt-8 space-y-6 border-t-2 border-dashed border-cadet/20 pt-8">
          <p className="text-xs font-semibold text-cadet/40 uppercase tracking-wider">
            behind the curtain
          </p>

          {pattern.design_rationale && (
            <section className="rounded-xl border border-cadet/15 bg-cadet/5 p-6">
              <h2 className="text-sm font-semibold text-cadet/80 mb-2">
                why this playdate
              </h2>
              <p className="text-sm text-cadet/70 whitespace-pre-line">
                {pattern.design_rationale}
              </p>
            </section>
          )}

          {pattern.developmental_notes && (
            <section className="rounded-xl border border-cadet/15 bg-cadet/5 p-6">
              <h2 className="text-sm font-semibold text-cadet/80 mb-2">
                what to look for
              </h2>
              <p className="text-sm text-cadet/70 whitespace-pre-line">
                {pattern.developmental_notes}
              </p>
            </section>
          )}

          {pattern.author_notes && (
            <section className="rounded-xl border border-cadet/15 bg-cadet/5 p-6">
              <h2 className="text-sm font-semibold text-cadet/80 mb-2">
                notes from us
              </h2>
              <p className="text-sm text-cadet/70 whitespace-pre-line">
                {pattern.author_notes}
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
