/* ============================================================
   amna at 10, evidence map — shared data + render
   the copy lives in the html; the data + charts live here.
   visual language is driven entirely by window.AMNA_THEME so
   the two directions (woven ledger / cadet dossier) share one
   brain and differ only in palette.
   ============================================================ */
(function () {
  "use strict";
  var T = window.AMNA_THEME || {};

  /* ---- data (verbatim from the source artefact) ------------ */

  // pillar × source-type coverage, 0 none → 3 strong. preliminary.
  var COLS = [
    "external evaluation",
    "internal MEAL",
    "training feedback",
    "reflective logs",
    "programme reporting",
    "strategy & ToC",
  ];
  var PILLARS = [
    ["community partnerships", [3, 3, 2, 2, 3, 3]],
    ["baytna, ECD", [3, 3, 3, 2, 2, 2]],
    ["dinami, youth", [2, 3, 2, 1, 2, 2]],
    ["systems of care", [0, 2, 2, 1, 1, 2]],
    ["global healing network", [2, 2, 3, 1, 2, 3]],
    ["therapeutic groups", [1, 2, 2, 1, 1, 1]],
    ["wellbeing spaces", [2, 3, 2, 1, 2, 1]],
    ["emergency response", [1, 2, 2, 1, 2, 2]],
    ["consultancies, public", [1, 2, 3, 0, 1, 1]],
  ];
  var COVWORD = ["nothing held", "thin", "moderate", "strong"];

  // the evaluation portfolio. status: final | ongoing | internal
  var EVALS = [
    ["UVA, humanitarian collaborative", "baytna, ECD", "greece", "2021–23", "final"],
    ["UVA, humanitarian collaborative", "community partnerships", "jordan & lebanon", "2024–26", "ongoing"],
    ["chapin hall, u. chicago", "afghanistan response, and ukraine, italy, balkans", "", "2022–23", "final"],
    ["harvard, RTI", "pakistan response", "", "2021–22", "internal"],
    ["nexus", "community partnerships", "afghanistan", "2024–25", "final"],
    ["nexus", "global healing network", "afghanistan", "2025–26", "ongoing"],
    ["360 consulting", "baytna", "lebanon", "2025–27", "ongoing"],
    ["internal", "wellbeing spaces", "", "2022–26", "internal"],
    ["internal", "general trainings", "", "2025", "internal"],
    ["internal", "dinami endline + dinami hubs", "", "2020–23", "internal"],
  ];

  // geographies weighted 1 light → 3 heavy
  var GEO = [
    ["greece", 3], ["jordan", 3], ["lebanon", 3], ["afghanistan", 3], ["ukraine", 3],
    ["pakistan", 2], ["palestine, gaza", 2],
    ["balkans, italy, poland", 1], ["syria", 1], ["uk", 1],
  ];

  // markers placed as percentages of the basemap image (direction a).
  // [name, x%, y%, weight 1..3, labelDx px, labelDy px, anchor]
  var MAP_PTS = [
    ["uk", 15.0, 8.0, 1, 0, -12, "center"],
    ["balkans, italy, poland", 26.0, 27.0, 1, 0, -12, "center"],
    ["greece", 33.5, 38.0, 3, 0, -12, "center"],
    ["ukraine", 40.0, 20.0, 3, 0, -12, "center"],
    ["lebanon", 43.0, 47.0, 3, -10, -1, "right"],
    ["syria", 43.5, 49.0, 1, 10, -2, "left"],
    ["jordan", 44.5, 52.0, 3, 10, 4, "left"],
    ["palestine, gaza", 42.5, 53.0, 2, -10, 6, "right"],
    ["afghanistan", 67.0, 41.0, 3, 0, -12, "center"],
    ["pakistan", 70.0, 50.0, 2, 10, 6, "left"],
  ];
  // real (simplified) coastlines in lon/lat, drawn as filled land with the
  // seas appearing as the gaps between masses. mediterranean = gap between
  // europe and n-africa; red sea = gap between africa and arabia; persian
  // gulf = gap between arabia and iran. black + caspian painted on top.
  var EURASIA = [
    [-9.5,43.8],[-1.5,43.4],[-1.8,46.2],[-4.6,48.4],[-1,48.7],[1.6,50.9],[4.3,52],[6.5,53.6],[8.1,55],[8.3,57.2],
    [12.5,54.6],[19,54.5],[24,56.2],[29,60],[34,60],
    [46,61],[60,60],[74,58],[82,56],
    [82,45],[82,34],[80,28],[78,24],[77,21],
    [74,16],[73,14],[71,17],[69,21],[67,24],
    [62,25.2],[59,25.4],[57,26.6],[54,28],[50,29.8],[48,30.2],
    [46,30.2],[43,31],[40,31.2],[37,31.2],[35.6,33],[35.8,36],[36,36.6],
    [33,36.4],[30.5,36.8],[28,36.6],
    [27,37.2],[26.6,38.6],[24.2,38],[23.2,37],[22,36.9],[21.8,38.4],[20.8,38.9],[20,39.6],
    [19.4,40.6],[18.5,42],[16.6,43.2],[13.6,45.5],
    [14.8,42.2],[16.2,41.7],[18.4,40.2],[16.4,39.8],[15.6,38.2],[14.2,40.8],[13.2,41.3],[11,42.4],[10,43],[9.1,44.3],
    [7,43.5],[3.2,43.4],[3.4,41.9],[1,41],[-0.3,38.4],[-2.1,36.8],[-6.3,36.2],
    [-9.4,37.2],[-9,41],[-9.5,43.8]
  ];
  var AFRICA = [
    [-6.3,35.9],[0,36.6],[10,34.4],[11.2,33.2],[20,32.4],[25,31.8],[30,31.3],[33,31.2],
    [34,29.6],[35,28],[37,22],[39,18],[43,12.6],
    [44.5,11.5],[48,11.5],[51,11.8],[48.5,9],[45,6.5],[42,4.5],[41,3],
    [40,2.5],[30,2.5],[10,2.5],[-8,2.5],
    [-13,8],[-17,15],[-17,21],[-13,28],[-10,32],[-6.3,35.9]
  ];
  var ARABIA = [
    [35,28.9],[38,20],[43,13.2],[48.5,13.8],[52,16.5],[56,20],[59.2,23.6],[59,25.2],
    [56.4,26.6],[52,27.6],[49,29.6],[47.6,30],
    [45,29.6],[41,29],[38,28],[35,28.9]
  ];
  var UK = [
    [-5,50],[-3.2,51.5],[0.6,51.4],[-0.5,53.4],[-2.8,55],[-5,57],[-6.2,58.4],[-8,57.5],[-5.8,54.6],[-4.6,53.3],[-5,50]
  ];
  var LAND = [EURASIA, AFRICA, ARABIA, UK];
  // enclosed seas painted over land: [lon, lat, rx°, ry°, rotate]
  var SEAS = [
    [34.5,43.2,7,2.6,0],   // black sea
    [50.5,41.5,3,5,-8],    // caspian
    [25.2,38.4,1.7,2.3,0], // aegean
  ];

  // evidence density by year, 1 sparse → 6 dense
  var YEARS = [
    ["16", 1], ["17", 1], ["18", 2], ["19", 2], ["20", 3], ["21", 3],
    ["22", 4], ["23", 4], ["24", 5], ["25", 6], ["26", 5],
  ];
  // era index per year column (0..3) and era meta
  var YEAR_ERA = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3];
  var ERAS = [
    ["i", "direct delivery", "starting close, in greece", "2016–2018", "1/4"],
    ["ii", "the pilot phase", "baytna hub emerges", "2018–2021", "4/7"],
    ["iii", "the training pivot", "teaching the teachers", "2021–2024", "7/10"],
    ["iv", "the ecosystem story", "what outlasts the grant", "2024–2026", "10/12"],
  ];

  // 8 co-equal outcome domains (radial wheel)
  var DOMAINS = [["safety"], ["regulation"], ["sense of", "future"], ["joy"],
    ["agency"], ["wellbeing"], ["protective", "relationships"], ["belonging"]];

  // 6 impact levels (nested rings, inner → outer)
  var LEVELS = ["individual", "caregiver, family", "community", "organisational", "institutional", "ecosystem"];

  /* ---- tiny dom helper ------------------------------------- */
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function svgFrom(str) {
    return new DOMParser().parseFromString(str, "image/svg+xml").documentElement;
  }
  function byId(id) { return document.getElementById(id); }

  /* ---- 2 · coverage matrix --------------------------------- */
  function renderMatrix() {
    var host = byId("matrix");
    if (!host) return;
    var tbl = el("table", "mx");
    var thead = el("thead");
    var htr = el("tr");
    htr.appendChild(el("th", "corner", "pillar"));
    COLS.forEach(function (c) { htr.appendChild(el("th", null, c)); });
    thead.appendChild(htr);
    tbl.appendChild(thead);

    var tb = el("tbody");
    PILLARS.forEach(function (row) {
      var name = row[0], vals = row[1];
      var tr = el("tr");
      tr.appendChild(el("td", "rowlab", name));
      vals.forEach(function (v, i) {
        var td = el("td", "cell-td");
        var c = el("span", "cell cv" + v);
        c.style.background = v === 0 ? "transparent" : T.cov[v];
        c.style.color = T.covText[v];
        if (v === 0) { c.classList.add("empty"); }
        c.setAttribute("title", name + " · " + COLS[i] + ": " + COVWORD[v]);
        c.setAttribute("aria-label", name + ", " + COLS[i] + ", " + COVWORD[v]);
        td.appendChild(c);
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    host.replaceChildren(tbl);
  }

  /* ---- 3 · evaluation portfolio (ledger) ------------------- */
  function renderEvals() {
    var host = byId("evals");
    if (!host) return;
    var wrap = el("div", "ledger");
    EVALS.forEach(function (e) {
      var partner = e[0], prog = e[1], place = e[2], yrs = e[3], status = e[4];
      var r = el("div", "led-row " + status);
      var scope = prog + (place ? ", " + place : "");
      r.appendChild(el("div", "led-partner", partner));
      r.appendChild(el("div", "led-scope", scope));
      r.appendChild(el("div", "led-yrs", yrs));
      var st = el("div", "led-status");
      st.appendChild(el("span", "dot"));
      st.appendChild(document.createTextNode(status === "internal" ? "internal" : status));
      r.appendChild(st);
      wrap.appendChild(r);
    });
    host.replaceChildren(wrap);
  }

  /* ---- 4a · geographies ------------------------------------ */
  function renderGeo() {
    var host = byId("geo");
    if (!host) return;
    var wrap = el("div", "geolist");
    GEO.forEach(function (g) {
      var name = g[0], n = g[1];
      var r = el("div", "geo-row w" + n);
      r.appendChild(el("div", "geo-name", name));
      var track = el("div", "geo-track");
      var bar = el("div", "geo-bar");
      bar.style.width = (n / 3 * 100) + "%";
      bar.style.background = T.geoRamp[n];
      track.appendChild(bar);
      r.appendChild(track);
      wrap.appendChild(r);
    });
    host.replaceChildren(wrap);
  }

  /* ---- 4a · geographic map (direction a only) -------------- */
  // uses the real political basemap as the ground truth; markers are placed
  // on it by image percentage (see MAP_PTS) and labelled.
  function renderGeoMap() {
    var host = byId("geomap");
    if (!host) return;
    var mk = T.mapMarker || ["", "#d99a6b", "#cb7858", "#b15043"];
    var frame = el("div", "mapframe");
    var img = document.createElement("img");
    img.src = T.mapImage || "../assets/region-basemap.png";
    img.alt = "map of europe, north africa, the middle east and south asia";
    img.className = "mapbase";
    frame.appendChild(img);
    var layer = el("div", "mmarkers");
    MAP_PTS.forEach(function (p) {
      var dot = el("div", "mdot w" + p[3]);
      dot.style.left = p[1] + "%";
      dot.style.top = p[2] + "%";
      dot.style.background = mk[p[3]];
      dot.title = p[0];
      layer.appendChild(dot);
      var lbl = el("div", "mlbl", p[0]);
      lbl.style.left = "calc(" + p[1] + "% + " + p[4] + "px)";
      lbl.style.top = "calc(" + p[2] + "% + " + p[5] + "px)";
      lbl.setAttribute("data-anchor", p[6]);
      layer.appendChild(lbl);
    });
    frame.appendChild(layer);
    var legend = el("div", "mlegend");
    legend.innerHTML = '<span class="ld w1"></span><span class="ld w2"></span><span class="ld w3"></span><span class="lt">more evidence held</span>';
    frame.appendChild(legend);
    host.replaceChildren(frame);
  }

  /* ---- 4b · years + strategic eras ------------------------- */
  function renderTimeline() {
    var host = byId("timeline");
    if (!host) return;

    var wrap = el("div", "tl");
    var head = el("div", "tl-headzone");
    var plot = el("div", "tl-plot");
    var bands = el("div", "tl-bands");
    var bars = el("div", "tl-bars");
    YEARS.forEach(function (y) {
      var cell = el("div", "tl-cell");
      cell.appendChild(el("div", "tl-val", String(y[1])));
      var track = el("div", "tl-track");
      var bar = el("div", "tl-bar");
      bar.style.height = (y[1] / 6 * 100) + "%";
      bar.style.background = T.yrRamp[y[1] - 1];
      track.appendChild(bar);
      cell.appendChild(track);
      cell.appendChild(el("div", "tl-yl", "\u2019" + y[0]));
      bars.appendChild(cell);
    });
    var pivot = el("div", "tl-pivot-line");
    plot.appendChild(bands);
    plot.appendChild(bars);
    plot.appendChild(pivot);

    var ramp = el("div", "tl-ramp");
    ramp.style.background = T.rampGradient || "linear-gradient(90deg, #dfe3ea, #273248)";
    var cap = el("div", "tl-rampcap");
    cap.appendChild(el("span", null, "sparse, the early years, 2016 to 2018"));
    cap.appendChild(el("span", null, "dense, 2024 to 2026"));

    wrap.appendChild(head);
    wrap.appendChild(plot);
    wrap.appendChild(ramp);
    wrap.appendChild(cap);
    host.replaceChildren(wrap);

    // era headers, bands and the pivot are positioned from the measured bar
    // columns so their boundaries land exactly on 2018, 2021 and 2024.
    var doLayout = function () { layoutTimeline(head, plot, bands, bars, pivot); };
    requestAnimationFrame(doLayout);
    requestAnimationFrame(function () { requestAnimationFrame(doLayout); });
    window.addEventListener("load", doLayout);
    if (window.ResizeObserver) { new ResizeObserver(doLayout).observe(plot); }
    if (!renderTimeline._bound) {
      window.addEventListener("resize", doLayout);
      renderTimeline._bound = true;
    }
  }

  function layoutTimeline(head, plot, bands, bars, pivot) {
    var cells = [].slice.call(bars.querySelectorAll(".tl-cell"));
    // bail and retry until the grid has actually resolved a real width, so we
    // never write collapsed left:0/width:0 positions as the resting state.
    if (cells.length < 11 ||
        plot.getBoundingClientRect().width < 10 ||
        cells[10].getBoundingClientRect().width < 2) {
      requestAnimationFrame(function () { layoutTimeline(head, plot, bands, bars, pivot); });
      return;
    }
    var pl = plot.getBoundingClientRect().left;
    function edgeL(i) { return cells[i].getBoundingClientRect().left - pl; }
    function edgeR(i) { return cells[i].getBoundingClientRect().right - pl; }
    function ctr(i) { var r = cells[i].getBoundingClientRect(); return r.left + r.width / 2 - pl; }
    // era boundaries sit on the shared years 2018, 2021, 2024 (indices 2, 5, 8)
    var b = [edgeL(0), ctr(2), ctr(5), ctr(8), edgeR(10)];
    var eraCol = ["#5a6128", "#cb7858", "#b15043", "#43b187"];

    bands.replaceChildren();
    var i;
    for (i = 0; i < 4; i++) {
      var band = el("div", "tl-band");
      band.style.left = b[i] + "px";
      band.style.width = (b[i + 1] - b[i]) + "px";
      band.style.background = T.eraBands[i];
      bands.appendChild(band);
    }
    [b[1], b[2], b[3]].forEach(function (x) {
      var d = el("div", "tl-div");
      d.style.left = x + "px";
      bands.appendChild(d);
    });

    pivot.style.left = b[2] + "px";

    head.replaceChildren();
    ERAS.forEach(function (e, idx) {
      var lx = b[idx], rx = b[idx + 1], mid = (lx + rx) / 2;
      var blk = el("div", "tl-eblock");
      blk.style.left = lx + "px";
      blk.style.width = (rx - lx) + "px";
      blk.appendChild(el("span", "tl-rn", e[0]));
      blk.appendChild(el("span", "tl-en", e[1]));
      blk.appendChild(el("span", "tl-es", e[2]));
      head.appendChild(blk);
      var con = el("div", "tl-con");
      con.style.left = mid + "px";
      con.style.background = eraCol[idx];
      head.appendChild(con);
    });
    var plab = el("div", "tl-pivot-label", "the strategic pivot, 2021");
    plab.style.left = b[2] + "px";
    head.appendChild(plab);
  }

  /* ---- 5a · outcome domains (radial wheel) ----------------- */
  function renderDomains() {
    var host = byId("domainFig");
    if (!host) return;
    var W = 440, H = 300, cx = 220, cy = 150, R = 96, cr = 38;
    var hues = T.domainHues;
    var s = "";
    DOMAINS.forEach(function (lines, i) {
      var a = (-90 + i * 45) * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
      var x0 = cx + cr * co, y0 = cy + cr * si, nx = cx + R * co, ny = cy + R * si;
      var lx = cx + (R + 16) * co, ly = cy + (R + 16) * si;
      var anc = co > 0.3 ? "start" : co < -0.3 ? "end" : "middle";
      s += '<line x1="' + x0.toFixed(1) + '" y1="' + y0.toFixed(1) + '" x2="' + nx.toFixed(1) + '" y2="' + ny.toFixed(1) + '" stroke="' + hues[i] + '" stroke-width="2.4" opacity=".7"/>';
      s += '<circle cx="' + nx.toFixed(1) + '" cy="' + ny.toFixed(1) + '" r="6.5" fill="' + hues[i] + '"/>';
      var dy0 = -(lines.length - 1) * 6;
      s += '<text x="' + lx.toFixed(1) + '" y="' + (ly + dy0).toFixed(1) + '" text-anchor="' + anc + '">' +
        lines.map(function (t, k) { return '<tspan x="' + lx.toFixed(1) + '" dy="' + (k ? 12 : 0) + '">' + t + "</tspan>"; }).join("") + "</text>";
    });
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + cr + '" fill="' + T.wheelCore + '" stroke="' + T.wheelCoreLine + '"/>';
    s += '<text class="ctr" x="' + cx + '" y="' + (cy - 4) + '" text-anchor="middle"><tspan x="' + cx + '">the healing</tspan><tspan x="' + cx + '" dy="13">person</tspan></text>';
    host.replaceChildren(svgFrom('<svg xmlns="http://www.w3.org/2000/svg" class="lensfig" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="radial wheel of eight co-equal outcome domains">' + s + "</svg>"));
  }

  /* ---- 5b · impact levels (nested rings) ------------------- */
  function renderLevels() {
    var host = byId("levelFig");
    if (!host) return;
    var W = 300, H = 272, cx = 150, cy = 132;
    var lr = [26, 42, 59, 77, 96, 116];
    var lc = T.ringRamp;
    var s = "";
    for (var i = LEVELS.length - 1; i >= 0; i--) {
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + lr[i] + '" fill="' + lc[i] + '" stroke="' + T.ringLine + '" stroke-width="1.5"/>';
    }
    LEVELS.forEach(function (t, i) {
      s += '<text class="lvl" x="' + cx + '" y="' + (cy - lr[i] + 11) + '" text-anchor="middle">' + t + "</text>";
    });
    s += '<text class="cap" x="' + cx + '" y="' + (cy + lr[5] + 18) + '" text-anchor="middle">the individual at the core, the ecosystem at the edge</text>';
    host.replaceChildren(svgFrom('<svg xmlns="http://www.w3.org/2000/svg" class="lensfig" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="six nested rings of impact, individual to ecosystem">' + s + "</svg>"));
  }

  /* ---- date, brand format ---------------------------------- */
  function renderDate() {
    var d = byId("today");
    if (!d) return;
    var months = ["january", "february", "march", "april", "may", "june",
      "july", "august", "september", "october", "november", "december"];
    var now = new Date();
    var dd = String(now.getDate()).padStart(2, "0");
    d.textContent = dd + " " + months[now.getMonth()] + " " + now.getFullYear();
  }

  function boot() {
    renderDate();
    renderMatrix();
    renderEvals();
    renderGeo();
    renderGeoMap();
    renderTimeline();
    renderDomains();
    renderLevels();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else { boot(); }
})();
