// ===============================================================
//  Estado global y eventos entre secciones
// ===============================================================
import { db } from './db.js';

const listeners = {};
export const on = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); };
export const emit = (ev, data) => (listeners[ev] || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } });

// Ajustes de voz por defecto (Laboratorio de voz)
export const VOICE_DEFAULTS = {
  tune: 0.35,      // autotune: 0 natural · 1 robótico (efecto T-Pain)
  transpose: 0,    // semitonos
  vibrato: 0.5,
  humanize: 0.6,   // pequeñas variaciones naturales de afinación y tiempo
  breath: 0.3,     // aire / respiración
  double: 0.5,     // voces dobladas a los lados (coros)
  harmony: 0.3,    // armonía en el coro final
  adlibs: 0.5,     // ecos y repeticiones al final de las frases
  space: 0.4,      // reverb + delay de la voz
  style: 'auto',   // auto | sung | rap
  who: 'auto',     // auto | mine | dg | none
  type: 'natural', // tipo de voz (Mi voz natural, Otaku, Fina, Gruesa…)
  formant: 1,      // color de la voz: >1 más fina, <1 más gruesa
  rasp: 0,         // voz rasposa
  whisper: 0,      // susurro
};

export const state = {
  artist: 'differentgyal',
  voice: { ...VOICE_DEFAULTS },
  projectId: null,
  tab: 'create',
};

export async function loadState() {
  state.artist = await db.kvGet('artist', 'differentgyal');
  state.voice = { ...VOICE_DEFAULTS, ...(await db.kvGet('voiceSettings', {})) };
  state.projectId = await db.kvGet('projectId', null);
}
export async function saveVoiceSettings() { await db.kvSet('voiceSettings', state.voice); emit('voiceSettings', state.voice); }
export async function setArtist(name) { state.artist = name; await db.kvSet('artist', name); emit('artist', name); }
