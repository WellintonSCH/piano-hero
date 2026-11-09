// Avaliacao funcional e de latencia do Piano Hero (Chrome headless + puppeteer-core)
// Uso: node avaliacao.js <pasta-de-saida>   (jogo servido em http://localhost:8765/)
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const URL = 'http://localhost:8765/';
const OUT = process.argv[2];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const KEY = {48:'z',49:'s',50:'x',51:'d',52:'c',53:'v',54:'g',55:'b',56:'h',57:'n',58:'j',59:'m',
  60:'q',61:'2',62:'w',63:'3',64:'e',65:'r',66:'5',67:'t',68:'6',69:'y',70:'7',71:'u',72:'i'};

async function open(browser) {
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 860 });
  await p.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} });
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await sleep(1200);
  return p;
}
async function tap(p, midi, hold = 60) {
  const k = KEY[midi]; if (!k) throw new Error('sem tecla para ' + midi);
  await p.keyboard.down(k); await sleep(hold); await p.keyboard.up(k);
}
async function completeText(p) {
  for (let i = 0; i < 60; i++) {
    const t = await p.evaluate(() => { const e = document.getElementById('screen-complete'); return e && !e.hidden ? e.innerText : null; });
    if (t) return t; await sleep(500);
  }
  return null;
}
async function openSong(p, idx) {
  const b = await p.$$('.map-bubble'); await b[idx].click(); await sleep(700);
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: 'new',
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const res = { chrome: await browser.version() };

  // ---------- dados da musica ----------
  let p = await open(browser);
  const song = await p.evaluate(() => { const s = PianoHero.songs.find(x => x.id === 'twinkle'); return { notes: s.notes, durations: s.durations, bpm: s.bpm }; });
  res.song = { id: 'twinkle', n: song.notes.length, bpm: song.bpm };
  res.audio = await p.evaluate(async () => { const c = new AudioContext(); await c.resume(); return { sampleRate: c.sampleRate, baseLatency: c.baseLatency, outputLatency: c.outputLatency }; });

  // ---------- CT1: modo espera, todas corretas ----------
  await openSong(p, 1); await p.click('#btnPlayWait'); await sleep(3600);
  for (const n of song.notes) { await tap(p, n); await sleep(90); }
  res.T1_wait_correct = await completeText(p);
  res.lat_keyboard_1 = await p.evaluate(() => PianoHero.latency.getStats());
  await p.close();

  // ---------- CT2: modo espera, com 1 nota errada a cada 4 ----------
  p = await open(browser);
  await openSong(p, 1); await p.click('#btnPlayWait'); await sleep(3600);
  let wrong = 0;
  for (let i = 0; i < song.notes.length; i++) {
    const n = song.notes[i];
    if (i % 4 === 3) { const w = n === 72 ? 71 : n + 1; await tap(p, w); wrong++; await sleep(90); }
    await tap(p, n); await sleep(90);
  }
  res.T2_wrong_inserted = wrong;
  res.T2_wait_errors = await completeText(p);
  await p.close();

  // ---------- CT3: modo normal, no tempo ----------
  p = await open(browser);
  await openSong(p, 1);
  const spt = (60 / song.bpm) / 480;
  await p.click('#btnPlayNormal');
  const t0 = Date.now();
  let acc = 0; const onsets = song.durations.map(d => { const t = acc; acc += d; return t * spt; });
  for (let i = 0; i < song.notes.length; i++) {
    const target = t0 + (3 + onsets[i]) * 1000;
    const w = target - Date.now(); if (w > 0) await sleep(w);
    await tap(p, song.notes[i], 40);
  }
  res.T3_normal = await completeText(p);
  await p.close();

  // ---------- CT4: modo normal, sem tocar nada ----------
  p = await open(browser);
  await openSong(p, 1); await p.click('#btnPlayNormal');
  res.T4_normal_nothing = await completeText(p) || (await sleep(30000), await completeText(p));
  await p.close();

  // ---------- CT5: ajuste de velocidade ----------
  p = await open(browser);
  await openSong(p, 1);
  for (let i = 0; i < 20; i++) { await p.click('#setupBpmMinus'); await sleep(30); }
  res.T5_bpm_after_minus20 = await p.$eval('#setupBpmOut', e => e.innerText);
  await p.close();

  // ---------- CT6/CT7/CT8: latencia com teclado e mouse (modo livre) ----------
  p = await open(browser);
  await p.click('#btnFree'); await sleep(1500);
  await p.evaluate(() => PianoHero.latency.clear());
  const keys = Object.keys(KEY).map(Number);
  for (let i = 0; i < 200; i++) { await tap(p, keys[i % keys.length], 50); await sleep(120); }
  const box = await (await p.$('canvas')).boundingBox();
  const y = box.y + box.height - 25;
  for (let i = 0; i < 200; i++) {
    const x = box.x + box.width * (0.3 + 0.4 * ((i * 7) % 20) / 20);
    await p.mouse.move(x, y); await p.mouse.down(); await sleep(50); await p.mouse.up(); await sleep(120);
  }
  res.latency = await p.evaluate(() => PianoHero.latency.getStats());
  // exporta as amostras via CSV, interceptando o download
  const csv = await p.evaluate(() => new Promise(r => {
    const orig = URL.createObjectURL;
    URL.createObjectURL = b => { b.text().then(r); return orig(b); };
    PianoHero.latency.exportCSV();
  }));
  fs.writeFileSync(OUT + '/latencia-amostras.csv', csv);
  await p.close();

  await browser.close();
  fs.writeFileSync(OUT + '/resultados.json', JSON.stringify(res, null, 2));
  console.log(JSON.stringify(res, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
