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
- **Repetição de trecho:** o jogador marca início e fim na linha do tempo, e o trecho repete sozinho. A marcação continua válida ao mudar a velocidade.
- **Prática por mão:** o jogador escolhe mão direita, esquerda ou ambas, e a outra mão toca sozinha no tempo certo.
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

## Relatório da fase

Ao terminar uma música, o jogador vê um resumo e pode abrir os detalhes:

- notas perfeitas, boas e erradas;
- tendência de adiantar ou atrasar, exceto no modo espera;
- notas mais erradas;
- acerto de cada mão.

## Celular

O jogo é feito para ser usado em paisagem, em tela cheia. O teclado desenhado tem uma oitava, de Dó4 a Dó5. Músicas que cabem nessa oitava são jogadas normalmente. As maiores aparecem como "tocar junto": ficam só em demonstração, sem pontos, com o teclado ampliado para aquela música.

No iPhone, a tela cheia depende de instalar o jogo pela opção "Adicionar à Tela de Início".

## Medição de latência

A opção "Medir latência", no grupo Avançado do menu de opções, coleta amostras do tempo entre a entrada e o som e permite exportá-las em JSON ou CSV.

## Primeiros passos

Antes da fase 1, o mapa tem a bolha 0, "Primeiros passos": uma introdução guiada ao teclado, sem tempo nem pontuação por ritmo, em cinco passos:

1. **As teclas pretas:** os grupos de 2 e de 3 pretas e o Dó à esquerda do grupo de 2; todos os Dós do teclado acendem.
2. **Todos os Dós:** achar o Dó sem a luz de ajuda.
3. **Dó, Ré, Mi**, com ajuda.
4. **Fá e Sol:** as cinco notas na posição de cinco dedos, com ajuda.
5. **Desafio:** dez notas de Dó a Sol fora de ordem, sem ajuda.

A nota vale em qualquer oitava. Depois de um erro, o texto diz qual tecla foi tocada e onde fica a certa; depois de dois erros seguidos, a tecla certa acende. No fim, a tela mostra acertos, erros, precisão e tempo e leva à primeira música.

## Ajustes de 11/11/2026 (depois do teste do autor)

- Teclado cortado em telas de notebook: o palco agora cabe na altura da janela.
- Notas rápidas na mesma tecla não se sobrepõem mais; todas as notas dos próximos 2 s aparecem.
- Repetir trecho: botões por trecho (Música toda, 1, 2, 3…) abaixo do teclado, no lugar da faixa de arrastar.
- Primeiros passos: só a oitava do meio, com nome das notas nas teclas e o Dó central marcado; notas caem mais devagar.
- Hot Cross Buns (primeira música) passou de 96 para 72 BPM.
