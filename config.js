/* config.js — wersja polska: hasło i jego znaczenie.
 *
 * Model karty:
 *   id     pl_0001
 *   t      mean = hasło → znaczenie (rozpoznawanie)
 *          word = znaczenie → hasło (produkcja, z wpisywaniem)
 *   term   hasło
 *   def    znaczenie
 *   dom    kwalifikator: filoz., praw., daw., pot., med.
 *   sense  numer znaczenia, gdy hasło ma ich kilka
 *   ex     przykład użycia
 *   note   uwaga: etymologia, mylone hasło, kolokacja
 *   tags   []
 */
window.APP_CONFIG = (function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function label(c) {
    return c.term + (c.sense ? ' (' + c.sense + ')' : '');
  }

  return {
    ns: 'plw',
    title: 'Pojęcia — fiszki',
    wordmark: 'Pojęcia',
    idPrefix: 'pl_',
    ttsLang: 'pl-PL',
    addTabLabel: 'Dodaj',

    defaults: {
      newPerDay: 20,
      typing: false,
      maximumInterval: 730,
      requestRetention: 0.9
    },

    answerOf: function (c) { return c.t === 'word' ? c.term : c.def; },

    renderFront: function (c) {
      if (c.t === 'word') {
        return {
          badge: 'Znaczenie → hasło',
          main: esc(c.def),
          sub: c.dom ? esc(c.dom) : '',
          long: true,
          typable: true
        };
      }
      return {
        badge: c.dom ? esc(c.dom) : 'Hasło',
        main: esc(label(c)),
        sub: c.sense ? 'To hasło ma kilka znaczeń — chodzi o ' + c.sense + '.' : '',
        long: false,
        typable: false
      };
    },

    renderBack: function (c) {
      var blocks = [];
      if (c.t === 'word') {
        if (c.dom) blocks.push({ title: 'Kwalifikator', items: [c.dom] });
      }
      if (c.ex) blocks.push({ title: 'Użycie', items: [c.ex], italic: true });
      if (c.note) blocks.push({ title: 'Uwaga', items: [c.note] });

      return {
        answer: c.t === 'word' ? label(c) : c.def,
        ipa: '',
        gloss: c.t === 'word' ? '' : (c.dom || ''),
        blocks: blocks,
        speak: c.t === 'word' ? c.term : (c.ex || c.def),
        speakLang: 'pl-PL'
      };
    },

    searchText: function (c) {
      return [c.term, c.def, c.dom, c.note, (c.tags || []).join(' ')].join(' ');
    },

    browseRow: function (c) {
      return {
        main: label(c) + (c.t === 'word' ? ' ←' : ''),
        sub: c.def
      };
    },

    addFormHtml: function () {
      return '' +
        '<div class="section"><h2>Nowe hasło</h2>' +
        '<div class="field"><label>Hasło</label><input id="f-term" placeholder="Imponderabilia"></div>' +
        '<div class="field"><label>Znaczenie</label><textarea id="f-def" placeholder="rzeczy nieuchwytne, niedające się zmierzyć, a mimo to wpływające na sprawy"></textarea></div>' +
        '<div class="field"><label>Kwalifikator</label><input id="f-dom" placeholder="filoz. / praw. / daw. / pot."></div>' +
        '<div class="field"><label>Numer znaczenia</label><input id="f-sense" type="number" min="1" max="9" placeholder="zostaw puste, jeśli hasło ma jedno znaczenie"></div>' +
        '<div class="field"><label>Przykład użycia</label><textarea id="f-ex" placeholder="Zdanie, w którym to hasło spotkałeś."></textarea>' +
        '<div class="help">Najlepiej zdanie z miejsca, w którym faktycznie natknąłeś się na to słowo. Zapamiętuje się wyraźnie lepiej niż definicja sama w sobie.</div></div>' +
        '<div class="field"><label>Uwaga</label><textarea id="f-note" placeholder="etymologia, hasło mylone, typowa kolokacja"></textarea></div>' +
        '<div class="field"><label>Kierunek</label><select id="f-dir">' +
        '<option value="mean">Hasło → znaczenie</option>' +
        '<option value="both">Obie strony</option>' +
        '<option value="word">Znaczenie → hasło</option>' +
        '</select><div class="help">Obie strony dają dwie karty. Kierunek znaczenie → hasło jest trudniejszy, ale to on sprawia, że słowo zaczyna wychodzić w mowie.</div></div>' +
        '<div class="field"><label>Tagi</label><input id="f-tags" placeholder="oddzielone przecinkiem"></div>' +
        '<button class="btn primary" id="btn-add-save">Dodaj hasło</button></div>' +

        '<div class="section"><h2>Import zbiorczy</h2>' +
        '<div class="field"><textarea id="f-bulk" style="min-height:130px" placeholder="hasło | znaczenie | kwalifikator | przykład | uwaga"></textarea>' +
        '<div class="help">Jedno hasło w linii, pola rozdzielone pionową kreską. Wystarczą dwa pierwsze.</div></div>' +
        '<button class="btn" id="btn-bulk">Wczytaj wszystkie linie</button></div>';
    },

    addFormRead: function () {
      var v = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
      var term = v('f-term'), def = v('f-def');
      if (!term || !def) { alert('Hasło i znaczenie są wymagane.'); return null; }

      var base = { term: term, def: def };
      if (v('f-dom')) base.dom = v('f-dom');
      if (v('f-sense')) base.sense = parseInt(v('f-sense'), 10);
      if (v('f-ex')) base.ex = v('f-ex');
      if (v('f-note')) base.note = v('f-note');
      if (v('f-tags')) base.tags = v('f-tags').split(',').map(function (s) { return s.trim(); }).filter(Boolean);

      var dir = v('f-dir') || 'mean';
      if (dir === 'both') {
        return [Object.assign({ t: 'mean' }, base), Object.assign({ t: 'word' }, base)];
      }
      return Object.assign({ t: dir }, base);
    },

    bulkParse: function (text) {
      return text.split('\n').map(function (line) {
        var p = line.split('|').map(function (s) { return s.trim(); });
        if (p.length < 2 || !p[0] || !p[1]) return null;
        var c = { t: 'mean', term: p[0], def: p[1] };
        if (p[2]) c.dom = p[2];
        if (p[3]) c.ex = p[3];
        if (p[4]) c.note = p[4];
        return c;
      }).filter(Boolean);
    }
  };
})();
