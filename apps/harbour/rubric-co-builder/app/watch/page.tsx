import Link from "next/link";
import { Wordmark } from "../_components/wordmark";

export default function WatchPage() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center px-6 py-24">
      <Wordmark />
      <div className="max-w-2xl w-full text-center">
        <p className="text-sm tracking-widest text-[color:var(--color-cadet)]/70 mb-6">
          walkthrough
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold mb-6">
          the replay is still being stitched together.
        </h1>
        <p className="text-lg text-[color:var(--color-cadet)] mb-10">
          it will show five ghost students co-building a rubric at four-times speed,
          end-to-end, in under two minutes. for now, the live room works — spin one up
          and run it with colleagues.
        </p>
        <Link href="/new" className="btn-primary inline-flex text-base">
          try it yourself
        </Link>
      </div>
    </main>
  );
}
