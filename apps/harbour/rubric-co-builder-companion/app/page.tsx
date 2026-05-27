import Link from "next/link";

export default function LandingPage() {
  return (
    <main
      className="flex-1 flex flex-col items-center justify-center px-6 py-12"
      style={{ background: "var(--color-champagne)" }}
    >
      <div className="max-w-xl text-center space-y-6">
        <p
          className="text-xs tracking-widest"
          style={{ color: "var(--color-cadet)", opacity: 0.7 }}
        >
          co.rubric companion · free for the PRME community
        </p>
        <h1
          className="text-4xl md:text-5xl font-bold leading-tight"
          style={{ color: "var(--color-cadet)" }}
        >
          draft a rubric in one sitting.
        </h1>
        <p
          className="text-lg leading-relaxed"
          style={{ color: "var(--color-cadet)" }}
        >
          a five-step worksheet that asks the questions a facilitator would
          ask, then hands you back a rubric you can print, paste into a doc,
          or share with the team.
        </p>
        <p
          className="text-sm"
          style={{ color: "var(--color-cadet)", opacity: 0.7 }}
        >
          nothing leaves your browser. close the tab, lose the draft.
        </p>
        <div className="pt-2 flex flex-col sm:flex-row gap-3 items-center justify-center">
          <Link href="/workshop" className="btn-primary text-base">
            start the worksheet
          </Link>
          {/* The "try co.rubric (full)" upsell link is hidden until the
              full facilitated app ships as the paid tier. To re-enable,
              uncomment the <a> below. (Edit #1 in PR #112.) */}
          {/*
          <a
            href="/harbour/co-rubric"
            className="text-sm underline underline-offset-4"
            style={{
              color: "var(--color-cadet)",
              textDecorationColor: "color-mix(in srgb, var(--color-cadet) 30%, transparent)",
            }}
          >
            facilitating a class? try co.rubric (full) →
          </a>
          */}
        </div>
      </div>
    </main>
  );
}
