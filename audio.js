/* audio.js — piano com amostras reais (Dó3–Dó5, uma gravação por semitom) + dois sons
 * funcionais mínimos (erro de tempo esgotado). De propósito, NÃO há camada de som
 * sintetizado por cima de cada acerto — isso quebrava a musicalidade. O feedback de
 * "acertou" é a própria nota de piano tocando; o de "errou" é a nota errada tocando + a
 * tecla ficando vermelha (ver render.js/main.js).
 *
 * Faixa gravada vs. faixa jogável: só existem 25 amostras (Dó3–Dó5), mas o teclado
 * desenhado (notes.js) cobre 5 oitavas pra caber músicas com melodia aguda e baixo grave
 * de verdade (ex.: Cânone em Ré). Fora de Dó3–Dó5, startNote() toca a amostra real mais
 * próxima com `playbackRate` ajustado (a técnica de "esticar o disco") em vez de tocar a
 * nota exata: decisão deliberada, aceitando alguma distorção de timbre nos extremos em
 * troca de manter o som de piano real na maior parte da faixa estendida. Além de uma
 * oitava de esticamento (`MAX_SHIFT_SEMITONES`), porém, a amostra fica caricata demais
 * (grave demais/lento demais ou agudo demais/rápido demais) — nesses casos extremos
 * cai pro oscilador sintetizado, que soa mais limpo que uma amostra distorcida ao ponto
 * de parecer outro instrumento.
 *
 * Sustain: startNote() começa a tocar e SEGURA (decaimento natural da amostra) até
 * stopNote() ser chamado — isso espelha o par nota-pressionada/nota-solta que input.js
 * agora emite (evento "notePlayed" / "noteReleased"), pra soar como um piano de verdade
 * enquanto a tecla estiver segurada.
 */

window.PianoHero = window.PianoHero || {};

(function (PH) {
  'use strict';

  var SAMPLE_BASE = 'assets/piano/';
  var SAMPLE_NAMES = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];
  var SAMPLE_MIN = 48, SAMPLE_MAX = 72;   // Dó3..Dó5 — faixa de fato gravada (25 amostras)

  var ctx = null;
  var master = null;
  var instrumentGain = null;   // barramento só do piano — mutável sem afetar metrônomo/timeout
  var muted = false;           // true = "Silenciar piano" (tocando num piano externo de verdade)
  var buffers = {};     // midi -> AudioBuffer decodificado
  var loading = false;
  var readyCallbacks = [];
  var ready = false;
  var voices = {};       // midi -> { source, gain } tocando agora (uma por tecla)

  function sampleName(midi) {
    return SAMPLE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
  }

  function freq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  var MAX_SHIFT_SEMITONES = 12;   // acima de 1 oitava de esticamento, a amostra fica artificial demais

  /**
   * A amostra real mais próxima de `midi`, dentro da faixa de fato gravada — ou `null`
   * se `midi` está longe demais (mais de uma oitava) pra esticar sem soar sintético
   * demais, caso em que `startNote()` cai pro oscilador (mais limpo que uma amostra
   * super distorcida nos extremos do teclado de 5 oitavas).
   */
  function nearestSampleMidi(midi) {
    if (midi >= SAMPLE_MIN && midi <= SAMPLE_MAX) return midi;
    var clamped = midi < SAMPLE_MIN ? SAMPLE_MIN : SAMPLE_MAX;
    return Math.abs(midi - clamped) <= MAX_SHIFT_SEMITONES ? clamped : null;
  }

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      // iPhone: por padrão o Web Audio é tratado como "som ambiente" e fica MUDO com a
      // chave de silencioso ligada. "playback" (Safari 16.4+) trata como mídia, igual a
      // um vídeo — toca mesmo no silencioso.
      if (navigator.audioSession) {
        try { navigator.audioSession.type = 'playback'; } catch (e) { /* não suportado */ }
      }
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.7;
      master.connect(ctx.destination);
      instrumentGain = ctx.createGain();
      instrumentGain.gain.value = muted ? 0.0001 : 1;
      instrumentGain.connect(master);
      // Toca um buffer mudo de 1 amostra dentro do próprio toque que criou o contexto:
      // é o que "destrava" o áudio de vez no Safari/iOS (senão pode continuar mudo).
      var silent = ctx.createBufferSource();
      silent.buffer = ctx.createBuffer(1, 1, 22050);
      silent.connect(ctx.destination);
      silent.start(0);
    }
    // 'suspended' (sem gesto ainda) ou 'interrupted' (iOS, depois de ligação/app em
    // segundo plano): qualquer estado que não seja tocando tenta retomar.
    if (ctx.state !== 'running') ctx.resume();
    if (!loading) loadSamples();
    return ctx;
  }

  function loadSamples() {
    loading = true;
    var todo = [];
    for (var m = SAMPLE_MIN; m <= SAMPLE_MAX; m++) todo.push(m);
    var remaining = todo.length;

    todo.forEach(function (midi) {
      var url = SAMPLE_BASE + sampleName(midi) + '.mp3';
      fetch(url)
        .then(function (r) { return r.arrayBuffer(); })
        .then(function (data) { return ctx.decodeAudioData(data); })
        .then(function (audioBuf) { buffers[midi] = audioBuf; })
        .catch(function (err) {
          console.error('[audio] falha ao carregar ' + url + ':', err);
        })
        .then(function () {
          remaining--;
          if (remaining === 0) {
            ready = true;
            readyCallbacks.forEach(function (cb) { cb(); });
            readyCallbacks = [];
          }
        });
    });
  }

  /** Roda `cb` assim que todas as amostras terminarem de carregar (ou já rodou, se pronto). */
  function onReady(cb) {
    if (ready) cb();
    else readyCallbacks.push(cb);
  }

  /**
   * Silencia só o som do piano (amostra/fallback), pra jogar com um piano externo de
   * verdade sem duplicar o som no PC. Metrônomo e aviso de tempo esgotado continuam
   * audíveis (ligados direto no `master`, não no `instrumentGain`) — é a "referência"
   * que o jogador ainda precisa ouvir vindo do computador.
   */
  function setMuted(value) {
    muted = !!value;
    if (instrumentGain) instrumentGain.gain.setValueAtTime(muted ? 0.0001 : 1, ctx.currentTime);
  }

  /**
   * Começa a tocar uma nota e a sustenta (decaimento natural da amostra) até stopNote().
   * `meta`, quando presente ({ source, midi, t0, tDispatch, tHandle }), alimenta a
   * instrumentação de latência (latency.js) com o instante em que a nota foi de fato
   * agendada no relógio do Web Audio.
   */
  function startNote(midi, volume, meta) {
    if (!ensure()) return;
    stopNote(midi, 0.03);   // corta qualquer instância anterior da mesma tecla (retrigger)

    var t = ctx.currentTime;
    var vol = volume === undefined ? 1 : volume;
    var sampleMidi = nearestSampleMidi(midi);
    var buf = sampleMidi !== null ? buffers[sampleMidi] : null;

    var gain = ctx.createGain();
    gain.connect(instrumentGain);

    if (buf) {
      var src = ctx.createBufferSource();
      src.buffer = buf;
      // Fora de Dó3–Dó5 isso é > 1 (mais agudo/rápido) ou < 1 (mais grave/lento) — ver
      // nota no topo do arquivo sobre esticar a amostra mais próxima em vez de sintetizar.
      src.playbackRate.value = Math.pow(2, (midi - sampleMidi) / 12);
      gain.gain.setValueAtTime(0.9 * vol, t);
      src.connect(gain);
      src.start(t);
      voices[midi] = { source: src, gain: gain };
    } else {
      // Amostra ainda carregando (ou faltou baixar): fallback simples só pra não ficar mudo.
      var osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq(midi);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.3 * vol, t + 0.01);
      osc.connect(gain);
      osc.start(t);
      voices[midi] = { source: osc, gain: gain };
    }

    if (meta && PH.latency) {
      PH.latency.record(meta, { ctx: ctx, scheduledCtxTime: t, sampleLoaded: !!buf });
    }
  }

  /** Solta a nota — decaimento curto, como o abafador de um piano ao soltar a tecla. */
  function stopNote(midi, release) {
    var v = voices[midi];
    if (!v || !ctx) return;
    delete voices[midi];

    var t = ctx.currentTime;
    var r = release === undefined ? 0.25 : release;
    try {
      var current = v.gain.gain.value;
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setValueAtTime(Math.max(current, 0.0001), t);
      v.gain.gain.exponentialRampToValueAtTime(0.0001, t + r);
      v.source.stop(t + r + 0.05);
    } catch (e) { /* a fonte já pode ter terminado sozinha (amostra curta) */ }
  }

  /** Toca e solta sozinha depois de `dur` segundos — pra feedback rápido sem hold real. */
  function playNote(midi, volume, dur) {
    startNote(midi, volume);
    var d = dur === undefined ? 0.6 : dur;
    setTimeout(function () { stopNote(midi, 0.3); }, d * 1000);
  }

  /**
   * Relógio do Web Audio (segundos, mesma base de `startNote`/agendamento). É a única
   * base de tempo precisa o bastante pra agendar o metrônomo com antecedência (ver
   * `PH.metronome` em main.js) — o relógio do loop de jogo (`performance.now()`/rAF)
   * sofre jitter do event loop do JS, então cliques agendados só nele cairiam torto.
   */
  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  /** Clique do metrônomo, agendado com precisão de sample no instante `time` (ctx.currentTime). */
  function playClick(time, accent) {
    if (!ctx) return;
    var osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(accent ? 1760 : 1046, time);
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(accent ? 0.22 : 0.13, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
    osc.connect(gain).connect(master);
    osc.start(time);
    osc.stop(time + 0.04);
  }

  /** Sinaliza que o tempo da nota passou sem tentativa (junto do clique, o único som sintetizado). */
  function playTimeout() {
    if (!ensure()) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.14);
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  // No celular, tocar uma tecla dispara `pointerdown`, que o Chrome do Android NÃO conta
  // como gesto que libera áudio (só o fim do toque conta). Se o contexto foi suspenso
  // (app em segundo plano, tela bloqueada), retoma no fim de qualquer toque.
  function resumeOnGesture() {
    if (ctx && ctx.state !== 'running') ctx.resume();
  }
  // Também no começo do toque (pointerdown, fase de captura: pega toques no teclado do
  // canvas, cujo touchstart é cancelado), e ao voltar pra aba/app — o iPhone deixa o áudio
  // "interrompido" depois de bloquear a tela, trocar de app ou quando o aparelho engasga.
  document.addEventListener('touchend', resumeOnGesture, { passive: true, capture: true });
  document.addEventListener('pointerdown', resumeOnGesture, true);
  document.addEventListener('click', resumeOnGesture, true);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) resumeOnGesture();
  });

  PH.audio = {
    unlock: ensure,
    onReady: onReady,
    startNote: startNote,
    stopNote: stopNote,
    playNote: playNote,
    playTimeout: playTimeout,
    now: now,
    playClick: playClick,
    setMuted: setMuted
  };
})(window.PianoHero);
