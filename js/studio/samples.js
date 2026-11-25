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
// Nivel automático: los loops/canciones subidos o creados vienen al volumen
// máximo; al juntarlos en una mezcla saturan. Se llevan a un nivel parejo
// (≈ -20 dBFS RMS para loops/audio, pico 0,7 para golpes) sin tocar el archivo.
const gainCache = new WeakMap();
export function sampleGain(buf) {
  if (!buf) return 1;
  if (gainCache.has(buf)) return gainCache.get(buf);
  let sum = 0, n = 0, pk = 0; const step = Math.max(1, Math.floor(buf.length / 200000));
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i += step) { const v = d[i]; sum += v * v; n++; const a = Math.abs(v); if (a > pk) pk = a; } }
  const rms = Math.sqrt(sum / Math.max(1, n)); const P = Math.max(pk, 1e-4);
  let g = buf.duration < 1.5 ? 0.7 / P : 0.1 / Math.max(rms, 1e-4);
  g = Math.max(0.05, Math.min(2, Math.min(g, 0.75 / P)));
  gainCache.set(buf, g); return g;
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
