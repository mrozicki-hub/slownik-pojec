/* fsrs.js — FSRS-5 (Free Spaced Repetition Scheduler)
 * Implementacja algorytmu wg specyfikacji open-spaced-repetition/fsrs4anki.
 * Wagi domyślne = opublikowane wagi FSRS-5.
 *
 * Stan karty (obiekt zapisywany w progress.js):
 *   s    stability   — czas w dniach, po którym retrievability spada do 90%
 *   d    difficulty  — 1..10
 *   st   state       — 0 new | 1 learning | 2 review | 3 relearning
 *   rep  reps
 *   lap  lapses
 *   due  timestamp ms
 *   last timestamp ms ostatniej powtórki
 *   u    timestamp ms ostatniej zmiany (do merge'owania między urządzeniami)
 *
 * Oceny: 1 = Znowu, 2 = Trudne, 3 = Dobre, 4 = Łatwe
 */
(function (global) {
  'use strict';

  var DEFAULT_W = [
    0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046,
    1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315,
    2.9898, 0.51655, 0.6621
  ];

  var DECAY = -0.5;
  var FACTOR = Math.pow(0.9, 1 / DECAY) - 1; // = 19/81

  var DAY = 86400000;

  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }

  function Scheduler(opts) {
    opts = opts || {};
    this.w = opts.w || DEFAULT_W.slice();
    this.requestRetention = opts.requestRetention || 0.9;
    this.maximumInterval = opts.maximumInterval || 3650;
    this.enableFuzz = opts.enableFuzz !== false;
    // kroki nauki w minutach dla kart nowych / przeuczanych
    this.learningSteps = opts.learningSteps || [1, 10];
    this.relearningSteps = opts.relearningSteps || [10];
  }

  /* --- retrievability i interwał --- */

  Scheduler.prototype.retrievability = function (elapsedDays, stability) {
    if (stability <= 0) return 0;
    return Math.pow(1 + FACTOR * elapsedDays / stability, DECAY);
  };

  Scheduler.prototype.intervalFromStability = function (stability) {
    var i = (stability / FACTOR) * (Math.pow(this.requestRetention, 1 / DECAY) - 1);
    return clamp(Math.round(i), 1, this.maximumInterval);
  };

  /* --- inicjalizacja --- */

  Scheduler.prototype.initStability = function (grade) {
    return Math.max(this.w[grade - 1], 0.1);
  };

  Scheduler.prototype.initDifficulty = function (grade) {
    return clamp(this.w[4] - Math.exp(this.w[5] * (grade - 1)) + 1, 1, 10);
  };

  /* --- aktualizacja difficulty --- */

  Scheduler.prototype.nextDifficulty = function (d, grade) {
    var delta = -this.w[6] * (grade - 3);
    var dPrime = d + delta * ((10 - d) / 9);            // liniowe tłumienie
    var target = this.initDifficulty(4);
    var dNew = this.w[7] * target + (1 - this.w[7]) * dPrime; // powrót do średniej
    return clamp(dNew, 1, 10);
  };

  /* --- aktualizacja stability --- */

  Scheduler.prototype.stabilityAfterRecall = function (d, s, r, grade) {
    var hardPenalty = grade === 2 ? this.w[15] : 1;
    var easyBonus = grade === 4 ? this.w[16] : 1;
    var inc = Math.exp(this.w[8]) *
      (11 - d) *
      Math.pow(s, -this.w[9]) *
      (Math.exp(this.w[10] * (1 - r)) - 1) *
      hardPenalty * easyBonus;
    return Math.max(s * (1 + inc), 0.01);
  };

  Scheduler.prototype.stabilityAfterForget = function (d, s, r) {
    var sf = this.w[11] *
      Math.pow(d, -this.w[12]) *
      (Math.pow(s + 1, this.w[13]) - 1) *
      Math.exp(this.w[14] * (1 - r));
    return Math.max(Math.min(sf, s), 0.01); // FSRS-5: nie może wzrosnąć po wpadce
  };

  Scheduler.prototype.stabilityShortTerm = function (s, grade) {
    return Math.max(s * Math.exp(this.w[17] * (grade - 3 + this.w[18])), 0.01);
  };

  /* --- rozrzut, żeby powtórki nie kumulowały się w jeden dzień --- */

  var FUZZ_RANGES = [
    { start: 2.5, end: 7.0, factor: 0.15 },
    { start: 7.0, end: 20.0, factor: 0.1 },
    { start: 20.0, end: Infinity, factor: 0.05 }
  ];

  Scheduler.prototype.applyFuzz = function (interval) {
    if (!this.enableFuzz || interval < 2.5) return interval;
    var delta = 1.0;
    for (var i = 0; i < FUZZ_RANGES.length; i++) {
      var r = FUZZ_RANGES[i];
      delta += r.factor * Math.max(Math.min(interval, r.end) - r.start, 0.0);
    }
    var min = Math.max(2, Math.round(interval - delta));
    var max = Math.min(Math.round(interval + delta), this.maximumInterval);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  /* --- publiczne API --- */

  Scheduler.prototype.newCard = function () {
    return { s: 0, d: 0, st: 0, rep: 0, lap: 0, step: 0, due: 0, last: 0, u: 0 };
  };

  /**
   * Zwraca podgląd czterech możliwych wyników bez zapisywania.
   * → { 1: {card, intervalText}, 2: {...}, 3: {...}, 4: {...} }
   */
  Scheduler.prototype.preview = function (card, now) {
    now = now || Date.now();
    var out = {};
    for (var g = 1; g <= 4; g++) {
      out[g] = this.review(card, g, now);
    }
    return out;
  };

  /**
   * Główna funkcja. Nie mutuje wejścia — zwraca nowy stan karty.
   */
  Scheduler.prototype.review = function (card, grade, now) {
    now = now || Date.now();
    var c = {
      s: card.s || 0, d: card.d || 0, st: card.st || 0,
      rep: card.rep || 0, lap: card.lap || 0, step: card.step || 0,
      due: card.due || 0, last: card.last || 0, u: card.u || 0
    };

    var elapsedDays = c.last ? Math.max((now - c.last) / DAY, 0) : 0;
    var next = { rep: c.rep + 1, lap: c.lap, last: now, u: now };

    if (c.st === 0) {
      /* --- karta nowa --- */
      next.d = this.initDifficulty(grade);
      next.s = this.initStability(grade);

      if (grade === 1) {
        next.st = 1; next.step = 0;
        next.due = now + this.learningSteps[0] * 60000;
      } else if (grade === 2) {
        next.st = 1; next.step = 0;
        var m = this.learningSteps.length > 1
          ? (this.learningSteps[0] + this.learningSteps[1]) / 2
          : this.learningSteps[0] * 1.5;
        next.due = now + m * 60000;
      } else if (grade === 3) {
        next.st = 1; next.step = 1;
        if (this.learningSteps.length > 1) {
          next.due = now + this.learningSteps[1] * 60000;
        } else {
          next.st = 2;
          next.due = this.dueFromInterval(now, this.applyFuzz(this.intervalFromStability(next.s)));
        }
      } else {
        next.st = 2;
        next.due = this.dueFromInterval(now, this.applyFuzz(this.intervalFromStability(next.s)));
      }
    } else if (c.st === 1 || c.st === 3) {
      /* --- karta w nauce / przeuczaniu --- */
      var steps = c.st === 1 ? this.learningSteps : this.relearningSteps;
      next.d = this.nextDifficulty(c.d, grade);
      next.s = elapsedDays < 1
        ? this.stabilityShortTerm(c.s, grade)
        : this.stabilityAfterRecall(c.d, c.s, this.retrievability(elapsedDays, c.s), grade);

      if (grade === 1) {
        next.st = c.st; next.step = 0;
        next.due = now + steps[0] * 60000;
      } else if (grade === 2) {
        next.st = c.st; next.step = c.step;
        next.due = now + steps[Math.min(c.step, steps.length - 1)] * 60000;
      } else if (grade === 3) {
        if (c.step + 1 >= steps.length) {
          next.st = 2; next.step = 0;
          next.due = this.dueFromInterval(now, this.applyFuzz(this.intervalFromStability(next.s)));
        } else {
          next.st = c.st; next.step = c.step + 1;
          next.due = now + steps[next.step] * 60000;
        }
      } else {
        next.st = 2; next.step = 0;
        next.due = this.dueFromInterval(now, this.applyFuzz(this.intervalFromStability(next.s)));
      }
    } else {
      /* --- karta w powtórkach --- */
      var r = this.retrievability(elapsedDays, c.s);
      next.d = this.nextDifficulty(c.d, grade);

      if (grade === 1) {
        next.lap = c.lap + 1;
        next.s = this.stabilityAfterForget(c.d, c.s, r);
        if (this.relearningSteps.length) {
          next.st = 3; next.step = 0;
          next.due = now + this.relearningSteps[0] * 60000;
        } else {
          next.st = 2;
          next.due = this.dueFromInterval(now, this.applyFuzz(this.intervalFromStability(next.s)));
        }
      } else {
        next.s = this.stabilityAfterRecall(c.d, c.s, r, grade);
        next.st = 2; next.step = 0;
        next.due = this.dueFromInterval(now, this.applyFuzz(this.intervalFromStability(next.s)));
      }
    }

    return next;
  };

  /**
   * Interwały dzienne są przypinane do początku dnia lokalnego,
   * żeby karta "za 1 dzień" oceniona o 22:00 była dostępna następnego dnia rano.
   */
  Scheduler.prototype.dueFromInterval = function (now, days) {
    var d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime() + days * DAY;
  };

  /* --- formatowanie --- */

  Scheduler.prototype.formatDue = function (dueTs, now) {
    now = now || Date.now();
    var ms = dueTs - now;
    if (ms <= 0) return 'teraz';
    var min = ms / 60000;
    if (min < 60) return Math.max(1, Math.round(min)) + ' min';
    var h = min / 60;
    if (h < 24) return Math.round(h) + ' godz.';
    var d = Math.round(h / 24);
    if (d < 31) return d + ' dn.';
    var mo = d / 30.4;
    if (mo < 12) return (mo < 2 ? mo.toFixed(1) : Math.round(mo)) + ' mies.';
    return (d / 365).toFixed(1) + ' lat';
  };

  global.FSRS = {
    Scheduler: Scheduler,
    DEFAULT_W: DEFAULT_W,
    DAY: DAY,
    STATE: { NEW: 0, LEARNING: 1, REVIEW: 2, RELEARNING: 3 },
    GRADE: { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 }
  };
})(typeof window !== 'undefined' ? window : globalThis);
