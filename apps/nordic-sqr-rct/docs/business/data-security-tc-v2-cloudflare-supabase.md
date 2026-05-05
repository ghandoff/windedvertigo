# Nordic Naturals Research Platform — Data Security Terms & Conditions v2

**Subject:** Updated data-security posture for the PCS / AICS platform
**Substrate change:** Notion-primary → Cloudflare Workers + Supabase Postgres
**Document author:** Garrett Jaeger, Winded Vertigo LLC (platform builder + Data Protection Lead)
**Recipient:** Sharon Matheny (Nordic Research VP) for forwarding to Nordic Naturals IT
**Effective date:** Upon Nordic countersignature
**Supersedes:** Data Security T&C v1 (Notion-primary, dated 2025-XX-XX)

---

## 1. Executive summary — three plain sentences

1. The platform is migrating its primary data store from Notion to a Cloudflare Workers + Supabase Postgres stack. PCS substantiation documents, claim records, and per-claim audit trails will live in Postgres with row-level security; static substantiation files (the source `.docx` and rendered `.pdf` exports) will live in Cloudflare R2 with object-lock.
2. **The new stack is measurably more secure for Nordic's specific use case** — per-claim audit, per-property access control, immutable substantiation files — because it can enforce controls that Notion structurally cannot (Notion supports row-level page permissions but no column-level access control).
3. The platform-vendor risk (vendor breach, vendor outage) is **roughly lateral**: both Notion and the new stack hold SOC 2 Type 2; both had 2025 AI-agent prompt-injection issues to address. The net security improvement comes from controls Nordic gains under the new architecture, conditional on the operational commitments in §5 of this document.

If your IT team agrees with the framing, the substantive sign-off is on §5 (the five operational commitments that make the improvement real).

---

## 2. What data lives where, after migration

| Data class | Where it lives | Encryption | Access model |
|---|---|---|---|
| **PCS / AICS substantiation records** (claims, evidence links, dose tables, regulatory metadata) | Supabase Postgres (`wv-nordic` project, US West region) | AES-256 at rest, TLS 1.2+ in transit | Postgres Row-Level Security (RLS), required on every table; per-column `GRANT` for read-only views |
| **Per-claim audit trail** (every change with who/when/before/after) | Supabase Postgres (`pcs_revisions` + `claim_migration_log`) | Same as above | Append-only via `INSERT`-only `GRANT`; `pgaudit` extension records SQL-level activity |
| **Source substantiation files** (`.docx` Lauren and Gina upload; PDF exports) | Cloudflare R2 (`nordic-substantiation-2026` bucket) | AES-256 at rest, TLS 1.2+ in transit | Default-private, signed URLs only, object-lock on the substantiation bucket |
| **Reviewer registry** (Nordic researchers + reviewer accounts; emails, bcrypt-hashed passwords, role assignments) | Notion (transitional through 2026) → Supabase Postgres (Phase N3, Q3 2026) | Notion AES-256 / Supabase AES-256 | Notion: workspace member + page permission. Supabase: RLS + role grants. |
| **AI / LLM prompts and responses** (claim extraction, substantiation drafts) | Anthropic API (Claude); Cloudflare AI Gateway for caching + cost telemetry | TLS in transit; ephemeral processing | Zero data retention configured on AI Gateway; Anthropic ZDR-by-default for the org |
| **Build artifacts, secrets** | Vercel (env vars), Cloudflare Workers (secret bindings) | Encrypted at rest | RBAC via Vercel Team / Cloudflare account roles |

No PHI is processed on this platform. PII is limited to Nordic researcher names, work emails, and role assignments — no resident addresses, no government IDs, no payment data.

---

## 3. Cloudflare 2025 incident review — what Nordic IT should know

Three Cloudflare incidents in 2025 are material to this T&C. **None compromised stored customer data on Cloudflare Workers, D1, KV, or R2**, which are the products our platform uses.

- **August 12-17, 2025 — Salesloft / Drift supply-chain breach.** A threat actor abused the Salesloft Drift / Salesforce integration and exfiltrated data from Cloudflare's *Salesforce* tenant — sales/support contact records and 104 API tokens from Cloudflare's customer-relationship pipeline. Cloudflare's production network and customer data planes were not touched. Cloudflare rotated tokens and notified affected customers within 48 hours of confirmation. ([Cloudflare blog](https://blog.cloudflare.com/response-to-salesloft-drift-incident/))
- **R2 outages, February 6 and March 21, 2025.** Both were operational, not security: an over-broad abuse-remediation action and a credential mis-deploy. R2 was unavailable for ~59 minutes in February. **No data loss or corruption.** Cloudflare added validation and credential-scoping safeguards in the published postmortems. ([Feb 6 postmortem](https://blog.cloudflare.com/cloudflare-incident-on-february-6-2025/), [Mar 21 postmortem](https://blog.cloudflare.com/cloudflare-incident-march-21-2025/))
- **November 18, 2025 — global proxy outage.** A Bot Management config file generated duplicate rows, breached memory limits, and crashed Cloudflare's FL/FL2 proxy for ~3 hours. Workers KV and Access were impaired because they front-run through the same proxy. **Not a security incident; no data exposure.** Cloudflare's postmortem flags insufficient kill switches and tight coupling of control planes as the architectural lessons. ([Cloudflare postmortem](https://blog.cloudflare.com/18-november-2025-outage/))

The prior Cloudflare security event was the [Thanksgiving 2023 Atlassian incident](https://blog.cloudflare.com/thanksgiving-2023-security-incident/) — credentials missed in the Okta-2023 rotation; CrowdStrike-confirmed no customer data impact.

**Net interpretation for Nordic:** Cloudflare's 2025 record is "high-availability risk, low data-confidentiality risk." A regulated supplement company should plan for outage recovery (read-only fallback, exported snapshots — see §5.5), not for breach assumptions on Cloudflare-stored data.

---

## 4. Supabase security posture — and the one gotcha

| Control | Status |
|---|---|
| SOC 2 Type 2 | Yes, audited and renewed annually ([docs](https://supabase.com/docs/guides/security/soc-2-compliance)) |
| HIPAA BAA | Available on Team / Enterprise (not relevant to Nordic — no PHI — but signals data-handling rigor) |
| GDPR / PIPEDA | Standard DPA available; Supabase signs as processor with the customer as controller ([DPA](https://supabase.com/legal/dpa)) |
| Encryption at rest | AES-256 for database files + backups |
| Encryption in transit | TLS 1.2+ |
| Application-layer secrets | `Vault` extension (authenticated encryption) |
| Audit logging | `pgaudit` for SQL activity; Auth audit logs automatic ([docs](https://supabase.com/docs/guides/database/extensions/pgaudit)) |
| Row-Level Security | Available, **opt-in per table** — see below |
| Reported incidents 2024-2026 | Two notable misuse-failure patterns; no platform-side breaches |

**The one gotcha — RLS is opt-in, not on by default.** This is the source of the largest Supabase security failure pattern of 2024-2025:

- **CVE-2025-48757** and a wave of public-database leaks driven by missing RLS policies, particularly in AI-generated apps using Supabase under the hood. Researchers found 13,000+ user-record leaks across 170+ apps with that root cause. ([byteiota writeup](https://byteiota.com/supabase-security-flaw-170-apps-exposed-by-missing-rls/))
- **MCP "lethal trifecta" (July 2025):** an LLM agent with the `service_role` key bypasses RLS entirely; a hidden instruction in a support ticket can exfiltrate any table. ([Simon Willison](https://simonwillison.net/2025/Jul/6/supabase-mcp-lethal-trifecta/))

**Both are misuse failures, not Supabase platform breaches.** They are also the two failure modes this T&C explicitly forbids in §5.

For comparison, Notion's analogous 2025 issue was the [Notion 3.0 AI Agent prompt-injection class](https://simonwillison.net/2025/Sep/19/notion-lethal-trifecta/) — same lethal-trifecta shape, hidden instructions in a PDF exfiltrate workspace data. The vendor-vendor risk on AI-agent injection is therefore lateral; the operational defense is the same on either substrate (don't wire LLM agents with full read access against production).

---

## 5. Five operational commitments — the substance of the sign-off

These five commitments are what *make* the new stack measurably more secure. Without them, the migration is a lateral move; with them, it materially exceeds Notion-primary's enforceable controls.

### 5.1. RLS required on every Supabase table

Every table in the `wv-nordic` Supabase project must have Row-Level Security enabled at table-creation time. A pre-merge CI check enforces this:

```sql
-- runs in CI on every PR that touches db/migrations/*.sql
SELECT relname FROM pg_class
WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace
  AND NOT relrowsecurity;
-- expected: zero rows
```

If any table is added without RLS, the build fails. Existing platform tables (`pcs_revisions`, `aics_claims`, `claim_migration_log`, etc.) get RLS retrofit in the next deploy following Nordic's countersignature.

### 5.2. The `service_role` key never reaches client code or LLM tools

The Supabase `service_role` key bypasses RLS entirely — that is the vector behind the largest 2025 misuse failures. The platform commits:

- `service_role` is bound only to Cloudflare Worker secret bindings on server-side handlers.
- `service_role` is never bound to a Worker that takes raw user input as an LLM tool argument.
- `service_role` is never copied into a `.env` file that ships in any browser bundle, mobile build, or AI agent runtime.
- All client-side code uses the `anon` key plus a verified JWT bound to the authenticated user.

### 5.3. No MCP / AI-agent tools wired to production data

The 2025 MCP "lethal trifecta" pattern — LLM agent + service-role access + untrusted instructions in user-supplied data — is the highest-impact misuse failure currently observed in the Supabase ecosystem. The platform commits to no MCP servers, agent tools, or any LLM with tool-use enabled having direct access to production Postgres or production R2. AI features that *need* database access do so through narrow, capability-gated REST endpoints (the same endpoints the human UI uses), never through an MCP-style tool descriptor.

### 5.4. R2 default-private + signed URLs + object-lock on substantiation

- All R2 buckets are default-private.
- Substantiation files (`.docx` uploads, PDF exports) are served only via signed URLs with a maximum 24-hour TTL.
- The substantiation bucket has Cloudflare R2 object-lock enabled in compliance mode for any file the platform marks as `final`. This means RA-approved AICS documents cannot be deleted or overwritten — even by the platform's own service credentials — until the configured retention period elapses. Nordic IT can audit the lock status of any object via the R2 dashboard.

### 5.5. Off-platform daily snapshot

The November 18, 2025 Cloudflare outage is the cautionary architecture tale: a single-vendor configuration error took down ~20% of the public internet for 3 hours. To preserve Nordic's research data continuity:

- A daily `pg_dump` of the Supabase database is captured to a separate cloud provider's storage (proposed: AWS S3 in us-west-2, Glacier Instant Retrieval for cost). Retention: 30 days rolling.
- A weekly R2 manifest export (file inventory + checksums, not the file contents) is stored alongside.
- Both snapshots are encrypted with a key held only by Garrett and a named-backup contractor (currently TBD per the August-Backup-Clause draft). Nordic can request a snapshot recovery rehearsal once per quarter.

---

## 6. Comparison table — Notion-primary vs Cloudflare + Supabase

| Concern | Notion-primary (current) | Cloudflare + Supabase (post-migration) |
|---|---|---|
| Per-claim audit trail | Workspace audit log (Enterprise tier) — coarse, no SQL access | `pgaudit` + app-level `pcs_revisions` table — fine-grained, queryable, replicable |
| Per-property access control | **Not supported** — once a reviewer can see a row, they see every property | Postgres RLS + column privileges — supported and enforceable |
| Substantiation document immutability | Page versions, soft delete | R2 object-lock + Postgres append-only revision tables |
| Encryption at rest | AES-256, opaque | AES-256, customer-controllable via `Vault` extension + key management |
| Encryption in transit | TLS 1.2+ | TLS 1.2+ |
| SOC 2 / ISO certifications | SOC 2 Type 2; ISO 27001/27017/27018/27701 | SOC 2 Type 2 (Cloudflare + Supabase both); ISO 27001 (Cloudflare) |
| Operational risk (availability) | Notion outages are short, infrequent | Cloudflare had a 3-hr Nov 2025 global event; mitigated by §5.5 off-platform snapshots |
| Vendor-side breach risk (1H 2025) | None | None on stored data; Salesforce-tenant supply-chain incident (contact data only) |
| Misuse risk surface | Workspace sharing mistakes; AI Agent injection | Missing RLS, leaked `service_role`, MCP/agent injection — all forbidden by §5 |
| Sub-processor transparency | [Notion Trust Center](https://trustcenter.notion.com/) | [Cloudflare Trust Hub](https://www.cloudflare.com/trust-hub/) + [Supabase status](https://status.supabase.com/) |
| Data residency | Notion offers EU residency on Enterprise; US-only at Nordic's tier | Supabase customer-selectable region (US West for `wv-nordic`); Cloudflare anycast |

**Where Cloudflare + Supabase materially exceeds Notion:** per-property access control, audit trail granularity, substantiation file immutability, customer-controlled encryption keys, vendor-published incident postmortems within days.

**Where the stacks are roughly equivalent:** SOC 2 / ISO certification depth, encryption strength, AI-agent prompt-injection surface area.

**Where Notion is simpler / better:** workspace-sharing UX (Notion: native; new stack: app-level only), end-user click-to-edit (Notion: native; new stack: built-in via Living-PCS UI but app-level), no operational responsibility for the customer (Notion: SaaS; new stack: Garrett owns the operational commitments in §5).

---

## 7. Sub-processor authorization

Under this T&C, **Winded Vertigo LLC (Garrett Jaeger) acts as Nordic's data processor** for the platform. The following are explicitly authorized **sub-processors** with back-to-back DPA terms, per GDPR Article 28(2) and (4):

| Sub-processor | Role | DPA | Scope of data |
|---|---|---|---|
| Cloudflare, Inc. | Edge compute (Workers), object storage (R2), CDN, AI Gateway | [Cloudflare Customer DPA](https://www.cloudflare.com/cloudflare-customer-dpa/) | All categories in §2 except the reviewer registry while it remains on Notion |
| Supabase, Inc. | Postgres database, authentication backend (forward-looking), pgaudit logs | [Supabase DPA](https://supabase.com/legal/dpa) | PCS / AICS substantiation records + per-claim audit trail |
| Vercel, Inc. | Front-end hosting, environment-variable secrets vault | [Vercel DPA](https://vercel.com/legal/dpa) | Build artifacts and encrypted secrets only; no Nordic substantiation data |
| Anthropic, PBC | LLM inference (Claude API) for claim extraction and AICS draft generation | [Anthropic Commercial Terms](https://www.anthropic.com/legal/commercial-terms) — Zero Data Retention configured for the org | Ephemeral processing of claim text; ZDR means no training and no retention beyond the synchronous response |
| Notion Labs, Inc. | Reviewer registry until Phase N3 cutover | [Notion DPA](https://www.notion.com/legal/data-processing-agreement) | Reviewer names, work emails, bcrypt-hashed passwords, role assignments |
| AWS, Inc. (off-platform snapshot) | S3 Glacier Instant Retrieval — encrypted daily Postgres snapshot per §5.5 | [AWS DPA](https://aws.amazon.com/agreement/) | Encrypted dumps only; key not held by AWS |

If any sub-processor is added or replaced, Nordic is notified at least 14 days in advance with a description of the change and the option to object before activation.

---

## 8. Incident response chain — Garrett's commitments

The August 2025 Cloudflare/Salesloft event is the cautionary tale for notification chain design: the notification flowed Salesloft → Cloudflare → customers in days, not hours. To minimize Nordic's exposure window:

- **48-hour vendor-incident forwarding.** When Garrett receives a security-relevant notification from any sub-processor in §7, Nordic IT (named contact: TBD) is notified within 48 hours, with a description of scope and remediation status.
- **24-hour Garrett-side incident notification.** If Garrett detects or is informed of a security event affecting Nordic data on the platform itself (account compromise, data leak, RLS bypass, etc.), Nordic IT is notified within 24 hours.
- **Quarterly sub-processor register review.** Garrett publishes a current sub-processor register every quarter; Nordic reviews and counter-signs.
- **Annual penetration test.** Recommended scope: capability-gated API endpoints, RLS effectiveness on `wv-nordic`, R2 object-lock enforcement. Performed by a third party Nordic IT approves; results shared within 30 days of completion.

---

## 9. Role of Garrett Jaeger / Winded Vertigo LLC

The previous Notion-T&C framed Garrett as Nordic's **Data Protection Officer (DPO)**. With the migration, this T&C updates the title to **Data Protection Lead** for two reasons:

1. **Strict GDPR Article 37 DPO requirements likely don't apply** to Nordic for this dataset (no large-scale special-category processing, no systematic monitoring of EU data subjects). The "DPO" title was doing operational and contractual work, not statutory work.
2. **Architecture changed.** In the Notion model, Notion was Nordic's processor and Garrett was effectively a *user* of Nordic's tenant. In the new model, **Garrett (Winded Vertigo LLC) is Nordic's processor**, and the entities in §7 are sub-processors. The "Lead" framing accurately reflects this without triggering Art. 37 expectations Nordic doesn't actually need.

**Operational responsibilities under "Data Protection Lead" are unchanged:**

- Single point of contact for Nordic IT on platform security questions
- Author and maintainer of this T&C
- Custodian of platform credentials and key rotation schedule
- Incident response lead per §8
- Owner of the August-Backup-Clause continuity arrangement (named-backup contractor, separate document)

If Nordic later appoints a real DPO under Article 37, the contractual framing here continues to hold — Nordic's DPO oversees Garrett-as-processor under the existing chain.

---

## 10. Sign-off

| Party | Name | Role | Signature | Date |
|---|---|---|---|---|
| Nordic Naturals (data controller) | Sharon Matheny (initial reviewer) → forwarded to: Nordic IT named contact | Research VP / IT Director | _____________________ | __________ |
| Winded Vertigo LLC (data processor) | Garrett Jaeger | Data Protection Lead | _____________________ | __________ |

Effective date is the date both parties sign. This T&C v2 supersedes T&C v1 (Notion-primary). The platform migration commitments in §5 take effect on the next deploy following countersignature.

---

## Appendix — sources

- [Cloudflare response to Salesloft Drift incident, Aug 2025](https://blog.cloudflare.com/response-to-salesloft-drift-incident/)
- [Cloudflare R2 incident postmortem, Feb 6 2025](https://blog.cloudflare.com/cloudflare-incident-on-february-6-2025/)
- [Cloudflare R2 incident postmortem, Mar 21 2025](https://blog.cloudflare.com/cloudflare-incident-march-21-2025/)
- [Cloudflare Nov 18 2025 outage postmortem](https://blog.cloudflare.com/18-november-2025-outage/)
- [Cloudflare Thanksgiving 2023 security incident](https://blog.cloudflare.com/thanksgiving-2023-security-incident/)
- [Supabase SOC 2 docs](https://supabase.com/docs/guides/security/soc-2-compliance)
- [Supabase HIPAA docs](https://supabase.com/docs/guides/security/hipaa-compliance)
- [Supabase security overview](https://supabase.com/security)
- [Supabase pgaudit](https://supabase.com/docs/guides/database/extensions/pgaudit)
- [Supabase DPA](https://supabase.com/legal/dpa)
- [Supabase MCP lethal-trifecta writeup (Willison)](https://simonwillison.net/2025/Jul/6/supabase-mcp-lethal-trifecta/)
- [byteiota — Supabase RLS missing-policy leak](https://byteiota.com/supabase-security-flaw-170-apps-exposed-by-missing-rls/)
- [Notion security](https://www.notion.com/security)
- [Notion Trust Center](https://trustcenter.notion.com/)
- [Notion granular database permissions guide (Frank)](https://thomasjfrank.com/notion-granular-database-permissions-guide/)
- [Cloudflare Customer DPA](https://www.cloudflare.com/cloudflare-customer-dpa/)
- [Vercel DPA](https://vercel.com/legal/dpa)
- [Anthropic Commercial Terms](https://www.anthropic.com/legal/commercial-terms)

— End of T&C v2 —
