# decisions

one-line-per-decision log of non-obvious calls made during the mvp build. newer
decisions at the bottom.

- **placed the app at `apps/values-auction/` instead of a root-level `values-auction/`** — matches the harbour-apps monorepo convention (see `apps/rubric-co-builder`, `apps/depth-chart`, etc.). the prompt's file tree is preserved relative to this app directory.
- **vite + lit 3 + vanilla css**, exactly as specified. no react, no tailwind, no css-in-js.
- **state is a pure reducer** over a tagged `Action` union. every mutation appends a `SessionEvent` so the facilitator's "live signal" and the exported event log both read from the same source.
- **facilitator client is authoritative** for act transitions, auction start/stop, and lock-ins. participants `dispatch` actions that become intents over the transport; only the facilitator's reducer writes state and rebroadcasts a snapshot. this means supabase can replace the transport layer later without rewriting reducers (this is the whole point of the `Transport` abstraction in §9 of the brief).
- **participant view resolves its identity via `localStorage`** (`va:pid:<code>`, `va:name:<code>`) so refresh and tab close/reopen don't generate new identities within a session. the brief rules out accounts but doesn't prohibit a per-session anonymous handle.
- **team assignment** is a simple round-robin after archetype sort, target 4 per team. maria's notes flagged this as intentionally open — the code is isolated in `assignTeams()` so a deterministic pairing rule ("rebels with diplomats", etc.) can land later with no other changes.
- **auction auto-ends** on a 500ms client-side watchdog on the authoritative client when `elapsed >= durationMs`. participants never end auctions. if the authoritative client drops mid-auction, the bid stays open until the facilitator rejoins — acceptable for phase-1 single-room demos.
- **bid rejection is silent-to-the-room and loud-to-the-sender** via `bidRejected` events (logged but not broadcast to participants' aria-live assertive region). this matches the pedagogy: only confirmed bids should feel "live."
- **identity-card png export** is a pure svg + canvas roundtrip — no runtime dependency needed because our layout is fully controllable via svg. the brief suggested `satori` + `@resvg/resvg-js` for server-rendered cards with `html-to-image` as fallback, but neither is actually executing any code in this path, so i dropped all three to keep the dependency list minimal. when a server-render path is needed (phase 2 with supabase), reinstate `satori` + `@resvg/resvg-js`.
- **`prefers-reduced-motion` global reset** lives in `src/design/motion.css` and kills all transitions/animations in one declaration, per the accessibility spec. lit components do not guard their own motion individually.
- **`va-countdown` announces only the 10/5/3/2/1-second marks** via the shared polite/assertive regions in `src/utils/a11y.ts`. announcing every second would spam the screen reader.
- **the ws server logs every inbound message to `server/events.log` (jsonl)** so post-session analysis works without spinning up analytics infra. `.gitignore` excludes the log so we never commit session data.
- **no `AUTH_SECRET`, no neon, no stripe** — this mvp is entirely in-browser. the top-level CLAUDE.md rules about database connections and shared auth don't apply here; they would apply when wiring a future supabase transport.
- **lowercase copy throughout, british english, oxford comma** — per the project-wide writing conventions. value card *names* retain their title case because they're the in-game proper nouns (see §6.3 of the prompt).
- **vercel deploy target** — as of april 2026 the app ships via a new Vercel project with `apps/values-auction` as the Root Directory. framework preset: Vite, build: `npm run build`, output: `dist`. `vercel.json` holds `turbo-ignore @harbour/values-auction` so unrelated pushes don't trigger a build. manual deploy path is `./scripts/deploy-values-auction.sh` once `cd apps/values-auction && vercel link` has been run. the `$10/mo` cap in CLAUDE.md still applies — static assets only, no serverless functions, so the cost impact is minimal.

## open questions deferred to maria

- grouping algorithm specifics (round-robin today; deterministic pairings later?)
- sound assets — `public/sfx/` is empty; gavel/tick mp3 would wire in trivially.
- spanish copy layer — all strings externalised in `content/copy.ts`, ready for a sibling file when the language call is made.
