// ===============================================================
//  Grabadora del Estudio: graba lo que suena y/o tu micrófono,
//  con pausa, y luego guárdalo, expórtalo o mándalo a Multipista.
// ===============================================================
import { h, toast, busy, action, prompt, chips, fmt, sheet, confirm } from '../core/ui.js';
import { state } from '../core/state.js';
import { decode, playPreview, stopPreview, shareOrSave, saveBlob, safeName } from '../core/audio.js';
import { SessionRecorder } from '../core/recorder.js';
import { toWav } from '../engine/export.js';
import { addSample } from '../studio/samples.js';
import { transport } from '../studio/sequencer.js';
import { sendToMulti } from '../multi/send.js';

const R = { rec: null, source: 'studio', last: null, raf: 0 };

export function recorderCard() {
  const card = h('div.card.reccard');
  draw(card);
  return card;
}
function draw(card) {
  cancelAnimationFrame(R.raf);
  card.innerHTML = '';
  const st = R.rec ? R.rec.state : 'idle';
  const time = h('div.rt', {}, fmt(R.rec ? R.rec.time() : 0));
  const meter = h('div.meter', {}, h('div'));
  card.append(h('h3', {}, '⏺️ Grabadora', h('small', {}, st === 'rec' ? '● grabando' : st === 'paused' ? '❚❚ en pausa' : 'lista')));
  if (st === 'idle') card.append(h('div.muted.small', {}, '¿Qué grabo?'),
    chips([{ id: 'studio', label: '🎛️ Lo que suena' }, { id: 'mic', label: '🎙️ Micrófono' }, { id: 'both', label: '🎛️+🎙️ Ambos' }], R.source, (s) => (R.source = s)));
  const main = h('button.bigrec.always' + (st === 'rec' ? '.on' : ''), { title: 'Grabar' }, st === 'idle' ? '●' : st === 'rec' ? '❚❚' : '●');
  main.onclick = action(async () => {
    if (st === 'idle') {
      R.rec = new SessionRecorder(R.source);
      try { await R.rec.start(); } catch (e) { R.rec = null; toast(e.message, 4500); return; }
      if (R.source !== 'mic' && transport.player) transport.player.mixer.analyser.connect(R.rec.tap);
      if (R.source !== 'mic' && !transport.playing) toast('Pulsa ▶ arriba: se graba todo lo que suene');
    } else if (st === 'rec') { R.rec.pause(); draw(card); await pausedMenu(card); return; }
    else R.rec.resume();
    draw(card);
  });
  const stopB = h('button.btn.always', { disabled: st === 'idle', onclick: action(async () => { if (await finish(card)) await saveMenu(card); }) }, '■ Detener');
  card.append(h('div.row', { style: { gap: '14px', margin: '8px 0' } }, main, h('div.grow', {}, time, meter), stopB));
  card.append(h('p.muted.small', {}, st === 'idle' ? '● graba · ❚❚ pausa (te pregunta si guardar, compartir o seguir) · ■ termina.' : st === 'paused' ? 'En pausa: toca ● para seguir o ■ para terminar y guardar.' : 'Toca ❚❚ para pausar.'));
  if (R.last && st === 'idle') {
    const L = R.last;
    card.append(h('div.sep'), h('b', {}, '🎧 ' + L.name), h('div.muted.small', {}, `${L.buffer.duration.toFixed(1)} s`),
      h('div.grid2', { style: { marginTop: '8px' } },
        h('button.btn', { onclick: () => playPreview(L.buffer) }, '▶ Escuchar'),
        h('button.btn', { onclick: () => stopPreview() }, '■ Parar'),
        h('button.btn.primary', { onclick: action(() => saveMenu(card)) }, '💾 Guardar / compartir'),
        h('button.btn', { onclick: action(() => sendToMulti({ buffer: L.buffer, name: L.name })) }, '📤 A Multipista'),
        h('button.btn.danger', { onclick: () => { R.last = null; draw(card); } }, '🗑 Descartar')));
  }
  if (st !== 'idle') {
    const tick = () => { if (!card.isConnected || !R.rec) return; time.textContent = fmt(R.rec.time()); meter.firstChild.style.width = Math.min(100, R.rec.level() * 120) + '%'; R.raf = requestAnimationFrame(tick); };
    tick();
  }
}

// Terminar la grabación (la deja lista en R.last)
async function finish(card) {
  const rec = R.rec; if (!rec) return false; R.rec = null;
  const blob = await rec.stop(); draw(card);
  if (!blob) { toast('La grabación quedó vacía'); return false; }
  busy('Preparando tu grabación…');
  try { R.last = { blob, buffer: await decode(blob), name: 'Grabación ' + new Date().toLocaleString(), saved: false }; } finally { busy(false); }
  draw(card); return true;
}
const ext = (b) => (/mp4|m4a|aac/.test(b.type) ? 'm4a' : /ogg/.test(b.type) ? 'ogg' : 'webm');

// Menú al pausar: seguir o decidir qué hacer con la grabación
async function pausedMenu(card) {
  const t = R.rec ? R.rec.time() : 0;
  const id = await sheet('❚❚ Grabación en pausa', { text: `Llevas ${fmt(t)} grabados. ¿Qué quieres hacer?`, options: [
    { id: 'resume', label: '● Seguir grabando', primary: true },
    { id: 'save', label: '💾 Terminar y guardar', sub: 'En Mis sonidos (🔁 Loops)' },
    { id: 'share', label: '📤 Terminar y compartir / Guardar en Archivos', sub: 'WhatsApp, AirDrop, Archivos del iPhone…' },
    { id: 'multi', label: '🎚️ Terminar y mandar a Multipista' },
    { id: 'del', label: '🗑 Borrar la grabación', danger: true },
  ], cancel: 'Dejar en pausa' });
  if (id === 'resume') { R.rec && R.rec.resume(); draw(card); return; }
  if (!id) return;
  if (id === 'del') { if (!(await confirm('¿Borrar la grabación?', 'Se descarta todo lo grabado.', 'Borrar', true))) return pausedMenu(card); const rec = R.rec; R.rec = null; await rec.stop(); R.last = null; draw(card); toast('🗑 Grabación borrada'); return; }
  if (!(await finish(card))) return;
  if (id === 'share') { await saveMenu(card); return; } // compartir necesita un toque directo en iPhone
  await doAction(id, card);
}
// Menú después de terminar
async function saveMenu(card) {
  const L = R.last; if (!L) return;
  const id = await sheet('🎧 ¿Qué hago con tu grabación?', { text: `${L.name} · ${L.buffer.duration.toFixed(1)} s`, options: [
    { id: 'save', label: '💾 Guardar en Mis sonidos', primary: true, sub: 'Para usarla en tus beats y en la Multipista' },
    { id: 'share', label: '📤 Compartir / Guardar en Archivos', sub: 'WhatsApp, AirDrop, Archivos del iPhone…' },
    { id: 'wav', label: '⬇️ Descargar en WAV', sub: 'Calidad máxima' },
    { id: 'multi', label: '🎚️ Mandar a Multipista' },
    { id: 'del', label: '🗑 Borrar', danger: true },
  ], cancel: 'Decidir después' });
  if (id) await doAction(id, card);
}
async function doAction(id, card) {
  const L = R.last; if (!L) return;
  if (id === 'save') { const n = await prompt('Nombre de la grabación', L.name); if (n == null) return saveMenu(card); await addSample({ name: (n || L.name).slice(0, 40), blob: L.blob, buffer: L.buffer, kind: 'audio' }); L.saved = true; L.name = n || L.name; toast('💾 Guardada en 🔁 Loops → Tus sonidos'); draw(card); }
  else if (id === 'share') await shareOrSave(L.blob, `${safeName(state.artist)} - ${safeName(L.name)}.${ext(L.blob)}`);
  else if (id === 'wav') saveBlob(toWav(L.buffer), `${safeName(state.artist)} - ${safeName(L.name)}.wav`);
  else if (id === 'multi') await sendToMulti({ buffer: L.buffer, name: L.name });
  else if (id === 'del') { if (await confirm('¿Borrar la grabación?', L.saved ? 'Se quita de aquí (la copia guardada en Mis sonidos sigue).' : 'No la guardaste: se perderá.', 'Borrar', true)) { R.last = null; draw(card); } }
}
