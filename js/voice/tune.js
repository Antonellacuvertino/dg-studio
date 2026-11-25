// ===============================================================
//  Autotune para voces grabadas (tu voz real):
//  1) detecta la altura de la voz cada ~12 ms
//  2) la acerca a la nota más cercana de la escala (cantidad + velocidad)
//  3) re-sintetiza con PSOLA (cambia la altura sin cambiar la velocidad)
// ===============================================================
import { SCALES } from '../engine/engine.js';
import { toMono44 } from './voice.js';

const SR = 44100;
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang), h = len >> 1;
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let j = 0; j < h; j++) { const a = i + j, b = a + h; const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr; re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } }
  }
}

// Seguimiento de altura (en 22 kHz para ir rápido)
export async function trackPitch(x, onProgress) {
  const ds = 2, sr = SR / ds, H = 256, W = 1024, N = 2048;
  const y = new Float32Array(Math.floor(x.length / ds)); for (let i = 0; i < y.length; i++) y[i] = (x[i * 2] + x[i * 2 + 1]) * 0.5;
  const frames = Math.max(1, Math.floor((y.length - W) / H));
  const f0 = new Float32Array(frames); const rms = new Float32Array(frames);
  const re = new Float32Array(N), im = new Float32Array(N);
  let maxR = 0;
  for (let f = 0; f < frames; f++) { let e = 0; const o = f * H; for (let i = 0; i < W; i += 2) e += y[o + i] * y[o + i]; rms[f] = Math.sqrt(e / (W / 2)); if (rms[f] > maxR) maxR = rms[f]; }
  const thr = maxR * 0.06; const lo = Math.floor(sr / 900), hi = Math.floor(sr / 70);
  for (let f = 0; f < frames; f++) {
    if (rms[f] < thr) continue;
    const o = f * H;
    for (let i = 0; i < N; i++) { re[i] = i < W ? y[o + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / W)) : 0; im[i] = 0; }
    fft(re, im); for (let i = 0; i < N; i++) { re[i] = re[i] * re[i] + im[i] * im[i]; im[i] = 0; } fft(re, im);
    const r0 = re[0] || 1; let bl = 0, bv = 0;
    for (let L = lo; L < hi; L++) { const v = re[L] / r0; if (v > bv) { bv = v; bl = L; } }
    for (let d = 3; d >= 2; d--) { const L = Math.round(bl / d); if (L >= lo && re[L] / r0 > 0.9 * bv) { bl = L; break; } }
    if (bv > 0.45 && bl > 1) { const a = re[bl - 1], b = re[bl], c = re[bl + 1]; const p = 0.5 * (a - c) / (a - 2 * b + c || 1); f0[f] = sr / (bl + Math.max(-0.5, Math.min(0.5, p))); }
    if (f % 400 === 399) { onProgress && onProgress(f / frames); await new Promise((r) => setTimeout(r)); }
  }
  // mediana para quitar saltos
  const sm = Float32Array.from(f0);
  for (let f = 2; f < frames - 2; f++) { if (!f0[f]) continue; const w = [f0[f - 2], f0[f - 1], f0[f], f0[f + 1], f0[f + 2]].filter(Boolean).sort((a, b) => a - b); sm[f] = w[Math.floor(w.length / 2)]; }
  return { f0: sm, hop: H * ds, frames };
}

const nearestScale = (m, root, mode) => {
  const sc = SCALES[mode] || SCALES.minor; let best = Math.round(m), bd = 99;
  for (let c = Math.floor(m) - 2; c <= Math.ceil(m) + 2; c++) { const pc = (((c - root) % 12) + 12) % 12; if (sc.includes(pc) && Math.abs(c - m) < bd) { bd = Math.abs(c - m); best = c; } }
  return best;
};

/**
 * amount 0..1: cuánto se corrige (0 = nada, 1 = total)
 * speed 0..1: 0 = lento/natural, 1 = instantáneo (efecto robótico)
 * transpose: semitonos
 */
export async function autotune(buffer, { root = 9, mode = 'minor', amount = 0.8, speed = 0.7, transpose = 0, formant = 1, onProgress = null } = {}) {
  const x = await toMono44(buffer);
  const { f0, hop, frames } = await trackPitch(x, (p) => onProgress && onProgress(p * 0.6));
  // corrección por cuadro (suavizada según la velocidad)
  const tc = 0.002 + Math.pow(1 - speed, 2) * 0.2; const alpha = 1 - Math.exp(-hop / (SR * tc));
  const ratio = new Float32Array(frames); let corr = 0;
  for (let f = 0; f < frames; f++) {
    if (!f0[f]) { corr *= 0.9; ratio[f] = Math.pow(2, transpose / 12); continue; }
    const m = 69 + 12 * Math.log2(f0[f] / 440);
    const target = (nearestScale(m, root, mode) - m) * amount;
    corr += (target - corr) * alpha;
    ratio[f] = Math.pow(2, (corr + transpose) / 12);
  }
  onProgress && onProgress(0.65);
  // marcas de análisis
  const marks = []; let i = 0;
  const frameOf = (p) => Math.min(frames - 1, Math.max(0, Math.floor(p / hop)));
  while (i < x.length) {
    const f = frameOf(i);
    if (f0[f]) {
      const T = SR / f0[f]; const lo = Math.max(0, Math.floor(i - 0.2 * T)), hi = Math.min(x.length - 1, Math.floor(i + 0.2 * T));
      let bm = i, bv = -2; for (let k = lo; k <= hi; k++) if (x[k] > bv) { bv = x[k]; bm = k; }
      marks.push({ p: bm, T, v: true }); i = bm + Math.max(20, Math.round(T));
    } else { marks.push({ p: i, T: 220, v: false }); i += 220; }
  }
  // re-síntesis PSOLA
  const out = new Float32Array(x.length + 4096);
  let tOut = 0, mi = 0;
  while (tOut < x.length) {
    while (mi < marks.length - 1 && Math.abs(marks[mi + 1].p - tOut) < Math.abs(marks[mi].p - tOut)) mi++;
    const m = marks[mi]; const r = m.v ? ratio[frameOf(m.p)] : 1;
    const F = m.v ? formant : 1; const W = Math.max(8, Math.round(m.T / F)); const P = m.T / r; const g = Math.min(1.5, P / W);
    const c = Math.round(tOut);
    for (let j = -W; j < W; j++) {
      const sp = m.p + j * F, dst = c + j; const si = Math.floor(sp); if (si < 0 || si + 1 >= x.length || dst < 0) continue;
      const fr = sp - si; out[dst] += (x[si] * (1 - fr) + x[si + 1] * fr) * (0.5 - 0.5 * Math.cos((Math.PI * (j + W)) / W)) * g;
    }
    tOut += P;
  }
  onProgress && onProgress(1);
  // igualar volumen
  let ein = 0, eout = 0; for (let k = 0; k < x.length; k += 4) { ein += x[k] * x[k]; eout += out[k] * out[k]; }
  const k = eout ? Math.sqrt(ein / eout) : 1;
  const res = new AudioBuffer({ length: x.length, numberOfChannels: 1, sampleRate: SR });
  const d = new Float32Array(x.length); for (let q = 0; q < x.length; q++) d[q] = Math.max(-1, Math.min(1, out[q] * k));
  res.copyToChannel(d, 0);
  return res;
}

// Detectar la tonalidad probable de una grabación (para afinar a esa escala)
export function detectKeyFromPitch(f0) {
  const hist = new Float32Array(12);
  f0.forEach((f) => { if (f) hist[((Math.round(69 + 12 * Math.log2(f / 440)) % 12) + 12) % 12]++; });
  let best = { root: 9, mode: 'minor', s: -1 };
  for (let r = 0; r < 12; r++) ['minor', 'major'].forEach((mode) => { const s = SCALES[mode].reduce((a, i) => a + hist[(r + i) % 12], 0) + hist[r] * 0.5; if (s > best.s) best = { root: r, mode, s }; });
  return best;
}
