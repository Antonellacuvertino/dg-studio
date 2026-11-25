// ===============================================================
//  MULTIPISTA: audios sobre una línea de tiempo (como un DAW).
//  proyecto = { id, name, bpm, tracks: [{ id, name, color, vol, pan, mute, solo, reverb,
//               clips: [{ id, sampleId, name, start, offset, dur, gain, fadeIn, fadeOut }] }] }
//  Todos los tiempos en segundos. El audio de cada clip vive en "Mis sonidos".
// ===============================================================
import { db } from '../core/db.js';
import { audio } from '../core/audio.js';
import { uid } from '../core/ui.js';
import { makeReverb } from '../engine/synth.js';
import { sampleBuffer } from '../studio/samples.js';

const COLORS = ['#ff2d4b', '#ffc23d', '#3ee08f', '#4dabff', '#c77dff', '#ff7a1a', '#e0aa55', '#2ed1e6'];
export const newMulti = (name = 'Mi mezcla') => ({ id: uid(), name, bpm: 120, created: Date.now(), updated: Date.now(), tracks: [] });
export function newLane(p, name) {
  const t = { id: uid(), name: name || `Pista ${p.tracks.length + 1}`, color: COLORS[p.tracks.length % COLORS.length], vol: 0.9, pan: 0, mute: false, solo: false, reverb: 0, clips: [] };
  p.tracks.push(t); return t;
}
export function addClip(p, lane, { sampleId, name, dur, start = 0 }) {
  const c = { id: uid(), sampleId, name, start, offset: 0, dur, gain: 1, fadeIn: 0.01, fadeOut: 0.02 };
  lane.clips.push(c); return c;
}
export const multiLength = (p) => Math.max(10, ...p.tracks.flatMap((t) => t.clips.map((c) => c.start + c.dur)));
export const saveMulti = (p) => { p.updated = Date.now(); return db.put('multis', p); };
export const listMultis = async () => (await db.all('multis')).sort((a, b) => b.updated - a.updated);

async function buffers(p) {
  const ids = [...new Set(p.tracks.flatMap((t) => t.clips.map((c) => c.sampleId)))];
  const m = new Map(); await Promise.all(ids.map(async (id) => { const b = await sampleBuffer(id); if (b) m.set(id, b); })); return m;
}

// Construir el grafo (sirve para tocar en vivo y para exportar)
function build(ctx, p, bufs, from, t0) {
  const master = ctx.createGain(); master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -8; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
  const an = ctx.createAnalyser(); an.fftSize = 512;
  master.connect(comp).connect(an).connect(ctx.destination);
  const rev = makeReverb(ctx, 0.5); rev.out.connect(master);
  const anySolo = p.tracks.some((t) => t.solo);
  const sources = []; const lanes = new Map();
  p.tracks.forEach((t) => {
    const g = ctx.createGain(); g.gain.value = t.mute || (anySolo && !t.solo) ? 0 : t.vol;
    const pan = ctx.createStereoPanner(); pan.pan.value = t.pan || 0;
    const rs = ctx.createGain(); rs.gain.value = t.reverb || 0;
    g.connect(pan).connect(master); g.connect(rs).connect(rev);
    lanes.set(t.id, g);
    t.clips.forEach((c) => {
      const b = bufs.get(c.sampleId); if (!b) return;
      const end = c.start + c.dur; if (end <= from) return;
      const skip = Math.max(0, from - c.start);
      const when = t0 + Math.max(0, c.start - from);
      const s = ctx.createBufferSource(); s.buffer = b;
      const cg = ctx.createGain(); const dur = c.dur - skip;
      const fi = Math.min(c.fadeIn || 0, c.dur / 2), fo = Math.min(c.fadeOut || 0, c.dur / 2);
      cg.gain.setValueAtTime(skip < fi ? 0.0001 : c.gain, when);
      if (skip < fi) cg.gain.linearRampToValueAtTime(c.gain, when + (fi - skip));
      cg.gain.setValueAtTime(c.gain, Math.max(when, when + dur - fo));
      cg.gain.linearRampToValueAtTime(0.0001, when + dur);
      s.connect(cg).connect(g);
      s.start(when, c.offset + skip, dur); sources.push(s);
    });
  });
  return { master, an, sources, lanes };
}

// ---------- reproducción en vivo ----------
export const multiPlayer = {
  playing: false, start: 0, from: 0, graph: null, p: null,
  async play(p, from = 0) {
    this.stop();
    const ctx = audio(); const bufs = await buffers(p);
    const t0 = ctx.currentTime + 0.08;
    this.graph = build(ctx, p, bufs, from, t0); this.p = p;
    this.start = t0; this.from = from; this.playing = true;
  },
  pos() { return this.playing ? this.from + Math.max(0, audio().currentTime - this.start) : this.from; },
  stop() {
    if (this.graph) { const g = this.graph; this.graph = null; g.sources.forEach((s) => { try { s.stop(); } catch { /* */ } }); g.master.gain.setTargetAtTime(0, audio().currentTime, 0.01); setTimeout(() => { try { g.master.disconnect(); } catch { /* */ } }, 200); }
    if (this.playing) this.from = this.pos();
    this.playing = false;
  },
  level() { if (!this.graph) return 0; const a = new Float32Array(512); this.graph.an.getFloatTimeDomainData(a); let m = 0; for (const v of a) m = Math.max(m, Math.abs(v)); return m; },
  // cambiar volumen de una pista mientras suena
  lane(t, p) { if (!this.graph) return; const g = this.graph.lanes.get(t.id); if (!g) return; const anySolo = p.tracks.some((x) => x.solo); p.tracks.forEach((x) => { const gg = this.graph.lanes.get(x.id); if (gg) gg.gain.setTargetAtTime(x.mute || (anySolo && !x.solo) ? 0 : x.vol, audio().currentTime, 0.02); }); },
};

// ---------- exportar ----------
export async function renderMulti(p) {
  const bufs = await buffers(p); const sr = 44100;
  const len = multiLength(p) + 1.5;
  const oc = new OfflineAudioContext(2, Math.ceil(len * sr), sr);
  build(oc, p, bufs, 0, 0);
  const out = await oc.startRendering();
  let pk = 0; for (let c = 0; c < 2; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i])); }
  if (pk > 0.98) { const k = 0.95 / pk; for (let c = 0; c < 2; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= k; } }
  return out;
}

// picos para dibujar la forma de onda de un clip
const peakCache = new Map();
export async function clipPeaks(sampleId, n = 400) {
  const key = sampleId + '|' + n; if (peakCache.has(key)) return peakCache.get(key);
  const b = await sampleBuffer(sampleId); if (!b) return null;
  const d = b.getChannelData(0); const per = Math.max(1, Math.floor(d.length / n)); const pk = new Float32Array(n);
  for (let i = 0; i < n; i++) { let m = 0; for (let j = i * per; j < Math.min(d.length, (i + 1) * per); j += 8) m = Math.max(m, Math.abs(d[j])); pk[i] = m; }
  const r = { pk, dur: b.duration }; peakCache.set(key, r); return r;
}
