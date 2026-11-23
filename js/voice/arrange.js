// ===============================================================
//  Mezcla automática de voces ("productor vocal"):
//  - voz principal al centro
//  - dobles a izquierda/derecha en los coros
//  - armonía (tercera arriba) en el último coro
//  - ad-libs: ecos de la última palabra de cada frase
//  - para grabaciones: corta frases y arma una canción más larga
// ===============================================================
import { SR, renderVocals, toBuffer } from './voice.js';

function addInto(dst, src, offset, gain) {
  for (let i = 0; i < src.length; i++) { const k = i + offset; if (k >= 0 && k < dst.length) dst[k] += src[i] * gain; }
}
// Eco con retroalimentación (para ad-libs y finales de frase)
function echo(x, delaySec, fb = 0.45, mix = 0.6) {
  const d = Math.floor(delaySec * SR); const y = Float32Array.from(x);
  for (let i = d; i < y.length; i++) y[i] += y[i - d] * fb;
  for (let i = 0; i < y.length; i++) y[i] = x[i] * (1 - mix) + y[i] * mix;
  return y;
}

export function renderVocalMix(song, notes, profile, settings, totalSec) {
  const L = new Float32Array(Math.ceil(totalSec * SR)); const R = new Float32Array(L.length);
  const main = renderVocals(notes, profile, totalSec, settings, 1);
  addInto(L, main, 0, 1); addInto(R, main, 0, 1);

  const chorus = notes.filter((n) => n.section === 'chorus' && !n.chop);
  // Dobles (coros) a los lados, con otra "toma" (variaciones distintas)
  if (settings.double > 0 && chorus.length) {
    const dl = renderVocals(chorus.map((n) => ({ ...n, midi: n.midi + 0.08 })), profile, totalSec, { ...settings, humanize: Math.max(0.5, settings.humanize) }, 2);
    const dr = renderVocals(chorus.map((n) => ({ ...n, midi: n.midi - 0.08 })), profile, totalSec, { ...settings, humanize: Math.max(0.5, settings.humanize) }, 3);
    const g = 0.55 * settings.double;
    addInto(L, dl, Math.floor(0.014 * SR), g); addInto(R, dr, Math.floor(0.022 * SR), g);
    addInto(R, dl, Math.floor(0.014 * SR), g * 0.25); addInto(L, dr, Math.floor(0.022 * SR), g * 0.25);
  }
  // Armonía en el último coro (una tercera arriba aprox.)
  if (settings.harmony > 0 && chorus.length) {
    const lastLines = new Set(chorus.slice(-Math.min(chorus.length, 40)).map((n) => n.line));
    const hn = chorus.filter((n) => lastLines.has(n.line)).map((n) => ({ ...n, midi: n.midi + (n.style === 'rap' ? 7 : 4) }));
    const hv = renderVocals(hn, profile, totalSec, settings, 4);
    addInto(L, hv, 0, 0.35 * settings.harmony); addInto(R, hv, Math.floor(0.008 * SR), 0.35 * settings.harmony);
  }
  // Ad-libs: la última palabra de cada frase repetida con eco
  if (settings.adlibs > 0) {
    const beat = 60 / song.bpm; const lines = {};
    notes.forEach((n) => { if (!n.chop) (lines[n.line] = lines[n.line] || []).push(n); });
    const ad = [];
    Object.values(lines).forEach((ns, i) => {
      if (i % 2 === 1) return; // en frases alternas
      const lastWord = []; for (let k = ns.length - 1; k >= 0; k--) { lastWord.unshift(ns[k]); if (k > 0 && ns[k - 1].syl.wordEnd) break; }
      const shift = (ns[ns.length - 1].t + ns[ns.length - 1].dur + beat * 0.5) - lastWord[0].t;
      lastWord.forEach((n) => ad.push({ ...n, t: n.t + shift, midi: n.midi + (i % 4 === 0 ? 0 : 5), section: 'adlib', line: 1000 + i }));
    });
    if (ad.length) {
      const av = echo(renderVocals(ad, profile, totalSec, { ...settings, breath: 0 }, 5), (60 / song.bpm) * 0.75, 0.4, 0.7);
      const g = 0.4 * settings.adlibs;
      addInto(L, av, 0, g); addInto(R, av, Math.floor(0.03 * SR), g * 0.6);
    }
  }
  let pk = 0; for (let i = 0; i < L.length; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
  if (pk > 0) { const k = 0.9 / pk; for (let i = 0; i < L.length; i++) { L[i] *= k; R[i] *= k; } }
  return toBuffer([L, R]);
}

// ---------------------------------------------------------------
//  Grabación libre → canción más larga (frases, gancho y chops)
// ---------------------------------------------------------------
export function arrangeRecording(voice, song, { introBars = 4, targetBars = 48, double = 0.5 } = {}) {
  const ch = voice.getChannelData(0); const sr = voice.sampleRate;
  const barS = Math.floor((60 / song.bpm) * 4 * sr), beatS = Math.floor(barS / 4);
  const vb = Math.max(1, Math.ceil(ch.length / barS));
  // gancho: los 2 compases con más energía
  let best = 0, hookStart = 0;
  for (let b = 0; b + 2 <= vb; b++) {
    let e = 0; for (let i = b * barS; i < Math.min(ch.length, (b + 2) * barS); i += 8) e += ch[i] * ch[i];
    if (e > best) { best = e; hookStart = b * barS; }
  }
  const hook = ch.subarray(hookStart, Math.min(ch.length, hookStart + 2 * barS));
  const plan = []; // {type, bars, kind:'full'|'hook'|'chop'|'none'}
  plan.push({ type: 'intro', bars: introBars, kind: 'chopIntro' });
  let used = introBars;
  const seq = [
    { type: 'verse', bars: vb, kind: 'full' }, { type: 'chorus', bars: 8, kind: 'hook' }, { type: 'verse', bars: 8, kind: 'chop' },
    { type: 'verse', bars: vb, kind: 'full' }, { type: 'chorus', bars: 8, kind: 'hook' }, { type: 'bridge', bars: 8, kind: 'chop' }, { type: 'chorus', bars: 8, kind: 'hook' },
  ];
  for (const s of seq) { if (used + s.bars > targetBars + 4 && plan.length > 2) break; plan.push(s); used += s.bars; }
  plan.push({ type: 'outro', bars: 4, kind: 'chopOut' });
  const total = plan.reduce((a, s) => a + s.bars, 0) * barS + sr * 2;
  const Lc = new Float32Array(total), Rc = new Float32Array(total);
  const put = (src, at, g = 1, pan = 0, fade = 0.01) => {
    const f = Math.floor(fade * sr);
    for (let i = 0; i < src.length; i++) {
      const k = at + i; if (k >= total) break;
      const e = Math.min(1, i / Math.max(1, f), (src.length - i) / Math.max(1, f)) * g;
      Lc[k] += src[i] * e * (pan > 0 ? 1 - pan : 1); Rc[k] += src[i] * e * (pan < 0 ? 1 + pan : 1);
    }
  };
  let pos = 0; const sections = [];
  plan.forEach((s, si) => {
    sections.push({ type: s.type, bars: s.bars });
    if (s.kind === 'full') put(ch, pos);
    else if (s.kind === 'hook') {
      for (let k = 0; k < s.bars; k += 2) {
        put(hook, pos + k * barS);
        if (double > 0) { put(hook, pos + k * barS + Math.floor(0.015 * sr), 0.5 * double, -0.8); put(hook, pos + k * barS + Math.floor(0.025 * sr), 0.5 * double, 0.8); }
      }
    } else if (s.kind === 'chop' || s.kind === 'chopIntro' || s.kind === 'chopOut') {
      // trozos de 1 tiempo del gancho, con ritmo y paneo alternado
      const rh = s.kind === 'chop' ? [0, 3, 6, 8, 11, 14] : [0, 8];
      for (let b = 0; b < s.bars; b++) rh.forEach((st, j) => {
        const slice = hook.subarray(((b + j) % 4) * beatS, ((b + j) % 4) * beatS + Math.floor(beatS * (s.kind === 'chop' ? 0.9 : 1.8)));
        put(slice, pos + b * barS + st * Math.floor(beatS / 4), s.kind === 'chop' ? 0.8 : 0.45, j % 2 ? 0.5 : -0.5, 0.006);
      });
    }
    pos += s.bars * barS;
    void si;
  });
  const out = new AudioBuffer({ length: total, numberOfChannels: 2, sampleRate: sr });
  out.copyToChannel(Lc, 0); out.copyToChannel(Rc, 1);
  return { buffer: out, sections };
}
