# Claude Code prompt — stand up the "Amna at 10" reading sprint in PaM

> Paste into a Claude Code session opened in `~/Projects/windedvertigo`, in **Plan mode** (shift+tab). It reviews the live PaM dashboard + data model first, then proposes how to represent the Amna at 10 inception reading sprint as PaM commitments + agent-routed tasks. Review the plan before approving any changes.

---

Switch to **Plan mode** and stay plan-first: do not write data, run migrations, or deploy until I approve. Your job is to make the **Amna at 10** desk-review inception readable and accountable inside **PaM** (the project + momentum manager on `port.windedvertigo.com/pam`), without over-building.

## orient first (review before proposing)

1. Read `./CLAUDE.md` and `../harbour-apps/CLAUDE.md` — conventions, "merged ≠ deployed," Supabase migrations applied manually, and the agents/memory architecture.
2. **Review the live PaM dashboard and its data model — all tabs:** `timeline` (deliverables as programme lanes), `pulse`, `whirlpool` (the weekly session board; tap-to-advance, grouped by person/status), `commitments` (the atomic unit — each has **owner, source ("via …"), description, due date, status [not started / in progress / blocked / done / parked], and dependencies**), `inbox`, and `brain` (PaM's memory). Find where these live: the `port` app components for `/pam`, the **Supabase** tables behind commitments/whirlpool/programmes, the `pam_*` MCP tools (`pam_create_commitment`, `pam_update_commitment`, …), and the `docs/pam/` brain.
3. **Note the gap:** there is currently **no "Amna at 10" programme lane** and no Amna commitments. Existing lanes: LEAP 2025, PRME 2026, Currents, R+D, Studio of Studios, Business Development.
4. Read the Amna context so the commitments link to real artefacts:
   - Notion **START HERE** (overview + decisions A1–A5): https://app.notion.com/p/38ae4ee74ba481a29aa0f72fda76e218
   - Notion **v2 Inception Package**: https://app.notion.com/p/38ae4ee74ba481088a42e35b9573fda5
   - Notion **raw-data plan**: https://app.notion.com/p/38ae4ee74ba481dd8b8cef99843c6054
   - the **evidence map**: `site/public/tools/amna-evidence-map/index.html`
   - repo: `docs/carl/amna/2026-06-25-amna-at-10-desk-review-plan.md` (reference)

## what to propose (after review)

### A. an "Amna at 10" programme lane
Add Amna at 10 as a programme/lane on the timeline (alongside LEAP, PRME, etc.), spanning now → the 30 Sep long-stop, with the inception note as the first milestone.

### B. the inception reading-sprint commitments (the human leads)
Create one commitment per lead — **specific documents + a by-when**, owner, status, and a link to the source doc/Notion/evidence-map. Phrase as implementation intentions where natural.

- **Garrett** — read the ~15 strategy/spine docs (healing-ecosystems evolution, internal narrative 2026, MEL ToC, cumulative-reach workbook) + the 2022 six-year evaluation; log key points to the evidence register.
- **Jamie** — read the external academic evaluations (UVA Baytna final, Chapin Hall Afghanistan final, Nexus CP Afghanistan) + a methods/evidence-quality pass; owns the OSF prereg.
- **Lamis** — read the Arabic/MENA materials (UVA Jordan & Lebanon incl. transcripts, Baytna Lebanon, CP Afghanistan partner docs, Palestine emergency response); trans-adaptation checks.
- **María** — read Baytna/ECD + Dinami/youth + the public-facing impact narratives; owns the evidence map + inception workshop.

**Due-date logic (peg to the kickoff, ~1 July, and the inception note):** (1) a light pre-kickoff skim + framing questions *before* the kickoff; (2) full Tier-1 deep reads + register entries within ~10 days of the kickoff; (3) feed the inception note (the paid 30% gate). Set concrete dates once the kickoff is booked.

### C. agent-routed tasks (PaM orchestrates; dependencies matter)
- **cARL** → the **LLM-assisted thematic pass on the long-tail partner-MEAL files** (the files no human reads), maintain the evidence map + library findings, support the OSF prereg. *(This blocks/feeds the human deep-reads — set the dependency.)*
- **Mo** → the public impact-brief positioning, the September "activated outputs," dissemination strategy.
- **Biz** → a QC / go-no-go gate on decisions A1–A5 and a quality-review gate on each deliverable before it goes to Amna.
- **Fin** → track the 30/30/40 milestone invoicing against deliverable approval.

### D. surface it where the team already looks
Ensure the Amna commitments appear in the **whirlpool** weekly board (so they're part of the Mon/Wed accountability rhythm) and the **timeline** lane. Don't build new UI if an Amna programme tag + existing views suffice — prefer reusing the existing commitment/whirlpool machinery.

## constraints
- **Plan first.** Flag any **Supabase migration** (provide SQL + backup + rollback; I apply it manually) and any **deploy** (`port` deploys only via `npm run deploy:cf`, by me) for explicit approval. If the `pam_*` MCP tools change, note that I must reconnect the agents connector in Cowork.
- Don't invent commitment data — use the real assignments above; leave due dates as `⟨set once kickoff booked⟩` if the date isn't fixed.
- Link every commitment to its source artefact (Notion/evidence-map/repo).
- House style: lowercase UI copy, british spelling, kebab-case files.

## hand back
A plan: (1) what you found in the PaM data model + how commitments/whirlpool/programmes are stored; (2) the proposed Amna lane + the exact commitments (human + agent-routed) with owners, links, dependencies, and due-date placeholders; (3) any migration/seed steps flagged for my approval; (4) what reuses existing machinery vs needs new code. Stop and wait for approval.
