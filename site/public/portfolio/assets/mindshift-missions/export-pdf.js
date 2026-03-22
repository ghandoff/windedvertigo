/* ============================================================================
   Mindshift Missions – PDF Export
   A4 summary that mirrors the windedvertigo.com aesthetic:
   dark slate (#273248) background, burnt-sienna accents, generous spacing,
   lowercase Inter-style typography, PRME rainbow stripe.

   Depends on: jsPDF (CDN), scenarioData, gameState, formatTime,
               showStatusMessage
   ============================================================================ */

(function () {
'use strict';

// ── Layout constants ──
const A4W = 210, A4H = 297;
const SW  = 3.5;                        // stripe width
const ML  = SW + 8;                     // generous left margin
const MR  = 10;                         // right margin
const MT  = 16;                         // top margin
const MB  = 12;                         // bottom margin
const CW  = A4W - ML - MR;             // content width
const GAP = 5;                          // column gutter
const COL = (CW - GAP) / 2;            // single column width
const PAD = 4;                          // card inner padding
const TW  = COL - PAD * 2;             // text width inside card column
const FW  = CW  - PAD * 2;             // text width inside full-width card

// ── Site palette (dark theme for PDF) ──
const STRIPE = ['#E2580E','#ED9120','#FFCF00','#486C37','#7A9EB8','#405DAB','#1E3250'];

const BG   = [39, 50, 72];             // #273248  – page background
const CARD = [30, 39, 56];             // #1e2738  – card surface (slightly lighter)
const CARD_B = [55, 65, 85];           // subtle card border
const ACC  = [177, 80, 67];            // #b15043  – burnt sienna accent
const ACC2 = [203, 120, 88];           // #cb7858  – secondary terracotta
const PEACH= [255, 235, 210];          // #ffebd2  – highlight / hover text
const WHITE= [255, 255, 255];          // primary text
const MUTED= [180, 185, 195];          // rgba(255,255,255,0.7) equivalent
const DIM  = [120, 128, 140];          // dimmer labels
const DIVIDER = [60, 72, 95];          // subtle divider lines

function hex(h) { return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]; }

// ════════════════════════════════════════════════════
//  Public export
// ════════════════════════════════════════════════════
window.exportPDF = function exportPDF() {
    var scenario = scenarioData.scenarios[gameState.selectedScenario];
    if (!scenario) { showStatusMessage('could not load scenario data','error'); return; }
    showStatusMessage('generating pdf…','info');

    var jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPDF) { showStatusMessage('jspdf library not loaded','error'); return; }

    var pdf = new jsPDF({ unit:'mm', format:'a4' });
    var y = MT;

    // ── Page chrome ───────────────────────────────────
    function background() {
        // Dark slate fill
        pdf.setFillColor(...BG);
        pdf.rect(0, 0, A4W, A4H, 'F');
        // PRME rainbow stripe
        var sh = A4H / 7;
        STRIPE.forEach(function(c, i) {
            pdf.setFillColor(...hex(c));
            pdf.rect(0, i * sh, SW, sh, 'F');
        });
    }

    function header() {
        // Title – large, bold, white
        pdf.setFontSize(18);
        pdf.setFont('Helvetica','bold');
        pdf.setTextColor(...WHITE);
        pdf.text('mindshift missions', ML, MT);

        // Right-aligned tag
        pdf.setFontSize(7);
        pdf.setFont('Helvetica','normal');
        pdf.setTextColor(...DIM);
        var tag = 'mission summary';
        pdf.text(tag, A4W - MR - pdf.getTextWidth(tag), MT - 1);

        // Sub-brand row
        var sy = MT + 7;
        pdf.setFontSize(9);
        pdf.setFont('Helvetica','bold');
        pdf.setTextColor(...ACC);
        pdf.text('prme', ML, sy);
        var bx = ML + pdf.getTextWidth('prme') + 2;
        pdf.setFont('Helvetica','normal');
        pdf.setTextColor(...DIM);
        pdf.text('\u00d7', bx, sy);
        bx += pdf.getTextWidth('\u00d7') + 2;
        pdf.setFont('Helvetica','italic');
        pdf.setTextColor(...PEACH);
        pdf.text('winded.vertigo', bx, sy);

        // Accent divider line (burnt sienna gradient effect – solid for PDF)
        var dy = sy + 5;
        pdf.setLineWidth(0.6);
        pdf.setDrawColor(...ACC);
        pdf.line(ML, dy, ML + 40, dy);
        // Fade to dim
        pdf.setLineWidth(0.15);
        pdf.setDrawColor(...DIVIDER);
        pdf.line(ML + 40, dy, A4W - MR, dy);

        return dy + 5;
    }

    function footer() {
        var fy = A4H - MB;
        pdf.setFontSize(6);
        pdf.setFont('Helvetica','normal');
        pdf.setTextColor(...DIM);
        var ft = 'prme \u00d7 winded.vertigo';
        pdf.text(ft, A4W - MR - pdf.getTextWidth(ft), fy);
    }

    function newPage() { pdf.addPage(); background(); y = header(); footer(); }
    function room() { return A4H - MB - 6 - y; }

    // ── Text primitives ──────────────────────────────
    function wrap(text, w, fs) {
        pdf.setFontSize(fs);
        return pdf.splitTextToSize((text || '').toLowerCase(), w);
    }

    function measureLV(w, label, value, fs, max, isQ) {
        fs = fs || 7; max = max || 20;
        var lh = fs * 0.56;
        if (isQ) {
            // Question heading – larger
            var ql = wrap(value, w, 8);
            return ql.length * (8 * 0.56) + 4;
        }
        var n = wrap(value || 'no response', w, fs).slice(0, max).length;
        return (lh + 1) + n * lh + 2.5;
    }

    function drawLV(x, cy, w, label, value, fs, max, isQ) {
        fs = fs || 7; max = max || 20;
        var lh = fs * 0.56;

        if (isQ) {
            // Question as a heading – peach color, italic, larger
            pdf.setFontSize(8);
            pdf.setFont('Helvetica','bolditalic');
            pdf.setTextColor(...PEACH);
            var ql = wrap(value, w, 8);
            pdf.text(ql, x, cy, {maxWidth: w});
            return cy + ql.length * (8 * 0.56) + 4;
        }

        // Label
        pdf.setFontSize(fs);
        pdf.setFont('Helvetica','bold');
        pdf.setTextColor(...ACC2);
        pdf.text((label || '').toLowerCase(), x, cy);
        cy += lh + 1;

        // Value
        pdf.setFont('Helvetica','normal');
        pdf.setTextColor(...MUTED);
        var ls = wrap(value || 'no response', w, fs).slice(0, max);
        pdf.text(ls, x, cy, {maxWidth: w});
        return cy + ls.length * lh + 2.5;
    }

    // ── Card ─────────────────────────────────────────
    function card(x, cy, w, h) {
        pdf.setFillColor(...CARD);
        pdf.setLineWidth(0.3);
        pdf.setDrawColor(...CARD_B);
        pdf.roundedRect(x, cy, w, h, 2, 2, 'FD');
    }

    function sectionTitle(text, x, cy) {
        pdf.setFontSize(10);
        pdf.setFont('Helvetica','bold');
        pdf.setTextColor(...WHITE);
        pdf.text(text, x, cy);
        // Small accent underline
        var tw = pdf.getTextWidth(text);
        pdf.setLineWidth(0.4);
        pdf.setDrawColor(...ACC);
        pdf.line(x, cy + 1.5, x + tw, cy + 1.5);
        return cy + 6;
    }

    function measureFields(fields, w, fs, max) {
        var h = PAD;
        fields.forEach(function(f) { h += measureLV(w, f[0], f[1], fs, max, f[2]); });
        return h + PAD;
    }

    function drawFields(x, cy, w, fields, fs, max) {
        var tw = w - PAD * 2;
        cy += PAD;
        fields.forEach(function(f) { cy = drawLV(x + PAD, cy, tw, f[0], f[1], fs, max, f[2]); });
    }

    function chip(x, cy, text, maxX, style) {
        pdf.setFontSize(6.5);
        var tw = pdf.getTextWidth(text.toLowerCase()), cw = tw + 5, ch = 3.5;
        if (x + cw > maxX) return null;
        pdf.setFillColor(...style.bg);
        pdf.setLineWidth(0.2);
        pdf.setDrawColor(...style.ln);
        pdf.roundedRect(x, cy, cw, ch, 1, 1, 'FD');
        pdf.setTextColor(...style.tx);
        pdf.text(text.toLowerCase(), x + 2.5, cy + ch - 0.8);
        return x + cw + 2;
    }

    // ── Chip styles (dark-theme versions) ────────────
    var chipTeam = { bg:[50,60,80], ln:[70,80,100], tx:[200,210,220] };
    var chipBadge = { bg:[70,45,40], ln:[140,80,65], tx:[255,200,180] };

    // ════════════════════════════════════════════════
    //  Extract data
    // ════════════════════════════════════════════════
    var team = gameState.teamMembers.split('\n').map(function(n) { return n.trim(); }).filter(function(n) { return n.length > 0; });
    var oKey = gameState.selectedScenario === 'plastic_packaging' ? 'environmental' : 'learning equity';
    var oVal = gameState.selectedScenario === 'plastic_packaging' ? scenario.outcomes.environmental : scenario.outcomes.learning_equity;
    var cp1 = scenario.checkpoints[1], r1 = gameState.responses.checkpoint1;
    var cp2 = scenario.checkpoints[2], r2 = gameState.responses.checkpoint2;

    var overview = [
        ['role', gameState.selectedRole || 'not selected'],
        ['scenario', scenario.title],
        ['total time', formatTime(Date.now() - gameState.startTime)]
    ];
    var outcomes = [
        [oKey, oVal],
        ['public perception', scenario.outcomes.public_perception],
        ['operational', scenario.outcomes.operational]
    ];
    var c1 = [
        ['situation', cp1.title],
        ['question', cp1.questions[r1.question] || 'none', true],
        ['action', cp1.actions[r1.action] || 'none'],
        ['discussion', r1.groupDiscussion || 'no response'],
        ['explanation', r1.actionExplanation || 'no response'],
        ['ai advice', r1.aiAdvice || 'no response']
    ];
    var c2 = [
        ['situation', cp2.title],
        ['question', cp2.questions[r2.question] || 'none', true],
        ['action', cp2.actions[r2.action] || 'none'],
        ['discussion', r2.groupDiscussion || 'no response'],
        ['explanation', r2.actionExplanation || 'no response'],
        ['ai advice', r2.aiAdvice || 'no response']
    ];
    var refl = [
        ['prompt', scenario.reflection_prompts[0], true],
        ['response', gameState.responses.reflection.answer1 || 'no response'],
        ['prompt', scenario.reflection_prompts[1], true],
        ['response', gameState.responses.reflection.answer2 || 'no response']
    ];

    // ════════════════════════════════════════════════
    //  Draw
    // ════════════════════════════════════════════════
    background();
    y = header();
    footer();

    // ── Row 1: Overview + Outcomes ──
    var secY = y;
    sectionTitle('mission overview', ML, secY);
    sectionTitle('outcome snapshot', ML + COL + GAP, secY);
    y = secY + 6;

    // Measure team chips
    var chipRows = 1, cx = 0;
    pdf.setFontSize(6.5);
    team.forEach(function(n) {
        var w = pdf.getTextWidth(n.toLowerCase()) + 7;
        if (cx + w > TW) { chipRows++; cx = 0; }
        cx += w;
    });
    var teamH = 5 + chipRows * 4.5 + 2;
    var ovH = teamH + measureFields(overview, TW, 7, 2);
    var ocH = measureFields(outcomes, TW, 7, 3);
    var r1H = Math.max(ovH, ocH);

    card(ML, y, COL, r1H);
    card(ML + COL + GAP, y, COL, r1H);

    // Fill overview card
    var oy = y + PAD;
    pdf.setFontSize(7);
    pdf.setFont('Helvetica','bold');
    pdf.setTextColor(...ACC2);
    pdf.text('team members', ML + PAD, oy);
    oy += 3.5;
    cx = ML + PAD;
    var mxChip = ML + COL - PAD;
    team.forEach(function(n) {
        var nx = chip(cx, oy, n, mxChip, chipTeam);
        if (!nx) { oy += 4.5; cx = ML + PAD; nx = chip(cx, oy, n, mxChip, chipTeam); }
        cx = nx || cx;
    });
    oy += 7;
    overview.forEach(function(f) { oy = drawLV(ML + PAD, oy, TW, f[0], f[1], 7, 2); });

    // Fill outcomes card
    var ocy = y + PAD;
    outcomes.forEach(function(f) { ocy = drawLV(ML + COL + GAP + PAD, ocy, TW, f[0], f[1], 7, 3); });

    y += r1H + 5;

    // ── Row 2: Checkpoint 1 + Checkpoint 2 ──
    var h1 = measureFields(c1, TW, 7, 4);
    var h2 = measureFields(c2, TW, 7, 4);
    var r2H = Math.max(h1, h2);
    if (r2H + 8 > room()) newPage();

    secY = y;
    sectionTitle('checkpoint 1', ML, secY);
    sectionTitle('checkpoint 2', ML + COL + GAP, secY);
    y = secY + 6;

    card(ML, y, COL, r2H);
    drawFields(ML, y, COL, c1, 7, 4);
    card(ML + COL + GAP, y, COL, r2H);
    drawFields(ML + COL + GAP, y, COL, c2, 7, 4);
    y += r2H + 5;

    // ── Row 3: Reflections (full width) ──
    var rH = measureFields(refl, FW, 7, 6);
    if (rH + 8 > room()) newPage();

    y = sectionTitle('reflections', ML, y);
    card(ML, y, CW, rH);
    drawFields(ML, y, CW, refl, 7, 6);
    y += rH + 5;

    // ── Badges ──
    if (gameState.earnedBadges && gameState.earnedBadges.length > 0) {
        if (14 > room()) newPage();
        y = sectionTitle('badges earned', ML, y);
        var bx = ML + 1, bmx = A4W - MR - 2;
        gameState.earnedBadges.forEach(function(b) {
            var nx = chip(bx, y, b, bmx, chipBadge);
            if (!nx) { y += 5; bx = ML + 1; nx = chip(bx, y, b, bmx, chipBadge); }
            bx = nx || bx;
        });
    }

    // ── Save ──
    try {
        pdf.save('mindshift-mission-' + Date.now() + '.pdf');
        showStatusMessage('pdf exported!', 'success');
    } catch(err) {
        showStatusMessage('pdf export failed', 'error');
        console.error('PDF export error:', err);
    }
};

})();
