# Memory

> Deep memory, tasks, and operational files live in `.brain/`
> Tasks: `.brain/TASKS.md` | Memory: `.brain/memory/` | Archive: `.brain/archive/`

## Me
Garrett Jaeger, Founder & Legal Representative of winded.vertigo LLC — a learning design collective. Based in the US (Eastern time). Email: garrett@windedvertigo.com

## People
| Who | Role |
|-----|------|
| **Payton** | Payton Jaeger, w.v collective — comms, website circulation, outreach |
| **Lamis** | Lamis Sabra, w.v collective — weekly sync Tuesdays 4pm UTC |
| **Maria** | Maria Altamirano Gonzalez, w.v collective — operations, IDB Salvador lead. Weekly Tuesdays 6pm UTC |
| **Apoorva** | Apoorva Shivaram, w.v collective — PRME workshops, survey design |
| **Kristin** | Kristin Lansing — formerly w.v collective (inactive) |
| **James** | James Galpin, w.v collective |
| **Randall** | External — weekly call Tuesdays 5pm UTC |
| **Gina** | Gina Jaeger — family |
| **Meredith** | Meredith Storey, UN Global Compact / PRME — key client contact |
| **Sam** | Sam at PRME — works with Meredith on contracts |
→ Full list: .brain/memory/glossary.md, profiles: .brain/memory/people/

## Terms
| Term | Meaning |
|------|---------|
| **w.v** | winded.vertigo |
| **whirlpool** | Monthly community learning event (public-facing) |
| **fruitstand** | Internal team meeting |
| **campfire** | Studio discussion format |
| **PRME** | Principles for Responsible Management Education (UN Global Compact program) |
| **PPCS** | PRME Pedagogy Certificate System — evidence infrastructure + AR program |
| **creaseworks** | w.v product — creativity platform |
| **GoTCHA!** | w.v product/project |
| **eddyy** | w.v product/project |
| **perp labs** | w.v studio initiative — perpetual labs |
| **toy lab** | w.v studio initiative |
| **play, fair** | w.v studio initiative — play and fairness research |
| **IDB** | Inter-American Development Bank — El Salvador ed-tech procurement |
| **MINEDUCYT** | El Salvador Ministry of Education, Science and Technology |
| **the collective** | The Winded Vertigo Collective — the full team |
| **Press Play** | Partner or program — joint whirlpool sessions |
| **stack audit** | Annual review of tools, DNS, hosting, subscriptions (first Monday of Jan) |
→ Full glossary: .brain/memory/glossary.md

## Active Projects
| Name | What | Status |
|------|------|--------|
| **IDB Salvador** | Ed-tech modernization procurement SDP 01/2026. Deadline: **April 10, 2026** | Active — docs requested |
| **PRME 2026** | Contract with UN Global Compact. Signed. PO approved Mar 27. First invoice submitted. | Active — invoicing |
| **Amna at 10** | Evidence synthesis & impact report proposal submitted Mar 26 | Proposal submitted |
| **LEGO / Superskills!** | Cross-cutting skills certification with Learning Economy Foundation | Active |
| **Sesame Workshop** | Learning design engagement | Active |
| **UNICEF** | Learning design engagement | Active |
| **Website launch** | windedvertigo.com circulated to trusted contacts for feedback Mar 27 | Active — soft launch |
| **401k / CPA** | Plan #156733 with ADP. Final 5500 + year-end testing needed | Active — admin |
→ Details: .brain/memory/projects/

## Recurring Meetings
| Meeting | When | Who |
|---------|------|-----|
| whirlpool x Press Play | Mon 4pm UTC | Lamis, Payton, Maria, + |
| weekly = lamis x garrett | Tue 4pm UTC | Lamis |
| Randall | Tue 5pm UTC | Randall, Gina |
| garrett x maria (part i) | Tue 6pm UTC | Maria |
| PRME hold | Tue 7pm UTC | Meredith, Sam, + |
| R&D meeting | Fri 6pm UTC | Gina, + |
| bi-weekly strategy playdates | Every 2 weeks | Team |

## Scheduled Tasks (AI Automation)
| Task | Schedule | What |
|------|----------|------|
| **weekly-cfo-review** | Mon 9:05am | Cash position, revenue pipeline, CPA liaison, action items |
| **invoice-processor** | Daily 9am | Scans Gmail for invoices, logs to Notion, labels in Gmail |

## Tool Stack
| Tool | What we use it for |
|------|-------------------|
| **Notion** | Central knowledge base, project management, invoice tracker, wiki |
| **Slack** | Team communication, async coordination |
| **Gmail** | External comms, client correspondence, invoice capture |
| **Google Calendar** | Scheduling, meeting cadence, time blocking |
| **Google Drive** | Document storage, shared folders, proposals |
| **Vercel** | Website hosting (windedvertigo.com) |
| **Cloudflare** | DNS, security, edge infrastructure |
| **Cowork (Claude)** | CFO/COO operations, memory system, scheduled tasks, file management |
| **Otter AI** | Meeting transcription (archived in Notion) |
| **ADP** | 401k plan administration |

## AI Roles (Second Brain C-Suite)
- **CFO**: Financial reporting, cash flow, invoicing, CPA coordination, revenue pipeline, budget monitoring
- **COO**: Task management, meeting prep, project health, team coordination, process automation
- Scheduled tasks = "dispatch" — autonomous operations that run without prompting

## Dual-Environment Architecture

The second brain operates across two Claude environments with a shared memory layer.

### Cowork (Desktop App) — Operations Layer
**Role:** CFO/COO copilot. Runs the business.
- Financial reviews via QuickBooks + Gusto MCPs
- Email triage, drafts, invoice processing (Gmail MCP)
- Meeting prep + calendar management (GCal MCP)
- Team coordination (Slack + Notion MCPs)
- Document creation (proposals, reports, decks, PDFs)
- Scheduled dispatch tasks (invoice-processor, weekly-cfo-review)
- Cross-tool search and synthesis (enterprise search)
- Project tracking, task management, memory updates
- Google Drive document retrieval

### Claude Code (Terminal) — Engineering Bench
**Role:** Builder. Ships code.
- Monorepo code changes: `harbour/`, `crm/`, `ops/`, `packages/`
- Build fixes, dependency management, config files
- Git operations (commit, push, branch, PR)
- Deployment via Vercel CLI (`deploy:ops`, `deploy:crm`)
- New features for ops dashboard, CRM, website
- Infrastructure (Cloudflare workers, D1, KV if needed)
- Debugging build/runtime errors
- Any task that needs `git push` or `npm run`

### Shared Foundation
Both environments read the same repo, same `CLAUDE.md`, same `.brain/`.
- Memory updates happen in whichever environment finishes a significant session
- When Cowork identifies engineering work → log it in `TASKS.md` under `## Engineering (Claude Code)`
- When Claude Code finishes building → update `TASKS.md` and note what's deployed
- Handoff notes go in `.brain/memory/handoff.md` for cross-environment context

## Monorepo Structure
```
windedvertigo/
  harbour/          — main website (windedvertigo.com)
  crm/              — client relationship manager (crm.windedvertigo.com)
  ops/              — command center dashboard (ops.windedvertigo.com)
  packages/         — shared packages
  scripts/          — deploy scripts (deploy-crm.sh, deploy-ops.sh)
  .vercel/          — Vercel project config (swapped by deploy scripts)
```

**Tech stack:** Next.js 16 + Turbopack, Tailwind v4, Auth.js v5 (Google OAuth), npm workspaces (no turborepo), Vercel hosting, Cloudflare DNS.

## Infrastructure State
| Service | Domain | Vercel Project | Status |
|---------|--------|---------------|--------|
| Website | windedvertigo.com | wv-harbour | Live |
| CRM | crm.windedvertigo.com | wv-crm | Live |
| Ops | ops.windedvertigo.com | wv-ops | Deployed — auth flow needs verification |

## Preferences
- Continuous copilot mode — don't wait to be asked, surface relevant info proactively
- All domains integrated: work, personal, creative, health, financial/CPA
- Lowercase aesthetic in brand voice (winded.vertigo style)
- Financial clarity is top priority — "where do we stand?" should always have an answer
- Memory should always be updated after significant sessions
- Engineering work → Claude Code. Operations work → Cowork. Don't fight the tools.
