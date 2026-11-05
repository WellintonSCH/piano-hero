# Músicas

## Repertório

São 21 músicas: 15 escritas à mão em `songs.js` e 6 importadas em `songs/`.

### Embutidas (`songs.js`)

| ID | Título | BPM |
|---|---|---|
| `hotcross` | Hot Cross Buns | 96 |
| `twinkle` | Brilha Brilha Estrelinha | 100 |
| `mary` | Maria Tinha um Carneirinho | 108 |
| `londonbridge` | A Ponte de Londres | 108 |
| `frere` | Irmão Jorge | 104 |
| `row` | Reme, Reme o Barquinho | 100 |
| `canon` | Cânone em Ré (baixo) | 80 |
| `birthday` | Parabéns pra Você | 112 |
| `ode` | Ode à Alegria | 112 |
| `hanschen` | Hänschen Klein | 108 |
| `lobato` | Seu Lobato Tinha um Sítio | 112 |
| `saints` | When the Saints | 120 |
| `brahms` | Canção de Ninar | 96 |
| `jingle` | Jingle Bells | 128 |
| `furelise` | Für Elise (tema inicial) | 60 |

### Importadas (`songs/*.json`)

| Arquivo | Título | BPM | Compasso | Posições na linha do tempo |
|---|---|---|---|---|
| `canonfull.json` | Cânone em Ré | 100 | 4/4 | 348 |
| `passacaglia.json` | Passacaglia | 130 | 4/4 | 582 |
| `swanlake.json` | O Lago dos Cisnes | 100 | 4/4 | 211 |
| `gymnopedie1.json` | Gymnopédie Nº 1 | 54 | 3/4 | 178 |
| `fureliseeasy.json` | Für Elise (duas mãos) | 60 | 3/4 | 87 |
| `bumblebee.json` | O Voo do Besouro | 144 | 2/4 | 774 |

A situação de direitos autorais dos arranjos importados ainda precisa ser conferida, porque um arranjo pode ter direitos próprios mesmo quando a obra original é de domínio público.

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
  "sustainDurations": [480, 480, 960],
  "fingers": ["R1", "R3", ["R1", "R3", "R5"]]
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
| `fingers` | Não | Mão e dedo de cada nota |

### Dedilhado

`R` é a mão direita e `L`, a esquerda. Os dedos vão de 1, o polegar, a 5. Assim, `R1` é o polegar direito. Um acorde recebe um array na mesma ordem das notas. Um rótulo só com a mão, como `"R"`, mantém a mão e deixa o algoritmo escolher o dedo.

Sem o campo `fingers`, o `fingering.js` sugere o dedilhado: usa a mão direita por padrão e a esquerda quando a direita não alcança.

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

3. Complete o dedilhado para revisar à mão, se quiser:

   ```
   node tools/add_fingers.js songs/minha.json
   ```

4. Acrescente `"minha.json"` a `songs/manifest.json`.

Não é preciso alterar o código. O conversor usa só a biblioteca padrão do Python.
