# Músicas

## Repertório

São 21 músicas: 15 escritas à mão em `songs.js` e 6 importadas em `songs/`.

### Embutidas (`songs.js`)

| ID | Título | BPM |
|---|---|---|
| `hotcross` | Hot Cross Buns | 72 |
| `twinkle` | Brilha Brilha Estrelinha | 100 |
| `mary` | Maria Tinha um Carneirinho | 84 |
| `londonbridge` | A Ponte de Londres | 84 |
| `frere` | Irmão Jorge | 80 |
| `row` | Reme, Reme o Barquinho | 80 |
| `canon` | Cânone em Ré (baixo) | 80 |
| `birthday` | Parabéns pra Você | 88 |
| `ode` | Ode à Alegria | 88 |
| `hanschen` | Hänschen Klein | 84 |
| `lobato` | Seu Lobato Tinha um Sítio | 88 |
| `saints` | When the Saints | 92 |
| `brahms` | Canção de Ninar | 80 |
| `jingle` | Jingle Bells | 100 |
| `furelise` | Für Elise (tema inicial) | 60 |

### Importadas (`songs/*.json`)

Nenhuma no momento. As seis peças importadas (Cânone em Ré, Passacaglia, O Lago dos Cisnes, Gymnopédie Nº 1, Für Elise a duas mãos e O Voo do Besouro) e a pasta `XML/` com as partituras de origem foram removidas em 12/11/2026: eram difíceis demais para o público iniciante, e os direitos dos arranjos não tinham sido conferidos. O mecanismo de importação continua funcionando (`songs/manifest.json` vazio).

## Formato

Cada música importada é um arquivo JSON:

```json
{
  "id": "exemplo",
  "title": "Minha Música",
  "subtitle": "compositor ou descrição",
  "bpm": 100,
  "timeSignature": [4, 4],
  "notes": [60, 64, [60, 64, 67]],
  "durations": [480, 480, 960],
  "sustainDurations": [480, 480, 960]
}
```

| Campo | Obrigatório | Significado |
|---|---|---|
| `id` | Sim | Identificador único, usado também para salvar o progresso |
| `title` | Sim | Título exibido |
| `subtitle` | Não | Texto de apoio |
| `bpm` | Sim | Andamento original |
| `timeSignature` | Sim | Compasso, como `[4, 4]` |
| `notes` | Sim | Número MIDI de cada nota; um array representa um acorde |
| `durations` | Sim | Ticks até a próxima posição, com 480 ticks por semínima |
| `sustainDurations` | Não | Ticks que a nota soa, em paralelo a `durations` |

## Adicionar uma música

1. Veja as vozes da partitura:

   ```
   python tools/mxl_to_song.py entrada.mxl --list-voices
   ```

2. Converta o arquivo MusicXML ou `.mxl`:

   ```
   python tools/mxl_to_song.py entrada.mxl songs/minha.json --id minha --title "Minha Música" --subtitle "Compositor"
   ```

   Para usar só algumas vozes, acrescente `--voices 1,5`.

3. Acrescente `"minha.json"` a `songs/manifest.json`.

Não é preciso alterar o código. O conversor usa só a biblioteca padrão do Python.
