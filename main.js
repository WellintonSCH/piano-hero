/* main.js — estado do jogo, loop principal e ligação entre input, notas/músicas e render.
 *
 * Dois modos:
 *  - "free"  : prática livre, infinita, sem pressão de tempo (nota espera na linha).
 *  - "song"  : fase com música de verdade — as notas caem no tempo (BPM/ticks) e há uma
 *              janela de acerto ao redor do instante certo, como num jogo de ritmo.
 *
 * Som e feedback: de propósito, NÃO há camada de som sintetizado por cima de cada
 * acerto — a própria nota de piano (amostra real) tocando É o feedback de acerto, e a
 * nota errada tocando (+ tecla/barra vermelhas) É o feedback de erro. Isso preserva a
 * musicalidade em vez de abafar a música com bipes.
 */

(function (PH) {
  'use strict';

  var VISIBLE_NOTES = 7;     // quantas notas ficam empilhadas na tela (modo livre)
  var FALL_SPEED = 220;      // px/s no modo livre
  var FLASH_TIME = 0.45;     // segundos do eco de brilho na tecla, depois de soltar
  var PROGRESS_KEY = 'pianoHeroProgress';

  var LEAD_TIME = 2.0;       // segundos que uma nota leva caindo até a linha (modo fase)
  var HIT_WINDOW = 0.35;     // tolerância total (±) pra considerar a nota "no tempo"
  var PERFECT_WINDOW = 0.12; // dentro disso conta como acerto "perfeito" (mais pontos)
  var PRE_ROLL = 1.5;        // segundos de preparo antes do tempo 0 da música

  var el = {};
  var sequence = new PH.notes.Sequence('white');
  var progress = { unlocked: 0, best: {}, prefs: { speed: 1, effects: true, wait: false, metronome: false, mutePiano: false, demo: false } };

  var state = {
    mode: 'free',         // 'free' ou 'song'
    song: null,
    timeline: [],          // modo song: [{ midi, time, dur }] em segundos
    cursor: 0,             // modo song: índice da próxima nota a resolver
    songTime: 0,           // modo song: relógio da música (negativo durante o preparo)
    songDuration: 0,       // modo song: duração total da timeline (fim da última nota), em segundos
    demoGen: 0,            // incrementa a cada reset()/seekTo() — invalida setTimeouts velhos da demonstração
    scrubbing: false,      // true enquanto o jogador arrasta a barra de progresso (suspende o relógio)
    speed: 1,              // multiplicador de velocidade (afeta o BPM efetivo da fase)
    waitMode: false,       // modo fase: true = a música pausa na nota até o jogador acertar
    metronome: false,      // modo fase: true = clique de referência em cada tempo (semínima)
    nextClick: 0,          // modo fase: índice do próximo tempo (semínima) a soar o clique
    effects: true,         // false = "modo foco": desliga partículas/tremor extras
    mutePiano: false,      // true = silencia o som do piano do PC (toca num piano externo de verdade)
    demoMode: false,       // modo fase: true = a música toca sozinha (auto-play), sem exigir input
    paused: false,         // true = jogo pausado (loop congelado, overlay de pausa visível)
    log: [],               // histórico de notas resolvidas na fase atual (pro relatório)
    notes: [],             // notas ainda por vir, visíveis no momento (ambos os modos)
    resolvedBars: [],      // barras já tocadas que ainda estão "soando" (efeito na nota)
    held: {},              // midi -> {good} — teclas fisicamente pressionadas agora
    flashes: {},           // midi -> {t, good} — eco de brilho depois de soltar a tecla
    hint: true,
    targetMidis: [],      // notas ainda pendentes do acorde/nota atual (1 item = nota simples)
    score: 0,
    combo: 0,
    bestCombo: 0,
    hits: 0,
    misses: 0,
    running: false
  };

  function boot() {
    el.canvas = document.getElementById('game');
    el.overlay = document.getElementById('overlay');
    el.score = document.getElementById('score');
    el.combo = document.getElementById('combo');
    el.accuracy = document.getElementById('accuracy');
    el.feedback = document.getElementById('feedback');
    el.midiStatus = document.getElementById('midiStatus');
    el.midiRaw = document.getElementById('midiRaw');
    el.pianoStatus = document.getElementById('pianoStatus');
    el.hint = document.getElementById('hintToggle');
    el.effectsToggle = document.getElementById('effectsToggle');
    el.muteToggle = document.getElementById('muteToggle');
    el.difficulty = document.getElementById('difficulty');
    el.difficultyItem = document.getElementById('difficultyItem');
    el.speed = document.getElementById('speed');
    el.speedItem = document.getElementById('speedItem');
    el.waitToggle = document.getElementById('waitToggle');
    el.waitItem = document.getElementById('waitItem');
    el.metronomeToggle = document.getElementById('metronomeToggle');
    el.metronomeItem = document.getElementById('metronomeItem');
    el.metronomeDot = document.getElementById('metronomeDot');
    el.demoToggle = document.getElementById('demoToggle');
    el.demoItem = document.getElementById('demoItem');
    el.songLabel = document.getElementById('songLabel');
    el.songLabelItem = document.getElementById('songLabelItem');
    el.demoBadge = document.getElementById('demoBadge');
    el.scrubberItem = document.getElementById('scrubberItem');
    el.scrubTrack = document.getElementById('scrubTrack');
    el.scrubFill = document.getElementById('scrubFill');
    el.scrubThumb = document.getElementById('scrubThumb');
    el.scrubCurrent = document.getElementById('scrubCurrent');
    el.scrubTotal = document.getElementById('scrubTotal');
    el.menuBtn = document.getElementById('menuBtn');
    el.pauseBtn = document.getElementById('pauseBtn');
    el.optionsBtn = document.getElementById('optionsBtn');
    el.optionsPanel = document.getElementById('optionsPanel');

    el.latencyToggle = document.getElementById('latencyToggle');
    el.latencyPanel = document.getElementById('latencyPanel');
    el.latencyStats = document.getElementById('latencyStats');
    el.latencyExportJSON = document.getElementById('latencyExportJSON');
    el.latencyExportCSV = document.getElementById('latencyExportCSV');
    el.latencyClear = document.getElementById('latencyClear');

    el.screenHome = document.getElementById('screen-home');
    el.screenLevels = document.getElementById('screen-levels');
    el.screenComplete = document.getElementById('screen-complete');
    el.screenPause = document.getElementById('screen-pause');
    el.levelList = document.getElementById('levelList');
    el.completeTitle = document.getElementById('completeTitle');
    el.completeStats = document.getElementById('completeStats');
    el.completeReport = document.getElementById('completeReport');
    el.btnNextLevel = document.getElementById('btnNextLevel');

    PH.render.init(el.canvas);
    PH.input.initKeyboard();
    PH.input.initPointer(el.canvas);
    PH.input.initMIDI(
      function (msg) { el.midiStatus.textContent = msg; },
      function (raw) {
        var cmd = raw.status & 0xf0;
        var kind = cmd === 0x90 && raw.velocity > 0 ? 'note-on'
                 : (cmd === 0x80 || (cmd === 0x90 && raw.velocity === 0)) ? 'note-off'
                 : '0x' + raw.status.toString(16);
        el.midiRaw.textContent = 'Última msg MIDI: ' + kind +
          ' — nota ' + raw.note + ' (' + PH.notes.noteName(raw.note) + '), vel ' + raw.velocity;
      }
    );

    window.addEventListener('notePlayed', function (e) { onNotePlayed(e.detail); });
    window.addEventListener('noteReleased', function (e) { onNoteReleased(e.detail); });

    document.getElementById('btnFree').addEventListener('click', startFree);
    document.getElementById('btnLevels').addEventListener('click', showLevels);
    document.getElementById('btnBackHome').addEventListener('click', showHome);
    document.getElementById('btnToLevelsFromComplete').addEventListener('click', showLevels);
    document.getElementById('btnRetryLevel').addEventListener('click', function () {
      el.overlay.hidden = true;
      state.running = true;
      reset();
    });
    el.btnNextLevel.addEventListener('click', function () {
      var next = nextSong();
      if (next) startSong(next);
    });

    el.menuBtn.addEventListener('click', function () {
      state.running = false;
      state.paused = false;
      showHome();
    });

    document.getElementById('restart').addEventListener('click', function () {
      state.paused = false;
      reset();
      el.canvas.focus();
    });

    el.optionsBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      setOptionsOpen(el.optionsPanel.hidden);
    });
    // Clicar dentro do painel não deve fechá-lo (só clicar fora, ou nos botões abaixo).
    el.optionsPanel.addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('click', function () { setOptionsOpen(false); });

    initScrubber();

    el.pauseBtn.addEventListener('click', togglePause);

    document.getElementById('btnResume').addEventListener('click', resumeGame);
    document.getElementById('btnRestartFromPause').addEventListener('click', function () {
      state.paused = false;
      el.overlay.hidden = true;
      state.running = true;
      reset();
    });
    document.getElementById('btnMenuFromPause').addEventListener('click', function () {
      state.running = false;
      state.paused = false;
      showHome();
    });

    // Esc fecha o menu de opções se estiver aberto; senão, pausa/retoma a partida em
    // andamento — não interfere com as teclas de nota (ver KEY_MAP em input.js), que
    // nunca usam Escape.
    window.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!el.optionsPanel.hidden) {
        e.preventDefault();
        setOptionsOpen(false);
      } else if (state.running || state.paused) {
        e.preventDefault();
        togglePause();
      }
    });

    el.hint.addEventListener('change', function () { state.hint = el.hint.checked; });

    el.effectsToggle.addEventListener('change', function () {
      state.effects = el.effectsToggle.checked;
      progress.prefs.effects = state.effects;
      saveProgressState();
    });

    el.muteToggle.addEventListener('change', function () {
      state.mutePiano = el.muteToggle.checked;
      progress.prefs.mutePiano = state.mutePiano;
      saveProgressState();
      PH.audio.setMuted(state.mutePiano);
    });

    el.difficulty.addEventListener('change', function () {
      sequence.setMode(el.difficulty.value);
      reset();
    });

    el.speed.addEventListener('change', function () {
      state.speed = parseFloat(el.speed.value) || 1;
      progress.prefs.speed = state.speed;
      saveProgressState();
      if (state.mode === 'song') reset();   // reaplica a nova velocidade à fase atual
    });

    el.waitToggle.addEventListener('change', function () {
      state.waitMode = el.waitToggle.checked;
      progress.prefs.wait = state.waitMode;
      saveProgressState();
    });

    el.metronomeToggle.addEventListener('change', function () {
      state.metronome = el.metronomeToggle.checked;
      progress.prefs.metronome = state.metronome;
      saveProgressState();
      if (state.metronome) PH.audio.unlock();
    });

    el.demoToggle.addEventListener('change', function () {
      state.demoMode = el.demoToggle.checked;
      progress.prefs.demo = state.demoMode;
      saveProgressState();
      updateDemoBadge();
    });

    el.latencyToggle.addEventListener('change', function () {
      el.latencyPanel.hidden = !el.latencyToggle.checked;
      updateLatencyPanel();
    });
    el.latencyExportJSON.addEventListener('click', function () { PH.latency.exportJSON(); });
    el.latencyExportCSV.addEventListener('click', function () { PH.latency.exportCSV(); });
    el.latencyClear.addEventListener('click', function () {
      PH.latency.clear();
      updateLatencyPanel();
    });

    progress = loadProgress();
    state.speed = progress.prefs.speed;
    state.effects = progress.prefs.effects;
    state.waitMode = progress.prefs.wait;
    state.metronome = progress.prefs.metronome;
    state.mutePiano = progress.prefs.mutePiano;
    state.demoMode = progress.prefs.demo;
    el.speed.value = String(state.speed);
    el.effectsToggle.checked = state.effects;
    el.waitToggle.checked = state.waitMode;
    el.metronomeToggle.checked = state.metronome;
    el.muteToggle.checked = state.mutePiano;
    el.demoToggle.checked = state.demoMode;
    PH.audio.setMuted(state.mutePiano);

    updateModeUI();
    reset();
    requestAnimationFrame(loop);
  }

  /* ---------------- navegação entre telas ---------------- */

  function showScreen(name) {
    el.screenHome.hidden = name !== 'home';
    el.screenLevels.hidden = name !== 'levels';
    el.screenComplete.hidden = name !== 'complete';
    el.screenPause.hidden = name !== 'pause';
    el.overlay.hidden = false;
    setOptionsOpen(false);   // evita o menu de opções ficar flutuando por cima da tela nova
  }

  function showHome() { showScreen('home'); }

  function showLevels() {
    renderLevelList();
    showScreen('levels');
  }

  function renderLevelList() {
    var html = '';
    for (var i = 0; i < PH.songs.length; i++) {
      var song = PH.songs[i];
      // Bloqueio de progressão desativado por enquanto (a pedido) — todas as fases
      // ficam livres pra jogar. `progress.unlocked` continua sendo salvo, então dá
      // pra reativar o gate depois só trocando essa condição de volta.
      var locked = false;
      var best = progress.best[song.id];
      html += '<button type="button" class="level-row' + (locked ? ' locked' : '') + '"' +
        ' data-index="' + i + '"' + (locked ? ' disabled' : '') + '>' +
        '<span class="level-num">' + (i + 1) + '</span>' +
        '<span class="level-info"><strong>' + song.title + '</strong><small>' + song.subtitle + ' · ' + song.bpm + ' BPM</small></span>' +
        (locked
          ? '<span class="level-lock">🔒</span>'
          : '<span class="level-score">' + (best ? best.accuracy + '%' : song.notes.length + ' notas') + '</span>') +
        '</button>';
    }
    el.levelList.innerHTML = html;

    var rows = el.levelList.querySelectorAll('.level-row:not(.locked)');
    for (var j = 0; j < rows.length; j++) {
      rows[j].addEventListener('click', onLevelClick);
    }
  }

  function onLevelClick() {
    var idx = parseInt(this.getAttribute('data-index'), 10);
    startSong(PH.songs[idx]);
  }

  /* ---------------- barra de progresso (voltar/avançar na música) ---------------- */

  function timeFromPointer(e) {
    var rect = el.scrubTrack.getBoundingClientRect();
    var frac = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0;
    frac = Math.max(0, Math.min(1, frac));
    return frac * state.songDuration;
  }

  /**
   * Arrastar/clicar na barra usa Pointer Events (unifica mouse/toque/pen) com
   * `setPointerCapture` — assim o arrasto continua "preso" na barra mesmo se o ponteiro
   * saltar pra fora dela no meio do gesto (comum quando o mouse se move rápido).
   * `state.scrubbing` suspende o relógio automático da música enquanto isso (ver
   * `updateSong()`) pra não competir com a posição que o jogador está escolhendo.
   */
  function initScrubber() {
    var dragging = false;

    function begin(e) {
      if (state.mode !== 'song' || !state.songDuration) return;
      dragging = true;
      state.scrubbing = true;
      el.scrubberItem.classList.add('scrubbing');
      el.scrubTrack.setPointerCapture(e.pointerId);
      seekTo(timeFromPointer(e));
    }

    function move(e) {
      if (!dragging) return;
      seekTo(timeFromPointer(e));
    }

    function end(e) {
      if (!dragging) return;
      dragging = false;
      state.scrubbing = false;
      el.scrubberItem.classList.remove('scrubbing');
      try { el.scrubTrack.releasePointerCapture(e.pointerId); } catch (err) { /* já liberado */ }
    }

    el.scrubTrack.addEventListener('pointerdown', begin);
    el.scrubTrack.addEventListener('pointermove', move);
    el.scrubTrack.addEventListener('pointerup', end);
    el.scrubTrack.addEventListener('pointercancel', end);

    // Roda do mouse sobre o palco ou a barra também volta/avança (passo fixo por notch).
    var WHEEL_STEP = 1.0;   // segundos por notch da roda
    function onWheel(e) {
      if (state.mode !== 'song' || !state.songDuration) return;
      e.preventDefault();
      seekTo(state.songTime + (e.deltaY > 0 ? WHEEL_STEP : -WHEEL_STEP));
    }
    document.getElementById('stage').addEventListener('wheel', onWheel, { passive: false });
    el.scrubberItem.addEventListener('wheel', onWheel, { passive: false });
  }

  /* ---------------- menu de opções ---------------- */

  function setOptionsOpen(open) {
    el.optionsPanel.hidden = !open;
    el.optionsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  /* ---------------- pausa ---------------- */

  function togglePause() {
    if (state.paused) resumeGame();
    else pauseGame();
  }

  function pauseGame() {
    if (!state.running) return;   // nada rodando (menu/fim de fase): não há o que pausar
    state.running = false;
    state.paused = true;
    updatePauseButton();
    updateDemoBadge();
    showScreen('pause');
  }

  function resumeGame() {
    if (!state.paused) return;
    state.paused = false;
    state.running = true;
    updatePauseButton();
    updateDemoBadge();
    el.overlay.hidden = true;
  }

  function updatePauseButton() {
    el.pauseBtn.textContent = state.paused ? '▶ Continuar' : '⏸ Pausar';
  }

  /* ---------------- progresso e preferências (localStorage) ---------------- */

  function loadProgress() {
    try {
      var raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return { unlocked: 0, best: {}, prefs: { speed: 1, effects: true, wait: false, metronome: false, mutePiano: false, demo: false } };
      var p = JSON.parse(raw);
      return {
        unlocked: p.unlocked || 0,
        best: p.best || {},
        prefs: {
          speed: (p.prefs && p.prefs.speed) || 1,
          effects: p.prefs && typeof p.prefs.effects === 'boolean' ? p.prefs.effects : true,
          wait: p.prefs && typeof p.prefs.wait === 'boolean' ? p.prefs.wait : false,
          metronome: p.prefs && typeof p.prefs.metronome === 'boolean' ? p.prefs.metronome : false,
          mutePiano: p.prefs && typeof p.prefs.mutePiano === 'boolean' ? p.prefs.mutePiano : false,
          demo: p.prefs && typeof p.prefs.demo === 'boolean' ? p.prefs.demo : false
        }
      };
    } catch (e) {
      return { unlocked: 0, best: {}, prefs: { speed: 1, effects: true, wait: false, metronome: false, mutePiano: false, demo: false } };
    }
  }

  function saveProgressState() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch (e) { /* privado/bloqueado: ignora */ }
  }

  function songIndexOf(id) {
    for (var i = 0; i < PH.songs.length; i++) {
      if (PH.songs[i].id === id) return i;
    }
    return -1;
  }

  function nextSong() {
    var idx = songIndexOf(state.song ? state.song.id : null);
    if (idx < 0 || idx + 1 >= PH.songs.length) return null;
    return PH.songs[idx + 1];
  }

  function saveProgress(songId, acc, score) {
    var idx = songIndexOf(songId);
    var best = progress.best[songId];
    if (!best || acc > best.accuracy || (acc === best.accuracy && score > best.score)) {
      progress.best[songId] = { accuracy: acc, score: score };
    }
    if (idx >= 0 && idx + 1 < PH.songs.length) {
      progress.unlocked = Math.max(progress.unlocked, idx + 1);
    }
    saveProgressState();
  }

  /* ---------------- início de modo ---------------- */

  function startFree() {
    state.mode = 'free';
    state.song = null;
    sequence.setMode(el.difficulty.value);
    PH.audio.unlock();
    watchPianoLoad();
    updateModeUI();
    reset();
    el.overlay.hidden = true;
    state.running = true;
  }

  function startSong(song) {
    state.mode = 'song';
    state.song = song;
    PH.audio.unlock();
    watchPianoLoad();
    updateModeUI();
    reset();
    el.overlay.hidden = true;
    state.running = true;
  }

  var pianoLoadWatched = false;
  function watchPianoLoad() {
    if (pianoLoadWatched) return;
    pianoLoadWatched = true;
    el.pianoStatus.textContent = '🎹 Carregando amostras de piano…';
    PH.audio.onReady(function () {
      el.pianoStatus.textContent = '🎹 Piano carregado.';
    });
  }

  function updateModeUI() {
    var isSong = state.mode === 'song';
    el.difficultyItem.hidden = isSong;
    el.speedItem.hidden = !isSong;
    el.waitItem.hidden = !isSong;
    el.metronomeItem.hidden = !isSong;
    el.demoItem.hidden = !isSong;
    el.songLabelItem.hidden = !isSong;
    el.scrubberItem.hidden = !isSong;
  }

  /* ---------------- ciclo de uma partida ---------------- */

  /** Duração de uma semínima (o "tempo" que `bpm` conta), em segundos, na velocidade atual. */
  function beatSeconds(song) {
    return 60 / (song.bpm * state.speed);
  }

  /**
   * Converte a música (notas + durações em ticks) numa linha do tempo em segundos.
   * Ticks são inteiros (resolução PPQ) — a soma nunca acumula erro de arredondamento;
   * só a conversão final ticks→segundos usa ponto flutuante, uma vez por nota.
   *
   * Cada posição de `song.notes` pode ser um midi (nota simples) ou um array de midis
   * (acorde — todas soam juntas, pela mesma duração) — por isso cada item da timeline
   * guarda `midis` (sempre array, mesmo pra nota simples: um acorde de 1 nota só).
   */
  function buildTimeline(song) {
    var secPerTick = beatSeconds(song) / PH.songTiming.PPQ;
    var ticks = 0;
    var out = [];
    for (var i = 0; i < song.notes.length; i++) {
      var durTicks = song.durations[i];
      var midis = Array.isArray(song.notes[i]) ? song.notes[i].slice() : [song.notes[i]];
      out.push({ midis: midis, time: ticks * secPerTick, dur: durTicks * secPerTick, index: i });
      ticks += durTicks;
    }
    return out;
  }

  function reset() {
    // Solta qualquer nota que ainda estivesse soando antes de trocar de fase/modo.
    Object.keys(state.held).forEach(function (midi) { PH.audio.stopNote(Number(midi)); });
    state.demoGen++;   // invalida setTimeouts de notas da demonstração agendados antes deste reset

    state.held = {};
    state.flashes = {};
    state.resolvedBars = [];
    state.score = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.hits = 0;
    state.misses = 0;
    state.log = [];
    sequence.last = null;

    if (state.mode === 'song' && state.song) {
      state.timeline = buildTimeline(state.song);
      state.cursor = 0;
      state.songTime = -PRE_ROLL;
      var last = state.timeline[state.timeline.length - 1];
      state.songDuration = last ? last.time + last.dur : 0;
      // Primeiro tempo (semínima) a soar: pode ser negativo (clique de contagem, durante
      // o pré-roll) — Math.ceil garante que não pulamos o tempo 0 por erro de arredondamento.
      state.nextClick = Math.ceil(state.songTime / beatSeconds(state.song));
      state.notes = [];
      state.targetMidis = state.timeline.length ? state.timeline[0].midis.slice() : [];
      showFeedback('Prepare-se…', 'info');
    } else {
      state.notes = [];
      fill();
      showFeedback('', null);
    }

    updateHUD();
    updateScrubber();
  }

  /* ---------------- modo livre: fila infinita, sem tempo ---------------- */

  function fill() {
    var layout = PH.render.getLayout();
    while (state.notes.length < VISIBLE_NOTES) {
      var midi = sequence.next();
      var last = state.notes[state.notes.length - 1];
      var y = last ? Math.min(last.y - layout.spacing, -layout.noteH)
                   : -layout.noteH;
      state.notes.push({ midi: midi, y: y });
    }
    state.targetMidis = state.notes.length ? [state.notes[0].midi] : [];
  }

  function updateFree(dt) {
    if (!state.running) return;
    var layout = PH.render.getLayout();
    for (var i = 0; i < state.notes.length; i++) {
      var cap = layout.hitLine - i * layout.spacing;
      state.notes[i].y = Math.min(state.notes[i].y + FALL_SPEED * dt, cap);
    }
    // Ecos de barras resolvidas no modo livre têm duração fixa (não há tempo/BPM aqui).
    for (var j = state.resolvedBars.length - 1; j >= 0; j--) {
      var rb = state.resolvedBars[j];
      rb.t -= dt / FLASH_TIME;
      if (rb.t <= 0) state.resolvedBars.splice(j, 1);
    }
  }

  function onFreeNote(played) {
    var target = state.targetMidis[0];
    holdKey(played, played === target);

    if (played === target) {
      var hitNote = state.notes[0];
      registerHit(played, false);
      state.resolvedBars.push({ midi: hitNote.midi, y: hitNote.y, len: PH.render.getLayout().noteH, t: 1 });
      state.notes.shift();
      fill();
    } else {
      state.misses++;
      state.combo = 0;
      if (state.effects) PH.render.burst(played, false);
      showFeedback('Era ' + PH.notes.noteNameOct(target) + '!', 'bad');
    }
    updateHUD();
  }

  /* ---------------- modo fase: linha do tempo com BPM/ticks ---------------- */

  /**
   * Salta o relógio da música pra `t` segundos (0..songDuration) — a barra de progresso
   * (arrastar/clicar/roda do mouse) e qualquer chamada futura de "voltar a música" devem
   * passar por aqui. Recalcula `cursor`/`targetMidis` a partir da nova posição (o primeiro
   * acorde cujo fim ainda não passou), solta notas que estivessem soando e limpa as barras
   * resolvidas antigas (não fazem sentido depois de um salto no tempo).
   */
  function seekTo(t) {
    if (state.mode !== 'song' || !state.timeline.length) return;
    state.songTime = Math.max(0, Math.min(t, state.songDuration));
    state.demoGen++;   // invalida setTimeouts de notas da demonstração agendados antes do salto

    Object.keys(state.held).forEach(function (midi) {
      PH.audio.stopNote(Number(midi));
      releaseKey(Number(midi));
    });
    state.resolvedBars = [];

    var timeline = state.timeline;
    var i = 0;
    while (i < timeline.length && timeline[i].time + timeline[i].dur <= state.songTime) i++;
    state.cursor = i;
    state.targetMidis = i < timeline.length ? timeline[i].midis.slice() : [];

    if (state.metronome) state.nextClick = Math.ceil(state.songTime / beatSeconds(state.song));

    updateHUD();
    syncSongNotes();
    updateScrubber();
  }

  function formatTime(seconds) {
    var s = Math.max(0, Math.round(seconds));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  /** Atualiza a posição visual da barra de progresso a partir de `state.songTime`. */
  function updateScrubber() {
    if (el.scrubberItem.hidden) return;
    var duration = state.songDuration || 0;
    var pct = duration > 0 ? Math.max(0, Math.min(1, state.songTime / duration)) * 100 : 0;
    el.scrubFill.style.width = pct + '%';
    el.scrubThumb.style.left = pct + '%';
    el.scrubCurrent.textContent = formatTime(state.songTime);
    el.scrubTotal.textContent = formatTime(duration);
  }

  /**
   * Recalcula quais notas aparecem na tela e onde, a partir do relógio da música.
   * Um "slot" da timeline pode ter mais de uma nota (acorde) — todas caem juntas, na
   * mesma posição y. O slot pendente (`state.cursor`) só mostra as notas que ainda faltam
   * tocar (`state.targetMidis`); as notas do acorde já tocadas somem daqui na hora (viram
   * barra resolvida em `onSongNote`), mesmo com o resto do acorde ainda caindo.
   */
  function syncSongNotes() {
    var layout = PH.render.getLayout();
    var pxPerSec = layout.hitLine / LEAD_TIME;
    var timeline = state.timeline;
    var arr = [];

    for (var i = state.cursor; i < timeline.length && (i - state.cursor) < VISIBLE_NOTES; i++) {
      var chord = timeline[i];
      var dt = chord.time - state.songTime;
      if (dt > LEAD_TIME + 0.05) break;
      // O comprimento da barra reflete a duração real da nota (semínima, mínima...) —
      // uma nota mais longa cai como uma barra mais comprida, e continua "soando"
      // (barra + tecla acesas) enquanto ela deveria estar sendo segurada.
      var len = Math.max(chord.dur * pxPerSec, layout.noteH);
      var y = layout.hitLine - dt * pxPerSec;
      var midis = i === state.cursor ? state.targetMidis : chord.midis;
      for (var m = 0; m < midis.length; m++) {
        arr.push({ midi: midis[m], y: y, len: len, chordIndex: i });
      }
    }

    state.notes = arr;

    // Barras já resolvidas continuam visíveis e "escorregando" até o fim da duração
    // escrita da nota, seguindo o mesmo relógio — é o efeito de acerto na própria
    // nota caindo, não só na tecla do piano.
    for (var j = state.resolvedBars.length - 1; j >= 0; j--) {
      var rb = state.resolvedBars[j];
      if (state.songTime > rb.time + rb.dur + 0.05) { state.resolvedBars.splice(j, 1); continue; }
      var rdt = rb.time - state.songTime;
      rb.y = layout.hitLine - rdt * pxPerSec;
      rb.len = Math.max(rb.dur * pxPerSec, layout.noteH);
    }
  }

  /** Passa pro próximo acorde se o tempo dele expirou sem o jogador acertar todas as notas. */
  function checkAutoMiss() {
    var timeline = state.timeline;
    while (state.cursor < timeline.length && state.songTime > timeline[state.cursor].time + HIT_WINDOW) {
      var missed = timeline[state.cursor];
      // Toda nota do acorde que ainda não foi tocada conta como perdida.
      state.targetMidis.forEach(function (midi) {
        state.misses++;
        state.combo = 0;
        state.log.push({ index: missed.index, expected: midi, result: 'timeout', deltaMs: null });
        flash(midi, false);
      });
      PH.audio.playTimeout();
      showFeedback('Perdeu: ' + missed.midis.map(PH.notes.noteNameOct).join(' + '), 'bad');
      state.cursor++;
      state.targetMidis = state.cursor < timeline.length ? timeline[state.cursor].midis.slice() : [];
      updateHUD();
    }
    checkSongEnd();
  }

  function checkSongEnd() {
    if (state.mode !== 'song' || state.cursor < state.timeline.length) return;
    if (state.demoMode) {
      // Demonstração é só uma prévia — não é uma tentativa de verdade, então não abre
      // a tela de "fase completa" nem grava progresso/pontuação.
      state.running = false;
      updateDemoBadge();
      showFeedback('Demonstração concluída — desative e tente você mesmo!', 'info');
    } else {
      finishSong();
    }
  }

  function updateSong(dt) {
    if (!state.running || state.scrubbing) return;   // arrastando a barra: o relógio fica em pausa
    var wasNegative = state.songTime < 0;
    // Modo espera: a nota "segura" o relógio da música na própria linha de acerto até o
    // jogador tocar — o relógio nunca passa do tempo da nota ainda não resolvida, então
    // checkAutoMiss() nunca vê tempo suficiente pra estourar a janela e dar timeout.
    // (Não se aplica em modo demonstração: lá a música sempre segue no tempo normal.)
    if (state.waitMode && !state.demoMode && state.cursor < state.timeline.length) {
      var capTime = state.timeline[state.cursor].time;
      state.songTime = Math.min(state.songTime + dt, capTime);
    } else {
      state.songTime += dt;
    }
    if (wasNegative && state.songTime >= 0) showFeedback('Vai!', 'good');
    if (state.demoMode) {
      advanceDemo();
    } else {
      checkAutoMiss();
    }
    if (state.metronome) scheduleMetronome();
  }

  /** Modo demonstração: a própria música "toca" cada acorde/nota no seu tempo, sem exigir input. */
  function advanceDemo() {
    var timeline = state.timeline;
    while (state.cursor < timeline.length && state.songTime >= timeline[state.cursor].time) {
      playDemoChord(timeline[state.cursor]);
      state.cursor++;
      // Crítico: sem isso, `state.targetMidis` (o que `syncSongNotes`/render.js desenham
      // como "a nota de agora") fica travado no primeiro acorde pra sempre, porque
      // `onSongNote()` — que normalmente atualiza isso — é ignorado no modo demonstração.
      state.targetMidis = state.cursor < timeline.length ? timeline[state.cursor].midis.slice() : [];
    }
    checkSongEnd();
  }

  /**
   * Toca e "segura" visualmente todas as notas de um acorde da timeline, sozinho.
   * Solta um pouco antes do próximo acorde (`durMs`) e com decaimento curto (`release`
   * proporcional à duração da nota, não o padrão de 0,25s) — numa passagem rápida de
   * semicolcheias, um decaimento longo demais embola uma nota na próxima, deixando a
   * demonstração soar "grudada"/borrada em vez de articulada.
   */
  function playDemoChord(chord) {
    var release = Math.min(0.25, chord.dur * 0.4);
    var gen = state.demoGen;   // ver seekTo()/reset(): se mudar antes do timeout, ele é ignorado
    chord.midis.forEach(function (midi) {
      PH.audio.startNote(midi, 1);
      holdKey(midi, true);
      state.resolvedBars.push({ midi: midi, time: chord.time, dur: chord.dur });
    });
    if (state.effects) PH.render.burst(chord.midis[0], true);
    var durMs = Math.max(chord.dur * 1000 - 20, 40);
    setTimeout(function () {
      if (state.demoGen !== gen) return;   // a música saltou de posição antes desse timer disparar
      chord.midis.forEach(function (midi) {
        PH.audio.stopNote(midi, release);
        releaseKey(midi);
      });
    }, durMs);
  }

  var CLICK_LOOKAHEAD = 0.15;   // segundos de antecedência pra agendar o próximo clique

  /**
   * Agenda os próximos cliques do metrônomo no relógio de precisão do Web Audio
   * (`ctx.currentTime`), não no `requestAnimationFrame` — é a técnica de "lookahead
   * scheduler" (agendar com alguns ms de antecedência num relógio de áudio estável) que
   * evita o jitter do event loop do JS chegar no som do clique. `state.songTime` (o
   * relógio da música, avançado por rAF) só decide QUANDO cada tempo cai; a hora exata
   * de tocar é convertida pro relógio do AudioContext, que é quem manda de verdade.
   */
  function scheduleMetronome() {
    var beatSec = beatSeconds(state.song);
    var beatsPerMeasure = state.song.timeSignature[0];
    while (state.nextClick * beatSec <= state.songTime + CLICK_LOOKAHEAD) {
      var beatTime = state.nextClick * beatSec;
      var audioTime = PH.audio.now() + (beatTime - state.songTime);
      var accent = ((state.nextClick % beatsPerMeasure) + beatsPerMeasure) % beatsPerMeasure === 0;
      PH.audio.playClick(Math.max(audioTime, PH.audio.now()), accent);
      pulseMetronomeDot(accent, (beatTime - state.songTime) * 1000);
      state.nextClick++;
    }
  }

  /** Acende o pontinho do metrônomo no instante certo (agendado com setTimeout, só visual). */
  function pulseMetronomeDot(accent, delayMs) {
    setTimeout(function () {
      el.metronomeDot.classList.add('tick');
      el.metronomeDot.classList.toggle('accent', accent);
      setTimeout(function () { el.metronomeDot.classList.remove('tick'); }, 90);
    }, Math.max(delayMs, 0));
  }

  function onSongNote(played) {
    if (state.demoMode) return;   // demonstração: a música toca sozinha, input do jogador não conta
    var timeline = state.timeline;
    if (state.cursor >= timeline.length) return;

    var chord = timeline[state.cursor];
    var dt = state.songTime - chord.time;   // negativo = adiantado, positivo = atrasado
    var onTime = state.waitMode || Math.abs(dt) <= HIT_WINDOW;
    var idx = state.targetMidis.indexOf(played);

    if (idx !== -1 && onTime) {
      var perfect = !state.waitMode && Math.abs(dt) <= PERFECT_WINDOW;
      state.targetMidis.splice(idx, 1);
      state.log.push({
        index: chord.index, expected: played, result: perfect ? 'perfect' : 'good',
        deltaMs: state.waitMode ? null : Math.round(dt * 1000)
      });
      holdKey(played, true);
      registerHit(played, perfect);
      state.resolvedBars.push({ midi: played, time: chord.time, dur: chord.dur });
      // Só avança pro próximo acorde quando TODAS as notas dele já foram tocadas.
      if (state.targetMidis.length === 0) {
        state.cursor++;
        state.targetMidis = state.cursor < timeline.length ? timeline[state.cursor].midis.slice() : [];
      }
    } else {
      state.misses++;
      state.combo = 0;
      state.log.push({ index: chord.index, expected: played, result: 'wrong', deltaMs: Math.round(dt * 1000) });
      holdKey(played, false);
      if (state.effects) PH.render.burst(played, false);
      showFeedback('Era ' + chord.midis.map(PH.notes.noteNameOct).join(' + ') + '!', 'bad');
    }

    updateHUD();
    checkSongEnd();
  }

  /** Comum a acerto no modo livre e na fase: pontuação, combo e efeito visual sutil. */
  function registerHit(played, perfect) {
    state.hits++;
    state.combo++;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.score += (perfect ? 15 : 10) * multiplier();

    if (state.effects) PH.render.burst(played, true);

    if (perfect) {
      if (state.effects) PH.render.ring(played, 'rgba(255,215,64,.9)');
      showFeedback('Perfeito!', 'good');
    } else {
      showFeedback(comboText(), 'good');
    }

    bump(el.score);
    if (state.combo > 1) bump(el.combo);
  }

  function finishSong() {
    state.running = false;
    var total = state.hits + state.misses;
    var acc = total ? Math.round(state.hits / total * 100) : 100;
    saveProgress(state.song.id, acc, state.score);

    var summary = summarizeLog();
    var hasNext = !!nextSong();

    el.completeTitle.textContent = '🎉 ' + state.song.title + ' completa!';
    el.completeStats.innerHTML =
      '<div class="stat"><span>Pontos</span><strong>' + state.score + '</strong></div>' +
      '<div class="stat"><span>Precisão</span><strong>' + acc + '%</strong></div>' +
      '<div class="stat"><span>Maior combo</span><strong>' + state.bestCombo + '</strong></div>';
    el.completeReport.innerHTML = buildReportHTML(summary, state.waitMode);
    el.btnNextLevel.hidden = !hasNext;

    showScreen('complete');
  }

  /* ---------------- relatório de performance ---------------- */

  function summarizeLog() {
    var perfect = 0, good = 0, wrong = 0, timeout = 0;
    var deltas = [];
    var missCount = {};

    state.log.forEach(function (e) {
      if (e.result === 'perfect') { perfect++; if (e.deltaMs != null) deltas.push(e.deltaMs); }
      else if (e.result === 'good') { good++; if (e.deltaMs != null) deltas.push(e.deltaMs); }
      else if (e.result === 'wrong') { wrong++; tallyMiss(e.expected); }
      else if (e.result === 'timeout') { timeout++; tallyMiss(e.expected); }
    });

    function tallyMiss(midi) {
      var name = PH.notes.noteNameOct(midi);
      missCount[name] = (missCount[name] || 0) + 1;
    }

    var avgDelta = deltas.length ? deltas.reduce(function (a, b) { return a + b; }, 0) / deltas.length : 0;

    var worst = Object.keys(missCount)
      .map(function (name) { return { name: name, count: missCount[name] }; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, 4);

    return { perfect: perfect, good: good, wrong: wrong, timeout: timeout, avgDelta: avgDelta, worst: worst };
  }

  function buildReportHTML(s, waitMode) {
    var chips =
      '<span class="chip perfect">Perfeitas: ' + s.perfect + '</span>' +
      '<span class="chip good">Boas: ' + s.good + '</span>' +
      '<span class="chip wrong">Notas erradas: ' + s.wrong + '</span>' +
      '<span class="chip timeout">Perdidas no tempo: ' + s.timeout + '</span>';

    var tendency;
    if (waitMode) {
      tendency = 'Modo espera: a música pausa em cada nota, então não há dado de tempo pra medir.';
    } else if (s.perfect + s.good === 0) {
      tendency = 'Sem acertos suficientes pra medir seu tempo ainda.';
    } else if (Math.abs(s.avgDelta) < 20) {
      tendency = 'Seu tempo está muito equilibrado (média de ' + Math.round(s.avgDelta) + ' ms).';
    } else if (s.avgDelta < 0) {
      tendency = 'Você tende a tocar adiantado: em média ' + Math.abs(Math.round(s.avgDelta)) + ' ms antes da hora.';
    } else {
      tendency = 'Você tende a tocar atrasado: em média ' + Math.round(s.avgDelta) + ' ms depois da hora.';
    }

    var worstHtml = s.worst.length
      ? '<p class="report-worst"><b>Pra praticar:</b> ' + s.worst.map(function (w) {
          return w.name + ' (' + w.count + 'x)';
        }).join(', ') + '</p>'
      : '';

    return '<div class="report">' +
      '<div class="report-chips">' + chips + '</div>' +
      '<p class="report-tendency">' + tendency + '</p>' +
      worstHtml +
      '</div>';
  }

  /* ---------------- comum aos dois modos ---------------- */

  function onNotePlayed(detail) {
    if (!state.running || state.targetMidis.length === 0) return;   // menu/tela de fim não reage a notas
    var tHandle = performance.now();
    PH.audio.startNote(detail.midi, state.targetMidis.indexOf(detail.midi) !== -1 ? 1 : 0.6, {
      source: detail.source, midi: detail.midi,
      t0: detail.t0, tDispatch: detail.tDispatch, tHandle: tHandle
    });
    updateLatencyPanel();
    if (state.mode === 'song') {
      onSongNote(detail.midi);
    } else {
      onFreeNote(detail.midi);
    }
  }

  /** A nota é solta (tecla física liberada) — para o som e inicia o eco visual. */
  function onNoteReleased(detail) {
    PH.audio.stopNote(detail.midi);
    releaseKey(detail.midi);
  }

  function multiplier() {
    return Math.min(1 + Math.floor(state.combo / 5), 5);
  }

  function comboText() {
    if (state.combo >= 20) return 'Em chamas! x' + multiplier();
    if (state.combo >= 10) return 'Mandou bem! x' + multiplier();
    if (state.combo >= 5) return 'Combo x' + multiplier();
    return 'Acertou!';
  }

  /** Marca a tecla como fisicamente pressionada agora — cor sólida enquanto durar. */
  function holdKey(midi, good) {
    state.held[midi] = { good: good };
  }

  /** Solta a tecla: some o "segurado" e começa o eco de brilho decrescente. */
  function releaseKey(midi) {
    var h = state.held[midi];
    if (!h) return;
    delete state.held[midi];
    flash(midi, h.good);
  }

  function flash(midi, good) {
    state.flashes[midi] = { t: 1, good: good };
  }

  function updateHUD() {
    el.score.textContent = state.score;
    el.combo.textContent = state.combo;
    var total = state.hits + state.misses;
    el.accuracy.textContent = total ? Math.round(state.hits / total * 100) + '%' : '—';

    if (state.mode === 'song' && state.song) {
      var songTotal = state.song.notes.length;
      var played = Math.min(state.cursor + 1, songTotal);
      el.songLabel.textContent = state.song.title + ' — ' + played + '/' + songTotal;
    }
    updateDemoBadge();
  }

  /** Mostra o selo "Demonstração — só observe" enquanto a música toca sozinha. */
  function updateDemoBadge() {
    el.demoBadge.hidden = !(state.mode === 'song' && state.demoMode && state.running);
  }

  /** Atualiza o painel de instrumentação de latência (latency.js) — só quando visível. */
  function updateLatencyPanel() {
    if (!PH.latency || el.latencyPanel.hidden) return;
    var s = PH.latency.getStats();
    if (!s.total) {
      el.latencyStats.textContent = 'Nenhuma amostra ainda — toque notas para coletar dados.';
      return;
    }
    var overall = '<div class="latency-row latency-overall"><span>Geral (' + s.overall.count + ')</span>' +
      '<span>média ' + s.overall.meanMs + ' ms · p95 ' + s.overall.p95Ms + ' ms</span></div>';
    var rows = ['midi', 'keyboard', 'pointer'].map(function (src) {
      var st = s.bySource[src];
      var value = st.count
        ? 'média ' + st.meanMs + ' ms · p95 ' + st.p95Ms + ' ms (n=' + st.count + ')'
        : '— sem amostras —';
      return '<div class="latency-row"><span>' + latencySourceLabel(src) + '</span><span>' + value + '</span></div>';
    }).join('');
    el.latencyStats.innerHTML = overall + rows;
  }

  function latencySourceLabel(src) {
    return src === 'midi' ? '🎹 MIDI' : src === 'keyboard' ? '⌨️ Teclado' : '🖱️ Mouse/toque';
  }

  function bump(node) {
    node.classList.remove('bump');
    void node.offsetWidth;   // reinicia a animação
    node.classList.add('bump');
    setTimeout(function () { node.classList.remove('bump'); }, 180);
  }

  var feedbackTimer = null;
  function showFeedback(text, kind) {
    el.feedback.textContent = text;
    el.feedback.className = 'feedback' + (text ? ' show ' + kind : '');
    clearTimeout(feedbackTimer);
    if (text) {
      feedbackTimer = setTimeout(function () {
        el.feedback.className = 'feedback';
      }, 900);
    }
  }

  /**
   * `dt` (com teto) suaviza partículas/eco de brilho — um pulo de frame não faz uma
   * partícula "teleportar". `rawDt` (sem teto) é o que avança o relógio da música: se
   * ele também tivesse teto, a aba perder um frame (segundo plano, engasgo do SO...)
   * faria o jogo achar que menos tempo passou do que passou de verdade, e o "muito
   * preciso" da fase 2 iria por água abaixo. O checkAutoMiss() já sabe absorver um
   * salto grande de uma vez (passa por várias notas perdidas no mesmo frame).
   */
  function update(dt, rawDt) {
    if (state.mode === 'song') {
      updateSong(rawDt);
    } else {
      updateFree(dt);
    }
    for (var midi in state.flashes) {
      state.flashes[midi].t -= dt / FLASH_TIME;
      if (state.flashes[midi].t <= 0) delete state.flashes[midi];
    }
  }

  var lastTime = 0;
  function loop(now) {
    var rawDt = lastTime ? (now - lastTime) / 1000 : 0;
    var dt = Math.min(rawDt, 0.05);
    lastTime = now;

    update(dt, rawDt);
    if (state.mode === 'song') {
      syncSongNotes();
      if (!state.scrubbing) updateScrubber();
    }
    PH.render.draw(state, dt);
    requestAnimationFrame(loop);
  }

  document.addEventListener('DOMContentLoaded', boot);
})(window.PianoHero);
