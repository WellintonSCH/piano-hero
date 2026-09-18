Quero criar um jogo de piano estilo "Guitar Hero" para o navegador, em vanilla JS 
(sem framework), o mais simples possível para ter algo jogável rápido.

## Conceito
- Uma sequência de notas "cai" na tela (como Guitar Hero/Rock Band).
- O jogador toca a nota certa no momento em que ela cruza uma linha/zona de acerto.
- Entrada aceita de 3 formas, todas mapeando pro mesmo "tocar nota X":
  1. Piano MIDI real via Web MIDI API
  2. Clique/toque na tela (teclas de piano desenhadas)
  3. Teclado do computador (mapear teclas tipo A,S,D,F... para notas)
- POR ENQUANTO: sem cobrança de ritmo/tempo. É só sequência de notas, uma de cada vez 
  (ou algumas na tela), sem precisar acertar o timing exato — só acertar a nota certa 
  na ordem certa. Ritmo/tempo entra depois, numa fase 2.
- Foco #1: o jogo tem que ser DIVERTIDO de jogar, mesmo nessa versão simples. 
  Feedback visual/sonoro imediato de acerto e erro é essencial.

## Escopo técnico mínimo (MVP)
- HTML + CSS + JS puro, sem build tool, sem framework, sem backend.
- Canvas (ou só DOM/CSS) para renderizar as notas caindo e o teclado na tela.
- Web MIDI API para capturar input de piano MIDI (com fallback gracioso se não 
  houver dispositivo conectado).
- Estrutura de arquivos simples, algo como:
  - index.html
  - main.js (loop do jogo, estado)
  - input.js (unifica MIDI + teclado do PC + clique na tela → evento "notePlayed")
  - notes.js (gera/gerencia a sequência de notas a tocar)
  - render.js (desenha notas caindo, teclado, feedback de acerto/erro)
- Pontuação simples: acerto = ponto + feedback visual (ex: nota fica verde), 
  erro = feedback de erro (ex: nota fica vermelha), sem penalidade complexa por enquanto.

## O que NÃO fazer agora (fica pra depois)
- Sem timing/ritmo (BPM, compasso, etc) — fase 2.
- Sem MusicXML, VexFlow, partitura tradicional.
- Sem funcionalidades sociais, compartilhamento, backend, banco de dados.
- Sem sistema de níveis/gamificação elaborado — só pontuação simples por enquanto.

## Primeira entrega que eu quero ver rodando
Uma versão jogável no navegador onde:
1. Aparece uma nota na tela pra tocar.
2. Eu toco ela (MIDI, clique ou teclado do PC).
3. O jogo reconhece se acertei ou errei e mostra feedback.
4. Avança pra próxima nota da sequência.

Comece criando essa base funcional antes de qualquer refinamento visual ou de gameplay.s