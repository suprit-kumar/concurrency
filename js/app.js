/*
 * app.js - shell: topic registry, nav + scroll-spy, theme, progress tracking, glossary drawer, hero animation.
 *
 * FROZEN CONTRACT: App.registerTopic({id, title, accent, mount(el)}).
 * Additive API: App.store, App.markComplete(id), App.isComplete(id), App.openGlossary(), App.closeGlossary().
 * Optional topic fields: kicker (string), demo (true = not counted in the progress ring).
 */
(function (global) {
  'use strict';

  var h = global.UI.h;

  /* ---------- storage: localStorage wrapped in try/catch with an in-memory fallback ---------- */
  var PREFIX = 'cm.';
  var memory = {};
  var ls = null;
  try {
    ls = global.localStorage;
    ls.setItem(PREFIX + '__probe', '1');
    ls.removeItem(PREFIX + '__probe');
  } catch (e) { ls = null; }

  var store = {
    persistent: !!ls,
    get: function (key, fallback) {
      var raw = null;
      try { raw = ls ? ls.getItem(PREFIX + key) : null; } catch (e) { raw = null; }
      if (raw === null || raw === undefined) { raw = Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null; }
      if (raw === null) { return fallback; }
      try { return JSON.parse(raw); } catch (e) { return fallback; }
    },
    set: function (key, value) {
      var raw = JSON.stringify(value);
      memory[key] = raw;
      try { if (ls) { ls.setItem(PREFIX + key, raw); } } catch (e) { /* quota or privacy mode: memory copy is kept */ }
    },
    remove: function (key) {
      delete memory[key];
      try { if (ls) { ls.removeItem(PREFIX + key); } } catch (e) { /* ignore */ }
    }
  };

  /* ---------- topic registry ---------- */
  var PLANNED = [
    { id: 'concurrency', title: 'Multithreading & Concurrency', accent: 'concurrency' },
    { id: 'async', title: 'Asynchronous Programming', accent: 'async' },
    { id: 'queues', title: 'Message Queues', accent: 'queues' },
    { id: 'kafka-rabbit', title: 'Kafka & RabbitMQ', accent: 'kafka-rabbit' },
    { id: 'eda', title: 'Event-Driven Architecture', accent: 'eda' },
    { id: 'capstone', title: 'Capstone Project', accent: 'capstone' }
  ];
  var topics = [];
  var sections = {};
  var started = false;
  var progress = store.get('progress', { complete: {} });
  if (!progress || typeof progress !== 'object' || !progress.complete) { progress = { complete: {} }; }

  function accentValue(a) {
    if (!a) { return 'var(--accent-concurrency)'; }
    return /^(#|rgb|hsl|var\()/i.test(a) ? a : 'var(--accent-' + a + ')';
  }

  function plannedIndex(id) {
    for (var i = 0; i < PLANNED.length; i++) { if (PLANNED[i].id === id) { return i; } }
    return -1;
  }

  function registerTopic(t) {
    if (!t || !t.id || typeof t.mount !== 'function') { throw new Error('registerTopic needs {id, title, accent, mount(el)}'); }
    topics = topics.filter(function (x) { return x.id !== t.id; });
    topics.push(t);
    if (started) { mountTopic(t); buildNav(); updateProgress(); }
  }

  function orderedTopics() {
    var order = ['demo'].concat(PLANNED.map(function (p) { return p.id; }));
    return topics.slice().sort(function (a, b) {
      var ia = order.indexOf(a.id); var ib = order.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }

  function mountTopic(t) {
    var host = document.getElementById('topics');
    var existing = sections[t.id];
    if (existing && existing.parentNode) { existing.parentNode.removeChild(existing); }
    var idx = plannedIndex(t.id);
    var kicker = t.kicker || (idx >= 0 ? (t.id === 'capstone' ? 'Capstone' : 'Topic ' + (idx + 1)) : 'Topic');
    var body = h('div', { class: 'topic-body' });
    var sec = h('section', { class: 'topic', id: t.id, 'aria-labelledby': t.id + '-title', style: '--accent:' + accentValue(t.accent) }, [
      h('div', { class: 'container' }, [
        h('div', { class: 'topic-head' }, [
          h('div', null, [h('span', { class: 'eyebrow', text: kicker }), h('h2', { id: t.id + '-title', text: t.title })]),
          h('span', { class: 'topic-badge', role: 'status', text: '\u2713 Completed' })
        ]),
        body
      ])
    ]);
    sec.classList.toggle('is-complete', !!progress.complete[t.id]);
    // Insert in curriculum order.
    var order = orderedTopics().map(function (x) { return x.id; });
    var after = null;
    for (var i = order.indexOf(t.id) + 1; i < order.length; i++) {
      if (sections[order[i]] && sections[order[i]].parentNode === host) { after = sections[order[i]]; break; }
    }
    host.insertBefore(sec, after);
    sections[t.id] = sec;
    try { t.mount(body); }
    catch (err) {
      if (global.console) { console.error(err); }
      body.appendChild(global.UI.callout('err', 'This topic failed to load', 'Open the browser console for details: ' + (err && err.message ? err.message : err)).el);
    }
    observeSection(sec);
  }

  /* ---------- progress ---------- */
  function isComplete(id) { return !!progress.complete[id]; }

  function markComplete(id) {
    if (progress.complete[id]) { return; }
    progress.complete[id] = true;
    store.set('progress', progress);
    var sec = sections[id];
    if (sec) { sec.classList.add('is-complete'); }
    var t = topics.filter(function (x) { return x.id === id; })[0];
    global.UI.toast('Completed: ' + (t ? t.title : id), { type: 'ok' });
    buildNav();
    updateProgress();
  }

  function resetProgress() {
    progress = { complete: {} };
    store.set('progress', progress);
    Object.keys(sections).forEach(function (id) { sections[id].classList.remove('is-complete'); });
    buildNav();
    updateProgress();
    global.UI.toast('Progress reset', { type: 'warn' });
  }

  var RING_C = 2 * Math.PI * 24;

  function updateProgress() {
    var done = PLANNED.filter(function (p) { return progress.complete[p.id]; }).length;
    var total = PLANNED.length;
    var bar = document.getElementById('ring-bar');
    var label = document.getElementById('ring-label');
    var text = document.getElementById('ring-text');
    if (bar) { bar.style.strokeDasharray = RING_C.toFixed(2); bar.style.strokeDashoffset = (RING_C * (1 - done / total)).toFixed(2); }
    if (label) { label.textContent = done + '/' + total; }
    if (text) { text.innerHTML = ''; text.appendChild(h('strong', { text: done === total ? 'Course complete' : done + ' of ' + total + ' complete' })); text.appendChild(document.createTextNode('Pass each quiz with 70% or more.')); }
    var ringEl = document.getElementById('ring');
    if (ringEl) { ringEl.setAttribute('aria-label', 'Course progress: ' + done + ' of ' + total + ' topics complete'); }
  }

  /* ---------- nav + scroll-spy ---------- */
  var activeId = '';

  function buildNav() {
    var nav = document.getElementById('nav');
    if (!nav) { return; }
    nav.innerHTML = '';
    var have = {};
    topics.forEach(function (t) { have[t.id] = t; });
    var entries = [];
    if (have.demo) { entries.push(have.demo); }
    PLANNED.forEach(function (p) { entries.push(have[p.id] || { id: p.id, title: p.title, accent: p.accent, soon: true }); });
    entries.forEach(function (t) {
      var style = '--item-accent:' + accentValue(t.accent);
      var inner = [h('span', { class: 'dot', 'aria-hidden': 'true' }), h('span', { class: 'name', text: t.title })];
      var li = h('li');
      if (t.soon) {
        inner.push(h('small', { text: 'Soon' }));
        li.appendChild(h('span', { class: 'nav-item is-disabled', style: style, 'aria-disabled': 'true' }, inner));
      } else {
        if (t.id === 'demo') { inner.push(h('small', { text: 'Stage 1' })); }
        if (progress.complete[t.id]) { inner.push(h('span', { class: 'badge-done', role: 'img', 'aria-label': 'Completed', text: '\u2713' })); }
        var a = h('a', { class: 'nav-item', href: '#' + t.id, style: style, 'data-id': t.id }, inner);
        if (activeId === t.id) { a.classList.add('is-active'); a.setAttribute('aria-current', 'true'); }
        a.addEventListener('click', closeSidebar);
        li.appendChild(a);
      }
      nav.appendChild(li);
    });
  }

  function setActive(id) {
    activeId = id;
    var links = document.querySelectorAll('#nav a.nav-item');
    Array.prototype.forEach.call(links, function (a) {
      var on = a.getAttribute('data-id') === id;
      a.classList.toggle('is-active', on);
      if (on) { a.setAttribute('aria-current', 'true'); } else { a.removeAttribute('aria-current'); }
    });
  }

  var spy = null;
  function observeSection(sec) { if (spy) { spy.observe(sec); } }

  function initSpy() {
    if (!('IntersectionObserver' in global)) { return; }
    spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { setActive(e.target.id); } });
    }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });
    Object.keys(sections).forEach(function (id) { spy.observe(sections[id]); });
    var hero = document.getElementById('top');
    if (hero) { spy.observe(hero); }
  }

  /* ---------- sidebar (mobile) ---------- */
  function openSidebar() {
    document.getElementById('sidebar').classList.add('is-open');
    document.getElementById('backdrop').classList.add('is-open');
    var mb = document.getElementById('menu-btn');
    if (mb) { mb.setAttribute('aria-expanded', 'true'); }
  }
  function closeSidebar() {
    var sb = document.getElementById('sidebar');
    if (!sb) { return; }
    sb.classList.remove('is-open');
    var bd = document.getElementById('backdrop');
    if (bd && !drawerOpen) { bd.classList.remove('is-open'); }
    var mb = document.getElementById('menu-btn');
    if (mb) { mb.setAttribute('aria-expanded', 'false'); }
  }

  /* ---------- theme ---------- */
  var themeListeners = [];
  function currentTheme() { return document.documentElement.getAttribute('data-theme') || 'dark'; }
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var btn = document.getElementById('theme-btn');
    if (btn) {
      btn.setAttribute('aria-pressed', t === 'light' ? 'true' : 'false');
      btn.setAttribute('aria-label', t === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
      btn.textContent = t === 'light' ? '\u263E' : '\u2600';
    }
    themeListeners.forEach(function (fn) { fn(t); });
  }
  function toggleTheme() {
    var next = currentTheme() === 'light' ? 'dark' : 'light';
    store.set('theme', next);
    applyTheme(next);
  }

  /* ---------- glossary drawer ---------- */
  var drawer = null, drawerSearch = null, drawerList = null, drawerMeta = null, drawerOpen = false, lastFocus = null;
  var TOPIC_LABEL = { concurrency: 'Concurrency', async: 'Async', queues: 'Queues', 'kafka-rabbit': 'Kafka & RabbitMQ', eda: 'Event-driven' };

  function highlight(text, q) {
    var frag = document.createDocumentFragment();
    if (!q) { frag.appendChild(document.createTextNode(text)); return frag; }
    var lower = text.toLowerCase();
    var needle = q.toLowerCase();
    var pos = 0;
    var i;
    while ((i = lower.indexOf(needle, pos)) >= 0) {
      if (i > pos) { frag.appendChild(document.createTextNode(text.slice(pos, i))); }
      frag.appendChild(h('mark', { text: text.slice(i, i + needle.length) }));
      pos = i + needle.length;
    }
    if (pos < text.length) { frag.appendChild(document.createTextNode(text.slice(pos))); }
    return frag;
  }

  function renderGlossary() {
    var q = drawerSearch.value.trim();
    var data = (global.GLOSSARY || []).slice().sort(function (a, b) { return a.term.localeCompare(b.term); });
    var hits = data.filter(function (g) {
      if (!q) { return true; }
      var hay = (g.term + ' ' + g.def + ' ' + g.analogy + ' ' + (TOPIC_LABEL[g.topic] || '')).toLowerCase();
      return hay.indexOf(q.toLowerCase()) >= 0;
    });
    drawerList.innerHTML = '';
    hits.forEach(function (g) {
      var title = h('h3');
      title.appendChild(highlight(g.term, q));
      title.appendChild(h('span', { class: 'chip', text: TOPIC_LABEL[g.topic] || g.topic }));
      var def = h('p'); def.appendChild(highlight(g.def, q));
      var an = h('p', { class: 'an' }); an.appendChild(h('strong', { text: 'Analogy: ' })); an.appendChild(highlight(g.analogy, q));
      drawerList.appendChild(h('li', { class: 'gloss-item' }, [title, def, an]));
    });
    if (!hits.length) { drawerList.appendChild(h('li', { class: 'gloss-empty', text: 'No terms match "' + q + '". Try a shorter word.' })); }
    drawerMeta.textContent = hits.length + ' of ' + data.length + ' terms';
  }

  function buildDrawer() {
    drawerSearch = h('input', { class: 'search', type: 'search', id: 'gloss-search', placeholder: 'Search terms, e.g. "deadlock" or "retry"', 'aria-label': 'Search glossary', autocomplete: 'off' });
    drawerMeta = h('div', { class: 'drawer-meta', 'aria-live': 'polite' });
    drawerList = h('ul', { class: 'drawer-list' });
    var closeBtn = h('button', { class: 'btn btn-sm', type: 'button', 'aria-label': 'Close glossary', text: 'Close \u2715' });
    drawer = h('aside', { class: 'drawer', id: 'glossary', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'glossary-title', 'aria-hidden': 'true' }, [
      h('div', { class: 'drawer-head' }, [
        h('div', { class: 'drawer-title' }, [h('h2', { id: 'glossary-title', text: 'Glossary' }), closeBtn]),
        drawerSearch, drawerMeta
      ]),
      drawerList
    ]);
    document.body.appendChild(drawer);
    closeBtn.addEventListener('click', closeGlossary);
    drawerSearch.addEventListener('input', renderGlossary);
    drawer.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') { return; }
      var f = drawer.querySelectorAll('button, input, a[href], [tabindex]:not([tabindex="-1"])');
      if (!f.length) { return; }
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    renderGlossary();
  }

  function openGlossary() {
    if (drawerOpen) { drawerSearch.focus(); return; }
    drawerOpen = true;
    lastFocus = document.activeElement;
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.getElementById('backdrop').classList.add('is-open');
    drawerSearch.select();
    drawerSearch.focus();
  }
  function closeGlossary() {
    if (!drawerOpen) { return; }
    drawerOpen = false;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    var sb = document.getElementById('sidebar');
    if (!sb.classList.contains('is-open')) { document.getElementById('backdrop').classList.remove('is-open'); }
    if (lastFocus && lastFocus.focus) { lastFocus.focus(); }
  }

  /* ---------- scroll progress bar ---------- */
  function initScrollBar() {
    var fill = document.querySelector('#scrollbar > i');
    var ticking = false;
    function update() {
      var max = document.documentElement.scrollHeight - global.innerHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, global.scrollY / max)) : 0;
      fill.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      ticking = false;
    }
    global.addEventListener('scroll', function () { if (!ticking) { ticking = true; global.requestAnimationFrame(update); } }, { passive: true });
    global.addEventListener('resize', update);
    update();
  }

  /* ---------- hero animation: producers -> broker -> consumers, drawn on canvas ---------- */
  function initHero() {
    var canvas = document.getElementById('hero-canvas');
    if (!canvas || !canvas.getContext) { return; }
    var ctx = canvas.getContext('2d');
    var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)');
    var w = 0, hgt = 0, dpr = 1, raf = 0, last = 0, spawn = 0, visible = true, packets = [], colors = [], dim = '#999', seed = Sim.random(7);

    function readColors() {
      var cs = getComputedStyle(document.documentElement);
      colors = ['concurrency', 'async', 'queues', 'kafka-rabbit', 'eda'].map(function (k) { return cs.getPropertyValue('--accent-' + k).trim() || '#8b7cff'; });
      dim = cs.getPropertyValue('--text-faint').trim() || '#999';
    }
    function resize() {
      var r = canvas.getBoundingClientRect();
      dpr = Math.min(2, global.devicePixelRatio || 1);
      w = Math.max(1, r.width); hgt = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(hgt * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }
    function layout() {
      var xs = w > 700 ? [0.60, 0.80, 0.94] : [0.45, 0.72, 0.94];
      var P = [0.22, 0.5, 0.78].map(function (y) { return { x: w * xs[0], y: hgt * y }; });
      var B = { x: w * xs[1], y: hgt * 0.5 };
      var C = [0.3, 0.7].map(function (y) { return { x: w * xs[2], y: hgt * y }; });
      return { P: P, B: B, C: C };
    }
    function spawnPacket() {
      packets.push({ p: Math.floor(seed() * 3), c: Math.floor(seed() * 2), t: 0, col: colors[Math.floor(seed() * colors.length)] });
    }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function draw() {
      ctx.clearRect(0, 0, w, hgt);
      var L = layout();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = dim; ctx.globalAlpha = 0.35;
      L.P.forEach(function (p) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(L.B.x, L.B.y); ctx.stroke(); });
      L.C.forEach(function (c) { ctx.beginPath(); ctx.moveTo(L.B.x, L.B.y); ctx.lineTo(c.x, c.y); ctx.stroke(); });
      ctx.globalAlpha = 0.9;
      L.P.forEach(function (p, i) { ctx.fillStyle = colors[i % colors.length]; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 6.283); ctx.fill(); });
      L.C.forEach(function (c, i) { ctx.fillStyle = colors[(i + 3) % colors.length]; ctx.beginPath(); ctx.arc(c.x, c.y, 7, 0, 6.283); ctx.fill(); });
      ctx.fillStyle = dim; ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(L.B.x - 16, L.B.y - 30, 32, 60, 8) : ctx.rect(L.B.x - 16, L.B.y - 30, 32, 60); ctx.fill();
      ctx.globalAlpha = 1;
      packets.forEach(function (k) {
        var a = L.P[k.p], c = L.C[k.c], x, y;
        if (k.t < 1) { x = lerp(a.x, L.B.x, k.t); y = lerp(a.y, L.B.y, k.t); }
        else { var u = k.t - 1; x = lerp(L.B.x, c.x, u); y = lerp(L.B.y, c.y, u); }
        ctx.fillStyle = k.col; ctx.shadowColor = k.col; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 6.283); ctx.fill();
        ctx.shadowBlur = 0;
      });
    }
    function frame(ts) {
      raf = 0;
      var dt = Math.min(64, ts - last); last = ts;
      spawn += dt;
      if (spawn > 650) { spawn = 0; spawnPacket(); }
      packets.forEach(function (k) { k.t += dt / 1800; });
      packets = packets.filter(function (k) { return k.t < 2; });
      draw();
      if (visible && !document.hidden) { raf = global.requestAnimationFrame(frame); }
    }
    function start() {
      if (raf || (reduce && reduce.matches) || !visible || document.hidden) { return; }
      last = performance.now();
      raf = global.requestAnimationFrame(frame);
    }
    function stop() { if (raf) { global.cancelAnimationFrame(raf); raf = 0; } }

    readColors();
    if (reduce && reduce.matches) { for (var i = 0; i < 5; i++) { spawnPacket(); packets[i].t = 0.2 + i * 0.35; } }
    resize();
    global.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', function () { if (document.hidden) { stop(); } else { start(); } });
    global.UI.onVisible(canvas, function () { visible = true; start(); }, function () { visible = false; stop(); });
    themeListeners.push(function () { readColors(); draw(); });
    if (reduce && reduce.addEventListener) { reduce.addEventListener('change', function () { if (reduce.matches) { stop(); } else { start(); } }); }
  }

  /* ---------- init ---------- */
  function init() {
    started = true;
    applyTheme(currentTheme());
    document.getElementById('theme-btn').addEventListener('click', toggleTheme);
    document.getElementById('menu-btn').addEventListener('click', function () {
      if (document.getElementById('sidebar').classList.contains('is-open')) { closeSidebar(); } else { openSidebar(); }
    });
    document.getElementById('backdrop').addEventListener('click', function () { closeGlossary(); closeSidebar(); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-open-glossary]'), function (b) { b.addEventListener('click', openGlossary); });
    document.getElementById('reset-progress').addEventListener('click', function () {
      if (global.confirm('Reset all progress and quiz scores?')) { resetProgress(); }
    });
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (drawerOpen) { closeGlossary(); } else { openGlossary(); }
      } else if (e.key === 'Escape') {
        if (drawerOpen) { closeGlossary(); } else { closeSidebar(); }
      }
    });
    buildDrawer();
    orderedTopics().forEach(mountTopic);
    buildNav();
    updateProgress();
    initSpy();
    initScrollBar();
    initHero();
    if (!store.persistent) {
      global.UI.toast('Storage is unavailable, so progress will only last until you close this tab.', { type: 'warn', ms: 5000 });
    }
    if (global.location.hash) {
      var target = document.getElementById(global.location.hash.slice(1));
      if (target) { target.scrollIntoView(); }
    }
  }

  global.App = {
    registerTopic: registerTopic,
    store: store,
    markComplete: markComplete,
    isComplete: isComplete,
    openGlossary: openGlossary,
    closeGlossary: closeGlossary,
    planned: PLANNED,
    topics: function () { return topics.slice(); }
  };

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})(window);
