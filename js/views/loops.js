// ===============================================================
//  LOOPS: biblioteca lista + tus sonidos + recrear una canción
// ===============================================================
import { h, toast, busy, busyText, action, sheet, confirm, prompt, chips } from '../core/ui.js';
import { put } from '../core/ui.js';
import { emit, on } from '../core/state.js';
import { audio, pickFile, playPreview, stopPreview, decode } from '../core/audio.js';
import { GENRES, NOTE_ES } from '../engine/engine.js';
import { analyzeSong, quickTempo } from '../engine/analyze.js';
import { LOOPS, LOOP_CATS } from '../studio/loops.js';
import { newTrack, newScene, emptyProject, CAMELOT, TECHNO } from '../studio/model.js';
import { transport } from '../studio/sequencer.js';
import { addSample, listSamples, deleteSample, sampleBuffer, updateSample } from '../studio/samples.js';
import { currentProject, addTrack, newFromStyle } from './studio.js';
import { recordOverlay } from './shared.js';

let root = null;
const ui = { cat: 'kick', playing: null };

export function initLoops(el) {
  root = el; render();
  on('tab', (t) => { if (t === 'loops') render(); else stopAll(); });
  transport.on((e) => { if (e.playing === false && ui.playing && ui.playing !== '__own') { ui.playing = null; markPlaying(); } });
}
function stopAll() { if (ui.playing) { transport.stop(); stopPreview(); ui.playing = null; markPlaying(); } }

function render() {
  if (!root) return;
  const P = currentProject();
  root.innerHTML = '';
  put(root, 
    h('h2.vt', {}, '🔁 Loops'),
    h('p.vs', {}, P ? `Suenan a ${P.bpm} BPM en ${NOTE_ES[P.root]} ${P.mode === 'minor' ? 'menor' : 'mayor'} (tu proyecto "${P.name}"). Toca ＋ para sumarlos.` : 'Abre un proyecto en el Estudio.'),
    recreateCard(),
    h('div.card', {},
      h('h3', {}, '📚 Biblioteca'),
      chips(LOOP_CATS.map((c) => ({ id: c.id, label: `${c.emoji} ${c.name}` })), ui.cat, (c) => { ui.cat = c; stopAll(); renderList(); }),
      h('div#loopList')),
    ownCard(),
  );
  renderList(); renderOwn();
}

function renderList() {
  const box = root.querySelector('#loopList'); if (!box) return; box.innerHTML = '';
  LOOPS.filter((l) => l.cat === ui.cat).forEach((l) => {
    const pb = h('button.lp', { 'data-loop': l.id, onclick: () => togglePreview(l) }, ui.playing === l.id ? '■' : '▶');
    box.append(h('div.loop', {}, pb,
      h('div.ln', {}, h('b', {}, l.name), h('span', {}, l.tags.join(' · '))),
      h('button.btn.sm.primary', { onclick: () => add(l) }, '＋')));
  });
}
function markPlaying() {
  if (!root) return;
  root.querySelectorAll('[data-loop]').forEach((b) => { const on = b.dataset.loop === ui.playing; b.textContent = on ? '■' : '▶'; b.classList.toggle('on', on); });
}
async function togglePreview(l) {
  if (ui.playing === l.id) { stopAll(); return; }
  stopAll();
  const P = currentProject() || emptyProject();
  const tmp = { ...emptyProject('preview'), bpm: P.bpm, root: P.root, mode: P.mode, swing: P.swing };
  const t = l.make(); tmp.tracks = [t];
  // contexto: un bombo suave debajo (si el loop no es de batería grave)
  if (!['kick', 'fx'].includes(l.cat)) tmp.tracks.push(newTrack('drum', { name: 'ref', sound: 'kick', role: 'kick', steps: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], vol: 0.45 }));
  tmp.scenes = [newScene('prev', Math.max(2, t.pattern.len / 16), Object.fromEntries(tmp.tracks.map((x) => [x.id, true])))];
  ui.playing = l.id; markPlaying();
  try { audio(); await transport.play(tmp, { mode: 'scene', scene: 0 }); } catch (e) { ui.playing = null; markPlaying(); toast(e.message); }
}
function add(l) {
  stopAll();
  if (!currentProject()) { toast('Abre un proyecto en el Estudio primero'); return; }
  addTrack(l.make());
}

// ---------- tus sonidos ----------
function ownCard() {
  return h('div.card', {},
    h('h3', {}, '🎵 Tus sonidos y loops', h('small', {}, 'guardados en este dispositivo')),
    h('div.grid2', {},
      h('button.btn', { onclick: action(uploadOwn) }, '📁 Subir audio'),
      h('button.btn', { onclick: action(recordOwn) }, '🎙️ Grabar')),
    h('div#ownList'));
}
async function renderOwn() {
  const box = root && root.querySelector('#ownList'); if (!box) return;
  const list = await listSamples(); box.innerHTML = '';
  if (!list.length) { box.append(h('p.muted.small', {}, 'Aún no tienes sonidos. Sube loops, golpes o grabaciones: se guardan aquí para usarlos en tus tracks.')); return; }
  list.forEach((s) => {
    const pb = h('button.lp', { 'data-own': s.id }, '▶');
    pb.onclick = async () => {
      if (pb.classList.contains('on')) { stopPreview(); return; }
      stopAll(); const b = await sampleBuffer(s.id); if (!b) { toast('No pude leer ese sonido'); return; }
      root.querySelectorAll('[data-own]').forEach((x) => { x.classList.remove('on'); x.textContent = '▶'; });
      pb.classList.add('on'); pb.textContent = '■';
      playPreview(b, { onend: () => { pb.classList.remove('on'); pb.textContent = '▶'; } });
    };
    box.append(h('div.loop', {}, pb,
      h('div.ln', {}, h('b', {}, s.name), h('span', {}, `${s.dur.toFixed(1)} s${s.bpm ? ` · ${s.bpm} BPM · ${s.bars} comp.` : ''} · ${{ loop: 'loop', oneshot: 'golpe', audio: 'voz/audio' }[s.kind] || s.kind}`)),
      h('button.btn.sm', { onclick: action(() => ownMenu(s)) }, '⋯'),
      h('button.btn.sm.primary', { onclick: () => addOwn(s) }, '＋')));
  });
}
async function ownMenu(s) {
  const id = await sheet(s.name, { options: [
    { id: 'name', label: '✎ Renombrar' },
    { id: 'bpm', label: `⏱ BPM: ${s.bpm || 'sin detectar'}`, sub: 'Corrige el tempo si lo detecté mal' },
    { id: 'kind', label: `Tipo: ${{ loop: 'Loop', oneshot: 'Golpe', audio: 'Voz/audio' }[s.kind]}`, sub: 'Loop = se repite al tempo · Golpe = se toca por pasos' },
    { id: 'del', label: '🗑 Borrar', danger: true },
  ] });
  if (id === 'name') { const v = await prompt('Nombre', s.name); if (v) { s.name = v; await updateSample(s); } }
  else if (id === 'bpm') { const v = await prompt('BPM del loop', String(s.bpm || '')); if (v && +v) { s.bpm = Math.round(+v); s.bars = Math.max(1, Math.round((s.dur * s.bpm) / 240)); await updateSample(s); } }
  else if (id === 'kind') { const k = await sheet('Tipo de sonido', { options: [{ id: 'loop', label: 'Loop' }, { id: 'oneshot', label: 'Golpe (one-shot)' }, { id: 'audio', label: 'Voz / audio largo' }] }); if (k) { s.kind = k; await updateSample(s); } }
  else if (id === 'del') { if (await confirm('¿Borrar sonido?', 'Las pistas que lo usen quedarán en silencio.', 'Borrar', true)) await deleteSample(s.id); }
  renderOwn();
}
async function uploadOwn() {
  const f = await pickFile(); if (!f) return;
  busy('Analizando el sonido…');
  try {
    const buf = await decode(f);
    const { bpm, conf } = await quickTempo(buf);
    const kind = buf.duration < 1.5 ? 'oneshot' : buf.duration > 40 ? 'audio' : 'loop';
    const rec = await addSample({ name: f.name.replace(/\.[^.]+$/, '').slice(0, 40), blob: f, buffer: buf, bpm: kind === 'loop' && conf > 0.1 ? bpm : null, kind });
    toast(`Guardado: ${rec.name}${rec.bpm ? ` · ${rec.bpm} BPM` : ''}`);
  } finally { busy(false); }
  renderOwn();
}
async function recordOwn() {
  const r = await recordOverlay('Graba un sonido, ritmo o voz…'); if (!r) return;
  const name = await prompt('Nombre del sonido', 'Grabación ' + new Date().toLocaleTimeString());
  await addSample({ name: name || 'Grabación', blob: r.blob, buffer: r.buffer, kind: r.buffer.duration < 1.5 ? 'oneshot' : 'audio' });
  renderOwn();
}
function addOwn(s) {
  if (!currentProject()) { toast('Abre un proyecto en el Estudio'); return; }
  const P = currentProject();
  let t;
  if (s.kind === 'loop') t = newTrack('sample', { name: s.name.slice(0, 24), role: 'perc', sampleId: s.id, mode: 'loop', sampleBpm: s.bpm || P.bpm, loopBars: s.bars || 1 });
  else if (s.kind === 'audio') t = newTrack('audio', { name: s.name.slice(0, 24), role: 'vox', sampleId: s.id });
  else t = newTrack('drum', { name: s.name.slice(0, 24), role: 'perc', sampleId: s.id, steps: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] });
  addTrack(t);
}

// ---------- recrear una canción ----------
function recreateCard() {
  return h('div.card.leo', {},
    h('h3', {}, '🧬 Recrear una canción'),
    h('p.muted.small', { style: { margin: '0 0 10px' } }, 'Sube un tema que te guste: detecto su BPM, tonalidad (y clave Camelot para DJ), su patrón de batería y su estilo, y te armo un proyecto parecido para que hagas tu versión. Nunca copio el audio original.'),
    h('button.btn.primary.block', { onclick: action(recreate) }, '🎵 Subir canción y analizar'));
}
async function recreate() {
  const f = await pickFile(); if (!f) return;
  busy('Escuchando la canción…');
  let dna, buf;
  try { buf = await decode(f); dna = await analyzeSong(buf, (m) => busyText(m)); } finally { busy(false); }
  const G = GENRES[dna.genre];
  const cam = CAMELOT[dna.mode][dna.root];
  const id = await sheet(`🧬 ${f.name.replace(/\.[^.]+$/, '')}`, {
    text: `Tempo: ${dna.bpm} BPM\nTonalidad: ${NOTE_ES[dna.root]} ${dna.mode === 'minor' ? 'menor' : 'mayor'} · Camelot ${cam}\nEstilo parecido: ${G.emoji} ${G.name}\nBatería detectada: ${dna.separated ? 'sí (bombo y caja separados)' : 'aproximada (usé el patrón del estilo)'}`,
    options: [
      { id: 'same', label: `✨ Proyecto parecido (${G.name})`, primary: true, sub: 'Mismo BPM, tono y groove; instrumentos nuevos' },
      { id: 'techno', label: '⛓️ Versión hard techno', sub: `Su tonalidad y groove, llevado a ${Math.max(145, dna.bpm)} BPM` },
      { id: 'latino', label: '🔥 Versión techno latino (edit)', sub: 'Para meterle voces latinas encima' },
      { id: 'save', label: '💾 Guardar la canción en Tus sonidos', sub: 'Para tus sets / referencias (uso personal)' },
    ] });
  if (!id) return;
  if (id === 'save') { await addSample({ name: f.name.replace(/\.[^.]+$/, '').slice(0, 40), blob: f, buffer: buf, bpm: dna.bpm, kind: 'audio' }); renderOwn(); toast('Guardada en Tus sonidos'); return; }
  const genre = id === 'same' ? dna.genre : id === 'techno' ? 'hardtechno' : 'technolatino';
  const bpm = id === 'same' ? dna.bpm : Math.max(GENRES[genre].bpm[0], Math.min(GENRES[genre].bpm[1], dna.bpm < 100 ? dna.bpm * 1.5 : dna.bpm));
  await newFromStyle(genre, { bpm: Math.round(bpm), root: dna.root, mode: dna.mode, drums: id === 'same' ? dna.drums : null, name: `Mi versión · ${f.name.replace(/\.[^.]+$/, '').slice(0, 24)}`, dj: TECHNO.has(genre) });
  emit('goto', 'studio');
}
