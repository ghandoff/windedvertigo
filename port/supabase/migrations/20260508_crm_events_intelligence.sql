-- Phase 1 of the conference intelligence pipeline.
-- See port/.brain/memory/ or /Users/garrettjaeger/.claude/plans/generic-popping-bubble.md
-- for the full plan. This migration adds:
--   1. Triage primitives (status + lifecycle, orthogonal)
--   2. AI fit scoring + provenance fields
--   3. Multi-deadline JSONB column
--   4. Cost fields (travel, sponsorship, actual rollup)
--   5. Post-event retro fields (outcome notes, contacts-met count, follow-up date)
--   6. ROI attribution: influenced_by_event_ids[] on rfp_opportunities + deals

-- ── triage + lifecycle (orthogonal) ────────────────────────────────────
-- status   = user intent (candidate / watch / attend / pursue / not_relevant)
-- lifecycle_state = event reality (upcoming / live / past / cancelled / postponed)
-- A row can be status='attend' AND lifecycle_state='cancelled' — preserves
-- intent history while flagging the event is dead.
alter table crm_events add column if not exists status text default 'watch';
alter table crm_events add column if not exists lifecycle_state text default 'upcoming';

-- ── AI scoring + triage notes ──────────────────────────────────────────
alter table crm_events add column if not exists fit_score text;            -- 'high fit' | 'medium fit' | 'low fit' | 'TBD'
alter table crm_events add column if not exists triage_notes text;
alter table crm_events add column if not exists triaged_at timestamptz;
alter table crm_events add column if not exists triaged_by text;

-- ── ownership + provenance ─────────────────────────────────────────────
alter table crm_events add column if not exists owner_user_id text;
alter table crm_events add column if not exists discovered_via text default 'manual';
                                                                            -- 'manual' | 'org-affiliated' | 'newsletter' | 'slack-paste' | 'broad-scout'
alter table crm_events add column if not exists discovered_at timestamptz default now();
alter table crm_events add column if not exists external_id text;           -- gmail msg id, RSS guid, etc.
alter table crm_events add column if not exists raw_payload_json jsonb;     -- audit + replay
alter table crm_events add column if not exists affiliated_org_id text;     -- for org-affiliated discovery

-- ── multi-deadline JSONB array ─────────────────────────────────────────
-- Real conferences have many deadlines. Existing single proposal_deadline
-- column stays for backcompat — new code reads from `deadlines` first and
-- falls back to proposal_deadline if empty.
-- Shape: [{kind: 'cfp_close' | 'abstract_revision' | 'early_bird' | 'hotel_block' | 'sponsorship_commitment' | 'registration' | 'other', date: 'YYYY-MM-DD', label: '...'}]
alter table crm_events add column if not exists deadlines jsonb default '[]'::jsonb;

-- ── cost fields ────────────────────────────────────────────────────────
alter table crm_events add column if not exists est_travel_cost numeric;
alter table crm_events add column if not exists sponsorship_fee numeric;
alter table crm_events add column if not exists actual_cost_total numeric;
alter table crm_events add column if not exists currency text default 'USD';

-- ── post-event retro ───────────────────────────────────────────────────
alter table crm_events add column if not exists outcome_notes text;
alter table crm_events add column if not exists contacts_met_count int;
alter table crm_events add column if not exists followup_due_by date;

-- ── indexes ────────────────────────────────────────────────────────────
create index if not exists crm_events_status_idx           on crm_events (status);
create index if not exists crm_events_lifecycle_idx        on crm_events (lifecycle_state);
create index if not exists crm_events_owner_idx            on crm_events (owner_user_id);
create index if not exists crm_events_affiliated_org_idx   on crm_events (affiliated_org_id);
create index if not exists crm_events_discovered_via_idx   on crm_events (discovered_via);

-- ── backfill: imminent deadlines → 'pursue', else 'watch' ──────────────
update crm_events
  set status = case
    when proposal_deadline is not null and proposal_deadline <= current_date + 60 then 'pursue'
    else 'watch'
  end
  where status is null or status = 'watch';

-- Set lifecycle_state from event_start so existing rows get a sensible default.
update crm_events
  set lifecycle_state = case
    when event_end is not null and event_end < current_date then 'past'
    when event_start is not null and event_start <= current_date and (event_end is null or event_end >= current_date) then 'live'
    else 'upcoming'
  end
  where lifecycle_state is null or lifecycle_state = 'upcoming';

-- ── ROI attribution columns on rfp_opportunities + deals ───────────────
alter table rfp_opportunities add column if not exists influenced_by_event_ids text[] default '{}';
alter table deals             add column if not exists influenced_by_event_ids text[] default '{}';

create index if not exists rfp_opp_influenced_events_idx on rfp_opportunities using gin(influenced_by_event_ids);
create index if not exists deals_influenced_events_idx   on deals             using gin(influenced_by_event_ids);
