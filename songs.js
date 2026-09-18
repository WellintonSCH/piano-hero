/* songs.js — fases do jogo: melodias tradicionais/domínio público, dispostas em dificuldade
   crescente.
 *
 * Ritmo baseado em "ticks" (resolução PPQ, igual arquivos MIDI/DAWs): cada duração é um
 * número inteiro de pulsos por semínima, não uma fração decimal. Isso evita erro de
 * arredondamento acumulado ao longo de dezenas de notas — a mesma técnica que partituras
 * digitais e sequenciadores usam pra manter o tempo preciso.
 *
 * `bpm` = semínimas por minuto (BPM tradicional). `timeSignature` é só documentação/uso
 * visual (grade de tempo), não restringe o motor. Arranjos simplificados pra ficarem
 * divertidos de jogar — não são transcrições musicológicas de partitura original.
 *
 * Cada música é escrita como uma "volta" (a melodia inteira, uma vez) e depois repetida
 * `repeat()` vezes — a mesma técnica de cantar mais uma estrofe/repetir o refrão, sem
 * inventar compassos novos. Isso deixa as fases mais longas de forma musicalmente segura
 * (a melodia repetida já está certa) e deixa o comprimento fácil de ajustar depois: basta
 * mudar o número de repetições de cada música.
 */

window.PianoHero = window.PianoHero || {};

(function (PH) {
  'use strict';

  var C3 = 48, D3 = 50, FS3 = 54, G3 = 55, A3 = 57, B3 = 59;
  var C4 = 60, D4 = 62, DS4 = 63, E4 = 64, F4 = 65, G4 = 67, A4 = 69, B4 = 71;
  var C5 = 72;

  // Resolução: pulsos por semínima. 480 é o padrão de fato usado por MIDI/DAWs — alto o
  // bastante pra representar semicolcheias, pontuados e tercinas como inteiros exatos.
  var PPQ = 480;

  var WHOLE = PPQ * 4;             // semibreve
  var DOTTED_HALF = PPQ * 3;       // mínima pontuada
  var HALF = PPQ * 2;              // mínima
  var QUARTER = PPQ;               // semínima
  var EIGHTH = PPQ / 2;            // colcheia
  var SIXTEENTH = PPQ / 4;         // semicolcheia

  /** Repete uma melodia (notas + durações) `times` vezes, concatenando os arrays. */
  function repeat(notes, durations, times) {
    var outNotes = [], outDurations = [];
    for (var i = 0; i < times; i++) {
      outNotes = outNotes.concat(notes);
      outDurations = outDurations.concat(durations);
    }
    return { notes: outNotes, durations: outDurations };
  }

  var hotcross = repeat(
    [
      E4, D4, C4,
      E4, D4, C4,
      C4, C4, C4, C4, D4, D4, D4, D4,
      E4, D4, C4
    ],
    [
      QUARTER, QUARTER, HALF,
      QUARTER, QUARTER, HALF,
      EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH,
      QUARTER, QUARTER, HALF
    ],
    2
  );

  var twinkle = repeat(
    [
      C4, C4, G4, G4, A4, A4, G4,
      F4, F4, E4, E4, D4, D4, C4,
      G4, G4, F4, F4, E4, E4, D4,
      G4, G4, F4, F4, E4, E4, D4,
      C4, C4, G4, G4, A4, A4, G4,
      F4, F4, E4, E4, D4, D4, C4
    ],
    [
      QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, HALF,
      QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, HALF,
      QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, HALF,
      QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, HALF,
      QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, HALF,
      QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, HALF
    ],
    2
  );

  var mary = repeat(
    [
      E4, D4, C4, D4, E4, E4, E4,
      D4, D4, D4,
      E4, G4, G4,
      E4, D4, C4, D4, E4, E4, E4, E4,
      D4, D4, E4, D4, C4
    ],
    [
      QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, HALF,
      QUARTER, QUARTER, HALF,
      QUARTER, QUARTER, HALF,
      QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER,
      QUARTER, QUARTER, QUARTER, QUARTER, WHOLE
    ],
    2
  );

  var londonbridge = repeat(
    [
      G4, A4, G4, F4, E4, F4, G4,
      D4, E4, F4,
      G4, A4, G4, F4, E4, F4, G4,
      D4, G4, E4, C4
    ],
    [
      QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, HALF,
      QUARTER, QUARTER, HALF,
      QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, HALF,
      QUARTER, QUARTER, HALF, WHOLE
    ],
    2
  );

  var frere = repeat(
    [
      C4, D4, E4, C4, C4, D4, E4, C4,
      E4, F4, G4, E4, F4, G4,
      G4, A4, G4, F4, E4, C4, G4, A4, G4, F4, E4, C4,
      C4, G3, C3, C4, G3, C3
    ],
    [
      QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER,
      QUARTER, QUARTER, HALF, QUARTER, QUARTER, HALF,
      EIGHTH, EIGHTH, EIGHTH, EIGHTH, QUARTER, QUARTER, EIGHTH, EIGHTH, EIGHTH, EIGHTH, QUARTER, QUARTER,
      QUARTER, QUARTER, HALF, QUARTER, QUARTER, HALF
    ],
    2
  );

  var row = repeat(
    [
      C4, C4, C4, D4, E4,
      E4, D4, E4, F4, G4,
      C5, C5, C5, G4, G4, G4, E4, E4, E4, C4, C4, C4,
      G4, F4, E4, D4, C4
    ],
    [
      QUARTER, QUARTER, QUARTER, QUARTER, HALF,
      QUARTER, QUARTER, QUARTER, QUARTER, HALF,
      QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER,
      QUARTER, QUARTER, QUARTER, QUARTER, WHOLE
    ],
    2
  );

  // Baixo-ostinato de 2 compassos (8 semínimas) do Cânone — na peça real ele se repete
  // dezenas de vezes sob variações melódicas cada vez mais elaboradas; repetir mais vezes
  // aqui é fiel a essa estrutura, só sem as variações de cima.
  var canon = repeat(
    [D4, A3, B3, FS3, G3, D3, G3, A3],
    [QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER],
    8
  );

  var birthday = repeat(
    [
      C4, C4, D4, C4, F4, E4,
      C4, C4, D4, C4, G4, F4,
      C4, C4, C5, A4, F4, E4, D4,
      C5, C5, B4, G4, A4, G4
    ],
    [
      EIGHTH, EIGHTH, QUARTER, QUARTER, QUARTER, HALF,
      EIGHTH, EIGHTH, QUARTER, QUARTER, QUARTER, HALF,
      EIGHTH, EIGHTH, QUARTER, QUARTER, QUARTER, QUARTER, HALF,
      EIGHTH, EIGHTH, QUARTER, QUARTER, QUARTER, HALF
    ],
    2
  );

  var ode = repeat(
    [
      E4, E4, F4, G4, G4, F4, E4, D4, C4, C4, D4, E4, E4, D4, D4,
      E4, E4, F4, G4, G4, F4, E4, D4, C4, C4, D4, E4, D4, C4, C4
    ],
    [
      QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, HALF,
      QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, HALF
    ],
    2
  );

  var jingle = repeat(
    [
      E4, E4, E4, E4, E4, E4, E4, G4, C4, D4, E4,
      F4, F4, F4, F4, F4, E4, E4, E4, E4, D4, D4, E4, D4, G4
    ],
    [
      QUARTER, QUARTER, HALF, QUARTER, QUARTER, HALF, EIGHTH, EIGHTH, EIGHTH, EIGHTH, HALF,
      QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, EIGHTH, EIGHTH, EIGHTH, EIGHTH, QUARTER, DOTTED_HALF
    ],
    2
  );

  // Tema inicial (frase de 9 notas) repetido 4x — no original ele já volta a esse mesmo
  // tema várias vezes entre as seções centrais; repetir mais é fiel a esse efeito de retorno.
  var furelise = repeat(
    [E4, DS4, E4, DS4, E4, B3, D4, C4, A3],
    [SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, EIGHTH],
    4
  );

  // --- Cânone em Ré (completo) ---------------------------------------------
  // Notas extras (fora da faixa das outras músicas) usadas nesta importação de
  // MusicXML -- 2ª e 6ª oitavas, graves e agudos de verdade.
  var D2 = 38, FS2 = 42, G2 = 43, A2 = 45, B2 = 47;
  var CS3 = 49, E3 = 52;
  var CS4 = 61, FS4 = 66;
  var CS5 = 73, D5 = 74, E5 = 76, FS5 = 78, G5 = 79, A5 = 81, B5 = 83;
  var CS6 = 85, D6 = 86;
  var DOTTED_QUARTER = PPQ * 1.5;

  /*
   * Cânone em Ré (completo): melodia + baixo juntos, com acordes onde as duas
   * vozes coincidem no tempo — diferente da fase `canon` acima (só o baixo, em
   * loop manual). Convertido automaticamente do MusicXML de domínio público em
   * XML/scores/Canon_in_D_easy.mxl (voz 1 = melodia, voz 5 = baixo), não escrito
   * nota a nota à mão como as outras fases — por isso não usa `repeat()`, é a
   * peça inteira de uma vez. Serve de fase de teste pro alcance estendido do
   * teclado (Ré2–Ré6) e pro input de acordes (duas+ teclas ao mesmo tempo).
   */
  var canonfull = {
    notes: [
      D3, FS3, A3, D4, A2, CS3, E3, A3,
      B2, D3, FS3, B3, FS2, A2, CS3, FS3,
      G2, B2, D3, G3, D2, FS2, A2, D3,
      G2, B2, D3, G3, A2, CS3, E3, A3,
      [D3, FS5], FS3, A3, D4, [A2, E5], CS3, E3, A3,
      [B2, D5], D3, FS3, B3, [FS2, CS5], A2, CS3, FS3,
      [G2, B4], B2, D3, G3, [D2, A4], FS2, A2, D3,
      [G2, B4], B2, D3, G3, [A2, CS5], CS3, E3, A3,
      [D3, D5, FS5], FS3, A3, D4, [A2, CS5, E5], CS3, E3, A3,
      [B2, B4, D5], D3, FS3, B3, [FS2, A4, CS5], A2, CS3, FS3,
      [G2, G4, B4], B2, D3, G3, [D2, FS4, A4], FS2, A2, D3,
      [G2, G4, B4], B2, D3, G3, [A2, A4, CS5], CS3, E3, A3,
      [D3, D4], FS4, [A2, A4], G4, [B2, FS4], D4, [FS2, FS4], E4,
      [G2, D4], B3, [D2, D4], A4, [G2, G4], B4, [A2, A4], G4,
      [D3, FS4], D4, [A2, E4], CS5, [B2, D5], FS5, [FS2, A5], A4,
      [G2, B4], G4, [D2, A4], FS4, [G2, D4], D5, [A2, CS5], [D3, D5],
      CS5, D5, D4, [A2, CS4], A4, E4, FS4, [B2, D4],
      D5, CS5, B4, [FS2, CS5], FS5, A5, B5, [G2, G5],
      FS5, E5, G5, [D2, FS5], E5, D5, CS5, [G2, B4],
      A4, G4, FS4, [A2, E4], G4, FS4, E4, [D3, D4],
      E4, FS4, G4, [A2, A4], E4, A4, G4, [B2, FS4],
      B4, A4, G4, [FS2, A4], G4, FS4, E4, [G2, D4],
      B3, B4, CS5, [D2, D5], CS5, B4, A4, [G2, G4],
      FS4, E4, B4, [A2, A4], B4, A4, G4, [D3, FS4],
      FS5, [A2, E5], B2, D5, [FS2, FS5], [G2, B5], [D2, A5], [G2, B5],
      [A2, CS6], [D3, D6], D5, [A2, CS5], B2, B4, [FS2, D5], [G2, D5],
      D2, D5, [G2, D5], FS5, [A2, E5], A5, [D3, A5], FS5,
      G5, A5, FS5, G5, [A2, A5], A4, B4, CS5,
      D5, E5, FS5, G5, [B2, FS5], D5, E5, FS5,
      FS4, G4, [FS2, A4], B4, A4, G4, A4, FS4,
      G4, A4, [G2, G4], B4, A4, G4, FS4, E4,
      [D2, FS4], E4, D4, E4, FS4, G4, A4, B4,
      [G2, G4], B4, A4, B4, CS5, D5, [A2, A4], B4,
      CS5, D5, E5, FS5, G5, A5, [D3, FS5], D5,
      E5, FS5, E5, D5, [A2, E5], CS5, D5, E5,
      FS5, E5, D5, CS5, [B2, D5], B4, CS5, D5,
      D4, E4, [FS2, FS4], G4, FS4, E4, FS4, D5,
      CS5, D5, [G2, B4], D5, CS5, B4, A4, G4,
      [D2, A4], G4, FS4, G4, A4, B4, CS5, D5,
      [G2, B4], D5, CS5, D5, CS5, B4, [A2, CS5], D5,
      E5, D5, CS5, D5, B4, CS5, [D3, D5], A5,
      [A2, A5], B5, A5, G5, [B2, FS5], FS5, [FS2, FS5], G5,
      FS5, E5, [G2, D5], D5, [D2, D5], A4, [G2, D5], C5,
      B4, C5, [A2, CS5], [D3, D5]
    ],
    durations: [
      EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH,
      EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH,
      EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH,
      EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH,
      EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH,
      EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH,
      EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH,
      EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH,
      EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH,
      EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH,
      EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH,
      EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH,
      QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER,
      QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER,
      QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER,
      QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, HALF, EIGHTH,
      EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH,
      EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH,
      EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH,
      EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH,
      EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH,
      EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH,
      EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH,
      EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, EIGHTH, QUARTER,
      QUARTER, HALF, QUARTER, QUARTER, HALF, HALF, HALF, HALF,
      HALF, QUARTER, QUARTER, HALF, QUARTER, QUARTER, HALF, HALF,
      QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, QUARTER, EIGHTH, SIXTEENTH,
      SIXTEENTH, EIGHTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH,
      SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, EIGHTH, SIXTEENTH, SIXTEENTH, EIGHTH,
      SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH,
      SIXTEENTH, SIXTEENTH, EIGHTH, SIXTEENTH, SIXTEENTH, EIGHTH, SIXTEENTH, SIXTEENTH,
      SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH,
      EIGHTH, SIXTEENTH, SIXTEENTH, EIGHTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH,
      SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, EIGHTH, SIXTEENTH,
      SIXTEENTH, EIGHTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH,
      SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, EIGHTH, SIXTEENTH, SIXTEENTH, EIGHTH,
      SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH,
      SIXTEENTH, SIXTEENTH, EIGHTH, SIXTEENTH, SIXTEENTH, EIGHTH, SIXTEENTH, SIXTEENTH,
      SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH,
      EIGHTH, SIXTEENTH, SIXTEENTH, EIGHTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH,
      SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH, DOTTED_QUARTER, EIGHTH,
      EIGHTH, EIGHTH, EIGHTH, EIGHTH, DOTTED_QUARTER, EIGHTH, EIGHTH, EIGHTH,
      EIGHTH, EIGHTH, DOTTED_QUARTER, EIGHTH, QUARTER, QUARTER, EIGHTH, EIGHTH,
      EIGHTH, EIGHTH, HALF, WHOLE
    ]
  };

  var SONGS = [
    {
      id: 'hotcross',
      title: 'Hot Cross Buns',
      subtitle: 'a clássica primeira lição',
      bpm: 96,
      timeSignature: [4, 4],
      notes: hotcross.notes,
      durations: hotcross.durations
    },
    {
      id: 'twinkle',
      title: 'Brilha Brilha Estrelinha',
      subtitle: 'Twinkle Twinkle Little Star',
      bpm: 100,
      timeSignature: [4, 4],
      notes: twinkle.notes,
      durations: twinkle.durations
    },
    {
      id: 'mary',
      title: 'Maria Tinha um Carneirinho',
      subtitle: 'Mary Had a Little Lamb',
      bpm: 108,
      timeSignature: [4, 4],
      notes: mary.notes,
      durations: mary.durations
    },
    {
      id: 'londonbridge',
      title: 'A Ponte de Londres',
      subtitle: 'London Bridge Is Falling Down',
      bpm: 108,
      timeSignature: [4, 4],
      notes: londonbridge.notes,
      durations: londonbridge.durations
    },
    {
      id: 'frere',
      title: 'Irmão Jorge',
      subtitle: 'Frère Jacques',
      bpm: 104,
      timeSignature: [4, 4],
      notes: frere.notes,
      durations: frere.durations
    },
    {
      id: 'row',
      title: 'Reme, Reme o Barquinho',
      subtitle: 'Row, Row, Row Your Boat',
      bpm: 100,
      timeSignature: [4, 4],
      notes: row.notes,
      durations: row.durations
    },
    {
      id: 'canon',
      title: 'Cânone em Ré (baixo)',
      subtitle: 'Pachelbel — só o baixo mais famoso da música, em loop',
      bpm: 80,
      timeSignature: [4, 4],
      notes: canon.notes,
      durations: canon.durations
    },
    {
      id: 'birthday',
      title: 'Parabéns pra Você',
      subtitle: 'Happy Birthday (versão simplificada)',
      bpm: 112,
      timeSignature: [3, 4],
      notes: birthday.notes,
      durations: birthday.durations
    },
    {
      id: 'ode',
      title: 'Ode à Alegria',
      subtitle: 'Beethoven — Ode to Joy',
      bpm: 112,
      timeSignature: [4, 4],
      notes: ode.notes,
      durations: ode.durations
    },
    {
      id: 'jingle',
      title: 'Jingle Bells',
      subtitle: 'fase bônus — mais rápida',
      bpm: 128,
      timeSignature: [4, 4],
      notes: jingle.notes,
      durations: jingle.durations
    },
    {
      id: 'furelise',
      title: 'Für Elise (tema inicial)',
      subtitle: 'Beethoven — bônus avançado, com sustenido',
      bpm: 60,
      timeSignature: [3, 8],
      notes: furelise.notes,
      durations: furelise.durations
    },
    {
      id: 'canonfull',
      title: '★ Cânone em Ré — completo, com acordes',
      subtitle: 'Pachelbel — melodia + baixo juntos — fase de teste maior',
      bpm: 100,
      timeSignature: [4, 4],
      notes: canonfull.notes,
      durations: canonfull.durations
    }
  ];

  PH.songs = SONGS;
  PH.songTiming = { PPQ: PPQ };
})(window.PianoHero);
