# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Piano Hero**: a Guitar-Hero-style rhythm game that runs entirely in the browser — vanilla JS, no framework, no build tool, no backend. This is the implementation artifact for a TCC (undergraduate thesis, UTFPR); `prompt.md` is the original spec and `relatorio-sistema.md` is a status report documenting the architecture and open research questions — read both for context before making non-trivial changes, since design decisions here are argued in the thesis text, not just the code.

Notes fall toward a hit line; the player plays the right note via real MIDI piano, PC keyboard, or on-screen click/touch. Two modes: **free** (untimed practice queue) and **song** (BPM/tick-timed levels with a hit window, like an actual rhythm game). Song mode supports **chords** (a timeline slot can require more than one simultaneous note) and has two optional toggles: **"Modo espera" (wait mode)** — instead of the note/chord timing out and passing by, the song clock pauses at the pending slot until the player plays it, removing time pressure while keeping the real melody/note order — and **"Demonstração" (demo mode)** — the song auto-plays itself (audio + falling notes + key highlights) at the correct tempo, with player input ignored, so the player can preview a song before attempting it. The game can also be paused (button or Esc) without losing progress, and a "Silenciar piano" toggle mutes only the piano's own sound output (metronome and timeout cue stay audible) for practicing on a real external instrument while using the PC only as a reference/timer.

## Running it

There is no build step and no package manager. The app must be served over HTTP — opening `index.html` via `file://` breaks Web MIDI and Web Audio (the page detects this and shows a warning banner).

- Double-click `iniciar.bat` (Windows), or
- `python -m http.server 8000` then open `http://localhost:8000`

No test suite, linter, or formatter is configured. There is no automated test command to run after changes — verify manually in the browser (see below).

## Architecture

Six script files loaded via plain `<script>` tags in `index.html`, in dependency order:

```
latency.js → audio.js → notes.js → songs.js → render.js → input.js → main.js
```

All modules attach to a single shared global namespace, `window.PianoHero` (aliased `PH` inside each IIFE). Each file is `(function (PH) { 'use strict'; ... })(window.PianoHero)` — there's no module system, so load order in `index.html` matters and must be preserved.

| Module | Responsibility |
|---|---|
| `latency.js` | Input-to-audible-sound latency instrumentation, broken into 4 stages (input→dispatch, dispatch→handler, handler→audio scheduling, scheduling→actual output), using `AudioContext.getOutputTimestamp()` to bridge the `performance.now()` and Web Audio clocks. Export to JSON/CSV via the "Medir latência" panel. |
| `audio.js` | Piano engine: 25 real mp3 samples (Dó3–Dó5, `assets/piano/`), decoded via `decodeAudioData`. Sustain-until-release + exponential-decay tail imitates a real damper. Falls back to a synthesized oscillator if a sample hasn't loaded yet. Notes outside the recorded Dó3–Dó5 range (needed for the wider drawn keyboard, see `notes.js`) play the nearest real sample pitch-shifted via `playbackRate` instead — a deliberate tradeoff (real piano timbre, some distortion at the extremes) over falling back to the synth oscillator for the whole extended range. Deliberately has no synthesized "hit" sound layered on top — the piano note itself *is* the hit/miss feedback. A separate `instrumentGain` bus (vs. the metronome/timeout `master` bus) backs the "Silenciar piano" mute toggle. |
| `notes.js` | MIDI↔note-name conversion. The **drawn keyboard** (`WHITE`/`BLACK`, exported `MIN_MIDI`/`MAX_MIDI`) spans 5 octaves (Dó2–Dó7) generated from a range constant, wide enough for real songs with a spread-out melody+bass (see `canonfull` in `songs.js`) — `input.js`'s MIDI `fold()` reanchors into this same wider range. Free mode's 3 difficulty pools (white keys / C-major scale / with sharps) stay scoped to the original, narrower core range (Dó3–Dó5) independently of the drawn keyboard, via a separate internal `CORE_MIN`/`CORE_MAX` filter — free mode's difficulty is unchanged by how wide the keyboard is drawn. |
| `songs.js` | Song data (public-domain melodies). Timing is stored as **integer ticks (PPQ 480)**, like a MIDI file/DAW, converted to seconds only once at timeline build — this avoids accumulated floating-point rounding error across long note sequences. Preserve this tick-based representation when editing or adding songs. Each song is written once as a `notes`/`durations` phrase and lengthened with the local `repeat()` helper (e.g. `repeat(phrase, durations, 2)`) rather than by duplicating arrays by hand — bump the repeat count (or extend the base phrase) to make a song longer. A `notes[i]` entry can be a single MIDI number or an **array of MIDI numbers** (a chord — all pressed together); `canonfull` (both hands of Pachelbel's Canon, auto-converted from `XML/scores/Canon_in_D_easy.mxl`) is the one example so far and is written as a flat literal (no `repeat()`), since it's a full imported piece rather than a hand-composed phrase. |
| `render.js` | Canvas 2D rendering: DPI-aware sizing, keyboard geometry computed from layout constants, falling note bars (length ∝ note duration), particle/ring hit-feedback effects. In song mode, multiple falling bars can share one timeline slot (a chord) — `state.targetMidis` (not a single `state.target`) is the source of truth for which key(s) are currently expected, used both for the on-screen hint ring and for which bar(s) get the "current target" glow. |
| `input.js` | Unifies three heterogeneous input sources — Web MIDI (`requestMIDIAccess`, raw note-on/off status-byte parsing), PC keyboard (fixed key→MIDI map, two octaves, anti-repeat), and pointer/touch on the drawn keyboard — into two canonical `CustomEvent`s dispatched on `window`: `notePlayed` and `noteReleased`. This input-unification layer is the part of the system the thesis treats as most novel/citable; keep new input sources going through this same event pair rather than talking to game state directly. `fold()` reanchors any MIDI note outside `notes.js`'s drawn-keyboard range into its lowest octave, so an out-of-range physical MIDI keyboard degrades instead of being silently dropped. |
| `main.js` | Game state, orchestration, and the `requestAnimationFrame` loop. Owns the `free`/`song` mode split, timeline building from `songs.js` tick data (a timeline slot's `midis` array has one entry for a plain note, more for a chord — resolved incrementally, one key press at a time, via `state.targetMidis`), hit-window scoring, pause/resume, demo auto-play, `localStorage` progress persistence, and the post-song performance report (early/late tendency, most-missed notes). |

### Key timing subtlety

`main.js`'s loop computes two deltas per frame: `dt` (capped at 0.05s, used for particles/visual echoes so a stalled frame doesn't teleport an effect) and `rawDt` (uncapped, used to advance the song's musical clock, `state.songTime`). If `rawDt` were capped too, a dropped frame (background tab, OS hiccup) would make the game think less time passed than actually did, corrupting rhythm timing. `checkAutoMiss()` is written to absorb a large single-frame jump by walking past multiple missed notes at once — don't reintroduce a cap on the clock-advancing delta.

When `state.waitMode` is on, `updateSong()` additionally clamps `state.songTime` so it never advances past the currently-pending note's timestamp (`state.timeline[state.cursor].time`) — that's the whole mechanism behind "the note waits instead of passing by": `checkAutoMiss()`'s timeout condition simply never becomes true while the clock is pinned. `onSongNote()` then accepts the pending note regardless of `dt` in wait mode (no `HIT_WINDOW`/`PERFECT_WINDOW` check, no "perfect" bonus), and the post-song report skips the timing-tendency text since there's no delta data to summarize.

### Communication pattern

Modules don't call into each other's game state directly for input. `input.js` emits `notePlayed`/`noteReleased` on `window`; `main.js` is the only listener and drives both `audio.js` (playback) and its own scoring/state from there. Keep this one-way event flow when adding features — don't have `render.js` or `input.js` reach into `main.js` state, and don't have new input sources bypass the `notePlayed`/`noteReleased` contract.

### Graceful degradation (by design, don't remove)

- No MIDI device → keyboard/mouse still work.
- Sample not yet decoded → synthesized oscillator fallback in `audio.js`.
- Opened via `file://` → explicit warning banner instead of silently broken audio/MIDI.

## Language

UI strings and code comments are in Portuguese (pt-BR); match this when editing existing files.
