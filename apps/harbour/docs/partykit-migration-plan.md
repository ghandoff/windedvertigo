# Partykit Migration Plan (raft-house)

**Status:** planning only, not scheduled. Written 07 April 2026.

## Why this exists

raft-house's multiplayer backend currently runs on [PartyKit](https://www.partykit.io). PartyKit is dormant — `0.0.115` (current) hasn't been updated in months, and its dependency chain (`miniflare → undici / esbuild`) carries 4 known security advisories that we can't patch from the outside. They're all dev-only (the local emulator), but they show up in `npm audit` and Dependabot, and they're the only thing standing between harbour-apps and a clean security report.

The runtime impact is zero today. The migration is about (a) eliminating the dev-only vulnerabilities, (b) getting off an abandoned package before something breaks at the wrong moment, and (c) future-proofing the multiplayer experience for the 1 May 2026 collective break-test and beyond.

## What raft-house actually needs from a multiplayer backend

Reading `apps/raft-house/party/room.ts` and `apps/raft-house/lib/types.ts`:

- **Persistent rooms keyed by a 6-character code** — facilitator creates a room, participants join via the code
- **Single source of truth for room state** — facilitator + participants see the same `RoomState` (mode, displayMode, ageLevel, status, activities, currentActivityIndex, participants map, timer, resultsRevealed)
- **Two-way realtime messages** — `ClientMessage`, `FacilitatorMessage`, `ParticipantMessage` flow up; `ServerBroadcast` flows down
- **Server-authoritative timer** — the server runs the activity timer, not the clients
- **Ephemeral state** — rooms don't need to persist beyond the session. If a room is empty for >1 hour it can be garbage collected
- **No long-tail history** — once a session ends, the data is gone. No replay, no audit log

This is a textbook "soft-realtime collaborative session" use case. Almost any modern realtime platform handles it.

## Three viable replacements

### Option A: Liveblocks (recommended)
**What it is:** A managed realtime collaboration platform. Built specifically for this use case (Figma-style multiplayer state).

**Pros:**
- Drop-in primitives: rooms, presence, broadcast events, durable storage. Maps almost 1:1 onto raft-house's current `Party.Server` shape.
- React hooks (`useRoom`, `useStorage`, `useBroadcastEvent`) replace `usePartySocket` cleanly.
- Free tier covers 100 MAU, which is plenty for the break-test sprint and likely the first months of public launch.
- Active development, healthy security posture.

**Cons:**
- Vendor lock-in. If Liveblocks raises prices or shuts down, we re-migrate.
- $25/month minimum once we exceed the free tier (which we will eventually).

**Migration effort:** ~1 day. The mapping is mechanical:
| partykit concept | liveblocks equivalent |
|---|---|
| `Party.Server` class | Liveblocks Room with `RoomEventEmitter` |
| `connection.send(JSON.stringify(msg))` | `broadcastEvent({type, payload})` |
| `room.broadcast(msg)` | `useBroadcastEvent` hook |
| `state` (in-memory) | `useStorage` (LiveObject/LiveMap) |
| Connection metadata | `usePresence` |

**When to pick this:** if we want the migration done in a day and we're OK paying $25/mo eventually.

---

### Option B: Cloudflare Durable Objects directly
**What it is:** What PartyKit was a wrapper around. We deploy our own Durable Object that holds the room state, and clients connect via WebSockets.

**Pros:**
- Same underlying platform as PartyKit, so the runtime semantics are nearly identical — no surprises
- No vendor lock-in beyond Cloudflare (which we already use for R2)
- Cheap: $0.15 / million requests + $0.20 / GB-month storage. raft-house at break-test scale would cost roughly $0/month
- Eliminates the abandoned partykit middleman

**Cons:**
- More boilerplate. We write the WebSocket upgrade handler, the message router, and the lifecycle hooks ourselves
- Local dev story is wrangler instead of `partykit dev` — different developer experience but not worse

**Migration effort:** ~2 days. Most of `room.ts` ports directly because the underlying API surface is similar.

**When to pick this:** if we want zero recurring cost and we're comfortable owning a bit more infrastructure code.

---

### Option C: Pusher / Ably / Supabase Realtime
**What it is:** Generic pub-sub services where the server is the source of truth and clients subscribe to channels.

**Pros:**
- Mature, well-documented, lots of examples
- Easy to swap between providers if one becomes problematic

**Cons:**
- Wrong shape for the use case. raft-house needs *room state*, not *channel events*. We'd end up writing the state-store layer ourselves, on top of the pub-sub primitive
- More moving parts than Liveblocks or Durable Objects
- Higher recurring cost than Durable Objects

**Migration effort:** ~3 days, mostly because we'd be inventing the state layer.

**When to pick this:** if Liveblocks and Cloudflare are both off the table for some external reason. Otherwise no.

---

## Recommendation

**Go with Option A (Liveblocks)** unless we have a strong reason to avoid vendor lock-in. The migration is ~1 day, the developer experience is better than partykit, security posture is solid, and the free tier covers us through launch and beyond.

If we're cost-paranoid or want to stay on Cloudflare's stack end-to-end, **Option B (Durable Objects)** is the right call — twice the work, but the running cost is essentially zero forever.

**Avoid Option C** unless something blocks both A and B.

## Migration sequence (assuming Option A)

1. **Spike (2 hours)** — sign up for Liveblocks free tier, port the simplest message type (e.g. `participant_join`) end-to-end, confirm latency feels right
2. **Type-shape mapping (1 hour)** — write a translation table from `RoomState` / `ClientMessage` / `ServerBroadcast` to Liveblocks Storage + Events
3. **Server port (3 hours)** — replace `apps/raft-house/party/room.ts` with a Liveblocks-side handler. The room logic is mostly state mutations; only the transport layer changes
4. **Client port (2 hours)** — swap `partysocket` for `@liveblocks/react`, replace `usePartySocket` calls with `useRoom` + hooks
5. **Smoke test with 2 browsers** — facilitator in one, participant in another. Verify all message types still work
6. **Deploy** — flip the env var, deploy raft-house, run the existing smoke tests
7. **Cleanup** — remove `partykit`, `partysocket`, `apps/raft-house/party/`, the `party:dev` and `party:deploy` scripts. Run `npm audit` to confirm 0 vulnerabilities in harbour-apps

**Estimated total effort:** 1 working day, comfortably.

## Files that will change

| File | Change |
|---|---|
| `apps/raft-house/party/room.ts` | Delete (logic moved into Liveblocks server-side handler) |
| `apps/raft-house/lib/types.ts` | Keep (the domain types are reusable) |
| `apps/raft-house/components/room-client.tsx` (or wherever `usePartySocket` lives) | Replace partysocket with `@liveblocks/react` |
| `apps/raft-house/package.json` | Remove `partykit`, `partysocket`. Add `@liveblocks/client`, `@liveblocks/react` |
| `apps/raft-house/.env.local` (and Vercel env) | Add `LIVEBLOCKS_SECRET_KEY` and `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY` |
| `docs/infrastructure-and-costs.md` | Update SaaS list, remove the partykit dev-only exception |

## Verification

- `npm audit` in harbour-apps reports **0 vulnerabilities** (down from 4 dev-only)
- Two browsers in different sessions can join the same room and see each other's messages in <500ms
- Activity timer counts down server-side (not client-side) — verify by killing one client and reconnecting; timer should still be correct
- All existing raft-house smoke tests pass
- Liveblocks dashboard shows the active room and connected clients

## When to actually do this

**Not before 1 May 2026.** The break-test sprint needs raft-house to be stable, not in the middle of a backend swap. Migrate in May or June 2026, after the launch dust settles, when there's a quiet week to focus on it.

**Trigger to fast-track:** if partykit's dev tooling actively breaks (e.g. a Node version bump that miniflare can't handle), or if a CVE in the partykit chain is rated critical and exploitable in production (currently they're all dev-only and rated high or moderate).
