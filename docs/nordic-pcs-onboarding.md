# Nordic Naturals PCS — Pilot Onboarding Guide

*For Sharon's RA/RES team. Updated Mar 2026.*

---

## What Is This?

The PCS (Product Claim Substantiation) system is your team's new home for managing product claims, the evidence behind them, and the review process. It replaces the Smartsheet trackers and email-based workflows you've been using.

Everything lives in Notion. If you can use Notion, you can use this.

---

## Key Concepts

**PCS Document** — One per product (e.g., "Ultimate Omega"). Think of it as a folder.

**PCS Version** — A snapshot of a product's claims at a point in time. When claims change, you create a new version rather than editing the old one. This preserves history.

**Canonical Claim** — The official wording of a claim (e.g., "Supports heart health"). Each claim exists once, even if used across multiple products. This prevents duplicate or conflicting language.

**Evidence Packet** — A bundle of studies and references that together substantiate a claim. One claim may have multiple packets (e.g., one for cardiovascular, one for cognitive).

**Evidence Library** — Your central repository of individual studies, reviews, and monographs. Each entry can be linked to multiple claims and packets.

**PCS Reference** — Citation metadata: DOI, PMID, EndNote ID, author, journal, year. Links to Evidence Library entries for full traceability.

---

## Your Daily Views

### If You're Sharon (Manager / Approver)

**Start here: Request Queue**
- Shows all incoming claim requests, sorted by urgency
- Triage new requests: assign a reviewer, set priority
- Filter by status to focus on what needs attention now

**Then check: Pending Approval**
- PCS Versions that reviewers have marked ready for your sign-off
- Open a version to see its linked claims, formula lines, and evidence packets
- Approve, request revision, or reject — your decision gets logged in Status Log

**Weekly: Recent Changes**
- Revision Events from the last 30 days
- See what's been updated, by whom, and why
- Catches anything that slipped through without your awareness

### If You're a Reviewer (RA/RES Staff)

**Start here: My Reviews**
- PCS Requests assigned to you, filtered to "In Review" status
- Each request links to the product and proposed claim language

**Your workflow:**

1. **Check for existing claims** — Search Canonical Claims before creating a new one. If the claim already exists, link to it rather than duplicating.

2. **Gather evidence** — Search the Evidence Library by ingredient, study type, or publication year. If you find relevant studies, add them to an evidence packet. If you need new literature, search externally and add entries to the Evidence Library.

3. **Build the packet** — Create or update an Evidence Packet. Link it to the canonical claim via the Claim–Evidence join table. Each link represents "this evidence supports this claim."

4. **Update the PCS Version** — Add your claim and evidence packet to the current version of the PCS Document. If this is a new version, create one and link it to the parent document.

5. **Mark ready for review** — Update the request status to "Pending Approval." Sharon will see it in her queue.

### If You're Looking Something Up (Audit / Regulatory)

**Start here: Products A–Z**
- Find the PCS Document for the product in question
- Click into it — the "All versions" back-link shows every version ever created
- Click a version to see its claims, formula lines, evidence packets, and references
- Click a claim to see which evidence supports it and where it's been used

**For citation lookup: Full Citation List**
- PCS References sorted by author/year
- Search by DOI, PMID, or EndNote ID
- Each reference links back to its Evidence Library entry

---

## Status Codes

You'll see these throughout the system. They match what you used in Smartsheet:

| Code | Meaning | What to do |
|------|---------|-----------|
| **DR** | Draft | Still being assembled — not ready for review |
| **IR** | In Review | Assigned reviewer is working on it |
| **PA** | Pending Approval | Ready for Sharon's sign-off |
| **AP** | Approved | Done — claim is substantiated |
| **RV** | Revision Needed | Issues flagged, needs rework |
| **RJ** | Rejected | Cannot be substantiated with current evidence |
| **AR** | Archived | Superseded by a newer version |

---

## Common Tasks

### Submit a new claim request

1. Go to **PCS Requests** database
2. Click **New** to create a record
3. Fill in: product name, proposed claim language, urgency, context/rationale
4. Set status to **DR** (Draft) — Sharon will triage it

### Add a new study to the Evidence Library

1. Go to **Evidence Library** database
2. Click **New** to create a record
3. Fill in: title, authors, publication year, study type, ingredient/tag
4. Create a matching **PCS Reference** record with the DOI/PMID/EndNote ID
5. Link the reference to the evidence entry

### Create a new PCS Version

1. Go to **PCS Versions** database
2. Click **New** to create a record
3. Link it to the parent **PCS Document**
4. Add claims, formula lines, and evidence packets via the relation fields
5. If this replaces an older version, create a **Revision Event** linking the old and new versions with a rationale

### Find all evidence for a specific ingredient

1. Go to **Evidence Library** database
2. Use the filter: Ingredient/tag contains "[your ingredient]"
3. The "Used in evidence packets" column shows where each study is already being used
4. The "PCS references" column links to formal citations

---

## Tips

- **Don't duplicate claims.** Always search Canonical Claims first. If "Supports heart health" already exists, link to it — don't create "Supports cardiovascular health" as a separate record.

- **Version, don't edit.** If a PCS Document's claims change, create a new PCS Version. The old version stays as history. This is how audit trails work.

- **Use the back-links.** Every page now shows its related records in both directions. If you're on a Claim page, you can see which products use it. If you're on an Evidence item, you can see which claims cite it. Navigate by clicking, not by searching.

- **Notes fields are specific.** Each database has its own notes field ("Document notes", "Claim notes", "Version notes", etc.). Use the right one — this matters for AI queries.

- **Person fields are real.** "Responsible individual" on Revision Events is a Notion person field, not a text field. Tag people by name so they get notifications and the record is filterable.

---

## Getting Help

This system was designed around your existing workflow — same status codes, same review process, same team roles. The difference is that everything is connected: claims link to evidence, evidence links to citations, versions link to documents, and you can navigate in any direction.

If something feels missing or confusing during the pilot, flag it. The schema can be adjusted before full rollout.
