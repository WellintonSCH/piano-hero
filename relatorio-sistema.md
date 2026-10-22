# Relatório: Piano Hero — Estado Final do Sistema (TCC2)

## 1. O que o sistema é

**Piano Hero**: um jogo de ritmo estilo Guitar Hero rodando 100% no navegador, em **vanilla JS puro** (sem framework, sem build tool, sem backend). Notas caem na tela até uma linha de acerto; o jogador toca a nota certa via **piano MIDI real**, **teclado do PC** ou **clique/toque** no teclado desenhado. Funciona no PC e no celular (paisagem, instalável como app pela tela inicial).

O sistema foi além do MVP descrito no `prompt.md` (que pedia só notas soltas, sem ritmo): hoje tem um **motor de ritmo completo** com timeline em ticks, BPM, janelas de acerto, acordes e prática por mão.

## 2. Arquitetura

Oito módulos carregados por `<script>` em ordem de dependência, todos pendurados num único namespace global (`window.PianoHero`), comunicando a entrada por `CustomEvent`s no `window`:

```
latency.js → audio.js → notes.js → songs.js → fingering.js → render.js → input.js → main.js
```

| Módulo | Responsabilidade | Destaques técnicos |
|---|---|---|
| `input.js` | Unifica 3 fontes de entrada | Web MIDI (`requestMIDIAccess`, parsing de note-on/off pelo status byte, descarte de note-on duplicado quando o piano aparece como duas portas), teclado (25 teclas → 2 oitavas, anti-repeat), ponteiro (mouse/touch multitoque por `pointerId`). Todas emitem os mesmos eventos `notePlayed`/`noteReleased`. |
| `latency.js` | Instrumentação de latência | Mede entrada→som em 4 etapas (entrada→dispatch, dispatch→handler, handler→agendamento, agendamento→saída), usando `getOutputTimestamp()` + `outputLatency` para ligar o relógio do Web Audio ao `performance.now()`. Exporta JSON/CSV pelo painel "Medir latência". |
| `audio.js` | Motor de áudio | 25 amostras reais (Dó3–Dó5) via `decodeAudioData`; sustain até soltar a tecla + release exponencial imitando o abafador; notas fora da faixa usam a amostra mais próxima com `playbackRate` (até 1 oitava) ou oscilador sintetizado. Barramento separado para o piano (permite silenciá-lo e tocar num instrumento externo). |
| `notes.js` | Vocabulário musical | MIDI ↔ nome de nota, teclado desenhado de 5 oitavas (1 no celular), faixa ajustável por música, pools de dificuldade do modo livre. |
| `songs.js` + `songs/*.json` | Repertório | 15 músicas embutidas + 6 importadas (JSON), timing em **ticks inteiros (PPQ 480)** como num arquivo MIDI. Músicas novas entram só soltando um JSON em `songs/` (gerado de MusicXML por `tools/mxl_to_song.py`), sem mexer no código. |
| `fingering.js` | Mão e dedo de cada nota | Lê o dedilhado do JSON (`R1`..`R5`, `L1`..`L5`) ou sugere um automaticamente (mão direita por padrão, esquerda só quando a direita não alcança; dedos por "posição" da frase). Mesmo código roda no navegador e no Node. |
| `render.js` | Renderização | Canvas 2D ciente de DPI, geometria do teclado calculada, barras com comprimento proporcional à duração, partículas de acerto, ajuste à altura real da tela no celular. |
| `main.js` | Estado e orquestração | Modos livre e fase, loop `requestAnimationFrame` com `dt` limitado (efeitos) e `rawDt` sem limite (relógio musical), pontuação por janela de acerto (±0,35 s; perfeito ±0,12 s), pausa/retomada com contagem 3-2-1, persistência em `localStorage`, relatório pós-fase. |

**Decisões de arquitetura defensáveis na monografia:**
- **Zero dependências e zero build** — só arquivos estáticos servidos por HTTP.
- **Ticks inteiros** em vez de segundos em ponto flutuante — evita erro acumulado ao longo de músicas longas; conversão para segundos uma única vez ao montar a timeline.
- **Dois deltas de tempo** — um frame atrasado não "rouba" tempo do relógio da música.
- **Camada única de entrada** — MIDI, teclado e toque viram o mesmo evento de domínio; nada do jogo sabe de onde veio a nota.
- **Degradação graciosa** — sem MIDI → teclado/toque; amostra não carregada → oscilador; `file://` → aviso explícito.

## 3. Funcionalidades

- **Mapa de fases** horizontal, com progresso, ranking top-5 por fase e recordes de precisão e de velocidade.
- **Três formas de jogar cada fase:** normal (com janela de tempo), **modo espera** (a música para na nota até o jogador acertar) e **demonstração** (a música toca sozinha para o jogador ouvir antes).
- **Velocidade em qualquer BPM**, lembrada por música.
- **Prática por mão:** o jogador escolhe direita, esquerda ou as duas; a outra mão toca sozinha no tempo certo. O relatório final mostra o acerto de cada mão.
- **Repetição de trecho (loop)** marcada direto na linha do tempo da música.
- **Pausa estilo player de vídeo:** tocar na área das notas pausa; arrastar a pista ou a barra lateral navega na música; ao continuar, a música rebobina 3 s e faz 3-2-1.
- **Relatório pós-fase:** perfeitos/bons/erros, tendência de adiantar ou atrasar, notas mais erradas, acerto por mão.
- **Celular:** modo paisagem em tela cheia, teclado de 1 oitava, músicas maiores como "tocar junto" (só demonstração).

## 4. Avaliação (o que o TCC mede)

- **Latência entrada→som por fonte de entrada** (MIDI × teclado × toque), com o painel "Medir latência": tocar cerca de 30–50 notas em cada fonte, exportar o CSV e comparar a média e a dispersão de cada etapa.
- **Precisão rítmica do jogador**, que o próprio jogo já calcula por partida (desvio médio em ms e tendência de adiantar/atrasar).
- **Compatibilidade:** Chrome/Edge com Web MIDI; Safari/iOS sem Web MIDI (funciona por toque) — limitação do objeto de estudo, documentada no texto.

## 5. Limitações e trabalhos futuros

- Sem testes automatizados (a validação foi manual no navegador).
- O áudio é disparado de forma síncrona no evento de entrada; um agendamento antecipado (lookahead) poderia reduzir o jitter — a medir antes de complicar.
- Web MIDI indisponível no Safari/iOS.
- Dedilhado automático é uma sugestão heurística, não o de um editor de partituras.
- Interface ainda pode ser simplificada com testes de usabilidade com usuários reais.
- Editor de músicas dentro do jogo (hoje é por JSON ou conversão de MusicXML).
