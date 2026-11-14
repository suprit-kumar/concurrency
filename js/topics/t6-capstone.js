/*
 * t6-capstone.js - Capstone: the "Place Order" flow.
 * Combines worker threads, async calls with retries, a queue, a broker and events,
 * with failure injection and recovery. Follows the frozen contract.
 */
(function (global) {
  'use strict';

  var UI = global.UI;
  var Sim = global.Sim;
  var h = UI.h;
  var uid = 0;

  /* ================= shared helpers ================= */

  function checkbox(label, checked, onChange) {
    var id = 'ccb' + (++uid);
    var inp = h('input', { type: 'checkbox', id: id });
    inp.checked = !!checked;
    inp.addEventListener('change', function () { onChange(inp.checked); });
    return { el: h('label', { class: 'ctl', for: id }, [inp, h('span', { text: label })]), get: function () { return inp.checked; }, set: function (v) { inp.checked = !!v; } };
  }

  function button(text, fn) {
    var b = h('button', { class: 'btn btn-sm', type: 'button', text: text });
    b.addEventListener('click', fn);
    return { el: b };
  }

  function title(text, sub) {
    var kids = [h('h3', { text: text })];
    if (sub) { kids.push(h('p', { class: 'muted', text: sub })); }
    return h('div', { class: 'section-title' }, kids);
  }

  function mkBox(name, cls) {
    var items = h('div', { class: 'qv-items' });
    var note = h('div', { class: 'qv-note' });
    var head = h('h4', { text: name });
    var el = h('div', { class: 'qv-box ' + (cls || '') }, [head, items, note]);
    return { el: el, items: items, note: note, head: head, state: function (c) { el.className = 'qv-box ' + (cls || '') + (c ? ' ' + c : ''); } };
  }

  function fill(box, list, max) {
    var lim = max || 30;
    box.items.innerHTML = '';
    list.slice(0, lim).forEach(function (m) {
      box.items.appendChild(h('span', { class: 'qv-msg ' + (m.cls || ''), text: String(m.label) }));
    });
    if (list.length > lim) { box.items.appendChild(h('span', { class: 'qv-note', text: '+' + (list.length - lim) + ' more' })); }
  }

  function avg(sum, n) { return n ? Math.round(sum / n) : NaN; }
  function rate(n, ms) { return ms > 0 ? n / (ms / 1000) : 0; }

  function levelPane(explain, analogy, wrong, prod, extra) {
    var d = h('div', { class: 'stack' });
    d.appendChild(UI.rich(explain));
    d.appendChild(UI.callout('analogy', 'Analogy', analogy).el);
    if (extra) { d.appendChild(extra); }
    d.appendChild(UI.callout('warn', 'What beginners get wrong', wrong).el);
    d.appendChild(UI.callout('err', 'In production this bites you when...', prod).el);
    return d;
  }

  /* ================= ARCHITECTURE DIAGRAM + STORY ================= */

  function svgEl(tag, attrs, text) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text) { e.textContent = text; }
    return e;
  }

  function diagram() {
    var svg = svgEl('svg', { viewBox: '0 0 780 250', role: 'img', 'aria-label': 'Place Order architecture: client to API, async call to the payment provider, order database with outbox, relay to broker, fulfilment queue to a worker pool, and event consumers for email and analytics', style: 'width:100%;height:auto;max-width:900px;color:var(--text)' });
    svg.appendChild(svgEl('defs', {}, '')).appendChild(svgEl('marker', { id: 'cap-arr', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' })).appendChild(svgEl('path', { d: 'M0 0L10 5L0 10z', fill: 'currentColor' }));
    var boxes = [
      [10, 90, 90, 50, 'Client', 'POST /orders'],
      [140, 90, 110, 50, 'API', 'async I/O'],
      [140, 10, 110, 50, 'Payment', 'timeout + retry'],
      [140, 170, 110, 60, 'Orders DB', '+ outbox table'],
      [290, 170, 90, 60, 'Relay', 'outbox poller'],
      [410, 90, 100, 50, 'Broker', 'topic exchange'],
      [550, 10, 110, 50, 'Fulfilment', 'queue (bounded)'],
      [690, 10, 80, 50, 'Workers', 'thread pool'],
      [550, 170, 110, 50, 'Email', 'event consumer'],
      [690, 170, 80, 50, 'Analytics', 'event consumer']
    ];
    boxes.forEach(function (b) {
      svg.appendChild(svgEl('rect', { x: b[0], y: b[1], width: b[2], height: b[3], rx: 8, fill: 'var(--surface)', stroke: 'var(--accent)', 'stroke-width': 1.5 }));
      svg.appendChild(svgEl('text', { x: b[0] + b[2] / 2, y: b[1] + 22, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: 'currentColor' }, b[4]));
      svg.appendChild(svgEl('text', { x: b[0] + b[2] / 2, y: b[1] + 40, 'text-anchor': 'middle', 'font-size': 10.5, fill: 'currentColor', opacity: '.7' }, b[5]));
    });
    [[100, 115, 140, 115], [195, 90, 195, 60], [195, 140, 195, 170], [250, 200, 290, 200], [380, 190, 440, 140], [510, 115, 555, 60], [660, 35, 690, 35], [480, 140, 560, 175], [660, 195, 690, 195]].forEach(function (l) {
      svg.appendChild(svgEl('line', { x1: l[0], y1: l[1], x2: l[2], y2: l[3], stroke: 'currentColor', 'stroke-width': 1.4, 'marker-end': 'url(#cap-arr)' }));
    });
    return h('div', { class: 'card' }, [h('div', { class: 'card-title' }, [h('h3', { text: 'The system you will operate' })]), svg]);
  }

  function storyBlock() {
    var stepper = UI.stepper({
      steps: [
        { title: '1. A customer clicks "Place order"', body: 'The **API** accepts the request using **async I/O**, so thousands of waiting requests share a few threads (Topic 2). It does not block while the payment provider thinks.' },
        { title: '2. Charge the card: an unreliable network call', body: 'The payment call can be slow or fail. The API uses a **timeout**, then **retries with exponential backoff and jitter**, and gives up after a limit (Topic 2). Retries are only safe because the call is idempotent (an idempotency key).' },
        { title: '3. Save the order and announce it', body: 'The order row and an **outbox** row commit in one transaction. A **relay** publishes "OrderPlaced" to the **broker** whenever it is up (Topic 5). The API can answer "accepted" without waiting for fulfilment.' },
        { title: '4. A queue smooths the work', body: 'The broker routes the event to a **fulfilment queue** (Topics 3 and 4). A bounded queue absorbs spikes, and **manual acks**, a delivery limit and a **dead letter queue** protect against crashes and poison messages.' },
        { title: '5. A worker pool does the heavy lifting', body: 'A fixed pool of **worker threads** picks, packs and labels orders: CPU-style work sized to cores, not to requests (Topic 1). A crashed worker\'s job returns to the queue.' },
        { title: '6. More events fan out', body: 'When an order ships, "OrderShipped" goes out. Email and Analytics react independently, and **idempotent consumers** ignore duplicates. A **correlation id** ties it all together for debugging.' }
      ]
    });
    return h('div', { class: 'card' }, [h('div', { class: 'card-title' }, [h('h3', { text: 'The Story: one click, five topics' })]), stepper.el]);
  }

  /* ================= THE CAPSTONE LAB ================= */

  function labPlaceOrder() {
    var PAY_OK = 200, TIMEOUT = 1000, WORK = 600, EVERY = 700;
    var sim = Sim.create({ speed: 1 });
    var resil = true, chaos = false, st, rnd;
    var apiBox = mkBox('API: payment calls in flight'), dbBox = mkBox('Orders DB + outbox'), brBox = mkBox('Broker');
    var qBox = mkBox('Fulfilment queue'), wBox = mkBox('Worker pool (3 threads)'), dlqBox = mkBox('Dead letter queue', 'dlq');
    var outBox = mkBox('Shipped, then emailed'), lostBox = mkBox('Lost or stuck', 'dlq');
    var status = h('p', { class: 'cf-note', role: 'status' });
    var grid = h('div', { class: 'qv-grid' }, [apiBox.el, dbBox.el, brBox.el, qBox.el, wBox.el, dlqBox.el, outBox.el, lostBox.el]);
    var stage = h('div', {}, [status, grid]);

    var lab = UI.lab({
      title: 'Capstone lab: the Place Order flow with failure injection',
      subtitle: 'Orders arrive every 0.7 s through async payment, an outbox, a broker, a queue and a thread pool. Inject failures and see what survives.',
      sim: sim, stage: stage,
      stageLabel: 'The Place Order pipeline: API, database and outbox, broker, queue, workers, events',
      breakLabel: 'Break it: failure script with no resilience',
      fixLabel: 'Fix it: turn the resilience features on',
      onBreak: function (broken) { chaos = true; resil = !broken; chaosC.set(true); resC.set(resil); sim.reset(); sim.play(); },
      caption: 'Press Play, then use the buttons to inject failures, or turn on the failure script.'
    });

    function payDown() { return st.payUntil > sim.now(); }
    function brokerDown() { return st.brkUntil > sim.now(); }

    function newOrder() {
      var o = { id: ++st.id, t0: sim.now(), att: 0, poison: st.poisonNext };
      st.poisonNext = false;
      st.pay.push(o);
      callPay(o);
      sim.schedule(EVERY, newOrder);
    }

    function callPay(o) {
      var down = payDown();
      sim.schedule(down ? TIMEOUT : PAY_OK, function () {
        if (!down) {
          st.pay.splice(st.pay.indexOf(o), 1);
          sim.schedule(50, function () { commit(o); });
          return;
        }
        if (resil && o.att < 4) {
          o.att++;
          var wait = Math.round(500 * Math.pow(2, o.att - 1) * (0.75 + rnd() * 0.5));
          lab.log.log('Payment call for #' + o.id + ' timed out. Retry ' + o.att + ' of 4 after ' + wait + ' ms (exponential backoff with jitter).', { t: sim.now(), level: 'warn' });
          sim.schedule(wait, function () { callPay(o); });
        } else {
          st.pay.splice(st.pay.indexOf(o), 1);
          st.payFail++; st.lostList.push('#' + o.id + ' pay');
          lab.log.log('Order #' + o.id + ' REJECTED: payment provider unreachable and no retry policy. The customer sees an error and may abandon.', { t: sim.now(), level: 'err' });
        }
      });
    }

    function commit(o) {
      st.db.push(o.id);
      if (resil) { st.outbox.push(o); }
      else if (brokerDown()) {
        st.lostEvt++; st.lostList.push('#' + o.id + ' event');
        lab.log.log('Order #' + o.id + ' saved and paid, but the publish failed (broker down). Dual write: the event is LOST, nothing will ship it.', { t: sim.now(), level: 'err' });
      } else { enqueue(o); }
    }

    function enqueue(o) { st.q.push({ o: o, fails: 0 }); dispatch(); }

    function relay() {
      if (resil && !brokerDown() && st.outbox.length) {
        var batch = st.outbox; st.outbox = [];
        batch.forEach(function (o) {
          enqueue(o);
          if (o.id % 7 === 0) { st.dup++; lab.log.log('Relay re-published #' + o.id + ' (it crashed before marking it sent). The consumer\'s processed-ids check ignores the duplicate.', { t: sim.now(), level: 'ok' }); }
        });
        if (batch.length > 3) { lab.log.log('Broker reachable again: relay flushed ' + batch.length + ' queued event(s) from the outbox.', { t: sim.now(), level: 'ok' }); }
      }
      sim.schedule(300, relay);
    }

    function dispatch() {
      st.workers.forEach(function (w) {
        if (!w.alive || w.busy) { return; }
        var job = st.q.shift();
        if (!job) { return; }
        w.busy = true; w.job = job;
        var tok = w.tok;
        sim.schedule(WORK, function () { if (w.tok === tok) { finish(w, job); } });
      });
    }

    function finish(w, job) {
      w.busy = false; w.job = null;
      if (job.o.poison) {
        if (resil) {
          job.fails++;
          if (job.fails >= 3) { st.dlq.push(job.o.id); lab.log.log('Poison order #' + job.o.id + ' failed 3 times: moved to the dead letter queue for a human. Other orders flow on.', { t: sim.now(), level: 'warn' }); }
          else { st.q.push(job); lab.log.log('Order #' + job.o.id + ' threw an error (attempt ' + job.fails + ' of 3). Requeued behind other work.', { t: sim.now(), level: 'warn' }); }
        } else {
          st.loops++; st.q.unshift(job);
          if (st.loops % 6 === 1) { lab.log.log('Poison order #' + job.o.id + ' requeued to the head AGAIN (' + st.loops + ' redeliveries). A worker is burning CPU in a hot loop.', { t: sim.now(), level: 'err' }); }
        }
      } else {
        st.done++; st.sum += sim.now() - job.o.t0; st.shipped.push(job.o.id);
        if (job.o.id % 5 === 0) { lab.log.log('Order #' + job.o.id + ' shipped. "OrderShipped" event sent; Email and Analytics react.', { t: sim.now(), level: 'ok' }); }
      }
      dispatch(); render();
    }

    function crashWorker() {
      var w = st.workers.filter(function (x) { return x.alive && x.busy; })[0] || st.workers.filter(function (x) { return x.alive; })[0];
      if (!w) { return; }
      var job = w.job;
      w.alive = false; w.tok++; w.busy = false; w.job = null;
      if (job) {
        if (resil) { st.q.unshift(job); lab.log.log('Worker ' + w.name + ' CRASHED mid-job. No ack was sent, so the broker requeues order #' + job.o.id + ' for another worker.', { t: sim.now(), level: 'warn' }); }
        else { st.lostJob++; st.lostList.push('#' + job.o.id + ' job'); lab.log.log('Worker ' + w.name + ' CRASHED mid-job. Auto-ack had already removed order #' + job.o.id + ' from the queue: it is LOST.', { t: sim.now(), level: 'err' }); }
      } else { lab.log.log('Worker ' + w.name + ' CRASHED while idle.', { t: sim.now(), level: 'warn' }); }
      sim.schedule(4000, function () { w.alive = true; lab.log.log('Worker ' + w.name + ' restarted.', { t: sim.now(), level: 'ok' }); dispatch(); render(); });
      render();
    }

    function payOutage() { st.payUntil = sim.now() + 4000; lab.log.log('FAILURE: payment provider unreachable for 4 s.', { t: sim.now(), level: 'err' }); render(); }
    function brokerOutage() { st.brkUntil = sim.now() + 3000; lab.log.log('FAILURE: broker unreachable for 3 s.', { t: sim.now(), level: 'err' }); render(); }
    function poison() { st.poisonNext = true; lab.log.log('FAILURE: the next order is a poison message (it always throws).', { t: sim.now(), level: 'err' }); }

    function errors() { return st.payFail + st.lostEvt + st.lostJob + (st.loops ? 1 : 0); }

    function render() {
      var now = sim.now();
      var act = [];
      if (payDown()) { act.push('payment provider DOWN'); }
      if (brokerDown()) { act.push('broker DOWN'); }
      if (st.workers.some(function (w) { return !w.alive; })) { act.push('a worker is down'); }
      status.textContent = act.length ? 'Active failures: ' + act.join(', ') : 'All systems healthy';
      fill(apiBox, st.pay.map(function (o) { return { label: '#' + o.id + (o.att ? ' r' + o.att : ''), cls: o.att ? 'dup' : '' }; }), 14);
      apiBox.state(payDown() ? 'is-dead' : '');
      apiBox.note.textContent = st.pay.length + ' waiting on the provider (r = retries)';
      fill(dbBox, st.outbox.map(function (o) { return { label: '#' + o.id, cls: 'dup' }; }), 14);
      dbBox.note.textContent = st.db.length + ' orders saved | ' + (resil ? st.outbox.length + ' event(s) waiting in outbox' : 'no outbox: publishes directly');
      brBox.state(brokerDown() ? 'is-dead' : '');
      fill(brBox, [], 1);
      brBox.note.textContent = brokerDown() ? 'DOWN' : 'up';
      fill(qBox, st.q.map(function (j) { return { label: '#' + j.o.id, cls: j.o.poison ? 'bad' : '' }; }), 18);
      qBox.note.textContent = st.q.length + ' waiting';
      fill(wBox, st.workers.map(function (w) { return { label: w.name + (!w.alive ? ' DOWN' : (w.job ? ' #' + w.job.o.id : ' idle')), cls: !w.alive ? 'bad' : (w.job ? (w.job.o.poison ? 'bad' : 'ok') : 'dup') }; }), 3);
      wBox.note.textContent = 'shipped ' + st.done + ' | poison redeliveries ' + st.loops;
      fill(dlqBox, st.dlq.map(function (i) { return { label: '#' + i, cls: 'bad' }; }), 8);
      dlqBox.note.textContent = st.dlq.length + ' parked for inspection';
      fill(outBox, st.shipped.slice(-10).map(function (i) { return { label: '#' + i, cls: 'ok' }; }), 10);
      outBox.note.textContent = st.done + ' shipped | duplicate events ignored: ' + st.dup;
      fill(lostBox, st.lostList.slice(-10).map(function (s) { return { label: s, cls: 'bad' }; }), 10);
      lostBox.note.textContent = 'payment rejected ' + st.payFail + ' | event lost ' + st.lostEvt + ' | job lost ' + st.lostJob + (st.loops ? ' | stuck loop' : '');
      lab.metrics.set('throughput', rate(st.done, now));
      lab.metrics.set('latency', avg(st.sum, st.done));
      lab.metrics.set('depth', st.q.length + st.outbox.length + st.pay.length);
      lab.metrics.set('errors', errors());
    }

    function summary() {
      sim.schedule(22000, function () {
        var e = errors();
        lab.explain(e
          ? '**Script finished with ' + e + ' failed or stuck order(s).** Without timeouts and retries the payment outage rejects customers; without an outbox the broker outage loses events; with auto-ack a worker crash loses its job; and an unbounded requeue lets one poison order spin forever. Switch on the resilience features and run it again.'
          : '**Script finished with no lost orders.** Retries with backoff rode out the payment outage, the outbox held events through the broker outage, manual acks recovered the crashed worker\'s job, and the poison order went to the DLQ. Costs: higher latency during failures, possible duplicates (handled by idempotent consumers), and more moving parts to monitor.');
      });
    }

    function seed() {
      rnd = Sim.random(5);
      st = { id: 0, pay: [], db: [], outbox: [], q: [], dlq: [], shipped: [], lostList: [], workers: [1, 2, 3].map(function (i) { return { name: 'W' + i, alive: true, busy: false, job: null, tok: 0 }; }), done: 0, sum: 0, payFail: 0, lostEvt: 0, lostJob: 0, loops: 0, dup: 0, payUntil: 0, brkUntil: 0, poisonNext: false };
      lab.log.clear(); lab.metrics.reset();
      lab.bar.setBroken(!resil);
      lab.explain('Resilience features: **' + (resil ? 'ON' : 'OFF') + '** (timeouts, retry with backoff and jitter, outbox, manual acks, delivery limit with DLQ, idempotent consumer). Failure script: **' + (chaos ? 'ON' : 'OFF') + '**. ' + (chaos ? 'Failures arrive at 3 s (payment), 8 s (broker), 12 s (worker crash) and 14 s (poison order). Watch the lost box.' : 'Press Play, then inject failures with the buttons.'));
      lab.log.log('Pipeline running. Orders every 0.7 s, three workers at 0.6 s per order.', { t: 0 });
      sim.schedule(0, newOrder); sim.schedule(100, relay);
      if (chaos) {
        sim.schedule(3000, payOutage); sim.schedule(8000, brokerOutage); sim.schedule(12000, crashWorker); sim.schedule(14000, poison);
        summary();
      }
      render();
    }

    sim.on('tick', render);
    sim.on('reset', seed);
    var chaosC = checkbox('Run the failure script', chaos, function (v) { chaos = v; sim.reset(); });
    var resC = checkbox('Resilience features', resil, function (v) { resil = v; sim.reset(); });
    var b1 = button('Payment outage 4 s', payOutage);
    var b2 = button('Broker outage 3 s', brokerOutage);
    var b3 = button('Crash a worker', crashWorker);
    var b4 = button('Inject poison order', poison);
    seed();
    return h('div', { class: 'lab-wrap' }, [h('div', { class: 'lab-controls', role: 'group', 'aria-label': 'Lab settings' }, [chaosC, resC, b1, b2, b3, b4].map(function (c) { return c.el; })), lab.el]);
  }

  /* ================= LEVELS ================= */

  function levelTabs() {
    return UI.tabs({
      label: 'Capstone at three levels',
      tabs: [
        { id: 'beginner', label: 'Beginner', content: function () {
          return levelPane(
            'The capstone joins everything. A customer places an order. The website must **not freeze** while the card is charged (**async**). The order must be **remembered** even if something crashes (**database**). Slow jobs such as packing are put in a **queue** so a rush of orders does not overwhelm the warehouse, and a fixed team of **workers** handles them (**threads**). Finally, the system announces "order shipped" as an **event** that email and analytics react to.\n\nThe point is not the tools, but the habit: for every arrow in the diagram ask, "what happens if this step fails, is slow, or runs twice?"',
            'A restaurant with a till, a ticket rail and a kitchen team. The cashier takes payment without freezing the line; tickets wait on the rail during a rush; cooks take tickets one at a time; if a cook faints, the ticket goes back on the rail.',
            '- Testing only the happy path.\n- Thinking the queue fixes slow workers. It only buffers; capacity must still match demand.\n- Assuming a retry is always safe. Retrying a charge can double-charge unless it is idempotent.',
            'Everything works in the demo, then a payment outage, a broker restart and a bad order arrive in the same hour.'
          );
        } },
        { id: 'intermediate', label: 'Intermediate', content: function () {
          return levelPane(
            '**Map each concern to a tool.** Remote call to a provider: async with a **timeout**, bounded **retries**, **exponential backoff and jitter**, and an **idempotency key**. Saving plus announcing: **transactional outbox**. Spike absorption and decoupling: a **queue** with a bounded length. Heavy work: a **worker pool** sized to cores, with **manual acks**, **prefetch** and a **delivery limit**. Bad messages: **dead letter queue**. Fan-out: **events** with **idempotent consumers**. Debugging: **correlation ids** and metrics for queue depth, age and redeliveries.\n\n**Failure matrix.** Payment slow: retries then reject politely. Broker down: orders still accepted, events wait in the outbox. Worker crash: unacked job redelivered. Poison message: dead-lettered after N tries. Consumer duplicates: ignored.',
            'An airline: booking is accepted even when the baggage system is down; the baggage request waits in an outbox and is delivered when it recovers.',
            '- Retrying everything at every layer, multiplying load (retry storms).\n- Adding a DLQ and never reading it.\n- Idempotency on the consumer but not on the payment call.',
            'During a provider outage every service retries at once, the retries become the traffic, and recovery takes far longer than the outage.'
          );
        } },
        { id: 'advanced', label: 'Advanced', content: function () {
          return levelPane(
            '**Capacity and backpressure.** Know your arrival rate, service time and worker count; when arrival exceeds capacity the queue grows without bound. Bound queues, shed or defer load, autoscale on queue age, and apply backpressure to callers. **Retry budgets** and circuit breakers stop retry storms. Prefer **timeouts shorter than the caller\'s own timeout**.\n\n**Consistency.** The order flow is a **saga**: if fulfilment fails after payment, compensate with a refund. Each hop is at-least-once, so every handler is idempotent. Ordering matters per order, not globally: key by order id.\n\n**Operations.** Alert on oldest-message age, DLQ growth, outbox backlog, redelivery rate, consumer lag and saturation, not just CPU. Practise failure with game days. Plan replay and recovery runbooks, retention that exceeds outage length, and schema evolution for every event.',
            'An air-traffic system: it is designed around what happens when a radar, a radio or a controller fails, and the drills are rehearsed before the real emergency.',
            '- Believing the architecture is "resilient" because it uses a broker.\n- Never testing recovery, only the failure.\n- Ignoring cost: more components mean more to deploy, secure and monitor.',
            'Backlog hides a stuck consumer for hours, a DLQ silently collects thousands of orders, or a replay re-sends every customer email.'
          );
        } }
      ]
    }).el;
  }

  /* ================= PREDICT ================= */

  function predict() {
    var WAITS = [0, 500, 1500, 3500];
    return UI.predictChallenge({
      question: 'The API retries a failing payment call. Waits between attempts double: 0.5 s, 1 s, 2 s, 4 s (ignore call duration and jitter). How long after the FIRST attempt does the 4th attempt start?',
      setup: 'Attempt 1 at 0 s. Wait 0.5 s, attempt 2. Wait 1 s, attempt 3. Wait 2 s, attempt 4.',
      options: ['1.5 s', '3.5 s', '7.5 s', '2 s'],
      answer: 1,
      duration: 4000,
      speed: 4,
      explain: 'Attempts start at 0, 0.5, 0.5 + 1 = 1.5 and 1.5 + 2 = **3.5 s**. Exponential backoff spreads retries out so a struggling provider gets room to recover; **jitter** adds randomness so thousands of clients do not retry in lockstep.',
      simulate: function (ctx) {
        var s = ctx.sim;
        var out = h('p', { class: 'ui-box', text: 'Attempts started: 0' });
        ctx.stage.appendChild(out);
        ctx.state = { last: 0, n: 0 };
        WAITS.forEach(function (t, i) {
          s.schedule(t, function () {
            ctx.state.n = i + 1; ctx.state.last = t;
            out.textContent = 'Attempts started: ' + (i + 1) + ' (latest at ' + (t / 1000) + ' s)';
            ctx.log('Attempt ' + (i + 1) + ' starts at ' + (t / 1000) + ' s.', { t: s.now(), level: i === 3 ? 'ok' : 'warn' });
          });
        });
      },
      measure: function (ctx) { return 'The 4th attempt started at ' + (ctx.state.last / 1000) + ' s.'; }
    }).el;
  }

  /* ================= CHEAT SHEET, INTERVIEW, NEXT ================= */

  function cheatSheet() {
    var items = [
      ['Slow external call', 'Async I/O, timeout, bounded retries, exponential backoff with jitter, idempotency key, circuit breaker.'],
      ['Save and announce', 'Transactional outbox or CDC. Never dual-write database and broker.'],
      ['Absorb spikes', 'Bounded queue between stages. Monitor depth and oldest-message age. Autoscale on age.'],
      ['Heavy work', 'Fixed worker pool sized to cores (CPU) or concurrency limit (I/O). Manual acks, sensible prefetch.'],
      ['Bad messages', 'Delivery limit, dead letter queue, alert on DLQ, replay deliberately after a fix.'],
      ['Duplicates', 'Assume at-least-once. Dedupe on event id in the same transaction as the effect.'],
      ['Distributed failure', 'Saga with compensations, persisted state, irreversible steps last.'],
      ['Observability', 'Correlation id everywhere, traces, lag, redeliveries, outbox backlog, saturation.'],
      ['Before launch', 'Kill a broker, a worker and a provider on purpose. Confirm nothing is lost and recovery needs no heroics.']
    ];
    return h('div', { class: 'cheat' }, items.map(function (it) {
      return h('div', { class: 'cheat-item' }, [h('h4', { text: it[0] }), UI.rich(it[1])]);
    }));
  }

  function interview() {
    return UI.accordion({ items: [
      { title: 'Design the backend for "Place Order". Walk me through failure modes.', body: 'Accept the request with non-blocking I/O. Call the payment provider with an idempotency key, a timeout and bounded retries with backoff and jitter. In one transaction save the order and an outbox row. A relay publishes "OrderPlaced" to a broker; a bounded queue feeds a worker pool for fulfilment with manual acks, a delivery limit and a DLQ. Shipped orders emit events consumed idempotently by email and analytics. For each hop, state what happens on slowness, failure, and duplicate delivery, and what you alert on.' },
      { title: 'The payment provider is down for 10 minutes. What happens in your design?', body: 'Calls time out; the API retries with backoff and jitter up to a limit, guarded by a circuit breaker so the system stops hammering it. Beyond the limit, either reject with a clear message or accept the order as "pending payment" and finish asynchronously via a queue. Idempotency keys prevent double charges when the provider recovers.' },
      { title: 'Why not just call the warehouse service directly from the API?', body: 'It couples availability and latency: if the warehouse is slow, checkout is slow. A queue/broker decouples them in time, absorbs spikes and lets the warehouse scale independently. The cost is eventual consistency and more things to monitor, so for a small system direct calls may be perfectly fine.' },
      { title: 'How do you size the worker pool and the queue?', body: 'From arrival rate, service time and acceptable latency (Little\'s law: concurrency = rate x time). CPU-bound work: about one worker per core. I/O-bound work: more, bounded by downstream limits. Bound the queue so overload becomes visible (backpressure or shedding) instead of unbounded memory and latency, and autoscale on queue age.' },
      { title: 'How do you prevent duplicate emails or double shipping?', body: 'Every event has a unique id; the consumer records processed ids in the same transaction as the side effect (or checks a sent-table keyed by the id). For external calls pass an idempotency key. Never rely on the broker for exactly-once.' },
      { title: 'A single order keeps failing. What does your system do, and what do you do?', body: 'After the delivery limit, the message goes to the dead letter queue so it stops blocking workers. An alert fires. You inspect the payload and x-death headers, fix the code or data, and replay the message deliberately, checking replay does not re-trigger side effects.' },
      { title: 'How would you test that this actually survives failures?', body: 'Automated fault-injection tests and game days: kill the broker, restart workers mid-job, add latency or errors to the provider, send a poison message, and replay duplicates. Assert invariants: every accepted order is shipped, cancelled or in the DLQ; none is charged twice; and queues drain after recovery.' },
      { title: 'What would you monitor on day one?', body: 'Per stage: throughput, latency percentiles, error rate. Queues: depth and oldest-message age, redeliveries, DLQ size. Outbox backlog. Worker saturation. Provider error rate and retry volume. Business metrics: orders accepted vs shipped. Page on symptoms users feel (orders not shipping), not just machine metrics.' }
    ] }).el;
  }

  function nextSteps() {
    return h('div', { class: 'card' }, [
      h('div', { class: 'card-title' }, [h('h3', { text: 'Where to go from here' })]),
      UI.rich('- **Build it:** implement this flow with a real broker locally (RabbitMQ or Kafka in Docker) and break it on purpose.\n- **Read:** your language\'s concurrency docs, the Kafka and RabbitMQ documentation, and "Designing Data-Intensive Applications".\n- **Practise:** re-open any lab, press **Break it**, and explain out loud why it fails before reading the caption.\n- **Remember:** most reliability comes from asking, for every arrow, "what if this is slow, fails, or happens twice?"')
    ]);
  }

  /* ================= MOUNT ================= */

  function mount(el) {
    el.appendChild(h('div', { class: 'topic-intro' }, [h('p', { class: 'lead', text: 'Time to combine everything: threads, async calls, a queue, a broker and events in one order flow, then break it.' })]));
    el.appendChild(diagram());
    el.appendChild(storyBlock());
    el.appendChild(title('Learn it at your level'));
    el.appendChild(levelTabs());
    el.appendChild(title('Capstone lab', 'Inject failures one by one, or run the full script with and without resilience.'));
    el.appendChild(labPlaceOrder());
    el.appendChild(title('Predict the outcome'));
    el.appendChild(predict());
    el.appendChild(title('Quiz', '5 questions. Score 70% or more to complete the course.'));
    el.appendChild(UI.quiz({ title: 'Capstone quiz', topicId: 'capstone', questions: (global.QUIZZES && global.QUIZZES.capstone) || [], passPct: 70 }).el);
    el.appendChild(title('Production checklist'));
    el.appendChild(cheatSheet());
    el.appendChild(title('System-design interview questions', 'Try answering out loud before opening each one.'));
    el.appendChild(interview());
    el.appendChild(nextSteps());
  }

  global.App.registerTopic({ id: 'capstone', title: 'Capstone: Place Order', accent: 'capstone', mount: mount });
})(window);
