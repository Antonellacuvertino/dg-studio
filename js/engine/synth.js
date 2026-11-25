// ===============================================================
//  Síntesis de instrumentos (compartida por el creador y el estudio)
//  Cada método crea nodos Web Audio en `this.ctx` y los conecta a
//  las salidas `this.o` (drums / music / bass / verb).
// ===============================================================
export const SR = 44100;
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const NOISE = Float32Array.from({ length: SR * 2 }, () => Math.random() * 2 - 1);

export class Synth {
  constructor(ctx, outs = null) {
    this.ctx = ctx;
    const nb = ctx.createBuffer(1, NOISE.length, SR); nb.copyToChannel(NOISE, 0); this.noise = nb;
    const d = ctx.destination;
    this.o = outs || { drums: d, music: d, bass: d, verb: ctx.createGain() };
  }

  // ---------- utilidades ----------
  env(p, t, a, peak, hold, rel) {
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(Math.max(0.0002, peak), t + a);
    p.setValueAtTime(Math.max(0.0002, peak), t + a + hold);
    p.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
    return t + a + hold + rel;
  }
  osc(type, f, t, end, detune = 0) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    o.start(t); o.stop(end + 0.05); return o;
  }
  noiseSrc(t, len) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noise;
    s.start(t, Math.random() * 1.4, Math.min(len + 0.05, 0.55)); return s;
  }
  filt(type, f, q = 0.7) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  gain(v = 1) { const g = this.ctx.createGain(); g.gain.value = v; return g; }
  shaper(k = 8) {
    const ws = this.ctx.createWaveShaper(); const n = 1024; const c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
    ws.curve = c; return ws;
  }

  // ---------- batería ----------
  _kick(t, v) {
    const out = this.o.drums;
    const g = this.gain(); const end = this.env(g.gain, t, 0.002, v, 0.03, 0.32);
    const o = this.osc('sine', 165, t, end); o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
    o.connect(g).connect(out);
    const cg = this.gain(); this.env(cg.gain, t, 0.001, v * 0.25, 0, 0.012);
    this.noiseSrc(t, 0.02).connect(this.filt('highpass', 2500)).connect(cg).connect(out);
  }
  // Bombo de techno duro: más punch, distorsión y cola larga
  _hardkick(t, v) {
    const out = this.o.drums;
    const g = this.gain(); const end = this.env(g.gain, t, 0.001, v * 0.9, 0.06, 0.38);
    const o = this.osc('sine', 260, t, end); o.frequency.exponentialRampToValueAtTime(110, t + 0.02); o.frequency.exponentialRampToValueAtTime(48, t + 0.16);
    const sh = this.shaper(9); const lp = this.filt('lowpass', 4500);
    o.connect(sh).connect(lp).connect(g).connect(out);
    const cg = this.gain(); this.env(cg.gain, t, 0.0005, v * 0.35, 0, 0.008);
    this.noiseSrc(t, 0.02).connect(this.filt('highpass', 3000)).connect(cg).connect(out);
  }
  _snare(t, v) {
    const out = this.o.drums;
    const ng = this.gain(); this.env(ng.gain, t, 0.001, v * 0.55, 0.01, 0.17);
    this.noiseSrc(t, 0.2).connect(this.filt('highpass', 1500)).connect(ng); ng.connect(out); ng.connect(this.o.verb);
    const tg = this.gain(); const end = this.env(tg.gain, t, 0.001, v * 0.5, 0, 0.09);
    const o = this.osc('triangle', 200, t, end); o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    o.connect(tg).connect(out);
  }
  _clap(t, v) {
    const g = this.ctx.createGain(); const p = g.gain;
    p.setValueAtTime(0.0001, t);
    [0, 0.011, 0.022].forEach((o) => { p.setValueAtTime(v * 0.7, t + o); p.exponentialRampToValueAtTime(v * 0.15, t + o + 0.009); });
    p.setValueAtTime(v * 0.6, t + 0.033); p.exponentialRampToValueAtTime(0.0001, t + 0.25);
    this.noiseSrc(t, 0.3).connect(this.filt('bandpass', 1300, 1.2)).connect(g);
    g.connect(this.o.drums); g.connect(this.o.verb);
  }
  _rim(t, v) {
    const g = this.gain(); const end = this.env(g.gain, t, 0.001, v * 0.45, 0, 0.05);
    this.osc('triangle', 820, t, end).connect(g).connect(this.o.drums);
    const ng = this.gain(); this.env(ng.gain, t, 0.001, v * 0.35, 0, 0.03);
    this.noiseSrc(t, 0.05).connect(this.filt('bandpass', 2800, 2)).connect(ng); ng.connect(this.o.drums); ng.connect(this.o.verb);
  }
  _hat(t, v, open = false) {
    const g = this.gain(); this.env(g.gain, t, 0.001, v * (open ? 0.22 : 0.28), 0, open ? 0.28 : 0.045);
    this.noiseSrc(t, open ? 0.35 : 0.06).connect(this.filt('highpass', 7500)).connect(g).connect(this.o.drums);
  }
  _ride(t, v) {
    const g = this.gain(); const end = this.env(g.gain, t, 0.001, v * 0.12, 0, 0.6);
    const bp = this.filt('bandpass', 5200, 1.5); bp.connect(g).connect(this.o.drums);
    [1, 1.47, 1.98, 2.53].forEach((r) => this.osc('square', 420 * r, t, end).connect(bp));
    const ng = this.gain(); this.env(ng.gain, t, 0.001, v * 0.1, 0, 0.4);
    this.noiseSrc(t, 0.45).connect(this.filt('highpass', 8000)).connect(ng).connect(this.o.drums);
  }
  _shaker(t, v) {
    const g = this.gain(); this.env(g.gain, t, 0.008, v * 0.13, 0, 0.06);
    this.noiseSrc(t, 0.08).connect(this.filt('bandpass', 6500, 1.5)).connect(g).connect(this.o.drums);
  }
  _guiro(t, v) {
    const g = this.gain(); this.env(g.gain, t, 0.01, v * 0.2, 0.02, 0.04);
    this.noiseSrc(t, 0.08).connect(this.filt('bandpass', 3800, 4)).connect(g).connect(this.o.drums);
  }
  _conga(t, v, hi) {
    const g = this.gain(); const end = this.env(g.gain, t, 0.002, v * 0.45, 0, 0.22);
    const f = hi ? 330 : 220;
    const o = this.osc('sine', f * 1.15, t, end); o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
    o.connect(g).connect(this.o.drums);
  }
  _tom(t, v, f = 120) {
    const g = this.gain(); const end = this.env(g.gain, t, 0.002, v * 0.6, 0, 0.35);
    const o = this.osc('sine', f * 1.6, t, end); o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
    o.connect(g).connect(this.o.drums); g.connect(this.o.verb);
  }
  // Percusión metálica (techno industrial)
  _metal(t, v) {
    const g = this.gain(); const end = this.env(g.gain, t, 0.001, v * 0.18, 0, 0.18);
    const hp = this.filt('highpass', 900); hp.connect(g); g.connect(this.o.drums); g.connect(this.o.verb);
    const car = this.osc('square', 540, t, end); const mod = this.osc('square', 1330, t, end);
    const mg = this.gain(800); mod.connect(mg).connect(car.frequency); car.connect(hp);
  }
  _crash(t) {
    const g = this.gain(); this.env(g.gain, t, 0.002, 0.22, 0, 1.8);
    const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.start(t); s.stop(t + 2);
    s.connect(this.filt('highpass', 5000)).connect(g); g.connect(this.o.drums); g.connect(this.o.verb);
  }
  _noiseSweep(t, len = 1.8, up = true) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; s.start(t); s.stop(t + len);
    const f = this.filt('bandpass', 400, 2);
    f.frequency.setValueAtTime(up ? 400 : 9000, t); f.frequency.exponentialRampToValueAtTime(up ? 9000 : 300, t + len);
    const g = this.gain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + len * (up ? 1 : 0.1));
    if (!up) g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f).connect(g); g.connect(this.o.drums); g.connect(this.o.verb);
  }

  // ---------- instrumentos melódicos ----------
  _voice(type, t, midi, dur, v, out = this.o.music) {
    const f = mtof(midi); const c = this.ctx;
    const g = this.gain(); let end;
    switch (type) {
      case 'pad': {
        end = this.env(g.gain, t, 0.25, v * 0.06, Math.max(0, dur - 0.25), 0.6);
        const lp = this.filt('lowpass', 1400); lp.connect(g);
        [-8, 0, 8].forEach((dt) => this.osc('sawtooth', f, t, end, dt).connect(lp));
        break;
      }
      case 'strings': {
        end = this.env(g.gain, t, 0.35, v * 0.05, Math.max(0, dur - 0.3), 0.8);
        const lp = this.filt('lowpass', 2600); lp.connect(g);
        [-10, -3, 4, 11].forEach((dt) => this.osc('sawtooth', f, t, end, dt).connect(lp));
        break;
      }
      case 'rhodes': {
        end = this.env(g.gain, t, 0.005, v * 0.16, 0.05, Math.max(0.6, dur * 1.1));
        this.osc('sine', f, t, end).connect(g);
        const g2 = this.gain(0.25); this.osc('sine', f * 2, t, end, 4).connect(g2).connect(g);
        const g3 = this.gain(0.06); this.osc('triangle', f * 3, t, Math.min(end, t + 0.3)).connect(g3).connect(g);
        break;
      }
      case 'piano': case 'arp': {
        end = this.env(g.gain, t, 0.003, v * 0.17, 0, Math.max(0.8, Math.min(dur * 1.6, 2.2)));
        this.osc('triangle', f, t, end).connect(g);
        const g2 = this.gain(0.35); this.osc('sine', f * 2, t, end, 3).connect(g2).connect(g);
        const g3 = this.gain(0.1); this.osc('sine', f * 4, t, Math.min(end, t + 0.4)).connect(g3).connect(g);
        break;
      }
      case 'pluck': {
        end = this.env(g.gain, t, 0.003, v * 0.1, 0, Math.min(0.45, dur + 0.2));
        const lp = this.filt('lowpass', 3500, 2); lp.frequency.setValueAtTime(3500, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.25);
        lp.connect(g); this.osc('sawtooth', f, t, end).connect(lp); this.osc('square', f, t, end, 6).connect(lp);
        break;
      }
      case 'stab': {
        end = this.env(g.gain, t, 0.003, v * 0.09, 0.05, 0.18);
        const lp = this.filt('lowpass', 2200); lp.connect(g);
        this.osc('sawtooth', f, t, end).connect(lp); this.osc('square', f, t, end, -7).connect(lp);
        break;
      }
      case 'skank': {
        end = this.env(g.gain, t, 0.002, v * 0.08, 0.04, 0.08);
        const bp = this.filt('bandpass', 1800, 0.8); bp.connect(g);
        this.osc('square', f, t, end).connect(bp);
        break;
      }
      case 'power': case 'guitar': {
        end = this.env(g.gain, t, 0.004, v * (type === 'power' ? 0.05 : 0.06), Math.max(0, dur - 0.05), 0.12);
        const sh = this.shaper(14); const lp = this.filt('lowpass', 3200); sh.connect(lp).connect(g);
        this.osc('sawtooth', f, t, end).connect(sh); this.osc('sawtooth', f, t, end, 9).connect(sh);
        break;
      }
      case 'supersaw': {
        end = this.env(g.gain, t, 0.03, v * 0.035, Math.max(0, dur - 0.03), 0.4);
        const lp = this.filt('lowpass', 5500); lp.connect(g);
        [-22, -11, 0, 11, 22].forEach((dt) => this.osc('sawtooth', f, t, end, dt).connect(lp));
        break;
      }
      case 'hoover': { // sintetizador "rave" agresivo
        end = this.env(g.gain, t, 0.02, v * 0.05, Math.max(0, dur - 0.02), 0.25);
        const lp = this.filt('lowpass', 3800, 1.5); lp.connect(g);
        const sweep = (o) => { o.frequency.setValueAtTime(f * 0.7, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08); return o; };
        [-30, -12, 0, 12, 30].forEach((dt) => sweep(this.osc('sawtooth', f, t, end, dt)).connect(lp));
        sweep(this.osc('square', f / 2, t, end)).connect(lp);
        break;
      }
      case 'bell': case 'marimba': {
        const mar = type === 'marimba';
        end = this.env(g.gain, t, 0.002, v * 0.13, 0, mar ? 0.35 : 1.1);
        const car = this.osc('sine', f, t, end);
        const mod = this.osc('sine', f * (mar ? 4 : 3.5), t, end);
        const mg = c.createGain(); mg.gain.setValueAtTime(f * (mar ? 1.2 : 2.2), t); mg.gain.exponentialRampToValueAtTime(1, t + 0.4);
        mod.connect(mg).connect(car.frequency); car.connect(g);
        break;
      }
      case 'acid': {
        end = this.env(g.gain, t, 0.003, v * 0.07, Math.max(0, dur - 0.03), 0.08);
        const lp = this.filt('lowpass', 400, 14); lp.frequency.setValueAtTime(2600 * (0.6 + 0.6 * v), t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.16);
        const sh = this.shaper(4); lp.connect(sh).connect(g);
        this.osc('sawtooth', f / 2, t, end).connect(lp);
        break;
      }
      case 'organ': {
        end = this.env(g.gain, t, 0.01, v * 0.05, Math.max(0, dur - 0.02), 0.08);
        [1, 2, 3, 4].forEach((h, i) => { const hg = this.gain([1, 0.6, 0.35, 0.2][i]); this.osc('sine', f * h, t, end).connect(hg).connect(g); });
        break;
      }
      case 'accordion': {
        end = this.env(g.gain, t, 0.03, v * 0.05, Math.max(0, dur - 0.04), 0.1);
        const bp = this.filt('bandpass', 1600, 0.7); bp.connect(g);
        const lfo = this.osc('sine', 5.5, t, end); const lg = c.createGain(); lg.gain.value = 9;
        const a = this.osc('square', f, t, end, 0); const b = this.osc('sawtooth', f, t, end, 12);
        lfo.connect(lg); lg.connect(a.detune); lg.connect(b.detune); a.connect(bp); b.connect(bp);
        break;
      }
      default: { // 'lead'
        end = this.env(g.gain, t, 0.01, v * 0.065, Math.max(0, dur - 0.02), 0.15);
        const lp = this.filt('lowpass', 2800); lp.connect(g);
        const lfo = this.osc('sine', 5, t, end); const lg = c.createGain(); lg.gain.value = 12;
        const a = this.osc('sawtooth', f, t, end); const b = this.osc('square', f, t, end, 7);
        lfo.connect(lg); lg.connect(a.detune); lg.connect(b.detune); a.connect(lp); b.connect(lp);
      }
    }
    g.connect(out);
    return end;
  }

  _bass(type, t, midi, dur, v, glideTo, out = this.o.bass) {
    const f = mtof(midi); const g = this.gain();
    if (type === '808') {
      const end = this.env(g.gain, t, 0.003, v * 0.55, Math.max(0, dur - 0.15), 0.25);
      const o = this.osc('sine', f * 1.6, t, end); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
      if (glideTo) { o.frequency.setValueAtTime(f, t + dur * 0.7); o.frequency.exponentialRampToValueAtTime(mtof(glideTo), t + dur * 0.95); }
      o.connect(this.shaper(3)).connect(g);
    } else if (type === 'sub') {
      const end = this.env(g.gain, t, 0.006, v * 0.5, Math.max(0, dur - 0.05), 0.08);
      this.osc('sine', f, t, end).connect(g);
      const g2 = this.gain(0.18); this.osc('triangle', f * 2, t, end).connect(g2).connect(g);
    } else if (type === 'rumble') {
      // Rumble de techno: sub grave distorsionado y filtrado, con cola
      const end = this.env(g.gain, t, 0.004, v * 0.5, Math.max(0, dur - 0.08), 0.18);
      const o = this.osc('sine', f * 1.3, t, end); o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
      const sh = this.shaper(6); const lp = this.filt('lowpass', 180, 1.2);
      o.connect(sh).connect(lp).connect(g);
    } else if (type === 'reese') {
      const end = this.env(g.gain, t, 0.01, v * 0.2, Math.max(0, dur - 0.04), 0.1);
      const lp = this.filt('lowpass', 700, 2); lp.connect(g);
      this.osc('sawtooth', f, t, end, -14).connect(lp); this.osc('sawtooth', f, t, end, 14).connect(lp);
      this.osc('sine', f / 2, t, end).connect(g);
    } else if (type === 'synth') {
      const end = this.env(g.gain, t, 0.004, v * 0.32, Math.max(0, dur - 0.04), 0.06);
      const lp = this.filt('lowpass', 900, 3); lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(260, t + 0.18);
      lp.connect(g); this.osc('sawtooth', f, t, end).connect(lp); this.osc('sine', f / 2, t, end).connect(lp);
    } else if (type === 'rock') {
      const end = this.env(g.gain, t, 0.004, v * 0.3, Math.max(0, dur - 0.03), 0.05);
      const lp = this.filt('lowpass', 1100); lp.connect(g);
      const sh = this.shaper(3); sh.connect(lp); this.osc('sawtooth', f, t, end).connect(sh);
    } else { // reggae, cumbia
      const end = this.env(g.gain, t, 0.006, v * 0.5, Math.max(0, dur - (type === 'cumbia' ? 0.1 : 0.04)), type === 'cumbia' ? 0.12 : 0.06);
      const lp = this.filt('lowpass', 500); lp.connect(g);
      this.osc('sine', f, t, end).connect(lp); this.osc('triangle', f, t, end).connect(lp);
    }
    g.connect(out);
  }
}

// ---------------------------------------------------------------
//  Renderizar un sonido a AudioBuffer (para bancos y caché)
// ---------------------------------------------------------------
let running = 0; const waiting = [];
async function slot() { if (running < 3) { running++; return; } await new Promise((r) => waiting.push(r)); running++; }
function release() { running--; const n = waiting.shift(); if (n) n(); }
export async function renderOne(len, fn) {
  await slot();
  try {
    const oc = new OfflineAudioContext(1, Math.ceil(len * SR), SR);
    fn(new Synth(oc));
    return await oc.startRendering();
  } finally { release(); }
}

// Golpes de batería disponibles (id -> [nombre, duración, función])
export const DRUMS = {
  kick: ['Bombo', 0.6, (s) => s._kick(0.003, 1)],
  hardkick: ['Bombo duro', 0.7, (s) => s._hardkick(0.003, 1)],
  snare: ['Caja', 0.5, (s) => s._snare(0.003, 1)],
  clap: ['Palmas', 0.5, (s) => s._clap(0.003, 1)],
  rim: ['Aro', 0.3, (s) => s._rim(0.003, 1)],
  hat: ['Hi-hat', 0.15, (s) => s._hat(0.003, 1)],
  hat2: ['Hi-hat 2', 0.15, (s) => s._hat(0.003, 1)],
  hatOpen: ['Hi-hat abierto', 0.5, (s) => s._hat(0.003, 1, true)],
  ride: ['Ride', 0.9, (s) => s._ride(0.003, 1)],
  shaker: ['Shaker', 0.2, (s) => s._shaker(0.003, 1)],
  guiro: ['Güiro', 0.2, (s) => s._guiro(0.003, 1)],
  congaHi: ['Conga aguda', 0.4, (s) => s._conga(0.003, 1, true)],
  congaLo: ['Conga grave', 0.4, (s) => s._conga(0.003, 1, false)],
  tomHi: ['Tom agudo', 0.5, (s) => s._tom(0.003, 1, 180)],
  tomLo: ['Tom grave', 0.5, (s) => s._tom(0.003, 1, 100)],
  metal: ['Metálico', 0.3, (s) => s._metal(0.003, 1)],
  crash: ['Platillo', 2.2, (s) => s._crash(0.003)],
  sweep: ['Barrido FX', 2.0, (s) => s._noiseSweep(0.003, 1.9, true)],
};

let _bank = null;
// Banco compartido: cada golpe se sintetiza una sola vez
export function drumBank() {
  if (!_bank) {
    _bank = (async () => {
      const b = {};
      await Promise.all(Object.entries(DRUMS).map(async ([k, [, len, fn]]) => { b[k] = await renderOne(len, fn); }));
      return b;
    })();
  }
  return _bank;
}

// ---------------------------------------------------------------
//  Reverb por convolución (sin retroalimentación: nunca "pita")
// ---------------------------------------------------------------
const _irs = new Map();
export function reverbIR(sec = 1.8, sr = SR) {
  const key = sr + '|' + sec; if (_irs.has(key)) return _irs.get(key);
  const len = Math.floor(sr * sec); const b = new AudioBuffer({ length: len, numberOfChannels: 2, sampleRate: sr });
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c); let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len; const k = 0.15 + 0.8 * t; // se oscurece con el tiempo
      lp += (((Math.random() * 2 - 1)) - lp) * (1 - k);
      d[i] = lp * Math.pow(1 - t, 2.4) * (i < sr * 0.012 ? i / (sr * 0.012) : 1);
    }
  }
  _irs.set(key, b); return b;
}
export function makeReverb(ctx, wet = 0.5) {
  const input = ctx.createGain();
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 250;
  const conv = ctx.createConvolver(); conv.normalize = true; conv.buffer = reverbIR(1.8, ctx.sampleRate);
  const out = ctx.createGain(); out.gain.value = wet;
  input.connect(hp).connect(conv).connect(out);
  input.out = out;
  return input;
}
