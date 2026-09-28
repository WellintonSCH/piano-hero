#!/usr/bin/env python3
"""
mxl_to_song.py -- converte um arquivo MusicXML (.musicxml/.xml) ou comprimido
(.mxl) numa fase pro Piano Hero, no formato JSON que songs.js carrega de
songs/*.json (ver o comentário sobre isso no fim de songs.js).

Só usa a biblioteca padrão do Python (zipfile, xml.etree, json, argparse) --
não precisa instalar nada.

USO BÁSICO
  python tools/mxl_to_song.py XML/scores/Canon_in_D_easy.mxl songs/canonfull.json \
      --id canonfull --title "Cânone em Ré" --subtitle "Pachelbel"

Por padrão usa TODAS as vozes que têm nota (funde num "acorde" quando duas
vozes tocam no mesmo instante). Pra escolher só algumas vozes (útil quando a
partitura tem mais mãos/instrumentos do que você quer no jogo):
  python tools/mxl_to_song.py entrada.mxl saida.json --voices 1,5

Pra ver quais vozes existem e quantas notas cada uma tem, sem converter nada:
  python tools/mxl_to_song.py entrada.mxl --list-voices

COMO FUNCIONA (leia se for mexer no script)
  1. Lê cada nota de cada voz, na ordem em que aparece no arquivo -- isso já é
     a ordem cronológica daquela voz (backup/forward do MusicXML só afetam a
     ORDEM DE ESCRITA entre vozes diferentes, não a cronologia de uma voz só).
  2. Pra cada voz, anda por ela somando durações (em "divisions", a unidade
     do MusicXML) pra achar o instante (onset) de cada nota. Notas marcadas
     <chord/> não avançam o relógio da voz -- elas caem no MESMO onset da
     nota anterior daquela voz (é assim que o MusicXML representa um acorde
     escrito numa voz só).
  3. Junta as notas de TODAS as vozes selecionadas por onset: todo mundo que
     começa no mesmo instante vira um "acorde" (lista de midis). Times
     únicos, ordenados, viram as posições da timeline.
  4. Duração "rítmica" de cada posição = tempo até o PRÓXIMO onset (de
     qualquer voz) -- é o que controla o timing do jogo (quando a próxima
     nota fica devida). Duração de "sustentação" = a duração ESCRITA de
     verdade da nota (maior quando outra voz se move mais rápido por cima/
     debaixo dela) -- usada só pelo modo demonstração, pra soltar a nota no
     tempo musical certo em vez de cortá-la cedo demais. Ver o comentário
     sobre isso em buildTimeline() no main.js.
  5. Converte de "divisions" pra ticks PPQ 480 (o mesmo de songs.js) --
     multiplica por 480/divisions.
  6. MÃO E DEDO (`fingers`, ver fingering.js): partitura de piano tem duas pautas --
     <staff>1</staff> = mão direita, <staff>2</staff> = mão esquerda -- e às vezes o
     dedo marcado (<technical><fingering>3</fingering>). Isso vira "R3"/"L5"; nota
     sem dedo marcado vira só a mão ("R"/"L"), e o jogo completa o dedo (ou rode
     `node tools/add_fingers.js` pra gravar o dedilhado completo no JSON e revisar).
     Partitura com uma pauta só: nada é gravado e o jogo sugere mão e dedo sozinho.
"""

import argparse
import json
import sys
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict

PPQ = 480
STEP_SEMITONES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def load_musicxml_root(path):
    """Aceita .mxl (zip) ou .musicxml/.xml (texto puro) e devolve a raiz do XML."""
    if path.lower().endswith('.mxl'):
        with zipfile.ZipFile(path) as z:
            # META-INF/container.xml diz qual arquivo dentro do zip é a partitura;
            # na prática é sempre o único .xml fora da pasta META-INF.
            names = [n for n in z.namelist() if n.lower().endswith('.xml') and not n.startswith('META-INF')]
            if not names:
                raise ValueError('nenhum .xml de partitura encontrado dentro do .mxl')
            with z.open(names[0]) as f:
                return ET.parse(f).getroot()
    else:
        return ET.parse(path).getroot()


def midi_from_pitch(pitch_el):
    step = pitch_el.find('step').text
    octave = int(pitch_el.find('octave').text)
    alter_el = pitch_el.find('alter')
    alter = int(alter_el.text) if alter_el is not None else 0
    return (octave + 1) * 12 + STEP_SEMITONES[step] + alter


def finger_of(note):
    """Dedo marcado na nota (<notations><technical><fingering>), 1..5 -- ou None.
    Troca de dedo escrita como "3-1" (substituição) usa o primeiro."""
    el = note.find('notations/technical/fingering')
    if el is None or not el.text:
        return None
    for ch in el.text:
        if ch in '12345':
            return int(ch)
    return None


def collect_voices(root):
    """
    Varre todas as <note> do documento (todas as <part>, em ordem) e devolve
    {voice_id: [(onset, midi, written_dur, staff, finger), ...]}, cada lista já em
    ordem cronológica daquela voz, com o relógio de <chord/> resolvido. `staff` é a
    pauta ('1', '2' ou None) e `finger` o dedo marcado (1..5 ou None).
    """
    measures = root.findall('.//part/measure')
    cursor_by_voice = defaultdict(int)
    last_onset_by_voice = defaultdict(int)
    events_by_voice = defaultdict(list)

    for m in measures:
        for note in m.findall('note'):
            voice_el = note.find('voice')
            voice = voice_el.text if voice_el is not None else '1'
            dur_el = note.find('duration')
            dur = int(dur_el.text) if dur_el is not None else 0
            is_chord = note.find('chord') is not None
            is_rest = note.find('rest') is not None
            is_grace = note.find('grace') is not None

            onset = last_onset_by_voice[voice] if is_chord else cursor_by_voice[voice]

            if is_grace:
                # Nota de ornamento não tem duração própria no MusicXML (dur=0) --
                # ignorada aqui pra não virar uma posição de duração zero na timeline.
                continue

            if not is_rest:
                pitch = note.find('pitch')
                if pitch is not None:
                    staff_el = note.find('staff')
                    staff = staff_el.text.strip() if staff_el is not None and staff_el.text else None
                    events_by_voice[voice].append((onset, midi_from_pitch(pitch), dur, staff, finger_of(note)))

            if not is_chord:
                cursor_by_voice[voice] += dur
                last_onset_by_voice[voice] = onset

    return events_by_voice


def build_song_data(events_by_voice, voice_ids, divisions):
    scale = PPQ / divisions  # multiplicador de "divisions" (MusicXML) pra ticks PPQ480

    all_events = []
    for v in voice_ids:
        all_events.extend(events_by_voice.get(v, []))
    if not all_events:
        raise ValueError('nenhuma nota encontrada nas vozes selecionadas: ' + ','.join(voice_ids))

    onset_to_midis = {}
    onset_to_maxdur = {}
    label_of = {}   # (onset, midi) -> "R3" / "L" ... (primeira ocorrência vale)
    has_staves = any(ev[3] == '2' for ev in all_events)
    for onset, midi, dur, staff, finger in all_events:
        midis = onset_to_midis.setdefault(onset, [])
        if midi not in midis:
            midis.append(midi)
            if has_staves:
                label_of[(onset, midi)] = ('L' if staff == '2' else 'R') + (str(finger) if finger else '')
        onset_to_maxdur[onset] = max(onset_to_maxdur.get(onset, 0), dur)

    onsets = sorted(onset_to_midis.keys())
    total_span = max(cursor for voice_events in
                      [events_by_voice.get(v, []) for v in voice_ids]
                      for cursor in [max((ev[0] + ev[2] for ev in voice_events), default=0)])

    notes, durations, sustain_durations, fingers = [], [], [], []
    for i, onset in enumerate(onsets):
        midis = sorted(onset_to_midis[onset])
        next_onset = onsets[i + 1] if i + 1 < len(onsets) else total_span
        gap = next_onset - onset
        if gap <= 0:
            gap = onset_to_maxdur[onset]
        notes.append(midis[0] if len(midis) == 1 else midis)
        durations.append(round(gap * scale))
        sustain_durations.append(round(onset_to_maxdur[onset] * scale))
        labels = [label_of.get((onset, m), 'R') for m in midis]
        fingers.append(labels[0] if len(labels) == 1 else labels)

    return notes, durations, sustain_durations, (fingers if has_staves else None)


def extract_metadata(root):
    divisions_el = root.find('.//attributes/divisions')
    divisions = int(divisions_el.text) if divisions_el is not None else 1

    bpm = None
    sound_el = root.find('.//sound[@tempo]')
    if sound_el is not None:
        bpm = round(float(sound_el.get('tempo')))

    beats_el = root.find('.//attributes/time/beats')
    beat_type_el = root.find('.//attributes/time/beat-type')
    time_sig = [int(beats_el.text), int(beat_type_el.text)] if beats_el is not None and beat_type_el is not None else [4, 4]

    work_title_el = root.find('.//work/work-title')
    work_title = work_title_el.text if work_title_el is not None else None

    composer_el = root.find(".//identification/creator[@type='composer']")
    composer = composer_el.text if composer_el is not None else None

    return divisions, bpm, time_sig, work_title, composer


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('input', help='.mxl ou .musicxml/.xml de entrada')
    ap.add_argument('output', nargs='?', help='.json de saída (ex.: songs/minhamusica.json)')
    ap.add_argument('--id', help='id curto da fase (padrão: nome do arquivo de saída, sem extensão)')
    ap.add_argument('--title', help='título mostrado na lista de fases (padrão: <work-title> do MusicXML)')
    ap.add_argument('--subtitle', default='', help='subtítulo mostrado na lista de fases')
    ap.add_argument('--bpm', type=int, help='sobrescreve o BPM (padrão: detectado do <sound tempo>)')
    ap.add_argument('--time-signature', help='sobrescreve a fórmula de compasso, ex.: 3/4 (padrão: detectada)')
    ap.add_argument('--voices', help='vozes a combinar, separadas por vírgula (ex.: 1,5). Padrão: todas as que têm nota')
    ap.add_argument('--list-voices', action='store_true', help='só lista as vozes disponíveis e quantas notas cada uma tem, sem converter')
    args = ap.parse_args()

    root = load_musicxml_root(args.input)
    events_by_voice = collect_voices(root)

    if args.list_voices:
        print('Vozes encontradas em', args.input, ':')
        for v in sorted(events_by_voice, key=lambda x: (len(x), x)):
            evs = events_by_voice[v]
            midis = [ev[1] for ev in evs]
            staves = sorted({ev[3] for ev in evs if ev[3]})
            marked = sum(1 for ev in evs if ev[4])
            print('  voz {}: {} notas, midi {}..{}, pauta {} (1 = mão direita, 2 = esquerda), {} com dedo marcado'.format(
                v, len(evs), min(midis), max(midis), '/'.join(staves) or '?', marked))
        return

    if not args.output:
        ap.error('output é obrigatório (a não ser com --list-voices)')

    divisions, detected_bpm, detected_time_sig, work_title, composer = extract_metadata(root)

    voice_ids = args.voices.split(',') if args.voices else sorted(events_by_voice.keys())
    notes, durations, sustain_durations, fingers = build_song_data(events_by_voice, voice_ids, divisions)

    bpm = args.bpm or detected_bpm
    if not bpm:
        ap.error('não consegui detectar o BPM no MusicXML -- passe --bpm manualmente')

    if args.time_signature:
        beats, beat_type = args.time_signature.split('/')
        time_sig = [int(beats), int(beat_type)]
    else:
        time_sig = detected_time_sig

    import os
    song_id = args.id or os.path.splitext(os.path.basename(args.output))[0]
    title = args.title or work_title or song_id
    subtitle = args.subtitle or (composer or '')

    song = {
        'id': song_id,
        'title': title,
        'subtitle': subtitle,
        'bpm': bpm,
        'timeSignature': time_sig,
        'notes': notes,
        'durations': durations,
        'sustainDurations': sustain_durations
    }
    if fingers:
        song['fingers'] = fingers

    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(song, f, ensure_ascii=False, indent=2)

    chords = sum(1 for n in notes if isinstance(n, list))
    print('Escrevi {} ({} posições, {} acordes, vozes {}, {} BPM, compasso {}/{})'.format(
        args.output, len(notes), chords, ','.join(voice_ids), bpm, time_sig[0], time_sig[1]))
    if fingers:
        print('Mão de cada nota tirada das pautas da partitura (dedos marcados: {}).'.format(
            sum(1 for f in fingers for l in (f if isinstance(f, list) else [f]) if len(l) > 1)))
        print('Pra gravar o dedilhado completo e revisar: node tools/add_fingers.js ' + args.output)
    print('Lembre de listar "{}" em songs/manifest.json pra ele aparecer no jogo.'.format(
        os.path.basename(args.output)))


if __name__ == '__main__':
    main()
