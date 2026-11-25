// ===============================================================
//  Biblioteca de sonidos: sintetizados por la app (100% tuyos) +
//  muestras de dominio público CC0 incluidas en la app.
//  Un sonido de batería se guarda como:  'kick' (sintetizado)
//  o  'lib:808-kick' (muestra de la biblioteca).
// ===============================================================
import { DRUMS, drumBank } from '../engine/synth.js';
import { decode } from '../core/audio.js';

export const SOUND_CATS = [
  { id: 'kick', name: 'Bombos', emoji: '🦵' },
  { id: 'snare', name: 'Cajas', emoji: '🥁' },
  { id: 'clap', name: 'Palmas', emoji: '👏' },
  { id: 'hat', name: 'Hi-hats', emoji: '🎩' },
  { id: 'perc', name: 'Percusión', emoji: '🪘' },
  { id: 'tom', name: 'Toms', emoji: '🛢️' },
  { id: 'fx', name: 'Platillos y FX', emoji: '💫' },
];
const SYNTH_CAT = { kick: 'kick', hardkick: 'kick', snare: 'snare', clap: 'clap', rim: 'perc', hat: 'hat', hatOpen: 'hat', ride: 'hat', shaker: 'perc', guiro: 'perc', congaHi: 'perc', congaLo: 'perc', tomHi: 'tom', tomLo: 'tom', metal: 'perc', crash: 'fx', sweep: 'fx', whistle: 'fx' };

let indexP = null;
export function libraryIndex() {
  if (!indexP) indexP = fetch('samples/index.json').then((r) => (r.ok ? r.json() : [])).catch(() => []);
  return indexP;
}
// Todos los sonidos de batería: [{id, name, cat, source}]
export async function allSounds() {
  const lib = await libraryIndex();
  const synth = Object.entries(DRUMS).filter(([k]) => k !== 'hat2').map(([k, [name]]) => ({ id: k, name: name + ' (DG)', cat: SYNTH_CAT[k] || 'perc', source: 'Sintetizado por DG Studio' }));
  return [...synth, ...lib.map((s) => ({ id: 'lib:' + s.id, name: s.name, cat: s.cat, source: s.source }))];
}
export async function soundName(id) {
  if (!id) return '';
  if (!id.startsWith('lib:')) return (DRUMS[id] || [id])[0];
  const s = (await libraryIndex()).find((x) => 'lib:' + x.id === id);
  return s ? s.name : id;
}
export function soundNameSync(id, idx = null) {
  if (!id) return '';
  if (!id.startsWith('lib:')) return (DRUMS[id] || [id])[0];
  const s = (idx || cachedIndex || []).find((x) => 'lib:' + x.id === id);
  return s ? s.name : id.slice(4);
}
let cachedIndex = null; libraryIndex().then((x) => (cachedIndex = x));

const bufCache = new Map();
export function libBuffer(id) {
  const key = id.startsWith('lib:') ? id.slice(4) : id;
  if (!bufCache.has(key)) {
    bufCache.set(key, libraryIndex().then(async (idx) => {
      const s = idx.find((x) => x.id === key); if (!s) return null;
      const r = await fetch(s.file); if (!r.ok) return null;
      return decode(await r.arrayBuffer());
    }).catch(() => null));
  }
  return bufCache.get(key);
}
// Buffer de cualquier sonido de batería
export async function soundBuffer(id) {
  if (id && id.startsWith('lib:')) return libBuffer(id);
  const bank = await drumBank(); return bank[id] || null;
}
// Cargar los sonidos de biblioteca que usa un proyecto
export async function loadProjectLib(project) {
  const ids = [...new Set(project.tracks.map((t) => t.sound).filter((s) => s && s.startsWith('lib:')))];
  const m = new Map(); await Promise.all(ids.map(async (id) => { const b = await libBuffer(id); if (b) m.set(id, b); })); return m;
}
