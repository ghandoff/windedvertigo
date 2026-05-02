/**
 * PCS Database IDs and shared configuration.
 *
 * All 12 PCS databases in the Nordic research database system.
 * IDs are Notion database IDs (not collection IDs).
 */

export const PCS_DB = {
  documents:       process.env.NOTION_PCS_DOCUMENTS_DB,       // 44020402-bbbc-445d-830c-806d114e6d99
  versions:        process.env.NOTION_PCS_VERSIONS_DB,        // e334741f-fe58-44da-b300-2ec12fa21c05
  claims:          process.env.NOTION_PCS_CLAIMS_DB,           // 661ffecd-c3f1-4b68-b216-d068df38fa18
  evidenceLibrary: process.env.NOTION_PCS_EVIDENCE_DB,         // 5835efb6-7336-44b4-afd6-9fc49daaa6cb
  evidencePackets: process.env.NOTION_PCS_EVIDENCE_PACKETS_DB, // 5a528e36-a1ec-469f-bbfc-0b669756124d
  requests:        process.env.NOTION_PCS_REQUESTS_DB,         // 7589ebcd-cce8-4660-a66f-fbb0ffe75fe1
  revisionEvents:  process.env.NOTION_PCS_REVISION_EVENTS_DB,  // f5a40944-5f15-435b-bd9e-a4ff7889d7a5
  canonicalClaims: process.env.NOTION_PCS_CANONICAL_CLAIMS_DB,  // 02820f09-e165-4468-85a4-82f16f3a9e73
  formulaLines:    process.env.NOTION_PCS_FORMULA_LINES_DB,     // 1c2a69c0-a944-49c4-ac08-54a4f7ea2762
  references:      process.env.NOTION_PCS_REFERENCES_DB,        // 1aea8c6f-2064-427a-8b05-5d8d4085ae61
  schemaIntake:    process.env.NOTION_PCS_SCHEMA_INTAKE_DB,     // 315e4ee7-4ba4-8091-85da-c9cd783c772e
  wordingVariants: process.env.NOTION_PCS_WORDING_VARIANTS_DB,  // 986d92b3-90c5-45d9-b662-ecf67ac71374
  applicability:   process.env.NOTION_PCS_APPLICABILITY_DB,     // 36accc20-20a6-4650-bc7d-a2bd513f754d
  claimDoseReqs:   process.env.NOTION_PCS_CLAIM_DOSE_REQS_DB,   // 2e2c2196-33e9-4d78-b1cb-b8f57ce6cc35
  // Multi-profile architecture (Week 1) — added 2026-04-19
  prefixes:          process.env.NOTION_PCS_PREFIXES_DB,           // 3f14308c-9f72-4518-b8ea-5333f474454f
  benefitCategories: process.env.NOTION_PCS_BENEFIT_CATEGORIES_DB, // ef085893-6007-4c29-aeb8-69f303caaaef
  coreBenefits:      process.env.NOTION_PCS_CORE_BENEFITS_DB,      // 414ce653-dfad-42ec-b446-2eee762c41b9
  // Ingredients database (Phase 1) — added 2026-04-19
  ingredients:       process.env.NOTION_PCS_INGREDIENTS_DB,        // bfaef639-3335-4e67-a7fd-9b90a059ee20
  ingredientForms:   process.env.NOTION_PCS_INGREDIENT_FORMS_DB,   // 8345d1b4-1f2e-4d97-9349-4a8bc17df518
  // Batch import jobs (durable job queue) — added 2026-04-19
  importJobs:        process.env.NOTION_PCS_IMPORT_JOBS_DB,        // f13eb64b-cda5-471f-9082-98e0ae428b3d
  // Product Labels (Wave 5.0) — added 2026-04-21
  productLabels:     process.env.NOTION_PCS_PRODUCT_LABELS_DB,     // 9b84d651-c7b2-4680-bf04-30cb6c64acf2
  labelIntakeQueue:  process.env.NOTION_PCS_LABEL_INTAKE_QUEUE_DB, // 4f864bd2-7f91-449b-9b62-d0c4fb677b17
  // Wave 8 Phase A — versioning infra (added 2026-04-22)
  revisions:         process.env.NOTION_PCS_REVISIONS_DB,          // 3f865414-8431-493b-b1d1-2e988705b0b6
};

/** Valid enum values — shared between client dropdowns and server validation. */
export const CLAIM_STATUSES = ['Authorized', 'Proposed', 'Not approved', 'NA', 'Unknown'];
export const CLAIM_BUCKETS = ['3A', '3B', '3C'];
export const EVIDENCE_ROLES = ['structure-function', 'mechanistic', 'clinical', 'safety', 'bioavailability'];
export const EVIDENCE_TYPES = ['RCT', 'Meta-analysis', 'Systematic review', 'Observational', 'In vitro', 'Animal', 'Mechanistic', 'Review', 'Other'];
export const SQR_RISK_OF_BIAS = ['Low', 'Some concerns', 'High'];
export const REQUEST_STATUSES = ['New', 'Blocked', 'With RES', 'With RA', 'Done'];
// Wave 4.5.0 — Research Requests activation (added 2026-04-21)
export const REQUEST_TYPES = ['missing-field', 'low-confidence', 'template-drift', 'label-drift'];
export const REQUEST_ROLES = ['Research', 'RA', 'Template-owner'];
// Wave 5.2 — `Critical` added for unauthorized-claim + dose/ingredient drift.
export const REQUEST_PRIORITIES = ['Critical', 'Safety', 'High', 'Normal'];
export const REQUEST_SOURCES = ['auto-on-commit', 'nightly-sweep', 'drift-detection', 'manual'];

// SQR Applicability option vocabularies — must match Notion select options exactly.
// See src/lib/applicability.js for the scoring logic that consumes these.
export const DOSE_MATCH = ['Exact', 'Within 2x', 'Within 10x', 'Outside range', 'N/A'];
export const FORM_MATCH = ['Exact match', 'Bioavailability-equivalent', 'Same class different form', 'Different form', 'N/A'];
export const DURATION_MATCH = ['Adequate', 'Marginal', 'Insufficient', 'N/A'];
export const POPULATION_MATCH = ['Exact', 'Close', 'Different', 'N/A'];
export const OUTCOME_RELEVANCE = ['Direct', 'Validated surrogate', 'Indirect', 'N/A'];
export const STRUCTURAL_LIMITATIONS = [
  'Blinding infeasible',
  'Subjective primary outcome',
  'Surrogate endpoint',
  'Small effect size expected',
  'Healthy population ceiling',
  'Industry funded',
];
export const APPLICABILITY_RATINGS = ['High', 'Moderate', 'Low', 'Pending'];

// NutriGrade (Schwingshackl 2016 Adv Nutr 7:994) body-of-evidence options.
// Must match Notion select options exactly. Consumed by src/lib/nutrigrade.js.
export const HETEROGENEITY = ['Low', 'Moderate', 'High', 'Unknown'];
export const PUBLICATION_BIAS = ['Undetected', 'Suspected', 'Detected', 'Unknown'];
export const FUNDING_BIAS = ['Independent', 'Mixed', 'Industry', 'Unknown'];
export const PRECISION = ['Precise', 'Moderate', 'Imprecise', 'Unknown'];
export const EFFECT_SIZE_CATEGORIES = ['Large', 'Moderate', 'Small', 'Null', 'Unknown'];
export const DOSE_RESPONSE_GRADIENT = ['Present', 'Absent', 'Unclear'];
export const CERTAINTY_RATINGS = ['High', 'Moderate', 'Low', 'Very Low', 'Pending'];

// Wave 4.3.1 — Living PCS View confidence threshold. Evidence packets or
// classifier signals below this value render a `info` BackfillBadge.
export const BACKFILL_THRESHOLD = 0.7;

// Lauren's template option vocabularies — must match Notion select options exactly.
// Added 2026-04-18 as part of the PCS-template-alignment migration.
export const FORMATS = ['Softgel', 'Capsule', 'Gummy', 'Liquid', 'Powder', 'Tablet', 'Chewable', 'Other'];
export const DEMOGRAPHICS = [
  'Infants (0-12mo)', 'Children (1-3y)', 'Children (4-8y)', 'Children (9-13y)',
  'Adolescents (14-18y)', 'Adults (19-50y)', 'Adults (51+)', 'Pregnant/Lactating',
  'All ages',
];
export const AI_UNITS = ['mg', 'mcg', 'g', 'IU', 'CFU', 'billion CFU', '%'];
export const SUBSTANTIATION_TIERS = [
  'Table 4 (primary study)',
  'Table 5 (supporting doc)',
  'Table 6 (null result)',
  'Not shown',
];
export const APPROVER_DEPTS = ['Research (RES)', 'Regulatory Affairs (RA)'];

// Multi-profile architecture (Week 1) — added 2026-04-19
export const REGULATORY_TIERS = ['Structure-function', 'Nutritive support', 'Essentiality', 'Conditional', 'Mechanistic'];

// Ingredients database (Phase 1) — added 2026-04-19
// Canonicalizes the ingredient names previously denormalized as text/multi-select
// across Evidence Library, Formula Lines, and Claim Dose Requirements.
// AI_UNITS (defined above) is reused for Standard unit / FDA RDI unit.
export const AI_CATEGORIES = [
  'Vitamin', 'Mineral', 'Omega-3', 'Omega-6', 'Amino acid',
  'Herbal', 'Probiotic', 'Botanical extract', 'Enzyme', 'Other',
];

// Wave 7.0.5 T6 — Source as first-class attribute on AI Forms (added 2026-04-21).
// Gina's review: Nordic sells algae-based and lanolin-based options for vegans,
// so source is a primary filter for a meaningful portion of the product line.
export const SOURCE_TYPES = [
  'animal', 'marine-animal', 'algae', 'plant-extract',
  'synthetic', 'fermentation', 'mineral', 'lanolin',
];
// FDA Big 9 allergens (Food Allergy Safety, Treatment, Education, and Research Act
// of 2021). `none` is a sentinel indicating an affirmative no-allergen declaration.
export const FDA_ALLERGENS = [
  'milk', 'egg', 'fish', 'shellfish', 'tree-nuts',
  'peanuts', 'wheat', 'soy', 'sesame',
];

// Product Labels (Wave 5.0) — added 2026-04-21
// Label regulatory frameworks & lifecycle states. See docs/plans/wave-5-product-labels.md §2.
export const LABEL_REGULATORY_FRAMEWORKS = [
  'FDA (US)', 'Health Canada', 'EU EFSA', 'ANVISA (Brazil)', 'FSANZ (AU/NZ)', 'Other',
];
export const LABEL_STATUSES = ['Active', 'Discontinued', 'In Review', 'Needs Reprint', 'Needs Validation'];

// Wave 5.3 — Label Intake Queue worker state machine.
// Pending → Extracting → (Needs Validation | Committed | Failed). Cancelled is terminal-manual.
export const LABEL_INTAKE_STATUSES = ['Pending', 'Extracting', 'Needs Validation', 'Committed', 'Failed', 'Cancelled'];

/** Property name constants per database to avoid typos. */
export const PROPS = {
  documents: {
    pcsId: 'PCS ID',
    classification: 'Classification',
    fileStatus: 'File status',
    productStatus: 'Product status',
    transferStatus: 'Transfer status',
    documentNotes: 'Document notes',
    approvedDate: 'Approved/signed date',
    latestVersion: 'Latest Version',
    allVersions: 'All versions',
    // Lauren's template Table B (Applicable NN Products) — added 2026-04-18
    finishedGoodName: 'Finished Good Name',
    format: 'Format (FMT)',
    sapMaterialNo: 'SAP Material No.',
    skus: 'SKUs',
    archived: 'Archived',
    // Template-version classification — added 2026-04-21
    templateVersion: 'Template version',
    templateSignals: 'Template classification signals',
  },
  versions: {
    version: 'Version',
    pcsDocument: 'PCS Document',
    effectiveDate: 'Effective date',
    isLatest: 'Is latest',
    versionNotes: 'Version notes',
    supersedes: 'Supersedes',
    claims: 'Claims',
    formulaLines: 'Formula lines',
    references: 'PCS references',
    revisionEvents: 'Revision events',
    requests: 'Requests',
    latestVersionOf: 'Latest Version Of',
    // Lauren's template Table 1 (Product Details) + Table 2 footer — added 2026-04-18
    productName: 'Product Name',
    formatOverride: 'Format override',
    demographic: 'Demographic', // legacy flat multi-select — retained during Wave 4.1a transition; retired in 4.1b after backfill
    // Demographic axes (Wave 4.1a) — four orthogonal multi-selects replacing the flat `demographic` field.
    biologicalSex: 'Biological Sex',
    ageGroup: 'Age Group',
    lifeStage: 'Life Stage',
    lifestyle: 'Lifestyle',
    demographicBackfillReview: 'Demographic backfill review',
    dailyServingSize: 'Daily serving size',
    totalEPA: 'Total EPA (mg)',
    totalDHA: 'Total DHA (mg)',
    totalEPAandDHA: 'Total EPA+DHA (mg)',
    totalOmega6: 'Total Omega-6 (mg)',
    totalOmega9: 'Total Omega-9 (mg)',
  },
  claims: {
    claim: 'Claim',
    claimNo: 'Claim No',
    claimBucket: 'Claim bucket',
    claimStatus: 'Claim status',
    claimNotes: 'Claim notes',
    disclaimerRequired: 'Disclaimer required',
    minDoseMg: 'Min dose mg',
    maxDoseMg: 'Max dose mg',
    doseGuidanceNote: 'Dose guidance note',
    pcsVersion: 'PCS Version',
    canonicalClaim: 'Canonical Claim',
    evidencePacketLinks: 'Evidence packet links',
    wordingVariants: 'Wording Variants',
    // NutriGrade body-of-evidence fields (Phase 4 — added 2026-04-18)
    heterogeneity: 'Heterogeneity',
    publicationBias: 'Publication bias',
    fundingBias: 'Funding bias',
    precision: 'Precision',
    effectSizeCategory: 'Effect size category',
    doseResponseGradient: 'Dose-response gradient',
    certaintyScore: 'Certainty score',
    certaintyRating: 'Certainty rating',
    // Multi-profile architecture (Week 1) — added 2026-04-19
    claimPrefix: 'Claim prefix',
    coreBenefit: 'Core benefit',
    // Wave 4.5.5 — per-item extractor confidence persistence (added 2026-04-21)
    confidence: 'Confidence',
  },
  evidence: {
    name: 'Name',
    citation: 'Citation',
    doi: 'DOI',
    pmid: 'PMID',
    url: 'URL',
    evidenceType: 'Evidence type',
    ingredient: 'Ingredient',
    publicationYear: 'Publication year',
    canonicalSummary: 'Canonical research summary',
    pdf: 'PDF',
    endnoteGroup: 'EndNote Group',
    endnoteRecordId: 'EndNote Record ID',
    sqrScore: 'SQR-RCT score',
    sqrRiskOfBias: 'SQR-RCT risk of bias',
    sqrReviewed: 'SQR-RCT reviewed',
    sqrReviewDate: 'SQR-RCT review date',
    sqrReviewUrl: 'SQR-RCT review URL',
    usedInPackets: 'Used in evidence packets',
    pcsReferences: 'PCS references',
    // Canonical ingredient relation (Phase 1) — added 2026-04-19
    activeIngredientCanonical: 'Active Ingredient (canonical)',
    // Wave 5.4 — Ingredient safety cross-check signal fields (added 2026-04-21)
    safetySignal: 'Safety signal',
    safetyIngredient: 'Safety ingredient',
    safetyDoseThreshold: 'Safety dose threshold',
    safetyDoseUnit: 'Safety dose unit',
    safetyDemographicFilter: 'Safety demographic filter',
  },
  requests: {
    request: 'Request',
    status: 'Status',
    requestedBy: 'Requested by',
    requestNotes: 'Request notes',
    owner: 'Owner',
    pcsVersion: 'PCS Version',
    relatedClaims: 'Related Claims',
    raDue: 'RA due',
    raCompleted: 'RA completed',
    resDue: 'RES due',
    resCompleted: 'RES completed',
    // Wave 4.5.0 — Research Requests activation (added 2026-04-21).
    // The existing `owner` (person) is kept for backward compat; new auto-generated
    // requests populate `assignee` instead. See docs/plans/wave-4.5-extractor-validation.md.
    relatedPcs: 'Related PCS',
    requestType: 'Request type',
    specificField: 'Specific field / signal',
    assignedRole: 'Assigned role',
    assignee: 'Assignee',
    priority: 'Priority',
    openedDate: 'Opened date',
    lastPingedDate: 'Last pinged date',
    resolutionNote: 'Resolution note',
    source: 'Source',
  },
  revisionEvents: {
    event: 'Event',
    activityType: 'Activity type',
    responsibleDept: 'Responsible dept',
    responsibleIndividual: 'Responsible individual',
    startDate: 'Start date',
    endDate: 'End date',
    fromVersion: 'From version',
    toVersion: 'To version',
    fromVersionLinked: 'From version (linked)',
    toVersionLinked: 'To version (linked)',
    pcsVersion: 'PCS Version',
    eventNotes: 'Event notes',
    attachments: 'Attachments',
    // Lauren's template Table A dual-approval — added 2026-04-18
    approverAlias: 'Approver alias',
    approverDepartment: 'Approver department',
  },
  canonicalClaims: {
    canonicalClaim: 'Canonical claim',
    claimFamily: 'Claim family',
    evidenceTierRequired: 'Evidence tier required',
    minimumEvidenceItems: 'Minimum evidence items',
    notesGuardrails: 'Notes / guardrails',
    pcsClaimInstances: 'PCS claim instances',
    // Multi-profile architecture (Week 1) — added 2026-04-19
    claimPrefix: 'Claim prefix',
    coreBenefit: 'Core benefit',
    // CAIPB import — added 2026-04-19
    activeIngredient: 'Active ingredient',       // relation → Active Ingredients
    benefitCategory: 'Benefit category',          // relation → Benefit Categories
    sourceCaipbRowId: 'Source CAIPB Row ID',      // number — audit trail
    // Wave 7.0.5 T2 — dose-sensitivity-aware canonical identity (added 2026-04-21)
    canonicalKey: 'Canonical key',                // rich_text — deterministic identity hash
    doseSensitivityApplied: 'Dose sensitivity applied', // select — which rule was used
    // Wave 8 Phase C1 — operator-visible curation state for the
    // canonical-claim dedupe backlog. Options: keep-survivor, retire-into-other,
    // archive, actually-different, needs-more-info.
    dedupeDecision: 'Dedupe decision',
  },
  formulaLines: {
    ingredientForm: 'Ingredient / AI form', // legacy title; still present for backward compat
    pcsVersion: 'PCS Version',
    ingredientSource: 'Ingredient source',
    elementalAI: 'Elemental AI',
    elementalAmountMg: 'Elemental amount (mg)',
    ratioNote: 'Ratio note',
    servingBasisNote: 'Serving basis note',
    formulaNotes: 'Formula notes',
    // Lauren's template Table 2 (Product Composition) decomposition — added 2026-04-18
    ai: 'AI',
    aiForm: 'AI Form',
    fmPlm: 'FM PLM #',
    amountPerServing: 'Amount per serving',
    amountUnit: 'Amount unit',
    percentDailyValue: 'Percent Daily Value',
    // Canonical ingredient relations (Phase 1) — added 2026-04-19
    activeIngredientCanonical: 'Active Ingredient (canonical)',
    activeIngredientFormCanonical: 'Active Ingredient Form (canonical)',
    // Wave 4.5.5 — per-item extractor confidence persistence (added 2026-04-21)
    confidence: 'Confidence',
  },
  references: {
    name: 'Name',
    pcsReferenceLabel: 'PCS reference label',
    referenceTextAsWritten: 'Reference text (as written)',
    referenceNotes: 'Reference notes',
    pcsVersion: 'PCS Version',
    evidenceItem: 'Evidence Item',
  },
  evidencePackets: {
    name: 'Name',
    pcsClaim: 'PCS Claim',
    evidenceItem: 'Evidence Item',
    evidenceRole: 'Evidence role',
    meetsSqrThreshold: 'Meets SQR-RCT threshold',
    relevanceNote: 'Relevance note',
    sortOrder: 'Sort order',
    // Lauren's template Tables 4/5/6 narrative fields — added 2026-04-18
    substantiationTier: 'Substantiation tier',
    studyDoseAI: 'Study dose AI',
    studyDoseAmount: 'Study dose amount',
    studyDoseUnit: 'Study dose unit',
    nullResultRationale: 'Null result rationale',
    keyTakeaway: 'Key takeaway',
    studyDesignSummary: 'Study design summary',
    sampleSize: 'Sample size (N)',
    positiveResults: 'Positive results',
    neutralResults: 'Neutral results',
    negativeResults: 'Negative results',
    potentialBiases: 'Potential biases',
    // Wave 4.5.5 — per-item extractor confidence persistence (added 2026-04-21)
    confidence: 'Confidence',
  },
  wordingVariants: {
    wording: 'Wording',
    pcsClaim: 'PCS Claim',
    isPrimary: 'Is primary',
    variantNotes: 'Variant notes',
  },
  applicability: {
    name: 'Name',
    evidenceItem: 'Evidence Item',
    pcsClaim: 'PCS Claim',
    doseMatch: 'Dose match',
    formMatch: 'Form/matrix match',
    durationMatch: 'Duration match',
    populationMatch: 'Population match',
    outcomeRelevance: 'Outcome relevance',
    structuralLimitations: 'Structural limitations',
    applicabilityScore: 'Applicability score',
    applicabilityRating: 'Applicability rating',
    notes: 'Notes',
    assessor: 'Assessor',
    assessmentDate: 'Assessment date',
  },
  claimDoseReqs: {
    requirement: 'Requirement',
    pcsClaim: 'PCS Claim',
    activeIngredient: 'Active Ingredient',
    aiForm: 'AI Form',
    amount: 'Amount',
    unit: 'Unit',
    combinationGroup: 'Combination group',
    notes: 'Notes',
    // Canonical ingredient relation (Phase 1) — added 2026-04-19
    activeIngredientCanonical: 'Active Ingredient (canonical)',
  },
  // Multi-profile architecture (Week 1) — added 2026-04-19
  prefixes: {
    prefix: 'Prefix',
    regulatoryTier: 'Regulatory tier',
    displayOrder: 'Display order',
    notes: 'Notes',
    // CAIPB cleanup + Gina's schema refinements — added 2026-04-19
    evidenceType: 'Evidence type',           // clinical_rct | mechanistic | essential_nutrient | qualified | not_applicable
    qualificationLevel: 'Qualification level', // fully_supported | dose_qualified | deprecated | not_applicable
    // Wave 7.0.5 T1 — added 2026-04-21. Drives canonical-claim identity hashing.
    // Values: dose_gated | dose_agnostic | dose_qualified | not_applicable
    doseSensitivity: 'Dose sensitivity',
  },
  benefitCategories: {
    name: 'Name',
    parentCategory: 'Parent category',
    displayOrder: 'Display order',
    icon: 'Icon',
    notes: 'Notes',
  },
  coreBenefits: {
    coreBenefit: 'Core benefit',
    benefitCategory: 'Benefit category',
    notes: 'Notes',
    pcsClaimInstances: 'PCS claim instances',
  },
  // Ingredients database (Phase 1) — added 2026-04-19
  ingredients: {
    canonicalName: 'Canonical name',
    synonyms: 'Synonyms',
    category: 'Category',
    standardUnit: 'Standard unit',
    fdaRdi: 'FDA RDI',
    fdaRdiUnit: 'FDA RDI unit',
    regulatoryCeiling: 'Regulatory ceiling',
    bioavailabilityNotes: 'Bioavailability notes',
    interactionCautions: 'Interaction cautions',
    notes: 'Notes',
    forms: 'Forms', // dual-relation back from Active Ingredient Forms
  },
  ingredientForms: {
    formName: 'Form name',
    activeIngredient: 'Active Ingredient',
    synonyms: 'Synonyms',
    bioavailabilityNote: 'Bioavailability note',
    strainIdentifier: 'Strain identifier',
    source: 'Source', // legacy free-text; superseded by sourceType below (Wave 7.0.5 T6)
    isDefault: 'Is default',
    formulaLines: 'Formula lines', // dual-relation back from Formula Lines
    // Wave 7.0.5 T6 — first-class source/diet attributes (added 2026-04-21)
    sourceType: 'Source type',
    veganCompatible: 'Vegan compatible',
    kosher: 'Kosher',
    halal: 'Halal',
    glutenFree: 'Gluten free',
    allergens: 'Allergens',
  },
  // Batch import jobs (durable job queue) — added 2026-04-19
  importJobs: {
    jobId: 'Job ID',
    status: 'Status',
    pdfUrl: 'PDF URL',
    pdfFilename: 'PDF Filename',
    pcsId: 'PCS ID',
    existingDocId: 'Existing Doc ID',
    conflictAction: 'Conflict action',
    extractedData: 'Extracted data',
    createdDocumentId: 'Created document ID',
    resultCounts: 'Result counts',
    warnings: 'Warnings',
    error: 'Error',
    retryCount: 'Retry count',
    batchId: 'Batch ID',
    ownerEmail: 'Owner email',
    contentHash: 'Content hash',
    promptVersion: 'Prompt version',
    notificationSent: 'Notification sent',
    diffReport: 'Diff report',
  },
  // Product Labels (Wave 5.0) — added 2026-04-21. See docs/plans/wave-5-product-labels.md §2.
  productLabels: {
    sku: 'SKU',
    upc: 'UPC',
    productNameAsMarketed: 'Product Name (as-marketed)',
    labelImage: 'Label Image',
    labelVersionDate: 'Label Version Date',
    regulatoryFramework: 'Regulatory Framework',
    markets: 'Market(s)',
    approvedClaimsOnLabel: 'Approved Claims (on label)',
    ingredientList: 'Ingredient List (as printed)',
    ingredientDoses: 'Ingredient Doses',
    dvCompliance: 'DV% Compliance',
    pcsDocument: 'PCS Document',
    linkedEvidence: 'Linked Evidence',
    status: 'Status',
    lastDriftCheck: 'Last Drift Check',
    driftFindings: 'Drift Findings',
    owner: 'Owner',
    notes: 'Notes',
  },
  // Label Intake Queue (Wave 5.0 staging) — added 2026-04-21.
  // Wave 5.3 added worker-state fields (Status, Content Hash, Extraction Data,
  // Error, Retry Count, Prompt Version, Batch ID, Confidence Overall, Owner Email)
  // so the permanent /pcs/admin/labels/imports UI + cron worker can drive rows
  // through Pending → Extracting → (Needs Validation | Committed | Failed).
  labelIntakeQueue: {
    sku: 'SKU',
    pcsId: 'PCS ID',
    productName: 'Product Name',
    labelFile: 'Label File',
    dateReceived: 'Date Received',
    market: 'Market',
    regulatory: 'Regulatory',
    ingested: 'Ingested?',
    ingestedLabel: 'Ingested Label',
    notes: 'Notes',
    // Wave 5.3 additions:
    status: 'Status',
    contentHash: 'Content Hash',
    extractionData: 'Extraction Data',
    error: 'Error',
    retryCount: 'Retry Count',
    promptVersion: 'Prompt Version',
    batchId: 'Batch ID',
    confidenceOverall: 'Confidence Overall',
    ownerEmail: 'Owner Email',
  },
  schemaIntake: {
    name: 'Name',
    respondentEmail: 'Respondent Email',
    role: 'Role',
    digitizeFirst: 'Digitize first',
    startFrom: 'Start from',
    versionsTreatedAs: 'Versions treated as',
    evidenceReuse: 'Evidence reuse',
    weeklyOutputs: 'Weekly outputs',
    thirtyDayWin: '30-day win',
    biggestTimeSink: 'Biggest time sink',
  },
  // Wave 8 Phase A — PCS Revisions (mutation audit + revert). Added 2026-04-22.
  revisions: {
    title: 'Title',                // auto-generated label
    timestamp: 'Timestamp',        // UTC write time
    actorEmail: 'Actor email',
    actorRoles: 'Actor roles',     // multi_select snapshot
    entityType: 'Entity type',     // select
    entityId: 'Entity id',         // rich_text (Notion page id)
    entityTitle: 'Entity title',   // rich_text (denormalized label)
    fieldPath: 'Field path',       // rich_text — dotted path
    beforeValue: 'Before value',   // rich_text JSON (truncated to 1950)
    afterValue: 'After value',     // rich_text JSON (truncated to 1950)
    reason: 'Reason',              // rich_text (optional)
    revertedAt: 'Reverted at',     // date (null unless reverted)
    revertedBy: 'Reverted by',     // email (null unless reverted)
    revertOfRevision: 'Revert of revision', // rich_text (id of revision this undoes)
  },
};

/**
 * Wave 8 Phase A — canonical entity-type identifiers for the PCS Revisions
 * log. Keep these stable; they appear in select-option strings in Notion
 * and in API payloads. Adding a new entity type requires also adding a
 * Notion select option to the PCS Revisions DB.
 */
export const REVISION_ENTITY_TYPES = Object.freeze({
  CANONICAL_CLAIM: 'canonical_claim',
  PCS_DOCUMENT: 'pcs_document',
  CLAIM: 'claim',
  EVIDENCE_PACKET: 'evidence_packet',
  FORMULA_LINE: 'formula_line',
  CLAIM_PREFIX: 'claim_prefix',
  ACTIVE_INGREDIENT: 'active_ingredient',
  ACTIVE_INGREDIENT_FORM: 'active_ingredient_form',
  REVIEWER: 'reviewer',
});

/** Synthetic actor email used when mutations originate from cron / workflow runs. */
export const SYSTEM_ACTOR_EMAIL = 'system@nordic-sqr-rct';
