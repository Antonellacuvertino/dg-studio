// ===============================================================
//  MODO FÁCIL del Estudio: "beat grid" como las tarjetas del video.
//  Una fila por instrumento, 16 casillas por compás, recetas por
//  estilo y una biblioteca para elegir el sonido de cada fila.
// ===============================================================
import { h, put, toast, busy, busyText, action, sheet, confirm, prompt, slider } from '../core/ui.js';
import { audio, stopPreview, playPreview, shareOrSave, safeName } from '../core/audio.js';
import { state } from '../core/state.js';
import { NOTE_ES, GENRES } from '../engine/engine.js';
import { toMp3, toWav } from '../engine/export.js';
import { SYNTHS, newTrack, newScene, degToMidi, genDrum, genAcid, genBass, CAMELOT, TECHNO, projectSeconds } from '../studio/model.js';
import { RECIPES, stepsFrom, notesFrom } from '../studio/recipes.js';
import { soundNameSync, soundBuffer } from '../studio/library.js';
import { transport, renderProject } from '../studio/sequencer.js';
import { sampleBuffer } from '../studio/samples.js';
import { pickSound } from './soundpicker.js';
import { recorderCard } from './recordercard.js';
import { sendToMulti } from '../multi/send.js';

const ui = { page: 0 };

// Vista "loop": todas las pistas suenan a la vez, en bucle
export function loopView(P) {
  const scene = { id: 'grid', name: 'Loop', fx: 'none', get bars() { return Math.max(1, ...P.tracks.map((t) => (t.pattern.len || 16) / 16)); }, get on() { return Object.fromEntries(P.tracks.map((t) => [t.id, true])); } };
  return { get bpm() { return P.bpm; }, get swing() { return P.swing; }, get root() { return P.root; }, get mode() { return P.mode; }, get master() { return P.master; }, get tracks() { return P.tracks; }, scenes: [scene], id: P.id, name: P.name };
}

export function renderGrid(root, P, { save, rerender, openMenu, goAdvanced }) {
  const maxLen = Math.max(16, ...P.tracks.map((t) => t.pattern.len || 16));
  const pages = maxLen / 16; if (ui.page >= pages) ui.page = 0;
  const off = ui.page * 16;
  const G = GENRES[P.genre];
  const rec = RECIPES.find((r) => r.id === P.recipe);

  // ---- cabecera y transporte ----
  const play = h('button.tplay#tPlay.always', { onclick: () => toggle(P) }, transport.playing ? '■' : '▶');
  const bpm = h('div.bpm', {}, h('button', { onclick: () => setBpm(P, P.bpm - 1, save) }, '−'), h('div.v', { onclick: action(async () => { const v = await prompt('Tempo (BPM)', String(P.bpm)); if (v && +v) setBpm(P, +v, save); }) }, String(P.bpm), h('small', {}, 'BPM')), h('button', { onclick: () => setBpm(P, P.bpm + 1, save) }, '+'));

  // ---- recetas (tarjetas) ----
  const cards = h('div.recipes');
  RECIPES.forEach((r) => cards.append(h('button.recipe' + (r.id === P.recipe ? '.on' : ''), { style: { background: r.color }, onclick: action(() => applyRecipe(P, r, save, rerender)) },
    h('b', {}, r.name), h('span', {}, `${r.bpm} BPM`), miniGrid(r))));

  // ---- cuadrícula ----
  const grid = h('div.bgrid');
  const head = h('div.bg-row.bg-head', {}, h('div.bg-name'), h('div.bg-cells', {}, ...Array.from({ length: 16 }, (_, i) => h('span', {}, i % 4 === 0 ? String(i / 4 + 1) : '·'))), h('div.bg-more'));
  grid.append(head);
  P.tracks.forEach((t) => grid.append(gridRow(t, P, off, save, rerender)));

  const pageSel = pages > 1 ? h('div.chips', {}, ...Array.from({ length: pages }, (_, i) => h('button' + (i === ui.page ? '.on' : ''), { onclick: () => { ui.page = i; rerender(); } }, `Compás ${i + 1}`))) : null;

  put(root,
    h('div.row', { style: { marginTop: '12px' } },
      h('div.grow', {}, h('h2.vt', { style: { margin: 0 } }, P.name), h('div.muted.small', {}, `${G ? G.emoji + ' ' + G.name + ' · ' : ''}${NOTE_ES[P.root]} ${P.mode === 'minor' ? 'menor' : 'mayor'} · ${CAMELOT[P.mode][P.root]}`)),
      h('button.btn.sm', { onclick: action(openMenu) }, '⋯')),
    h('div.transport', {}, h('div.row', {}, play, bpm, h('div.grow'), h('button.btn.sm', { onclick: goAdvanced }, '⚙️ Avanzado'))),
    h('div.muted.small', { style: { margin: '10px 2px 4px' } }, '1️⃣ Elige un estilo'),
    cards,
    rec ? h('div.tipcard', { style: { borderColor: rec.color } }, h('b', {}, `💡 ${rec.name}`), ' ', rec.tip) : null,
    h('div.muted.small', { style: { margin: '12px 2px 4px' } }, '2️⃣ Toca las casillas · toca el nombre para cambiar el sonido'),
    pageSel,
    grid,
    h('div.grid2', { style: { marginTop: '10px' } },
      h('button.btn.primary', { onclick: action(() => addRow(P, save, rerender)) }, '＋ Instrumento'),
      h('button.btn', { onclick: () => { P.tracks.forEach((t) => { if (t.kind === 'drum') t.pattern.steps = vary(t); }); save(); rerender(); } }, '🎲 Variar ritmo')),
    h('div.muted.small', { style: { margin: '14px 2px 4px' } }, '3️⃣ Guarda tu beat'),
    h('div.grid2', {},
      h('button.btn', { onclick: action(() => exportBeat(P, 'mp3')) }, '⬇️ MP3'),
      h('button.btn', { onclick: action(() => exportBeat(P, 'wav')) }, '💿 WAV (DJ)')),
    h('button.btn.block', { style: { marginTop: '8px' }, onclick: action(() => sendBeat(P)) }, '📤 Enviar a Multipista (para sumar voces y audios)'),
    recorderCard(),
    h('p.muted.small', { style: { marginTop: '10px' } }, 'Para armar el tema completo (intro, subida, drop…), mezclar y usar el piano roll, entra en ⚙️ Avanzado: tus filas son las mismas pistas.'),
  );
}

function miniGrid(r) {
  const box = h('div.mini');
  r.rows.slice(0, 4).forEach(([, , s]) => box.append(h('div', {}, ...stepsFrom(s).map((v) => h('i' + (v ? '.on' : ''))))));
  return box;
}

function gridRow(t, P, off, save, rerender) {
  const label = t.kind === 'synth' ? (SYNTHS[t.preset] || {}).name : t.sampleId ? 'Sonido propio' : soundNameSync(t.sound);
  const name = h('button.bg-name', { style: { borderLeftColor: t.color }, onclick: action(() => changeSound(t, P, save, rerender)) }, h('b', {}, t.name), h('span', {}, '🔊 ' + (label || '')));
  const cells = h('div.bg-cells');
  for (let k = 0; k < 16; k++) {
    const i = off + k; const len = t.pattern.len || 16;
    if (i >= len) { cells.append(h('span.off')); continue; }
    let v = 0;
    if (t.kind === 'synth') { const n = t.pattern.notes.find((n) => i >= n.s && i < n.s + n.len); v = n ? (n.s === i ? 1 : 0.4) : 0; }
    else if (t.kind === 'drum' || (t.kind === 'sample' && t.mode !== 'loop')) v = t.pattern.steps[i] || 0;
    else { cells.append(h('span.off', {}, k === 0 ? 'loop' : '')); continue; }
    const b = h('button' + (v >= 0.9 ? '.v1' : v > 0 ? '.v2' : '') + (Math.floor(k / 4) % 2 ? '.b4' : ''), { 'data-step': i, style: v ? { background: t.color } : null });
    b.onclick = () => {
      if (t.kind === 'synth') {
        const hit = t.pattern.notes.find((n) => i >= n.s && i < n.s + n.len);
        if (hit) t.pattern.notes = t.pattern.notes.filter((n) => n !== hit); else { t.pattern.notes.push({ s: i, d: t.rowNote || 0, len: 1, vel: 1 }); auditionSynth(t, P); }
      } else {
        const nv = !t.pattern.steps[i] ? 1 : t.pattern.steps[i] >= 0.9 ? 0.55 : 0; t.pattern.steps[i] = nv;
        if (nv && !transport.playing) auditionDrum(t, nv);
      }
      save(); rerender();
    };
    cells.append(b);
  }
  const more = h('button.bg-more', { title: 'Opciones', onclick: action(() => rowMenu(t, P, save, rerender)) }, t.mute ? '🔇' : '⋯');
  return h('div.bg-row' + (t.mute ? '.muted-row' : ''), {}, name, cells, more);
}

async function changeSound(t, P, save, rerender) {
  const cat = t.kind === 'synth' ? 'synth' : t.role === 'kick' ? 'kick' : t.role === 'snare' ? (/clap/.test(t.sound || '') ? 'clap' : 'snare') : t.role === 'hat' ? 'hat' : 'perc';
  const c = await pickSound({ cat, synths: true, current: t.kind === 'synth' ? t.preset : t.sampleId || t.sound, title: `🔊 Sonido para "${t.name}"`, root: P.root });
  if (!c) return;
  applyChoice(t, c, P);
  save(); rerender(); await transport.refreshLib();
}
function applyChoice(t, c, P) {
  if (c.kind === 'synth') {
    if (t.kind !== 'synth') { t.kind = 'synth'; t.pattern.notes = t.pattern.steps.map((v, s) => (v ? { s, d: 0, len: 1, vel: v } : null)).filter(Boolean); }
    t.preset = c.preset; t.role = SYNTHS[c.preset].fn === 'bass' ? 'bass' : 'lead';
  } else if (c.kind === 'drum') {
    if (t.kind === 'synth') { t.kind = 'drum'; t.pattern.steps = Array.from({ length: t.pattern.len }, (_, i) => (t.pattern.notes.some((n) => n.s === i) ? 1 : 0)); }
    t.kind = 'drum'; t.sound = c.sound; t.sampleId = null;
  } else if (c.kind === 'sample') {
    if (t.kind === 'synth') t.pattern.steps = Array.from({ length: t.pattern.len }, (_, i) => (t.pattern.notes.some((n) => n.s === i) ? 1 : 0));
    if (c.sampleKind === 'loop' && c.dur > 1.2) { t.kind = 'sample'; t.mode = 'loop'; t.sampleBpm = c.bpm || P.bpm; t.loopBars = c.bars || 1; } else t.kind = 'drum';
    t.sampleId = c.sampleId;
  }
  void P;
}

async function rowMenu(t, P, save, rerender) {
  const r = await sheet(t.name, { body: h('div', {},
    slider('Volumen', t.vol, { min: 0, max: 1.2, oninput: (v) => { t.vol = v; transport.update(t); save(); } }),
    slider('Afinación', t.pitch || 0, { min: -12, max: 12, step: 1, fmt: (v) => `${v > 0 ? '+' : ''}${v} st`, oninput: (v) => { t.pitch = v; save(); } }),
    t.kind === 'synth' ? slider('Nota nueva', t.rowNote || 0, { min: -7, max: 7, step: 1, fmt: (v) => { const m = degToMidi(P, SYNTHS[t.preset] || SYNTHS.lead, v); return NOTE_ES[((m % 12) + 12) % 12]; }, oninput: (v) => { t.rowNote = v; save(); } }) : null,
    slider('Reverb', t.fx.reverb || 0, { oninput: (v) => { t.fx.reverb = v; transport.update(t); save(); } })),
  options: [
    { id: 'mute', label: t.mute ? '🔊 Activar' : '🔇 Silenciar' },
    { id: 'rename', label: '✎ Renombrar' },
    { id: 'clear', label: '🧹 Vaciar la fila' },
    { id: 'gen', label: t.kind === 'synth' ? '🎲 Nueva melodía/bajo' : '🎲 Nuevo ritmo para esta fila' },
    { id: 'len', label: `⏱ Largo: ${(t.pattern.len || 16) / 16} compás(es)`, sub: 'Para melodías o ritmos más largos' },
    { id: 'del', label: '🗑 Quitar instrumento', danger: true },
  ], cancel: 'Listo' });
  if (r === 'mute') { t.mute = !t.mute; transport.update(t); }
  else if (r === 'rename') { const v = await prompt('Nombre', t.name); if (v) t.name = v; }
  else if (r === 'clear') { if (t.kind === 'synth') t.pattern.notes = []; else t.pattern.steps = t.pattern.steps.map(() => 0); }
  else if (r === 'gen') { if (t.kind === 'synth') t.pattern.notes = t.preset === 'acid' ? genAcid(Math.random() * 1e9, t.pattern.len) : genBass(Math.random() * 1e9, t.pattern.len, 'offbeat'); else t.pattern.steps = vary(t); }
  else if (r === 'len') {
    const l = await sheet('Largo de la fila', { options: [16, 32, 64].map((x) => ({ id: String(x), label: `${x / 16} compás(es)` })) });
    if (l) { const nl = +l, old = t.pattern.len || 16; t.pattern.len = nl; if (t.pattern.steps) { for (let i = old; i < nl; i++) t.pattern.steps[i] = t.pattern.steps[i % old] || 0; t.pattern.steps.length = nl; } if (t.pattern.notes) { if (nl > old) for (let k = old; k < nl; k += old) t.pattern.notes.filter((n) => n.s < old).forEach((n) => t.pattern.notes.push({ ...n, s: n.s + k })); t.pattern.notes = t.pattern.notes.filter((n) => n.s < nl); } }
  }
  else if (r === 'del') {
    if (!(await confirm('¿Quitar instrumento?', `"${t.name}" se elimina del beat.`, 'Quitar', true))) return;
    P.tracks = P.tracks.filter((x) => x !== t); P.scenes.forEach((s) => delete s.on[t.id]); if (transport.player) transport.player.mixer.remove(t.id);
  }
  save(); rerender();
}

async function addRow(P, save, rerender) {
  const c = await pickSound({ cat: 'kick', synths: true, title: '＋ ¿Qué instrumento agregas?', root: P.root });
  if (!c) return;
  let t;
  if (c.kind === 'synth') t = newTrack('synth', { name: SYNTHS[c.preset].name, preset: c.preset, role: SYNTHS[c.preset].fn === 'bass' ? 'bass' : 'lead', notes: [], fx: { duck: SYNTHS[c.preset].fn === 'bass' ? 0.6 : 0.3 } });
  else if (c.kind === 'drum') t = newTrack('drum', { name: c.name, sound: c.sound, role: /kick/i.test(c.sound) ? 'kick' : /hat|ride/i.test(c.sound) ? 'hat' : /clap|snare/i.test(c.sound) ? 'snare' : 'perc' });
  else { t = newTrack('drum', { name: c.name.slice(0, 24), role: 'perc' }); applyChoice(t, c, P); }
  P.tracks.push(t); P.scenes.forEach((s) => { s.on[t.id] = true; });
  save(); rerender(); await transport.refreshLib();
  toast(`＋ ${t.name}: toca las casillas`);
}

async function applyRecipe(P, r, save, rerender) {
  if (P.tracks.some((t) => (t.pattern.steps || []).some(Boolean) || (t.pattern.notes || []).length)) {
    if (!(await confirm(`Usar la receta ${r.name}`, 'Se reemplazan las filas del beat actual por las de esta receta (puedes cambiar todo después).', 'Usar receta'))) return;
  }
  transport.stop();
  P.tracks.forEach((t) => transport.player && transport.player.mixer.remove(t.id));
  P.tracks = r.rows.map(([name, sound, s]) => newTrack('drum', { name, sound, role: /bombo|kick/i.test(name) ? 'kick' : /hat|ride/i.test(name) ? 'hat' : /palma|caja|clap|aro dembow/i.test(name) ? 'snare' : 'perc', steps: stepsFrom(s), vol: /bombo/i.test(name) ? 0.95 : 0.7 }));
  (r.synths || []).forEach(([name, preset, s, duck]) => P.tracks.push(newTrack('synth', { name, preset, role: SYNTHS[preset].fn === 'bass' ? 'bass' : 'lead', notes: notesFrom(s), vol: 0.75, fx: { duck, delay: preset === 'acid' ? 0.2 : 0, reso: preset === 'acid' ? 0.3 : 0.1 } })));
  P.bpm = r.bpm; P.recipe = r.id; P.genre = r.genre;
  if (P.tracks.length && TECHNO.has(r.genre)) P.tracks.forEach((t) => { if (t.role === 'bass') t.fx.duck = Math.max(t.fx.duck || 0, 0.6); });
  const all = Object.fromEntries(P.tracks.map((t) => [t.id, true]));
  P.scenes = TECHNO.has(r.genre) ? djScenes(P) : [newScene('Loop', 8, all)];
  save(); rerender();
  toast(`${r.name} · ${r.bpm} BPM ▶`);
}
// estructura DJ automática a partir de las filas
export function djScenes(P) {
  const ids = (pred) => Object.fromEntries(P.tracks.filter(pred).map((t) => [t.id, true]));
  const drums = (t) => ['kick', 'hat', 'perc'].includes(t.role);
  return [newScene('Intro', 16, ids(drums), 'fadein'), newScene('Groove', 16, ids((t) => drums(t) || t.role === 'bass')), newScene('Subida', 8, ids((t) => t.role !== 'kick'), 'build'),
    newScene('Drop', 32, ids(() => true), 'drop'), newScene('Break', 16, ids((t) => ['lead', 'pad', 'chords', 'perc'].includes(t.role)), 'break'), newScene('Subida 2', 8, ids((t) => t.role !== 'kick'), 'build'),
    newScene('Drop 2', 32, ids(() => true), 'drop'), newScene('Outro', 16, ids(drums), 'fadeout')];
}

function vary(t) {
  const len = t.pattern.len || 16; const s = (t.sound || '').replace('lib:', '');
  const kind = /kick/.test(s) ? 'kick' : /clap/.test(s) ? 'clap' : /snare/.test(s) ? 'snare' : /openhat|hatOpen/.test(s) ? 'hatOpen' : /hat/.test(s) ? 'hat' : /shaker|maracas/.test(s) ? 'shaker' : 'perc';
  return genDrum(kind, Math.random() * 1e9, len);
}

async function toggle(P) {
  if (transport.playing) { transport.stop(); return; }
  try { audio(); stopPreview(); await transport.play(loopView(P), { mode: 'scene', scene: 0 }); } catch (e) { toast('No pude reproducir: ' + e.message); }
}
function setBpm(P, v, save) { P.bpm = Math.max(60, Math.min(200, Math.round(v))); transport.setBpm(P.bpm); save(); const el = document.querySelector('#v-studio .bpm .v'); if (el) el.firstChild.textContent = String(P.bpm); }

async function auditionDrum(t, v) {
  const buf = t.sampleId ? await sampleBuffer(t.sampleId) : await soundBuffer(t.sound);
  if (buf) playPreview(buf, { rate: Math.pow(2, (t.pitch || 0) / 12), gain: v * (t.vol || 0.8) });
}
let aSynth = null;
async function auditionSynth(t, P) {
  const { Synth } = await import('../engine/synth.js');
  const c = audio(); const pr = SYNTHS[t.preset] || SYNTHS.lead;
  if (!aSynth) { const g = c.createGain(); g.gain.value = 0.9; g.connect(c.destination); aSynth = new Synth(c, { drums: g, music: g, bass: g, verb: c.createGain() }); }
  const midi = degToMidi(P, pr, t.rowNote || 0) + (t.pitch || 0); const tt = c.currentTime + 0.02;
  if (pr.fn === 'bass') aSynth._bass(pr.type, tt, midi, 0.25, 1); else aSynth._voice(pr.type, tt, midi, 0.25, 1);
}

async function exportBeat(P, kind) {
  transport.stop();
  const len = await sheet('¿Qué exporto?', { options: [
    { id: 'loop', label: '🔁 El loop (8 compases)', sub: 'Para practicar o rapear encima' },
    { id: 'song', label: '🎚️ Tema completo con estructura', primary: true, sub: TECHNO.has(P.genre) ? 'Intro, groove, subida, drop, break… (~4 min, ideal DJ)' : 'Usa las escenas del modo Avanzado' },
  ] });
  if (!len) return;
  busy('Mezclando…');
  try {
    let proj = P;
    if (len === 'loop') { const v = loopView(P); proj = { ...v, scenes: [{ id: 'x', name: 'Loop', fx: 'none', bars: 8, on: v.scenes[0].on }] }; }
    else if (!P.scenes.some((s) => s.bars >= 8 && Object.keys(s.on).length)) P.scenes = djScenes(P);
    const buf = await renderProject(proj, { onProgress: (p) => busyText(`Mezclando… ${Math.round(p * 100)}%`) });
    let blob;
    if (kind === 'mp3') { const y = new Date().getFullYear(); blob = await toMp3(buf, { title: P.name, artist: state.artist, album: `${state.artist} — DG Studio`, genre: (GENRES[P.genre] || {}).name || 'Beat', year: String(y), bpm: String(P.bpm), key: CAMELOT[P.mode][P.root], copyright: `℗ © ${y} ${state.artist}`, comment: 'Hecho en DG Studio' }, (p) => busyText(`Creando MP3… ${Math.round(p * 100)}%`)); }
    else blob = toWav(buf);
    busy(false);
    await shareOrSave(blob, `${safeName(state.artist)} - ${safeName(P.name)} (${P.bpm} BPM ${CAMELOT[P.mode][P.root]})${len === 'loop' ? ' loop' : ''}.${kind}`);
  } catch (e) { busy(false); throw e; }
  void projectSeconds;
}

async function sendBeat(P) {
  transport.stop();
  const what = await sheet('📤 Enviar a Multipista', { options: [{ id: 'song', label: '🎚️ Tema completo', primary: true, sub: 'Con intro, drops y final' }, { id: 'loop', label: '🔁 Loop de 8 compases' }] });
  if (!what) return;
  busy('Mezclando el beat…');
  let buf;
  try {
    let proj = P;
    if (what === 'loop') { const v = loopView(P); proj = { ...v, scenes: [{ id: 'x', name: 'Loop', fx: 'none', bars: 8, on: v.scenes[0].on }] }; }
    else if (!P.scenes.some((s) => s.bars >= 8 && Object.keys(s.on).length)) P.scenes = djScenes(P);
    buf = await renderProject(proj, { onProgress: (p) => busyText(`Mezclando el beat… ${Math.round(p * 100)}%`), tail: what === 'loop' ? 0 : 2 });
  } finally { busy(false); }
  await sendToMulti({ buffer: buf, name: P.name + (what === 'loop' ? ' (loop)' : ''), bpm: P.bpm });
}
