#!/usr/bin/env node
/*
 * add_fingers.js -- grava o dedilhado (`fingers`) nos JSON de música (songs/*.json),
 * usando o MESMO algoritmo do jogo (fingering.js), pra poder revisar/corrigir à mão.
 *
 * Formato: `fingers` paralelo a `notes`; "R1".."R5" = mão direita (1 = dedão), "L1".."L5"
 * = esquerda; acorde = array na ordem das notas do acorde. Só a mão ("R"/"L") também vale.
 *
 * O que já estiver escrito é respeitado: mãos e dedos dados ficam; só o que falta (arquivo
 * sem `fingers`, ou rótulos só com a mão, como os que tools/mxl_to_song.py gera quando a
 * partitura não marca o dedo) é completado.
 *
 * USO
 *   node tools/add_fingers.js                  (todos os listados em songs/manifest.json)
 *   node tools/add_fingers.js songs/minha.json (só esse)
 *   node tools/add_fingers.js --force ...      (refaz do zero, ignorando o que está escrito)
 */

'use strict';

var fs = require('fs');
var path = require('path');
var fingering = require('../fingering.js');

var args = process.argv.slice(2);
var force = args.indexOf('--force') !== -1;
var files = args.filter(function (a) { return a !== '--force'; });

var songsDir = path.join(__dirname, '..', 'songs');
if (!files.length) {
  files = JSON.parse(fs.readFileSync(path.join(songsDir, 'manifest.json'), 'utf8'))
    .map(function (f) { return path.join(songsDir, f); });
}

files.forEach(function (file) {
  var song = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (force) delete song.fingers;
  var before = JSON.stringify(song.fingers || null);
  song.fingers = fingering.toJSON(song);
  var counts = { R: 0, L: 0 };
  song.fingers.forEach(function (f) {
    (Array.isArray(f) ? f : [f]).forEach(function (l) { counts[l.charAt(0)]++; });
  });
  fs.writeFileSync(file, JSON.stringify(song, null, 2) + '\n', 'utf8');
  var changed = before !== JSON.stringify(song.fingers);
  console.log(path.basename(file) + ': ' + (changed ? 'gravado' : 'sem mudança') +
    ' (mão direita ' + counts.R + ' notas, esquerda ' + counts.L + ')');
});
