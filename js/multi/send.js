// Enviar un audio (beat, canción, voz) a la Multipista abierta
import { db } from '../core/db.js';
import { emit } from '../core/state.js';
import { toast } from '../core/ui.js';
import { addSample } from '../studio/samples.js';
import { newMulti, newLane, addClip, saveMulti, multiLength } from './engine.js';

export async function currentMulti() {
  const id = await db.kvGet('multiId', null);
  let p = id ? await db.get('multis', id) : null;
  if (!p) { p = newMulti(); await saveMulti(p); await db.kvSet('multiId', p.id); }
  return p;
}
/** buffer: AudioBuffer (o sampleId existente), name, bpm opcional, at: 'start' | 'end' */
export async function sendToMulti({ buffer = null, sampleId = null, name = 'Audio', dur = null, bpm = null, at = 'start' }) {
  if (!sampleId) { const rec = await addSample({ name: name.slice(0, 40), buffer, kind: 'audio', bpm }); sampleId = rec.id; dur = rec.dur; }
  const p = await currentMulti();
  if (bpm && !p.tracks.length) p.bpm = bpm;
  const lane = newLane(p, name.slice(0, 22));
  addClip(p, lane, { sampleId, name, dur: dur || buffer.duration, start: at === 'end' && p.tracks.length > 1 ? multiLength(p) : 0 });
  await saveMulti(p);
  emit('multi', p); emit('goto', 'multi');
  toast(`📤 "${name}" está en la Multipista`);
  return p;
}
