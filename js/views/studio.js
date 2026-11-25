// ===============================================================
//  ESTUDIO: pistas, escenas, secuenciador, piano roll, mezcla
// ===============================================================
import { $, h, toast, busy, busyText, action, sheet, confirm, prompt, slider, chips, uid, clamp } from '../core/ui.js';
import { put } from '../core/ui.js';
import { db } from '../core/db.js';
import { state, emit, on } from '../core/state.js';
import { audio, decode, pickFile, playPreview, stopPreview, shareOrSave, safeName, startRecorder } from '../core/audio.js';
import { GENRES, GENRE_KEYS, NOTE_ES, SCALES, degSemi } from '../engine/engine.js';
import { toMp3, toWav } from '../engine/export.js';
import { drumBank, Synth } from '../engine/synth.js';
import { SYNTHS, DRUM_LIST, SCENE_FX, CAMELOT, TECHNO, newTrack, newScene, makeProject, emptyProject, genAcid, genBass, genArp, genDrum, degToMidi, projectSeconds, keyLabel, touch } from '../studio/model.js';
import { transport, renderProject } from '../studio/sequencer.js';
import { addSample, listSamples, sampleBuffer } from '../studio/samples.js';
import { recordOverlay } from './shared.js';
import { renderGrid, loopView } from './beatgrid.js';
import { soundNameSync } from '../studio/library.js';

let P = null;               // proyecto abierto
let root = null;
const ui = { sel: null, scene: 0, etab: 'pattern', view: 'tracks', mode: 'scene', noteLen: 1, pos: null, easy: true };
let saveT = null;

// ---------------------------------------------------------------
//  Proyecto: cargar / guardar
// ---------------------------------------------------------------
export const currentProject = () => P;
export function saveSoon() { if (!P) return; touch(P); clearTimeout(saveT); saveT = setTimeout(() => db.put('projects', P).catch(() => toast('⚠️ No pude guardar (sin espacio)')), 350); }
export async function openProject(p, { silent = false } = {}) {
  transport.stop();
  P = p; ui.sel = p.tracks[0] ? p.tracks[0].id : null; ui.scene = 0;
  state.projectId = p.id; await db.kvSet('projectId', p.id); await db.put('projects', p);
  render();
  if (!silent) toast(`📂 ${p.name}`);
  emit('project', p);
}
export async function initStudio(el) {
  root = el;
  ui.easy = await db.kvGet('studioEasy', true);
  let p = state.projectId ? await db.get('projects', state.projectId) : null;
  if (!p) { const all = await db.all('projects'); p = all.sort((a, b) => b.updated - a.updated)[0] || null; }
  if (!p) p = makeProject('hardtechno', { name: 'Mi primer hard techno' });
  await openProject(p, { silent: true });
  transport.on(onTransport);
  on('tab', (t) => { if (t !== 'studio' && transport.playing) transport.stop(); });
}

// ---------------------------------------------------------------
//  Render principal
// ---------------------------------------------------------------
function render() {
  if (!root || !P) return;
  const scene = P.scenes[ui.scene] || P.scenes[0];
  root.innerHTML = '';
  if (ui.easy) {
    renderGrid(root, P, { save: saveSoon, rerender: render, openMenu: menu, goAdvanced: () => { transport.stop(); ui.easy = false; db.kvSet('studioEasy', false); render(); } });
    return;
  }
  put(root, 
    h('div.row', { style: { marginTop: '12px' } },
      h('div.grow', {},
        h('h2.vt', { style: { margin: '0' } }, P.name),
        h('div.muted.small', {}, `${GENRES[P.genre] ? GENRES[P.genre].emoji + ' ' + GENRES[P.genre].name + ' · ' : ''}${keyLabel(P, NOTE_ES)} · ${fmtDur(projectSeconds(P))}`)),
      h('button.btn.sm', { onclick: () => { transport.stop(); ui.easy = true; db.kvSet('studioEasy', true); render(); } }, '🟥 Fácil'),
      h('button.btn.sm', { onclick: action(menu) }, '⋯')),
    transportBar(),
    sceneStrip(),
    sceneTools(scene),
    h('div.row', { style: { marginTop: '10px' } },
      chips([{ id: 'tracks', label: '🎚️ Pistas' }, { id: 'arrange', label: '🧩 Arreglo' }], ui.view, (v) => { ui.view = v; render(); }),
      h('div.grow'),
      h('button.btn.sm.primary', { onclick: action(addTrackMenu) }, '＋ Pista')),
    ui.view === 'tracks' ? trackList(scene) : matrix(),
    P.guide ? guideCard() : null,
    ui.view === 'tracks' && sel() ? editor(sel()) : null,
  );
}
const fmtDur = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const sel = () => P.tracks.find((t) => t.id === ui.sel) || null;

// ---------- transporte ----------
function transportBar() {
  const playBtn = h('button.tplay#tPlay', { onclick: togglePlay, title: 'Reproducir / detener' }, transport.playing ? '■' : '▶');
  const bpmV = h('div.v', { onclick: action(editBpm) }, String(P.bpm), h('small', {}, 'BPM'));
  const bpm = h('div.bpm', {},
    h('button', { onclick: () => setBpm(P.bpm - 1) }, '−'), bpmV, h('button', { onclick: () => setBpm(P.bpm + 1) }, '+'));
  const lcd = h('div.lcd#tLcd', {}, '1.1', h('small', {}, (P.scenes[ui.scene] || {}).name || ''));
  const mode = h('button.btn.sm#tMode', { title: 'Repetir la escena o tocar el tema completo', onclick: () => { ui.mode = ui.mode === 'scene' ? 'song' : 'scene'; $('tMode').textContent = ui.mode === 'scene' ? '🔁 Escena' : '▶️ Tema'; if (transport.playing) startPlay(); } }, ui.mode === 'scene' ? '🔁 Escena' : '▶️ Tema');
  const vu = h('div.vu', {}, h('div#tVu'));
  return h('div.transport', {}, h('div.row', {}, playBtn, lcd, bpm, h('div.grow', {}, mode), vu));
}
function togglePlay() { if (transport.playing) transport.stop(); else startPlay(); }
async function startPlay() {
  try { audio(); stopPreview(); await transport.play(P, { mode: ui.mode, scene: ui.scene }); }
  catch (e) { console.error(e); toast('No pude reproducir: ' + e.message); }
}
function setBpm(v) {
  P.bpm = clamp(Math.round(v), 60, 200); transport.setBpm(P.bpm); saveSoon();
  const el = root.querySelector('.bpm .v'); if (el) el.firstChild.textContent = String(P.bpm);
}
async function editBpm() {
  const v = await prompt('Tempo (BPM)', String(P.bpm), '60–200');
  if (v && +v) setBpm(+v);
}
function onTransport(e) {
  if (!root || !root.isConnected) return;
  if ('playing' in e) { const b = $('tPlay'); if (b) b.textContent = e.playing ? '■' : '▶'; if (!e.playing) clearPlayhead(); }
  if (e.pos) {
    ui.pos = e.pos;
    const lcd = $('tLcd'); const sc = P.scenes[e.pos.scene];
    if (lcd && sc) lcd.innerHTML = `${Math.floor(e.pos.s / 16) + 1}.${Math.floor((e.pos.s % 16) / 4) + 1}<small>${sc.name}</small>`;
    const vu = $('tVu'); if (vu) vu.style.height = `${Math.min(100, e.level * 110)}%`;
    root.querySelectorAll('.scene[data-i]').forEach((x) => x.classList.toggle('playing', +x.dataset.i === e.pos.scene));
    drawPlayhead(e.pos);
    if (transport.player) {
      const buf = new Float32Array(256);
      root.querySelectorAll('[data-vu]').forEach((el) => {
        const ch = transport.player.mixer.ch.get(el.dataset.vu); if (!ch) { el.style.height = '0'; return; }
        ch.meter.getFloatTimeDomainData(buf); let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v));
        el.style.height = `${Math.min(100, m * 140)}%`;
      });
    }
  }
}
function clearPlayhead() { root.querySelectorAll('.ph').forEach((x) => x.classList.remove('ph')); }
function drawPlayhead(pos) {
  if (ui.easy) {
    clearPlayhead();
    const head = root.querySelectorAll('.bg-head .bg-cells > span'); if (head[pos.s % 16]) head[pos.s % 16].classList.add('ph');
    P.tracks.forEach((t, ti) => {
      const row = root.querySelectorAll('.bg-row:not(.bg-head)')[ti]; if (!row) return;
      const b = row.querySelector(`[data-step="${pos.s % (t.pattern.len || 16)}"]`); if (b) b.classList.add('ph');
    });
    return;
  }
  const t = sel(); if (!t) return;
  clearPlayhead();
  if (pos.scene !== ui.scene && ui.mode === 'scene') return;
  const i = pos.s % (t.pattern.len || 16);
  root.querySelectorAll(`[data-step="${i}"]`).forEach((x) => x.classList.add('ph'));
}

// ---------- escenas ----------
function sceneStrip() {
  const box = h('div.scenes');
  P.scenes.forEach((s, i) => box.append(h('button.scene' + (i === ui.scene ? '.on' : ''), { 'data-i': i, onclick: () => { ui.scene = i; if (transport.playing && ui.mode === 'scene') transport.setScene(i); render(); } },
    h('b', {}, s.name), h('span', {}, `${s.bars} comp.${s.fx !== 'none' ? ' · ' + ({ build: '⤴', drop: '💥', break: '〰', fadein: '◢', fadeout: '◣' }[s.fx] || '') : ''}`))));
  box.append(h('button.scene.add', { title: 'Nueva escena', onclick: action(addScene) }, '＋'));
  return box;
}
function sceneTools(scene) {
  if (!scene) return null;
  return h('div.row.wrap', { style: { marginTop: '6px', gap: '6px' } },
    h('button.btn.sm', { onclick: action(async () => { const v = await prompt('Nombre de la escena', scene.name); if (v) { scene.name = v; saveSoon(); render(); } }) }, '✎ ' + scene.name),
    h('button.btn.sm', { onclick: action(async () => {
      const id = await sheet('Duración de la escena', { grid: true, options: [1, 2, 4, 8, 16, 32, 64].map((b) => ({ id: String(b), label: `${b} compases` })) });
      if (id) { scene.bars = +id; saveSoon(); render(); }
    }) }, `⏱ ${scene.bars} comp.`),
    h('button.btn.sm', { onclick: action(async () => {
      const id = await sheet('Efecto de la escena', { options: Object.entries(SCENE_FX).map(([k, v]) => ({ id: k, label: v, sub: { build: 'Barrido + redoble + filtro que sube', drop: 'Platillo al empezar', break: 'Filtro cerrado (más suave)', fadein: 'Filtro que se abre', fadeout: 'Baja el volumen al final', none: '' }[k] })) });
      if (id) { scene.fx = id; saveSoon(); render(); }
    }) }, `✨ ${SCENE_FX[scene.fx] || 'Normal'}`),
    h('button.btn.sm', { onclick: action(async () => { const c = { ...JSON.parse(JSON.stringify(scene)), id: uid(), name: scene.name + ' 2' }; P.scenes.splice(ui.scene + 1, 0, c); ui.scene++; saveSoon(); render(); }) }, '⧉'),
    h('button.btn.sm', { onclick: action(async () => { if (ui.scene > 0) { const [s] = P.scenes.splice(ui.scene, 1); P.scenes.splice(ui.scene - 1, 0, s); ui.scene--; saveSoon(); render(); } }) }, '◀'),
    h('button.btn.sm', { onclick: action(async () => { if (ui.scene < P.scenes.length - 1) { const [s] = P.scenes.splice(ui.scene, 1); P.scenes.splice(ui.scene + 1, 0, s); ui.scene++; saveSoon(); render(); } }) }, '▶'),
    h('button.btn.sm.danger', { onclick: action(async () => {
      if (P.scenes.length < 2) { toast('Debe quedar al menos una escena'); return; }
      if (await confirm('¿Borrar escena?', `"${scene.name}" se eliminará.`, 'Borrar', true)) { P.scenes.splice(ui.scene, 1); ui.scene = Math.max(0, ui.scene - 1); saveSoon(); render(); }
    }) }, '🗑'),
  );
}
async function addScene() {
  const cur = P.scenes[ui.scene];
  const s = newScene(`Escena ${P.scenes.length + 1}`, cur ? cur.bars : 8, cur ? { ...cur.on } : {});
  P.scenes.splice(ui.scene + 1, 0, s); ui.scene++; saveSoon(); render();
}

// ---------- lista de pistas ----------
function trackList(scene) {
  const box = h('div.tracks');
  if (!P.tracks.length) box.append(h('div.card.muted', {}, 'Sin pistas todavía. Toca ＋ Pista o ve a 🔁 Loops.'));
  P.tracks.forEach((t) => {
    const inScene = !!(scene && scene.on[t.id]);
    const sub = t.kind === 'drum' ? (t.sampleId ? 'Sample' : soundNameSync(t.sound)) : t.kind === 'synth' ? (SYNTHS[t.preset] || {}).name : t.kind === 'audio' ? 'Audio' : 'Sample';
    const row = h('div.trk' + (t.id === ui.sel ? '.sel' : ''), {},
      h('div.clr', { style: { background: t.color } }),
      h('div.tn', { onclick: () => { ui.sel = t.id; render(); } }, h('b', {}, t.name), h('span', {}, sub + ` · ${t.pattern.len / 16} comp.`)),
      h('div.tb', {},
        h('div.mini-vu', {}, h('div', { 'data-vu': t.id })),
        h('button.tog.in' + (inScene ? '.on' : ''), { title: 'Suena en esta escena', onclick: () => { scene.on[t.id] = !scene.on[t.id]; if (!scene.on[t.id]) delete scene.on[t.id]; saveSoon(); render(); } }, inScene ? '●' : '○'),
        h('button.tog.m' + (t.mute ? '.on' : ''), { title: 'Silenciar', onclick: () => { t.mute = !t.mute; transport.update(t); saveSoon(); render(); } }, 'M'),
        h('button.tog.s' + (t.solo ? '.on' : ''), { title: 'Solo', onclick: () => { t.solo = !t.solo; transport.update(t); saveSoon(); render(); } }, 'S')));
    box.append(row);
  });
  return box;
}

// ---------- vista de arreglo (matriz pistas × escenas) ----------
function matrix() {
  const tb = h('table');
  tb.append(h('tr', {}, h('th'), ...P.scenes.map((s, i) => h('th', { style: { color: i === ui.scene ? 'var(--red2)' : '' } }, `${s.name}`, h('br'), `${s.bars}`))));
  P.tracks.forEach((t) => tb.append(h('tr', {},
    h('td.name', { style: { borderLeft: `4px solid ${t.color}`, paddingLeft: '6px' } }, t.name),
    ...P.scenes.map((s) => h('td.cell', {}, h('button' + (s.on[t.id] ? '.on' : ''), { onclick: (e) => { s.on[t.id] = !s.on[t.id]; if (!s.on[t.id]) delete s.on[t.id]; e.currentTarget.classList.toggle('on'); saveSoon(); } }))))));
  return h('div.card', {}, h('h3', {}, '🧩 Arreglo', h('small', {}, `Total ${fmtDur(projectSeconds(P))}`)),
    h('p.muted.small', { style: { margin: '0 0 8px' } }, 'Cada columna es una sección del tema. Enciende qué pistas suenan en cada una. Para DJ: intro y outro solo con batería.'),
    h('div.matrix', {}, tb));
}

// ---------------------------------------------------------------
//  Editor de pista
// ---------------------------------------------------------------
function editor(t) {
  const tabs = h('div.etabs', {}, ...[['pattern', t.kind === 'synth' ? '🎹 Notas' : t.kind === 'audio' ? '🎙️ Clip' : '🥁 Pasos'], ['sound', '🔊 Sonido'], ['mix', '🎚️ Mezcla']].map(([id, l]) =>
    h('button' + (ui.etab === id ? '.on' : ''), { onclick: () => { ui.etab = id; render(); } }, l)));
  let body;
  if (ui.etab === 'pattern') body = t.kind === 'synth' ? pianoRoll(t) : t.kind === 'audio' || (t.kind === 'sample' && t.mode === 'loop') ? clipInfo(t) : stepGrid(t);
  else if (ui.etab === 'sound') body = soundPanel(t);
  else body = mixPanel(t);
  return h('div.card.editor', { style: { borderLeft: `4px solid ${t.color}` } },
    h('h3', {}, t.name, h('small', {}, t.kind === 'drum' ? 'Batería' : t.kind === 'synth' ? 'Sintetizador' : t.kind === 'audio' ? 'Audio' : 'Sample')),
    tabs, body);
}

function lenChips(t) {
  return chips([16, 32, 64].map((l) => ({ id: l, label: `${l / 16} comp.` })), t.pattern.len, (l) => {
    const old = t.pattern.len; t.pattern.len = l;
    if (t.pattern.steps) { const s = t.pattern.steps; for (let i = old; i < l; i++) s[i] = s[i % old] || 0; s.length = l; }
    if (l > old && t.pattern.notes) { const copy = []; for (let k = old; k < l; k += old) t.pattern.notes.filter((n) => n.s < old).forEach((n) => copy.push({ ...n, s: n.s + k })); t.pattern.notes.push(...copy.filter((n) => n.s < l)); }
    if (t.pattern.notes) t.pattern.notes = t.pattern.notes.filter((n) => n.s < l);
    saveSoon(); render();
  });
}

function stepGrid(t) {
  const steps = t.pattern.steps; const grid = h('div.steps');
  for (let i = 0; i < t.pattern.len; i++) {
    const v = steps[i] || 0;
    const b = h('button' + (v >= 0.9 ? '.v1' : v > 0 ? '.v2' : '') + (Math.floor(i / 4) % 2 ? '.b4' : ''), { 'data-step': i, title: `Paso ${i + 1}` });
    b.onclick = () => {
      const nv = !steps[i] ? 1 : steps[i] >= 0.9 ? 0.55 : 0; steps[i] = nv;
      b.className = (nv >= 0.9 ? 'v1' : nv > 0 ? 'v2' : '') + (Math.floor(i / 4) % 2 ? ' b4' : '');
      if (nv && !transport.playing) auditionTrack(t, nv);
      saveSoon();
    };
    grid.append(b);
  }
  return h('div', {},
    h('div.row', { style: { marginBottom: '8px' } }, lenChips(t)),
    grid,
    h('p.muted.small', {}, 'Toca: fuerte → suave → apagado.'),
    h('div.row.wrap', { style: { gap: '6px' } },
      h('button.btn.sm', { onclick: () => { t.pattern.steps = genDrum(t.sound, Math.random() * 1e9, t.pattern.len); saveSoon(); render(); } }, '🎲 Variar'),
      h('button.btn.sm', { onclick: () => { const s = t.pattern.steps; s.unshift(s.pop()); saveSoon(); render(); } }, '⇢ Mover'),
      h('button.btn.sm', { onclick: () => { const s = t.pattern.steps; s.push(s.shift()); saveSoon(); render(); } }, '⇠ Mover'),
      h('button.btn.sm', { onclick: () => { t.pattern.steps = t.pattern.steps.map((v) => (v ? 0 : 0)); saveSoon(); render(); } }, '🧹 Limpiar')));
}

function pianoRoll(t) {
  const pr = SYNTHS[t.preset] || SYNTHS.lead; const sc = SCALES[P.mode];
  const rows = []; for (let d = 12; d >= -5; d--) rows.push(d);
  const tb = h('table');
  const cover = new Map(); // "d|s" -> note
  t.pattern.notes.forEach((n) => { for (let k = 0; k < n.len; k++) cover.set(`${n.d}|${n.s + k}`, n); });
  rows.forEach((d) => {
    const midi = degToMidi(P, pr, d); const nm = NOTE_ES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
    const tr = h('tr', {}, h('td.lbl', {}, nm));
    for (let s = 0; s < t.pattern.len; s++) {
      const n = cover.get(`${d}|${s}`);
      const cls = (n ? (n.s === s ? '.n' : '.nc') : '') + (((d % 7) + 7) % 7 === 0 ? '.root' : '') + (s % 4 === 0 ? '.beat' : '');
      const td = h('td' + cls, { 'data-step': s });
      td.onclick = () => {
        const hit = cover.get(`${d}|${s}`);
        if (hit) t.pattern.notes = t.pattern.notes.filter((x) => x !== hit);
        else {
          const len = Math.min(ui.noteLen, t.pattern.len - s);
          t.pattern.notes = t.pattern.notes.filter((x) => !(x.d === d && x.s < s + len && x.s + x.len > s));
          t.pattern.notes.push({ s, d, len, vel: 1 });
          if (!transport.playing) auditionNote(t, d, len);
        }
        saveSoon(); render();
      };
      tr.append(td);
    }
    tb.append(tr);
  });
  const shift = (k) => { t.pattern.notes.forEach((n) => (n.d += k)); saveSoon(); render(); };
  void sc;
  return h('div', {},
    h('div.row.wrap', { style: { marginBottom: '8px', gap: '6px' } }, lenChips(t)),
    h('div.row', { style: { marginBottom: '6px' } }, h('span.muted.small', {}, 'Largo de nota:'),
      chips([1, 2, 4, 8, 16].map((l) => ({ id: l, label: `${l}` })), ui.noteLen, (l) => (ui.noteLen = l))),
    h('div.roll', {}, tb),
    h('p.muted.small', {}, `Solo notas de la escala ${NOTE_ES[P.root]} ${P.mode === 'minor' ? 'menor' : 'mayor'}: siempre suena bien. Toca para poner o quitar.`),
    h('div.row.wrap', { style: { gap: '6px' } },
      h('button.btn.sm', { onclick: () => { t.pattern.notes = genAcid(Math.random() * 1e9, t.pattern.len); saveSoon(); render(); } }, '🎲 Línea acid'),
      h('button.btn.sm', { onclick: action(async () => {
        const st = await sheet('Estilo de bajo', { options: [{ id: 'offbeat', label: 'A contratiempo (techno)' }, { id: 'rolling', label: 'Rodante (hard techno)' }, { id: 'gallop', label: 'Galope' }, { id: 'random', label: 'Libre' }] });
        if (st) { t.pattern.notes = genBass(Math.random() * 1e9, t.pattern.len, st); saveSoon(); render(); }
      }) }, '🎲 Bajo'),
      h('button.btn.sm', { onclick: () => { t.pattern.notes = genArp(Math.random() * 1e9, t.pattern.len); saveSoon(); render(); } }, '🎲 Arpegio'),
      h('button.btn.sm', { onclick: () => shift(7) }, '⬆ Octava'),
      h('button.btn.sm', { onclick: () => shift(-7) }, '⬇ Octava'),
      h('button.btn.sm', { onclick: () => { t.pattern.notes = []; saveSoon(); render(); } }, '🧹 Limpiar')));
}

function clipInfo(t) {
  return h('div', {},
    h('p.muted', {}, t.kind === 'audio' ? 'Este clip suena desde el inicio de cada escena donde esté encendido (●).' : `Loop de ${t.loopBars} compás(es), se repite en cada escena encendida.`),
    t.kind === 'sample' ? h('div', {}, slider('Compases', t.loopBars, { min: 1, max: 16, step: 1, fmt: (v) => String(v), onchange: (v) => { t.loopBars = v; saveSoon(); } }),
      slider('BPM original', t.sampleBpm || P.bpm, { min: 60, max: 200, step: 1, fmt: (v) => String(v), onchange: (v) => { t.sampleBpm = v; saveSoon(); } })) : null,
    h('button.btn.sm', { onclick: action(async () => { const b = await sampleBuffer(t.sampleId); if (b) playPreview(b); }) }, '▶ Escuchar original'));
}

// ---------- sonido ----------
function soundPanel(t) {
  const box = h('div');
  if (t.kind === 'drum') {
    box.append(h('div.muted.small', {}, 'Sonido de batería'),
      chips(DRUM_LIST.map((d) => ({ id: d.id, label: d.name })), t.sampleId ? null : t.sound, (id) => { t.sound = id; t.sampleId = null; saveSoon(); auditionTrack(t, 1); }, '.wrap'),
      h('div.row', { style: { marginTop: '8px' } }, h('button.btn.sm', { onclick: action(() => chooseSampleFor(t)) }, t.sampleId ? '🎵 Cambiar sonido propio' : '🎵 Usar un sonido propio')));
  } else if (t.kind === 'synth') {
    box.append(h('div.muted.small', {}, 'Instrumento'),
      chips(Object.entries(SYNTHS).map(([id, s]) => ({ id, label: s.name })), t.preset, (id) => { t.preset = id; saveSoon(); auditionNote(t, 0, 2); render(); }, '.wrap'));
  } else if (t.kind === 'sample') {
    box.append(chips([{ id: 'hits', label: 'Golpes (por pasos)' }, { id: 'loop', label: 'Loop' }], t.mode, (m) => { t.mode = m; saveSoon(); render(); }));
  }
  box.append(slider('Afinación', t.pitch || 0, { min: -24, max: 24, step: 1, fmt: (v) => `${v > 0 ? '+' : ''}${v} st`, oninput: (v) => { t.pitch = v; saveSoon(); } }),
    h('button.btn.sm', { style: { marginTop: '6px' }, onclick: () => (t.kind === 'synth' ? auditionNote(t, 0, 2) : auditionTrack(t, 1)) }, '▶ Probar sonido'));
  return box;
}
async function chooseSampleFor(t) {
  const lib = await listSamples();
  const id = await sheet('Sonido propio', { options: [{ id: '__up', label: '📁 Subir archivo', sub: 'Audio de tu teléfono o PC' }, { id: '__rec', label: '🎙️ Grabar ahora', sub: 'Golpes, voz, lo que quieras' }, ...lib.map((s) => ({ id: s.id, label: s.name, sub: `${s.dur.toFixed(1)} s${s.bpm ? ' · ' + s.bpm + ' BPM' : ''}` }))] });
  if (!id) return;
  let rec;
  if (id === '__up') { const f = await pickFile(); if (!f) return; busy('Guardando sonido…'); try { rec = await addSample({ name: f.name.replace(/\.[^.]+$/, ''), blob: f, kind: 'oneshot' }); } finally { busy(false); } }
  else if (id === '__rec') { const r = await recordOverlay('Graba tu sonido…'); if (!r) return; rec = await addSample({ name: 'Grabación ' + new Date().toLocaleTimeString(), blob: r.blob, kind: 'oneshot' }); }
  else rec = lib.find((s) => s.id === id);
  if (rec) { t.sampleId = rec.id; t.name = rec.name.slice(0, 24); saveSoon(); render(); auditionTrack(t, 1); }
}

// ---------- mezcla ----------
function mixPanel(t) {
  const u = () => { transport.update(t); saveSoon(); };
  const f = t.fx;
  return h('div', {},
    slider('Volumen', t.vol, { min: 0, max: 1.2, oninput: (v) => { t.vol = v; u(); } }),
    slider('Paneo', t.pan || 0, { min: -1, max: 1, fmt: (v) => (Math.abs(v) < 0.05 ? 'C' : v < 0 ? `I${Math.round(-v * 100)}` : `D${Math.round(v * 100)}`), oninput: (v) => { t.pan = v; u(); } }),
    slider('Filtro (LP)', f.cutoff ?? 1, { oninput: (v) => { f.cutoff = v; u(); } }),
    slider('Quitar graves', f.hp || 0, { oninput: (v) => { f.hp = v; u(); } }),
    slider('Resonancia', f.reso || 0, { oninput: (v) => { f.reso = v; u(); } }),
    slider('Saturación', f.drive || 0, { oninput: (v) => { f.drive = v; u(); } }),
    slider('Reverb', f.reverb || 0, { oninput: (v) => { f.reverb = v; u(); } }),
    slider('Delay', f.delay || 0, { oninput: (v) => { f.delay = v; u(); } }),
    slider('Sidechain', f.duck || 0, { oninput: (v) => { f.duck = v; u(); } }),
    h('p.muted.small', {}, 'Sidechain: baja esta pista cada vez que suena el bombo (el "bombeo" del techno).'),
    h('div.row.wrap', { style: { gap: '6px', marginTop: '6px' } },
      h('button.btn.sm', { onclick: action(async () => { const v = await prompt('Nombre de la pista', t.name); if (v) { t.name = v; saveSoon(); render(); } }) }, '✎ Renombrar'),
      h('button.btn.sm', { onclick: () => { const c = JSON.parse(JSON.stringify(t)); c.id = uid(); c.name += ' 2'; P.tracks.splice(P.tracks.indexOf(t) + 1, 0, c); P.scenes.forEach((s) => { if (s.on[t.id]) s.on[c.id] = true; }); ui.sel = c.id; saveSoon(); render(); } }, '⧉ Duplicar'),
      h('button.btn.sm', { onclick: () => { const i = P.tracks.indexOf(t); if (i > 0) { P.tracks.splice(i, 1); P.tracks.splice(i - 1, 0, t); saveSoon(); render(); } } }, '⬆'),
      h('button.btn.sm', { onclick: () => { const i = P.tracks.indexOf(t); if (i < P.tracks.length - 1) { P.tracks.splice(i, 1); P.tracks.splice(i + 1, 0, t); saveSoon(); render(); } } }, '⬇'),
      h('button.btn.sm.danger', { onclick: action(async () => {
        if (!(await confirm('¿Borrar pista?', `"${t.name}" se eliminará del proyecto.`, 'Borrar', true))) return;
        P.tracks = P.tracks.filter((x) => x !== t); P.scenes.forEach((s) => delete s.on[t.id]);
        if (transport.player) transport.player.mixer.remove(t.id);
        ui.sel = P.tracks[0] ? P.tracks[0].id : null; saveSoon(); render();
      }) }, '🗑 Borrar')));
}

// ---------- escuchar un golpe / nota sin reproducir el tema ----------
let audCtxSynth = null;
async function auditionTrack(t, v) {
  const c = audio(); const bank = await drumBank();
  const buf = t.sampleId ? await sampleBuffer(t.sampleId) : bank[t.sound];
  if (buf) playPreview(buf, { rate: Math.pow(2, (t.pitch || 0) / 12), gain: v * (t.vol || 0.8) });
  void c;
}
function auditionNote(t, d, len) {
  const c = audio(); const pr = SYNTHS[t.preset] || SYNTHS.lead;
  if (!audCtxSynth) { const g = c.createGain(); g.gain.value = 0.9; g.connect(c.destination); audCtxSynth = new Synth(c, { drums: g, music: g, bass: g, verb: c.createGain() }); }
  const midi = degToMidi(P, pr, d) + (t.pitch || 0); const dur = (60 / P.bpm / 4) * len; const tt = c.currentTime + 0.02;
  if (pr.fn === 'bass') audCtxSynth._bass(pr.type, tt, midi, dur, 1); else audCtxSynth._voice(pr.type, tt, midi, dur, 1);
}

// ---------------------------------------------------------------
//  Agregar pistas
// ---------------------------------------------------------------
async function addTrackMenu() {
  const id = await sheet('Nueva pista', { options: [
    { id: 'drum', label: '🥁 Batería', sub: 'Bombo, clap, hats, percusión… por pasos' },
    { id: 'synth', label: '🎹 Sintetizador', sub: 'Acid, rumble, bajos, stabs, pads, leads' },
    { id: 'sample', label: '🎵 Sonido propio', sub: 'Sube o elige un sample / loop tuyo' },
    { id: 'rec', label: '🎙️ Grabar voz o sonido', sub: 'Se guarda como pista de audio' },
    { id: 'loops', label: '🔁 Desde la biblioteca de loops', sub: 'Kits techno listos para usar' },
  ] });
  if (!id) return;
  if (id === 'loops') { emit('goto', 'loops'); return; }
  let t;
  if (id === 'drum') {
    const s = await sheet('Elige el sonido', { grid: true, options: DRUM_LIST.map((d) => ({ id: d.id, label: d.name })) }); if (!s) return;
    t = newTrack('drum', { name: DRUM_LIST.find((d) => d.id === s).name, sound: s, role: /kick/.test(s) ? 'kick' : /hat|ride/.test(s) ? 'hat' : /clap|snare|rim/.test(s) ? 'snare' : 'perc', steps: genDrum(s, Math.random() * 1e9, 16) });
  } else if (id === 'synth') {
    const s = await sheet('Elige el instrumento', { grid: true, options: Object.entries(SYNTHS).map(([k, v]) => ({ id: k, label: v.name })) }); if (!s) return;
    const pr = SYNTHS[s];
    t = newTrack('synth', { name: pr.name, preset: s, role: pr.fn === 'bass' ? 'bass' : s === 'pad' || s === 'strings' ? 'pad' : 'lead', notes: s === 'acid' ? genAcid(Math.random() * 1e9) : pr.fn === 'bass' ? genBass(Math.random() * 1e9, 16, 'offbeat') : genArp(Math.random() * 1e9), fx: { duck: pr.fn === 'bass' ? 0.6 : 0.3 } });
  } else if (id === 'sample') {
    t = newTrack('drum', { name: 'Sonido propio', role: 'perc', steps: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] });
    await chooseSampleFor(t); if (!t.sampleId) return;
    const rec = (await listSamples()).find((s) => s.id === t.sampleId);
    if (rec && rec.dur > 1.2) { t.kind = 'sample'; t.mode = 'loop'; t.sampleBpm = rec.bpm || P.bpm; t.loopBars = rec.bars || 1; }
  } else if (id === 'rec') {
    const r = await recordOverlay('Graba tu voz o sonido…'); if (!r) return;
    const rec = await addSample({ name: 'Voz ' + new Date().toLocaleTimeString(), blob: r.blob, kind: 'audio' });
    t = newTrack('audio', { name: rec.name, role: 'vox', sampleId: rec.id, fx: { reverb: 0.15 } });
  }
  addTrack(t);
}
export function addTrack(t, { allScenes = true } = {}) {
  if (!P) return;
  P.tracks.push(t);
  P.scenes.forEach((s, i) => { if (allScenes ? s.fx !== 'break' || t.role !== 'kick' : i === ui.scene) s.on[t.id] = true; });
  ui.sel = t.id; ui.etab = 'pattern'; ui.view = 'tracks';
  saveSoon(); render();
  toast(`＋ ${t.name}`);
}

// ---------------------------------------------------------------
//  Menú del proyecto
// ---------------------------------------------------------------
async function menu() {
  const id = await sheet(P.name, { options: [
    { id: 'new', label: '✨ Nuevo desde un estilo', sub: 'Plantilla con kit, bajo, melodía y estructura DJ' },
    { id: 'open', label: '📂 Mis proyectos', sub: 'Abrir, duplicar o borrar' },
    { id: 'mp3', label: '⬇️ Exportar tema en MP3', primary: true, sub: 'Con tu nombre y licencia en las etiquetas' },
    { id: 'wav', label: '💿 Exportar WAV (calidad DJ)', sub: 'Sin compresión, para tu USB o Rekordbox' },
    { id: 'loop', label: '🔁 Exportar escena actual como loop', sub: 'WAV de la escena seleccionada' },
    { id: 'key', label: `🎼 Tonalidad: ${keyLabel(P, NOTE_ES)}`, sub: 'Todas las notas se transponen solas' },
    { id: 'swing', label: `🎚️ Swing: ${Math.round((P.swing || 0) * 100)}%`, sub: 'Groove más suelto' },
    { id: 'guide', label: P.guide ? '✅ Ocultar guía DJ' : '🧭 Guía: track techno para DJ', sub: 'Paso a paso con tu proyecto' },
    { id: 'rename', label: '✎ Renombrar proyecto' },
    { id: 'dup', label: '⧉ Duplicar proyecto' },
  ] });
  if (!id) return;
  if (id === 'new') await newFromStyle();
  else if (id === 'open') await openMenu();
  else if (id === 'mp3' || id === 'wav') await exportSong(id);
  else if (id === 'loop') await exportScene();
  else if (id === 'key') await keyMenu();
  else if (id === 'swing') { const s = await sheet('Swing', { options: [0, 0.05, 0.1, 0.15, 0.2, 0.3].map((v) => ({ id: String(v), label: `${Math.round(v * 100)}%` })) }); if (s != null) { P.swing = +s; saveSoon(); render(); } }
  else if (id === 'guide') { P.guide = !P.guide; saveSoon(); render(); }
  else if (id === 'rename') { const v = await prompt('Nombre del proyecto', P.name); if (v) { P.name = v; saveSoon(); render(); } }
  else if (id === 'dup') { const c = JSON.parse(JSON.stringify(P)); c.id = uid(); c.name += ' (copia)'; c.created = Date.now(); await openProject(c); }
}
export async function newFromStyle(preset = null, opts = {}) {
  let g = preset;
  if (!g) {
    const order = ['hardtechno', 'technolatino', 'techno', 'acidtechno', 'industrial', 'hardgroove', 'rave', 'melodictechno', ...GENRE_KEYS.filter((k) => !TECHNO.has(k)), 'house', 'edm'];
    g = await sheet('Nuevo proyecto', { grid: true, options: [...new Set(order)].filter((k) => GENRES[k]).map((k) => ({ id: k, label: `${GENRES[k].emoji} ${GENRES[k].name}`, sub: `${GENRES[k].bpm[0]}–${GENRES[k].bpm[1]} BPM` })) });
    if (!g) return;
  }
  const p = makeProject(g, opts);
  await openProject(p);
  return p;
}
async function openMenu() {
  const all = (await db.all('projects')).sort((a, b) => b.updated - a.updated);
  const id = await sheet('Mis proyectos', { options: all.map((p) => ({ id: p.id, label: (p.id === P.id ? '● ' : '') + p.name, sub: `${p.bpm} BPM · ${p.tracks.length} pistas · ${new Date(p.updated).toLocaleDateString()}` })) });
  if (!id) return;
  const p = all.find((x) => x.id === id);
  const act = await sheet(p.name, { options: [{ id: 'open', label: '📂 Abrir', primary: true }, { id: 'del', label: '🗑 Borrar', danger: true }] });
  if (act === 'open') await openProject(p);
  else if (act === 'del') {
    if (!(await confirm('¿Borrar proyecto?', `"${p.name}" se eliminará de este dispositivo. No se puede deshacer.`, 'Borrar', true))) return;
    await db.del('projects', p.id);
    if (p.id === P.id) { const rest = all.filter((x) => x.id !== p.id); await openProject(rest[0] || emptyProject()); }
    toast('Proyecto borrado');
  }
}
async function keyMenu() {
  const r = await sheet('Tonalidad (nota base)', { grid: true, options: NOTE_ES.map((n, i) => ({ id: String(i), label: `${n}`, sub: `${CAMELOT.minor[i]} menor · ${CAMELOT.major[i]} mayor` })) });
  if (r == null) return;
  const m = await sheet('¿Menor o mayor?', { options: [{ id: 'minor', label: 'Menor (oscuro, techno)' }, { id: 'major', label: 'Mayor (alegre)' }] });
  if (!m) return;
  P.root = +r; P.mode = m; saveSoon(); render();
}
function tagsFor(buf) {
  const y = new Date().getFullYear(); const EN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return { title: P.name, artist: state.artist, album: `${state.artist} — DG Studio`, genre: GENRES[P.genre] ? GENRES[P.genre].name : 'Electrónica', year: String(y), bpm: String(P.bpm),
    key: `${EN[P.root]}${P.mode === 'minor' ? 'm' : ''} (${CAMELOT[P.mode][P.root]})`, copyright: `℗ © ${y} ${state.artist}. Todos los derechos reservados.`, comment: `Producido por ${state.artist} en DG Studio. ${buf.duration.toFixed(0)} s.` };
}
async function exportSong(kind) {
  transport.stop();
  busy('Mezclando el tema…');
  try {
    const buf = await renderProject(P, { onProgress: (p) => busyText(`Mezclando el tema… ${Math.round(p * 100)}%`) });
    let blob;
    if (kind === 'mp3') { busyText('Creando MP3…'); blob = await toMp3(buf, tagsFor(buf), (p) => busyText(`Creando MP3… ${Math.round(p * 100)}%`)); }
    else blob = toWav(buf);
    busy(false);
    P.exported = true; saveSoon();
    await shareOrSave(blob, `${safeName(state.artist)} - ${safeName(P.name)} (${P.bpm} BPM ${CAMELOT[P.mode][P.root]}).${kind}`);
  } catch (e) { busy(false); throw e; }
}
async function exportScene() {
  transport.stop(); const sc = P.scenes[ui.scene];
  busy('Exportando loop…');
  try {
    const buf = await renderProject(P, { sceneIdx: ui.scene, tail: 0 });
    busy(false);
    await shareOrSave(toWav(buf), `${safeName(P.name)} - ${safeName(sc.name)} loop ${P.bpm}BPM.wav`);
  } catch (e) { busy(false); throw e; }
}

// ---------------------------------------------------------------
//  Guía: track techno para DJ
// ---------------------------------------------------------------
function guideCard() {
  const roles = (r) => P.tracks.filter((t) => r.includes(t.role)).length;
  const first = P.scenes[0], last = P.scenes[P.scenes.length - 1];
  const kickOnly = (s) => s && s.bars >= 16 && P.tracks.filter((t) => s.on[t.id]).every((t) => ['kick', 'hat', 'perc', 'snare'].includes(t.role));
  const steps = [
    ['Tempo de techno: 130–160 BPM', P.bpm >= 128 && P.bpm <= 165],
    ['Bombo + rumble/bajo con sidechain', roles(['kick']) > 0 && P.tracks.some((t) => t.role === 'bass' && (t.fx.duck || 0) > 0.3)],
    ['Groove: al menos 2 pistas de hats/percusión', roles(['hat', 'perc']) >= 2],
    ['Elemento principal: acid, stab o lead', roles(['lead', 'chords']) > 0],
    ['Intro de 16+ compases solo con batería (para mezclar)', kickOnly(first)],
    ['Outro de 16+ compases solo con batería', kickOnly(last)],
    ['Una subida (build) y un drop', P.scenes.some((s) => s.fx === 'build') && P.scenes.some((s) => s.fx === 'drop')],
    ['Exporta en WAV para tu USB', !!P.exported],
  ];
  const done = steps.filter((s) => s[1]).length;
  return h('div.card.guide', {},
    h('h3', {}, '🧭 Guía: track techno para DJ', h('small', {}, `${done}/${steps.length}`)),
    h('ol', {}, ...steps.map(([t, ok]) => h('li' + (ok ? '.done' : ''), {}, t))),
    h('p.muted.small', {}, 'Consejo: los DJ mezclan en bloques de 16/32 compases. Mantén la intro y el outro simples y sin melodía para empalmar con otro tema.'));
}
export const refreshStudio = () => render();
