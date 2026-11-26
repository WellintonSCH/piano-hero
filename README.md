# Piano Hero

Jogo de ritmo para apoiar a prática individual de piano por iniciantes, executado inteiramente no navegador. As notas caem até uma linha de acerto, e o jogador toca a nota certa em um piano MIDI, no teclado do computador ou tocando na tela.

Este sistema é o artefato de implementação do Trabalho de Conclusão de Curso "Piano Hero: jogo de ritmo web com feedback em tempo real para a prática de piano", de Wellinton Schweitzer, orientado pelo Prof. Dr. Anderson Brilhador, no curso de Ciência da Computação da UTFPR, câmpus Santa Helena. Ele é pensado como complemento ao ensino de piano, não como substituto do professor.

**Jogar online:** https://wellintonsch.github.io/piano-hero/

## Documentação

| Documento | Conteúdo |
|---|---|
| [Funcionalidades](docs/funcionalidades.md) | O que o sistema faz, do ponto de vista de quem joga |
| [Arquitetura](docs/arquitetura.md) | Módulos, fluxo de dados, tempo, áudio e persistência |
| [Músicas](docs/musicas.md) | Repertório, formato dos arquivos e como adicionar músicas |
| [Testes automatizados](tools/testes/README.md) | Scripts usados na avaliação técnica do TCC |

## Principais características

- Três formas de entrada unificadas: Web MIDI, teclado do computador e mouse ou toque.
- Introdução guiada para quem nunca tocou ("Primeiros passos"), da localização das notas no teclado até a primeira música.
- 15 melodias de domínio público, escolhidas para iniciantes, com o tempo guardado em ticks inteiros.
- Modos normal, espera, demonstração e livre.
- Repetição de trecho, velocidade em qualquer BPM e metrônomo.
- Pontuação, combo, ranking por fase, recordes, estrelas, medalhas e relatório de desempenho.
- Medição de latência embutida, com exportação das amostras.
- Versão para celular em paisagem, instalável na tela inicial.

## Como executar

Não há instalação, dependências nem etapa de build. A aplicação precisa ser servida por HTTP, porque Web MIDI e Web Audio não funcionam corretamente por `file://`.

No Windows, dê dois cliques em `iniciar.bat`. Em qualquer sistema com Python:

```
python -m http.server 8000
```

Depois abra `http://localhost:8000`.

## Modo pesquisa (testes com participantes)

Abra o jogo com `?pesquisa=` e um código de participante, por exemplo `http://localhost:8000/?pesquisa=P01`. Um selo "Pesquisa · P01" aparece no canto inferior esquerdo. Com ele ativo:

- cada vez que uma fase começa ou recomeça, o jogo registra uma tentativa: fase, modo, andamento, precisão, acertos, erros, atraso médio e quantas notas vieram do piano MIDI, do teclado e do mouse ou toque; na introdução guiada, registra também o tempo de cada passo. Tentativas interrompidas ficam como "abandonada";
- o protocolo termina sozinho no fim da primeira música guiada: o jogo salva o registro do participante em CSV, mostra uma tela de agradecimento com o QR code do questionário e passa para o código seguinte (P01 → P02), com o progresso do jogo zerado;
- o selo também exporta o registro em CSV ou JSON e permite trocar de participante manualmente.

Os dados ficam só no navegador (`localStorage`) até serem exportados e não identificam a pessoa, apenas o código. Não use janela anônima. Sem `?pesquisa=` na URL, nada disso é ativado.

## Testes automatizados

Os testes da avaliação técnica do TCC estão em [`tools/testes/`](tools/testes/README.md): casos de teste funcionais, bateria de regressão, latência, janela de acerto e desempenho de renderização, rodados no Chrome com um piano MIDI virtual.

## Compatibilidade

O jogo funciona por teclado e toque em navegadores modernos. O piano MIDI depende do suporte do navegador à Web MIDI API: Chrome e Edge oferecem suporte; o Firefox oferece mediante um complemento de permissão por site; e o Safari, incluindo o iOS, não oferece. Uma matriz de testes formal ainda não foi feita.

## Tecnologias

HTML, CSS e JavaScript puros, Web MIDI API, Web Audio API, Canvas 2D e `localStorage`. As ferramentas auxiliares usam Python, para preparar arquivos de música e ícones, e Node.js com Puppeteer, para os testes automatizados.

## Uso de inteligência artificial

O código foi desenvolvido com o apoio de ferramentas de IA generativa de assistência à programação, a partir de especificações escritas pelo autor. O autor definiu os requisitos e a arquitetura, revisou e testou o código e é responsável pelas decisões de projeto. O arquivo `CLAUDE.md` reúne as orientações do projeto usadas por essas ferramentas. Esse uso está descrito na Seção 4.1 do TCC.

## Licença

O código do Piano Hero é distribuído sob a [Licença MIT](LICENSE).

As amostras de piano em `assets/piano/` não estão cobertas por essa licença: derivam do Salamander Grand Piano, de Alexander Holm, sob CC BY 3.0 (ver [`assets/piano/CREDITS.md`](assets/piano/CREDITS.md)).
