# creaseworks

co-design pattern platform for [winded vertigo](https://windedvertigo.com). built with next.js, vercel postgres, and notion as cms.

## setup

```bash
npm install
cp .env.example .env.local   # fill in all values
npx tsx scripts/run-migrations.ts
npx tsx scripts/seed-blocklist.ts
npm run dev
```

## architecture

see [docs/DESIGN.md](docs/DESIGN.md) for the full technical design document.

**key concepts:**

- notion is the cms — patterns, materials, packs, and runs are authored there
- vercel postgres is the system of record for entitlements, purchases, and cached notion content
- an hourly cron sync pulls from notion, normalises to lowercase, and upserts into postgres
- three-tier access: teaser (public), entitled (purchased), internal (admin)
- column-level security prevents leaking fields beyond the caller's tier

## project structure

```
src/
├── app/                    # next.js app router pages
│   ├── api/cron/           # vercel cron endpoint
│   ├── sampler/            # public pattern browser
│   └── page.tsx            # landing
├── components/ui/          # shared components
├── lib/
│   ├── queries/            # tier-scoped database queries
│   ├── security/           # column selectors + leak guard
│   └── sync/               # notion → postgres sync engine
scripts/                    # one-off setup scripts
migrations/                 # sql schema

## deployment

hosted on vercel at `creaseworks.windedvertigo.com`.

docs/                       # design documentation

```
