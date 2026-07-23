# How to review a pull request

A practical guide for reviewing PRs in this repo, written for a non-GitHub-expert
owner. Keep it close — reviewing your own (and Claude's) PRs is the habit that
keeps `main` trustworthy.

## The mental model

A **pull request (PR)** is a *proposal to merge one branch into another* — almost
always some `feat/…` or `fix/…` branch into `main`. Opening a PR changes nothing
in `main`; it's the "may I?" step. Reviewing is deciding whether the proposal is
safe and correct **before** it becomes part of `main`.

**Merging ≠ deploying** (this repo's #1 gotcha):

- **Merge** = the code lands in `main` on GitHub. Saved, version-controlled.
- **Deploy** = a separate manual step (`npm run deploy:cf` / `deploy-port.sh`)
  that makes Cloudflare actually serve it.

So a merge is low-stakes and reversible; the deploy is the moment it goes live.
Never call something "live" just because it merged — it's "merged, pending deploy."

## The PR page has four tabs

1. **Conversation** — the description, discussion, and the green merge button at
   the bottom. Start here to learn *why* the change exists.
2. **Commits** — the individual save-points. Skip for small PRs.
3. **Checks** — automated tests/builds (CI). Green ✓ = passed. This repo runs few
   automated checks, so it may be sparse.
4. **Files changed** — **the actual review.** The diff of every line added or
   removed. ~90% of reviewing happens here.

## The review workflow (the 5-minute version)

1. **Read the description** (Conversation tab). It should say *what* changed and
   *why*. A vague description is itself a yellow flag.
2. **Open "Files changed"** and read the diff:
   - **Green / `+`** = added lines. **Red / `-`** = removed lines.
   - Each file is collapsible. Skim file-by-file.
3. **You are hunting for surprises, not perfection.** Ask:
   - Do the changed files match what the description promised? (e.g. a "polls
     only" PR should touch only polls files — an unrelated `layout.tsx` in the
     diff is worth a question.)
   - Is any important code being deleted?
   - Any secret/password/API key being added? (Never OK.)
   - Does a "small fix" somehow touch dozens of files?
4. **Record a verdict.** Top-right of "Files changed" → **Review changes**:
   - **Comment** — notes, no verdict.
   - **Approve** — good to merge.
   - **Request changes** — must be fixed first (blocks merge).
   - To ask about a specific line, hover it and click the blue **`+`**.

## Merging

Use the merge-button dropdown → **Squash and merge** (this repo's convention). It
collapses the PR's commits into one tidy commit on `main`, keeping history clean.
(The other options — "Create a merge commit", "Rebase and merge" — add noise or
are advanced; skip them.)

### The `--admin` / branch-protection note

`main` is protected: PRs need an approval before merging. As a solo owner there's
no second approver, so:

- In the **CLI**, the convention is `gh pr merge <n> --admin --squash --delete-branch`
  — the `--admin` flag is the owner override for the missing review.
- In the **GitHub UI**, clicking "Squash and merge" as the repo admin does the
  same thing (GitHub offers a "merge without waiting for requirements" option).

Either way it's a conscious owner override — fine for a solo shop, but it *is* a
bypass, which is why automated agents are asked to get explicit sign-off before
using `--admin`.

## After merging: deploy + verify

Merged code is not live. For `port` and `wv-site` there is **no CI deploy** — you
must deploy manually, then confirm:

- **port**: `./scripts/deploy-port.sh` (or `--preview` for a workers.dev preview)
- **wv-site**: `cd site && npm run deploy:cf`
- **Verify it's serving:** `curl -s https://port.windedvertigo.com/api/version`
  and compare the `built` timestamp to when you merged.

## Quick checklist

- [ ] Description explains what + why
- [ ] Files changed matches the description's scope (no surprise files)
- [ ] No deleted-important-code, no secrets, no giant unrelated diffs
- [ ] Checks are green (if any)
- [ ] Squash and merge
- [ ] Deploy the affected app(s)
- [ ] Verify live (`/api/version` timestamp, or eyeball the page)
