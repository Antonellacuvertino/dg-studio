// ===============================================================
//  Voz cantada: convierte la letra escrita en voz (cantada o rapeada)
//  usando el timbre de TU voz (perfil grabado) o una voz sintética.
//  Técnica: TD-PSOLA (granos de tu voz recolocados a la altura de
//  cada nota) + consonantes sintetizadas. Todo local, sin internet.
// ===============================================================
import { GENRES, SCALES, degSemi, chordDegAt, rng, pick } from './engine.js';

export const SR = 44100;
export const SOUNDS = ['a', 'e', 'i', 'o', 'u', 'm', 's'];
const RAP = new Set(['trap', 'drill', 'hiphop', 'dembow']);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const ftom = (f) => 69 + 12 * Math.log2(f / 440);

// ---------------------------------------------------------------
//  Preparar una muestra de voz (vocal sostenida) para PSOLA
// ---------------------------------------------------------------
export async function toMono44(buffer) {
  const oc = new OfflineAudioContext(1, Math.ceil(buffer.duration * SR), SR);
  const s = oc.createBufferSource(); s.buffer = buffer; s.connect(oc.destination); s.start();
  return (await oc.startRendering()).getChannelData(0);
}

function detectF0(seg) {
  const N = Math.min(4096, seg.length - 1200); if (N < 1024) return null;
  const off = Math.floor((seg.length - N) / 2);
  const lo = Math.floor(SR / 800), hi = Math.floor(SR / 70);
  const r = new Float32Array(hi + 1); let e0 = 0;
  for (let i = 0; i < N; i++) e0 += seg[off + i] * seg[off + i];
  let best = 0, bl = 0;
  for (let L = lo; L <= hi; L++) {
    let s = 0; for (let i = 0; i < N; i++) s += seg[off + i] * seg[off + i + L];
    r[L] = s; if (s > best) { best = s; bl = L; }
  }
  if (!bl || best / e0 < 0.3) return null;
  // evitar errores de octava: preferir el periodo más corto casi igual de fuerte
  for (let d = 4; d >= 2; d--) { const L = Math.round(bl / d); if (L >= lo && r[L] > 0.95 * best) { bl = L; break; } }
  return SR / bl;
}

export function prepSource(x, voiced = true) {
  const L = Math.min(x.length, Math.floor(0.8 * SR));
  let best = -1, bs = 0;
  for (let s = 0; s + L <= x.length; s += 1024) { let e = 0; for (let i = s; i < s + L; i += 4) e += x[i] * x[i]; if (e > best) { best = e; bs = s; } }
  let seg = Float32Array.from(x.subarray(bs, bs + L));
  let pk = 0; for (const v of seg) pk = Math.max(pk, Math.abs(v));
  if (pk < 0.01) return null;
  for (let i = 0; i < seg.length; i++) seg[i] *= 0.9 / pk;
  if (!voiced) return { data: seg, noise: true };
  const f0 = detectF0(seg); if (!f0) return null;
  return markSource(seg, f0);
}
function markSource(seg, f0) {
  const T = SR / f0; const marks = [];
  let m = 0, mv = -2; for (let i = 0; i < T; i++) if (seg[i] > mv) { mv = seg[i]; m = i; }
  for (;;) {
    marks.push(m);
    const lo = Math.round(m + 0.8 * T), hi = Math.min(seg.length - 1, Math.round(m + 1.2 * T));
    if (lo >= seg.length - 1) break;
    let bm = lo, bv = -2; for (let i = lo; i <= hi; i++) if (seg[i] > bv) { bv = seg[i]; bm = i; }
    m = bm;
  }
  return { data: seg, marks, T, f0 };
}

// ---------------------------------------------------------------
//  Voz sintética por defecto ("Voz DG") — formantes
// ---------------------------------------------------------------
function biquad(type, f, q) {
  const w = (2 * Math.PI * f) / SR, cs = Math.cos(w), sn = Math.sin(w), a = sn / (2 * q);
  let b0, b1, b2;
  if (type === 'bp') { b0 = a; b1 = 0; b2 = -a; } else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; } else { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; }
  const a0 = 1 + a, a1 = -2 * cs, a2 = 1 - a;
  const B0 = b0 / a0, B1 = b1 / a0, B2 = b2 / a0, A1 = a1 / a0, A2 = a2 / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => { const y = B0 * x + B1 * x1 + B2 * x2 - A1 * y1 - A2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}
const FORM = {
  a: [[800, 1], [1200, 0.55], [2800, 0.2]], e: [[450, 1], [2000, 0.4], [2750, 0.22]], i: [[300, 1], [2300, 0.35], [3000, 0.3]],
  o: [[480, 1], [850, 0.6], [2700, 0.12]], u: [[330, 1], [750, 0.35], [2600, 0.08]], m: [[260, 1], [1250, 0.05], [2500, 0.03]],
};
let _default = null;
export function defaultProfile() {
  if (_default) return _default;
  const f0 = 215, T = SR / f0, len = Math.floor(0.8 * SR);
  const sources = {};
  Object.entries(FORM).forEach(([k, fs]) => {
    const glot = new Float32Array(len); let ph = 0, prev = 0;
    for (let i = 0; i < len; i++) {
      const tt = ph / T; const g = tt < 0.4 ? 0.5 * (1 - Math.cos((Math.PI * tt) / 0.4)) : tt < 0.56 ? Math.cos((Math.PI * (tt - 0.4)) / 0.32) : 0;
      glot[i] = g - prev + (Math.random() - 0.5) * 0.02; prev = g;
      ph += 1 + 0.003 * Math.sin(i / 900); if (ph >= T) ph -= T;
    }
    const filters = fs.map(([f, a]) => [biquad('bp', f, f / 90), a]);
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) { let s = 0; filters.forEach(([bq, a]) => (s += bq(glot[i]) * a)); out[i] = s; }
    let pk = 0; out.forEach((v) => (pk = Math.max(pk, Math.abs(v)))); for (let i = 0; i < len; i++) out[i] *= 0.9 / pk;
    sources[k] = markSource(out, f0);
  });
  const hp = biquad('hp', 5200, 0.7); const sn = new Float32Array(len); for (let i = 0; i < len; i++) sn[i] = hp(Math.random() * 2 - 1) * 0.8;
  sources.s = { data: sn, noise: true };
  _default = { name: 'Voz DG', center: ftom(f0) + 2, sources };
  return _default;
}

// ---------------------------------------------------------------
//  Guardar / cargar perfil
// ---------------------------------------------------------------
export function f32ToB64(a) {
  const i16 = new Int16Array(a.length); for (let i = 0; i < a.length; i++) i16[i] = Math.max(-1, Math.min(1, a[i])) * 32767;
  const u8 = new Uint8Array(i16.buffer); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
export function b64ToF32(b) {
  const s = atob(b); const u8 = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  const i16 = new Int16Array(u8.buffer); return Float32Array.from(i16, (v) => v / 32767);
}
export function serializeProfile(p) {
  return { name: p.name, center: p.center, date: p.date, sources: Object.fromEntries(Object.entries(p.sources).map(([k, s]) => [k, { noise: !!s.noise, f0: s.f0, data: f32ToB64(s.data) }])) };
}
export function deserializeProfile(o) {
  if (!o || !o.sources) return null;
  const sources = {};
  Object.entries(o.sources).forEach(([k, s]) => { const d = b64ToF32(s.data); sources[k] = s.noise ? { data: d, noise: true } : markSource(d, s.f0); });
  return { name: o.name, center: o.center, date: o.date, sources };
}
export function finishProfile(sources, name) {
  const f0s = SOUNDS.filter((k) => sources[k] && !sources[k].noise && k !== 'm').map((k) => sources[k].f0).sort((a, b) => a - b);
  const med = f0s[Math.floor(f0s.length / 2)] || 200;
  // corregir errores de octava: todas las vocales a la misma altura base
  Object.keys(sources).forEach((k) => {
    const src = sources[k]; if (!src || src.noise) return;
    const ratio = src.f0 / med;
    if (ratio > 1.7 && ratio < 2.3) sources[k] = markSource(src.data, src.f0 / 2);
    else if (ratio > 0.43 && ratio < 0.59) sources[k] = markSource(src.data, src.f0 * 2);
  });
  return { name, center: ftom(med) + 2, date: Date.now(), sources };
}

// ---------------------------------------------------------------
//  Letra -> sílabas con fonemas (español)
// ---------------------------------------------------------------
const STRONG = (p) => 'aeo'.includes(p.c) || (p.acc && 'iu'.includes(p.c));
const CLUSTER = /^[pbfkgtd][lr]$/;
function phonemize(w) {
  const ph = []; const V = 'aeiouáéíóú';
  for (let i = 0; i < w.length; i++) {
    const c = w[i], n = w[i + 1] || '', n2 = w[i + 2] || '';
    const ai = 'áéíóú'.indexOf(c);
    if (ai >= 0) { ph.push({ c: 'aeiou'[ai], v: true, acc: true }); continue; }
    if ('aeiou'.includes(c)) { ph.push({ c, v: true }); continue; }
    if (c === 'ü' || c === 'w') { ph.push({ c: 'u', v: true }); continue; }
    if (c === 'q' && n === 'u') { ph.push({ c: 'k' }); i++; continue; }
    if (c === 'g' && n === 'u' && 'eiéí'.includes(n2)) { ph.push({ c: 'g' }); i++; continue; }
    if (c === 'c' && n === 'h') { ph.push({ c: 'C' }); i++; continue; }
    if (c === 'l' && n === 'l') { ph.push({ c: 'Y' }); i++; continue; }
    if (c === 'r' && n === 'r') { ph.push({ c: 'R' }); i++; continue; }
    if (c === 'r' && i === 0) { ph.push({ c: 'R' }); continue; }
    if (c === 'c') { ph.push({ c: 'eiéí'.includes(n) ? 's' : 'k' }); continue; }
    if (c === 'g') { ph.push({ c: 'eiéí'.includes(n) ? 'x' : 'g' }); continue; }
    if (c === 'z') { ph.push({ c: 's' }); continue; }
    if (c === 'j') { ph.push({ c: 'x' }); continue; }
    if (c === 'h') continue;
    if (c === 'v') { ph.push({ c: 'b' }); continue; }
    if (c === 'x') { ph.push({ c: 'k' }, { c: 's' }); continue; }
    if (c === 'ñ') { ph.push({ c: 'N' }); continue; }
    if (c === 'y') { if (V.includes(n)) ph.push({ c: 'Y' }); else ph.push({ c: 'i', v: true }); continue; }
    ph.push({ c });
  }
  return ph;
}
function syllabifyWord(w) {
  const ph = phonemize(w);
  // núcleos
  const nuc = []; let i = 0;
  while (i < ph.length) {
    if (!ph[i].v) { i++; continue; }
    let j = i + 1; while (j < ph.length && ph[j].v) j++;
    let s = i;
    for (let k = i + 1; k < j; k++) if (STRONG(ph[k]) && STRONG(ph[k - 1])) { nuc.push([s, k]); s = k; }
    nuc.push([s, j]); i = j;
  }
  if (!nuc.length) return [];
  const syl = nuc.map(([a, b]) => ({ on: [], nuc: ph.slice(a, b), co: [] }));
  syl[0].on = ph.slice(0, nuc[0][0]).map((p) => p.c);
  for (let k = 0; k < nuc.length - 1; k++) {
    const cons = ph.slice(nuc[k][1], nuc[k + 1][0]).map((p) => p.c);
    let split;
    if (cons.length <= 1) split = 0;
    else if (cons.length === 2) split = CLUSTER.test(cons.join('')) ? 0 : 1;
    else split = CLUSTER.test(cons.slice(-2).join('')) ? cons.length - 2 : cons.length - 1;
    syl[k].co = cons.slice(0, split); syl[k + 1].on = cons.slice(split);
  }
  syl[syl.length - 1].co = ph.slice(nuc[nuc.length - 1][1]).map((p) => p.c);
  // acento
  let st = syl.findIndex((s) => s.nuc.some((p) => p.acc));
  if (st < 0) st = /[aeiouns]$/.test(w.normalize('NFD').replace(/[̀-ͯ]/g, '')) && syl.length > 1 ? syl.length - 2 : syl.length - 1;
  syl.forEach((s, k) => {
    s.stressed = k === st;
    const vs = s.nuc; let mi = vs.findIndex((p) => STRONG(p)); if (mi < 0) mi = vs.length - 1;
    s.vowel = vs[mi].c; s.glideIn = mi > 0 ? vs[0].c : null; s.glideOut = mi < vs.length - 1 ? vs[vs.length - 1].c : null;
  });
  return syl;
}
export function syllabifyLine(text) {
  const out = [];
  text.toLowerCase().split(/\s+/).forEach((w) => {
    const clean = w.replace(/[^a-záéíóúüñ]/g, '');
    if (clean) syllabifyWord(clean).forEach((s, k, arr) => out.push({ ...s, wordEnd: k === arr.length - 1 }));
  });
  return out;
}

// ---------------------------------------------------------------
//  Melodía / flow sobre el beat
// ---------------------------------------------------------------
export function planVocals(song, profile, styleOverride) {
  const G = GENRES[song.genre]; const scale = SCALES[song.mode];
  const style = styleOverride || (RAP.has(song.genre) ? 'rap' : 'sung');
  const step = 60 / song.bpm / 4, barDur = step * 16;
  const center = Math.round(profile.center);
  const r = rng(song.seed + 1234);
  const ladder = [];
  for (let m = center - 9; m <= center + 9; m++) if (scale.some((s) => (song.root + s) % 12 === ((m % 12) + 12) % 12)) ladder.push(m);
  const nearestIdx = (m) => ladder.reduce((bi, v, i) => (Math.abs(v - m) < Math.abs(ladder[bi] - m) ? i : bi), 0);
  const chordPcs = (bar) => { const d = chordDegAt(song, bar); return [d, d + 2, d + 4].map((x) => (song.root + degSemi(scale, x)) % 12); };
  const memo = {};
  const notes = [];
  song.timeline.forEach((line) => {
    const syl = syllabifyLine(line.text); const n = syl.length; if (!n) return;
    const steps = line.bars * 16;
    let unit;
    if (style === 'rap') unit = n * 2 <= steps * 0.9 ? 2 : n <= steps ? 1 : steps / n;
    else unit = n * 2 <= steps * 0.75 ? 2 : n <= steps * 0.9 ? 1 : steps / n;
    const startBar = Math.round(line.time / barDur);
    // melodía: memorizada por texto (los coros repiten la misma)
    let mel = memo[line.text];
    if (!mel) {
      mel = []; let idx = nearestIdx(center);
      for (let k = 0; k < n; k++) {
        const pos = k * unit; const bar = startBar + Math.floor(pos / 16);
        if (style === 'rap') {
          const decl = -2 * (k / Math.max(1, n - 1));
          mel.push(center - 2 + decl + (syl[k].stressed ? 1.5 : 0) + (r() - 0.5) * 0.6);
          continue;
        }
        const pcs = chordPcs(bar);
        const strong = pos % 4 === 0 || k === 0 || k === n - 1;
        if (strong) {
          // nota del acorde más cercana
          let bi = idx, bd = 99;
          ladder.forEach((m, i) => { if (pcs.includes(((m % 12) + 12) % 12) && Math.abs(i - idx) < bd) { bd = Math.abs(i - idx); bi = i; } });
          idx = bi;
        } else {
          const arch = k < n / 2 ? 1 : -1;
          idx += pick(r, [arch, arch, 0, -arch, arch * 2]);
        }
        idx = Math.max(1, Math.min(ladder.length - 2, idx));
        mel.push(ladder[idx]);
      }
      memo[line.text] = mel;
    }
    for (let k = 0; k < n; k++) {
      const pos = k * unit;
      let len = unit;
      if (k === n - 1) len = Math.min(steps - pos, style === 'rap' ? unit * 2 : Math.max(unit * 3, 6));
      else if (style === 'sung' && syl[k].stressed && syl[k].wordEnd && unit >= 2) len = unit;
      notes.push({ t: line.time + pos * step, dur: Math.max(0.06, len * step * 0.95), midi: mel[k], syl: syl[k], style });
    }
  });
  return notes;
}

// ---------------------------------------------------------------
//  Síntesis (PSOLA)
// ---------------------------------------------------------------
function psola(out, start, len, src, f0fn, gain, att = 0.012, rel = 0.035, am = null) {
  if (!src || len <= 0) return;
  if (src.noise) return noiseFrom(out, start, len, src.data, gain);
  const { data, marks, T } = src; const W = Math.round(T);
  const usable = marks.filter((m) => m - W >= 0 && m + W < data.length);
  if (usable.length < 3) return;
  let pos = 0, sp = Math.floor(usable.length * 0.3), dir = 1, acc = 0;
  const A = att * SR, R = rel * SR;
  while (pos < len) {
    const f = f0fn(pos / SR); const P = SR / f;
    let e = Math.min(1, pos / A, (len - pos) / R);
    if (am) e *= am(pos / SR);
    if (e > 0) {
      const m = usable[sp]; const k0 = start + Math.round(pos); const gg = e * gain * Math.min(1.6, P / T);
      for (let j = -W; j < W; j++) {
        const k = k0 + j; if (k < 0 || k >= out.length) continue;
        out[k] += data[m + j] * (0.5 - 0.5 * Math.cos((Math.PI * (j + W)) / W)) * gg;
      }
    }
    pos += P; acc += P;
    while (acc >= T) { acc -= T; sp += dir; if (sp >= usable.length - 1) { dir = -1; sp = usable.length - 2; } if (sp <= 0) { dir = 1; sp = 1; } }
  }
}
function noiseFrom(out, start, len, data, gain, filt = null) {
  const off = Math.floor(Math.random() * Math.max(1, data.length - len - 1));
  const A = Math.min(len * 0.3, 0.012 * SR), R = Math.min(len * 0.5, 0.03 * SR);
  for (let i = 0; i < len; i++) {
    const k = start + i; if (k < 0 || k >= out.length) continue;
    let v = data[(off + i) % data.length]; if (filt) v = filt(v);
    out[k] += v * gain * Math.min(1, i / A, (len - i) / R);
  }
}
const WHITE = Float32Array.from({ length: SR }, () => Math.random() * 2 - 1);
const PLOS = { p: 900, b: 900, t: 3800, d: 3000, k: 2000, g: 1800, C: 2800 };
const CONS_LEN = (c) => ('ptkbdg'.includes(c) ? 0.05 : 'sfxC'.includes(c) ? 0.08 : 'mnN'.includes(c) ? 0.06 : c === 'R' ? 0.08 : c === 'r' ? 0.03 : 0.05);

function consonant(out, start, len, c, prof, f0fn, vowel) {
  const S = prof.sources;
  if ('ptkbdgC'.includes(c)) {
    const voicedC = 'bdg'.includes(c);
    if (voicedC) psola(out, start, Math.floor(len * 0.7), S.m, f0fn, 0.15);
    const bl = Math.floor(0.014 * SR);
    noiseFrom(out, start + len - bl, bl, WHITE, voicedC ? 0.12 : 0.22, biquad('bp', PLOS[c], 1.2));
    if (c === 'C') noiseFrom(out, start + len - bl, Math.floor(0.06 * SR), WHITE, 0.18, biquad('bp', 2800, 1.5));
  } else if (c === 's') {
    noiseFrom(out, start, len, S.s ? S.s.data : WHITE, S.s ? 0.28 : 0.15, S.s ? null : biquad('hp', 5000, 0.7));
  } else if (c === 'f') {
    noiseFrom(out, start, len, WHITE, 0.1, biquad('bp', 4500, 0.8));
  } else if (c === 'x') {
    noiseFrom(out, start, len, WHITE, 0.16, biquad('bp', 1800, 1.2));
  } else if ('mnN'.includes(c) || c === 'l') {
    psola(out, start, len, S.m, f0fn, c === 'l' ? 0.45 : 0.6, 0.008, 0.015);
  } else if (c === 'Y') {
    psola(out, start, len, S.i, f0fn, 0.6, 0.008, 0.01);
  } else if (c === 'r' || c === 'R') {
    const rate = 28;
    psola(out, start, len, S[vowel] || S.a, f0fn, 0.5, 0.005, 0.005, (t) => 0.35 + 0.65 * Math.abs(Math.cos(Math.PI * rate * t)));
  }
}

export function renderVocals(notes, profile, totalSec) {
  const out = new Float32Array(Math.ceil(totalSec * SR));
  const S = profile.sources;
  let prev = null, prevEnd = -1;
  notes.forEach((n) => {
    const s = n.syl; const start = Math.floor(n.t * SR); const durS = Math.floor(n.dur * SR);
    const cscale = Math.min(1, n.dur / 0.22);
    const legato = prev != null && n.t - prevEnd < 0.08;
    const from = legato ? prev : n.midi;
    const f0At = (t0) => (t) => {
      const t2 = t + t0; let m = n.midi;
      if (from !== n.midi && t2 < 0.06 && Math.abs(from - n.midi) < 8) m = from + (n.midi - from) * Math.max(0, t2 / 0.06);
      if (n.style === 'sung' && n.dur > 0.32 && t2 > 0.16) m += 0.28 * Math.sin(2 * Math.PI * 5.4 * (t2 - 0.16)) * Math.min(1, (t2 - 0.16) / 0.2);
      return mtof(m);
    };
    const gain = (s.stressed ? 1 : 0.82) * (n.style === 'rap' ? 1.05 : 1);
    // consonantes de ataque: terminan justo en el tiempo de la nota
    const onLens = s.on.map((c) => Math.floor(CONS_LEN(c) * cscale * SR));
    let cpos = start - onLens.reduce((a, b) => a + b, 0);
    s.on.forEach((c, i) => { consonant(out, cpos, onLens[i], c, profile, f0At(-(start - cpos) / SR), s.vowel); cpos += onLens[i]; });
    // vocal (con deslizamiento si es diptongo)
    const coLens = s.co.map((c) => Math.floor(CONS_LEN(c) * cscale * 0.8 * SR));
    const coTot = coLens.reduce((a, b) => a + b, 0);
    const vLen = Math.max(Math.floor(0.04 * SR), durS - coTot);
    let vStart = start, vL = vLen;
    if (s.glideIn && S[s.glideIn]) { const gl = Math.min(Math.floor(0.05 * SR), Math.floor(vLen * 0.3)); psola(out, start, gl + 200, S[s.glideIn], f0At(0), gain * 0.9, 0.008, 0.02); vStart += Math.floor(gl * 0.7); vL -= Math.floor(gl * 0.7); }
    let gOut = 0;
    if (s.glideOut && S[s.glideOut]) gOut = Math.min(Math.floor(0.06 * SR), Math.floor(vL * 0.3));
    psola(out, vStart, vL - Math.floor(gOut * 0.6), S[s.vowel], f0At((vStart - start) / SR), gain);
    if (gOut) psola(out, vStart + vL - gOut, gOut, S[s.glideOut], f0At((vStart + vL - gOut - start) / SR), gain * 0.85, 0.02, 0.02);
    // consonantes finales
    let p2 = start + vLen;
    s.co.forEach((c, i) => { consonant(out, p2, coLens[i], c, profile, f0At((p2 - start) / SR), s.vowel); p2 += coLens[i]; });
    prev = n.midi; prevEnd = n.t + n.dur;
  });
  let pk = 0; for (let i = 0; i < out.length; i++) pk = Math.max(pk, Math.abs(out[i]));
  if (pk > 0) for (let i = 0; i < out.length; i++) out[i] *= 0.85 / pk;
  const buf = new AudioBuffer({ length: out.length, numberOfChannels: 1, sampleRate: SR });
  buf.copyToChannel(out, 0);
  return buf;
}

// Demostración corta para escuchar el perfil
export function demoVocals(profile) {
  const fake = { genre: 'pop', mode: 'major', root: 0, bpm: 100, seed: 3, prog: [0, 4, 5, 3],
    timeline: [{ text: 'hola esta es mi voz', time: 0.1, bars: 2 }, { text: 'cantando lo que escribo yo', time: 0.1 + 2.4, bars: 2 }] };
  const notes = planVocals(fake, profile, 'sung');
  return renderVocals(notes, profile, 5.6);
}
