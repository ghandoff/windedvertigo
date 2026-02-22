import { authenticateRequest } from '@/lib/auth';
import { getAllScores, getAllStudies, getAllReviewers } from '@/lib/notion';
import {
  calculateFleissKappas,
  buildArticleSummaries,
  buildReviewerStats,
  buildDistributions,
  calculateOverallAgreement,
} from '@/lib/statistics';

const QUESTION_IDS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11'];

export async function GET(request) {
  const user = await authenticateRequest(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!user.isAdmin) {
    return new Response(JSON.stringify({ error: 'Admin access required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Fetch all data
    const [scores, studies, reviewers] = await Promise.all([
      getAllScores(),
      getAllStudies(),
      getAllReviewers(),
    ]);

    // Group scores by study
    const articleScoresMap = {};
    scores.forEach(score => {
      const studyId = score.studyRelation?.[0];
      if (!studyId) return;
      if (!articleScoresMap[studyId]) articleScoresMap[studyId] = [];
      articleScoresMap[studyId].push(score);
    });

    // Compute analytics
    const fleissKappas = calculateFleissKappas(articleScoresMap);
    const overallAgreement = calculateOverallAgreement(articleScoresMap);
    const articleSummaries = buildArticleSummaries(studies, articleScoresMap);
    const reviewerStats = buildReviewerStats(scores, reviewers);
    const distributions = buildDistributions(scores);

    // Generate PDF
    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 60, bottom: 60, left: 50, right: 50 },
      info: {
        Title: 'SQR-RCT Quality Assessment Report',
        Author: 'Nordic Naturals SQR-RCT Platform',
      },
    });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    const pdfDone = new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const PAGE_WIDTH = 512; // letter width minus margins
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    // ─── Page 1: Title & Summary ───────────────────────────
    doc.fontSize(28).font('Helvetica-Bold')
      .text('SQR-RCT Quality Assessment Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica').fillColor('#666666')
      .text('Nordic Naturals — Study Quality Rubric for RCTs', { align: 'center' });
    doc.moveDown(0.3);
    doc.text(`Generated: ${dateStr}`, { align: 'center' });
    doc.moveDown(2);

    // Summary box
    doc.fillColor('#000000');
    doc.fontSize(16).font('Helvetica-Bold').text('Project Summary');
    doc.moveDown(0.5);

    const summaryItems = [
      ['Total Articles', studies.length],
      ['Total Reviews', scores.length],
      ['Active Reviewers', reviewerStats.length],
      ['Articles with 2+ Reviewers', Object.values(articleScoresMap).filter(s => s.length >= 2).length],
      ['Overall Agreement', `${overallAgreement}%`],
      ['Average Score', `${distributions.avgScore}/22`],
      ['High Quality Rate', `${distributions.qualityTiers.highPct}%`],
    ];

    doc.fontSize(11).font('Helvetica');
    for (const [label, value] of summaryItems) {
      doc.text(`${label}: `, { continued: true }).font('Helvetica-Bold').text(String(value));
      doc.font('Helvetica');
    }

    // ─── Page 2: IRR Statistics ─────────────────────────────
    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').text('Inter-Rater Reliability (IRR)');
    doc.moveDown(0.5);

    if (fleissKappas.overall != null) {
      doc.fontSize(12).font('Helvetica-Bold')
        .text(`Overall Fleiss\' Kappa: ${fleissKappas.overall} (${fleissKappas.overallInterpretation})`);
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica').fillColor('#666666')
        .text(`Based on ${fleissKappas.eligibleArticleCount} articles with 2+ raters`);
      doc.fillColor('#000000');
      doc.moveDown(1);

      // Per-question kappa table
      doc.fontSize(12).font('Helvetica-Bold').text('Per-Question Agreement');
      doc.moveDown(0.5);

      // Table header
      const colWidths = [180, 70, 120, 80];
      let tableY = doc.y;
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Question', 50, tableY, { width: colWidths[0] });
      doc.text('Kappa', 50 + colWidths[0], tableY, { width: colWidths[1], align: 'center' });
      doc.text('Interpretation', 50 + colWidths[0] + colWidths[1], tableY, { width: colWidths[2], align: 'center' });
      doc.text('% Agree', 50 + colWidths[0] + colWidths[1] + colWidths[2], tableY, { width: colWidths[3], align: 'center' });
      tableY += 16;
      doc.moveTo(50, tableY).lineTo(50 + PAGE_WIDTH, tableY).stroke('#cccccc');
      tableY += 4;

      doc.font('Helvetica').fontSize(9);
      for (const [qId, data] of Object.entries(fleissKappas.perQuestion)) {
        doc.text(data.label, 50, tableY, { width: colWidths[0] });
        doc.text(String(data.kappa), 50 + colWidths[0], tableY, { width: colWidths[1], align: 'center' });
        doc.text(data.interpretation, 50 + colWidths[0] + colWidths[1], tableY, { width: colWidths[2], align: 'center' });
        doc.text(`${data.percentAgreement}%`, 50 + colWidths[0] + colWidths[1] + colWidths[2], tableY, { width: colWidths[3], align: 'center' });
        tableY += 16;
      }
    } else {
      doc.fontSize(11).font('Helvetica').fillColor('#888888')
        .text('Not enough data for IRR analysis. At least 2 reviewers scoring the same article are required.');
      doc.fillColor('#000000');
    }

    // ─── Page 3: Quality Distribution ───────────────────────
    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').text('Quality Distribution');
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica');
    doc.text(`High Quality (17-22): ${distributions.qualityTiers.high} reviews (${distributions.qualityTiers.highPct}%)`);
    doc.text(`Moderate Quality (11-16): ${distributions.qualityTiers.moderate} reviews (${distributions.qualityTiers.moderatePct}%)`);
    doc.text(`Low Quality (0-10): ${distributions.qualityTiers.low} reviews (${distributions.qualityTiers.lowPct}%)`);
    doc.moveDown(1);

    // Score histogram as text bars
    doc.fontSize(12).font('Helvetica-Bold').text('Score Distribution');
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica');
    const maxCount = Math.max(...distributions.scoreHistogram.map(b => b.count), 1);
    for (const bin of distributions.scoreHistogram) {
      const barLen = Math.round((bin.count / maxCount) * 30);
      const bar = '\u2588'.repeat(barLen) || '';
      doc.text(`${bin.range.padEnd(6)} ${bar} ${bin.count}`);
    }

    // ─── Page 4+: Article Scores ────────────────────────────
    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').text('Article Score Summaries');
    doc.moveDown(0.5);

    doc.fontSize(9).font('Helvetica');
    for (const article of articleSummaries) {
      if (doc.y > 680) doc.addPage(); // page break near bottom

      doc.font('Helvetica-Bold').fontSize(10);
      const citationText = article.citation.length > 90
        ? article.citation.substring(0, 90) + '...'
        : article.citation;
      doc.text(citationText);
      doc.font('Helvetica').fontSize(9);

      const meta = [];
      if (article.year) meta.push(`Year: ${article.year}`);
      if (article.journal) meta.push(article.journal);
      meta.push(`Reviewers: ${article.reviewerCount}`);
      if (article.avgScore != null) meta.push(`Avg: ${article.avgScore}/22`);
      meta.push(`Tier: ${article.avgTier || 'N/A'}`);
      meta.push(`Status: ${article.consensusStatus}`);
      doc.fillColor('#555555').text(meta.join(' | '));
      doc.fillColor('#000000');
      doc.moveDown(0.5);
    }

    // ─── Page: Reviewer Stats ───────────────────────────────
    if (reviewerStats.length > 0) {
      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').text('Reviewer Statistics');
      doc.moveDown(0.5);

      const rColWidths = [120, 60, 70, 70, 70, 90];
      let rY = doc.y;
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Reviewer', 50, rY, { width: rColWidths[0] });
      doc.text('Articles', 50 + rColWidths[0], rY, { width: rColWidths[1], align: 'center' });
      doc.text('Avg Score', 50 + rColWidths[0] + rColWidths[1], rY, { width: rColWidths[2], align: 'center' });
      doc.text('Tier', 50 + rColWidths[0] + rColWidths[1] + rColWidths[2], rY, { width: rColWidths[3], align: 'center' });
      doc.text('Avg Time', 50 + rColWidths[0] + rColWidths[1] + rColWidths[2] + rColWidths[3], rY, { width: rColWidths[4], align: 'center' });
      doc.text('Bias', 50 + rColWidths[0] + rColWidths[1] + rColWidths[2] + rColWidths[3] + rColWidths[4], rY, { width: rColWidths[5], align: 'center' });
      rY += 16;
      doc.moveTo(50, rY).lineTo(50 + PAGE_WIDTH, rY).stroke('#cccccc');
      rY += 4;

      doc.font('Helvetica').fontSize(9);
      for (const r of reviewerStats) {
        if (rY > 700) {
          doc.addPage();
          rY = 60;
        }
        doc.text(`${r.name} (${r.alias})`, 50, rY, { width: rColWidths[0] });
        doc.text(String(r.articlesReviewed), 50 + rColWidths[0], rY, { width: rColWidths[1], align: 'center' });
        doc.text(`${r.avgScore}/22`, 50 + rColWidths[0] + rColWidths[1], rY, { width: rColWidths[2], align: 'center' });
        doc.text(r.avgTier, 50 + rColWidths[0] + rColWidths[1] + rColWidths[2], rY, { width: rColWidths[3], align: 'center' });
        doc.text(r.avgTime != null ? `${r.avgTime}m` : '—', 50 + rColWidths[0] + rColWidths[1] + rColWidths[2] + rColWidths[3], rY, { width: rColWidths[4], align: 'center' });
        doc.text(r.biasLabel, 50 + rColWidths[0] + rColWidths[1] + rColWidths[2] + rColWidths[3] + rColWidths[4], rY, { width: rColWidths[5], align: 'center' });
        rY += 16;
      }
    }

    // Finalize
    doc.end();

    const pdfBuffer = await pdfDone;
    const dateSuffix = new Date().toISOString().split('T')[0];

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=sqr-report-${dateSuffix}.pdf`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error('PDF export error:', err);
    return new Response(JSON.stringify({ error: 'Failed to generate PDF report' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
