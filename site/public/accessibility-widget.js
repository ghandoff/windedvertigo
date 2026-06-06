/* winded.vertigo accessibility widget — self-contained IIFE
   Injected into harbour apps via harbour-nav-widget.js.
   Mirrors the React AccessibilityWidget + accessibility-context logic.
   No external dependencies. DOM created via safe methods only. */
(function () {
  if (window.__wvA11yMounted) return;
  window.__wvA11yMounted = true;

  var BRAND = {
    cadet:     '#273248',
    champagne: '#ffebd2',
    redwood:   '#b15043',
    focus:     '#3B82F6',
  };

  var LS_PREFIX = 'wv-a11y-';
  var TOGGLES = [
    { key: 'still',          label: 'stop animations'  },
    { key: 'textLg',         label: 'bigger text'      },
    { key: 'highContrast',   label: 'high contrast'    },
    { key: 'wideSpacing',    label: 'wide spacing'     },
    { key: 'dyslexiaFont',   label: 'legible font'     },
    { key: 'highlightLinks', label: 'highlight links'  },
    { key: 'bigCursor',      label: 'big cursor'       },
    { key: 'readingGuide',   label: 'reading guide'    },
    { key: 'grayscale',      label: 'grayscale'        },
  ];

  // Maps React context keys to dataset property names (camelCase → data-* attribute)
  var ATTR_MAP = {
    still:          'still',
    textLg:         'textLg',
    highContrast:   'highContrast',
    wideSpacing:    'wideSpacing',
    dyslexiaFont:   'dyslexiaFont',
    highlightLinks: 'highlightLinks',
    bigCursor:      'bigCursor',
    readingGuide:   'readingGuide',
    grayscale:      'grayscale',
  };

  // ── state ─────────────────────────────────────────────────────

  var state = {};
  TOGGLES.forEach(function (t) {
    state[t.key] = localStorage.getItem(LS_PREFIX + t.key) === '1';
  });

  var guideEl = null;
  var guideMoveHandler = null;

  function setAttr(key, active) {
    var attr = ATTR_MAP[key];
    if (!attr) return;
    if (active) {
      document.documentElement.dataset[attr] = '';
    } else {
      delete document.documentElement.dataset[attr];
    }
  }

  function applyAll() {
    TOGGLES.forEach(function (t) { setAttr(t.key, state[t.key]); });
    syncReadingGuide();
  }

  function toggle(key) {
    state[key] = !state[key];
    localStorage.setItem(LS_PREFIX + key, state[key] ? '1' : '0');
    setAttr(key, state[key]);
    if (key === 'readingGuide') syncReadingGuide();
    updateSwitchUI(key);
  }

  function resetAll() {
    TOGGLES.forEach(function (t) {
      state[t.key] = false;
      localStorage.setItem(LS_PREFIX + t.key, '0');
      setAttr(t.key, false);
      updateSwitchUI(t.key);
    });
    syncReadingGuide();
  }

  function syncReadingGuide() {
    if (state.readingGuide) {
      if (!guideEl) {
        guideEl = document.createElement('div');
        guideEl.className = 'a11y-reading-guide';
        guideEl.setAttribute('aria-hidden', 'true');
        document.body.appendChild(guideEl);
        guideMoveHandler = function (e) {
          if (guideEl) guideEl.style.top = e.clientY + 'px';
        };
        window.addEventListener('mousemove', guideMoveHandler);
      }
    } else {
      if (guideEl) {
        if (guideEl.parentNode) guideEl.parentNode.removeChild(guideEl);
        guideEl = null;
      }
      if (guideMoveHandler) {
        window.removeEventListener('mousemove', guideMoveHandler);
        guideMoveHandler = null;
      }
    }
  }

  // ── CSS injection ─────────────────────────────────────────────

  var BIG_CURSOR_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cpath d='M4 2 L4 27 L10 21 L14 31 L18 29 L14 19 L22 19 Z' fill='%23273248' stroke='%23ffebd2' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E";

  var styleRules = [
    '.a11y-trigger{position:fixed;left:0;top:50%;transform:translateY(-50%);z-index:20002;width:44px;height:44px;background:' + BRAND.cadet + ';border:1px solid rgba(255,235,210,.18);border-left:none;border-radius:0 10px 10px 0;cursor:pointer;display:flex;align-items:center;justify-content:center;color:' + BRAND.champagne + ';opacity:.6;transition:opacity .2s ease,box-shadow .2s ease;padding:10px;box-shadow:2px 0 12px rgba(0,0,0,.25);}',
    '.a11y-trigger:hover,.a11y-trigger--open{opacity:1;box-shadow:2px 0 18px rgba(0,0,0,.4);}',
    '.a11y-trigger svg{width:22px;height:22px;flex-shrink:0;display:block;}',
    '.a11y-panel{position:fixed;left:44px;top:50%;transform:translateY(-50%) translateX(-300px);transition:transform .25s cubic-bezier(.4,0,.2,1),opacity .2s ease;opacity:0;pointer-events:none;z-index:20001;width:260px;max-height:80vh;overflow-y:auto;background:' + BRAND.cadet + ';border:1px solid rgba(255,235,210,.18);border-left:none;border-radius:0 12px 12px 0;box-shadow:4px 0 28px rgba(0,0,0,.35);scrollbar-width:thin;}',
    '.a11y-panel--open{transform:translateY(-50%) translateX(0);opacity:1;pointer-events:auto;}',
    '.a11y-panel-inner{padding:16px 16px 8px;}',
    '.a11y-panel-title{font-size:.72rem;font-weight:600;letter-spacing:.1em;text-transform:lowercase;color:rgba(255,235,210,.55);margin:0 0 8px;padding-bottom:8px;border-bottom:1px solid rgba(255,235,210,.1);font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;}',
    '.a11y-toggle-list{list-style:none;padding:0;margin:0 0 8px;}',
    '.a11y-toggle-item{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 0;border-bottom:1px solid rgba(255,235,210,.07);}',
    '.a11y-toggle-item:last-child{border-bottom:none;}',
    '.a11y-toggle-label{font-size:.8rem;font-weight:500;color:' + BRAND.champagne + ';text-transform:lowercase;letter-spacing:.02em;cursor:default;user-select:none;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;}',
    '.a11y-switch{position:relative;flex-shrink:0;width:34px;height:18px;background:rgba(255,235,210,.15);border:none;border-radius:9px;cursor:pointer;transition:background .2s ease;padding:0;}',
    '.a11y-switch::after{content:"";position:absolute;top:3px;left:3px;width:12px;height:12px;background:rgba(255,235,210,.5);border-radius:50%;transition:transform .18s ease,background .2s ease;}',
    '.a11y-switch[aria-checked="true"]{background:' + BRAND.redwood + ';}',
    '.a11y-switch[aria-checked="true"]::after{transform:translateX(16px);background:' + BRAND.champagne + ';}',
    '.a11y-reset{display:block;width:100%;background:none;border:none;border-top:1px solid rgba(255,235,210,.1);padding:8px 16px;text-align:center;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:lowercase;color:rgba(255,235,210,.45);cursor:pointer;transition:color .2s ease;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;}',
    '.a11y-reset:hover{color:' + BRAND.champagne + ';}',
    '.a11y-reading-guide{position:fixed;left:0;right:0;height:40px;background:rgba(255,235,210,.07);border-top:1px solid rgba(255,235,210,.18);border-bottom:1px solid rgba(255,235,210,.18);pointer-events:none;z-index:19990;transform:translateY(-50%);}',
    'html[data-text-lg]{font-size:112.5%;}',
    'html[data-high-contrast] body{background:#fff!important;color:#000!important;}',
    'html[data-wide-spacing] body,html[data-wide-spacing] p,html[data-wide-spacing] li,html[data-wide-spacing] h1,html[data-wide-spacing] h2,html[data-wide-spacing] h3{letter-spacing:.06em;word-spacing:.14em;line-height:1.9;}',
    '@font-face{font-family:"OpenDyslexic";src:url("https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/fonts/OpenDyslexic-Regular.woff2") format("woff2");font-weight:normal;font-display:swap;}',
    'html[data-dyslexia-font],html[data-dyslexia-font] body,html[data-dyslexia-font] *{font-family:"OpenDyslexic",sans-serif!important;}',
    'html[data-highlight-links] a{text-decoration:underline!important;text-decoration-thickness:2px!important;text-underline-offset:3px!important;font-weight:700!important;}',
    'html[data-big-cursor],html[data-big-cursor] *{cursor:url("' + BIG_CURSOR_URL + '") 4 2,auto!important;}',
    'html[data-grayscale]{filter:grayscale(100%);}',
  ];

  var styleEl = document.createElement('style');
  styleEl.setAttribute('data-wv-a11y', '');
  styleEl.textContent = styleRules.join('\n');
  document.head.appendChild(styleEl);

  // ── SVG icon (DOM-safe, no innerHTML) ─────────────────────────
  // Font Awesome fa-universal-access (CC BY 4.0, fontawesome.com/license/free)
  // Compound path — ring + person figure. fill-rule=evenodd creates the
  // transparent gaps between the ring and the body.

  function createSVGIcon() {
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 512 512');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('fill-rule', 'evenodd');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    var p = document.createElementNS(NS, 'path');
    p.setAttribute('d', 'M256 48c114.953 0 208 93.029 208 208 0 114.953-93.029 208-208 208-114.953 0-208-93.029-208-208 0-114.953 93.029-208 208-208m0-40C119.033 8 8 119.033 8 256s111.033 248 248 248 248-111.033 248-248S392.967 8 256 8zm0 56C149.961 64 64 149.961 64 256s85.961 192 192 192 192-85.961 192-192S362.039 64 256 64zm0 44c19.882 0 36 16.118 36 36s-16.118 36-36 36-36-16.118-36-36 16.118-36 36-36zm117.741 98.023c-28.712 6.779-55.511 12.748-82.14 15.807.851 101.023 12.306 123.052 25.037 155.621 3.617 9.26-.957 19.698-10.217 23.315-9.261 3.617-19.699-.957-23.316-10.217-8.705-22.308-17.086-40.636-22.261-78.549h-9.686c-5.167 37.851-13.534 56.208-22.262 78.549-3.615 9.255-14.05 13.836-23.315 10.217-9.26-3.617-13.834-14.056-10.217-23.315 12.713-32.541 24.185-54.541 25.037-155.621-26.629-3.058-53.428-9.027-82.141-15.807-8.6-2.031-13.926-10.648-11.895-19.249s10.647-13.926 19.249-11.895c96.686 22.829 124.283 22.783 220.775 0 8.599-2.03 17.218 3.294 19.249 11.895 2.029 8.601-3.297 17.219-11.897 19.249z');
    svg.appendChild(p);
    return svg;
  }

  // ── DOM construction ──────────────────────────────────────────

  var trigger = document.createElement('button');
  trigger.className = 'a11y-trigger';
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', 'a11y-panel-wv');
  trigger.setAttribute('aria-label', 'open accessibility options');
  trigger.appendChild(createSVGIcon());

  var panel = document.createElement('div');
  panel.id = 'a11y-panel-wv';
  panel.className = 'a11y-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'accessibility options');
  panel.setAttribute('aria-hidden', 'true');

  var inner = document.createElement('div');
  inner.className = 'a11y-panel-inner';

  var titleEl = document.createElement('p');
  titleEl.className = 'a11y-panel-title';
  titleEl.textContent = 'accessibility';
  inner.appendChild(titleEl);

  var listEl = document.createElement('ul');
  listEl.className = 'a11y-toggle-list';

  var switchEls = {};
  TOGGLES.forEach(function (t) {
    var li = document.createElement('li');
    li.className = 'a11y-toggle-item';

    var labelEl = document.createElement('span');
    labelEl.className = 'a11y-toggle-label';
    labelEl.id = 'a11y-label-wv-' + t.key;
    labelEl.textContent = t.label;

    var sw = document.createElement('button');
    sw.className = 'a11y-switch';
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-checked', state[t.key] ? 'true' : 'false');
    sw.setAttribute('aria-labelledby', 'a11y-label-wv-' + t.key);
    sw.setAttribute('tabindex', '-1');
    sw.addEventListener('click', (function (key) {
      return function () { toggle(key); };
    }(t.key)));
    switchEls[t.key] = sw;

    li.appendChild(labelEl);
    li.appendChild(sw);
    listEl.appendChild(li);
  });

  inner.appendChild(listEl);
  panel.appendChild(inner);

  var resetBtn = document.createElement('button');
  resetBtn.className = 'a11y-reset';
  resetBtn.textContent = 'reset all';
  resetBtn.setAttribute('tabindex', '-1');
  resetBtn.addEventListener('click', resetAll);
  panel.appendChild(resetBtn);

  document.body.appendChild(trigger);
  document.body.appendChild(panel);

  // ── panel open / close ────────────────────────────────────────

  var isOpen = false;

  function openPanel() {
    isOpen = true;
    trigger.classList.add('a11y-trigger--open');
    trigger.setAttribute('aria-expanded', 'true');
    trigger.setAttribute('aria-label', 'close accessibility options');
    panel.classList.add('a11y-panel--open');
    panel.setAttribute('aria-hidden', 'false');
    TOGGLES.forEach(function (t) { switchEls[t.key].setAttribute('tabindex', '0'); });
    resetBtn.setAttribute('tabindex', '0');
    var first = panel.querySelector('button');
    if (first) first.focus();
  }

  function closePanel() {
    isOpen = false;
    trigger.classList.remove('a11y-trigger--open');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-label', 'open accessibility options');
    panel.classList.remove('a11y-panel--open');
    panel.setAttribute('aria-hidden', 'true');
    TOGGLES.forEach(function (t) { switchEls[t.key].setAttribute('tabindex', '-1'); });
    resetBtn.setAttribute('tabindex', '-1');
    trigger.focus();
  }

  trigger.addEventListener('click', function () {
    if (isOpen) { closePanel(); } else { openPanel(); }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) closePanel();
  });

  document.addEventListener('mousedown', function (e) {
    if (!isOpen) return;
    if (!panel.contains(e.target) && !trigger.contains(e.target)) closePanel();
  });

  function updateSwitchUI(key) {
    var sw = switchEls[key];
    if (sw) sw.setAttribute('aria-checked', state[key] ? 'true' : 'false');
  }

  // Restore persisted preferences on mount
  applyAll();
  TOGGLES.forEach(function (t) { updateSwitchUI(t.key); });

}());
