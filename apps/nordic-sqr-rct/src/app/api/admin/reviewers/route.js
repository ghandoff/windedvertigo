import { authenticateRequest, verifyAdminFromNotion } from '@/lib/auth';
import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const REVIEWER_DB = process.env.NOTION_REVIEWER_DB;
const SCORES_DB = process.env.NOTION_SCORES_DB;

function extractTitle(prop) {
  return prop?.title?.[0]?.plain_text || '';
}

function extractRichText(prop) {
  return (prop?.rich_text || []).map(t => t.plain_text).join('');
}

function parseReviewerPage(page) {
  const p = page.properties;
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
    status: p['Status']?.select?.name || 'Active',
  };
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
    timestamp: p['Timestamp']?.date?.start || page.created_time,
  };
}

export async function GET(request) {
  try {
    // Authenticate and check admin status
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const isAdmin = await verifyAdminFromNotion(user);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch ALL reviewers (without consent filter for admin visibility)
    const reviewersRes = await notion.databases.query({
      database_id: REVIEWER_DB,
      sorts: [{ property: 'First Name', direction: 'ascending' }],
    });

    const reviewers = reviewersRes.results.map(parseReviewerPage);

    // Fetch all scores in parallel
    let allScores = [];
    let cursor = undefined;
    do {
      const scoresRes = await notion.databases.query({
        database_id: SCORES_DB,
        start_cursor: cursor,
        sorts: [{ property: 'Timestamp', direction: 'descending' }],
      });
      allScores = allScores.concat(scoresRes.results.map(parseScorePage));
      cursor = scoresRes.has_more ? scoresRes.next_cursor : undefined;
    } while (cursor);

    // Enrich reviewers with score statistics
    const enrichedReviewers = reviewers.map(reviewer => {
      const reviewerScores = allScores.filter(score => score.raterAlias === reviewer.alias);

      let avgScore = null;
      if (reviewerScores.length > 0) {
        const totalScore = reviewerScores.reduce((sum, score) => {
          const scores = [score.q1, score.q2, score.q3, score.q4, score.q5, score.q6, score.q7, score.q8, score.q9, score.q10, score.q11].filter(s => s !== null);
          return sum + scores.reduce((a, b) => a + b, 0);
        }, 0);
        const totalAnswers = reviewerScores.reduce((sum, score) => {
          const scores = [score.q1, score.q2, score.q3, score.q4, score.q5, score.q6, score.q7, score.q8, score.q9, score.q10, score.q11].filter(s => s !== null);
          return sum + scores.length;
        }, 0);
        avgScore = totalAnswers > 0 ? (totalScore / totalAnswers).toFixed(2) : null;
      }

      const lastReviewDate = reviewerScores.length > 0 ? reviewerScores[0].timestamp : null;

      return {
        ...reviewer,
        reviewCount: reviewerScores.length,
        lastReviewDate,
        avgScore: avgScore ? parseFloat(avgScore) : null,
      };
    });

    return NextResponse.json({ reviewers: enrichedReviewers });
  } catch (error) {
    console.error('Error fetching reviewers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
