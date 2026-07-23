-- 0002_seed_amna_at_10.sql — 9 rows from the notion verification queue (2026-06-26).
-- aggregate evaluation excerpts only — NO participant-level / special-category data.
-- apply with: npm run db:seed  (step 4, needs approval — review seed.json first).

insert into claims (claim_text, conjecture_ref, source_file, location, coder_a_excerpt, coder_b_excerpt, carl_excerpt, agreement, status, notes) values

-- 1 · triple-verified decisive sustainability quote
('sustainability (decisive)', 'sustainability', 'UVA Baytna evaluation', 'exec summary pt 7, p.5',
 '…none of the organizations were able to sustain their Baytna program beyond the pilot.',
 '…none of the organizations were able to sustain their Baytna program beyond the pilot.',
 '…none of the organizations were able to sustain their Baytna program beyond the pilot.',
 'agree', 'pending', 'triple-verified (a + b + carl direct read).'),

-- 2 · corroborating quote, found by b only
('sustainability (corroborating)', 'sustainability', 'UVA Baytna evaluation', 'p.105',
 null,
 'All of them closed their Baytna programs in August 2022… organizations went back to how they were operating before…',
 null,
 'partial', 'pending', 'corroborating quote surfaced by coder b only; a/carl did not extract.'),

-- 3 · funding dependence (a approximate, b exact)
('funding-dependence', 'sustainability', 'Nexus CP Afghanistan', '§3.5.2',
 '…the majority of survey partner staff still admit they are (currently) very reliant upon Amna funding (Figure 17).',
 '…the majority of survey partner staff still admit they are (currently) very reliant upon Amna funding (Figure 17).',
 null,
 'agree', 'pending', 'coder a approximate (~), b exact location.'),

-- 4 · ⚠ counter-evidence — a and b disagree → must be adjudicated
('sustainability (counter-evidence)', 'sustainability', 'Chapin Hall Ukraine', '§5.1, p.62',
 null,
 '…genuine solidarity and reciprocal learning that was facilitated by us, but not dependent on us.',
 null,
 'disagree', 'flagged', 'a=✗, b=✓. blind second coder caught positive framing — needs a ruling.'),

-- 5 · funding challenge
('funding challenge', 'sustainability', 'Chapin Hall Afghanistan', 'p.36',
 'All the partner organisations mentioned funding as a significant challenge for ongoing work…',
 'All the partner organisations mentioned funding as a significant challenge for ongoing work…',
 null,
 'agree', 'pending', null),

-- 6 · change chain
('change chain', 'change-chain', 'Nexus CP Afghanistan', 'exec summary',
 '…improved emotional regulation, greater self-awareness, and stronger interpersonal relationships… reconnect with a sense of agency…',
 '…improved emotional regulation, greater self-awareness, and stronger interpersonal relationships… reconnect with a sense of agency…',
 null,
 'agree', 'pending', null),

-- 7 · change chain (full)
('change chain (full)', 'change-chain', 'Chapin Hall Ukraine', 'conclusion, p.ix',
 '…development of safe spaces and the creation of joy… a re-emergence of a sense of who people are… allow them to connect with others.',
 '…development of safe spaces and the creation of joy… a re-emergence of a sense of who people are… allow them to connect with others.',
 null,
 'agree', 'pending', null),

-- 8 · training quality (triple-confirmed)
('training quality', 'training-quality', 'UVA Baytna evaluation', 'exec summary pt 3, p.4',
 'Amna is excellent at training… within a few months the Amna was able to train and support most facilitators to effectively deliver Baytna programming.',
 'Amna is excellent at training… within a few months the Amna was able to train and support most facilitators to effectively deliver Baytna programming.',
 'Amna is excellent at training… within a few months the Amna was able to train and support most facilitators to effectively deliver Baytna programming.',
 'agree', 'pending', 'a + b + carl.'),

-- 9 · ⚠ not-found — both coders agree the claim is absent; do not attribute
('sustainability (J&L) — not found', 'sustainability', 'UVA J&L Phase 1 Preview', 'whole 3-page brief',
 null,
 null,
 null,
 'agree', 'flagged', 'a=✗, b=✗: no organisational-sustainability statement in this brief. do NOT attribute one. confirm in full CPP Phase 1 Evaluation Report.pdf if needed.');

-- mirror each seed row into the audit trail
insert into audit_log (claim_id, action, to_status, reviewer, note)
  select id, 'seed', status, null, 'seeded from notion verification queue 2026-06-26' from claims;
