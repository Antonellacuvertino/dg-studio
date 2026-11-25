import { makeReverb } from '../engine/synth.js';
// ===============================================================
//  Mezclador: un canal por pista + buses de reverb y delay + máster
//  canal: entrada → saturación → HP → LP → sidechain → paneo → volumen
// ===============================================================
const curveCache = new Map();
function driveCurve(k) {
  const key = Math.round(k * 20);
  if (!curveCache.has(key)) {
    const n = 1024; const c = new Float32Array(n); const amt = 1 + key * 1.5;
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = key ? Math.tanh(amt * x) / Math.tanh(amt) : x; }
    curveCache.set(key, c);
  }
  return curveCache.get(key);
}
const cutoffHz = (v) => 60 * Math.pow(20000 / 60, v);   // 0..1 → 60 Hz..20 kHz
const hpHz = (v) => 20 * Math.pow(2000 / 20, v);        // 0..1 → 20 Hz..2 kHz

export class Mixer {
  constructor(ctx, project) {
    this.ctx = ctx; this.ch = new Map(); this.project = project;
    const master = ctx.createGain(); master.gain.value = project.master ?? 0.9;
    this.masterHP = ctx.createBiquadFilter(); this.masterHP.type = 'highpass'; this.masterHP.frequency.value = 10;
    this.masterLP = ctx.createBiquadFilter(); this.masterLP.type = 'lowpass'; this.masterLP.frequency.value = 20000;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.12; comp.knee.value = 6;
    this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 1024;
    const clip = ctx.createWaveShaper(); const cc = new Float32Array(2048);
    for (let i = 0; i < cc.length; i++) { const x = (i / (cc.length - 1)) * 2 - 1; cc[i] = Math.abs(x) < 0.7 ? x : Math.sign(x) * (0.7 + 0.28 * Math.tanh((Math.abs(x) - 0.7) / 0.28)); }
    clip.curve = cc;
    master.connect(this.masterHP).connect(this.masterLP).connect(comp).connect(clip).connect(this.analyser).connect(ctx.destination);
    // grabadora: si está grabando "lo que suena", también enviar ahí
    if (Mixer.tap && Mixer.tap.context === ctx) this.analyser.connect(Mixer.tap);
    this.master = master;

    // reverb por convolución (estable, sin pitidos)
    this.rev = makeReverb(ctx, 0.55); this.rev.out.connect(master);

    // delay sincronizado (3/16)
    this.del = ctx.createGain();
    this.delNode = ctx.createDelay(2); this.delFb = ctx.createGain(); this.delFb.gain.value = 0.42;
    const dLp = ctx.createBiquadFilter(); dLp.type = 'lowpass'; dLp.frequency.value = 3500;
    const dHp = ctx.createBiquadFilter(); dHp.type = 'highpass'; dHp.frequency.value = 300;
    const dOut = ctx.createGain(); dOut.gain.value = 0.6;
    this.del.connect(this.delNode); this.delNode.connect(dLp).connect(dHp); dHp.connect(this.delFb).connect(this.delNode); dHp.connect(dOut).connect(master);
    this.setBpm(project.bpm);
    project.tracks.forEach((t) => this.channel(t));
    this.refresh();
  }

  setBpm(bpm) { this.delNode.delayTime.setTargetAtTime(Math.min(1.9, (60 / bpm) * 0.75), this.ctx.currentTime, 0.02); }

  channel(t) {
    if (this.ch.has(t.id)) return this.ch.get(t.id);
    const c = this.ctx;
    const input = c.createGain();
    const drive = c.createWaveShaper(); drive.curve = driveCurve(0); drive.oversample = 'none';
    const hp = c.createBiquadFilter(); hp.type = 'highpass';
    const lp = c.createBiquadFilter(); lp.type = 'lowpass';
    const duck = c.createGain();
    const pan = c.createStereoPanner ? c.createStereoPanner() : c.createGain();
    const vol = c.createGain();
    const rev = c.createGain(); const del = c.createGain();
    input.connect(drive).connect(hp).connect(lp).connect(duck).connect(pan).connect(vol).connect(this.master);
    vol.connect(rev).connect(this.rev); vol.connect(del).connect(this.del);
    const meter = c.createAnalyser(); meter.fftSize = 256; vol.connect(meter);
    const ch = { input, drive, hp, lp, duck, pan, vol, rev, del, meter, sources: new Set() };
    this.ch.set(t.id, ch);
    this.update(t, true);
    return ch;
  }
  remove(id) {
    const ch = this.ch.get(id); if (!ch) return;
    ch.sources.forEach((s) => { try { s.stop(); } catch { /* */ } });
    try { ch.vol.disconnect(); } catch { /* */ }
    this.ch.delete(id);
  }
  // aplicar parámetros de la pista
  update(t, now = false) {
    const ch = this.ch.get(t.id); if (!ch) return;
    const T = now ? 0 : this.ctx.currentTime; const k = 0.015;
    const set = (param, v) => (now ? (param.value = v) : param.setTargetAtTime(v, T, k));
    const fx = t.fx;
    ch.drive.curve = driveCurve(fx.drive || 0);
    set(ch.input.gain, fx.drive ? 1 / (1 + fx.drive * 0.8) : 1);
    set(ch.hp.frequency, hpHz(fx.hp || 0));
    set(ch.lp.frequency, cutoffHz(fx.cutoff ?? 1));
    set(ch.lp.Q, 0.7 + (fx.reso || 0) * 14);
    if (ch.pan.pan) set(ch.pan.pan, t.pan || 0);
    set(ch.rev.gain, fx.reverb || 0);
    set(ch.del.gain, fx.delay || 0);
    set(ch.vol.gain, this.audible(t) ? t.vol : 0);
  }
  audible(t) {
    const anySolo = this.project.tracks.some((x) => x.solo);
    return !t.mute && (!anySolo || t.solo);
  }
  refresh() { this.project.tracks.forEach((t) => this.update(t)); }
  // sidechain: bajar el volumen de las pistas con "duck" cuando suena el bombo
  duckAt(time, stepDur) {
    this.project.tracks.forEach((t) => {
      const d = t.fx.duck || 0; if (!d) return;
      const ch = this.ch.get(t.id); if (!ch) return;
      const p = ch.duck.gain;
      p.cancelScheduledValues(time); p.setValueAtTime(1 - d * 0.9, time); p.linearRampToValueAtTime(1, time + Math.min(0.3, stepDur * 2.6));
    });
  }
  level() { const a = new Float32Array(this.analyser.fftSize); this.analyser.getFloatTimeDomainData(a); let m = 0; for (const v of a) m = Math.max(m, Math.abs(v)); return m; }
}
