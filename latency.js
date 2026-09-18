/* latency.js — instrumentação de latência: mede o tempo entre o evento de entrada
 * (MIDI/teclado/ponteiro) e o instante estimado em que o som passa a ser audível,
 * quebrado em 4 etapas: entrada→dispatch, dispatch→handler, handler→agendamento
 * de áudio, agendamento→saída de fato.
 *
 * Por que estimar o instante "audível" em vez de só o instante em que o JS chama
 * AudioBufferSourceNode.start(): o relógio do Web Audio (AudioContext.currentTime)
 * roda numa linha do tempo separada de performance.now(), e a saída de áudio ainda
 * tem uma latência de hardware/driver depois do agendamento. getOutputTimestamp()
 * devolve um par sincronizado {contextTime, performanceTime} que permite projetar
 * o instante agendado (em contextTime) de volta pra linha do tempo de performance.now(),
 * e ctx.outputLatency soma a latência de saída estimada pelo navegador. Sem isso, a
 * métrica mediria só "tempo de JS até agendar", ignorando o hardware — que é
 * justamente uma das variáveis que a pesquisa quer comparar entre fontes de entrada.
 */

window.PianoHero = window.PianoHero || {};

(function (PH) {
  'use strict';

  var MAX_SAMPLES = 3000;
  var samples = [];

  /**
   * meta: { source, midi, t0, tDispatch, tHandle } — t0/tDispatch/tHandle em
   *   performance.now() (ou DOMHighResTimeStamp equivalente do evento original).
   * audioInfo: { ctx, scheduledCtxTime, sampleLoaded }
   */
  function record(meta, audioInfo) {
    if (!meta || meta.t0 == null) return;

    var tScheduleCall = performance.now();
    var estimatedOutputPerf = null;
    var ctx = audioInfo.ctx;

    if (ctx && ctx.getOutputTimestamp) {
      try {
        var out = ctx.getOutputTimestamp();
        if (out && out.performanceTime != null && out.contextTime != null) {
          var driftSec = audioInfo.scheduledCtxTime - out.contextTime;
          estimatedOutputPerf = out.performanceTime + driftSec * 1000;
          var hw = ctx.outputLatency != null ? ctx.outputLatency : (ctx.baseLatency || 0);
          estimatedOutputPerf += hw * 1000;
        }
      } catch (e) { /* getOutputTimestamp indisponível em alguns navegadores */ }
    }

    // Sem getOutputTimestamp (ex.: navegador antigo), cai pra medir só até o
    // agendamento — pior caso é subestimar a latência real, nunca superestimar.
    var endPerf = estimatedOutputPerf != null ? estimatedOutputPerf : tScheduleCall;

    samples.push({
      ts: Date.now(),
      source: meta.source,
      midi: meta.midi,
      sampleLoaded: !!audioInfo.sampleLoaded,
      estimated: estimatedOutputPerf != null,
      inputToDispatchMs: round(meta.tDispatch - meta.t0),
      dispatchToHandleMs: round(meta.tHandle - meta.tDispatch),
      handleToScheduleMs: round(tScheduleCall - meta.tHandle),
      scheduleToOutputMs: round(endPerf - tScheduleCall),
      totalMs: round(endPerf - meta.t0)
    });

    if (samples.length > MAX_SAMPLES) samples.shift();
  }

  function round(n) { return Math.round(n * 100) / 100; }

  function percentile(arr, p) {
    if (!arr.length) return null;
    var sorted = arr.slice().sort(function (a, b) { return a - b; });
    var idx = Math.min(sorted.length - 1, Math.floor(p / 100 * sorted.length));
    return sorted[idx];
  }

  function statsFor(list) {
    var totals = list.map(function (s) { return s.totalMs; });
    if (!totals.length) return { count: 0 };
    var sum = totals.reduce(function (a, b) { return a + b; }, 0);
    return {
      count: totals.length,
      meanMs: round(sum / totals.length),
      medianMs: percentile(totals, 50),
      p95Ms: percentile(totals, 95),
      minMs: round(Math.min.apply(null, totals)),
      maxMs: round(Math.max.apply(null, totals))
    };
  }

  function getStats() {
    var bySource = {};
    ['midi', 'keyboard', 'pointer'].forEach(function (src) {
      bySource[src] = statsFor(samples.filter(function (s) { return s.source === src; }));
    });
    return { overall: statsFor(samples), bySource: bySource, total: samples.length };
  }

  function clear() { samples.length = 0; }

  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportJSON() {
    download('piano-hero-latencia-' + Date.now() + '.json', JSON.stringify(samples, null, 2), 'application/json');
  }

  function exportCSV() {
    var header = 'ts,source,midi,sampleLoaded,estimated,inputToDispatchMs,dispatchToHandleMs,handleToScheduleMs,scheduleToOutputMs,totalMs';
    var rows = samples.map(function (s) {
      return [s.ts, s.source, s.midi, s.sampleLoaded, s.estimated,
        s.inputToDispatchMs, s.dispatchToHandleMs, s.handleToScheduleMs, s.scheduleToOutputMs, s.totalMs].join(',');
    });
    download('piano-hero-latencia-' + Date.now() + '.csv', [header].concat(rows).join('\n'), 'text/csv');
  }

  PH.latency = {
    record: record,
    getStats: getStats,
    clear: clear,
    exportJSON: exportJSON,
    exportCSV: exportCSV
  };
})(window.PianoHero);
