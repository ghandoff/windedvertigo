import { Client } from '@notionhq/client';

const _notion = new Client({
  auth: process.env.NOTION_TOKEN,
  timeoutMs: 30000,
});

/**
 * Retry wrapper with exponential backoff + jitter
 * Retries on 429 (rate limit) and 5xx (server errors)
 * Notion rate limit: 3 requests/sec per integration token
 */
async function withRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const status = error?.status || error?.code;
      const isRetryable = status === 429 || (status >= 500 && status < 600);
      if (!isRetryable || attempt === maxRetries) throw error;
      // Exponential backoff: 1s, 2s, 4s (capped at 10s) + random jitter
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      const jitter = Math.random() * 500;
      await new Promise(r => setTimeout(r, delay + jitter));
    }
  }
}

// Wrap all Notion SDK methods with automatic retry on transient errors
const notion = {
  databases: {
    query: (...args) => withRetry(() => _notion.databases.query(...args)),
  },
  pages: {
    create: (...args) => withRetry(() => _notion.pages.create(...args)),
    retrieve: (...args) => withRetry(() => _notion.pages.retrieve(...args)),
    update: (...args) => withRetry(() => _notion.pages.update(...args)),
  },
};

const REVIEWER_DB = process.env.NOTION_REVIEWER_DB;
const INTAKE_DB = process.env.NOTION_INTAKE_DB;
const SCORES_DB = process.env.NOTION_SCORES_DB;

export async function getReviewerByAlias(alias) {
  const res = await notion.databases.query({
    database_id: REVIEWER_DB,
    filter: { property: 'Alias', rich_text: { equals: alias } },
  });
  return res.results[0] || null;
}

export async function createReviewer(data) {
  return notion.pages.create({
    parent: { database_id: REVIEWER_DB },
    properties: {
      'First Name': { title: [{ text: { content: data.firstName } }] },
      'Last Name (Surname)': { rich_text: [{ text: { content: data.lastName } }] },
      'Email': { email: data.email },
      'Affiliation': { rich_text: [{ text: { content: data.affiliation || '' } }] },
      'Alias': { rich_text: [{ text: { content: data.alias } }] },
      'Password': { rich_text: [{ text: { content: data.password } }] },
      'Discipline/Specialty': { rich_text: [{ text: { content: data.discipline || '' } }] },
      'Consent': { checkbox: data.consent === true },
      'Onboarding Date': { date: { start: new Date().toISOString().split('T')[0] } },
    },
  });
}

export async function getReviewerById(pageId) {
  const page = await notion.pages.retrieve({ page_id: pageId });
  return parseReviewerPage(page);
}

export async function getAllReviewers() {
  const res = await notion.databases.query({
    database_id: REVIEWER_DB,
    filter: { property: 'Consent', checkbox: { equals: true } },
    sorts: [{ property: 'First Name', direction: 'ascending' }],
  });
  return res.results.map(parseReviewerPage);
}

function parseReviewerPage(page) {
  const p = page.properties;
  const profileImageUrl = extractRichText(p['Profile Image']) || null;
  return {
    id: page.id,
    firstName: extractTitle(p['First Name']),
    lastName: extractRichText(p['Last Name (Surname)']),
    email: p['Email']?.email || '',
    affiliation: extractRichText(p['Affiliation']),
    affiliationType: p['Affiliation Type']?.select?.name || '',
    alias: extractRichText(p['Alias']),
    password: extractRichText(p['Password']),
    discipline: extractRichText(p['Discipline/Specialty']),
    domainExpertise: (p['Domain expertise']?.multi_select || []).map(s => s.name),
    yearsExperience: p['Years of Experience']?.number || null,
    consent: p['Consent']?.checkbox || false,
    trainingCompleted: p['Training Completed']?.checkbox || false,
    isAdmin: p['Admin']?.checkbox || false,
    onboardingDate: p['Onboarding Date']?.date?.start || null,
    profileImageUrl,
  };
}

export async function getAllStudies() {
  const res = await notion.databases.query({
    database_id: INTAKE_DB,
    sorts: [{ property: 'Year', direction: 'descending' }],
  });
  return res.results.map(parseIntakePage);
}

export async function getStudyById(pageId) {
  const page = await notion.pages.retrieve({ page_id: pageId });
  return parseIntakePage(page);
}

export async function createStudy(data) {
  const properties = {
    'Citation': { title: [{ text: { content: data.citation } }] },
    'DOI': { url: data.doi || null },
    'Year': { number: data.year ? Number(data.year) : null },
    'Journal': { rich_text: [{ text: { content: data.journal || '' } }] },
    'Purpose of Research': { rich_text: [{ text: { content: data.purposeOfResearch || '' } }] },
    'Study Design': { rich_text: [{ text: { content: data.studyDesign || '' } }] },
    'Funding Source(s)': { rich_text: [{ text: { content: data.fundingSources || '' } }] },
    'Inclusion Criteria': { rich_text: [{ text: { content: data.inclusionCriteria || '' } }] },
    'Exclusion Criteria': { rich_text: [{ text: { content: data.exclusionCriteria || '' } }] },
    'Recruitment': { rich_text: [{ text: { content: data.recruitment || '' } }] },
    'Initial N': { number: data.initialN ? Number(data.initialN) : null },
    'Ages (group means)': { rich_text: [{ text: { content: data.ages || '' } }] },
    'Female Participants': { number: data.femaleParticipants ? Number(data.femaleParticipants) : null },
    'Male Participants': { number: data.maleParticipants ? Number(data.maleParticipants) : null },
    'Final N': { number: data.finalN ? Number(data.finalN) : null },
    'Location of Study (Country)': { rich_text: [{ text: { content: data.locationCountry || '' } }] },
    'Location of Study (City)': { rich_text: [{ text: { content: data.locationCity || '' } }] },
    'Timing of Measures': { rich_text: [{ text: { content: data.timingOfMeasures || '' } }] },
    'Independent Variables': { rich_text: [{ text: { content: data.independentVariables || '' } }] },
    'Dependent Variables': { rich_text: [{ text: { content: data.dependentVariables || '' } }] },
    'Control Variables': { rich_text: [{ text: { content: data.controlVariables || '' } }] },
    'Key Results': { rich_text: [{ text: { content: data.keyResults || '' } }] },
    'Other Results': { rich_text: [{ text: { content: data.otherResults || '' } }] },
    'Statistical Methods': { rich_text: [{ text: { content: data.statisticalMethods || '' } }] },
    'Missing Data Handling': { rich_text: [{ text: { content: data.missingDataHandling || '' } }] },
    'Authors\' Conclusion': { rich_text: [{ text: { content: data.authorsConclusion || '' } }] },
    'Strengths': { rich_text: [{ text: { content: data.strengths || '' } }] },
    'Limitations': { rich_text: [{ text: { content: data.limitations || '' } }] },
    'Potential Biases': { rich_text: [{ text: { content: data.potentialBiases || '' } }] },
    'Submitted by Alias': { rich_text: [{ text: { content: data.submittedByAlias || '' } }] },
  };
  if (data.blinding) {
    properties['Blinding'] = { select: { name: data.blinding } };
  }
  if (data.aPrioriPower) {
    properties['A Priori Power Estimation'] = { select: { name: data.aPrioriPower } };
  }
  return notion.pages.create({ parent: { database_id: INTAKE_DB }, properties });
}

function parseIntakePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    citation: extractTitle(p['Citation']),
    doi: p['DOI']?.url || '',
    year: p['Year']?.number || null,
    journal: extractRichText(p['Journal']),
    purposeOfResearch: extractRichText(p['Purpose of Research']),
    studyDesign: extractRichText(p['Study Design']),
    fundingSources: extractRichText(p['Funding Source(s)']),
    inclusionCriteria: extractRichText(p['Inclusion Criteria']),
    exclusionCriteria: extractRichText(p['Exclusion Criteria']),
    recruitment: extractRichText(p['Recruitment']),
    blinding: p['Blinding']?.select?.name || '',
    initialN: p['Initial N']?.number || null,
    ages: extractRichText(p['Ages (group means)']),
    femaleParticipants: p['Female Participants']?.number || null,
    maleParticipants: p['Male Participants']?.number || null,
    finalN: p['Final N']?.number || null,
    aPrioriPower: p['A Priori Power Estimation']?.select?.name || '',
    locationCountry: extractRichText(p['Location of Study (Country)']),
    locationCity: extractRichText(p['Location of Study (City)']),
    timingOfMeasures: extractRichText(p['Timing of Measures']),
    independentVariables: extractRichText(p['Independent Variables']),
    dependentVariables: extractRichText(p['Dependent Variables']),
    controlVariables: extractRichText(p['Control Variables']),
    keyResults: extractRichText(p['Key Results']),
    otherResults: extractRichText(p['Other Results']),
    statisticalMethods: extractRichText(p['Statistical Methods']),
    missingDataHandling: extractRichText(p['Missing Data Handling']),
    authorsConclusion: extractRichText(p['Authors\' Conclusion']),
    strengths: extractRichText(p['Strengths']),
    limitations: extractRichText(p['Limitations']),
    potentialBiases: extractRichText(p['Potential Biases']),
    submittedByAlias: extractRichText(p['Submitted by Alias']),
    createdTime: page.created_time,
  };
}

export async function getScoresForStudy(studyPageId) {
  const res = await notion.databases.query({
    database_id: SCORES_DB,
    filter: { property: 'Study', relation: { contains: studyPageId } },
    sorts: [{ property: 'Timestamp', direction: 'descending' }],
  });
  return res.results.map(parseScorePage);
}

export async function getScoresByReviewer(reviewerAlias) {
  const res = await notion.databases.query({
    database_id: SCORES_DB,
    filter: { property: 'Rater Alias', select: { equals: reviewerAlias } },
    sorts: [{ property: 'Timestamp', direction: 'descending' }],
  });
  return res.results.map(parseScorePage);
}

export async function getAllScores() {
  let allResults = [];
  let cursor = undefined;
  do {
    const res = await notion.databases.query({
      database_id: SCORES_DB,
      start_cursor: cursor,
      sorts: [{ property: 'Timestamp', direction: 'descending' }],
    });
    allResults = allResults.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return allResults.map(parseScorePage);
}

export async function createScore(data) {
  const properties = {
    'Score ID': { title: [{ text: { content: data.scoreId || `SCR-${Date.now()}` } }] },
    'Q1 Research Question': { select: { name: data.q1 } },
    'Q2 Randomization': { select: { name: data.q2 } },
    'Q3 Blinding': { select: { name: data.q3 } },
    'Q4 Sample Size': { select: { name: data.q4 } },
    'Q5 Baseline Characteristics': { select: { name: data.q5 } },
    'Q6 Participant Flow': { select: { name: data.q6 } },
    'Q7 Intervention Description': { select: { name: data.q7 } },
    'Q8 Outcome Measurement': { select: { name: data.q8 } },
    'Q9 Statistical Analysis': { select: { name: data.q9 } },
    'Q10 Bias Assessment': { select: { name: data.q10 } },
    'Q11 Applicability': { select: { name: data.q11 } },
    'Rater Alias': { select: { name: data.raterAlias } },
    'Notes': { rich_text: [{ text: { content: data.notes || '' } }] },
    'Rubric version': { select: { name: data.rubricVersion || 'V2' } },
    'Timestamp': { date: { start: new Date().toISOString() } },
  };
  if (data.studyId) {
    properties['Study'] = { relation: [{ id: data.studyId }] };
  }
  if (data.reviewerId) {
    properties['Reviewer'] = { relation: [{ id: data.reviewerId }] };
  }
  if (data.timeToComplete) {
    properties['Time to Complete (minutes)'] = { number: Number(data.timeToComplete) };
  }
  return notion.pages.create({ parent: { database_id: SCORES_DB }, properties });
}

function parseScorePage(page) {
  const p = page.properties;
  const extractScore = (val) => {
    const name = val?.select?.name || '';
    const match = name.match(/^(\d)/);
    return match ? Number(match[1]) : null;
  };
  return {
    id: page.id,
    scoreId: extractTitle(p['Score ID']),
    studyRelation: (p['Study']?.relation || []).map(r => r.id),
    reviewerRelation: (p['Reviewer']?.relation || []).map(r => r.id),
    raterAlias: p['Rater Alias']?.select?.name || '',
    q1: extractScore(p['Q1 Research Question']),
    q2: extractScore(p['Q2 Randomization']),
    q3: extractScore(p['Q3 Blinding']),
    q4: extractScore(p['Q4 Sample Size']),
    q5: extractScore(p['Q5 Baseline Characteristics']),
    q6: extractScore(p['Q6 Participant Flow']),
    q7: extractScore(p['Q7 Intervention Description']),
    q8: extractScore(p['Q8 Outcome Measurement']),
    q9: extractScore(p['Q9 Statistical Analysis']),
    q10: extractScore(p['Q10 Bias Assessment']),
    q11: extractScore(p['Q11 Applicability']),
    q1Raw: p['Q1 Research Question']?.select?.name || '',
    q2Raw: p['Q2 Randomization']?.select?.name || '',
    q3Raw: p['Q3 Blinding']?.select?.name || '',
    q4Raw: p['Q4 Sample Size']?.select?.name || '',
    q5Raw: p['Q5 Baseline Characteristics']?.select?.name || '',
    q6Raw: p['Q6 Participant Flow']?.select?.name || '',
    q7Raw: p['Q7 Intervention Description']?.select?.name || '',
    q8Raw: p['Q8 Outcome Measurement']?.select?.name || '',
    q9Raw: p['Q9 Statistical Analysis']?.select?.name || '',
    q10Raw: p['Q10 Bias Assessment']?.select?.name || '',
    q11Raw: p['Q11 Applicability']?.select?.name || '',
    rubricVersion: p['Rubric version']?.select?.name || '',
    notes: extractRichText(p['Notes']),
    timestamp: p['Timestamp']?.date?.start || page.created_time,
    timeToComplete: p['Time to Complete (minutes)']?.number || null,
    createdTime: page.created_time,
  };
}

// Get all intake entries submitted by a specific reviewer alias
export async function getIntakesByReviewerAlias(alias) {
  const res = await notion.databases.query({
    database_id: INTAKE_DB,
    filter: { property: 'Submitted by Alias', rich_text: { equals: alias } },
    sorts: [{ property: 'Year', direction: 'descending' }],
  });
  return res.results.map(parseIntakePage);
}

// Get a reviewer's intake for a specific DOI
export async function getIntakeByReviewerAndDoi(alias, doi) {
  const res = await notion.databases.query({
    database_id: INTAKE_DB,
    filter: {
      and: [
        { property: 'Submitted by Alias', rich_text: { equals: alias } },
        { property: 'DOI', url: { equals: doi } },
      ],
    },
  });
  return res.results[0] ? parseIntakePage(res.results[0]) : null;
}

// Get a single score by page ID
export async function getScoreById(scoreId) {
  const page = await notion.pages.retrieve({ page_id: scoreId });
  return parseScorePage(page);
}

// Update reviewer password (for hash migration and password changes)
export async function updateReviewerPassword(reviewerId, hashedPassword) {
  return notion.pages.update({
    page_id: reviewerId,
    properties: {
      'Password': { rich_text: [{ text: { content: hashedPassword } }] },
    },
  });
}

// Update reviewer properties (admin, status, etc.)
export async function updateReviewerProperties(reviewerId, updates) {
  const properties = {};
  if (updates.isAdmin !== undefined) {
    properties['Admin'] = { checkbox: updates.isAdmin };
  }
  if (updates.status !== undefined) {
    properties['Status'] = { select: { name: updates.status } };
  }
  return notion.pages.update({
    page_id: reviewerId,
    properties,
  });
}

// Update reviewer profile fields (self-service)
export async function updateReviewerProfile(reviewerId, updates) {
  const properties = {};
  if (updates.firstName !== undefined) {
    properties['First Name'] = { title: [{ text: { content: updates.firstName } }] };
  }
  if (updates.lastName !== undefined) {
    properties['Last Name (Surname)'] = { rich_text: [{ text: { content: updates.lastName } }] };
  }
  if (updates.affiliation !== undefined) {
    properties['Affiliation'] = { rich_text: [{ text: { content: updates.affiliation } }] };
  }
  if (updates.discipline !== undefined) {
    properties['Discipline/Specialty'] = { rich_text: [{ text: { content: updates.discipline } }] };
  }
  if (updates.yearsExperience !== undefined) {
    properties['Years of Experience'] = { number: updates.yearsExperience ? Number(updates.yearsExperience) : null };
  }
  if (updates.profileImageUrl !== undefined) {
    properties['Profile Image'] = updates.profileImageUrl
      ? { rich_text: [{ text: { content: updates.profileImageUrl } }] }
      : { rich_text: [] };
  }

  return notion.pages.update({ page_id: reviewerId, properties });
}

// Get all reviewers without consent filter (for admin management)
export async function getAllReviewersAdmin() {
  const res = await notion.databases.query({
    database_id: REVIEWER_DB,
    sorts: [{ property: 'First Name', direction: 'ascending' }],
  });
  return res.results.map(parseReviewerPage);
}

function extractTitle(prop) {
  return prop?.title?.[0]?.plain_text || '';
}

function extractRichText(prop) {
  return (prop?.rich_text || []).map(t => t.plain_text).join('');
}
