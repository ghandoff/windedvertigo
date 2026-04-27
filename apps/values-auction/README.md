# values auction

a live, facilitator-driven classroom game for the winded.vertigo / PRME network.
three views (participant, facilitator, wall) of the same session state. scarcity
is real. losses stick.

## requirements

- node 20+
- npm 10+
- a modern evergreen browser (chrome, firefox, safari, edge)

## install

from this app directory:

```bash
npm install
```

from the monorepo root, the workspace install also works:

```bash
npm install --workspace @harbour/values-auction
```

## dev — single machine, multi-tab (default)

```bash
npm run dev
```

three urls:

- facilitator → `http://localhost:5173/#/facilitate?code=DEMO`
- participant → `http://localhost:5173/#/join?code=DEMO` (open 2+ tabs)
- wall        → `http://localhost:5173/#/wall?code=DEMO`

transport is the browser `BroadcastChannel` api, scoped per session code.

## dev — cross-device on lan

terminal 1 (ws hub):

```bash
npm run dev:server
```

terminal 2 (vite):

```bash
VITE_TRANSPORT=socket npm run dev
```

override the server url with `VITE_WS_URL=ws://<lan-host>:8787` if needed.

## test

```bash
npm test          # vitest unit suite
npm run e2e       # playwright smoke across the three views
```

## build

```bash
npm run build
npm run preview
```

## environment variables

| variable          | default                | notes                                       |
| ----------------- | ---------------------- | ------------------------------------------- |
| `VITE_TRANSPORT`  | `broadcast`            | `broadcast` or `socket`                     |
| `VITE_WS_URL`     | `ws://localhost:8787`  | only read when `VITE_TRANSPORT=socket`      |
| `PORT` (server)   | `8787`                 | ws hub port                                 |

## session flow

seven acts: arrival · grouping · set the scene · team strategy · auction · reflection · regather.
the facilitator drives act transitions. the auction is authoritative on the
facilitator client, so bids are validated centrally and broadcast as state
snapshots.

## known limits

- phase 1 mvp. no user accounts, no cloud persistence. state lives in the
  facilitator tab + a short-lived localstorage cache.
- the ws hub is a single-process, single-machine hub suitable for lan demos.
  for remote PRME sessions, swap `src/transport/socket.ts` for a supabase
  transport — the rest of the app is unchanged.
- identity card export renders a 1200×630 png via an svg + canvas roundtrip.
  the server-rendered satori path is scaffolded but not wired — html-to-image
  semantics were unnecessary given our static svg layout.
- no deck editor, no startup profile editor, no multi-language.
