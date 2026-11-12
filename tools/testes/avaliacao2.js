// Avaliacao complementar do Piano Hero: MIDI simulado, limites da janela de acerto,
// pratica por mao, metronomo, repeticao de trecho, persistencia, celular e latencia sob carga.
// Uso: node avaliacao2.js <pasta-de-saida>   (jogo servido em http://localhost:8765/)
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const BASE = 'http://localhost:8765/';
const OUT = process.argv[2];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const KEY = {48:'z',49:'s',50:'x',51:'d',52:'c',53:'v',54:'g',55:'b',56:'h',57:'n',58:'j',59:'m',
  60:'q',61:'2',62:'w',63:'3',64:'e',65:'r',66:'5',67:'t',68:'6',69:'y',70:'7',71:'u',72:'i'};

// Dispositivo MIDI virtual: substitui navigator.requestMIDIAccess antes do jogo carregar.
// window.__midi(bytes) entrega uma mensagem ao jogo como se viesse de um piano USB.
const MIDI_MOCK = () => {
  const port = { name: 'Piano virtual', onmidimessage: null };
  navigator.requestMIDIAccess = () => Promise.resolve({ inputs: new Map([['p1', port]]), outputs: new Map(), onstatechange: null });
  window.__midi = bytes => { if (port.onmidimessage) port.onmidimessage({ data: new Uint8Array(bytes), timeStamp: performance.now() }); };
};

async function open(browser, opts = {}) {
  const p = await browser.newPage();
  if (opts.device) await p.emulate(opts.device); else await p.setViewport({ width: 1280, height: 860 });
  if (!opts.keepStorage) await p.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} });
  await p.evaluateOnNewDocument(MIDI_MOCK);
  await p.goto(BASE + (opts.debug ? '?debug' : ''), { waitUntil: 'networkidle0' });
  await sleep(1200);
  return p;
}
const midiOn = (p, n) => p.evaluate(n => window.__midi([0x90, n, 100]), n);
const midiOff = (p, n) => p.evaluate(n => window.__midi([0x80, n, 0]), n);
async function midiTap(p, notes, hold = 60) {
  for (const n of notes) await midiOn(p, n);
  await sleep(hold);
  for (const n of notes) await midiOff(p, n);
}
async function keyTap(p, midi, hold = 40) { const k = KEY[midi]; await p.keyboard.down(k); await sleep(hold); await p.keyboard.up(k); }
async function completeText(p, tries = 80) {
  for (let i = 0; i < tries; i++) {
    const t = await p.evaluate(() => { const e = document.getElementById('screen-complete'); return e && !e.hidden ? e.innerText : null; });
    if (t) { await sleep(2500); return p.evaluate(() => document.getElementById('screen-complete').innerText); }
    await sleep(500);
  }
  return null;
}
async function openSong(p, id) {
  const idx = await p.evaluate(id => [...document.querySelectorAll('.map-bubble')].findIndex(b => b.textContent && b.dataset && (b.dataset.song === id || b.dataset.id === id)), id);
  const ids = await p.evaluate(() => PianoHero.songs.map(s => s.id));
  const bs = await p.$$('.map-bubble:not(.intro)');
  await bs[idx >= 0 ? idx : ids.indexOf(id)].click(); await sleep(700);
}
const songData = (p, id) => p.evaluate(id => { const s = PianoHero.songs.find(x => x.id === id);
  const sh = PianoHero.notes.songShift(s) || 0;   // transposicao por oitavas aplicada pelo jogo
  const tr = n => Array.isArray(n) ? n.map(x => x + sh) : n + sh;
  return { notes: s.notes.map(tr), durations: s.durations, bpm: s.bpm, shift: sh }; }, id);
const asArr = x => Array.isArray(x) ? x : [x];
function onsets(song) { const spt = (60 / song.bpm) / 480; let a = 0; return song.durations.map(d => { const t = a; a += d; return t * spt; }); }
async function playTimed(p, song, offsetMs) {
  const on = onsets(song); await p.click('#btnPlayNormal'); const t0 = Date.now();
  for (let i = 0; i < song.notes.length; i++) {
    const w = t0 + (3 + on[i]) * 1000 + offsetMs - Date.now(); if (w > 0) await sleep(w);
    await keyTap(p, song.notes[i], 30);
  }
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: 'new',
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const res = { chrome: await browser.version() };
  let p;

  // CT9: modo espera com o piano MIDI virtual (mensagens note-on/note-off)
  p = await open(browser);
  res.CT9_midi_status = await p.evaluate(() => document.body.innerText.match(/MIDI:[^\n]*/)?.[0] || null);
  const tw = await songData(p, 'twinkle');
  await openSong(p, 'twinkle'); await p.click('#btnPlayWait'); await sleep(3600);
  for (const n of tw.notes) { await midiTap(p, asArr(n)); await sleep(60); }
  res.CT9_midi_wait = await completeText(p);
  res.CT9_lat = await p.evaluate(() => PianoHero.latency.getStats().bySource.midi);
  await p.close();

  // CT10: nota MIDI duplicada (duas portas do mesmo piano) deve contar uma vez so
  p = await open(browser);
  await openSong(p, 'twinkle'); await p.click('#btnPlayWait'); await sleep(3600);
  for (const n of tw.notes) { const m = asArr(n)[0]; await midiOn(p, m); await midiOn(p, m); await sleep(50); await midiOff(p, m); await midiOff(p, m); await sleep(60); }
  res.CT10_midi_duplicate = await completeText(p);
  await p.close();

  // CT11: modo normal, todas as notas 200 ms atrasadas (dentro da janela, fora do "perfeito")
  p = await open(browser); await openSong(p, 'twinkle'); await playTimed(p, tw, 200);
  res.CT11_late200 = await completeText(p); await p.close();

  // CT12: modo normal, todas as notas 450 ms atrasadas (fora da janela de 350 ms)
  p = await open(browser); await openSong(p, 'twinkle'); await playTimed(p, tw, 450);
  res.CT12_late450 = await completeText(p); await p.close();

  // CT13: metronomo ligado durante 6 s do modo normal (100 BPM => ~10 batidas)
  p = await open(browser); await openSong(p, 'twinkle');
  await p.evaluate(() => { const c = document.getElementById('metronomeToggle'); if (!c.checked) c.click(); });
  await p.evaluate(() => { window.__ticks = 0; const d = document.getElementById('metronomeDot');
    new MutationObserver(() => { if (d.classList.contains('tick')) window.__ticks++; }).observe(d, { attributes: true }); });
  await p.click('#btnPlayNormal'); await sleep(3000);
  await p.evaluate(() => { window.__ticks = 0; }); await sleep(6000);
  res.CT13_metronome_ticks_6s = await p.evaluate(() => window.__ticks);
  res.CT13_metronome_checked = await p.evaluate(() => document.getElementById('metronomeToggle').checked);
  await p.close();

  // CT14: repeticao de trecho - clicar no botao do trecho 2 e verificar que o tempo volta ao inicio dele
  p = await open(browser); await openSong(p, 'twinkle'); await p.click('#btnPlayNormal'); await sleep(3500);
  res.CT14_chips = await p.evaluate(() => [...document.querySelectorAll('.section-chip')].map(b => b.textContent + (b.title ? ' (' + b.title + ')' : '')));
  await p.evaluate(() => document.querySelectorAll('.section-chip')[2].click()); await sleep(200);
  res.CT14_trecho_s = await p.evaluate(() => { const s = PianoHero.debugState || null; return s && [s.loopAFrac * s.songDuration, s.loopBFrac * s.songDuration]; });
  {
    const samples = [];
    for (let i = 0; i < 60; i++) { samples.push(await p.evaluate(() => document.getElementById('vScrubTime')?.textContent || '')); await sleep(250); }
    res.CT14_loop_samples = samples;
  }
  await p.close();

  // CT15: persistencia - concluir uma fase, recarregar a pagina e conferir o progresso salvo
  p = await open(browser);
  await openSong(p, 'twinkle'); await p.click('#btnPlayWait'); await sleep(3600);
  for (const n of tw.notes) { await midiTap(p, asArr(n), 40); await sleep(50); }
  await completeText(p);
  const p2 = await browser.newPage(); await p2.setViewport({ width: 1280, height: 860 });
  await p2.goto(BASE, { waitUntil: 'networkidle0' }); await sleep(1200);
  res.CT15_after_reload = await p2.evaluate(() => { const pr = JSON.parse(localStorage.getItem('pianoHeroProgress') || 'null');
    return pr ? { best: pr.best && pr.best.twinkle, records: pr.records && pr.records.twinkle, last: pr.last && pr.last.twinkle } : null; });
  await openSong(p2, 'twinkle');
  res.CT15_song_card = await p2.evaluate(() => document.getElementById('screen-song')?.innerText.slice(0, 600));
  await p2.close(); await p.close();

  // CT16: celular (emulacao Pixel 5) - retrato pede para girar; paisagem joga com 1 oitava
  const dev = puppeteer.KnownDevices;
  p = await open(browser, { device: dev['Pixel 5'] });
  res.CT16_portrait = await p.evaluate(() => ({ compact: document.documentElement.classList.contains('compact'),
    rotateHintVisible: getComputedStyle(document.getElementById('rotateHint')).display !== 'none' }));
  await p.close();
  p = await open(browser, { device: dev['Pixel 5 landscape'] });
  res.CT16_landscape = await p.evaluate(() => ({ compact: document.documentElement.classList.contains('compact'),
    rotateHintVisible: getComputedStyle(document.getElementById('rotateHint')).display !== 'none',
    range: [PianoHero.notes.MIN_MIDI, PianoHero.notes.MAX_MIDI] }));
  const hc = await songData(p, 'hotcross');
  await openSong(p, 'hotcross'); await p.tap('#btnPlayWait'); await sleep(3600);
  for (const n of hc.notes) { await midiTap(p, asArr(n)); await sleep(60); }
  res.CT16_mobile_play = await completeText(p);
  await p.close();

  // Latencia sob carga: "Für Elise (tema inicial)", a musica mais densa do repertorio (3,6 notas/s),
  // em modo normal e repetida em laco (o tema dura 10 s), 400 teclas, CPU normal e 4x mais lenta
  for (const thr of [1, 4]) {
    p = await open(browser, { debug: true }); await openSong(p, 'furelise'); await p.click('#btnPlayNormal');
    await p.evaluate(() => { const s = PianoHero.debugState; s.loopAFrac = 0; s.loopBFrac = 1; s.loopEnabled = true; }); await sleep(4000);
    const cdp = await p.target().createCDPSession(); await cdp.send('Emulation.setCPUThrottlingRate', { rate: thr });
    await p.evaluate(() => PianoHero.latency.clear());
    const ks = Object.keys(KEY).map(Number);
    for (let i = 0; i < 200; i++) { await keyTap(p, ks[(i * 5) % ks.length], 40); await sleep(80); }
    for (let i = 0; i < 200; i++) { await midiTap(p, [ks[(i * 7) % ks.length]], 40); await sleep(80); }
    const csv = await p.evaluate(() => new Promise(r => { const o = URL.createObjectURL; URL.createObjectURL = b => { b.text().then(r); return o(b); }; PianoHero.latency.exportCSV(); }));
    fs.writeFileSync(OUT + '/latencia-carga-cpu' + thr + 'x.csv', csv);
    await p.close();
  }
  // Latencia MIDI sem carga (modo livre)
  p = await open(browser); await p.click('#btnFree'); await sleep(1500);
  await p.evaluate(() => PianoHero.latency.clear());
  const ks = Object.keys(KEY).map(Number);
  for (let i = 0; i < 200; i++) { await midiTap(p, [ks[i % ks.length]], 50); await sleep(120); }
  const csv = await p.evaluate(() => new Promise(r => { const o = URL.createObjectURL; URL.createObjectURL = b => { b.text().then(r); return o(b); }; PianoHero.latency.exportCSV(); }));
  fs.writeFileSync(OUT + '/latencia-midi-livre.csv', csv);
  await p.close();

  await browser.close();
  fs.writeFileSync(OUT + '/resultados2.json', JSON.stringify(res, null, 2));
  console.log(JSON.stringify(res, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
