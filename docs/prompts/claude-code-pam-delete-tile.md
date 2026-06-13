# claude code task — add "delete tile" to /pam commitments

> handoff from a cowork/PaM session. goal: let a user delete (remove) a
> commitment tile on the /pam board. today there is **no delete anywhere** —
> the data layer, API, and tile UI only support *insert* and *update-status*
> (`not-started | in-progress | blocked | done | parked`). a tile can change
> status but cannot be removed. this task adds that capability.

## session protocol (do this first — repo has a history of cross-session reverts)

1. `git pull --rebase origin main` before touching anything.
2. work on a short-lived branch: `feat/pam-delete-tile`.
3. commit style: `feat(pam): add delete action for commitment tiles`.
4. when done: deploy port, then PR + admin-merge (solo):
   `cd port && npm run deploy:cf` (chains `opennextjs-cloudflare build && wrangler deploy`; needs `CLOUDFLARE_API_TOKEN` in env/`.env`).
   then `gh pr merge --admin --squash --delete-branch`.

## where things live (all under `port/`)

- **data layer:** `lib/supabase/pam.ts` — table `pam_commitments`. Has
  `insertPamCommitment`, `updatePamCommitment(id, {...})`, `getPamCommitments`.
  Uses the service-role client (`lib/supabase/client.ts`), which **bypasses
  RLS**, so a server-side delete will work without policy changes.
- **server actions (what the UI calls):** `app/(dashboard)/pam/actions.ts` —
  e.g. `updateCommitmentAction`. The edit dialog imports from here.
- **tile UI:** `app/(dashboard)/pam/components/edit-commitment-dialog.tsx`
  (the dialog opened from a tile; has a `DialogFooter`, a status `Select`,
  and a `submit()` that calls `updateCommitmentAction`). Sibling files:
  `commitments-board.tsx`, `commitments-timeline.tsx`, `add-commitment-dialog.tsx`.
- **REST API (used by agents/MCP, mirror for symmetry):**
  `app/api/pam/commitments/route.ts` — has `GET`, `POST`, `PATCH`; auth via
  `Bearer === process.env.CMO_API_TOKEN`. No `DELETE` yet.
- **migrations:** `port/supabase/migrations/` (e.g. `20260605_pam_commitment_start_date.sql`).

## what to build

### recommendation: hard delete, with a confirm step
The user explicitly wants to *remove* tiles, so implement a real delete (not
just a hidden status). Add a confirm interaction so it isn't a one-click
accident. (If you'd rather make it reversible, a soft-delete via a new
`archived` status is acceptable — but that also means extending the status
union in `pam.ts`, any DB check constraint on `pam_commitments.status`, the
`STATUSES` array in the edit dialog, and making the board filter out archived
tiles. Hard delete is simpler and is what was asked; your call.)

1. **`lib/supabase/pam.ts`** — add:
   ```ts
   export async function deletePamCommitment(id: string): Promise<void> {
     const { error } = await supabase.from("pam_commitments").delete().eq("id", id);
     if (error) throw error;
   }
   ```

2. **`app/(dashboard)/pam/actions.ts`** — add a `deleteCommitmentAction(id)`
   server action that calls `deletePamCommitment(id)` and `revalidatePath`s the
   /pam route (match how `updateCommitmentAction` revalidates).

3. **`edit-commitment-dialog.tsx`** — add a destructive **Delete** button in the
   `DialogFooter` (left-aligned, separated from Cancel/Save). On click, show a
   confirm (a small `AlertDialog` or a two-step "click again to confirm"
   inline). On confirm: call `deleteCommitmentAction(commitment.id)` inside the
   existing `startTransition`, close the dialog (`onOpenChange(false)`), and
   `router.refresh()`. Disable while `pending`.

4. **`app/api/pam/commitments/route.ts`** — add a `DELETE` handler mirroring
   `PATCH`: `verifyAuth`, read `id` from `param(req, "id")`, call
   `deletePamCommitment(id)`, return `json({ ok: true })`. (Keeps the
   agent/MCP path symmetric with the UI.)

### tests / verification
- `cd port && npm run lint && npm run build` clean.
- manually: open a tile → Delete → confirm → tile disappears from the board and
  from the gantt/timeline after refresh; reload the page to confirm it's gone
  from Supabase (not just client state).
- confirm Cancel and the existing Save/status flows still work.

## while you're in there — clean two stale rows (optional, low effort)
A cowork reconciliation left two obsolete commitments that should be removed
(either click Delete once the feature ships, or run a one-off migration):

```sql
-- port/supabase/migrations/<yyyymmdd>_pam_delete_stale_commitments.sql
delete from pam_commitments
where who = 'garrett'
  and (
    what ilike '%draft & submit WTG proposal%'   -- stale: real WTG deadline is 2026-07-29, tracked separately & parked
    or (what ilike '%PRME%' and what ilike '%forum%'  and what ilike '%submission%')  -- no longer a deliverable
  );
```
Verify it matches exactly **two** rows before applying (`select ... ` first).

## optional follow-on (not required for this task)
- add a `pam_delete_commitment` tool in `lib/agent/tools/pam.ts` + the MCP
  route (`app/api/mcp/agents/[agent]/route.ts`) so PaM can delete tiles
  conversationally, not just the UI. Note PaM's `briefing` does not currently
  expose commitment ids, so an agent-side delete would also need an id-returning
  list/lookup — out of scope here, flag if you pick it up.

## out of scope
- the stale strategy-dashboard date refresh (separate task).
