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

  var match = /[?&]pesquisa=([A-Za-z0-9_-]{1,20})/.exec(location.search);
  if (!match) return;
  var participant = match[1].toUpperCase();

  function load(key, def) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; } catch (e) { return def; }
  }
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
    a.status = status;
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
      fase: info.songId, titulo: info.title, modo: info.mode, mao: info.hand,
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

  var COLUMNS = ['participante', 'inicio', 'fim', 'duracao_s', 'status', 'fase', 'titulo', 'modo', 'mao',
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

  function exportCSV() {
    var lines = [COLUMNS.join(',')].concat(log.map(function (a) {
      return COLUMNS.map(function (c) { return csvCell(a[c]); }).join(',');
    }));
    download('pesquisa-piano-hero-' + stamp() + '.csv', '﻿' + lines.join('\n'), 'text/csv;charset=utf-8');
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

    var confirmClear = false;
    panel.addEventListener('click', function (e) {
      var act = e.target && e.target.getAttribute('data-act');
      if (act === 'csv') exportCSV();
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
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
  else buildUI();

  PH.research = {
    participant: participant,
    attemptStart: attemptStart,
    attemptEnd: attemptEnd,
    exportCSV: exportCSV,
    exportJSON: exportJSON,
    getLog: function () { return log.slice(); }
  };
})(window.PianoHero);
