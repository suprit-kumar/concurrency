/*
 * t1-concurrency.js - Topic 1: Multithreading & Concurrency.
 * Story, level tabs, six labs, predict challenge, quiz, cheat sheet and interview questions.
 * Follows the frozen contract: Sim.create, UI.lab/controlBar/logPanel/metrics, App.registerTopic.
 */
(function (global) {
  'use strict';

  var UI = global.UI;
  var Sim = global.Sim;
  var h = UI.h;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var uid = 0;

  /* ================= small shared helpers ================= */

  function svg(tag, attrs, kids) {
    var el = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }

  function taskColor(i) { return 'hsl(' + ((i * 57 + 200) % 360) + ' 70% 58%)'; }

  function segmented(label, options, initial, onChange) {
    var name = 't1seg' + (++uid);
    var val = initial;
    var root = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label });
    options.forEach(function (o) {
      var inp = h('input', { type: 'radio', name: name, value: o[0] });
      if (o[0] === initial) { inp.checked = true; }
      inp.addEventListener('change', function () { if (inp.checked) { val = o[0]; onChange(val); } });
      root.appendChild(h('label', { class: 'seg' }, [inp, h('span', { text: o[1] })]));
    });
    return { el: h('div', { class: 'ctl' }, [h('span', { text: label }), root]), get: function () { return val; } };
  }

  function slider(label, min, max, val, onChange) {
    var id = 't1sl' + (++uid);
    var out = h('output', { for: id, text: String(val) });
    var inp = h('input', { type: 'range', id: id, min: min, max: max, step: 1, value: val });
    inp.addEventListener('input', function () { out.textContent = inp.value; });
    inp.addEventListener('change', function () { onChange(+inp.value); });
    return { el: h('label', { class: 'ctl', for: id }, [h('span', { text: label }), inp, out]), get: function () { return +inp.value; } };
  }

  function checkbox(label, checked, onChange) {
    var id = 't1cb' + (++uid);
    var inp = h('input', { type: 'checkbox', id: id });
    inp.checked = !!checked;
    inp.addEventListener('change', function () { onChange(inp.checked); });
    return { el: h('label', { class: 'ctl', for: id }, [inp, h('span', { text: label })]), get: function () { return inp.checked; } };
  }

  function wrap(controls, lab, extra) {
    var kids = [h('div', { class: 'lab-controls', role: 'group', 'aria-label': 'Lab settings' }, controls.map(function (c) { return c.el; })), lab.el];
    (extra || []).forEach(function (e) { kids.push(e); });
    return h('div', { class: 'lab-wrap' }, kids);
  }

  function legend(items) {
    return h('div', { class: 'legend' }, items.map(function (it) {
      var sw = h('i');
      sw.style.background = it[0];
      return h('span', {}, [sw, it[1]]);
    }));
  }

  function title(text, sub) {
    var kids = [h('h3', { text: text })];
    if (sub) { kids.push(h('p', { class: 'muted', text: sub })); }
    return h('div', { class: 'section-title' }, kids);
  }

  /* Canvas Gantt chart. Drawn on every sim tick; there is no separate animation loop to clean up. */
  function makeGantt(o) {
    var canvas = h('canvas', { role: 'img', 'aria-label': o.label || 'Timeline of work per row' });
    var box = h('div', { class: 'gantt' }, [canvas]);
    var rows = 1;
    var segs = [];
    var now = 0;
    var marks = o.marks || [];
    var LEFT = 62;

    function pal() {
      var cs = getComputedStyle(document.documentElement);
      function v(n, d) { return cs.getPropertyValue(n).trim() || d; }
      return { dim: v('--text-dim', '#9aa4b2'), text: v('--text', '#e6e9ef'), border: v('--border-strong', '#445'), err: v('--err', '#f55'), warn: v('--warn', '#fb3') };
    }

    function draw(t) {
      if (t !== undefined) { now = t; }
      var dpr = global.devicePixelRatio || 1;
      var w = Math.max(280, box.clientWidth || 600);
      var rowH = rows > 8 ? 14 : 26;
      var gap = rows > 8 ? 3 : 6;
      var H = 10 + rows * (rowH + gap) + 24;
      var cw = Math.round(w * dpr);
      var ch = Math.round(H * dpr);
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
      canvas.style.height = H + 'px';
      var c = canvas.getContext('2d');
      var p = pal();
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, H);
      var maxT = Math.max(o.base, Math.ceil(now / 500) * 500);
      function X(tt) { return LEFT + (w - LEFT - 10) * tt / maxT; }
      c.font = '11px system-ui, sans-serif';
      c.textBaseline = 'middle';
      var r;
      for (r = 0; r < rows; r++) {
        var y = 10 + r * (rowH + gap);
        c.fillStyle = p.dim;
        c.textAlign = 'left';
        c.fillText(o.rowLabel ? o.rowLabel(r) : 'Row ' + (r + 1), 6, y + rowH / 2);
        c.strokeStyle = p.border;
        c.globalAlpha = 0.35;
        c.strokeRect(LEFT, y, w - LEFT - 10, rowH);
        c.globalAlpha = 1;
      }
      segs.forEach(function (s) {
        if (s.start >= now) { return; }
        var end = Math.min(s.end, now);
        var x1 = X(s.start);
        var x2 = Math.max(x1 + 1, X(end));
        var y2 = 10 + s.row * (rowH + gap);
        var col = s.color === 'switch' ? p.dim : (s.color === 'blocked' ? p.err : s.color);
        if (s.wait) {
          c.globalAlpha = 0.25;
          c.fillStyle = col;
          c.fillRect(x1, y2, x2 - x1, rowH);
          c.globalAlpha = 1;
          c.strokeStyle = col;
          c.setLineDash([3, 2]);
          c.strokeRect(x1 + 0.5, y2 + 0.5, Math.max(1, x2 - x1 - 1), rowH - 1);
          c.setLineDash([]);
        } else {
          c.fillStyle = col;
          c.fillRect(x1, y2, x2 - x1, rowH);
          c.strokeStyle = 'rgba(0,0,0,.35)';
          c.strokeRect(x1 + 0.5, y2 + 0.5, Math.max(0, x2 - x1 - 1), rowH - 1);
        }
        if (s.label && x2 - x1 > 26 && rowH > 16) {
          c.fillStyle = s.wait ? p.text : '#0a0c13';
          c.textAlign = 'center';
          c.fillText(s.label, (x1 + x2) / 2, y2 + rowH / 2);
        }
      });
      marks.forEach(function (m) {
        c.strokeStyle = p.err;
        c.setLineDash([4, 3]);
        c.beginPath(); c.moveTo(X(m.t), 4); c.lineTo(X(m.t), H - 20); c.stroke();
        c.setLineDash([]);
        c.fillStyle = p.err;
        c.textAlign = 'left';
        c.fillText(m.label, X(m.t) + 4, 8);
      });
      c.fillStyle = p.dim;
      c.textAlign = 'center';
      for (var tt = 0; tt <= maxT; tt += 500) {
        if (tt % 1000 === 0 || maxT <= 2500) { c.fillText((tt / 1000) + 's', X(tt), H - 8); }
      }
      c.strokeStyle = p.warn;
      c.beginPath(); c.moveTo(X(now), 6); c.lineTo(X(now), H - 22); c.stroke();
    }

    global.addEventListener('resize', function () { draw(); });
    return {
      el: box,
      setRows: function (n) { rows = n; },
      clear: function () { segs = []; now = 0; },
      add: function (row, start, end, color, label, wait) {
        var s = { row: row, start: start, end: end, color: color, label: label, wait: !!wait };
        segs.push(s);
        return s;
      },
      draw: draw
    };
  }

  /* ================= THE STORY ================= */

  function storyScene() {
    var scene = h('div', { class: 'story', 'data-mode': 'one' }, [
      h('div', { class: 'story-stage', role: 'img', 'aria-label': 'Animated kitchen: one chef walks between three stations, or three chefs each own a station' }, [
        h('div', { class: 'station s1' }, [h('span', {}, ['Chop', h('small', { text: 'station 1' })])]),
        h('div', { class: 'station s2' }, [h('span', {}, ['Cook', h('small', { text: 'station 2' })])]),
        h('div', { class: 'station s3' }, [h('span', {}, ['Plate', h('small', { text: 'station 3' })])]),
        h('div', { class: 'chef c1', text: 'Ann' }),
        h('div', { class: 'chef c2', text: 'Bo' }),
        h('div', { class: 'chef c3', text: 'Cy' })
      ])
    ]);
    var cap = h('p', { class: 'muted', 'aria-live': 'polite', text: 'One chef, three jobs: Ann walks between stations. Only one job moves at a time, but all three dishes make progress. That is concurrency.' });
    var seg = segmented('Kitchen', [['one', 'One chef (concurrency)'], ['three', 'Three chefs (parallelism)']], 'one', function (v) {
      scene.setAttribute('data-mode', v);
      cap.textContent = v === 'one'
        ? 'One chef, three jobs: Ann walks between stations. Only one job moves at a time, but all three dishes make progress. That is concurrency.'
        : 'Three chefs, three stations: all three jobs move at the same instant. That is parallelism, and it needs more than one worker.';
    });
    UI.onVisible(scene, function () { scene.classList.remove('is-paused'); }, function () { scene.classList.add('is-paused'); });
    return h('div', {}, [h('div', { class: 'lab-controls' }, [seg.el]), scene, cap]);
  }

  function storyBlock() {
    var stepper = UI.stepper({
      steps: [
        { title: '0:00 One kitchen, one chef, three orders', body: 'Imagine a tiny restaurant with a single chef, **Ann**. Three orders arrive together: chop vegetables, cook the soup, plate the salad. Ann is a **thread of execution**: one sequence of steps done by one worker.' },
        { title: '0:15 Ann juggles', body: 'Ann chops for a while, stirs the soup, plates a bit, then goes back to chopping. At any instant she does one thing, yet all three orders are *in progress*. This is **concurrency**: managing several tasks by interleaving them. It makes a single worker feel responsive.' },
        { title: '0:30 Hire two more chefs', body: 'Now **Bo** and **Cy** join. Each takes a station. All three orders really move at the same moment. This is **parallelism**: several workers literally running at once. It needs more than one core (chef).' },
        { title: '0:45 The chefs share one salt shaker', body: 'Two chefs reach for the only salt shaker at the same time, or both read "salt: half full" and both think they can use the last half. This is a **race condition**. A rule such as "hold the shaker, use it, put it back" is a **lock**.' },
        { title: '0:55 The standoff', body: 'Ann holds the knife and waits for the board. Bo holds the board and waits for the knife. Nobody can proceed. This is a **deadlock**. The rest of this topic shows how to see, cause and prevent all of these.' }
      ]
    });
    return h('div', { class: 'card' }, [
      h('div', { class: 'card-title' }, [h('h3', { text: 'The Story: a 60-second kitchen' })]),
      storyScene(), stepper.el
    ]);
  }

  /* ================= LEVEL TABS ================= */

  function levelPane(explain, analogy, wrong, prod, extra) {
    var d = h('div', { class: 'stack' });
    d.appendChild(UI.rich(explain));
    d.appendChild(UI.callout('analogy', 'Analogy', analogy).el);
    if (extra) { d.appendChild(extra); }
    d.appendChild(UI.callout('warn', 'What beginners get wrong', wrong).el);
    d.appendChild(UI.callout('err', 'In production this bites you when...', prod).el);
    return d;
  }

  var RACE_CODE = {
    python: "import threading\n\ncounter = 0\nlock = threading.Lock()\n\ndef add_unsafe(n):\n    global counter\n    for _ in range(n):\n        counter += 1          # load, add, store: three steps, not one\n\ndef add_safe(n):\n    global counter\n    for _ in range(n):\n        with lock:            # only one thread inside at a time\n            counter += 1\n\nthreads = [threading.Thread(target=add_safe, args=(100_000,)) for _ in range(2)]\nfor t in threads: t.start()\nfor t in threads: t.join()\nprint(counter)                # 200000, every time",
    java: "import java.util.concurrent.atomic.AtomicInteger;\n\nclass Counter {\n    private int unsafe = 0;\n    private final Object lock = new Object();\n    private int safe = 0;\n    private final AtomicInteger atomic = new AtomicInteger();\n\n    void addUnsafe()  { unsafe++; }                         // race: lost updates\n    void addLocked()  { synchronized (lock) { safe++; } }   // mutual exclusion\n    void addAtomic()  { atomic.incrementAndGet(); }         // one atomic hardware step\n}",
    go: "package main\n\nimport (\n\t\"fmt\"\n\t\"sync\"\n)\n\nfunc main() {\n\tvar mu sync.Mutex\n\tcounter := 0\n\tvar wg sync.WaitGroup\n\tfor i := 0; i < 2; i++ {\n\t\twg.Add(1)\n\t\tgo func() {\n\t\t\tdefer wg.Done()\n\t\t\tfor j := 0; j < 100000; j++ {\n\t\t\t\tmu.Lock()\n\t\t\t\tcounter++ // without the lock, `go run -race` reports a data race\n\t\t\t\tmu.Unlock()\n\t\t\t}\n\t\t}()\n\t}\n\twg.Wait()\n\tfmt.Println(counter) // 200000\n}"
  };

  var ORDER_CODE = "import threading\n\naccount_a, account_b = threading.Lock(), threading.Lock()\n\n# DEADLOCK-PRONE: two threads take the same locks in opposite order\ndef transfer_ab():\n    with account_a:\n        with account_b:\n            pass\n\ndef transfer_ba():\n    with account_b:\n        with account_a:\n            pass\n\n# FIX: one global order. Always lock the lower id first.\ndef transfer(src, dst):\n    first, second = sorted((src, dst), key=id)\n    with first:\n        with second:\n            pass";

  function levelTabs() {
    var codeBox = UI.codePanel({ title: 'The counter race and its fix', tabs: [
      { lang: 'python', label: 'Python', code: RACE_CODE.python },
      { lang: 'java', label: 'Java', code: RACE_CODE.java },
      { lang: 'go', label: 'Go', code: RACE_CODE.go }
    ] });
    var orderBox = UI.codePanel({ title: 'Lock ordering', tabs: [{ lang: 'python', label: 'Python', code: ORDER_CODE }] });

    return UI.tabs({
      label: 'Concurrency at three levels',
      tabs: [
        { id: 'beginner', label: 'Beginner', content: function () {
          return levelPane(
            'A **program** is a list of instructions. A **thread** is one worker following a list of instructions. A **process** is a running program with its own private memory; it holds one or more threads.\n\n**Concurrency** means several tasks are *in progress* during the same period, even if only one runs at any instant. **Parallelism** means several tasks are *literally running at the same instant* on different CPU cores. Concurrency is about **structure** (how you organise tasks); parallelism is about **execution** (what the hardware does).\n\nWhy bother? Programs spend a lot of time **waiting** (for disks, networks, users). Concurrency lets other work happen during the wait, and parallelism lets heavy calculations use all your cores.',
            'A cook with three pots on the stove is **concurrent**. Three cooks, one pot each, are **parallel**. One cook cannot be parallel, but can be concurrent.',
            '- "More threads means faster". Past the number of cores, extra threads on CPU-heavy work make things **slower** (see Lab 6).\n- "Concurrency and parallelism are the same word". They are not: you can have either without the other.\n- "My code runs in order, so it is safe". With threads, the order of steps **between** threads is not guaranteed.',
            'A page that works in testing with one user starts losing orders or hanging under real traffic, because the bug only appears when two threads happen to overlap, which almost never happens on a developer laptop.'
          );
        } },
        { id: 'intermediate', label: 'Intermediate', content: function () {
          return levelPane(
            'Threads in one process **share memory**. That is their superpower (cheap communication) and their curse (shared state). A line like `counter += 1` is really three steps: **load**, **add**, **store**. If two threads interleave those steps, one update is lost. That is a **race condition**.\n\nThe fix is **mutual exclusion**: a **mutex** (lock) lets only one thread into a **critical section** at a time. A **semaphore** generalises this to N permits. An **atomic** operation makes the whole read-modify-write one indivisible hardware step.\n\nWhen threads need several locks you risk **deadlock**: each holds one lock and waits for another in a cycle. The four **Coffman conditions** must all hold: mutual exclusion, hold-and-wait, no preemption, circular wait. Break any one and deadlock is impossible. The cheapest to break is circular wait: **always take locks in one global order**.\n\nFor handing work between threads, use a **bounded queue** (producer-consumer). Bounded means a full queue makes producers wait, which is **backpressure** and protects memory.',
            'A shared whiteboard with a single marker. Whoever holds the marker may write; everyone else waits their turn. If two people each hold half of what the other needs, they stare at each other forever.',
            '- Locking only the **write** and not the **read**. A reader can still see half-finished state.\n- Using a plain `volatile` or a "flag" variable as a lock. Visibility is not atomicity.\n- Making a queue unbounded "to be safe". It is safe until memory runs out.\n- Holding a lock while calling slow code (network, disk). Everyone else queues behind it.',
            'A lock is held across a network call, the remote service slows down, and every thread piles up waiting for that one lock. CPU shows 5% yet the service is dead.',
            h('div', { class: 'stack' }, [codeBox.el, orderBox.el])
          );
        } },
        { id: 'advanced', label: 'Advanced', content: function () {
          return levelPane(
            '**Memory model and visibility.** Compilers and CPUs reorder instructions and cache values per core. Without a **happens-before** edge (a lock release/acquire, a `volatile` write/read, thread start/join, an atomic with the right ordering) one thread may never see another\'s write, or see writes out of order. Locks give you both mutual exclusion **and** visibility; that is why "it works on my machine" bugs vanish under a debugger.\n\n**Amdahl\'s law.** If a fraction `s` of the work is serial, speed-up on N cores is at most `1 / (s + (1 - s) / N)`. With 10% serial work, even infinite cores give at most 10x. Lock contention is serial work.\n\n**Pool sizing.** For CPU-bound work use roughly `cores` (or `cores + 1`) threads. For I/O-bound work use roughly `cores x (1 + wait / compute)`, then measure. Little\'s law (`concurrency = throughput x latency`) is a good sanity check.\n\n**GIL.** The default CPython interpreter has a **Global Interpreter Lock**: only one thread executes Python bytecode at a time, so threads give concurrency for I/O but not CPU parallelism. Use `multiprocessing`, native extensions that release the GIL, or a free-threaded build (experimental in 3.13, officially supported from 3.14, still opt-in). Java 21 added **virtual threads**, cheap threads suited to blocking I/O.\n\n**Other hazards.** *False sharing*: independent variables on one cache line make cores fight over it. *Priority inversion*: a low-priority thread holding a lock blocks a high-priority one. *Lock convoys*: threads queue up and wake one at a time, destroying throughput.',
            'A busy airport. Runways (cores) are the real limit; control-tower rules (the memory model) decide who can see which plane; and one slow gate (a hot lock) caps how many flights can leave however many runways you build.',
            '- Believing `synchronized`/`Lock` is "slow". Uncontended locks are cheap; **contention** is what costs.\n- Double-checked locking without `volatile` (Java) or proper atomics: another thread can see a half-built object.\n- Sizing a pool from a blog post instead of measuring your own wait-to-compute ratio.\n- Calling `Thread.sleep` or "adding a delay" to hide a race. It only moves it.',
            '- **Pool-starvation deadlock**: tasks in a fixed pool submit sub-tasks to the *same* pool and block on them. Every worker waits for a child that can never start (Lab 6, Break it).\n- **Check-then-act**: `if (!map.containsKey(k)) map.put(k, v)` on a thread-safe map is still racy; use an atomic `putIfAbsent`/`computeIfAbsent`.\n- **Thread leaks**: a pool created per request. Threads pile up until the process hits the OS limit.\n- **Finding it**: take a **thread dump** (`jstack`, `py-spy dump`, Go\'s goroutine dump) and look for threads blocked on each other; prefer `tryLock` with a timeout so a deadlock becomes a logged error instead of a frozen service.'
          );
        } }
      ]
    }).el;
  }

  /* ================= LAB 1: concurrency vs parallelism ================= */

  function labParallel() {
    var N = 6, WORK = 600, SWITCH = 30, DEADLINE = 3000;
    var sim = Sim.create({ speed: 1 });
    var cores = 2;
    var slice = 200;
    var gantt = makeGantt({ base: 4200, rowLabel: function (r) { return 'Core ' + (r + 1); }, marks: [{ t: DEADLINE, label: 'deadline' }], label: 'Gantt chart of which task runs on which core over time' });
    var st;

    var lab = UI.lab({
      title: 'Lab 1: concurrency vs parallelism',
      subtitle: 'Six tasks of 600 ms each share a few cores. Move the cores slider and watch the Gantt chart.',
      sim: sim,
      stage: h('div', {}, [gantt.el, legend([['#7aa2ff', 'task running (colour = task)'], ['#8a93a3', 'context switch (wasted time)']])]),
      stageLabel: 'Gantt chart of tasks across CPU cores',
      breakLabel: 'Break it: 10 ms time slices',
      fixLabel: 'Fix it: back to 200 ms slices',
      onBreak: function (broken) {
        slice = broken ? 10 : 200;
        sim.reset();
        sim.play();
      },
      caption: 'With 1 core, tasks take turns (concurrency): all make progress but total time is the sum. More cores run tasks at the same instant (parallelism) and the whole batch finishes sooner.'
    });

    function update() {
      var secs = sim.now() / 1000;
      lab.metrics.set('throughput', secs > 0 ? st.done / secs : 0);
      lab.metrics.set('latency', st.done ? Math.round(st.sum / st.done) : NaN);
      lab.metrics.set('depth', st.ready.length);
      lab.metrics.set('errors', st.missed);
    }

    function dispatch(ci) {
      var c = st.core[ci];
      if (c.busy || !st.ready.length) { return; }
      var t = st.ready.shift();
      var s = sim.now();
      var cost = (c.last !== -1 && c.last !== t.id) ? SWITCH : 0;
      var run = Math.min(slice, t.rem);
      if (cost) { gantt.add(ci, s, s + cost, 'switch', '', true); st.switches++; }
      gantt.add(ci, s + cost, s + cost + run, taskColor(t.id), 'T' + (t.id + 1));
      c.busy = true;
      c.last = t.id;
      if (slice >= 100 || st.switches % 25 === 1) {
        lab.log.log('Core ' + (ci + 1) + ' runs T' + (t.id + 1) + ' for ' + run + ' ms' + (cost ? ' (after a ' + cost + ' ms context switch)' : ''), { t: s });
      }
      sim.schedule(cost + run, function () {
        c.busy = false;
        t.rem -= run;
        if (t.rem <= 0) {
          st.done++;
          st.sum += sim.now();
          var late = sim.now() > DEADLINE;
          if (late) { st.missed++; }
          lab.log.log('T' + (t.id + 1) + ' finished at ' + Math.round(sim.now()) + ' ms' + (late ? ' (MISSED the 3000 ms deadline)' : ''), { t: sim.now(), level: late ? 'err' : 'ok' });
          if (st.done === N) {
            lab.log.log('All ' + N + ' tasks done at ' + Math.round(sim.now()) + ' ms. Time lost to context switching: ' + st.switches * SWITCH + ' ms of core time.', { t: sim.now(), level: late ? 'warn' : 'ok' });
            lab.explain(slice < 50
              ? '**Context-switch thrashing.** With a 10 ms slice a core spends 30 ms switching to run for only 10 ms. Most of the chart is grey: the CPU is busy but not doing your work. Time slices must be long compared with the switch cost.'
              : 'Total work is 3600 ms of CPU time. With **' + cores + ' core' + (cores > 1 ? 's' : '') + '** the batch finished at about **' + Math.round(sim.now()) + ' ms**. More cores shorten the finish time because tasks truly run in parallel; the small grey slivers are context switches when one core hops between tasks.');
          }
        } else {
          st.ready.push(t);
        }
        for (var k = 0; k < st.core.length; k++) { dispatch(k); }
        update();
      });
    }

    function seed() {
      st = { ready: [], core: [], done: 0, sum: 0, missed: 0, switches: 0 };
      var i;
      for (i = 0; i < N; i++) { st.ready.push({ id: i, rem: WORK }); }
      for (i = 0; i < cores; i++) { st.core.push({ busy: false, last: -1 }); }
      gantt.setRows(cores);
      gantt.clear();
      lab.log.clear();
      lab.metrics.reset();
      lab.bar.setBroken(slice !== 200);
      lab.explain(slice !== 200
        ? 'Time slices are now only 10 ms, but a context switch costs 30 ms. Press Play and watch the grey blocks swallow the chart.'
        : 'With 1 core, tasks take turns (concurrency): all make progress but total time is the sum. More cores run tasks at the same instant (parallelism) and the whole batch finishes sooner.');
      lab.log.log(N + ' tasks of ' + WORK + ' ms, ' + cores + ' core(s), ' + slice + ' ms time slice. Press Play.', { t: 0 });
      sim.schedule(0, function () { for (var k = 0; k < st.core.length; k++) { dispatch(k); } });
      gantt.draw(0);
      update();
    }

    sim.on('tick', function () { gantt.draw(sim.now()); update(); });
    sim.on('reset', seed);
    seed();

    var coreSlider = slider('Cores', 1, 4, cores, function (v) { cores = v; sim.reset(); });
    return wrap([coreSlider], lab);
  }

  /* ================= LAB 2: process vs thread memory ================= */

  function labMemory() {
    var sim = Sim.create({ speed: 1 });
    var mode = 'threads';
    var pipe = false;
    var st;
    var root = h('div', { class: 'mem' });

    function box(cls, kids) { return h('div', { class: 'mem-box ' + cls }, kids); }

    function render() {
      root.innerHTML = '';
      var dead = st.dead;
      if (mode === 'threads') {
        var p = h('div', { class: 'mem-proc' + (dead ? ' is-dead' : '') }, [
          h('h4', { text: 'One process (shared memory)' }),
          box('heap', ['Shared heap: counter = ', h('b', { text: String(st.a) })]),
          h('div', { class: 'mem-row' }, [
            box('', ['Thread A stack', h('br'), h('small', { text: 'writer' })]),
            box('', ['Thread B stack', h('br'), h('small', { text: 'reader' })])
          ]),
          h('p', { class: 'mem-note', text: dead ? 'Crash in Thread A took down the whole process, including B.' : 'B reads the same heap A writes. No copying, but no walls either.' })
        ]);
        root.appendChild(p);
      } else {
        var pa = h('div', { class: 'mem-proc' + (st.deadA ? ' is-dead' : '') }, [
          h('h4', { text: 'Process A (writer)' }),
          box('heap', ['Own heap: counter = ', h('b', { text: String(st.a) })]),
          box('', ['Main thread stack']),
          h('p', { class: 'mem-note', text: st.deadA ? 'Crashed. Its memory is gone.' : 'Private memory.' })
        ]);
        var mid = h('div', { class: 'mem-proc' }, [
          h('h4', { text: pipe ? 'IPC pipe' : 'No channel' }),
          box('', [pipe ? 'In flight: ' : 'Nothing connects A and B', h('b', { text: pipe ? String(st.depth) : '' })]),
          h('p', { class: 'mem-note', text: pipe ? 'Data is copied through the OS. Safe but slower.' : 'Separate processes cannot see each other\'s variables.' })
        ]);
        var pb = h('div', { class: 'mem-proc' }, [
          h('h4', { text: 'Process B (reader)' }),
          box('heap', ['Own heap: counter = ', h('b', { text: String(st.b) })]),
          box('', ['Main thread stack']),
          h('p', { class: 'mem-note', text: st.deadA ? 'Still running. A\'s crash did not touch B.' : 'Private memory.' })
        ]);
        root.appendChild(pa); root.appendChild(mid); root.appendChild(pb);
      }
    }

    var lab = UI.lab({
      title: 'Lab 2: process vs thread memory',
      subtitle: 'A writes a counter, B reads it. See what is shared, what is copied and what survives a crash.',
      sim: sim,
      stage: root,
      stageLabel: 'Memory diagram of threads inside one process or two separate processes',
      breakLabel: 'Break it: crash A',
      fixLabel: 'Fix it: restart everything',
      onBreak: function (broken) {
        if (!broken) { sim.reset(); sim.play(); return; }
        if (mode === 'threads') {
          st.dead = true; st.deadA = true;
          lab.log.log('Thread A crashed (for example a segfault or unhandled fatal error). The OS kills the whole process.', { t: sim.now(), level: 'err' });
          lab.metrics.inc('errors');
          lab.explain('**Threads share fate.** A fatal error in one thread takes down every thread in the process, because they live in the same address space. That is the price of cheap sharing.');
        } else {
          st.deadA = true;
          lab.log.log('Process A crashed. Process B is a separate process and keeps running.', { t: sim.now(), level: 'err' });
          lab.metrics.inc('errors');
          lab.explain('**Processes isolate failures.** B keeps running with its last copy of the data. That isolation (plus separate memory) is why browsers and servers like Nginx or Postgres use processes for safety.');
        }
        render();
      },
      caption: 'Threads share one heap (fast, but a bug anywhere hurts everyone). Processes each own their memory (safe, but must send data through a pipe or similar).'
    });

    function seed() {
      st = { a: 0, b: 0, dead: false, deadA: false, depth: 0, stale: 0, writes: 0 };
      lab.log.clear();
      lab.metrics.reset();
      lab.metrics.set('latency', mode === 'threads' ? 0 : (pipe ? 400 : NaN));
      lab.explain('Threads share one heap (fast, but a bug anywhere hurts everyone). Processes each own their memory (safe, but must send data through a pipe or similar).');
      lab.log.log('Mode: ' + (mode === 'threads' ? 'two threads in one process' : 'two processes' + (pipe ? ' connected by a pipe' : ' with no channel')) + '. Press Play.', { t: 0 });
      sim.schedule(900, writeA);
      sim.schedule(1000, readB);
      render();
    }

    function writeA() {
      if (st.deadA) { return; }
      st.a++; st.writes++;
      if (mode === 'threads') {
        st.b = st.a;
        lab.log.log('A sets counter = ' + st.a + ' (visible to B instantly: same memory)', { t: sim.now() });
      } else if (pipe) {
        st.depth++;
        lab.log.log('A sends counter = ' + st.a + ' through the pipe (a copy)', { t: sim.now() });
        var v = st.a;
        sim.schedule(400, function () {
          st.depth--; st.b = v;
          lab.log.log('B receives ' + v + ' from the pipe (400 ms later)', { t: sim.now(), level: 'ok' });
          upd(); render();
        });
      } else {
        lab.log.log('A sets counter = ' + st.a + ' in its own memory', { t: sim.now() });
      }
      upd(); render();
      sim.schedule(900, writeA);
    }

    function readB() {
      if (st.dead) { return; }
      var level = 'info';
      var msg = 'B reads counter = ' + st.b;
      if (mode === 'procs' && !pipe && st.a !== st.b) {
        st.stale++; level = 'err';
        msg += ' but A has ' + st.a + '. B has its own copy and never sees A\'s changes (a stale read).';
        lab.explain('**Separate processes do not share variables.** B\'s counter is a different variable that happens to share a name. To share data you need **inter-process communication** (pipes, sockets, shared-memory segments, queues), which copies data and takes time.');
      } else if (mode === 'procs' && pipe && st.a !== st.b) {
        level = 'warn'; msg += ' (A is ahead by ' + (st.a - st.b) + ': the copy is still in flight)';
      }
      lab.log.log(msg, { t: sim.now(), level: level });
      upd();
      sim.schedule(1000, readB);
    }

    function upd() {
      var secs = sim.now() / 1000;
      lab.metrics.set('throughput', secs > 0 ? st.writes / secs : 0);
      lab.metrics.set('depth', st.depth);
      lab.metrics.set('errors', st.stale + (st.deadA ? 1 : 0));
    }

    sim.on('reset', seed);
    seed();

    var modeSeg = segmented('Model', [['threads', 'Threads'], ['procs', 'Processes']], mode, function (v) { mode = v; sim.reset(); });
    var pipeBox = checkbox('Add an IPC pipe (processes only)', pipe, function (v) { pipe = v; sim.reset(); });
    return wrap([modeSeg, pipeBox], lab);
  }

  /* ================= LAB 3: race condition ================= */

  function labRace() {
    var STEP = 800;
    var OPS = ['LOAD  r = counter', 'ADD   r = r + 1', 'STORE counter = r'];
    var OPS_LOCK = ['LOCK  mutex'].concat(OPS, ['UNLOCK mutex']);
    var BUG_SCRIPT = [0, 1, 0, 1, 0, 1];
    var LOCK_SCRIPT = [0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1];
    var TRIALS = 1000, PER = 5;

    var sim = Sim.create({ speed: 1 });
    var mode = 'step';
    var lockOn = false;
    var st, hist, trialsDone, rnd;

    var threadsBox = h('div', { class: 'threads' });
    var sharedRow = h('div', { class: 'shared-row' });
    var stepView = h('div', {}, [threadsBox, sharedRow]);
    var histBox = h('div', { class: 'hist', role: 'img', 'aria-label': 'Histogram of final counter values over 1000 runs' });
    var histNote = h('p', { class: 'muted', text: '' });
    var histView = h('div', {}, [histBox, histNote]);
    var stage = h('div', {}, [stepView, histView]);

    var lab = UI.lab({
      title: 'Lab 3: race condition',
      subtitle: 'Two threads each run counter++. Step through one unlucky run, repeat it 1000 times, then fix it with a mutex.',
      sim: sim,
      stage: stage,
      stageLabel: 'Two thread programs and a shared counter, or a histogram of results',
      autoPlayOnBreak: false,
      breakLabel: 'Break it: remove the mutex',
      fixLabel: 'Fix it: add the mutex',
      onBreak: function (broken) { lockOn = !broken; sim.reset(); },
      caption: 'Pick a mode, press Play (or Step to advance one instruction at a time).'
    });

    function ops() { return lockOn ? OPS_LOCK : OPS; }

    function renderStep() {
      threadsBox.innerHTML = '';
      st.th.forEach(function (t, i) {
        var ol = h('ol');
        ops().forEach(function (op, k) {
          var cls = k < t.pc ? 'is-done' : (k === t.pc ? (t.blocked ? 'is-blocked' : 'is-now') : '');
          ol.appendChild(h('li', { class: cls, text: op }));
        });
        threadsBox.appendChild(h('div', { class: 'thr' }, [
          h('h4', { text: 'Thread ' + (i + 1) }), ol,
          h('div', { class: 'reg', text: 'private register r = ' + (t.reg === null ? '?' : t.reg) + (t.blocked ? '  (waiting for the lock)' : '') })
        ]));
      });
      sharedRow.innerHTML = '';
      sharedRow.appendChild(h('div', { class: 'shared-box' }, ['Shared counter', h('b', { text: String(st.counter) })]));
      if (lockOn) {
        sharedRow.appendChild(h('div', { class: 'shared-box' + (st.owner !== null ? ' lock-held' : '') }, ['Mutex', h('b', { text: st.owner === null ? 'free' : 'held by T' + (st.owner + 1) })]));
      }
    }

    function renderHist() {
      histBox.innerHTML = '';
      var max = 1, v;
      for (v = 2; v <= 10; v++) { max = Math.max(max, hist[v]); }
      for (v = 2; v <= 10; v++) {
        var bar = h('div', { class: 'hist-bar' });
        bar.style.height = Math.round(hist[v] / max * 100) + '%';
        var col = h('div', { class: 'hist-col' + (v === 10 ? ' ok' : '') }, [h('b', { text: String(hist[v]) }), h('div', { style: 'flex:1;display:flex;align-items:flex-end;width:100%' }, [bar]), h('span', { text: String(v) })]);
        histBox.appendChild(col);
      }
      histNote.textContent = 'Final counter value after each run (correct answer is 10). Runs: ' + trialsDone + ' / ' + TRIALS;
    }

    function show() {
      stepView.hidden = mode !== 'step';
      histView.hidden = mode === 'step';
    }

    function execOp(i) {
      var t = st.th[i];
      var list = ops();
      if (t.pc >= list.length) { return; }
      var name = list[t.pc].split(' ')[0];
      var who = 'Thread ' + (i + 1);
      if (name === 'LOCK') {
        if (st.owner !== null && st.owner !== i) {
          t.blocked = true;
          lab.log.log(who + ' tries LOCK but T' + (st.owner + 1) + ' holds it, so it must wait (blocked, not spinning).', { t: sim.now(), level: 'warn' });
          return;
        }
        st.owner = i; t.blocked = false;
        lab.log.log(who + ' acquires the mutex.', { t: sim.now() });
      } else if (name === 'LOAD') {
        t.reg = st.counter;
        lab.log.log(who + ' LOAD: reads counter = ' + st.counter + ' into its private register.', { t: sim.now() });
      } else if (name === 'ADD') {
        t.reg++;
        lab.log.log(who + ' ADD: register becomes ' + t.reg + '.', { t: sim.now() });
      } else if (name === 'STORE') {
        var lost = st.counter !== t.reg - 1;
        st.counter = t.reg;
        lab.log.log(who + ' STORE: counter = ' + t.reg + (lost ? '. The other thread already changed it; that update is LOST.' : '.'), { t: sim.now(), level: lost ? 'err' : 'info' });
        if (lost) { st.lost++; }
      } else if (name === 'UNLOCK') {
        st.owner = null;
        lab.log.log(who + ' releases the mutex.', { t: sim.now(), level: 'ok' });
      }
      t.pc++;
    }

    function stepMetrics() {
      lab.metrics.set('depth', st.th.filter(function (t) { return t.blocked; }).length);
      lab.metrics.set('errors', st.lost);
      lab.metrics.set('throughput', sim.now() > 0 ? st.ran / (sim.now() / 1000) : 0);
      lab.metrics.set('latency', NaN);
    }

    function stepRun(k) {
      var script = lockOn ? LOCK_SCRIPT : BUG_SCRIPT;
      if (k >= script.length) {
        var ok = st.counter === 2;
        lab.log.log('Both threads finished. Counter = ' + st.counter + ' (expected 2).', { t: sim.now(), level: ok ? 'ok' : 'err' });
        lab.explain(ok
          ? '**The mutex worked.** Thread 2 tried to LOCK while Thread 1 was inside its critical section, so it waited. The three steps of each increment ran one thread at a time, giving the correct **2**.'
          : '**Lost update.** Both threads LOADed 0 before either STOREd. Each added 1 to its own private copy and wrote back 1. Two increments happened, but the counter says **1**. Nothing crashed and no error appeared: the program silently produced a wrong answer.');
        stepMetrics(); renderStep();
        return;
      }
      execOp(script[k]);
      st.ran++;
      stepMetrics(); renderStep();
      sim.schedule(STEP, function () { stepRun(k + 1); });
    }

    function trial() {
      var res;
      if (lockOn) {
        res = 0;
        for (var i = 0; i < 2 * PER; i++) { res++; }
      } else {
        var th = [{ pc: 0, n: 0, reg: 0 }, { pc: 0, n: 0, reg: 0 }];
        var c = 0;
        while (th[0].n < PER || th[1].n < PER) {
          var cand = [];
          if (th[0].n < PER) { cand.push(0); }
          if (th[1].n < PER) { cand.push(1); }
          var t = th[cand[Math.floor(rnd() * cand.length)]];
          if (t.pc === 0) { t.reg = c; t.pc = 1; } else if (t.pc === 1) { t.reg++; t.pc = 2; } else { c = t.reg; t.pc = 0; t.n++; }
        }
        res = c;
      }
      return res;
    }

    function trialRun() {
      var r = trial();
      hist[r]++; trialsDone++;
      if (r !== 2 * PER) { st.lost++; }
      if (trialsDone <= 3 || trialsDone % 100 === 0) {
        lab.log.log('Run #' + trialsDone + ': final counter = ' + r + (r === 10 ? '' : ' (wrong, ' + (10 - r) + ' increments lost)'), { t: sim.now(), level: r === 10 ? 'ok' : 'warn' });
      }
      var dur = lockOn ? 7 : 4;
      lab.metrics.set('throughput', sim.now() > 0 ? trialsDone / ((sim.now() + dur) / 1000) : 0);
      lab.metrics.set('latency', dur);
      lab.metrics.set('depth', TRIALS - trialsDone);
      lab.metrics.set('errors', st.lost);
      renderHist();
      if (trialsDone < TRIALS) {
        sim.schedule(dur, trialRun);
      } else {
        var wrong = st.lost;
        lab.log.log('1000 runs done: ' + wrong + ' wrong results.', { t: sim.now(), level: wrong ? 'err' : 'ok' });
        lab.explain(wrong
          ? '**Same code, different answers.** ' + wrong + ' of 1000 runs lost updates, and the result changes from run to run because it depends on exact timing. That is why races survive testing and fail in production. Only the value 10 is correct.'
          : '**All 1000 runs gave 10.** The mutex forces the read-modify-write to happen one thread at a time. Notice the cost: each run takes longer (7 ms vs 4 ms here), so throughput dropped. Correctness first, then shrink the critical section.');
      }
    }

    function seed() {
      st = { th: [{ pc: 0, reg: null, blocked: false }, { pc: 0, reg: null, blocked: false }], counter: 0, owner: null, lost: 0, ran: 0 };
      hist = {}; for (var v = 2; v <= 10; v++) { hist[v] = 0; }
      trialsDone = 0;
      rnd = Sim.random(20240607);
      lab.log.clear();
      lab.metrics.reset();
      lab.bar.setBroken(!lockOn);
      show();
      if (mode === 'step') {
        lab.explain(lockOn
          ? 'Mutex version: each thread must LOCK before touching the counter and UNLOCK after. Press Play or Step.'
          : 'Each thread runs counter++ as three separate steps. The scheduler decides the order, and this order is a perfectly legal one. Press Play or Step.');
        lab.log.log('Two threads, one shared counter = 0. Expected final value: 2.', { t: 0 });
        renderStep();
        sim.schedule(STEP, function () { stepRun(0); });
      } else {
        lab.explain(lockOn
          ? 'Each run: 2 threads x 5 increments, with a mutex around every increment.'
          : 'Each run: 2 threads x 5 increments with no lock, interleaved at random at instruction level. The correct total is 10.');
        lab.log.log('Press Play to run ' + TRIALS + ' trials (' + (lockOn ? 'with' : 'without') + ' a mutex).', { t: 0 });
        renderHist();
        lab.metrics.set('depth', TRIALS);
        sim.schedule(lockOn ? 7 : 4, trialRun);
      }
    }

    sim.on('reset', seed);

    var modeSeg = segmented('Mode', [['step', '1 Step through'], ['x1000', '2 Run 1000x'], ['mutex', '3 Fix with a mutex']], mode, function (v) {
      mode = v;
      lockOn = v === 'mutex';
      sim.reset();
    });
    seed();
    return wrap([modeSeg], lab);
  }

  /* ================= LAB 4: dining philosophers ================= */

  function labPhilosophers() {
    var N = 5, EAT = 400;
    var sim = Sim.create({ speed: 1 });
    var naive = false;
    var st, rnd;
    var host = h('div', { class: 'phil-wrap' });
    var drawing = h('div');
    var status = h('ul', { class: 'phil-status', 'aria-label': 'Philosopher states' });
    host.appendChild(drawing);
    host.appendChild(h('div', {}, [status, legend([['#e0b341', 'hungry'], ['#4ccf8d', 'eating'], ['#ef5b5b', 'deadlocked']])]));

    var lab = UI.lab({
      title: 'Lab 4: dining philosophers and deadlock',
      subtitle: 'Five philosophers, five forks. Each needs two forks to eat. Safe version first, then break it.',
      sim: sim,
      stage: host,
      stageLabel: 'Five philosophers around a table with forks between them',
      breakLabel: 'Break it: everyone grabs the left fork',
      fixLabel: 'Fix it: lock forks in a global order',
      onBreak: function (broken) { naive = broken; sim.reset(); sim.play(); },
      caption: 'Safe version: every philosopher picks up the lower-numbered fork first, so a circular wait cannot form.'
    });

    function fl(p) { return p; }
    function fr(p) { return (p + 1) % N; }

    function findCycle() {
      var i, seen, cur;
      for (i = 0; i < N; i++) {
        seen = [];
        cur = i;
        while (cur !== null && seen.indexOf(cur) === -1) {
          seen.push(cur);
          var w = st.ph[cur].want;
          cur = w === null ? null : st.owner[w];
        }
        if (cur !== null) { return seen.slice(seen.indexOf(cur)); }
      }
      return null;
    }

    function pos(i, r) {
      var a = (-90 + 72 * i) * Math.PI / 180;
      return [150 + r * Math.cos(a), 150 + r * Math.sin(a)];
    }
    function forkPos(f, r) {
      var a = (-90 + 72 * f + 36) * Math.PI / 180;
      return [150 + r * Math.cos(a), 150 + r * Math.sin(a), a];
    }

    function render() {
      var cycle = st.cycle || [];
      var s = svg('svg', { class: 'phil-svg', viewBox: '0 0 300 300', 'aria-hidden': 'true' });
      s.appendChild(svg('circle', { class: 'table', cx: 150, cy: 150, r: 70 }));
      var i;
      for (i = 0; i < N; i++) {
        var fp = forkPos(i, 62);
        var held = st.owner[i] !== null;
        s.appendChild(svg('line', { class: 'fork' + (held ? ' held' : ''), x1: fp[0] - 9 * Math.cos(fp[2]), y1: fp[1] - 9 * Math.sin(fp[2]), x2: fp[0] + 9 * Math.cos(fp[2]), y2: fp[1] + 9 * Math.sin(fp[2]) }));
      }
      for (i = 0; i < N; i++) {
        var p = st.ph[i];
        if (p.want !== null) {
          var a = pos(i, 84);
          var b = forkPos(p.want, 62);
          var inCycle = cycle.indexOf(i) !== -1;
          s.appendChild(svg('line', { class: 'wait' + (inCycle ? ' cycle' : ''), x1: a[0], y1: a[1], x2: b[0], y2: b[1], 'stroke-dasharray': '4 3' }));
        }
      }
      for (i = 0; i < N; i++) {
        var q = pos(i, 108);
        var cls = 'p ' + (cycle.indexOf(i) !== -1 ? 'stuck' : (st.ph[i].state === 'eating' ? 'eating' : (st.ph[i].state === 'hungry' ? 'hungry' : '')));
        s.appendChild(svg('circle', { class: cls, cx: q[0], cy: q[1], r: 22 }));
        s.appendChild(svg('text', { x: q[0], y: q[1] }, ['P' + i]));
      }
      drawing.innerHTML = '';
      drawing.appendChild(s);
      status.innerHTML = '';
      for (i = 0; i < N; i++) {
        var ph = st.ph[i];
        var holds = [];
        if (st.owner[fl(i)] === i) { holds.push(fl(i)); }
        if (st.owner[fr(i)] === i) { holds.push(fr(i)); }
        var txt = 'P' + i + ': ' + (cycle.indexOf(i) !== -1 ? 'DEADLOCKED' : ph.state) + (holds.length ? ' (holds fork ' + holds.join(', ') + ')' : '') + (ph.want !== null ? ', waiting for fork ' + ph.want : '');
        status.appendChild(h('li', { text: txt }));
      }
      drawing.firstChild.setAttribute('aria-hidden', 'true');
    }

    function metrics() {
      var waiting = st.ph.filter(function (p) { return p.want !== null; }).length;
      var secs = sim.now() / 1000;
      lab.metrics.set('throughput', secs > 0 ? st.meals / secs : 0);
      lab.metrics.set('latency', st.meals ? Math.round(st.hungrySum / st.meals) : NaN);
      lab.metrics.set('depth', waiting);
      lab.metrics.set('errors', st.dead ? 1 : 0);
    }

    function acquire(p, f, cb) {
      if (st.owner[f] === null) {
        st.owner[f] = p;
        cb();
      } else {
        st.ph[p].want = f;
        lab.log.log('P' + p + ' wants fork ' + f + ' but P' + st.owner[f] + ' holds it. P' + p + ' waits.', { t: sim.now(), level: 'warn' });
        st.waiters[f].push({ p: p, cb: cb });
      }
      render(); metrics();
    }

    function release(f) {
      st.owner[f] = null;
      if (st.waiters[f].length) {
        var w = st.waiters[f].shift();
        st.owner[f] = w.p;
        st.ph[w.p].want = null;
        w.cb();
      }
    }

    function hungry(p) {
      var P = st.ph[p];
      P.state = 'hungry'; P.since = sim.now();
      var L = fl(p), R = fr(p);
      var first = naive ? L : Math.min(L, R);
      var second = naive ? R : Math.max(L, R);
      lab.log.log('P' + p + ' is hungry. Picks up fork ' + first + ' first.', { t: sim.now() });
      acquire(p, first, function () {
        lab.log.log('P' + p + ' holds fork ' + first + '.', { t: sim.now() });
        sim.schedule(naive ? 200 : 50, function () {
          acquire(p, second, function () { eat(p, first, second); });
        });
      });
    }

    function eat(p, a, b) {
      var P = st.ph[p];
      P.state = 'eating';
      st.hungrySum += sim.now() - P.since;
      lab.log.log('P' + p + ' has forks ' + a + ' and ' + b + ' and is EATING.', { t: sim.now(), level: 'ok' });
      render(); metrics();
      sim.schedule(EAT, function () {
        st.meals++;
        P.state = 'thinking';
        lab.log.log('P' + p + ' finished eating and puts both forks down.', { t: sim.now() });
        release(a); release(b);
        render(); metrics();
        sim.schedule(100 + Math.floor(rnd() * 400), function () { hungry(p); });
      });
    }

    function heartbeat() {
      var c = findCycle();
      metrics();
      if (c) {
        st.dead = true; st.cycle = c;
        var chain = c.map(function (x) { return 'P' + x; });
        lab.log.log('DEADLOCK detected. Wait-for cycle: ' + chain.join(' -> ') + ' -> P' + c[0] + '. Each holds one fork and waits for the next. Nothing can ever move.', { t: sim.now(), level: 'err' });
        lab.explain('**Deadlock, and all four conditions hold.** (1) Forks are exclusive. (2) Each philosopher holds one fork while waiting for another. (3) Nobody can snatch a fork away. (4) The waits form a **circle**: P0 waits on P1 waits on ... waits on P0. Press **Fix it** and every philosopher picks up the lower-numbered fork first; P4 now reaches for fork 0 before fork 4, so the circle cannot close.');
        lab.metrics.set('errors', 1);
        render();
        sim.pause();
        return;
      }
      sim.schedule(250, heartbeat);
    }

    function seed() {
      st = { ph: [], owner: [], waiters: [], meals: 0, hungrySum: 0, dead: false, cycle: null };
      rnd = Sim.random(7);
      for (var i = 0; i < N; i++) { st.ph.push({ state: 'thinking', want: null, since: 0 }); st.owner.push(null); st.waiters.push([]); }
      lab.log.clear();
      lab.metrics.reset();
      lab.bar.setBroken(naive);
      lab.explain(naive
        ? 'Everyone grabs their left fork at the same moment, then waits 200 ms before reaching for the right one. Press Play.'
        : 'Safe version: every philosopher picks up the lower-numbered fork first, so a circular wait cannot form. Philosophers keep eating and thinking forever. Press Play.');
      lab.log.log((naive ? 'Naive' : 'Ordered') + ' rule. All philosophers get hungry at t = 300 ms.', { t: 0 });
      for (var p = 0; p < N; p++) { (function (id) { sim.schedule(300, function () { hungry(id); }); })(p); }
      sim.schedule(250, heartbeat);
      render();
    }

    sim.on('reset', seed);
    seed();
    return wrap([], lab);
  }

  /* ================= LAB 5: producer-consumer bounded buffer ================= */

  function labBuffer() {
    var PROD_MS = 400, CONS_MS = 700, OOM = 60;
    var sim = Sim.create({ speed: 1 });
    var np = 2, nc = 1, cap = 5;
    var unbounded = false;
    var st;
    var prodCol = h('div', { class: 'buf-col' });
    var consCol = h('div', { class: 'buf-col' });
    var slotsBox = h('div', { class: 'buf-slots' });
    var stage = h('div', { class: 'buf-row' }, [prodCol, h('span', { class: 'arrow', 'aria-hidden': 'true', text: '\u2192' }), slotsBox, h('span', { class: 'arrow', 'aria-hidden': 'true', text: '\u2192' }), consCol]);

    var lab = UI.lab({
      title: 'Lab 5: producer-consumer with a bounded buffer',
      subtitle: 'Producers are faster than the consumer. What happens to the buffer between them?',
      sim: sim,
      stage: stage,
      stageLabel: 'Producers, a bounded buffer and consumers',
      breakLabel: 'Break it: make the buffer unbounded',
      fixLabel: 'Fix it: bound the buffer again',
      onBreak: function (broken) {
        if (st.dead) { sim.reset(); return; }
        unbounded = broken;
        if (broken) {
          lab.log.log('Buffer capacity removed. Producers never have to wait now.', { t: sim.now(), level: 'warn' });
          while (st.waitP.length) { wakeProducer(); }
          lab.explain('Without a limit the producers never feel any pressure, so they produce at full speed while the consumer falls further behind. The buffer grows without bound until the process runs out of memory.');
        } else {
          lab.log.log('Buffer bounded again at ' + cap + '. Producers will wait when it is full.', { t: sim.now(), level: 'ok' });
          lab.explain('**Backpressure restored.** When the buffer is full, producers are made to wait, so the system settles at the speed of the slowest stage instead of burying it.');
        }
        render();
      },
      caption: 'A bounded buffer makes fast producers wait for slow consumers. That waiting is not a bug: it is **backpressure**.'
    });

    function limit() { return unbounded ? Infinity : cap; }

    function render() {
      prodCol.innerHTML = '';
      consCol.innerHTML = '';
      st.prods.forEach(function (p, i) {
        prodCol.appendChild(h('div', { class: 'node' + (p.blocked ? ' is-blocked' : '') }, ['Producer ' + (i + 1), h('small', { text: p.blocked ? 'BLOCKED: buffer full' : 'producing' })]));
      });
      st.cons.forEach(function (c, i) {
        consCol.appendChild(h('div', { class: 'node' + (c.waiting ? ' is-wait' : '') }, ['Consumer ' + (i + 1), h('small', { text: c.waiting ? 'waiting: buffer empty' : 'processing' })]));
      });
      slotsBox.innerHTML = '';
      slotsBox.classList.toggle('is-full', !unbounded && st.buf.length >= cap);
      slotsBox.classList.toggle('is-dead', st.dead);
      var shown = unbounded ? Math.min(st.buf.length, 44) : cap;
      for (var i = 0; i < shown; i++) { slotsBox.appendChild(h('span', { class: 'bslot' + (i < st.buf.length ? ' on' : '') })); }
      if (unbounded && st.buf.length > shown) { slotsBox.appendChild(h('span', { class: 'slots-empty', text: '+' + (st.buf.length - shown) })); }
      slotsBox.setAttribute('aria-label', 'Buffer holds ' + st.buf.length + (unbounded ? ' items (unbounded)' : ' of ' + cap + ' slots'));
      var secs = sim.now() / 1000;
      lab.metrics.set('throughput', secs > 0 ? st.done / secs : 0);
      lab.metrics.set('latency', st.done ? Math.round(st.waitSum / st.done) : NaN);
      lab.metrics.set('depth', st.buf.length);
      lab.metrics.set('errors', st.dead ? 1 : 0);
    }

    function crash() {
      st.dead = true;
      lab.log.log('OutOfMemoryError: the buffer reached ' + st.buf.length + ' items and the process ran out of memory. Everything in the buffer is lost.', { t: sim.now(), level: 'err' });
      lab.explain('**The classic unbounded-queue failure.** Producers made ' + st.made + ' items; the consumer finished only ' + st.done + '. The difference piled up in memory until the process died, and every buffered item vanished with it. Bounding the buffer turns that crash into a harmless wait. Press **Fix it** to reset.');
      render();
      sim.pause();
    }

    function put(p, item) {
      st.buf.push(item);
      if (st.buf.length >= OOM && unbounded) { crash(); return false; }
      if (st.waitC.length) { var c = st.waitC.shift(); c.waiting = false; sim.schedule(0, function () { take(c); }); }
      return true;
    }

    function produce(p) {
      sim.schedule(PROD_MS, function () {
        if (st.dead) { return; }
        var item = { id: ++st.made, born: sim.now() };
        lab.log.log('Producer ' + (st.prods.indexOf(p) + 1) + ' made item #' + item.id, { t: sim.now() });
        if (st.buf.length < limit()) {
          if (put(p, item)) { render(); produce(p); }
        } else {
          p.blocked = true; p.pending = item;
          st.waitP.push(p);
          lab.log.log('Buffer full (' + st.buf.length + '/' + cap + '). Producer ' + (st.prods.indexOf(p) + 1) + ' must WAIT. This is backpressure.', { t: sim.now(), level: 'warn' });
          render();
        }
      });
    }

    function wakeProducer() {
      if (!st.waitP.length) { return; }
      var p = st.waitP.shift();
      p.blocked = false;
      var item = p.pending; p.pending = null;
      if (put(p, item)) { render(); produce(p); }
    }

    function take(c) {
      if (st.dead) { return; }
      if (!st.buf.length) {
        c.waiting = true; st.waitC.push(c);
        lab.log.log('Consumer ' + (st.cons.indexOf(c) + 1) + ' finds the buffer empty and waits.', { t: sim.now(), level: 'warn' });
        render();
        return;
      }
      var item = st.buf.shift();
      if (st.waitP.length && st.buf.length < limit()) { wakeProducer(); }
      render();
      sim.schedule(CONS_MS, function () {
        if (st.dead) { return; }
        st.done++; st.waitSum += sim.now() - item.born;
        lab.log.log('Consumer ' + (st.cons.indexOf(c) + 1) + ' finished item #' + item.id, { t: sim.now(), level: 'ok' });
        render();
        take(c);
      });
    }

    function seed() {
      st = { buf: [], prods: [], cons: [], waitP: [], waitC: [], made: 0, done: 0, waitSum: 0, dead: false };
      unbounded = false;
      var i;
      for (i = 0; i < np; i++) { st.prods.push({ blocked: false, pending: null }); }
      for (i = 0; i < nc; i++) { st.cons.push({ waiting: false }); }
      lab.log.clear();
      lab.metrics.reset();
      lab.bar.setBroken(false);
      lab.explain('A bounded buffer makes fast producers wait for slow consumers. That waiting is not a bug: it is **backpressure**.');
      lab.log.log(np + ' producer(s) at 400 ms/item, ' + nc + ' consumer(s) at 700 ms/item, capacity ' + cap + '. Press Play.', { t: 0 });
      st.prods.forEach(produce);
      st.cons.forEach(function (c) { sim.schedule(0, function () { take(c); }); });
      render();
    }

    sim.on('reset', seed);
    seed();

    var s1 = slider('Producers', 1, 3, np, function (v) { np = v; sim.reset(); });
    var s2 = slider('Consumers', 1, 3, nc, function (v) { nc = v; sim.reset(); });
    var s3 = slider('Buffer capacity', 1, 12, cap, function (v) { cap = v; sim.reset(); });
    return wrap([s1, s2, s3], lab);
  }

  /* ================= LAB 6: thread pool sizing ================= */

  function labPool() {
    var TASKS = 48, CORES = 4;
    var sim = Sim.create({ speed: 1 });
    var size = 4, work = 'cpu', runtime = 'native';
    var starve = false;
    var gantt = makeGantt({ base: 3000, rowLabel: function (r) { return 'Worker ' + (r + 1); }, label: 'Gantt chart of what each pool worker is doing' });
    var st;

    var lab = UI.lab({
      title: 'Lab 6: thread pool sizing',
      subtitle: '48 tasks on a 4-core machine. Change the pool size, the kind of work and the runtime, and watch the total time.',
      sim: sim,
      stage: h('div', {}, [gantt.el, legend([['#7aa2ff', 'using the CPU'], ['#8a93a3', 'waiting on I/O (hollow bar)'], ['#ef5b5b', 'blocked on a child task']])]),
      stageLabel: 'Gantt chart of pool workers',
      breakLabel: 'Break it: tasks wait for sub-tasks in the same pool',
      fixLabel: 'Fix it: independent tasks',
      onBreak: function (broken) { starve = broken; sim.reset(); sim.play(); },
      caption: 'CPU-bound work stops getting faster once the pool matches the core count. I/O-bound work keeps improving with more threads, because waiting threads do not need a core.'
    });

    function metrics() {
      var secs = sim.now() / 1000;
      lab.metrics.set('throughput', secs > 0 ? st.done / secs : 0);
      lab.metrics.set('latency', st.done ? Math.round(st.sum / st.done) : NaN);
      lab.metrics.set('depth', st.queue.length);
      lab.metrics.set('errors', st.dead ? 1 : 0);
    }

    function checkDeadlock() {
      if (st.dead || st.blocked !== size || !st.queue.length) { return; }
      st.dead = true;
      lab.log.log('POOL STARVATION DEADLOCK: all ' + size + ' workers are blocked waiting for child tasks, and the ' + st.queue.length + ' tasks still in the queue (including those children) can never start.', { t: sim.now(), level: 'err' });
      lab.explain('**Thread-pool starvation.** Every running task submitted a child task to the *same* pool and then blocked waiting for it. All workers are now blocked, so nobody is free to run the children. No lock was involved, yet it is a true deadlock. Fixes: never block a pool thread on work from the same pool, use a separate pool for children, use non-blocking composition (futures, async), or make the pool unbounded for such work. A thread dump would show every worker parked in a `Future.get()`.');
      metrics();
      gantt.draw(sim.now());
      sim.pause();
    }

    function start(w) {
      if (w.busy || !st.queue.length || st.dead) { return; }
      var t = st.queue.shift();
      w.busy = true;
      if (t.child) { runChild(w, t); return; }
      var s = sim.now();
      if (starve) { runStarve(w, t, s); return; }
      var cpu = work === 'cpu' ? 200 : 20;
      var io = work === 'cpu' ? 0 : 180;
      st.cpuBusy++;
      var eff = runtime === 'gil' ? 1 : CORES;
      var stretch = Math.max(1, st.cpuBusy / eff) * (1 + 0.03 * Math.max(0, size - eff));
      var dur = Math.round(cpu * stretch);
      gantt.add(w.i, s, s + dur, taskColor(t.id), stretch > 1.05 ? Math.round(stretch * 10) / 10 + 'x' : '');
      sim.schedule(dur, function () {
        st.cpuBusy--;
        if (io) {
          gantt.add(w.i, sim.now(), sim.now() + io, taskColor(t.id), 'I/O', true);
          sim.schedule(io, function () { finish(w, t); });
        } else {
          finish(w, t);
        }
      });
    }

    function finish(w, t) {
      st.done++; st.sum += sim.now();
      w.busy = false;
      if (st.done === TASKS) {
        lab.log.log('All ' + TASKS + ' tasks finished at ' + Math.round(sim.now()) + ' ms with a pool of ' + size + '.', { t: sim.now(), level: 'ok' });
        lab.explain(summary(Math.round(sim.now())));
      }
      metrics();
      start(w);
    }

    function runStarve(w, t, s) {
      gantt.add(w.i, s, s + 50, taskColor(t.id), 'P' + (t.id + 1));
      sim.schedule(50, function () {
        var child = { id: t.id, child: true, parent: w, parentTask: t };
        st.queue.push(child);
        st.blocked++;
        w.blockSeg = gantt.add(w.i, sim.now(), Infinity, 'blocked', 'wait', true);
        lab.log.log('Task ' + (t.id + 1) + ' submits a child to the same pool and blocks waiting for it.', { t: sim.now(), level: 'warn' });
        metrics();
        checkDeadlock();
      });
    }

    function runChild(w, c) {
      var s = sim.now();
      gantt.add(w.i, s, s + 50, taskColor(c.id), 'C' + (c.id + 1));
      sim.schedule(50, function () {
        st.done++; st.sum += sim.now();
        w.busy = false;
        var pw = c.parent;
        pw.blockSeg.end = sim.now();
        st.blocked--;
        pw.busy = false;
        st.done++; st.sum += sim.now();
        metrics();
        start(w); start(pw);
      });
    }

    function summary(ms) {
      if (starve) { return ''; }
      if (work === 'cpu' && runtime === 'native') { return 'Finished in **' + ms + ' ms**. CPU-bound work: 4 workers saturate 4 cores. Try 8 or 16 workers: no speed-up (bars stretch because workers share cores), and the overhead of extra threads makes it slightly worse.'; }
      if (work === 'cpu') { return 'Finished in **' + ms + ' ms**. With the **GIL**, only one thread runs Python bytecode at a time, so extra threads give no CPU speed-up. For CPU-bound Python use `multiprocessing`, native extensions that release the GIL, or a free-threaded build.'; }
      return 'Finished in **' + ms + ' ms**. I/O-bound work: each task spends 90% of its time waiting, and a waiting thread does not need a core. A pool of 16 beats a pool of 4 by a wide margin. Rule of thumb: threads = cores x (1 + wait / compute) = 4 x (1 + 180 / 20) = 40, capped by what downstream services can handle. The GIL is released while waiting, so I/O-bound Python threads scale well too.';
    }

    function seed() {
      st = { queue: [], done: 0, sum: 0, cpuBusy: 0, blocked: 0, dead: false, workers: [] };
      var i;
      for (i = 0; i < TASKS; i++) { st.queue.push({ id: i }); }
      for (i = 0; i < size; i++) { st.workers.push({ i: i, busy: false }); }
      gantt.setRows(size);
      gantt.clear();
      lab.log.clear();
      lab.metrics.reset();
      lab.bar.setBroken(starve);
      lab.explain(starve
        ? 'Every task is a "parent" that must submit a child task to the same pool and wait for it. Press Play.'
        : 'CPU-bound work stops getting faster once the pool matches the core count. I/O-bound work keeps improving with more threads, because waiting threads do not need a core.');
      lab.log.log(TASKS + ' tasks, pool of ' + size + ' worker(s), ' + (starve ? 'parent/child tasks' : (work === 'cpu' ? 'CPU-bound (200 ms CPU)' : 'I/O-bound (20 ms CPU + 180 ms wait)')) + ', runtime ' + (runtime === 'gil' ? 'CPython with GIL' : 'native threads') + ', ' + CORES + ' cores.', { t: 0 });
      sim.schedule(0, function () { st.workers.forEach(function (w) { start(w); }); });
      gantt.draw(0);
      metrics();
    }

    sim.on('tick', function () { gantt.draw(sim.now()); metrics(); });
    sim.on('reset', seed);
    seed();

    var sz = slider('Pool size', 1, 16, size, function (v) { size = v; sim.reset(); });
    var wk = segmented('Work', [['cpu', 'CPU-bound'], ['io', 'I/O-bound']], work, function (v) { work = v; sim.reset(); });
    var rt = segmented('Runtime', [['native', 'Native threads'], ['gil', 'CPython (GIL)']], runtime, function (v) { runtime = v; sim.reset(); });
    var note = UI.callout('warn', 'GIL note', 'In the default CPython build the **Global Interpreter Lock** lets only one thread execute Python bytecode at a time. Choose "CPython (GIL)" and CPU-bound work gets no speed-up from more threads. I/O-bound work still scales because the lock is released while waiting. A free-threaded build removes this limit (experimental in 3.13, officially supported from 3.14, opt-in).').el;
    return wrap([sz, wk, rt], lab, [note]);
  }

  /* ================= PREDICT ================= */

  function predict() {
    return UI.predictChallenge({
      question: 'Two threads each run `counter += 1` one thousand times on the same shared counter, with no lock. What is the final value?',
      setup: 'The counter starts at 0. Both threads start together. Nothing else touches it. After both finish we print the counter.',
      options: ['Exactly 2000, every time', 'Usually less than 2000, and different each run', 'Exactly 1000', 'The program crashes'],
      answer: 1,
      duration: 4500,
      speed: 4,
      explain: 'Each `+= 1` is load, add, store. When threads interleave between the load and the store, one thread overwrites the other\'s update. The total is **usually below 2000 and varies from run to run**, and nothing crashes. Honest caveats: the exact number depends on the language runtime and hardware, and in CPython the GIL can hide the race in short loops by accident, but that is not a guarantee. Never rely on it.',
      simulate: function (ctx) {
        var rnd = Sim.random((Date.now() % 100000) + 1);
        var th = [{ pc: 0, n: 0, reg: 0 }, { pc: 0, n: 0, reg: 0 }];
        var s = { counter: 0, cur: 0 };
        ctx.state = { s: s, th: th };
        var out = h('div', { class: 'shared-box' }, ['counter', h('b', { text: '0' })]);
        var prog = h('p', { class: 'muted', text: 'Thread 1: 0 / 1000    Thread 2: 0 / 1000' });
        ctx.stage.appendChild(h('div', {}, [out, prog]));
        function microStep() {
          if (th[0].n >= 1000 && th[1].n >= 1000) { return false; }
          if (rnd() < 0.05 || th[s.cur].n >= 1000) { s.cur = 1 - s.cur; }
          var t = th[s.cur];
          if (t.n >= 1000) { s.cur = 1 - s.cur; t = th[s.cur]; }
          if (t.pc === 0) { t.reg = s.counter; t.pc = 1; } else if (t.pc === 1) { t.reg++; t.pc = 2; } else { s.counter = t.reg; t.pc = 0; t.n++; }
          return true;
        }
        function tickEv() {
          var more = true;
          for (var i = 0; i < 30 && more; i++) { more = microStep(); }
          out.lastChild.textContent = String(s.counter);
          prog.textContent = 'Thread 1: ' + th[0].n + ' / 1000    Thread 2: ' + th[1].n + ' / 1000';
          if (more) { ctx.sim.schedule(20, tickEv); } else { ctx.log('Both threads finished. Final counter = ' + s.counter + ' (expected 2000).', { t: ctx.sim.now(), level: 'err' }); }
        }
        ctx.sim.schedule(20, tickEv);
      },
      measure: function (ctx) {
        var c = ctx.state.s.counter;
        return 'Final value ' + c + ' (expected 2000): ' + (2000 - c) + ' increments lost.';
      }
    }).el;
  }

  /* ================= CHEAT SHEET + INTERVIEW ================= */

  function cheatSheet() {
    var items = [
      ['Concurrency vs parallelism', 'Concurrency: many tasks in progress (structure). Parallelism: many tasks running at the same instant (needs cores).'],
      ['Process vs thread', 'Process: own memory, strong isolation, costly to create and talk to. Thread: shared memory inside a process, cheap, shares fate.'],
      ['Race condition', 'Result depends on timing. Cure: mutual exclusion (mutex), atomics, or avoid sharing (immutability, message passing).'],
      ['Deadlock', 'Needs all four: mutual exclusion, hold-and-wait, no preemption, circular wait. Prevent by locking in one global order or using timeouts.'],
      ['Producer-consumer', 'Use a **bounded** queue. Full means producers wait (backpressure). Empty means consumers wait.'],
      ['Pool sizing', 'CPU-bound: about cores. I/O-bound: cores x (1 + wait/compute). Always measure. Never block a pool on its own children.'],
      ['Python note', 'CPython has a GIL by default: threads help I/O, not CPU. Use processes for CPU work. Free-threaded builds are opt-in.'],
      ['Debugging tools', 'Thread dumps (jstack, py-spy), Go race detector (-race), ThreadSanitizer, tryLock with timeout, structured logging with thread ids.']
    ];
    return h('div', { class: 'cheat' }, items.map(function (it) {
      return h('div', { class: 'cheat-item' }, [h('h4', { text: it[0] }), UI.rich(it[1])]);
    }));
  }

  function interview() {
    return UI.accordion({ items: [
      { title: 'What is the difference between concurrency and parallelism?', body: '**Concurrency** is about dealing with many things at once: structuring a program so several tasks can make progress in overlapping time, even on one core. **Parallelism** is doing many things at the same instant, which needs multiple cores. A single-core machine can be concurrent but not parallel. Concurrency helps with waiting (I/O), parallelism helps with computing.' },
      { title: 'Process vs thread: when would you choose each?', body: 'A process has its own address space: strong isolation, a crash stays contained, but creation and communication (IPC) cost more. Threads share memory: cheap to create and to share data, but a bug or crash can affect everything and shared state needs synchronisation. Choose processes for isolation, security or to get around the CPython GIL; threads for shared in-memory work and I/O concurrency.' },
      { title: 'What is a race condition? How do you fix one?', body: 'A race condition is when correctness depends on the timing of operations between threads, typically a **check-then-act** or **read-modify-write** on shared state. `counter++` is load, add, store, so two threads can lose an update. Fixes: a mutex around the critical section, an atomic operation, confining state to one thread, immutable data, or message passing. Tools: Go `-race`, ThreadSanitizer, stress tests. Adding `sleep` does not fix it.' },
      { title: 'Explain deadlock and how to prevent it.', body: 'Deadlock: threads wait for each other forever. It requires all four **Coffman conditions**: mutual exclusion, hold-and-wait, no preemption, circular wait. Break one. In practice: acquire locks in a **global order** (breaks circular wait), take all locks at once or none, use `tryLock` with a timeout, hold locks for the shortest time, and never call unknown code while holding a lock. Detect with thread dumps or a wait-for graph.' },
      { title: 'Mutex vs semaphore vs atomic?', body: 'A **mutex** allows one owner at a time and is released by that owner. A **semaphore** counts permits (N at a time), useful for limiting concurrency such as connection slots, and need not be released by the same thread. An **atomic** makes one small operation (increment, compare-and-swap) indivisible without a lock. Atomics cover single variables; anything spanning several variables still needs a lock.' },
      { title: 'How would you size a thread pool?', body: 'Separate by workload. **CPU-bound**: about the number of cores (cores + 1 at most), since more threads just add context switches. **I/O-bound**: cores x (1 + wait time / compute time), capped by downstream capacity such as database connection limits. Use separate pools for different workloads so one slow dependency cannot starve everything. Then load-test, because real wait ratios vary. Use bounded queues and a sensible rejection policy.' },
      { title: 'What is the GIL and does it make Python threads useless?', body: 'The Global Interpreter Lock in default CPython lets only one thread run Python bytecode at a time. Threads still help for **I/O-bound** work, because the lock is released while waiting. They do not speed up pure-Python CPU work: use `multiprocessing`, `concurrent.futures.ProcessPoolExecutor`, native extensions (NumPy releases the GIL), or the opt-in free-threaded build (experimental in 3.13, officially supported from 3.14).' },
      { title: 'Is `volatile` enough to make a counter thread-safe?', body: 'No. In Java, `volatile` guarantees **visibility** and ordering (a write is seen by later reads) but not **atomicity**: `count++` is still three steps. Use `AtomicInteger`, `LongAdder` for heavy contention, or a lock. `volatile` suits a simple flag written by one thread and read by others.' },
      { title: 'Why use a bounded queue between producers and consumers?', body: 'An unbounded queue hides a speed mismatch until memory runs out, and everything queued is lost in the crash. A bounded queue gives **backpressure**: when full, producers block, are rejected, or slow down, so the system runs at the pace of the slowest stage. You must then decide what a full queue means: wait, drop, or fail fast. Alert on queue depth and age.' }
    ] }).el;
  }

  /* ================= MOUNT ================= */

  function mount(el) {
    var intro = h('div', { class: 'topic-intro' }, [
      h('p', { class: 'lead', text: 'How do programs do many things at once, and what goes wrong when they do? You will see it, break it, and fix it.' })
    ]);
    el.appendChild(intro);
    el.appendChild(storyBlock());
    el.appendChild(title('Learn it at your level', 'Start at Beginner. Each level adds depth and real production scars.'));
    el.appendChild(levelTabs());

    el.appendChild(title('Lab 1 \u00B7 Concurrency vs parallelism'));
    el.appendChild(labParallel());
    el.appendChild(title('Lab 2 \u00B7 Process vs thread memory'));
    el.appendChild(labMemory());
    el.appendChild(title('Lab 3 \u00B7 Race condition'));
    el.appendChild(labRace());
    el.appendChild(title('Lab 4 \u00B7 Deadlock: dining philosophers'));
    el.appendChild(labPhilosophers());
    el.appendChild(title('Lab 5 \u00B7 Producer-consumer with a bounded buffer'));
    el.appendChild(labBuffer());
    el.appendChild(title('Lab 6 \u00B7 Thread pool sizing'));
    el.appendChild(labPool());

    el.appendChild(title('Predict the outcome'));
    el.appendChild(predict());

    el.appendChild(title('Quiz', '5 questions. Score 70% or more to complete this topic.'));
    el.appendChild(UI.quiz({ title: 'Concurrency quiz', topicId: 'concurrency', questions: (global.QUIZZES && global.QUIZZES.concurrency) || [], passPct: 70 }).el);

    el.appendChild(title('Cheat sheet'));
    el.appendChild(cheatSheet());
    el.appendChild(title('Interview questions', 'Try answering out loud before opening each one.'));
    el.appendChild(interview());
  }

  global.App.registerTopic({ id: 'concurrency', title: 'Multithreading & Concurrency', accent: 'concurrency', mount: mount });
})(window);
