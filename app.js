/* app.js — silnik aplikacji fiszek.
 * Wspólny dla obu wersji. Różnice siedzą wyłącznie w config.js i cards.js.
 * Zależności: fsrs.js, config.js, cards.js, progress.js, reviews.js
 */
(function () {
  'use strict';

  var CFG = window.APP_CONFIG;
  var DAY = 86400000;

  /* =========================================================
     Stan
     ========================================================= */

  var S = {
    cards: [],          // definicje fiszek (z cards.js + dodane lokalnie)
    prog: {},           // id -> stan FSRS
    log: [],            // [id, ts, grade, elapsedDays]
    sched: null,
    queue: [],          // id-ki w kolejce sesji
    current: null,
    revealed: false,
    typedResult: null,  // 'ok' | 'near' | 'bad' | null
    view: 'learn',
    mode: 'day',        // day | dusk | night
    settings: {},
    dirtyProgress: false,
    dirtyCards: false,
    sessionDone: 0,
    sessionRight: 0,
    startedAt: Date.now(),
    dayKey: null
  };

  var DEFAULT_SETTINGS = {
    newPerDay: 15,
    maxReviews: 200,
    requestRetention: 0.9,
    maximumInterval: 365,
    typing: true,
    tts: true,
    ghUser: '',
    ghRepo: '',
    ghBranch: 'main',
    ghToken: '',
    autoSync: true
  };

  /* =========================================================
     Narzędzia
     ========================================================= */

  var $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function todayKey(ts) {
    var d = new Date(ts || Date.now());
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function startOfToday() {
    var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
  }

  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('on'); }, 2600);
  }

  function buzz(ms) {
    if (S.mode !== 'night' && navigator.vibrate) { try { navigator.vibrate(ms || 8); } catch (e) {} }
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* =========================================================
     Trwałość
     ========================================================= */

  function loadSettings() {
    var raw = {};
    try { raw = JSON.parse(localStorage.getItem(CFG.ns + '_settings')) || {}; } catch (e) {}
    S.settings = Object.assign({}, DEFAULT_SETTINGS, CFG.defaults || {}, raw);
  }

  function saveSettings() {
    localStorage.setItem(CFG.ns + '_settings', JSON.stringify(S.settings));
  }

  function loadLocal() {
    // Karty: plik z repo + karty dodane lokalnie, jeszcze niezsynchronizowane
    var base = (window.CARDS && Array.isArray(window.CARDS)) ? window.CARDS.slice() : [];
    var extra = [];
    try { extra = JSON.parse(localStorage.getItem(CFG.ns + '_cards_pending')) || []; } catch (e) {}
    var seen = {};
    S.cards = [];
    base.concat(extra).forEach(function (c) {
      if (!c || !c.id || seen[c.id]) return;
      seen[c.id] = 1;
      S.cards.push(c);
    });

    // Postęp: plik z repo, potem scalenie z localStorage po znaczniku `u`
    var fileProg = (window.PROGRESS && window.PROGRESS.cards) || {};
    var localProg = {};
    try { localProg = JSON.parse(localStorage.getItem(CFG.ns + '_progress')) || {}; } catch (e) {}
    S.prog = mergeProgress(fileProg, localProg);

    var fileLog = (window.REVIEWS && Array.isArray(window.REVIEWS)) ? window.REVIEWS : [];
    var localLog = [];
    try { localLog = JSON.parse(localStorage.getItem(CFG.ns + '_reviews')) || []; } catch (e) {}
    S.log = mergeLog(fileLog, localLog);

    S.dirtyCards = extra.length > 0;
  }

  /* Scalenie per-karta: wygrywa nowszy znacznik `u`. Nie ma "last write wins"
     na całym pliku, więc dwa urządzenia nie kasują sobie postępu. */
  function mergeProgress(a, b) {
    var out = {};
    Object.keys(a || {}).forEach(function (k) { out[k] = a[k]; });
    Object.keys(b || {}).forEach(function (k) {
      var mine = b[k], theirs = out[k];
      if (!theirs || (mine.u || 0) >= (theirs.u || 0)) out[k] = mine;
    });
    return out;
  }

  function mergeLog(a, b) {
    var seen = {}, out = [];
    (a || []).concat(b || []).forEach(function (e) {
      if (!e || e.length < 3) return;
      var k = e[0] + '|' + e[1];
      if (seen[k]) return;
      seen[k] = 1; out.push(e);
    });
    out.sort(function (x, y) { return x[1] - y[1]; });
    return out;
  }

  function saveLocal() {
    localStorage.setItem(CFG.ns + '_progress', JSON.stringify(S.prog));
    localStorage.setItem(CFG.ns + '_reviews', JSON.stringify(S.log));
  }

  function savePendingCards() {
    var baseIds = {};
    (window.CARDS || []).forEach(function (c) { baseIds[c.id] = 1; });
    var pending = S.cards.filter(function (c) { return !baseIds[c.id]; });
    localStorage.setItem(CFG.ns + '_cards_pending', JSON.stringify(pending));
  }

  /* =========================================================
     Kolejka sesji
     ========================================================= */

  function stateOf(id) {
    return S.prog[id] || S.sched.newCard();
  }

  function newTodayCount() {
    var key = CFG.ns + '_new_' + todayKey();
    return parseInt(localStorage.getItem(key) || '0', 10);
  }

  function bumpNewToday() {
    var key = CFG.ns + '_new_' + todayKey();
    localStorage.setItem(key, String(newTodayCount() + 1));
  }

  function buckets() {
    var now = Date.now();
    var b = { due: [], learn: [], fresh: [], later: [] };
    S.cards.forEach(function (c) {
      if (c.suspended) return;
      var st = S.prog[c.id];
      if (!st || st.st === 0) { b.fresh.push(c.id); return; }
      if (st.due <= now) {
        if (st.st === 1 || st.st === 3) b.learn.push(c.id); else b.due.push(c.id);
      } else {
        b.later.push(c.id);
      }
    });
    return b;
  }

  function buildQueue() {
    var b = buckets();
    var q = [];

    // Powtórki: najpierw te, które czekają najdłużej, ale w losowej kolejności
    // wewnątrz porcji — żeby nie uczyć się sekwencji zamiast treści.
    // Najpierw te zaległe najdłużej, dopiero potem losowanie wewnątrz porcji.
    var reviews = b.due.slice().sort(function (x, y) {
      return S.prog[x].due - S.prog[y].due;
    }).slice(0, S.settings.maxReviews);
    shuffle(reviews);

    // Nowe: tylko do dziennego limitu
    var slots = Math.max(0, S.settings.newPerDay - newTodayCount());
    var fresh = shuffle(b.fresh.slice()).slice(0, slots);

    // Przeplot: nowe wpuszczane co ~4 powtórki, żeby sesja nie była monotonna
    var ri = 0, fi = 0;
    while (ri < reviews.length || fi < fresh.length) {
      for (var k = 0; k < 4 && ri < reviews.length; k++) q.push(reviews[ri++]);
      if (fi < fresh.length) q.push(fresh[fi++]);
    }

    S.queue = q;
  }

  /* Karty w krokach nauki (minutowe) mają pierwszeństwo, gdy ich czas nadszedł. */
  function pickNext() {
    var now = Date.now();
    var b = buckets();

    var ready = b.learn.filter(function (id) { return S.prog[id].due <= now; });
    if (ready.length) {
      ready.sort(function (x, y) { return S.prog[x].due - S.prog[y].due; });
      return ready[0];
    }

    while (S.queue.length) {
      var id = S.queue.shift();
      var st = S.prog[id];
      if (!st || st.st === 0 || st.due <= now) return id;
    }

    if (b.learn.length) {
      b.learn.sort(function (x, y) { return S.prog[x].due - S.prog[y].due; });
      return b.learn[0];
    }
    return null;
  }

  function cardById(id) {
    for (var i = 0; i < S.cards.length; i++) if (S.cards[i].id === id) return S.cards[i];
    return null;
  }

  /* =========================================================
     Sprawdzanie wpisanej odpowiedzi
     ========================================================= */

  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[’']/g, "'")
      .replace(/[.,!?;:"„”«»()\[\]]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    var m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    var prev = new Array(n + 1), cur = new Array(n + 1), i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      var t = prev; prev = cur; cur = t;
    }
    return prev[n];
  }

  function checkAnswer(card, typed) {
    var t = normalize(typed);
    if (!t) return 'bad';
    var candidates = [CFG.answerOf(card)].concat(card.accept || []);
    var best = 99;
    for (var i = 0; i < candidates.length; i++) {
      var c = normalize(candidates[i]);
      if (!c) continue;
      if (c === t) return 'ok';
      var d = levenshtein(t, c);
      if (d < best) best = d;
    }
    // Tolerancja na literówkę rośnie z długością, ale nigdy nie przepuszcza innego słowa.
    var target = normalize(CFG.answerOf(card));
    var allowed = target.length >= 12 ? 2 : (target.length >= 5 ? 1 : 0);
    if (best <= allowed) return 'near';
    return 'bad';
  }

  /* =========================================================
     Renderowanie widoku nauki
     ========================================================= */

  function render() {
    if (S.view !== 'learn') return;

    updateSessionBar();

    var area = $('card-area');
    var controls = $('controls');

    if (!S.current) {
      var b = buckets();
      var nextDue = null;
      b.later.forEach(function (id) {
        var d = S.prog[id].due;
        if (nextDue === null || d < nextDue) nextDue = d;
      });
      var remainingNew = Math.max(0, S.settings.newPerDay - newTodayCount());
      var freshLeft = b.fresh.length;

      var msg;
      if (S.cards.length === 0) {
        msg = 'Talia jest pusta. Dodaj pierwsze hasła w zakładce Dodaj albo wgraj plik <code>cards.js</code> do repozytorium.';
      } else if (freshLeft > 0 && remainingNew === 0) {
        msg = 'Dzienny limit nowych kart wyczerpany. Zostało ' + freshLeft + ' nieruszonych haseł — wrócą jutro. Limit zmienisz w Ustawieniach.';
      } else if (nextDue) {
        msg = 'Następna powtórka za ' + S.sched.formatDue(nextDue) + '.';
      } else {
        msg = 'Wszystko przerobione.';
      }

      area.innerHTML = '<div class="empty"><div class="mark">✓</div><h3>Na dziś koniec</h3><p>' +
        msg + '</p>' +
        (S.sessionDone ? '<p style="margin-top:14px">W tej sesji: <b>' + S.sessionDone + '</b> kart, trafionych <b>' +
          Math.round(S.sessionRight / S.sessionDone * 100) + '%</b>.</p>' : '') +
        '</div>';
      controls.innerHTML = '';
      return;
    }

    var card = cardById(S.current);
    if (!card) { S.current = pickNext(); render(); return; }

    var front = CFG.renderFront(card);
    var typingOn = S.settings.typing && S.mode !== 'night' && front.typable !== false;

    var html = '<div class="card">';
    if (front.badge) html += '<div class="type-badge">' + esc(front.badge) + '</div>';
    html += '<div class="prompt-main' + (front.long ? ' sentence' : '') + '">' + front.main + '</div>';
    if (front.sub) html += '<div class="prompt-sub">' + front.sub + '</div>';
    if (front.keyword) html += '<div class="keyword">' + esc(front.keyword) + '</div>';
    html += '</div>';

    if (!S.revealed && typingOn) {
      html += '<div class="answer-row">' +
        '<input id="typed" type="text" inputmode="text" autocomplete="off" autocorrect="off" ' +
        'autocapitalize="off" spellcheck="false" placeholder="Wpisz odpowiedź" />' +
        '<button id="btn-check">Sprawdź</button></div>';
    }

    if (S.revealed) html += renderBack(card);

    area.innerHTML = html;
    area.scrollTop = 0;

    if (!S.revealed) {
      controls.innerHTML = '<button class="big-action" id="btn-reveal">Pokaż odpowiedź</button>';
      $('btn-reveal').onclick = reveal;
      if (typingOn) {
        var inp = $('typed');
        $('btn-check').onclick = reveal;
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); reveal(); }
        });
      }
    } else {
      renderGrades();
      bindSpeakers();
    }
  }

  function renderBack(card) {
    var back = CFG.renderBack(card);
    var wrong = S.typedResult === 'bad';
    var h = '<div id="reveal">';
    h += '<div class="answer-headline' + (wrong ? ' was-wrong' : '') + '">';
    h += '<div class="a-main">' + esc(back.answer) + '</div>';
    if (back.ipa) h += '<div class="a-ipa">' + esc(back.ipa) + '</div>';
    if (back.gloss) h += '<div class="a-pl">' + esc(back.gloss) + '</div>';
    h += '</div>';

    if (S.typedResult === 'near') {
      h += '<div class="block"><h4>Prawie</h4><p>Literówka. Zaliczam jako trafione, ale przyjrzyj się pisowni.</p></div>';
    }

    (back.blocks || []).forEach(function (b) {
      if (!b || !b.items || !b.items.length) return;
      h += '<div class="block"><h4>' + esc(b.title) + '</h4>';
      if (b.items.length > 1) {
        h += '<ul>' + b.items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
      } else {
        h += '<p' + (b.italic ? ' class="example"' : '') + '>' + esc(b.items[0]) + '</p>';
      }
      h += '</div>';
    });

    if (S.settings.tts && S.mode !== 'night' && back.speak && 'speechSynthesis' in window) {
      h += '<button class="speak" data-say="' + esc(back.speak) + '" data-lang="' + esc(back.speakLang || CFG.ttsLang) + '">▸ Posłuchaj</button>';
    }

    h += '</div>';
    return h;
  }

  function renderGrades() {
    var st = stateOf(S.current);
    var pv = S.sched.preview(st);
    var labels = { 1: 'Znowu', 2: 'Trudne', 3: 'Dobre', 4: 'Łatwe' };
    var h = '<div class="grades">';
    for (var g = 1; g <= 4; g++) {
      h += '<button data-g="' + g + '"><span class="g-label">' + labels[g] + '</span>' +
        '<span class="g-when">' + S.sched.formatDue(pv[g].due) + '</span></button>';
    }
    h += '</div>';
    $('controls').innerHTML = h;
    Array.prototype.forEach.call($('controls').querySelectorAll('button'), function (btn) {
      btn.onclick = function () { grade(parseInt(btn.dataset.g, 10)); };
    });
  }

  function bindSpeakers() {
    Array.prototype.forEach.call(document.querySelectorAll('.speak'), function (b) {
      b.onclick = function () { speak(b.dataset.say, b.dataset.lang); };
    });
  }

  function updateSessionBar() {
    var b = buckets();
    var remainingNew = Math.min(b.fresh.length, Math.max(0, S.settings.newPerDay - newTodayCount()));
    $('pill-due').innerHTML = 'do powtórki <b>' + (b.due.length + b.learn.length) + '</b>';
    $('pill-new').innerHTML = 'nowe <b>' + remainingNew + '</b>';
    $('pill-done').innerHTML = 'sesja <b>' + S.sessionDone + '</b>';
    var total = S.sessionDone + b.due.length + b.learn.length + remainingNew;
    $('track-fill').style.width = total ? Math.round(S.sessionDone / total * 100) + '%' : '0%';
  }

  /* =========================================================
     Akcje
     ========================================================= */

  function reveal() {
    if (S.revealed) return;
    var inp = $('typed');
    if (inp && inp.value.trim()) {
      S.typedResult = checkAnswer(cardById(S.current), inp.value);
    } else {
      S.typedResult = null;
    }
    S.revealed = true;
    buzz(6);
    render();
  }

  function grade(g) {
    if (!S.current) return;
    // Wpisana błędna odpowiedź nie może zostać oceniona jako pamiętana.
    if (S.typedResult === 'bad' && g > 1) g = 1;

    var id = S.current;
    var before = stateOf(id);
    var elapsed = before.last ? (Date.now() - before.last) / DAY : 0;
    var after = S.sched.review(before, g);

    S.prog[id] = after;
    S.log.push([id, Date.now(), g, Math.round(elapsed * 100) / 100]);
    if (before.st === 0) bumpNewToday();

    S.sessionDone++;
    if (g >= 3) S.sessionRight++;
    S.dirtyProgress = true;
    saveLocal();
    buzz(g === 1 ? 16 : 8);

    S.revealed = false;
    S.typedResult = null;
    S.current = pickNext();
    render();

    if (S.settings.autoSync && S.sessionDone % 20 === 0) push(true);
  }

  function speak(text, lang) {
    if (!text || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = lang || CFG.ttsLang;
      u.rate = 0.92;
      var voices = speechSynthesis.getVoices() || [];
      var pref = voices.filter(function (v) {
        return v.lang.toLowerCase().replace('_', '-').indexOf(lang.slice(0, 2).toLowerCase()) === 0;
      });
      var good = pref.find(function (v) { return /google|enhanced|premium|natural|siri/i.test(v.name); });
      if (good || pref[0]) u.voice = good || pref[0];
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  /* =========================================================
     Tryb wyświetlania
     ========================================================= */

  function setMode(m) {
    S.mode = m;
    document.documentElement.className = m === 'day' ? '' : m;
    $('dimmer').style.opacity = m === 'night' ? '0.25' : '0';
    localStorage.setItem(CFG.ns + '_mode', m);
    Array.prototype.forEach.call(document.querySelectorAll('.mode-switch button'), function (b) {
      b.setAttribute('aria-pressed', b.dataset.mode === m ? 'true' : 'false');
    });
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = m === 'night' ? '#05050a' : (m === 'dusk' ? '#0a0a0d' : '#0b0e14');
    if (S.view === 'learn') render();
  }

  /* =========================================================
     Widoki poboczne
     ========================================================= */

  function switchView(v) {
    S.view = v;
    ['learn', 'browse', 'add', 'more'].forEach(function (k) {
      $('view-' + k).classList.toggle('hidden', k !== v);
      $('nav-' + k).setAttribute('aria-current', k === v ? 'page' : 'false');
    });
    if (v === 'learn') { if (!S.current) { buildQueue(); S.current = pickNext(); } render(); }
    if (v === 'browse') renderBrowse();
    if (v === 'add') renderAdd();
    if (v === 'more') renderMore();
  }

  function renderBrowse() {
    var q = normalize($('search').value);
    var list = S.cards.filter(function (c) {
      if (!q) return true;
      return normalize(CFG.searchText(c)).indexOf(q) !== -1;
    });
    var out = '<div class="session-bar" style="padding-top:0"><span class="pill">wszystkich <b>' +
      S.cards.length + '</b></span><span class="pill">pokazuję <b>' + list.length + '</b></span></div>';

    out += list.slice(0, 400).map(function (c) {
      var st = S.prog[c.id];
      var tag = !st || st.st === 0 ? 'nowa'
        : (st.st === 2 ? S.sched.formatDue(st.due) : 'w nauce');
      var row = CFG.browseRow(c);
      return '<div class="row"><div class="r-top"><div class="r-main">' + esc(row.main) +
        '</div><div class="r-tag">' + esc(tag) + '</div></div>' +
        (row.sub ? '<div class="r-sub">' + esc(row.sub) + '</div>' : '') + '</div>';
    }).join('');

    if (list.length > 400) out += '<p style="color:var(--faint);font-size:13px;padding:8px 0">Pokazuję pierwsze 400. Zawęź wyszukiwanie.</p>';
    if (!list.length) out += '<div class="empty"><p>Nic nie pasuje.</p></div>';
    $('browse-list').innerHTML = out;
  }

  function renderAdd() {
    $('add-form').innerHTML = CFG.addFormHtml();
    var btn = $('btn-add-save');
    if (btn) btn.onclick = function () {
      var res = CFG.addFormRead();
      if (!res) return;
      var list = Array.isArray(res) ? res : [res];
      list.forEach(function (card) {
        card.id = nextId();
        S.cards.push(card);
      });
      S.dirtyCards = true;
      savePendingCards();
      buildQueue();
      toast(list.length > 1
        ? 'Dodano ' + list.length + ' karty'
        : 'Dodano: ' + (CFG.browseRow(list[0]).main || list[0].id));
      renderAdd();
      if (S.settings.autoSync) pushCards(true);
    };

    var bulk = $('btn-bulk');
    if (bulk && CFG.bulkParse) bulk.onclick = function () {
      var txt = $('f-bulk').value;
      if (!txt.trim()) { toast('Wklej najpierw linie'); return; }
      var parsed = CFG.bulkParse(txt);
      var lineCount = txt.split('\n').filter(function (l) { return l.trim(); }).length;
      if (!parsed.length) { toast('Nie rozpoznałem żadnej linii — sprawdź format'); return; }
      parsed.forEach(function (c) { c.id = nextId(); S.cards.push(c); });
      S.dirtyCards = true;
      savePendingCards();
      buildQueue();
      toast('Dodano ' + parsed.length + ' z ' + lineCount + ' linii');
      renderAdd();
      if (S.settings.autoSync) pushCards(true);
    };
  }

  function nextId() {
    var max = 0;
    S.cards.forEach(function (c) {
      var m = /(\d+)$/.exec(c.id || '');
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return CFG.idPrefix + String(max + 1).padStart(4, '0');
  }

  function renderMore() {
    var st = S.settings;
    var b = buckets();
    var now = Date.now();

    // Retencja z ostatnich 30 dni: udział ocen >= 3 wśród powtórek kart dojrzałych
    var since = now - 30 * DAY;
    var recent = S.log.filter(function (e) { return e[1] >= since && e[3] >= 1; });
    var right = recent.filter(function (e) { return e[2] >= 3; }).length;
    var retention = recent.length ? Math.round(right / recent.length * 100) : null;

    var todayLog = S.log.filter(function (e) { return e[1] >= startOfToday(); });

    // Prognoza obciążenia na 14 dni
    var fc = new Array(14).fill(0);
    S.cards.forEach(function (c) {
      var p = S.prog[c.id];
      if (!p || p.st === 0) return;
      var d = Math.floor((p.due - startOfToday()) / DAY);
      if (d >= 0 && d < 14) fc[d]++; else if (d < 0) fc[0]++;
    });
    var peak = Math.max.apply(null, fc.concat([1]));

    var leeches = S.cards.filter(function (c) {
      var p = S.prog[c.id]; return p && p.lap >= 5;
    }).sort(function (a, b2) { return S.prog[b2.id].lap - S.prog[a.id].lap; });

    var h = '';

    h += '<div class="section"><h2>Dziś</h2><div class="stat-grid">' +
      '<div class="stat"><div class="n">' + todayLog.length + '</div><div class="l">powtórek</div></div>' +
      '<div class="stat"><div class="n">' + (b.due.length + b.learn.length) + '</div><div class="l">zaległych</div></div>' +
      '<div class="stat"><div class="n">' + (retention === null ? '—' : retention + '%') + '</div><div class="l">retencja 30d</div></div>' +
      '</div></div>';

    h += '<div class="section"><h2>Talia</h2><div class="stat-grid">' +
      '<div class="stat"><div class="n">' + b.fresh.length + '</div><div class="l">nowe</div></div>' +
      '<div class="stat"><div class="n">' + S.cards.filter(function (c) { var p = S.prog[c.id]; return p && (p.st === 1 || p.st === 3); }).length + '</div><div class="l">w nauce</div></div>' +
      '<div class="stat"><div class="n">' + S.cards.filter(function (c) { var p = S.prog[c.id]; return p && p.st === 2; }).length + '</div><div class="l">w powtórkach</div></div>' +
      '</div></div>';

    h += '<div class="section"><h2>Obciążenie — najbliższe 14 dni</h2><div class="forecast">' +
      fc.map(function (n, i) {
        return '<div class="bar"><i style="height:' + Math.round(n / peak * 100) + '%"></i><span>' + (i === 0 ? 'dziś' : i) + '</span></div>';
      }).join('') + '</div>' +
      '<p style="font-size:12px;color:var(--faint);margin-top:8px">Szczyt: ' + peak + ' kart. Jeśli słupki rosną lawinowo, zejdź z dziennego limitu nowych kart.</p></div>';

    if (leeches.length) {
      h += '<div class="section"><h2>Uparte — ' + leeches.length + '</h2>' +
        leeches.slice(0, 12).map(function (c) {
          var r = CFG.browseRow(c);
          return '<div class="row"><div class="r-top"><div class="r-main">' + esc(r.main) +
            '</div><div class="r-tag">' + S.prog[c.id].lap + ' wpadek</div></div></div>';
        }).join('') +
        '<p style="font-size:12px;color:var(--faint);margin-top:6px">Te hasła zjadają czas. Przepisz je: dodaj mocniejszy kontekst albo rozbij na prostsze karty.</p></div>';
    }

    h += '<div class="section"><h2>Nauka</h2>' +
      '<div class="field"><label>Nowe karty dziennie</label><input id="set-new" type="number" min="0" max="200" value="' + st.newPerDay + '">' +
      '<div class="help">Główny hamulec. Przy 15 nowych dziennie ustabilizujesz się na ok. 90–130 powtórkach dziennie.</div></div>' +
      '<div class="field"><label>Limit powtórek na sesję</label><input id="set-max" type="number" min="10" max="999" value="' + st.maxReviews + '"></div>' +
      '<div class="field"><label>Docelowa retencja</label><select id="set-rr">' +
      [0.85, 0.87, 0.9, 0.92, 0.95].map(function (v) {
        return '<option value="' + v + '"' + (Math.abs(v - st.requestRetention) < 0.001 ? ' selected' : '') + '>' + Math.round(v * 100) + '%</option>';
      }).join('') + '</select>' +
      '<div class="help">Wyżej = częstsze powtórki i więcej pracy. 90% to rozsądny punkt wyjścia; podnieś na miesiąc przed egzaminem.</div></div>' +
      '<div class="field"><label>Maksymalny interwał (dni)</label><input id="set-maxiv" type="number" min="30" max="3650" value="' + st.maximumInterval + '">' +
      '<div class="help">Przy nauce pod termin trzymaj 180–365, żeby nic nie wypadło poza horyzont egzaminu.</div></div>' +
      '<div class="field"><label>Wpisywanie odpowiedzi</label><select id="set-typing">' +
      '<option value="1"' + (st.typing ? ' selected' : '') + '>Włączone — produkcja</option>' +
      '<option value="0"' + (!st.typing ? ' selected' : '') + '>Wyłączone — samo rozpoznawanie</option></select>' +
      '<div class="help">W trybie nocnym wpisywanie jest wyłączane automatycznie.</div></div>' +
      '<button class="btn primary" id="btn-save-learn">Zapisz ustawienia nauki</button></div>';

    h += '<div class="section"><h2>Synchronizacja z GitHubem</h2>' +
      '<div class="field"><label>Nazwa użytkownika</label><input id="set-user" value="' + esc(st.ghUser) + '" autocapitalize="off"></div>' +
      '<div class="field"><label>Repozytorium</label><input id="set-repo" value="' + esc(st.ghRepo) + '" autocapitalize="off"></div>' +
      '<div class="field"><label>Gałąź</label><input id="set-branch" value="' + esc(st.ghBranch) + '" autocapitalize="off"></div>' +
      '<div class="field"><label>Token dostępu</label><input id="set-token" type="password" value="' + esc(st.ghToken) + '" autocapitalize="off">' +
      '<div class="help">Użyj tokenu fine-grained ograniczonego do tego jednego repozytorium, z uprawnieniem Contents: Read and write. Token leży w pamięci przeglądarki — nie wklejaj tu tokenu klasycznego z szerokim dostępem.</div></div>' +
      '<div class="btn-row"><button class="btn" id="btn-save-gh">Zapisz dane</button>' +
      '<button class="btn" id="btn-pull">Pobierz</button>' +
      '<button class="btn primary" id="btn-push">Wyślij</button></div>' +
      '<p style="font-size:12px;color:var(--faint);margin-top:8px">' +
      (S.dirtyProgress || S.dirtyCards ? 'Są niewysłane zmiany.' : 'Wszystko wysłane.') + '</p></div>';

    h += '<div class="section"><h2>Kopia i czyszczenie</h2>' +
      '<div class="btn-row"><button class="btn" id="btn-export">Pobierz kopię</button>' +
      '<button class="btn danger" id="btn-reset">Wyzeruj postęp</button></div></div>';

    $('more-body').innerHTML = h;

    $('btn-save-learn').onclick = function () {
      st.newPerDay = Math.max(0, parseInt($('set-new').value, 10) || 0);
      st.maxReviews = Math.max(10, parseInt($('set-max').value, 10) || 200);
      st.requestRetention = parseFloat($('set-rr').value);
      st.maximumInterval = Math.max(30, parseInt($('set-maxiv').value, 10) || 365);
      st.typing = $('set-typing').value === '1';
      saveSettings();
      initScheduler();
      buildQueue();
      toast('Zapisano');
      renderMore();
    };

    $('btn-save-gh').onclick = function () {
      st.ghUser = $('set-user').value.trim();
      st.ghRepo = $('set-repo').value.trim();
      st.ghBranch = $('set-branch').value.trim() || 'main';
      st.ghToken = $('set-token').value.trim();
      saveSettings();
      toast('Zapisano dane połączenia');
    };

    $('btn-pull').onclick = function () { pull(); };
    $('btn-push').onclick = function () { push(); pushCards(); };

    $('btn-export').onclick = function () {
      var blob = new Blob([JSON.stringify({ cards: S.cards, progress: S.prog, reviews: S.log }, null, 1)],
        { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = CFG.ns + '-kopia-' + todayKey() + '.json';
      a.click();
    };

    $('btn-reset').onclick = function () {
      if (!confirm('Wyzerować cały postęp nauki? Fiszki zostaną, historia powtórek zniknie.')) return;
      S.prog = {}; S.log = [];
      saveLocal();
      S.dirtyProgress = true;
      buildQueue(); S.current = pickNext();
      toast('Postęp wyzerowany');
      renderMore();
    };
  }

  /* =========================================================
     Synchronizacja z GitHubem
     ========================================================= */

  function ghReady() {
    var s = S.settings;
    return s.ghUser && s.ghRepo && s.ghToken;
  }

  function ghHeaders() {
    return {
      'Authorization': 'Bearer ' + S.settings.ghToken,
      'Accept': 'application/vnd.github+json'
    };
  }

  function ghUrl(path) {
    var s = S.settings;
    return 'https://api.github.com/repos/' + s.ghUser + '/' + s.ghRepo + '/contents/' + path;
  }

  function b64encode(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin);
  }

  function b64decode(b64) {
    var bin = atob(b64.replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function ghGet(path) {
    return fetch(ghUrl(path) + '?ref=' + S.settings.ghBranch + '&t=' + Date.now(),
      { headers: ghHeaders(), cache: 'no-store' })
      .then(function (r) {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error('GitHub ' + r.status);
        return r.json();
      });
  }

  function ghPut(path, content, message, sha) {
    var body = { message: message, content: b64encode(content), branch: S.settings.ghBranch };
    if (sha) body.sha = sha;
    return fetch(ghUrl(path), {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, ghHeaders()),
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (j) { throw new Error(j.message || ('GitHub ' + r.status)); });
      return r.json();
    });
  }

  function extractAssign(src, varName) {
    var re = new RegExp('window\\.' + varName + '\\s*=\\s*([\\s\\S]*?);?\\s*$');
    var m = re.exec(src.trim());
    if (!m) return null;
    try { return JSON.parse(m[1].replace(/;\s*$/, '')); } catch (e) { return null; }
  }

  function pull(silent) {
    if (!ghReady()) { if (!silent) toast('Uzupełnij dane połączenia'); return Promise.resolve(); }
    if (!silent) toast('Pobieram…');
    return Promise.all([ghGet('progress.js'), ghGet('reviews.js'), ghGet('cards.js')])
      .then(function (res) {
        var changed = 0;
        if (res[0]) {
          var p = extractAssign(b64decode(res[0].content), 'PROGRESS');
          if (p && p.cards) { S.prog = mergeProgress(p.cards, S.prog); changed++; }
        }
        if (res[1]) {
          var l = extractAssign(b64decode(res[1].content), 'REVIEWS');
          if (l) { S.log = mergeLog(l, S.log); changed++; }
        }
        if (res[2]) {
          var c = extractAssign(b64decode(res[2].content), 'CARDS');
          if (c && c.length) {
            var have = {}; S.cards.forEach(function (x) { have[x.id] = 1; });
            c.forEach(function (x) { if (!have[x.id]) { S.cards.push(x); have[x.id] = 1; } });
            changed++;
          }
        }
        saveLocal();
        buildQueue(); S.current = pickNext();
        if (S.view === 'learn') render(); else if (S.view === 'more') renderMore();
        if (!silent) toast(changed ? 'Pobrano i scalono' : 'Brak plików w repozytorium');
      })
      .catch(function (e) { if (!silent) toast('Błąd pobierania: ' + e.message); });
  }

  function push(silent) {
    if (!ghReady()) { if (!silent) toast('Uzupełnij dane połączenia'); return Promise.resolve(); }
    if (!silent) toast('Wysyłam…');
    var progSrc = 'window.PROGRESS = ' + JSON.stringify({ v: 1, updated: Date.now(), cards: S.prog }) + ';\n';
    var logSrc = 'window.REVIEWS = ' + JSON.stringify(S.log) + ';\n';

    return ghGet('progress.js')
      .then(function (f) { return ghPut('progress.js', progSrc, 'postęp ' + todayKey(), f && f.sha); })
      .then(function () { return ghGet('reviews.js'); })
      .then(function (f) { return ghPut('reviews.js', logSrc, 'historia ' + todayKey(), f && f.sha); })
      .then(function () {
        S.dirtyProgress = false;
        if (!silent) toast('Wysłano');
      })
      .catch(function (e) { if (!silent) toast('Błąd wysyłki: ' + e.message); });
  }

  function pushCards(silent) {
    if (!ghReady() || !S.dirtyCards) { if (!silent && !S.dirtyCards) toast('Talia bez zmian'); return Promise.resolve(); }
    var src = 'window.CARDS = ' + JSON.stringify(S.cards, null, 1) + ';\n';
    return ghGet('cards.js')
      .then(function (f) { return ghPut('cards.js', src, 'talia: ' + S.cards.length + ' kart', f && f.sha); })
      .then(function () {
        S.dirtyCards = false;
        localStorage.removeItem(CFG.ns + '_cards_pending');
        if (!silent) toast('Talia wysłana');
      })
      .catch(function (e) { if (!silent) toast('Błąd wysyłki talii: ' + e.message); });
  }

  /* =========================================================
     Gesty i klawiatura
     ========================================================= */

  function setupGestures() {
    var area = $('card-area');
    var x0 = 0, y0 = 0, t0 = 0;
    area.addEventListener('touchstart', function (e) {
      x0 = e.changedTouches[0].screenX; y0 = e.changedTouches[0].screenY; t0 = Date.now();
    }, { passive: true });
    area.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].screenX - x0;
      var dy = e.changedTouches[0].screenY - y0;
      var dt = Date.now() - t0;
      if (dt < 500 && Math.abs(dx) > 60 && Math.abs(dy) < 45) {
        if (!S.revealed) reveal();
        else grade(dx > 0 ? 3 : 1);   // w prawo = pamiętam, w lewo = znowu
      }
    }, { passive: true });

    // W trybie nocnym stuknięcie w kartę odsłania odpowiedź — obsługa jednym kciukiem po ciemku.
    area.addEventListener('click', function (e) {
      if (S.mode !== 'night' || S.revealed) return;
      if (e.target.closest('button, input')) return;
      reveal();
    });
  }

  function setupKeyboard() {
    document.addEventListener('keydown', function (e) {
      if (S.view !== 'learn') return;
      var typing = document.activeElement && document.activeElement.tagName === 'INPUT';
      if (e.key === ' ' && !typing) { e.preventDefault(); S.revealed ? grade(3) : reveal(); return; }
      if (typing) return;
      if (e.key >= '1' && e.key <= '4' && S.revealed) { e.preventDefault(); grade(parseInt(e.key, 10)); }
      if (e.key === 'Enter' && !S.revealed) { e.preventDefault(); reveal(); }
    });
  }

  /* =========================================================
     Start
     ========================================================= */

  function initScheduler() {
    S.sched = new FSRS.Scheduler({
      requestRetention: S.settings.requestRetention,
      maximumInterval: S.settings.maximumInterval,
      learningSteps: [1, 10],
      relearningSteps: [10]
    });
  }

  function init() {
    loadSettings();
    initScheduler();
    loadLocal();

    document.title = CFG.title;
    $('wordmark').textContent = CFG.wordmark;

    setMode(localStorage.getItem(CFG.ns + '_mode') || 'day');
    Array.prototype.forEach.call(document.querySelectorAll('.mode-switch button'), function (b) {
      b.onclick = function () { setMode(b.dataset.mode); };
    });

    ['learn', 'browse', 'add', 'more'].forEach(function (v) {
      $('nav-' + v).onclick = function () { switchView(v); };
    });
    $('nav-add').querySelector('.txt').textContent = CFG.addTabLabel || 'Dodaj';

    $('search').addEventListener('input', renderBrowse);

    setupGestures();
    setupKeyboard();

    buildQueue();
    S.current = pickNext();
    switchView('learn');
    S.dayKey = todayKey();

    if (S.settings.autoSync && ghReady()) pull(true);

    /* Aplikacja dodana do ekranu głównego bywa zamrażana zamiast zamykana —
       na iOS potrafi wisieć w tle tygodniami, więc init() nie wykona się ponownie.
       Bez tego kolejka i licznik nowych kart zostają na dniu, w którym wystartowała. */
    function resume() {
      var newDay = todayKey() !== S.dayKey;
      S.dayKey = todayKey();

      if (newDay) {
        // Nowa doba: licznik nowych kart startuje od zera, sesja liczona od nowa.
        S.sessionDone = 0;
        S.sessionRight = 0;
        S.startedAt = Date.now();
      }

      buildQueue();
      if (!S.current || newDay) {
        S.revealed = false;
        S.typedResult = null;
        S.current = pickNext();
      }
      if (S.view === 'learn') render();

      if (S.settings.autoSync && ghReady()) pull(true);
    }

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        // Sesja przerwana w połowie nie ginie.
        if (S.dirtyProgress && S.settings.autoSync && ghReady()) push(true);
      } else {
        resume();
      }
    });

    // Safari na iOS nie zawsze odpala visibilitychange przy powrocie z tła.
    window.addEventListener('pageshow', function (e) { if (e.persisted) resume(); });
    window.addEventListener('focus', resume);

    /* Zapas na wypadek sesji trwającej przez północ. */
    setInterval(function () {
      if (todayKey() !== S.dayKey && document.visibilityState === 'visible') resume();
    }, 60000);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        // Sprawdzenie aktualizacji przy starcie i przy każdym powrocie do aplikacji.
        reg.update().catch(function () {});
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible') reg.update().catch(function () {});
        });
        // Nowa wersja przejmuje kontrolę dopiero po przeładowaniu strony.
        reg.addEventListener('updatefound', function () {
          var sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', function () {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              toast('Jest nowa wersja — uruchamiam ponownie');
              setTimeout(function () { location.reload(); }, 1800);
            }
          });
        });
      }).catch(function () {});
    }

    if ('speechSynthesis' in window) speechSynthesis.getVoices();
  }

  window.APP = { state: S, pull: pull, push: push, render: render };
  document.addEventListener('DOMContentLoaded', init);
})();
