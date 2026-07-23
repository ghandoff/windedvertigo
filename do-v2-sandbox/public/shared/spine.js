/* do-v2 sandbox — shared spine behaviour (progressive enhancement only;
   every page is complete semantic HTML without this file). */
(function () {
  "use strict";
  var D = window.WV_DATA;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ── plain version ─────────────────────────────────────────────── */
  var plainParam = new URLSearchParams(location.search).get("plain") === "1";
  function setPlain(on) {
    document.body.classList.toggle("plain", on);
    var btns = document.querySelectorAll("[data-plain-toggle]");
    btns.forEach(function (b) {
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.textContent = on ? "interactive version" : "plain version";
    });
    document.dispatchEvent(new CustomEvent("wv:plain", { detail: { on: on } }));
  }
  document.querySelectorAll("[data-plain-toggle]").forEach(function (b) {
    b.addEventListener("click", function () {
      setPlain(!document.body.classList.contains("plain"));
    });
  });
  if (plainParam) setPlain(true);

  /* ── accordion (one unfold open at a time) ─────────────────────── */
  var fams = Array.prototype.slice.call(document.querySelectorAll(".fam"));
  function openFam(fam, focusHead) {
    fams.forEach(function (f) {
      var open = f === fam;
      f.dataset.open = open ? "true" : "false";
      f.querySelector(".fam-head").setAttribute("aria-expanded", open ? "true" : "false");
      f.querySelector(".fam-body").hidden = !open;
    });
    if (focusHead) fam.querySelector(".fam-head").focus();
  }
  function closeAll() {
    fams.forEach(function (f) {
      f.dataset.open = "false";
      f.querySelector(".fam-head").setAttribute("aria-expanded", "false");
      f.querySelector(".fam-body").hidden = true;
    });
  }
  fams.forEach(function (fam) {
    var head = fam.querySelector(".fam-head");
    head.addEventListener("click", function () {
      if (fam.dataset.open === "true") closeAll();
      else openFam(fam, false);
    });
  });

  /* jump: open a family by slug and scroll to it */
  function jumpToFamily(slug) {
    var fam = document.querySelector('.fam[data-slug="' + slug + '"]');
    if (!fam) return;
    openFam(fam, false);
    fam.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "start" });
    fam.querySelector(".fam-head").focus({ preventScroll: true });
  }
  window.WV_SPINE = { openFam: openFam, closeAll: closeAll, jumpToFamily: jumpToFamily, setPlain: setPlain };

  /* ── hook list: tap = jump; spotlight travels the visible list ─── */
  var hookBtns = Array.prototype.slice.call(document.querySelectorAll(".hook-btn"));
  hookBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      jumpToFamily(btn.dataset.family);
    });
  });

  var spotIdx = -1;
  var spotTimer = null;
  var spotPaused = false;
  function spotlight(i) {
    hookBtns.forEach(function (b, j) {
      b.classList.toggle("spotlit", j === i);
    });
    spotIdx = i;
  }
  function tickSpot() {
    if (spotPaused || document.body.classList.contains("plain")) return;
    spotlight((spotIdx + 1) % hookBtns.length);
  }
  if (hookBtns.length && !reduceMotion.matches) {
    spotlight(0);
    spotTimer = setInterval(tickSpot, 2600);
    var hookList = document.querySelector(".hooks");
    ["mouseenter", "focusin", "touchstart"].forEach(function (ev) {
      hookList.addEventListener(ev, function () { spotPaused = true; }, { passive: true });
    });
    ["mouseleave", "focusout"].forEach(function (ev) {
      hookList.addEventListener(ev, function () { spotPaused = false; });
    });
  }
  reduceMotion.addEventListener("change", function () {
    if (reduceMotion.matches && spotTimer) { clearInterval(spotTimer); spotlight(-1); }
  });

  /* ── scoring (used by variants b and c) ────────────────────────── */
  // score = 2 × profile weight + 1 per axis whose non-neutral position
  // matches the family's lean. positions: 0 = left, 1 = middle, 2 = right.
  function scoreFamilies(profileId, axisPositions) {
    var profile = D.profiles.find(function (p) { return p.id === profileId; }) || null;
    return D.families
      .map(function (f) {
        var s = profile ? (profile.familyWeights[f.slug] || 0) * 2 : 0;
        if (axisPositions) {
          D.axes.forEach(function (ax) {
            var pos = axisPositions[ax.id];
            var lean = f.axisLean[ax.id];
            if (pos === 0 && lean === ax.left) s += 1;
            if (pos === 2 && lean === ax.right) s += 1;
          });
        }
        return { slug: f.slug, score: s };
      })
      .sort(function (a, b) { return b.score - a.score; });
  }

  // best hook line for a family given an active profile
  function bestHook(familySlug, profileId) {
    var f = D.families.find(function (x) { return x.slug === familySlug; });
    if (!f) return "";
    if (profileId) {
      var match = f.hooks.find(function (h) { return h.profiles.indexOf(profileId) !== -1; });
      if (match) return match.text;
    }
    return f.hooks[0].text;
  }
  window.WV_SCORE = { scoreFamilies: scoreFamilies, bestHook: bestHook };

  /* ── FLIP reorder: the visible labour, no artificial delay ─────── */
  // reorder is presentation only — DOM order (the semantic <ol>) is untouched;
  // we translate rows with CSS order + FLIP animation.
  function reorderIndex(rankedSlugs) {
    var list = document.querySelector(".index");
    if (!list) return;
    var first = {};
    fams.forEach(function (f) { first[f.dataset.slug] = f.getBoundingClientRect().top; });
    fams.forEach(function (f) {
      var rank = rankedSlugs.indexOf(f.dataset.slug);
      f.style.order = rank === -1 ? 99 : rank;
    });
    list.style.display = "flex";
    list.style.flexDirection = "column";
    if (reduceMotion.matches) return;
    fams.forEach(function (f) {
      var delta = first[f.dataset.slug] - f.getBoundingClientRect().top;
      if (!delta) return;
      f.animate(
        [{ transform: "translateY(" + delta + "px)" }, { transform: "none" }],
        { duration: 380, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
      );
    });
  }
  window.WV_REORDER = reorderIndex;
})();
