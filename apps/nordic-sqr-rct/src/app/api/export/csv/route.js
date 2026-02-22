import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { getAllScores, getAllStudies } from '@/lib/notion';

const QUESTION_IDS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11'];

function escapeCSV(val) {
  if (val == null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function getTotal(score) {
  return QUESTION_IDS.reduce((sum, q) => sum + (score[q] ?? 0), 0);
}

function getQualityTier(total) {
  if (total >= 17) return 'High';
  if (total >= 11) return 'Moderate';
  return 'Low';
}

export async function GET(request) {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if (!user.isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const [scores, studies] = await Promise.all([
      getAllScores(),
      getAllStudies(),
    ]);

    // Build study lookup by ID
    const studyMap = {};
    studies.forEach(s => { studyMap[s.id] = s; });

    // CSV headers
    const headers = [
      'Citation', 'DOI', 'Year', 'Journal', 'Reviewer',
      'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q10', 'Q11',
      'Total Score', 'Quality Tier', 'Notes', 'Time (min)', 'Timestamp',
    ];

    const rows = [headers.map(escapeCSV).join(',')];

    for (const score of scores) {
      const studyId = score.studyRelation?.[0];
      const study = studyId ? studyMap[studyId] : null;
      const total = getTotal(score);

      const row = [
        study?.citation || '',
        study?.doi || '',
        study?.year || '',
        study?.journal || '',
        score.raterAlias || '',
        ...QUESTION_IDS.map(q => score[q] ?? ''),
        total,
        getQualityTier(total),
        score.notes || '',
        score.timeToComplete || '',
        score.timestamp || '',
      ];

      rows.push(row.map(escapeCSV).join(','));
    }

    const csv = rows.join('\n');
    const dateStr = new Date().toISOString().split('T')[0];

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=sqr-scores-${dateStr}.csv`,
      },
    });
  } catch (err) {
    console.error('CSV export error:', err);
    return NextResponse.json(
      { error: 'Failed to generate CSV export' },
      { status: 500 }
    );
  }
}
