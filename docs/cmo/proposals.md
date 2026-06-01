# proposal generation doctrine — winded.vertigo

> canonical guidance for automated proposal drafts (AI) and human-written proposals alike.
> source of truth: `crm/lib/ai/proposal-generator.ts` system prompt
> last updated: april 2026

---

## team composition — standing doctrine

### who appears in every proposal

**all five of the following must appear in every proposal's team composition section**, not a subset:

| member | standing role in every proposal |
|--------|--------------------------------|
| **Garrett Jaeger** | principal lead — MEL, learning design strategy, client relationship |
| **Lamis Sabra** | facilitation design + practitioner experience lead |
| **Maria Altamirano Gonzalez** | practitioner & cultural appropriateness lead + operations |
| **James Galpin** | curriculum, materials, and instructional writing (scope-dependent intensity) |
| **Payton Jaeger** | visual communication, tone strategy, stakeholder messaging, brand |

### why Lamis is always included

Lamis is not only the facilitation specialist. she is the team's practitioner experience lead — the person who ensures that what w.v designs is genuinely appropriate for the people in the room: their cultural contexts, the pacing of the experience, the group dynamics, the difference between a technically correct training structure and one that a real teacher or programme officer will actually engage with. this contribution exists whether or not the engagement is heavily facilitation-focused. never frame Lamis as conditional.

### why Maria is always included

Maria is not a regional specialist who appears on LatAm or IDB bids. she is the internal voice ensuring everything w.v produces is designed for the practitioners and communities it serves — reviewing frameworks, tools, curricula, and training materials for cultural appropriateness, contextual fit, and real-world usability. she also manages the operational complexity of every engagement (coordination, scheduling, deliverable logistics). her contribution is present on every project. never frame Maria as "LatAm only" or reduce her to operations.

### how to write Payton's section

Payton's contribution is **substantive**, not administrative. the team composition section should make the case that visual language, tone, and communications strategy are programme-level variables — not finishing touches. key points to make:

- visual design and tonal calibration of all external-facing deliverables (impact reports, stakeholder briefs, training materials, proposals)
- stakeholder messaging architecture — how the work communicates to funders, partners, school leaders, community members
- brand voice consistency and how it affects perceived credibility and trust
- in engagements requiring stakeholder buy-in at scale (government departments, community organisations, multi-partner programmes), communications quality determines adoption

do not reduce Payton to "she'll find local partners." local partner identification is one task; it is not her identity.

---

## section length minimums

| section | minimum |
|---------|---------|
| executive summary | 350 words, 4–6 paragraphs |
| understanding of requirements | 400 words, 3–5 paragraphs |
| proposed approach | 600 words, phased with named phases, deliverables per phase |
| relevant experience | 4–6 entries, each entry 3–5 sentences |
| team composition | 5–6 paragraphs (one per team member + local partner) |
| value proposition | 300 words, 3–4 paragraphs |
| budget framework | 2–3 paragraphs |
| risk mitigation | 2–3 paragraphs, 3–4 named risks with specific mitigations |

---

## cover letters

set `requiresCoverLetter: true` when:
- RFP explicitly asks for a cover letter, letter of interest, EOI, or transmittal letter
- submission is a grant or EOI-type format where cover letters are standard

format: date → recipient (or "Procurement Committee") → organisation → Re: [title]
4 paragraphs: who we are + why submitting | understanding + fit | team + confidence | next steps + contact
sign off: Garrett Jaeger, Principal, winded.vertigo

---

## CVs

include CVs when RFP asks for team CVs, staff bios, or qualifications evidence. use `teamMembersForCvs` array. CV content is in `TEAM_BIOS` record in `proposal-generator.ts` — update there when bios change.

---

## visual aide callouts

whenever a diagram would clarify a complex relationship (theory of change, phased approach, MEL feedback loop, competency progression, transfer model), add:

`🎨 Visual aide: [description of what to show and why]`

these render as Notion callout blocks in the generated proposal, not as prose. use them generously — they are invitations for the human editor to add a real visual.

---

## citations

- `relevantCitations` comes from the annotated bibliography, pre-selected by the citation-matcher (Claude Haiku)
- cite inline as (Author, year), full citation in `references` array
- authoritative policy sources (UNICEF, OECD, World Bank, Learning Policy Institute) may be cited even if not in the bibliography if directly relevant
- never invent citations — omit rather than fabricate

---

## anti-patterns to avoid in proposals

- do not frame any team member as "optional" or "may be brought in if needed" for Lamis, Maria, or Payton — they are always in
- do not reduce Maria to "LatAm/IDB only" — she contributes to all engagements
- do not reduce Payton to "she'll find local partners" — she leads communications and messaging strategy
- do not use filler language ("robust", "impactful outcomes", "leverage synergies", "world-class")
- do not write one-sentence relevance descriptions for past experience — minimum 3 sentences
- do not omit a local partner note when the engagement requires in-country implementation capacity
