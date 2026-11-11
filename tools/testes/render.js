// Desempenho de renderizacao: custo da funcao de desenho e intervalo entre quadros,
// com CPU normal e 4x mais lenta (emulacao do Chrome). Uso: node render.js
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
  const out = {};
  for (const thr of [1, 4]) {
    const p = await b.newPage(); await p.setViewport({ width: 1280, height: 860 });
    await p.goto('http://localhost:8765/', { waitUntil: 'networkidle0' }); await sleep(1200);
    const ids = await p.evaluate(() => PianoHero.songs.map(s => s.id));
    const bs = await p.$$('.map-bubble:not(.intro)'); await bs[ids.indexOf('bumblebee')].click(); await sleep(700);
    await p.click('#btnPlayDemo'); await sleep(4000);
    const cdp = await p.target().createCDPSession(); await cdp.send('Emulation.setCPUThrottlingRate', { rate: thr });
    out['x' + thr] = await p.evaluate(() => new Promise(r => {
      const d = [], f = []; const orig = PianoHero.render.draw;
      PianoHero.render.draw = function () { const t = performance.now(); const v = orig.apply(this, arguments); d.push(performance.now() - t); return v; };
      let last = performance.now(); const end = last + 20000;
      (function fr(t) { f.push(t - last); last = t; if (t < end) requestAnimationFrame(fr); else {
        const st = a => { a = a.slice().sort((x, y) => x - y); const m = a.reduce((x, y) => x + y, 0) / a.length; return { n: a.length, mean: +m.toFixed(2), p95: +a[Math.floor(a.length * .95)].toFixed(2), max: +a[a.length - 1].toFixed(2) }; };
        r({ draw: st(d), frame: st(f), fps: +(1000 / st(f).mean).toFixed(1), over33: f.filter(x => x > 33.4).length }); } })(last);
    }));
    await p.close();
  }
  await b.close(); console.log(JSON.stringify(out, null, 1));
})();
