// ===============================================================
//  Perfil de voz guardado en el dispositivo (IndexedDB)
// ===============================================================
import { db } from '../core/db.js';
import { deserializeProfile, defaultProfile, b64ToF32 } from './voice.js';
import { state, emit } from '../core/state.js';

let profile = null; let loaded = false;

export async function loadProfile() {
  if (loaded) return profile;
  loaded = true;
  let raw = await db.kvGet('voiceProfile', null);
  // migrar de la versión anterior (localStorage)
  if (!raw) {
    try { const old = JSON.parse(localStorage.getItem('dg_voice') || 'null'); if (old) { raw = old; await db.kvSet('voiceProfile', old); } } catch { /* */ }
    try { const r = JSON.parse(localStorage.getItem('dg_voice_ref') || 'null'); if (r) await db.kvSet('voiceRef', b64ToF32(r)); } catch { /* */ }
  }
  try { profile = raw ? deserializeProfile(raw) : null; } catch { profile = null; }
  return profile;
}
export const getProfile = () => profile;
export async function saveProfile(p) {
  profile = p;
  const raw = { name: p.name, center: p.center, date: p.date, sources: Object.fromEntries(Object.entries(p.sources).map(([k, s]) => [k, { noise: !!s.noise, f0: s.f0, data: s.data }])) };
  await db.kvSet('voiceProfile', raw);
  emit('profile', p);
}
export async function deleteProfile() { profile = null; await db.kvSet('voiceProfile', null); await db.kvSet('voiceRef', null); emit('profile', null); }
export async function saveRef(x22) { await db.kvSet('voiceRef', x22); }
export async function loadRef() { return db.kvGet('voiceRef', null); }

// Qué voz canta la letra según los ajustes
export function singer() {
  const who = state.voice.who === 'auto' ? (profile ? 'mine' : 'dg') : state.voice.who;
  if (who === 'none') return null;
  if (who === 'mine' && profile) return profile;
  return defaultProfile();
}
export const singerName = (p) => (!p ? 'nadie' : p === profile ? 'tu voz' : 'la Voz DG');
