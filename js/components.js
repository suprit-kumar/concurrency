/*
 * components.js - reusable UI components.
 *
 * FROZEN CONTRACT: UI.tabs(), UI.stepper(), UI.quiz(config), UI.codePanel({tabs:[{lang,code}]}), UI.logPanel(),
 * UI.metrics(), UI.controlBar(sim), UI.predictChallenge(config), UI.toast(), UI.accordion().
 *
 * Every builder returns an object with an `.el` DOM node (append it yourself) plus a small control API.
 * Additive helpers: UI.h, UI.esc, UI.rich, UI.callout, UI.lab, UI.onVisible.
 * All authored text goes through textContent or UI.rich (which escapes first), so content is never injected raw.
 */
(function (global) {
  'use strict';

  var uidCounter = 0;
  function nid(prefix) { return (prefix || 'ui') + '-' + (++uidCounter); }

  /* ---------- DOM helpers ---------- */
  function append(el, kids) {
    if (kids === null || kids === undefined || kids === false) { return; }
    if (!Array.isArray(kids)) { kids = [kids]; }
    kids.forEach(function (k) {
      if (k === null || k === undefined || k === false) { return; }
      if (Array.isArray(k)) { append(el, k); }
      else if (k.nodeType) { el.appendChild(k); }
      else { el.appendChild(document.createTextNode(String(k))); }
    });
  }

  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) { return; }
        if (k === 'class') { el.className = v; }
        else if (k === 'text') { el.textContent = v; }
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') { el.addEventListener(k.slice(2), v); }
        else { el.setAttribute(k, v === true ? '' : v); }
      });
    }
    append(el, kids);
    return el;
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Escapes first, then allows only `code`, **bold**, and blank-line paragraphs / "- " bullet lists.
  function richHtml(s) {
    var blocks = String(s).split(/\n{2,}/);
    return blocks.map(function (block) {
      var lines = block.split('\n');
      var inline = function (t) {
        return esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      };
      if (lines.every(function (l) { return /^\s*-\s+/.test(l); })) {
        return '<ul>' + lines.map(function (l) { return '<li>' + inline(l.replace(/^\s*-\s+/, '')) + '</li>'; }).join('') + '</ul>';
      }
      return '<p>' + lines.map(inline).join('<br>') + '</p>';
    }).join('');
  }

  function rich(s) {
    var d = document.createElement('div');
    d.className = 'rich';
    d.innerHTML = richHtml(s);
    return d;
  }

  // Accepts a Node, a function returning a Node/string, or an authored string.
  function toNode(x) {
    if (typeof x === 'function') { x = x(); }
    if (x && x.nodeType) { return x; }
    if (x && x.el && x.el.nodeType) { return x.el; }
    return rich(x === undefined || x === null ? '' : x);
  }

  function onVisible(el, show, hide) {
    if (!('IntersectionObserver' in global)) { return function () {}; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { if (show) { show(); } }
        else if (hide) { hide(); }
      });
    }, { threshold: 0.01 });
    io.observe(el);
    return function () { io.disconnect(); };
  }

  function chevron() {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'chev');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M5 7.5l5 5 5-5');
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '2');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(p);
    return svg;
  }

  /* ---------- callout ---------- */
  function callout(kind, title, body) {
    var el = h('div', { class: 'callout ' + (kind || '') }, [h('h4', { text: title }), toNode(body)]);
    return { el: el };
  }

  /* ---------- tabs ---------- */
  function tabs(cfg) {
    cfg = cfg || {};
    var items = cfg.tabs || [];
    var base = nid('tabs');
    var list = h('div', { class: 'tabs-list', role: 'tablist', 'aria-label': cfg.label || 'Tabs' });
    var root = h('div', { class: 'tabs' }, [list]);
    var buttons = [];
    var panels = [];
    var current = -1;

    function select(idOrIndex, focus) {
      var idx = typeof idOrIndex === 'number' ? idOrIndex : items.findIndex(function (t) { return t.id === idOrIndex; });
      if (idx < 0 || idx >= items.length) { return; }
      current = idx;
      buttons.forEach(function (b, i) {
        var on = i === idx;
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
        panels[i].hidden = !on;
      });
      if (focus) { buttons[idx].focus(); }
      if (cfg.onChange) { cfg.onChange(items[idx].id, idx); }
    }

    items.forEach(function (t, i) {
      var id = t.id || String(i);
      t.id = id;
      var btn = h('button', {
        class: 'tab-btn', role: 'tab', type: 'button', id: base + '-tab-' + i,
        'aria-controls': base + '-panel-' + i, text: t.label || id
      });
      btn.addEventListener('click', function () { select(i); });
      btn.addEventListener('keydown', function (e) {
        var n = items.length;
        var map = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 };
        if (Object.prototype.hasOwnProperty.call(map, e.key)) { e.preventDefault(); select(map[e.key], true); }
      });
      var panel = h('div', { class: 'tab-panel', role: 'tabpanel', id: base + '-panel-' + i, 'aria-labelledby': base + '-tab-' + i, tabindex: '0' });
      panel.appendChild(toNode(t.content));
      buttons.push(btn);
      panels.push(panel);
      list.appendChild(btn);
      root.appendChild(panel);
    });

    select(cfg.initial !== undefined ? cfg.initial : 0);
    return { el: root, select: select, current: function () { return items[current] && items[current].id; } };
  }

  /* ---------- stepper ---------- */
  function stepper(cfg) {
    cfg = cfg || {};
    var steps = cfg.steps || [];
    var idx = 0;
    var count = h('span', { class: 'stepper-count' });
    var dots = h('div', { class: 'stepper-dots', role: 'group', 'aria-label': 'Jump to step' });
    var bar = h('div', { class: 'stepper-bar' }, [h('i')]);
    var body = h('div', { class: 'stepper-body', 'aria-live': 'polite', tabindex: '-1' });
    var prev = h('button', { class: 'btn btn-sm', type: 'button', text: '\u2190 Back' });
    var next = h('button', { class: 'btn btn-sm btn-primary', type: 'button', text: 'Next \u2192' });
    var dotBtns = steps.map(function (s, i) {
      var b = h('button', { class: 'stepper-dot', type: 'button', text: String(i + 1), 'aria-label': 'Step ' + (i + 1) + ': ' + (s.title || '') });
      b.addEventListener('click', function () { go(i); });
      dots.appendChild(b);
      return b;
    });
    var root = h('div', { class: 'stepper' }, [
      h('div', { class: 'stepper-head' }, [count, dots]),
      bar, body,
      h('div', { class: 'stepper-foot' }, [prev, next])
    ]);

    function go(i) {
      if (!steps.length) { return; }
      idx = Math.max(0, Math.min(steps.length - 1, i));
      var s = steps[idx];
      body.innerHTML = '';
      if (s.title) { body.appendChild(h('h4', { text: s.title })); }
      body.appendChild(toNode(s.body));
      count.textContent = 'Step ' + (idx + 1) + ' of ' + steps.length;
      bar.firstChild.style.width = ((idx + 1) / steps.length * 100) + '%';
      dotBtns.forEach(function (b, j) {
        b.classList.toggle('is-done', j < idx);
        if (j === idx) { b.setAttribute('aria-current', 'step'); } else { b.removeAttribute('aria-current'); }
      });
      prev.disabled = idx === 0;
      next.textContent = idx === steps.length - 1 ? 'Restart \u21BA' : 'Next \u2192';
      if (s.onEnter) { s.onEnter(body, idx); }
      if (cfg.onStep) { cfg.onStep(idx, s); }
    }

    prev.addEventListener('click', function () { go(idx - 1); });
    next.addEventListener('click', function () { go(idx === steps.length - 1 ? 0 : idx + 1); });
    go(0);
    return { el: root, go: go, index: function () { return idx; } };
  }

  /* ---------- quiz ---------- */
  function quiz(cfg) {
    cfg = cfg || {};
    var qs = cfg.questions || [];
    var passPct = cfg.passPct || 70;
    var i = 0;
    var score = 0;
    var root = h('div', { class: 'quiz' });
    var finished = null;

    function pctOf(s) { return qs.length ? Math.round((s / qs.length) * 100) : 0; }

    function renderQuestion() {
      var q = qs[i];
      var name = nid('q');
      var chosen = -1;
      var checked = false;
      root.innerHTML = '';
      root.classList.remove('is-locked');

      var head = h('div', { class: 'quiz-head' }, [
        h('strong', { text: (cfg.title || 'Quiz') + ' \u00B7 Question ' + (i + 1) + ' of ' + qs.length }),
        q.scenario ? h('span', { class: 'tag', text: 'Scenario' }) : null
      ]);
      var prog = h('div', { class: 'quiz-progress', 'aria-hidden': 'true' }, [h('i')]);
      prog.firstChild.style.width = (i / qs.length * 100) + '%';
      var qEl = h('p', { class: 'quiz-q', id: name + '-q', tabindex: '-1', text: q.q });
      var fs = h('fieldset', { 'aria-labelledby': name + '-q' });
      var labels = q.options.map(function (opt, oi) {
        var input = h('input', { type: 'radio', name: name, value: String(oi) });
        var lab = h('label', { class: 'quiz-opt' }, [input, h('span', { text: opt })]);
        input.addEventListener('change', function () {
          if (checked) { return; }
          chosen = oi;
          labels.forEach(function (l, j) { l.classList.toggle('is-selected', j === oi); });
          checkBtn.disabled = false;
        });
        fs.appendChild(lab);
        return lab;
      });
      var feedback = h('div', { class: 'quiz-explain', 'aria-live': 'polite' });
      var checkBtn = h('button', { class: 'btn btn-primary', type: 'button', text: 'Check answer', disabled: true });
      var nextBtn = h('button', { class: 'btn', type: 'button', hidden: true, text: i === qs.length - 1 ? 'See results' : 'Next question \u2192' });

      checkBtn.addEventListener('click', function () {
        if (chosen < 0 || checked) { return; }
        checked = true;
        root.classList.add('is-locked');
        var right = chosen === q.answer;
        if (right) { score++; }
        labels.forEach(function (l, j) {
          l.querySelector('input').disabled = true;
          l.classList.remove('is-selected');
          if (j === q.answer) { l.classList.add('is-right'); }
          else if (j === chosen) { l.classList.add('is-wrong'); }
        });
        feedback.innerHTML = '';
        feedback.appendChild(callout(right ? 'ok' : 'warn', right ? 'Correct' : 'Not quite', q.explain || '').el);
        checkBtn.hidden = true;
        nextBtn.hidden = false;
        nextBtn.focus();
      });
      nextBtn.addEventListener('click', function () {
        i++;
        if (i < qs.length) { renderQuestion(); qEl = root.querySelector('.quiz-q'); if (qEl) { qEl.focus(); } }
        else { renderResult(); }
      });

      root.appendChild(head);
      root.appendChild(prog);
      root.appendChild(qEl);
      root.appendChild(fs);
      root.appendChild(feedback);
      root.appendChild(h('div', { class: 'quiz-actions' }, [checkBtn, nextBtn]));
    }

    function renderResult() {
      var pct = pctOf(score);
      var passed = pct >= passPct;
      finished = { score: score, total: qs.length, pct: pct, passed: passed };
      root.innerHTML = '';
      root.classList.remove('is-locked');
      var msg = passed
        ? 'Nice work. You cleared the ' + passPct + '% bar' + (cfg.topicId ? ' and this topic is now marked complete.' : '.')
        : 'You need ' + passPct + '% to pass. Re-read the explanations above each answer, then try again.';
      var heading = h('h3', { text: passed ? 'Passed' : 'Keep going', tabindex: '-1' });
      root.appendChild(h('div', { class: 'quiz-result', role: 'status' }, [
        heading,
        h('div', { class: 'quiz-score ' + (passed ? 'pass' : 'fail'), text: pct + '%' }),
        h('p', { text: score + ' of ' + qs.length + ' correct. ' + msg }),
        h('button', { class: 'btn', type: 'button', text: 'Retry quiz', onclick: function () { i = 0; score = 0; renderQuestion(); root.querySelector('.quiz-q').focus(); } })
      ]));
      heading.focus();
      if (passed && cfg.topicId && global.App && global.App.markComplete) { global.App.markComplete(cfg.topicId); }
      if (global.App && global.App.store && cfg.topicId) {
        var key = 'quiz:' + cfg.topicId;
        var best = global.App.store.get(key, 0);
        if (pct > best) { global.App.store.set(key, pct); }
      }
      if (cfg.onComplete) { cfg.onComplete(finished); }
    }

    if (qs.length) { renderQuestion(); }
    return { el: root, result: function () { return finished; }, restart: function () { i = 0; score = 0; renderQuestion(); } };
  }

  /* ---------- code panel ---------- */
  var KEYWORDS = ('const let var function return if else elif for while do new class async await import from export default def self None True False ' +
    'null undefined true false try catch finally throw raise except with as in of yield lambda public private protected static void int long string boolean ' +
    'func go chan select defer package type struct interface extends implements this switch case break continue then end begin SELECT FROM WHERE INSERT INTO ' +
    'UPDATE VALUES CREATE TABLE AND OR NOT synchronized volatile final throws object val fun').split(' ');
  var KW = {};
  KEYWORDS.forEach(function (k) { KW[k] = true; });

  function commentRegex(lang) {
    lang = (lang || '').toLowerCase();
    if (['python', 'py', 'bash', 'sh', 'shell', 'yaml', 'yml', 'toml', 'properties', 'ruby'].indexOf(lang) >= 0) { return '#.*$'; }
    if (lang === 'sql') { return '--.*$'; }
    return '\\/\\/.*$|\\/\\*.*?\\*\\/';
  }

  function highlightLine(line, lang) {
    var re = new RegExp('(' + commentRegex(lang) + ')|("(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'|`(?:\\\\.|[^`\\\\])*`)|\\b(\\d+(?:\\.\\d+)?)\\b|\\b([A-Za-z_][A-Za-z0-9_]*)(?=\\()|\\b([A-Za-z_][A-Za-z0-9_]*)\\b', 'g');
    var out = '';
    var last = 0;
    var m;
    while ((m = re.exec(line)) !== null) {
      out += esc(line.slice(last, m.index));
      var t = esc(m[0]);
      if (m[1]) { out += '<span class="t-c">' + t + '</span>'; }
      else if (m[2]) { out += '<span class="t-s">' + t + '</span>'; }
      else if (m[3]) { out += '<span class="t-n">' + t + '</span>'; }
      else if (m[4]) { out += KW[m[0]] ? '<span class="t-k">' + t + '</span>' : '<span class="t-f">' + t + '</span>'; }
      else if (m[5] && KW[m[0]]) { out += '<span class="t-k">' + t + '</span>'; }
      else { out += t; }
      last = m.index + m[0].length;
      if (m[0].length === 0) { re.lastIndex++; }
    }
    return out + esc(line.slice(last));
  }

  function copyText(text) {
    if (global.navigator && navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = h('textarea', { 'aria-hidden': 'true' });
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (ok) { resolve(); } else { reject(new Error('copy failed')); }
    });
  }

  function codeBlock(t) {
    var code = String(t.code || '').replace(/\n$/, '');
    var pre = h('pre', { tabindex: '0', 'aria-label': (t.label || t.lang || 'code') + ' code sample' });
    var codeEl = h('code', { style: 'background:none;border:0;padding:0;font-size:inherit' });
    var html = code.split('\n').map(function (line, n) {
      return '<span class="code-line"><span class="code-ln" aria-hidden="true">' + (n + 1) + '</span><span class="code-txt">' + (highlightLine(line, t.lang) || ' ') + '</span></span>';
    }).join('\n');
    codeEl.innerHTML = html;
    pre.appendChild(codeEl);
    var copy = h('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: 'Copy', 'aria-label': 'Copy ' + (t.label || t.lang || 'code') + ' to clipboard' });
    copy.addEventListener('click', function () {
      copyText(code).then(function () { toast('Code copied to clipboard', { type: 'ok' }); },
        function () { toast('Copy blocked by the browser. Select the code and copy manually.', { type: 'warn' }); });
    });
    return { pre: pre, copy: copy };
  }

  function codePanel(cfg) {
    cfg = cfg || {};
    var items = cfg.tabs || [];
    var root = h('div', { class: 'codepanel' });
    var copyHolder = h('span');
    var blocks = items.map(codeBlock);
    var tabsApi = tabs({
      label: cfg.title || 'Code language',
      tabs: items.map(function (t, i) { return { id: t.lang || String(i), label: t.label || t.lang || 'code', content: blocks[i].pre }; }),
      onChange: function (id, idx) { copyHolder.innerHTML = ''; copyHolder.appendChild(blocks[idx].copy); }
    });
    var list = tabsApi.el.querySelector('.tabs-list');
    var head = h('div', { class: 'codepanel-head' }, [
      cfg.title ? h('span', { class: 'codepanel-title', text: cfg.title }) : null,
      list, copyHolder
    ]);
    root.appendChild(head);
    root.appendChild(tabsApi.el);
    if (blocks.length) { copyHolder.appendChild(blocks[0].copy); }
    return { el: root, select: tabsApi.select };
  }

  /* ---------- log panel ---------- */
  function fmtTime(ms) {
    ms = Math.max(0, Math.round(ms));
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    var rest = String(ms % 1000);
    while (rest.length < 3) { rest = '0' + rest; }
    return (m < 10 ? '0' + m : m) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60) + '.' + rest;
  }

  function logPanel(cfg) {
    cfg = cfg || {};
    var max = cfg.max || 200;
    var body = h('div', { class: 'logpanel-body', role: 'log', 'aria-live': 'off', tabindex: '0', 'aria-label': cfg.title || 'Live event log' });
    var empty = h('div', { class: 'log-empty', text: 'No events yet. Press Play or Step.' });
    body.appendChild(empty);
    var clearBtn = h('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: 'Clear' });
    var root = h('div', { class: 'logpanel' }, [
      h('div', { class: 'logpanel-head' }, [h('span', { text: cfg.title || 'Live event log' }), clearBtn]),
      body
    ]);
    var rows = 0;

    function clear() {
      body.innerHTML = '';
      body.appendChild(empty);
      rows = 0;
    }
    function log(msg, opts) {
      opts = opts || {};
      if (empty.parentNode) { body.removeChild(empty); }
      var stick = body.scrollTop + body.clientHeight >= body.scrollHeight - 24;
      var level = opts.level || 'info';
      body.appendChild(h('div', { class: 'log-row ' + level }, [
        h('span', { class: 'log-t', text: opts.t === undefined ? '' : fmtTime(opts.t) }),
        h('span', { class: 'log-msg', text: msg })
      ]));
      rows++;
      while (rows > max) { body.removeChild(body.firstChild); rows--; }
      if (stick) { body.scrollTop = body.scrollHeight; }
    }
    clearBtn.addEventListener('click', clear);
    return { el: root, log: log, clear: clear };
  }

  /* ---------- metrics ---------- */
  var DEFAULT_METRICS = [
    { id: 'throughput', label: 'Throughput', unit: 'msg/s' },
    { id: 'latency', label: 'Latency', unit: 'ms' },
    { id: 'depth', label: 'Queue depth', unit: 'msgs' },
    { id: 'errors', label: 'Errors', unit: '' }
  ];

  function fmtNum(v) {
    if (typeof v !== 'number') { return String(v); }
    if (!isFinite(v)) { return '-'; }
    return Math.abs(v - Math.round(v)) < 0.005 ? String(Math.round(v)) : v.toFixed(1);
  }

  function metrics(cfg) {
    cfg = cfg || {};
    var items = (cfg.items || DEFAULT_METRICS).slice();
    var root = h('div', { class: 'metrics', role: 'group', 'aria-label': cfg.label || 'Live metrics' });
    var map = {};
    items.forEach(function (it) {
      var val = h('span', { class: 'metric-value', text: '0' });
      var cell = h('div', { class: 'metric' }, [
        h('div', { class: 'metric-label', text: it.label }),
        h('div', null, [val, it.unit ? h('span', { class: 'metric-unit', text: it.unit }) : null])
      ]);
      map[it.id] = { cell: cell, val: val, v: 0 };
      root.appendChild(cell);
    });

    function set(id, v) {
      var m = map[id];
      if (!m) { return; }
      if (m.v === v) { return; }
      m.v = v;
      m.val.textContent = fmtNum(v);
      m.cell.classList.remove('flash');
      void m.cell.offsetWidth;
      m.cell.classList.add('flash');
      if (id === 'errors') { m.cell.classList.toggle('is-bad', v > 0); }
    }
    return {
      el: root,
      set: set,
      inc: function (id, n) { if (map[id]) { set(id, map[id].v + (n === undefined ? 1 : n)); } },
      get: function (id) { return map[id] ? map[id].v : undefined; },
      reset: function () {
        Object.keys(map).forEach(function (id) {
          map[id].v = 0;
          map[id].val.textContent = '0';
          map[id].cell.classList.remove('flash', 'is-bad');
        });
      }
    };
  }

  /* ---------- control bar ---------- */
  var SPEEDS = [0.25, 0.5, 1, 2, 4, 8];

  function controlBar(sim, opts) {
    opts = opts || {};
    var broken = false;
    var wasPlaying = false;
    var playBtn = h('button', { class: 'btn btn-primary', type: 'button' });
    var stepBtn = h('button', { class: 'btn', type: 'button', text: 'Step', 'aria-label': 'Advance one event' });
    var resetBtn = h('button', { class: 'btn', type: 'button', text: 'Reset' });
    var select = h('select', { id: nid('speed'), 'aria-label': 'Simulation speed' });
    SPEEDS.forEach(function (s) { select.appendChild(h('option', { value: String(s), text: s + '\u00D7' })); });
    var breakBtn = opts.showBreak === false ? null : h('button', { class: 'btn btn-break', type: 'button', 'aria-pressed': 'false' });
    var root = h('div', { class: 'controlbar', role: 'group', 'aria-label': opts.label || 'Simulation controls' }, [
      playBtn, stepBtn, resetBtn,
      h('label', { class: 'speed', for: select.id }, ['Speed', select]),
      h('span', { class: 'sep' }),
      breakBtn
    ]);

    function syncPlay() {
      var p = sim.isPlaying ? sim.isPlaying() : false;
      playBtn.textContent = p ? 'Pause' : 'Play';
      playBtn.setAttribute('aria-label', p ? 'Pause simulation' : 'Play simulation');
    }
    function syncBreak() {
      if (!breakBtn) { return; }
      breakBtn.textContent = broken ? (opts.fixLabel || 'Fix it') : (opts.breakLabel || 'Break it');
      breakBtn.setAttribute('aria-pressed', broken ? 'true' : 'false');
    }
    function setSpeedSelect() {
      var s = sim.speed ? sim.speed() : 1;
      select.value = String(s);
      if (select.value !== String(s)) { select.value = '1'; }
    }

    playBtn.addEventListener('click', function () { if (sim.isPlaying()) { sim.pause(); } else { sim.play(); } });
    stepBtn.addEventListener('click', function () { sim.step(); });
    resetBtn.addEventListener('click', function () { sim.reset(); });
    select.addEventListener('change', function () { sim.setSpeed(parseFloat(select.value)); });
    if (breakBtn) {
      breakBtn.addEventListener('click', function () {
        broken = !broken;
        syncBreak();
        sim.emit('break', { broken: broken });
        if (opts.onBreak) { opts.onBreak(broken, sim); }
        if (broken && !sim.isPlaying() && opts.autoPlayOnBreak !== false) { sim.play(); }
      });
    }
    sim.on('play', syncPlay);
    sim.on('pause', syncPlay);
    sim.on('idle', syncPlay);
    sim.on('speed', setSpeedSelect);
    sim.on('reset', function () { broken = false; syncBreak(); syncPlay(); });
    syncPlay(); syncBreak(); setSpeedSelect();

    // Clean up timers/animation frames when the lab scrolls out of view; resume if it was running.
    var target = null;
    var stopWatching = onVisible(root, function () {
      if (wasPlaying) { wasPlaying = false; sim.play(); }
    }, function () {
      if (!target) { target = root.closest('.lab') || root; }
      if (sim.isPlaying()) { wasPlaying = true; sim.pause(); }
    });

    return {
      el: root,
      isBroken: function () { return broken; },
      setBroken: function (b) { broken = !!b; syncBreak(); },
      destroy: function () { stopWatching(); sim.pause(); }
    };
  }

  /* ---------- lab frame (composition of the above) ---------- */
  function lab(cfg) {
    cfg = cfg || {};
    var sim = cfg.sim || global.Sim.create({ speed: cfg.speed || 1 });
    var stage = h('div', { class: 'lab-stage', role: 'img', 'aria-label': cfg.stageLabel || 'Simulation scene' });
    if (cfg.stage) { stage.appendChild(cfg.stage); }
    var bar = controlBar(sim, { onBreak: cfg.onBreak, breakLabel: cfg.breakLabel, fixLabel: cfg.fixLabel, autoPlayOnBreak: cfg.autoPlayOnBreak, label: cfg.title ? cfg.title + ' controls' : undefined });
    var m = metrics({ items: cfg.metrics });
    var lg = logPanel({ title: 'Live event log' });
    var captionBox = h('div', { class: 'explain-box callout analogy', hidden: true, 'aria-live': 'polite' });
    var captionText = cfg.caption || 'Press Play and watch the log. Use Break it to trigger the classic failure, then read what happened here.';
    var toggle = h('button', { class: 'btn btn-sm explain-toggle', type: 'button', 'aria-expanded': 'false', text: 'Explain what just happened' });
    var heading = h('h4', { text: 'What just happened' });
    var captionBody = h('div', { class: 'rich' });
    captionBox.appendChild(heading);
    captionBox.appendChild(captionBody);

    function explain(text) {
      captionText = text;
      captionBody.innerHTML = richHtml(text);
    }
    explain(captionText);
    toggle.addEventListener('click', function () {
      var open = captionBox.hidden;
      captionBox.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    var root = h('div', { class: 'lab' }, [
      h('div', { class: 'lab-head' }, [h('h3', { text: cfg.title || 'Lab' }), cfg.subtitle ? h('p', { text: cfg.subtitle }) : null]),
      stage,
      bar.el,
      m.el,
      h('div', { class: 'lab-cols' }, [lg.el, toggle, captionBox])
    ]);
    return { el: root, stage: stage, sim: sim, bar: bar, metrics: m, log: lg, explain: explain };
  }

  /* ---------- predict challenge ---------- */
  function predictChallenge(cfg) {
    cfg = cfg || {};
    var options = cfg.options || [];
    var locked = false;
    var activeSim = null;
    var stopWatch = null;
    var root = h('div', { class: 'predict' });
    var optWrap = h('div', { class: 'predict-opts', role: 'group', 'aria-label': 'Your prediction' });
    var runArea = h('div', { class: 'predict-run', 'aria-live': 'polite' });

    var optBtns = options.map(function (o, i) {
      var b = h('button', { class: 'predict-opt', type: 'button', text: o });
      b.addEventListener('click', function () { pick(i); });
      optWrap.appendChild(b);
      return b;
    });

    root.appendChild(h('span', { class: 'tag', text: 'Predict the outcome' }));
    root.appendChild(h('h3', { text: cfg.question || 'What will happen?', style: 'margin-top:12px' }));
    if (cfg.setup) { root.appendChild(toNode(cfg.setup)); }
    root.appendChild(h('p', { class: 'drawer-meta', text: 'Pick your answer first. Then the simulation runs and shows what really happens.' }));
    root.appendChild(optWrap);
    root.appendChild(runArea);

    function teardown() {
      if (activeSim) { activeSim.destroy(); activeSim = null; }
      if (stopWatch) { stopWatch(); stopWatch = null; }
    }

    function reveal(choice, measured) {
      var right = choice === cfg.answer;
      optBtns.forEach(function (b, i) {
        b.classList.remove('is-picked');
        if (i === cfg.answer) { b.classList.add('is-right'); }
        else if (i === choice) { b.classList.add('is-wrong'); }
      });
      var again = h('button', { class: 'btn btn-sm', type: 'button', text: 'Try again' });
      again.addEventListener('click', reset);
      var v = h('div', { class: 'predict-verdict ' + (right ? 'right' : 'wrong'), role: 'status' }, [
        h('strong', { class: 'v', text: right ? 'You predicted it.' : 'Not what you expected, and that is the lesson.' }),
        measured ? h('p', null, [h('strong', { text: 'Simulation measured: ' }), measured]) : null,
        toNode(cfg.explain || ''),
        again
      ]);
      runArea.appendChild(v);
      v.setAttribute('tabindex', '-1');
      v.focus();
    }

    function pick(choice) {
      if (locked) { return; }
      locked = true;
      optBtns.forEach(function (b, i) { b.disabled = true; if (i === choice) { b.classList.add('is-picked'); } });
      runArea.innerHTML = '';
      var sim = global.Sim.create({ speed: cfg.speed || 4 });
      activeSim = sim;
      var stage = h('div', { class: 'lab-stage', role: 'img', 'aria-label': 'Prediction simulation' });
      var lg = logPanel({ title: 'Simulation log' });
      var skip = h('button', { class: 'btn btn-sm', type: 'button', text: 'Skip to result' });
      var ctx = { sim: sim, stage: stage, log: lg.log, state: {} };
      runArea.appendChild(stage);
      runArea.appendChild(lg.el);
      runArea.appendChild(skip);
      var finished = false;
      function finish() {
        if (finished) { return; }
        finished = true;
        sim.pause();
        skip.remove();
        var measured = cfg.measure ? cfg.measure(ctx) : '';
        reveal(choice, measured);
      }
      cfg.simulate(ctx);
      // +1 ms so same-instant events (for example an arrival exactly at the deadline) are counted first.
      sim.schedule((cfg.duration || 10000) + 1, finish);
      skip.addEventListener('click', function () { sim.runUntil((cfg.duration || 10000) + 1); });
      stopWatch = onVisible(root, function () { if (!finished && !sim.isPlaying()) { sim.play(); } }, function () { if (sim.isPlaying()) { sim.pause(); } });
      sim.play();
    }

    function reset() {
      teardown();
      locked = false;
      runArea.innerHTML = '';
      optBtns.forEach(function (b) { b.disabled = false; b.classList.remove('is-picked', 'is-right', 'is-wrong'); });
      optBtns[0] && optBtns[0].focus();
    }

    return { el: root, reset: reset };
  }

  /* ---------- toast ---------- */
  function toast(msg, opts) {
    opts = opts || {};
    var region = document.getElementById('toast-region');
    if (!region) {
      region = h('div', { id: 'toast-region', class: 'toast-region', role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(region);
    }
    var t = h('div', { class: 'toast ' + (opts.type || 'info'), text: msg });
    region.appendChild(t);
    var ms = opts.ms || 3200;
    setTimeout(function () {
      t.classList.add('is-leaving');
      setTimeout(function () { if (t.parentNode) { t.parentNode.removeChild(t); } }, 300);
    }, ms);
    return t;
  }

  /* ---------- accordion ---------- */
  function accordion(cfg) {
    cfg = cfg || {};
    var items = cfg.items || [];
    var base = nid('acc');
    var root = h('div', { class: 'accordion' });
    var rows = items.map(function (it, i) {
      var btn = h('button', { class: 'acc-btn', type: 'button', id: base + '-b' + i, 'aria-expanded': 'false', 'aria-controls': base + '-p' + i }, [h('span', { text: it.title }), chevron()]);
      var panel = h('div', { class: 'acc-panel', role: 'region', id: base + '-p' + i, 'aria-labelledby': base + '-b' + i, hidden: true });
      panel.appendChild(toNode(it.body));
      btn.addEventListener('click', function () { toggle(i); });
      root.appendChild(h('div', { class: 'acc-item' }, [btn, panel]));
      return { btn: btn, panel: panel };
    });

    function toggle(i, force) {
      var open = force === undefined ? rows[i].panel.hidden : force;
      if (open && cfg.single !== false) {
        rows.forEach(function (r, j) { if (j !== i) { r.panel.hidden = true; r.btn.setAttribute('aria-expanded', 'false'); } });
      }
      rows[i].panel.hidden = !open;
      rows[i].btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    return { el: root, toggle: toggle };
  }

  global.UI = {
    h: h, esc: esc, rich: rich, callout: callout, onVisible: onVisible, fmtTime: fmtTime,
    tabs: tabs, stepper: stepper, quiz: quiz, codePanel: codePanel, logPanel: logPanel, metrics: metrics,
    controlBar: controlBar, lab: lab, predictChallenge: predictChallenge, toast: toast, accordion: accordion
  };
})(window);
