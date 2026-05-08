-- Seed collective_cv from TEAM_BIOS (port/lib/ai/proposal-generator.ts).
--
-- Idempotent: ON CONFLICT DO NOTHING so re-running this migration after a
-- member has already verified their CV (last_verified_at populated) won't
-- clobber that state. To update a bio, edit the bio + run an explicit UPDATE.

INSERT INTO collective_cv (member_email, member_name, bio, expires_after_days)
VALUES
  (
    'garrett@windedvertigo.com',
    'Garrett',
    'Garrett Jaeger is the Principal of winded.vertigo and leads all client engagements. He has over ten years of experience in learning design, monitoring and evaluation, and curriculum development for international development organisations including the UN Global Compact (PRME), Inter-American Development Bank, UNICEF, and multiple foundations. His work spans competency-based curriculum design, MEL framework development, evidence synthesis, and the design of professional learning systems for teachers and practitioners. He holds deep expertise in Global South contexts, with active projects in Latin America, Sub-Saharan Africa, and South Asia. Garrett leads all technical proposals and serves as principal investigator on evaluation engagements.',
    90
  ),
  (
    'lamis@windedvertigo.com',
    'Lamis',
    'Lamis Sabra is a facilitation designer and train-the-trainer specialist at winded.vertigo. She designs and delivers participatory learning experiences, professional development workshops, and facilitator certification programmes. Her work focuses on building facilitation capacity in organisations and education systems, designing scalable train-the-trainer architectures, and supporting teams to embed reflective practice. She has delivered workshops across multiple continents and is fluent in Arabic and English.',
    90
  ),
  (
    'jamie@windedvertigo.com',
    'James',
    'James Galpin is a curriculum developer and instructional writer at winded.vertigo. He specialises in learning materials development, instructional sequencing, and the production of educator-facing resources. He works across formal and non-formal education contexts, with particular expertise in competency-based progressions and evidence-aligned curriculum frameworks.',
    90
  ),
  (
    'maria@windedvertigo.com',
    'Maria',
    'Maria Altamirano Gonzalez is the Practitioner and Cultural Appropriateness Lead at winded.vertigo, and contributes to every engagement the collective takes on. Her core role is ensuring that everything w.v designs — frameworks, curricula, tools, training programmes — is genuinely appropriate for the practitioners and communities it serves: not just technically sound, but contextually grounded, culturally resonant, and usable in the real conditions of the people receiving it. She reviews all programme design through this lens, and her input is a quality gate for every deliverable. She also manages project operations, stakeholder coordination, and the logistical dimensions of complex multi-stakeholder engagements. She is the primary point of contact for IDB procurements and El Salvador-related engagements, and has managed the operational complexity of multi-country development bank programmes. She is fluent in Spanish and English.',
    90
  ),
  (
    'payton@windedvertigo.com',
    'Payton',
    'Payton Jaeger leads visual communication, tone strategy, and stakeholder messaging for winded.vertigo. Her work shapes how w.v''s expertise reaches the people it needs to reach — from the visual language and design of training materials and impact reports, to the tonal calibration of proposals, stakeholder briefs, and external communications. She ensures that everything w.v produces communicates clearly and compellingly to its intended audience: the right level of formality, the right visual register, the right narrative frame for funders, partners, and programme staff. In client engagements, Payton contributes substantively to materials design and stakeholder communications strategy, treating visual and tonal quality as programme variables with real consequences for buy-in, adoption, and impact. She also leads on local partner identification and network development, and manages w.v''s brand presence and outreach pipeline.',
    90
  )
ON CONFLICT (member_email) DO NOTHING;
