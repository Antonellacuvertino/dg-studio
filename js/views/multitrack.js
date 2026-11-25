// ===============================================================
//  MULTIPISTA: junta tus beats, tracks y voces en una línea de tiempo
// ===============================================================
import { h, put, toast, busy, busyText, action, sheet, confirm, prompt, slider, uid, fmt } from '../core/ui.js';
import { db } from '../core/db.js';
import { state, on, emit } from '../core/state.js';
import { audio, pickFile, decode, shareOrSave, safeName, stopPreview } from '../core/audio.js';
import { SessionRecorder } from '../core/recorder.js';
import { toMp3, toWav } from '../engine/export.js';
import { addSample, listSamples, sampleBuffer } from '../studio/samples.js';
import { transport, renderProject } from '../studio/sequencer.js';
import { newMulti, newLane, addClip, multiLength, saveMulti, listMultis, multiPlayer, renderMulti, clipPeaks } from '../multi/engine.js';
import { currentMulti } from '../multi/send.js';
import { currentProject } from './studio.js';

let root = null; let P = null;
const ui = { pps: 40, sel: null, snap: true, raf: 0 };
let saveT = null;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => saveMulti(P), 300); };

export async function initMulti(el) {
  root = el; P = await currentMulti(); render();
  on('multi', (p) => { P = p; ui.sel = null; render(); });
  on('tab', (t) => { if (t !== 'multi' && multiPlayer.playing) stop(); if (t === 'multi') render(); });
}

// ---------------------------------------------------------------
function render() {
  if (!root || !P) return;
  root.innerHTML = '';
  const len = multiLength(P) + 8; const W = Math.ceil(len * ui.pps);
  const beat = 60 / (P.bpm || 120);
  // regla
  const ruler = h('div.mt-ruler', { style: { width: W + 'px' } });
  const step = ui.pps < 25 ? 10 : ui.pps < 60 ? 5 : ui.pps < 120 ? 2 : 1;
  for (let s = 0; s < len; s += step) ruler.append(h('span', { style: { left: s * ui.pps + 'px' } }, fmt(s)));
  ruler.onclick = (e) => { const r = ruler.getBoundingClientRect(); seek((e.clientX - r.left) / ui.pps); };
  // pistas
  const lanes = h('div.mt-lanes', { style: { width: W + 'px' } });
  P.tracks.forEach((t) => {
    const lane = h('div.mt-lane', { 'data-lane': t.id });
    t.clips.forEach((c) => lane.append(clipEl(c, t, beat)));
    lanes.append(lane);
  });
  const head = h('div.mt-heads', {}, h('div.mt-hspace'), ...P.tracks.map((t) => h('div.mt-head', { style: { borderLeftColor: t.color } },
    h('b', { onclick: action(() => laneMenu(t)) }, t.name),
    h('div.row', {},
      h('button.tog.m' + (t.mute ? '.on' : ''), { onclick: () => { t.mute = !t.mute; multiPlayer.lane(t, P); save(); render(); } }, 'M'),
      h('button.tog.s' + (t.solo ? '.on' : ''), { onclick: () => { t.solo = !t.solo; multiPlayer.lane(t, P); save(); render(); } }, 'S')))));
  const playhead = h('div.mt-playhead#mtHead', { style: { left: multiPlayer.pos() * ui.pps + 'px' } });
  const scroller = h('div.mt-scroll#mtScroll', {}, h('div.mt-inner', { style: { width: W + 'px' } }, ruler, lanes, playhead));
  const timeline = h('div.mt-timeline', {}, head, scroller);

  put(root,
    h('div.row', { style: { marginTop: '12px' } },
      h('div.grow', {}, h('h2.vt', { style: { margin: 0 } }, '🎚️ ' + P.name), h('div.muted.small', {}, `${P.tracks.length} pistas · ${fmt(multiLength(P))} · junta beats, tracks y voces`)),
      h('button.btn.sm', { onclick: action(menu) }, '⋯')),
    h('div.transport', {}, h('div.row', {},
      h('button.tplay#mtPlay.always', { onclick: toggle }, multiPlayer.playing ? '❚❚' : '▶'),
      h('button.btn.icon', { title: 'Al inicio', onclick: () => seek(0) }, '⏮'),
      h('div.lcd#mtTime', {}, fmt(multiPlayer.pos()), h('small', {}, 'tiempo')),
      h('div.grow'),
      h('button.btn.sm', { onclick: () => zoom(0.7) }, '－'), h('button.btn.sm', { onclick: () => zoom(1.4) }, '＋'),
      h('button.btn.sm.primary', { onclick: action(recordLane) }, '● Grabar'))),
    P.tracks.length ? timeline : h('div.card.muted', {}, 'Tu mezcla está vacía. Agrega un beat del Estudio, una canción de Crear, tu voz o cualquier archivo de audio. Luego arrástralos para acomodarlos.'),
    h('div.grid2', { style: { marginTop: '10px' } },
      h('button.btn.primary', { onclick: action(addMenu) }, '＋ Agregar audio'),
      h('button.btn', { onclick: () => { ui.snap = !ui.snap; render(); } }, ui.snap ? '🧲 Imán: a tiempo' : '🧲 Imán: libre')),
    ui.sel ? clipPanel() : h('p.muted.small', { style: { marginTop: '8px' } }, 'Toca un clip para editarlo. Arrástralo para moverlo; arrastra sus bordes para recortarlo. Toca la regla para mover el cursor.'),
    h('div.grid2', { style: { marginTop: '10px' } },
      h('button.btn', { onclick: action(() => exportMix('mp3')) }, '⬇️ Exportar MP3'),
      h('button.btn', { onclick: action(() => exportMix('wav')) }, '💿 Exportar WAV')),
  );
  requestAnimationFrame(() => drawWaves());
  if (multiPlayer.playing) loop();
}

function clipEl(c, t, beat) {
  const el = h('div.mt-clip' + (ui.sel === c.id ? '.sel' : ''), { 'data-clip': c.id, style: { left: c.start * ui.pps + 'px', width: Math.max(6, c.dur * ui.pps) + 'px', background: t.color + '33', borderColor: t.color } },
    h('canvas', { 'data-wave': c.sampleId, 'data-off': c.offset, 'data-dur': c.dur }), h('span', {}, c.name), h('i.mt-h.l'), h('i.mt-h.r'));
  el.addEventListener('pointerdown', (e) => startDrag(e, c, t, el, beat));
  return el;
}
const snapT = (x, beat) => (ui.snap ? Math.round(x / (beat / 2)) * (beat / 2) : Math.round(x * 100) / 100);

function startDrag(e, c, t, el, beat) {
  e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
  const mode = e.target.classList.contains('l') ? 'l' : e.target.classList.contains('r') ? 'r' : 'move';
  const x0 = e.clientX; const o = { start: c.start, offset: c.offset, dur: c.dur }; let moved = false;
  let maxDur = Infinity; sampleBuffer(c.sampleId).then((b) => { if (b) maxDur = b.duration; });
  const mv = (ev) => {
    const dx = (ev.clientX - x0) / ui.pps; if (Math.abs(ev.clientX - x0) > 4) moved = true; if (!moved) return;
    if (mode === 'move') c.start = Math.max(0, snapT(o.start + dx, beat));
    else if (mode === 'r') c.dur = Math.max(0.05, Math.min(maxDur - c.offset, snapT(o.start + o.dur + dx, beat) - c.start));
    else { const ns = Math.max(0, Math.min(o.start + o.dur - 0.05, snapT(o.start + dx, beat))); const d = ns - o.start; if (o.offset + d < 0) return; c.start = ns; c.offset = o.offset + d; c.dur = o.dur - d; }
    el.style.left = c.start * ui.pps + 'px'; el.style.width = Math.max(6, c.dur * ui.pps) + 'px';
  };
  const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); if (!moved) ui.sel = c.id; save(); render(); };
  el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}

async function drawWaves() {
  for (const cv of root.querySelectorAll('canvas[data-wave]')) {
    const pk = await clipPeaks(cv.dataset.wave); if (!pk) continue;
    const w = cv.clientWidth, hh = cv.clientHeight; if (!w) continue; cv.width = w; cv.height = hh;
    const g = cv.getContext('2d'); g.fillStyle = 'rgba(255,255,255,.55)';
    const off = +cv.dataset.off, dur = +cv.dataset.dur;
    for (let x = 0; x < w; x += 2) { const tt = off + (x / w) * dur; const i = Math.floor((tt / pk.dur) * pk.pk.length); const v = pk.pk[i] || 0; const bh = Math.max(1, v * hh * 0.9); g.fillRect(x, (hh - bh) / 2, 1.5, bh); }
  }
}

// ---------- transporte ----------
async function toggle() { if (multiPlayer.playing) stop(); else await play(multiPlayer.pos()); }
async function play(from) { try { transport.stop(); stopPreview(); audio(); await multiPlayer.play(P, from); $('mtPlay', '❚❚'); loop(); } catch (e) { toast('No pude reproducir: ' + e.message); } }
function stop() { multiPlayer.stop(); cancelAnimationFrame(ui.raf); $('mtPlay', '▶'); }
function $(id, txt) { const el = document.getElementById(id); if (el && txt != null) el.textContent = txt; return el; }
function seek(t) { const was = multiPlayer.playing; multiPlayer.stop(); multiPlayer.from = Math.max(0, t); const hd = $('mtHead'); if (hd) hd.style.left = multiPlayer.from * ui.pps + 'px'; const tm = $('mtTime'); if (tm) tm.firstChild.textContent = fmt(multiPlayer.from); if (was) play(multiPlayer.from); }
function loop() {
  cancelAnimationFrame(ui.raf);
  const tick = () => {
    if (!multiPlayer.playing) return;
    const t = multiPlayer.pos(); const hd = $('mtHead'); if (hd) hd.style.left = t * ui.pps + 'px';
    const tm = $('mtTime'); if (tm) tm.firstChild.textContent = fmt(t);
    if (t > multiLength(P) + 1) { stop(); seek(0); return; }
    ui.raf = requestAnimationFrame(tick);
  };
  tick();
}
function zoom(k) { ui.pps = Math.max(8, Math.min(240, ui.pps * k)); render(); }

// ---------- clip seleccionado ----------
function findSel() { for (const t of P.tracks) { const c = t.clips.find((x) => x.id === ui.sel); if (c) return { c, t }; } return null; }
function clipPanel() {
  const f = findSel(); if (!f) { ui.sel = null; return null; }
  const { c, t } = f;
  return h('div.card', { style: { borderLeft: `4px solid ${t.color}` } },
    h('h3', {}, '✂️ ' + c.name, h('small', {}, `${fmt(c.start)} → ${fmt(c.start + c.dur)}`)),
    h('div.row.wrap', { style: { gap: '6px' } },
      h('button.btn.sm', { onclick: () => split(c, t) }, '✂️ Dividir en el cursor'),
      h('button.btn.sm', { onclick: () => { const d = { ...c, id: uid(), start: c.start + c.dur }; t.clips.push(d); ui.sel = d.id; save(); render(); } }, '⧉ Duplicar'),
      h('button.btn.sm', { onclick: () => { c.start = Math.max(0, c.start - 60 / P.bpm / 4); save(); render(); } }, '◀'),
      h('button.btn.sm', { onclick: () => { c.start += 60 / P.bpm / 4; save(); render(); } }, '▶'),
      h('button.btn.sm', { onclick: () => moveLane(c, t, -1) }, '⬆ Pista'),
      h('button.btn.sm', { onclick: () => moveLane(c, t, 1) }, '⬇ Pista'),
      h('button.btn.sm', { onclick: action(async () => { const b = await sampleBuffer(c.sampleId); if (b) emit('editVoice', { buffer: b, name: c.name }); }) }, '🎤 Editar voz/efectos'),
      h('button.btn.sm.danger', { onclick: () => { t.clips = t.clips.filter((x) => x !== c); ui.sel = null; save(); render(); } }, '🗑')),
    slider('Volumen', c.gain, { min: 0, max: 2, oninput: (v) => { c.gain = v; save(); } }),
    slider('Entrada', c.fadeIn || 0, { min: 0, max: Math.min(8, c.dur / 2), fmt: (v) => v.toFixed(1) + ' s', oninput: (v) => { c.fadeIn = v; save(); } }),
    slider('Salida', c.fadeOut || 0, { min: 0, max: Math.min(8, c.dur / 2), fmt: (v) => v.toFixed(1) + ' s', oninput: (v) => { c.fadeOut = v; save(); } }),
    h('p.muted.small', {}, 'Los cambios suenan la próxima vez que pulses ▶.'));
}
function split(c, t) {
  const at = multiPlayer.pos();
  if (at <= c.start + 0.05 || at >= c.start + c.dur - 0.05) { toast('Pon el cursor dentro del clip (toca la regla)'); return; }
  const left = at - c.start;
  const b = { ...c, id: uid(), start: at, offset: c.offset + left, dur: c.dur - left, fadeIn: 0.01 };
  c.dur = left; c.fadeOut = 0.01; t.clips.push(b); ui.sel = b.id; save(); render();
}
function moveLane(c, t, d) {
  const i = P.tracks.indexOf(t); const j = i + d; if (j < 0) return;
  if (j >= P.tracks.length) newLane(P);
  t.clips = t.clips.filter((x) => x !== c); P.tracks[j].clips.push(c); save(); render();
}

async function laneMenu(t) {
  const r = await sheet(t.name, { body: h('div', {},
    slider('Volumen', t.vol, { min: 0, max: 1.5, oninput: (v) => { t.vol = v; multiPlayer.lane(t, P); save(); } }),
    slider('Paneo', t.pan || 0, { min: -1, max: 1, fmt: (v) => (Math.abs(v) < 0.05 ? 'C' : v < 0 ? 'I' + Math.round(-v * 100) : 'D' + Math.round(v * 100)), oninput: (v) => { t.pan = v; save(); } }),
    slider('Reverb', t.reverb || 0, { oninput: (v) => { t.reverb = v; save(); } })),
  options: [{ id: 'name', label: '✎ Renombrar pista' }, { id: 'del', label: '🗑 Borrar pista', danger: true }], cancel: 'Listo' });
  if (r === 'name') { const v = await prompt('Nombre de la pista', t.name); if (v) t.name = v; }
  else if (r === 'del') { if (await confirm('¿Borrar pista?', `"${t.name}" y sus clips se quitan de la mezcla.`, 'Borrar', true)) P.tracks = P.tracks.filter((x) => x !== t); }
  save(); render();
}

// ---------- agregar audio ----------
async function addMenu() {
  const id = await sheet('＋ Agregar audio', { options: [
    { id: 'studio', label: '🎛️ El beat del Estudio', primary: true, sub: currentProject() ? `"${currentProject().name}" · tema completo` : 'Abre un proyecto en el Estudio' },
    { id: 'loop', label: '🔁 El loop del Estudio (8 compases)', sub: 'Para repetirlo y armar encima' },
    { id: 'create', label: '✍️ La última canción de Crear', sub: state.lastSong ? state.lastSong.name : 'Crea una canción primero' },
    { id: 'mine', label: '⭐ De Mis sonidos', sub: 'Voces, loops y grabaciones guardadas' },
    { id: 'file', label: '📁 Subir archivo de audio', sub: 'MP3, WAV, M4A… del teléfono o PC' },
    { id: 'rec', label: '🎙️ Grabar ahora', sub: 'Se agrega en el cursor mientras suena la mezcla' },
  ] });
  if (!id) return;
  if (id === 'rec') return recordLane();
  let buffer = null, name = 'Audio', sampleId = null, dur = null, bpm = null;
  if (id === 'studio' || id === 'loop') {
    const sp = currentProject(); if (!sp) { toast('Abre un proyecto en el Estudio'); return; }
    transport.stop(); busy('Mezclando el beat del Estudio…');
    try {
      let proj = sp;
      if (id === 'loop') { const all = Object.fromEntries(sp.tracks.map((t) => [t.id, true])); proj = { ...sp, scenes: [{ id: 'x', name: 'Loop', fx: 'none', bars: 8, on: all }] }; }
      buffer = await renderProject(proj, { onProgress: (p) => busyText(`Mezclando el beat… ${Math.round(p * 100)}%`), tail: id === 'loop' ? 0 : 2 });
    } finally { busy(false); }
    name = sp.name + (id === 'loop' ? ' (loop)' : ''); bpm = sp.bpm;
  } else if (id === 'create') {
    if (!state.lastSong) { toast('Primero crea una canción en ✍️ Crear'); return; }
    buffer = state.lastSong.buffer; name = state.lastSong.name; bpm = state.lastSong.bpm;
  } else if (id === 'mine') {
    const lib = await listSamples();
    const s = await sheet('⭐ Mis sonidos', { options: lib.map((x) => ({ id: x.id, label: x.name, sub: `${x.dur.toFixed(1)} s` })) });
    if (!s) return; const rec = lib.find((x) => x.id === s); sampleId = rec.id; name = rec.name; dur = rec.dur;
  } else if (id === 'file') {
    const f = await pickFile(); if (!f) return;
    busy('Abriendo audio…'); try { buffer = await decode(f); const rec = await addSample({ name: f.name.replace(/\.[^.]+$/, '').slice(0, 40), blob: f, buffer, kind: 'audio' }); sampleId = rec.id; dur = rec.dur; name = rec.name; } finally { busy(false); }
  }
  if (!sampleId) { const rec = await addSample({ name: name.slice(0, 40), buffer, kind: 'audio', bpm }); sampleId = rec.id; dur = rec.dur; }
  if (bpm && !P.tracks.length) P.bpm = bpm;
  const lane = newLane(P, name.slice(0, 22));
  addClip(P, lane, { sampleId, name, dur, start: P.tracks.length > 1 ? multiPlayer.pos() : 0 });
  await saveMulti(P); render(); toast(`＋ ${name}`);
}

async function recordLane() {
  const rec = new SessionRecorder('mic');
  try { await rec.start(); } catch (e) { toast(e.message, 4500); return; }
  const at = multiPlayer.pos();
  if (P.tracks.length) await play(at);
  const ov = document.getElementById('rec'); document.getElementById('recHint').textContent = P.tracks.length ? 'Grabando sobre tu mezcla (usa audífonos)…' : 'Grabando…';
  document.getElementById('recPrompter').hidden = true; ov.hidden = false;
  let raf; const tick = () => { document.getElementById('recTime').textContent = fmt(rec.time()); document.getElementById('recLevel').style.width = Math.min(100, rec.level() * 120) + '%'; raf = requestAnimationFrame(tick); }; tick();
  await new Promise((res) => { document.getElementById('recStop').onclick = res; });
  cancelAnimationFrame(raf); ov.hidden = true; document.getElementById('recStop').onclick = null;
  stop();
  const blob = await rec.stop(); if (!blob) { toast('La grabación quedó vacía'); return; }
  busy('Guardando la grabación…');
  try {
    const buffer = await decode(blob);
    const s = await addSample({ name: 'Grabación ' + new Date().toLocaleTimeString(), blob, buffer, kind: 'audio' });
    const lane = newLane(P, '🎙️ Voz');
    const lat = (audio().outputLatency || 0.04) + (audio().baseLatency || 0.01);
    const c = addClip(P, lane, { sampleId: s.id, name: s.name, dur: buffer.duration, start: at });
    if (P.tracks.length > 1) { c.offset = Math.min(buffer.duration - 0.1, lat + 0.08); c.dur = buffer.duration - c.offset; }
    await saveMulti(P);
  } finally { busy(false); }
  render(); toast('🎙️ Grabación agregada');
}

// ---------- proyecto ----------
async function menu() {
  const id = await sheet(P.name, { options: [
    { id: 'new', label: '✨ Nueva mezcla' }, { id: 'open', label: '📂 Mis mezclas' }, { id: 'name', label: '✎ Renombrar' },
    { id: 'bpm', label: `⏱ Tempo para el imán: ${P.bpm} BPM` }, { id: 'del', label: '🗑 Borrar esta mezcla', danger: true },
  ] });
  if (id === 'new') { stop(); P = newMulti(); await saveMulti(P); await db.kvSet('multiId', P.id); ui.sel = null; }
  else if (id === 'open') { const all = await listMultis(); const s = await sheet('Mis mezclas', { options: all.map((x) => ({ id: x.id, label: (x.id === P.id ? '● ' : '') + x.name, sub: `${x.tracks.length} pistas · ${new Date(x.updated).toLocaleDateString()}` })) }); if (s) { stop(); P = all.find((x) => x.id === s); await db.kvSet('multiId', P.id); ui.sel = null; } }
  else if (id === 'name') { const v = await prompt('Nombre de la mezcla', P.name); if (v) { P.name = v; await saveMulti(P); } }
  else if (id === 'bpm') { const v = await prompt('BPM (para que los clips se acomoden a tiempo)', String(P.bpm)); if (v && +v) { P.bpm = Math.max(40, Math.min(220, +v)); await saveMulti(P); } }
  else if (id === 'del') { if (await confirm('¿Borrar mezcla?', `"${P.name}" se elimina (tus sonidos siguen en Mis sonidos).`, 'Borrar', true)) { stop(); await db.del('multis', P.id); P = newMulti(); await saveMulti(P); await db.kvSet('multiId', P.id); } }
  render();
}
async function exportMix(kind) {
  if (!P.tracks.some((t) => t.clips.length)) { toast('Agrega audio primero'); return; }
  stop(); busy('Mezclando…');
  try {
    const buf = await renderMulti(P);
    let blob;
    if (kind === 'mp3') { const y = new Date().getFullYear(); blob = await toMp3(buf, { title: P.name, artist: state.artist, album: `${state.artist} — DG Studio`, genre: 'Mezcla', year: String(y), bpm: String(P.bpm), key: '', copyright: `℗ © ${y} ${state.artist}`, comment: 'Mezclado en DG Studio' }, (p) => busyText(`Creando MP3… ${Math.round(p * 100)}%`)); }
    else blob = toWav(buf);
    busy(false);
    await shareOrSave(blob, `${safeName(state.artist)} - ${safeName(P.name)}.${kind}`);
  } catch (e) { busy(false); throw e; }
}
void newMulti;
