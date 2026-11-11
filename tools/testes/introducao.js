// CT18: introdução guiada "Primeiros passos" no computador e no celular emulado.
// Uso: node introducao.js [pasta-das-capturas]
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = process.argv[2] || '.';
const MIDI_MOCK = () => { const port = { name: 'Piano virtual', onmidimessage: null };
  navigator.requestMIDIAccess = () => Promise.resolve({ inputs: new Map([['p1', port]]), outputs: new Map(), onstatechange: null });
  window.__midi = b => { if (port.onmidimessage) port.onmidimessage({ data: new Uint8Array(b), timeStamp: performance.now() }); }; };
const tap = async (p, n) => { await p.evaluate(n => window.__midi([0x90, n, 90]), n); await sleep(60); await p.evaluate(n => window.__midi([0x80, n, 0]), n); await sleep(120); };
const target = p => p.evaluate(() => { const s = PianoHero.debugState; return s.notes.length ? s.notes[0].midi : null; });
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 300000, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const out = {};
  for (const dev of [null, 'Pixel 5 landscape']) {
    const tag = dev ? 'cel' : 'pc';
    const p = await b.newPage();
    if (dev) await p.emulate(puppeteer.KnownDevices[dev]); else await p.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 });
    await p.evaluateOnNewDocument(() => { if (!sessionStorage.__c) { localStorage.clear(); sessionStorage.__c = 1; } });
    await p.evaluateOnNewDocument(MIDI_MOCK);
    await p.goto('http://localhost:8765/?debug&pesquisa=INTRO' + tag, { waitUntil: 'networkidle0' }); await sleep(1200);
    await p.screenshot({ path: `${OUT}/${tag}-1-mapa.png` });
    await p.click('.map-bubble.intro'); await sleep(1500);
    await p.screenshot({ path: `${OUT}/${tag}-2-passo1.png` });
    // passo 1: um erro (Ré) e depois os Dós, em oitavas diferentes
    await tap(p, 62); await sleep(300);
    await p.screenshot({ path: `${OUT}/${tag}-3-erro.png` });
    for (const n of [48, 60, 72]) { await tap(p, dev ? 60 : n); }
    await sleep(500); await p.screenshot({ path: `${OUT}/${tag}-4-muitobem.png` });
    await sleep(1200);
    let guard = 0, step3shot = false;
    while (guard++ < 80) {
      const scr = await p.evaluate(() => !document.getElementById('screen-intro').hidden);
      if (scr) break;
      const t = await target(p);
      if (t == null) { await sleep(300); continue; }
      const st = await p.evaluate(() => document.getElementById('lessonTitle').textContent);
      if (st === 'Desafio' && !out[tag + '_hint_test']) {
        // dois erros seguidos na mesma nota: a dica tem que acender
        const before = await p.evaluate(() => PianoHero.debugState.hint);
        await tap(p, t === 60 ? 62 : 60); await tap(p, t === 60 ? 62 : 60);
        const after = await p.evaluate(() => PianoHero.debugState.hint);
        out[tag + '_hint_test'] = { before, after };
        await p.screenshot({ path: `${OUT}/${tag}-6-desafio-dica.png` });
      }
      if (st === 'Fá e Sol' && !step3shot) { step3shot = true; await p.screenshot({ path: `${OUT}/${tag}-5-fasol.png` }); }
      await tap(p, t);
    }
    await sleep(800);
    await p.screenshot({ path: `${OUT}/${tag}-7-fim.png` });
    out[tag + '_fim'] = await p.evaluate(() => document.getElementById('screen-intro').innerText);
    out[tag + '_log'] = await p.evaluate(() => PianoHero.research.getLog().map(a => [a.modo, a.status, a.precisao, a.boas, a.erradas, a.duracao_s, a.tempos_passos_s]));
    await p.click('#btnIntroToLevels'); await sleep(800);
    out[tag + '_mapa_depois'] = await p.evaluate(() => ({ introDone: document.querySelector('.map-bubble.intro').className, current: document.querySelector('.map-bubble.current')?.getAttribute('aria-label') }));
    await p.screenshot({ path: `${OUT}/${tag}-8-mapa-depois.png` });
    await p.close();
  }
  await b.close(); console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
