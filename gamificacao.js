/*
 * gamificacao.js — estrelas por fase, medalhas e sequência de dias.
 *
 * Só funções sobre o objeto de progresso (o mesmo `progress` salvo em localStorage por
 * main.js); nada aqui mexe na tela. main.js chama:
 *   - starsFor(acc, wait)        -> 0..3 estrelas de uma tentativa concluída;
 *   - recordAttempt(p, info)     -> atualiza estrelas, contagens e sequência de dias e
 *                                   devolve as medalhas novas;
 *   - recordTutorial(p)          -> idem, quando a introdução termina;
 *   - summary(p)                 -> totais para o perfil e o mapa.
 *
 * Inspiração: as estrelas por música do Guitar Hero e a sequência de dias do Duolingo,
 * em versão pequena — sem moeda, vidas ou loja, para não tirar o foco da prática.
 */
(function (PH) {
  'use strict';

  /** Estrelas de uma tentativa: no ritmo, pela precisão; no Modo espera, no máximo 1. */
  function starsFor(acc, wait) {
    if (wait) return 1;
    return acc >= 95 ? 3 : acc >= 80 ? 2 : acc >= 50 ? 1 : 0;
  }

  var MEDALS = [
    { id: 'tutorial', name: 'Primeiros passos', desc: 'Concluir a introdução e a primeira música guiada.' },
    { id: 'primeira', name: 'Primeira música', desc: 'Concluir uma fase.' },
    { id: 'ritmo', name: 'No ritmo', desc: 'Concluir uma fase no modo normal com 80% ou mais.' },
    { id: 'combo25', name: 'Embalado', desc: 'Fazer um combo de 25 notas.' },
    { id: 'tres', name: 'Três estrelas', desc: 'Ganhar 3 estrelas em uma fase.' },
    { id: 'cinco', name: 'Explorador', desc: 'Concluir 5 fases diferentes.' },
    { id: 'dez', name: 'Persistente', desc: 'Concluir 10 tentativas no total.' },
    { id: 'dias3', name: 'Constância', desc: 'Praticar 3 dias seguidos.' }
  ];

  function ensure(p) {
    if (!p.stars || typeof p.stars !== 'object') p.stars = {};
    if (!p.medals || typeof p.medals !== 'object') p.medals = {};
    if (!p.streak || typeof p.streak !== 'object') p.streak = { days: 0, best: 0, last: null };
    if (typeof p.attempts !== 'number') p.attempts = 0;
  }

  function dayKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /** Conta o dia de hoje na sequência (uma vez por dia; quebra se pulou um dia). */
  function touchStreak(p, now) {
    var today = dayKey(now);
    var s = p.streak;
    if (s.last === today) return;
    var y = new Date(now.getTime()); y.setDate(y.getDate() - 1);
    s.days = s.last === dayKey(y) ? s.days + 1 : 1;
    s.best = Math.max(s.best || 0, s.days);
    s.last = today;
  }

  /** Sequência que vale hoje: zera se o último dia praticado foi antes de ontem. */
  function currentStreak(p, now) {
    ensure(p);
    var s = p.streak;
    if (!s.last) return 0;
    var y = new Date(now.getTime()); y.setDate(y.getDate() - 1);
    return s.last === dayKey(now) || s.last === dayKey(y) ? s.days : 0;
  }

  function award(p, id, list, now) {
    if (p.medals[id]) return;
    p.medals[id] = now.getTime();
    for (var i = 0; i < MEDALS.length; i++) if (MEDALS[i].id === id) list.push(MEDALS[i]);
  }

  function completedSongs(p) {
    return Object.keys(p.best || {}).length;
  }

  function checkCommon(p, list, now) {
    if (completedSongs(p) >= 1) award(p, 'primeira', list, now);
    if (completedSongs(p) >= 5) award(p, 'cinco', list, now);
    if (p.attempts >= 10) award(p, 'dez', list, now);
    if (p.streak.days >= 3) award(p, 'dias3', list, now);
    var ids = Object.keys(p.stars);
    for (var i = 0; i < ids.length; i++) if (p.stars[ids[i]] >= 3) { award(p, 'tres', list, now); break; }
  }

  /**
   * Uma fase concluída (não vale demonstração). `info` = { songId, accuracy, wait, bestCombo }.
   * Devolve { stars, newStars (melhorou?), medals: [medalhas novas] }.
   */
  function recordAttempt(p, info, now) {
    now = now || new Date();
    ensure(p);
    var list = [];
    var s = starsFor(info.accuracy, info.wait);
    var prev = p.stars[info.songId] || 0;
    if (s > prev) p.stars[info.songId] = s;
    p.attempts++;
    touchStreak(p, now);
    if (!info.wait && info.accuracy >= 80) award(p, 'ritmo', list, now);
    if (info.bestCombo >= 25) award(p, 'combo25', list, now);
    checkCommon(p, list, now);
    return { stars: s, improved: s > prev, medals: list };
  }

  function recordTutorial(p, now) {
    now = now || new Date();
    ensure(p);
    var list = [];
    touchStreak(p, now);
    award(p, 'tutorial', list, now);
    checkCommon(p, list, now);
    return list;
  }

  function summary(p, now) {
    ensure(p);
    var total = 0;
    Object.keys(p.stars).forEach(function (k) { total += p.stars[k]; });
    return {
      stars: total,
      completed: completedSongs(p),
      attempts: p.attempts,
      streak: currentStreak(p, now || new Date()),
      bestStreak: p.streak.best || 0,
      medals: MEDALS.map(function (m) { return { id: m.id, name: m.name, desc: m.desc, at: p.medals[m.id] || null }; })
    };
  }

  PH.gami = {
    starsFor: starsFor,
    MEDALS: MEDALS,
    ensure: ensure,
    recordAttempt: recordAttempt,
    recordTutorial: recordTutorial,
    summary: summary,
    currentStreak: currentStreak
  };
})(window.PianoHero);
