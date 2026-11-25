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
import { voiceTypeCards } from './voicetypes.js';
import { voiceEditorCard, loadIntoEditor } from './voiceeditor.js';
import { startRecorder } from '../core/audio.js';

let root = null;
const tuneState = { orig: null, tuned: null, root: 9, mode: 'minor', amount: 0.8, speed: 0.6, transpose: 0, name: '' };
let player = null;

export async function initVoice(el) {
  root = el; await loadProfile(); render();
  on('tab', (t) => { if (t === 'voice') render(); else if (player) player.stop(); });
  on('profile', () => render());
  on('editVoice', async ({ buffer, name }) => { emit('goto', 'voice'); await loadIntoEditor(buffer, name); render(); });
}

function render() {
  if (!root) return;
  root.innerHTML = '';
  put(root, h('h2.vt', {}, '🎤 Voz'), h('p.vs', {}, 'Tu voz, cómo suena al cantar tus letras, y un afinador (autotune) para tus grabaciones reales.'),
    voiceEditorCard(() => render()),
    h('h2.vt', { style: { fontSize: '18px', marginTop: '22px' } }, '🗣️ Voz que canta tus letras'),
    h('p.vs', {}, 'Para cuando escribes una letra en ✍️ Crear y quieres que la app la cante.'),
    profileCard(), settingsCard());
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
    h('div.muted.small', {}, 'Tipo de voz'),
    voiceTypeCards(() => render()),
    h('div.sep'),
    h('div.muted.small', {}, '¿Quién canta?'),
    chips([{ id: 'auto', label: '🤖 Auto' }, { id: 'mine', label: '🧬 Mi voz' }, { id: 'dg', label: '🎤 Voz DG' }, { id: 'none', label: '🔇 Sin voz' }], v.who, (x) => { v.who = x; save(); }),
    h('div.muted.small', { style: { marginTop: '6px' } }, 'Estilo'),
    chips([{ id: 'auto', label: 'Según el género' }, { id: 'sung', label: '🎶 Cantado' }, { id: 'rap', label: '🎤 Rapeado' }], v.style, (x) => { v.style = x; save(); }),
    h('div.sep'),
    slider('Autotune', v.tune, { fmt: (x) => (x < 0.15 ? 'Natural' : x > 0.8 ? 'Robot' : pct(x)), onchange: (x) => { v.tune = x; save(); } }),
    slider('Tono', v.transpose, { min: -12, max: 12, step: 1, fmt: (x) => `${x > 0 ? '+' : ''}${x} st`, onchange: (x) => { v.transpose = x; save(); } }),
    slider('Color', v.formant || 1, { min: 0.8, max: 1.3, step: 0.01, fmt: (x) => (x < 0.95 ? 'Gruesa' : x > 1.06 ? 'Fina' : 'Normal'), onchange: (x) => { v.formant = x; save(); } }),
    slider('Rasposa', v.rasp || 0, { fmt: pct, onchange: (x) => { v.rasp = x; save(); } }),
    slider('Susurro', v.whisper || 0, { fmt: pct, onchange: (x) => { v.whisper = x; save(); } }),
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

