// ===============================================================
//  Efectos para voces grabadas (procesado sin conexión, alta calidad)
// ===============================================================
import { makeReverb } from '../engine/synth.js';

export const FX_DEFAULTS = { gain: 0, gate: 0.15, low: 0, high: 2, comp: 0.5, reverb: 0.2, delay: 0, double: 0, normalize: true };

export const FX_PRESETS = [
  { id: 'clean', name: 'Limpia', emoji: '✨', set: { gate: 0.15, low: -1, high: 2, comp: 0.4, reverb: 0.12, delay: 0, double: 0 } },
  { id: 'trap', name: 'Trap / reggaetón', emoji: '🔥', set: { gate: 0.2, low: -2, high: 4, comp: 0.75, reverb: 0.18, delay: 0.25, double: 0.35 } },
  { id: 'techno', name: 'Techno (eco)', emoji: '🏭', set: { gate: 0.25, low: -4, high: 3, comp: 0.7, reverb: 0.45, delay: 0.5, double: 0.2 } },
  { id: 'radio', name: 'Radio / teléfono', emoji: '📻', set: { gate: 0.2, low: -12, high: -6, comp: 0.9, reverb: 0.05, delay: 0, double: 0 } },
  { id: 'big', name: 'Estadio', emoji: '🏟️', set: { gate: 0.15, low: 0, high: 3, comp: 0.6, reverb: 0.7, delay: 0.2, double: 0.6 } },
];

// Recortar (segundos) y devolver un AudioBuffer nuevo
export function trim(buf, start = 0, end = null) {
  const sr = buf.sampleRate; const a = Math.max(0, Math.floor(start * sr)); const b = Math.min(buf.length, Math.floor((end ?? buf.duration) * sr));
  const len = Math.max(1, b - a); const out = new AudioBuffer({ length: len, numberOfChannels: buf.numberOfChannels, sampleRate: sr });
  for (let c = 0; c < buf.numberOfChannels; c++) out.copyToChannel(buf.getChannelData(c).subarray(a, b), c);
  return out;
}

// Puerta de ruido simple: baja el volumen en los silencios
function gateBuffer(buf, amount) {
  if (!amount) return buf;
  const sr = buf.sampleRate; const out = new AudioBuffer({ length: buf.length, numberOfChannels: buf.numberOfChannels, sampleRate: sr });
  const ch0 = buf.getChannelData(0); let pk = 0; for (let i = 0; i < ch0.length; i += 4) pk = Math.max(pk, Math.abs(ch0[i]));
  const thr = pk * (0.01 + 0.12 * amount); const att = Math.exp(-1 / (0.002 * sr)), rel = Math.exp(-1 / (0.12 * sr));
  let env = 0, g = 0; const gains = new Float32Array(buf.length);
  for (let i = 0; i < ch0.length; i++) { const v = Math.abs(ch0[i]); env = v > env ? v : env * 0.9995; const target = env > thr ? 1 : 0.05; g = target > g ? target + (g - target) * att : target + (g - target) * rel; gains[i] = g; }
  for (let c = 0; c < buf.numberOfChannels; c++) { const s = buf.getChannelData(c), d = out.getChannelData(c); for (let i = 0; i < s.length; i++) d[i] = s[i] * gains[i]; }
  return out;
}

export async function processVoice(input, o = {}) {
  const p = { ...FX_DEFAULTS, ...o };
  const buf = gateBuffer(input, p.gate);
  const sr = buf.sampleRate; const tail = 2.2;
  const oc = new OfflineAudioContext(2, Math.ceil((buf.duration + tail) * sr), sr);
  const mk = (type, f, gain = 0, q = 0.7) => { const b = oc.createBiquadFilter(); b.type = type; b.frequency.value = f; b.gain.value = gain; b.Q.value = q; return b; };
  const hp = mk('highpass', 80); const lo = mk('lowshelf', 220, p.low); const hi = mk('highshelf', 4500, p.high); const pres = mk('peaking', 2800, p.high * 0.5, 1);
  const comp = oc.createDynamicsCompressor(); comp.threshold.value = -8 - 28 * p.comp; comp.ratio.value = 1.5 + 8 * p.comp; comp.attack.value = 0.004; comp.release.value = 0.15; comp.knee.value = 8;
  const make = oc.createGain(); make.gain.value = Math.pow(10, (p.gain + p.comp * 9) / 20);
  const master = oc.createGain(); master.connect(oc.destination);
  const chain = (src) => { src.connect(hp).connect(lo).connect(hi).connect(pres).connect(comp).connect(make); };
  const src = oc.createBufferSource(); src.buffer = buf; chain(src); make.connect(master); src.start(0);
  // doble (coro) a los lados
  if (p.double > 0) {
    [[-0.9, 0.016, 1.004], [0.9, 0.027, 0.996]].forEach(([pan, dly, rate]) => {
      const s2 = oc.createBufferSource(); s2.buffer = buf; s2.playbackRate.value = rate;
      const g = oc.createGain(); g.gain.value = 0.45 * p.double; const pn = oc.createStereoPanner(); pn.pan.value = pan;
      const f = mk('highpass', 150); s2.connect(f).connect(g).connect(pn).connect(master); s2.start(dly);
    });
  }
  if (p.reverb > 0) { const rv = makeReverb(oc, 0.9); const sg = oc.createGain(); sg.gain.value = p.reverb * 0.8; make.connect(sg).connect(rv); rv.out.connect(master); }
  if (p.delay > 0) {
    const d = oc.createDelay(1.5); d.delayTime.value = 0.32; const fb = oc.createGain(); fb.gain.value = 0.38; const lp = mk('lowpass', 3500); const sg = oc.createGain(); sg.gain.value = p.delay * 0.6;
    make.connect(sg).connect(d); d.connect(lp).connect(fb).connect(d); lp.connect(master);
  }
  let out = await oc.startRendering();
  // quitar la cola en silencio y normalizar
  const sr2 = out.sampleRate; let last = out.length - 1; const L = out.getChannelData(0), R = out.getChannelData(1);
  while (last > buf.length && Math.abs(L[last]) < 0.0008 && Math.abs(R[last]) < 0.0008) last--;
  out = trim(out, 0, (last + sr2 * 0.1) / sr2);
  if (p.normalize) { let pk = 0; for (let c = 0; c < 2; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i])); } if (pk > 0) { const k = 0.89 / pk; for (let c = 0; c < 2; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= k; } } }
  return out;
}
