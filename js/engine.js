/*
 * engine.js - shared discrete-event simulation engine (virtual clock).
 *
 * FROZEN CONTRACT:
 *   Sim.create({speed}) -> {schedule(delay, fn), now(), play(), pause(), step(), reset(), setSpeed(x), on(event, fn)}
 *
 * Additive helpers (safe to rely on): cancel(id), emit(event, data), runUntil(t), isPlaying(),
 * speed(), pending(), destroy(), and Sim.random(seed).
 *
 * Events emitted via on(): 'play', 'pause', 'step', 'reset', 'speed', 'tick', 'event', 'idle', plus any custom
 * event a lab emits through sim.emit().
 */
(function (global) {
  'use strict';

  var MIN_SPEED = 0.05;
  var MAX_SPEED = 32;
  var MAX_FRAME_MS = 100; // clamp so a background tab does not cause a huge time jump
  var MAX_EVENTS_PER_RUN = 100000; // guard against runaway zero-delay loops

  function clampSpeed(x) {
    x = Number(x);
    if (!isFinite(x) || x <= 0) { return 1; }
    return Math.min(MAX_SPEED, Math.max(MIN_SPEED, x));
  }

  function create(opts) {
    opts = opts || {};
    var speedFactor = clampSpeed(opts.speed || 1);
    var clock = 0;      // virtual milliseconds
    var seq = 0;        // tie-breaker so equal-time events run in schedule order (FIFO)
    var queue = [];     // sorted by (at, seq)
    var playing = false;
    var raf = 0;
    var lastTs = 0;
    var handlers = {};
    var destroyed = false;
    var api;

    function emit(name, data) {
      var list = handlers[name];
      if (!list) { return; }
      list.slice().forEach(function (fn) {
        try { fn(data, api); } catch (err) { if (global.console) { console.error(err); } }
      });
    }

    function insert(item) {
      var i = queue.length;
      while (i > 0 && (queue[i - 1].at > item.at || (queue[i - 1].at === item.at && queue[i - 1].seq > item.seq))) { i--; }
      queue.splice(i, 0, item);
    }

    function schedule(delay, fn) {
      if (destroyed || typeof fn !== 'function') { return -1; }
      delay = Number(delay);
      if (!isFinite(delay) || delay < 0) { delay = 0; }
      var item = { id: ++seq, seq: seq, at: clock + delay, fn: fn };
      insert(item);
      return item.id;
    }

    function cancel(id) {
      for (var i = 0; i < queue.length; i++) {
        if (queue[i].id === id) { queue.splice(i, 1); return true; }
      }
      return false;
    }

    function runOne() {
      var item = queue.shift();
      clock = item.at;
      try { item.fn(api); } catch (err) { if (global.console) { console.error(err); } }
      emit('event', { id: item.id, at: clock });
    }

    // Run every event due at or before `limit` (virtual ms). Stops early if a handler pauses/destroys.
    function drain(limit, requirePlaying) {
      var guard = 0;
      while (queue.length && queue[0].at <= limit && !destroyed) {
        if (requirePlaying && !playing) { return false; }
        if (++guard > MAX_EVENTS_PER_RUN) { return false; }
        runOne();
      }
      return true;
    }

    function frame(ts) {
      raf = 0;
      if (!playing || destroyed) { return; }
      var dt = Math.min(MAX_FRAME_MS, Math.max(0, ts - lastTs));
      lastTs = ts;
      var target = clock + dt * speedFactor;
      var completed = drain(target, true);
      if (playing && completed) { clock = target; }
      emit('tick', clock);
      if (!playing || destroyed) { return; }
      if (!queue.length) {
        pause();
        emit('idle', clock);
        return;
      }
      raf = global.requestAnimationFrame(frame);
    }

    function play() {
      if (playing || destroyed) { return; }
      if (!queue.length) { emit('idle', clock); return; }
      playing = true;
      lastTs = (global.performance && performance.now) ? performance.now() : Date.now();
      raf = global.requestAnimationFrame(frame);
      emit('play', clock);
    }

    function pause() {
      if (!playing) { return; }
      playing = false;
      if (raf) { global.cancelAnimationFrame(raf); raf = 0; }
      emit('pause', clock);
    }

    function step() {
      if (destroyed) { return; }
      pause();
      if (!queue.length) { emit('idle', clock); return; }
      runOne();
      emit('step', clock);
      emit('tick', clock);
    }

    function runUntil(limit) {
      if (destroyed) { return; }
      pause();
      limit = Number(limit);
      if (!isFinite(limit)) { limit = clock; }
      drain(limit, false);
      if (limit > clock) { clock = limit; }
      emit('tick', clock);
    }

    function reset() {
      pause();
      queue.length = 0;
      clock = 0;
      emit('reset', 0);
      emit('tick', 0);
    }

    function setSpeed(x) {
      speedFactor = clampSpeed(x);
      emit('speed', speedFactor);
    }

    function on(name, fn) {
      if (typeof fn !== 'function') { return function () {}; }
      (handlers[name] = handlers[name] || []).push(fn);
      return function off() {
        var list = handlers[name] || [];
        var i = list.indexOf(fn);
        if (i >= 0) { list.splice(i, 1); }
      };
    }

    function destroy() {
      pause();
      destroyed = true;
      queue.length = 0;
      handlers = {};
    }

    api = {
      schedule: schedule,
      now: function () { return clock; },
      play: play,
      pause: pause,
      step: step,
      reset: reset,
      setSpeed: setSpeed,
      on: on,
      cancel: cancel,
      emit: emit,
      runUntil: runUntil,
      isPlaying: function () { return playing; },
      speed: function () { return speedFactor; },
      pending: function () { return queue.length; },
      destroy: destroy
    };
    return api;
  }

  // Small deterministic PRNG (mulberry32) so labs behave identically on every run.
  function random(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  global.Sim = { create: create, random: random };
})(window);
