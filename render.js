/* render.js — geometria do teclado, desenho das notas caindo e do feedback visual. */

window.PianoHero = window.PianoHero || {};

(function (PH) {
  'use strict';

  var canvas, ctx;
  var layout = null;
  var particles = [];
  var rings = [];
  var shake = 0;

  var NOTE_H = 30;

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    return layout;
  }

  /** Recalcula tamanho lógico (CSS px) + escala de retina e a geometria do piano. */
  function resize() {
    var cssW = Math.max(320, canvas.parentNode.clientWidth);
    // Tetos maiores que antes (era 600 / 0.66): o teclado tem 5 oitavas agora (ver
    // notes.js), então precisa de mais altura pra cada tecla branca não ficar espremida.
    var cssH = Math.round(Math.min(680, Math.max(420, cssW * 0.72)));
    // Celular em pé: a largura é pequena, então a fórmula acima trava no piso de 420px e
    // sobra metade da tela vazia embaixo. Usa a altura da janela, descontando HUD, barra
    // de progresso e rodapé (~330px), pra notas terem mais espaço pra cair e os menus
    // (que ficam dentro do palco) caberem sem rolar.
    // Deitado (paisagem, o jeito de jogar no celular): a tela é baixa (~360px), então o
    // palco ocupa quase tudo, descontando só a HUD em uma linha (~52px; no celular não há
    // barra de progresso, ver style.css).
    if (PH.notes.COMPACT) {
      cssH = window.innerWidth > window.innerHeight
        ? Math.round(Math.max(200, window.innerHeight - 52))
        : Math.round(Math.min(760, Math.max(cssH, window.innerHeight - 330)));
    }
    var dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.height = cssH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildLayout(cssW, cssH);
  }

  function buildLayout(W, H) {
    var whites = PH.notes.WHITE;
    var whiteW = W / whites.length;
    // Teto maior que antes (era 150): compensa as teclas brancas mais estreitas do
    // teclado de 5 oitavas com teclas mais altas, mais fáceis de mirar no toque/clique.
    var pianoH = Math.min(190, Math.round(H * 0.32));
    var pianoY = H - pianoH;
    var blackW = whiteW * 0.6;
    var blackH = pianoH * 0.6;

    var keys = [];   // ordem de desenho: brancas primeiro, pretas por cima
    var byMidi = {};

    whites.forEach(function (midi, i) {
      var k = {
        midi: midi, black: false,
        x: i * whiteW, y: pianoY, w: whiteW, h: pianoH,
        cx: i * whiteW + whiteW / 2
      };
      keys.push(k);
      byMidi[midi] = k;
    });

    PH.notes.BLACK.forEach(function (b) {
      var cx = (b.after + 1) * whiteW;
      var k = {
        midi: b.midi, black: true,
        x: cx - blackW / 2, y: pianoY, w: blackW, h: blackH,
        cx: cx
      };
      keys.push(k);
      byMidi[b.midi] = k;
    });

    layout = {
      W: W, H: H,
      whiteW: whiteW,
      pianoY: pianoY,
      pianoH: pianoH,
      hitLine: pianoY,
      noteH: NOTE_H,
      spacing: NOTE_H + 16,
      keys: keys,
      byMidi: byMidi
    };
  }

  function getLayout() { return layout; }

  /** Converte coordenada do ponteiro (CSS px) na tecla clicada, pretas têm prioridade. */
  function keyAt(x, y) {
    if (!layout || y < layout.pianoY) return null;
    var keys = layout.keys, i, k;
    for (i = keys.length - 1; i >= 0; i--) {
      k = keys[i];
      if (!k.black) continue;
      if (x >= k.x && x <= k.x + k.w && y <= k.y + k.h) return k.midi;
    }
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      if (k.black) continue;
      if (x >= k.x && x <= k.x + k.w) return k.midi;
    }
    return null;
  }

  function burst(midi, good) {
    var k = layout.byMidi[midi];
    if (!k) return;
    var color = good ? [61, 220, 151] : [255, 92, 110];
    var n = good ? 18 : 10;
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
      var sp = 120 + Math.random() * 260;
      particles.push({
        x: k.cx, y: layout.hitLine,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 1, color: color, size: 2 + Math.random() * 3
      });
    }
    if (!good) shake = 10;
  }

  /** Anel expandindo a partir de uma tecla — usado no acerto "perfeito". */
  function ring(midi, color) {
    var k = layout.byMidi[midi];
    if (!k) return;
    rings.push({ x: k.cx, y: layout.hitLine, r: 4, alpha: 1, color: color });
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 900 * dt;
      p.life -= dt * 1.7;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (var j = rings.length - 1; j >= 0; j--) {
      var r = rings[j];
      r.r += 260 * dt;
      r.alpha -= dt * 2.2;
      if (r.alpha <= 0) rings.splice(j, 1);
    }
    shake = Math.max(0, shake - dt * 45);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /**
   * state: { notes, flashes, hint, combo }
   *  - notes[i] = { midi, y }  (y = base da nota)
   *  - flashes[midi] = { t, good }
   */
  function draw(state, dt) {
    updateParticles(dt);

    var W = layout.W, H = layout.H;
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    drawBackground();
    drawLanes();
    drawResolvedBars(state);
    drawNotes(state);
    drawHitLine(state);
    drawPiano(state);
    drawParticles();
    drawRings();

    ctx.restore();

    function drawBackground() {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0a0c16');
      g.addColorStop(1, '#131832');
      ctx.fillStyle = g;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }

    function drawLanes() {
      ctx.strokeStyle = 'rgba(255,255,255,.05)';
      ctx.lineWidth = 1;
      for (var i = 1; i < PH.notes.WHITE.length; i++) {
        var x = Math.round(i * layout.whiteW) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, layout.pianoY);
        ctx.stroke();
      }
    }

    /**
     * Barras já tocadas continuam visíveis até o fim da duração escrita da nota —
     * o efeito de acerto acontece na própria nota caindo, não só na tecla do piano.
     * É o mesmo visual de "segurando", só que sem o brilho pulsante de alvo.
     */
    function drawResolvedBars(st) {
      for (var i = 0; i < st.resolvedBars.length; i++) {
        var rb = st.resolvedBars[i];
        var k = layout.byMidi[rb.midi];
        if (!k) continue;

        var h = rb.len || layout.noteH;
        var w = k.black ? k.w * 1.05 : layout.whiteW * 0.74;
        var x = k.cx - w / 2;
        var y = rb.y - h;
        var alpha = rb.t === undefined ? 1 : Math.max(0, rb.t);

        ctx.globalAlpha = alpha;
        var g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, '#7cffc4');
        g.addColorStop(1, '#2fbf83');
        ctx.fillStyle = g;
        ctx.shadowColor = 'rgba(61,220,151,.85)';
        ctx.shadowBlur = 12;
        roundRect(x, y, w, h, 8);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
    }

    function drawNotes(st) {
      for (var i = st.notes.length - 1; i >= 0; i--) {
        var n = st.notes[i];
        var k = layout.byMidi[n.midi];
        if (!k) continue;

        // Modo livre: só a nota da frente (índice 0) é o alvo. Modo fase: todas as notas
        // do acorde pendente (mesmo índice de timeline que `st.cursor`) são alvo ao mesmo
        // tempo — um acorde pode exigir mais de uma tecla pressionada agora.
        var isTarget = st.mode === 'song' ? n.chordIndex === st.cursor : i === 0;
        var w = k.black ? k.w * 1.05 : layout.whiteW * 0.74;
        var x = k.cx - w / 2;
        var h = n.len || layout.noteH;
        var y = n.y - h;

        var base = k.black ? ['#b98cff', '#7d4fe0'] : ['#8fb4ff', '#4a6fe0'];
        var g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, base[0]);
        g.addColorStop(1, base[1]);

        if (isTarget) {
          ctx.shadowColor = k.black ? 'rgba(185,140,255,.9)' : 'rgba(143,180,255,.9)';
          ctx.shadowBlur = 18 + Math.sin(Date.now() / 160) * 6;
        }

        ctx.fillStyle = g;
        roundRect(x, y, w, h, 8);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = isTarget ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.18)';
        ctx.lineWidth = isTarget ? 2 : 1;
        roundRect(x, y, w, h, 8);
        ctx.stroke();

        ctx.fillStyle = isTarget ? '#0b0d17' : 'rgba(11,13,23,.7)';
        ctx.font = (isTarget ? 'bold ' : '') + '13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(PH.notes.noteName(n.midi), k.cx, y + h / 2 + 1);
      }
    }

    function drawHitLine(st) {
      var y = layout.hitLine;
      var pulse = st.notes.length ? (0.35 + 0.25 * Math.sin(Date.now() / 300)) : 0.25;
      ctx.fillStyle = 'rgba(122,162,255,' + pulse + ')';
      ctx.fillRect(0, y - 3, W, 3);
      ctx.fillStyle = 'rgba(122,162,255,.12)';
      ctx.fillRect(0, y - 26, W, 23);
    }

    function drawPiano(st) {
      var keys = layout.keys, i, k, f;

      for (i = 0; i < keys.length; i++) {
        k = keys[i];
        if (k.black) continue;
        f = pickFlash(k.midi);

        ctx.fillStyle = flashColor(f, '#ffffff', '#f2f4fb');
        roundRect(k.x + 1, k.y, k.w - 2, k.h, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.35)';
        ctx.lineWidth = 1;
        ctx.stroke();

        if (st.hint && st.targetMidis && st.targetMidis.indexOf(k.midi) !== -1) hintRing(k);
        label(k, '#6a7290', k.y + k.h - 14);
      }

      for (i = 0; i < keys.length; i++) {
        k = keys[i];
        if (!k.black) continue;
        f = pickFlash(k.midi);

        ctx.fillStyle = flashColor(f, '#2a3050', '#11131f');
        roundRect(k.x, k.y, k.w, k.h, 5);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.6)';
        ctx.stroke();

        if (st.hint && st.targetMidis && st.targetMidis.indexOf(k.midi) !== -1) hintRing(k);
        label(k, 'rgba(255,255,255,.55)', k.y + k.h - 10);
      }

      // Enquanto a tecla está fisicamente segurada, mostra cor sólida (como o piano
      // "soando"); depois de soltar, cai pro eco decrescente em st.flashes.
      function pickFlash(midi) {
        var held = st.held && st.held[midi];
        if (held) return { good: held.good, solid: true };
        return st.flashes[midi];
      }

      function flashColor(flash, hi, lo) {
        if (!flash) return lo;
        var c = flash.good ? [61, 220, 151] : [255, 92, 110];
        if (flash.solid) {
          return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
        }
        var a = Math.max(0, flash.t);
        var g = ctx.createLinearGradient(0, layout.pianoY, 0, layout.H);
        g.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')');
        g.addColorStop(1, a > 0.5 ? hi : lo);
        return g;
      }

      function hintRing(key) {
        ctx.save();
        ctx.strokeStyle = 'rgba(122,162,255,.95)';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 5]);
        ctx.lineDashOffset = -(Date.now() / 60) % 11;
        roundRect(key.x + 2, key.y + 2, key.w - 4, key.h - 4, 6);
        ctx.stroke();
        ctx.restore();
      }

      function label(key, color, y) {
        // No celular (teclado compacto) não há teclado de PC — a letra da tecla não diz nada,
        // então as brancas mostram o nome da nota (as pretas são estreitas demais pra texto).
        var txt = PH.notes.COMPACT
          ? (key.black ? '' : PH.notes.noteName(key.midi))
          : (PH.input && PH.input.labelFor ? PH.input.labelFor(key.midi) : '');
        if (!txt) return;
        ctx.fillStyle = color;
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(txt, key.cx, y);
      }
    }

    function drawParticles() {
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = 'rgb(' + p.color[0] + ',' + p.color[1] + ',' + p.color[2] + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawRings() {
      for (var i = 0; i < rings.length; i++) {
        var r = rings[i];
        ctx.globalAlpha = Math.max(0, r.alpha);
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  PH.render = {
    init: init,
    getLayout: getLayout,
    keyAt: keyAt,
    burst: burst,
    ring: ring,
    draw: draw
  };
})(window.PianoHero);
