# meeting-notes pipe — spec (gemini/notion → port → agents)

> owner: opsy (build) · consumer: mo + the agent collective · requested by garrett 2026-06-30
> goal: every team meeting's notes + transcript land in the port automatically, so mo
> (and pam/carl) can read and comment on them within minutes — no new subscription,
> built on tools we already pay for (google workspace + gemini, notion ai).

## the one-line problem

we already record + transcribe every meeting twice (google gemini "take notes for me"
and notion ai meeting notes). neither is wired into the agents. the missing piece is the
**pipe**, not another transcriber. fireflies/otter would be a third paid tool doing a job
we already do — skip it.

## current state — the blocker

the ingest cron already exists and is **down**:

- `meet-transcript-ingest` failing 503 `drive_auth_failure` (opsy, root-caused 2026-06-26).
- cause: the `GOOGLE_SERVICE_ACCOUNT_JSON` service account's domain-wide delegation is
  **missing the `https://www.googleapis.com/auth/drive.readonly` scope**.
- also confirm `GOOGLE_IMPERSONATE_SUBJECTS` (csv) is set on the wv-port worker — without
  it the job 503s with `no_subjects`.
- **the code is correct — do not "fix" in code.** fix is in google workspace admin →
  security → api controls → domain-wide delegation → add the scope to the SA client id.
- this is a **garrett action** (workspace-admin seat). same fix also clears the
  `rfp-gmail-scanner` failure (that one needs `gmail.modify` impersonating lamis@).

nothing downstream can be tested until this is green.

## how the source data actually behaves (verified 2026-06-30)

- **gemini**: after a meeting ends, gemini auto-saves to the **organiser's** drive in a
  `Meet Recordings` folder — separate google docs for the *notes* and the *transcript*,
  named by meeting title + date. (there's also a google meet rest api for transcript
  entries, but the drive docs are the simpler, richer source and what the cron already
  targets.) finalised **after** the meeting, not mid-call.
- **notion ai meeting notes**: records *system audio* (does not join the call), lands as a
  structured page; notion exposes an api endpoint to pull the full transcript + summary.
- **implication**: this gives **near-real-time after a meeting** (minutes), not live
  in-call commentary. true live = a bot that joins + streams chunks (recall.ai/fireflies
  model) — out of scope here, noted at the end.

## pipeline stages

1. **source** — gemini docs in each organiser's `Meet Recordings` drive folder
   (primary); notion meeting-notes pages (secondary / fallback).
2. **ingest** — `meet-transcript-ingest` cron: SA with domain-wide delegation impersonates
   each organiser in `GOOGLE_IMPERSONATE_SUBJECTS`, lists the `Meet Recordings` folder for
   docs created since `last_ingest_at`, downloads the notes + transcript doc text.
3. **normalise** — parse into one record: title, start/end, organiser, attendees, gemini
   summary, action items, full transcript text. dedupe gemini vs notion by
   `(normalised_title, date)`.
4. **store** — upsert into a `meetings` table on the port (supabase, EU region — same data
   spine as the rest of the agent memory).
5. **expose** — a read endpoint + MCP tools so agents query it the same way they call
   `*_briefing` today.

## data model — `meetings`

| field | type | notes |
|---|---|---|
| `id` | uuid | pk |
| `source` | text | `gemini` \| `notion` |
| `title` | text | meeting title |
| `started_at` / `ended_at` | timestamptz | from doc / calendar |
| `organiser` | text | email |
| `attendees` | text[] | best-effort from transcript/calendar |
| `summary` | text | gemini's/notion's generated summary |
| `action_items` | jsonb | `[{text, owner?, due?}]` if the tool extracted them |
| `full_text` | text | transcript body |
| `drive_doc_id` / `source_url` | text | link back to the original |
| `tags` | text[] | e.g. `strategy`, `whirlpool`, `client:amna` |
| `ingested_at` | timestamptz | pipeline run stamp |

apply RLS on this table from creation (per the standing rls-safeguard event trigger).

## agent-facing contract (the part mo needs)

add three tools to the existing agent MCP connector, mirroring the `*_briefing` pattern:

- `meeting_latest(n=5)` → most recent meetings (title, date, summary, id).
- `meeting_get(id)` → full record incl. transcript + action items.
- `meeting_search(query, since?)` → keyword/semantic search across stored meetings.

with these, a session like "mo, what did we decide in today's strategy meeting?" resolves
to `meeting_latest` → `meeting_get`, and i can comment, log decisions to memory, and route
actions to pam — automatically, on every future meeting.

## cadence / latency

- run ingest **every 5 min** (a `*/5` cron) — gemini finalises the doc shortly after a
  meeting ends, so 5-min polling delivers notes within minutes of "leave call".
- keep a per-organiser `last_ingest_at` cursor so each run only pulls new docs.

## governance — do NOT ingest sensitive client meetings

this matters because of the amna engagement (special-category / identifiable data lives
under strict handling; workspace approved for anonymised material only).

- **allowlist by intent**: only ingest internal/strategy meetings. exclude anything tagged
  client-confidential.
- mechanism: a simple denylist (meeting-title prefix or a calendar marker like `[noai]`)
  checked at ingest; default-exclude any organiser/folder outside the team.
- least privilege: SA gets `drive.readonly` only; restrict `GOOGLE_IMPERSONATE_SUBJECTS`
  to the handful of internal meeting organisers, not the whole domain.
- keep the table EU-region; no raw client PII in `full_text` for excluded meetings.

## who does what

- **garrett (workspace admin):** add the `drive.readonly` delegation scope to the SA
  client id; confirm `GOOGLE_IMPERSONATE_SUBJECTS` is set on wv-port. (unblocks everything.)
- **opsy:** verify `meet-transcript-ingest` returns green post-fix; build the normalise +
  `meetings` store + RLS; ship the read endpoint and the three MCP tools; add the
  governance denylist; flip cron to `*/5`; add the notion-notes secondary source + dedupe.
- **mo:** consume via `meeting_*`; on each strategy/whirlpool meeting, summarise, log
  decisions to memory, hand actions to pam.

## definition of done

- [ ] SA delegation scope added; `meet-transcript-ingest` green for ≥1 real meeting.
- [ ] `meetings` table live (RLS on, EU region) with ≥1 ingested gemini meeting.
- [ ] `meeting_latest` / `meeting_get` / `meeting_search` callable from a cowork session.
- [ ] governance denylist verified — a `[noai]`/client-confidential meeting is NOT ingested.
- [ ] cron at `*/5`; notion source added as fallback with cross-source dedupe.
- [ ] mo can answer "what did we decide today?" end-to-end without a paste.

## explicitly out of scope (for later)

- **true live in-call commentary** — needs a bot joining the call streaming transcript
  chunks (recall.ai / fireflies live model). revisit only if "within minutes after" proves
  insufficient. fireflies pro is ~$10/user/mo annual — not worth it while gemini + notion
  already cover capture.
