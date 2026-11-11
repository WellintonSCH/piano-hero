# Testes automatizados

Scripts usados na avaliação técnica do TCC. Eles controlam o Google Chrome com a
biblioteca `puppeteer-core`, abrem o jogo, tocam notas (teclado, mouse e um piano MIDI
virtual) e registram os resultados.

## Como rodar

1. Sirva o jogo na porta 8765, a partir da raiz do projeto:
   `python -m http.server 8765`
2. Nesta pasta: `npm install`
3. Diga onde está o Chrome, se não for `/usr/bin/google-chrome`. No Windows:
   `set CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe`
4. Crie a pasta de saída (`mkdir resultados`) e rode um dos scripts:

| Comando | O que faz |
| --- | --- |
| `npm run funcionais` | CT1 a CT8 e a latência sem carga (teclado e mouse) |
| `npm run complementares` | CT9 a CT17 (MIDI virtual, janela de acerto, prática por mão, metrônomo, repetição de trecho, progresso salvo, celular emulado) e a latência sob carga |
| `npm run janela` | Toca a música inteira adiantada ou atrasada por deslocamentos fixos, agendados pelo relógio do jogo (precisa de `?debug`), e mostra como cada toque foi classificado |
| `npm run introducao` | CT18: introdução guiada "Primeiros passos" no computador e no celular emulado (erro, Dó em várias oitavas, luz após dois erros, tela final) |
| `npm run fim` | CT19: fim da demonstração volta à tela da música com o Modo espera em destaque; depois do Modo espera, "Voltar à música" e "Agora no ritmo" |
| `npm run render` | Custo do desenho por quadro, com CPU normal e 4x mais lenta |

`?debug` na URL expõe o estado do jogo (`PianoHero.debugState`) para os testes; sem
ele, nada muda no jogo.
