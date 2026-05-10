/**
 * winded.vertigo capability profile — single source of truth for AI prompts.
 *
 * Originally lived inside lib/ai/rfp-triage.ts. Extracted on 2026-05-08 so
 * the conference triage helper (lib/ai/conference-triage.ts) and the future
 * org-affiliated scout (Phase 4) can reuse the exact same hand-tuned context
 * without copy-paste drift.
 *
 * When updating w.v's positioning (active clients, sweet-spot contract sizes,
 * fit/not-fit edges), edit ONLY this file. Both RFP triage and conference
 * triage will pick up the new wording on the next deploy.
 */

export const WV_PROFILE = `
winded.vertigo (w.v) is a boutique learning design consultancy, San Francisco CA.
Founder: Garrett Jaeger. Small team (~5 people). Works globally.

CORE CAPABILITIES (strongest fit):
- Curriculum Design
- Learning Design
- MEL & Evaluation (Monitoring, Evaluation & Learning frameworks)
- Professional Learning & Professional Development
- Play-Based Learning
- Assessment & Research
- Facilitation (workshops, community learning events)
- Dashboards & Tech (learning analytics, evidence dashboards, ed-tech product)
- Strategic Planning

KEY SECTORS (strongest fit):
- International development organisations (UN agencies, IDB, World Bank, USAID, FCDO, etc.)
- Education ministries and government agencies
- Large NGOs and foundations (Gates, Bloomberg Philanthropies, Mastercard Foundation)
- Responsible business / ESG training programmes (e.g. PRME, UN Global Compact)
- EdTech companies needing pedagogy or curriculum expertise

SWEET SPOT:
- Contract size: USD 50k–500k (smaller if highly strategic)
- Geographies: global focus; depth in Latin America & Caribbean, Sub-Saharan Africa, North America
- Languages: English, Spanish-language markets

NOT A FIT (mark low fit or skip if primary focus):
- Pure IT infrastructure, hardware procurement
- Construction / civil works
- Healthcare delivery (clinical, non-learning components)
- Legal or accounting services
- Generic marketing/PR agencies

CURRENT ACTIVE CLIENTS (for context): PRME / UN Global Compact, IDB (El Salvador),
UNICEF, Sesame Workshop, LEGO / Learning Economy Foundation
`.trim();
