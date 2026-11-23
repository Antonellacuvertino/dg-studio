// ===============================================================
//  VOZ: mi perfil de voz, ajustes (autotune, tono…) y afinador real
// ===============================================================
import { h, toast, busy, busyText, action, sheet, confirm, slider, chips } from '../core/ui.js';
import { put } from '../core/ui.js';
import { state, saveVoiceSettings, VOICE_DEFAULTS, on, emit } from '../core/state.js';
import { audio, pickFile, playPreview, stopPreview, decode, shareOrSave, safeName } from '../core/audio.js';
import { NOTE_ES } from '../engine/engine.js';
import { toWav } from '../engine/export.js';
import { SOUNDS, toMono44, prepSource, finishProfile, demoVocals, defaultProfile } from '../voice/voice.js';
import { autotune, trackPitch, detectKeyFromPitch } from '../voice/tune.js';
import { loadProfile, getProfile, saveProfile, deleteProfile, saveRef, singer } from '../voice/profile.js';
import { addSample } from '../studio/samples.js';
import { currentProject } from './studio.js';
import { recordOverlay, WavePlayer } from './shared.js';
import { startRecorder } from '../core/audio.js';

let root = null;
const tuneState = { orig: null, tuned: null, root: 9, mode: 'minor', amount: 0.8, speed: 0.6, transpose: 0, name: '' };
let player = null;

export async function initVoice(el) {
  root = el; await loadProfile(); render();
  on('tab', (t) => { if (t === 'voice') render(); else if (player) player.stop(); });
  on('profile', () => render());
}

function render() {
  if (!root) return;
  root.innerHTML = '';
  put(root, h('h2.vt', {}, '🎤 Voz'), h('p.vs', {}, 'Tu voz, cómo suena al cantar tus letras, y un afinador (autotune) para tus grabaciones reales.'),
    profileCard(), settingsCard(), tunerCard());
}

// ---------- perfil ----------
function profileCard() {
  const p = getProfile();
  return h('div.card.leo', {},
    h('h3', {}, '🧬 Mi voz', h('small', {}, p ? `creada ${new Date(p.date).toLocaleDateString()}` : 'sin crear')),
    h('p.muted.small', { style: { margin: '0 0 10px' } }, p ? 'La app canta tus letras con tu timbre. Ajusta abajo cuánto autotune quieres.' : 'Graba 7 sonidos cortos + una frase de 15 s (≈45 s). La app aprende tu timbre para cantar o rapear cualquier letra que escribas.'),
    h('div.grid2', {},
      h('button.btn.primary', { onclick: action(wizard) }, p ? '🔁 Volver a grabar' : '🎙️ Crear mi voz'),
      h('button.btn', { onclick: () => demo() }, '🎧 Escuchar demo')),
    p ? h('button.btn.sm.danger', { style: { marginTop: '8px' }, onclick: action(async () => { if (await confirm('¿Borrar tu voz?', 'Se elimina tu perfil de voz de este dispositivo.', 'Borrar', true)) await deleteProfile(); }) }, '🗑 Borrar mi voz') : null);
}
function demo() {
  const p = singer() || defaultProfile();
  try { playPreview(demoVocals(p, state.voice)); } catch (e) { toast(e.message); }
}

// Asistente de grabación (8 pasos)
const REF = () => `Hola, soy ${state.artist}. Estoy grabando mi voz para crear mis canciones. Me gusta la música, el ritmo y la noche; cuando canto siento que todo puede cambiar, y por eso nunca me rindo.`;
const WIZ = {
  a: ['A', 'Di "aaaaa" sostenido 2 segundos, como una nota larga, en tu tono cómodo.'], e: ['E', '"eeeee" parejo, en el mismo tono.'], i: ['I', '"iiiii" sostenido.'],
  o: ['O', '"ooooo" sostenido.'], u: ['U', '"uuuuu" sostenido.'], m: ['M', 'Tararea con la boca cerrada: "mmmmm".'], s: ['S', 'Un siseo suave: "sssss".'],
  ref: ['🎙️', null],
};
async function wizard() {
  const steps = [...SOUNDS, 'ref'];
  const ok = await sheet('🧬 Crear mi voz', { text: 'Usa audífonos o un lugar silencioso. Te pediré 8 grabaciones cortas.\n\nSolo se puede crear con TU propia voz.', options: [{ id: 'yes', label: '✅ Confirmo que es mi propia voz, empezar', primary: true }] });
  if (ok !== 'yes') return;
  const sources = {};
  for (let i = 0; i < steps.length; i++) {
    const k = steps[i];
    const txt = k === 'ref' ? `Último paso: lee en voz alta (15 s):\n\n"${REF()}"` : WIZ[k][1];
    for (;;) {
      const go = await sheet(`Paso ${i + 1} de ${steps.length}: ${WIZ[k][0]}`, { text: txt, options: [{ id: 'rec', label: '🔴 Grabar', primary: true }] });
      if (go !== 'rec') { toast('Creación de voz cancelada'); return; }
      const r = await recordFixed(k === 'ref' ? 15 : 2.6, k === 'ref' ? 'Lee el texto…' : `Mantén "${k.repeat(4)}"…`, k === 'ref' ? REF() : null);
      if (!r) return;
      const x = await toMono44(r);
      if (k === 'ref') {
        let e = 0; for (let j = 0; j < x.length; j += 8) e += x[j] * x[j];
        if (Math.sqrt(e / (x.length / 8)) < 0.008) { toast('Casi no te escuché, repite más cerca del micrófono', 3500); continue; }
        const d = new Float32Array(Math.floor(x.length / 2)); for (let j = 0; j < d.length; j++) d[j] = (x[2 * j] + x[2 * j + 1]) / 2;
        await saveRef(d); break;
      }
      const src = prepSource(x, k !== 's');
      if (!src) { toast('No te escuché bien 😕 mantén el sonido más fuerte y parejo', 3500); continue; }
      sources[k] = src; break;
    }
    if (i === SOUNDS.length - 1) {
      const p = finishProfile(sources, state.artist);
      await saveProfile(p);
      if (state.voice.who === 'dg') { state.voice.who = 'auto'; await saveVoiceSettings(); }
    }
  }
  toast('✅ ¡Tu voz quedó guardada! Ve a ✍️ Crear y escribe tu letra.', 4000);
  render();
}
// Grabar una cantidad fija de segundos
async function recordFixed(sec, hint, text) {
  let rec; try { rec = await startRecorder(); } catch (e) { toast(e.message, 4500); return null; }
  const ov = document.getElementById('rec'); document.getElementById('recHint').textContent = hint;
  const pr = document.getElementById('recPrompter'); pr.innerHTML = ''; pr.hidden = !text; if (text) pr.append(h('li.now', {}, text));
  ov.hidden = false; const t0 = performance.now();
  let stop = false; document.getElementById('recStop').onclick = () => { stop = true; };
  await new Promise((res) => { const tick = () => { const el = (performance.now() - t0) / 1000; document.getElementById('recTime').textContent = `${el.toFixed(1)} / ${sec}s`; document.getElementById('recLevel').style.width = `${Math.min(100, rec.level() * 120)}%`; if (el >= sec || stop) return res(); requestAnimationFrame(tick); }; tick(); });
  ov.hidden = true; document.getElementById('recStop').onclick = null;
  const blob = await rec.stop();
  if (stop && (performance.now() - t0) / 1000 < sec * 0.6) { toast('Grabación cancelada'); return null; }
  try { return await decode(blob); } catch { toast('No pude leer la grabación'); return null; }
}

// ---------- ajustes de voz ----------
function settingsCard() {
  const v = state.voice; const save = () => saveVoiceSettings();
  const pct = (x) => Math.round(x * 100) + '%';
  return h('div.card', {},
    h('h3', {}, '🎚️ Cómo canta tu letra', h('small', {}, 'se aplica en ✍️ Crear')),
    h('div.muted.small', {}, '¿Quién canta?'),
    chips([{ id: 'auto', label: '🤖 Auto' }, { id: 'mine', label: '🧬 Mi voz' }, { id: 'dg', label: '🎤 Voz DG' }, { id: 'none', label: '🔇 Sin voz' }], v.who, (x) => { v.who = x; save(); }),
    h('div.muted.small', { style: { marginTop: '6px' } }, 'Estilo'),
    chips([{ id: 'auto', label: 'Según el género' }, { id: 'sung', label: '🎶 Cantado' }, { id: 'rap', label: '🎤 Rapeado' }], v.style, (x) => { v.style = x; save(); }),
    h('div.sep'),
    slider('Autotune', v.tune, { fmt: (x) => (x < 0.15 ? 'Natural' : x > 0.8 ? 'Robot' : pct(x)), onchange: (x) => { v.tune = x; save(); } }),
    slider('Tono', v.transpose, { min: -12, max: 12, step: 1, fmt: (x) => `${x > 0 ? '+' : ''}${x} st`, onchange: (x) => { v.transpose = x; save(); } }),
    slider('Vibrato', v.vibrato, { fmt: pct, onchange: (x) => { v.vibrato = x; save(); } }),
    slider('Humanizar', v.humanize, { fmt: pct, onchange: (x) => { v.humanize = x; save(); } }),
    slider('Aire', v.breath, { fmt: pct, onchange: (x) => { v.breath = x; save(); } }),
    h('div.sep'),
    h('div.muted.small', {}, 'Mezcla automática de voces'),
    slider('Coros dobles', v.double, { fmt: pct, onchange: (x) => { v.double = x; save(); } }),
    slider('Armonía', v.harmony, { fmt: pct, onchange: (x) => { v.harmony = x; save(); } }),
    slider('Ad-libs/ecos', v.adlibs, { fmt: pct, onchange: (x) => { v.adlibs = x; save(); } }),
    slider('Espacio', v.space, { fmt: pct, onchange: (x) => { v.space = x; save(); } }),
    h('div.grid2', { style: { marginTop: '8px' } },
      h('button.btn', { onclick: () => demo() }, '🎧 Probar'),
      h('button.btn.ghost', { onclick: action(async () => { Object.assign(state.voice, VOICE_DEFAULTS); await saveVoiceSettings(); render(); }) }, '↺ Valores por defecto')),
    h('p.muted.small', {}, 'Consejo: Autotune 20–40% suena más natural; 80–100% es el efecto robótico del trap/reggaetón. Para cambiar nota por nota usa "🎼 Editar melodía" en ✍️ Crear.'));
}

// ---------- afinador (autotune real) ----------
function tunerCard() {
  const s = tuneState;
  player = player || new WavePlayer();
  const card = h('div.card', {},
    h('h3', {}, '🎯 Afinar mi grabación (autotune)'),
    h('p.muted.small', { style: { margin: '0 0 10px' } }, 'Graba o sube tu voz real cantando. La afino a la escala que elijas, sin cambiar la velocidad.'),
    h('div.grid2', {},
      h('button.btn', { onclick: action(async () => { const r = await recordOverlay('Canta…'); if (r) await loadTake(r.buffer, 'Grabación'); }) }, '🎙️ Grabar'),
      h('button.btn', { onclick: action(async () => { const f = await pickFile(); if (f) { busy('Abriendo…'); try { await loadTake(await decode(f), f.name.replace(/\.[^.]+$/, '')); } finally { busy(false); } } }) }, '📁 Subir')));
  if (s.orig) {
    const P = currentProject();
    put(card, 
      h('div.sep'),
      h('div.row.wrap', { style: { gap: '6px' } }, h('b', {}, s.name), h('span.muted.small', {}, `${s.orig.duration.toFixed(1)} s`)),
      h('div.muted.small', { style: { marginTop: '8px' } }, `Escala: ${NOTE_ES[s.root]} ${s.mode === 'minor' ? 'menor' : 'mayor'}`),
      h('div.row.wrap', { style: { gap: '6px', margin: '6px 0' } },
        h('button.btn.sm', { onclick: action(async () => { const r = await sheet('Nota base', { grid: true, options: NOTE_ES.map((n, i) => ({ id: String(i), label: n })) }); if (r != null) { s.root = +r; render(); } }) }, '🎼 Cambiar nota'),
        h('button.btn.sm', { onclick: () => { s.mode = s.mode === 'minor' ? 'major' : 'minor'; render(); } }, s.mode === 'minor' ? '→ Mayor' : '→ Menor'),
        P ? h('button.btn.sm', { onclick: () => { s.root = P.root; s.mode = P.mode; render(); } }, `= Proyecto (${NOTE_ES[P.root]})`) : null),
      slider('Corrección', s.amount, { onchange: (x) => (s.amount = x) }),
      slider('Velocidad', s.speed, { fmt: (x) => (x > 0.85 ? 'Robot' : x < 0.3 ? 'Suave' : Math.round(x * 100) + '%'), onchange: (x) => (s.speed = x) }),
      slider('Tono', s.transpose, { min: -12, max: 12, step: 1, fmt: (x) => `${x > 0 ? '+' : ''}${x} st`, onchange: (x) => (s.transpose = x) }),
      h('button.btn.primary.block', { style: { marginTop: '8px' }, onclick: action(runTune) }, '🎯 Afinar'),
      s.tuned ? h('div', {},
        h('div.row', { style: { marginTop: '10px', gap: '6px' } },
          h('button.btn.sm', { onclick: () => { player.set(s.orig); player.play(0); } }, 'A · Original'),
          h('button.btn.sm.primary', { onclick: () => { player.set(s.tuned); player.play(0); } }, 'B · Afinada')),
        player.el,
        h('div.grid3', { style: { marginTop: '10px' } },
          h('button.btn.sm', { onclick: () => { emit('useVoice', { buffer: s.tuned, name: s.name + ' (afinada)' }); emit('goto', 'create'); } }, '✍️ Usar en Crear'),
          h('button.btn.sm', { onclick: action(async () => { await addSample({ name: s.name + ' afinada', buffer: s.tuned, kind: 'audio' }); toast('Guardada en 🔁 Loops → Tus sonidos'); }) }, '💾 A mis sonidos'),
          h('button.btn.sm', { onclick: action(() => shareOrSave(toWav(s.tuned), `${safeName(s.name)} afinada.wav`)) }, '⬇️ WAV'))) : null);
    if (s.tuned) player.set(s.tuned);
  }
  return card;
}
async function loadTake(buf, name) {
  const s = tuneState; s.orig = buf; s.tuned = null; s.name = name;
  busy('Detectando tu tonalidad…');
  try {
    const x = await toMono44(buf); const { f0 } = await trackPitch(x);
    const k = detectKeyFromPitch(f0); s.root = k.root; s.mode = k.mode;
    toast(`Parece ${NOTE_ES[k.root]} ${k.mode === 'minor' ? 'menor' : 'mayor'}`);
  } finally { busy(false); }
  render();
}
async function runTune() {
  const s = tuneState; if (!s.orig) return;
  audio(); stopPreview();
  busy('Afinando tu voz…');
  try { s.tuned = await autotune(s.orig, { root: s.root, mode: s.mode, amount: s.amount, speed: s.speed, transpose: s.transpose, onProgress: (p) => busyText(`Afinando tu voz… ${Math.round(p * 100)}%`) }); }
  finally { busy(false); }
  render(); player.play(0);
}
