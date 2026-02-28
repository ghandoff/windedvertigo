import Link from "next/link";
import DownloadButton from "@/components/ui/download-button";
import QuickLogButton from "@/components/ui/quick-log-button";
import { MaterialIllustration } from "@/components/material-illustration";

interface PlaydateData {
  id: string;
  slug: string;
  title: string;
  headline: string | null;
  primary_function: string | null;
  friction_dial: number | null;
  start_in_120s: boolean;
  arc_emphasis: string[];
  required_forms: string[];
  slots_optional: string[];
  rails_sentence: string | null;
  find: string | null;
  fold: string | null;
  unfold: string | null;
  find_again_mode: string | null;
  find_again_prompt: string | null;
  slots_notes: string | null;
  substitutions_notes: string | null;
  /* collective-only fields (may be absent for entitled tier) */
  design_rationale?: string | null;
  developmental_notes?: string | null;
  author_notes?: string | null;
}

interface MaterialData {
  id: string;
  title: string;
  form_primary: string | null;
}

interface EntitledPlaydateViewProps {
  playdate: PlaydateData;
  materials: MaterialData[];
  packSlug: string | null;
}

/**
 * Full entitled-tier playdate display.
 * Shows find, fold, unfold flow, rails sentence,
 * find again mode + prompt, slots notes, substitutions notes.
 */
export default function EntitledPlaydateView({
  playdate,
  materials,
  packSlug,
}: EntitledPlaydateViewProps) {
  return (
    <div className="space-y-8">
      {/* headline */}
      {playdate.headline && (
        <p className="text-lg text-cadet/60">{playdate.headline}</p>
      )}

      {/* at a glance — playful, parent-readable summary */}
      <section className="rounded-xl border border-cadet/10 bg-champagne/30 p-6">
        <h2 className="text-sm font-semibold text-cadet/80 mb-4">
          at a glance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {playdate.primary_function && (
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none mt-px">🎯</span>
              <div>
                <p className="text-cadet/45 text-xs font-medium">what&apos;s it about</p>
                <p className="text-cadet/80">{playdate.primary_function}</p>
              </div>
            </div>
          )}
          {playdate.friction_dial !== null && (
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none mt-px">🎚️</span>
              <div>
                <p className="text-cadet/45 text-xs font-medium">energy level</p>
                <p className="text-cadet/80">
                  {playdate.friction_dial <= 2
                    ? `chill (${playdate.friction_dial}/5)`
                    : playdate.friction_dial <= 3
                      ? `medium (${playdate.friction_dial}/5)`
                      : `high energy (${playdate.friction_dial}/5)`}
                </p>
              </div>
            </div>
          )}
          {playdate.start_in_120s && (
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none mt-px">⚡</span>
              <div>
                <p className="text-cadet/45 text-xs font-medium">setup time</p>
                <p className="text-cadet/80">ready in under 2 minutes</p>
              </div>
            </div>
          )}
          {(playdate.arc_emphasis as string[])?.length > 0 && (
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none mt-px">🌱</span>
              <div>
                <p className="text-cadet/45 text-xs font-medium">what kids practise</p>
                <p className="text-cadet/80">{(playdate.arc_emphasis as string[]).join(", ")}</p>
              </div>
            </div>
          )}
          {(playdate.required_forms as string[])?.length > 0 && (
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none mt-px">✂️</span>
              <div>
                <p className="text-cadet/45 text-xs font-medium">what you&apos;ll gather</p>
                <p className="text-cadet/80">{(playdate.required_forms as string[]).join(", ")}</p>
              </div>
            </div>
          )}
          {(playdate.slots_optional as string[])?.length > 0 && (
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none mt-px">🧩</span>
              <div>
                <p className="text-cadet/45 text-xs font-medium">nice to have</p>
                <p className="text-cadet/80">{(playdate.slots_optional as string[]).join(", ")}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* rails sentence */}
      {playdate.rails_sentence && (
        <section className="rounded-xl border border-cadet/10 bg-white p-6">
          <h2 className="text-sm font-semibold text-cadet/80 mb-2">
            the big idea
          </h2>
          <p className="text-sm text-cadet/80 italic">
            {playdate.rails_sentence}
          </p>
        </section>
      )}

      {/* find, fold, unfold */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-cadet/80">
          how to play
        </h2>

        {playdate.find && (
          <div className="rounded-xl border border-cadet/10 bg-white p-5">
            <h3 className="text-xs font-bold text-redwood uppercase tracking-wider mb-1">
              find
            </h3>
            <p className="text-[11px] text-cadet/40 mb-2">
              gather materials and set the stage
            </p>
            <p className="text-sm text-cadet/80 whitespace-pre-line">
              {playdate.find}
            </p>
          </div>
        )}

        {playdate.fold && (
          <div className="rounded-xl border border-cadet/10 bg-white p-5">
            <h3 className="text-xs font-bold text-sienna uppercase tracking-wider mb-1">
              fold
            </h3>
            <p className="text-[11px] text-cadet/40 mb-2">
              the hands-on exploration
            </p>
            <p className="text-sm text-cadet/80 whitespace-pre-line">
              {playdate.fold}
            </p>
          </div>
        )}

        {playdate.unfold && (
          <div className="rounded-xl border border-cadet/10 bg-white p-5">
            <h3 className="text-xs font-bold text-cadet uppercase tracking-wider mb-1">
              unfold
            </h3>
            <p className="text-[11px] text-cadet/40 mb-2">
              reflect on what happened
            </p>
            <p className="text-sm text-cadet/80 whitespace-pre-line">
              {playdate.unfold}
            </p>
          </div>
        )}
      </section>

      {/* find again */}
      {playdate.find_again_mode && (
        <section className="rounded-xl border border-redwood/20 bg-redwood/5 p-6">
          <h2 className="text-sm font-semibold text-redwood mb-2">
            find again — {playdate.find_again_mode}
          </h2>
          {playdate.find_again_prompt && (
            <p className="text-sm text-cadet/80 whitespace-pre-line">
              {playdate.find_again_prompt}
            </p>
          )}
        </section>
      )}

      {/* slots notes — practical material hints */}
      {playdate.slots_notes && (
        <section className="rounded-xl border border-cadet/10 bg-champagne/20 p-6">
          <h2 className="text-sm font-semibold text-cadet/80 mb-2">
            material tips
          </h2>
          <p className="text-sm text-cadet/70 whitespace-pre-line">
            {playdate.slots_notes}
          </p>
        </section>
      )}

      {/* substitutions notes */}
      {playdate.substitutions_notes && (
        <section className="rounded-xl border border-cadet/10 bg-champagne/20 p-6">
          <h2 className="text-sm font-semibold text-cadet/80 mb-2">
            swap ideas
          </h2>
          <p className="text-sm text-cadet/70 whitespace-pre-line">
            {playdate.substitutions_notes}
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
            {materials.map((m) => (
              <li key={m.id} className="flex items-center gap-2.5 text-sm">
                {m.form_primary && <MaterialIllustration formPrimary={m.form_primary} size={24} className="opacity-80" />}
                <span className="inline-block rounded-full bg-cadet/5 px-2.5 py-0.5 text-xs font-medium text-cadet/70">
                  {m.form_primary ?? "material"}
                </span>
                <span className="text-cadet/80">{m.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* actions */}
      <section className="pt-4 border-t border-cadet/10 flex flex-wrap items-center gap-3">
        <QuickLogButton
          playdateId={playdate.id}
          playdateTitle={playdate.title}
          playdateSlug={playdate.slug}
        />
        <DownloadButton
          playdateId={playdate.id}
          packSlug={packSlug}
          playdateTitle={playdate.title}
        />
        <Link
          href={`/reflections/new?playdate=${playdate.slug}`}
          className="rounded-lg px-4 py-2 text-xs font-medium text-white transition-all hover:opacity-90"
          style={{ backgroundColor: "var(--wv-redwood)" }}
        >
          log a reflection
        </Link>
      </section>

      {/* ── collective-only sections ── */}
      {/* these fields are only present when fetched at collective tier */}
      {(playdate.design_rationale ||
        playdate.developmental_notes ||
        playdate.author_notes) && (
        <div className="mt-8 space-y-6 border-t-2 border-dashed border-cadet/20 pt-8">
          <p className="text-xs font-semibold text-cadet/40 uppercase tracking-wider">
            behind the curtain
          </p>

          {playdate.design_rationale && (
            <section className="rounded-xl border border-cadet/15 bg-cadet/5 p-6">
              <h2 className="text-sm font-semibold text-cadet/80 mb-2">
                why this playdate
              </h2>
              <p className="text-sm text-cadet/70 whitespace-pre-line">
                {playdate.design_rationale}
              </p>
            </section>
          )}

          {playdate.developmental_notes && (
            <section className="rounded-xl border border-cadet/15 bg-cadet/5 p-6">
              <h2 className="text-sm font-semibold text-cadet/80 mb-2">
                what to look for
              </h2>
              <p className="text-sm text-cadet/70 whitespace-pre-line">
                {playdate.developmental_notes}
              </p>
            </section>
          )}

          {playdate.author_notes && (
            <section className="rounded-xl border border-cadet/15 bg-cadet/5 p-6">
              <h2 className="text-sm font-semibold text-cadet/80 mb-2">
                notes from us
              </h2>
              <p className="text-sm text-cadet/70 whitespace-pre-line">
                {playdate.author_notes}
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
