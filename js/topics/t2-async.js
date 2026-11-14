/*
 * t2-async.js - Topic 2: Asynchronous Programming.
 * Story, level tabs, seven labs, decision helper, predict challenge, quiz, cheat sheet and interview questions.
 * Follows the frozen contract: Sim.create, UI.lab/controlBar/logPanel/metrics, App.registerTopic.
 */
(function (global) {
  'use strict';

  var UI = global.UI;
  var Sim = global.Sim;
  var h = UI.h;
  var uid = 0;

  /* ================= small shared helpers ================= */

  function segmented(label, options, initial, onChange) {
    var name = 't2seg' + (++uid);
    var val = initial;
    var inputs = {};
    var root = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label });
    options.forEach(function (o) {
      var inp = h('input', { type: 'radio', name: name, value: o[0] });
      if (o[0] === initial) { inp.checked = true; }
      inputs[o[0]] = inp;
      inp.addEventListener('change', function () { if (inp.checked) { val = o[0]; onChange(val); } });
      root.appendChild(h('label', { class: 'seg' }, [inp, h('span', { text: o[1] })]));
    });
    return {
      el: h('div', { class: 'ctl' }, [h('span', { text: label }), root]),
      get: function () { return val; },
      set: function (v) { val = v; if (inputs[v]) { inputs[v].checked = true; } }
    };
  }

  function checkbox(label, checked, onChange) {
    var id = 't2cb' + (++uid);
    var inp = h('input', { type: 'checkbox', id: id });
    inp.checked = !!checked;
    inp.addEventListener('change', function () { onChange(inp.checked); });
    return { el: h('label', { class: 'ctl', for: id }, [inp, h('span', { text: label })]), get: function () { return inp.checked; }, set: function (v) { inp.checked = !!v; } };
  }

  function wrap(controls, lab, extra) {
    var kids = [];
    if (controls.length) { kids.push(h('div', { class: 'lab-controls', role: 'group', 'aria-label': 'Lab settings' }, controls.map(function (c) { return c.el; }))); }
    kids.push(lab.el);
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

  function arrow() { return h('span', { class: 'arrow', 'aria-hidden': 'true', text: '\u2192' }); }

  /* DOM timeline: rows of bars positioned by percentage; redrawn on every sim tick (no own animation loop). */
  function makeTimeline(o) {
    var base = o.base;
    var shownMax = -1;
    var bars = [];
    var marks = [];
    var tracks = [];
    var rowsBox = h('div');
    var axis = h('div', { class: 'tl-axis', 'aria-hidden': 'true' });
    var over = h('div', { class: 'tl-over', 'aria-hidden': 'true' });
    var box = h('div', { class: 'tl', role: 'img', 'aria-label': o.label }, [rowsBox, axis, over]);

    function clear() {
      bars.forEach(function (b) { b.el.remove(); });
      marks.forEach(function (m) { m.el.remove(); });
      bars = []; marks = []; shownMax = -1;
    }
    function setRows(labels) {
      rowsBox.innerHTML = '';
      tracks = [];
      labels.forEach(function (l) {
        var tr = h('div', { class: 'tl-track' });
        tracks.push(tr);
        rowsBox.appendChild(h('div', { class: 'tl-row' }, [h('span', { class: 'tl-label', text: l }), tr]));
      });
      clear();
    }
    function add(row, start, end, cls, label) {
      var b = { el: h('div', { class: 'tl-bar' }), start: start, end: end, cls: cls, label: label || '' };
      tracks[row].appendChild(b.el);
      bars.push(b);
      return b;
    }
    function mark(t, label, cls) {
      var m = { t: t, cls: cls || '', el: h('div', { class: 'tl-mark' }, [h('span', { text: label })]) };
      over.appendChild(m.el);
      marks.push(m);
      return m;
    }
    function draw(now) {
      var max = Math.max(base, Math.ceil(now / 500) * 500);
      if (max !== shownMax) {
        axis.innerHTML = '';
        var step = max <= 3000 ? 500 : 1000;
        for (var t = 0; t <= max; t += step) {
          var s = h('span', { text: (t / 1000) + 's' });
          s.style.left = (t / max * 100) + '%';
          axis.appendChild(s);
        }
        shownMax = max;
      }
      bars.forEach(function (b) {
        if (b.start >= now && now > 0) { b.el.style.display = 'none'; return; }
        var e = Math.min(b.end, now);
        b.el.style.display = '';
        b.el.style.left = (b.start / max * 100) + '%';
        b.el.style.width = Math.max(0.4, (e - b.start) / max * 100) + '%';
        b.el.className = 'tl-bar ' + b.cls;
        if (b.el.textContent !== b.label) { b.el.textContent = b.label; }
      });
      marks.forEach(function (m) {
        m.el.style.left = (m.t / max * 100) + '%';
        m.el.className = 'tl-mark ' + m.cls;
      });
    }
    return { el: box, setRows: setRows, clear: clear, add: add, mark: mark, draw: draw };
  }

  /* Column chart with stacked segments. */
  var BARH = 124;
  function makeBars(n, o) {
    var cols = [];
    var line = h('div', { class: 'bars-line' }, [h('span', { text: o.lineLabel || '' })]);
    var box = h('div', { class: 'bars', role: 'img', 'aria-label': o.label }, [line]);
    for (var i = 0; i < n; i++) {
      var col = h('div', { class: 'bars-col' + (o.down && i < o.down ? ' down' : '') });
      var segs = o.segs.map(function (cls) { var s = h('i', { class: cls }); col.appendChild(s); return s; });
      cols.push(segs);
      box.appendChild(col);
    }
    return {
      el: box,
      set: function (i, vals, scale) { for (var k = 0; k < cols[i].length; k++) { cols[i][k].style.height = ((vals[k] || 0) / scale * BARH) + 'px'; } },
      setLine: function (v, scale) { line.style.bottom = (v / scale * BARH) + 'px'; line.style.display = v > 0 ? '' : 'none'; }
    };
  }

  /* ================= THE STORY ================= */

  function storyBlock() {
    var scene = h('div', { class: 'astory', 'data-mode': 'block' }, [
      h('div', { class: 'astage', role: 'img', 'aria-label': 'Animated coffee shop: one barista either stands at one machine waiting, or starts three machines and hops between them' }, [
        h('div', { class: 'am' }, [h('i'), h('span', { text: 'Machine 1' })]),
        h('div', { class: 'am' }, [h('i'), h('span', { text: 'Machine 2' })]),
        h('div', { class: 'am' }, [h('i'), h('span', { text: 'Machine 3' })]),
        h('div', { class: 'abar', text: 'You' })
      ])
    ]);
    var cap = h('p', { class: 'muted', 'aria-live': 'polite', text: 'Blocking: you start Machine 1 and stand there staring at it. Machines 2 and 3 sit idle and customers queue up.' });
    var seg = segmented('Barista style', [['block', 'Stand and wait (blocking)'], ['free', 'Start and move on (async)']], 'block', function (v) {
      scene.setAttribute('data-mode', v);
      cap.textContent = v === 'block'
        ? 'Blocking: you start Machine 1 and stand there staring at it. Machines 2 and 3 sit idle and customers queue up.'
        : 'Async: you start a machine, leave a ticket ("tell me when it is done") and move to the next. Three drinks brew at once with ONE barista.';
    });
    UI.onVisible(scene, function () { scene.classList.remove('is-paused'); }, function () { scene.classList.add('is-paused'); });
    var stepper = UI.stepper({
      steps: [
        { title: '0:00 A barista and a slow machine', body: 'You run a coffee shop alone. The espresso machine needs **2.5 seconds** per drink and does the work by itself. The question is what **you** do during those 2.5 seconds.' },
        { title: '0:15 The blocking way', body: 'You stand at the machine and wait. This is **blocking**: your one worker is stuck doing nothing useful. Customers pile up even though the machines (and you) are mostly idle.' },
        { title: '0:30 The async way', body: 'You press start, put a **ticket** on the machine ("call me when done"), and take the next order. When a machine beeps, you collect the drink. This is **asynchronous, non-blocking** work: you never wait for slow things, you react when they finish.' },
        { title: '0:45 Still one barista', body: 'Nothing here is parallel. There is only **one** of you. Async is not more workers; it is not wasting the worker you have while things are slow. That is why it suits I/O-heavy programs: web servers, API calls, database queries.' },
        { title: '0:55 The catch', body: 'If you decide to hand-grind beans for 5 seconds, you **cannot** answer any beeping machine or take any order. One slow, blocking task freezes the whole shop. That is the number-one async bug in production, and Lab 1 lets you cause it.' }
      ]
    });
    return h('div', { class: 'card' }, [
      h('div', { class: 'card-title' }, [h('h3', { text: 'The Story: the barista who never waits' })]),
      h('div', { class: 'lab-controls' }, [seg.el]), scene, cap, stepper.el
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

  var JS_PAR = "// Sequential: total time = a + b + c\nconst a = await fetchA();\nconst b = await fetchB();\nconst c = await fetchC();\n\n// Concurrent: total time = the slowest one\nconst [a2, b2, c2] = await Promise.all([fetchA(), fetchB(), fetchC()]);\n\n// Concurrent with a limit: N workers pull from one shared index\nasync function mapLimit(items, limit, fn) {\n  const results = new Array(items.length);\n  let next = 0;\n  async function worker() {\n    while (next < items.length) {\n      const i = next++;              // no await between read and increment, so it is safe\n      results[i] = await fn(items[i]);\n    }\n  }\n  await Promise.all(Array.from({ length: limit }, worker));\n  return results;\n}";
  var PY_PAR = "import asyncio\n\nasync def main():\n    # concurrent: total time = the slowest call\n    a, b, c = await asyncio.gather(fetch_a(), fetch_b(), fetch_c())\n\n    # bounded concurrency\n    sem = asyncio.Semaphore(20)\n    async def guarded(url):\n        async with sem:\n            return await fetch(url)\n    pages = await asyncio.gather(*(guarded(u) for u in urls))\n\n    # structured concurrency plus a deadline (Python 3.11+)\n    async with asyncio.timeout(5):\n        async with asyncio.TaskGroup() as tg:\n            t1 = tg.create_task(fetch_a())\n            t2 = tg.create_task(fetch_b())\n    print(t1.result(), t2.result())\n\nasyncio.run(main())";
  var JS_RETRY = "async function withRetry(fn, { retries = 5, base = 200, cap = 5000 } = {}) {\n  for (let attempt = 0; ; attempt++) {\n    try {\n      return await fn(AbortSignal.timeout(2000));   // per-attempt deadline\n    } catch (err) {\n      if (attempt >= retries || !isRetryable(err)) throw err;\n      const ceiling = Math.min(cap, base * 2 ** attempt);\n      const delay = Math.random() * ceiling;          // full jitter\n      await new Promise(r => setTimeout(r, delay));\n    }\n  }\n}\n// Only retry idempotent calls, or send an idempotency key with the request.";
  var PY_RETRY = "import asyncio, random\n\nasync def with_retry(fn, retries=5, base=0.2, cap=5.0):\n    for attempt in range(retries + 1):\n        try:\n            async with asyncio.timeout(2):          # per-attempt deadline (3.11+)\n                return await fn()\n        except (TimeoutError, ConnectionError):\n            if attempt == retries:\n                raise\n            ceiling = min(cap, base * 2 ** attempt)\n            await asyncio.sleep(random.uniform(0, ceiling))   # full jitter";

  function levelTabs() {
    var parBox = UI.codePanel({ title: 'Sequential vs concurrent awaits', tabs: [
      { lang: 'javascript', label: 'JavaScript', code: JS_PAR },
      { lang: 'python', label: 'Python asyncio', code: PY_PAR }
    ] });
    var retryBox = UI.codePanel({ title: 'Retry with backoff, jitter and a per-attempt timeout', tabs: [
      { lang: 'javascript', label: 'JavaScript', code: JS_RETRY },
      { lang: 'python', label: 'Python asyncio', code: PY_RETRY }
    ] });

    return UI.tabs({
      label: 'Asynchronous programming at three levels',
      tabs: [
        { id: 'beginner', label: 'Beginner', content: function () {
          return levelPane(
            '**Synchronous** (blocking) code does one step at a time and waits for each step to finish. **Asynchronous** (non-blocking) code starts a slow step, then carries on with other work and deals with the result when it arrives.\n\nMost slow things in programs are **waiting**, not calculating: waiting for a website, a database or a file. While waiting, the CPU has nothing to do. Async lets one worker use that idle time for other tasks.\n\nYou will meet three styles for "tell me when it is done": a **callback** (a function you hand over), a **promise** (an object that stands for a future result), and **async/await** (syntax that makes promise code read top to bottom).',
            'A waiter who takes your order, hands the ticket to the kitchen, and serves other tables until the kitchen rings the bell. The blocking waiter stands at the kitchen door until your soup is ready.',
            '- "Async makes my code faster". One task takes just as long. Async lets you **do other things** during the wait.\n- "Async means multithreading". Usually it means **one** thread that never sits idle.\n- "`await` freezes my program". It pauses only **that function**; everything else keeps running.\n- "Async code runs in parallel". Overlapping waits, yes. Overlapping calculations, no.',
            'One handler does heavy calculation or a blocking call (a synchronous file read, a big JSON parse, a CPU loop) and every other user of the same process freezes, because there is only one thread doing everything.'
          );
        } },
        { id: 'intermediate', label: 'Intermediate', content: function () {
          return levelPane(
            'A **Promise** is in one of three states: **pending**, **fulfilled** (with a value) or **rejected** (with an error). `then` attaches a continuation, `catch` handles a rejection, `finally` always runs. `async` functions always return a promise, and `await` unwraps one, turning a rejection into a thrown exception you can `try/catch`.\n\nThe **event loop** runs your code. It executes the current script to the end, then **all microtasks** (promise callbacks, `await` continuations), then picks **one macrotask** (a timer, an I/O callback, a UI event), runs microtasks again, and repeats. That is why `Promise.then` beats `setTimeout(..., 0)`.\n\nCombinators: `Promise.all` (all fulfil, or the first rejection), `Promise.allSettled` (wait for everything, never rejects), `Promise.race` (first to settle wins), `Promise.any` (first to **fulfil**; rejects only if all reject). Sequential `await` adds up times; starting work first and awaiting later overlaps them.',
            'A to-do list with sticky notes. Microtasks are notes stuck to the top of your monitor: you must clear them before anything else. Macrotasks are the pile in your inbox: you take one, finish it, clear the monitor notes, then take the next.',
            '- `await` inside a `for` loop runs requests one after another when they could overlap.\n- Using `array.forEach(async ...)`: it does not wait for the callbacks. Use `for...of` or `Promise.all(map(...))`.\n- Forgetting `await` or `return`: the promise floats away and its errors become **unhandled rejections**.\n- Believing `Promise.all` cancels the losers. It does not; they keep running.\n- `try/catch` around a call that is not awaited catches nothing.',
            '`Promise.all` over thousands of items starts them all at once. You exhaust sockets, memory or an API rate limit, and the failure looks random. Bound concurrency instead.',
            parBox.el
          );
        } },
        { id: 'advanced', label: 'Advanced', content: function () {
          return levelPane(
            '**Event-loop internals.** Node.js runs phases (timers, pending callbacks, poll for I/O, check for `setImmediate`, close callbacks). Between callbacks it drains `process.nextTick` first and then promise microtasks. A microtask that keeps queueing microtasks can **starve** timers and I/O forever. Browsers have a similar model with rendering steps between macrotasks, so long tasks make the page janky.\n\n**Cancellation is cooperative.** You cannot kill a promise. Pass an `AbortSignal` (JavaScript) or rely on `CancelledError` (Python asyncio) and make the work check it. Cancelling the client does not stop the server unless the server also honours it.\n\n**Deadlines and timeouts at every hop.** Every network call needs a timeout; propagate a total deadline so downstream calls do not outlive the caller.\n\n**Retries.** Use exponential backoff with **jitter**, a cap, a maximum attempt count, retry only errors that are retryable and operations that are **idempotent**. Beware **retry amplification**: three layers that each retry three times can turn one request into 27 under failure. Use retry budgets and a **circuit breaker**.\n\n**Backpressure.** Producers must slow down when consumers cannot keep up: bounded buffers, pausing streams (`highWaterMark`, `pipeline`), or load shedding. An unbounded in-memory queue just moves the failure into an out-of-memory crash.\n\n**Structured concurrency** (Python `TaskGroup`, Kotlin coroutines, Java structured concurrency) ties child tasks to a scope so errors and cancellation propagate and nothing leaks.',
            'A relay of postal workers on one road. Nobody can overtake, so one parked truck (a blocking call) stops everything behind it. Timeouts are "give up after an hour", jitter is "do not all knock on the depot door at 9:00 sharp", and backpressure is the depot telling senders to stop sending boxes.',
            '- Assuming async needs no limits. Without bounded concurrency and queues you only move the overload to a different place.\n- Retrying everything, including non-idempotent writes such as "charge the card".\n- Adding `setTimeout` to "fix" ordering bugs.\n- Wrapping blocking libraries in `async` functions. The function is still blocking.\n- Treating `Promise.race` with a timer as cancellation. The slow work continues in the background.',
            '- **Event-loop blocking**: a regex with catastrophic backtracking (ReDoS), a synchronous `JSON.parse` of a huge body, or `fs.readFileSync` in a request path. Watch **event-loop delay** (Node `perf_hooks.monitorEventLoopDelay`, Python asyncio debug mode `slow_callback_duration`).\n- **Retry storms** after an outage, when every client retries in lockstep (Lab 5).\n- **Stale responses**: an older slow request overwrites the newest result because nothing was cancelled (Lab 6).\n- **Unhandled rejections** crashing a Node process (default since Node 15) or silently vanishing in other runtimes.\n- **Unbounded buffering** between a fast source and a slow sink (Lab 7).',
            retryBox.el
          );
        } }
      ]
    }).el;
  }

  /* ================= LAB 1: blocking vs non-blocking coffee shop ================= */

  function labCoffee() {
    var ARR = 900, TAKE = 300, BREW = 2500, SERVE = 200, PATIENCE = 8000, SPECIAL = 5000, MACH = 3;
    var sim = Sim.create({ speed: 1 });
    var mode = 'free';
    var pendingSpecial = false;
    var st;

    var lineBox = h('div', { class: 'slots', role: 'img' });
    var barNode = h('div', { class: 'node' });
    var machBox = h('div', { class: 'flow' });
    var tally = h('p', { class: 'cf-note' });
    var stage = h('div', { class: 'cf' }, [
      h('div', { class: 'cf-row' }, [h('div', { class: 'node' }, ['Line', h('small', { text: 'customers' })]), lineBox, arrow(), barNode, arrow(), machBox]),
      tally
    ]);

    var lab = UI.lab({
      title: 'Lab 1: blocking vs non-blocking coffee shop',
      subtitle: 'One barista, a customer every 0.9 s, and drinks that take 2.5 s. Compare standing and waiting with starting and moving on.',
      sim: sim,
      stage: stage,
      stageLabel: 'Coffee shop: customer line, barista and espresso machines',
      breakLabel: 'Break it: hand-grind a special (5 s blocking task)',
      fixLabel: 'Fix it: cancel the special order',
      autoPlayOnBreak: false,
      onBreak: function (broken) {
        pendingSpecial = broken;
        if (broken) {
          lab.log.log('The next customer will ask for a hand-ground special that needs 5 s of the barista\'s own, non-delegable time.', { t: sim.now(), level: 'warn' });
          lab.explain(mode === 'free'
            ? '**Blocking the event loop.** The shop is non-blocking, but one task that needs the barista for 5 seconds freezes everything: finished drinks sit on the counter, new orders go unheard, and customers start walking out. One synchronous, CPU-heavy callback does the same to a Node.js or asyncio server.'
            : 'In the blocking shop everyone was already queuing behind a barista who waits at the machine, so the special just makes a slow shop slower. Switch to "Start and move on" and break it again to see how async designs are fragile in a different way.');
        } else {
          lab.log.log('Special order cancelled.', { t: sim.now(), level: 'ok' });
        }
      },
      caption: 'Pick a style, press Play and watch the line.'
    });

    function freeMachine() {
      for (var i = 0; i < st.mach.length; i++) { if (!st.mach[i].busy) { return i; } }
      return -1;
    }

    function render() {
      lineBox.innerHTML = '';
      if (!st.line.length) { lineBox.appendChild(h('span', { class: 'slots-empty', text: 'nobody waiting' })); }
      for (var i = 0; i < Math.min(st.line.length, 24); i++) { lineBox.appendChild(h('span', { class: 'slot' })); }
      if (st.line.length > 24) { lineBox.appendChild(h('span', { class: 'slots-empty', text: '+' + (st.line.length - 24) })); }
      lineBox.setAttribute('aria-label', st.line.length + ' customers waiting');
      barNode.className = 'node' + (st.stuck ? ' is-dead' : (st.busy ? ' is-busy' : ''));
      barNode.innerHTML = '';
      barNode.appendChild(document.createTextNode('Barista'));
      barNode.appendChild(h('small', { text: st.bState }));
      machBox.innerHTML = '';
      st.mach.forEach(function (m, i) {
        machBox.appendChild(h('div', { class: 'node' + (m.busy ? ' is-busy' : '') }, ['Machine ' + (i + 1), h('small', { text: m.busy ? 'brewing' : 'free' })]));
      });
      tally.textContent = 'Served ' + st.served + '  |  Walked out ' + st.walked + '  |  Drinks ready, waiting for the barista: ' + st.ready.length;
      var secs = sim.now() / 1000;
      lab.metrics.set('throughput', secs > 0 ? st.served / secs : 0);
      lab.metrics.set('latency', st.served ? Math.round(st.waitSum / st.served) : NaN);
      lab.metrics.set('depth', st.line.length);
      lab.metrics.set('errors', st.walked);
    }

    function served(c) {
      st.served++;
      var wait = sim.now() - c.t0;
      st.waitSum += wait;
      lab.log.log('Customer #' + c.id + ' served (total wait ' + Math.round(wait) + ' ms).', { t: sim.now(), level: 'ok' });
    }

    function takeOrder(c) {
      st.busy = true;
      st.bState = 'Taking order #' + c.id;
      render();
      sim.schedule(TAKE, function () {
        if (mode === 'block') {
          st.bState = 'Standing at the machine, waiting (blocked)';
          st.mach[0].busy = true;
          lab.log.log('Barista starts the machine for #' + c.id + ' and stands there until it finishes.', { t: sim.now() });
          render();
          sim.schedule(BREW, function () {
            st.mach[0].busy = false;
            st.bState = 'Serving #' + c.id;
            render();
            sim.schedule(SERVE, function () { st.busy = false; st.bState = 'Free'; served(c); work(); render(); });
          });
        } else {
          var mi = freeMachine();
          st.mach[mi].busy = true;
          st.busy = false;
          st.bState = 'Free (free to do other things)';
          lab.log.log('Barista starts machine ' + (mi + 1) + ' for #' + c.id + ' and moves on.', { t: sim.now() });
          sim.schedule(BREW, function () {
            st.mach[mi].busy = false;
            st.ready.push(c);
            lab.log.log('Machine ' + (mi + 1) + ' beeps: drink #' + c.id + ' is ready' + (st.busy ? ' but the barista is busy' : '') + '.', { t: sim.now(), level: st.busy ? 'warn' : 'info' });
            work(); render();
          });
          work(); render();
        }
      });
    }

    function work() {
      if (st.busy) { return; }
      if (mode === 'free' && st.ready.length) {
        var d = st.ready.shift();
        st.busy = true;
        st.bState = 'Serving #' + d.id;
        sim.schedule(SERVE, function () { st.busy = false; st.bState = 'Free'; served(d); work(); render(); });
        return;
      }
      if (!st.line.length) { return; }
      if (mode === 'free' && freeMachine() < 0) { return; }
      var c = st.line.shift();
      c.picked = true;
      if (pendingSpecial) {
        pendingSpecial = false;
        st.busy = true; st.stuck = true;
        st.bState = 'Hand-grinding beans: BLOCKED';
        lab.log.log('Customer #' + c.id + ' wants a hand-ground special. The barista grinds for 5 s and cannot respond to anything.', { t: sim.now(), level: 'err' });
        render();
        sim.schedule(SPECIAL, function () {
          st.busy = false; st.stuck = false;
          lab.bar.setBroken(false);
          lab.log.log('Grinding finished. The barista can listen again.', { t: sim.now(), level: 'warn' });
          takeOrder(c);
        });
        return;
      }
      takeOrder(c);
    }

    function arrive() {
      var c = { id: ++st.id, t0: sim.now(), picked: false };
      st.line.push(c);
      lab.log.log('Customer #' + c.id + ' joins the line.', { t: sim.now() });
      sim.schedule(PATIENCE, function () {
        if (c.picked) { return; }
        var i = st.line.indexOf(c);
        if (i >= 0) { st.line.splice(i, 1); st.walked++; lab.log.log('Customer #' + c.id + ' gives up after 8 s and walks out.', { t: sim.now(), level: 'err' }); render(); }
      });
      work(); render();
      sim.schedule(ARR, arrive);
    }

    function seed() {
      st = { line: [], ready: [], mach: [], busy: false, stuck: false, bState: 'Free', served: 0, walked: 0, waitSum: 0, id: 0 };
      var n = mode === 'free' ? MACH : 1;
      for (var i = 0; i < n; i++) { st.mach.push({ busy: false }); }
      pendingSpecial = false;
      lab.bar.setBroken(false);
      lab.log.clear();
      lab.metrics.reset();
      lab.explain(mode === 'free'
        ? 'Non-blocking: the barista starts a machine and moves on. Three machines brew at once, so one worker keeps up with a customer every 0.9 s (about 1.2 drinks per second is the ceiling). Press Break it to see what one blocking task does.'
        : 'Blocking: the barista stands at the single machine for the whole 2.8 s. Customers arrive faster than that, so the line grows and people walk out. Switch to "Start and move on" to compare.');
      lab.log.log((mode === 'free' ? 'Non-blocking shop (3 machines, 1 barista)' : 'Blocking shop (barista waits at the machine)') + '. Press Play.', { t: 0 });
      sim.schedule(100, arrive);
      render();
    }

    sim.on('reset', seed);
    seed();
    var seg = segmented('Barista style', [['block', 'Stand and wait (blocking)'], ['free', 'Start and move on (non-blocking)']], mode, function (v) { mode = v; sim.reset(); });
    return wrap([seg], lab);
  }

  /* ================= LAB 2: event loop visualizer ================= */

  function L(v, ln) { return { k: 'log', v: v, ln: ln }; }
  function T(ms, ln, body, label) { return { k: 'timer', ms: ms, ln: ln, body: body, label: label || 'setTimeout ' + ms + 'ms' }; }
  function M(ln, body, label) { return { k: 'micro', ln: ln, body: body, label: label || '.then callback' }; }
  function B(ms, ln) { return { k: 'block', ms: ms, ln: ln }; }

  var PRESETS = {
    basic: {
      label: 'Timer vs promise',
      lines: ["console.log('A');", "setTimeout(() => console.log('B'), 0);", "Promise.resolve().then(() => console.log('C'));", "console.log('D');"],
      prog: [L('A', 0), T(0, 1, [L('B', 1)]), M(2, [L('C', 2)]), L('D', 3)],
      explain: 'Output **A D C B**. Synchronous code (A, D) runs to the end first. The timer is handed to the Web API; its callback must wait in the macrotask queue. The promise callback goes into the microtask queue, which is drained completely **before** the next macrotask, so C beats B even though the timer delay is 0.'
    },
    nested: {
      label: 'Microtasks inside microtasks',
      lines: ["setTimeout(() => console.log('timer'), 0);", "Promise.resolve().then(() => {", "  console.log('micro 1');", "  Promise.resolve().then(() => console.log('micro 2'));", "});", "console.log('sync');"],
      prog: [T(0, 0, [L('timer', 0)]), M(1, [L('micro 1', 2), M(3, [L('micro 2', 3)])]), L('sync', 5)],
      explain: 'Output **sync, micro 1, micro 2, timer**. A microtask queued by another microtask joins the same queue and runs before the loop moves on, so the queue drains **completely**. This is also why an endless chain of microtasks can starve timers and I/O.'
    },
    async: {
      label: 'async / await',
      lines: ["async function f() {", "  console.log('f start');", "  await null;", "  console.log('f after await');", "}", "console.log('script start');", "f();", "setTimeout(() => console.log('timeout'), 0);", "console.log('script end');"],
      prog: [L('script start', 5), L('f start', 1), M(2, [L('f after await', 3)], 'await continuation'), T(0, 7, [L('timeout', 7)]), L('script end', 8)],
      explain: 'Output **script start, f start, script end, f after await, timeout**. An async function runs synchronously until its first `await`. The rest of the function becomes a **microtask continuation**, so the caller continues first (script end), then the continuation runs, and only then the timer.'
    },
    timers: {
      label: 'Racing timers',
      lines: ["setTimeout(() => console.log('50ms'), 50);", "setTimeout(() => console.log('0ms'), 0);", "setTimeout(() => {", "  console.log('20ms');", "  setTimeout(() => console.log('20+0'), 0);", "}, 20);", "console.log('main');"],
      prog: [T(50, 0, [L('50ms', 0)]), T(0, 1, [L('0ms', 1)]), T(20, 2, [L('20ms', 3), T(0, 4, [L('20+0', 4)])]), L('main', 6)],
      explain: 'Output **main, 0ms, 20ms, 20+0, 50ms**. Timers fire in order of their due time, not the order you wrote them. A timer created inside a callback is due relative to *then*, so `20+0` (due at about 21 ms) still beats the 50 ms timer. Delays are also a minimum: the callback runs when the loop is free.'
    },
    block: {
      label: 'Blocking the loop',
      lines: ["const start = Date.now();", "setTimeout(() => console.log('timer (wanted 10 ms)'), 10);", "for (let i = 0; i < 5e9; i++) {} // about 3 s of CPU", "console.log('loop finished');"],
      prog: [T(10, 1, [L('timer (wanted 10 ms)', 1)]), B(3000, 2), L('loop finished', 3)],
      explain: 'Output **loop finished, timer**. The timer was due after 10 ms but the stack was busy with a synchronous loop, so it ran about **3 seconds late**. In a server, every request, health check and timer in that process waits too. Fixes: do the work in a worker thread or another process, or slice it into small chunks.'
    }
  };
  var PRESET_ORDER = ['basic', 'nested', 'async', 'timers', 'block'];

  /* A tiny model of the event loop that runs the preset programs one visible step at a time. */
  function makeLoop(prog) {
    var lt = 0, seq = 0;
    var S = { stack: [], apis: [], micro: [], macro: [{ name: 'script (main)', stmts: prog }], out: [], done: false, ran: 0, late: 0, lateEvents: 0, ln: -1, lt: 0 };

    function startFrame(t) { S.stack.push({ name: t.name, stmts: t.stmts, i: 0 }); S.ran++; }

    S.step = function () {
      var msg = '';
      var due = S.apis.filter(function (a) { return a.at <= lt; }).sort(function (a, b) { return a.at - b.at || a.seq - b.seq; });
      due.forEach(function (a) {
        S.apis.splice(S.apis.indexOf(a), 1);
        S.macro.push({ name: a.label + ' callback', stmts: a.body, due: a.at });
        msg += a.label + ' finished in the Web API: its callback moves to the macrotask queue. ';
      });
      S.ln = -1;
      if (S.stack.length) {
        var f = S.stack[S.stack.length - 1];
        if (f.i >= f.stmts.length) { S.stack.pop(); S.lt = lt; return msg + '"' + f.name + '" returns and pops off the call stack.'; }
        var s = f.stmts[f.i++];
        S.ln = s.ln;
        lt += 1;
        if (s.k === 'log') { S.out.push(s.v); msg += 'console.log prints "' + s.v + '".'; }
        else if (s.k === 'timer') { S.apis.push({ label: s.label, at: lt + s.ms, seq: ++seq, body: s.body }); msg += s.label + ' is handed to the Web API (the browser timer). The stack keeps going.'; }
        else if (s.k === 'micro') { S.micro.push({ name: s.label, stmts: s.body }); msg += 'A ' + s.label + ' is queued in the microtask queue.'; }
        else if (s.k === 'block') { lt += s.ms; msg += 'A synchronous loop holds the call stack for ' + s.ms + ' ms. Nothing else can run.'; }
        S.lt = lt;
        return msg;
      }
      if (S.micro.length) {
        var m = S.micro.shift();
        startFrame(m);
        S.lt = lt;
        return msg + 'Stack is empty, so the event loop takes from the MICROTASK queue first: "' + m.name + '".';
      }
      if (S.macro.length) {
        var t = S.macro.shift();
        if (t.due !== undefined) {
          S.late = Math.max(0, lt - t.due);
          if (S.late > 100) { S.lateEvents++; }
        }
        startFrame(t);
        S.lt = lt;
        return msg + 'Microtasks are empty, so the event loop takes the next MACROTASK: "' + t.name + '"' + (t.due !== undefined && S.late > 20 ? ' (it was due ' + S.late + ' ms ago!).' : '.');
      }
      if (S.apis.length) {
        var next = Math.min.apply(null, S.apis.map(function (a) { return a.at; }));
        lt = Math.max(lt, next);
        S.lt = lt;
        return msg + 'Nothing to run. The event loop sleeps until the next timer is due (t = ' + lt + ' ms).';
      }
      S.done = true;
      return msg + 'Stack, microtasks and macrotasks are all empty. The event loop idles.';
    };
    return S;
  }

  function runAll(prog) {
    var lp = makeLoop(prog);
    var n = 0;
    while (!lp.done && n < 500) { lp.step(); n++; }
    return { out: lp.out, steps: n };
  }

  function guessGame(getPreset) {
    var seed = 11;
    var score = { right: 0, tries: 0 };
    var box = h('div', { class: 'card game' });
    var exp, picked, chips, finished;

    function reset() {
      var p = PRESETS[getPreset()];
      exp = runAll(p.prog).out;
      picked = [];
      finished = false;
      var rnd = Sim.random(seed++);
      chips = exp.slice();
      for (var i = chips.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var tmp = chips[i]; chips[i] = chips[j]; chips[j] = tmp; }
      render('');
    }

    function render(msg, ok) {
      box.innerHTML = '';
      box.appendChild(h('div', { class: 'card-title' }, [h('h3', { text: 'Guess the output order' })]));
      box.appendChild(h('p', { text: 'Before you press Play, click the console lines in the order you think they will print for the selected snippet.' }));
      var remaining = h('div', { class: 'chips', role: 'group', 'aria-label': 'Console lines to order' });
      chips.forEach(function (c) {
        if (picked.indexOf(c) !== -1) { return; }
        var b = h('button', { class: 'btn btn-sm', type: 'button', text: c });
        b.disabled = finished;
        b.addEventListener('click', function () { picked.push(c); render(''); });
        remaining.appendChild(b);
      });
      box.appendChild(remaining);
      var ol = h('ol', { 'aria-label': 'Your guess so far' });
      picked.forEach(function (p) { ol.appendChild(h('li', { text: p })); });
      if (picked.length) { box.appendChild(ol); }
      var row = h('div', { class: 'chips' });
      var undo = h('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: 'Undo' });
      undo.disabled = !picked.length || finished;
      undo.addEventListener('click', function () { picked.pop(); render(''); });
      var check = h('button', { class: 'btn btn-sm btn-primary', type: 'button', text: 'Check my guess' });
      check.disabled = picked.length !== exp.length || finished;
      check.addEventListener('click', function () {
        finished = true;
        score.tries++;
        var good = picked.join('|') === exp.join('|');
        if (good) { score.right++; }
        render(good ? 'Correct! Press Play on the lab above to watch the event loop produce exactly that order.' : 'Not quite. The real order is: ' + exp.join(', ') + '. Press Play to watch why.', good);
        UI.toast(good ? 'Correct order' : 'Different order: watch the lab to see why', { type: good ? 'ok' : 'warn' });
      });
      var again = h('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: 'New shuffle' });
      again.addEventListener('click', reset);
      row.appendChild(undo); row.appendChild(check); row.appendChild(again);
      box.appendChild(row);
      if (msg) { box.appendChild(h('p', { class: 'ui-box ' + (ok ? 'good' : 'stale'), role: 'status', text: msg })); }
      box.appendChild(h('p', { class: 'cf-note', text: 'Score this session: ' + score.right + ' / ' + score.tries }));
    }
    reset();
    return { el: box, reset: reset };
  }

  function labLoop() {
    var STEP = 700;
    var sim = Sim.create({ speed: 1 });
    var key = 'basic';
    var lastGood = 'basic';
    var lp;

    var codeEl = h('ol', { class: 'el-code', 'aria-label': 'Code being executed' });
    var stackUl = h('ul'), apiUl = h('ul'), microUl = h('ul'), macroUl = h('ul'), outUl = h('ul');
    function box(name, ul) { return h('div', { class: 'el-box' }, [h('h4', { text: name }), ul]); }
    var stage = h('div', {}, [codeEl, h('div', { class: 'el' }, [box('Call stack', stackUl), box('Web APIs (timers)', apiUl), box('Microtask queue', microUl), box('Macrotask queue', macroUl), box('Console output', outUl)])]);

    var game = guessGame(function () { return key; });

    var lab = UI.lab({
      title: 'Lab 2: the event loop, step by step',
      subtitle: 'Pick a snippet and press Step or Play. Watch code move between the call stack, Web APIs and the two queues.',
      sim: sim,
      stage: stage,
      stageLabel: 'Event loop visualizer: call stack, Web APIs, microtask queue, macrotask queue and console',
      breakLabel: 'Break it: block the loop for 3 s',
      fixLabel: 'Fix it: back to the previous snippet',
      onBreak: function (broken) {
        if (broken) { lastGood = key === 'block' ? lastGood : key; key = 'block'; } else { key = lastGood; }
        presetSeg.set(key);
        sim.reset();
        sim.play();
      },
      caption: 'Pick a snippet, then Play or Step.'
    });

    function fill(ul, items, cls, top) {
      ul.innerHTML = '';
      if (!items.length) { ul.appendChild(h('li', { class: 'el-empty', text: 'empty' })); return; }
      items.forEach(function (t, i) { ul.appendChild(h('li', { class: 'el-item ' + cls + (top && i === 0 ? ' top' : ''), text: t })); });
    }

    function render() {
      var p = PRESETS[key];
      codeEl.innerHTML = '';
      p.lines.forEach(function (ln, i) { codeEl.appendChild(h('li', { class: i === lp.ln ? 'is-now' : '', text: ln })); });
      fill(stackUl, lp.stack.slice().reverse().map(function (f) { return f.name; }), '', true);
      fill(apiUl, lp.apis.map(function (a) { return a.label + ' (due t=' + a.at + ')'; }), 'api');
      fill(microUl, lp.micro.map(function (m) { return m.name; }), 'micro');
      fill(macroUl, lp.macro.map(function (m) { return m.name; }), 'macro');
      fill(outUl, lp.out, '');
      var secs = sim.now() / 1000;
      lab.metrics.set('throughput', secs > 0 ? lp.ran / secs : 0);
      lab.metrics.set('latency', lp.late);
      lab.metrics.set('depth', lp.micro.length + lp.macro.length);
      lab.metrics.set('errors', lp.lateEvents);
    }

    function tick() {
      var msg = lp.step();
      var late = lp.late > 100 && /macrotask/i.test(msg);
      lab.log.log(msg, { t: sim.now(), level: late ? 'err' : (lp.done ? 'ok' : 'info') });
      render();
      if (lp.done) {
        lab.explain(PRESETS[key].explain);
        lab.log.log('Final console order: ' + lp.out.join(', '), { t: sim.now(), level: 'ok' });
        return;
      }
      sim.schedule(STEP, tick);
    }

    function seed() {
      lp = makeLoop(PRESETS[key].prog);
      lab.log.clear();
      lab.metrics.reset();
      lab.bar.setBroken(key === 'block');
      lab.explain('Snippet "' + PRESETS[key].label + '". Predict the output first (the game below), then press Play.');
      lab.log.log('Loaded snippet "' + PRESETS[key].label + '". The whole script runs as the first macrotask.', { t: 0 });
      render();
      sim.schedule(STEP, tick);
      game.reset();
    }

    sim.on('reset', seed);
    var presetSeg = segmented('Snippet', PRESET_ORDER.map(function (k) { return [k, PRESETS[k].label]; }), key, function (v) { key = v; if (v !== 'block') { lastGood = v; } sim.reset(); });
    seed();
    return wrap([presetSeg], lab, [game.el]);
  }

  /* ================= LAB 3: callbacks vs promises vs async/await ================= */

  function labStyles() {
    var COLS = [
      { id: 'cb', title: 'Callbacks', lines: ['getUser(id, (err, user) => {', '  if (err) return handle(err);', '  getOrders(user, (err, orders) => {', '    // forgot: if (err) return handle(err);', '    computeTotal(orders, (err, total) => {', '      show(total);', '    });', '  });', '});'], map: { user: 0, orders: 2, total: 4, done: 5, fail: 3 } },
      { id: 'pr', title: 'Promises', lines: ['getUser(id)', '  .then(user => getOrders(user))', '  .then(orders => computeTotal(orders))', '  .then(total => show(total))', '  .catch(err => showFallback(err));'], map: { user: 0, orders: 1, total: 2, done: 3, fail: 4 } },
      { id: 'aw', title: 'async / await', lines: ['try {', '  const user = await getUser(id);', '  const orders = await getOrders(user);', '  const total = await computeTotal(orders);', '  show(total);', '} catch (err) {', '  showFallback(err);', '}'], map: { user: 1, orders: 2, total: 3, done: 4, fail: 6 } }
    ];
    var sim = Sim.create({ speed: 1 });
    var fail = false;
    var els = {};
    var cols = h('div', { class: 'cols3' });
    COLS.forEach(function (c) {
      var pre = h('pre', { 'aria-label': c.title + ' code' });
      var spans = c.lines.map(function (ln) { var s = h('span', { class: 'cmp-line', text: ln }); pre.appendChild(s); return s; });
      var status = h('div', { class: 'cmp-status', role: 'status', text: 'Waiting to start.' });
      els[c.id] = { spans: spans, status: status };
      cols.appendChild(h('div', { class: 'cmp' }, [h('h4', { text: c.title }), pre, status]));
    });

    var lab = UI.lab({
      title: 'Lab 3: callbacks vs promises vs async/await',
      subtitle: 'The same job three ways: get a user, get their orders, compute a total. Then make the orders call fail.',
      sim: sim,
      stage: cols,
      stageLabel: 'Three code listings that highlight the line being executed',
      breakLabel: 'Break it: make getOrders fail',
      fixLabel: 'Fix it: let getOrders succeed',
      onBreak: function (broken) { fail = broken; sim.reset(); sim.play(); },
      caption: 'Same timing, same result on success. The difference shows up when something fails.'
    });

    function mark(which, cls) {
      COLS.forEach(function (c) {
        els[c.id].spans.forEach(function (s) { s.className = 'cmp-line'; });
        if (which && cls !== 'none') { els[c.id].spans[c.map[which]].className = 'cmp-line ' + cls; }
      });
    }
    function status(id, text, cls) { els[id].status.textContent = text; els[id].status.className = 'cmp-status ' + (cls || ''); }

    function seed() {
      mark(null);
      COLS.forEach(function (c) { status(c.id, 'Waiting to start.'); });
      lab.log.clear();
      lab.metrics.reset();
      lab.bar.setBroken(fail);
      lab.explain('Callbacks nest one level deeper per step and need an error check at **every** level. Promises flatten the chain and send any rejection to one `.catch`. async/await reads like synchronous code and uses ordinary `try/catch`. Press Play, then Break it.');
      lab.log.log('Three implementations of the same flow. getUser takes 400 ms, getOrders 600 ms, computeTotal 100 ms.', { t: 0 });
      sim.schedule(0, function () { mark('user', 'is-now'); lab.log.log('getUser(id) called in all three versions.', { t: sim.now() }); });
      sim.schedule(400, function () { mark('orders', 'is-now'); lab.log.log('User received. getOrders(user) called.', { t: sim.now() }); lab.metrics.set('depth', 1); });
      sim.schedule(1000, function () {
        if (fail) {
          mark('fail', 'is-err');
          els.pr.spans[COLS[1].map.fail].className = 'cmp-line is-ok';
          els.aw.spans[COLS[2].map.fail].className = 'cmp-line is-ok';
          status('cb', 'Uncaught TypeError: the orders error was never checked, so computeTotal(undefined) throws inside a callback. No try/catch around the original call can catch it.', 'err');
          status('pr', 'getOrders rejected. The rejection skipped the remaining .then steps and landed in the single .catch. Fallback shown.', 'ok');
          status('aw', 'await threw. Control jumped to the catch block. Fallback shown.', 'ok');
          lab.log.log('getOrders FAILED at 1000 ms.', { t: sim.now(), level: 'err' });
          lab.log.log('Callbacks: the missing error check lets the failure crash the callback.', { t: sim.now(), level: 'err' });
          lab.log.log('Promises and async/await: the error is routed to one handler.', { t: sim.now(), level: 'ok' });
          lab.metrics.inc('errors');
          lab.metrics.set('depth', 0);
          lab.explain('**Error handling is the real difference.** With callbacks you must remember `if (err)` at every level, and a forgotten check fails far from its cause (this crash happens inside a different callback, so you cannot wrap it in try/catch). With promises a rejection skips every `.then` until a `.catch`. With async/await a rejection becomes a normal exception. Honest caveat: promises and async code also crash (as an unhandled rejection) if you forget the `.catch` or `try/catch` completely. They make the right thing easier, not automatic.');
        } else {
          mark('total', 'is-now');
          lab.log.log('Orders received. computeTotal called.', { t: sim.now() });
        }
      });
      sim.schedule(1100, function () {
        if (fail) { return; }
        mark('done', 'is-ok');
        COLS.forEach(function (c) { status(c.id, 'Done: total shown after 1100 ms.', 'ok'); });
        lab.log.log('All three versions finish at 1100 ms. The work and timing are identical.', { t: sim.now(), level: 'ok' });
        lab.metrics.set('latency', 1100);
        lab.metrics.set('throughput', 3 / 1.1);
        lab.metrics.set('depth', 0);
        lab.explain('**Same behaviour, different shape.** On the happy path all three take 1100 ms because each step waits for the previous one. The callback version is already three levels deep; add two more steps and it becomes the "pyramid of doom". Press Break it to compare failure handling.');
      });
    }

    sim.on('reset', seed);
    seed();
    return wrap([], lab);
  }

  /* ================= LAB 4: Promise combinators ================= */

  function labCombinators() {
    var DUR = [300, 600, 900, 1200];
    var NAMES = ['A', 'B', 'C', 'D'];
    var sim = Sim.create({ speed: 1 });
    var comb = 'all';
    var flags = [false, false, false, false];
    var st;
    var tl = makeTimeline({ base: 1500, label: 'Timeline of four tasks and when the combinator settles' });
    var res = h('p', { class: 'tl-result', role: 'status', text: 'Result: pending' });
    var stage = h('div', {}, [tl.el, res, legend([['#4ccf8d', 'fulfilled'], ['#ef5b5b', 'rejected'], ['#7aa2ff', 'running']])]);

    var lab = UI.lab({
      title: 'Lab 4: Promise.all / allSettled / race / any',
      subtitle: 'Four tasks finish at 0.3, 0.6, 0.9 and 1.2 s. Choose a combinator, inject failures, and see when and how it settles.',
      sim: sim,
      stage: stage,
      stageLabel: 'Timeline of four parallel promises and the combinator result',
      breakLabel: 'Break it: make A and B fail',
      fixLabel: 'Fix it: nobody fails',
      onBreak: function (broken) {
        flags = broken ? [true, true, false, false] : [false, false, false, false];
        boxes.forEach(function (b, i) { b.set(flags[i]); });
        sim.reset();
        sim.play();
      },
      caption: 'Press Play. The dashed line marks the moment the combinator settles.'
    });

    var GENERAL = {
      all: '**Promise.all** fulfils with all values only if every task fulfils. The **first rejection** rejects it immediately. Other tasks are not cancelled: they keep running and their results are thrown away.',
      allSettled: '**Promise.allSettled** always waits for every task and never rejects. You get a status for each. Use it when partial success is acceptable (for example sending notifications).',
      race: '**Promise.race** settles with whichever task settles **first**, success or failure. A fast failure beats a slower success. It is the building block for timeouts, but it does not cancel the loser.',
      any: '**Promise.any** fulfils with the first **fulfilled** task and ignores rejections. It rejects (with an AggregateError) only if every task rejects. Good for "ask several mirrors, take the first good answer".'
    };

    function label(i) { return NAMES[i] + ' ' + DUR[i] + ' ms'; }

    function update() {
      var running = st.t.filter(function (t) { return !t.fin; }).length;
      var failed = st.t.filter(function (t) { return t.fin && t.fail; }).length;
      var fin = st.t.length - running;
      var secs = sim.now() / 1000;
      lab.metrics.set('throughput', secs > 0 ? fin / secs : 0);
      lab.metrics.set('depth', running);
      lab.metrics.set('errors', failed);
    }

    function settle(ok, text) {
      st.settled = true;
      tl.mark(sim.now(), ok ? 'resolved' : 'rejected', ok ? 'ok' : '');
      res.textContent = 'Result: ' + text;
      res.style.color = ok ? 'var(--ok)' : 'var(--err)';
      lab.metrics.set('latency', Math.round(sim.now()));
      lab.log.log('Promise.' + comb + ' ' + (ok ? 'RESOLVED' : 'REJECTED') + ': ' + text, { t: sim.now(), level: ok ? 'ok' : 'err' });
      lab.explain(GENERAL[comb] + (ok ? '' : '\n\nThis run **rejected**: your `await` would throw at ' + Math.round(sim.now()) + ' ms.') + (st.t.some(function (t) { return !t.fin; }) ? '\n\nNotice the bars still running to the right of the line: the other tasks are **not cancelled**.' : ''));
    }

    function onFinish(i) {
      var t = st.t[i];
      t.fin = true;
      t.fail = flags[i];
      t.bar.cls = (t.fail ? 'fail' : 'ok') + (st.settled ? ' ignored' : '');
      t.bar.label = NAMES[i] + (t.fail ? ' failed' : ' ok');
      lab.log.log('Task ' + NAMES[i] + ' ' + (t.fail ? 'REJECTED' : 'fulfilled') + (st.settled ? ' (the combinator already settled, so this result is ignored. The work still ran.)' : '.'), { t: sim.now(), level: t.fail ? 'err' : 'ok' });
      var allFin = st.t.every(function (x) { return x.fin; });
      if (!st.settled) {
        if (comb === 'all') {
          if (t.fail) { settle(false, 'task ' + NAMES[i] + ' rejected, so Promise.all rejects right away.'); }
          else if (allFin) { settle(true, 'all four values: [A, B, C, D]'); }
        } else if (comb === 'allSettled') {
          if (allFin) { settle(true, st.t.map(function (x, k) { return NAMES[k] + ': ' + (x.fail ? 'rejected' : 'fulfilled'); }).join(', ')); }
        } else if (comb === 'race') {
          settle(!t.fail, 'the first to settle was ' + NAMES[i] + ' (' + (t.fail ? 'rejected' : 'fulfilled') + ').');
        } else if (comb === 'any') {
          if (!t.fail) { settle(true, 'first fulfilled value came from ' + NAMES[i] + '. Earlier failures were ignored.'); }
          else if (allFin) { settle(false, 'AggregateError: all four promises rejected.'); }
        }
      }
      if (allFin) { lab.log.log('All four tasks have finished.', { t: sim.now() }); }
      update();
    }

    function seed() {
      st = { t: [], settled: false };
      tl.setRows(NAMES.map(function (n, i) { return 'Task ' + n; }));
      DUR.forEach(function (d, i) {
        var bar = tl.add(i, 0, d, 'run', label(i));
        st.t.push({ fin: false, fail: false, bar: bar });
        sim.schedule(d, function () { onFinish(i); });
      });
      res.textContent = 'Result: pending';
      res.style.color = '';
      lab.log.clear();
      lab.metrics.reset();
      lab.bar.setBroken(flags.some(function (f) { return f; }));
      lab.explain(GENERAL[comb]);
      lab.log.log('Promise.' + comb + '([A, B, C, D]) with failures on: ' + (NAMES.filter(function (n, i) { return flags[i]; }).join(', ') || 'none') + '.', { t: 0 });
      tl.draw(0);
      update();
    }

    sim.on('tick', function () { tl.draw(sim.now()); });
    sim.on('reset', seed);

    var combSeg = segmented('Combinator', [['all', 'all'], ['allSettled', 'allSettled'], ['race', 'race'], ['any', 'any']], comb, function (v) { comb = v; sim.reset(); });
    var boxes = NAMES.map(function (n, i) { return checkbox('Fail ' + n, false, function (v) { flags[i] = v; sim.reset(); }); });
    seed();
    return wrap([combSeg].concat(boxes), lab);
  }

  /* ================= LAB 5: retries, exponential backoff and jitter ================= */

  function labRetry() {
    var N = 20, CAP = 5, OUTAGE = 3000, NB = 100;
    var sim = Sim.create({ speed: 1 });
    var policy = 'jitter';
    var st, rnd;
    var bars = makeBars(NB, { segs: ['r', 'g'], down: OUTAGE / 100, label: 'Requests per 100 ms: green accepted, red rejected', lineLabel: 'server capacity: 5 per 100 ms' });
    var cap = h('div', { class: 'bars-cap' }, [h('span', { text: '0 s  (red-tinted area: server down until 3 s)' }), h('span', { text: '10 s' })]);
    var stage = h('div', {}, [bars.el, cap, legend([['#4ccf8d', 'accepted'], ['#ef5b5b', 'rejected (server down or overloaded)']])]);

    var lab = UI.lab({
      title: 'Lab 5: retries with exponential backoff and jitter',
      subtitle: '20 clients call a server that is down for 3 s and can then handle only 5 requests per 100 ms. How do they retry?',
      sim: sim,
      stage: stage,
      stageLabel: 'Bar chart of request attempts per 100 millisecond window',
      breakLabel: 'Break it: retry every 50 ms with no backoff',
      fixLabel: 'Fix it: exponential backoff with jitter',
      onBreak: function (broken) { policy = broken ? 'none' : 'jitter'; polSeg.set(policy); sim.reset(); sim.play(); },
      caption: 'Press Play and compare the three retry policies.'
    });

    function maxAttempts() { return policy === 'none' ? 100 : 10; }
    function delayFor(n) {
      if (policy === 'none') { return 50; }
      var ceiling = Math.min(2000, 200 * Math.pow(2, n - 1));
      return policy === 'exp' ? ceiling : Math.max(10, Math.round(rnd() * ceiling));
    }

    function draw() {
      var scale = 8;
      for (var i = 0; i < NB; i++) { var b = st.b[i]; scale = Math.max(scale, b.ok + b.bad); }
      for (var j = 0; j < NB; j++) { bars.set(j, [st.b[j].bad, st.b[j].ok], scale); }
      bars.setLine(CAP, scale);
    }

    function update() {
      var secs = sim.now() / 1000;
      lab.metrics.set('throughput', secs > 0 ? st.success / secs : 0);
      lab.metrics.set('latency', st.success ? Math.round(st.sumLat / st.success) : NaN);
      lab.metrics.set('depth', N - st.success - st.gave);
      lab.metrics.set('errors', st.rejected);
    }

    function attempt(c) {
      var t = sim.now();
      var b = st.b[Math.min(NB - 1, Math.floor(t / 100))];
      var bi = Math.min(NB - 1, Math.floor(t / 100));
      c.n++;
      st.attempts++;
      st.bucketAttempts++;
      var ok = false;
      if (t >= OUTAGE && st.acc[bi] < CAP) { st.acc[bi]++; ok = true; }
      if (ok) {
        b.ok++;
        c.done = true;
        st.success++;
        st.sumLat += t;
        lab.log.log('Client ' + (c.id + 1) + ' succeeded on attempt ' + c.n + ' at ' + Math.round(t) + ' ms.', { t: t, level: 'ok' });
      } else {
        b.bad++;
        st.rejected++;
        st.bucketRej++;
        if (c.n >= maxAttempts()) { c.gave = true; st.gave++; lab.log.log('Client ' + (c.id + 1) + ' GAVE UP after ' + c.n + ' attempts.', { t: t, level: 'err' }); }
        else { sim.schedule(delayFor(c.n), function () { attempt(c); }); }
      }
      if (st.success + st.gave === N) { finish(); }
      update();
    }

    function finish() {
      st.over = true;
      var ms = Math.round(sim.now());
      lab.log.log('Finished at ' + ms + ' ms: ' + st.success + ' succeeded, ' + st.gave + ' gave up, ' + st.attempts + ' total attempts (' + st.rejected + ' rejected).', { t: sim.now(), level: st.gave ? 'err' : 'ok' });
      lab.explain(policy === 'none'
        ? '**Retry storm.** ' + st.attempts + ' attempts for 20 requests. Clients hammered the dead server, then all hit the recovering one at the same instant and kept it overloaded. Retrying immediately turns a short outage into extra load exactly when the server is weakest.'
        : policy === 'exp'
          ? '**Backoff without jitter still synchronises.** All 20 clients started together, so they retry together (0.2, 0.6, 1.4, 3.0 s...). Each wave of 20 exceeds the 5-per-100 ms capacity, so only 5 get through and the other 15 return together again. Total attempts: ' + st.attempts + '. Finish time: ' + ms + ' ms.'
          : '**Jitter spreads the herd.** Each client waits a random time up to the exponential ceiling, so retries arrive spread out instead of in waves. Attempts: ' + st.attempts + ', finished at ' + ms + ' ms. In production also cap attempts, retry only safe (idempotent) operations, and use a retry budget so layers do not multiply retries.');
    }

    function heartbeat() {
      if (st.over) { return; }
      if (st.bucketAttempts) { lab.log.log('Last 0.5 s: ' + st.bucketAttempts + ' attempts, ' + st.bucketRej + ' rejected.', { t: sim.now(), level: st.bucketRej ? 'warn' : 'info' }); }
      st.bucketAttempts = 0; st.bucketRej = 0;
      sim.schedule(500, heartbeat);
    }

    function seed() {
      rnd = Sim.random(42);
      st = { b: [], acc: [], clients: [], success: 0, gave: 0, attempts: 0, rejected: 0, sumLat: 0, over: false, bucketAttempts: 0, bucketRej: 0 };
      for (var i = 0; i < NB; i++) { st.b.push({ ok: 0, bad: 0 }); st.acc.push(0); }
      lab.log.clear();
      lab.metrics.reset();
      lab.bar.setBroken(policy === 'none');
      lab.explain('Policy: ' + ({ none: 'retry every 50 ms (no backoff)', exp: 'exponential backoff, no jitter (200 ms, 400, 800... capped at 2 s)', jitter: 'exponential backoff with full jitter (random wait up to the same ceiling)' })[policy] + '. Press Play.');
      lab.log.log('20 clients start at t = 0. The server is down until 3000 ms, then accepts 5 requests per 100 ms.', { t: 0 });
      for (var k = 0; k < N; k++) { (function (id) { var c = { id: id, n: 0, done: false, gave: false }; sim.schedule(0, function () { attempt(c); }); })(k); }
      sim.schedule(500, heartbeat);
      draw();
    }

    sim.on('tick', draw);
    sim.on('reset', seed);
    var polSeg = segmented('Retry policy', [['none', 'No backoff'], ['exp', 'Backoff, no jitter'], ['jitter', 'Backoff + jitter']], policy, function (v) { policy = v; sim.reset(); });
    seed();
    return wrap([polSeg], lab);
  }

  /* ================= LAB 6: timeouts and cancellation ================= */

  function labCancel() {
    var REQ = [{ q: 'c', start: 0, lat: 1500 }, { q: 'ca', start: 300, lat: 900 }, { q: 'cat', start: 600, lat: 200 }];
    var TIMEOUT = 1000;
    var sim = Sim.create({ speed: 1 });
    var cancel = true, tout = true;
    var st;
    var tl = makeTimeline({ base: 2000, label: 'Timeline of three search requests started by typing c, ca, cat' });
    var typed = h('div', { class: 'ui-box' });
    var shown = h('div', { class: 'ui-box', role: 'status' });
    var stage = h('div', {}, [typed, shown, tl.el, legend([['#7aa2ff', 'in flight'], ['#4ccf8d', 'completed'], ['#e0b341', 'aborted'], ['#ef5b5b', 'timed out']])]);

    var lab = UI.lab({
      title: 'Lab 6: timeouts and cancellation',
      subtitle: 'Search-as-you-type fires a request per keystroke. The slowest request belongs to the oldest keystroke. Who wins the screen?',
      sim: sim,
      stage: stage,
      stageLabel: 'Search box, results shown and a timeline of three requests',
      breakLabel: 'Break it: do not cancel old requests',
      fixLabel: 'Fix it: abort the previous request',
      onBreak: function (broken) { cancel = !broken; cSeg.set(cancel); sim.reset(); sim.play(); },
      caption: 'Press Play with cancellation on, then Break it.'
    });

    function render() {
      typed.textContent = 'Search box: "' + (st.begun ? REQ[st.begun - 1].q : '') + '"' + (st.begun === 3 ? '  (the user has finished typing "cat")' : '');
      if (st.shown < 0) { shown.className = 'ui-box'; shown.textContent = 'Results shown: (none yet)'; }
      else if (st.shown === 2) { shown.className = 'ui-box good'; shown.textContent = 'Results shown for "cat". Correct.'; }
      else { shown.className = 'ui-box stale'; shown.textContent = 'STALE: results shown for "' + REQ[st.shown].q + '" but the user typed "cat".'; }
      var active = st.r.filter(function (r) { return r.active; }).length;
      var secs = sim.now() / 1000;
      lab.metrics.set('throughput', secs > 0 ? st.ok / secs : 0);
      lab.metrics.set('latency', st.okAt >= 0 ? Math.round(st.okAt) : NaN);
      lab.metrics.set('depth', active);
      lab.metrics.set('errors', st.stale + st.timeouts);
    }

    function check() {
      if (st.begun < 3 || st.r.some(function (r) { return r.active; }) || st.concluded) { return; }
      st.concluded = true;
      lab.log.log(st.shown === 2 ? 'Final screen is correct.' : 'Final screen is WRONG: it shows an old query.', { t: sim.now(), level: st.shown === 2 ? 'ok' : 'err' });
      lab.explain(st.shown === 2
        ? '**Cancellation keeps the newest answer on screen.** Each keystroke aborts the previous request, so a late, stale response can never arrive and overwrite fresh results. Note: aborting stops the **client** from waiting. The server may still be doing the work unless it also honours the cancellation.'
        : '**A race between responses.** Responses return in a different order than requests were sent. The newest query finished first, then older slow ones arrived and overwrote it. ' + (tout ? 'The timeout stopped the slowest request at 1000 ms, but not the middle one. ' : '') + 'Fix: abort the previous request (`AbortController`), or ignore any response whose request is not the latest. A timeout alone is not cancellation.');
    }

    function begin(i) {
      var r = st.r[i];
      st.begun = i + 1;
      if (cancel) {
        for (var j = 0; j < i; j++) {
          var o = st.r[j];
          if (o.active) {
            o.active = false; o.bar.end = sim.now(); o.bar.cls = 'abort'; o.bar.label = 'aborted';
            lab.log.log('Request "' + REQ[j].q + '" aborted: a newer keystroke made it obsolete (the server may still be working on it).', { t: sim.now(), level: 'warn' });
          }
        }
      }
      r.active = true;
      r.bar = tl.add(i, sim.now(), sim.now() + REQ[i].lat, 'run', '"' + REQ[i].q + '"');
      lab.log.log('Request for "' + REQ[i].q + '" sent (will take ' + REQ[i].lat + ' ms).', { t: sim.now() });
      sim.schedule(REQ[i].lat, function () { finish(i); });
      if (tout) { sim.schedule(TIMEOUT, function () { timedOut(i); }); }
      render();
    }

    function finish(i) {
      var r = st.r[i];
      if (!r.active) { return; }
      r.active = false; r.bar.cls = 'ok'; r.bar.label = '"' + REQ[i].q + '" done';
      st.ok++;
      var stale = i < st.begun - 1;
      st.shown = i;
      if (stale) { st.stale++; lab.log.log('Response for "' + REQ[i].q + '" arrived late and OVERWROTE newer results.', { t: sim.now(), level: 'err' }); }
      else { st.okAt = sim.now(); lab.log.log('Response for "' + REQ[i].q + '" displayed.', { t: sim.now(), level: 'ok' }); }
      render(); check();
    }

    function timedOut(i) {
      var r = st.r[i];
      if (!r.active) { return; }
      r.active = false; r.bar.end = sim.now(); r.bar.cls = 'fail'; r.bar.label = 'timeout';
      st.timeouts++;
      lab.log.log('Request "' + REQ[i].q + '" TIMED OUT after ' + TIMEOUT + ' ms. The client stops waiting.', { t: sim.now(), level: 'err' });
      render(); check();
    }

    function seed() {
      st = { r: REQ.map(function () { return { active: false, bar: null }; }), begun: 0, shown: -1, ok: 0, stale: 0, timeouts: 0, okAt: -1, concluded: false };
      tl.setRows(REQ.map(function (r) { return 'Req "' + r.q + '"'; }));
      lab.log.clear();
      lab.metrics.reset();
      lab.bar.setBroken(!cancel);
      lab.explain((cancel ? 'Cancellation ON: each new keystroke aborts the previous request.' : 'Cancellation OFF: old requests keep running and their responses are still accepted.') + (tout ? ' A 1000 ms timeout is also active.' : ' No timeout.'));
      lab.log.log('The user types "c", then "ca", then "cat". Latencies: 1500, 900 and 200 ms.', { t: 0 });
      REQ.forEach(function (r, i) { sim.schedule(r.start, function () { begin(i); }); });
      tl.draw(0);
      render();
    }

    sim.on('tick', function () { tl.draw(sim.now()); });
    sim.on('reset', seed);
    var cSeg = checkbox('Abort previous request', cancel, function (v) { cancel = v; sim.reset(); });
    var tBox = checkbox('1000 ms timeout', tout, function (v) { tout = v; sim.reset(); });
    seed();
    return wrap([cSeg, tBox], lab);
  }

  /* ================= LAB 7: backpressure ================= */

  function labBackpressure() {
    var PROD = 50, CONS = 200, WORKERS = 2, HWM = 20, LOW = 8, OOM = 120, WIN = 60;
    var sim = Sim.create({ speed: 1 });
    var policy = 'pause';
    var st;
    var chart = makeBars(WIN, { segs: ['d'], label: 'Buffer depth over the last 12 seconds', lineLabel: 'high-water mark: 20' });
    var cap = h('div', { class: 'bars-cap' }, [h('span', { text: '12 s ago' }), h('span', { text: 'now' })]);
    var state = h('p', { class: 'cf-note', role: 'status' });
    var stage = h('div', {}, [chart.el, cap, state]);

    var lab = UI.lab({
      title: 'Lab 7: backpressure',
      subtitle: 'A fast source produces 20 items per second. A slow sink (2 async writers, 200 ms each) can take only 10 per second.',
      sim: sim,
      stage: stage,
      stageLabel: 'Chart of buffer depth between a fast producer and a slow consumer',
      breakLabel: 'Break it: remove all limits',
      fixLabel: 'Fix it: pause the producer at the high-water mark',
      onBreak: function (broken) { policy = broken ? 'none' : 'pause'; polSeg.set(policy); sim.reset(); sim.play(); },
      caption: 'Press Play and compare the three policies.'
    });

    function scale() { return policy === 'none' ? OOM : Math.max(HWM * 1.5, 1); }

    function draw() {
      var sc = scale();
      for (var i = 0; i < WIN; i++) { var v = st.samples[i]; chart.set(i, [v === undefined ? 0 : v], sc); }
      chart.setLine(policy === 'none' ? 0 : HWM, sc);
      var secs = sim.now() / 1000;
      lab.metrics.set('throughput', secs > 0 ? st.done / secs : 0);
      lab.metrics.set('latency', st.started ? Math.round(st.waitSum / st.started) : NaN);
      lab.metrics.set('depth', st.buf.length);
      lab.metrics.set('errors', st.dead ? 1 : st.dropped);
      state.textContent = 'Produced ' + st.made + '  |  Written ' + st.done + '  |  In buffer ' + st.buf.length + '  |  Dropped ' + st.dropped + '  |  Producer ' + (st.dead ? 'crashed' : (st.paused ? 'PAUSED by backpressure' : 'running'));
    }

    function crash() {
      st.dead = true;
      lab.log.log('FATAL: JavaScript heap out of memory. ' + st.buf.length + ' buffered items are lost.', { t: sim.now(), level: 'err' });
      lab.explain('**The unbounded buffer is a time bomb.** Writing 10 items per second while producing 20 leaves a surplus of 10 per second that piles up in memory. Each item also waits longer and longer (watch latency climb), and finally the process dies and loses everything buffered. Backpressure turns that crash into a controlled slowdown. Press **Fix it**.');
      draw();
      sim.pause();
    }

    function pump() {
      while (st.idle > 0 && st.buf.length) {
        st.idle--;
        var item = st.buf.shift();
        st.started++;
        st.waitSum += sim.now() - item.born;
        sim.schedule(CONS, function () {
          if (st.dead) { return; }
          st.done++; st.idle++;
          if (st.paused && st.buf.length <= LOW) {
            st.paused = false;
            lab.log.log('Buffer drained to ' + st.buf.length + '. Producer resumes (like the stream "drain" event).', { t: sim.now(), level: 'ok' });
            sim.schedule(0, produce);
          }
          pump();
        });
      }
    }

    function produce() {
      if (st.dead) { return; }
      if (policy === 'pause' && st.buf.length >= HWM) {
        st.paused = true;
        lab.log.log('Buffer at the high-water mark (' + st.buf.length + '). Producer PAUSES: this is backpressure.', { t: sim.now(), level: 'warn' });
        return;
      }
      st.made++;
      if (policy === 'drop' && st.buf.length >= HWM) {
        st.dropped++;
        if (st.dropped % 25 === 1) { lab.log.log('Buffer full: dropping new items (load shedding). Dropped so far: ' + st.dropped + '.', { t: sim.now(), level: 'warn' }); }
      } else {
        st.buf.push({ born: sim.now() });
        if (policy === 'none' && st.buf.length >= OOM) { crash(); return; }
        pump();
      }
      sim.schedule(PROD, produce);
    }

    function sample() {
      if (st.dead) { return; }
      st.samples.push(st.buf.length);
      if (st.samples.length > WIN) { st.samples.shift(); }
      sim.schedule(200, sample);
    }

    function seed() {
      st = { buf: [], samples: [], made: 0, done: 0, started: 0, waitSum: 0, dropped: 0, idle: WORKERS, paused: false, dead: false };
      lab.log.clear();
      lab.metrics.reset();
      lab.bar.setBroken(policy === 'none');
      lab.explain({
        pause: 'Policy: pause the producer at 20 buffered items and resume at 8. The system settles at the sink\'s pace (10 items per second) with a bounded delay.',
        drop: 'Policy: drop new items when the buffer is full (load shedding). Memory stays safe and latency stays bounded, but data is lost, so this only suits data you can afford to lose (metrics samples, video frames).',
        none: 'Policy: no limit. The buffer will grow until memory runs out.'
      }[policy]);
      lab.log.log('Producer 20 items/s, consumers 10 items/s, policy "' + policy + '". Press Play.', { t: 0 });
      sim.schedule(0, produce);
      sim.schedule(200, sample);
      draw();
    }

    sim.on('tick', draw);
    sim.on('reset', seed);
    var polSeg = segmented('Policy', [['pause', 'Pause producer (backpressure)'], ['drop', 'Drop newest (shed load)'], ['none', 'No limit']], policy, function (v) { policy = v; sim.reset(); });
    seed();
    return wrap([polSeg], lab);
  }

  /* ================= Async vs threads decision helper ================= */

  function decisionHelper() {
    var QUESTIONS = [
      { id: 'where', q: '1. Where does each request spend most of its time?', opts: [['io', 'Waiting on network, disk or databases (I/O)'], ['cpu', 'Crunching numbers (CPU)'], ['both', 'Both, substantially']] },
      { id: 'scale', q: '2. How many things are in flight at once?', opts: [['few', 'Tens'], ['many', 'Hundreds to a few thousand'], ['huge', 'Tens of thousands or more']] },
      { id: 'libs', q: '3. How async-ready are your libraries and drivers?', opts: [['async', 'All async (HTTP, DB, queue clients)'], ['mixed', 'A mix'], ['blocking', 'Mostly blocking']] },
      { id: 'threads', q: '4. Does your platform offer cheap threads (Go goroutines, Java 21+ virtual threads, Erlang processes)?', opts: [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']] },
      { id: 'state', q: '5. Do tasks share a lot of mutable in-memory state?', opts: [['little', 'Little or none'], ['lots', 'Yes, a lot']] }
    ];
    var ans = {};
    var out = h('div', { class: 'decide-out', 'aria-live': 'polite' });

    function verdict(a) {
      var v;
      if (a.where === 'cpu') {
        v = ['warn', 'Use threads or processes (parallelism), not async', 'Async only overlaps **waiting**. CPU-bound work needs more cores doing work at once: a thread pool sized near the core count (native threads), processes (Python `multiprocessing`), worker threads (Node), or a job queue. Keep the event loop free for I/O.'];
      } else if (a.where === 'both') {
        v = ['', 'Hybrid: async for I/O, a worker pool for CPU', 'Run the I/O orchestration on the event loop and push CPU-heavy steps to a bounded worker pool (`asyncio.to_thread` or a `ProcessPoolExecutor`, Node `worker_threads`, a separate service). Never run heavy computation inline on the loop.'];
      } else if (a.threads === 'yes') {
        v = ['ok', 'Cheap threads (virtual threads / goroutines) give you simple code with async-level scale', 'You can write straightforward blocking code, one thread per task, and still handle huge numbers of waiting tasks. You avoid function colouring and can keep blocking libraries. Still bound concurrency and set timeouts.'];
      } else if (a.libs === 'blocking') {
        v = ['', 'A bounded thread pool', 'Async needs async libraries all the way down. With mostly blocking libraries, wrapping them in `async` just blocks the loop. Use a sized thread pool (I/O-bound formula: cores x (1 + wait / compute)), or migrate the hot paths to async drivers first.'];
      } else if (a.scale === 'few') {
        v = ['', 'Either works: choose the simplest', 'With only tens of concurrent tasks, plain blocking code with a small thread pool is easiest to write, debug and profile. Async brings no big win here unless the rest of your stack is already async.'];
      } else if (a.libs === 'mixed') {
        v = ['', 'Async/await, with blocking calls offloaded', 'Use the event loop for the many waiting tasks and move each remaining blocking library call to an executor (`asyncio.to_thread`, `run_in_executor`) so it cannot freeze the loop. Plan to replace those calls over time.'];
      } else {
        v = ['ok', 'Async / non-blocking I/O (event loop)', 'Many mostly-waiting tasks and async-ready libraries is the sweet spot. One thread can juggle thousands of connections with little memory. Add concurrency limits, per-call timeouts, cancellation and backpressure.'];
      }
      var note = a.state === 'lots'
        ? '\n\n**Shared state:** on a single event loop, code between `await`s cannot be interrupted, so races are rarer, but state can still change *across* an `await`. With threads, shared state needs locks (Topic 1).'
        : '\n\n**Shared state:** little shared state keeps either model simple.';
      return UI.callout(v[0], v[1], v[2] + note).el;
    }

    function refresh() {
      out.innerHTML = '';
      var missing = QUESTIONS.filter(function (q) { return !ans[q.id]; }).length;
      if (missing) { out.appendChild(h('p', { class: 'cf-note', text: 'Answer all five questions to get a recommendation (' + missing + ' left).' })); return; }
      out.appendChild(verdict(ans));
    }

    var form = h('div', { class: 'decide' }, QUESTIONS.map(function (q) {
      var name = 'dq' + (++uid);
      var root = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': q.q });
      q.opts.forEach(function (o) {
        var inp = h('input', { type: 'radio', name: name, value: o[0] });
        inp.addEventListener('change', function () { ans[q.id] = o[0]; refresh(); });
        root.appendChild(h('label', { class: 'seg' }, [inp, h('span', { text: o[1] })]));
      });
      return h('div', { class: 'decide-q' }, [h('span', { text: q.q }), root]);
    }));
    refresh();
    return h('div', { class: 'card' }, [
      h('div', { class: 'card-title' }, [h('h3', { text: 'Async or threads? A decision helper' })]),
      h('p', { text: 'Answer five questions about your workload. This is a rule of thumb, not a law: always measure.' }),
      form, out
    ]);
  }

  /* ================= PREDICT ================= */

  var PRED = [L('A', 0), T(0, 1, [L('B', 1)]), M(2, [L('C', 2)]), L('D', 3), M(4, [L('E', 4)], 'await continuation'), L('F', 5)];

  function predict() {
    var info = runAll(PRED);
    return UI.predictChallenge({
      question: 'In what order does this JavaScript print its letters?',
      setup: "console.log('A'); setTimeout(() => console.log('B'), 0); Promise.resolve().then(() => console.log('C')); (async () => { console.log('D'); await null; console.log('E'); })(); console.log('F');",
      options: ['A B C D E F', 'A D F C E B', 'A D F B C E', 'A F D E C B'],
      answer: 1,
      duration: (info.steps + 1) * 400,
      speed: 4,
      explain: 'Synchronous lines run first: **A**, then the async function runs up to its first `await` and prints **D**, then **F**. The stack is empty, so the microtask queue drains in the order queued: the promise callback **C**, then the await continuation **E**. Only then does the timer callback **B** run as a macrotask. Order: **A D F C E B**.',
      simulate: function (ctx) {
        var lp = makeLoop(PRED);
        var out = h('p', { class: 'ui-box', text: 'Console: (empty)' });
        ctx.stage.appendChild(out);
        ctx.state = { lp: lp };
        function go() {
          if (lp.done) { return; }
          var msg = lp.step();
          out.textContent = 'Console: ' + (lp.out.join(' ') || '(empty)');
          ctx.log(msg, { t: ctx.sim.now(), level: lp.done ? 'ok' : 'info' });
          if (!lp.done) { ctx.sim.schedule(400, go); }
        }
        ctx.sim.schedule(400, go);
      },
      measure: function (ctx) { return 'The console printed: ' + ctx.state.lp.out.join(' '); }
    }).el;
  }

  /* ================= CHEAT SHEET + INTERVIEW ================= */

  function cheatSheet() {
    var items = [
      ['Blocking vs non-blocking', 'Blocking: the worker waits. Non-blocking: start, move on, react on completion. Async is about not wasting the worker, not about extra workers.'],
      ['Event loop order', 'Run script, then **all microtasks** (promises, await), then **one macrotask** (timer, I/O), then microtasks again. `nextTick` (Node) runs before promise microtasks.'],
      ['Promise states', 'pending, then fulfilled or rejected, settled once. `then`/`catch`/`finally`. `async` returns a promise; `await` unwraps it.'],
      ['Combinators', '`all`: all or first rejection. `allSettled`: every outcome. `race`: first to settle. `any`: first to fulfil. None of them cancel the rest.'],
      ['Never block the loop', 'No CPU loops, sync file or crypto calls, huge JSON parses or catastrophic regex in handlers. Offload to workers or chunk the work.'],
      ['Retries', 'Exponential backoff + full jitter + cap + max attempts. Retry only retryable errors and idempotent operations. Use a retry budget or circuit breaker.'],
      ['Timeouts and cancellation', 'Every network call gets a timeout and a propagated deadline. Cancellation is cooperative (`AbortController`, `CancelledError`). `race` with a timer is not cancellation.'],
      ['Backpressure', 'Bound every buffer. Pause producers (`highWaterMark`, `drain`), shed load, or reject. Unbounded queues turn slowness into out-of-memory crashes.'],
      ['Async vs threads', 'Async: many mostly-waiting tasks, async libraries. Threads/processes: CPU-bound work, blocking libraries. Cheap threads (Go, Java 21 virtual threads) give simple code at scale.']
    ];
    return h('div', { class: 'cheat' }, items.map(function (it) {
      return h('div', { class: 'cheat-item' }, [h('h4', { text: it[0] }), UI.rich(it[1])]);
    }));
  }

  function interview() {
    return UI.accordion({ items: [
      { title: 'Explain the event loop to a non-engineer, then to an engineer.', body: '**Simple:** one worker with a to-do list. It finishes one job, then picks the next. Slow things (waiting for a website) are handed off and come back as new jobs on the list.\n\n**Engineer:** a single thread runs the call stack. Async operations are delegated to the runtime (timers, the OS I/O layer, a thread pool for some operations). Completions enqueue callbacks. When the stack is empty the loop drains the microtask queue (promise reactions, await continuations) and then takes the next macrotask. Nothing runs concurrently on that thread, so a long synchronous task delays everything.' },
      { title: 'What is the difference between microtasks and macrotasks?', body: '**Macrotasks** (timers, I/O callbacks, UI events, `setImmediate`) are processed one per loop turn. **Microtasks** (promise reactions, `queueMicrotask`, await continuations) run right after the current task, and the whole microtask queue is drained, including newly added microtasks, before the next macrotask. So `Promise.then` runs before `setTimeout(fn, 0)`, and a microtask loop can starve timers and rendering.' },
      { title: 'Async vs multithreading: when do you pick each?', body: 'Async fits **I/O-bound** work with many concurrent waits and async-capable libraries: one thread, tiny per-task memory, no data races between awaits. Threads or processes fit **CPU-bound** work (real parallelism) and codebases built on blocking libraries. They are not exclusive: a common design is an event loop for I/O plus a worker pool for CPU tasks. Platforms with cheap threads (Go, Java 21+ virtual threads) let you keep blocking-style code while scaling.' },
      { title: 'Why is `await` inside a loop sometimes a performance bug? How do you fix it?', body: 'Each iteration waits for the previous one, so independent requests run sequentially and total time is the **sum**. Start the operations first and await them together (`Promise.all`, `asyncio.gather`). For large lists, bound concurrency with a pool or semaphore so you do not open thousands of connections. If the iterations genuinely depend on each other, or you must respect ordering or rate limits, sequential `await` is correct.' },
      { title: 'Promise.all vs allSettled vs race vs any?', body: '`all` fulfils with every value, or rejects on the first rejection. `allSettled` waits for everything and reports each outcome; it never rejects. `race` settles with the first promise to settle, whether success or failure. `any` fulfils with the first success and rejects with an AggregateError only if all reject. None cancel the remaining work. Choose by what partial failure means for your caller.' },
      { title: 'What can block the event loop in production, and how do you find it?', body: 'CPU loops, synchronous I/O (`readFileSync`), large `JSON.parse`/`stringify`, heavy crypto, catastrophic regex backtracking, and blocking libraries wrapped in async functions. Symptoms: latency spikes across unrelated requests while CPU shows one core at 100%. Detect with event-loop-delay metrics, `--cpu-prof` / flame graphs, asyncio debug mode, and tracing of slow callbacks. Fix by offloading to worker threads or processes, streaming, chunking with yields, or using async APIs.' },
      { title: 'How should retries be designed?', body: 'Retry only transient, retryable errors (timeouts, 503, connection resets), never validation errors. Make operations **idempotent** or send an idempotency key. Use exponential backoff with **full jitter**, a maximum delay and a maximum number of attempts, and respect `Retry-After`. Put a **retry budget** or circuit breaker around dependencies and retry at only one layer, because nested retries multiply load (3 x 3 x 3 = 27). Combine with a per-attempt timeout and an overall deadline.' },
      { title: 'How do timeouts and cancellation work for async code?', body: 'A timeout is the decision to stop waiting; cancellation is actually telling the work to stop. In JavaScript you pass an `AbortSignal` (`AbortSignal.timeout(ms)`) to `fetch` and your own functions; in Python `asyncio.timeout()` cancels the task by raising `CancelledError` inside it, which must not be swallowed. `Promise.race` against a timer does not stop the loser. Propagate a total deadline across hops and remember the remote server may keep working unless it also honours the cancellation.' },
      { title: 'What is backpressure and how do you implement it?', body: 'Backpressure is the signal from a slow consumer that tells a fast producer to slow down or stop, keeping buffers bounded. Implement it with bounded queues that block or reject when full, stream APIs (`write()` returning false, the `drain` event, `stream.pipeline`), pull-based consumption, or reactive-streams style demand signalling. If you cannot slow the source, shed load deliberately (drop, sample, or reject with 429/503) instead of buffering without limit.' },
      { title: 'Is JavaScript single-threaded?', body: 'Your JavaScript runs on one thread per event loop, but the runtime is not purely single-threaded: the OS handles network readiness, Node uses a libuv thread pool for file system, DNS and some crypto, browsers render and fetch on other threads, and Web Workers or `worker_threads` run additional JavaScript in separate isolates with message passing. Concurrency comes from overlapping waits; CPU parallelism needs workers.' }
    ] }).el;
  }

  /* ================= MOUNT ================= */

  function mount(el) {
    el.appendChild(h('div', { class: 'topic-intro' }, [h('p', { class: 'lead', text: 'How do programs wait for slow things without freezing? You will see the event loop work, race promises, retry safely and learn what blocks it.' })]));
    el.appendChild(storyBlock());
    el.appendChild(title('Learn it at your level', 'Start at Beginner. Each level adds depth and real production scars.'));
    el.appendChild(levelTabs());

    el.appendChild(title('Lab 1 \u00B7 Blocking vs non-blocking coffee shop'));
    el.appendChild(labCoffee());
    el.appendChild(title('Lab 2 \u00B7 Event loop visualizer'));
    el.appendChild(labLoop());
    el.appendChild(title('Lab 3 \u00B7 Callbacks vs Promises vs async/await'));
    el.appendChild(labStyles());
    el.appendChild(title('Lab 4 \u00B7 Promise.all, allSettled, race and any'));
    el.appendChild(labCombinators());
    el.appendChild(title('Lab 5 \u00B7 Retries, exponential backoff and jitter'));
    el.appendChild(labRetry());
    el.appendChild(title('Lab 6 \u00B7 Timeouts and cancellation'));
    el.appendChild(labCancel());
    el.appendChild(title('Lab 7 \u00B7 Backpressure'));
    el.appendChild(labBackpressure());
    el.appendChild(title('Tool \u00B7 Async or threads?'));
    el.appendChild(decisionHelper());

    el.appendChild(title('Predict the outcome'));
    el.appendChild(predict());

    el.appendChild(title('Quiz', '5 questions. Score 70% or more to complete this topic.'));
    el.appendChild(UI.quiz({ title: 'Asynchronous programming quiz', topicId: 'async', questions: (global.QUIZZES && global.QUIZZES.async) || [], passPct: 70 }).el);

    el.appendChild(title('Cheat sheet'));
    el.appendChild(cheatSheet());
    el.appendChild(title('Interview questions', 'Try answering out loud before opening each one.'));
    el.appendChild(interview());
  }

  global.App.registerTopic({ id: 'async', title: 'Asynchronous Programming', accent: 'async', mount: mount });
})(window);
