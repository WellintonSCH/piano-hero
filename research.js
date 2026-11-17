/*
 * research.js — modo pesquisa, para os testes com participantes do TCC.
 *
 * Ativado só pela URL: ...?pesquisa=P01 (código do participante). Sem o parâmetro, o
 * módulo não faz nada e o jogo funciona como sempre.
 *
 * Com o modo ativo:
 *  - ao trocar de participante, o progresso do jogo (pianoHeroProgress) é apagado, para que
 *    cada pessoa comece do zero; o registro da pesquisa NÃO é apagado (acumula a sessão toda);
 *  - cada (re)início de fase vira uma tentativa (main.js chama attemptStart / attemptEnd);
 *    tentativas interrompidas ficam com status "abandonada";
 *  - conta as notas por fonte de entrada (MIDI, teclado, mouse/toque) em cada tentativa;
 *  - um selo "Pesquisa · Pxx" no canto inferior esquerdo abre um painel para exportar CSV/JSON,
 *    trocar de participante e apagar o registro.
 *
 * Nada sai do navegador: os dados ficam no localStorage até serem exportados.
 */
(function (PH) {
  'use strict';

  var LOG_KEY = 'pianoHeroResearchLog';
  var CURRENT_KEY = 'pianoHeroResearchParticipant';
  var PROGRESS_KEY = 'pianoHeroProgress';   // mesma chave usada em main.js

  function load(key, def) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; } catch (e) { return def; }
  }

  // ?pesquisa=P03 usa o código dado; ?pesquisa sozinho continua o último participante
  // (ou começa em P01), para o pesquisador não precisar digitar nada.
  var match = /[?&]pesquisa(?:=([A-Za-z0-9_-]{0,20}))?(?:&|$)/.exec(location.search);
  if (!match) return;
  var participant = (match[1] || load(CURRENT_KEY, null) || 'P01').toUpperCase();
  if (!match[1] && history.replaceState) {
    history.replaceState(null, '', location.pathname + '?pesquisa=' + participant + location.hash);
  }

  /** Próximo código: P01 → P02, P9 → P10, A → A2. */
  function nextCode(code) {
    var m = /^(.*?)(\d+)$/.exec(code);
    if (!m) return code + '2';
    var n = String(Number(m[2]) + 1);
    while (n.length < m[2].length) n = '0' + n;
    return m[1] + n;
  }
  var nextParticipant = nextCode(participant);
  function save(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* privado/bloqueado */ }
  }

  // Participante novo => progresso do jogo zerado (antes de main.js ler o localStorage).
  if (load(CURRENT_KEY, null) !== participant) {
    try { localStorage.removeItem(PROGRESS_KEY); } catch (e) { /* ignora */ }
    save(CURRENT_KEY, participant);
  }

  var log = load(LOG_KEY, []);
  var current = null;

  function nowISO() { return new Date().toISOString(); }

  function close(status, data) {
    if (!current) return;
    var a = current;
    current = null;
    // Demonstração não tem desempenho a medir: sai como "assistida", não "abandonada".
    a.status = status === 'abandonada' && a.modo === 'demonstracao' ? 'assistida' : status;
    a.fim = nowISO();
    a.duracao_s = Math.round((performance.now() - a._t0) / 100) / 10;
    delete a._t0;
    if (data) {
      a.precisao = data.accuracy;
      a.pontos = data.score;
      a.maior_combo = data.bestCombo;
      a.perfeitas = data.perfect;
      a.boas = data.good;
      a.erradas = data.wrong;
      a.perdidas = data.timeout;
      a.atrasadas = data.late;
      if (data.stepTimes) a.tempos_passos_s = data.stepTimes.join(' | ');
      a.desvio_medio_ms = data.meanDeltaMs;
      a.desvio_abs_medio_ms = data.meanAbsDeltaMs;
    }
    log.push(a);
    save(LOG_KEY, log);
    refreshPanel();
  }

  function attemptStart(info) {
    close('abandonada');
    current = {
      participante: participant, inicio: nowISO(), _t0: performance.now(),
      fase: info.songId, titulo: info.title, modo: info.mode,
      bpm: info.bpm, notas: info.notes,
      notas_midi: 0, notas_teclado: 0, notas_mouse_toque: 0
    };
  }

  function attemptEnd(data) { close('concluida', data); }

  window.addEventListener('notePlayed', function (e) {
    if (!current) return;
    var src = e.detail && e.detail.source;
    if (src === 'midi') current.notas_midi++;
    else if (src === 'keyboard') current.notas_teclado++;
    else current.notas_mouse_toque++;
  });
  window.addEventListener('pagehide', function () { close('abandonada'); });

  /* ---------------- exportação ---------------- */

  var COLUMNS = ['participante', 'inicio', 'fim', 'duracao_s', 'status', 'fase', 'titulo', 'modo',
    'bpm', 'notas', 'precisao', 'pontos', 'maior_combo', 'perfeitas', 'boas', 'erradas', 'perdidas', 'atrasadas',
    'desvio_medio_ms', 'desvio_abs_medio_ms', 'notas_midi', 'notas_teclado', 'notas_mouse_toque', 'tempos_passos_s'];

  function csvCell(v) {
    if (v == null) return '';
    var s = String(v);
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function download(name, text, type) {
    var blob = new Blob([text], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function stamp() { return new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'); }

  function exportCSV(rows, name) {
    rows = rows || log;
    var lines = [COLUMNS.join(',')].concat(rows.map(function (a) {
      return COLUMNS.map(function (c) { return csvCell(a[c]); }).join(',');
    }));
    download(name || 'pesquisa-piano-hero-' + stamp() + '.csv', '﻿' + lines.join('\n'), 'text/csv;charset=utf-8');
  }

  /** Fim da sessão: fecha a tentativa aberta, baixa o CSV deste participante e abre o próximo. */
  function finishParticipant() {
    close('abandonada');
    var mine = log.filter(function (a) { return a.participante === participant; });
    if (mine.length) exportCSV(mine, 'pesquisa-' + participant + '-' + stamp() + '.csv');
    setTimeout(function () {
      location.search = '?pesquisa=' + encodeURIComponent(nextParticipant) + '&obrigado=1';
    }, 600);
  }

  /** Recomeça o mesmo participante do zero (progresso do jogo apagado; o registro fica). */
  function restartParticipant() {
    close('abandonada');
    try { localStorage.removeItem(PROGRESS_KEY); } catch (e) { /* ignora */ }
    location.reload();
  }

  function exportJSON() {
    download('pesquisa-piano-hero-' + stamp() + '.json', JSON.stringify(log, null, 2), 'application/json');
  }

  /* ---------------- interface: selo + grupo no menu de opções ---------------- */

  var countEl = null;

  function refreshPanel() {
    if (!countEl) return;
    var mine = log.filter(function (a) { return a.participante === participant; }).length;
    countEl.textContent = mine + ' tentativa(s) deste participante · ' + log.length + ' no total';
  }

  function buildUI() {
    // Selo + painel próprios (fora do HUD): o menu ⚙ Opções some na tela de fases, e o
    // pesquisador precisa trocar de participante justamente ali.
    var wrap = document.createElement('div');
    wrap.className = 'research';
    wrap.innerHTML =
      '<button type="button" class="research-badge" aria-expanded="false" title="Modo pesquisa ativo: as tentativas estão sendo registradas neste navegador. Clique para exportar ou trocar de participante.">' +
        'Pesquisa · ' + participant + '</button>' +
      '<div class="research-panel" hidden>' +
        '<strong>Participante ' + participant + '</strong>' +
        '<small class="research-count"></small>' +
        '<button type="button" data-act="next" class="primary research-big">Encerrar e ir para ' + nextParticipant + ' ▶</button>' +
        '<button type="button" data-act="restart" class="ghost">Recomeçar ' + participant + ' do zero</button>' +
        '<div class="research-actions">' +
          '<button type="button" data-act="csv">Exportar CSV</button>' +
          '<button type="button" data-act="json" class="ghost">JSON</button>' +
        '</div>' +
        '<form class="research-next">' +
          '<input type="text" name="next" maxlength="20" placeholder="Próximo (ex.: P02)" aria-label="Código do próximo participante">' +
          '<button type="submit">Trocar</button>' +
        '</form>' +
        '<button type="button" data-act="clear" class="ghost research-clear">Apagar registro da pesquisa</button>' +
      '</div>';
    document.body.appendChild(wrap);
    var badge = wrap.querySelector('.research-badge');
    var panel = wrap.querySelector('.research-panel');
    countEl = wrap.querySelector('.research-count');

    // O painel não deve virar toque/tecla do jogo nem pausar a música.
    ['pointerdown', 'touchstart', 'keydown', 'wheel'].forEach(function (t) {
      wrap.addEventListener(t, function (e) { e.stopPropagation(); });
    });
    badge.addEventListener('click', function () {
      panel.hidden = !panel.hidden;
      badge.setAttribute('aria-expanded', String(!panel.hidden));
      refreshPanel();
    });

    var confirmClear = false, armed = null;
    // Ações que mudam de participante pedem um segundo clique (sem confirm(), ver abaixo).
    function twoStep(btn, label) {
      if (armed === btn) return true;
      if (armed) armed.textContent = armed.getAttribute('data-label');
      btn.setAttribute('data-label', btn.textContent);
      btn.textContent = label;
      armed = btn;
      setTimeout(function () { if (armed === btn) { btn.textContent = btn.getAttribute('data-label'); armed = null; } }, 4000);
      return false;
    }
    panel.addEventListener('click', function (e) {
      var act = e.target && e.target.getAttribute('data-act');
      if (act === 'next') { if (twoStep(e.target, 'Clique de novo: salva o CSV e passa para ' + nextParticipant)) finishParticipant(); }
      else if (act === 'restart') { if (twoStep(e.target, 'Clique de novo para recomeçar')) restartParticipant(); }
      else if (act === 'csv') exportCSV();
      else if (act === 'json') exportJSON();
      else if (act === 'clear') {
        // Duas etapas, sem confirm() (diálogos nativos travam a automação e assustam no teste).
        if (!confirmClear) { confirmClear = true; e.target.textContent = 'Clique de novo para apagar tudo'; return; }
        log = []; save(LOG_KEY, log); confirmClear = false;
        e.target.textContent = 'Apagar registro da pesquisa';
        refreshPanel();
      }
    });
    panel.querySelector('.research-next').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = (e.target.next.value || '').trim();
      if (!/^[A-Za-z0-9_-]{1,20}$/.test(v)) { e.target.next.focus(); return; }
      close('abandonada');
      location.search = '?pesquisa=' + encodeURIComponent(v.toUpperCase());
    });
    refreshPanel();
    if (/[?&]obrigado=1/.test(location.search)) showThanks();
  }

  /**
   * Depois de "Encerrar": a tela de agradecimento cobre o jogo (já zerado para o próximo
   * participante) até o pesquisador ou a próxima pessoa tocar em "Começar".
   */
  // Questionário (Google Forms) do teste; o QR code em assets/ aponta para este mesmo link.
  var FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfsPj9ym7tG94jaH26IFmmOYsesrY7AnH9F0G82B9TjzCIrEg/viewform';

  function showThanks() {
    var box = document.createElement('div');
    box.className = 'research-thanks';
    box.innerHTML =
      '<div class="research-thanks-card" role="dialog" aria-live="polite">' +
        '<div class="star" aria-hidden="true">★</div>' +
        '<h1>Obrigado por participar!</h1>' +
        '<p>Você terminou o teste. Agora é só responder o questionário:</p>' +
        '<a class="research-qr" href="' + FORM_URL + '" target="_blank" rel="noopener">' +
          '<img src="assets/qr-formulario.svg" alt="QR code do questionário" width="220" height="220">' +
          '<span>Aponte a câmera do celular ou toque aqui</span>' +
        '</a>' +
        '<button type="button" class="primary">Próximo participante (' + participant + ') ▶</button>' +
      '</div>';
    ['pointerdown', 'touchstart', 'keydown', 'wheel'].forEach(function (t) {
      box.addEventListener(t, function (e) { e.stopPropagation(); });
    });
    box.querySelector('button').addEventListener('click', function () {
      box.remove();
      if (history.replaceState) history.replaceState(null, '', location.pathname + '?pesquisa=' + participant);
    });
    document.body.appendChild(box);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();

  PH.research = {
    participant: participant,
    attemptStart: attemptStart,
    attemptEnd: attemptEnd,
    exportCSV: exportCSV,
    finishParticipant: finishParticipant,
    exportJSON: exportJSON,
    getLog: function () { return log.slice(); }
  };
})(window.PianoHero);
