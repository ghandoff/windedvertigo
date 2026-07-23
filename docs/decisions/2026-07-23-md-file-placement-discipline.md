# 2026-07-23 — md file placement discipline (incident + rule)

## what happened

During the /do/v2 design-plan work (Cowork session, 23 jul), four markdown files
(`docs/do-v2/design-plan.md`, `docs/do-v2/profiles-problems-proof.md`,
`docs/do-v2/profiles-problems-rubric.md`, `docs/prompts/do-v2-sandbox-prompt.md`)
were written to the mac mini's disk via the Cowork device bridge and referenced
in a hand-off prompt as if they were in the repo. They were on disk at the right
paths but **untracked** — invisible on GitHub, in editor source-control views,
and in every other person's clone. Garrett went looking for
`docs/prompts/do-v2-sandbox-prompt.md` and reasonably concluded it wasn't there.

## the pattern behind it

This is not a one-off. Loose and mis-placed md files have repeatedly cluttered
`~/Projects` (see `_loose-archive-2026-06/`), drifted between Drive and the
repo, and broken references for teammates whose clones only receive what is
pushed. Root causes each time:

1. writing to disk and calling it "placed" (disk ≠ repo — sandbox sessions can't push);
2. no verification step between writing a file and referencing its path elsewhere;
3. no single canonical home per document, so copies multiply and rot.

## the standing rule

Now codified in `CLAUDE.md → file output rules → md placement discipline`:
one canonical home per doc; nothing loose at repo/Projects roots; **placed =
tracked + pushed** (or explicitly handed off as "on disk, untracked, commit me
first"); verify a path exists before referencing it anywhere; kebab-case naming
with prompts in `docs/prompts/` and dated notes in `docs/decisions/`.

Cowork/agent sessions writing through the device bridge must end their hand-off
with the git status of every file they created.
