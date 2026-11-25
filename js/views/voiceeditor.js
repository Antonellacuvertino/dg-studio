// ===============================================================
//  EDITOR DE VOZ: importa tu audio y edítalo (recorte, autotune,
//  tono, color, efectos) → guárdalo o mándalo a la Multipista.
// ===============================================================
import { h, toast, busy, busyText, action, sheet, prompt, slider, chips, fmt } from '../core/ui.js';
import { state, emit } from '../core/state.js';
import { audio, pickFile, decode, stopPreview, shareOrSave, safeName } from '../core/audio.js';
import { NOTE_ES } from '../engine/engine.js';
import { toWav } from '../engine/export.js';
import { toMono44 } from '../voice/voice.js';
import { autotune, trackPitch, detectKeyFromPitch } from '../voice/tune.js';
import { processVoice, trim, FX_DEFAULTS, FX_PRESETS } from '../voice/fx.js';
import { addSample } from '../studio/samples.js';
import { sendToMulti } from '../multi/send.js';
import { currentProject } from './studio.js';
import { recordOverlay, WavePlayer } from './shared.js';

const E = { orig: null, name: '', a: 0, b: 0, root: 9, mode: 'minor', amount: 0, speed: 0.5, transpose: 0, formant: 1, fx: { ...FX_DEFAULTS }, preset: 'clean', result: null };
let player = null;
let rerender = () => {};

export async function loadIntoEditor(buffer, name) {
  E.orig = buffer; E.name = name; E.a = 0; E.b = buffer.duration; E.result = null;
  busy('Detectando la tonalidad de tu voz…');
  try { const x = await toMono44(buffer); const { f0 } = await trackPitch(x); const k = detectKeyFromPitch(f0); E.root = k.root; E.mode = k.mode; }
  catch { /* si no hay voz clara, se queda la tonalidad anterior */ } finally { busy(false); }
  rerender();
}

export function voiceEditorCard(onChange) {
  rerender = onChange || rerender;
  player = player || new WavePlayer();
  const card = h('div.card.leo');
  card.append(h('h3', {}, '🎙️ Editor de voz', h('small', {}, 'importa tu audio y edítalo')),
    h('div.grid2', {},
      h('button.btn.primary', { onclick: action(async () => { const f = await pickFile(); if (!f) return; busy('Abriendo…'); let b; try { b = await decode(f); } finally { busy(false); } await loadIntoEditor(b, f.name.replace(/\.[^.]+$/, '').slice(0, 40)); }) }, '📁 Importar mi voz'),
      h('button.btn', { onclick: action(async () => { const r = await recordOverlay('Canta o habla…'); if (r) await loadIntoEditor(r.buffer, 'Grabación ' + new Date().toLocaleTimeString()); }) }, '🎙️ Grabar')));
  if (!E.orig) { card.append(h('p.muted.small', { style: { marginTop: '8px' } }, 'Sube un audio con tu voz (MP3, M4A de notas de voz, WAV…). No necesitas crear un perfil: aquí le pones autotune, cambias el tono, la recortas y le das efectos para juntarla con tu música.')); return card; }
  const P = currentProject();
  const pct = (x) => Math.round(x * 100) + '%';
  const dirty = () => { E.result = null; };
  card.append(
    h('div.sep'),
    h('div.row', {}, h('b.grow', {}, '🎧 ' + E.name), h('span.muted.small', {}, `${fmt(E.orig.duration)}`)),
    // recorte
    h('div.muted.small', { style: { marginTop: '8px' } }, '✂️ Recortar'),
    slider('Inicio', E.a, { min: 0, max: E.orig.duration, step: 0.05, fmt: (v) => v.toFixed(2) + ' s', onchange: (v) => { E.a = Math.min(v, E.b - 0.1); dirty(); rerender(); } }),
    slider('Final', E.b, { min: 0, max: E.orig.duration, step: 0.05, fmt: (v) => v.toFixed(2) + ' s', onchange: (v) => { E.b = Math.max(v, E.a + 0.1); dirty(); rerender(); } }),
    // autotune
    h('div.sep'),
    h('div.muted.small', {}, `🎯 Autotune · escala ${NOTE_ES[E.root]} ${E.mode === 'minor' ? 'menor' : 'mayor'}`),
    h('div.row.wrap', { style: { gap: '6px', margin: '6px 0' } },
      h('button.btn.sm', { onclick: action(async () => { const r = await sheet('Nota base de la escala', { grid: true, options: NOTE_ES.map((n, i) => ({ id: String(i), label: n })) }); if (r != null) { E.root = +r; dirty(); rerender(); } }) }, '🎼 Nota'),
      h('button.btn.sm', { onclick: () => { E.mode = E.mode === 'minor' ? 'major' : 'minor'; dirty(); rerender(); } }, E.mode === 'minor' ? '→ Mayor' : '→ Menor'),
      P ? h('button.btn.sm', { onclick: () => { E.root = P.root; E.mode = P.mode; dirty(); rerender(); } }, `= Mi beat (${NOTE_ES[P.root]})`) : null),
    slider('Autotune', E.amount, { fmt: (x) => (x < 0.05 ? 'Apagado' : pct(x)), onchange: (v) => { E.amount = v; dirty(); } }),
    slider('Velocidad', E.speed, { fmt: (x) => (x > 0.85 ? 'Robot' : x < 0.3 ? 'Suave' : pct(x)), onchange: (v) => { E.speed = v; dirty(); } }),
    slider('Tono', E.transpose, { min: -12, max: 12, step: 1, fmt: (v) => `${v > 0 ? '+' : ''}${v} st`, onchange: (v) => { E.transpose = v; dirty(); } }),
    slider('Color', E.formant, { min: 0.8, max: 1.3, step: 0.01, fmt: (x) => (x < 0.95 ? 'Gruesa' : x > 1.06 ? 'Fina' : 'Normal'), onchange: (v) => { E.formant = v; dirty(); } }),
    // efectos
    h('div.sep'),
    h('div.muted.small', {}, '✨ Efectos'),
    chips(FX_PRESETS.map((p) => ({ id: p.id, label: `${p.emoji} ${p.name}` })), E.preset, (id) => { E.preset = id; Object.assign(E.fx, FX_PRESETS.find((p) => p.id === id).set); dirty(); rerender(); }),
    slider('Volumen', E.fx.gain, { min: -12, max: 12, step: 1, fmt: (v) => `${v > 0 ? '+' : ''}${v} dB`, onchange: (v) => { E.fx.gain = v; dirty(); } }),
    slider('Quitar ruido', E.fx.gate, { fmt: pct, onchange: (v) => { E.fx.gate = v; dirty(); } }),
    slider('Graves', E.fx.low, { min: -12, max: 8, step: 1, fmt: (v) => `${v > 0 ? '+' : ''}${v} dB`, onchange: (v) => { E.fx.low = v; dirty(); } }),
    slider('Brillo', E.fx.high, { min: -8, max: 10, step: 1, fmt: (v) => `${v > 0 ? '+' : ''}${v} dB`, onchange: (v) => { E.fx.high = v; dirty(); } }),
    slider('Compresión', E.fx.comp, { fmt: pct, onchange: (v) => { E.fx.comp = v; dirty(); } }),
    slider('Reverb', E.fx.reverb, { fmt: pct, onchange: (v) => { E.fx.reverb = v; dirty(); } }),
    slider('Eco', E.fx.delay, { fmt: pct, onchange: (v) => { E.fx.delay = v; dirty(); } }),
    slider('Doble (coro)', E.fx.double, { fmt: pct, onchange: (v) => { E.fx.double = v; dirty(); } }),
    h('button.btn.primary.block', { style: { marginTop: '10px' }, onclick: action(apply) }, '✅ Aplicar y escuchar'),
    h('div.row', { style: { marginTop: '10px', gap: '6px' } },
      h('button.btn.sm', { onclick: () => { player.set(trim(E.orig, E.a, E.b)); player.play(0); } }, 'A · Original'),
      h('button.btn.sm' + (E.result ? '.primary' : ''), { disabled: !E.result, onclick: () => { player.set(E.result); player.play(0); } }, 'B · Editada')),
    player.el,
    E.result ? h('div.grid2', { style: { marginTop: '10px' } },
      h('button.btn.primary', { onclick: action(() => sendToMulti({ buffer: E.result, name: E.name + ' (voz)' })) }, '📤 A Multipista'),
      h('button.btn', { onclick: action(async () => { const n = await prompt('Nombre', E.name + ' editada'); if (n == null) return; await addSample({ name: (n || E.name).slice(0, 40), buffer: E.result, kind: 'audio' }); toast('💾 Guardada en Mis sonidos'); }) }, '💾 Guardar'),
      h('button.btn', { onclick: () => { emit('useVoice', { buffer: E.result, name: E.name + ' (editada)' }); emit('goto', 'create'); } }, '✍️ Usar en Crear'),
      h('button.btn', { onclick: action(() => shareOrSave(toWav(E.result), `${safeName(state.artist)} - ${safeName(E.name)} editada.wav`)) }, '⬇️ Exportar WAV')) : h('p.muted.small', {}, 'Ajusta y pulsa "Aplicar" para escuchar el resultado.'),
  );
  if (E.result) player.set(E.result); else player.set(trim(E.orig, E.a, E.b));
  return card;
}

async function apply() {
  audio(); stopPreview(); player.stop();
  busy('Editando tu voz…');
  try {
    let b = trim(E.orig, E.a, E.b);
    if (E.amount > 0.04 || E.transpose || Math.abs(E.formant - 1) > 0.01) {
      busyText('Afinando…');
      b = await autotune(b, { root: E.root, mode: E.mode, amount: E.amount, speed: E.speed, transpose: E.transpose, formant: E.formant, onProgress: (p) => busyText(`Afinando… ${Math.round(p * 100)}%`) });
    }
    busyText('Aplicando efectos…');
    E.result = await processVoice(b, E.fx);
  } finally { busy(false); }
  rerender(); player.play(0);
}
