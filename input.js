/* input.js — unifica MIDI + teclado do PC + clique na tela em dois eventos:
 * "notePlayed" (pressionou) e "noteReleased" (soltou) — o par permite a nota soar
 * enquanto a tecla estiver segurada, como num piano de verdade. */

window.PianoHero = window.PianoHero || {};

(function (PH) {
  'use strict';

  // Layout "piano de digitação" clássico: fileira de baixo = 1ª oitava (Dó3..Si3),
  // fileira de cima = 2ª oitava (Dó4..Dó5). Pretas ficam na fileira acima da branca.
  var KEY_MAP = {
    z: 48, s: 49, x: 50, d: 51, c: 52, v: 53,
    g: 54, b: 55, h: 56, n: 57, j: 58, m: 59,
    q: 60, '2': 61, w: 62, '3': 63, e: 64, r: 65,
    '5': 66, t: 67, '6': 68, y: 69, '7': 70, u: 71, i: 72
  };

  var LABELS = {};
  Object.keys(KEY_MAP).forEach(function (ch) { LABELS[KEY_MAP[ch]] = ch.toUpperCase(); });

  var held = {};       // evita auto-repeat do teclado
  var midiAccess = null;

  /**
   * t0: DOMHighResTimeStamp do evento de origem (keydown/pointerdown/MIDIMessageEvent),
   * na mesma linha do tempo de performance.now() — base da instrumentação de latência
   * (ver latency.js). tDispatch marca quando este módulo efetivamente despacha o
   * evento de domínio, separando "tempo até chegar aqui" de "tempo gasto aqui".
   */
  function emit(midi, source, t0) {
    var tDispatch = performance.now();
    window.dispatchEvent(new CustomEvent('notePlayed', {
      detail: { midi: midi, source: source, t0: t0 != null ? t0 : tDispatch, tDispatch: tDispatch }
    }));
  }

  function emitRelease(midi, source) {
    window.dispatchEvent(new CustomEvent('noteReleased', {
      detail: { midi: midi, source: source }
    }));
  }

  /** Dobra qualquer nota recebida para dentro do teclado desenhado (Dó2..Dó7, ver notes.js). */
  function fold(midi) {
    var lo = PH.notes.MIN_MIDI, hi = PH.notes.MAX_MIDI;
    if (midi >= lo && midi <= hi) return midi;
    // Fora do intervalo: reancora na oitava mais baixa do teclado, pela classe de altura.
    return ((midi - lo) % 12 + 12) % 12 + lo;
  }

  function initKeyboard() {
    window.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var ch = e.key.toLowerCase();
      if (!(ch in KEY_MAP)) return;
      e.preventDefault();
      if (held[ch]) return;
      held[ch] = true;
      emit(KEY_MAP[ch], 'keyboard', e.timeStamp);
    });

    window.addEventListener('keyup', function (e) {
      var ch = e.key.toLowerCase();
      if (!held[ch]) return;
      delete held[ch];
      if (ch in KEY_MAP) emitRelease(KEY_MAP[ch], 'keyboard');
    });

    // Se a aba perde o foco, solta tudo (senão a nota fica "presa" tocando pra sempre).
    window.addEventListener('blur', function () {
      Object.keys(held).forEach(function (ch) {
        if (ch in KEY_MAP) emitRelease(KEY_MAP[ch], 'keyboard');
      });
      held = {};
    });
  }

  function initPointer(canvas) {
    // Uma nota por dedo (pointerId): no celular dá pra tocar acordes com dois dedos, e
    // soltar um dedo não solta a nota do outro.
    var activeByPointer = {};

    canvas.addEventListener('pointerdown', function (e) {
      var r = canvas.getBoundingClientRect();
      var midi = PH.render.keyAt(e.clientX - r.left, e.clientY - r.top);
      if (midi === null) return;
      e.preventDefault();
      activeByPointer[e.pointerId] = midi;
      emit(midi, 'pointer', e.timeStamp);
    });

    function release(e) {
      var midi = activeByPointer[e.pointerId];
      if (midi === undefined) return;
      delete activeByPointer[e.pointerId];
      emitRelease(midi, 'pointer');
    }

    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    canvas.addEventListener('pointerleave', release);

    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // Safari/iPhone: segurar o dedo numa tecla abria a lupa/seleção de texto e dava zoom
    // (e toque duplo rápido também dá zoom). `user-select`/`touch-action` no CSS não
    // bastam no iOS — cancelar o `touchstart` do canvas é o que impede esses gestos do
    // sistema. Pointer Events (usados acima) continuam chegando normalmente.
    canvas.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
  }

  /**
   * Web MIDI é opcional: sem API, sem permissão ou sem aparelho, o jogo segue
   * normalmente com teclado e mouse. `onStatus` recebe o texto pra exibir.
   */
  function initMIDI(onStatus, onRaw) {
    function status(msg) { if (onStatus) onStatus(msg); }
    function raw(msg) { if (onRaw) onRaw(msg); }

    if (!navigator.requestMIDIAccess) {
      var isFile = location.protocol === 'file:';
      status(isFile
        ? 'MIDI: indisponível em file:// — rode um servidor local para usar piano MIDI.'
        : 'MIDI: não suportado neste navegador (use teclado ou mouse).');
      return;
    }

    navigator.requestMIDIAccess().then(function (access) {
      midiAccess = access;
      attachAll(access);
      access.onstatechange = function () {
        attachAll(access);
        report(access);
      };
      report(access);
    }).catch(function () {
      status('MIDI: permissão negada (use teclado ou mouse).');
    });

    function attachAll(access) {
      access.inputs.forEach(function (port) {
        port.onmidimessage = handleMessage;
      });
    }

    function report(access) {
      var names = [];
      access.inputs.forEach(function (p) { names.push(p.name); });
      status(names.length
        ? 'MIDI: conectado — ' + names.join(', ')
        : 'MIDI: nenhum aparelho detectado (use teclado ou mouse).');
    }

    function handleMessage(msg) {
      var d = msg.data;
      var cmd = d[0] & 0xf0;
      var note = d[1];
      var velocity = d[2];

      // Log cru pra depuração — abra o console (F12) se algo parecer errado.
      console.log('[MIDI] byte0=0x' + d[0].toString(16) + ' nota=' + note + ' vel=' + velocity);
      raw({ status: d[0], note: note, velocity: velocity });

      // Note-on de verdade: comando 0x90 e velocity > 0
      // (velocity 0 em 0x90 costuma ser usado como note-off).
      if (cmd === 0x90 && velocity > 0) {
        emit(fold(note), 'midi', msg.timeStamp);
      } else if (cmd === 0x80 || (cmd === 0x90 && velocity === 0)) {
        emitRelease(fold(note), 'midi');
      }
    }
  }

  function labelFor(midi) { return LABELS[midi] || ''; }

  PH.input = {
    KEY_MAP: KEY_MAP,
    labelFor: labelFor,
    initKeyboard: initKeyboard,
    initPointer: initPointer,
    initMIDI: initMIDI
  };
})(window.PianoHero);
