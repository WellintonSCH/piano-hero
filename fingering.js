/* fingering.js — qual mão e qual dedo toca cada nota.
 *
 * Formato (no próprio JSON/objeto da música): `fingers`, um array paralelo a `notes`. Cada
 * posição é um rótulo "R1".."R5" (mão direita, 1 = dedão … 5 = mindinho) ou "L1".."L5"
 * (mão esquerda) — ou, se `notes[i]` é um acorde, um array de rótulos na MESMA ordem das
 * notas do acorde. Ex.: notes [60, [48, 64]] → fingers ["R1", ["L5", "R3"]].
 * Um rótulo pode ter só a mão ("R"/"L"): o dedo é então completado pelo algoritmo abaixo,
 * respeitando a mão dada (útil quando a partitura diz a mão mas não marca todos os dedos).
 *
 * Músicas sem `fingers` recebem um dedilhado sugerido por `compute()`, em duas etapas:
 *  1. MÃO — tudo na direita; a esquerda só entra quando a direita não dá conta: a nota não
 *     cabe na abertura da mão (~1 oitava) junto do que ela ainda segura, passaria de 5
 *     notas ao mesmo tempo, ou está longe demais de onde a mão está sem tempo pra saltar.
 *  2. DEDO — dentro de cada mão, olhando a FRASE e não só a nota anterior: trechos seguidos
 *     que cabem numa mão parada (até 5 notas diferentes, abertura ≤ 1 sexta) viram uma
 *     "posição", e cada tecla da posição recebe um dedo, do dedão pra fora, proporcional à
 *     distância (Dó Ré Mi → 1 2 3; Dó Mi Sol → 1 3 5). Acordes idem, sozinhos.
 * É uma SUGESTÃO razoável pra treino, não o dedilhado de um editor. Quando a partitura traz
 * mão/dedo de verdade (MusicXML: pauta 1/2 e <fingering>), tools/mxl_to_song.py já grava isso
 * em `fingers`; e tools/add_fingers.js grava o sugerido nos songs/*.json que não têm, pra
 * poder corrigir à mão.
 *
 * Funciona no navegador (window.PianoHero.fingering) e no Node (module.exports), pra o
 * script de ferramenta usar exatamente o mesmo algoritmo do jogo.
 */

(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.PianoHero) root.PianoHero.fingering = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var SPAN = 12;               // abertura máxima de uma mão (semitons) em acorde/segurando
  var REACH = 9;               // extensão de uma posição de 5 dedos sem mover a mão (Dó–Lá)
  var FAR = 16;                // mais longe que isso de onde a mão está, sem tempo pra saltar = "não dá conta"
  var JUMP_TICKS = 480;        // tempo livre mínimo (1 semínima, PPQ 480) pra mão saltar longe

  /** "R3" → { hand: 'R', finger: 3 }; "L" → { hand: 'L', finger: null }; inválido → null. */
  function parse(label) {
    var m = /^([RL])([1-5])?$/.exec(String(label || '').trim().toUpperCase());
    return m ? { hand: m[1], finger: m[2] ? Number(m[2]) : null } : null;
  }

  function asArray(x) { return Array.isArray(x) ? x : [x]; }

  /* ---------- 1ª etapa: qual mão toca cada nota ---------- */

  /** Uma mão: notas que está segurando, onde está (centro) e quando ficou livre. */
  function Hand() {
    this.held = [];          // [{ midi, end }]
    this.center = null;
    this.lastEnd = -Infinity;
  }

  Hand.prototype.release = function (now) {
    this.held = this.held.filter(function (h) { return h.end > now; });
  };

  /** A mão consegue tocar `midis` agora, junto do que já segura? */
  Hand.prototype.fits = function (midis, now) {
    var all = this.held.map(function (h) { return h.midi; }).concat(midis);
    if (all.length > 5) return false;
    if (Math.max.apply(null, all) - Math.min.apply(null, all) > SPAN) return false;
    // Muito longe de onde a mão está e sem tempo pra saltar até lá: não dá conta.
    if (this.center !== null && this.held.length === 0 && now - this.lastEnd < JUMP_TICKS) {
      for (var i = 0; i < midis.length; i++) {
        if (Math.abs(midis[i] - this.center) > FAR) return false;
      }
    }
    return true;
  };

  Hand.prototype.play = function (midis, end) {
    var self = this;
    midis.forEach(function (m) { self.held.push({ midi: m, end: end }); });
    this.center = midis.reduce(function (a, b) { return a + b; }, 0) / midis.length;
    this.lastEnd = Math.max(this.lastEnd, end);
  };

  /**
   * Mão de cada nota: array paralelo a `song.notes`, cada item um array de 'R'/'L' na
   * ordem das notas daquela posição. A direita escolhe primeiro, das mais agudas pras mais
   * graves; só o que ela não comporta vai pra esquerda.
   */
  function assignHands(song) {
    var right = new Hand(), left = new Hand();
    var out = [];
    var t = 0;
    for (var i = 0; i < song.notes.length; i++) {
      var notes = asArray(song.notes[i]);
      var dur = song.durations[i];
      var sus = song.sustainDurations ? song.sustainDurations[i] : dur;
      var end = t + Math.max(dur, sus);
      right.release(t);
      left.release(t);

      var forRight = [], forLeft = [];
      notes.slice().sort(function (a, b) { return b - a; }).forEach(function (m) {
        if (right.fits(forRight.concat([m]), t)) forRight.push(m);
        else forLeft.push(m);
      });
      // Se nem a esquerda comporta, as notas extras ficam na direita (música impossível
      // como escrita — melhor sugerir algo do que nada).
      while (forLeft.length && !left.fits(forLeft, t) && forRight.length < 5) {
        forRight.push(forLeft.shift());
      }
      if (forRight.length) right.play(forRight, end);
      if (forLeft.length) left.play(forLeft, end);
      out.push(notes.map(function (m) { return forLeft.indexOf(m) !== -1 ? 'L' : 'R'; }));
      t += dur;
    }
    return out;
  }

  /* ---------- 2ª etapa: qual dedo, dentro de cada mão ---------- */

  /**
   * Dedos pra notas já ordenadas do lado do dedão pra fora (direita: grave → agudo;
   * esquerda: agudo → grave): dedão na primeira, os outros proporcionais à distância,
   * sempre crescentes e sem passar de 5 — Dó Mi Sol vira 1 3 5; Dó Ré Mi, 1 2 3.
   */
  function spread(sorted) {
    var first = sorted[0];
    var span = Math.max(Math.abs(sorted[sorted.length - 1] - first), 7);
    var fingers = [];
    for (var i = 0; i < sorted.length; i++) {
      var f = Math.round(1 + 4 * Math.abs(sorted[i] - first) / span);
      if (i > 0) f = Math.max(f, fingers[i - 1] + 1);
      fingers.push(f);
    }
    // Estourou o 5: empurra de volta pra dentro, de trás pra frente.
    for (var j = fingers.length - 1; j >= 0; j--) {
      var cap = 5 - (fingers.length - 1 - j);
      if (fingers[j] > cap) fingers[j] = cap;
    }
    return fingers;
  }

  /**
   * Dedos de uma mão ao longo da música. `events` = [{ key, midis }] na ordem em que a mão
   * toca. Acordes: dedilhados sozinhos. Notas soltas: agrupadas em posições (trechos que
   * cabem numa mão parada) e cada tecla da posição ganha um dedo fixo durante o trecho.
   */
  function fingerHand(events, dir) {
    var order = function (a, b) { return (a - b) * dir; };   // do dedão pra fora
    var result = {};
    var j = 0;
    while (j < events.length) {
      var ev = events[j];
      if (ev.midis.length > 1) {
        var chord = ev.midis.slice().sort(order);
        var cf = spread(chord);
        for (var c = 0; c < chord.length; c++) result[ev.key + ':' + chord[c]] = cf[c];
        j++;
        continue;
      }
      var distinct = [];
      var k = j;
      while (k < events.length && events[k].midis.length === 1) {
        var m = events[k].midis[0];
        var trial = distinct.indexOf(m) === -1 ? distinct.concat([m]) : distinct;
        if (trial.length > 5 || Math.max.apply(null, trial) - Math.min.apply(null, trial) > REACH) break;
        distinct = trial;
        k++;
      }
      distinct.sort(order);
      var wf = spread(distinct);
      for (var e = j; e < k; e++) {
        var mm = events[e].midis[0];
        result[events[e].key + ':' + mm] = wf[distinct.indexOf(mm)];
      }
      j = k;
    }
    return result;
  }

  /**
   * Dedilhado pra música inteira: array paralelo a `song.notes`, cada item um array de
   * rótulos ("R1".."L5") na ordem das notas daquela posição. `given` (opcional, mesmo
   * formato, já normalizado) fixa o que já se sabe: a mão de cada nota e, quando tem, o
   * dedo — o algoritmo só completa o que falta.
   */
  function compute(song, given) {
    var hands = given
      ? given.map(function (labels) { return labels.map(function (l) { return l.charAt(0); }); })
      : assignHands(song);
    var events = { R: [], L: [] };
    hands.forEach(function (hs, i) {
      var notes = asArray(song.notes[i]);
      ['R', 'L'].forEach(function (h) {
        var midis = notes.filter(function (m, k) { return hs[k] === h; });
        if (midis.length) events[h].push({ key: i, midis: midis });
      });
    });
    var fr = fingerHand(events.R, 1);
    var fl = fingerHand(events.L, -1);
    return hands.map(function (hs, i) {
      return asArray(song.notes[i]).map(function (m, k) {
        var known = given && given[i][k].length > 1 ? given[i][k].charAt(1) : null;
        return hs[k] + (known || (hs[k] === 'R' ? fr : fl)[i + ':' + m] || 1);
      });
    });
  }

  /**
   * Dedilhado a usar: o escrito na música (`song.fingers`), se válido e do tamanho certo;
   * senão o sugerido por `compute()`. Sempre normalizado pra arrays (1 por nota).
   */
  function forSong(song) {
    if (song._fingersCache) return song._fingersCache;
    var out = null;
    if (Array.isArray(song.fingers) && song.fingers.length === song.notes.length) {
      out = song.fingers.map(function (f, i) {
        var labels = asArray(f);
        var n = asArray(song.notes[i]).length;
        if (labels.length !== n || !labels.every(parse)) return null;
        return labels.map(function (l) { return String(l).toUpperCase(); });
      });
      if (out.some(function (x) { return x === null; })) {
        if (typeof console !== 'undefined') console.warn('[fingering] "fingers" inválido em ' + song.id + ' — usando o sugerido');
        out = null;
      }
    }
    if (!out) out = compute(song);
    else if (out.some(function (ls) { return ls.some(function (l) { return l.length === 1; }); })) {
      out = compute(song, out);   // só a mão em alguns rótulos: completa os dedos
    }
    try {
      Object.defineProperty(song, '_fingersCache', { value: out, enumerable: false, configurable: true });
    } catch (e) { /* objeto congelado: só não guarda o cache */ }
    return out;
  }

  /** Quais mãos a música usa: { R: bool, L: bool }. */
  function handsUsed(song) {
    var used = { R: false, L: false };
    forSong(song).forEach(function (labels) {
      labels.forEach(function (l) { used[l.charAt(0)] = true; });
    });
    return used;
  }

  /**
   * `fingers` completo pra gravar num JSON de música: rótulo simples em nota sozinha,
   * array em acorde (o formato documentado no topo). Usado por tools/add_fingers.js.
   */
  function toJSON(song) {
    return forSong(song).map(function (labels, i) {
      return Array.isArray(song.notes[i]) ? labels : labels[0];
    });
  }

  return { parse: parse, compute: compute, forSong: forSong, handsUsed: handsUsed, toJSON: toJSON };
});
