/* notes.js — vocabulário de notas e geração da sequência a tocar (modo livre). */

window.PianoHero = window.PianoHero || {};

(function (PH) {
  'use strict';

  // Teclado desenhado: 5 oitavas, Dó2 (MIDI 36) até Dó7 (MIDI 96) — largo o bastante pra
  // caber músicas de verdade (ex.: um Cânone em Ré com voz aguda e baixo grave), não só
  // a faixa de 2 oitavas do modo livre. Gerado a partir da faixa, não escrito nota a nota
  // à mão, pra facilitar mudar o alcance depois (só trocar MIN_MIDI/MAX_MIDI).
  //
  // Celular (tela de toque pequena): 5 oitavas dariam ~10px por tecla branca, impossível
  // de tocar com o dedo — então o teclado encolhe pra UMA oitava (Dó4–Dó5: 8 brancas e 5
  // pretas, teclas bem largas com o celular deitado). Decidido uma vez, no carregamento,
  // pelo menor lado da tela (não muda ao girar o aparelho). `?oitavas=1` / `?oitavas=5` na
  // URL força um dos dois, pra testar no PC. No celular só aparecem as fases que cabem
  // inteiras nessa oitava (`songFits()`, ver `availableSongs()` no main.js) — em vez de
  // espremer à força músicas largas, que ficariam irreconhecíveis.
  var COMPACT = (function () {
    var forced = /[?&]oitavas=(\d)/.exec(location.search);
    if (forced) return forced[1] !== '5';
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    return !!coarse && Math.min(screen.width, screen.height) < 600;
  })();
  var MIN_MIDI = COMPACT ? 60 : 36, MAX_MIDI = COMPACT ? 72 : 96;
  // Classe no <html> pro CSS montar o layout de celular (deitado, com aviso de girar).
  if (COMPACT) document.documentElement.classList.add('compact');
  var WHITE_PC = [0, 2, 4, 5, 7, 9, 11];   // classes de altura das teclas brancas (Dó Ré Mi Fá Sol Lá Si)
  var BLACK_PC = [1, 3, 6, 8, 10];         // classes de altura das teclas pretas

  var WHITE = [];
  for (var m = MIN_MIDI; m <= MAX_MIDI; m++) {
    if (WHITE_PC.indexOf(m % 12) !== -1) WHITE.push(m);
  }

  // Cada preta fica na divisa depois da branca de índice `after`.
  var BLACK = [];
  WHITE.forEach(function (midi, i) {
    var up = midi + 1;
    if (up <= MAX_MIDI && BLACK_PC.indexOf(up % 12) !== -1) {
      BLACK.push({ midi: up, after: i });
    }
  });

  var NAMES = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si'];

  // Modo livre continua só nas 2 oitavas originais (Dó3–Dó5) — o teclado desenhado ficou
  // mais largo pra fases com música real, mas a prática livre não muda de dificuldade.
  var CORE_MIN = 48, CORE_MAX = 72;
  var coreWhite = WHITE.filter(function (midi) { return midi >= CORE_MIN && midi <= CORE_MAX; });
  var coreBlack = BLACK.filter(function (b) { return b.midi >= CORE_MIN && b.midi <= CORE_MAX; })
    .map(function (b) { return b.midi; });

  var POOLS = {
    white: coreWhite.slice(),
    scale: coreWhite.slice(),
    all: coreWhite.concat(coreBlack).sort(function (a, b) { return a - b; })
  };

  function isBlack(midi) {
    return [1, 3, 6, 8, 10].indexOf(midi % 12) !== -1;
  }

  function noteName(midi) {
    return NAMES[((midi % 12) + 12) % 12];
  }

  /** Nome com oitava (notação científica: Dó4 = MIDI 60), pra desambiguar entre oitavas. */
  function noteNameOct(midi) {
    var oct = Math.floor(midi / 12) - 1;
    return noteName(midi) + oct;
  }

  /**
   * Quanto transpor a música inteira (em oitavas, pra não mudar o tom) pra caber no
   * teclado desenhado — 0 se já cabe, `null` se não cabe de jeito nenhum (extensão maior
   * que o teclado). Transpor a música toda, e não nota a nota, preserva a melodia.
   */
  function songShift(song) {
    var lo = Infinity, hi = -Infinity;
    song.notes.forEach(function (n) {
      (Array.isArray(n) ? n : [n]).forEach(function (m) {
        if (m < lo) lo = m;
        if (m > hi) hi = m;
      });
    });
    for (var k = 0; Math.abs(k) <= 48; k = k <= 0 ? -k + 12 : -k) {
      if (lo + k >= MIN_MIDI && hi + k <= MAX_MIDI) return k;
    }
    return null;
  }

  function songFits(song) { return songShift(song) !== null; }

  /**
   * Traz uma nota pra dentro do teclado desenhado subindo/descendo de oitava em oitava —
   * mantém a nota (classe de altura) e fica o mais perto possível da oitava original.
   * No teclado completo (5 oitavas) as músicas já cabem e isto não muda nada.
   */
  function fitMidi(midi) {
    while (midi < MIN_MIDI) midi += 12;
    while (midi > MAX_MIDI) midi -= 12;
    return midi;
  }

  /**
   * Fluxo infinito de notas (modo livre). Não sorteia nota repetida em seguida
   * e, no modo "scale", prefere saltos pequenos para soar como melodia.
   */
  function Sequence(mode) {
    this.setMode(mode || 'white');
  }

  Sequence.prototype.setMode = function (mode) {
    this.mode = POOLS[mode] ? mode : 'white';
    this.pool = POOLS[this.mode];
    this.last = null;
  };

  Sequence.prototype.next = function () {
    var pool = this.pool;
    var midi;

    if (this.mode === 'scale' && this.last !== null) {
      var i = pool.indexOf(this.last);
      var steps = [-2, -1, -1, 1, 1, 2];
      var j = i + steps[Math.floor(Math.random() * steps.length)];
      if (j < 0) j = 1;
      if (j >= pool.length) j = pool.length - 2;
      midi = pool[j];
    } else {
      do {
        midi = pool[Math.floor(Math.random() * pool.length)];
      } while (midi === this.last && pool.length > 1);
    }

    this.last = midi;
    return midi;
  };

  PH.notes = {
    MIN_MIDI: MIN_MIDI,
    MAX_MIDI: MAX_MIDI,
    COMPACT: COMPACT,
    fitMidi: fitMidi,
    songShift: songShift,
    songFits: songFits,
    WHITE: WHITE,
    BLACK: BLACK,
    POOLS: POOLS,
    isBlack: isBlack,
    noteName: noteName,
    noteNameOct: noteNameOct,
    Sequence: Sequence
  };
})(window.PianoHero);
