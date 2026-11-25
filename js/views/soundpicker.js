// ===============================================================
//  Biblioteca de sonidos: elegir (y escuchar antes) cualquier sonido
// ===============================================================
import { h, sheet, closeSheet, toast, chips } from '../core/ui.js';
import { audio, playPreview, stopPreview } from '../core/audio.js';
import { Synth } from '../engine/synth.js';
import { SOUND_CATS, allSounds, soundBuffer } from '../studio/library.js';
import { SYNTHS } from '../studio/model.js';
import { listSamples, sampleBuffer } from '../studio/samples.js';

let previewSynth = null;
function previewNote(preset, root = 9) {
  const c = audio(); stopPreview();
  if (!previewSynth || previewSynth.ctx !== c) { const g = c.createGain(); g.gain.value = 0.9; g.connect(c.destination); previewSynth = new Synth(c, { drums: g, music: g, bass: g, verb: c.createGain() }); }
  const pr = SYNTHS[preset]; const base = 12 * (pr.oct + 1) + root; const t = c.currentTime + 0.02;
  [0, 3, 7].forEach((iv, k) => { if (pr.fn === 'bass') { if (k === 0) previewSynth._bass(pr.type, t, base, 0.6, 1); } else previewSynth._voice(pr.type, t + k * 0.18, base + iv, 0.35, 1); });
}

/**
 * Abre la biblioteca. Devuelve {kind:'drum', sound} | {kind:'sample', sampleId, name, dur} | {kind:'synth', preset} | null
 * opts.cat: categoría inicial · opts.synths: mostrar sintetizadores · opts.current: sonido actual
 */
export async function pickSound({ cat = 'kick', synths = false, current = null, title = '🎵 Biblioteca de sonidos', root = 9 } = {}) {
  const [all, mine] = await Promise.all([allSounds(), listSamples()]);
  let choice = null;
  const cats = [...SOUND_CATS, ...(synths ? [{ id: 'synth', name: 'Sintes y bajos', emoji: '🎹' }] : []), { id: 'mine', name: 'Mis sonidos', emoji: '⭐' }];
  const list = h('div');
  const choose = (c) => { choice = c; stopPreview(); closeSheet(); };
  const row = (label, sub, onPlay, pick, on) => {
    const pb = h('button.lp', {}, '▶');
    pb.onclick = async (e) => { e.stopPropagation(); list.querySelectorAll('.lp.on').forEach((x) => { x.classList.remove('on'); x.textContent = '▶'; }); pb.classList.add('on'); pb.textContent = '■'; try { await onPlay(() => { pb.classList.remove('on'); pb.textContent = '▶'; }); } catch { toast('No pude reproducir ese sonido'); } };
    return h('div.loop' + (on ? '.sel' : ''), { style: on ? { borderColor: 'var(--red2)' } : null }, pb, h('div.ln', {}, h('b', {}, label), h('span', {}, sub)), h('button.btn.sm.primary', { onclick: pick }, on ? '✓' : 'Usar'));
  };
  const draw = (c) => {
    list.innerHTML = '';
    if (c === 'synth') {
      Object.entries(SYNTHS).forEach(([id, s]) => list.append(row(s.name, s.fn === 'bass' ? 'Bajo' : 'Sintetizador', async (done) => { previewNote(id, root); setTimeout(done, 900); }, () => choose({ kind: 'synth', preset: id }), current === id)));
    } else if (c === 'mine') {
      if (!mine.length) list.append(h('p.muted.small', {}, 'Aún no tienes sonidos propios. Súbelos o grábalos en 🔁 Loops → Tus sonidos.'));
      mine.forEach((s) => list.append(row(s.name, `${s.dur.toFixed(1)} s · tuyo`, async (done) => { const b = await sampleBuffer(s.id); if (b) playPreview(b, { onend: done }); }, () => choose({ kind: 'sample', sampleId: s.id, name: s.name, dur: s.dur, bpm: s.bpm, bars: s.bars, sampleKind: s.kind }), current === s.id)));
    } else {
      all.filter((s) => s.cat === c).forEach((s) => list.append(row(s.name, s.source, async (done) => { const b = await soundBuffer(s.id); if (b) playPreview(b, { onend: done }); }, () => choose({ kind: 'drum', sound: s.id, name: s.name.replace(' (DG)', '') }), current === s.id)));
    }
  };
  const body = h('div', {},
    chips(cats.map((c) => ({ id: c.id, label: `${c.emoji} ${c.name}` })), cat, (c) => draw(c)),
    h('p.muted.small', { style: { margin: '6px 0' } }, '▶ para escuchar · "Usar" para elegir. Todos se pueden usar en canciones que monetices: los (DG) los sintetiza la app y el resto es de dominio público (CC0).'),
    list);
  draw(cat);
  await sheet(title, { body, cancel: 'Cerrar' });
  stopPreview();
  return choice;
}
