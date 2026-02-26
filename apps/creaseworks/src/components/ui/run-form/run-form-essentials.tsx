"use client";

import { RUN_TYPES } from "@/lib/constants/enums";
import type { Playdate } from "./types";
import type { RunFormState } from "./use-run-form-state";

interface RunFormEssentialsProps {
  state: RunFormState;
  playdates: Playdate[];
}

export function RunFormEssentials({ state, playdates }: RunFormEssentialsProps) {
  return (
    <div className="rounded-xl border border-cadet/10 bg-champagne/30 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-cadet/80">essentials</h2>

      {/* title */}
      <div>
        <label className="block text-xs text-cadet/60 mb-1">
          title <span className="text-redwood">*</span>
        </label>
        <input
          type="text"
          value={state.title}
          onChange={(e) => state.setTitle(e.target.value)}
          placeholder="e.g. year 4 paper folding session"
          className="w-full rounded-lg border border-cadet/15 px-3 py-2 text-sm outline-none focus:ring-2"
          required
        />
      </div>

      {/* run type */}
      <div>
        <label className="block text-xs text-cadet/60 mb-1">
          context of use <span className="text-redwood">*</span>
        </label>
        <select
          value={state.runType}
          onChange={(e) => state.setRunType(e.target.value)}
          className="w-full rounded-lg border border-cadet/15 px-3 py-2 text-sm outline-none focus:ring-2 bg-white"
          required
        >
          <option value="">select type…</option>
          {RUN_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* date */}
      <div>
        <label className="block text-xs text-cadet/60 mb-1">
          date <span className="text-redwood">*</span>
        </label>
        <input
          type="date"
          value={state.runDate}
          onChange={(e) => state.setRunDate(e.target.value)}
          className="w-full rounded-lg border border-cadet/15 px-3 py-2 text-sm outline-none focus:ring-2"
          required
        />
      </div>

      {/* playdate link */}
      <div>
        <label className="block text-xs text-cadet/60 mb-1">
          linked playdate
        </label>
        <select
          value={state.playdateId}
          onChange={(e) => state.setPlaydateId(e.target.value)}
          className="w-full rounded-lg border border-cadet/15 px-3 py-2 text-sm outline-none focus:ring-2 bg-white"
        >
          <option value="">none</option>
          {playdates.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>

      {/* find again toggle — quiet, only relevant when a playdate is linked */}
      {state.playdateId && (
        <label className="flex items-center gap-2 cursor-pointer text-xs text-cadet/60 pt-1">
          <input
            type="checkbox"
            checked={state.isFindAgain}
            onChange={(e) => state.setIsFindAgain(e.target.checked)}
            className="rounded"
          />
          this was a find again moment
        </label>
      )}
    </div>
  );
}
