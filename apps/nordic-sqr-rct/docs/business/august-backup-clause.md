# Named Backup Contractor Clause — Draft

**Status:** DRAFT. Awaiting user-supplied details (full name, business entity, vendor access matrix). Once those land, this upgrades from draft to ready-for-attorney.
**Intended location:** Inserted into `retainer-and-buyout-proposal.md` as new subsection under §3 (Proposed retainer structure), and referenced from §6 (SLA specifics → Availability windows).
**Author:** Garrett Jaeger (Winded Vertigo)
**Date:** 2026-04-30

---

## Drafting goal

The current retainer proposal limits "named-backup" coverage to the Dedicated tier ($9,000/mo) only. Nordic's biggest single-vendor risk in this engagement is **Garrett's bus factor** (sole consultant, regulated-data platform, institutional knowledge concentrated in one head). Promoting named-backup to *all tiers* closes that risk for a fraction of Dedicated-tier cost and gives Nordic real on-call continuity.

The named backup is **August** [LAST NAME PENDING], a contractor August already retains for vacation, illness, and travel coverage on Winded Vertigo client work.

---

## Proposed clause text (insert into §3)

> ### Named backup contractor
>
> Every tier of this retainer (Standard, Priority, Dedicated) includes a named backup contractor — currently **August [LAST NAME]** — who provides secondary on-call coverage during Garrett's planned absences (vacation > 3 days), unplanned absences (illness, emergency), or sustained unreachability (international travel without reliable connectivity).
>
> **Coverage scope.** August acknowledges and triages P1/P2 incidents within the tier's stated SLA when Garrett is unreachable. Resolution may extend beyond Garrett's normal SLA window when work-product depth (deep platform changes, security forensics, novel LLM debugging) genuinely requires Garrett's return. August's role is to keep Nordic informed, contain damage, and execute well-documented runbook procedures — not to substitute for Garrett's full skill surface.
>
> **Access provisioning.** August maintains a named contractor account with read-write access to the Nordic technology stack: Vercel, Cloudflare, Supabase, Notion (workspace member), and Anthropic (org member). All access is provisioned under a contractor-of-Winded-Vertigo agreement, not a direct Nordic-issued account. Audit logs distinguish Garrett's actions from August's.
>
> **Billing.** August's hours bill against the retainer's monthly hour pool at the same effective rate. There is no separate Nordic-facing invoice line for August. Garrett pays August directly out of retainer revenue and represents to Nordic that this arrangement does not increase Nordic's effective cost per hour of coverage.
>
> **Vacation notification.** Garrett gives Nordic ≥ 2 weeks' notice for absences > 3 days, identifies August (or named successor — see below) as the on-call contact for the absence window, and communicates the contact channel (Slack handle, email, phone for P1).
>
> **Successor clause.** If August becomes unavailable (declines coverage, ends contractor relationship with Winded Vertigo, or suffers his own absence), Garrett identifies a replacement named-backup with **30 calendar days' notice** to Nordic. Nordic acknowledges in writing (email is sufficient). The replacement provisions equivalent vendor access before the new arrangement takes effect.
>
> **Mutual non-solicitation.** Nordic agrees not to engage August directly outside the Winded Vertigo retainer for the term of the contract + 12 months post-termination. August is bound to the same generic non-reverse-engineering norms as Garrett (§4) for any code, prompt, or schema he touches under the retainer.

---

## Proposed addition to §6 (Availability windows)

Replace this line in §6:

> Vacation coverage: Garrett provides 2 weeks' notice for absences > 3 days, designates backup contact (or reduced-SLA hold) during those windows

With:

> Vacation coverage: Garrett provides ≥ 2 weeks' notice for absences > 3 days. Coverage is provided by August [LAST NAME], the named backup contractor (see §3 → Named backup contractor). Reduced-SLA hold applies *only* when both Garrett and the named backup are simultaneously unavailable, in which case Nordic receives advance written notice and a return-to-SLA date estimate.

---

## Proposed addition to §3 → Tiered SLA options table

Update the rightmost column for all three tiers:

| Tier | Monthly hours | Approx fee | Backup |
|---|---|---|---|
| Standard | 8 h included | $4,000 / mo | Named backup (§3 → Named backup contractor) |
| Priority | 16 h included | $6,000 / mo | Named backup |
| Dedicated | 24 h included | $9,000 / mo | Named backup + 1-hr P1 SLA |

(Previously: Dedicated tier carried "named-backup" as a distinguishing feature. With this clause, all three tiers include a named backup; Dedicated still differs by hour count and SLA aggressiveness.)

---

## TODO before this draft becomes attorney-ready

1. **August's full legal name.** [PENDING — Garrett to supply.]
2. **August's business entity.** Sole proprietor? LLC? S-Corp? Affects how the contractor-of-Winded-Vertigo agreement is structured. [PENDING.]
3. **Vendor access status today.** Which of the 5 vendor surfaces (Vercel / Cloudflare / Supabase / Notion / Anthropic) does August already have provisioned for Winded Vertigo's other client work? Provisioning new accounts for Nordic-only access takes calendar time; we should know the current baseline. [PENDING.]
4. **Existing contractor agreement between Winded Vertigo and August.** Does it already cover Nordic-bound work, or does it need an amendment? [PENDING.]
5. **August's awareness and consent.** Has August been told about Nordic specifically, the regulated-data nature of the platform, and the on-call expectations? [PENDING — Garrett to confirm.]
6. **Insurance.** Is August covered by his own E&O / Cyber Liability policy, or does he need to be added as an additional insured on Winded Vertigo's policy? Affects §2 of the breach-liability analysis. [PENDING — review with attorney.]

---

## Rollback / "what if August declines or is unsuitable"

The clause is structured so that **the named backup is identified by role, not by name**:

> Named backup contractor — currently **August [LAST NAME]** — ...

If August declines the role at signature time, replace "August [LAST NAME]" with "[REPLACEMENT NAME]" everywhere in the proposal and re-circulate. The §3 "Successor clause" handles mid-contract substitution.

If no named backup is identifiable at all, the fallback is:
- Drop the clause entirely.
- Restore §6's original "designates backup contact (or reduced-SLA hold)" language.
- Standard and Priority tiers lose the differentiator; Dedicated tier still has named-backup as advertised.

This degrades Nordic's confidence but does not break the proposal.
