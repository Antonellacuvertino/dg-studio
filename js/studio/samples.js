// ===============================================================
//  Sonidos propios (samples / loops subidos o grabados)
//  Se guardan en IndexedDB como archivo original + datos (BPM, compases)
// ===============================================================
import { db } from '../core/db.js';
import { decode } from '../core/audio.js';
import { uid } from '../core/ui.js';
import { toWav } from '../engine/export.js';

const cache = new Map(); // id -> Promise<AudioBuffer>

export async function addSample({ name, blob, buffer = null, bpm = null, kind = 'loop', tags = [] }) {
  if (!blob && buffer) blob = toWav(buffer);
  const buf = buffer || (await decode(blob));
  const bars = bpm ? Math.max(1, Math.round((buf.duration * bpm) / 240)) : null;
  const rec = { id: uid(), name, blob, bpm, bars, kind, tags, dur: buf.duration, date: Date.now() };
  try { await db.put('samples', rec); } catch { throw new Error('No hay espacio para guardar el sonido en este dispositivo'); }
  cache.set(rec.id, Promise.resolve(buf));
  return rec;
}
export const listSamples = async () => (await db.all('samples')).sort((a, b) => b.date - a.date);
export async function deleteSample(id) { cache.delete(id); await db.del('samples', id); }
export async function updateSample(rec) { await db.put('samples', rec); }

export function sampleBuffer(id) {
  if (!cache.has(id)) {
    cache.set(id, (async () => { const rec = await db.get('samples', id); if (!rec) return null; return decode(rec.blob); })().catch(() => null));
  }
  return cache.get(id);
}
// Cargar todos los samples que usa un proyecto
export async function loadProjectSamples(project) {
  const ids = [...new Set(project.tracks.map((t) => t.sampleId).filter(Boolean))];
  const map = new Map();
  await Promise.all(ids.map(async (id) => { const b = await sampleBuffer(id); if (b) map.set(id, b); }));
  return map;
}
