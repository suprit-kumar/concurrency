/*
 * t5-eda.js - Topic 5: Event-Driven Architecture.
 * Story, level tabs, labs (coupling, event store, CQRS + eventual consistency, saga, outbox,
 * event versioning, tracing), event styles, anti-patterns, predict, quiz, cheat sheet, interview.
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
    var name = 'esg' + (++uid);
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
    var id = 'ecb' + (++uid);
    var inp = h('input', { type: 'checkbox', id: id });
    inp.checked = !!checked;
    inp.addEventListener('change', function () { onChange(inp.checked); });
    return { el: h('label', { class: 'ctl', for: id }, [inp, h('span', { text: label })]), get: function () { return inp.checked; }, set: function (v) { inp.checked = !!v; } };
  }

  function slider(label, min, max, val, step, fmt, onChange) {
    var id = 'esl' + (++uid);
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
    return { el: b };
  }

  function wrap(controls, lab, extra) {
    var kids = [];
    if (controls.length) { kids.push(h('div', { class: 'lab-controls', role: 'group', 'aria-label': 'Lab settings' }, controls.map(function (c) { return c.el; }))); }
    kids.push(lab.el);
    (extra || []).forEach(function (e) { kids.push(e); });
    return h('div', { class: 'lab-wrap' }, kids);
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

  /* ================= THE STORY ================= */

  function storyBlock() {
    var scene = h('div', { class: 'qstory', role: 'img', 'aria-label': 'A waiter phoning three departments one by one, versus a waiter pinning a ticket on a board that every department watches' }, [
      h('div', { class: 'qs-who', text: 'Request-driven: the waiter phones everyone' }),
      h('div', { class: 'qs-rail' }, [0, 1, 2, 3, 4, 5].map(function (i) { var t = h('i', { class: 'qt' }); t.style.setProperty('--d', (-i) + 's'); return t; })),
      h('div', { class: 'qs-who', text: 'Event-driven: a ticket on the board' })
    ]);
    UI.onVisible(scene, function () { scene.classList.remove('is-paused'); }, function () { scene.classList.add('is-paused'); });
    var stepper = UI.stepper({
      steps: [
        { title: '0:00 A busy restaurant', body: 'A customer orders a meal. Several things must now happen: the kitchen cooks, the bar pours, the cashier prepares the bill and the manager updates the stock count.' },
        { title: '0:15 Version one: the waiter phones everybody', body: 'The waiter calls the kitchen, waits for an answer, calls the bar, waits, calls the cashier, waits. If the bar does not pick up, the waiter stands there and the customer waits. If management wants a new "loyalty points" desk, the waiter must be retrained to call it too. This is **request-driven**: the caller knows every callee and waits for each.' },
        { title: '0:30 Version two: the ticket board', body: 'The waiter pins a ticket "Table 4 ordered pasta" to a board and walks away. Kitchen, bar, cashier and loyalty desk each watch the board and react in their own time. A new desk just starts watching. If the bar is closed for ten minutes, its tickets wait. This is **event-driven**: someone announces a **fact**, and others react.' },
        { title: '0:45 The price of the board', body: 'Nobody is in charge of the whole flow, so you must answer new questions: what if two desks disagree for a while (**eventual consistency**)? What if a ticket is read twice (**idempotency**)? How do we follow one order across five desks (**correlation IDs**)? What if the pasta is cooked but payment fails (**saga**)? That is this topic.' },
        { title: '0:55 What you will do', body: 'You will unplug a service and compare designs, replay history, split reads from writes, roll back a distributed order, survive a broker outage with the outbox, break and fix an event contract, and trace one request across services.' }
      ]
    });
    return h('div', { class: 'card' }, [
      h('div', { class: 'card-title' }, [h('h3', { text: 'The Story: the phoning waiter and the ticket board' })]),
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

  var JS_EVENTS = "// An event is a past-tense FACT. Small, immutable, versioned.\nconst orderPlaced = {\n  id: 'evt-7f3a',            // unique: consumers dedupe on this\n  type: 'OrderPlaced',\n  version: 2,                // schema version\n  occurredAt: '2026-01-15T10:00:00Z',\n  correlationId: 'req-91c2', // follows the whole business flow\n  data: { orderId: 'o-123', customerId: 'c-42', amount: { value: 1999, currency: 'EUR' } }\n};\n\n// A command is a REQUEST to do something. It can be refused.\nconst chargeCard = { type: 'ChargeCard', orderId: 'o-123', amountCents: 1999 };\n\n// Idempotent consumer: processing the same event twice must be harmless\nasync function onOrderPlaced(evt) {\n  const first = await db.insertIfAbsent('processed_events', { id: evt.id });\n  if (!first) return;                        // duplicate: ignore\n  await reserveStock(evt.data.orderId);      // ideally in the same transaction\n}";
  var TXT_OUTBOX = "-- Transactional outbox: business row + event row in ONE transaction\nBEGIN;\n  INSERT INTO orders (id, customer_id, total) VALUES ('o-123', 'c-42', 1999);\n  INSERT INTO outbox (id, aggregate_id, type, payload, created_at, sent_at)\n         VALUES ('evt-7f3a', 'o-123', 'OrderPlaced', '{...}', now(), NULL);\nCOMMIT;\n\n-- Relay (a separate process, or change data capture such as Debezium)\nSELECT * FROM outbox WHERE sent_at IS NULL ORDER BY created_at LIMIT 100;\n-- publish each row to the broker (with the key aggregate_id to keep order),\n-- then:  UPDATE outbox SET sent_at = now() WHERE id = :id;\n-- A crash between publish and update means a duplicate, so consumers must be idempotent.";
  var JS_SAGA = "// Orchestrated saga: one coordinator owns the flow and the compensations\nasync function placeOrderSaga(order) {\n  const done = [];\n  try {\n    await payment.charge(order);      done.push(() => payment.refund(order));\n    await inventory.reserve(order);   done.push(() => inventory.release(order));\n    await shipping.schedule(order);\n    return 'COMPLETED';\n  } catch (err) {\n    for (const undo of done.reverse()) await retryForever(undo); // compensations must succeed eventually\n    return 'CANCELLED';\n  }\n}\n// Persist the saga state after every step so a crash resumes instead of forgetting.";

  function levelTabs() {
    var panelI = UI.codePanel({ title: 'Events, commands and an idempotent consumer', tabs: [{ lang: 'javascript', label: 'Event shapes', code: JS_EVENTS }] });
    var panelA = UI.codePanel({ title: 'Outbox and saga', tabs: [
      { lang: 'text', label: 'Outbox (SQL)', code: TXT_OUTBOX },
      { lang: 'javascript', label: 'Saga', code: JS_SAGA }
    ] });
    return UI.tabs({
      label: 'Event-driven architecture at three levels',
      tabs: [
        { id: 'beginner', label: 'Beginner', content: function () {
          return levelPane(
            'In **event-driven architecture (EDA)**, a service announces that something **happened** (an **event**, such as "OrderPlaced") and does not care who listens. Other services **subscribe** and react on their own. The announcement usually travels through a **broker** (RabbitMQ, Kafka, a cloud bus).\n\nCompare with **request-driven** design, where service A calls B, waits, then calls C. There, A must know B and C, and if C is down, A is stuck. With events, A is only coupled to the event, so you can add a "loyalty points" service without touching A.\n\nWhat you gain: loose coupling, independent scaling, resilience to a slow or dead consumer, and an audit trail. What you give up: simple step-by-step flow, instant answers, and easy debugging.',
            'A notice board in a school. Teachers pin "Sports day moved to Friday". Students, parents and the canteen each read it when they pass. The teacher does not phone each person, and a new club can simply start reading the board.',
            '- "Events are just function calls over the network". A call asks for work and waits; an event states a fact and moves on.\n- "Event-driven means asynchronous so everything is faster". It often adds latency; the gain is decoupling and resilience.\n- "Use events for everything". Simple request/response is often better.\n- "The consumer will receive it exactly once". Assume at-least-once and duplicates.',
            'A system that was fine with two services becomes a web nobody can draw, and a bug means reading logs from six places to learn who reacted to what.'
          );
        } },
        { id: 'intermediate', label: 'Intermediate', content: function () {
          return levelPane(
            '**Event vs command.** An event is a past-tense **fact** ("OrderPlaced") with many possible listeners. A command is a **request** ("ChargeCard") aimed at one handler that may refuse. Mixing them up creates hidden coupling.\n\n**Three event styles.** **Event notification** carries just an id ("customer c-42 changed", then you call back for details). **Event-carried state transfer** carries the data the consumer needs, so it can keep its own copy. **Event sourcing** stores the events themselves as the source of truth and derives state by replaying them.\n\n**CQRS** splits the write model from the read models, which are built from events and tuned for queries. The cost is **eventual consistency**: the read side lags, so a user may not see their own write at once. Mitigate with read-your-writes, UI hints and version checks.\n\n**Sagas** replace distributed transactions with a series of local transactions and **compensating actions** (refund, release stock). Use **orchestration** (a coordinator tells each service what to do) or **choreography** (services react to each other\'s events).\n\n**The outbox pattern** solves the dual-write problem: write the business row and an outbox row in one database transaction, then a relay publishes it. **Correlation IDs** travel with every message so you can trace one business flow across services.',
            'A relay race where each runner hands over a baton (event). A coach with a whistle (orchestrator) or runners who know the course (choreography). If a runner trips, earlier runners cannot un-run their leg; the team performs a recovery routine instead (compensation).',
            '- Calling the saga\'s compensation an "undo". A refund is a new business action and may not restore everything.\n- Publishing to the broker right after the database commit and hoping both succeed.\n- Assuming ordering across partitions or queues.\n- Putting the whole database row in every event and exposing internals.\n- Forgetting the unhappy path: timeouts, duplicates, out-of-order events.',
            'The read model shows stale data and customers report "my order is missing". A consumer double-charges because a duplicate event arrived. Support cannot find what happened to order 123 because nothing links the logs.',
            panelI.el
          );
        } },
        { id: 'advanced', label: 'Advanced', content: function () {
          return levelPane(
            '**Event contracts are public APIs that live forever.** Old events stay in the log and are replayed years later. Make additive changes, include a version, use a schema registry (Avro, Protobuf or JSON Schema) with compatibility checks, and write **upcasters** that translate old versions on read. Never reuse a field with a new meaning.\n\n**Delivery and ordering.** Assume at-least-once. Make consumers idempotent with a processed-ids table written in the same transaction as the effect, or natural idempotence (set, not increment). Ordering holds only inside one partition or queue; key by aggregate id and design handlers to tolerate late and out-of-order events (version numbers, "ignore if older").\n\n**Event sourcing in practice.** Snapshots keep replay fast. Rebuilding a projection means reading the whole log, so plan for it. Corrections are new compensating events, not edits. Personal data and "right to be forgotten" conflict with immutable logs; use crypto-shredding or keep personal data outside events. Event sourcing is powerful but costly; most systems need only events plus a normal database.\n\n**Sagas and failure.** Persist saga state. Compensations must be idempotent, retried and sometimes impossible (you cannot unsend an email), so order steps so the irreversible ones come last. Handle timeouts and the "zombie" case where a slow step succeeds after you compensated.\n\n**Outbox relay.** Poll the table or tail the transaction log (CDC, for example Debezium). Publishing keeps order per aggregate if you key by aggregate id. Clean up sent rows. The inbox pattern mirrors it on the consumer side.\n\n**Observability.** Propagate a correlation id and trace context (for example W3C `traceparent`) through message headers, record consumer lag and oldest-message age, and alert on dead-letter growth.',
            'A shared ledger in a big company: nobody may erase a line, only add a correcting entry; each department keeps its own summary sheet and can rebuild it from the ledger, and every entry carries a case number so an auditor can follow one case across departments.',
            '- Treating event sourcing as a default instead of a deliberate trade-off.\n- Large "god events" shared by many teams that nobody dares change.\n- Compensations that assume the world did not change meanwhile.\n- Replaying a log that triggers real emails or payments.\n- Using the broker as a database of record without retention planning.',
            '- A producer renames a field and half the consumers crash (Lab 6).\n- The broker blips and an order exists without its event (Lab 5).\n- A shipping failure leaves customers charged for nothing (Lab 4).\n- A projection bug has silently corrupted read models for weeks (Lab 2).\n- Nobody can trace a slow checkout across six services (Lab 7).',
            panelA.el
          );
        } }
      ]
    }).el;
  }

  /* ================= LAB 1: coupling ================= */

  function labCoupling() {
    var sim = Sim.create({ speed: 1 });
    var mode = 'request', plan = false, st;
    var row = h('div', { class: 'qv' });
    var stage = row;

    var lab = UI.lab({
      title: 'Lab 1: request-driven vs event-driven coupling',
      subtitle: 'The Order service must tell Email, Inventory and Analytics about each order. Take Analytics offline and see who suffers.',
      sim: sim, stage: stage,
      stageLabel: 'Order service and its downstream services',
      breakLabel: 'Break it: request-driven, Analytics goes down at 2 s',
      fixLabel: 'Fix it: publish an event instead',
      onBreak: function (broken) { mode = broken ? 'request' : 'event'; plan = true; seg.set(mode); sim.reset(); sim.play(); },
      caption: 'Press Play, then take a service down.'
    });

    function down(s) { return s.manual > sim.now() || (plan && s.name === 'Analytics' && sim.now() >= 2000 && sim.now() < 9000); }

    function pump(s) {
      if (mode !== 'event' || s.busy || s.q <= 0 || down(s)) { return; }
      s.busy = true;
      sim.schedule(150, function () { s.busy = false; s.q--; s.done++; pump(s); });
    }

    function order() {
      var id = ++st.id;
      if (mode === 'request') {
        var t = 0, failed = null;
        st.svc.forEach(function (s) {
          if (failed) { return; }
          if (down(s)) { t += 1000; failed = s; } else { t += 150; s.done++; }
        });
        sim.schedule(t, function () {
          if (failed) { st.fail++; lab.log.log('Order #' + id + ' FAILED: Order service waited 1 s for ' + failed.name + ' and gave up. The customer sees an error because of a non-essential service.', { t: sim.now(), level: 'err' }); }
          else { st.ok++; st.sum += t; }
        });
      } else {
        st.ok++; st.sum += 20;
        if (id % 4 === 1) { lab.log.log('Order #' + id + ' saved and "OrderPlaced" published in 20 ms. Order service does not wait for anyone.', { t: sim.now(), level: 'ok' }); }
        st.svc.forEach(function (s) { s.q++; pump(s); });
      }
      sim.schedule(800, order);
    }

    function beat() { st.svc.forEach(pump); sim.schedule(250, beat); }

    function render() {
      row.innerHTML = '';
      var o = mkBox('Order service');
      o.note.textContent = 'orders ok ' + st.ok + ' | failed ' + st.fail;
      o.state(mode === 'request' ? 'is-busy' : '');
      fill(o, [], 1);
      row.appendChild(o.el);
      st.svc.forEach(function (s) {
        var b = mkBox(s.name + (down(s) ? ' (DOWN)' : ''));
        fill(b, [], 1);
        b.state(down(s) ? 'is-dead' : (s.busy ? 'is-busy' : ''));
        b.note.textContent = 'processed ' + s.done + (mode === 'event' ? ' | backlog ' + s.q : '');
        row.appendChild(b.el);
      });
      lab.metrics.set('throughput', rate(st.ok, sim.now()));
      lab.metrics.set('latency', avg(st.sum, st.ok));
      lab.metrics.set('depth', st.svc.reduce(function (a, s) { return a + s.q; }, 0));
      lab.metrics.set('errors', st.fail);
    }

    function explain() {
      lab.explain(mode === 'request'
        ? '**Request-driven.** Order calls each service in turn and waits. Latency is the sum of all calls, and one dead service fails the whole order, even though analytics should never block a sale. Adding a service means editing and redeploying Order.'
        : '**Event-driven.** Order saves and publishes one fact, then returns. Each consumer works through its own backlog; Analytics\' backlog simply grows while it is down and drains when it returns. Adding "Fraud" needs no change to Order. Cost: the order is "done" before downstream work is, so the system is eventually consistent.');
    }

    function seed() {
      st = { id: 0, ok: 0, fail: 0, sum: 0, svc: ['Email', 'Inventory', 'Analytics'].map(function (n) { return { name: n, q: 0, done: 0, busy: false, manual: 0 }; }) };
      lab.log.clear(); lab.metrics.reset();
      lab.bar.setBroken(mode === 'request' && plan);
      explain();
      lab.log.log('Mode: ' + mode + (plan ? ', Analytics will fail from 2 s to 9 s' : '') + '. Orders arrive every 0.8 s.', { t: 0 });
      sim.schedule(0, order); sim.schedule(100, beat);
      render();
    }

    sim.on('tick', render);
    sim.on('reset', seed);
    var seg = segmented('Design', [['request', 'Request-driven'], ['event', 'Event-driven']], mode, function (v) { mode = v; sim.reset(); });
    var add = button('Add a "Fraud" consumer', function () {
      if (st.svc.some(function (s) { return s.name === 'Fraud'; })) { return; }
      st.svc.push({ name: 'Fraud', q: 0, done: 0, busy: false, manual: 0 });
      lab.log.log(mode === 'request' ? 'Fraud added: the Order service code had to be changed and redeployed to call it (and every order is now 150 ms slower).' : 'Fraud subscribed to OrderPlaced. Order service untouched. It sees events from now on.', { t: sim.now(), level: mode === 'request' ? 'warn' : 'ok' });
      render();
    });
    var down1 = button('Take Analytics down for 6 s', function () { st.svc[2].manual = sim.now() + 6000; lab.log.log('Analytics taken offline for 6 s.', { t: sim.now(), level: 'warn' }); render(); });
    seed();
    return wrap([seg, add, down1], lab);
  }

  /* ================= EVENT STYLES (non-simulated) ================= */

  function stylesBlock() {
    var D = {
      notify: {
        label: 'Event notification',
        json: '{ "type": "CustomerAddressChanged",\n  "customerId": "c-42" }',
        how: 'Shipping receives a tiny "something changed" signal, then **calls the Customer service** to ask for the new address.',
        pros: '- Small, stable events\n- Source stays the single owner of the data',
        cons: '- The callback re-couples consumers to the producer at run time\n- A burst of events becomes a burst of calls, and the producer must be up\n- The data may have changed again by the time you ask'
      },
      state: {
        label: 'Event-carried state transfer',
        json: '{ "type": "CustomerAddressChanged",\n  "customerId": "c-42",\n  "address": { "street": "12 Quay Rd", "city": "Cork" },\n  "version": 17 }',
        how: 'Shipping stores the address from the event in **its own table** and never calls Customer.',
        pros: '- Consumers stay available even if the producer is down\n- No callback traffic, fast local reads',
        cons: '- Data is duplicated and eventually consistent\n- Events are bigger and expose more of the model (privacy, contract size)\n- Consumers must handle duplicates and out-of-order versions'
      },
      sourcing: {
        label: 'Event sourcing',
        json: '{ "type": "AddressChanged", "streamId": "customer-c-42",\n  "seq": 17, "data": { "city": "Cork" } }',
        how: 'The **event log is the database**. Current state is a fold over the stream; Shipping can build any projection by replaying it.',
        pros: '- Complete history, audit and time travel\n- Rebuild or add read models any time',
        cons: '- Steep learning curve, schema evolution is hard\n- Querying needs projections; replay can be slow without snapshots\n- Immutable data vs privacy deletion requests'
      }
    };
    var cur = 'notify';
    var pre = h('pre', { class: 'json-pre' });
    var body = h('div', { class: 'stack', 'aria-live': 'polite' });
    function draw() {
      var d = D[cur];
      pre.textContent = d.json;
      body.innerHTML = '';
      body.appendChild(UI.rich('**Question: the customer\'s address changed. How does Shipping find out the new address?**\n\n' + d.how));
      body.appendChild(UI.callout('ok', 'Good for', d.pros).el);
      body.appendChild(UI.callout('warn', 'Costs', d.cons).el);
    }
    var seg = segmented('Event style', [['notify', 'Notification'], ['state', 'State transfer'], ['sourcing', 'Event sourcing']], cur, function (v) { cur = v; draw(); });
    draw();
    return h('div', { class: 'card' }, [
      h('div', { class: 'card-title' }, [h('h3', { text: 'Three kinds of event: notification, carried state, sourcing' })]),
      h('p', { class: 'muted', text: 'Same business fact, three payloads, three trade-offs. Pick one on purpose.' }),
      h('div', { class: 'lab-controls' }, [seg.el]), pre, body
    ]);
  }

  /* ================= LAB 2: event store, replay, time travel ================= */

  function labStore() {
    var sim = Sim.create({ speed: 1 });
    var bug = false, tt = 40, st, rnd;
    var evBox = mkBox('Event store (append-only, never edited)');
    var projBox = mkBox('Live projection: balance');
    var truthBox = mkBox('Balance if every event were applied correctly');
    var ttBox = mkBox('Time travel: balance as of event N');
    var stage = h('div', { class: 'qv' }, [evBox.el, projBox.el, truthBox.el, ttBox.el]);

    var lab = UI.lab({
      title: 'Lab 2: event store, replay and time travel',
      subtitle: 'An account\'s history is stored as events. A read model (projection) is built from them. Rewind with the slider, and repair a buggy projection by replaying.',
      sim: sim, stage: stage,
      stageLabel: 'Event log, live projection and time-travel view',
      breakLabel: 'Break it: ship a projection bug (withdrawals added)',
      fixLabel: 'Fix it: correct the code and replay the log',
      onBreak: function (broken) {
        bug = broken;
        if (!broken) { replay(); }
        else { lab.log.log('Deployed a buggy projection: withdrawals are now ADDED to the balance.', { t: sim.now(), level: 'err' }); }
        sim.play(); render();
      },
      caption: 'Press Play, slide the time-travel control, then break and fix the projection.'
    });

    function fold(n, buggy) {
      var b = 0;
      for (var i = 0; i < n && i < st.ev.length; i++) { var e = st.ev[i]; b += (e.type === 'Deposited' || buggy) ? e.amt : -e.amt; }
      return b;
    }

    function append() {
      var bal = fold(st.ev.length, false);
      var amt = 10 * (1 + Math.floor(rnd() * 9));
      var type = (rnd() < 0.6 || bal < amt) ? 'Deposited' : 'Withdrawn';
      var e = { n: st.ev.length + 1, type: type, amt: amt };
      st.ev.push(e);
      if (type === 'Withdrawn' && bug) { st.bad++; st.live += amt; } else { st.live += type === 'Deposited' ? amt : -amt; }
      if (e.n % 3 === 1) { lab.log.log('Event #' + e.n + ' ' + type + ' ' + amt + ' appended. Projection applied it.', { t: sim.now() }); }
      sim.schedule(700, append);
      render();
    }

    function replay() {
      st.live = fold(st.ev.length, bug);
      st.bad = 0;
      lab.log.log('Replayed ' + st.ev.length + ' events from offset 0 with the ' + (bug ? 'buggy' : 'fixed') + ' projection. Projection = ' + st.live + '.', { t: sim.now(), level: bug ? 'err' : 'ok' });
      lab.explain(bug
        ? 'Replaying with buggy code just reproduces the bug. The events are fine; the code that interprets them is wrong.'
        : '**Replay repairs history.** The events never changed, so after fixing the code, rebuilding the projection from offset 0 gives the correct balance. With a plain "update balance" table the wrong numbers would be permanent. Cost: replay takes time on a long log, so real systems use snapshots.');
      render();
    }

    function render() {
      var n = Math.min(tt, st.ev.length);
      fill(evBox, st.ev.slice(-30).map(function (e) { return { label: '#' + e.n + (e.type === 'Deposited' ? '+' : '-') + e.amt, cls: (e.n > n ? 'hid ' : '') + (e.type === 'Deposited' ? 'ok' : 'dup') }; }), 30);
      evBox.note.textContent = st.ev.length + ' events | dimmed = after the time-travel point';
      var truth = fold(st.ev.length, false);
      fill(projBox, [{ label: st.live, cls: st.live === truth ? 'ok' : 'bad' }], 1);
      projBox.note.textContent = st.live === truth ? 'matches the truth' : 'WRONG by ' + (st.live - truth) + ' (a bug, not data loss)';
      projBox.state(st.live === truth ? '' : 'is-dead');
      fill(truthBox, [{ label: truth }], 1);
      truthBox.note.textContent = 'derived by folding all events';
      fill(ttBox, [{ label: fold(n, false), cls: 'dup' }], 1);
      ttBox.note.textContent = 'state after the first ' + n + ' event(s)';
      lab.metrics.set('throughput', rate(st.ev.length, sim.now()));
      lab.metrics.set('latency', NaN);
      lab.metrics.set('depth', st.ev.length);
      lab.metrics.set('errors', st.bad);
    }

    function seed() {
      rnd = Sim.random(11);
      st = { ev: [], live: 0, bad: 0 };
      bug = false;
      lab.log.clear(); lab.metrics.reset();
      lab.bar.setBroken(false);
      lab.explain('**Event store.** Each change is appended as an immutable event. Current state is not stored; it is **derived** by applying events in order. Slide **time travel** to see the balance at any earlier point, something a normal table cannot do after an update.');
      lab.log.log('Account events arrive every 0.7 s.', { t: 0 });
      sim.schedule(100, append);
      render();
    }

    sim.on('tick', render);
    sim.on('reset', seed);
    var tS = slider('Time travel to event', 0, 40, tt, 1, function (v) { return v >= 40 ? 'latest' : '#' + v; }, function (v) { tt = v; render(); });
    var rp = button('Rebuild projection (replay all)', replay);
    seed();
    return wrap([tS, rp], lab);
  }

  /* ================= LAB 3: CQRS and eventual consistency ================= */

  function labCqrs() {
    var sim = Sim.create({ speed: 1 });
    var lag = 300, ryw = false, st;
    var wBox = mkBox('Write model (commands)'), bus = mkBox('Events in flight'), rBox = mkBox('Read model (queries)');
    var stage = h('div', { class: 'qv' }, [wBox.el, bus.el, rBox.el]);

    var lab = UI.lab({
      title: 'Lab 3: CQRS and eventual consistency',
      subtitle: 'Each second a user places an order, then opens "My orders" 0.4 s later. The read model is updated by events after a projection delay.',
      sim: sim, stage: stage,
      stageLabel: 'Write model, event bus and read model',
      breakLabel: 'Break it: slow projection (1.5 s lag)',
      fixLabel: 'Fix it: read your own writes',
      onBreak: function (broken) { lag = 1500; ryw = !broken; lagS.set(lag); rywC.set(ryw); sim.reset(); sim.play(); },
      caption: 'Press Play. Watch how many users fail to see their own order.'
    });

    function place() {
      var id = ++st.id;
      st.w.push(id); st.flight.push(id);
      sim.schedule(lag, function () { st.flight.splice(st.flight.indexOf(id), 1); st.r.push(id); render(); });
      sim.schedule(400, function () {
        var seen = ryw || st.r.indexOf(id) !== -1;
        if (seen) { st.fresh++; st.sum += 400; if (id % 4 === 1) { lab.log.log('User opens "My orders": order #' + id + ' is visible' + (ryw ? ' (their recent writes are read from the write model).' : '.'), { t: sim.now(), level: 'ok' }); } }
        else { st.stale++; lab.log.log('User opens "My orders" 0.4 s after ordering: order #' + id + ' is MISSING. The read model has not caught up. "Did my order fail?"', { t: sim.now(), level: 'err' }); }
        render();
      });
      sim.schedule(1000, place);
      render();
    }

    function render() {
      fill(wBox, st.w.slice(-14).map(function (i) { return { label: '#' + i, cls: 'ok' }; }), 14);
      wBox.note.textContent = st.w.length + ' orders committed (source of truth)';
      fill(bus, st.flight.map(function (i) { return { label: '#' + i, cls: 'dup' }; }), 14);
      bus.note.textContent = st.flight.length + ' event(s) not yet projected';
      fill(rBox, st.r.slice(-14).map(function (i) { return { label: '#' + i, cls: 'ok' }; }), 14);
      rBox.note.textContent = st.r.length + ' orders visible in queries';
      lab.metrics.set('throughput', rate(st.fresh + st.stale, sim.now()));
      lab.metrics.set('latency', avg(st.sum, st.fresh));
      lab.metrics.set('depth', st.flight.length);
      lab.metrics.set('errors', st.stale);
    }

    function seed() {
      st = { id: 0, w: [], r: [], flight: [], fresh: 0, stale: 0, sum: 0 };
      lab.log.clear(); lab.metrics.reset();
      lab.bar.setBroken(lag >= 1000 && !ryw);
      lab.explain(lag < 400
        ? '**CQRS.** Writes go to a model designed for correctness; reads are served from a separate model built from events and shaped for queries. With a short lag the user rarely notices, but the lag is never zero: this is **eventual consistency**.'
        : (ryw ? '**Read-your-writes.** Eventual consistency stays (the read model is still behind), but the one user who just wrote is served from the write model or a session cache, so they never see their own data vanish. Other users see the delay, which is usually acceptable.'
          : '**Stale reads.** The read model needs ' + (lag / 1000) + ' s to catch up but the user asks after 0.4 s. The system is "correct" and the experience is not. Fixes: read-your-writes, return the new data in the command response, show a pending state, or reduce the lag.'));
      lab.log.log('Projection lag ' + (lag / 1000) + ' s, read-your-writes ' + (ryw ? 'ON' : 'OFF') + '.', { t: 0 });
      sim.schedule(0, place);
      render();
    }

    sim.on('reset', seed);
    var lagS = slider('Projection lag', 100, 3000, lag, 100, function (v) { return (v / 1000).toFixed(1) + ' s'; }, function (v) { lag = v; sim.reset(); });
    var rywC = checkbox('Read your own writes', ryw, function (v) { ryw = v; sim.reset(); });
    seed();
    return wrap([lagS, rywC], lab);
  }

  /* ================= LAB 4: saga ================= */

  function labSaga() {
    var STEPS = [{ k: 'pay', ok: 'charged', svc: 'Payment' }, { k: 'inv', ok: 'reserved', svc: 'Inventory' }, { k: 'ship', ok: 'shipped', svc: 'Shipping' }];
    var UNDO = ['refunded', 'released'];
    var sim = Sim.create({ speed: 1 });
    var mode = 'orch', fail = 'none', comp = true, st;
    var boxes = STEPS.map(function (s) { return mkBox(s.svc + ' service'); });
    var stage = h('div', { class: 'qv' }, boxes.map(function (b) { return b.el; }));

    var lab = UI.lab({
      title: 'Lab 4: saga with compensating actions',
      subtitle: 'Placing an order spans Payment, Inventory and Shipping, each with its own database. There is no shared transaction. Make a step fail.',
      sim: sim, stage: stage,
      stageLabel: 'Order state in each of three services',
      breakLabel: 'Break it: Shipping fails and nothing compensates',
      fixLabel: 'Fix it: run compensating actions',
      onBreak: function (broken) { fail = 'shipping'; comp = !broken; failS.set(fail); compC.set(comp); sim.reset(); sim.play(); },
      caption: 'Press Play. Choose which step fails, then compare orchestration and choreography.'
    });

    function failIdx() { return { none: -1, inventory: 1, shipping: 2 }[fail]; }

    function start() {
      var o = { id: ++st.id, t0: sim.now(), pay: '', inv: '', ship: '', state: 'running' };
      st.orders.push(o); st.inflight++;
      run(o, 0);
      sim.schedule(3500, start);
    }

    function run(o, i) {
      if (i >= 3) { o.state = 'completed'; st.inflight--; st.ok++; st.sum += sim.now() - o.t0; lab.log.log('Order #' + o.id + ' COMPLETED.', { t: sim.now(), level: 'ok' }); render(); return; }
      var s = STEPS[i];
      lab.log.log(mode === 'orch'
        ? 'Orchestrator -> command to ' + s.svc + ' for order #' + o.id + '.'
        : (i === 0 ? 'OrderCreated event: Payment reacts for order #' + o.id + '.' : STEPS[i - 1].svc + ' event for #' + o.id + ': ' + s.svc + ' reacts.'), { t: sim.now() });
      sim.schedule(500 + (mode === 'orch' ? 100 : 0), function () {
        if (i === failIdx()) {
          o[s.k] = 'failed';
          lab.log.log(s.svc + ' FAILED for order #' + o.id + (comp ? '. Starting compensation.' : '. Nothing compensates the earlier steps!'), { t: sim.now(), level: 'err' });
          compensate(o, i - 1);
        } else { o[s.k] = s.ok; render(); run(o, i + 1); }
      });
      render();
    }

    function compensate(o, j) {
      if (!comp) {
        o.state = 'inconsistent'; st.inflight--; st.bad++;
        lab.log.log('Order #' + o.id + ' is INCONSISTENT: the customer was charged and stock is held, but nothing ships.', { t: sim.now(), level: 'err' });
        render(); return;
      }
      if (j < 0) { o.state = 'cancelled'; st.inflight--; st.cancel++; lab.log.log('Order #' + o.id + ' CANCELLED cleanly.', { t: sim.now(), level: 'warn' }); render(); return; }
      sim.schedule(400, function () {
        o[STEPS[j].k] = UNDO[j];
        lab.log.log('Compensation: ' + STEPS[j].svc + ' ' + UNDO[j] + ' order #' + o.id + '.', { t: sim.now(), level: 'ok' });
        render(); compensate(o, j - 1);
      });
    }

    function render() {
      STEPS.forEach(function (s, i) {
        fill(boxes[i], st.orders.slice(-8).filter(function (o) { return o[s.k]; }).map(function (o) {
          var v = o[s.k];
          return { label: '#' + o.id + ' ' + v, cls: (o.state === 'inconsistent' && v !== 'failed') ? 'bad' : (v === 'failed' ? 'bad' : (v === 'refunded' || v === 'released' ? 'dup' : 'ok')) };
        }), 8);
        boxes[i].note.textContent = 'chips: green = done, orange = compensated, red = failed or stranded';
      });
      lab.metrics.set('throughput', rate(st.ok, sim.now()));
      lab.metrics.set('latency', avg(st.sum, st.ok));
      lab.metrics.set('depth', st.inflight);
      lab.metrics.set('errors', st.bad);
    }

    function seed() {
      st = { id: 0, orders: [], inflight: 0, ok: 0, cancel: 0, bad: 0, sum: 0 };
      lab.log.clear(); lab.metrics.reset();
      lab.bar.setBroken(fail !== 'none' && !comp);
      lab.explain((mode === 'orch'
        ? '**Orchestration:** a central coordinator calls each step and owns the compensation logic. Easy to see and change the flow; the coordinator is a dependency (keep it stateless-ish with persisted saga state). Each step costs an extra hop.'
        : '**Choreography:** each service reacts to the previous service\'s event; there is no boss. Loosely coupled and fast, but the flow lives in nobody\'s head and is hard to follow as it grows.')
        + (fail === 'none' ? ' Set a failing step to see rollback.' : (comp ? ' **Compensating actions** run in reverse: refund the payment, release the stock. A compensation is a new business operation, not a database rollback.' : ' With **no compensation** each local transaction already committed, so the customer is charged for goods that will never ship. There is no automatic rollback across services.')));
      lab.log.log('Mode: ' + mode + ', failing step: ' + fail + ', compensation ' + (comp ? 'ON' : 'OFF') + '.', { t: 0 });
      sim.schedule(0, start);
      render();
    }

    sim.on('reset', seed);
    var seg = segmented('Style', [['orch', 'Orchestration'], ['chor', 'Choreography']], mode, function (v) { mode = v; sim.reset(); });
    var failS = segmented('Failing step', [['none', 'None'], ['inventory', 'Inventory'], ['shipping', 'Shipping']], fail, function (v) { fail = v; sim.reset(); });
    var compC = checkbox('Compensating actions', comp, function (v) { comp = v; sim.reset(); });
    seed();
    return wrap([seg, failS, compC], lab);
  }

  /* ================= LAB 5: outbox ================= */

  function labOutbox() {
    var sim = Sim.create({ speed: 1 });
    var mode = 'dual', outage = false, st;
    var dbBox = mkBox('Order database'), obBox = mkBox('Outbox table (same DB)'), brBox = mkBox('Broker'), cBox = mkBox('Consumer (idempotent)');
    var stage = h('div', { class: 'qv' }, [dbBox.el, obBox.el, brBox.el, cBox.el]);

    var lab = UI.lab({
      title: 'Lab 5: the transactional outbox',
      subtitle: 'Each order must be saved AND announced. The broker is down from 3 s to 6 s. Dual write or outbox?',
      sim: sim, stage: stage,
      stageLabel: 'Database, outbox, broker and consumer',
      breakLabel: 'Break it: dual write during a broker outage',
      fixLabel: 'Fix it: use the outbox',
      onBreak: function (broken) { mode = broken ? 'dual' : 'outbox'; outage = true; seg.set(mode); outC.set(true); sim.reset(); sim.play(); },
      caption: 'Press Play. In outbox mode one relay crash causes a duplicate, which the consumer ignores.'
    });

    function brokerDown() { return outage && sim.now() >= 3000 && sim.now() < 6000; }

    function deliver(id) {
      if (st.got[id]) { st.dup++; lab.log.log('Duplicate of order #' + id + ' ignored by the idempotent consumer.', { t: sim.now(), level: 'ok' }); return; }
      st.got[id] = true; st.delivered++; st.sum += sim.now() - st.t0[id];
    }

    function order() {
      var id = ++st.id;
      st.t0[id] = sim.now(); st.db.push(id);
      if (mode === 'dual') {
        if (brokerDown()) { st.lost[id] = true; st.nLost++; lab.log.log('Order #' + id + ' saved, but publishing failed (broker down). The event is LOST; nobody will ever ship it.', { t: sim.now(), level: 'err' }); }
        else { deliver(id); }
      } else { st.outbox.push(id); }
      sim.schedule(600, order);
      render();
    }

    function relay() {
      if (mode === 'outbox' && !brokerDown() && st.outbox.length) {
        var keep = [];
        st.outbox.forEach(function (id) {
          deliver(id);
          if (id === 8 && !st.crashed) { st.crashed = true; keep.push(id); lab.log.log('Relay crashed after publishing #8 but before marking it sent. It will publish it again (at-least-once).', { t: sim.now(), level: 'warn' }); }
        });
        st.outbox = keep;
      } else if (mode === 'outbox' && brokerDown() && st.outbox.length && !st.warned) {
        st.warned = true; lab.log.log('Broker down: orders keep being accepted; their events wait safely in the outbox table.', { t: sim.now(), level: 'warn' });
      }
      sim.schedule(400, relay);
      render();
    }

    function render() {
      fill(dbBox, st.db.slice(-16).map(function (i) { return { label: '#' + i, cls: st.lost[i] ? 'bad' : (st.got[i] ? 'ok' : 'dup') }; }), 16);
      dbBox.note.textContent = st.db.length + ' orders committed (red = event lost)';
      fill(obBox, st.outbox.map(function (i) { return { label: '#' + i, cls: 'dup' }; }), 16);
      obBox.note.textContent = mode === 'outbox' ? st.outbox.length + ' unsent row(s)' : 'not used in dual-write mode';
      brBox.state(brokerDown() ? 'is-dead' : '');
      fill(brBox, [], 1);
      brBox.note.textContent = brokerDown() ? 'DOWN' : 'up';
      fill(cBox, st.delivered ? [{ label: st.delivered + ' unique', cls: 'ok' }] : [], 1);
      cBox.note.textContent = 'duplicates ignored: ' + st.dup;
      lab.metrics.set('throughput', rate(st.delivered, sim.now()));
      lab.metrics.set('latency', avg(st.sum, st.delivered));
      lab.metrics.set('depth', st.outbox.length);
      lab.metrics.set('errors', st.nLost);
    }

    function summary() {
      sim.schedule(8000, function () {
        lab.explain(st.nLost
          ? '**Dual write failed.** Saving to the database and publishing to the broker are two separate systems, so they cannot be made atomic. When one succeeds and the other fails, the system disagrees with itself forever: ' + st.nLost + ' order(s) exist with no event.'
          : '**Outbox worked.** The order and its event row commit in **one** local transaction, so they cannot diverge. The relay publishes later and retries through the outage. Price: a little delay, and at-least-once delivery, so consumers dedupe by event id.');
      });
    }

    function seed() {
      st = { id: 0, db: [], outbox: [], got: {}, lost: {}, t0: {}, delivered: 0, dup: 0, nLost: 0, sum: 0, crashed: false, warned: false };
      lab.log.clear(); lab.metrics.reset();
      lab.bar.setBroken(mode === 'dual' && outage);
      lab.explain(mode === 'dual'
        ? '**Dual write:** commit to the database, then publish. Works until the process or the broker fails between the two steps.'
        : '**Outbox:** write the order and an outbox row in the same transaction; a relay publishes rows to the broker.');
      lab.log.log('Mode: ' + mode + (outage ? ', broker outage 3-6 s' : ', no outage') + '. Orders every 0.6 s.', { t: 0 });
      sim.schedule(0, order); sim.schedule(200, relay); summary();
      render();
    }

    sim.on('tick', render);
    sim.on('reset', seed);
    var seg = segmented('Publishing', [['dual', 'Dual write'], ['outbox', 'Outbox + relay']], mode, function (v) { mode = v; sim.reset(); });
    var outC = checkbox('Broker outage 3-6 s', outage, function (v) { outage = v; sim.reset(); });
    seed();
    return wrap([seg, outC], lab);
  }

  /* ================= LAB 6: event versioning ================= */

  function labVersion() {
    var sim = Sim.create({ speed: 1 });
    var style = 'additive', st;
    var pre = h('pre', { class: 'json-pre', 'aria-live': 'off' });
    var cBox = mkBox('Consumer v1 (reads "price")'), dBox = mkBox('Dead letter queue', 'dlq');
    var stage = h('div', {}, [pre, h('div', { class: 'qv' }, [cBox.el, dBox.el])]);

    var lab = UI.lab({
      title: 'Lab 6: event versioning and schema evolution',
      subtitle: 'At 3 s the producer ships version 2 of OrderPlaced. The consumer is still on version 1 and reads "price". How the change is made decides whether it survives.',
      sim: sim, stage: stage,
      stageLabel: 'Latest event payload, consumer and dead letter queue',
      breakLabel: 'Break it: rename "price" to "amount"',
      fixLabel: 'Fix it: additive change',
      onBreak: function (broken) { style = broken ? 'rename' : 'additive'; seg.set(style); sim.reset(); sim.play(); },
      caption: 'Press Play. At 3 s the producer deploys v2.'
    });

    function makeEvent(n, v2) {
      var price = 10 + (n % 7) * 5;
      if (!v2) { return { type: 'OrderPlaced', version: 1, orderId: 'o-' + n, price: price }; }
      if (style === 'additive') { return { type: 'OrderPlaced', version: 2, orderId: 'o-' + n, price: price, currency: 'EUR' }; }
      return { type: 'OrderPlaced', version: 2, orderId: 'o-' + n, amount: { value: price, currency: 'EUR' } };
    }

    function consume(e) {
      var x = e;
      if (style === 'upcast' && x.version === 2 && x.amount) { x = { type: x.type, version: 1, orderId: x.orderId, price: x.amount.value }; }
      if (typeof x.price !== 'number') {
        st.fail++; st.dlq.push(e.orderId);
        if (st.fail % 3 === 1) { lab.log.log('Consumer v1 cannot handle ' + e.orderId + ' (version ' + e.version + '): "price" is undefined. Event dead-lettered.', { t: sim.now(), level: 'err' }); }
      } else { st.ok++; st.rev += x.price; }
    }

    function emit() {
      var n = ++st.n, v2 = sim.now() >= 3000;
      if (v2 && !st.deployed) { st.deployed = true; lab.log.log('Producer deploys schema v2 (' + style + ').', { t: sim.now(), level: 'warn' }); }
      var e = makeEvent(n, v2);
      pre.textContent = JSON.stringify(e, null, 2);
      consume(e); render();
      sim.schedule(500, emit);
    }

    function render() {
      fill(cBox, [], 1);
      cBox.note.textContent = 'handled ' + st.ok + ' | revenue ' + st.rev;
      cBox.state(st.fail ? 'is-dead' : '');
      fill(dBox, st.dlq.slice(-14).map(function (i) { return { label: i, cls: 'bad' }; }), 14);
      dBox.note.textContent = st.dlq.length + ' undeliverable';
      lab.metrics.set('throughput', rate(st.ok, sim.now()));
      lab.metrics.set('latency', NaN);
      lab.metrics.set('depth', st.dlq.length);
      lab.metrics.set('errors', st.fail);
    }

    function seed() {
      st = { n: 0, ok: 0, fail: 0, rev: 0, dlq: [], deployed: false };
      lab.log.clear(); lab.metrics.reset();
      lab.bar.setBroken(style === 'rename');
      pre.textContent = '(waiting for the first event)';
      lab.explain({
        rename: '**Breaking change.** Renaming or moving a field breaks every consumer that has not deployed yet, and old events in the log still use the old shape. Coordinated deploys across teams are fragile and rarely possible.',
        additive: '**Backward-compatible change.** Add new fields, keep the old ones, and let consumers migrate at their own pace. Remove the old field only after everyone has moved, with a published deprecation date. A schema registry can enforce this automatically.',
        upcast: '**Upcasting.** The new shape is breaking, but the consumer carries a small translator that converts version 2 into the version it understands. This also lets you replay years of old events through today\'s code.'
      }[style]);
      lab.log.log('Producer emits every 0.5 s; v2 ships at 3 s (style: ' + style + ').', { t: 0 });
      sim.schedule(0, emit);
      render();
    }

    sim.on('reset', seed);
    var seg = segmented('How v2 is introduced', [['rename', 'Rename field (breaking)'], ['additive', 'Add field (compatible)'], ['upcast', 'Rename + upcaster']], style, function (v) { style = v; sim.reset(); });
    seed();
    return wrap([seg], lab);
  }

  /* ================= LAB 7: correlation IDs and tracing waterfall ================= */

  function labTrace() {
    var sim = Sim.create({ speed: 1 });
    var prop = true, pay = 200, st;
    var head = h('p', { class: 'cf-note', role: 'status' });
    var wf = h('div', { class: 'wf', role: 'img', 'aria-label': 'Waterfall of spans for one request across services' });
    var stage = h('div', {}, [head, wf]);

    var lab = UI.lab({
      title: 'Lab 7: correlation IDs and a tracing waterfall',
      subtitle: 'One "place order" request fans out through services and, via a queue, to Shipping and Email. Can you stitch it back together?',
      sim: sim, stage: stage,
      stageLabel: 'Waterfall of spans for the latest request',
      breakLabel: 'Break it: drop the correlation ID at the queue',
      fixLabel: 'Fix it: propagate the ID in message headers',
      onBreak: function (broken) { prop = !broken; propC.set(prop); sim.reset(); sim.play(); },
      caption: 'Press Play. Slow Payment down to see where the time goes.'
    });

    function spans() {
      var oe = 70 + pay + 140;
      return [
        { n: 'api-gateway', s: 0, d: oe + 40, async: false },
        { n: 'order-service', s: 20, d: oe - 20, async: false },
        { n: 'payment-service', s: 70, d: pay, async: false, slow: pay > 500 },
        { n: 'inventory-service', s: 70 + pay, d: 100, async: false },
        { n: 'queue wait', s: oe, d: 300, async: true },
        { n: 'shipping-service', s: oe + 300, d: 400, async: true },
        { n: 'email-service', s: oe + 300, d: 250, async: true }
      ];
    }

    function cid(n) { return 'c-' + ((n * 2654435761) >>> 0).toString(16).slice(0, 6); }

    function request() {
      var id = ++st.n;
      st.cur = { id: id, cid: cid(id), t0: sim.now(), spans: spans() };
      var orphans = prop ? 0 : st.cur.spans.filter(function (x) { return x.async; }).length;
      var end = st.cur.spans.reduce(function (m, x) { return Math.max(m, x.s + x.d); }, 0);
      st.cur.spans.forEach(function (x) {
        x.orphan = !prop && x.async;
        sim.schedule(x.s, function () {
          lab.log.log('[' + (x.orphan ? 'no id' : st.cur.cid) + '] ' + x.n + ' ' + x.d + ' ms' + (x.orphan ? ' (cannot be linked to the request)' : ''), { t: sim.now(), level: x.orphan ? 'err' : (x.slow ? 'warn' : 'info') });
        });
      });
      st.orph += orphans;
      if (orphans) { st.broken++; }
      sim.schedule(end, function () { st.done++; st.sum += end; });
      sim.schedule(3000, request);
    }

    function render() {
      wf.innerHTML = '';
      var c = st.cur;
      if (!c) { head.textContent = 'Waiting for the first request.'; return; }
      var total = c.spans.reduce(function (m, x) { return Math.max(m, x.s + x.d); }, 1);
      var el = sim.now() - c.t0;
      head.textContent = 'Trace ' + c.cid + (prop ? ': all spans share this correlation ID, so one query returns the whole flow.' : ': only the synchronous spans carry the ID. Shipping and Email lost it at the queue, so they appear as unrelated orphans.');
      c.spans.forEach(function (x) {
        var vis = Math.max(0, Math.min(x.d, el - x.s));
        var bar = h('div', { class: 'wf-bar' + (x.orphan ? ' orphan' : (x.slow ? ' slow' : '')) });
        bar.style.left = (x.s / total * 100) + '%';
        bar.style.width = (vis / total * 100) + '%';
        wf.appendChild(h('div', { class: 'wf-row' }, [h('span', { text: x.n + (x.orphan ? ' (orphan)' : '') }), h('div', { class: 'wf-lane' }, [bar])]));
      });
      lab.metrics.set('throughput', rate(st.done, sim.now()));
      lab.metrics.set('latency', avg(st.sum, st.done));
      lab.metrics.set('depth', st.orph);
      lab.metrics.set('errors', st.broken);
    }

    function seed() {
      st = { n: 0, cur: null, orph: 0, broken: 0, done: 0, sum: 0 };
      lab.log.clear(); lab.metrics.reset();
      lab.bar.setBroken(!prop);
      lab.explain(prop
        ? '**Correlation ID.** The gateway creates one id and every service copies it into logs, calls and message headers. Search that id and you see the full waterfall; the widest bar (' + (pay > 500 ? 'Payment, highlighted' : 'currently Payment or the queue wait') + ') shows where the time goes.'
        : '**Lost context.** The id was not copied into the message headers, so the asynchronous half of the flow has no link to the request. In an incident you can see that Shipping was slow but not **which** order or request it belonged to. Always propagate the id (or W3C traceparent) through queues and events.');
      lab.log.log('Request every 3 s, Payment latency ' + pay + ' ms, propagation ' + (prop ? 'ON' : 'OFF') + '.', { t: 0 });
      sim.schedule(0, request);
      render();
    }

    sim.on('tick', render);
    sim.on('reset', seed);
    var propC = checkbox('Propagate correlation ID through the queue', prop, function (v) { prop = v; sim.reset(); });
    var payS = slider('Payment latency', 50, 1500, pay, 50, function (v) { return v + ' ms'; }, function (v) { pay = v; sim.reset(); });
    seed();
    return wrap([propC, payS], lab);
  }

  /* ================= ANTI-PATTERNS ================= */

  function antiPatterns() {
    return h('div', { class: 'card' }, [
      h('div', { class: 'card-title' }, [h('h3', { text: 'Anti-patterns: how event-driven systems go wrong' })]),
      UI.accordion({ items: [
        { title: 'The distributed monolith', body: 'Services are separate processes but cannot change or deploy independently, because their events are tightly shared and every flow touches all of them. **Smell:** a release needs five teams. **Fix:** clear ownership, small stable contracts, bounded contexts.' },
        { title: 'Events used as hidden RPC', body: 'Service A publishes "PleaseChargeCard" and waits for "CardCharged", which is a synchronous call wearing a costume, with worse latency and debugging. **Fix:** use a plain request when you need an answer now; use an event only for a fact others may react to.' },
        { title: 'God events and leaking internals', body: 'One huge event with the entire database row, consumed by everyone, so any internal change breaks someone. **Fix:** design events as a public API: only what consumers need, versioned, with a schema registry.' },
        { title: 'Assuming exactly-once and ordering', body: 'Consumers that increment a counter or send an email on every delivery. Redeliveries and reordering will corrupt data. **Fix:** idempotent handlers keyed by event id, version checks, and per-key ordering only where required.' },
        { title: 'Dual writes', body: 'Updating the database and publishing to a broker as two independent steps. **Fix:** transactional outbox or change data capture (Lab 5).' },
        { title: 'Event sourcing everywhere', body: 'Using event sourcing for simple CRUD data because it sounds modern, then paying for projections, replay, versioning and privacy handling with no benefit. **Fix:** apply it to domains where history and audit truly matter.' },
        { title: 'No observability or ownership', body: 'Nobody knows which services consume an event, how far behind they are, or who owns the dead-letter queue. **Fix:** correlation IDs, consumer lag and oldest-message alerts, an event catalogue and a DLQ runbook.' },
        { title: 'Unbounded retries and replays', body: 'Retrying a failing message forever, or replaying history through consumers that send real emails and payments. **Fix:** bounded retries with backoff, dead-lettering, side-effect guards and explicit replay modes.' }
      ] }).el
    ]);
  }

  /* ================= PREDICT ================= */

  function predict() {
    return UI.predictChallenge({
      question: 'A choreographed saga has three steps: Payment, Inventory, Shipping. Payment and Inventory succeed, then Shipping fails. How many compensating actions must run?',
      setup: 'Completed steps: Payment (charged), Inventory (reserved). Failed step: Shipping. Compensations undo only the steps that completed.',
      options: ['0', '1', '2', '3'],
      answer: 2,
      duration: 4200,
      speed: 4,
      explain: 'Shipping never completed, so it needs no compensation. The two completed steps are compensated in **reverse order**: release the inventory, then refund the payment. That is **2** compensating actions, not a database rollback.',
      simulate: function (ctx) {
        var s = ctx.sim;
        var out = h('p', { class: 'ui-box', text: 'Compensations run: 0' });
        ctx.stage.appendChild(out);
        ctx.state = { n: 0 };
        var plan = [
          [700, 'Payment charged the customer.', 'ok', 0],
          [1400, 'Inventory reserved the stock.', 'ok', 0],
          [2100, 'Shipping FAILED.', 'err', 0],
          [2800, 'Compensation: Inventory released the stock.', 'warn', 1],
          [3500, 'Compensation: Payment refunded the customer.', 'warn', 1]
        ];
        plan.forEach(function (p) {
          s.schedule(p[0], function () {
            ctx.state.n += p[3];
            out.textContent = 'Compensations run: ' + ctx.state.n;
            ctx.log(p[1], { t: s.now(), level: p[2] });
          });
        });
      },
      measure: function (ctx) { return ctx.state.n + ' compensating action(s) ran.'; }
    }).el;
  }

  /* ================= CHEAT SHEET + INTERVIEW ================= */

  function cheatSheet() {
    var items = [
      ['Event vs command', 'Event = past-tense fact, many listeners. Command = request to one handler, may be refused.'],
      ['Event styles', 'Notification (id only, callback), carried state (data inside, local copy), sourcing (log is the truth).'],
      ['Coupling', 'Events decouple callers from callees in time and knowledge. They do not remove the contract.'],
      ['CQRS', 'Separate write and read models. Reads are eventually consistent. Offer read-your-writes where it matters.'],
      ['Saga', 'Local transactions plus compensations in reverse. Orchestration = coordinator. Choreography = reactions. Persist state.'],
      ['Outbox', 'Business row and event row in one transaction; relay publishes with retries. At-least-once, so dedupe.'],
      ['Idempotency', 'Dedupe on event id in the same transaction as the effect, or use naturally idempotent operations.'],
      ['Versioning', 'Add, do not rename. Version events, use a schema registry, write upcasters, deprecate slowly.'],
      ['Observability', 'Correlation id in every log and header, lag and oldest-message age, DLQ alerts, an event catalogue.']
    ];
    return h('div', { class: 'cheat' }, items.map(function (it) {
      return h('div', { class: 'cheat-item' }, [h('h4', { text: it[0] }), UI.rich(it[1])]);
    }));
  }

  function interview() {
    return UI.accordion({ items: [
      { title: 'When would you choose event-driven architecture, and when not?', body: 'Choose it when several independent consumers react to the same facts, when you need to absorb spikes and survive consumer outages, or when an audit trail and replay have value. Avoid it for simple CRUD, flows needing an immediate answer or strict consistency, and small teams that cannot yet afford the operational and debugging cost. A well-factored monolith is often the right starting point.' },
      { title: 'What is the difference between an event and a command?', body: 'An **event** states that something already happened and is named in the past tense ("OrderPlaced"); the producer does not know or care who listens. A **command** asks one specific handler to do something ("ChargeCard") and can be rejected. Treating commands as events hides coupling.' },
      { title: 'Compare event notification, event-carried state transfer and event sourcing.', body: '**Notification:** a small signal, consumers call back for data (re-couples at run time). **Event-carried state:** the event holds the data so consumers keep their own copy (resilient, but duplicated and eventually consistent). **Event sourcing:** events are the system of record; state is derived by replay (history and audit, at the cost of complexity). They solve different problems and can be combined.' },
      { title: 'How do you handle eventual consistency in the user experience?', body: 'Return the result of the write in the command response, read your own writes from the write model or a session cache, show "processing" states, use version or etag checks, and make operations idempotent so retries are safe. Decide per feature which data really needs strong consistency.' },
      { title: 'Explain the saga pattern and orchestration vs choreography.', body: 'A saga replaces a distributed transaction with a sequence of local transactions, each with a **compensating action** to semantically undo it if a later step fails. In **orchestration** a coordinator drives the steps and compensations, which is easier to reason about but adds a central component. In **choreography** services react to each other\'s events, which is loosely coupled but harder to follow and test. Persist saga state, make steps and compensations idempotent, and put irreversible steps last.' },
      { title: 'What problem does the outbox pattern solve?', body: 'The **dual-write problem**: you cannot atomically update a database and publish to a broker. Write the event into an outbox table in the same transaction as the business change, then a relay (poller or change data capture) publishes it and marks it sent. Delivery is at-least-once, so consumers need an inbox or idempotency check.' },
      { title: 'How do you make a consumer idempotent?', body: 'Give every event a unique id and record processed ids in the same transaction as the side effect (unique constraint), or design operations to be naturally idempotent (set a value, upsert by key, "if version is newer"). For external side effects such as email, store a sent marker keyed by the event id.' },
      { title: 'How do you evolve event schemas safely?', body: 'Prefer additive, backward-compatible changes; include a version; use a schema registry with compatibility rules (backward, forward or full); keep old fields during a deprecation period; use upcasters to translate old events when replaying; and never change the meaning of an existing field. For genuinely breaking changes, publish a new event type or topic and migrate consumers.' },
      { title: 'How do you debug a request that crossed six services and two queues?', body: 'Generate a correlation or trace id at the edge and propagate it in HTTP headers and message headers (for example W3C traceparent). Log it everywhere and use distributed tracing to see the waterfall. Add metrics for consumer lag, oldest-message age, redeliveries and DLQ depth, and keep an event catalogue so you know who consumes what.' },
      { title: 'What are the risks of event sourcing?', body: 'Complexity in schema evolution, slow rebuilds without snapshots, eventual consistency for reads, difficulty deleting personal data from an immutable log, and replay hazards when handlers have external side effects. Use it where the history is the business value (finance, audit, workflows), not as a default storage strategy.' }
    ] }).el;
  }

  /* ================= MOUNT ================= */

  function mount(el) {
    el.appendChild(h('div', { class: 'topic-intro' }, [h('p', { class: 'lead', text: 'Instead of services calling each other and waiting, they announce facts and react. You will see the benefits and, more importantly, the traps.' })]));
    el.appendChild(storyBlock());
    el.appendChild(title('Learn it at your level', 'Start at Beginner. Each level adds depth and real production scars.'));
    el.appendChild(levelTabs());

    el.appendChild(title('Lab 1 \u00B7 Request-driven vs event-driven coupling'));
    el.appendChild(labCoupling());
    el.appendChild(title('Event notification vs carried state vs event sourcing'));
    el.appendChild(stylesBlock());
    el.appendChild(title('Lab 2 \u00B7 Event store, replay and time travel'));
    el.appendChild(labStore());
    el.appendChild(title('Lab 3 \u00B7 CQRS and eventual consistency'));
    el.appendChild(labCqrs());
    el.appendChild(title('Lab 4 \u00B7 Saga: orchestration, choreography and compensation'));
    el.appendChild(labSaga());
    el.appendChild(title('Lab 5 \u00B7 The transactional outbox'));
    el.appendChild(labOutbox());
    el.appendChild(title('Lab 6 \u00B7 Event versioning'));
    el.appendChild(labVersion());
    el.appendChild(title('Lab 7 \u00B7 Correlation IDs and tracing'));
    el.appendChild(labTrace());
    el.appendChild(title('Anti-patterns'));
    el.appendChild(antiPatterns());

    el.appendChild(title('Predict the outcome'));
    el.appendChild(predict());

    el.appendChild(title('Quiz', '5 questions. Score 70% or more to complete this topic.'));
    el.appendChild(UI.quiz({ title: 'Event-driven architecture quiz', topicId: 'eda', questions: (global.QUIZZES && global.QUIZZES.eda) || [], passPct: 70 }).el);

    el.appendChild(title('Cheat sheet'));
    el.appendChild(cheatSheet());
    el.appendChild(title('Interview questions', 'Try answering out loud before opening each one.'));
    el.appendChild(interview());
  }

  global.App.registerTopic({ id: 'eda', title: 'Event-Driven Architecture', accent: 'eda', mount: mount });
})(window);
