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
  var PRE_ROLL = 3;          // segundos de preparo (contagem 3-2-1) antes do tempo 0 da música
  var RESUME_COUNTDOWN = 3;  // segundos de contagem regressiva ao continuar depois de uma pausa
  var SEEK_STEP = 5;         // segundos por toque nos botões ⏪ / ⏩
  var MAX_SCORES = 5;        // quantas tentativas cada fase guarda no próprio ranking

  var el = {};
  var sequence = new PH.notes.Sequence('white');
  var progress = { unlocked: 0, best: {}, scores: {}, prefs: { speed: 1, effects: true, wait: false, metronome: false, mutePiano: false, demo: false } };

  var state = {
    mode: 'free',         // 'free' ou 'song'
    song: null,
    timeline: [],          // modo song: [{ midi, time, dur }] em segundos
    cursor: 0,             // modo song: índice da próxima nota a resolver
    songTime: 0,           // modo song: relógio da música (negativo durante o preparo)
    songDuration: 0,       // modo song: duração total da timeline (fim da última nota), em segundos
    demoGen: 0,            // incrementa a cada reset()/seekTo() — invalida setTimeouts velhos da demonstração
    scrubbing: false,      // true enquanto o jogador arrasta a barra de progresso (suspende o relógio)
    loopAFrac: null,       // modo fase: início do trecho marcado pra repetir, em fração (0..1) da duração
    loopBFrac: null,       // modo fase: fim do trecho marcado pra repetir, em fração (0..1) da duração
    loopEnabled: false,    // modo fase: true = ao chegar em loopBFrac, volta pra loopAFrac automaticamente
    speed: 1,              // multiplicador de velocidade (afeta o BPM efetivo da fase)
    waitMode: false,       // modo fase: true = a música pausa na nota até o jogador acertar
    metronome: false,      // modo fase: true = clique de referência em cada tempo (semínima)
    nextClick: 0,          // modo fase: índice do próximo tempo (semínima) a soar o clique
    effects: true,         // false = "modo foco": desliga partículas/tremor extras
    mutePiano: false,      // true = silencia o som do piano do PC (toca num piano externo de verdade)
    demoMode: false,       // modo fase: true = a música toca sozinha (auto-play), sem exigir input
    paused: false,         // true = jogo pausado (loop congelado, overlay de pausa visível)
    countdownTo: null,     // modo fase: songTime em que a contagem 3-2-1 termina; null = sem contagem
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
    el.loopTrack = document.getElementById('loopTrack');
    el.loopRange = document.getElementById('loopRange');
    el.loopHandleA = document.getElementById('loopHandleA');
    el.loopHandleB = document.getElementById('loopHandleB');
    el.loopToggleBtn = document.getElementById('loopToggleBtn');
    el.loopClearBtn = document.getElementById('loopClearBtn');
    el.menuBtn = document.getElementById('menuBtn');
    el.countdown = document.getElementById('countdown');
    el.optionsBtn = document.getElementById('optionsBtn');
    el.optionsPanel = document.getElementById('optionsPanel');

    el.latencyToggle = document.getElementById('latencyToggle');
    el.latencyPanel = document.getElementById('latencyPanel');
    el.latencyStats = document.getElementById('latencyStats');
    el.latencyExportJSON = document.getElementById('latencyExportJSON');
    el.latencyExportCSV = document.getElementById('latencyExportCSV');
    el.latencyClear = document.getElementById('latencyClear');

    el.screenHome = document.getElementById('screen-home');
    el.screenHelp = document.getElementById('screen-help');
    el.screenRanking = document.getElementById('screen-ranking');
    el.screenComplete = document.getElementById('screen-complete');
    el.screenPause = document.getElementById('screen-pause');
    el.screenSong = document.getElementById('screen-song');
    el.setupTitle = document.getElementById('setupTitle');
    el.setupSubtitle = document.getElementById('setupSubtitle');
    el.setupSpeed = document.getElementById('setupSpeed');
    el.setupRanking = document.getElementById('setupRanking');
    el.levelList = document.getElementById('levelList');
    el.rankingList = document.getElementById('rankingList');
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
    document.getElementById('btnHelp').addEventListener('click', function () { showScreen('help'); });
    initFullscreen();
    document.getElementById('btnBackHomeFromHelp').addEventListener('click', showHome);
    document.getElementById('btnPlayNormal').addEventListener('click', function () { playSongAs('normal'); });
    document.getElementById('btnPlayWait').addEventListener('click', function () { playSongAs('wait'); });
    document.getElementById('btnPlayDemo').addEventListener('click', function () { playSongAs('demo'); });
    document.getElementById('btnBackFromSong').addEventListener('click', showHome);
    document.getElementById('btnRanking').addEventListener('click', showRanking);
    document.getElementById('btnBackHomeFromRanking').addEventListener('click', showHome);
    document.getElementById('btnToLevelsFromComplete').addEventListener('click', showHome);
    document.getElementById('btnRetryLevel').addEventListener('click', function () {
      el.overlay.hidden = true;
      updateModeUI();   // a tela de fim escondeu a barra de progresso (ver showScreen)
      state.running = true;
      reset();
    });
    el.btnNextLevel.addEventListener('click', function () {
      var next = nextSong();
      if (next) showSongSetup(next);
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
    initLoopTrack();

    // Pausar como num vídeo: tocar/clicar no meio do palco (a área das notas caindo, acima
    // do teclado — o teclado continua sendo pra tocar notas). Um "toque" = soltar perto de
    // onde apertou, rápido (arrasto não pausa). Usa pointerdown/up e não `click`: o input.js
    // cancela o `touchstart` do canvas (pra o Safari não abrir a lupa de seleção ao segurar
    // uma tecla), e com isso o iPhone deixa de gerar `click` no canvas.
    var tapStart = null;
    el.canvas.addEventListener('pointerdown', function (e) {
      var r = el.canvas.getBoundingClientRect();
      tapStart = (e.clientY - r.top < PH.render.getLayout().pianoY)
        ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
    });
    el.canvas.addEventListener('pointerup', function (e) {
      if (!tapStart || !state.running) return;
      var moved = Math.abs(e.clientX - tapStart.x) + Math.abs(e.clientY - tapStart.y);
      if (moved < 16 && performance.now() - tapStart.t < 500) pauseGame();
      tapStart = null;
    });
    // ⏪ / ⏩: voltar/avançar alguns segundos. Ficam no topo (HUD) e na pausa — longe das
    // teclas, pra não esbarrar tocando (a barra de progresso fica só no PC).
    ['seekBackBtn', 'btnSeekBackPause'].forEach(function (id) {
      document.getElementById(id).addEventListener('click', function () { seekBy(-SEEK_STEP); });
    });
    ['seekFwdBtn', 'btnSeekFwdPause'].forEach(function (id) {
      document.getElementById(id).addEventListener('click', function () { seekBy(SEEK_STEP); });
    });
    // Na pausa, tocar fora dos botões (no "vídeo" parado) também continua.
    el.overlay.addEventListener('click', function (e) {
      if (e.target === el.overlay && state.paused) resumeGame();
    });

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

    // Músicas customizadas (songs/*.json, ver songs.js) carregam de forma assíncrona —
    // se a lista de fases já estiver aberta quando uma terminar de chegar, atualiza na
    // hora em vez de exigir recarregar a página.
    window.addEventListener('resize', drawMapPath);
    // Mapa horizontal: no PC a roda do mouse (vertical) passa as fases pro lado.
    el.levelList.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.levelList.scrollLeft += e.deltaY;
    }, { passive: false });
    PH.onSongsChanged = function () {
      if (!el.screenHome.hidden) renderLevelList();
    };

    updateModeUI();
    reset();
    renderLevelList();   // a tela inicial já abre com a lista de fases
    requestAnimationFrame(loop);
  }

  /* ---------------- tela cheia ---------------- */

  /**
   * Tela cheia pela Fullscreen API + trava em paisagem (o jogo no celular é deitado).
   * Só funciona dentro de um gesto do usuário, então: no celular, entra sozinha no
   * PRIMEIRO toque da página (uma vez só — se o jogador sair de propósito, não fica
   * forçando de novo), e o botão ⛶ do mapa liga/desliga quando quiser.
   * O Safari do iPhone não tem Fullscreen API pra páginas (só pra vídeo): lá o botão
   * abre a ajuda, que explica o "Adicionar à Tela de Início" (manifest.webmanifest +
   * metas apple-* no index.html fazem o app instalado abrir em tela cheia).
   */
  function fullscreenSupported() {
    var d = document.documentElement;
    return !!(d.requestFullscreen || d.webkitRequestFullscreen);
  }

  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function enterFullscreen() {
    if (isFullscreen() || !fullscreenSupported()) return;
    var d = document.documentElement;
    try {
      var p = d.requestFullscreen ? d.requestFullscreen({ navigationUI: 'hide' }) : d.webkitRequestFullscreen();
      if (p && p.then) p.then(lockLandscape).catch(function () { /* recusado pelo navegador */ });
      else lockLandscape();
    } catch (e) { /* sem suporte de verdade */ }
  }

  function lockLandscape() {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(function () { /* só Android, e só em tela cheia */ });
    }
  }

  function toggleFullscreen() {
    if (!fullscreenSupported()) { showScreen('help'); return; }
    if (isFullscreen()) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      enterFullscreen();
    }
  }

  function initFullscreen() {
    document.getElementById('btnFullscreen').addEventListener('click', toggleFullscreen);
    document.getElementById('rotateHint').addEventListener('click', enterFullscreen);
    if (PH.notes.COMPACT && fullscreenSupported()) {
      var once = function () {
        document.removeEventListener('click', once, true);
        enterFullscreen();
      };
      document.addEventListener('click', once, true);
    }
  }

  /* ---------------- navegação entre telas ---------------- */

  function showScreen(name) {
    el.screenHome.hidden = name !== 'home';
    el.screenHelp.hidden = name !== 'help';
    el.screenSong.hidden = name !== 'song';
    el.screenRanking.hidden = name !== 'ranking';
    el.screenComplete.hidden = name !== 'complete';
    el.screenPause.hidden = name !== 'pause';
    el.overlay.hidden = false;
    // Pausa "de vídeo": fundo quase transparente, dá pra ver as notas paradas no palco
    // (e elas se mexem ao arrastar a barra de progresso com o jogo pausado).
    el.overlay.classList.toggle('see-through', name === 'pause');
    // Fora da partida (menu, lista de fases, ranking, fim de fase) a barra de progresso some:
    // senão ela fica sobrando embaixo do palco, deixa a página mais alta que a janela e a roda
    // do mouse acaba rolando a página/mexendo na música em vez de rolar a lista de fases.
    // Na pausa ela continua visível, pra dar pra voltar/avançar antes de retomar.
    el.scrubberItem.hidden = !(state.mode === 'song' && name === 'pause');
    setOptionsOpen(false);   // evita o menu de opções ficar flutuando por cima da tela nova
  }

  /** A tela inicial é a própria lista de fases — sempre re-renderizada (melhor % pode ter mudado). */
  function showHome() {
    showScreen('home');
    renderLevelList();
  }

  function showRanking() {
    renderRankingList();
    showScreen('ranking');
  }

  function renderRankingList() {
    var ranked = [];
    for (var i = 0; i < PH.songs.length; i++) {
      var song = PH.songs[i];
      var best = progress.best[song.id];
      if (best) ranked.push({ song: song, best: best });
    }
    ranked.sort(function (a, b) { return b.best.score - a.best.score; });

    if (!ranked.length) {
      el.rankingList.innerHTML = '<p class="ranking-empty">Nenhuma fase completada ainda — jogue uma fase pra aparecer aqui.</p>';
      return;
    }

    var MEDALS = ['🥇', '🥈', '🥉'];
    var html = '';
    for (var r = 0; r < ranked.length; r++) {
      var entry = ranked[r];
      var dateText = entry.best.date ? new Date(entry.best.date).toLocaleDateString('pt-BR') : '';
      html += '<div class="level-row ranking-row">' +
        '<span class="level-num">' + (MEDALS[r] || (r + 1)) + '</span>' +
        '<span class="level-info"><strong>' + entry.song.title + '</strong>' +
        '<small>' + entry.best.accuracy + '% de precisão' +
        (entry.best.combo ? ' · combo ' + entry.best.combo : '') +
        (dateText ? ' · ' + dateText : '') + '</small></span>' +
        '<span class="level-score">' + entry.best.score + ' pts</span>' +
        '</div>';
    }
    el.rankingList.innerHTML = html;
  }

  /**
   * Tela inicial = mapa de fases: bolhas numeradas lado a lado, subindo e descendo em
   * zigue-zague e ligadas por uma trilha, como o mapa de fases de um jogo mobile — a
   * sequência (fase 1 → 2 → 3…) aparece no próprio desenho, e dá pra ir passando pro lado
   * (arrastar no celular, roda do mouse no PC). Horizontal porque o jogo no celular é
   * deitado: a tela é larga e baixa. Fase concluída mostra a melhor precisão; a primeira
   * ainda não concluída é a "atual" (destacada, e o mapa já abre rolado até ela).
   */
  var MAP_K = [0.5, 1, 0.5, 0];   // altura relativa (0 = topo, 1 = base) de cada bolha, repetindo o zigue-zague

  /**
   * Fases que aparecem no mapa. No celular (teclado de 1 oitava) só as que cabem inteiras
   * nele (`PH.notes.songFits`) — músicas largas espremidas numa oitava ficariam
   * irreconhecíveis; as de celular foram escritas pra essa faixa (ver songs.js).
   */
  function availableSongs() {
    return PH.notes.COMPACT ? PH.songs.filter(PH.notes.songFits) : PH.songs;
  }

  function renderLevelList() {
    var current = -1;
    var songs = availableSongs();
    var html = '<svg class="map-path" aria-hidden="true"><path/></svg>';
    for (var i = 0; i < songs.length; i++) {
      var song = songs[i];
      var best = progress.best[song.id];
      if (!best && current === -1) current = i;
      var cls = best ? ' done' : (i === current ? ' current' : '');
      html += '<div class="map-node"><div class="map-stop" style="--k:' + MAP_K[i % MAP_K.length] + '">' +
        '<button type="button" class="map-bubble' + cls + '" data-index="' + i + '"' +
        ' aria-label="Fase ' + (i + 1) + ': ' + song.title + '">' +
        '<span class="map-num">' + (i + 1) + '</span>' +
        (best ? '<span class="map-best">' + best.accuracy + '%</span>' : '') +
        '</button>' +
        '<span class="map-label">' + song.title + '</span>' +
        '</div></div>';
    }
    el.levelList.innerHTML = html;

    var bubbles = el.levelList.querySelectorAll('.map-bubble');
    for (var j = 0; j < bubbles.length; j++) {
      bubbles[j].addEventListener('click', onLevelClick);
    }
    drawMapPath();
    var cur = el.levelList.querySelector('.map-bubble.current');
    if (cur) el.levelList.scrollLeft = Math.max(0, cur.closest('.map-node').offsetLeft - el.levelList.clientWidth / 3);
  }

  /** Trilha curva ligando o centro de cada bolha à próxima (refeita quando a largura muda). */
  function drawMapPath() {
    var svg = el.levelList.querySelector('.map-path');
    if (!svg || el.screenHome.hidden) return;
    var bubbles = el.levelList.querySelectorAll('.map-bubble');
    var box = el.levelList.getBoundingClientRect();
    var pts = [];
    for (var i = 0; i < bubbles.length; i++) {
      var r = bubbles[i].getBoundingClientRect();
      pts.push({ x: r.left - box.left + el.levelList.scrollLeft + r.width / 2,
                 y: r.top - box.top + el.levelList.scrollTop + r.height / 2 });
    }
    var d = '';
    pts.forEach(function (pt, k) {
      if (k === 0) { d = 'M' + pt.x + ' ' + pt.y; return; }
      var prev = pts[k - 1], midX = (prev.x + pt.x) / 2;
      d += ' C' + midX + ' ' + prev.y + ' ' + midX + ' ' + pt.y + ' ' + pt.x + ' ' + pt.y;
    });
    svg.setAttribute('width', el.levelList.scrollWidth);
    svg.setAttribute('height', el.levelList.scrollHeight);
    svg.querySelector('path').setAttribute('d', d);
  }

  function onLevelClick() {
    var idx = parseInt(this.getAttribute('data-index'), 10);
    showSongSetup(availableSongs()[idx]);
  }

  /* ---------------- escolher como tocar a fase ---------------- */

  var setupSong = null;

  /**
   * Tela entre a lista e a partida: escolher o jeito de tocar (normal / modo espera /
   * demonstração) e a velocidade, em vez de deixar isso escondido no menu ⚙ da partida.
   * A escolha só sincroniza os mesmos toggles/preferências do menu ⚙ — não é um estado
   * paralelo, então mudar lá durante a partida continua funcionando igual.
   */
  function showSongSetup(song) {
    setupSong = song;
    el.setupTitle.textContent = song.title;
    el.setupSubtitle.textContent = song.subtitle || '';
    var html = '';
    SPEED_MULTIPLIERS.forEach(function (mult) {
      html += '<option value="' + mult + '"' + (mult === state.speed ? ' selected' : '') + '>' +
        Math.round(song.bpm * mult) + ' BPM' + (mult === 1 ? ' (original)' : '') + '</option>';
    });
    el.setupSpeed.innerHTML = html;
    el.setupRanking.innerHTML = buildSongRankingHTML(song);
    showScreen('song');
  }

  function buildSongRankingHTML(song) {
    var list = scoresFor(song.id);
    if (!list.length) return '<p class="ranking-empty">Nenhuma tentativa ainda — seja o primeiro!</p>';
    var MEDALS = ['🥇', '🥈', '🥉'];
    return '<div class="setup-ranking-title">🏆 Ranking da fase</div>' + list.map(function (e, i) {
      var details = e.accuracy + '%' + (e.combo ? ' · combo ' + e.combo : '') +
        (e.wait ? ' · espera' : '') +
        (e.speed && e.speed !== 1 ? ' · ' + Math.round(song.bpm * e.speed) + ' BPM' : '') +
        (e.date ? ' · ' + new Date(e.date).toLocaleDateString('pt-BR') : '');
      return '<div class="setup-rank-row"><span class="setup-rank-pos">' + (MEDALS[i] || (i + 1) + 'º') + '</span>' +
        '<span class="setup-rank-info">' + details + '</span>' +
        '<span class="setup-rank-score">' + e.score + ' pts</span></div>';
    }).join('');
  }

  function playSongAs(kind) {
    if (!setupSong) return;
    state.waitMode = kind === 'wait';
    state.demoMode = kind === 'demo';
    state.speed = parseFloat(el.setupSpeed.value) || 1;
    el.waitToggle.checked = state.waitMode;
    el.demoToggle.checked = state.demoMode;
    el.speed.value = String(state.speed);
    progress.prefs.wait = state.waitMode;
    progress.prefs.demo = state.demoMode;
    progress.prefs.speed = state.speed;
    saveProgressState();
    startSong(setupSong);
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
      // Mexer na barra pausa o jogo: dá pra procurar o trecho vendo as notas paradas no
      // palco; ao continuar vem a contagem 3-2-1 (ver resumeGame()).
      pauseGame();
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
      // Com uma tela de menu aberta por cima do palco (lista de fases, ranking, fim de fase),
      // a roda deve rolar essa tela normalmente, não mexer na posição da música.
      if (!el.overlay.hidden && el.screenPause.hidden) return;
      e.preventDefault();
      pauseGame();
      seekTo(state.songTime + (e.deltaY > 0 ? WHEEL_STEP : -WHEEL_STEP));
    }
    document.getElementById('stage').addEventListener('wheel', onWheel, { passive: false });
    el.scrubberItem.addEventListener('wheel', onWheel, { passive: false });
  }

  /* ---------------- repetir trecho (loop A/B, prática) ---------------- */

  /**
   * As marcações do trecho ficam guardadas como fração (0..1) da duração da música, não em
   * segundos absolutos — assim sobrevivem a uma troca de velocidade (`speed`), que reconstrói
   * a timeline inteira com um `songDuration` diferente (ver `reset()`/`buildTimeline()`); a
   * mesma posição musical continua valendo a mesma fração mesmo com a duração mudando.
   */
  var LOOP_MIN_FRAC = 0.008;   // trechos menores que ~0.8% da música são tratados como clique sem querer

  function clearLoop() {
    state.loopAFrac = null;
    state.loopBFrac = null;
    state.loopEnabled = false;
    updateLoopUI();
  }

  function toggleLoopEnabled() {
    if (state.loopAFrac == null || state.loopBFrac == null) return;
    state.loopEnabled = !state.loopEnabled;
    updateLoopUI();
  }

  /** Reflete o estado do loop nos botões e no realce sobre a faixa dedicada abaixo da barra. */
  function updateLoopUI() {
    var hasA = state.loopAFrac != null;
    var hasB = state.loopBFrac != null;
    var hasRange = hasA && hasB;
    el.loopToggleBtn.disabled = !hasRange;
    el.loopToggleBtn.classList.toggle('active', state.loopEnabled);
    el.loopClearBtn.hidden = !hasA && !hasB;

    el.loopRange.hidden = !hasRange;
    if (hasRange) {
      el.loopRange.style.left = (state.loopAFrac * 100) + '%';
      el.loopRange.style.width = ((state.loopBFrac - state.loopAFrac) * 100) + '%';
    }
  }

  /**
   * Arrastar na faixa dedicada (`#loopTrack`, abaixo da barra de progresso) define o trecho a
   * repetir num gesto só: começar num ponto vazio desenha uma seleção nova entre onde o arrasto
   * começou e onde está agora; começar em cima de uma alça (`#loopHandleA`/`B`) ajusta só aquela
   * ponta; começar no meio do realce dourado (`#loopRange`) arrasta o trecho inteiro sem mudar o
   * tamanho dele. Usa Pointer Events + `setPointerCapture`, igual ao `initScrubber()` da barra
   * principal, mas é uma faixa própria — nunca compete com o gesto de "pular no tempo" de lá.
   */
  function initLoopTrack() {
    var mode = null;   // null | 'create' | 'handleA' | 'handleB' | 'move'
    var startFrac = 0, origA = 0, origB = 0;

    function fracFromPointer(e) {
      var rect = el.loopTrack.getBoundingClientRect();
      var frac = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0;
      return Math.max(0, Math.min(1, frac));
    }

    function begin(e) {
      if (state.mode !== 'song' || !state.songDuration) return;
      var frac = fracFromPointer(e);
      if (e.target === el.loopHandleA) {
        mode = 'handleA';
      } else if (e.target === el.loopHandleB) {
        mode = 'handleB';
      } else if (e.target === el.loopRange) {
        mode = 'move';
        startFrac = frac;
        origA = state.loopAFrac;
        origB = state.loopBFrac;
      } else {
        mode = 'create';
        startFrac = frac;
        state.loopAFrac = frac;
        state.loopBFrac = frac;
        state.loopEnabled = false;
      }
      el.loopTrack.setPointerCapture(e.pointerId);
      updateLoopUI();
    }

    function move(e) {
      if (!mode) return;
      var frac = fracFromPointer(e);
      if (mode === 'create') {
        state.loopAFrac = Math.min(startFrac, frac);
        state.loopBFrac = Math.max(startFrac, frac);
      } else if (mode === 'handleA') {
        state.loopAFrac = Math.min(frac, state.loopBFrac - LOOP_MIN_FRAC);
      } else if (mode === 'handleB') {
        state.loopBFrac = Math.max(frac, state.loopAFrac + LOOP_MIN_FRAC);
      } else if (mode === 'move') {
        var width = origB - origA;
        var newA = Math.max(0, Math.min(1 - width, origA + (frac - startFrac)));
        state.loopAFrac = newA;
        state.loopBFrac = newA + width;
      }
      updateLoopUI();
    }

    function end(e) {
      if (!mode) return;
      // Um "clique" (arrasto praticamente nulo) ao criar não vira um trecho de duração ~0:
      // é descartado, pra não travar o loop numa marcação acidental de um só ponto.
      if (mode === 'create' && state.loopBFrac - state.loopAFrac < LOOP_MIN_FRAC) {
        state.loopAFrac = null;
        state.loopBFrac = null;
      } else if (mode === 'create') {
        state.loopEnabled = true;   // desenhar um trecho novo já liga a repetição
      }
      mode = null;
      try { el.loopTrack.releasePointerCapture(e.pointerId); } catch (err) { /* já liberado */ }
      updateLoopUI();
    }

    el.loopTrack.addEventListener('pointerdown', begin);
    el.loopTrack.addEventListener('pointermove', move);
    el.loopTrack.addEventListener('pointerup', end);
    el.loopTrack.addEventListener('pointercancel', end);

    el.loopToggleBtn.addEventListener('click', toggleLoopEnabled);
    el.loopClearBtn.addEventListener('click', clearLoop);
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
    // Pausado, nada deve ficar soando nem aceso.
    Object.keys(state.held).forEach(function (midi) {
      PH.audio.stopNote(Number(midi));
      releaseKey(Number(midi));
    });
    state.demoGen++;   // invalida notas da demonstração agendadas pra depois da pausa
    hideCountdown();
    updateDemoBadge();
    showScreen('pause');
  }

  /**
   * Continua. No modo fase não volta "a seco" no mesmo instante: recua o relógio
   * RESUME_COUNTDOWN segundos e mostra 3-2-1 — as notas a partir de onde parou voltam a
   * cair de cima, dando tempo de ver o que vem (e de se reposicionar depois de mexer na
   * barra de progresso). Só o relógio recua: `cursor`/`targetMidis` continuam na nota
   * pendente, então notas de antes do ponto de pausa não voltam a ser cobradas.
   */
  function resumeGame() {
    if (!state.paused) return;
    state.paused = false;
    el.overlay.hidden = true;
    if (state.mode === 'song' && state.cursor < state.timeline.length) {
      var resumeAt = state.songTime;
      state.resolvedBars = [];
      state.songTime = resumeAt - RESUME_COUNTDOWN;
      state.countdownTo = resumeAt;
      if (state.metronome) state.nextClick = Math.ceil(state.songTime / beatSeconds(state.song));
      syncSongNotes();
    }
    state.running = true;
    updateDemoBadge();
  }

  /**
   * Volta/avança `sec` segundos. Pausa junto (como arrastar a barra): o jogador vê as notas
   * do novo ponto paradas no palco e, ao continuar, vem a contagem 3-2-1.
   */
  function seekBy(sec) {
    if (state.mode !== 'song' || !state.timeline.length) return;
    pauseGame();
    seekTo(state.songTime + sec);
  }

  /* ---------------- contagem regressiva (3-2-1) ---------------- */

  var countdownShown = null;
  function updateCountdown() {
    if (state.countdownTo == null || state.mode !== 'song') return;
    var remaining = state.countdownTo - state.songTime;
    if (remaining <= 0) {
      hideCountdown();
      showFeedback('Vai!', 'good');
      return;
    }
    var n = Math.ceil(remaining);
    if (n !== countdownShown) {
      countdownShown = n;
      el.countdown.textContent = n;
      el.countdown.hidden = false;
      el.countdown.classList.remove('pop');   // reinicia a animação a cada número
      void el.countdown.offsetWidth;
      el.countdown.classList.add('pop');
    }
  }

  function hideCountdown() {
    state.countdownTo = null;
    countdownShown = null;
    el.countdown.hidden = true;
  }

  /* ---------------- progresso e preferências (localStorage) ---------------- */

  function loadProgress() {
    try {
      var raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return { unlocked: 0, best: {}, scores: {}, prefs: { speed: 1, effects: true, wait: false, metronome: false, mutePiano: false, demo: false } };
      var p = JSON.parse(raw);
      return {
        unlocked: p.unlocked || 0,
        best: p.best || {},
        scores: p.scores || {},
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
      return { unlocked: 0, best: {}, scores: {}, prefs: { speed: 1, effects: true, wait: false, metronome: false, mutePiano: false, demo: false } };
    }
  }

  function saveProgressState() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch (e) { /* privado/bloqueado: ignora */ }
  }

  /** Tentativas guardadas da fase (progresso de antes do ranking por fase só tem a melhor). */
  function scoresFor(songId) {
    if (progress.scores[songId]) return progress.scores[songId].slice();
    return progress.best[songId] ? [progress.best[songId]] : [];
  }

  function songIndexOf(id) {
    for (var i = 0; i < PH.songs.length; i++) {
      if (PH.songs[i].id === id) return i;
    }
    return -1;
  }

  function nextSong() {
    var songs = availableSongs();
    var idx = state.song ? songs.indexOf(state.song) : -1;
    if (idx < 0 || idx + 1 >= songs.length) return null;
    return songs[idx + 1];
  }

  function saveProgress(songId, acc, score, combo) {
    var idx = songIndexOf(songId);
    var best = progress.best[songId];
    var entry = { accuracy: acc, score: score, combo: combo, date: Date.now(), wait: state.waitMode, speed: state.speed };
    if (!best || score > best.score || (score === best.score && acc > best.accuracy)) {
      progress.best[songId] = entry;
    }
    // Ranking da própria fase: as MAX_SCORES melhores tentativas, não só a melhor.
    var list = scoresFor(songId).concat([entry]);
    list.sort(function (a, b) { return b.score - a.score || b.accuracy - a.accuracy; });
    progress.scores[songId] = list.slice(0, MAX_SCORES);
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
    clearLoop();   // marcações de trecho são por música — não fazem sentido levadas pra outra
    PH.audio.unlock();
    watchPianoLoad();
    updateModeUI();
    updateSpeedOptions();
    reset();
    el.overlay.hidden = true;
    state.running = true;
  }

  /** O seletor de velocidade mostra BPM de verdade (calculado a partir do BPM da fase
   *  atual), não a porcentagem crua — o valor interno (0.5..1.5, usado em beatSeconds())
   *  continua sendo o multiplicador, só o texto exibido muda por música. */
  var SPEED_MULTIPLIERS = [0.5, 0.75, 1, 1.25, 1.5];
  function updateSpeedOptions() {
    if (!state.song) return;
    var opts = el.speed.options;
    for (var i = 0; i < opts.length && i < SPEED_MULTIPLIERS.length; i++) {
      opts[i].textContent = Math.round(state.song.bpm * SPEED_MULTIPLIERS[i]) + ' BPM';
    }
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
    document.body.classList.toggle('song-mode', isSong);   // mostra ⏪/⏩ (HUD e pausa), ver style.css
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
   *
   * `dur` é a duração "rítmica" (até a próxima nota ficar devida — controla o timing do
   * jogo e o tamanho da barra caindo). `sustain` é quanto tempo a nota deveria soar de
   * verdade, que pode ser MAIOR que `dur` quando a música tem duas vozes (ex.: um baixo
   * segurando uma mínima enquanto a melodia já passou pra próxima colcheia) — usado só
   * pelo modo demonstração (`playDemoChord`), pra soltar a nota no tempo musicalmente
   * certo em vez de cortá-la na hora que a próxima fica devida. Músicas sem
   * `sustainDurations` (todas as fases escritas à mão) simplesmente têm sustain == dur,
   * igual sempre foi.
   */
  function buildTimeline(song) {
    var secPerTick = beatSeconds(song) / PH.songTiming.PPQ;
    // Música inteira transposta em oitavas pra caber no teclado desenhado (0 no PC). Se
    // nem assim couber, cada nota é trazida pra faixa sozinha (fitMidi) como último recurso.
    var shift = PH.notes.songShift(song);
    var ticks = 0;
    var out = [];
    for (var i = 0; i < song.notes.length; i++) {
      var durTicks = song.durations[i];
      var sustainTicks = song.sustainDurations ? song.sustainDurations[i] : durTicks;
      var raw = Array.isArray(song.notes[i]) ? song.notes[i] : [song.notes[i]];
      // Dois sons do acorde podem cair na mesma tecla depois do fitMidi (ex.: baixo e
      // melodia em oitavas) — viram uma só, senão o acorde exigiria tocar a mesma tecla
      // duas vezes e nunca terminaria.
      var midis = [];
      raw.forEach(function (midi) {
        var fitted = shift !== null ? midi + shift : PH.notes.fitMidi(midi);
        if (midis.indexOf(fitted) === -1) midis.push(fitted);
      });
      out.push({
        midis: midis, time: ticks * secPerTick,
        dur: durTicks * secPerTick, sustain: sustainTicks * secPerTick,
        index: i
      });
      ticks += durTicks;
    }
    return out;
  }

  function reset() {
    // Solta qualquer nota que ainda estivesse soando antes de trocar de fase/modo.
    Object.keys(state.held).forEach(function (midi) { PH.audio.stopNote(Number(midi)); });
    state.demoGen++;   // invalida setTimeouts de notas da demonstração agendados antes deste reset
    hideCountdown();

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
      state.countdownTo = 0;
      var last = state.timeline[state.timeline.length - 1];
      state.songDuration = last ? last.time + last.dur : 0;
      // Primeiro tempo (semínima) a soar: pode ser negativo (clique de contagem, durante
      // o pré-roll) — Math.ceil garante que não pulamos o tempo 0 por erro de arredondamento.
      state.nextClick = Math.ceil(state.songTime / beatSeconds(state.song));
      state.notes = [];
      state.targetMidis = state.timeline.length ? state.timeline[0].midis.slice() : [];
      showFeedback('', null);
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
    hideCountdown();

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
    // Repetir trecho: ao alcançar (ou passar) a marca de fim, volta pra marca de início
    // usando `seekTo()` (nunca setando `state.songTime` direto), pra também resolver
    // `cursor`/`targetMidis` de novo a partir da nova posição.
    if (state.loopEnabled && state.loopBFrac != null && state.loopAFrac != null &&
        state.songTime >= state.loopBFrac * state.songDuration) {
      seekTo(state.loopAFrac * state.songDuration);
      return;
    }
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
    // `sustain` (não `dur`) decide quanto tempo a nota soa aqui — ver o comentário em
    // buildTimeline(). Numa música com duas vozes, isso deixa a nota grave "segurando"
    // de verdade em vez de ser cortada assim que a melodia passa pra próxima colcheia.
    var release = Math.min(0.25, chord.sustain * 0.4);
    var gen = state.demoGen;   // ver seekTo()/reset(): se mudar antes do timeout, ele é ignorado
    chord.midis.forEach(function (midi) {
      PH.audio.startNote(midi, 1);
      holdKey(midi, true);
      state.resolvedBars.push({ midi: midi, time: chord.time, dur: chord.sustain });
    });
    if (state.effects) PH.render.burst(chord.midis[0], true);
    var durMs = Math.max(chord.sustain * 1000 - 20, 40);
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
    saveProgress(state.song.id, acc, state.score, state.bestCombo);

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
      updateCountdown();
      syncSongNotes();
      if (!state.scrubbing) updateScrubber();
    }
    PH.render.draw(state, dt);
    requestAnimationFrame(loop);
  }

  document.addEventListener('DOMContentLoaded', boot);
})(window.PianoHero);
