# winded.vertigo × august
**a brief on where we are and what we're building together**
*april 2026*

---

## who we are

winded.vertigo (w.v) is a learning design collective. we work with organizations — UN programs, development banks, NGOs, ed-tech companies, and educational institutions — to design, evaluate, and scale learning experiences. our work spans pedagogy, program evaluation, evidence systems, product design, and platform infrastructure.

the collective is small and intentional: garrett (founder), payton (comms + outreach), lamis (facilitation + community), maria (operations + international programs), and james (writing + research). we run lean, we move fast, and we care a lot about the quality of what we make.

---

## what august has already built with us

you came in during a critical phase. when you arrived, our infrastructure was a patchwork — scattered tools, no real operating system, no shared mental model of how work flows through the team. what you built:

- **a Notion OS** for the full team — replacing fragmented workflows with a centralized platform, built with Double Diamond + ADKAR methodology, complete with training docs, in-person sessions, and a video library
- **the `#august-base` knowledge wiki** — a living documentation layer where we track SOPs, guides, and processes; you built the structure, schema, and taxonomy
- **PM platform exploration** — you led our evaluation of Linear, Motion, ClickUp, and Notion for project management across different project types
- **early CRM thinking** — you helped us think through Attio as a relationship management layer before garrett pivoted to building The Port

you taught payton how relational databases work. you got maria shipping with Claude. that's not a small thing.

---

## where we are now

### the tech stack
we're at an inflection point. our current stack:

| layer | current | direction |
|-------|---------|-----------|
| hosting | vercel | cloudflare workers / pages |
| database | notion (source of truth) | supabase |
| CRM / ops | the port (vercel + notion) | the port (cloudflare + supabase) |
| DNS / security | cloudflare | cloudflare (staying) |
| auth | auth.js v5 (google oauth) | staying |

vercel is feeling predatory. notion has real limitations — no webhooks (polling only), no field validation, no required fields, a poor mobile experience. we're actively planning migration to supabase as the primary database layer, with cloudflare workers on the edge. garrett has already built a before/after stack comparison report (attached) that maps this out.

### the port
the port started as a CRM to manage campaigns — it now includes project management with tasks, milestones, gantt charts, and calendars pulled from notion. the team has largely stopped using notion directly and prefers working through the port interface. it's a custom-built app (next.js 16, tailwind v4, auth.js, vercel + cloudflare).

the port lives at `port.windedvertigo.com` and is becoming the hub. the next chapter is migrating its data layer from notion to supabase.

### active client work
| project | what | status |
|---------|------|--------|
| PRME 2026 | UN Global Compact contract — pedagogy certificate system, evidence infrastructure, AR program | active — invoicing |
| IDB Salvador | ed-tech modernization, SDP 01/2026 | active — docs in progress |
| Nordic Naturals | research database / command center (HTML app on vercel) | active |
| LEGO / Superskills! | cross-cutting skills certification | active |
| Sesame Workshop | learning design engagement | active |
| UNICEF | learning design engagement | active |
| Amna at 10 | evidence synthesis + impact report proposal | submitted |

---

## what we want from you — rest of 2026

based on our conversation, here's how we're thinking about the collaboration:

### 1. technical backup + continuity
you become a "watcher" — staying advised on the stack, the port, and our infrastructure. if garrett gets sick, goes dark, or needs to step away, you can step in without a cold start. this is about resilience, not redundancy.

### 2. stack migration support
the vercel → cloudflare + supabase migration is coming. we want you available as a technical guide and sounding board — you don't need to build it all, but your experience here would save us from expensive mistakes.

### 3. the port: database layer + feature development
as the port evolves, we'll need architectural thinking and development support. specifically: migrating nordic naturals and other databases from notion to supabase, and continuing to build out port features as the team's primary interface.

### 4. research database infrastructure (PRME)
garrett is building a research database for the PRME contract — structured evidence from program evaluations, publications, and community data. this needs to be built right, and we want you as backup support.

### 5. client-facing systems
some clients (nordic naturals, potentially others) are receiving custom HTML dashboards and command centers. as this practice grows, you'd be a natural collaborator on architecture and delivery.

### 6. the "artificial brain" concept
you pitched a four-component system: plugins (AI areas), skills (execution modules), agents (which use skills), resources (SOPs + documentation). we want to build this together — it maps directly to how garrett is already using claude as a second brain / c-suite. there's real work here.

---

## arrangement

we talked about a few models:

- **retainer** (monthly) — a set amount to stay advised, be available for questions, and show up when needed
- **project-based** — scoped work tied to specific deliverables (port migration, research database, etc.)
- **hybrid** — a light retainer for continuity + project fees for bigger lifts

you said you're flexible, especially for projects with freedom for discovery. garrett's preference is something that doesn't create admin overhead for either of you.

next step: we discuss numbers and structure and turn this into a simple scope of work.

---

## a note

what you've built here has been genuinely useful. the team is more capable, the infrastructure is more coherent, and the thinking is sharper. this brief is an attempt to honor that by being honest about where we are and where we're going — so that whatever we build together next is grounded in reality.

more soon.

*— garrett*
