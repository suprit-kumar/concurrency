/*
 * t4-kafka-rabbit.js - Topic 4: Kafka and RabbitMQ.
 * Story, level tabs, nine labs (5 Kafka, 4 RabbitMQ), comparison matrix, decision wizard,
 * predict challenge, quiz, cheat sheet and interview questions.
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
    var name = 't4seg' + (++uid);
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
    var id = 't4cb' + (++uid);
    var inp = h('input', { type: 'checkbox', id: id });
    inp.checked = !!checked;
    inp.addEventListener('change', function () { onChange(inp.checked); });
    return { el: h('label', { class: 'ctl', for: id }, [inp, h('span', { text: label })]), get: function () { return inp.checked; }, set: function (v) { inp.checked = !!v; } };
  }

  function slider(label, min, max, val, step, fmt, onChange) {
    var id = 't4sl' + (++uid);
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

  function textInput(label, value, onChange) {
    var id = 't4ti' + (++uid);
    var inp = h('input', { type: 'text', id: id, class: 'txt', value: value });
    inp.addEventListener('input', function () { onChange(inp.value); });
    return { el: h('label', { class: 'ctl', for: id }, [h('span', { text: label }), inp]), get: function () { return inp.value; }, set: function (v) { inp.value = v; } };
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
      var s = h('span', { class: 'qv-msg ' + (m.cls || ''), text: String(m.label) });
      if (m.color) { s.style.background = m.color; s.style.borderColor = m.border || m.color; }
      box.items.appendChild(s);
    });
    if (list.length > lim) { box.items.appendChild(h('span', { class: 'qv-note', text: '+' + (list.length - lim) + ' more' })); }
  }

  function avg(sum, n) { return n ? Math.round(sum / n) : NaN; }

  function hash(s) { var x = 0; for (var i = 0; i < s.length; i++) { x = (x * 31 + s.charCodeAt(i)) >>> 0; } return x; }
  function keyColor(k) { return 'hsl(' + ((hash(k) * 37) % 360) + ' 70% 50% / .5)'; }

  /* ================= THE STORY ================= */

  function storyBlock() {
    var scene = h('div', { class: 'qstory', role: 'img', 'aria-label': 'Two systems: a library shelf where every book stays in order, and a post office that sorts letters into pigeonholes by address' }, [
      h('div', { class: 'qs-who', text: 'Kafka: the library log' }),
      h('div', { class: 'qs-rail' }, [0, 1, 2, 3, 4, 5].map(function (i) { var t = h('i', { class: 'qt' }); t.style.setProperty('--d', (-i) + 's'); return t; })),
      h('div', { class: 'qs-who', text: 'RabbitMQ: the sorting office' })
    ]);
    UI.onVisible(scene, function () { scene.classList.remove('is-paused'); }, function () { scene.classList.add('is-paused'); });
    var stepper = UI.stepper({
      steps: [
        { title: '0:00 Two tools, two mindsets', body: 'Both move messages between programs. But they are built around different pictures. **Kafka** is a **log**: a very long ledger where new entries are added at the end and stay there. **RabbitMQ** is a **broker**: a smart sorting office that takes each message, decides where it goes, and forgets it once it is delivered.' },
        { title: '0:15 Kafka: the library shelf', body: 'Imagine a shelf where every new book goes on the end and has a **number** (its offset). Readers keep their own **bookmark**. Ten readers can read the same shelf at different speeds, and a new reader can start from the very first book. Books are not removed when read; they are removed when they get old. Big libraries split the shelf into several **partitions** to hold more and be read in parallel.' },
        { title: '0:30 RabbitMQ: the sorting office', body: 'A letter arrives with an address (the **routing key**). The office looks at its rules (**bindings**) and drops copies into the right pigeonholes (**queues**). Workers take letters from a pigeonhole, and a letter is thrown away once the worker signs for it (**ack**). Great for "send this job to the right team".' },
        { title: '0:45 So which one?', body: 'Need to **keep and replay** a huge stream of events for many readers? Think Kafka. Need **flexible routing and per-message handling** (priorities, TTL, retries to a dead-letter queue) for tasks? Think RabbitMQ. Many systems use both. Neither is "better"; they answer different questions.' },
        { title: '0:55 What you will do', body: 'Below you will append to partitions, watch a consumer-group rebalance, kill a Kafka leader, replay history, route messages through exchanges with wildcard bindings, crash a broker, and finish with a decision wizard.' }
      ]
    });
    return h('div', { class: 'card' }, [
      h('div', { class: 'card-title' }, [h('h3', { text: 'The Story: a library shelf vs a sorting office' })]),
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

  var PY_KAFKA = "from confluent_kafka import Producer, Consumer\n\np = Producer({'bootstrap.servers': 'b1:9092',\n              'acks': 'all',                  # wait for in-sync replicas\n              'enable.idempotence': True})    # no duplicates from producer retries\np.produce('orders', key='user-42', value=b'{...}')   # same key -> same partition -> ordered\np.flush()\n\nc = Consumer({'bootstrap.servers': 'b1:9092',\n              'group.id': 'billing',\n              'enable.auto.commit': False,     # commit only after the work succeeded\n              'auto.offset.reset': 'earliest'})\nc.subscribe(['orders'])\nwhile True:\n    msg = c.poll(1.0)\n    if msg is None or msg.error():\n        continue\n    handle(msg)          # must be idempotent: a crash before commit means redelivery\n    c.commit(msg)        # at-least-once";
  var PY_RABBIT = "import pika\n\nconn = pika.BlockingConnection(pika.ConnectionParameters('localhost'))\nch = conn.channel()\nch.exchange_declare('events', exchange_type='topic', durable=True)\nch.exchange_declare('dlx', exchange_type='fanout', durable=True)\nch.queue_declare('dead', durable=True)\nch.queue_bind('dead', 'dlx')\nch.queue_declare('billing', durable=True, arguments={\n    'x-queue-type': 'quorum',                 # replicated (Raft) and durable\n    'x-dead-letter-exchange': 'dlx',\n    'x-message-ttl': 60000})\nch.queue_bind('billing', 'events', 'order.*.eu')\n\nch.confirm_delivery()                          # publisher confirms\nch.basic_publish('events', 'order.created.eu', b'{...}',\n                 properties=pika.BasicProperties(delivery_mode=2, message_id='o-123'),\n                 mandatory=True)               # error if unroutable\n\nch.basic_qos(prefetch_count=10)                # at most 10 unacked per consumer\ndef on_msg(ch, method, props, body):\n    try:\n        handle(body)\n        ch.basic_ack(method.delivery_tag)\n    except Exception:\n        ch.basic_nack(method.delivery_tag, requeue=False)   # to the DLX, no hot loop\nch.basic_consume('billing', on_msg)\nch.start_consuming()";
  var CFG_KAFKA = "# Topic (durability)\nreplication.factor=3\nmin.insync.replicas=2\nunclean.leader.election.enable=false\n\n# Producer\nacks=all\nenable.idempotence=true\ncompression.type=lz4\nlinger.ms=5\n\n# Consumer\nenable.auto.commit=false\npartition.assignment.strategy=CooperativeStickyAssignor\nmax.poll.interval.ms=300000   # longer than your slowest batch, or you get rebalanced\nsession.timeout.ms=45000\n\n# Retention\nretention.ms=604800000        # 7 days (default)\ncleanup.policy=delete         # or compact for latest-value-per-key topics";

  function levelTabs() {
    var panelI = UI.codePanel({ title: 'The same idea in code', tabs: [
      { lang: 'python', label: 'Kafka (Python)', code: PY_KAFKA },
      { lang: 'python', label: 'RabbitMQ (Python)', code: PY_RABBIT }
    ] });
    var panelA = UI.codePanel({ title: 'Production settings that matter', tabs: [
      { lang: 'text', label: 'Kafka', code: CFG_KAFKA },
      { lang: 'python', label: 'RabbitMQ quorum queue', code: PY_RABBIT }
    ] });
    return UI.tabs({
      label: 'Kafka and RabbitMQ at three levels',
      tabs: [
        { id: 'beginner', label: 'Beginner', content: function () {
          return levelPane(
            '**Apache Kafka** stores messages in a **topic**, which is split into **partitions**. Each partition is an **append-only log**: new messages go on the end and get the next number, called an **offset**. Messages are kept for a set time (for example 7 days) whether or not anybody has read them. A **consumer** remembers its own offset ("my bookmark"), so it can stop, restart and carry on, or go back and read again.\n\n**RabbitMQ** is a **message broker** using AMQP. Producers publish to an **exchange**. The exchange looks at the message\'s **routing key** and the **bindings** (rules) and copies it into one or more **queues**. Consumers take messages from queues, and **acknowledge** them; once acknowledged the message is gone.\n\nRule of thumb: Kafka is a **log of events** you can re-read. RabbitMQ is a **router of tasks** that are done once.',
            'Kafka is a security-camera recording: it keeps footage for a week and anyone can rewind. RabbitMQ is a post office: it sorts each letter to the right box and the letter disappears when it is collected.',
            '- "Kafka is just a faster RabbitMQ". They have different models; neither replaces the other in every case.\n- "Kafka deletes a message after it is read". It does not; retention decides.\n- "More consumers always means more speed". In Kafka the limit is the number of partitions.\n- "A topic is ordered". Only each **partition** is ordered.\n- "RabbitMQ never loses a message". Not unless queues are durable, messages persistent, publishers use confirms and consumers ack properly.',
            'You pick a tool by popularity, then rebuild its missing half yourself: replay on a queue broker, or per-message retries and priorities on a log.'
          );
        } },
        { id: 'intermediate', label: 'Intermediate', content: function () {
          return levelPane(
            '**Kafka.** The **message key** is hashed to choose the partition, so the same key always lands in the same partition and stays in order. A **consumer group** shares a topic: each partition is read by **one** consumer in the group, so extra consumers beyond the partition count sit idle. When members join or leave, a **rebalance** reassigns partitions. **Lag** (log end offset minus committed offset) tells you how far behind a group is. **Replication** copies each partition to several brokers; one is the **leader**. With `acks=all` and `min.insync.replicas=2` an acknowledged write survives a leader failure. Retention can be time or size based, or **compaction** can keep only the latest value per key. Modern Kafka runs without ZooKeeper using **KRaft**.\n\n**RabbitMQ.** **Exchange types**: direct (exact key), fanout (copy to all bound queues), topic (patterns with `*` one word and `#` zero or more words), headers (match message headers, with `x-match` all or any). Reliability needs a chain: **durable** queue + **persistent** messages + **publisher confirms** + consumer **acks**. **Prefetch** limits unacknowledged messages per consumer so a slow worker cannot hoard. Rejected, expired or overflowed messages can go to a **dead letter exchange (DLX)**; **TTL** expires old messages. **Quorum queues** (Raft) are the recommended replicated queue type; **streams** add a Kafka-like log.',
            'Kafka: each reader keeps a bookmark in a shared book, and a department (consumer group) splits the chapters between its readers. RabbitMQ: a mail room with rules: invoices to finance, anything urgent to the duty manager, and bounced mail to a supervisor.',
            '- Using a random or null key and then expecting per-entity ordering.\n- Choosing too few partitions: you can add partitions later, but doing so changes key-to-partition mapping.\n- Auto-acking in RabbitMQ and losing messages when the consumer crashes.\n- Thinking publisher confirms alone make messages durable. The queue and message must also be durable.\n- Requeueing a failing message forever instead of dead-lettering it.',
            'A consumer is slow or restarted constantly, groups rebalance repeatedly, lag grows, and nobody alerts on lag until the data is hours behind. Or a RabbitMQ queue fills memory because consumers are slower than publishers and nothing limits queue length.',
            panelI.el
          );
        } },
        { id: 'advanced', label: 'Advanced', content: function () {
          return levelPane(
            '**Kafka internals and failure modes.** Writes are sequential and batched, which is why throughput is so high. In-sync replicas (ISR) are replicas that are caught up. A leader election picks a new leader from the ISR; electing an out-of-sync replica (unclean election) can lose acknowledged data. Rebalances are the main source of surprise: with the eager protocol every consumer stops while assignments are recomputed; **cooperative sticky** assignment and static membership reduce that, and the newer group protocol moves more of this to the broker. A consumer that does not call `poll` within `max.poll.interval.ms` is kicked out and its work is redone. **Exactly-once** in Kafka means idempotent producers plus transactions **within Kafka**; effects in your own database still need idempotent consumers or an outbox. **Compacted** topics keep the latest value per key, and a **tombstone** (null value) deletes a key. Hot keys create hot partitions.\n\n**RabbitMQ internals and failure modes.** Prefer **quorum queues** for replicated, durable queues; classic mirrored queues were removed in RabbitMQ 4. Set a **delivery limit** so poison messages are dead-lettered instead of looping. Watch memory and disk alarms: when they trigger, the broker blocks publishers. A long-running consumer can exceed the **consumer acknowledgement timeout** and be disconnected. Unroutable messages are silently dropped unless you use `mandatory` publishing or an **alternate exchange**. **Streams** provide an append-only log with replay when you need Kafka-style consumption inside RabbitMQ.\n\n**Shared hazards.** At-least-once delivery means duplicates, so consumers must be idempotent. Ordering is lost with competing consumers, retries and redelivery. Retention or queue limits are capacity planning, not a backup. Monitor consumer lag or queue depth, oldest message age, redeliveries and DLQ size.',
            'Kafka is a municipal archive with strict rules for adding pages and many readers. RabbitMQ is a busy sorting hub with a manager who can reroute, expire or return mail. In both, the real danger is not the machinery but the humans: a clerk who keeps re-stamping the same unreadable letter.',
            '- Treating "exactly-once" as a switch that makes your database effects exactly-once.\n- Leaving `unclean.leader.election.enable` on for important topics.\n- Setting `min.insync.replicas` equal to the replication factor, so one broker outage stops all writes.\n- Using RabbitMQ as long-term storage or Kafka as a task queue with per-message retries.\n- Letting the queue grow unbounded without a max-length or TTL.',
            '- **Leader failover with acks=1** silently drops acknowledged messages (Lab 3).\n- **Rebalance storms** from a slow consumer or a rolling deploy cause lag spikes (Lab 2).\n- **Hot partition** from a skewed key overloads one broker (Lab 1).\n- **Retention shorter than a consumer outage** means data is deleted before it is read (Lab 4).\n- **Requeue loops** and queue memory alarms in RabbitMQ (Labs 8 and 9).',
            panelA.el
          );
        } }
      ]
    }).el;
  }

  /* ================= KAFKA LAB 1: partitions, offsets and keys ================= */

  var KEYS = ['user-A', 'user-B', 'user-C', 'user-D', 'user-E', 'user-F'];

  function labKeys() {
    var P = 3, PROD = 250, SERVICE = 350, SLA = 3000;
    var sim = Sim.create({ speed: 1 });
    var part = 'key', hot = false, st, rnd;
    var boxes = [0, 1, 2].map(function (i) { return mkBox('Partition ' + i); });
    var info = h('div', { class: 'ui-box', role: 'status' });
    var stage = h('div', {}, [h('div', { class: 'qv' }, boxes.map(function (b) { return b.el; })), info]);

    var lab = UI.lab({
      title: 'Lab 1: partitions, offsets and key-based partitioning',
      subtitle: 'Events arrive every 0.25 s from six users. Each partition is an append-only log with its own offsets and its own consumer.',
      sim: sim, stage: stage,
      stageLabel: 'Three Kafka partitions, each a log of offsets coloured by key',
      breakLabel: 'Break it: one hot key sends 80% of traffic',
      fixLabel: 'Fix it: spread the keys',
      onBreak: function (broken) { hot = broken; hotC.set(hot); sim.reset(); sim.play(); },
      caption: 'Press Play. Dim cells are already consumed.'
    });

    function render() {
      st.parts.forEach(function (p, i) {
        fill(boxes[i], p.log.slice(-18).map(function (e) { return { label: e.off, color: keyColor(e.key), cls: e.off < p.pos ? 'hid' : '' }; }), 18);
        var lag = p.log.length - p.pos;
        boxes[i].note.textContent = 'next offset ' + p.log.length + ' | consumer at ' + p.pos + ' | lag ' + lag;
        boxes[i].state(lag > 8 ? 'is-dead' : (p.busy ? 'is-busy' : ''));
      });
      var bad = false;
      var lines = KEYS.map(function (k) {
        var ps = Object.keys(st.keyParts[k] || {});
        if (ps.length > 1) { bad = true; }
        return k + ': ' + (ps.length ? ps.map(function (x) { return 'P' + x; }).join(',') : '-');
      });
      info.className = 'ui-box ' + (bad ? 'stale' : 'good');
      info.textContent = 'Which partitions hold each key  |  ' + lines.join('   ') + (bad ? '   >> a key spans several partitions, so its order is NOT guaranteed' : '');
      var secs = sim.now() / 1000;
      lab.metrics.set('throughput', secs > 0 ? st.done / secs : 0);
      lab.metrics.set('latency', avg(st.sum, st.done));
      lab.metrics.set('depth', st.parts.reduce(function (a, p) { return a + p.log.length - p.pos; }, 0));
      lab.metrics.set('errors', st.late);
    }

    function pump(i) {
      var p = st.parts[i];
      if (p.busy || p.pos >= p.log.length) { return; }
      p.busy = true;
      var e = p.log[p.pos];
      if (sim.now() - e.t0 > SLA) { st.late++; }
      sim.schedule(SERVICE, function () { p.busy = false; p.pos++; st.done++; st.sum += sim.now() - e.t0; pump(i); render(); });
    }

    function produce() {
      var key = (hot && rnd() < 0.8) ? 'user-A' : KEYS[Math.floor(rnd() * KEYS.length)];
      var i = part === 'key' ? KEYS.indexOf(key) % P : (st.rr++ % P);
      var p = st.parts[i];
      p.log.push({ off: p.log.length, key: key, t0: sim.now() });
      (st.keyParts[key] = st.keyParts[key] || {})[i] = true;
      if (st.n++ % 8 === 0) { lab.log.log('Event for ' + key + ' appended to partition ' + i + ' at offset ' + (p.log.length - 1) + (part === 'key' ? ' (key decides the partition).' : ' (round-robin ignores the key).'), { t: sim.now() }); }
      pump(i); render();
      sim.schedule(PROD, produce);
    }

    function seed() {
      rnd = Sim.random(7);
      st = { parts: [0, 1, 2].map(function () { return { log: [], pos: 0, busy: false }; }), keyParts: {}, rr: 0, n: 0, done: 0, sum: 0, late: 0 };
      lab.log.clear(); lab.metrics.reset();
      lab.bar.setBroken(hot);
      lab.explain((part === 'key'
        ? '**Key-based partitioning.** Kafka hashes the key (murmur2 in the real client) to pick a partition, so one key always lands in one partition and stays in order. Here each partition has one consumer that handles 2.9 events per second.'
        : '**No key (round-robin).** Load spreads perfectly evenly, but events for one user are scattered across partitions, so Kafka cannot promise their order.') + (hot ? ' **Hot key:** most traffic shares one key, so one partition (and its single consumer) gets 3.2 events per second but can only handle 2.9. Its lag grows while the others idle. Adding partitions does not help, because one key can only use one partition.' : ''));
      lab.log.log('Partitioner: ' + (part === 'key' ? 'by key' : 'round-robin') + (hot ? ', hot key enabled' : '') + '.', { t: 0 });
      sim.schedule(0, produce);
      render();
    }

    sim.on('reset', seed);
    var seg = segmented('Partitioner', [['key', 'By key'], ['rr', 'Round-robin (no key)']], part, function (v) { part = v; sim.reset(); });
    var hotC = checkbox('Skewed traffic (hot key)', hot, function (v) { hot = v; sim.reset(); });
    seed();
    return wrap([seg, hotC], lab);
  }

  /* ================= KAFKA LAB 2: consumer groups, rebalance, lag ================= */

  function labGroup() {
    var P = 6, PROD = 125, SERVICE = 330, REB = 2000, COOP = 600, SESSION = 3000;
    var sim = Sim.create({ speed: 1 });
    var proto = 'eager', st;
    var banner = h('p', { class: 'cf-note', role: 'status' });
    var cBox = h('div', { class: 'qv-grid' });
    var pBox = h('div', { class: 'qv-grid' });
    var stage = h('div', {}, [banner, cBox, pBox]);

    var lab = UI.lab({
      title: 'Lab 2: consumer groups, rebalance and lag',
      subtitle: 'Six partitions receive 8 events per second. Each consumer handles 3 per second. Add, remove and crash consumers.',
      sim: sim, stage: stage,
      stageLabel: 'Consumers, partition assignment and per-partition lag meters',
      breakLabel: 'Break it: crash consumer C1',
      fixLabel: 'Fix it: restart crashed consumers',
      onBreak: function (broken) {
        if (broken) { var c = st.cons.filter(function (x) { return x.alive; })[0]; if (c) { kill(c); } }
        else { st.cons.forEach(function (c) { if (!c.alive) { c.alive = true; lab.log.log(c.name + ' restarted and rejoins the group.', { t: sim.now(), level: 'ok' }); rebalance('rejoin'); } }); }
      },
      caption: 'Press Play, then add and remove consumers.'
    });

    function target() {
      var alive = st.cons.filter(function (c) { return c.alive; });
      var t = [];
      if (!alive.length) { for (var i = 0; i < P; i++) { t.push(-1); } return t; }
      var base = Math.floor(P / alive.length), extra = P % alive.length;
      alive.forEach(function (c, ci) { var n = base + (ci < extra ? 1 : 0); for (var k = 0; k < n; k++) { t.push(c.id); } });
      return t;
    }

    function rebalance(reason) {
      st.reb++;
      var tg = target(), affected = [];
      for (var p = 0; p < P; p++) { if (proto === 'eager' || st.owners[p] !== tg[p]) { affected.push(p); } }
      var dur = proto === 'eager' ? REB : COOP;
      affected.forEach(function (p) { st.owners[p] = -1; st.stall[p] = sim.now() + dur; });
      lab.log.log('REBALANCE (' + reason + '), ' + proto + ' protocol: ' + (proto === 'eager' ? 'ALL consumers stop and give up ALL partitions for ' + (dur / 1000) + ' s.' : 'only the ' + affected.length + ' moved partition(s) pause for ' + (dur / 1000) + ' s; the rest keep consuming.'), { t: sim.now(), level: 'warn' });
      lab.explain(proto === 'eager'
        ? '**Eager rebalance = stop the world.** Every consumer revokes every partition, the group coordinator recomputes the assignment, then everyone resumes. For 2 seconds nothing is consumed and lag jumps. Frequent joins, leaves, crashes and slow consumers make this a recurring outage.'
        : '**Cooperative rebalance.** Only partitions that actually change owner are revoked, so most consumers keep working. Same final assignment, much less disruption. Prefer the cooperative-sticky assignor and static membership for rolling deploys.');
      sim.schedule(dur, function () {
        var t2 = target();
        affected.forEach(function (q) { st.owners[q] = t2[q]; });
        lab.log.log('Rebalance complete.', { t: sim.now(), level: 'ok' });
        pumpAll(); render();
      });
      render();
    }

    function pumpAll() {
      st.cons.forEach(function (c) {
        if (!c.alive || c.busy) { return; }
        var p = -1;
        for (var i = 0; i < P; i++) {
          var pp = st.parts[i];
          if (st.owners[i] === c.id && sim.now() >= st.stall[i] && !pp.inflight && pp.q.length) { p = i; break; }
        }
        if (p < 0) { return; }
        var pt = st.parts[p], tok = c.tok;
        c.busy = true; pt.inflight = true;
        sim.schedule(SERVICE, function () {
          if (c.tok !== tok) { return; }
          var e = pt.q.shift();
          c.busy = false; pt.inflight = false; st.done++; st.sum += sim.now() - e.t0;
          pumpAll(); render();
        });
      });
    }

    function kill(c) {
      c.alive = false; c.tok++; c.busy = false;
      for (var i = 0; i < P; i++) { if (st.owners[i] === c.id) { st.parts[i].inflight = false; } }
      lab.log.log(c.name + ' CRASHED. Its partitions are not read. The coordinator only notices after the session timeout (' + (SESSION / 1000) + ' s).', { t: sim.now(), level: 'err' });
      sim.schedule(SESSION, function () { if (!c.alive) { lab.log.log('Session timeout: ' + c.name + ' declared dead.', { t: sim.now(), level: 'warn' }); rebalance('consumer failure'); } });
      render();
    }

    function addConsumer() {
      var c = { id: ++st.nextC, name: 'C' + st.nextC, alive: true, busy: false, tok: 0 };
      st.cons.push(c);
      lab.log.log(c.name + ' joins the group.', { t: sim.now(), level: 'ok' });
      rebalance('join');
    }

    function removeConsumer() {
      var alive = st.cons.filter(function (c) { return c.alive; });
      if (!alive.length) { return; }
      var c = alive[alive.length - 1];
      st.cons.splice(st.cons.indexOf(c), 1);
      c.tok++; c.busy = false;
      for (var i = 0; i < P; i++) { if (st.owners[i] === c.id) { st.parts[i].inflight = false; } }
      lab.log.log(c.name + ' leaves the group.', { t: sim.now() });
      rebalance('leave');
    }

    function render() {
      var now = sim.now();
      var reb = st.stall.some(function (s) { return s > now; });
      banner.textContent = reb ? 'REBALANCING: some or all partitions are unassigned and nothing is consumed from them' : 'Group stable';
      cBox.innerHTML = '';
      st.cons.forEach(function (c) {
        var b = mkBox(c.name + (c.alive ? '' : ' (crashed)'));
        var owned = [];
        for (var i = 0; i < P; i++) { if (st.owners[i] === c.id) { owned.push({ label: 'P' + i, cls: c.alive ? 'ok' : 'bad' }); } }
        fill(b, owned, 6);
        b.state(!c.alive ? 'is-dead' : (c.busy ? 'is-busy' : (owned.length ? '' : 'is-off')));
        b.note.textContent = !c.alive ? 'not consuming' : (owned.length ? 'owns ' + owned.length + ' partition(s)' : 'idle (more consumers than partitions)');
        cBox.appendChild(b.el);
      });
      pBox.innerHTML = '';
      for (var i = 0; i < P; i++) {
        var lag = st.parts[i].q.length;
        var o = st.owners[i];
        var oc = st.cons.filter(function (c) { return c.id === o; })[0];
        var bar = h('div', { class: 'lagbar' + (lag > 30 ? ' hot' : '') }, [h('i')]);
        bar.firstChild.style.width = Math.min(100, lag * 2) + '%';
        pBox.appendChild(h('div', { class: 'qv-box' }, [h('h4', { text: 'P' + i + ' ' + (oc ? '- ' + oc.name : (o === -1 ? '- unassigned' : '')) }), h('div', { class: 'qv-note', text: 'lag ' + lag }), bar]));
      }
      var secs = now / 1000;
      lab.metrics.set('throughput', secs > 0 ? st.done / secs : 0);
      lab.metrics.set('latency', avg(st.sum, st.done));
      lab.metrics.set('depth', st.parts.reduce(function (a, p) { return a + p.q.length; }, 0));
      lab.metrics.set('errors', st.reb);
    }

    function produce() {
      st.parts[st.n++ % P].q.push({ t0: sim.now() });
      pumpAll();
      sim.schedule(PROD, produce);
    }

    function seed() {
      st = { parts: [], cons: [], owners: [], stall: [], n: 0, done: 0, sum: 0, reb: 0, nextC: 3 };
      for (var i = 0; i < P; i++) { st.parts.push({ q: [], inflight: false }); st.owners.push(Math.floor(i / 2) + 1); st.stall.push(0); }
      for (var k = 1; k <= 3; k++) { st.cons.push({ id: k, name: 'C' + k, alive: true, busy: false, tok: 0 }); }
      lab.log.clear(); lab.metrics.reset();
      lab.bar.setBroken(false);
      lab.explain('Three consumers handle 9 events per second against 8 produced, so lag stays near zero. Adding a seventh consumer would do nothing: a partition is read by at most one consumer in a group. Try Break it, then compare the two rebalance protocols.');
      lab.log.log('Group of 3 consumers reading 6 partitions. Press Play.', { t: 0 });
      sim.schedule(0, produce);
      render();
    }

    sim.on('tick', render);
    sim.on('reset', seed);
    var seg = segmented('Rebalance protocol', [['eager', 'Eager (stop the world)'], ['coop', 'Cooperative']], proto, function (v) { proto = v; sim.reset(); });
    var add = button('Add consumer', function () { addConsumer(); });
    var rem = button('Remove consumer', function () { removeConsumer(); });
    seed();
    return wrap([seg, add, rem], lab);
  }

  /* ================= KAFKA LAB 3: replication and leader failure ================= */

  function labReplication() {
    var SEND = 500, ELECTION = 1500, DELAY = [0, 700, 1100];
    var sim = Sim.create({ speed: 1 });
    var acks = 'all', killPlan = false, st;
    var bBoxes = [mkBox('Broker B1'), mkBox('Broker B2'), mkBox('Broker B3')];
    var bufBox = mkBox('Producer retry buffer'), lostBox = mkBox('Acknowledged but LOST', 'dlq');
    var stage = h('div', { class: 'qv' }, bBoxes.map(function (b) { return b.el; }).concat([bufBox.el, lostBox.el]));

    var lab = UI.lab({
      title: 'Lab 3: replication and leader failure',
      subtitle: 'One partition replicated on three brokers. Followers copy from the leader with a delay (B2 0.7 s, B3 1.1 s).',
      sim: sim, stage: stage,
      stageLabel: 'Three brokers holding replicas of one partition',
      breakLabel: 'Break it: acks=1 and the leader dies at 3.3 s',
      fixLabel: 'Fix it: acks=all',
      onBreak: function (broken) { acks = broken ? '1' : 'all'; killPlan = broken; seg.set(acks); sim.reset(); sim.play(); },
      caption: 'Press Play, then kill the leader and compare the acks settings.'
    });

    function aliveList() { return [0, 1, 2].filter(function (b) { return st.alive[b]; }); }

    function ack(m) {
      if (m.acked) { return; }
      m.acked = true; st.acked++; st.sum += sim.now() - m.t0;
      lab.log.log('Producer receives ack for #' + m.id + '.', { t: sim.now(), level: 'ok' });
    }

    function checkAll(m) {
      if (acks !== 'all' || m.acked || m.lost) { return; }
      var al = aliveList();
      if (al.length < 2) { return; }
      if (al.every(function (b) { return m.on[b]; })) { ack(m); }
    }

    function append(m) {
      var L = st.L, ep = st.epoch;
      m.on[L] = true;
      lab.log.log('Leader B' + (L + 1) + ' appends #' + m.id + '.', { t: sim.now() });
      if (acks === '0') { ack(m); }
      else if (acks === '1') { sim.schedule(50, function () { if (st.epoch === ep && !m.lost) { ack(m); } }); }
      [0, 1, 2].forEach(function (f) {
        if (f === L || !st.alive[f]) { return; }
        sim.schedule(DELAY[f], function () {
          if (st.epoch !== ep || !st.alive[f] || !st.alive[L] || m.lost) { return; }
          m.on[f] = true; checkAll(m); render();
        });
      });
      checkAll(m);
    }

    function send() {
      var m = { id: ++st.id, t0: sim.now(), acked: false, lost: false, on: [false, false, false] };
      st.m.push(m);
      if (st.leaderless) {
        if (acks === '0') { m.acked = true; m.lost = true; st.lost++; lab.log.log('No leader: with acks=0 the producer never even learns #' + m.id + ' was dropped.', { t: sim.now(), level: 'err' }); }
        else { st.buf.push(m); lab.log.log('No leader: #' + m.id + ' waits in the producer buffer and will be retried.', { t: sim.now(), level: 'warn' }); }
      } else { append(m); }
      render();
      sim.schedule(SEND, send);
    }

    function elect() {
      var al = aliveList();
      if (!al.length) { return; }
      var count = function (b) { return st.m.filter(function (m) { return m.on[b] && !m.lost; }).length; };
      var nl = al.reduce(function (best, b) { return count(b) > count(best) ? b : best; }, al[0]);
      var resend = [];
      st.m.forEach(function (m) {
        if (m.lost || m.on[nl]) { return; }
        if (m.acked) { m.lost = true; st.lost++; lab.log.log('#' + m.id + ' was ACKNOWLEDGED but never reached the new leader: DATA LOSS.', { t: sim.now(), level: 'err' }); }
        else if (st.buf.indexOf(m) === -1) { resend.push(m); }
      });
      al.forEach(function (f) { st.m.forEach(function (m) { m.on[f] = !m.lost && m.on[nl]; }); });
      st.L = nl; st.leaderless = false; st.epoch++;
      lab.log.log('B' + (nl + 1) + ' elected leader. Followers truncate to its log.', { t: sim.now(), level: 'warn' });
      var pend = resend.concat(st.buf);
      st.buf = [];
      pend.forEach(function (m) { m.on = [false, false, false]; append(m); });
      explain();
      render();
    }

    function kill(b) {
      if (!st.alive[b]) { return; }
      st.alive[b] = false;
      lab.log.log('Broker B' + (b + 1) + ' DIED' + (b === st.L ? ' (it was the leader). Election takes ' + (ELECTION / 1000) + ' s.' : '.'), { t: sim.now(), level: 'err' });
      if (b === st.L) { st.leaderless = true; st.epoch++; sim.schedule(ELECTION, elect); }
      else { st.m.forEach(checkAll); }
      render();
    }

    function restart() {
      [0, 1, 2].forEach(function (b) {
        if (!st.alive[b] && !st.leaderless) { st.alive[b] = true; st.m.forEach(function (m) { m.on[b] = !m.lost && m.on[st.L]; }); lab.log.log('Broker B' + (b + 1) + ' restarted and caught up as a follower.', { t: sim.now(), level: 'ok' }); }
      });
      render();
    }

    function explain() {
      lab.explain(st.lost
        ? '**Acknowledged data was lost.** With acks=' + acks + ' the leader confirmed messages before the followers had copied them. When it died, the most up-to-date follower became leader without them, and the producer believed they were safe. Use **acks=all** with replication factor 3 and **min.insync.replicas=2**.'
        : acks === 'all'
          ? '**acks=all.** The producer is acknowledged only after every in-sync replica has the message, so an acknowledged message exists on whichever replica becomes leader. Cost: latency (about 1.1 s here). Messages sent during the election are retried, not lost. With min.insync.replicas=2 the partition refuses writes if fewer than 2 replicas are in sync.'
          : 'acks=' + acks + ' is fast but gives no durability guarantee on leader failure. Kill the leader to see.');
    }

    function render() {
      [0, 1, 2].forEach(function (b) {
        var bx = bBoxes[b];
        bx.head.textContent = 'Broker B' + (b + 1) + (!st.alive[b] ? ' (DOWN)' : (b === st.L && !st.leaderless ? ' (leader)' : ''));
        fill(bx, st.m.filter(function (m) { return m.on[b] && !m.lost; }).slice(-14).map(function (m) { return { label: m.id, cls: m.acked ? 'ok' : '' }; }), 14);
        bx.state(!st.alive[b] ? 'is-dead' : (b === st.L && !st.leaderless ? 'is-busy' : ''));
        bx.note.textContent = 'copies: ' + st.m.filter(function (m) { return m.on[b] && !m.lost; }).length + (st.alive[b] ? '' : ' (stale)');
      });
      fill(bufBox, st.buf.map(function (m) { return { label: m.id, cls: 'dup' }; }), 10);
      bufBox.note.textContent = st.leaderless ? 'no leader: electing...' : 'retries pending: ' + st.buf.length;
      fill(lostBox, st.m.filter(function (m) { return m.lost; }).map(function (m) { return { label: m.id, cls: 'bad' }; }), 10);
      lostBox.note.textContent = st.lost + ' message(s) lost';
      var secs = sim.now() / 1000;
      lab.metrics.set('throughput', secs > 0 ? st.acked / secs : 0);
      lab.metrics.set('latency', avg(st.sum, st.acked));
      lab.metrics.set('depth', st.m.filter(function (m) { return !m.acked && !m.lost; }).length);
      lab.metrics.set('errors', st.lost);
    }

    function seed() {
      st = { m: [], alive: [true, true, true], L: 0, leaderless: false, epoch: 0, buf: [], acked: 0, sum: 0, lost: 0, id: 0 };
      lab.log.clear(); lab.metrics.reset();
      lab.bar.setBroken(killPlan);
      lab.explain('Producer acks setting: **acks=' + acks + '**. ' + ({ '0': 'Fire and forget: no confirmation at all.', '1': 'The leader confirms as soon as it has written the message.', all: 'The producer waits until all in-sync replicas have the message.' })[acks] + ' Press Play, then "Kill leader".');
      lab.log.log('Partition with replicas on B1 (leader), B2, B3. Producer sends every 0.5 s.', { t: 0 });
      sim.schedule(100, send);
      if (killPlan) { sim.schedule(3300, function () { kill(st.L); lab.bar.setBroken(false); killPlan = false; }); }
      render();
    }

    sim.on('reset', seed);
    var seg = segmented('Producer acks', [['0', 'acks=0'], ['1', 'acks=1'], ['all', 'acks=all']], acks, function (v) { acks = v; killPlan = false; sim.reset(); });
    var kl = button('Kill current leader', function () { if (!st.leaderless) { kill(st.L); } });
    var rs = button('Restart dead brokers', restart);
    seed();
    return wrap([seg, kl, rs], lab);
  }

  /* ================= KAFKA LAB 4: retention and compaction ================= */

  function labRetention() {
    var PROD = 600, CONS = 500, OUT0 = 2000, OUT1 = 14000;
    var sim = Sim.create({ speed: 1 });
    var mode = 'delete', R = 20000, st;
    var logBox = mkBox('Partition log (retained records)'), tblBox = mkBox('Latest value per key (state rebuilt from the log)'), cBox = mkBox('Consumer');
    var stage = h('div', { class: 'qv' }, [logBox.el, tblBox.el, cBox.el]);

    var lab = UI.lab({
      title: 'Lab 4: retention and log compaction',
      subtitle: 'The consumer is down for a 12 s deploy from 2 s to 14 s. Does the data it needs survive?',
      sim: sim, stage: stage,
      stageLabel: 'Kafka partition log with retention or compaction and a consumer position',
      breakLabel: 'Break it: retention shorter than the outage',
      fixLabel: 'Fix it: retention longer than the outage',
      onBreak: function (broken) { mode = 'delete'; R = broken ? 6000 : 20000; modeS.set('delete'); rS.set(R / 1000); sim.reset(); sim.play(); },
      caption: 'Press Play at 4x. Watch the grey (consumed) and the gaps.'
    });

    function render() {
      var now = sim.now(), keys = {};
      st.log.forEach(function (e) { keys[e.key] = e; });
      fill(logBox, st.log.slice(-40).map(function (e) { return { label: e.off + ' ' + e.key + '=' + e.val, color: keyColor(e.key), cls: e.off < st.pos ? 'hid' : '' }; }), 40);
      logBox.note.textContent = 'start offset ' + (st.log.length ? st.log[0].off : st.next) + ' | end offset ' + st.next + ' | consumer position ' + st.pos + ' | ' + st.log.length + ' retained';
      fill(tblBox, Object.keys(keys).sort().map(function (k) { return { label: k + '=' + keys[k].val, color: keyColor(k) }; }), 10);
      tblBox.note.textContent = mode === 'compact' ? 'compaction keeps this latest value per key forever' : 'a table can be rebuilt by replaying the log';
      var down = now >= OUT0 && now < OUT1;
      cBox.state(down ? 'is-dead' : 'is-busy');
      cBox.note.textContent = (down ? 'DOWN for deploy' : 'running') + ' | read ' + st.consumed + ' | skipped (deleted before read) ' + st.skippedDel + ' | compacted away ' + st.skippedComp;
      fill(cBox, [], 1);
      var secs = now / 1000;
      lab.metrics.set('throughput', secs > 0 ? st.consumed / secs : 0);
      lab.metrics.set('latency', avg(st.sumAge, st.consumed));
      lab.metrics.set('depth', st.log.length);
      lab.metrics.set('errors', st.skippedDel);
    }

    function produce() {
      var key = 'K' + (st.next % 4 + 1);
      st.ver[key] = (st.ver[key] || 0) + 1;
      st.log.push({ off: st.next++, key: key, val: st.ver[key], t0: sim.now() });
      render();
      sim.schedule(PROD, produce);
    }

    function consume() {
      var now = sim.now();
      if (now >= OUT0 && now < OUT1) { sim.schedule(CONS, consume); return; }
      var e = null;
      for (var i = 0; i < st.log.length; i++) { if (st.log[i].off >= st.pos) { e = st.log[i]; break; } }
      if (e) {
        var gap = e.off - st.pos;
        if (gap > 0) {
          if (mode === 'delete') { st.skippedDel += gap; lab.log.log('OffsetOutOfRange: offsets ' + st.pos + '-' + (e.off - 1) + ' were deleted by retention before they were read. auto.offset.reset jumps forward: ' + gap + ' record(s) skipped forever.', { t: now, level: 'err' }); }
          else { st.skippedComp += gap; lab.log.log('Offsets ' + st.pos + '-' + (e.off - 1) + ' were compacted away: only the newest value per key remains (intermediate versions are gone, by design).', { t: now, level: 'warn' }); }
        }
        st.pos = e.off + 1; st.consumed++; st.sumAge += now - e.t0;
      }
      render();
      sim.schedule(CONS, consume);
    }

    function sweep() {
      var now = sim.now();
      if (mode === 'delete') {
        var n = 0;
        while (st.log.length && now - st.log[0].t0 > R) { st.log.shift(); n++; }
        if (n) { lab.log.log('Retention deleted ' + n + ' record(s) older than ' + (R / 1000) + ' s.', { t: now, level: 'warn' }); }
      }
      sim.schedule(1000, sweep);
    }

    function clean() {
      if (mode === 'compact') {
        var keep = {}, n = 0, tail = st.log.length - 4;
        for (var i = st.log.length - 1; i >= 0; i--) { if (i >= tail) { keep[st.log[i].key] = true; } }
        var out = [];
        for (var j = st.log.length - 1; j >= 0; j--) {
          var e = st.log[j];
          if (j >= tail) { out.unshift(e); continue; }
          if (keep[e.key]) { n++; continue; }
          keep[e.key] = true; out.unshift(e);
        }
        st.log = out;
        if (n) { lab.log.log('Log cleaner removed ' + n + ' superseded record(s). The active tail is never compacted.', { t: sim.now(), level: 'ok' }); }
      }
      sim.schedule(3000, clean);
    }

    function seed() {
      st = { log: [], next: 0, pos: 0, consumed: 0, skippedDel: 0, skippedComp: 0, sumAge: 0, ver: {} };
      lab.log.clear(); lab.metrics.reset();
      lab.bar.setBroken(mode === 'delete' && R < 12000);
      lab.explain(mode === 'delete'
        ? '**Retention (cleanup.policy=delete)** removes records older than ' + (R / 1000) + ' s, whether or not they were read. The outage lasts 12 s, so ' + (R < 12000 ? 'old records are deleted while the consumer is away: they are **gone forever** (red). Retention must exceed your longest plausible outage.' : 'records survive and the consumer catches up with nothing lost.')
        : '**Compaction (cleanup.policy=compact)** keeps the newest record per key and removes older ones. Nothing is lost for "latest state" use cases (a table, a changelog), but a consumer will not see every intermediate version, and storage stays bounded.');
      lab.log.log('Producer writes every 0.6 s across keys K1-K4. Consumer outage 2 s to 14 s.', { t: 0 });
      sim.schedule(0, produce);
      sim.schedule(CONS, consume);
      sim.schedule(1000, sweep);
      sim.schedule(3000, clean);
      sim.schedule(OUT0, function () { lab.log.log('Consumer goes down for a deploy.', { t: sim.now(), level: 'warn' }); });
      sim.schedule(OUT1, function () { lab.log.log('Consumer is back and resumes from its committed offset.', { t: sim.now(), level: 'ok' }); });
      render();
    }

    sim.on('reset', seed);
    var modeS = segmented('Cleanup policy', [['delete', 'Delete by retention'], ['compact', 'Compact by key']], mode, function (v) { mode = v; sim.reset(); });
    var rS = slider('Retention', 3, 60, R / 1000, 1, function (v) { return v + ' s'; }, function (v) { R = v * 1000; sim.reset(); });
    seed();
    return wrap([modeS, rS], lab);
  }

  /* ================= KAFKA LAB 5: replay from an offset ================= */

  function labReplay() {
    var N = 30, STEP = 300;
    var sim = Sim.create({ speed: 1 });
    var idem = false, from = 10, autoReplay = false, st;
    var logBox = mkBox('Order events (offset = order number)'), cBox = mkBox('Consumer');
    var stage = h('div', { class: 'qv' }, [logBox.el, cBox.el]);

    var lab = UI.lab({
      title: 'Lab 5: replaying from an offset',
      subtitle: 'All 30 orders were processed with a bug in the tax calculation. After the fix, rewind the consumer and recompute. Each order also sends an email.',
      sim: sim, stage: stage,
      stageLabel: 'Event log with consumer position and email counts',
      breakLabel: 'Break it: replay from offset 0 without protection',
      fixLabel: 'Fix it: replay with a sent-emails guard',
      onBreak: function (broken) { idem = !broken; from = broken ? 0 : 10; idemC.set(idem); fromS.set(from); autoReplay = true; sim.reset(); sim.play(); },
      caption: 'Pick an offset and press "Replay now".'
    });

    function render() {
      fill(logBox, st.mail.map(function (c, i) { return { label: i + (c > 1 ? 'x' + c : ''), cls: c > 1 ? 'dup' : (i < st.pos || (c === 1 && st.pos === N) ? 'ok' : 'ok') }; }), 30);
      var dups = st.mail.reduce(function (a, c) { return a + Math.max(0, c - 1); }, 0);
      logBox.note.textContent = 'xN = emails sent for that order (more than 1 is a duplicate) | position ' + st.pos + ' of ' + N;
      cBox.state(st.pos < N ? 'is-busy' : '');
      cBox.note.textContent = 'recomputed ' + st.recomputed + ' order(s) | duplicate emails ' + dups;
      fill(cBox, st.pos < N ? [{ label: st.pos, cls: 'ok' }] : [], 1);
      var secs = sim.now() / 1000;
      lab.metrics.set('throughput', secs > 0 ? st.recomputed / secs : 0);
      lab.metrics.set('latency', NaN);
      lab.metrics.set('depth', N - st.pos);
      lab.metrics.set('errors', dups);
    }

    function step() {
      if (st.pos >= N) { return; }
      var o = st.pos;
      st.recomputed++;
      if (idem && st.sent[o]) { lab.log.log('Order ' + o + ': tax recomputed. Email already in the sent table, skipped.', { t: sim.now(), level: 'ok' }); }
      else { st.sent[o] = true; st.mail[o]++; lab.log.log('Order ' + o + ': tax recomputed' + (st.mail[o] > 1 ? ' and a DUPLICATE email was sent to the customer!' : ' and email sent.'), { t: sim.now(), level: st.mail[o] > 1 ? 'err' : 'info' }); }
      st.pos++;
      render();
      if (st.pos < N) { sim.schedule(STEP, step); } else { done(); }
    }

    function done() {
      var dups = st.mail.reduce(function (a, c) { return a + Math.max(0, c - 1); }, 0);
      lab.log.log('Replay finished. Duplicate emails: ' + dups + '.', { t: sim.now(), level: dups ? 'err' : 'ok' });
      lab.explain(dups
        ? '**Replay re-runs side effects.** Rewinding is easy because Kafka keeps the log, but every consumer action runs again. Recomputing derived data (the corrected tax) is safe, yet the email went out ' + (dups + 1) + ' times for some customers. Replay is only safe when side effects are idempotent or disabled.'
        : '**Safe replay.** The corrected tax is recomputed for each order, while a "sent" table keyed by order id stops the emails repeating. Consumers that are idempotent can be rewound freely, which is a huge advantage of a log.');
    }

    function replay() {
      if (st.pos < N) { return; }
      st.pos = from;
      lab.log.log('Consumer seeks to offset ' + from + ' (like kafka-consumer-groups --reset-offsets --to-offset ' + from + ').', { t: sim.now(), level: 'warn' });
      lab.explain('Replaying ' + (N - from) + ' record(s) from offset ' + from + '. ' + (idem ? 'Emails are guarded by a sent table.' : 'Emails are NOT guarded.'));
      render();
      sim.schedule(STEP, step);
      sim.play();
    }

    function seed() {
      st = { pos: N, mail: [], sent: {}, recomputed: 0 };
      for (var i = 0; i < N; i++) { st.mail.push(1); st.sent[i] = true; }
      lab.log.clear(); lab.metrics.reset();
      lab.bar.setBroken(!idem && from === 0 && autoReplay);
      lab.explain('Everything is processed once. The log still holds all 30 events, so the consumer can seek back to any offset or timestamp. Choose a start offset and press **Replay now**.');
      lab.log.log('30 orders processed once, each with one email.', { t: 0 });
      render();
      if (autoReplay) { autoReplay = false; sim.schedule(100, replay); }
    }

    sim.on('reset', seed);
    var fromS = slider('Replay from offset', 0, 29, from, 1, function (v) { return String(v); }, function (v) { from = v; });
    var idemC = checkbox('Guard emails with a sent table (idempotent)', idem, function (v) { idem = v; });
    var go = button('Replay now', replay);
    seed();
    return wrap([fromS, idemC, go], lab);
  }

  /* ================= RABBITMQ LAB 6: exchanges and bindings ================= */

  function topicMatch(pattern, key) {
    var p = pattern.split('.'), k = key.split('.');
    function m(i, j) {
      if (i === p.length) { return j === k.length; }
      if (p[i] === '#') { for (var x = j; x <= k.length; x++) { if (m(i + 1, x)) { return true; } } return false; }
      if (j === k.length) { return false; }
      if (p[i] === '*' || p[i] === k[j]) { return m(i + 1, j + 1); }
      return false;
    }
    return m(0, 0);
  }

  function parseHeaders(s) {
    var o = {};
    s.split(',').forEach(function (pair) { var kv = pair.split('='); if (kv.length === 2 && kv[0].trim()) { o[kv[0].trim()] = kv[1].trim(); } });
    return o;
  }

  var MSGS = ['order.created.eu', 'order.paid.us', 'user.created.eu', 'order.created.us', 'payment.failed.eu', 'order.shipped.eu'];
  var DEFAULTS = {
    direct: ['order.created.eu', 'order.paid.us', 'user.created.eu', 'payment.failed.eu'],
    fanout: ['', '', '', ''],
    topic: ['order.#', '*.*.eu', '#.us', 'payment.*.*'],
    headers: ['type=order', 'region=eu', 'type=order,region=us', 'region=us']
  };

  function routeMsg(type, binds, xmatch, rk) {
    var parts = rk.split('.');
    var hdr = { type: parts[0], event: parts[1] || '', region: parts[2] || '' };
    var out = [];
    binds.forEach(function (b, i) {
      var ok = false;
      if (type === 'fanout') { ok = true; }
      else if (type === 'direct') { ok = b === rk; }
      else if (type === 'topic') { ok = b.trim() !== '' && topicMatch(b.trim(), rk); }
      else {
        var want = parseHeaders(b), keys = Object.keys(want);
        if (keys.length) { ok = xmatch === 'all' ? keys.every(function (k) { return hdr[k] === want[k]; }) : keys.some(function (k) { return hdr[k] === want[k]; }); }
      }
      if (ok) { out.push(i); }
    });
    return out;
  }

  function labExchange() {
    var sim = Sim.create({ speed: 1 });
    var type = 'topic', xm = 'all', alt = false, st;
    var binds = DEFAULTS[type].slice();
    var qBoxes = [0, 1, 2, 3].map(function (i) { return mkBox('Queue Q' + (i + 1)); });
    var unr = mkBox('Unroutable (alternate exchange)', 'dlq');
    var cur = h('div', { class: 'ui-box', role: 'status', text: 'No message yet.' });
    var stage = h('div', {}, [cur, h('div', { class: 'qv' }, qBoxes.map(function (b) { return b.el; }).concat([unr.el]))]);
    var inputs = [];

    var lab = UI.lab({
      title: 'Lab 6: exchanges, bindings and wildcards',
      subtitle: 'Edit the binding of each queue. Messages (order.created.eu ...) are published every second. See where each one is routed.',
      sim: sim, stage: stage,
      stageLabel: 'Exchange routing messages to four queues',
      breakLabel: 'Break it: typo in every binding',
      fixLabel: 'Fix it: restore the bindings',
      onBreak: function (broken) {
        binds = DEFAULTS[type].map(function (b) { return broken && b ? b + '_typo' : b; });
        syncInputs(); sim.reset(); sim.play();
      },
      caption: 'Press Play, edit a binding, or publish your own routing key.'
    });

    function syncInputs() { inputs.forEach(function (c, i) { c.set(binds[i]); }); }

    function render() {
      qBoxes.forEach(function (b, i) {
        fill(b, st.q[i].slice(-10).map(function (m) { return { label: m, cls: 'ok' }; }), 10);
        b.note.textContent = st.q[i].length + ' message(s)';
      });
      unr.el.style.display = alt ? '' : 'none';
      fill(unr, st.u.slice(-10).map(function (m) { return { label: m, cls: 'bad' }; }), 10);
      unr.note.textContent = st.u.length + ' message(s)';
      var secs = sim.now() / 1000;
      lab.metrics.set('throughput', secs > 0 ? st.n / secs : 0);
      lab.metrics.set('latency', NaN);
      lab.metrics.set('depth', st.q.reduce(function (a, q) { return a + q.length; }, 0));
      lab.metrics.set('errors', st.drop);
    }

    function publish(rk) {
      st.n++;
      var r = routeMsg(type, binds, xm, rk);
      cur.textContent = 'Published routing key "' + rk + '" (headers type=' + rk.split('.')[0] + ', region=' + (rk.split('.')[2] || '') + ') to the ' + type + ' exchange.';
      if (r.length) {
        r.forEach(function (i) { st.q[i].push(rk); });
        lab.log.log('"' + rk + '" routed to ' + r.map(function (i) { return 'Q' + (i + 1); }).join(', ') + '.', { t: sim.now(), level: 'ok' });
      } else if (alt) {
        st.u.push(rk);
        lab.log.log('"' + rk + '" matched NO binding: sent to the alternate exchange, so you can see and fix it.', { t: sim.now(), level: 'warn' });
      } else {
        st.drop++;
        lab.log.log('"' + rk + '" matched NO binding: the broker silently DROPPED it (no mandatory flag, no alternate exchange).', { t: sim.now(), level: 'err' });
      }
      render();
    }

    function auto() { publish(MSGS[st.i++ % MSGS.length]); sim.schedule(1000, auto); }

    function seed() {
      st = { q: [[], [], [], []], u: [], n: 0, drop: 0, i: 0 };
      lab.log.clear(); lab.metrics.reset();
      lab.bar.setBroken(false);
      var info = {
        direct: '**Direct exchange:** a message goes to queues whose binding key equals the routing key exactly.',
        fanout: '**Fanout exchange:** copies the message to every bound queue and **ignores** the routing key and binding key. Typos in bindings change nothing.',
        topic: '**Topic exchange:** binding patterns use words separated by dots. `*` matches exactly one word, `#` matches zero or more words. Try changing Q1 to `order.*` and see order.created.eu stop matching.',
        headers: '**Headers exchange:** matches on message headers (type, event, region here) instead of the routing key. Bindings are written as `key=value,key=value`. `x-match=all` needs every pair; `any` needs at least one.'
      };
      lab.explain(info[type]);
      lab.log.log('Exchange type: ' + type + '. Press Play.', { t: 0 });
      sim.schedule(500, auto);
      render();
    }

    sim.on('reset', seed);
    var seg = segmented('Exchange type', [['direct', 'direct'], ['fanout', 'fanout'], ['topic', 'topic'], ['headers', 'headers']], type, function (v) { type = v; binds = DEFAULTS[v].slice(); syncInputs(); sim.reset(); });
    var xmS = segmented('Headers x-match', [['all', 'all'], ['any', 'any']], xm, function (v) { xm = v; sim.reset(); });
    var altC = checkbox('Alternate exchange for unroutable', alt, function (v) { alt = v; render(); });
    inputs = [0, 1, 2, 3].map(function (i) { return textInput('Binding Q' + (i + 1), binds[i], function (v) { binds[i] = v; }); });
    var pubIn = textInput('Routing key', 'order.created.eu', function () {});
    var pubBtn = button('Publish now', function () { var v = pubIn.get().trim(); if (v) { publish(v); } });
    seed();
    return wrap([seg, xmS, altC].concat(inputs).concat([pubIn, pubBtn]), lab);
  }

  /* ================= RABBITMQ LAB 7: acks and prefetch ================= */

  function labAcks() {
    var PROD = 250;
    var sim = Sim.create({ speed: 1 });
    var ackMode = 'manual', pf = 1, st;
    var rBox = mkBox('Ready queue'), aBox = mkBox('Consumer A (fast, 0.25 s)'), bBox = mkBox('Consumer B (slow, 1.2 s)'), lBox = mkBox('Lost', 'dlq');
    var stage = h('div', { class: 'qv' }, [rBox.el, aBox.el, bBox.el, lBox.el]);

    var lab = UI.lab({
      title: 'Lab 7: acknowledgements and prefetch',
      subtitle: 'Four messages per second go to a fast and a slow consumer. Prefetch controls how many unacked messages each may hold.',
      sim: sim, stage: stage,
      stageLabel: 'Ready queue and two consumers with their unacknowledged buffers',
      breakLabel: 'Break it: unlimited prefetch',
      fixLabel: 'Fix it: prefetch 1',
      onBreak: function (broken) { pf = broken ? 50 : 1; pfS.set(pf); sim.reset(); sim.play(); },
      caption: 'Press Play, then crash consumer B.'
    });

    function limit() { return ackMode === 'auto' ? 1e9 : pf; }

    function dispatch() {
      var guard = 0;
      while (st.ready.length && guard++ < 200) {
        var cand = st.cons.filter(function (c) { return c.alive && c.buf.length < limit(); });
        if (!cand.length) { break; }
        var c = cand[st.rr++ % cand.length];
        c.buf.push(st.ready.shift());
        process(c);
      }
    }

    function process(c) {
      if (c.busy || !c.alive || !c.buf.length) { return; }
      c.busy = true;
      var m = c.buf[0], tok = c.tok;
      sim.schedule(c.svc, function () {
        if (c.tok !== tok) { return; }
        c.buf.shift(); c.busy = false; st.done++; st.sum += sim.now() - m.t0;
        dispatch(); process(c); render();
      });
    }

    function crash(c) {
      if (!c.alive) { return; }
      c.alive = false; c.tok++; c.busy = false;
      if (ackMode === 'manual') {
        c.buf.slice().reverse().forEach(function (m) { st.ready.unshift(m); });
        lab.log.log('Consumer ' + c.name + ' crashed holding ' + c.buf.length + ' unacked message(s): the broker REQUEUES them for others.', { t: sim.now(), level: 'warn' });
      } else {
        st.lost += c.buf.length;
        lab.log.log('Consumer ' + c.name + ' crashed holding ' + c.buf.length + ' message(s) that were auto-acked on delivery: they are LOST.', { t: sim.now(), level: 'err' });
      }
      c.buf = [];
      sim.schedule(3000, function () { c.alive = true; lab.log.log('Consumer ' + c.name + ' is back.', { t: sim.now(), level: 'ok' }); dispatch(); render(); });
      dispatch(); render();
    }

    function render() {
      fill(rBox, st.ready.map(function (m) { return { label: m.id }; }), 25);
      rBox.note.textContent = st.ready.length + ' ready in the broker';
      [[aBox, st.cons[0]], [bBox, st.cons[1]]].forEach(function (p) {
        var c = p[1];
        fill(p[0], c.buf.map(function (m, i) { return { label: m.id, cls: i === 0 && c.busy ? 'ok' : 'dup' }; }), 25);
        p[0].state(!c.alive ? 'is-dead' : (c.busy ? 'is-busy' : ''));
        p[0].note.textContent = !c.alive ? 'DOWN' : c.buf.length + ' held (orange = waiting in this consumer)';
      });
      fill(lBox, [], 1);
      lBox.note.textContent = st.lost + ' message(s) lost';
      var secs = sim.now() / 1000;
      lab.metrics.set('throughput', secs > 0 ? st.done / secs : 0);
      lab.metrics.set('latency', avg(st.sum, st.done));
      lab.metrics.set('depth', st.ready.length + st.cons.reduce(function (a, c) { return a + c.buf.length; }, 0));
      lab.metrics.set('errors', st.lost);
    }

    function produce() {
      st.ready.push({ id: ++st.id, t0: sim.now() });
      dispatch(); render();
      sim.schedule(PROD, produce);
    }

    function seed() {
      st = { ready: [], cons: [{ name: 'A', svc: 250, buf: [], busy: false, alive: true, tok: 0 }, { name: 'B', svc: 1200, buf: [], busy: false, alive: true, tok: 0 }], id: 0, done: 0, sum: 0, lost: 0, rr: 0 };
      lab.log.clear(); lab.metrics.reset();
      lab.bar.setBroken(pf >= 20 && ackMode === 'manual');
      lab.explain(ackMode === 'auto'
        ? '**Auto-ack** (no_ack): the broker considers a message done the moment it is sent, and pushes as fast as it can. Fast, but anything a consumer holds in memory when it crashes is lost. Prefetch has no effect.'
        : pf >= 20
          ? '**Unlimited prefetch.** The broker hands out messages round-robin without waiting for acks, so the slow consumer B hoards a long private backlog while A sits idle. Latency rises for messages stuck behind B. **Prefetch 1** gives fair dispatch: a consumer gets a new message only after acking the last.'
          : '**Manual ack with prefetch ' + pf + '.** Each consumer holds at most ' + pf + ' unacked message(s), so work flows to whoever is free, and a crash requeues the unacked messages. Larger prefetch improves throughput for fast, uniform work; 1 is fairest for slow or uneven work.');
      lab.log.log('Ack mode: ' + ackMode + ', prefetch ' + (ackMode === 'auto' ? 'n/a' : pf) + '.', { t: 0 });
      sim.schedule(0, produce);
      render();
    }

    sim.on('reset', seed);
    var seg = segmented('Ack mode', [['manual', 'Manual ack'], ['auto', 'Auto-ack']], ackMode, function (v) { ackMode = v; sim.reset(); });
    var pfS = slider('Prefetch (QoS)', 1, 50, pf, 1, function (v) { return String(v); }, function (v) { pf = v; sim.reset(); });
    var crashB = button('Crash consumer B', function () { crash(st.cons[1]); });
    seed();
    return wrap([seg, pfS, crashB], lab);
  }

  /* ================= RABBITMQ LAB 8: durability and publisher confirms ================= */

  function labDurable() {
    var PROD = 400, CONSUME = 900, CRASH_AT = 3000;
    var sim = Sim.create({ speed: 1 });
    var storage = 'durable', confirms = true, st;
    var pBox = mkBox('Publisher (unconfirmed)'), brBox = mkBox('Broker queue'), cBox = mkBox('Consumer'), lBox = mkBox('Lost forever', 'dlq');
    var stage = h('div', { class: 'qv' }, [pBox.el, brBox.el, cBox.el, lBox.el]);

    var lab = UI.lab({
      title: 'Lab 8: durability and publisher confirms',
      subtitle: 'At 3 s the broker node restarts (2.5 s of downtime; a quorum queue fails over in 0.6 s). What survives?',
      sim: sim, stage: stage,
      stageLabel: 'Publisher, broker queue, consumer and lost messages around a broker restart',
      breakLabel: 'Break it: transient queue, no confirms',
      fixLabel: 'Fix it: durable queue + persistent messages + confirms',
      onBreak: function (broken) { storage = broken ? 'transient' : 'durable'; confirms = !broken; stS.set(storage); cfC.set(confirms); sim.reset(); sim.play(); },
      caption: 'Press Play. The restart happens at 3 s.'
    });

    function delayFor() { return storage === 'transient' ? 20 : (storage === 'durable' ? 300 : 500); }
    function down() { return st.downUntil > sim.now(); }

    function lose(m, why) { if (m.state !== 'lost') { m.state = 'lost'; st.lost++; lab.log.log('#' + m.id + ' LOST: ' + why, { t: sim.now(), level: 'err' }); } }

    function publish(m) {
      if (down()) {
        if (confirms) { return; }
        lose(m, 'broker was down and the publisher (no confirms) never knew.');
        return;
      }
      var gen = st.gen;
      m.state = 'queued'; m.stored = false;
      st.q.push(m);
      sim.schedule(delayFor(), function () {
        if (st.gen !== gen || m.state === 'lost') { return; }
        if (storage !== 'transient') { m.stored = true; }
        if (confirms && st.unconf.indexOf(m) !== -1) {
          st.unconf.splice(st.unconf.indexOf(m), 1);
          lab.log.log('Broker confirms #' + m.id + (storage === 'transient' ? ' (but it is only in memory!).' : ' (written to disk' + (storage === 'quorum' ? ' and replicated to a majority).' : ').')), { t: sim.now(), level: storage === 'transient' ? 'warn' : 'ok' });
        }
        render();
      });
      render();
    }

    function produce() {
      var m = { id: ++st.id, t0: sim.now(), state: 'new', stored: false };
      st.all.push(m);
      if (confirms) { st.unconf.push(m); }
      publish(m);
      sim.schedule(PROD, produce);
    }

    function consume() {
      if (!down() && st.q.length && !st.cur) {
        var m = st.q.shift();
        st.cur = m;
        var gen = st.gen;
        sim.schedule(CONSUME - 400, function () {
          if (st.gen !== gen || m.state === 'lost') { return; }
          st.cur = null; m.state = 'done'; st.done++; st.sum += sim.now() - m.t0;
          render();
        });
      }
      sim.schedule(400, consume);
    }

    function crash() {
      st.gen++;
      var dur = storage === 'quorum' ? 600 : 2500;
      st.downUntil = sim.now() + dur;
      lab.log.log('BROKER NODE RESTARTS (down for ' + (dur / 1000) + ' s' + (storage === 'quorum' ? ', a replica takes over' : '') + ').', { t: sim.now(), level: 'err' });
      var survivors = [];
      var inflight = st.cur ? [st.cur] : [];
      st.cur = null;
      inflight.concat(st.q).forEach(function (m) {
        if (storage === 'transient') { lose(m, 'the queue was transient (not durable), so its contents vanished.'); }
        else if (m.stored) { survivors.push(m); }
        else if (confirms && st.unconf.indexOf(m) !== -1) { m.state = 'new'; lab.log.log('#' + m.id + ' was not yet on disk, but it is unconfirmed, so the publisher will resend it.', { t: sim.now(), level: 'warn' }); }
        else { lose(m, 'it was only in memory and the publisher had no confirm to retry from.'); }
      });
      st.q = survivors;
      sim.schedule(dur, function () {
        lab.log.log('Broker is back. Queue recovered with ' + st.q.length + ' message(s).', { t: sim.now(), level: 'ok' });
        st.unconf.filter(function (m) { return m.state === 'new'; }).forEach(function (m) { lab.log.log('Publisher resends unconfirmed #' + m.id + '.', { t: sim.now() }); publish(m); });
        summary();
        render();
      });
      render();
    }

    function summary() {
      sim.schedule(4000, function () {
        lab.explain(st.lost
          ? '**Messages lost.** ' + st.lost + ' message(s) vanished. A non-durable queue loses its contents on restart; a confirm from a transient queue only means "it is in memory". Without confirms, publishers cannot detect messages lost while the broker is down or before the disk write.'
          : '**Nothing lost.** Durable queue + persistent messages put data on disk, **publisher confirms** tell the producer when it is safe to forget a message (and let it resend otherwise), and consumer acks protect the other end. A quorum queue also replicates to a majority and fails over faster. Cost: disk writes and confirm latency. Duplicates are still possible on resend, so consumers should be idempotent.');
      });
    }

    function render() {
      fill(pBox, st.unconf.map(function (m) { return { label: m.id, cls: 'dup' }; }), 12);
      pBox.note.textContent = confirms ? st.unconf.length + ' awaiting confirm (kept for retry)' : 'confirms OFF: fire and forget';
      fill(brBox, st.q.map(function (m) { return { label: m.id, cls: m.stored ? 'ok' : 'dup' }; }), 25);
      brBox.state(down() ? 'is-dead' : '');
      brBox.note.textContent = (down() ? 'DOWN | ' : '') + st.q.length + ' queued (green = on disk, orange = memory only)';
      fill(cBox, st.cur ? [{ label: st.cur.id, cls: 'ok' }] : [], 1);
      cBox.note.textContent = st.done + ' delivered';
      fill(lBox, st.all.filter(function (m) { return m.state === 'lost'; }).map(function (m) { return { label: m.id, cls: 'bad' }; }), 15);
      lBox.note.textContent = st.lost + ' lost';
      var secs = sim.now() / 1000;
      lab.metrics.set('throughput', secs > 0 ? st.done / secs : 0);
      lab.metrics.set('latency', avg(st.sum, st.done));
      lab.metrics.set('depth', st.q.length);
      lab.metrics.set('errors', st.lost);
    }

    function seed() {
      st = { all: [], q: [], unconf: [], cur: null, id: 0, done: 0, sum: 0, lost: 0, gen: 0, downUntil: 0 };
      lab.log.clear(); lab.metrics.reset();
      lab.bar.setBroken(storage === 'transient' && !confirms);
      lab.explain('Settings: **' + ({ transient: 'transient queue, non-persistent messages', durable: 'durable queue + persistent messages (classic)', quorum: 'quorum queue (replicated, durable)' })[storage] + '**, publisher confirms ' + (confirms ? 'ON' : 'OFF') + '. Press Play and watch the 3 s restart.');
      lab.log.log('Publisher sends every 0.4 s; consumer is slower, so a backlog exists when the node restarts.', { t: 0 });
      sim.schedule(0, produce);
      sim.schedule(200, consume);
      sim.schedule(CRASH_AT, crash);
      render();
    }

    sim.on('tick', render);
    sim.on('reset', seed);
    var stS = segmented('Queue type', [['transient', 'Transient'], ['durable', 'Durable + persistent'], ['quorum', 'Quorum queue']], storage, function (v) { storage = v; sim.reset(); });
    var cfC = checkbox('Publisher confirms', confirms, function (v) { confirms = v; sim.reset(); });
    seed();
    return wrap([stS, cfC], lab);
  }

  /* ================= RABBITMQ LAB 9: DLX and TTL ================= */

  function labDlx() {
    var PROD = 500, WORK = 800;
    var sim = Sim.create({ speed: 1 });
    var pol = 'dlx', ttl = 8000, maxLen = 20, st;
    var qBox = mkBox('Work queue'), cBox = mkBox('Consumer'), okBox = mkBox('Processed'), dBox = mkBox('Dead letter queue (via DLX)', 'dlq');
    var stage = h('div', { class: 'qv' }, [qBox.el, cBox.el, okBox.el, dBox.el]);

    var lab = UI.lab({
      title: 'Lab 9: dead letter exchange and TTL',
      subtitle: 'Every 6th message is poison. Messages also expire after the TTL, and the queue is capped. Where does each end up?',
      sim: sim, stage: stage,
      stageLabel: 'Work queue with TTL and max length, a consumer and a dead letter queue',
      breakLabel: 'Break it: nack with requeue=true',
      fixLabel: 'Fix it: nack with requeue=false (dead-letter)',
      onBreak: function (broken) { pol = broken ? 'requeue' : 'dlx'; seg.set(pol); sim.reset(); sim.play(); },
      caption: 'Press Play and watch the DLQ reasons.'
    });

    function dead(m, why) { st.dlq.push({ id: m.id, why: why }); st.reasons[why] = (st.reasons[why] || 0) + 1; }

    function render() {
      fill(qBox, st.q.map(function (m) { return { label: m.id + (m.redel ? ' r' + m.redel : ''), cls: m.poison ? 'bad' : '' }; }), 25);
      qBox.note.textContent = st.q.length + ' / ' + maxLen + ' (max-length) | TTL ' + (ttl / 1000) + ' s';
      fill(cBox, st.cur ? [{ label: st.cur.id, cls: st.cur.poison ? 'bad' : 'ok' }] : [], 1);
      cBox.state(st.cur ? (st.cur.poison ? 'is-dead' : 'is-busy') : '');
      cBox.note.textContent = st.cur ? 'working on #' + st.cur.id : 'idle';
      fill(okBox, [], 1);
      okBox.note.textContent = st.done + ' processed';
      fill(dBox, st.dlq.slice(-12).map(function (d) { return { label: d.id + ':' + d.why, cls: 'bad' }; }), 12);
      dBox.note.textContent = st.dlq.length + ' dead | rejected ' + (st.reasons.rejected || 0) + ', expired ' + (st.reasons.expired || 0) + ', maxlen ' + (st.reasons.maxlen || 0);
      var secs = sim.now() / 1000;
      lab.metrics.set('throughput', secs > 0 ? st.done / secs : 0);
      lab.metrics.set('latency', avg(st.sum, st.done));
      lab.metrics.set('depth', st.q.length);
      lab.metrics.set('errors', st.redel);
    }

    function pump() {
      if (st.cur) { return; }
      while (st.q.length && sim.now() - st.q[0].t0 > ttl) { var d = st.q.shift(); dead(d, 'expired'); }
      if (!st.q.length) { return; }
      var m = st.q.shift();
      st.cur = m;
      sim.schedule(WORK, function () {
        st.cur = null;
        if (m.poison) {
          if (pol === 'requeue') {
            m.redel = (m.redel || 0) + 1; st.redel++;
            st.q.unshift(m);
            if (m.redel % 5 === 1) { lab.log.log('#' + m.id + ' rejected with requeue=true (redelivery ' + m.redel + '): it goes straight back to the head and the consumer hot-loops on it.', { t: sim.now(), level: 'err' }); }
          } else {
            dead(m, 'rejected');
            lab.log.log('#' + m.id + ' rejected with requeue=false: dead-lettered with reason "rejected".', { t: sim.now(), level: 'warn' });
          }
        } else { st.done++; st.sum += sim.now() - m.t0; }
        pump(); render();
      });
    }

    function produce() {
      var m = { id: ++st.id, t0: sim.now(), poison: st.id % 6 === 0 };
      if (st.q.length >= maxLen) {
        var old = st.q.shift();
        dead(old, 'maxlen');
        if (st.reasons.maxlen % 4 === 1) { lab.log.log('Queue full (' + maxLen + '): oldest message #' + old.id + ' dropped to the DLX (overflow=drop-head).', { t: sim.now(), level: 'warn' }); }
      }
      st.q.push(m);
      pump(); render();
      sim.schedule(PROD, produce);
    }

    function seed() {
      st = { q: [], cur: null, dlq: [], reasons: {}, id: 0, done: 0, sum: 0, redel: 0 };
      lab.log.clear(); lab.metrics.reset();
      lab.bar.setBroken(pol === 'requeue');
      lab.explain(pol === 'requeue'
        ? '**Requeue loop.** With `requeue=true` the broker puts the poisoned message back at the head, so the consumer retries it instantly forever, burning CPU, blocking the messages behind it and filling logs. Press **Fix it**.'
        : '**Dead-lettering.** Messages that are **rejected** (requeue=false), **expire** (TTL) or **overflow** (max-length) are republished to the dead letter exchange with an `x-death` header recording why. Healthy messages keep flowing, and you can inspect, alert on and replay the DLQ. Note: queue TTL is enforced at the head of the queue, and a DLQ nobody reads is just a slow data-loss bin.');
      lab.log.log('Producer 2 msg/s, consumer 1.25 msg/s, TTL ' + (ttl / 1000) + ' s, max length ' + maxLen + '.', { t: 0 });
      sim.schedule(0, produce);
      render();
    }

    sim.on('reset', seed);
    var seg = segmented('On failure (nack)', [['dlx', 'requeue=false (DLX)'], ['requeue', 'requeue=true']], pol, function (v) { pol = v; sim.reset(); });
    var tS = slider('Message TTL', 2, 20, ttl / 1000, 1, function (v) { return v + ' s'; }, function (v) { ttl = v * 1000; sim.reset(); });
    var mS = slider('Max length', 5, 50, maxLen, 1, function (v) { return String(v); }, function (v) { maxLen = v; sim.reset(); });
    seed();
    return wrap([seg, tS, mS], lab);
  }

  /* ================= COMPARISON MATRIX ================= */

  var ROWS = [
    ['Core model', 'Distributed, partitioned, append-only commit log', 'Smart broker: exchanges route messages to queues (AMQP 0-9-1; also supports other protocols)', 'depends'],
    ['Message lifetime', 'Kept by time, size or compaction, whether or not consumed', 'Removed after the consumer acks (queues). Streams keep a log.', 'kafka'],
    ['Replay and re-reading', 'First class: seek to any offset or timestamp; many independent consumer groups', 'Not for classic or quorum queues; RabbitMQ Streams add replay', 'kafka'],
    ['Routing flexibility', 'Topic plus partition key; consumers filter themselves', 'Direct, fanout, topic and headers exchanges, alternate exchanges, rich bindings', 'rabbit'],
    ['Ordering', 'Guaranteed per partition (use a key for per-entity order)', 'Per queue with a single consumer; lost with competing consumers and redelivery', 'kafka'],
    ['Consumer model', 'Pull. Parallelism per group is capped by partition count', 'Push with prefetch. Add consumers freely to a queue', 'depends'],
    ['Throughput at scale', 'Very high: sequential disk I/O, batching and partitions scale out', 'High for typical workloads; single queues are bounded, streams go higher', 'kafka'],
    ['Latency for small loads', 'Low milliseconds, batching trades a little latency for throughput', 'Very low latency for small messages and light load', 'rabbit'],
    ['Delivery guarantees', 'At-least-once by default; idempotent producer and transactions within Kafka', 'At-least-once with confirms and acks; at-most-once with auto-ack', 'depends'],
    ['Per-message features', 'No per-message TTL, priority or delay; only retention', 'Per-message and per-queue TTL, priorities, delayed delivery (plugin), DLX', 'rabbit'],
    ['Retries and dead letters', 'You build retry topics and a dead letter topic', 'Dead letter exchanges built in; delivery limits on quorum queues', 'rabbit'],
    ['Operations', 'Larger clusters, partition planning, KRaft (no ZooKeeper in recent versions)', 'Simple to start; clustering needs care (use quorum queues); watch memory alarms', 'depends'],
    ['Typical uses', 'Event streaming, analytics pipelines, log aggregation, CDC, event sourcing', 'Task queues, RPC, workflow routing, notifications, integration between services', 'depends']
  ];

  function matrixBlock() {
    var f = 'all';
    var tb = h('tbody');
    var tbl = h('table', { class: 'matrix' }, [
      h('caption', { class: 'sr-only', text: 'Kafka versus RabbitMQ comparison' }),
      h('thead', {}, [h('tr', {}, ['Dimension', 'Apache Kafka', 'RabbitMQ', 'Edge'].map(function (t) { return h('th', { scope: 'col', text: t }); }))]),
      tb
    ]);
    var out = h('p', { class: 'cf-note', 'aria-live': 'polite' });
    function draw() {
      tb.innerHTML = '';
      var n = 0;
      ROWS.forEach(function (r) {
        if (f !== 'all' && r[3] !== f) { return; }
        n++;
        tb.appendChild(h('tr', {}, [
          h('td', { text: r[0] }), h('td', { text: r[1] }), h('td', { text: r[2] }),
          h('td', {}, [h('span', { class: 'edge ' + r[3], text: r[3] === 'kafka' ? 'Kafka' : (r[3] === 'rabbit' ? 'RabbitMQ' : 'Depends') })])
        ]));
      });
      out.textContent = 'Showing ' + n + ' of ' + ROWS.length + ' dimensions.';
    }
    var seg = segmented('Show rows where the edge is', [['all', 'All'], ['kafka', 'Kafka'], ['rabbit', 'RabbitMQ'], ['depends', 'Depends']], 'all', function (v) { f = v; draw(); });
    draw();
    return h('div', { class: 'card' }, [
      h('div', { class: 'card-title' }, [h('h3', { text: 'Head-to-head comparison' })]),
      h('p', { class: 'muted', text: 'A fair comparison, not a scoreboard. "Edge" means the tool\'s natural strength; you can bend either tool, at a cost.' }),
      h('div', { class: 'lab-controls' }, [seg.el]), h('div', { class: 'matrix-wrap' }, [tbl]), out
    ]);
  }

  /* ================= DECISION WIZARD ================= */

  function wizard() {
    var QS = [
      { id: 'replay', q: '1. Do new or existing consumers need to re-read old events (rebuild state, reprocess after a bug)?', opts: [['yes', 'Yes, often', { k: 3, r: 0 }], ['some', 'Occasionally', { k: 1, r: 1 }], ['no', 'No, once handled is done', { k: 0, r: 2 }]] },
      { id: 'vol', q: '2. How much data per second?', opts: [['low', 'Up to a few thousand messages', { k: 0, r: 2 }], ['mid', 'Tens of thousands', { k: 1, r: 1 }], ['high', 'Hundreds of thousands or more', { k: 3, r: 0 }]] },
      { id: 'route', q: '3. How complex is the routing (different consumers want different subsets by pattern or header)?', opts: [['complex', 'Complex and changing', { k: 0, r: 3 }], ['simple', 'A few topics or queues', { k: 1, r: 1 }]] },
      { id: 'feat', q: '4. Do you need per-message priorities, TTL, delayed delivery or request/reply?', opts: [['yes', 'Yes', { k: 0, r: 3 }], ['no', 'No', { k: 1, r: 0 }]] },
      { id: 'order', q: '5. Do you need ordering per key (per customer, per account) at large scale?', opts: [['yes', 'Yes', { k: 2, r: 0 }], ['no', 'Not strictly', { k: 0, r: 1 }]] },
      { id: 'fan', q: '6. How many independent consumer groups read the same events?', opts: [['many', 'Many (analytics, search, audit, ML...)', { k: 2, r: 0 }], ['few', 'One or two', { k: 0, r: 1 }]] },
      { id: 'ops', q: '7. Who will run it?', opts: [['managed', 'A managed cloud service or a platform team', { k: 1, r: 1 }], ['small', 'A small team that wants minimal operations', { k: 0, r: 1 }]] }
    ];
    var ans = {};
    var out = h('div', { class: 'decide-out', 'aria-live': 'polite' });

    function bar(label, v, max) {
      var b = h('div', { class: 'lagbar' }, [h('i')]);
      b.firstChild.style.width = (max ? v / max * 100 : 0) + '%';
      return h('div', { class: 'score' }, [h('span', { text: label }), b, h('span', { text: String(v) })]);
    }

    function refresh() {
      out.innerHTML = '';
      var left = QS.filter(function (q) { return !ans[q.id]; }).length;
      if (left) { out.appendChild(h('p', { class: 'cf-note', text: 'Answer all seven questions to get a recommendation (' + left + ' left).' })); return; }
      var k = 0, r = 0, why = [];
      QS.forEach(function (q) {
        var o = q.opts.filter(function (x) { return x[0] === ans[q.id]; })[0];
        k += o[2].k; r += o[2].r;
        if (o[2].k - o[2].r >= 2) { why.push('Kafka: ' + o[1].toLowerCase()); } else if (o[2].r - o[2].k >= 2) { why.push('RabbitMQ: ' + o[1].toLowerCase()); }
      });
      var max = Math.max(k, r, 1);
      var diff = k - r, head, kind, body;
      if (Math.abs(diff) <= 2) {
        kind = ''; head = 'It is close: either can work';
        body = 'Your answers do not strongly favour one. Choose the one your team already runs or can get as a managed service, and keep consumers idempotent so you can switch later. At small scale also consider a managed queue (for example SQS) or RabbitMQ Streams if you want a log inside RabbitMQ.';
      } else if (diff > 0) {
        kind = 'ok'; head = 'Lean towards Apache Kafka';
        body = 'Kafka fits large-volume event streams that several teams read and replay. Plan partitions and keys carefully, set acks=all with min.insync.replicas=2, monitor consumer lag and expect to build retries and dead-letter handling yourself.';
      } else {
        kind = 'ok'; head = 'Lean towards RabbitMQ';
        body = 'RabbitMQ fits task and workflow messaging with rich routing and per-message handling. Use quorum queues, publisher confirms, manual acks with a sensible prefetch, a delivery limit and a DLX. If you later need replay, look at RabbitMQ Streams.';
      }
      out.appendChild(UI.callout(kind, head, body + (why.length ? '\n\n**What drove it:** ' + why.join('; ') + '.' : '') + '\n\nThis is a rule of thumb. Prototype with your real load before committing.').el);
      out.appendChild(h('div', {}, [bar('Kafka', k, max), bar('RabbitMQ', r, max)]));
    }

    var form = h('div', { class: 'decide' }, QS.map(function (q) {
      var name = 'wq' + (++uid);
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
      h('div', { class: 'card-title' }, [h('h3', { text: 'Which should I choose? A decision wizard' })]),
      h('p', { text: 'Seven questions about your workload. No hype: the answer is often "it depends", and sometimes "neither".' }),
      form, out
    ]);
  }

  /* ================= PREDICT ================= */

  function predict() {
    var BINDS = ['order.#', '*.created.*', 'order.*', '#.eu'];
    var KEY = 'order.created.eu';
    return UI.predictChallenge({
      question: 'A topic exchange has four queues bound with the patterns below. A message is published with routing key "order.created.eu". How many queues receive a copy?',
      setup: 'Bindings: Q1 = "order.#", Q2 = "*.created.*", Q3 = "order.*", Q4 = "#.eu". Routing key: "order.created.eu".',
      options: ['1', '2', '3', '4'],
      answer: 2,
      duration: (BINDS.length + 1) * 700,
      speed: 4,
      explain: '`order.#` matches (order, then any words). `*.created.*` matches (three words, the middle one is "created"). `order.*` does **not** match, because `*` matches exactly one word and the key has two more. `#.eu` matches (anything, then eu). So **3** queues receive it: Q1, Q2 and Q4.',
      simulate: function (ctx) {
        var s = ctx.sim, n = 0;
        var out = h('p', { class: 'ui-box', text: 'Queues that received a copy: 0' });
        ctx.stage.appendChild(out);
        ctx.state = { n: 0 };
        BINDS.forEach(function (b, i) {
          s.schedule((i + 1) * 700, function () {
            var ok = topicMatch(b, KEY);
            if (ok) { n++; }
            ctx.state.n = n;
            out.textContent = 'Queues that received a copy: ' + n;
            ctx.log('Q' + (i + 1) + ' binding "' + b + '" vs key "' + KEY + '": ' + (ok ? 'MATCH, a copy is queued.' : 'no match.'), { t: s.now(), level: ok ? 'ok' : 'info' });
          });
        });
      },
      measure: function (ctx) { return ctx.state.n + ' queue(s) received the message.'; }
    }).el;
  }

  /* ================= CHEAT SHEET + INTERVIEW ================= */

  function cheatSheet() {
    var items = [
      ['Kafka in one line', 'A partitioned, replicated, append-only log. Records keep their offset; consumers track their own position; retention decides deletion.'],
      ['Keys and ordering', 'Same key goes to the same partition and keeps order. No global order across partitions. Hot keys make hot partitions.'],
      ['Consumer groups', 'Each partition goes to one consumer per group. More consumers than partitions means idle ones. Watch lag and rebalances.'],
      ['Kafka durability', 'replication.factor=3, min.insync.replicas=2, acks=all, idempotent producer, unclean leader election off, commit offsets after processing.'],
      ['Retention and compaction', 'delete: drop old data by time or size. compact: keep latest per key (tombstone deletes). Retention must exceed worst outage.'],
      ['RabbitMQ in one line', 'A broker: producer, exchange, bindings, queue, consumer. Messages are removed after ack. Streams add a log.'],
      ['Exchange types', 'direct = exact key. fanout = all bound queues. topic = `*` one word, `#` zero or more. headers = match headers (x-match all or any).'],
      ['RabbitMQ reliability', 'Durable queue + persistent message + publisher confirms + manual ack + prefetch. Quorum queues for replication. mandatory or alternate exchange for unroutable.'],
      ['Failure handling', 'DLX for rejected, expired and overflowed messages. Never requeue forever. Delivery limit, backoff, alert on DLQ. Idempotent consumers always.']
    ];
    return h('div', { class: 'cheat' }, items.map(function (it) {
      return h('div', { class: 'cheat-item' }, [h('h4', { text: it[0] }), UI.rich(it[1])]);
    }));
  }

  function interview() {
    return UI.accordion({ items: [
      { title: 'Explain Kafka\'s architecture in two minutes.', body: 'A **topic** is split into **partitions**; each partition is an ordered, append-only log replicated across brokers, with one **leader** and followers in the **ISR**. Producers pick a partition (by key or round-robin) and append; consumers in a **consumer group** each own a subset of partitions and track their **offsets**. Data is kept by retention or compaction regardless of consumption, which enables replay and many independent consumer groups. Recent versions replace ZooKeeper with **KRaft** controllers for metadata.' },
      { title: 'How does Kafka guarantee ordering, and where does that break?', body: 'Only **within a partition**. Using a key routes all events for an entity to one partition, giving per-key order. It breaks if you change the partition count (the key mapping changes), use no key, send with retries and several in-flight requests without idempotence, or process a partition\'s records in parallel inside the consumer. Hot keys also limit scaling because one key can use only one partition.' },
      { title: 'A consumer group is falling behind. How do you investigate?', body: 'Look at **lag per partition** (is it one partition or all?), consumer processing time, rebalance frequency, and whether consumers are CPU, I/O or downstream bound. One lagging partition suggests a hot key or a slow single consumer; all lagging suggests throughput. Fixes: optimise the handler, batch work, add consumers up to the partition count, add partitions (aware of the key mapping change), fix flapping membership with cooperative-sticky or static membership, and raise `max.poll.interval.ms` if processing is legitimately long.' },
      { title: 'How do you avoid losing data in Kafka?', body: 'On the producer: `acks=all`, `enable.idempotence=true`, retries and delivery timeouts. On the topic: replication factor 3, `min.insync.replicas=2`, `unclean.leader.election.enable=false`. On the consumer: disable auto-commit, commit offsets only after processing, and make processing idempotent. Plus monitoring of under-replicated partitions and an appropriate retention for your recovery time.' },
      { title: 'What does "exactly-once" mean in Kafka?', body: 'Within Kafka, idempotent producers prevent duplicates from retries, and transactions let you atomically write to several partitions and commit consumer offsets together (consume-transform-produce). It does **not** make side effects in an external database or API exactly-once. For those you still need idempotent consumers, or the outbox pattern, and you read with `isolation.level=read_committed`.' },
      { title: 'Explain RabbitMQ\'s exchange types with an example each.', body: '**Direct:** route `invoice` to the invoices queue (exact key). **Fanout:** broadcast a cache-invalidation to every service queue. **Topic:** `order.*.eu` or `payment.#` for pattern routing, where `*` is one word and `#` is zero or more. **Headers:** route by attributes such as `region=eu` and `type=order`, with `x-match` all or any. Unroutable messages are dropped unless you publish with `mandatory` or configure an alternate exchange.' },
      { title: 'How do you make RabbitMQ delivery reliable end to end?', body: 'Publisher side: publisher **confirms**, `mandatory`, persistent messages. Broker side: **durable** (preferably **quorum**) queues. Consumer side: manual **acks** after the work, sensible **prefetch**, a **delivery limit** and a **dead letter exchange**. Add idempotent consumers because redelivery can duplicate, and monitor queue depth, unacked counts, memory and disk alarms.' },
      { title: 'What is prefetch and how do you choose it?', body: 'Prefetch (QoS) caps unacknowledged messages per consumer or channel. Too high and a slow consumer hoards messages while others idle, and a crash requeues a huge batch. Too low and network round trips limit throughput. Start with 1 for slow or uneven jobs, and tens to hundreds for fast, uniform jobs, then measure.' },
      { title: 'Kafka or RabbitMQ for task processing with retries and priorities?', body: 'Usually **RabbitMQ**: per-message TTL, priorities, delayed delivery, dead letter exchanges and flexible routing are built in. In Kafka you would build retry topics with delays and a dead letter topic yourself, and a stuck record blocks its partition. Choose Kafka when you need very high throughput, replay, many consumer groups, or stream processing over the same data.' },
      { title: 'When would you use both together?', body: 'A common pattern: Kafka as the durable backbone for domain events and analytics, with RabbitMQ (or a job queue) for command-style tasks that need routing, delays and retries. A consumer reads a Kafka event, then enqueues a task. Keep clear ownership and idempotency at each boundary, and avoid bridging them without a reason, since every hop adds latency and failure modes.' }
    ] }).el;
  }

  /* ================= MOUNT ================= */

  function mount(el) {
    el.appendChild(h('div', { class: 'topic-intro' }, [h('p', { class: 'lead', text: 'Two ways to move messages: Kafka keeps a log you can replay; RabbitMQ routes and delivers tasks. You will break both and learn when to pick each.' })]));
    el.appendChild(storyBlock());
    el.appendChild(title('Learn it at your level', 'Start at Beginner. Each level adds depth and real production scars.'));
    el.appendChild(levelTabs());

    el.appendChild(title('Apache Kafka labs', 'Logs, partitions, groups, replication and replay.'));
    el.appendChild(title('Lab 1 \u00B7 Partitions, offsets and keys'));
    el.appendChild(labKeys());
    el.appendChild(title('Lab 2 \u00B7 Consumer groups, rebalance and lag'));
    el.appendChild(labGroup());
    el.appendChild(title('Lab 3 \u00B7 Replication and leader failure'));
    el.appendChild(labReplication());
    el.appendChild(title('Lab 4 \u00B7 Retention and compaction'));
    el.appendChild(labRetention());
    el.appendChild(title('Lab 5 \u00B7 Replay from an offset'));
    el.appendChild(labReplay());

    el.appendChild(title('RabbitMQ labs', 'Exchanges, acks, durability, dead letters and TTL.'));
    el.appendChild(title('Lab 6 \u00B7 Exchanges, bindings and wildcards'));
    el.appendChild(labExchange());
    el.appendChild(title('Lab 7 \u00B7 Acks and prefetch'));
    el.appendChild(labAcks());
    el.appendChild(title('Lab 8 \u00B7 Durability and publisher confirms'));
    el.appendChild(labDurable());
    el.appendChild(title('Lab 9 \u00B7 Dead letter exchange and TTL'));
    el.appendChild(labDlx());

    el.appendChild(title('Head to head'));
    el.appendChild(matrixBlock());
    el.appendChild(wizard());

    el.appendChild(title('Predict the outcome'));
    el.appendChild(predict());

    el.appendChild(title('Quiz', '5 questions. Score 70% or more to complete this topic.'));
    el.appendChild(UI.quiz({ title: 'Kafka and RabbitMQ quiz', topicId: 'kafka-rabbit', questions: (global.QUIZZES && global.QUIZZES['kafka-rabbit']) || [], passPct: 70 }).el);

    el.appendChild(title('Cheat sheet'));
    el.appendChild(cheatSheet());
    el.appendChild(title('Interview questions', 'Try answering out loud before opening each one.'));
    el.appendChild(interview());
  }

  global.App.registerTopic({ id: 'kafka-rabbit', title: 'Kafka & RabbitMQ', accent: 'kafka-rabbit', mount: mount });
})(window);
