# Piano Hero

Jogo de ritmo para apoiar a prática individual de piano por iniciantes, executado inteiramente no navegador. As notas caem até uma linha de acerto, e o jogador toca a nota certa em um piano MIDI, no teclado do computador ou tocando na tela.

Este sistema é o artefato de implementação de um Trabalho de Conclusão de Curso de Ciência da Computação da UTFPR, campus Santa Helena. Ele é pensado como complemento ao ensino de piano, não como substituto do professor.

**Jogar online:** https://wellintonsch.github.io/piano-hero/

## Documentação

| Documento | Conteúdo |
|---|---|
| [Resumo para o orientador](docs/resumo-para-orientador.md) | Estado do projeto, mudanças desde o TCC1 e pontos que precisam de decisão |
| [Funcionalidades](docs/funcionalidades.md) | O que o sistema faz, do ponto de vista de quem joga |
| [Arquitetura](docs/arquitetura.md) | Módulos, fluxo de dados, tempo, áudio e persistência |
| [Músicas](docs/musicas.md) | Repertório, formato dos arquivos e como adicionar músicas |
| [Relatório do sistema](relatorio-sistema.md) | Visão resumida do estado final |
| [Especificação inicial](prompt.md) | Pedido original que deu início ao protótipo |

## Principais características

- Três formas de entrada unificadas: Web MIDI, teclado do computador e mouse ou toque.
- 21 músicas, com suporte a acordes e tempo em ticks inteiros.
- Modos normal, espera, demonstração e livre.
- Repetição de trecho, velocidade em qualquer BPM e metrônomo.
- Prática de uma mão, com a outra tocando sozinha, e dedilhado por nota.
- Pontuação, combo, ranking por fase, recordes e relatório de desempenho.
- Versão para celular em paisagem, instalável na tela inicial.

## Como executar

Não há instalação, dependências nem etapa de build. A aplicação precisa ser servida por HTTP, porque Web MIDI e Web Audio não funcionam corretamente por `file://`.

No Windows, dê dois cliques em `iniciar.bat`. Em qualquer sistema com Python:

```
python -m http.server 8000
```

Depois abra `http://localhost:8000`.

## Compatibilidade

O jogo funciona por teclado e toque em navegadores modernos. O piano MIDI depende do suporte do navegador à Web MIDI API: Chrome e Edge oferecem suporte, e o Safari, incluindo o iOS, não oferece. Uma matriz de testes formal ainda não foi feita.

## Tecnologias

HTML, CSS e JavaScript puros, Web MIDI API, Web Audio API, Canvas 2D e `localStorage`. As ferramentas auxiliares usam Python e Node.js, apenas para preparar arquivos de música.

## Licença

Ainda não há uma licença definida para o projeto.
