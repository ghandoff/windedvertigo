export const dynamic = "force-dynamic";

const html = `
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>the harbour — launch map</title>
<style>
:root {
  color-scheme: light;
  --wv-redwood: #7a3a2e;
  --wv-sienna: #c87b4c;
  --wv-champagne: #e6c89a;
  --wv-cadet: #4a6a78;
  --wv-cream: #faf6ef;
  --wv-ink: #2a2420;
  --wv-muted: #6b5e54;
  --wv-line: #d9cdb9;
  --wv-mint: #cfe3d6;
  --wv-water: #b9d6dd;
  --wv-sand: #f3e9d2;
  --wv-coming: #c9bfac;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--wv-cream);
  color: var(--wv-ink);
  line-height: 1.55;
  font-size: 15.5px;
}
.wrap { max-width: 1100px; margin: 0 auto; padding: 24px 28px 80px; }
h1, h2, h3, h4 { font-weight: 600; letter-spacing: -0.01em; }
h1 { font-size: 2.1rem; margin: 0 0 4px; text-transform: lowercase; }
h2 { font-size: 1.45rem; margin: 36px 0 10px; text-transform: lowercase; color: var(--wv-redwood); }
h3 { font-size: 1.1rem; margin: 14px 0 4px; text-transform: lowercase; }
h4 { font-size: 0.78rem; margin: 12px 0 4px; text-transform: uppercase; color: var(--wv-muted); letter-spacing: 0.12em; font-weight: 600; }
p, li { color: var(--wv-ink); }
a { color: var(--wv-cadet); }

.hero {
  background: linear-gradient(135deg, var(--wv-sand) 0%, var(--wv-cream) 60%, var(--wv-water) 100%);
  border: 1px solid var(--wv-line);
  border-radius: 14px;
  padding: 26px 28px;
  margin-bottom: 22px;
}
.hero .kicker { font-size: 0.78rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--wv-muted); margin-bottom: 6px; }
.hero .sub { color: var(--wv-muted); font-size: 1rem; max-width: 720px; }
.countdown {
  display: inline-flex; gap: 12px; align-items: center;
  background: rgba(255,255,255,0.6);
  border: 1px solid var(--wv-line);
  border-radius: 999px; padding: 6px 14px; margin-top: 12px;
  font-size: 0.85rem; color: var(--wv-redwood);
}
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--wv-redwood); display: inline-block; }
.dot.wave2 { background: var(--wv-sienna); }
.dot.wave3 { background: var(--wv-coming); }

/* nav tabs */
.tabs {
  display: flex; gap: 4px; flex-wrap: wrap;
  border-bottom: 1px solid var(--wv-line);
  margin-bottom: 18px;
  position: sticky; top: 0; background: rgba(250,246,239,0.92); backdrop-filter: blur(6px);
  padding-top: 6px; z-index: 5;
}
.tab {
  padding: 9px 14px; border: none; background: transparent;
  font: inherit; cursor: pointer; color: var(--wv-muted);
  border-bottom: 2px solid transparent; text-transform: lowercase;
}
.tab.active { color: var(--wv-redwood); border-bottom-color: var(--wv-redwood); font-weight: 600; }

.panel { display: none; }
.panel.active { display: block; }

/* legend */
.legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 0.85rem; color: var(--wv-muted); margin-bottom: 14px; }
.legend .item { display: inline-flex; align-items: center; gap: 6px; }

/* cards grid */
.grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
  gap: 14px;
}
.card {
  border: 1px solid var(--wv-line);
  border-radius: 12px;
  background: #fff;
  padding: 16px 18px 18px 20px;
  position: relative;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.card .stripe {
  position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
}
.card.wave1 .stripe { background: var(--wv-redwood); }
.card.wave2 .stripe { background: var(--wv-sienna); }
.card.wave3 .stripe { background: var(--wv-coming); }
.card .meta {
  font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.14em;
  color: var(--wv-muted); margin-bottom: 6px; font-weight: 600;
}
.card.wave1 .meta { color: var(--wv-redwood); }
.card.wave2 .meta { color: var(--wv-sienna); }
.card.wave3 .meta { color: var(--wv-muted); }
.card .name {
  font-size: 1.1rem; font-weight: 600; text-transform: lowercase;
  margin-top: 0;
}
.card .tagline { font-size: 0.92rem; color: var(--wv-muted); margin: 4px 0 8px; font-style: italic; }
.card .row { display: flex; gap: 6px; flex-wrap: wrap; margin: 6px 0 8px; }
.tag {
  font-size: 0.72rem; padding: 2px 8px; border-radius: 999px;
  background: var(--wv-sand); color: var(--wv-ink); border: 1px solid var(--wv-line);
}
.tag.live { background: var(--wv-mint); color: #2a4a3a; border-color: #aac7b3; }
.tag.soon { background: var(--wv-water); color: var(--wv-cadet); border-color: #9cbbc4; }
.tag.tease { background: #efe9d8; color: var(--wv-muted); }
.card .body { font-size: 0.9rem; color: var(--wv-ink); }
.card details { margin-top: 8px; font-size: 0.88rem; }
.card details summary { cursor: pointer; color: var(--wv-cadet); padding: 4px 0; user-select: none; }
.card details summary::marker { color: var(--wv-cadet); }
.card .pos { padding: 8px 0 4px; border-top: 1px dashed var(--wv-line); margin-top: 8px; }
.card .pos h4 { margin-top: 10px; margin-bottom: 4px; }
.card .url { font-size: 0.75rem; color: var(--wv-muted); margin-top: 8px; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; word-break: break-all; }
.card .audience-strip { font-size: 0.78rem; color: var(--wv-muted); margin: 2px 0 6px; }
.card .audience-strip strong { color: var(--wv-ink); font-weight: 600; }

/* IA / piers */
.piers { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin-top: 16px; }
.pier {
  border: 1px solid var(--wv-line); border-radius: 12px; padding: 16px 18px 16px 20px; background: #fff;
  position: relative; overflow: hidden;
}
.pier::before {
  content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
  background: var(--wv-cadet);
}
.pier.pier-a::before { background: var(--wv-redwood); }
.pier.pier-b::before { background: var(--wv-redwood); }
.pier.pier-c::before { background: var(--wv-sienna); }
.pier.dry::before { background: var(--wv-coming); }
.pier .label {
  font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.14em;
  color: var(--wv-muted); font-weight: 600; margin-bottom: 2px;
}
.pier.pier-a .label, .pier.pier-b .label { color: var(--wv-redwood); }
.pier.pier-c .label { color: var(--wv-sienna); }
.pier h3 { margin: 0 0 4px; color: var(--wv-ink); }
.pier .who { font-size: 0.85rem; color: var(--wv-muted); margin: 0 0 10px; }
.pier ul { padding-left: 18px; margin: 6px 0 0; }
.pier li { margin: 3px 0; font-size: 0.92rem; }
.pier li .muted { color: var(--wv-muted); font-size: 0.85rem; }

/* timeline / Marketing */
.timeline {
  border-left: 3px solid var(--wv-line);
  padding-left: 18px; margin: 18px 0 0;
}
.t-row { padding: 8px 0; position: relative; }
.t-row::before {
  content: ""; width: 11px; height: 11px; border-radius: 50%;
  background: var(--wv-cream); border: 2px solid var(--wv-redwood);
  position: absolute; left: -25px; top: 14px;
}
.t-row.now::before { background: var(--wv-redwood); }
.t-row .when {
  font-size: 0.78rem; color: var(--wv-muted); text-transform: uppercase; letter-spacing: 0.08em;
}
.t-row .what { font-size: 0.95rem; }
.t-row .detail { font-size: 0.85rem; color: var(--wv-muted); }
.t-row.launch::before { background: var(--wv-redwood); border-color: var(--wv-redwood); }
.t-row.wave2::before { background: var(--wv-sienna); border-color: var(--wv-sienna); }

/* diagram */
.diagram-wrap {
  background: #fff; border: 1px solid var(--wv-line);
  border-radius: 12px; padding: 24px 18px; overflow-x: auto;
}
.ia-svg { display: block; margin: 0 auto; max-width: 100%; height: auto; }

/* callouts */
.callout {
  background: var(--wv-sand);
  border-left: 3px solid var(--wv-sienna);
  padding: 12px 14px; border-radius: 8px; font-size: 0.92rem;
  margin: 12px 0;
}
.callout strong { color: var(--wv-redwood); }

.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 720px) { .two-col { grid-template-columns: 1fr; } }

.sources {
  font-size: 0.82rem; color: var(--wv-muted);
  background: var(--wv-cream); border: 1px solid var(--wv-line);
  border-radius: 10px; padding: 12px 16px; margin-top: 12px;
}
.sources a { color: var(--wv-cadet); }
.sources li { margin: 3px 0; }
.note { font-size: 0.85rem; color: var(--wv-muted); margin-top: 8px; }
.flag {
  background: #fff7e1; border: 1px solid #e9d699; border-radius: 8px;
  padding: 10px 12px; font-size: 0.88rem; margin: 8px 0;
}
.flag strong { color: #7a5a18; }

.handoff {
  background: #fff; border: 1px solid var(--wv-line);
  border-radius: 12px; padding: 16px 18px;
}
.handoff h3 { margin-top: 0; }
.handoff ol { padding-left: 20px; }
.handoff ol li { margin: 6px 0; }
.code-snip {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.82rem; background: #f4eee2; padding: 2px 5px; border-radius: 4px;
}
</style>
</head>
<body>
<div class="wrap">

<div class="hero">
  <div class="kicker">winded.vertigo · internal — for the whirlpool</div>
  <h1>the harbour — launch map</h1>
  <div class="sub">a coordination view of every app currently in the harbour-apps monorepo, mapped to wave 1 (may 28 — final ppcs session) and wave 2 (late june — parents and educators summer push). built from notion, gmail, drive, slack, and the website cms.</div>
  <div class="countdown"><span class="dot"></span> wave 1 launch · 28 may 2026 · t-11 days</div>
</div>

<div class="tabs" role="tablist">
  <button class="tab active" data-target="overview">overview</button>
  <button class="tab" data-target="wave1">wave 1 — may 28</button>
  <button class="tab" data-target="wave2">wave 2 — late june</button>
  <button class="tab" data-target="wave3">coming soon</button>
  <button class="tab" data-target="ia">ia and piers</button>
  <button class="tab" data-target="marketing">marketing arc</button>
  <button class="tab" data-target="handoff">claude code hand-off</button>
</div>

<!-- OVERVIEW -->
<section class="panel active" id="overview">
  <h2>the picture, in one screen</h2>
  <p>the harbour is winded.vertigo's playful learning ecosystem at <span class="code-snip">windedvertigo.com/harbour</span>. roughly <strong>~19 apps</strong> are already deployed across the <span class="code-snip">ghandoff/harbour-apps</span> monorepo on cloudflare workers. they fall into three groups: a small wave-1 set that ships on <strong>28 may</strong> aligned to the final ppcs session; a kids/family wave that ships <strong>end of june</strong> for the summer parent/educator push; and a longer tail of threshold-concept micro-apps that show up as "coming soon" tiles.</p>

  <div class="callout">
    <strong>narrative anchor (from the 06 may whirlpool):</strong> the harbour as a working seaside harbour. ships come and go. piers serve different audiences. visitors enter as themselves and find a vessel that fits. the "sea captains for rough waters of uncertainty" framing is the brand line maria and jamie surfaced — it's been on the table since the 06 may decision to narrow the launch.
  </div>

  <h3>three waves at a glance</h3>
  <div class="grid">
    <div class="card wave1">
      <div class="stripe"></div>
      <div class="meta">wave 1 — 28 may 2026</div>
      <div class="name">prme · adult · higher-ed</div>
      <div class="audience-strip"><strong>audience:</strong> prme plus · adult · higher-ed faculty and facilitators</div>
      <div class="body">5 polished apps that map directly to the ppcs sessions just delivered. launched on the last day of the certificate series so 250+ educators step from session into harbour.</div>
      <div class="row"><span class="tag live">vertigo.vault</span><span class="tag live">depth.chart</span><span class="tag live">lines.become.loops</span><span class="tag live">values.auction</span><span class="tag live">feel.cards</span></div>
    </div>
    <div class="card wave2">
      <div class="stripe"></div>
      <div class="meta">wave 2 — end of june</div>
      <div class="name">families · parents · k-12</div>
      <div class="audience-strip"><strong>audience:</strong> parents · families · k-12 educators (summer and back-to-school)</div>
      <div class="body">the kids/family pier. needs co-creation/testing with children, aligns with prime global conference timing and school holidays.</div>
      <div class="row"><span class="tag soon">creaseworks</span><span class="tag soon">raft.house</span><span class="tag soon">deep.deck</span></div>
    </div>
    <div class="card wave3">
      <div class="stripe"></div>
      <div class="meta">coming soon · q3+</div>
      <div class="name">threshold-concept apps</div>
      <div class="audience-strip"><strong>audience:</strong> learning designers · researchers · curious adults</div>
      <div class="body">the threshold-concept micro-apps. teased as "coming soon" tiles. each one is a 5–15 minute aha-moment experience around a single concept.</div>
      <div class="row"><span class="tag tease">tidal.pool</span><span class="tag tease">paper.trail</span><span class="tag tease">mirror.log</span><span class="tag tease">+ 11 more</span></div>
    </div>
  </div>

  <div class="flag" style="margin-top:14px"><strong>a naming reconciliation:</strong> "deep tech" in your message most likely maps to <span class="code-snip">depth.chart</span> (also possible: <span class="code-snip">deep.deck</span>). "title pool" maps to <span class="code-snip">tidal.pool</span> (one of four systems-thinking tools alongside <span class="code-snip">lines.become.loops</span>). flagged here so we can confirm before the press kit goes out.</div>

  <h3>at a glance — every harbour app, by status</h3>
  <div class="legend">
    <span class="item"><span class="dot"></span> wave 1 — live may 28</span>
    <span class="item"><span class="dot wave2"></span> wave 2 — live late june</span>
    <span class="item"><span class="dot wave3"></span> coming soon — tease only</span>
  </div>

  <div class="grid">
    <div class="card wave1"><div class="stripe"></div><div class="meta">wave 1</div><div class="name">vertigo.vault</div><div class="tagline">facilitator's library</div><div class="row"><span class="tag live">launch</span><span class="tag">facilitators</span><span class="tag">higher-ed</span></div></div>
    <div class="card wave1"><div class="stripe"></div><div class="meta">wave 1</div><div class="name">depth.chart</div><div class="tagline">ai assessment generator</div><div class="row"><span class="tag live">launch</span><span class="tag">educators</span></div></div>
    <div class="card wave1"><div class="stripe"></div><div class="meta">wave 1</div><div class="name">lines.become.loops</div><div class="tagline">systems thinking</div><div class="row"><span class="tag live">launch</span><span class="tag">higher-ed</span></div></div>
    <div class="card wave1"><div class="stripe"></div><div class="meta">wave 1</div><div class="name">values.auction</div><div class="tagline">values exploration</div><div class="row"><span class="tag live">launch</span><span class="tag">ppcs-derived</span></div></div>
    <div class="card wave1"><div class="stripe"></div><div class="meta">wave 1</div><div class="name">feel.cards</div><div class="tagline">decolonisation prompts</div><div class="row"><span class="tag live">launch</span><span class="tag">prme</span></div></div>

    <div class="card wave2"><div class="stripe"></div><div class="meta">wave 2</div><div class="name">creaseworks</div><div class="tagline">playdates platform</div><div class="row"><span class="tag soon">jun</span><span class="tag">parents</span><span class="tag">k-12</span></div></div>
    <div class="card wave2"><div class="stripe"></div><div class="meta">wave 2</div><div class="name">raft.house</div><div class="tagline">multiplayer room codes</div><div class="row"><span class="tag soon">jun</span><span class="tag">facilitators</span><span class="tag">classrooms</span></div></div>
    <div class="card wave2"><div class="stripe"></div><div class="meta">wave 2</div><div class="name">deep.deck</div><div class="tagline">conversation cards</div><div class="row"><span class="tag soon">jun</span><span class="tag">families</span></div></div>

    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">tidal.pool</div><div class="tagline">systems web</div><div class="row"><span class="tag tease">soon</span></div></div>
    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">paper.trail</div><div class="tagline">observation game</div><div class="row"><span class="tag tease">soon</span></div></div>
    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">mirror.log</div><div class="tagline">reflection dashboard</div><div class="row"><span class="tag tease">soon</span></div></div>
    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">bias.lens</div><div class="tagline">cognitive biases</div><div class="row"><span class="tag tease">soon</span></div></div>
    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">time.prism</div><div class="tagline">historical decisions</div><div class="row"><span class="tag tease">soon</span></div></div>
    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">liminal.pass</div><div class="tagline">aha-moment puzzles</div><div class="row"><span class="tag tease">soon</span></div></div>
    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">pattern.weave</div><div class="tagline">gestalt psychology</div><div class="row"><span class="tag tease">soon</span></div></div>
    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">rhythm.lab</div><div class="tagline">beat sequencer</div><div class="row"><span class="tag tease">soon</span></div></div>
    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">orbit.lab</div><div class="tagline">gravity sim</div><div class="row"><span class="tag tease">soon</span></div></div>
    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">code.weave</div><div class="tagline">recursion tree</div><div class="row"><span class="tag tease">soon</span></div></div>
    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">market.mind</div><div class="tagline">resource allocation</div><div class="row"><span class="tag tease">soon</span></div></div>
    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">scale.shift</div><div class="tagline">powers of ten</div><div class="row"><span class="tag tease">soon</span></div></div>
    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">proof.garden</div><div class="tagline">logic proofs</div><div class="row"><span class="tag tease">soon</span></div></div>
    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">emerge.box</div><div class="tagline">conway's life</div><div class="row"><span class="tag tease">soon</span></div></div>
  </div>
</section>

<!-- WAVE 1 -->
<section class="panel" id="wave1">
  <h2>wave 1 — may 28 launch</h2>
  <p>five apps were named in the 06 may whirlpool as the adult/prme-plus/higher-ed launch lineup. the may 13 whirlpool agenda had "lock by today" on this list (t-15 days) — confirm the final five before the press kit. positioning below pulls from the harbour-launch-plan, the website cms, and product roadmap docs.</p>

  <div class="grid">

    <div class="card wave1">
      <div class="stripe"></div>
      <div class="meta">wave 1 · flagship</div>
      <div class="name">vertigo.vault</div>
      <div class="tagline">a growing library of group activities, ice-breakers, and energisers — designed for facilitators, educators, and trainers.</div>
      <div class="audience-strip"><strong>primary:</strong> higher-ed faculty and facilitators · <strong>secondary:</strong> learning designers · corporate l&amp;d</div>
      <div class="row"><span class="tag live">live</span><span class="tag">prme-aligned</span></div>
      <div class="body">the launch flagship. a curated gallery of ~22 facilitated activities organised by tier (prme / explorer / practitioner), with warm-up, connection, and transfer prompts. each card includes duration, format, skills developed, group size, materials. this is the app prme faculty have been touching during ppcs sessions; it's the warmest hand-off in the harbour.</div>
      <div class="pos">
        <h4>positioning</h4>
        <p><em>"facilitator-ready activities you can run tomorrow. researched, tested with prme faculty, free to sample."</em></p>
        <h4>why it leads the launch</h4>
        <p>highest polish, clearest "do tomorrow" value, direct ppcs alumni hand-off. the activities have been live-tested by the ~250 ppcs participants across the may sessions. sampler-to-paywall strategy doc already exists.</p>
        <h4>what to say in marketing</h4>
        <p>lead with one named activity by audience: facilitators (warm-up X), educators (connection Y), trainers (transfer Z). use a participant quote from the ppcs sessions. point at the certificate series as evidence of in-the-wild use.</p>
        <div class="url">windedvertigo.com/harbour/vertigo-vault</div>
      </div>
    </div>

    <div class="card wave1">
      <div class="stripe"></div>
      <div class="meta">wave 1 · credibility anchor</div>
      <div class="name">depth.chart</div>
      <div class="tagline">an ai-powered assessment task generator for educators who want to measure cross-cutting skills, not just content recall.</div>
      <div class="audience-strip"><strong>primary:</strong> higher-ed faculty · <strong>secondary:</strong> k-12 admins · l&amp;d professionals designing rubrics</div>
      <div class="row"><span class="tag live">live</span><span class="tag">21-skill framework</span></div>
      <div class="body">an assessment task generator built on the holistic skills framework (critical thinking, creative thinking, problem-solving, self-directed learning, collaboration) introduced in the prme intro sessions. give it a topic and a target skill and it produces tasks and rubrics aligned to that skill across social/behavioural and cognitive domains.</div>
      <div class="pos">
        <h4>positioning</h4>
        <p><em>"the rubric that meets you where you teach. tell it what you're already covering and it builds the assessment that names what students are learning."</em></p>
        <h4>why it leads the launch</h4>
        <p>direct artefact of the ppcs framework. solves a known pain (assessment that goes beyond recall) for the audience already in the room. credibility anchor — the 21-skill framework and un global compact branding sit behind it.</p>
        <h4>what to say in marketing</h4>
        <p>frame as "evidence for the work you're already doing" — not new content, but a way to surface the skills hidden in current curricula. faculty testimonial from ppcs is the killer asset.</p>
        <div class="url">windedvertigo.com/harbour/depth-chart</div>
      </div>
    </div>

    <div class="card wave1">
      <div class="stripe"></div>
      <div class="meta">wave 1 · systems thinking lead</div>
      <div class="name">lines.become.loops</div>
      <div class="tagline">a systems-thinking experience — see how cause-and-effect curls back on itself.</div>
      <div class="audience-strip"><strong>primary:</strong> higher-ed faculty · sustainability educators · <strong>secondary:</strong> facilitators teaching feedback loops</div>
      <div class="row"><span class="tag live">live</span><span class="tag">ppcs session 1</span></div>
      <div class="body">one of the four systems-thinking tools (alongside tidal.pool, and two others under repair). converts straight chains of cause-and-effect into the loops that actually drive systemic behaviour. ppcs session 1 ("from systems thinking to regenerative business") used this as a worked example.</div>
      <div class="pos">
        <h4>positioning</h4>
        <p><em>"the lecture you've given a hundred times, now a thing your students can move with their hands."</em></p>
        <h4>why it leads the launch</h4>
        <p>direct artefact of session 1. unique — there's no comparable lightweight interactive tool in the systems-thinking ed space. one of four tools meredith specifically mentioned as ppcs-aligned in the 06 may whirlpool.</p>
        <h4>what to say in marketing</h4>
        <p>opens the door for sustainability faculty and mba programmes. counter-intuitive frame: "your systems-thinking course was a slideshow. it doesn't have to be."</p>
        <div class="url">windedvertigo.com/harbour/lines-become-loops · export bugs flagged 05/01, fix-in-progress</div>
        <div class="flag" style="margin-top:8px"><strong>readiness flag:</strong> "fix lines-become-loops exports" was on the task list on 01 may. confirm exports are green before launch — this app has the most polish risk of the wave-1 five.</div>
      </div>
    </div>

    <div class="card wave1">
      <div class="stripe"></div>
      <div class="meta">wave 1 · demo unit</div>
      <div class="name">values.auction</div>
      <div class="tagline">trade your way to a value system — what you bid on shows what you stand for.</div>
      <div class="audience-strip"><strong>primary:</strong> ppcs participants · faculty teaching ethics and leadership · <strong>secondary:</strong> facilitators running off-sites</div>
      <div class="row"><span class="tag live">live</span><span class="tag">ppcs-derived</span></div>
      <div class="body">migrated to the harbour during the 27 apr ppcs prep session. a values-exploration activity where participants "bid" on competing values under scarcity. surfaces what people actually privilege when forced to choose — a corrective to the way written values lists let everyone pretend they care equally about everything.</div>
      <div class="pos">
        <h4>positioning</h4>
        <p><em>"the values exercise that doesn't let you have it all."</em></p>
        <h4>why it leads the launch</h4>
        <p>active artefact from the most recent ppcs work — the migration was the centrepiece of the 27 apr prep meeting. ships with the lived credibility of having been run with real cohorts. easy to demo as a stand-alone experience.</p>
        <h4>what to say in marketing</h4>
        <p>show, don't tell. a short demo video of the auction running, two participants visibly choosing, the surfaced contrast at the end. ends with the prompt: "what would you have bid?"</p>
        <div class="url">windedvertigo.com/harbour/values-auction (confirm slug)</div>
      </div>
    </div>

    <div class="card wave1">
      <div class="stripe"></div>
      <div class="meta">wave 1 · decolonisation entry</div>
      <div class="name">feel.cards</div>
      <div class="tagline">prompt cards for naming emotions that classroom english doesn't have words for.</div>
      <div class="audience-strip"><strong>primary:</strong> prme faculty · facilitators working in cross-cultural settings · <strong>secondary:</strong> educators teaching decolonisation, dei</div>
      <div class="row"><span class="tag live">live</span><span class="tag">prme</span></div>
      <div class="body">decolonisation-framed emotional prompt cards — drawing in language and concepts that aren't always present in dominant-culture vocabulary. the launch lineup item closest to ppcs session 4 (cross-cultural and decolonisation) and session 5 (contemplative). small surface area, deep payoff.</div>
      <div class="pos">
        <h4>positioning</h4>
        <p><em>"the words your students don't have yet — and the practice of finding them."</em></p>
        <h4>why it leads the launch</h4>
        <p>fills the "soft skills and decolonisation" corner of the wave-1 lineup that vertigo.vault doesn't cover head-on. signals to prme participants that the harbour reflects the full series, not just the systems-thinking sessions.</p>
        <h4>what to say in marketing</h4>
        <p>lead with maria's voice. quote a ppcs participant. keep this one understated — feel.cards is the wave-1 entry where over-marketing would betray the content. one well-chosen post is better than a campaign.</p>
        <div class="url">windedvertigo.com/harbour/feel-cards (confirm slug)</div>
      </div>
    </div>

  </div>

  <h3>shared positioning notes for the wave-1 set</h3>
  <ul>
    <li><strong>audience framing:</strong> "prime plus / adult / higher-ed" — decided 06 may. avoid kids/family language in any wave-1 copy; that's wave 2's job.</li>
    <li><strong>monetisation:</strong> free sample, then ad-supported, then subscription or pack purchases. wave 1 keeps the free sample generous to let ppcs alumni walk in without friction.</li>
    <li><strong>credibility anchor:</strong> un global compact / prme certification system and the ~250 educators who just lived through ppcs. use it explicitly in press pitches, with permission.</li>
    <li><strong>ip note:</strong> tier 1 content is shared with prme; tiers 2–3 are w.v ip and monetisable. depth.chart in particular: pending meredith's ownership clarity before final launch copy.</li>
  </ul>
</section>

<!-- WAVE 2 -->
<section class="panel" id="wave2">
  <h2>wave 2 — end of june launch</h2>
  <p>the kids/family pier. decided at the 06 may whirlpool to defer this from the may 28 launch so the team has time for co-creation with children, and to align with school holidays and the prime global conference in june. the wave-2 launch becomes the centre of a parent/educator summer campaign.</p>

  <div class="grid">

    <div class="card wave2">
      <div class="stripe"></div>
      <div class="meta">wave 2 · flagship</div>
      <div class="name">creaseworks</div>
      <div class="tagline">design a playful experience. run it with a real group. see what actually changed.</div>
      <div class="audience-strip"><strong>primary:</strong> parents · k-12 educators · <strong>secondary:</strong> learning designers · creative practitioners</div>
      <div class="row"><span class="tag soon">jun</span><span class="tag">curriculum potential</span></div>
      <div class="body">a creativity platform built around "playdates" — designed activities with find, fold, and unfold phases, material relations, friction dials, and a reflection loop. the 06 may whirlpool flagged this as "potentially huge standalone product with significant curricular potential" — full education packages with lesson plans and standards alignment are within reach.</div>
      <div class="pos">
        <h4>positioning</h4>
        <p><em>"the only screen time you'll keep on the calendar. design a play, run it with your kid, see what changes."</em></p>
        <h4>why it leads wave 2</h4>
        <p>most polished kids/family app, runtime-api'd into notion, with full content cms (playdates, materials, packs, collections, site copy, app config). already has user reflection logs from pilot use ("cloud cartographer activity successfully played" — 12 mar weekly).</p>
        <h4>what to say in marketing</h4>
        <p>video demo of a real playdate with a real kid. show the fold (the live activity) and the unfold (what the parent noticed afterward). target the conscious-parenting and play-based-learning niche on instagram and reddit's r/Montessori and r/homeschool.</p>
        <div class="url">windedvertigo.com/harbour/creaseworks · stripe-ready · auth shared with vertigo.vault</div>
      </div>
    </div>

    <div class="card wave2">
      <div class="stripe"></div>
      <div class="meta">wave 2 · multiplayer lead</div>
      <div class="name">raft.house</div>
      <div class="tagline">a facilitated, real-time learning platform that helps groups cross threshold concepts through play.</div>
      <div class="audience-strip"><strong>primary:</strong> teachers · facilitators · <strong>secondary:</strong> camp counsellors · family game nights</div>
      <div class="row"><span class="tag soon">jun</span><span class="tag">real-time</span></div>
      <div class="body">multiplayer, room-code-based experiences for crossing threshold concepts — classic-crossing, detective, paradigm-shift, empathy-engine, and custom templates. partykit and cloudflare durable objects under the hood. session templates live in notion and are queried at runtime so facilitators can pick a session and go.</div>
      <div class="pos">
        <h4>positioning</h4>
        <p><em>"escape-room mechanics for the moment a class actually has to think together."</em></p>
        <h4>why it leads wave 2</h4>
        <p>multiplayer is a natural fit for school holidays (family game nights, camps) and the prime global conference attendees who teach. it also bridges to wave 1 — a facilitator who buys vertigo.vault is one step from a raft.house room code.</p>
        <h4>what to say in marketing</h4>
        <p>position alongside escape rooms, jackbox, gather.town — but for learning. show the room-code workflow (no accounts needed for participants). target both family and classroom in two parallel mini-campaigns.</p>
        <div class="url">windedvertigo.com/harbour/raft-house · raft.house may also stand as its own domain</div>
      </div>
    </div>

    <div class="card wave2">
      <div class="stripe"></div>
      <div class="meta">wave 2 · conversation primer</div>
      <div class="name">deep.deck</div>
      <div class="tagline">a card game for teachers and parents who want to actually connect with kids.</div>
      <div class="audience-strip"><strong>primary:</strong> parents · families · <strong>secondary:</strong> teachers · therapists · social workers</div>
      <div class="row"><span class="tag soon">jun</span><span class="tag">low-prep</span></div>
      <div class="body">conversation cards — no prep, just play. the 06 may whirlpool already started seeing this as a wave-2 lead because the parent/family audience is wave 2's reason to exist. pair with creaseworks (the "what we did" tool) as the "what we talked about" tool.</div>
      <div class="pos">
        <h4>positioning</h4>
        <p><em>"the conversation you keep meaning to have, in a format that takes the pressure off both of you."</em></p>
        <h4>why it leads wave 2</h4>
        <p>lowest friction app in the harbour. great social-media demo unit (one card, one conversation, one short clip). natural cross-promotion with creaseworks ("design a playdate" then "ask one card after").</p>
        <h4>what to say in marketing</h4>
        <p>lead with the screen-time inversion: "twenty minutes off your phone, one card, one kid." partner with the conscious-parenting micro-influencer list payton built in apr. point library story-time networks at it as a free distribution opportunity.</p>
        <div class="url">windedvertigo.com/harbour/deep-deck</div>
      </div>
    </div>

  </div>

  <h3>shared positioning notes for the wave-2 set</h3>
  <ul>
    <li><strong>visual shift:</strong> "wizard of oz transition" from the wave-1 brand — more colour, more animation, while keeping the harbour's overall design language. customisation controls (palette, motion) honour the accessibility guide jamie is preparing.</li>
    <li><strong>timing:</strong> aligned with school holidays and the prime global conference in june. summer = peak attention from parents looking for "screen time that matters."</li>
    <li><strong>co-creation:</strong> use the late-may to mid-june gap to run sessions with real kids before launch. sufi, alfie, egypt and other team kids surfaced in the 06 may whirlpool as natural testers.</li>
    <li><strong>cross-sell engine:</strong> a wave-1 user (facilitator using vertigo.vault) is naturally a wave-2 user (parent or classroom teacher with kids). build the in-app nudge from one app to the other.</li>
  </ul>
</section>

<!-- WAVE 3 / COMING SOON -->
<section class="panel" id="wave3">
  <h2>coming soon — the threshold-concept micro-apps</h2>
  <p>fourteen smaller experiences shipped to the harbour as "threshold concept apps" (per the 06 apr slack post: "we've just deployed 11 new threshold concept apps — bringing the total to 19"). each one is a 5–15 minute aha-moment around a single concept. surface them as a "coming soon" wall on the wave-1 landing — they tell the visitor the harbour has depth, without committing to a launch promise on each.</p>

  <div class="callout">
    <strong>recommended treatment in the may 28 site:</strong> a single "coming soon" section below the wave-1 five. each tile is greyed (not hidden), shows the name and one-line description, and a "notify me" email capture. this also seeds the wave-2 and beyond email list.
  </div>

  <div class="grid">

    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">tidal.pool</div>
      <div class="tagline">drop elements into the pool, draw connections, watch how everything affects everything else.</div>
      <div class="body">systems-thinking sibling to lines.become.loops. an interactive web where every node nudges every other. two notion data sources back it (elements and scenarios). a top wave-3 candidate to "graduate" early if a slot opens.</div>
      <div class="url">windedvertigo.com/harbour/tidal-pool</div>
    </div>

    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">paper.trail</div>
      <div class="tagline">photograph everyday objects, annotate what you notice, build a personal field study.</div>
      <div class="body">camera-based observation game. used in early "first fold" demos. quietly the most "play for all" experience in the set — works for kids, parents, researchers, anyone with a phone.</div>
      <div class="url">windedvertigo.com/harbour/paper-trail</div>
    </div>

    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">mirror.log</div>
      <div class="tagline">your reflection dashboard across the harbour — see patterns in how you learn.</div>
      <div class="body">cross-harbour reflection layer. only meaningful once a user has played with two or more apps. perfect "stay for a while" hook after launch.</div>
      <div class="url">windedvertigo.com/harbour/mirror-log</div>
    </div>

    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">bias.lens</div>
      <div class="tagline">three interactive scenarios that reveal how cognitive biases shape your decisions.</div>
      <div class="body">corporate l&amp;d crossover candidate. high demo-ability, runs in under 10 minutes.</div>
      <div class="url">windedvertigo.com/harbour/bias-lens</div>
    </div>

    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">time.prism</div>
      <div class="tagline">step into a historical decision without hindsight. the challenger launch, the cuban missile crisis.</div>
      <div class="body">history and decision-science. could anchor an ed-press pitch all on its own ("learn what happens when you remove hindsight").</div>
      <div class="url">windedvertigo.com/harbour/time-prism</div>
    </div>

    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">liminal.pass</div>
      <div class="tagline">three puzzles designed to trigger aha moments — including the nine dots problem.</div>
      <div class="body">classic insight problems with light-touch instrumentation. accessible to any audience.</div>
      <div class="url">windedvertigo.com/harbour/liminal-pass</div>
    </div>

    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">pattern.weave</div>
      <div class="tagline">three gestalt psychology puzzles that reveal how your brain organises information.</div>
      <div class="body">research-flavoured. natural pair with bias.lens for a "how your mind works" doubleheader.</div>
      <div class="url">windedvertigo.com/harbour/pattern-weave</div>
    </div>

    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">rhythm.lab</div>
      <div class="tagline">a 4×4 step sequencer with synthesised drum sounds. tap out beats, layer them up.</div>
      <div class="body">creativity playground. teachers running music and maths cross-overs will love it. great social-share unit.</div>
      <div class="url">windedvertigo.com/harbour/rhythm-lab</div>
    </div>

    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">orbit.lab</div>
      <div class="tagline">launch rockets into orbit around planets in this 2D gravity simulation.</div>
      <div class="body">physics intuition builder. wave-3 candidate that could anchor a stem-teacher push later.</div>
      <div class="url">windedvertigo.com/harbour/orbit-lab</div>
    </div>

    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">code.weave</div>
      <div class="tagline">watch a recursion tree unfold as factorial(5) computes. each branch a call.</div>
      <div class="body">cs concepts made visible. small but charming. cs educator linkedin gold.</div>
      <div class="url">windedvertigo.com/harbour/code-weave</div>
    </div>

    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">market.mind</div>
      <div class="tagline">allocate resources between two goods with dual sliders. ghost overlays show alternatives.</div>
      <div class="body">economics intuition. could pair with values.auction in a wave-1 follow-on cluster.</div>
      <div class="url">windedvertigo.com/harbour/market-mind</div>
    </div>

    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">scale.shift</div>
      <div class="tagline">zoom from atoms to galaxies in a powers-of-ten scale explorer.</div>
      <div class="body">a classic teacher pleaser. high "share with my class" potential.</div>
      <div class="url">windedvertigo.com/harbour/scale-shift</div>
    </div>

    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">proof.garden</div>
      <div class="tagline">drag and connect logic nodes to build a syllogistic proof.</div>
      <div class="body">philosophy and logic teachers. low audience volume but high-value when found.</div>
      <div class="url">windedvertigo.com/harbour/proof-garden</div>
    </div>

    <div class="card wave3"><div class="stripe"></div><div class="meta">coming soon</div><div class="name">emerge.box</div>
      <div class="tagline">conway's game of life — simple rules, complex behaviour. place cells, watch them evolve.</div>
      <div class="body">complexity-thinking gateway drug. natural neighbour of tidal.pool and lines.become.loops in a "systems wing" of the harbour.</div>
      <div class="url">windedvertigo.com/harbour/emerge-box</div>
    </div>

  </div>
</section>

<!-- IA -->
<section class="panel" id="ia">
  <h2>information architecture — the piers model</h2>
  <p>the 06 may whirlpool decided on a "piers" metaphor for organising the harbour by audience. three piers maps cleanly onto the three waves; a fourth "drydock" is a friendly home for the coming-soon apps. this also gives the website a natural home for browse-by-role nav.</p>

  <div class="diagram-wrap">
    <svg class="ia-svg" viewBox="0 0 1000 620" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="harbour information architecture diagram: landing routes to four piers, each pier holds its apps">
      <defs>
        <style>
          .ia-label-lg { font: 600 16px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; fill: #2a2420; }
          .ia-label-md { font: 600 13px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; fill: #2a2420; }
          .ia-label-sub { font: 400 11.5px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; fill: #6b5e54; }
          .ia-label-app { font: 500 11.5px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; fill: #2a2420; }
          .ia-label-mono { font: 500 11px ui-monospace, "SF Mono", Menlo, Consolas, monospace; fill: #6b5e54; }
          .ia-pill { font: 600 9.5px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; letter-spacing: 0.1em; }
          .conn { stroke: #d9cdb9; stroke-width: 1.5; fill: none; }
        </style>
      </defs>

      <!-- Hub -->
      <rect x="340" y="20" width="320" height="78" rx="12" fill="#b9d6dd" stroke="#4a6a78" stroke-width="1.5"/>
      <text x="500" y="48" text-anchor="middle" class="ia-label-lg">the harbour landing</text>
      <text x="500" y="68" text-anchor="middle" class="ia-label-mono">windedvertigo.com/harbour</text>
      <text x="500" y="86" text-anchor="middle" class="ia-label-sub">single entry point · "who are you?" picker (optional v1.1)</text>

      <!-- Connectors from hub to piers -->
      <path class="conn" d="M 500 98 C 500 140, 130 140, 130 178" />
      <path class="conn" d="M 500 98 C 500 140, 376 140, 376 178" />
      <path class="conn" d="M 500 98 C 500 140, 624 140, 624 178" />
      <path class="conn" d="M 500 98 C 500 140, 870 140, 870 178" />

      <!-- Pier A -->
      <rect x="20" y="178" width="220" height="106" rx="12" fill="#fbe5dc" stroke="#7a3a2e" stroke-width="1.5"/>
      <rect x="20" y="178" width="6" height="106" rx="3" fill="#7a3a2e"/>
      <text x="38" y="200" class="ia-pill" fill="#7a3a2e">PIER A · WAVE 1</text>
      <text x="38" y="222" class="ia-label-md">workplace and leadership</text>
      <text x="38" y="240" class="ia-label-sub">facilitators · l&amp;d</text>
      <text x="38" y="256" class="ia-label-sub">corporate trainers</text>
      <text x="38" y="272" class="ia-label-sub">off-site designers</text>

      <!-- Pier B -->
      <rect x="266" y="178" width="220" height="106" rx="12" fill="#fbe5dc" stroke="#7a3a2e" stroke-width="1.5"/>
      <rect x="266" y="178" width="6" height="106" rx="3" fill="#7a3a2e"/>
      <text x="284" y="200" class="ia-pill" fill="#7a3a2e">PIER B · WAVE 1</text>
      <text x="284" y="222" class="ia-label-md">classroom and higher-ed</text>
      <text x="284" y="240" class="ia-label-sub">prme faculty</text>
      <text x="284" y="256" class="ia-label-sub">educators · sustainability</text>
      <text x="284" y="272" class="ia-label-sub">mba programmes</text>

      <!-- Pier C -->
      <rect x="514" y="178" width="220" height="106" rx="12" fill="#fde8d3" stroke="#c87b4c" stroke-width="1.5"/>
      <rect x="514" y="178" width="6" height="106" rx="3" fill="#c87b4c"/>
      <text x="532" y="200" class="ia-pill" fill="#c87b4c">PIER C · WAVE 2</text>
      <text x="532" y="222" class="ia-label-md">family play</text>
      <text x="532" y="240" class="ia-label-sub">parents · families</text>
      <text x="532" y="256" class="ia-label-sub">k-12 educators</text>
      <text x="532" y="272" class="ia-label-sub">libraries · summer programmes</text>

      <!-- Drydock -->
      <rect x="760" y="178" width="220" height="106" rx="12" fill="#ece4d3" stroke="#6b5e54" stroke-width="1.5"/>
      <rect x="760" y="178" width="6" height="106" rx="3" fill="#6b5e54"/>
      <text x="778" y="200" class="ia-pill" fill="#6b5e54">DRYDOCK · COMING SOON</text>
      <text x="778" y="222" class="ia-label-md">threshold-concept apps</text>
      <text x="778" y="240" class="ia-label-sub">learning designers</text>
      <text x="778" y="256" class="ia-label-sub">researchers</text>
      <text x="778" y="272" class="ia-label-sub">curious adults</text>

      <!-- Connectors from piers to app boxes -->
      <path class="conn" d="M 130 284 L 130 314" />
      <path class="conn" d="M 376 284 L 376 314" />
      <path class="conn" d="M 624 284 L 624 314" />
      <path class="conn" d="M 870 284 L 870 314" />

      <!-- App boxes -->
      <rect x="20" y="314" width="220" height="160" rx="10" fill="#ffffff" stroke="#d9cdb9" stroke-width="1.2"/>
      <text x="38" y="336" class="ia-label-app">vertigo.vault</text>
      <text x="38" y="356" class="ia-label-app">values.auction</text>
      <text x="38" y="376" class="ia-label-app">feel.cards</text>
      <text x="38" y="408" class="ia-label-sub">three apps · all wave 1</text>
      <text x="38" y="426" class="ia-label-sub">facilitator-ready</text>
      <text x="38" y="444" class="ia-label-sub">most monetisable pier</text>
      <text x="38" y="462" class="ia-label-sub">short-run revenue lead</text>

      <rect x="266" y="314" width="220" height="160" rx="10" fill="#ffffff" stroke="#d9cdb9" stroke-width="1.2"/>
      <text x="284" y="336" class="ia-label-app">depth.chart</text>
      <text x="284" y="356" class="ia-label-app">vertigo.vault</text>
      <text x="284" y="376" class="ia-label-app">lines.become.loops</text>
      <text x="284" y="396" class="ia-label-app">feel.cards</text>
      <text x="284" y="424" class="ia-label-sub">four apps · all wave 1</text>
      <text x="284" y="442" class="ia-label-sub">warmest hand-off —</text>
      <text x="284" y="458" class="ia-label-sub">250 ppcs alumni land here</text>

      <rect x="514" y="314" width="220" height="160" rx="10" fill="#ffffff" stroke="#d9cdb9" stroke-width="1.2"/>
      <text x="532" y="336" class="ia-label-app">creaseworks</text>
      <text x="532" y="356" class="ia-label-app">raft.house</text>
      <text x="532" y="376" class="ia-label-app">deep.deck</text>
      <text x="532" y="408" class="ia-label-sub">three apps · all wave 2</text>
      <text x="532" y="426" class="ia-label-sub">opens late june</text>
      <text x="532" y="444" class="ia-label-sub">waitlist on the may 28 site</text>

      <rect x="760" y="314" width="220" height="160" rx="10" fill="#ffffff" stroke="#d9cdb9" stroke-width="1.2"/>
      <text x="778" y="336" class="ia-label-app">tidal.pool · paper.trail</text>
      <text x="778" y="356" class="ia-label-app">mirror.log · bias.lens</text>
      <text x="778" y="376" class="ia-label-app">time.prism · liminal.pass</text>
      <text x="778" y="396" class="ia-label-app">pattern.weave · rhythm.lab</text>
      <text x="778" y="416" class="ia-label-app">orbit.lab · code.weave</text>
      <text x="778" y="436" class="ia-label-app">market.mind · scale.shift</text>
      <text x="778" y="456" class="ia-label-app">proof.garden · emerge.box</text>

      <!-- Cross-pier sharing note -->
      <text x="500" y="510" text-anchor="middle" class="ia-label-sub" font-style="italic">vertigo.vault and feel.cards live in both pier a and pier b (multi-select cms field)</text>

      <!-- Bottom routes legend -->
      <rect x="20" y="540" width="960" height="64" rx="10" fill="#faf6ef" stroke="#d9cdb9"/>
      <text x="36" y="562" class="ia-label-md">concrete site routes</text>
      <text x="36" y="582" class="ia-label-mono">/harbour · /harbour/pier/leadership · /harbour/pier/classroom · /harbour/pier/family · /harbour/drydock</text>
      <text x="36" y="598" class="ia-label-sub">individual app routes stay at /harbour/{slug} (vertigo-vault, depth-chart, etc.) — piers are aggregator pages over them.</text>
    </svg>
  </div>

  <div class="piers">
    <div class="pier pier-a">
      <div class="label">pier a · wave 1</div>
      <h3>workplace and leadership</h3>
      <p class="who">facilitators · l&amp;d · corporate trainers · off-site designers</p>
      <ul>
        <li><strong>vertigo.vault</strong> <span class="muted">— flagship activity gallery</span></li>
        <li><strong>values.auction</strong> <span class="muted">— values exploration under scarcity</span></li>
        <li><strong>feel.cards</strong> <span class="muted">— emotional prompt cards</span></li>
      </ul>
      <p class="note">"the team off-site or workshop you actually want to be in." this pier is the most monetisable in the short run — corporate l&amp;d has budget the higher-ed and family piers don't.</p>
    </div>
    <div class="pier pier-b">
      <div class="label">pier b · wave 1</div>
      <h3>classroom and higher-ed</h3>
      <p class="who">prme faculty · educators · sustainability and mba programmes</p>
      <ul>
        <li><strong>depth.chart</strong> <span class="muted">— skills-anchored assessment</span></li>
        <li><strong>vertigo.vault</strong> <span class="muted">— shared with pier a</span></li>
        <li><strong>lines.become.loops</strong> <span class="muted">— systems thinking</span></li>
        <li><strong>feel.cards</strong> <span class="muted">— shared with pier a</span></li>
      </ul>
      <p class="note">"the prme certificate series, alive between sessions." this pier is the warmest hand-off — 250 educators just walked through ppcs and are ready to keep going.</p>
    </div>
    <div class="pier pier-c">
      <div class="label">pier c · wave 2 · opens late june</div>
      <h3>family play</h3>
      <p class="who">parents · families · k-12 educators · libraries</p>
      <ul>
        <li><strong>creaseworks</strong> <span class="muted">— design and run a playdate</span></li>
        <li><strong>raft.house</strong> <span class="muted">— multiplayer room codes</span></li>
        <li><strong>deep.deck</strong> <span class="muted">— conversation cards</span></li>
      </ul>
      <p class="note">"screen time that matters." closed on may 28 (shows as "coming end of june — sign up to be first in"). opens with the summer/back-to-school campaign.</p>
    </div>
    <div class="pier dry">
      <div class="label">drydock · coming soon</div>
      <h3>threshold-concept micro-apps</h3>
      <p class="who">curious adults · researchers · learning designers · cs/sci educators</p>
      <ul>
        <li>14 threshold-concept micro-apps</li>
        <li>tease as tiles with "notify me"</li>
        <li>graduates promoted to a pier when polished</li>
      </ul>
      <p class="note">"the back rooms of the harbour where new vessels are still being fitted out." doubles as the email-capture funnel for wave-2 and beyond.</p>
    </div>
  </div>

  <h3>website architecture — concrete routing</h3>
  <ul>
    <li><span class="code-snip">/harbour</span> — landing. hero ("the harbour is open"), the three piers as visual zones, drydock as the coming-soon wall.</li>
    <li><span class="code-snip">/harbour/pier/leadership</span> · <span class="code-snip">/harbour/pier/classroom</span> · <span class="code-snip">/harbour/pier/family</span> — pier index pages. each holds 3–4 app cards filtered for that audience.</li>
    <li><span class="code-snip">/harbour/{app-slug}</span> — existing app routes stay where they are (vertigo-vault, depth-chart, etc).</li>
    <li><span class="code-snip">/harbour/drydock</span> — the coming-soon wall and email capture.</li>
    <li><span class="code-snip">/harbour/start</span> — a "who are you" picker that routes new visitors to the right pier (optional v1, valuable v1.1).</li>
  </ul>

  <h3>cms recommendation</h3>
  <p>add two fields to the <strong>harbour games</strong> notion database to support the piers model without a schema overhaul:</p>
  <ul>
    <li><strong>pier</strong> (multi-select: leadership · classroom · family · drydock). an app can live in two piers (vertigo.vault and feel.cards do).</li>
    <li><strong>launch wave</strong> (select: wave-1 · wave-2 · coming-soon). this drives the visual treatment on the landing.</li>
  </ul>
  <p>both fields stay backwards-compatible with the existing <span class="code-snip">Status</span> field (live · coming-soon) — they just give the cms enough to drive a more sophisticated landing.</p>
</section>

<!-- MARKETING -->
<section class="panel" id="marketing">
  <h2>marketing arc — may 18 through end of june</h2>
  <p>built on top of payton's may–july content plan, the harbour-launch-plan (from 03 april), and the 06 may cmo review's "next steps." the calendar already has slots for harbour content; this just fills them.</p>

  <div class="timeline">

    <div class="t-row">
      <div class="when">now → fri 22 may</div>
      <div class="what"><strong>phase 0 — finish wave 1</strong></div>
      <div class="detail">lock the final five. fix lines-become-loops exports. write per-app one-liners (jamie?). meta business portfolio setup (10 min, unblocks ig and fb analytics). draft 5 press pitches.</div>
    </div>

    <div class="t-row">
      <div class="when">mon 18 → fri 22 may</div>
      <div class="what">prme posts and fold substack #2 (wed 20 may)</div>
      <div class="detail">the substack lands inside this window; carries the "fold" arc which the harbour visually embodies. ride it.</div>
    </div>

    <div class="t-row">
      <div class="when">sun 17 → fri 22 may</div>
      <div class="what">book the harbour preview session (30 min, recorded)</div>
      <div class="detail">cmo's #4 recommendation. gives the launch email a real cta. one zoom, payton or lamis demos the five wave-1 apps live.</div>
    </div>

    <div class="t-row launch">
      <div class="when">wed 27 may</div>
      <div class="what"><strong>tease post</strong> — "something is opening"</div>
      <div class="detail">image-led, no app names. point at the harbour url. ride the play@ted tail (may 14 launched 14 days earlier).</div>
    </div>

    <div class="t-row launch">
      <div class="when">thu 28 may</div>
      <div class="what"><strong>LAUNCH — the harbour opens</strong></div>
      <div class="detail">top-level reveal. all five wave-1 apps live. drydock visible as "coming soon" wall. wave-2 apps shown with "join the waitlist." aligned with the final ppcs session — 250+ educators step from cert into harbour. launch email and social blitz.</div>
    </div>

    <div class="t-row launch">
      <div class="when">fri 29 may</div>
      <div class="what">walk-through post</div>
      <div class="detail">"you've arrived — here's where to start" framing. links to harbour preview zoom recording.</div>
    </div>

    <div class="t-row">
      <div class="when">mon 01 jun</div>
      <div class="what">harbour rollout #1 — whole-harbour reflection</div>
      <div class="detail">"what we've heard in 72 hours." testimonials from ppcs alumni. press play co-brand call-out optional.</div>
    </div>

    <div class="t-row">
      <div class="when">tue 02 jun</div>
      <div class="what">harbour rollout #2 — audience post (pier a or b)</div>
      <div class="detail">"if you're a facilitator, here's why this is for you." mirror with a higher-ed faculty post.</div>
    </div>

    <div class="t-row">
      <div class="when">wed 03 jun</div>
      <div class="what">unfold substack #3 (publishes anyway)</div>
      <div class="detail">essay arc continues. light backlink to depth.chart as "what unfolding looks like in assessment."</div>
    </div>

    <div class="t-row">
      <div class="when">mon 08 jun</div>
      <div class="what">harbour rollout #3 — app spotlight (depth.chart)</div>
      <div class="detail">deep dive. educator quote from ppcs. show, don't tell.</div>
    </div>

    <div class="t-row">
      <div class="when">tue 09 jun</div>
      <div class="what">harbour rollout #4 — app spotlight (vertigo.vault)</div>
      <div class="detail">deep dive. one named activity. video of it being facilitated.</div>
    </div>

    <div class="t-row">
      <div class="when">wed 10 jun</div>
      <div class="what">find again substack #4</div>
      <div class="detail">closes the essay arc the day before wave-2 prep cycle starts.</div>
    </div>

    <div class="t-row wave2">
      <div class="when">mon 15 jun → fri 26 jun</div>
      <div class="what"><strong>wave-2 ramp</strong> — tease creaseworks, raft.house, deep.deck</div>
      <div class="detail">parent and educator outreach lists activate. partner with sesame workshop contacts and library story-time networks. micro-influencer push (5–8 parents w/ 10–50k followers each). press pitches to motherly, fatherly, pbs parents.</div>
    </div>

    <div class="t-row wave2">
      <div class="when">last week of june (target)</div>
      <div class="what"><strong>WAVE 2 LAUNCH — the family pier opens</strong></div>
      <div class="detail">aligned with school holidays and prime global conference. creaseworks, raft.house, deep.deck go live. iste+ascd (28 jun – 01 jul, orlando) is the in-person amplifier.</div>
    </div>

  </div>

  <h3>three things the marketing plan still needs</h3>
  <ol>
    <li><strong>per-app one-liners.</strong> open question from the may 13 whirlpool — "who writes the 4–6 harbour app one-liners — jamie, garrett, or distributed?" recommend jamie writes, the team edits, by may 22.</li>
    <li><strong>five press pitches.</strong> cmo recommended by mon 11 may. priority: edsurge, edweek, eschool news, learning sciences exchange, the 74. anchor on the un global compact and prme story.</li>
    <li><strong>warm contact batch.</strong> q2–q3 plan asks for 50 personalised outreach emails. no evidence yet in slack/gmail that the batch has started. these should be the launch email recipients, not cold to it.</li>
  </ol>

  <h3>cross-promotional engines (already designed)</h3>
  <ul>
    <li><strong>the harbour bundle effect</strong> — every app surfaces the harbour home and cross-links to neighbours. (in the launch plan.)</li>
    <li><strong>whirlpool as launch vehicle</strong> — dedicate the may whirlpool to a live demo and breakout-room app trials.</li>
    <li><strong>prme as credibility anchor</strong> — depth.chart and vertigo.vault inherit prme/un-global-compact credibility for higher-ed marketing.</li>
    <li><strong>sesame workshop connection</strong> — existing w.v relationship into discovery education early learning channel and pbs partnerships for wave 2.</li>
    <li><strong>multiplier campaign</strong> (garrett's may 03 idea) — co-brand w.v with lightbulb, press play, care for education, education for sharing across q3.</li>
  </ul>
</section>

<!-- HANDOFF -->
<section class="panel" id="handoff">
  <h2>hand-off notes for claude code</h2>
  <p>what to migrate this research into when you switch over to claude code. these are the concrete changes to the codebase and cms — plus the specific path to host this page team-only at <span class="code-snip">port.windedvertigo.com</span>.</p>

  <div class="handoff">
    <h3>0. host this page on the port (team-only)</h3>
    <p>the port runs on <strong>cloudflare workers</strong> (full vercel decommission completed 11 may 2026) and already does google oauth gating for <span class="code-snip">@windedvertigo.com</span> emails — same allowlist as the docent, with the <span class="code-snip">AUTH_URL</span> secret fixed during the workers migration. drop the html into the port app and you get team-only access for free.</p>
    <ol>
      <li>open the repo that hosts the port in claude code. find <span class="code-snip">wrangler.jsonc</span> and <span class="code-snip">app/docent/page.tsx</span> first to ground yourself in the layout.</li>
      <li>copy <span class="code-snip">harbour_launch_map.html</span> from your projects folder into <span class="code-snip">port/public/harbour-launch-map.html</span> — if the worker's <span class="code-snip">assets</span> binding serves <span class="code-snip">public/</span> and the auth middleware covers static paths, you're done.</li>
      <li>alternative — render it as a next.js route at <span class="code-snip">port/app/harbour-launch-map/page.tsx</span> that returns the html with <span class="code-snip">dangerouslySetInnerHTML</span> reading the file at build time. use this if static assets bypass auth, or you want a clean url without the <span class="code-snip">.html</span> extension. match the docent's <span class="code-snip">runtime</span> setting.</li>
      <li>confirm the route is protected by the existing auth.js / google oauth middleware (same as the docent at <span class="code-snip">port.windedvertigo.com/docent</span>).</li>
      <li>commit and push. cloudflare pages auto-builds, or run <span class="code-snip">pnpm run deploy</span> / <span class="code-snip">wrangler deploy</span> from the port root — depends on the port's setup. tail with <span class="code-snip">wrangler tail</span> if anything looks off. share the url in slack ahead of monday's whirlpool: <span class="code-snip">port.windedvertigo.com/harbour-launch-map</span>.</li>
    </ol>
    <p class="note">if you'd rather not touch the port: drop the html as a github gist and share the rendered url. no auth gate, but quickest for one-off internal sharing if the port deploy is blocked.</p>
  </div>

  <div class="handoff" style="margin-top:14px">
    <h3>1. cms (notion) — minimal additions</h3>
    <ol>
      <li>add <strong>launch wave</strong> field to <span class="code-snip">harbour games</span> db (select: wave-1, wave-2, coming-soon).</li>
      <li>add <strong>pier</strong> field to <span class="code-snip">harbour games</span> db (multi-select: leadership, classroom, family, drydock).</li>
      <li>backfill all existing entries with both fields. use the wave and pier mapping in the "wave 1", "wave 2", "coming soon" tabs of this map.</li>
      <li>add <strong>tagline</strong> and <strong>one-liner</strong> text fields if not present. populate from this map's positioning briefs as starter copy (edit before publishing).</li>
      <li>confirm two slugs: <span class="code-snip">values-auction</span> and <span class="code-snip">feel-cards</span>. these don't appear in the harbour games db search results — they may live under different slugs or in vertigo.vault as activity entries rather than standalone apps.</li>
    </ol>
  </div>

  <div class="handoff" style="margin-top:14px">
    <h3>2. site (windedvertigo / harbour next.js app)</h3>
    <ol>
      <li>refactor the <span class="code-snip">/harbour</span> landing to render <em>by pier</em>, not as a flat grid. pier sections collapse coming-soon apps into a single "drydock" wall.</li>
      <li>add four new routes: <span class="code-snip">/harbour/pier/leadership</span>, <span class="code-snip">/harbour/pier/classroom</span>, <span class="code-snip">/harbour/pier/family</span>, <span class="code-snip">/harbour/drydock</span>.</li>
      <li>family pier renders in "coming end of june" state until launch — a single hero card with a waitlist email capture, plus greyed tiles for creaseworks, raft.house, deep.deck.</li>
      <li>drydock renders the 14 threshold-concept apps as tease tiles with "notify me" capture. on launch day each tile says "available {month}" if there's an internal plan, else "in development."</li>
      <li>add a "who are you?" picker as <span class="code-snip">/harbour/start</span> (optional for v1; valuable for v1.1). three buttons: i'm a facilitator into pier a · i teach into pier b · i'm a parent into pier c.</li>
      <li>update <span class="code-snip">scripts/fetch-notion.js</span> to pull the new <strong>launch wave</strong> and <strong>pier</strong> fields. cache as static json (existing pattern).</li>
    </ol>
  </div>

  <div class="handoff" style="margin-top:14px">
    <h3>3. analytics and ops (pre-launch)</h3>
    <ol>
      <li>meta business portfolio setup — 10 min, unblocks ig and fb analytics on the strategy page (cmo's #2 recommendation).</li>
      <li>wire up substack and linkedin api endpoints (or manual monthly entry) so the strategy page kpi cards stop showing null.</li>
      <li>add utm parameters per channel to launch email and social posts. follow the convention in the harbour-launch-plan ("set up tracking" line).</li>
      <li>verify <span class="code-snip">/harbour</span> and each app handle the 250+ ppcs alumni traffic on cloudflare workers without hitting request-limit alarms. (the apr cost report's $10 vercel spend cap is obsolete post-migration, but the equivalent workers/r2 usage tier is worth eyeballing.)</li>
      <li>run an accessibility pass once jamie's guide is shared in studio comms (open action from may 6 whirlpool).</li>
    </ol>
  </div>

  <div class="handoff" style="margin-top:14px">
    <h3>4. content (pre-launch)</h3>
    <ol>
      <li>per-app one-liners (5 of them) — assign to jamie, edit-of-record by may 22.</li>
      <li>five press pitches drafted by mon 11 may (overdue, prioritise this week).</li>
      <li>warm contact outreach batch — 50 personalised emails starting now, finishing pre-launch.</li>
      <li>harbour preview zoom recording — book and record by fri 22 may.</li>
      <li>"coming soon" wave-2 hero copy and email capture form on the wave-1 site.</li>
    </ol>
  </div>

  <div class="handoff" style="margin-top:14px">
    <h3>5. open questions to resolve before migrating</h3>
    <ol>
      <li><strong>"deep tech" reconciliation:</strong> confirm whether the user's "deep tech" is depth.chart (most likely) or deep.deck.</li>
      <li><strong>"title pool" reconciliation:</strong> confirm tidal.pool (apr 16 weekly notes mention "title pool works visually like tidal pool" — looks like a casual alt name).</li>
      <li><strong>final wave-1 lineup:</strong> the 06 may whirlpool floated 5 apps (vertigo.vault, depth.chart, lines.become.loops, values.auction, feel.cards). the 13 may whirlpool agenda had the lock-by-today flag on it. verify the actual locked list — the may 6 names are the working assumption in this map.</li>
      <li><strong>meredith's ownership of depth.chart:</strong> the 06 may whirlpool noted "depth chart (pending meredith's ownership)." confirm before launch copy goes out.</li>
      <li><strong>brand line:</strong> "sea captains for rough waters of uncertainty" surfaced in the may 6 whirlpool. is this the launch tagline or just internal narrative scaffolding?</li>
    </ol>
  </div>
</section>

<div class="sources">
  <strong>sources synthesised</strong> (most are notion and drive; the slack search returned over 145k chars and was scanned at the keyword level only):
  <ul>
    <li>notion · <a href="https://www.notion.so/337e4ee74ba481aba573fd3bf397a0b9">harbour launch plan — may 2026</a> — the canonical launch plan, written 03 apr</li>
    <li>notion · <a href="https://www.notion.so/356e4ee74ba481f6bfa6e5487e1721d4">whirlpool — may 6, 2026</a> — the 4–6 app curation discussion</li>
    <li>notion · <a href="https://www.notion.so/358e4ee74ba480d7a270f44aa2dad4bd">whirlpool meeting notes — may 6</a> — the locked-in wave-1 names and piers framing</li>
    <li>notion · <a href="https://www.notion.so/35ae4ee74ba481569d46d8cc6b68f601">whirlpool agenda — may 11, 2026</a></li>
    <li>notion · <a href="https://www.notion.so/35fe4ee74ba4818483c5c797e791790a">whirlpool agenda — may 13, 2026</a> — final lock day for the lineup</li>
    <li>notion · <a href="https://www.notion.so/358e4ee74ba4819d87faf5a14f39b9c0">CMO review — week of 04 may 2026</a> — t-22 to t-15 to-do list</li>
    <li>notion · <a href="https://www.notion.so/2fbe4ee74ba4810e9ed6f9037498e9d7">website databases</a> — every cms source mapped to every route</li>
    <li>notion · <a href="https://www.notion.so/345e4ee74ba4812eb8d1fea5a24f4e1a">the harbour stack, explained</a> — full ops and infra map</li>
    <li>notion · <a href="https://www.notion.so/357e4ee74ba4818db5b9c894c3b86469">may–july content plan</a> — payton's calendar</li>
    <li>notion · <a href="https://www.notion.so/8e3f3364b2654640a91ed0f38b091a07">harbour games db</a> — canonical app list and schema</li>
    <li>notion (each app's individual harbour-games row) · vertigo.vault, depth.chart, deep.deck, creaseworks, raft.house, tidal.pool, paper.trail, mirror.log, bias.lens, time.prism, liminal.pass, pattern.weave, rhythm.lab, orbit.lab, code.weave, market.mind, scale.shift, proof.garden, emerge.box</li>
    <li>notion · <a href="https://www.notion.so/349e4ee74ba481e0a672d72ef1562181">strategy playdates — running log</a> — cmo and play@ted context</li>
    <li>gmail · "PRME Pedagogy Week 1 - AM to PM Recap" thread and related 2026-04-30 to 2026-05-15 prme correspondence</li>
    <li>slack · #client-prme-internal channel and windedvertigogo.slack.com app deployment notes ("deployed 11 new threshold concept apps")</li>
    <li>google drive · 250528_LearningAgenda_PRMEPedagogy.pdf, w.v rec from PRME.pdf, ppcs-2026 facilitation guides</li>
  </ul>
</div>

</div>

<script>
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const target = document.getElementById(tab.dataset.target);
    if (target) target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});
</script>
</body>
</html>
`;

export async function GET() {
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
