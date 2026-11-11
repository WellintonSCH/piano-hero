// Testes da janela de acerto agendados pelo relogio do proprio jogo (?debug expoe o estado).
// Cada toque e entregue pelo piano MIDI virtual quando songTime >= tempo da nota + deslocamento.
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MIDI_MOCK = () => { const port = { name: 'Piano virtual', onmidimessage: null };
  navigator.requestMIDIAccess = () => Promise.resolve({ inputs: new Map([['p1', port]]), outputs: new Map(), onstatechange: null });
  window.__midi = b => { if (port.onmidimessage) port.onmidimessage({ data: new Uint8Array(b), timeStamp: performance.now() }); }; };
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const out = {};
  for (const off of (process.argv[2] || '0,-60,60,-150,150,240,-240,300,450').split(',').map(Number)) {
    const p = await b.newPage(); await p.setViewport({ width: 1280, height: 860 });
    await p.evaluateOnNewDocument(MIDI_MOCK);
    await p.goto('http://localhost:8765/?debug&pesquisa=JANELA', { waitUntil: 'networkidle0' }); await sleep(1000);
    const ids = await p.evaluate(() => PianoHero.songs.map(s => s.id)); const bs = await p.$$('.map-bubble:not(.intro)'); await bs[ids.indexOf('twinkle')].click(); await sleep(600);
    await p.click('#btnPlayNormal');
    await p.evaluate(off => new Promise(done => {
      const st = PianoHero.debugState; const tl = st.timeline.map(x => ({ t: x.time + off / 1000, m: x.midis.slice() })); let i = 0;
      (function tick() {
        while (i < tl.length && st.songTime >= tl[i].t) { const m = tl[i].m; m.forEach(n => window.__midi([0x90, n, 90])); setTimeout(() => m.forEach(n => window.__midi([0x80, n, 0])), 40); i++; }
        // termina quando todos os toques sairam OU quando a musica acabou (toques atrasados alem da ultima nota nao chegam a sair)
        const acabou = !document.getElementById('screen-complete').hidden;
        if (i < tl.length && !acabou) requestAnimationFrame(tick); else setTimeout(done, 1500);
      })();
    }), off);
    await sleep(2500);
    out[off + ' ms'] = await p.evaluate(() => { const a = PianoHero.research.getLog().filter(x => x.status === 'concluida').pop();
      return a && { precisao: a.precisao, perfeitas: a.perfeitas, boas: a.boas, erradas: a.erradas, perdidas: a.perdidas, atrasadas: a.atrasadas, desvio_medio_ms: a.desvio_medio_ms }; });
    await p.close();
  }
  await b.close(); console.log(JSON.stringify(out, null, 1));
})();
