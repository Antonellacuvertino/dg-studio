// ===============================================================
//  Grabadora del Estudio: graba lo que suena y/o tu micrófono,
//  con pausa, y luego guárdalo, expórtalo o mándalo a Multipista.
// ===============================================================
import { h, toast, busy, action, prompt, chips, fmt } from '../core/ui.js';
import { state } from '../core/state.js';
import { decode, playPreview, stopPreview, shareOrSave, safeName } from '../core/audio.js';
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
    } else if (st === 'rec') R.rec.pause(); else R.rec.resume();
    draw(card);
  });
  const stopB = h('button.btn.always', { disabled: st === 'idle', onclick: action(async () => {
    const rec = R.rec; R.rec = null; const blob = await rec.stop(); draw(card);
    if (!blob) { toast('La grabación quedó vacía'); return; }
    busy('Guardando…'); try { R.last = { blob, buffer: await decode(blob), name: 'Grabación ' + new Date().toLocaleString() }; } finally { busy(false); }
    draw(card);
  }) }, '■ Detener');
  card.append(h('div.row', { style: { gap: '14px', margin: '8px 0' } }, main, h('div.grow', {}, time, meter), stopB));
  card.append(h('p.muted.small', {}, st === 'idle' ? '● graba · ❚❚ pausa · ● sigue · ■ termina. Puedes cambiar casillas y sonidos mientras grabas.' : 'Puedes pausar y seguir cuantas veces quieras.'));
  if (R.last && st === 'idle') {
    const L = R.last;
    card.append(h('div.sep'), h('b', {}, '🎧 ' + L.name), h('div.muted.small', {}, `${L.buffer.duration.toFixed(1)} s`),
      h('div.grid2', { style: { marginTop: '8px' } },
        h('button.btn', { onclick: () => playPreview(L.buffer) }, '▶ Escuchar'),
        h('button.btn', { onclick: () => stopPreview() }, '■ Parar'),
        h('button.btn.primary', { onclick: action(async () => { const n = await prompt('Nombre', L.name); if (n == null) return; await addSample({ name: (n || L.name).slice(0, 40), blob: L.blob, buffer: L.buffer, kind: 'audio' }); toast('💾 Guardada en 🔁 Loops → Tus sonidos'); }) }, '💾 Guardar'),
        h('button.btn', { onclick: action(() => shareOrSave(toWav(L.buffer), `${safeName(state.artist)} - ${safeName(L.name)}.wav`)) }, '⬇️ Exportar'),
        h('button.btn', { onclick: action(() => sendToMulti({ buffer: L.buffer, name: L.name })) }, '📤 A Multipista'),
        h('button.btn.danger', { onclick: () => { R.last = null; draw(card); } }, '🗑 Descartar')));
  }
  if (st !== 'idle') {
    const tick = () => { if (!card.isConnected || !R.rec) return; time.textContent = fmt(R.rec.time()); meter.firstChild.style.width = Math.min(100, R.rec.level() * 120) + '%'; R.raf = requestAnimationFrame(tick); };
    tick();
  }
}
