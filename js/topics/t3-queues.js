/*
 * t3-queues.js - Topic 3: Message Queues.
 * Story, level tabs, eight labs, predict challenge, quiz, cheat sheet and interview questions.
 * Follows the frozen contract: Sim.create, UI.lab/controlBar/logPanel/metrics, App.registerTopic.
 */
(function (global) {
  'use strict';

  var UI = global.UI;
  var Sim = global.Sim;
  var h = UI.h;
  var uid = 0;

  /* ================= shared helpers ================= */

  function segmented(label, options, initial, onChange) {
    var name = 't3seg' + (++uid);
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
    var id = 't3cb' + (++uid);
    var inp = h('input', { type: 'checkbox', id: id });
    inp.checked = !!checked;
    inp.addEventListener('change', function () { onChange(inp.checked); });
    return { el: h('label', { class: 'ctl', for: id }, [inp, h('span', { text: label })]), get: function () { return inp.checked; }, set: function (v) { inp.checked = !!v; } };
  }

  function slider(label, min, max, val, step, fmt, onChange) {
    var id = 't3sl' + (++uid);
    var out = h('output', { text: fmt(val) });
    var inp = h('input', { type: 'range', id: id, min: min, max: max, step: step, value: val });
    inp.addEventListener('input', function () { out.textContent = fmt(+inp.value); });
    inp.addEventListener('change', function () { onChange(+inp.value); });
    return {
      el: h('label', { class: 'ctl', for: id }, [h('span', { text: label }), inp, out]),
      get: function () { return +inp.value; },
      set: function (v) { inp.value = v; out.textContent = fmt(v); }
    };
  }

  function button(text, fn) {
    var b = h('button', { class: 'btn btn-sm', type: 'button', text: text });
    b.addEventListener('click', fn);
    return { el: b, node: b };
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

  function mkBox(name, cls) {
    var items = h('div', { class: 'qv-items' });
    var note = h('div', { class: 'qv-note' });
    var el = h('div', { class: 'qv-box ' + (cls || '') }, [h('h4', { text: name }), items, note]);
    return { el: el, items: items, note: note, state: function (c) { el.className = 'qv-box ' + (cls || '') + (c ? ' ' + c : ''); } };
  }

  function fill(box, list, max) {
    var lim = max || 30;
    box.items.innerHTML = '';
    list.slice(0, lim).forEach(function (m) { box.items.appendChild(h('span', { class: 'qv-msg ' + (m.cls || ''), text: String(m.label) })); });
    if (list.length > lim) { box.items.appendChild(h('span', { class: 'qv-note', text: '+' + (list.length - lim) + ' more' })); }
  }

  function avg(sum, n) { return n ? Math.round(sum / n) : NaN; }

  var BARH = 124;
  function makeBars(n, o) {
    var cols = [];
    var line = h('div', { class: 'bars-line' }, [h('span', { text: o.lineLabel || '' })]);
    var box = h('div', { class: 'bars', role: 'img', 'aria-label': o.label }, [line]);
    for (var i = 0; i < n; i++) {
      var col = h('div', { class: 'bars-col' });
      var seg = h('i', { class: 'd' });
      col.appendChild(seg);
      cols.push(seg);
      box.appendChild(col);
    }
    return {
      el: box,
      set: function (i, v, scale) { cols[i].style.height = (Math.min(v, scale) / scale * BARH) + 'px'; },
      setLine: function (v, scale) { line.style.bottom = (v / scale * BARH) + 'px'; line.style.display = v > 0 ? '' : 'none'; }
    };
  }

  /* ================= THE STORY ================= */

  function storyBlock() {
    var tickets = [];
    for (var i = 0; i < 6; i++) {
      var t = h('i', { class: 'qt' });
      t.style.setProperty('--d', (-i) + 's');
      tickets.push(t);
    }
    var scene = h('div', { class: 'qstory', role: 'img', 'aria-label': 'Animated restaurant: waiters clip order tickets onto a rail and a cook takes them off at a steady pace' }, [
      h('div', { class: 'qs-who', text: 'Waiters (producers)' }),
      h('div', { class: 'qs-rail' }, tickets),
      h('div', { class: 'qs-who', text: 'Cook (consumer)' })
    ]);
    UI.onVisible(scene, function () { scene.classList.remove('is-paused'); }, function () { scene.classList.add('is-paused'); });
    var stepper = UI.stepper({
      steps: [
        { title: '0:00 A restaurant without a rail', body: 'Waiters shout orders straight at the cook. At a quiet hour it works. When a coach party arrives, the cook is interrupted constantly, shouted orders get missed, and waiters stand around waiting for an answer. Both sides are **tied together in time**.' },
        { title: '0:15 Add an order rail', body: 'Now waiters clip a **ticket** on a rail and walk away. The cook takes the next ticket when ready. The rail is a **queue**: it holds work between the one who asks and the one who does it.' },
        { title: '0:30 The rush', body: 'During the rush tickets pile up on the rail, but nobody is shouted at and no order is dropped. The cook works at a steady speed and the pile shrinks after the rush. A queue **absorbs bursts**. It does not make the cook faster, so customers wait longer, not never.' },
        { title: '0:45 When things go wrong', body: 'If the cook drops a ticket on the floor, that order is lost unless someone notices. So the cook only tears the ticket off the rail when the dish is **done** (an acknowledgement). If the cook faints mid-order, the ticket stays and another cook takes it. That is **at-least-once delivery**, and it means the same dish can occasionally be made twice.' },
        { title: '0:55 Rules for a healthy rail', body: 'Limit retries on a bad ticket and put it in a **dead-letter tray**. Throw away tickets that are too old to matter (**TTL**). Hire more cooks when the pile grows (**autoscaling**). The labs below let you cause each of these problems.' }
      ]
    });
    return h('div', { class: 'card' }, [
      h('div', { class: 'card-title' }, [h('h3', { text: 'The Story: the restaurant order rail' })]),
      scene, stepper.el
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

  var JS_IDEM = "// At-least-once delivery means this handler WILL see duplicates.\nasync function handle(msg) {\n  await db.tx(async (tx) => {\n    // the unique key makes the insert fail on a duplicate delivery\n    const inserted = await tx.query(\n      'INSERT INTO processed_messages(id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id',\n      [msg.id]\n    );\n    if (inserted.rowCount === 0) return;          // already done: just ack\n    await tx.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [msg.amount, msg.account]);\n  });                                              // effect and dedupe record commit together\n  channel.ack(rawMessage);                         // ack only after the commit\n}";
  var PY_SQS = "import boto3\nsqs = boto3.client('sqs')\n\nwhile True:\n    resp = sqs.receive_message(\n        QueueUrl=URL, MaxNumberOfMessages=10,\n        WaitTimeSeconds=20,            # long polling: fewer empty responses\n        VisibilityTimeout=60)          # must exceed worst-case processing time\n    for m in resp.get('Messages', []):\n        try:\n            process(m['Body'])         # must be idempotent\n            sqs.delete_message(QueueUrl=URL, ReceiptHandle=m['ReceiptHandle'])\n        except Exception:\n            pass                       # no delete: it reappears after the timeout\n                                       # a redrive policy moves it to a DLQ after maxReceiveCount";

  function levelTabs() {
    var idem = UI.codePanel({ title: 'Consumer patterns', tabs: [
      { lang: 'javascript', label: 'Idempotent consumer (JS)', code: JS_IDEM },
      { lang: 'python', label: 'Polling consumer (SQS, Python)', code: PY_SQS }
    ] });
    return UI.tabs({
      label: 'Message queues at three levels',
      tabs: [
        { id: 'beginner', label: 'Beginner', content: function () {
          return levelPane(
            'A **message** is a small piece of data that says "something happened" or "please do this". A **queue** is a line of messages waiting to be handled. The program that adds messages is the **producer**; the program that takes them off is the **consumer**. A **broker** is the server that stores the line safely (RabbitMQ, Amazon SQS, Kafka and others).\n\nWhy bother? Without a queue the sender must wait for the receiver, and both must be running at the same moment. With a queue the sender hands over the message and carries on. The receiver can be slow, restarted or temporarily down, and the message is still there.\n\nTwo shapes matter. **Point-to-point**: many consumers share one queue and each message goes to exactly one of them (work sharing). **Publish/subscribe**: each subscriber gets its own copy of every message (broadcasting).',
            'A post office. You drop a letter in the box and leave. You do not wait for the recipient to read it. Point-to-point is one letter to one person; publish/subscribe is a newsletter where everyone on the list gets a copy.',
            '- "A queue makes my system faster". It smooths bursts; total capacity is still set by the consumers.\n- "A queue never loses messages". Only if it is durable, replicated and you acknowledge correctly.\n- "Each message is processed exactly once". Usually it is **at least once**, so duplicates happen.\n- "A queue is a database". Messages are meant to be consumed and removed, not queried.',
            'Traffic spikes arrive and a service with no buffer rejects requests or falls over. A queue would have turned that into a short delay.'
          );
        } },
        { id: 'intermediate', label: 'Intermediate', content: function () {
          return levelPane(
            '**Acknowledgements.** A broker keeps a message until the consumer **acks** it. If the consumer dies first, the message is redelivered. Ack **after** the work for at-least-once; ack **before** for at-most-once (fast, but a crash loses the message).\n\n**Delivery semantics.** At-most-once may lose, at-least-once may duplicate, and "exactly-once" is really **at-least-once delivery plus an idempotent consumer** (the effect happens once even if the message arrives twice). Make operations idempotent with a unique message id, a processed-ids table written in the same transaction as the effect, or naturally idempotent updates such as "set status = PAID".\n\n**Failure handling.** A **poison message** fails every time. Cap redeliveries and route it to a **dead letter queue (DLQ)**. **Visibility timeout** (SQS style) hides a received message for a while; if you do not delete it in time it reappears. **TTL** expires messages that are too old to be useful.\n\n**Scaling.** Add competing consumers to a queue; watch **queue depth** and **oldest message age**, and autoscale on them.',
            'A restaurant ticket rail. The cook only removes the ticket when the dish is served (ack). A ticket that keeps ruining dishes goes in a "problem orders" tray (DLQ). Tickets older than an hour are discarded because the customer left (TTL).',
            '- Acking before processing "to be safe" and then losing work on a crash.\n- Retrying a failing message forever, immediately, blocking everything behind it.\n- A visibility timeout shorter than the slowest job, causing duplicate processing.\n- Believing the broker can guarantee exactly-once side effects in your database. It cannot.\n- Using a DLQ as a graveyard nobody looks at.',
            'A slow dependency pushes processing time past the visibility timeout, messages reappear while still being worked on, load doubles and the system spirals.',
            idem.el
          );
        } },
        { id: 'advanced', label: 'Advanced', content: function () {
          return levelPane(
            '**Ordering vs parallelism.** More consumers on one queue means messages can finish out of order. Keep order per entity by routing the same key to the same consumer (message groups in SQS FIFO, single active consumer or consistent-hash routing in RabbitMQ, partitions in Kafka, next topic). Strict global ordering limits you to one consumer.\n\n**Redelivery design.** Use a **delivery limit** (RabbitMQ quorum queues support `delivery-limit`; SQS has `maxReceiveCount` in a redrive policy), retry with **delayed backoff** rather than instant requeue, and alert on DLQ depth. A DLQ needs an owner, a reason code on every message and a tested **redrive** procedure.\n\n**Producer side.** A producer can crash between saving to its database and publishing, or between publishing and saving. The **outbox pattern** (write the message to an outbox table in the same transaction, relay it afterwards) fixes that dual-write problem; it appears in the event-driven topic.\n\n**Flow control.** Unbounded queues hide overload until memory or disk runs out. Use length limits, prefetch (consumer window) limits, producer confirms and backpressure. Monitor **consumer lag**, depth, **oldest message age** and DLQ rate, not only CPU.\n\n**Autoscaling pitfalls.** Scale-up lags (instances take time to start), scale-down can flap, and more consumers just move the bottleneck to the database or a rate-limited API. Cap the maximum and size for the downstream limit.\n\n**Payloads.** Keep messages small; put big blobs in object storage and send a reference (claim-check).',
            'A sorting office with numbered trolleys. Letters for the same address always go to the same trolley so they stay in order. Letters that bounce three times go to a supervisor. Old flyers are binned. The office hires temporary staff when the pile grows, but only as many as the loading dock can handle.',
            '- Treating FIFO as a guarantee when several consumers process in parallel.\n- Thinking DLQ replay is safe without checking that the bug is actually fixed.\n- Scaling consumers without checking the database connection limit.\n- Forgetting that TTL in some brokers is checked lazily at the head of the queue.\n- Putting secrets or huge payloads into messages that are retained and logged.',
            '- A poison message at the head of a queue that is requeued immediately blocks the entire stream.\n- A DLQ silently fills for weeks and then someone replays 2 million stale orders.\n- A retry loop with no backoff multiplies load on a struggling database.\n- The producer wrote to the database but crashed before publishing, so downstream systems never hear about the order.\n- Autoscaling to 200 consumers takes the database down.'
          );
        } }
      ]
    }).el;
  }

  /* ================= LAB 1: traffic spike with vs without a queue ================= */

  function labSpike() {
    var SERVICE = 100, LIMIT = 5, S0 = 2000, S1 = 6000, BASE = 5, WIN = 60;
    var sim = Sim.create({ speed: 1 });
    var mode = 'queue', spike = 40, st;
    var qBox = mkBox('Waiting line'), wBox = mkBox('Server (10 requests / s)'), okBox = mkBox('Served'), rejBox = mkBox('Rejected (503)', 'dlq');
    var chart = makeBars(WIN, { label: 'Waiting line length over the last 30 seconds', lineLabel: '' });
    var cap = h('div', { class: 'bars-cap' }, [h('span', { text: '30 s ago' }), h('span', { text: 'now' })]);
    var stage = h('div', {}, [h('div', { class: 'qv' }, [qBox.el, wBox.el, okBox.el, rejBox.el]), chart.el, cap]);

    var lab = UI.lab({
      title: 'Lab 1: traffic spike, with and without a queue',
      subtitle: 'The server can do 10 requests per second. Normal traffic is 5 per second; a spike hits from 2 s to 6 s.',
      sim: sim, stage: stage,
      stageLabel: 'Requests arriving at a server directly or through a queue',
      breakLabel: 'Break it: remove the queue (direct calls)',
      fixLabel: 'Fix it: put a queue in front',
      onBreak: function (broken) { mode = broken ? 'direct' : 'queue'; seg.set(mode); sim.reset(); sim.play(); },
      caption: 'Press Play. The spike starts at 2 s.'
    });

    function render() {
      fill(qBox, st.q.map(function (m) { return { label: m.id }; }), 40);
      qBox.note.textContent = st.q.length + ' waiting (peak ' + st.peak + ')';
      fill(wBox, st.busy ? [{ label: st.busy.id, cls: 'ok' }] : [], 1);
      wBox.state(st.busy ? 'is-busy' : '');
      okBox.items.innerHTML = '';
      okBox.note.textContent = st.done + ' served';
      rejBox.items.innerHTML = '';
      rejBox.note.textContent = st.rej + ' rejected';
      var secs = sim.now() / 1000;
      lab.metrics.set('throughput', secs > 0 ? st.done / secs : 0);
      lab.metrics.set('latency', avg(st.waitSum, st.done));
      lab.metrics.set('depth', st.q.length);
      lab.metrics.set('errors', st.rej);
    }

    function pump() {
      if (st.busy || !st.q.length) { return; }
      var m = st.q.shift();
      st.busy = m;
      sim.schedule(SERVICE, function () { st.busy = null; st.done++; st.waitSum += sim.now() - m.t0; pump(); render(); });
    }

    function arrive() {
      var t = sim.now();
      var r = (t >= S0 && t < S1) ? spike : BASE;
      var m = { id: ++st.id, t0: t };
      if (mode === 'direct' && st.q.length >= LIMIT) {
        st.rej++;
        if (st.rej % 15 === 1) { lab.log.log('Server overloaded: request #' + m.id + ' rejected (' + st.rej + ' so far). The client sees an error.', { t: t, level: 'err' }); }
      } else {
        st.q.push(m);
        if (st.q.length > st.peak) { st.peak = st.q.length; }
      }
      pump(); render();
      sim.schedule(1000 / r, arrive);
    }

    function draw() {
      var sc = 20;
      st.samples.forEach(function (v) { sc = Math.max(sc, v); });
      for (var i = 0; i < WIN; i++) { chart.set(i, st.samples[i] === undefined ? 0 : st.samples[i], sc); }
    }

    function sample() {
      st.samples.push(st.q.length);
      if (st.samples.length > WIN) { st.samples.shift(); }
      sim.schedule(500, sample);
    }

    function seed() {
      st = { q: [], busy: null, id: 0, done: 0, rej: 0, waitSum: 0, peak: 0, samples: [] };
      lab.log.clear(); lab.metrics.reset();
      lab.bar.setBroken(mode === 'direct');
      lab.explain(mode === 'queue'
        ? 'With a queue every request is accepted, even during the spike. The line grows, then drains at 10 per second after the spike ends. Nothing is lost, but requests wait longer. A queue **moves** the problem from "errors" to "delay".'
        : 'Direct calls: the server can only hold 5 waiting requests, so during the spike most arrivals are rejected. Press **Fix it** to compare with a queue.');
      lab.log.log('Normal 5 req/s. Spike of ' + spike + ' req/s from 2 s to 6 s. Mode: ' + (mode === 'queue' ? 'queue (unbounded)' : 'direct (5 waiting slots)') + '.', { t: 0 });
      sim.schedule(0, arrive);
      sim.schedule(500, sample);
      sim.schedule(S0, function () { lab.log.log('SPIKE starts: ' + spike + ' requests per second.', { t: sim.now(), level: 'warn' }); });
      sim.schedule(S1, function () { lab.log.log('Spike ends. Back to 5 req/s.', { t: sim.now(), level: 'ok' }); });
      sim.schedule(8000, function () {
        lab.explain(mode === 'queue'
          ? '**Queue absorbed the spike.** Peak line length: ' + st.peak + ', rejected: ' + st.rej + '. The cost is latency (see the average wait). Honest trade-off: a queue does not add capacity. If the spike lasted for hours the line would grow without limit, so you also need a maximum size, backpressure or more consumers (Lab 8).'
          : '**No buffer, so errors.** ' + st.rej + ' requests were rejected during the spike even though the server was idle again 4 seconds later. The work was short-lived; the failures were permanent for those callers.');
      });
      render(); draw();
    }

    sim.on('tick', draw);
    sim.on('reset', seed);
    var seg = segmented('Architecture', [['queue', 'With a queue'], ['direct', 'Direct (no queue)']], mode, function (v) { mode = v; sim.reset(); });
    var sp = slider('Spike rate', 20, 80, spike, 5, function (v) { return v + '/s'; }, function (v) { spike = v; sim.reset(); });
    seed();
    return wrap([seg, sp], lab);
  }

  /* ================= LAB 2: point-to-point vs pub/sub ================= */

  function labFanout() {
    var PRODUCE = 600, WORK = 900;
    var sim = Sim.create({ speed: 1 });
    var mode = 'p2p', durable = false, st;
    var qBox = mkBox('Shared queue');
    var consWrap = h('div', { class: 'qv-grid' });
    var stage = h('div', {}, [h('div', { class: 'qv' }, [qBox.el]), consWrap]);

    var lab = UI.lab({
      title: 'Lab 2: point-to-point vs publish/subscribe',
      subtitle: 'A producer publishes a message every 0.6 s. Add and remove consumers while it runs, and crash one.',
      sim: sim, stage: stage,
      stageLabel: 'Producer, queue and consumers',
      breakLabel: 'Break it: crash consumer C1',
      fixLabel: 'Fix it: restart crashed consumers',
      onBreak: function (broken) {
        if (broken) { var c = st.cons.filter(function (x) { return x.alive; })[0]; if (c) { kill(c, true); } }
        else { st.cons.forEach(function (c) { if (!c.alive) { revive(c); } }); }
        render();
      },
      caption: 'Press Play. Try both modes.'
    });

    function total() { return st.sq.length + st.cons.reduce(function (a, c) { return a + c.q.length; }, 0); }

    function render() {
      qBox.el.style.display = mode === 'p2p' ? '' : 'none';
      fill(qBox, st.sq.map(function (m) { return { label: m.id }; }), 30);
      qBox.note.textContent = st.sq.length + ' waiting';
      consWrap.innerHTML = '';
      st.cons.forEach(function (c) {
        var b = mkBox(c.name + (c.alive ? '' : ' (crashed)'));
        b.state(!c.alive ? 'is-dead' : (c.cur ? 'is-busy' : ''));
        var list = c.cur ? [{ label: c.cur.id, cls: 'ok' }] : [];
        if (mode === 'pubsub') { list = list.concat(c.q.map(function (m) { return { label: m.id, cls: c.alive ? '' : 'hid' }; })); }
        fill(b, list, 12);
        b.note.textContent = 'handled ' + c.done + (mode === 'pubsub' ? ' | own queue ' + c.q.length : '');
        consWrap.appendChild(b.el);
      });
      if (!st.cons.length) { consWrap.appendChild(h('p', { class: 'qv-note', text: 'No consumers. Add one.' })); }
      var secs = sim.now() / 1000;
      lab.metrics.set('throughput', secs > 0 ? st.done / secs : 0);
      lab.metrics.set('latency', avg(st.sum, st.done));
      lab.metrics.set('depth', total());
      lab.metrics.set('errors', st.lost);
    }

    function dispatch() {
      st.cons.forEach(function (c) {
        if (!c.alive || c.cur) { return; }
        var m = mode === 'p2p' ? st.sq.shift() : c.q.shift();
        if (!m) { return; }
        c.cur = m;
        var tok = ++c.tok;
        sim.schedule(WORK, function () {
          if (c.tok !== tok) { return; }
          c.cur = null; c.done++; st.done++; st.sum += sim.now() - m.t0;
          lab.log.log(c.name + ' processed message #' + m.id + '.', { t: sim.now(), level: 'ok' });
          dispatch(); render();
        });
      });
    }

    function publish() {
      var m = { id: ++st.n, t0: sim.now() };
      if (mode === 'p2p') {
        st.sq.push(m);
        lab.log.log('Published #' + m.id + ' to the queue (one consumer will get it).', { t: sim.now() });
      } else if (!st.cons.length) {
        st.lost++;
        lab.log.log('Published #' + m.id + ' but there are no subscribers: it is discarded.', { t: sim.now(), level: 'warn' });
      } else {
        lab.log.log('Published #' + m.id + ' to the topic: every subscriber gets a copy.', { t: sim.now() });
        st.cons.forEach(function (c) {
          if (c.alive || durable) { c.q.push({ id: m.id, t0: m.t0 }); }
          else { st.lost++; lab.log.log(c.name + ' is offline and not durable: its copy of #' + m.id + ' is LOST.', { t: sim.now(), level: 'err' }); }
        });
      }
      dispatch(); render();
      sim.schedule(PRODUCE, publish);
    }

    function kill(c, crash) {
      c.alive = false; c.tok++;
      if (c.cur) {
        if (mode === 'p2p') { st.sq.unshift(c.cur); lab.log.log(c.name + ' ' + (crash ? 'crashed' : 'left') + ' while handling #' + c.cur.id + '. No ack, so the broker puts it back on the queue for another consumer.', { t: sim.now(), level: 'warn' }); }
        else if (durable || !crash) { c.q.unshift(c.cur); lab.log.log('#' + c.cur.id + ' stays in ' + c.name + '\'s durable queue.', { t: sim.now(), level: 'warn' }); }
        else { st.lost++; lab.log.log(c.name + ' crashed holding #' + c.cur.id + ' and its subscription is not durable: the message is LOST.', { t: sim.now(), level: 'err' }); }
        c.cur = null;
      } else if (crash) { lab.log.log(c.name + ' crashed.', { t: sim.now(), level: 'err' }); }
      dispatch();
    }

    function revive(c) { c.alive = true; lab.log.log(c.name + ' restarted' + (mode === 'pubsub' && durable ? ' and catches up on its durable queue.' : '.'), { t: sim.now(), level: 'ok' }); dispatch(); }

    function addConsumer() {
      var c = { id: ++st.nextC, name: 'C' + st.nextC, alive: true, cur: null, q: [], tok: 0, done: 0 };
      st.cons.push(c);
      lab.log.log(c.name + ' joined' + (mode === 'p2p' ? ' and starts sharing the queue.' : ' and only receives messages published from now on.'), { t: sim.now(), level: 'ok' });
      dispatch(); render();
    }

    function removeConsumer() {
      if (!st.cons.length) { return; }
      var c = st.cons[st.cons.length - 1];
      kill(c, false);
      st.cons.pop();
      lab.log.log(c.name + ' removed.', { t: sim.now() });
      render();
    }

    function seed() {
      st = { cons: [], sq: [], n: 0, nextC: 0, done: 0, lost: 0, sum: 0 };
      st.cons.push({ id: 1, name: 'C1', alive: true, cur: null, q: [], tok: 0, done: 0 });
      st.cons.push({ id: 2, name: 'C2', alive: true, cur: null, q: [], tok: 0, done: 0 });
      st.nextC = 2;
      lab.log.clear(); lab.metrics.reset();
      lab.bar.setBroken(false);
      lab.explain(mode === 'p2p'
        ? '**Point-to-point (work queue).** Consumers compete: each message goes to exactly one. Adding a consumer raises capacity; removing or crashing one just means the others take over, and the unacknowledged message is put back.'
        : '**Publish/subscribe.** Every subscriber gets its own copy of every message, so adding a consumer does **not** add capacity. A new subscriber sees only new messages. A non-durable subscriber that is offline misses messages; a durable one keeps a queue until it returns.');
      lab.log.log((mode === 'p2p' ? 'Point-to-point' : 'Publish/subscribe') + ' with C1 and C2. Press Play.', { t: 0 });
      sim.schedule(100, publish);
      render();
    }

    sim.on('reset', seed);
    var seg = segmented('Pattern', [['p2p', 'Point-to-point (one queue)'], ['pubsub', 'Publish/subscribe (copies)']], mode, function (v) { mode = v; sim.reset(); });
    var dur = checkbox('Durable subscriptions (pub/sub)', durable, function (v) { durable = v; sim.reset(); });
    var add = button('Add consumer', function () { addConsumer(); });
    var rem = button('Remove consumer', function () { removeConsumer(); });
    seed();
    return wrap([seg, dur, add, rem], lab);
  }

  /* ================= LAB 3: delivery semantics ================= */

  function labDelivery() {
    var N = 10, GAP = 600, WORK = 700, EFFECT = 350, RESTART = 1500;
    var sim = Sim.create({ speed: 1 });
    var mode = 'alo', armed = false, st;
    var qBox = mkBox('Broker queue'), cBox = mkBox('Consumer'), ledger = mkBox('Ledger: effect applied per message');
    var stage = h('div', { class: 'qv' }, [qBox.el, cBox.el, ledger.el]);

    var lab = UI.lab({
      title: 'Lab 3: delivery semantics and redelivery',
      subtitle: 'Ten messages, each with a side effect (for example "send an email"). Kill the consumer mid-message and see what each guarantee does.',
      sim: sim, stage: stage,
      stageLabel: 'Broker queue, consumer and a ledger showing how many times each effect happened',
      breakLabel: 'Break it: kill the consumer on the next message',
      fixLabel: 'Fix it: disarm the crash',
      onBreak: function (broken) { armed = broken; },
      caption: 'Pick a guarantee, press Play, then Break it while it runs.'
    });

    function effects(id) { return st.eff[id] || 0; }

    function render() {
      fill(qBox, st.q.map(function (m) { return { label: m.id }; }), 20);
      qBox.note.textContent = st.q.length + ' waiting';
      fill(cBox, st.cur ? [{ label: st.cur.id, cls: st.dead ? 'bad' : 'ok' }] : [], 1);
      cBox.state(st.dead ? 'is-dead' : (st.cur ? 'is-busy' : ''));
      cBox.note.textContent = st.dead ? 'CRASHED, restarting...' : (st.cur ? 'working' : 'idle');
      var items = [];
      var lost = 0, dups = 0;
      for (var i = 1; i <= N; i++) {
        var e = effects(i), cls, inFlight = (st.cur && st.cur.id === i) || st.q.some(function (m) { return m.id === i; });
        if (i > st.sent) { cls = 'hid'; }
        else if (e >= 2) { cls = 'dup'; dups++; }
        else if (e === 1) { cls = 'ok'; }
        else if (inFlight) { cls = ''; }
        else { cls = 'bad'; lost++; }
        items.push({ label: i + (e ? 'x' + e : ''), cls: cls });
      }
      fill(ledger, items, 20);
      ledger.note.textContent = 'green = once (correct), orange = duplicated, red = lost';
      var secs = sim.now() / 1000;
      lab.metrics.set('throughput', secs > 0 ? st.acked / secs : 0);
      lab.metrics.set('latency', avg(st.sum, st.acked));
      lab.metrics.set('depth', st.q.length + (st.cur ? 1 : 0));
      lab.metrics.set('errors', lost + dups);
    }

    function maybeFinish() {
      if (st.finished || st.sent < N || st.q.length || st.cur || st.dead) { return; }
      st.finished = true;
      var lost = 0, dups = 0;
      for (var i = 1; i <= N; i++) { var e = effects(i); if (e === 0) { lost++; } else if (e > 1) { dups++; } }
      lab.log.log('Done: ' + lost + ' lost, ' + dups + ' duplicated, ' + (N - lost - dups) + ' exactly once.', { t: sim.now(), level: lost || dups ? 'err' : 'ok' });
      lab.explain(mode === 'amo'
        ? '**At-most-once** acks on delivery, then works. A crash after the ack means the broker believes it is done, so the message is **lost** (red). Good for data you can afford to lose, like metrics samples.'
        : mode === 'alo'
          ? '**At-least-once** acks after the work. A crash between the effect and the ack means the broker redelivers and the effect runs **twice** (orange). Nothing is lost, so you must make the consumer tolerate duplicates.'
          : '**Exactly-once effect** = at-least-once delivery + an idempotent consumer. Redelivery still happens, but the consumer remembers processed ids and skips the effect, so every message has an effect exactly once. The guarantee holds only if the dedupe record and the effect commit together.');
    }

    function dispatch() {
      if (st.dead || st.cur || !st.q.length) { maybeFinish(); return; }
      var m = st.q.shift();
      st.cur = m;
      var tok = ++st.tok;
      var d0 = sim.now();
      if (mode === 'amo') { lab.log.log('Broker delivers #' + m.id + ' and considers it done immediately (ack on delivery).', { t: d0 }); }
      else { lab.log.log('Broker delivers #' + m.id + ' and keeps it until the consumer acks.', { t: d0 }); }
      if (armed) {
        armed = false;
        lab.bar.setBroken(false);
        sim.schedule(mode === 'amo' ? 200 : 500, function () { if (st.tok === tok) { crash(m); } });
      }
      sim.schedule(EFFECT, function () {
        if (st.tok !== tok) { return; }
        if (mode === 'eo' && st.seen[m.id]) { lab.log.log('Consumer sees #' + m.id + ' again, finds it in the processed table and skips the effect.', { t: sim.now(), level: 'ok' }); return; }
        st.seen[m.id] = true;
        st.eff[m.id] = effects(m.id) + 1;
        lab.log.log('Effect applied for #' + m.id + (effects(m.id) > 1 ? ' (SECOND time!)' : '.'), { t: sim.now(), level: effects(m.id) > 1 ? 'err' : 'info' });
        render();
      });
      sim.schedule(WORK, function () {
        if (st.tok !== tok) { return; }
        st.cur = null; st.acked++; st.sum += sim.now() - m.t0;
        if (mode !== 'amo') { lab.log.log('Consumer acks #' + m.id + '.', { t: sim.now(), level: 'ok' }); }
        dispatch(); render();
      });
    }

    function crash(m) {
      st.dead = true; st.tok++; st.cur = null;
      lab.log.log('CONSUMER CRASHED while handling #' + m.id + '.', { t: sim.now(), level: 'err' });
      if (mode === 'amo') { lab.log.log('Message #' + m.id + ' was already acked at delivery, so the broker will never resend it.', { t: sim.now(), level: 'err' }); }
      else { st.q.unshift(m); lab.log.log('No ack received: the broker will redeliver #' + m.id + ' after the consumer restarts.', { t: sim.now(), level: 'warn' }); }
      render();
      sim.schedule(RESTART, function () { st.dead = false; lab.log.log('Consumer restarted.', { t: sim.now(), level: 'ok' }); dispatch(); render(); });
    }

    function send() {
      st.sent++;
      st.q.push({ id: st.sent, t0: sim.now() });
      lab.log.log('Producer sends #' + st.sent + '.', { t: sim.now() });
      dispatch(); render();
      if (st.sent < N) { sim.schedule(GAP, send); }
    }

    function seed() {
      st = { q: [], cur: null, dead: false, tok: 0, sent: 0, eff: {}, seen: {}, acked: 0, sum: 0, finished: false };
      armed = false;
      lab.log.clear(); lab.metrics.reset();
      lab.bar.setBroken(false);
      lab.explain('Guarantee: **' + ({ amo: 'at-most-once', alo: 'at-least-once', eo: 'at-least-once + idempotent consumer (exactly-once effect)' })[mode] + '**. Press Play, then use Break it while a message is being processed.');
      lab.log.log('Ten messages will be sent, one every 0.6 s.', { t: 0 });
      sim.schedule(100, send);
      render();
    }

    sim.on('reset', seed);
    var seg = segmented('Guarantee', [['amo', 'At-most-once'], ['alo', 'At-least-once'], ['eo', 'Exactly-once effect']], mode, function (v) { mode = v; sim.reset(); });
    seed();
    return wrap([seg], lab);
  }

  /* ================= LAB 4: idempotency ================= */

  function labIdem() {
    var N = 8, GAP = 700, APPLY = 300, REDELIVER = 1200, LOSTACK = [2, 5, 6];
    var sim = Sim.create({ speed: 1 });
    var strat = 'dedupe', st;
    var balance = h('div', { class: 'ui-box', role: 'status' });
    var qBox = mkBox('Deliveries'), tbl = mkBox('Orders paid (consumer database)');
    var stage = h('div', {}, [balance, h('div', { class: 'qv' }, [qBox.el, tbl.el])]);

    var lab = UI.lab({
      title: 'Lab 4: idempotency',
      subtitle: 'Eight "pay order #n: $10" messages. For orders 2, 5 and 6 the consumer\'s ack is lost on the network, so the broker redelivers them.',
      sim: sim, stage: stage,
      stageLabel: 'Account balance and the orders that were applied',
      breakLabel: 'Break it: naive balance += 10',
      fixLabel: 'Fix it: dedupe on message id',
      onBreak: function (broken) { strat = broken ? 'add' : 'dedupe'; seg.set(strat); sim.reset(); sim.play(); },
      caption: 'Press Play and compare the three strategies.'
    });

    function bal() {
      if (strat === 'natural') { return Object.keys(st.paid).length * 10; }
      return st.balance;
    }

    function render() {
      var b = bal(), exp = st.sent * 10;
      var done = st.sent === N && st.pending === 0;
      balance.textContent = 'Balance: $' + b + '   |   Expected for ' + st.sent + ' sent orders: $' + exp;
      balance.className = 'ui-box ' + (b === exp ? 'good' : (done || b > exp ? 'stale' : ''));
      var items = [];
      for (var i = 1; i <= N; i++) { var n = st.count[i] || 0; items.push({ label: i + (n ? 'x' + n : ''), cls: i > st.sent ? 'hid' : (n > 1 ? (strat === 'natural' ? 'ok' : 'dup') : (n === 1 ? 'ok' : '')) }); }
      fill(tbl, items, 20);
      tbl.note.textContent = 'xN = times the consumer RAN for that order';
      fill(qBox, st.redel.map(function (m) { return { label: m.id, cls: 'dup' }; }), 10);
      qBox.note.textContent = st.redel.length + ' waiting to be redelivered';
      var secs = sim.now() / 1000;
      lab.metrics.set('throughput', secs > 0 ? st.applied / secs : 0);
      lab.metrics.set('latency', avg(st.sum, st.applied));
      lab.metrics.set('depth', st.pending);
      lab.metrics.set('errors', st.harm);
    }

    function deliver(m, attempt) {
      sim.schedule(APPLY, function () {
        var first = !st.count[m.id];
        st.count[m.id] = (st.count[m.id] || 0) + 1;
        if (strat === 'add') { st.balance += 10; if (!first) { st.harm++; lab.log.log('Order #' + m.id + ' applied AGAIN: customer charged twice (balance +10).', { t: sim.now(), level: 'err' }); } else { lab.log.log('Order #' + m.id + ' applied: balance +10.', { t: sim.now(), level: 'ok' }); } }
        else if (strat === 'dedupe') {
          if (st.seen[m.id]) { lab.log.log('Order #' + m.id + ' is already in processed_messages: skipped, just ack.', { t: sim.now(), level: 'ok' }); }
          else { st.seen[m.id] = true; st.balance += 10; lab.log.log('Order #' + m.id + ' applied and recorded: balance +10.', { t: sim.now(), level: 'ok' }); }
        } else {
          st.paid[m.id] = 'PAID';
          lab.log.log('Order #' + m.id + ': set status = PAID' + (first ? '.' : ' (already PAID, harmless repeat).'), { t: sim.now(), level: 'ok' });
        }
        st.applied++; st.sum += sim.now() - m.t0;
        if (attempt === 1 && LOSTACK.indexOf(m.id) !== -1) {
          lab.log.log('The ack for #' + m.id + ' is lost on the network. The broker will redeliver.', { t: sim.now(), level: 'warn' });
          st.redel.push(m);
          sim.schedule(REDELIVER, function () { st.redel.splice(st.redel.indexOf(m), 1); lab.log.log('Broker redelivers #' + m.id + '.', { t: sim.now(), level: 'warn' }); deliver(m, 2); render(); });
        } else { st.pending--; }
        render();
      });
    }

    function send() {
      var m = { id: ++st.sent, t0: sim.now() };
      st.pending++;
      lab.log.log('Message: pay order #' + m.id + ' ($10).', { t: sim.now() });
      deliver(m, 1);
      render();
      if (st.sent < N) { sim.schedule(GAP, send); }
      else { sim.schedule(REDELIVER + APPLY * 2 + 100, summarize); }
    }

    function summarize() {
      var b = bal(), exp = N * 10;
      lab.log.log('Final balance $' + b + ', expected $' + exp + '.', { t: sim.now(), level: b === exp ? 'ok' : 'err' });
      lab.explain(strat === 'add'
        ? '**Not idempotent.** "Add 10" applied three extra times, so the balance is $' + b + ' instead of $' + exp + '. This is the real cost of at-least-once delivery: duplicates are normal, and a consumer that is not idempotent silently corrupts data.'
        : strat === 'dedupe'
          ? '**Dedupe on a message id.** The consumer stores each processed id (in the same database transaction as the effect) and skips repeats. Balance is correct at $' + b + '. Remember to expire old ids sensibly and to use a stable id set by the **producer**, not one made up on receipt.'
          : '**Naturally idempotent.** "Set status = PAID for order n" gives the same result no matter how often it runs. Where you can phrase work as "make the state X" instead of "change the state by Y", you need no extra bookkeeping.');
    }

    function seed() {
      st = { balance: 0, paid: {}, seen: {}, count: {}, redel: [], sent: 0, pending: 0, applied: 0, sum: 0, harm: 0 };
      lab.log.clear(); lab.metrics.reset();
      lab.bar.setBroken(strat === 'add');
      lab.explain('Strategy: **' + ({ add: 'naive "balance += 10"', dedupe: 'dedupe table keyed by message id', natural: 'naturally idempotent "set status = PAID"' })[strat] + '**. Press Play.');
      lab.log.log('Eight payments will arrive. Acks for #2, #5 and #6 will be lost.', { t: 0 });
      sim.schedule(100, send);
      render();
    }

    sim.on('reset', seed);
    var seg = segmented('Consumer strategy', [['add', 'Naive: balance += 10'], ['dedupe', 'Dedupe by message id'], ['natural', 'Idempotent: set PAID']], strat, function (v) { strat = v; sim.reset(); });
    seed();
    return wrap([seg], lab);
  }

  /* ================= LAB 5: poison message and dead letter queue ================= */

  function labPoison() {
    var POISON = 3, WORK = 400, TOTAL = 14, GAP = 800;
    var sim = Sim.create({ speed: 1 });
    var mode = 'dlq', maxR = 3, fixed = false, st;
    var qBox = mkBox('Main queue'), cBox = mkBox('Consumer'), okBox = mkBox('Processed'), dBox = mkBox('Dead letter queue (DLQ)', 'dlq');
    var stage = h('div', { class: 'qv' }, [qBox.el, cBox.el, okBox.el, dBox.el]);

    var lab = UI.lab({
      title: 'Lab 5: poison messages and the dead letter queue',
      subtitle: 'Message #3 is malformed and crashes the consumer every time. What happens to the messages behind it?',
      sim: sim, stage: stage,
      stageLabel: 'Main queue, consumer, processed messages and dead letter queue',
      breakLabel: 'Break it: retry forever',
      fixLabel: 'Fix it: limit retries and dead-letter',
      onBreak: function (broken) { mode = broken ? 'infinite' : 'dlq'; seg.set(mode); sim.reset(); sim.play(); },
      caption: 'Press Play. Watch the main queue.'
    });

    function render() {
      fill(qBox, st.q.map(function (m) { return { label: m.id + (st.att[m.id] ? ' (' + st.att[m.id] + ' tries)' : ''), cls: m.id === POISON && !fixed ? 'bad' : '' }; }), 24);
      qBox.note.textContent = st.q.length + ' waiting';
      fill(cBox, st.cur ? [{ label: st.cur.id, cls: st.cur.id === POISON && !fixed ? 'bad' : 'ok' }] : [], 1);
      cBox.state(st.cur ? (st.cur.id === POISON && !fixed ? 'is-dead' : 'is-busy') : '');
      cBox.note.textContent = st.cur ? 'working on #' + st.cur.id : 'idle';
      fill(okBox, st.ok.map(function (id) { return { label: id, cls: 'ok' }; }), 30);
      okBox.note.textContent = st.ok.length + ' processed';
      fill(dBox, st.dlq.map(function (m) { return { label: m.id, cls: 'bad' }; }), 10);
      dBox.note.textContent = st.dlq.length + ' parked' + (st.dlq.length ? ' (reason: failed ' + maxR + ' times)' : '');
      var secs = sim.now() / 1000;
      lab.metrics.set('throughput', secs > 0 ? st.ok.length / secs : 0);
      lab.metrics.set('latency', avg(st.sum, st.ok.length));
      lab.metrics.set('depth', st.q.length);
      lab.metrics.set('errors', st.fails);
    }

    function pump() {
      if (st.cur || !st.q.length) { return; }
      var m = st.q.shift();
      st.cur = m;
      sim.schedule(WORK, function () {
        st.cur = null;
        if (m.id === POISON && !fixed) {
          st.fails++;
          st.att[m.id] = (st.att[m.id] || 0) + 1;
          if (mode === 'dlq' && st.att[m.id] >= maxR) {
            st.dlq.push(m);
            lab.log.log('#' + m.id + ' failed ' + st.att[m.id] + ' times: moved to the DLQ. The queue moves on.', { t: sim.now(), level: 'warn' });
            if (!st.explained) { st.explained = true; lab.explain('**Dead-lettered.** After ' + maxR + ' attempts the poison message is parked with its failure reason, and healthy messages flow again. Now someone must look at the DLQ, fix the bug and **redrive** it (try the button). Raise the retry limit and note the delay it causes. Honest trade-off: retries immediately in a row rarely help; real systems add delays between attempts.'); }
          } else {
            st.q.unshift(m);
            lab.log.log('#' + m.id + ' FAILED (attempt ' + st.att[m.id] + '). Requeued at the head: everything behind it waits.', { t: sim.now(), level: 'err' });
            if (mode === 'infinite' && st.att[m.id] === 6) { lab.explain('**Head-of-line blocking.** The poison message is requeued immediately, every time, so the consumer never gets past it. ' + st.q.length + ' healthy messages are stuck and the queue grows. This is how one bad message takes down a pipeline. Press **Fix it**.'); }
          }
        } else {
          st.ok.push(m.id); st.sum += sim.now() - m.t0;
          lab.log.log('#' + m.id + ' processed.' + (m.id === POISON ? ' (fixed consumer handled the old poison message)' : ''), { t: sim.now(), level: 'ok' });
        }
        pump(); render();
      });
    }

    function produce() {
      st.n++;
      st.q.push({ id: st.n, t0: sim.now() });
      pump(); render();
      if (st.n < TOTAL) { sim.schedule(GAP, produce); }
    }

    function deploy() {
      if (fixed) { return; }
      fixed = true;
      lab.log.log('Bug fixed and consumer redeployed. Redriving ' + st.dlq.length + ' message(s) from the DLQ.', { t: sim.now(), level: 'ok' });
      st.dlq.forEach(function (m) { st.att[m.id] = 0; st.q.push(m); });
      st.dlq = [];
      pump(); render();
      if (!st.q.length) { lab.explain('The consumer is fixed. Retries and DLQs buy you time; the real cure is fixing the bug.'); }
    }

    function seed() {
      st = { q: [], cur: null, ok: [], dlq: [], att: {}, n: 0, fails: 0, sum: 0, explained: false };
      fixed = false;
      for (var i = 0; i < 6; i++) { st.q.push({ id: ++st.n, t0: 0 }); }
      lab.log.clear(); lab.metrics.reset();
      lab.bar.setBroken(mode === 'infinite');
      lab.explain(mode === 'dlq' ? 'Policy: at most ' + maxR + ' attempts, then dead-letter. Press Play.' : 'Policy: retry forever. Press Play and watch #3.');
      lab.log.log('Six messages are queued; more arrive every 0.8 s. Message #3 is poison.', { t: 0 });
      sim.schedule(GAP, produce);
      pump();
      render();
    }

    sim.on('reset', seed);
    var seg = segmented('Retry policy', [['dlq', 'Limit retries + DLQ'], ['infinite', 'Retry forever']], mode, function (v) { mode = v; sim.reset(); });
    var mr = slider('Max delivery attempts', 1, 6, maxR, 1, function (v) { return String(v); }, function (v) { maxR = v; sim.reset(); });
    var fix = button('Deploy bug fix and redrive DLQ', deploy);
    seed();
    return wrap([seg, mr, fix], lab);
  }

  /* ================= LAB 6: visibility timeout ================= */

  function labVisibility() {
    var N = 8, FAST = 1000, SLOW = 5000, SLOWIDS = [2, 5];
    var sim = Sim.create({ speed: 1 });
    var vt = 8000, hb = false, st;
    var qBox = mkBox('Queue (visible and hidden)'), c1 = mkBox('Consumer A'), c2 = mkBox('Consumer B'), dBox = mkBox('Deleted (finished)');
    var stage = h('div', { class: 'qv' }, [qBox.el, c1.el, c2.el, dBox.el]);

    var lab = UI.lab({
      title: 'Lab 6: visibility timeout',
      subtitle: 'Received messages are hidden, not removed. Messages #2 and #5 take 5 s to process; the others take 1 s.',
      sim: sim, stage: stage,
      stageLabel: 'Queue with hidden messages and two consumers',
      breakLabel: 'Break it: visibility timeout of 2 s',
      fixLabel: 'Fix it: timeout of 8 s',
      onBreak: function (broken) { vt = broken ? 2000 : 8000; hb = false; vtS.set(vt / 1000); hbC.set(false); sim.reset(); sim.play(); },
      caption: 'Press Play. Slow messages outlast a short timeout.'
    });

    function render() {
      var live = st.msgs.filter(function (m) { return !m.deleted; });
      fill(qBox, live.map(function (m) { return { label: m.id + (m.effects > 1 ? 'x' + m.effects : ''), cls: m.effects > 1 ? 'dup' : (m.hidden ? 'hid' : '') }; }), 20);
      qBox.note.textContent = live.filter(function (m) { return !m.hidden; }).length + ' visible, ' + live.filter(function (m) { return m.hidden; }).length + ' hidden';
      [[c1, st.cons[0]], [c2, st.cons[1]]].forEach(function (p) {
        var cur = p[1].cur;
        fill(p[0], cur ? [{ label: cur.m.id, cls: cur.m.effects > 0 || cur.m.deleted ? 'dup' : 'ok' }] : [], 1);
        p[0].state(cur ? 'is-busy' : '');
        p[0].note.textContent = cur ? 'working on #' + cur.m.id + ' (' + (cur.m.work / 1000) + ' s job)' : 'idle';
      });
      fill(dBox, st.msgs.filter(function (m) { return m.deleted; }).map(function (m) { return { label: m.id, cls: m.effects > 1 ? 'dup' : 'ok' }; }), 20);
      dBox.note.textContent = st.deleted + ' deleted';
      var secs = sim.now() / 1000;
      lab.metrics.set('throughput', secs > 0 ? st.deleted / secs : 0);
      lab.metrics.set('latency', avg(st.sum, st.deleted));
      lab.metrics.set('depth', N - st.deleted);
      lab.metrics.set('errors', st.dups);
    }

    function expire(m, delay) {
      sim.schedule(delay, function () {
        if (m.deleted || !m.hidden || sim.now() < m.until - 0.5) { return; }
        m.hidden = false;
        lab.log.log('Visibility timeout expired for #' + m.id + ': it is VISIBLE again, even though a consumer is still working on it.', { t: sim.now(), level: 'warn' });
        dispatch(); render();
      });
    }

    function dispatch() {
      st.cons.forEach(function (c) {
        if (c.cur) { return; }
        var m = st.msgs.filter(function (x) { return !x.deleted && !x.hidden; })[0];
        if (!m) { return; }
        m.hidden = true; m.receipt++; m.until = sim.now() + vt;
        var rc = m.receipt;
        c.cur = { m: m, rc: rc };
        lab.log.log(c.name + ' receives #' + m.id + ' (delivery ' + m.receipt + '); hidden for ' + (vt / 1000) + ' s.', { t: sim.now() });
        expire(m, vt);
        if (hb) {
          var beat = function () {
            if (c.cur && c.cur.m === m && c.cur.rc === rc && !m.deleted) {
              m.until = sim.now() + vt; expire(m, vt);
              lab.log.log(c.name + ' heartbeat: visibility of #' + m.id + ' extended.', { t: sim.now(), level: 'ok' });
              sim.schedule(vt / 2, beat);
            }
          };
          sim.schedule(vt / 2, beat);
        }
        sim.schedule(m.work, function () {
          m.effects++;
          c.cur = null;
          if (m.effects > 1) { st.dups++; lab.log.log(c.name + ' finished #' + m.id + ' but it was ALREADY processed: duplicate side effect!', { t: sim.now(), level: 'err' }); }
          else { lab.log.log(c.name + ' finished #' + m.id + ' and deletes it.', { t: sim.now(), level: 'ok' }); }
          if (!m.deleted) { m.deleted = true; m.hidden = false; st.deleted++; st.sum += sim.now(); }
          dispatch(); render(); summary();
        });
      });
    }

    function summary() {
      if (st.deleted < N || st.summed || st.cons.some(function (c) { return c.cur; })) { return; }
      st.summed = true;
      lab.explain(st.dups
        ? '**Timeout shorter than the job.** ' + st.dups + ' message(s) reappeared while still being processed, so another consumer ran them again: duplicate side effects and wasted work. Set the timeout above your worst-case processing time, extend it with a **heartbeat** while working, and make the consumer idempotent anyway.'
        : '**No duplicates.** The timeout (' + (vt / 1000) + ' s) is longer than the slowest job (5 s)' + (hb ? ', and the heartbeat keeps extending it' : '') + '. Trade-off: a very long timeout means a crashed consumer\'s message stays hidden for that whole time before anyone else can retry it.');
    }

    function seed() {
      st = { msgs: [], cons: [{ name: 'A', cur: null }, { name: 'B', cur: null }], deleted: 0, sum: 0, dups: 0, summed: false };
      for (var i = 1; i <= N; i++) { st.msgs.push({ id: i, work: SLOWIDS.indexOf(i) !== -1 ? SLOW : FAST, hidden: false, until: 0, receipt: 0, deleted: false, effects: 0 }); }
      lab.log.clear(); lab.metrics.reset();
      lab.bar.setBroken(vt < 5000 && !hb);
      lab.explain('Visibility timeout: ' + (vt / 1000) + ' s' + (hb ? ' with heartbeat' : '') + '. The slow jobs take 5 s. Press Play.');
      lab.log.log('Eight messages are queued; consumers A and B poll.', { t: 0 });
      dispatch();
      render();
    }

    sim.on('reset', seed);
    var vtS = slider('Visibility timeout', 1, 10, vt / 1000, 1, function (v) { return v + ' s'; }, function (v) { vt = v * 1000; sim.reset(); });
    var hbC = checkbox('Heartbeat (extend while working)', hb, function (v) { hb = v; sim.reset(); });
    seed();
    return wrap([vtS, hbC], lab);
  }

  /* ================= LAB 7: TTL ================= */

  function labTtl() {
    var PROD = 500, WORK = 1000, LIFE = 6000;
    var sim = Sim.create({ speed: 1 });
    var pol = 'ttl', ttl = 6000, st;
    var qBox = mkBox('Queue (oldest first)'), cBox = mkBox('Consumer'), okBox = mkBox('Processed'), xBox = mkBox('Expired', 'dlq');
    var stage = h('div', { class: 'qv' }, [qBox.el, cBox.el, okBox.el, xBox.el]);

    var lab = UI.lab({
      title: 'Lab 7: message TTL (time to live)',
      subtitle: 'Flash-sale notifications are only useful for 6 s. They arrive twice per second but the consumer handles one per second.',
      sim: sim, stage: stage,
      stageLabel: 'Queue with message expiry',
      breakLabel: 'Break it: no TTL',
      fixLabel: 'Fix it: expire after the TTL',
      onBreak: function (broken) { pol = broken ? 'none' : 'ttl'; seg.set(pol); sim.reset(); sim.play(); },
      caption: 'Press Play. Compare the age of processed messages.'
    });

    function render() {
      var t = sim.now();
      fill(qBox, st.q.map(function (m) { var age = t - m.born; return { label: m.id, cls: age > LIFE ? 'bad' : (pol !== 'none' && age > ttl * 0.75 ? 'dup' : '') }; }), 30);
      qBox.note.textContent = st.q.length + ' waiting (red = already too old to be useful)';
      fill(cBox, st.cur ? [{ label: st.cur.id, cls: 'ok' }] : [], 1);
      cBox.state(st.cur ? 'is-busy' : '');
      cBox.note.textContent = st.cur ? 'working' : 'idle';
      fill(okBox, st.ok.slice(-30), 30);
      okBox.note.textContent = st.ok.length + ' processed';
      fill(xBox, [], 1);
      xBox.note.textContent = st.expired + (pol === 'dlx' ? ' dead-lettered' : ' dropped');
      var secs = t / 1000;
      lab.metrics.set('throughput', secs > 0 ? st.ok.length / secs : 0);
      lab.metrics.set('latency', avg(st.ageSum, st.ok.length));
      lab.metrics.set('depth', st.q.length);
      lab.metrics.set('errors', st.stale);
    }

    function pump() {
      if (st.cur) { return; }
      while (pol !== 'none' && st.q.length && sim.now() - st.q[0].born > ttl) {
        var d = st.q.shift();
        st.expired++;
        if (st.expired % 4 === 1) { lab.log.log('Message #' + d.id + ' expired in the queue (age ' + Math.round(sim.now() - d.born) + ' ms)' + (pol === 'dlx' ? ' and was dead-lettered.' : ' and was dropped.'), { t: sim.now(), level: 'warn' }); }
      }
      if (!st.q.length) { return; }
      var m = st.q.shift();
      st.cur = m;
      var age = sim.now() - m.born;
      sim.schedule(WORK, function () {
        st.cur = null; st.ok.push({ label: m.id, cls: age > LIFE ? 'bad' : 'ok' });
        st.ageSum += age;
        if (age > LIFE) { st.stale++; if (st.stale % 3 === 1) { lab.log.log('Processed #' + m.id + ' but it was ' + (age / 1000).toFixed(1) + ' s old: the sale notification is useless now.', { t: sim.now(), level: 'err' }); } }
        pump(); render();
      });
    }

    function produce() {
      st.q.push({ id: ++st.n, born: sim.now() });
      pump(); render();
      sim.schedule(PROD, produce);
    }

    function seed() {
      st = { q: [], cur: null, ok: [], n: 0, expired: 0, stale: 0, ageSum: 0 };
      lab.log.clear(); lab.metrics.reset();
      lab.bar.setBroken(pol === 'none');
      lab.explain(pol === 'none'
        ? 'No TTL: every message is processed eventually, but as the backlog grows each one is older when it is handled. Notifications arrive minutes late (red).'
        : 'TTL ' + (ttl / 1000) + ' s: messages that waited too long are discarded' + (pol === 'dlx' ? ' to a dead-letter exchange for inspection' : '') + ', so the consumer spends its time on fresh ones. Honest trade-offs: expired data is gone (only use TTL for perishable messages), and in RabbitMQ per-message TTL is only enforced when a message reaches the head of the queue.');
      lab.log.log('Producer: 2 msgs/s. Consumer: 1 msg/s. Useful life: 6 s.', { t: 0 });
      sim.schedule(0, produce);
      render();
    }

    sim.on('tick', render);
    sim.on('reset', seed);
    var seg = segmented('Expiry policy', [['none', 'No TTL'], ['ttl', 'TTL: drop expired'], ['dlx', 'TTL: dead-letter expired']], pol, function (v) { pol = v; sim.reset(); });
    var ts = slider('TTL', 2, 20, ttl / 1000, 1, function (v) { return v + ' s'; }, function (v) { ttl = v * 1000; sim.reset(); });
    seed();
    return wrap([seg, ts], lab);
  }

  /* ================= LAB 8: queue-depth autoscaler ================= */

  function labScaler() {
    var BASE = 6, S0 = 3000, S1 = 18000, WORKMS = 250, STARTUP = 3000, TARGET = 5, SLA = 5000, MIN = 2, WIN = 60;
    var sim = Sim.create({ speed: 1 });
    var pol = 'auto', maxW = 12, spike = 40, st;
    var chart = makeBars(WIN, { label: 'Queue depth over the last 30 seconds', lineLabel: '' });
    var cap = h('div', { class: 'bars-cap' }, [h('span', { text: '30 s ago' }), h('span', { text: 'now' })]);
    var wBox = mkBox('Workers (green = busy)');
    var stage = h('div', {}, [h('div', { class: 'qv' }, [wBox.el]), chart.el, cap]);

    var lab = UI.lab({
      title: 'Lab 8: queue-depth autoscaler',
      subtitle: 'Normal load is 6 msg/s. From 3 s to 18 s it jumps. Each worker handles 4 msg/s and takes 3 s to start.',
      sim: sim, stage: stage,
      stageLabel: 'Queue depth chart and worker pool size',
      breakLabel: 'Break it: fixed 2 workers',
      fixLabel: 'Fix it: autoscale on backlog',
      onBreak: function (broken) { pol = broken ? 'fixed' : 'auto'; seg.set(pol); sim.reset(); sim.play(); },
      caption: 'Press Play at 4x or 8x to see the whole run.'
    });

    function draw() {
      var sc = 20;
      st.samples.forEach(function (v) { sc = Math.max(sc, v); });
      for (var i = 0; i < WIN; i++) { chart.set(i, st.samples[i] === undefined ? 0 : st.samples[i], sc); }
    }

    function render() {
      var items = [];
      for (var i = 0; i < st.w; i++) { items.push({ label: 'W', cls: i < st.busy ? 'ok' : '' }); }
      for (var j = 0; j < st.starting; j++) { items.push({ label: '...', cls: 'hid' }); }
      fill(wBox, items, 30);
      wBox.note.textContent = st.w + ' running' + (st.starting ? ', ' + st.starting + ' starting' : '') + ' | backlog ' + st.q.length + ' | capacity ' + (st.w * 4) + ' msg/s';
      var secs = sim.now() / 1000;
      lab.metrics.set('throughput', secs > 0 ? st.done / secs : 0);
      lab.metrics.set('latency', avg(st.waitSum, st.done));
      lab.metrics.set('depth', st.q.length);
      lab.metrics.set('errors', st.late);
    }

    function pump() {
      while (st.busy < st.w && st.q.length) {
        var m = st.q.shift();
        st.busy++;
        var wait = sim.now() - m.t0;
        st.waitSum += wait;
        if (wait > SLA) { st.late++; }
        sim.schedule(WORKMS, function () { st.busy--; st.done++; pump(); render(); });
      }
    }

    function arrive() {
      var t = sim.now();
      var r = (t >= S0 && t < S1) ? spike : BASE;
      st.acc += r / 10;
      while (st.acc >= 1) { st.q.push({ t0: t }); st.acc -= 1; }
      pump(); render();
      sim.schedule(100, arrive);
    }

    function evaluate() {
      var t = sim.now();
      if (pol === 'auto') {
        var eff = st.w + st.starting;
        var metric = st.q.length / Math.max(1, eff);
        if (metric > TARGET) {
          var want = Math.min(maxW, Math.max(MIN, Math.ceil(eff * metric / TARGET)));
          var add = want - eff;
          if (add > 0) {
            st.starting += add; st.last = t;
            lab.log.log('Backlog per worker is ' + metric.toFixed(1) + ' (target ' + TARGET + '). Scaling up by ' + add + ' to ' + want + (want === maxW ? ' (at the maximum)' : '') + '. They need 3 s to start.', { t: t, level: 'warn' });
            sim.schedule(STARTUP, function () { st.starting -= add; st.w += add; lab.log.log(add + ' worker(s) are ready (now ' + st.w + ').', { t: sim.now(), level: 'ok' }); pump(); render(); });
          } else if (eff >= maxW && !st.capped) { st.capped = true; lab.log.log('Backlog is high but the maximum of ' + maxW + ' workers is reached. The cap protects the database but the queue will keep growing if load exceeds capacity.', { t: t, level: 'err' }); }
        } else if (st.q.length < st.w && st.w > MIN && t - st.last >= 5000) {
          st.w--; st.last = t;
          lab.log.log('Backlog is small. Scaling down by 1 to ' + st.w + ' (one step at a time, with a cooldown, to avoid flapping).', { t: t });
        }
      }
      sim.schedule(2000, evaluate);
    }

    function sample() {
      st.samples.push(st.q.length);
      if (st.samples.length > WIN) { st.samples.shift(); }
      sim.schedule(500, sample);
    }

    function seed() {
      st = { q: [], w: MIN, starting: 0, busy: 0, done: 0, waitSum: 0, late: 0, acc: 0, last: -10000, capped: false, samples: [] };
      lab.log.clear(); lab.metrics.reset();
      lab.bar.setBroken(pol === 'fixed');
      lab.explain(pol === 'fixed'
        ? 'Fixed 2 workers can do 8 msg/s. Load jumps to ' + spike + ' msg/s, so the backlog grows by ' + (spike - 8) + ' per second and messages wait longer than the 5 s target (errors).'
        : 'Autoscaling on **backlog per worker** adds workers within a few seconds, with a 3 s startup delay (so the queue still peaks), then removes them one at a time once the backlog is gone. Limit: max ' + maxW + ' workers. More consumers only help if the database or API behind them can take it.');
      lab.log.log('Policy: ' + (pol === 'auto' ? 'autoscale (target backlog per worker ' + TARGET + ', max ' + maxW + ')' : 'fixed 2 workers') + '. Spike ' + spike + ' msg/s from 3 s to 18 s.', { t: 0 });
      sim.schedule(0, arrive);
      sim.schedule(500, sample);
      sim.schedule(2000, evaluate);
      sim.schedule(S0, function () { lab.log.log('LOAD SPIKE: ' + spike + ' msg/s.', { t: sim.now(), level: 'warn' }); });
      sim.schedule(S1, function () { lab.log.log('Load returns to normal (6 msg/s).', { t: sim.now(), level: 'ok' }); });
      render(); draw();
    }

    sim.on('tick', draw);
    sim.on('reset', seed);
    var seg = segmented('Scaling policy', [['fixed', 'Fixed (2 workers)'], ['auto', 'Autoscale on backlog']], pol, function (v) { pol = v; sim.reset(); });
    var mx = slider('Max workers', 2, 16, maxW, 1, function (v) { return String(v); }, function (v) { maxW = v; sim.reset(); });
    var sp = slider('Spike rate', 20, 60, spike, 5, function (v) { return v + '/s'; }, function (v) { spike = v; sim.reset(); });
    seed();
    return wrap([seg, mx, sp], lab);
  }

  /* ================= PREDICT ================= */

  function predict() {
    return UI.predictChallenge({
      question: 'A message takes 5 s to process. The queue has a 3 s visibility timeout and two idle consumers. Consumer 1 receives the message at t=0. How many times is it processed?',
      setup: 'At-least-once queue (SQS style). Visibility timeout = 3 s. Processing time = 5 s. Consumer 1 receives at t=0 and does not extend the timeout. Consumer 2 is idle and polling.',
      options: ['Once', 'Twice', 'Three times', 'Zero times (the broker drops it)'],
      answer: 1,
      duration: 8500,
      speed: 4,
      explain: 'At t=3 s the timeout expires while Consumer 1 is still busy, so the message becomes visible and **Consumer 2** receives it. Consumer 1 finishes at 5 s and deletes it; Consumer 2 keeps going and finishes at 8 s. The message was processed **twice**. Fix: timeout longer than the job, a heartbeat, and an idempotent consumer.',
      simulate: function (ctx) {
        var s = ctx.sim, receipt = 0, deleted = false;
        var out = h('p', { class: 'ui-box', text: 'Times processed: 0' });
        ctx.stage.appendChild(out);
        ctx.state = { n: 0 };
        function recv(name) {
          var rc = ++receipt;
          ctx.log(name + ' receives the message. It is hidden for 3 s.', { t: s.now() });
          s.schedule(3000, function () {
            if (!deleted && receipt === rc) {
              ctx.log('Visibility timeout expires: message visible again.', { t: s.now(), level: 'warn' });
              recv('Consumer 2');
            }
          });
          s.schedule(5000, function () {
            ctx.state.n++;
            out.textContent = 'Times processed: ' + ctx.state.n;
            ctx.log(name + ' finished processing' + (deleted ? ' (a duplicate!).' : ' and deletes the message.'), { t: s.now(), level: deleted ? 'err' : 'ok' });
            deleted = true;
          });
        }
        s.schedule(0, function () { recv('Consumer 1'); });
      },
      measure: function (ctx) { return 'The message was processed ' + ctx.state.n + ' time(s).'; }
    }).el;
  }

  /* ================= CHEAT SHEET + INTERVIEW ================= */

  function cheatSheet() {
    var items = [
      ['Why queues', 'Decouple producer and consumer in time and speed, absorb bursts, survive consumer downtime. They add delay and moving parts; they do not add capacity.'],
      ['Point-to-point vs pub/sub', 'P2P: competing consumers, each message handled once (scale work). Pub/sub: each subscriber gets a copy (broadcast). Durable subscriptions keep messages while offline.'],
      ['Delivery guarantees', 'At-most-once: may lose. At-least-once: may duplicate (the default). "Exactly-once" = at-least-once + idempotent consumer.'],
      ['Ack rules', 'Ack **after** the work is committed. No ack means redelivery. Ack before the work only for data you can lose.'],
      ['Idempotency', 'Unique message id + processed table in the same transaction, or naturally idempotent updates (set, upsert). Keys come from the producer.'],
      ['Poison and DLQ', 'Cap deliveries, add backoff, dead-letter with a reason, alert on DLQ depth, have an owner and a tested redrive process.'],
      ['Visibility timeout', 'Hide-not-delete on receive. Set above worst-case processing, extend with heartbeats, expect duplicates anyway.'],
      ['TTL', 'Expire perishable messages. Expired = lost (or dead-lettered). Some brokers enforce per-message TTL only at the queue head.'],
      ['Scaling and ops', 'Watch depth, oldest message age, consumer lag and DLQ rate. Autoscale with cooldowns and a max that the downstream can handle. Bound queue length.']
    ];
    return h('div', { class: 'cheat' }, items.map(function (it) {
      return h('div', { class: 'cheat-item' }, [h('h4', { text: it[0] }), UI.rich(it[1])]);
    }));
  }

  function interview() {
    return UI.accordion({ items: [
      { title: 'What problem does a message queue solve?', body: 'It decouples producers from consumers in **time** (the consumer can be down or slow), **rate** (bursts are buffered) and **failure** (messages survive a consumer crash). It enables work distribution to competing consumers and lets you add consumers without changing producers. The costs: extra latency, another component to operate, and new failure modes such as duplicates and ordering issues.' },
      { title: 'Point-to-point versus publish/subscribe?', body: 'In point-to-point, consumers compete on one queue and each message is delivered to one of them, which scales throughput. In pub/sub, each subscriber has its own queue (or offset) and receives every message, which broadcasts events to many independent systems. Many brokers combine both: an exchange or topic fans out to several queues, and each queue has competing consumers.' },
      { title: 'Explain at-most-once, at-least-once and exactly-once.', body: '**At-most-once:** ack before processing; a crash loses the message. **At-least-once:** ack after processing; a crash causes redelivery, so duplicates are possible. **Exactly-once:** delivery across independent systems cannot be guaranteed outright, so in practice you get exactly-once **effects** by combining at-least-once delivery with idempotent processing or transactional dedupe. Some systems offer exactly-once within their own boundary (for example Kafka transactions or SQS FIFO deduplication in a 5-minute window), but the side effects in your database are still your responsibility.' },
      { title: 'How do you make a consumer idempotent?', body: 'Use a stable unique id assigned by the producer. In the same transaction as the effect, insert the id into a processed table with a unique constraint; if the insert conflicts, skip the work and ack. Alternatively, use naturally idempotent operations (upsert, set status, put by key) or conditional updates with version numbers. Expire old ids only after the maximum possible redelivery window.' },
      { title: 'What is a poison message and how do you handle it?', body: 'A message that always fails processing (bad schema, a bug, a missing referenced record). If requeued immediately it can block the queue or burn CPU forever. Handle it with a limited delivery count (`maxReceiveCount`, quorum-queue `delivery-limit`), delayed retries with backoff, and a dead letter queue that stores the reason. Alert on DLQ growth, find the root cause, then redrive after the fix.' },
      { title: 'What is a visibility timeout and how do you choose it?', body: 'In SQS-style queues, receiving a message hides it from other consumers for the timeout; deleting it completes the work, otherwise it reappears. Choose a value above the worst-case (p99.9) processing time, or extend it with heartbeats during long jobs. Too short causes duplicate processing; too long delays retries after a crash. Always combine with idempotency.' },
      { title: 'When would you use a TTL on messages?', body: 'For perishable data: notifications, price quotes, one-time codes, cache invalidations. Expiry stops consumers wasting time on useless messages after a backlog. Decide whether expired messages are dropped or dead-lettered for analysis. Do not use TTL for data you must never lose, and remember the enforcement detail in your broker (for example RabbitMQ per-message TTL is applied at the head of the queue).' },
      { title: 'How do you scale consumers, and what can go wrong?', body: 'Add competing consumers and autoscale on backlog per consumer or oldest message age. Pitfalls: startup lag, flapping (use cooldowns and gentle scale-down), losing order (route by key to keep per-entity ordering), and moving the bottleneck to a database or third-party API (cap concurrency, use prefetch limits). Verify that the system can drain a backlog faster than it accumulates.' },
      { title: 'A queue is growing without bound. How do you investigate?', body: 'Check the rate in versus the rate out, and the oldest message age. Look for stuck or crashing consumers (poison message at the head, repeated redelivery), a slow dependency, a recently reduced consumer count or prefetch, and visibility timeouts that cause duplicate work. Then act: fix the consumer, scale out within downstream limits, shed or expire perishable messages, add backpressure to producers, and set queue length limits and alerts so it never reaches that point silently.' },
      { title: 'What is the dual-write problem and how does the outbox pattern fix it?', body: 'A service that updates its database and then publishes a message can crash in between, leaving the two out of sync. The outbox pattern writes the message into an outbox table in the **same transaction** as the data change, and a separate relay publishes it to the broker afterwards (with at-least-once semantics, so consumers must be idempotent). We return to this in the event-driven architecture topic.' }
    ] }).el;
  }

  /* ================= MOUNT ================= */

  function mount(el) {
    el.appendChild(h('div', { class: 'topic-intro' }, [h('p', { class: 'lead', text: 'How do systems hand work to each other without waiting? You will fill queues, crash consumers, trigger duplicates, trap poison messages and autoscale workers.' })]));
    el.appendChild(storyBlock());
    el.appendChild(title('Learn it at your level', 'Start at Beginner. Each level adds depth and real production scars.'));
    el.appendChild(levelTabs());

    el.appendChild(title('Lab 1 \u00B7 Traffic spike, with and without a queue'));
    el.appendChild(labSpike());
    el.appendChild(title('Lab 2 \u00B7 Point-to-point vs publish/subscribe'));
    el.appendChild(labFanout());
    el.appendChild(title('Lab 3 \u00B7 Delivery semantics and redelivery'));
    el.appendChild(labDelivery());
    el.appendChild(title('Lab 4 \u00B7 Idempotency'));
    el.appendChild(labIdem());
    el.appendChild(title('Lab 5 \u00B7 Poison messages and the dead letter queue'));
    el.appendChild(labPoison());
    el.appendChild(title('Lab 6 \u00B7 Visibility timeout'));
    el.appendChild(labVisibility());
    el.appendChild(title('Lab 7 \u00B7 Message TTL'));
    el.appendChild(labTtl());
    el.appendChild(title('Lab 8 \u00B7 Queue-depth autoscaler'));
    el.appendChild(labScaler());

    el.appendChild(title('Predict the outcome'));
    el.appendChild(predict());

    el.appendChild(title('Quiz', '5 questions. Score 70% or more to complete this topic.'));
    el.appendChild(UI.quiz({ title: 'Message queues quiz', topicId: 'queues', questions: (global.QUIZZES && global.QUIZZES.queues) || [], passPct: 70 }).el);

    el.appendChild(title('Cheat sheet'));
    el.appendChild(cheatSheet());
    el.appendChild(title('Interview questions', 'Try answering out loud before opening each one.'));
    el.appendChild(interview());
  }

  global.App.registerTopic({ id: 'queues', title: 'Message Queues', accent: 'queues', mount: mount });
})(window);
