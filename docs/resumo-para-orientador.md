# Resumo do projeto para o orientador

Situação em 05/11/2026. Documento de apoio para receber orientação antes da escrita do TCC2.

**Sistema publicado:** https://wellintonsch.github.io/piano-hero/
**Código:** https://github.com/WellintonSCH/piano-hero

## O que foi desenvolvido

O Piano Hero é um jogo de ritmo que roda inteiramente no navegador. As notas caem até uma linha de acerto, e o jogador as toca em um piano MIDI, no teclado do computador ou na tela. O sistema compara cada nota com a esperada e dá retorno imediato, tanto no modo com tempo quanto no modo espera, em que a música aguarda o acerto.

O público continua sendo o iniciante em prática individual, e o sistema continua sendo um complemento ao ensino. O que mudou foi a forma da solução: a proposta do TCC1 era uma plataforma com partitura e comunidade, e o resultado é um jogo com notas caindo, sem servidor.

## Comparação com a proposta do TCC1

| Item | Proposta no TCC1 | Sistema atual |
|---|---|---|
| Interface | React | JavaScript puro, sem framework |
| Visualização musical | Partitura com VexFlow | Notas caindo em Canvas 2D, sem partitura |
| Som | Tone.js | Web Audio API com 25 amostras reais de piano |
| Servidor | Node.js e Express | Não há; arquivos estáticos |
| Banco de dados | PostgreSQL | Não há; `localStorage` no navegador |
| Entrada | MIDI e teclado virtual | MIDI, teclado do computador, mouse e toque |
| MusicXML | Importação pelo usuário | Conversão prévia por script (`tools/mxl_to_song.py`) |
| Modo Espera | Previsto | Implementado |
| Modo Contínuo | Previsto | Implementado (modo normal) |
| Modo Loop | Por compassos, com gráfico de evolução | Implementado por trecho na linha do tempo, sem gráfico |
| Ajuste de andamento | 25% a 200% | De 20 BPM até o dobro do BPM original |
| Metrônomo | Previsto | Implementado |
| Pontuação | Multidimensional | Pontos, combo, ranking por fase e recordes |
| Conquistas | Previstas | Não implementadas |
| Módulo social | Perfis, comentários e compartilhamento | Não implementado |
| Publicação e código aberto | Previstos, com licença MIT | Publicado; repositório público, ainda sem licença |

Foram acrescentados itens que não estavam na proposta: prática de uma mão com a outra tocando sozinha, dedilhado por nota, modo demonstração, relatório por mão e versão para celular.

## Avaliação: situação atual

Ainda não há resultados coletados. O TCC1 previu três avaliações:

| Avaliação | Previsão no TCC1 | Situação |
|---|---|---|
| Técnica | Latência média abaixo de 20 ms | Painel de medição implementado, exporta JSON e CSV; medições formais não realizadas |
| Usabilidade | Questionário SUS, meta acima de 70 | Não realizada |
| Engajamento | Dados de uso e questionário IMI | Não realizada; o sistema não envia dados de uso a um servidor |

O sistema também registra, a cada partida, acertos, erros e tendência de adiantar ou atrasar, mas esses dados ficam apenas na tela e no navegador do jogador.

## Limitações conhecidas

- Não há testes automatizados; a verificação foi manual no navegador.
- O Safari e o iOS não têm Web MIDI, então funcionam só por toque.
- O dedilhado automático é uma sugestão heurística.
- O som é disparado no momento da entrada, sem agendamento antecipado.
- Não houve testes com usuários.

## Pontos para orientação

1. **Enquadramento:** o trabalho deve seguir como plataforma de apoio ao ensino ou passar a ser apresentado como jogo de ritmo? O título "Plataforma Web Acessível e Gamificada para o Ensino de Piano" deve mudar?
2. **Pergunta de pesquisa:** a pergunta do TCC1 cita tecnologias que não foram usadas. Qual deve ser a nova formulação?
3. **Mudança de escopo:** a retirada de partitura, servidor e módulo social é aceitável se for justificada no texto?
4. **Avaliação:** quais avaliações são viáveis no prazo? Medição de latência, testes com usuários ou ambas?
5. **Ética:** testes com pessoas exigem aprovação de comitê neste caso?
6. **Formato do texto:** qual estrutura de capítulos e qual tamanho são esperados para o TCC2?
7. **Prazo:** quais são as datas de entrega e de defesa a considerar?

## Onde ver mais detalhes

- [Funcionalidades](funcionalidades.md)
- [Arquitetura](arquitetura.md)
- [Músicas](musicas.md)
