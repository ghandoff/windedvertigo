# winded.vertigo invoice locations & workflow

*Maintained as a reference for any future invoicing work — Claude sessions don't persist memory across conversations, so this file is the source of truth.*

## Canonical client invoice folder structure

All client invoice files (.docx source + .pdf delivery) should be saved to the user's personal Drive under:

**`My Drive > admin > Finances > Invoices > [client name]`**

### Known client invoice folders

| Client | Drive folder URL | Drive folder ID |
|---|---|---|
| **Amna** | https://drive.google.com/drive/folders/1HqqvZKGpkoXnyImhU2ImueS918Bmv4ea | `1HqqvZKGpkoXnyImhU2ImueS918Bmv4ea` |

**Do not** save invoices to the shared drive (`winded.vertigo > clients > [client]/invoices`). The shared drive is for project deliverables and reference materials; invoices belong in the personal Drive Finances tree.

## Invoice naming convention

Format: `[ProjectShortName]_Invoice_[###]_[milestone]_winded.vertigo.[ext]`

Examples:
- `Amna_at_10_Invoice_001_signature_winded.vertigo.docx`
- `Amna_at_10_Invoice_002_inception_DRAFT_winded.vertigo.docx`
- `Amna_at_10_Invoice_003_finals_DRAFT_winded.vertigo.docx`

Use `DRAFT` suffix for invoices that aren't ready to issue (waiting on milestone gate). Remove the `DRAFT` when issued.

## Standard invoice elements (Clause 12-compliant)

Each invoice must include (per the Amna contract Clause 12, applies as a general standard):

- Deliverables completed
- Work performed
- Time allocation by team member (where applicable)
- Banking details for international wire transfer (Option A — on the invoice itself, not in email body)

## Banking details (winded.vertigo LLC)

For international wire transfer (UK / EU → US):

- **Beneficiary:** winded.vertigo LLC (trading as winded.vertigo collective)
- **Beneficiary address:** 6 Pueblo Dr, San Rafael, CA 94903, USA
- **Beneficiary bank:** JPMorgan Chase Bank, N.A.
- **Bank address:** P O Box 182051, Columbus, OH 43218-2051, USA
- **SWIFT / BIC:** CHASUS33
- **Account number:** 591023018
- **Account type:** Chase Business Complete Checking (USD)

These belong **on the invoice PDF only**, never in the email body — Business Email Compromise (BEC) hygiene.

## Entity details for invoice headers

- **Legal entity:** winded.vertigo LLC
- **Trade name:** winded.vertigo collective
- **CA Entity number:** 202461213744
- **EIN (US Tax ID):** 99-1874021
- **Principal address:** 6 Pueblo Dr, San Rafael, CA 94903, USA
- **Contact email:** garrett@windedvertigo.com

## Cover email workflow (for any client invoice)

1. Save invoice .docx + .pdf to the client's invoice folder in Drive
2. Create Gmail draft addressed to procurement/finance contact (cc project lead)
3. Reference contract clause + milestone gate
4. Mention payment terms (Net 30 typical)
5. Reference banking details "on the invoice itself" — do NOT include them inline
6. Offer to add a PO number if their procurement process requires one
7. Soft "valid and accepted" reply nudge to start Net 30 clock
8. Attach PDF manually before sending (Gmail API attachment workflow is brittle for ~70KB+ files)

## Amna-specific invoice schedule (£20,000 / £6K + £6K + £8K)

| # | Trigger | Amount | Reference clause |
|---|---|---|---|
| WV-AMNA-001 | Signature of the Agreement | £6,000 | Clause 12.1 |
| WV-AMNA-002 | Inception Note submitted + approved | £6,000 | Clause 12.2 |
| WV-AMNA-003 | Final deliverables submitted + approved | £8,000 | Clause 12.3 |

Payment terms: Net 30 from receipt of valid invoice. Up to 2 rounds of reasonable revisions per deliverable included in milestone 3.

## Amna contacts

- **Walaa Abu Zaiter** (Director of Operations, Risks and Security) — walaa@amna.org — primary procurement/finance contact
- **Hejer Dhahbi** (Monitoring & Evaluation Lead) — hejer@amna.org — project lead, cc on operational emails
- **Gabriella Brent** (CEO) — gabriella@amna.org
- **Jonelle Gyamfi** (procurement coordinator) — jonelle@amna.org
- **Natalia Kyrkopoulou** (Deputy CEO) — countersigned the Agreement on Amna's side

---

*Last updated: 26 June 2026 — initial setup during preparation of WV-AMNA-001 signature payment invoice.*
