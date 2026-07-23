// do-v2 sandbox build — renders public/{index,a,b,c}/index.html from data.mjs.
// no framework: template literals in, static semantic HTML out. run: node build.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { families, profiles, axes, proofFloor, strings } from "./data.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const out = (p, html) => {
  const f = join(root, "public", p);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, html);
  console.log("wrote", p);
};

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ── shared blocks ─────────────────────────────────────────────── */

const head = (title, desc) => `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/shared/base.css">
</head>
<body>
<a class="skip-link" href="#main">skip to content</a>`;

const siteHead = (tag) => `
<header class="site-head wrap">
  <a class="brand" href="/">${esc(strings.brand)} <span aria-hidden="true">·</span> do — sandbox</a>
  <span class="variant-tag">${esc(tag)}</span>
</header>`;

const hooksBlock = () => {
  const items = families
    .flatMap((f) => f.hooks.map((h) => ({ ...h, family: f.slug })))
    .map(
      (h) =>
        `<li><button type="button" class="hook-btn" data-family="${h.family}">${esc(h.text)}</button></li>`
    )
    .join("\n");
  return `
<section class="hero wrap" aria-labelledby="hooks-heading">
  <h1 id="hooks-heading" class="visually-hidden" style="position:absolute;left:-9999px">start with your problem</h1>
  <ul class="hooks">
${items}
  </ul>
  <p class="hooks-note">tap the one that names you — it takes you straight there.</p>
  <p class="hero-sub">${esc(strings.heroSub)}</p>
</section>`;
};

const proofItem = (p) => {
  const stat = p.stat ? `<span class="stat">${esc(p.stat)}</span> · ` : "";
  if (p.href) return `<li>${stat}<a href="${esc(p.href)}">${esc(p.label)}</a></li>`;
  if (p.cleared) return `<li>${stat}${esc(p.label)}</li>`;
  return `<li class="pending">${stat}${esc(p.label)}</li>`;
};

const ladderBlock = (f) => {
  const rung = (label, entry) =>
    entry.href
      ? `<li><a href="${esc(entry.href)}"><span class="rung-label">${label}</span>${esc(entry.label)}</a></li>`
      : `<li><span class="dead"><span class="rung-label">${label}</span>${esc(entry.label)} <em>(link pending)</em></span></li>`;
  return `<ol class="ladder">
${rung("play", f.ladder.play)}
${rung("take", f.ladder.take)}
<li><a href="${esc(strings.talkHref)}"><span class="rung-label">talk</span>thirty minutes, no deck</a></li>
</ol>`;
};

const indexBlock = () => {
  const rows = families
    .map((f, i) => {
      const bodyId = `fam-body-${f.slug}`;
      const headId = `fam-head-${f.slug}`;
      const proofTease = f.proof.find((p) => p.stat);
      return `<li class="fam" data-slug="${f.slug}" data-open="false">
  <h2 style="margin:0;font-size:inherit;font-weight:inherit">
    <button type="button" class="fam-head" id="${headId}" aria-expanded="false" aria-controls="${bodyId}">
      <span class="fam-name">${esc(f.name)}</span>
      <span class="fam-hookline" data-hookline>${esc(f.hooks[0].text)}</span>
      ${proofTease ? `<span class="fam-tease">${esc(proofTease.stat)}</span>` : ""}
    </button>
  </h2>
  <div class="fam-body" id="${bodyId}" role="region" aria-labelledby="${headId}" hidden>
    <div class="fam-body-inner">
      <ul class="fam-problems">
${f.hooks.map((h) => `        <li>${esc(h.text)}</li>`).join("\n")}
      </ul>
      <p class="fam-offer">${esc(f.offer)}</p>
      <ul class="proof-strip">
${f.proof.map((p) => `        ${proofItem(p)}`).join("\n")}
      </ul>
      ${ladderBlock(f)}
    </div>
  </div>
</li>`;
    })
    .join("\n");
  return `
<section class="wrap" aria-label="what we do — seven families">
  <ol class="index">
${rows}
  </ol>
</section>`;
};

const quietExit = () => `
<section class="quiet-exit wrap">
  <p>${esc(strings.quietExit)}</p>
  <a href="${esc(strings.talkHref)}">${esc(strings.quietExitCta)}</a>
</section>`;

const proofFloorBlock = () => `
<footer class="proof-floor wrap">
  <ul>
${proofFloor.map((n) => `    <li>${esc(n)}</li>`).join("\n")}
  </ul>
  <p>${esc(strings.proofFloorLine)}</p>
</footer>`;

const utilRow = (links) => `
<nav class="util-row wrap" aria-label="page options">
  <button type="button" data-plain-toggle aria-pressed="false">plain version</button>
${links.map((l) => `  <a href="${l.href}">${esc(l.label)}</a>`).join("\n")}
</nav>`;

const dataScript = `<script src="/shared/data.js"></script>
<script src="/shared/spine.js"></script>`;

/* ── variant a — the quiet index ───────────────────────────────── */

const pageA = () => `${head(
  "do — variant a · the quiet index",
  "sandbox prototype a: the quiet typographic index of the seven winded.vertigo service families."
)}
${siteHead("variant a — the quiet index")}
<main id="main">
${hooksBlock()}
<nav class="wrap hero-links" aria-label="browse">
  <a href="#browse-need">${esc(strings.browseNeed)}</a>
  <a href="#browse-who">${esc(strings.browseWho)}</a>
</nav>
${indexBlock()}
<section class="wrap" id="browse-who" aria-labelledby="who-h">
  <h2 id="who-h" style="font-size:var(--step-1);margin-top:2.4rem">browse by who you are</h2>
  <ul class="fam-problems">
${profiles
  .map(
    (p) =>
      `    <li><a href="/b/?p=${p.id}">${esc(p.firstPersonLine)}</a> <span style="color:var(--ink-muted)">— ${esc(p.name)}</span></li>`
  )
  .join("\n")}
  </ul>
  <p id="browse-need" style="color:var(--ink-muted);font-size:var(--step--1)">browse by what you need: the list above is it — seven families, no filters.</p>
</section>
${quietExit()}
${proofFloorBlock()}
${utilRow([{ href: "/", label: "all three variants" }])}
</main>
${dataScript}
</body>
</html>`;

/* ── variant b — faders over filters ───────────────────────────── */

const deskBlock = () => `
<section class="desk wrap" aria-labelledby="desk-h">
  <h2 id="desk-h" style="font-size:var(--step-1);margin:1.8rem 0 0.6rem">the desk</h2>
  <p style="color:var(--ink-muted);font-size:var(--step--1);margin:0 0 0.9rem">set a preset, nudge the switches — the index below re-sorts to your situation. <button type="button" data-desk-reset style="background:none;border:0;font:inherit;text-decoration:underline;cursor:pointer;padding:0">${esc(
    strings.showEverything
  )}</button></p>
  <div class="desk-presets" role="group" aria-label="who you are">
${profiles
  .map(
    (p) =>
      `    <button type="button" class="preset" data-preset="${p.id}" aria-pressed="false">${esc(p.firstPersonLine)}</button>`
  )
  .join("\n")}
  </div>
  <div class="desk-faders">
${axes
  .map(
    (ax) => `    <div class="fader-row">
      <span class="fader-end" id="lbl-${ax.id}-l">${esc(ax.left)}</span>
      <input type="range" class="fader" id="fader-${ax.id}" data-axis="${ax.id}" min="0" max="2" step="1" value="1"
        aria-label="${esc(ax.left)} to ${esc(ax.right)}" list="ticks-${ax.id}">
      <datalist id="ticks-${ax.id}"><option value="0"></option><option value="1"></option><option value="2"></option></datalist>
      <span class="fader-end" id="lbl-${ax.id}-r">${esc(ax.right)}</span>
    </div>`
  )
  .join("\n")}
  </div>
  <p class="desk-share" hidden><a data-share-link href="#">share this mix</a> <span style="color:var(--ink-muted)">— the url is the mix</span></p>
</section>
<style>
.desk { border: 1px solid var(--ink); padding: 1.1rem 1.2rem 1.2rem; margin-top: 1.6rem; }
.desk h2 { margin-top: 0 !important; }
.desk-presets { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0 0 1.1rem; }
.preset {
  font: inherit; font-size: var(--step--1); text-align: left;
  background: none; color: var(--ink); border: 1px solid var(--ink);
  padding: 0.5rem 0.8rem; cursor: pointer; min-height: 44px;
}
.preset[aria-pressed="true"] { background: var(--ink); color: var(--field); border-color: var(--ink); }
.preset:hover { border-color: var(--accent); color: var(--accent); }
.preset[aria-pressed="true"]:hover { color: var(--field); }
.fader-row { display: grid; grid-template-columns: 5.2rem 1fr 5.2rem; align-items: center; gap: 0.7rem; margin: 0.55rem 0; }
.fader-end { font-size: var(--step--1); color: var(--ink-muted); }
.fader-end:last-child { text-align: right; }
.fader { -webkit-appearance: none; appearance: none; width: 100%; height: 44px; background: transparent; cursor: pointer; }
.fader::-webkit-slider-runnable-track { height: 4px; background: var(--ink); }
.fader::-moz-range-track { height: 4px; background: var(--ink); }
.fader::-webkit-slider-thumb {
  -webkit-appearance: none; width: 28px; height: 28px; margin-top: -12px;
  background: var(--field); border: 3px solid var(--accent); border-radius: 2px;
}
.fader::-moz-range-thumb { width: 24px; height: 24px; background: var(--field); border: 3px solid var(--accent); border-radius: 2px; }
@media (min-width: 700px) { .desk-presets { gap: 0.6rem; } }
</style>`;

const deskScript = `<script>
(function () {
  "use strict";
  var state = { p: null, a1: 1, a2: 1, a3: 1 };
  var presets = document.querySelectorAll(".preset");
  var faders = document.querySelectorAll(".fader");
  var share = document.querySelector(".desk-share");
  var shareLink = document.querySelector("[data-share-link]");

  function apply(pushUrl) {
    // no artificial "matching…" delay: the FLIP reorder IS the visible work.
    var ranked = WV_SCORE.scoreFamilies(state.p, { a1: state.a1, a2: state.a2, a3: state.a3 })
      .map(function (r) { return r.slug; });
    WV_REORDER(ranked);
    document.querySelectorAll(".fam").forEach(function (fam) {
      var line = fam.querySelector("[data-hookline]");
      if (line) line.textContent = WV_SCORE.bestHook(fam.dataset.slug, state.p);
    });
    presets.forEach(function (b) {
      b.setAttribute("aria-pressed", b.dataset.preset === state.p ? "true" : "false");
    });
    var params = new URLSearchParams();
    if (state.p) params.set("p", state.p);
    ["a1", "a2", "a3"].forEach(function (k) { if (state[k] !== 1) params.set(k, state[k]); });
    var qs = params.toString();
    if (pushUrl) history.replaceState(null, "", qs ? "?" + qs : location.pathname);
    var touched = state.p || qs.length;
    share.hidden = !touched;
    if (touched) shareLink.href = location.pathname + (qs ? "?" + qs : "");
  }

  presets.forEach(function (b) {
    b.addEventListener("click", function () {
      state.p = state.p === b.dataset.preset ? null : b.dataset.preset;
      apply(true);
    });
  });
  faders.forEach(function (f) {
    f.addEventListener("input", function () {
      state[f.dataset.axis] = Number(f.value);
      apply(true);
    });
  });
  document.querySelector("[data-desk-reset]").addEventListener("click", function () {
    state = { p: null, a1: 1, a2: 1, a3: 1 };
    faders.forEach(function (f) { f.value = 1; });
    apply(true);
    WV_SPINE.closeAll();
  });

  // restore state from the url (shareable, deep-linkable)
  var q = new URLSearchParams(location.search);
  if (q.get("p")) state.p = q.get("p");
  ["a1", "a2", "a3"].forEach(function (k) {
    if (q.has(k)) {
      state[k] = Math.max(0, Math.min(2, Number(q.get(k)) || 1));
      var f = document.getElementById("fader-" + k);
      if (f) f.value = state[k];
    }
  });
  if (state.p || q.has("a1") || q.has("a2") || q.has("a3")) apply(false);
})();
</script>`;

const pageB = () => `${head(
  "do — variant b · faders over filters",
  "sandbox prototype b: the quiet index re-sorted live by a small mixing desk of profile presets and three switches."
)}
${siteHead("variant b — faders over filters")}
<main id="main">
${hooksBlock()}
<nav class="wrap hero-links" aria-label="entry points">
  <a href="#desk-h">${esc(strings.playDesk)}</a>
  <a href="#browse-all">${esc(strings.showEverything)}</a>
</nav>
${deskBlock()}
<span id="browse-all"></span>
${indexBlock()}
${quietExit()}
${proofFloorBlock()}
${utilRow([{ href: "/", label: "all three variants" }])}
</main>
${dataScript}
${deskScript}
</body>
</html>`;

/* ── variant c — what brings you here? ─────────────────────────── */

const dialogueBlock = () => `
<div class="dialogue-layer" data-dialogue>
  <div class="wrap dlg-wrap">
    <div class="dlg-crease" aria-hidden="true"><span data-notch style="width:0%"></span></div>
    <p class="dlg-step" data-step-label>1 of 3</p>

    <section class="dlg-beat" data-beat="1">
      <h1 class="dlg-q">what brings you here?</h1>
      <div class="dlg-choices">
${profiles
  .map((p) => `        <button type="button" class="dlg-choice" data-choose-profile="${p.id}">${esc(p.firstPersonLine)}</button>`)
  .join("\n")}
      </div>
    </section>

    <section class="dlg-beat" data-beat="2" hidden>
      <h1 class="dlg-q">which of these sounds like your week?</h1>
      <div class="dlg-choices" data-hook-choices></div>
    </section>

    <button type="button" class="dlg-skip" data-dialogue-skip>skip — ${esc(strings.showEverything)}</button>
  </div>
</div>
<style>
.dialogue-layer {
  position: fixed; inset: 0; z-index: 40; overflow-y: auto;
  background: var(--field);
  display: flex; align-items: flex-start;
}
.dlg-wrap { padding-top: 14vh; padding-bottom: 4rem; width: 100%; }
.dlg-crease { height: 3px; background: var(--hairline); margin-bottom: 0.7rem; }
.dlg-crease span { display: block; height: 3px; background: var(--accent); }
@media (prefers-reduced-motion: no-preference) { .dlg-crease span { transition: width 320ms var(--ease-unfold); } }
.dlg-step { font-size: var(--step--1); color: var(--ink-muted); margin: 0 0 1.6rem; }
.dlg-q { font-size: var(--step-3); font-weight: 600; letter-spacing: -0.02em; line-height: 1.08; margin: 0 0 1.4rem; max-width: 24ch; }
.dlg-q:focus, .dlg-q:focus-visible { outline: none; } /* programmatic focus target — ring adds noise, focus stays for SR */
.dlg-choices { display: flex; flex-direction: column; gap: 0.6rem; max-width: 30rem; }
.dlg-choice {
  font: inherit; font-size: var(--step-1); text-align: left; line-height: 1.3;
  background: none; color: var(--ink); border: 1px solid var(--ink);
  padding: 0.85rem 1rem; cursor: pointer; min-height: 44px;
}
.dlg-choice:hover { border-color: var(--accent); color: var(--accent); }
.dlg-skip {
  margin-top: 2.2rem; background: none; border: 0; font: inherit;
  font-size: var(--step--1); color: var(--ink-muted); cursor: pointer;
  text-decoration: underline; text-underline-offset: 0.18em; padding: 0.5rem 0;
}
.dlg-skip:hover { color: var(--accent); }
@media (prefers-reduced-motion: no-preference) {
  .dlg-beat { animation: unfold 300ms var(--ease-unfold); }
}
</style>`;

const dialogueScript = `<script>
(function () {
  "use strict";
  var layer = document.querySelector("[data-dialogue]");
  var notch = document.querySelector("[data-notch]");
  var stepLabel = document.querySelector("[data-step-label]");
  var beats = { 1: document.querySelector('[data-beat="1"]'), 2: document.querySelector('[data-beat="2"]') };
  var chosenProfile = null;

  function showBeat(n) {
    Object.keys(beats).forEach(function (k) { beats[k].hidden = Number(k) !== n; });
    notch.style.width = (n - 1) * 33 + 34 + "%";
    stepLabel.textContent = n + " of 3";
    var h = beats[n].querySelector(".dlg-q");
    h.setAttribute("tabindex", "-1");
    h.focus();
  }

  function reveal(profileId, viaSkip) {
    notch.style.width = "100%";
    layer.remove();
    document.body.style.overflow = "";
    if (viaSkip || !profileId) {
      document.getElementById("main").querySelector(".fam .fam-head").focus();
      return;
    }
    var ranked = WV_SCORE.scoreFamilies(profileId, null).map(function (r) { return r.slug; });
    WV_REORDER(ranked);
    document.querySelectorAll(".fam").forEach(function (fam) {
      var line = fam.querySelector("[data-hookline]");
      if (line) line.textContent = WV_SCORE.bestHook(fam.dataset.slug, profileId);
    });
    var top = document.querySelector('.fam[data-slug="' + ranked[0] + '"]');
    WV_SPINE.openFam(top, false);
    history.replaceState(null, "", "?p=" + profileId);
    var mixNote = document.querySelector("[data-mix-note]");
    if (mixNote) {
      mixNote.hidden = false;
      mixNote.querySelector("a").href = location.pathname + "?p=" + profileId;
    }
    top.scrollIntoView({ block: "start" });
    top.querySelector(".fam-head").focus({ preventScroll: true });
  }

  document.querySelectorAll("[data-choose-profile]").forEach(function (b) {
    b.addEventListener("click", function () {
      chosenProfile = b.dataset.chooseProfile;
      var hooks = [];
      WV_DATA.families.forEach(function (f) {
        f.hooks.forEach(function (h) {
          if (h.profiles.indexOf(chosenProfile) !== -1) hooks.push({ text: h.text, family: f.slug });
        });
      });
      var box = document.querySelector("[data-hook-choices]");
      box.innerHTML = "";
      hooks.slice(0, 4).forEach(function (h) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dlg-choice";
        btn.textContent = h.text;
        btn.addEventListener("click", function () { reveal(chosenProfile, false); });
        box.appendChild(btn);
      });
      showBeat(2);
    });
  });

  document.querySelector("[data-dialogue-skip]").addEventListener("click", function () {
    reveal(null, true);
  });

  // deep link / plain: arrive with ?p= → skip the dialogue, land folded;
  // ?plain=1 or reduced data cases → straight to the spine.
  var q = new URLSearchParams(location.search);
  if (q.get("plain") === "1") { layer.remove(); }
  else if (q.get("p")) { layer.remove(); reveal(q.get("p"), false); }
  else { document.body.style.overflow = "hidden"; showBeat(1); }
  document.addEventListener("wv:plain", function (e) {
    if (e.detail.on && document.body.contains(layer)) layer.remove();
  });
})();
</script>`;

const pageC = () => `${head(
  "do — variant c · what brings you here?",
  "sandbox prototype c: a three-beat scripted entry that folds the page to your situation."
)}
${siteHead("variant c — what brings you here?")}
${dialogueBlock()}
<main id="main">
${hooksBlock()}
<p class="wrap" data-mix-note hidden style="font-size:var(--step--1);color:var(--ink-muted)">this view is your mix — <a href="#">the url is shareable</a>.</p>
${indexBlock()}
${quietExit()}
${proofFloorBlock()}
${utilRow([{ href: "/", label: "all three variants" }])}
</main>
${dataScript}
${dialogueScript}
</body>
</html>`;

/* ── sandbox index (the chooser) ───────────────────────────────── */

const evalQuestions = [
  "which entry made you *feel* the problem-first idea?",
  "could you find “your” problem in under 30 seconds?",
  "did the desk feel like play or like work?",
  "on your phone, which variant would you send to a client?",
  "where did you want a next step that wasn’t there?",
];

const mailFeedback = (variant) =>
  `mailto:garrett@windedvertigo.com?subject=${encodeURIComponent(`do-v2 sandbox feedback — variant ${variant}`)}&body=${encodeURIComponent(
    evalQuestions.map((q) => `${q}\n\n`).join("")
  )}`;

const pageIndex = () => `${head(
  "do-v2 sandbox — three variants",
  "three working prototypes of the next windedvertigo.com/do — open on your phone, compare, reply."
)}
${siteHead("evaluation sandbox")}
<main id="main" class="wrap">
  <section class="hero">
    <h1 style="font-size:var(--step-3);font-weight:600;letter-spacing:-0.02em;line-height:1.1;margin:0 0 0.6rem">the next /do, three ways</h1>
    <p class="hero-sub">same seven families, same thirty-one problems, three different front doors. open each on your phone. production is untouched — this is a sandbox.</p>
  </section>

  <ol style="list-style:none;padding:0;margin:1.2rem 0 0;display:flex;flex-direction:column;gap:1rem">
    <li style="border:1px solid var(--ink);padding:1.1rem 1.2rem">
      <h2 style="margin:0;font-size:var(--step-1)"><a href="/a/" style="text-decoration:none">variant a — the quiet index</a></h2>
      <p style="margin:0.4rem 0 0.6rem;color:var(--ink-muted)">the control condition. problems first, seven families as a typographic list that unfolds in place. no toys.</p>
      <p style="margin:0;font-size:var(--step--1)"><a href="/a/">open</a> · <a href="/a/?plain=1">plain version</a> · <a href="${mailFeedback("a")}">send feedback</a></p>
    </li>
    <li style="border:1px solid var(--ink);padding:1.1rem 1.2rem">
      <h2 style="margin:0;font-size:var(--step-1)"><a href="/b/" style="text-decoration:none">variant b — faders over filters</a></h2>
      <p style="margin:0.4rem 0 0.6rem;color:var(--ink-muted)">variant a plus the desk: five “that’s me” presets and three switches that re-sort the index live. the url is the mix.</p>
      <p style="margin:0;font-size:var(--step--1)"><a href="/b/">open</a> · <a href="/b/?p=p1">arrive as a programme leader</a> · <a href="/b/?plain=1">plain version</a> · <a href="${mailFeedback("b")}">send feedback</a></p>
    </li>
    <li style="border:1px solid var(--ink);padding:1.1rem 1.2rem">
      <h2 style="margin:0;font-size:var(--step-1)"><a href="/c/" style="text-decoration:none">variant c — what brings you here?</a></h2>
      <p style="margin:0.4rem 0 0.6rem;color:var(--ink-muted)">a three-beat scripted entry — pick your situation, pick your problem, and the page folds itself. skippable at every beat.</p>
      <p style="margin:0;font-size:var(--step--1)"><a href="/c/">open</a> · <a href="/c/?plain=1">plain version</a> · <a href="${mailFeedback("c")}">send feedback</a></p>
    </li>
  </ol>

  <section style="margin-top:2.4rem">
    <h2 style="font-size:var(--step-1)">what we’re asking you</h2>
    <ol style="max-width:36rem;padding-left:1.2rem">
${evalQuestions.map((q) => `      <li style="margin:0.4rem 0">${esc(q)}</li>`).join("\n")}
    </ol>
    <p style="font-size:var(--step--1);color:var(--ink-muted)">tap “send feedback” under any variant — the questions are pre-filled. or just say it in slack.</p>
  </section>
${proofFloorBlock()}
</main>
</body>
</html>`;

/* ── emit ──────────────────────────────────────────────────────── */

out("index.html", pageIndex());
out("a/index.html", pageA());
out("b/index.html", pageB());
out("c/index.html", pageC());

// client copy of the canonical data (same source, one build)
out(
  "shared/data.js",
  "window.WV_DATA = " + JSON.stringify({ families, profiles, axes }, null, 2) + ";\n"
);

out("robots.txt", "User-agent: *\nDisallow: /\n");
out(
  "llms.txt",
  `# winded.vertigo — do-v2 sandbox (demonstration file)

> this is a throwaway design sandbox for windedvertigo.com/do — three prototype
> variants under evaluation. it is not the production services page and should
> not be cited. the production page will ship its own llms.txt with stable
> per-family urls.

## what winded.vertigo does (seven families)
${families.map((f) => `- ${f.name}: ${f.hooks[0].text}`).join("\n")}
`
);

console.log("build complete.");
