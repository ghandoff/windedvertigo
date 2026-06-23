# Bid Eligibility Screen — BIZ-E1

Authoritative definition of the six eligibility checks required before any
`bid` verdict. The `checkEligibilityGate()` function in
`port/lib/supabase/rfp-requirements.ts` enforces these as a hard gate; this
file is the human reference and agent memory source.

Each check is stored as an `rfp_requirements` row with `kind='eligibility'`.
The `eligibility_verdict` column must be set to `pass`, `n-a`, or `covered`
for all required rows before `bid` is permitted. A `fail` or `null` verdict on
any required row blocks the decision.

---

## The Six Checks

### 1. Entity vs. Individual Modality
**What it screens:** Does the call accept organisations, or only individual consultants?

Many development-bank tenders (World Bank, IDB, IADB, USAID) explicitly state
"individual consultant" or "firm/organisation" as the eligible applicant type.
winded.vertigo is an LLC; a call requiring an individual is automatically a
fail unless a named individual on our team is eligible to apply independently
and we structure the engagement accordingly.

- `pass` — call accepts firms / organisations
- `fail` — call requires individual consultants and no team member is set up as
  an independent respondent
- `covered` — call requires individual but a named team member (e.g. Garrett
  Jaeger, LLC legal representative) can apply as the eligible party; evidence
  must name the individual and the applicable clause

---

### 2. Local Registration / Locality
**What it screens:** Does the call require registration in-country, regional
presence, or a local-entity clause?

Common in MINEDUCYT (El Salvador), MINEDUC (other LatAm), some UN agency
tenders. A requirement to be "registered in [country]" that we cannot satisfy
via a teaming partner is an automatic fail.

- `pass` — no registration requirement, or our existing registration covers it
- `fail` — in-country registration required and we have no partner or entity on file
- `n-a` — call is global / remote-delivery with no residency clause
- `covered` — in-country partner confirmed; evidence must name the partner and
  reference the teaming/sub-contracting arrangement

---

### 3. Mandatory Credential / Language
**What it screens:** Does the call require a specific professional credential
(e.g. a certified evaluator designation, ISO certification, particular academic
degree in a named field) or a language proficiency we cannot demonstrate?

- `pass` — credential is held by a team member and is on file
- `fail` — credential required and no team member holds it
- `n-a` — no mandatory credential stated in the ToR
- `covered` — credential held by a named sub-contractor or partner under the
  team-composition clause; evidence must name the credentialed individual

---

### 4. Submission Mechanics
**What it screens:** Can we physically / technically comply with the submission
process? Portal-only submissions with country-restricted access, wet-ink
signatures required by in-person courier, bank guarantee required before
deadline — all are potential hard stops.

- `pass` — submission process is accessible and feasible for our team
- `fail` — submission requirement is impossible to meet (e.g. in-person
  notarisation in a country where no team member is present by deadline)
- `n-a` — standard email/portal submission with no special mechanics

---

### 5. Mandatory Experience Proof-Points
**What it screens:** Does the call list minimum prior-engagement requirements
(e.g. "at least 3 completed projects of ≥ $500k in the last 5 years in
[sector]") that the collective's verified project history cannot satisfy?

- `pass` — our BD assets and verified project history meet the stated minimum
- `fail` — minimum experience requirement is not met and no credible argument
  closes the gap
- `n-a` — no minimum experience threshold stated
- `covered` — gap closed via a named partner whose verified track record is in
  scope; evidence must reference the specific project(s) and their budget

---

### 6. Domain vs. Method Match
**What it screens:** Is the primary domain of the work within our practice area
(learning design, capacity building, MEL, pedagogy, instructional design), or
is it primarily something else (e.g. infrastructure, health services delivery,
supply chain management) that merely has a training component?

- `pass` — core scope is squarely within winded.vertigo's practice area
- `fail` — core scope is outside our domain (we would be the tail, not the dog)
- `n-a` — rarely applicable; most calls fall cleanly pass or fail here

---

## Verdict Definitions

| Verdict  | Meaning |
|----------|---------|
| `pass`   | Requirement satisfied by the team/entity as-is |
| `fail`   | Requirement is NOT met AND no coverage is in place — blocks `bid` |
| `n-a`    | Requirement does not apply to this specific call |
| `covered`| Requirement not natively met but covered by a named partner/entity; `eligibility_evidence` must be populated |
| `null`   | Not yet assessed — treated as blocking (same effect as `fail`) |

## Coverage Clause
A `covered` verdict requires populated `eligibility_evidence`: the name of the
covering entity, the applicable clause in the ToR, and (if available) a
reference to the teaming agreement or registration document. Without evidence,
`covered` is treated as `fail` by the gate.

## Lighthouse "Fit" Tag and Win Probability
The fit tag (`high fit` / `medium fit` / `low fit`) and the scorecard
win-probability are **context signals only**. They do not override or substitute
for any eligibility check. An RFP tagged `high fit` with an uncovered fail on
check 1 is still blocked.
