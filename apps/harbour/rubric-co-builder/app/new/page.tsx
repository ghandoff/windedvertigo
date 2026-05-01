import { NewRoomForm } from "./form";
import { Wordmark } from "../_components/wordmark";
import { SEED_CRITERIA } from "@/lib/types";

export default function NewRoomPage() {
  return (
    <main className="min-h-screen w-full px-6 py-16">
      <Wordmark />
      <div className="max-w-3xl mx-auto">
        <p className="text-sm tracking-widest text-[color:var(--color-cadet)]/70 mb-4">
          step zero — faculty setup
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">
          frame the outcome.
        </h1>
        <p className="text-lg text-[color:var(--color-cadet)] mb-10 max-w-2xl">
          write the learning outcome the assessment should surface, then describe
          the project in one line. seed criteria are editable — the class can add,
          rename, or delete once the room opens.
        </p>

        <NewRoomForm seeds={SEED_CRITERIA} />
      </div>
    </main>
  );
}
