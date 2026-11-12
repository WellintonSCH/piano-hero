// CT18: fim da demonstração volta à tela da música; fim do modo espera oferece "Agora no ritmo" e "Voltar à música".
// Uso: node fim-musica.js [pasta-das-capturas]
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = process.argv[2] || '.';
const MIDI_MOCK = () => { const port = { name: 'Piano virtual', onmidimessage: null };
  navigator.requestMIDIAccess = () => Promise.resolve({ inputs: new Map([['p1', port]]), outputs: new Map(), onstatechange: null });
  window.__midi = b => { if (port.onmidimessage) port.onmidimessage({ data: new Uint8Array(b), timeStamp: performance.now() }); }; };
const tap = async (p, n) => { await p.evaluate(n => window.__midi([0x90, n, 90]), n); await sleep(60); await p.evaluate(n => window.__midi([0x80, n, 0]), n); await sleep(100); };
const vis = (p, id) => p.evaluate(id => { const e = document.getElementById(id); return !!e && !e.hidden && e.offsetParent !== null; }, id);
const screenOn = (p, s) => p.evaluate(s => !document.getElementById('screen-' + s).hidden && !document.getElementById('overlay').hidden, s);
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 300000, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const out = {};
  for (const dev of [null, 'Pixel 5 landscape']) {
    const tag = dev ? 'cel' : 'pc';
    const p = await b.newPage();
    p.on('pageerror', e => (out[tag + '_err'] = (out[tag + '_err'] || []).concat(String(e))));
    if (dev) await p.emulate(puppeteer.KnownDevices[dev]); else await p.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 });
    await p.evaluateOnNewDocument(() => { if (!sessionStorage.__c) { localStorage.clear(); sessionStorage.__c = 1; } });
    await p.evaluateOnNewDocument(MIDI_MOCK);
    await p.goto('http://localhost:8765/?debug', { waitUntil: 'networkidle0' }); await sleep(1000);
    await p.click('.map-bubble:not(.intro)'); await sleep(800);
    // andamento máximo para a demonstração acabar logo
    await p.evaluate(() => { const r = document.getElementById('setupBpm'); r.value = r.max; r.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.click('#btnPlayDemo');
    const t0 = Date.now();
    while (Date.now() - t0 < 120000 && !(await screenOn(p, 'song'))) await sleep(250);
    out[tag + '_demo_volta_s'] = Math.round((Date.now() - t0) / 100) / 10;
    out[tag + '_aviso'] = await p.evaluate(() => { const n = document.getElementById('setupNotice'); return n.hidden ? null : n.textContent; });
    out[tag + '_sugerido'] = await p.evaluate(() => [...document.querySelectorAll('.setup-mode.suggested')].map(e => e.id));
    await p.screenshot({ path: `${OUT}/${tag}-1-fim-demo.png` });
    // Modo espera até o fim
    await p.click('#btnPlayWait');
    let g = 0;
    while (g++ < 400 && !(await screenOn(p, 'complete'))) {
      const t = await p.evaluate(() => { const s = PianoHero.debugState; const n = s.notes && s.notes.find(x => !x.hit && !x.auto && !x.done); return n ? n.midi : null; });
      if (t == null) { await sleep(200); continue; }
      await tap(p, t);
    }
    await sleep(1500);
    out[tag + '_fim_botoes'] = await p.evaluate(() => [...document.querySelectorAll('#screen-complete .menu-buttons button')].filter(b => !b.hidden).map(b => b.textContent + (b.classList.contains('primary') ? ' [primário]' : '')));
    await p.screenshot({ path: `${OUT}/${tag}-2-fim-espera.png` });
    await p.click('#btnBackToSong'); await sleep(600);
    out[tag + '_voltar'] = { song: await screenOn(p, 'song'), aviso: await vis(p, 'setupNotice') };
    // Agora no ritmo
    await p.click('#btnPlayWait'); g = 0;
    while (g++ < 400 && !(await screenOn(p, 'complete'))) {
      const t = await p.evaluate(() => { const s = PianoHero.debugState; const n = s.notes && s.notes.find(x => !x.hit && !x.auto && !x.done); return n ? n.midi : null; });
      if (t == null) { await sleep(200); continue; } await tap(p, t);
    }
    await sleep(1500);
    await p.click('#btnTryNormal'); await sleep(800);
    out[tag + '_ritmo'] = await p.evaluate(() => ({ wait: PianoHero.debugState.waitMode, demo: PianoHero.debugState.demoMode, running: PianoHero.debugState.running, overlay: !document.getElementById('overlay').hidden }));
    await p.screenshot({ path: `${OUT}/${tag}-3-ritmo.png` });
    await p.close();
  }
  await b.close(); console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
