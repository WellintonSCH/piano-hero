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
    }
  ];

  PH.songs = SONGS;
  PH.songTiming = { PPQ: PPQ };

  /**
   * Músicas customizadas (compostas fora deste arquivo — importadas de MusicXML com
   * `tools/mxl_to_song.py`, ou escritas à mão) ficam em arquivos `songs/*.json`, não
   * aqui. `songs/manifest.json` lista quais carregar; cada um vira um item de
   * `PH.songs`, no mesmo formato usado acima (`notes`/`durations`, mais o `sustainDurations`
   * opcional — ver o comentário sobre isso em `buildTimeline()` no main.js). Adicionar
   * uma música nova é só soltar o `.json` em `songs/` e listar o nome do arquivo no
   * manifest — não precisa editar este arquivo.
   *
   * Carregamento é assíncrono (fetch): se a tela de fases já estiver aberta quando uma
   * música customizada termina de carregar, `PH.onSongsChanged()` (main.js define isso)
   * é chamado pra atualizar a lista na hora, sem precisar recarregar a página.
   */
  fetch('songs/manifest.json')
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (files) {
      files.forEach(function (file) {
        fetch('songs/' + file)
          .then(function (r) { return r.json(); })
          .then(function (song) {
            PH.songs.push(song);
            if (PH.onSongsChanged) PH.onSongsChanged();
          })
          .catch(function (err) {
            console.error('[songs] falha ao carregar songs/' + file + ':', err);
          });
      });
    })
    .catch(function () { /* sem songs/manifest.json (ou sem servidor): segue só com as fixas */ });
})(window.PianoHero);
