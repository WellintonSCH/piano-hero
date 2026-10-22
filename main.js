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
  var REWIND_ANIM = 0.6;     // segundos (reais) da animação das notas voltando pra cima ao continuar
  var SEEK_STEP = 5;         // segundos por toque nos botões ⏪ / ⏩
  var MAX_SCORES = 5;        // quantas tentativas cada fase guarda no próprio ranking
  var BPM_MIN = 20;          // BPM mais lento do seletor de velocidade (qualquer valor inteiro até o máximo)
  var BPM_MAX_FACTOR = 2;    // BPM mais rápido do seletor = BPM original da fase × isso
  var SPEED_RECORD_MIN_ACC = 80;   // precisão mínima (%) pra uma tentativa valer como recorde de velocidade

  var el = {};
  var sequence = new PH.notes.Sequence('white');
  var progress = loadProgress();   // recarregado em init(), junto com as preferências

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
    practiceHand: 'both',  // modo fase: 'both' | 'R' | 'L' — mão praticada; a outra toca sozinha
    autoTimeline: [],      // modo fase: notas da OUTRA mão (praticando uma só), tocadas sozinhas
    autoCursor: 0,         // modo fase: próxima posição de autoTimeline a tocar
    paused: false,         // true = jogo pausado (loop congelado, overlay de pausa visível)
    countdownTo: null,     // modo fase: songTime em que a contagem 3-2-1 termina; null = sem contagem
    rewind: null,          // modo fase: animação de rebobinar ao continuar { from, to, t (0..1) }; null = nenhuma
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
    el.handBadge = document.getElementById('handBadge');
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
    el.vScrub = document.getElementById('vScrub');
    el.vScrubTrack = document.getElementById('vScrubTrack');
    el.vScrubFill = document.getElementById('vScrubFill');
    el.vScrubThumb = document.getElementById('vScrubThumb');
    el.vScrubTime = document.getElementById('vScrubTime');
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
    el.setupBpm = document.getElementById('setupBpm');
    el.setupBpmOut = document.getElementById('setupBpmOut');
    el.setupLast = document.getElementById('setupLast');
    el.speedOut = document.getElementById('speedOut');
    el.setupRanking = document.getElementById('setupRanking');
    el.setupRankingBox = document.getElementById('setupRankingBox');
    el.setupRankingSummary = document.getElementById('setupRankingSummary');
    el.setupHand = document.getElementById('setupHand');
    el.setupHandSection = document.getElementById('setupHandSection');
    el.btnPlayNormal = document.getElementById('btnPlayNormal');
    el.btnPlayWait = document.getElementById('btnPlayWait');
    el.btnPlayDemoText = document.querySelector('#btnPlayDemo .setup-text');
    el.setupListenHint = document.getElementById('setupListenHint');
    el.setupHandHint = document.getElementById('setupHandHint');
    el.setupHand.addEventListener('click', function (e) {
      var b = e.target.closest('[data-hand]');
      if (b) { state.practiceHand = b.getAttribute('data-hand'); refreshSegmented(); }
    });
    // Velocidade: qualquer BPM inteiro — arrastar o slider ou ±1 nos botões. Só mexe no
    // valor escolhido (barato); a linha do tempo só é montada ao começar a partida.
    el.setupBpm.addEventListener('input', function () { setSetupBpm(parseInt(el.setupBpm.value, 10)); });
    document.getElementById('setupBpmMinus').addEventListener('click', function () { setSetupBpm(setupBpmValue - 1); });
    document.getElementById('setupBpmPlus').addEventListener('click', function () { setSetupBpm(setupBpmValue + 1); });
    document.getElementById('setupBpmReset').addEventListener('click', function () {
      if (setupSong) setSetupBpm(setupSong.bpm);
    });
    el.levelList = document.getElementById('levelList');
    el.rankingList = document.getElementById('rankingList');
    el.completeTitle = document.getElementById('completeTitle');
    el.completeStats = document.getElementById('completeStats');
    el.completeReport = document.getElementById('completeReport');
    el.completeSummary = document.getElementById('completeSummary');
    el.completeHands = document.getElementById('completeHands');
    el.recordBadge = document.getElementById('recordBadge');
    el.btnReportToggle = document.getElementById('btnReportToggle');
    el.btnReportToggle.addEventListener('click', function () {
      setReportExpanded(el.completeReport.hidden);
    });
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

    initHighwayGestures();
    initVerticalScrubber();
    // ⏪ / ⏩: voltar/avançar alguns segundos. Ficam no topo (HUD) e na pausa — longe das
    // teclas, pra não esbarrar tocando (a barra de progresso fica só no PC).
    ['seekBackBtn', 'btnSeekBackPause'].forEach(function (id) {
      document.getElementById(id).addEventListener('click', function () { seekBy(-SEEK_STEP); });
    });
    ['seekFwdBtn', 'btnSeekFwdPause'].forEach(function (id) {
      document.getElementById(id).addEventListener('click', function () { seekBy(SEEK_STEP); });
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

    el.hint.addEventListener('change', function () {
      state.hint = el.hint.checked;
      progress.prefs.hint = state.hint;
      saveProgressState();
    });

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
      progress.prefs.difficulty = el.difficulty.value;
      saveProgressState();
      reset();
    });

    // Slider de BPM do menu ⚙: enquanto arrasta só atualiza o número; ao soltar, aplica e
    // recomeça a fase na nova velocidade (refazer a linha do tempo a cada pixel pesaria).
    el.speed.addEventListener('input', function () {
      el.speedOut.textContent = el.speed.value + ' BPM';
    });
    el.speed.addEventListener('change', function () {
      if (state.mode !== 'song' || !state.song) return;
      var bpm = parseInt(el.speed.value, 10);
      state.speed = bpm / state.song.bpm;
      progress.prefs.bpm[state.song.id] = bpm;
      saveProgressState();
      reset();   // reaplica a nova velocidade à fase atual
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
      // Música "tocar junto" (celular) só existe em demonstração — ver listenOnly().
      if (state.mode === 'song' && listenOnly(state.song)) el.demoToggle.checked = true;
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

    // Volta com as mesmas opções da última partida (salvas a cada mudança, ver loadProgress()).
    progress = loadProgress();
    state.effects = progress.prefs.effects;
    state.hint = progress.prefs.hint;
    state.practiceHand = progress.prefs.hand;
    el.hint.checked = state.hint;
    el.difficulty.value = progress.prefs.difficulty;
    sequence.setMode(el.difficulty.value);
    state.waitMode = progress.prefs.wait;
    state.metronome = progress.prefs.metronome;
    state.mutePiano = progress.prefs.mutePiano;
    state.demoMode = progress.prefs.demo;
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
    el.vScrub.hidden = el.scrubberItem.hidden;
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
        '<small>' + entry.best.accuracy + '% de precisão · ' + entryBpm(entry.song, entry.best) + ' BPM' +
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
   * Fases que aparecem no mapa. No celular (teclado de 1 oitava) as que cabem inteiras
   * nele (`PH.notes.songFits`) vêm primeiro e são jogáveis normalmente; as largas demais
   * (espremidas numa oitava ficariam irreconhecíveis) vêm depois, como músicas "pra
   * tocar junto" (`listenOnly()`): só em demonstração, sem pontos, com o teclado alargado
   * pelas oitavas que a música usa (ver startSong).
   */
  function availableSongs() {
    if (!PH.notes.COMPACT) return PH.songs;
    return PH.songs.filter(PH.notes.songFits)
      .concat(PH.songs.filter(function (s) { return !PH.notes.songFits(s); }));
  }

  function listenOnly(song) {
    return !!song && PH.notes.COMPACT && !PH.notes.songFits(song);
  }

  function renderLevelList() {
    var current = -1;
    var songs = availableSongs();
    var html = '<svg class="map-path" aria-hidden="true"><path/></svg>';
    for (var i = 0; i < songs.length; i++) {
      var song = songs[i];
      var best = progress.best[song.id];
      var listen = listenOnly(song);
      if (!best && !listen && current === -1) current = i;
      var cls = listen ? ' listen' : best ? ' done' : (i === current ? ' current' : '');
      html += '<div class="map-node"><div class="map-stop" style="--k:' + MAP_K[i % MAP_K.length] + '">' +
        '<button type="button" class="map-bubble' + cls + '" data-index="' + i + '"' +
        ' aria-label="' + (listen ? 'Tocar junto' : 'Fase ' + (i + 1)) + ': ' + song.title + '">' +
        '<span class="map-num">' + (listen ? '&#9835;' : i + 1) + '</span>' +
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
  var setupBpmValue = 100;

  var HAND_NAMES = { R: 'mão direita', L: 'mão esquerda', both: 'duas mãos' };

  /**
   * Tela entre o mapa e a partida, organizada de cima pra baixo: MÃO a praticar (só em
   * músicas que usam as duas), VELOCIDADE (qualquer BPM, slider + ±1) e,
   * por último, os botões que começam a partida — um por modo (Jogar / Modo espera /
   * Demonstração). O ranking da fase fica recolhido no fim. As escolhas só sincronizam os
   * mesmos toggles/preferências do menu ⚙ — não é um estado paralelo.
   */
  function showSongSetup(song) {
    setupSong = song;
    el.setupTitle.textContent = song.title;
    el.setupSubtitle.textContent = song.subtitle || '';

    // Música larga no celular: só a demonstração (tocar junto, sem pontos) — ver listenOnly().
    var listen = listenOnly(song);
    el.btnPlayNormal.hidden = listen;
    el.btnPlayWait.hidden = listen;
    el.setupRankingBox.hidden = listen;
    el.setupListenHint.hidden = !listen;
    el.btnPlayDemoText.innerHTML = listen
      ? '<strong>Tocar junto</strong><small>Música completa, sem contar pontos</small>'
      : '<strong>Demonstração</strong><small>Ouvir e ver antes de tentar</small>';

    var hands = PH.fingering.handsUsed(song);
    var twoHands = hands.R && hands.L && !listen;
    el.setupHandSection.hidden = !twoHands;
    if (!twoHands) state.practiceHand = 'both';
    el.setupHandHint.textContent = 'Praticando uma mão, a outra toca sozinha no tempo certo.';

    if (twoHands) state.practiceHand = progress.prefs.hand;
    el.setupBpm.min = bpmMin(song);
    el.setupBpm.max = bpmMax(song);
    setSetupBpm(savedBpm(song));
    refreshSegmented();
    el.setupLast.innerHTML = listen ? '' : buildLastScoreHTML(song);
    el.setupLast.hidden = !el.setupLast.innerHTML;

    var list = scoresFor(song.id);
    el.setupRanking.innerHTML = buildSongRankingHTML(song);
    el.setupRankingSummary.textContent = list.length
      ? 'Ranking da fase · recorde ' + list[0].score + ' pts'
      : 'Ranking da fase · nenhuma tentativa ainda';
    el.setupRankingBox.open = false;
    showScreen('song');
  }

  /** Marca o botão escolhido no grupo de botões da mão. */
  function refreshSegmented() {
    [].forEach.call(el.setupHand.querySelectorAll('[data-hand]'), function (b) {
      var on = b.getAttribute('data-hand') === state.practiceHand;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  /* Velocidade em BPM: qualquer inteiro entre BPM_MIN e o original × BPM_MAX_FACTOR.
     `state.speed` continua sendo o multiplicador interno (BPM escolhido ÷ BPM da fase). */
  function bpmMin(song) { return Math.min(BPM_MIN, song.bpm); }
  function bpmMax(song) { return Math.round(song.bpm * BPM_MAX_FACTOR); }
  function clampBpm(song, bpm) { return Math.max(bpmMin(song), Math.min(bpmMax(song), Math.round(bpm) || song.bpm)); }
  /** BPM em que a fase foi jogada da última vez (ou o original, se nunca foi). */
  function savedBpm(song) { return clampBpm(song, progress.prefs.bpm[song.id] || song.bpm); }

  function setSetupBpm(bpm) {
    if (!setupSong) return;
    setupBpmValue = clampBpm(setupSong, bpm);
    el.setupBpm.value = setupBpmValue;
    var pct = Math.round(setupBpmValue / setupSong.bpm * 100);
    el.setupBpmOut.innerHTML = '<strong>' + setupBpmValue + '</strong> BPM' +
      '<small>' + (pct === 100 ? 'original' : pct + '% do original') + '</small>';
  }

  /** BPM de uma tentativa salva (as antigas guardavam só o multiplicador `speed`). */
  function entryBpm(song, e) {
    return e.bpm || Math.round(song.bpm * (e.speed || 1));
  }

  /**
   * "Sua pontuação" antes de começar: a última tentativa e os dois recordes da fase —
   * PRECISÃO (maior %) e VELOCIDADE (maior BPM terminado no ritmo, sem modo espera,
   * com pelo menos SPEED_RECORD_MIN_ACC% de precisão).
   */
  function buildLastScoreHTML(song) {
    var last = progress.last[song.id];
    var rec = progress.records[song.id] || {};
    if (!last && !rec.accuracy && !rec.speed) return '';
    var html = '';
    if (last) {
      html += '<div class="last-row"><span class="last-label">Última vez</span>' +
        '<span class="last-val">' + last.accuracy + '% · ' + entryBpm(song, last) + ' BPM' +
        (last.wait ? ' · espera' : '') +
        (last.hand && last.hand !== 'both' ? ' · só ' + HAND_NAMES[last.hand] : '') +
        ' · ' + last.score + ' pts</span></div>';
    }
    html += '<div class="last-records">' +
      '<span class="last-chip acc"><small>Recorde de precisão</small><strong>' +
        (rec.accuracy ? rec.accuracy.accuracy + '%' : '—') + '</strong>' +
        (rec.accuracy ? '<small>a ' + entryBpm(song, rec.accuracy) + ' BPM</small>' : '') + '</span>' +
      '<span class="last-chip spd"><small>Recorde de velocidade</small><strong>' +
        (rec.speed ? entryBpm(song, rec.speed) + ' BPM' : '—') + '</strong>' +
        '<small>' + (rec.speed ? 'com ' + rec.speed.accuracy + '%' : 'no ritmo, ≥' + SPEED_RECORD_MIN_ACC + '%') + '</small></span>' +
      '</div>';
    return html;
  }

  function buildSongRankingHTML(song) {
    var list = scoresFor(song.id);
    if (!list.length) return '<p class="ranking-empty">Nenhuma tentativa ainda — seja o primeiro!</p>';
    var MEDALS = ['🥇', '🥈', '🥉'];
    return list.map(function (e, i) {
      var details = e.accuracy + '%' + (e.combo ? ' · combo ' + e.combo : '') +
        (e.hand && e.hand !== 'both' ? ' · só ' + HAND_NAMES[e.hand] : '') +
        (e.wait ? ' · espera' : '') +
        ' · ' + entryBpm(song, e) + ' BPM' +
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
    state.speed = setupBpmValue / setupSong.bpm;
    el.waitToggle.checked = state.waitMode;
    el.demoToggle.checked = state.demoMode;
    progress.prefs.wait = state.waitMode;
    progress.prefs.demo = state.demoMode;
    progress.prefs.bpm[setupSong.id] = setupBpmValue;
    if (!el.setupHandSection.hidden) progress.prefs.hand = state.practiceHand;
    saveProgressState();
    startSong(setupSong);
  }

  /* ---------------- gestos no palco: tocar pausa, arrastar na vertical navega ---------------- */

  var DRAG_THRESHOLD = 10;   // px de movimento pra um toque virar arrasto
  var SEEK_IDLE_MS = 700;    // após parar de navegar, quanto esperar pra mostrar os botões de novo

  /**
   * Navegando (arrastando a pista/barra, roda do mouse), os botões da pausa somem pra
   * deixar ver as notas — e voltam sozinhos quando o jogador para de mexer, como num
   * player de vídeo. Chamar a cada movimento; `hold` = ainda com o dedo na tela.
   */
  var seekIdleTimer = null;
  function markSeeking(hold) {
    el.overlay.classList.add('seeking');
    clearTimeout(seekIdleTimer);
    if (!hold) seekIdleTimer = setTimeout(function () { el.overlay.classList.remove('seeking'); }, SEEK_IDLE_MS);
  }

  /**
   * A área das notas caindo (acima do teclado) funciona como a "pista" de um vídeo:
   *  - tocar/clicar e soltar rápido = pausa (ou continua, se já pausado);
   *  - arrastar pra cima/baixo = navegar na música, como se segurasse a pista: puxar pra
   *    baixo traz as notas pra frente (avança), puxar pra cima volta. Pausa sozinho, e as
   *    notas acompanham o dedo 1:1 (mesma escala px/s em que caem).
   * Pausado, o overlay (quase transparente) fica por cima do canvas — então o mesmo gesto
   * é escutado no fundo do overlay também. Usa pointer events e não `click`: o input.js
   * cancela o `touchstart` do canvas (lupa do Safari), e o iPhone deixa de gerar `click` lá.
   */
  function initHighwayGestures() {
    var g = null;   // gesto em andamento: { x, y, t, songTime, dragging, elem, id }

    function begin(e, elem) {
      g = { x: e.clientX, y: e.clientY, t: performance.now(), songTime: state.songTime,
            dragging: false, elem: elem, id: e.pointerId };
      try { elem.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
    }

    el.canvas.addEventListener('pointerdown', function (e) {
      var r = el.canvas.getBoundingClientRect();
      if (e.clientY - r.top < PH.render.getLayout().pianoY && state.running) begin(e, el.canvas);
    });
    el.overlay.addEventListener('pointerdown', function (e) {
      if (e.target === el.overlay && state.paused) begin(e, el.overlay);
    });

    function move(e) {
      if (!g || e.pointerId !== g.id) return;
      var dy = e.clientY - g.y;
      if (!g.dragging) {
        if (Math.abs(dy) < DRAG_THRESHOLD || state.mode !== 'song' || !state.timeline.length) return;
        g.dragging = true;
        pauseGame();
      }
      var pxPerSec = PH.render.getLayout().hitLine / LEAD_TIME;
      seekTo(g.songTime + dy / pxPerSec);
      markSeeking(true);
    }

    function end(e) {
      if (!g || e.pointerId !== g.id) return;
      var tap = !g.dragging && performance.now() - g.t < 500 &&
        Math.abs(e.clientX - g.x) + Math.abs(e.clientY - g.y) < 16;
      var elem = g.elem;
      if (g.dragging) markSeeking(false);   // soltou: os botões voltam daqui a pouco
      g = null;
      try { elem.releasePointerCapture(e.pointerId); } catch (err) { /* ok */ }
      if (!tap) return;
      if (elem === el.canvas && state.running) pauseGame();
      else if (elem === el.overlay && state.paused) resumeGame();
    }

    [el.canvas, el.overlay].forEach(function (elem) {
      elem.addEventListener('pointermove', move);
      elem.addEventListener('pointerup', end);
      elem.addEventListener('pointercancel', function (e) { if (g && e.pointerId === g.id) g = null; });
    });
  }

  /**
   * Barra de progresso na lateral direita do palco, na altura da pista de notas (longe do
   * teclado): começo embaixo, fim em cima — o mesmo sentido em que as notas "vêm" (de cima).
   * Arrastar/tocar nela pausa e pula pro ponto; ao continuar vem a contagem 3-2-1.
   */
  function initVerticalScrubber() {
    var dragging = false;

    function timeFromY(e) {
      var r = el.vScrubTrack.getBoundingClientRect();
      var frac = r.height > 0 ? 1 - (e.clientY - r.top) / r.height : 0;
      return Math.max(0, Math.min(1, frac)) * state.songDuration;
    }

    el.vScrub.addEventListener('pointerdown', function (e) {
      if (state.mode !== 'song' || !state.songDuration) return;
      e.preventDefault();
      e.stopPropagation();
      pauseGame();
      dragging = true;
      el.vScrub.classList.add('dragging');
      el.vScrub.setPointerCapture(e.pointerId);
      seekTo(timeFromY(e));
      markSeeking(true);
    });
    el.vScrub.addEventListener('pointermove', function (e) {
      if (dragging) { seekTo(timeFromY(e)); markSeeking(true); }
    });
    function end(e) {
      if (!dragging) return;
      dragging = false;
      markSeeking(false);
      el.vScrub.classList.remove('dragging');
      try { el.vScrub.releasePointerCapture(e.pointerId); } catch (err) { /* ok */ }
    }
    el.vScrub.addEventListener('pointerup', end);
    el.vScrub.addEventListener('pointercancel', end);
    el.vScrub.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
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
      markSeeking(false);
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
   * Continua. No modo fase não volta "a seco" no mesmo instante: rebobina o relógio
   * RESUME_COUNTDOWN segundos e mostra 3-2-1 — as notas a partir de onde parou voltam a
   * cair de cima, dando tempo de ver o que vem (e de se reposicionar depois de navegar).
   * O recuo é ANIMADO (REWIND_ANIM, ver updateSong()): as notas deslizam pra cima, como um
   * vídeo rebobinando, em vez de sumirem e reaparecerem no topo. Só o relógio recua:
   * `cursor`/`targetMidis` continuam na nota pendente, então notas de antes do ponto de
   * pausa não voltam a ser cobradas.
   *
   * No modo espera não há rebobinar nem 3-2-1: a nota pendente espera o jogador de
   * qualquer jeito, então a música continua direto de onde está (no máximo, parada no
   * começo da nota pendente — o updateSong() já segura o relógio ali).
   */
  function resumeGame() {
    if (!state.paused) return;
    state.paused = false;
    el.overlay.hidden = true;
    el.overlay.classList.remove('seeking');
    var waiting = state.waitMode && !state.demoMode;
    if (state.mode === 'song' && state.cursor < state.timeline.length && !waiting) {
      state.resolvedBars = [];
      state.rewind = { from: state.songTime, to: state.songTime - RESUME_COUNTDOWN, t: 0 };
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
    state.rewind = null;   // pausa/salto/reinício no meio do rebobinar também o cancela
    state.countdownTo = null;
    countdownShown = null;
    el.countdown.hidden = true;
  }

  /* ---------------- progresso e preferências (localStorage) ---------------- */

  /**
   * Tudo que fica salvo no navegador (localStorage): fases liberadas, ranking por fase,
   * a última tentativa e os recordes de precisão/velocidade de cada fase, e as opções da
   * última partida (cada uma salva assim que muda) — reabrir o jogo volta igual.
   */
  function loadProgress() {
    var p = {};
    try { p = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}') || {}; } catch (e) { p = {}; }
    var pr = p.prefs || {};
    function bool(v, def) { return typeof v === 'boolean' ? v : def; }
    var out = {
      unlocked: p.unlocked || 0,
      best: p.best || {},
      scores: p.scores || {},
      last: p.last || {},
      records: p.records || {},
      prefs: {
        bpm: pr.bpm || {},   // BPM escolhido por fase (id → BPM)
        effects: bool(pr.effects, true),
        hint: bool(pr.hint, true),
        wait: bool(pr.wait, false),
        metronome: bool(pr.metronome, false),
        mutePiano: bool(pr.mutePiano, false),
        demo: bool(pr.demo, false),
        hand: pr.hand === 'R' || pr.hand === 'L' ? pr.hand : 'both',
        difficulty: pr.difficulty === 'scale' || pr.difficulty === 'all' ? pr.difficulty : 'white'
      }
    };
    // Progresso de antes dos recordes separados: tira os recordes do ranking que já existia.
    if (!p.records) {
      Object.keys(out.best).forEach(function (id) {
        (out.scores[id] || [out.best[id]]).forEach(function (e) { updateRecords(out.records, id, e); });
      });
    }
    return out;
  }

  /** Atualiza os dois recordes da fase (precisão e velocidade) com uma tentativa nova. */
  function updateRecords(records, songId, e) {
    var rec = records[songId] || (records[songId] = {});
    // Compara pelo multiplicador `speed` (BPM ÷ BPM da fase): dentro da mesma fase é o
    // mesmo que comparar BPM, e as tentativas antigas (sem `bpm` salvo) também têm.
    var spd = e.speed || 1;
    var accBest = rec.accuracy;
    if (!accBest || e.accuracy > accBest.accuracy ||
        (e.accuracy === accBest.accuracy && spd > (accBest.speed || 1))) {
      rec.accuracy = e;
    }
    var spdBest = rec.speed;
    if (!e.wait && e.accuracy >= SPEED_RECORD_MIN_ACC &&
        (!spdBest || spd > (spdBest.speed || 1) ||
         (spd === (spdBest.speed || 1) && e.accuracy > spdBest.accuracy))) {
      rec.speed = e;
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
    var song = PH.songs[idx];
    var entry = { accuracy: acc, score: score, combo: combo, date: Date.now(), wait: state.waitMode,
                  speed: state.speed, bpm: song ? Math.round(song.bpm * state.speed) : 0, hand: state.practiceHand };
    progress.last[songId] = entry;
    updateRecords(progress.records, songId, entry);
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
    setKeyboardFor(null);
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
    setKeyboardFor(song);
    if (listenOnly(song)) {
      // Teclado alargado com teclas estreitas: só dá pra acompanhar, não pra ser cobrado.
      state.demoMode = true;
      el.demoToggle.checked = true;
    }
    clearLoop();   // marcações de trecho são por música — não fazem sentido levadas pra outra
    PH.audio.unlock();
    watchPianoLoad();
    updateModeUI();
    updateSpeedOptions();
    reset();
    el.overlay.hidden = true;
    state.running = true;
  }

  /**
   * Celular: teclado padrão (1 oitava) pras fases normais e pro modo livre; alargado pelas
   * oitavas da música (PH.notes.songRange) pras músicas "tocar junto". No PC não muda nada.
   */
  function setKeyboardFor(song) {
    if (!PH.notes.COMPACT) return;
    var changed;
    if (listenOnly(song)) {
      var r = PH.notes.songRange(song);
      changed = PH.notes.setRange(r.min, r.max);
    } else {
      changed = PH.notes.resetRange();
    }
    if (changed) PH.render.relayout();
  }

  /** O slider de velocidade do menu ⚙ mostra o BPM de verdade da fase atual (qualquer
   *  inteiro entre bpmMin/bpmMax) — o valor interno usado em beatSeconds() continua sendo
   *  o multiplicador `state.speed` (BPM escolhido ÷ BPM da fase). */
  function updateSpeedOptions() {
    if (!state.song) return;
    el.speed.min = bpmMin(state.song);
    el.speed.max = bpmMax(state.song);
    el.speed.value = Math.round(state.song.bpm * state.speed);
    el.speedOut.textContent = el.speed.value + ' BPM';
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
    el.vScrub.hidden = !isSong;
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
    var labels = PH.fingering.forSong(song);   // mão + dedo de cada nota
    var ticks = 0;
    var out = [];
    for (var i = 0; i < song.notes.length; i++) {
      var durTicks = song.durations[i];
      var sustainTicks = song.sustainDurations ? song.sustainDurations[i] : durTicks;
      var raw = Array.isArray(song.notes[i]) ? song.notes[i] : [song.notes[i]];
      // Dois sons do acorde podem cair na mesma tecla depois do fitMidi (ex.: baixo e
      // melodia em oitavas) — viram uma só, senão o acorde exigiria tocar a mesma tecla
      // duas vezes e nunca terminaria.
      var midis = [], hands = [], fingers = [];
      raw.forEach(function (midi, k) {
        var fitted = shift !== null ? midi + shift : PH.notes.fitMidi(midi);
        if (midis.indexOf(fitted) !== -1) return;
        var label = labels[i][k] || 'R1';   // "R3" = mão direita, dedo 3 (ver fingering.js)
        midis.push(fitted);
        hands.push(label.charAt(0));
        fingers.push(Number(label.charAt(1)) || 0);
      });
      out.push({
        midis: midis, hands: hands, fingers: fingers, time: ticks * secPerTick,
        dur: durTicks * secPerTick, sustain: sustainTicks * secPerTick,
        index: i
      });
      ticks += durTicks;
    }
    return out;
  }

  /**
   * Separa a timeline por mão: `mine` = só as notas da mão praticada (as que o jogador
   * toca e que pontuam), `other` = as da outra mão (tocadas sozinhas por advanceAuto()).
   * Uma posição com notas das duas mãos vira uma posição em cada lista, no mesmo tempo.
   */
  function splitByHand(full, hand) {
    function pick(slot, keep) {
      var idx = [];
      slot.hands.forEach(function (h, k) { if (keep(h)) idx.push(k); });
      if (!idx.length) return null;
      return {
        midis: idx.map(function (k) { return slot.midis[k]; }),
        hands: idx.map(function (k) { return slot.hands[k]; }),
        fingers: idx.map(function (k) { return slot.fingers[k]; }),
        time: slot.time, dur: slot.dur, sustain: slot.sustain, index: slot.index
      };
    }
    var mine = [], other = [];
    full.forEach(function (slot) {
      var a = pick(slot, function (h) { return h === hand; });
      var b = pick(slot, function (h) { return h !== hand; });
      if (a) mine.push(a);
      if (b) other.push(b);
    });
    return { mine: mine, other: other };
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
      var full = buildTimeline(state.song);
      state.timeline = full;
      state.autoTimeline = [];
      // Praticando uma mão (fora da demonstração, que toca tudo): o jogador só é cobrado
      // pelas notas dela; as da outra mão entram em autoTimeline e tocam sozinhas.
      if (state.practiceHand !== 'both' && !state.demoMode) {
        var parts = splitByHand(full, state.practiceHand);
        if (parts.mine.length) {
          state.timeline = parts.mine;
          state.autoTimeline = parts.other;
        }
      }
      state.autoCursor = 0;
      state.cursor = 0;
      state.songTime = -PRE_ROLL;
      state.countdownTo = 0;
      var last = full[full.length - 1];
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
    // Outra mão (praticando uma só): a partir da primeira nota que ainda não começou.
    var a = 0;
    while (a < state.autoTimeline.length && state.autoTimeline[a].time < state.songTime) a++;
    state.autoCursor = a;

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
    el.vScrub.hidden = el.scrubberItem.hidden;
    if (el.scrubberItem.hidden) return;
    var duration = state.songDuration || 0;
    var pct = duration > 0 ? Math.max(0, Math.min(1, state.songTime / duration)) * 100 : 0;
    // Barra lateral: ocupa só a altura da pista de notas (acaba antes do teclado).
    // Só mexe no DOM quando algo visível mudou (a cada quadro isso forçava o navegador a
    // recalcular o layout à toa — pesado no celular).
    var key = Math.round(pct * 10) + '|' + Math.floor(state.songTime) + '|' + PH.render.getLayout().pianoY;
    if (key === lastScrubKey) return;
    lastScrubKey = key;
    // Termina ~14px acima do teclado, a partir de onde a barra começa (o topo muda no celular).
    el.vScrub.style.height = Math.max(60, PH.render.getLayout().pianoY - el.vScrub.offsetTop - 14) + 'px';
    el.vScrubFill.style.height = pct + '%';
    el.vScrubThumb.style.bottom = pct + '%';
    el.vScrubTime.textContent = formatTime(state.songTime) + ' / ' + formatTime(duration);
    el.scrubFill.style.width = pct + '%';
    el.scrubThumb.style.left = pct + '%';
    el.scrubCurrent.textContent = formatTime(state.songTime);
    el.scrubTotal.textContent = formatTime(duration);
  }
  var lastScrubKey = '';

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
        var k = chord.midis.indexOf(midis[m]);
        arr.push({ midi: midis[m], y: y, len: len, chordIndex: i,
                   hand: chord.hands[k], finger: chord.fingers[k] });
      }
    }

    // Notas da outra mão (praticando uma só): caem apagadas, sem brilho de alvo — dá pra
    // ver o que a outra mão faz, mas não é o jogador quem toca.
    var auto = state.autoTimeline;
    for (var a = state.autoCursor; a < auto.length; a++) {
      var ac = auto[a];
      var adt = ac.time - state.songTime;
      if (adt > LEAD_TIME + 0.05) break;
      var alen = Math.max(ac.dur * pxPerSec, layout.noteH);
      for (var am = 0; am < ac.midis.length; am++) {
        arr.push({ midi: ac.midis[am], y: layout.hitLine - adt * pxPerSec, len: alen,
                   auto: true, hand: ac.hands[am], finger: ac.fingers[am] });
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
        state.log.push({ index: missed.index, expected: midi, result: 'timeout', deltaMs: null,
                         hand: handOf(missed, midi) });
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
    // Rebobinando depois da pausa (ver resumeGame()): o relógio anda pra trás, suavizado
    // (acelera e freia), e só no fim começa a contagem 3-2-1 e a música volta a andar.
    if (state.rewind) {
      var rw = state.rewind;
      rw.t = Math.min(1, rw.t + dt / REWIND_ANIM);
      var k = rw.t < 0.5 ? 2 * rw.t * rw.t : 1 - Math.pow(-2 * rw.t + 2, 2) / 2;
      state.songTime = rw.from + (rw.to - rw.from) * k;
      if (rw.t >= 1) {
        state.rewind = null;
        state.countdownTo = rw.from;
        if (state.metronome) state.nextClick = Math.ceil(state.songTime / beatSeconds(state.song));
      }
      return;
    }
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
      advanceAuto();
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

  /** Praticando uma mão: a outra toca sozinha, cada posição no seu tempo. */
  function advanceAuto() {
    var auto = state.autoTimeline;
    while (state.autoCursor < auto.length && state.songTime >= auto[state.autoCursor].time) {
      playDemoChord(auto[state.autoCursor], true);
      state.autoCursor++;
    }
  }

  /**
   * Toca e "segura" visualmente todas as notas de um acorde da timeline, sozinho.
   * Solta um pouco antes do próximo acorde (`durMs`) e com decaimento curto (`release`
   * proporcional à duração da nota, não o padrão de 0,25s) — numa passagem rápida de
   * semicolcheias, um decaimento longo demais embola uma nota na próxima, deixando a
   * demonstração soar "grudada"/borrada em vez de articulada.
   */
  function playDemoChord(chord, isAuto) {
    // `sustain` (não `dur`) decide quanto tempo a nota soa aqui — ver o comentário em
    // buildTimeline(). Numa música com duas vozes, isso deixa a nota grave "segurando"
    // de verdade em vez de ser cortada assim que a melodia passa pra próxima colcheia.
    var release = Math.min(0.25, chord.sustain * 0.4);
    var gen = state.demoGen;   // ver seekTo()/reset(): se mudar antes do timeout, ele é ignorado
    chord.midis.forEach(function (midi) {
      PH.audio.startNote(midi, 1);
      holdKey(midi, true);
      state.resolvedBars.push({ midi: midi, time: chord.time, dur: chord.sustain, auto: !!isAuto,
                                hand: chord.hands ? chord.hands[chord.midis.indexOf(midi)] : null });
    });
    if (state.effects && !isAuto) PH.render.burst(chord.midis[0], true);
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
        deltaMs: state.waitMode ? null : Math.round(dt * 1000), hand: handOf(chord, played)
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
      state.log.push({ index: chord.index, expected: played, result: 'wrong', deltaMs: Math.round(dt * 1000),
                       hand: handOf(chord, nearestExpected(chord, played)) });
      holdKey(played, false);
      if (state.effects) PH.render.burst(played, false);
      showFeedback('Era ' + chord.midis.map(PH.notes.noteNameOct).join(' + ') + '!', 'bad');
    }

    updateHUD();
    checkSongEnd();
  }

  /** Mão da nota `midi` na posição `slot` da timeline ('R' / 'L'). */
  function handOf(slot, midi) {
    var k = slot.midis.indexOf(midi);
    return k !== -1 && slot.hands ? slot.hands[k] : 'R';
  }

  /** Nota errada é atribuída à mão da nota esperada mais próxima (quem "devia" ter tocado). */
  function nearestExpected(slot, played) {
    var pool = state.targetMidis.length ? state.targetMidis : slot.midis;
    return pool.reduce(function (best, m) {
      return Math.abs(m - played) < Math.abs(best - played) ? m : best;
    }, pool[0]);
  }

  /** Comum a acerto no modo livre e na fase: pontuação, combo e efeito visual sutil. */
  function registerHit(played, perfect) {
    state.hits++;
    state.combo++;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.score += Math.round((perfect ? 15 : 10) * multiplier());

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
    var id = state.song.id;
    var prevBest = progress.best[id];
    var isRecord = !prevBest || state.score > prevBest.score;
    saveProgress(id, acc, state.score, state.bestCombo);
    // Os dois recordes da fase: a tentativa que acabou de ser salva virou um deles?
    var rec = progress.records[id] || {};
    var recAcc = rec.accuracy === progress.last[id];
    var recSpd = rec.speed === progress.last[id];
    var bpm = Math.round(state.song.bpm * state.speed);

    var summary = summarizeLog();
    var hasNext = !!nextSong();

    el.completeTitle.textContent = '🎉 ' + state.song.title + ' completa!';
    el.completeStats.innerHTML =
      '<div class="stat"><span>Pontos</span><strong data-count="' + state.score + '">0</strong></div>' +
      '<div class="stat"><span>Precisão</span><strong data-count="' + acc + '" data-suffix="%">0%</strong></div>' +
      '<div class="stat"><span>Velocidade</span><strong data-count="' + bpm + '" data-suffix=" BPM">0 BPM</strong></div>' +
      '<div class="stat"><span>Maior combo</span><strong data-count="' + state.bestCombo + '">0</strong></div>';
    var recText = recAcc && recSpd ? 'Novo recorde de precisão e de velocidade!'
      : recAcc ? 'Novo recorde de precisão!'
      : recSpd ? 'Novo recorde de velocidade!'
      : isRecord ? 'Novo recorde de pontos!' : '';
    el.recordBadge.textContent = recText;
    el.recordBadge.hidden = !recText || state.score === 0;
    el.completeHands.innerHTML = buildHandsHTML(summary);
    el.completeReport.innerHTML = buildReportHTML(summary, state.waitMode);
    // Resumo de uma linha sempre visível; o relatório completo (contagens, tendência de
    // tempo, notas pra praticar) fica recolhido atrás de "Ver detalhes" — assim a tela de
    // fim cabe inteira na tela deitada do celular.
    el.completeSummary.textContent = summary.perfect + ' perfeitas · ' + summary.good + ' boas · ' +
      (summary.wrong + summary.timeout) + ' erros';
    setReportExpanded(false);
    el.btnNextLevel.hidden = !hasNext;

    showScreen('complete');
    animateComplete();
  }

  /**
   * Relatório por mão: uma barra de precisão pra cada mão que tocou (a praticada, ou as
   * duas). Praticando uma só, avisa que a outra tocou sozinha.
   */
  function buildHandsHTML(s) {
    var rows = ['R', 'L'].filter(function (h) { return s.byHand[h].total > 0; }).map(function (h) {
      var b = s.byHand[h];
      var pct = Math.round(b.hits / b.total * 100);
      return '<div class="hand-row hand-' + h + '">' +
        '<span class="hand-name"><span class="hand-dot ' + h + '"></span>' +
        HAND_NAMES[h].charAt(0).toUpperCase() + HAND_NAMES[h].slice(1) + '</span>' +
        '<span class="hand-bar"><span class="hand-fill" style="--pct:' + pct + '%"></span></span>' +
        '<span class="hand-pct">' + pct + '%</span>' +
        '<span class="hand-count">' + b.hits + '/' + b.total + '</span></div>';
    });
    if (!rows.length) return '';
    var note = state.practiceHand !== 'both' && state.autoTimeline.length
      ? '<p class="hand-note">Você praticou só a ' + HAND_NAMES[state.practiceHand] + '; a outra tocou sozinha.</p>'
      : '';
    return rows.join('') + note;
  }

  /** Números do fim de fase "contando" de 0 até o valor, e barras das mãos enchendo. */
  function animateComplete() {
    var nodes = el.completeStats.querySelectorAll('[data-count]');
    var start = performance.now(), DUR = 900;
    function frame(now) {
      var t = Math.min(1, (now - start) / DUR);
      var k = 1 - Math.pow(1 - t, 3);   // desacelera no fim
      [].forEach.call(nodes, function (n) {
        n.textContent = Math.round(Number(n.getAttribute('data-count')) * k) + (n.getAttribute('data-suffix') || '');
      });
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    el.completeHands.classList.remove('filled');
    void el.completeHands.offsetWidth;   // reinicia a transição das barras
    el.completeHands.classList.add('filled');
  }

  function setReportExpanded(open) {
    el.completeReport.hidden = !open;
    el.btnReportToggle.textContent = open ? 'Ocultar detalhes' : 'Ver detalhes';
    el.btnReportToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  /* ---------------- relatório de performance ---------------- */

  function summarizeLog() {
    var perfect = 0, good = 0, wrong = 0, timeout = 0;
    var deltas = [];
    var missCount = {};
    var byHand = { R: { hits: 0, total: 0 }, L: { hits: 0, total: 0 } };

    state.log.forEach(function (e) {
      if (e.hand && byHand[e.hand]) {
        byHand[e.hand].total++;
        if (e.result === 'perfect' || e.result === 'good') byHand[e.hand].hits++;
      }
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

    return { perfect: perfect, good: good, wrong: wrong, timeout: timeout, avgDelta: avgDelta, worst: worst, byHand: byHand };
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
    var practicing = state.mode === 'song' && !state.demoMode && state.practiceHand !== 'both' &&
      state.autoTimeline.length > 0;
    el.handBadge.hidden = !practicing;
    if (practicing) {
      el.handBadge.className = 'hand-badge hand-' + state.practiceHand;
      el.handBadge.textContent = 'Praticando: ' + HAND_NAMES[state.practiceHand];
    }
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
  var lastMenuOpen = null;
  function loop(now) {
    var rawDt = lastTime ? (now - lastTime) / 1000 : 0;
    var dt = Math.min(rawDt, 0.05);
    lastTime = now;

    // Com um menu cobrindo o palco (mapa, escolher modo, ajuda, ranking, fim de fase) não há
    // nada pra animar: pular o desenho do canvas (e a ~60 quadros/s de trabalho) deixa o
    // celular leve nos menus — antes o jogo redesenhava a pista inteira por trás do menu
    // o tempo todo, e isso travava o celular. Na pausa continua desenhando (as notas ficam
    // visíveis e andam ao navegar).
    var menuOpen = !el.overlay.hidden && el.screenPause.hidden;
    // Abrir/fechar menu mostra/esconde a HUD e muda o espaço do palco: reajusta na hora
    // (sem o intervalo do fitCheck), senão o teclado sairia cortado por um instante.
    PH.render.fitCheck(menuOpen !== lastMenuOpen ? undefined : now);
    lastMenuOpen = menuOpen;
    if (!menuOpen) {
      update(dt, rawDt);
      if (state.mode === 'song') {
        updateCountdown();
        syncSongNotes();
        if (!state.scrubbing) updateScrubber();
      }
      PH.render.draw(state, dt);
    }
    requestAnimationFrame(loop);
  }

  document.addEventListener('DOMContentLoaded', boot);
})(window.PianoHero);
