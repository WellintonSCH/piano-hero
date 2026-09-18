# Relatório: Piano Hero — Estado Atual e Próximos Passos (TCC2)

## 1. O que o sistema é

**Piano Hero**: um jogo de ritmo estilo Guitar Hero rodando 100% no navegador, em **vanilla JS puro** (sem framework, sem build tool, sem backend). Notas caem na tela até uma linha de acerto; o jogador toca a nota certa via MIDI real, teclado do PC ou clique/toque na tela. Estrutura em 6 módulos desacoplados (`audio.js`, `notes.js`, `songs.js`, `render.js`, `input.js`, `main.js`), comunicando-se por `CustomEvent`s no `window`.

Importante: o sistema **já passou da Fase 1** descrita no `prompt.md` original. O prompt pedia "sem ritmo/tempo, fase 2 depois" — mas o código atual já tem um **motor de ritmo completo** (modo "fase/song", com BPM, janelas de acerto e timeline em ticks). Isso muda o enquadramento do TCC: você não está relatando um MVP simples, está relatando um sistema com engine de sincronização temporal.

## 2. Inventário funcional (o que já funciona)

| Módulo | Responsabilidade | Destaques técnicos |
|---|---|---|
| `input.js` | Unifica 3 fontes de entrada | Web MIDI API (`requestMIDIAccess`, parsing de note-on/off por status byte), teclado (mapa de 25 teclas → 2 oitavas, com anti-repeat), pointer (mouse/touch, com prioridade de teclas pretas na hit-detection). Todas emitem os mesmos eventos `notePlayed`/`noteReleased`. |
| `audio.js` | Motor de áudio | Amostras reais gravadas (25 arquivos mp3, Dó3–Dó5), decodificadas via `decodeAudioData`, com sustain (hold até soltar tecla) e release exponencial (`exponentialRampToValueAtTime`) imitando abafador de piano real. Fallback para oscilador sintetizado se a amostra ainda não carregou. |
| `notes.js` | Vocabulário musical | Conversão MIDI↔nome de nota (notação científica), 3 pools de dificuldade (brancas / escala / com sustenidos), gerador de sequência infinita (modo "scale" prefere saltos pequenos, pra soar como melodia). |
| `songs.js` | Repertório | 11 músicas de domínio público com timing em **ticks (PPQ 480)**, igual arquivos MIDI/DAW — decisão deliberada para evitar acúmulo de erro de arredondamento em ponto flutuante ao longo de dezenas de notas. |
| `render.js` | Renderização | Canvas 2D com DPI-awareness (`devicePixelRatio`), geometria de teclado derivada matematicamente, sistema de partículas/anéis para feedback, barras de nota com comprimento proporcional à duração real. |
| `main.js` | Orquestração/estado | Dois modos (`free`/`song`), loop de jogo com `requestAnimationFrame`, separação entre `dt` (limitado, para suavizar partículas) e `rawDt` (não limitado, para não perder precisão do relógio da música), persistência via `localStorage`, relatório pós-fase (tendência de adiantar/atrasar, notas mais erradas). |

**Decisões de arquitetura relevantes para uma monografia técnica:**
- Zero dependências externas, zero passo de build — só HTML/CSS/JS servidos estaticamente.
- Degradação graciosa: sem MIDI → funciona por teclado/mouse; sem áudio decodificado → fallback sintetizado; `file://` → aviso explícito pedindo servidor local (limitação conhecida do Web MIDI/Web Audio nesse protocolo).
- Separação limpa entrada→evento→estado→render, o que facilita testar/discutir cada camada isoladamente.

## 3. O que é mais importante (para a pesquisa técnica)

Como o foco é **Web MIDI/Web Audio**, os pontos com maior peso acadêmico são:

1. **A camada de unificação de input** (`input.js`) — é a peça mais "de pesquisa": três fontes heterogêneas (evento MIDI binário, evento de teclado do SO, evento de ponteiro) convergindo para uma única abstração de domínio (`notePlayed`/`noteReleased`). Isso é generalizável e citável.
2. **O motor de sincronização temporal** (ticks PPQ + `songTime` + `dt` vs `rawDt`) — é onde há uma decisão técnica defensável (por que ticks inteiros, por que dois deltas de tempo diferentes) que dá conteúdo pra discussão de precisão/jitter.
3. **Ausência de backend** — arquitetura 100% client-side com Web Audio decodificando amostras locais é um ponto de design que vale comparar com abordagens que dependem de servidor (streaming, síntese server-side, etc.).

## 4. Lacunas atuais

- **Nenhuma medição formal de latência/precisão** ainda — o sistema *implementa* uma janela de acerto (±0,35s) mas não há dados coletados sobre o quão preciso isso é na prática (MIDI vs teclado vs touch podem ter latências de entrada bem diferentes).
- **Nenhum teste automatizado** (unitário ou E2E) — risco para validar a lógica de timeline/ticks à medida que o projeto cresce.
- **Compatibilidade cross-browser não documentada** — Web MIDI não é suportado nativamente no Safari/iOS; isso é uma limitação real do objeto de estudo que precisa virar texto na monografia, não só comentário no código.
- **Sem instrumentação de coleta de dados** — se a pesquisa vai gerar resultados quantitativos (latência, taxa de acerto, etc.), hoje nada é exportado/logado além do relatório visual na tela.

## 5. Próximas etapas técnicas sugeridas

1. **Instrumentar latência**: medir tempo entre evento de entrada (MIDI/teclado/pointer) e o `AudioContext.currentTime` em que o som de fato começa, para cada fonte de entrada — esse é provavelmente o dado central do TCC técnico.
2. **Testar em matriz de navegadores/SOs** (Chrome/Firefox/Edge em Windows, e verificar comportamento em Safari sem Web MIDI) e documentar formalmente as diferenças.
3. **Escrever testes unitários** para `buildTimeline()` e a matemática de ticks — protege a parte mais "matematicamente sensível" do sistema e dá credibilidade metodológica.
4. **Decidir se o scheduler de áudio precisa de lookahead** — hoje `startNote()` é chamado de forma síncrona no momento do evento; sistemas de áudio profissionais usam scheduling antecipado (buffer de alguns ms à frente) para evitar jitter do event loop do JS. Vale medir se isso é um problema real antes de complicar o código.
5. **Definir o que sai do escopo do TCC2** — o sistema já tem MVP + fase de ritmo prontos; decidir agora se features futuras (ex: mais músicas, ranking, acordes) viram "trabalhos futuros" no texto ou se entram no cronograma.

## 6. Decisões a tomar agora (pesquisa, não código)

1. **Formalizar a pergunta de pesquisa.** Como o foco é técnico, uma pergunta viável é algo como: *"Como projetar e avaliar uma arquitetura client-side, sem backend, que unifique múltiplas fontes de entrada musical (Web MIDI, teclado, ponteiro) em um sistema de jogo rítmico com sincronização temporal em tempo real no navegador?"* — isso dá algo testável (medir latência/precisão) em vez de só "construí um jogo".
2. **Escolher a métrica de avaliação central.** Latência de input→som? Precisão de sincronização (desvio médio em ms, que o próprio `main.js` já calcula por partida)? Compatibilidade entre navegadores? Isso decide que instrumentação precisa ser adicionada primeiro.
3. **Decidir o "baseline" de comparação.** Comparar com outra abordagem (ex: uma lib como Tone.js, ou uma implementação com framework) para justificar a escolha vanilla JS, ou tratar a arquitetura atual como contribuição autônoma sem comparação direta?
4. **Delimitar o corpus de testes.** Testar com usuários reais tocando (dado comportamental) ou só benchmarks automatizados/sintéticos de latência? Tem implicação ética/CEP se envolver pessoas, então precisa decidir cedo.
5. **Congelar escopo para o TCC2.** O prompt original mirava um MVP sem ritmo; o código já entregou muito mais. Decidir com o orientador o que efetivamente vira "capítulo de resultados" vs. o que fica como "trabalhos futuros" — isso evita que a pesquisa continue crescendo sem fechar.
