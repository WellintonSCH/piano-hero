# Funcionalidades

## Entrada

O jogador pode usar, ao mesmo tempo se quiser:

- **Piano MIDI**, conectado ao computador e lido pela Web MIDI API.
- **Teclado do computador**, com teclas mapeadas para duas oitavas.
- **Mouse ou toque** no teclado desenhado, com suporte a mais de um dedo para acordes.

Sem dispositivo MIDI, o jogo continua funcionando pelas outras formas.

## Mapa de fases

A tela inicial é um mapa horizontal de fases numeradas. A primeira fase ainda não concluída fica em destaque. O canto do mapa dá acesso ao modo livre, ao ranking geral e à ajuda.

Ao escolher uma fase, o jogador vê as formas de jogar, o seletor de velocidade, os recordes, a última tentativa e o ranking daquela fase.

## Modos de jogo

| Modo | Como funciona | Pontua |
|---|---|---|
| Normal | As notas seguem o tempo da música e precisam ser tocadas dentro da janela de acerto | Sim |
| Espera | A música para na nota pendente até o jogador acertar, sem pressão de tempo | Sim |
| Demonstração | A música toca sozinha, e a entrada do jogador é ignorada | Não |
| Livre | Fila de notas sem tempo, com três dificuldades: teclas brancas, escala de Dó e com sustenidos | Sim |

Ao fim da demonstração, o jogo volta sozinho para a tela da música e sugere o Modo espera. Na tela de fase completa há sempre Repetir, Voltar à música e Fases; depois do Modo espera, o botão principal é "Agora no ritmo", que toca a mesma música no modo normal, na mesma velocidade.

No modo normal, a janela de acerto é de ±0,25 s, e o acerto perfeito fica em ±0,08 s. Um toque adiantado só vale até a metade do intervalo desde a nota anterior, para não ser confundido com ela, e um toque logo depois de a nota expirar aparece como "Atrasou!" sem contar um erro a mais. No modo espera, a nota é aceita a qualquer momento, sem bônus de perfeito.

## Recursos de prática

- **Velocidade:** qualquer BPM inteiro, de 20 até o dobro do BPM original. A escolha é lembrada por música e não altera a pontuação.
- **Repetição de trecho:** abaixo do teclado, botões dividem a música em trechos de 2, 4 ou 8 compassos. O trecho escolhido se repete, com contagem 3-2-1 a cada volta, até o jogador escolher "Música toda". A marcação continua válida ao mudar a velocidade.
- **Metrônomo:** clique de referência opcional.
- **Silenciar piano:** desliga só o som do piano do jogo, para praticar em um instrumento externo.
- **Dica:** indicação visual da tecla esperada, que pode ser desligada.

## Pausa e navegação

Tocar na área das notas ou pressionar Esc pausa o jogo. A tela de pausa imita um player de vídeo, com as notas congeladas ainda visíveis.

No computador, o jogador navega arrastando a pista de notas, usando a barra vertical ou a roda do mouse. Navegar pausa o jogo automaticamente. Ao continuar, a música volta 3 segundos e faz uma contagem 3-2-1, para que as notas caiam novamente desde o topo. No modo espera, essa contagem não é necessária.

## Pontuação e progresso

- Cada acerto vale 10 pontos, ou 15 se for perfeito.
- O combo aumenta o multiplicador a cada 5 acertos seguidos, até 5x. Um erro zera o combo.
- Cada fase guarda as 5 melhores tentativas, a última tentativa e dois recordes.
- O recorde de precisão guarda a melhor porcentagem.
- O recorde de velocidade guarda o maior BPM concluído no modo normal com precisão de pelo menos 80%.
- O progresso e as opções ficam salvos no próprio navegador.
- Estrelas por fase: de uma a três, conforme a precisão no modo normal (50%, 80% e 95%); concluir no modo espera vale uma estrela.
- Oito medalhas de progresso, anunciadas no momento em que são conquistadas, e a sequência de dias seguidos de prática.
- Perfil com nome, cor de destaque e tema escuro ou claro.

## Relatório da fase

Ao terminar uma música, o jogador vê um resumo e pode abrir os detalhes:

- notas perfeitas, boas e erradas;
- tendência de adiantar ou atrasar, exceto no modo espera;
- notas mais erradas.

## Celular

O jogo é feito para ser usado em paisagem, em tela cheia. O teclado desenhado tem uma oitava, de Dó4 a Dó5. Músicas que cabem nessa oitava são jogadas normalmente. As maiores aparecem como "tocar junto": ficam só em demonstração, sem pontos, com o teclado ampliado para aquela música.

No iPhone, a tela cheia depende de instalar o jogo pela opção "Adicionar à Tela de Início".

## Medição de latência

A opção "Medir latência", no grupo Avançado do menu de opções, coleta amostras do tempo entre a entrada e o som e permite exportá-las em JSON ou CSV.

## Primeiros passos

Antes da fase 1, o mapa tem a fase 0, "Primeiros passos": uma introdução guiada ao teclado, sem tempo, em duas partes.

A primeira parte mostra só três oitavas (uma no celular), com o nome das notas nas teclas e o Dó central marcado, e tem cinco passos (quatro no celular):

1. **Ache o Dó central:** o jogador toca qualquer tecla, e o jogo mostra o nome dela e para que lado fica o Dó central.
2. **Agora as outras notas:** a escala de Dó, subindo e descendo, aceita em qualquer oitava.
3. **Dá pra tocar mais agudo:** Dó, Ré e Mi uma oitava acima e uma abaixo, na tecla exata (só no computador).
4. **O Dó fica antes das 2 pretas:** tocar três Dós diferentes (dois no celular).
5. **Agora explore:** cinco teclas quaisquer.

Depois de dois erros seguidos na mesma nota, a tecla certa acende; no passo 1, depois de cinco tentativas. Uma tecla do piano fora das três oitavas exibidas aparece na tecla de mesmo nome dentro delas.

A segunda parte é a primeira música guiada, "Hot Cross Buns", em três etapas: ouvir na demonstração, tocar no modo espera e tocar no ritmo a 56 BPM. Antes de cada etapa, um cartão explica o que fazer, e o último apresenta as funções do jogo.
