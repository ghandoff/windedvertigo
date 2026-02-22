'use client';

import { getRubricByVersion, DEFAULT_RUBRIC_VERSION } from '@/lib/rubric';

export default function ScoreComparison({ scores, rubricVersion }) {
  if (!scores || scores.length === 0) return null;

  // Detect version from scores if not passed explicitly
  const version = rubricVersion || scores[0]?.rubricVersion || DEFAULT_RUBRIC_VERSION;
  const rubric = getRubricByVersion(version);

  const calculateTotalScore = (scoreObj) => {
    let total = 0;
    for (let i = 1; i <= 11; i++) {
      total += scoreObj[`q${i}`] || 0;
    }
    return total;
  };

  const calculateAgreement = () => {
    let agreedQuestions = 0;

    for (const question of rubric) {
      const values = scores.map(s => s[question.id]);
      const allSame = values.every(v => v === values[0]);
      if (allSame) agreedQuestions += 1;
    }

    return Math.round((agreedQuestions / rubric.length) * 100);
  };

  const allReviewersAgree = (questionId) => {
    const values = scores.map(s => s[questionId]);
    return values.every(v => v === values[0]);
  };

  const agreement = calculateAgreement();

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left text-sm font-semibold text-gray-700 py-3 px-4 bg-gray-50 sticky left-0 z-10">
              Question
            </th>
            {scores.map((score, idx) => (
              <th
                key={idx}
                className="text-center text-sm font-semibold text-gray-700 py-3 px-4 bg-gray-50"
              >
                <div className="text-xs text-gray-500 mb-1">Reviewer</div>
                <div className="font-medium text-gray-900">{score.raterAlias}</div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rubric.map((question) => {
            const agree = allReviewersAgree(question.id);
            const bgColor = agree ? 'bg-green-50' : 'bg-yellow-50';

            return (
              <tr key={question.id} className={`border-b border-gray-100 ${bgColor}`}>
                <td className="text-left text-sm font-medium text-gray-900 py-3 px-4 sticky left-0 z-10 bg-inherit">
                  <div className="text-xs text-gray-500 mb-1">Q{question.number}</div>
                  <div className="max-w-xs">{question.label}</div>
                </td>

                {scores.map((score, idx) => {
                  const scoreValue = score[question.id];
                  return (
                    <td
                      key={idx}
                      className="text-center text-sm font-semibold text-gray-900 py-3 px-4"
                    >
                      {scoreValue !== undefined ? scoreValue : '—'}
                    </td>
                  );
                })}
              </tr>
            );
          })}

          <tr className="bg-gray-100 font-semibold">
            <td className="text-left text-sm text-gray-900 py-3 px-4 sticky left-0 z-10 bg-inherit">
              Total Score
            </td>
            {scores.map((score, idx) => {
              const total = calculateTotalScore(score);
              return (
                <td key={idx} className="text-center text-sm text-gray-900 py-3 px-4">
                  {total} / 22
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900">Reviewer Agreement</p>
            <p className="text-xs text-blue-700 mt-1">
              {agreement}% of questions scored identically across all reviewers
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-blue-900">{agreement}%</p>
          </div>
        </div>

        <div className="mt-3 flex gap-3 text-xs text-blue-800">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-400" />
            <span>All agree</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-yellow-400" />
            <span>Some differ</span>
          </div>
        </div>
      </div>
    </div>
  );
}
