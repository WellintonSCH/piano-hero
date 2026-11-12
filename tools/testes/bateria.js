// Bateria de testes de todas as funcionalidades do Piano Hero.
// Cada teste abre o jogo do zero (localStorage limpo), executa a ação como um usuário faria
// (cliques, teclado do PC, piano MIDI virtual) e confere o resultado na tela e no estado do
// jogo (?debug expõe PianoHero.debugState). Saída: tabela PASSOU/FALHOU no terminal e em
// <pasta>/bateria.json e <pasta>/bateria.md.
// Uso: node bateria.js [pasta-de-saida]      (jogo servido em http://localhost:8765/)
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:8765/';
const OUT = process.argv[2] || 'resultados';
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

const MIDI_MOCK = () => {
  const port = { name: 'Piano virtual', onmidimessage: null };
  navigator.requestMIDIAccess = () => Promise.resolve({ inputs: new Map([['p1', port]]), outputs: new Map(), onstatechange: null });
  window.__midi = b => { if (port.onmidimessage) port.onmidimessage({ data: new Uint8Array(b), timeStamp: performance.now() }); };
};
const KEY = { 60: 'q', 62: 'w', 64: 'e', 65: 'r', 67: 't', 69: 'y', 71: 'u', 72: 'i' };

let browser;
async function open(opts = {}) {
  const p = await browser.newPage();
  p.__errors = [];
  p.on('pageerror', e => p.__errors.push(String(e)));
  if (opts.device) await p.emulate(puppeteer.KnownDevices[opts.device]);
  else await p.setViewport({ width: opts.w || 1366, height: opts.h || 768 });
  await p.evaluateOnNewDocument(MIDI_MOCK);
  const progress = opts.progress === undefined ? { intro: { done: true, accuracy: 90 }, guide: { done: true } } : opts.progress;
  await p.evaluateOnNewDocument((pr, keep) => {
    if (keep || sessionStorage.__init) return;
    sessionStorage.__init = 1;
    localStorage.clear();
    if (pr) localStorage.setItem('pianoHeroProgress', JSON.stringify(pr));
  }, progress, !!opts.keepStorage);
  await p.goto(BASE + (opts.query || '?debug'), { waitUntil: 'networkidle0' });
  await sleep(700);
  return p;
}
const S = p => p.evaluate(() => {
  const s = PianoHero.debugState;
  return { mode: s.mode, running: s.running, paused: s.paused, t: s.songTime, cursor: s.cursor, n: s.timeline.length,
    wait: s.waitMode, demo: s.demoMode, speed: s.speed, bpm: s.song ? Math.round(s.song.bpm * s.speed) : null,
    loop: s.loopEnabled, cd: s.countdownTo, hint: s.hint, lesson: !!s.lesson, guide: s.guide && s.guide.step };
});
const visible = (p, id) => p.evaluate(id => { const e = document.getElementById(id); if (!e || e.hidden) return false; const cs = getComputedStyle(e), r = e.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; }, id);
const screenOn = (p, name) => p.evaluate(n => !document.getElementById('overlay').hidden && !document.getElementById('screen-' + n).hidden, name);
const click = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error('não achei ' + s); e.click(); }, sel);
const midi = async (p, n, ms = 60) => { await p.evaluate(n => window.__midi([0x90, n, 90]), n); await sleep(ms); await p.evaluate(n => window.__midi([0x80, n, 0]), n); };
async function waitFor(p, fn, ms = 15000, arg) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await p.evaluate(fn, arg)) return true; await sleep(120); }
  return false;
}
async function openSong(p, idx = 0) {
  await p.evaluate(i => document.querySelectorAll('.map-bubble:not(.intro)')[i].click(), idx); await sleep(400);
}
async function maxBpm(p) {
  await p.evaluate(() => { const r = document.getElementById('setupBpm'); r.value = r.max; r.dispatchEvent(new Event('input', { bubbles: true })); });
}
/** Toca cada nota pendente no instante certo (ou na hora, no modo espera) até a tela pedida aparecer. */
async function playUntil(p, done, ms = 90000, wrongEvery = 0) {
  const end = Date.now() + ms; let k = 0;
  while (Date.now() < end) {
    if (await p.evaluate(done)) return true;
    const t = await p.evaluate(() => { const s = PianoHero.debugState; const c = s.timeline[s.cursor];
      if (!c || !s.running || s.paused) return null; return (s.waitMode || c.time - s.songTime < 0.02) ? s.targetMidis[0] : null; });
    if (t == null) { await sleep(15); continue; }
    if (wrongEvery && ++k % wrongEvery === 0) await midi(p, t + 1, 30);
    await midi(p, t, 40);
  }
  return false;
}
const completeOn = () => !document.getElementById('overlay').hidden && !document.getElementById('screen-complete').hidden;

const results = [];
async function T(id, area, desc, fn) {
  const t0 = Date.now(); let ok = false, detail = '', pages = [];
  try {
    const r = await Promise.race([fn(pages), new Promise((_, rej) => setTimeout(() => rej(new Error('tempo esgotado')), 180000))]);
    ok = r.ok; detail = r.detail || '';
  } catch (e) { detail = 'erro: ' + e.message; }
  for (const p of pages) { if (p.__errors && p.__errors.length) { ok = false; detail += ' | erro na página: ' + p.__errors[0]; } await p.close().catch(() => {}); }
  results.push({ id, area, desc, ok, detail, s: Math.round((Date.now() - t0) / 100) / 10 });
  console.log((ok ? 'PASSOU ' : 'FALHOU ') + id + ' ' + desc + (detail ? ' — ' + detail : ''));
}

(async () => {
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 300000,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });

  // ---------------- Mapa e telas ----------------
  await T('B01', 'Mapa', 'Primeiro acesso: mapa abre com "Primeiros passos" em destaque', async pg => {
    const p = await open({ progress: null }); pg.push(p);
    const r = await p.evaluate(() => ({ home: !document.getElementById('screen-home').hidden, intro: document.querySelector('.map-bubble.intro').className, n: document.querySelectorAll('.map-bubble:not(.intro)').length }));
    return { ok: r.home && /current/.test(r.intro) && r.n >= 10, detail: r.n + ' fases no mapa' };
  });
  await T('B02', 'Mapa', 'Ajuda, ranking e perfil abrem e voltam ao mapa', async pg => {
    const p = await open(); pg.push(p); const ok = [];
    for (const [btn, scr, back] of [['#btnHelp', 'help', '#btnBackHomeFromHelp'], ['#btnRanking', 'ranking', '#btnBackHomeFromRanking'], ['#btnProfile', 'profile', '#btnProfileBack']]) {
      await click(p, btn); await sleep(250); const a = await screenOn(p, scr);
      await click(p, back); await sleep(250); const b = await screenOn(p, 'home'); ok.push(a && b);
    }
    return { ok: ok.every(Boolean), detail: ok.join(',') };
  });
  await T('B03', 'Tela da música', 'Abrir fase mostra modos e permite mudar a velocidade (±1 e voltar ao original)', async pg => {
    const p = await open(); pg.push(p); await openSong(p, 1);
    const v0 = await p.evaluate(() => document.getElementById('setupBpmOut').textContent);
    await click(p, '#setupBpmMinus'); await click(p, '#setupBpmMinus');
    const v1 = await p.evaluate(() => document.getElementById('setupBpmOut').textContent);
    await click(p, '#setupBpmReset'); const v2 = await p.evaluate(() => document.getElementById('setupBpmOut').textContent);
    const modes = await Promise.all(['btnPlayNormal', 'btnPlayWait', 'btnPlayDemo'].map(id => visible(p, id)));
    return { ok: modes.every(Boolean) && parseInt(v1) === parseInt(v0) - 2 && v2 === v0, detail: v0 + ' → ' + v1 + ' → ' + v2 };
  });

  // ---------------- Introdução ----------------
  await T('B04', 'Introdução', 'Primeiros passos: 7 passos, só uma oitava, Dó em outra oitava vale, termina na tela final', async pg => {
    const p = await open({ progress: null }); pg.push(p);
    await click(p, '.map-bubble.intro'); await sleep(1500);
    const range = await p.evaluate(() => [PianoHero.notes.MIN_MIDI, PianoHero.notes.MAX_MIDI]);
    await midi(p, 48); await sleep(400);
    const step1 = await p.evaluate(() => PianoHero.debugState.lesson.hits);
    let guard = 0;
    while (guard++ < 400 && !(await screenOn(p, 'intro'))) {
      const t = await p.evaluate(() => { const s = PianoHero.debugState; return s.notes[0] && s.notes[0].midi; });
      if (!t) { await sleep(80); continue; }
      await midi(p, t, 40); await sleep(60);
    }
    const end = await screenOn(p, 'intro');
    const steps = await p.evaluate(() => document.getElementById('introStats').textContent);
    return { ok: range[0] === 60 && range[1] === 72 && step1 >= 1 && end, detail: 'teclado ' + range.join('–') + '; ' + steps.replace(/\s+/g, ' ').slice(0, 60) };
  });
  await T('B05', 'Introdução', 'Música guiada: ouvir → modo espera → no ritmo (56 BPM) → cartão final; fase 1 concluída', async pg => {
    const p = await open({ progress: { intro: { done: true, accuracy: 90 } } }); pg.push(p);
    await click(p, '.map-bubble.intro'); await sleep(400);
    const guide = () => !document.getElementById('overlay').hidden && !document.getElementById('screen-guide').hidden;
    const steps = [await p.evaluate(() => document.getElementById('guideStep').textContent)];
    await click(p, '#btnGuideGo'); await waitFor(p, guide, 60000);
    steps.push(await p.evaluate(() => document.getElementById('guideStep').textContent));
    await click(p, '#btnGuideGo'); await sleep(500); await playUntil(p, guide);
    steps.push(await p.evaluate(() => document.getElementById('guideStep').textContent));
    await click(p, '#btnGuideGo'); await sleep(300); const bpm = (await S(p)).bpm; await playUntil(p, guide);
    steps.push(await p.evaluate(() => document.getElementById('guideStep').textContent));
    await click(p, '#btnGuideGo'); await sleep(400);
    const done = await p.evaluate(() => /done/.test(document.querySelector('.map-bubble.intro').className) && /done/.test(document.querySelectorAll('.map-bubble:not(.intro)')[0].className));
    return { ok: steps.length === 4 && /Tutorial/.test(steps[3]) && bpm === 56 && done, detail: steps.map(s => s.split('·')[0].trim()).join(' / ') + '; ' + bpm + ' BPM' };
  });

  // ---------------- Modos de jogo ----------------
  await T('B06', 'Modos', 'Jogar (normal) tocando tudo no tempo: 100%, 3 estrelas, tela de fim', async pg => {
    const p = await open(); pg.push(p); await openSong(p, 0); await maxBpm(p); await click(p, '#btnPlayNormal');
    const ok = await playUntil(p, completeOn); await sleep(2500);
    const r = await p.evaluate(() => ({ stars: document.querySelectorAll('#completeStars .star.on').length, title: document.getElementById('completeTitle').textContent, stats: document.getElementById('completeStats').textContent.replace(/\s+/g, ' ') }));
    return { ok: ok && r.stars === 3 && /100%/.test(r.stats), detail: r.stars + '★; ' + r.stats.slice(0, 60) };
  });
  await T('B07', 'Modos', 'Modo espera: música para na nota, erro não avança; ao fim, "Agora no ritmo" em destaque', async pg => {
    const p = await open(); pg.push(p); await openSong(p, 0); await maxBpm(p); await click(p, '#btnPlayWait');
    await sleep(4000); const a = await S(p); await sleep(1500); const b = await S(p);
    const target = await p.evaluate(() => PianoHero.debugState.targetMidis[0]);
    await midi(p, target + 2); await sleep(200); const c = await S(p);
    const ok = await playUntil(p, completeOn);
    const r = await p.evaluate(() => ({ try: !document.getElementById('btnTryNormal').hidden && document.getElementById('btnTryNormal').classList.contains('primary') }));
    return { ok: Math.abs(a.t - b.t) < 0.01 && c.cursor === b.cursor && ok && r.try, detail: 'relógio parado em ' + a.t.toFixed(2) + ' s; erro não avançou' };
  });
  await T('B08', 'Modos', 'Demonstração: ignora o jogador e, no fim, volta à tela da música sugerindo o modo espera', async pg => {
    const p = await open(); pg.push(p); await openSong(p, 0); await maxBpm(p); await click(p, '#btnPlayDemo'); await sleep(3500);
    const c0 = (await S(p)).cursor; await midi(p, 30); const st = await S(p);
    const back = await waitFor(p, () => !document.getElementById('overlay').hidden && !document.getElementById('screen-song').hidden, 60000);
    const r = await p.evaluate(() => ({ notice: document.getElementById('setupNotice').hidden ? '' : document.getElementById('setupNotice').textContent, sug: !!document.querySelector('#btnPlayWait.suggested') }));
    return { ok: st.demo && back && r.sug && /espera/i.test(r.notice), detail: r.notice.slice(0, 50) };
  });
  await T('B09', 'Fim de fase', 'Botões do fim: Agora no ritmo (mesma velocidade), Repetir, Voltar à música, Fases', async pg => {
    const p = await open(); pg.push(p); await openSong(p, 0); await maxBpm(p); await click(p, '#btnPlayWait');
    await playUntil(p, completeOn); const bpm0 = (await S(p)).bpm;
    await click(p, '#btnTryNormal'); await sleep(400); const a = await S(p);
    await click(p, '#restart').catch(() => {}); // reinício pela HUD
    await sleep(200); await p.evaluate(() => { const s = PianoHero.debugState; });
    // volta ao fim pelo modo espera de novo
    await p.evaluate(() => document.getElementById('menuBtn') && 0);
    const p2 = await open(); pg.push(p2); await openSong(p2, 0); await maxBpm(p2); await click(p2, '#btnPlayWait'); await playUntil(p2, completeOn);
    await click(p2, '#btnRetryLevel'); await sleep(400); const retry = await S(p2);
    await p2.evaluate(() => { PianoHero.debugState.running = false; });
    const p3 = await open(); pg.push(p3); await openSong(p3, 0); await maxBpm(p3); await click(p3, '#btnPlayWait'); await playUntil(p3, completeOn);
    await click(p3, '#btnBackToSong'); await sleep(300); const song = await screenOn(p3, 'song');
    await click(p3, '#btnBackFromSong'); await sleep(300); const home = await screenOn(p3, 'home');
    return { ok: !a.wait && !a.demo && a.running && a.bpm === bpm0 && retry.running && retry.wait && song && home, detail: 'ritmo a ' + a.bpm + ' BPM; repetir, voltar e fases ok' };
  });

  // ---------------- Pausa e navegação ----------------
  await T('B10', 'Pausa', 'Clique na pista pausa; Esc retoma com rebobinar de 3 s e contagem', async pg => {
    const p = await open(); pg.push(p); await openSong(p, 1); await click(p, '#btnPlayNormal'); await sleep(6000);
    const box = await (await p.$('canvas')).boundingBox();
    await p.mouse.click(box.x + box.width / 2, box.y + 60); await sleep(300);
    const a = await S(p); const pause = await screenOn(p, 'pause');
    await p.keyboard.press('Escape'); await sleep(250); const b = await S(p);
    await sleep(1200); const cdShown = await p.evaluate(() => !document.getElementById('countdown').hidden);
    return { ok: a.paused && pause && !b.paused && cdShown, detail: 'pausou em ' + a.t.toFixed(1) + ' s; contagem exibida' };
  });
  await T('B11', 'Pausa', 'Na pausa: −5 s, +5 s e voltar ao início mudam o tempo da música', async pg => {
    const p = await open(); pg.push(p); await openSong(p, 1); await click(p, '#btnPlayNormal'); await sleep(9000);
    await p.keyboard.press('Escape'); await sleep(300); const t0 = (await S(p)).t;
    await click(p, '#btnSeekFwdPause'); await sleep(200); const t1 = (await S(p)).t;
    await click(p, '#btnSeekBackPause'); await sleep(200); const t2 = (await S(p)).t;
    await click(p, '#btnRestartFromPause'); await sleep(400); const t3 = (await S(p)).t;
    return { ok: t1 - t0 > 4 && t1 - t2 > 4 && t3 < 0.5, detail: [t0, t1, t2, t3].map(x => x.toFixed(1)).join(' → ') };
  });
  await T('B12', 'Pausa', 'Roda do mouse na pista avança/volta a música', async pg => {
    const p = await open(); pg.push(p); await openSong(p, 1); await click(p, '#btnPlayNormal'); await sleep(6000);
    const box = await (await p.$('canvas')).boundingBox();
    await p.mouse.move(box.x + box.width / 2, box.y + 80); const t0 = (await S(p)).t;
    await p.mouse.wheel({ deltaY: -600 }); await sleep(400); const t1 = (await S(p)).t;
    return { ok: Math.abs(t1 - t0) > 0.5 && (await S(p)).paused, detail: t0.toFixed(1) + ' → ' + t1.toFixed(1) + ' s (pausado)' };
  });
  await T('B13', 'Opções', '⚙ Opções pausa a música; fechar retoma', async pg => {
    const p = await open(); pg.push(p); await openSong(p, 1); await click(p, '#btnPlayNormal'); await sleep(5000);
    await click(p, '#optionsBtn'); await sleep(1200); const a = await S(p); const t0 = a.t; await sleep(800); const t1 = (await S(p)).t;
    await click(p, '#optionsBtn'); await sleep(4500); const b = await S(p);
    return { ok: a.paused && Math.abs(t1 - t0) < 0.01 && !b.paused && b.t > t1, detail: 'parado em ' + t0.toFixed(1) + ' s; retomou' };
  });

  // ---------------- Velocidade, metrônomo, opções ----------------
  await T('B14', 'Velocidade', 'Escolher 50 BPM deixa a música proporcionalmente mais longa', async pg => {
    const p = await open(); pg.push(p); await openSong(p, 1);
    await click(p, '#btnPlayNormal'); await sleep(300);
    const d0 = await p.evaluate(() => PianoHero.debugState.songDuration);
    await p.evaluate(() => { PianoHero.debugState.running = false; });
    const p2 = await open(); pg.push(p2); await openSong(p2, 1);
    const bpm0 = await p2.evaluate(() => +document.getElementById('setupBpm').value);
    await p2.evaluate(() => { const r = document.getElementById('setupBpm'); r.value = 50; r.dispatchEvent(new Event('input', { bubbles: true })); });
    await click(p2, '#btnPlayNormal'); await sleep(300);
    const d1 = await p2.evaluate(() => PianoHero.debugState.songDuration); const s = await S(p2);
    const ratio = d1 / d0, expected = bpm0 / 50;
    return { ok: s.bpm === 50 && Math.abs(ratio - expected) < 0.02, detail: bpm0 + '→50 BPM; duração ×' + ratio.toFixed(2) + ' (esperado ×' + expected.toFixed(2) + ')' };
  });
  await T('B15', 'Opções', 'Metrônomo marca o tempo (≈ batidas por segundo do BPM)', async pg => {
    const p = await open(); pg.push(p); await openSong(p, 1);
    await p.evaluate(() => { const c = document.getElementById('metronomeToggle'); if (!c.checked) c.click(); });
    await p.evaluate(() => { window.__ticks = 0; const d = document.getElementById('metronomeDot'); new MutationObserver(() => { if (d.classList.contains('tick')) window.__ticks++; }).observe(d, { attributes: true }); });
    await click(p, '#btnPlayNormal'); await sleep(3500); await p.evaluate(() => { window.__ticks = 0; }); await sleep(6000);
    const ticks = await p.evaluate(() => window.__ticks); const bpm = (await S(p)).bpm; const exp = bpm / 10;
    return { ok: Math.abs(ticks - exp) <= 2, detail: ticks + ' batidas em 6 s a ' + bpm + ' BPM (esperado ≈' + exp.toFixed(0) + ')' };
  });
  await T('B16', 'Opções', 'Dica, efeitos e silenciar piano mudam e ficam salvos ao recarregar', async pg => {
    const p = await open(); pg.push(p); await openSong(p, 1); await click(p, '#btnPlayNormal'); await sleep(1500);
    await click(p, '#optionsBtn'); await sleep(1000);
    const before = await p.evaluate(() => ['hintToggle', 'effectsToggle', 'muteToggle'].map(id => document.getElementById(id).checked));
    for (const id of ['hintToggle', 'effectsToggle', 'muteToggle']) await click(p, '#' + id);
    const after = await p.evaluate(() => ['hintToggle', 'effectsToggle', 'muteToggle'].map(id => document.getElementById(id).checked));
    await p.reload({ waitUntil: 'networkidle0' }); await sleep(700);
    const reload = await p.evaluate(() => ['hintToggle', 'effectsToggle', 'muteToggle'].map(id => document.getElementById(id).checked));
    return { ok: after.every((v, i) => v !== before[i]) && JSON.stringify(reload) === JSON.stringify(after), detail: 'antes ' + before + ' / depois ' + after + ' / recarregado ' + reload };
  });

  // ---------------- Repetir trecho ----------------
  await T('B17', 'Repetir trecho', 'Botão de trecho repete com contagem 3-2-1; notas após o trecho não aparecem; "Música toda" desliga', async pg => {
    const p = await open(); pg.push(p); await openSong(p, 1); await click(p, '#btnPlayDemo'); await sleep(3000);
    await click(p, '.section-chip[data-k="1"]'); await sleep(200);
    const ab = await p.evaluate(() => { const s = PianoHero.debugState; return [s.loopAFrac * s.songDuration, s.loopBFrac * s.songDuration]; });
    let wrapped = false, sawCd = false, beyond = 0, last = 0;
    for (let i = 0; i < 80; i++) {
      const r = await p.evaluate(B => { const s = PianoHero.debugState; return { t: s.songTime, cd: !document.getElementById('countdown').hidden, beyond: s.notes.filter(n => s.timeline[n.chordIndex] && s.timeline[n.chordIndex].time >= B - 1e-6).length }; }, ab[1]);
      if (r.cd) sawCd = true; beyond = Math.max(beyond, r.beyond); if (r.t < last - 1) wrapped = true; last = r.t; if (wrapped && i > 10) break; await sleep(250);
    }
    await click(p, '.section-chip[data-k=""]'); await sleep(200); const off = !(await S(p)).loop;
    return { ok: wrapped && sawCd && beyond === 0 && off, detail: 'trecho ' + ab.map(x => x.toFixed(1)).join('–') + ' s; voltou=' + wrapped + ', contagem=' + sawCd };
  });

  // ---------------- Modo livre e entradas ----------------
  await T('B18', 'Modo livre', 'Modo livre: notas aparecem e somem ao acertar (MIDI)', async pg => {
    const p = await open(); pg.push(p); await click(p, '#btnFree'); await sleep(1500);
    const before = await p.evaluate(() => ({ n: PianoHero.debugState.notes.length, m: PianoHero.debugState.notes[0] && PianoHero.debugState.notes[0].midi, score: PianoHero.debugState.score }));
    await midi(p, before.m); await sleep(400);
    const after = await p.evaluate(() => ({ m: PianoHero.debugState.notes[0] && PianoHero.debugState.notes[0].midi, score: PianoHero.debugState.score }));
    return { ok: before.n > 0 && after.score > before.score, detail: before.n + ' notas na fila; pontos ' + before.score + ' → ' + after.score };
  });
  await T('B19', 'Entradas', 'Teclado do PC e clique na tecla desenhada tocam notas; digitar no nome do perfil não toca', async pg => {
    const p = await open(); pg.push(p);
    await p.evaluate(() => { window.__n = []; window.addEventListener('notePlayed', e => window.__n.push(e.detail.source + ':' + e.detail.midi)); });
    await click(p, '#btnFree'); await sleep(1000);
    await p.keyboard.press('q'); await sleep(100);
    const box = await (await p.$('canvas')).boundingBox();
    await p.mouse.click(box.x + box.width / 2, box.y + box.height - 20); await sleep(100);
    const kb = await p.evaluate(() => window.__n.slice());
    await click(p, '#menuBtn').catch(() => {}); await sleep(200);
    await p.evaluate(() => { document.getElementById('btnProfile').click(); }); await sleep(300);
    await p.evaluate(() => { window.__n = []; }); await p.focus('#profileName'); await p.keyboard.type('qwerty'); await sleep(200);
    const typed = await p.evaluate(() => ({ n: window.__n.length, v: document.getElementById('profileName').value }));
    const srcs = kb.map(x => x.split(':')[0]);
    return { ok: srcs.includes('keyboard') && srcs.some(s => s !== 'keyboard' && s !== 'midi') && typed.n === 0 && typed.v === 'qwerty', detail: kb.join(' ') + '; ao digitar: ' + typed.n + ' notas, campo="' + typed.v + '"' };
  });

  // ---------------- Gamificação e perfil ----------------
  await T('B20', 'Gamificação', 'Estrelas no mapa, medalha anunciada e sequência de dias após concluir uma fase', async pg => {
    const p = await open(); pg.push(p); await openSong(p, 0); await maxBpm(p); await click(p, '#btnPlayNormal');
    await playUntil(p, completeOn); await sleep(400);
    const toast = await p.evaluate(() => document.getElementById('toast').textContent);
    await click(p, '#btnToLevelsFromComplete'); await sleep(400);
    const r = await p.evaluate(() => ({ stars: document.querySelectorAll('.map-bubble:not(.intro)')[0].querySelectorAll('.star.on').length, status: document.getElementById('homeStatus').textContent.replace(/\s+/g, ' ').trim() }));
    return { ok: r.stars === 3 && /medalha/i.test(toast) && /1 dia/.test(r.status), detail: r.stars + '★ no mapa; aviso "' + toast.replace(/\s+/g, ' ').slice(0, 40) + '"; selo "' + r.status + '"' };
  });
  await T('B21', 'Perfil', 'Perfil: nome, cor e tema claro aplicam na hora e continuam após recarregar', async pg => {
    const p = await open(); pg.push(p); await click(p, '#btnProfile'); await sleep(300);
    await p.focus('#profileName'); await p.keyboard.type('Ana');
    await click(p, '[data-accent="rosa"]'); await click(p, '[data-theme-opt="claro"]'); await sleep(200);
    const now = await p.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.dataset.accent, getComputedStyle(document.body).backgroundImage.slice(0, 30)]);
    await p.reload({ waitUntil: 'networkidle0' }); await sleep(600);
    const later = await p.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.dataset.accent, JSON.parse(localStorage.getItem('pianoHeroProgress')).profile.name]);
    return { ok: now[0] === 'light' && now[1] === 'rosa' && later[0] === 'light' && later[1] === 'rosa' && later[2] === 'Ana', detail: later.join(', ') };
  });

  // ---------------- Modo pesquisa e latência ----------------
  await T('B22', 'Modo pesquisa', '?pesquisa=: selo, tentativa registrada, CSV exportado e troca de participante zera o progresso', async pg => {
    const p = await open({ query: '?debug&pesquisa=T01' }); pg.push(p);
    const badge = await p.evaluate(() => (document.querySelector('.research-badge') || {}).textContent);
    await openSong(p, 0); await maxBpm(p); await click(p, '#btnPlayNormal'); await playUntil(p, completeOn);
    const log = await p.evaluate(() => PianoHero.research.getLog().map(a => a.participante + ':' + a.modo + ':' + a.status));
    const csv = await p.evaluate(() => new Promise(r => { const o = URL.createObjectURL; URL.createObjectURL = b => { b.text().then(r); return o(b); }; PianoHero.research.exportCSV(); }));
    await p.goto(BASE + '?debug&pesquisa=T02', { waitUntil: 'networkidle0' }); await sleep(600);
    const prog = await p.evaluate(() => localStorage.getItem('pianoHeroProgress'));
    const zerou = !prog || !JSON.parse(prog).best || !Object.keys(JSON.parse(prog).best).length;
    return { ok: /T01/.test(badge) && log.some(l => /T01:normal:concluida/.test(l)) && /^﻿?participante,/.test(csv) && zerou, detail: log.join(' ') + '; CSV ' + csv.split('\n').length + ' linhas' };
  });
  await T('B23', 'Latência', 'Painel Medir latência coleta amostras e exporta CSV com as colunas de contexto', async pg => {
    const p = await open(); pg.push(p); await click(p, '#btnFree'); await sleep(1000);
    await click(p, '#optionsBtn'); await sleep(200); await click(p, '#latencyToggle'); await click(p, '#optionsBtn'); await sleep(300);
    for (let i = 0; i < 6; i++) { await midi(p, 60); await sleep(150); }
    const csv = await p.evaluate(() => new Promise(r => { const o = URL.createObjectURL; URL.createObjectURL = b => { b.text().then(r); return o(b); }; PianoHero.latency.exportCSV(); }));
    const lines = csv.trim().split('\n'); const ok = /mode,songPlaying,baseLatencyMs,outputLatencyMs,sampleRate,userAgent/.test(lines[0]) && lines.length >= 7;
    return { ok: ok && await visible(p, 'latencyPanel'), detail: (lines.length - 1) + ' amostras' };
  });

  // ---------------- Layout e celular ----------------
  await T('B24', 'Layout', 'Notebook 1366×657: teclado inteiro visível no jogo, no modo livre e ao tocar com o painel de latência', async pg => {
    const p = await open({ w: 1366, h: 657 }); pg.push(p); const fits = [];
    const fit = async () => p.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return c.bottom <= innerHeight + 1 && c.height > 300; });
    await openSong(p, 1); await click(p, '#btnPlayNormal'); await sleep(1500); fits.push(await fit());
    await p.goto(BASE + '?debug', { waitUntil: 'networkidle0' }); await sleep(600); await click(p, '#btnFree'); await sleep(1200); fits.push(await fit());
    await click(p, '#optionsBtn'); await sleep(200); await click(p, '#latencyToggle'); await click(p, '#optionsBtn'); await sleep(300);
    for (let i = 0; i < 6; i++) { await midi(p, 60 + i); await sleep(120); } await sleep(500); fits.push(await fit());
    return { ok: fits.every(Boolean), detail: fits.join(',') };
  });
  await T('B25', 'Celular', 'Celular: em pé pede para girar; deitado tem teclado de 1 oitava e conclui uma fase', async pg => {
    const p = await open({ device: 'Pixel 5' }); pg.push(p);
    const rot = await visible(p, 'rotateHint');
    const p2 = await open({ device: 'Pixel 5 landscape' }); pg.push(p2);
    const range = await p2.evaluate(() => [PianoHero.notes.MIN_MIDI, PianoHero.notes.MAX_MIDI]);
    await openSong(p2, 0); await click(p2, '#btnPlayWait'); const ok = await playUntil(p2, completeOn);
    return { ok: rot && range[0] === 60 && range[1] === 72 && ok, detail: 'girar=' + rot + '; teclado ' + range.join('–') + '; fase concluída=' + ok };
  });
  await T('B26', 'Progresso', 'Progresso e velocidade escolhida continuam após recarregar a página', async pg => {
    const p = await open(); pg.push(p); await openSong(p, 0); await maxBpm(p); const bpm = await p.evaluate(() => +document.getElementById('setupBpm').value);
    await click(p, '#btnPlayWait'); await playUntil(p, completeOn); await click(p, '#btnToLevelsFromComplete'); await sleep(300);
    await p.reload({ waitUntil: 'networkidle0' }); await sleep(700);
    const done = await p.evaluate(() => /done/.test(document.querySelectorAll('.map-bubble:not(.intro)')[0].className));
    await openSong(p, 0); const bpm2 = await p.evaluate(() => +document.getElementById('setupBpm').value);
    const last = await p.evaluate(() => document.getElementById('setupLast').textContent.replace(/\s+/g, ' ').trim());
    return { ok: done && bpm2 === bpm && last.length > 0, detail: 'fase concluída; ' + bpm2 + ' BPM; "' + last.slice(0, 50) + '"' };
  });

  await browser.close();
  const pass = results.filter(r => r.ok).length;
  console.log('\n' + pass + ' de ' + results.length + ' passaram');
  fs.writeFileSync(path.join(OUT, 'bateria.json'), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(OUT, 'bateria.md'), '| Teste | Área | O que verifica | Resultado | Detalhe |\n|---|---|---|---|---|\n' +
    results.map(r => `| ${r.id} | ${r.area} | ${r.desc} | ${r.ok ? 'Passou' : '**Falhou**'} | ${r.detail.replace(/\|/g, '/')} |`).join('\n') + '\n');
})().catch(e => { console.error(e); process.exit(1); });
