// ===============================================================
//  Secuenciador: programa cada semicorchea de cada pista.
//  El mismo código sirve para tocar en vivo (Transport) y para
//  exportar (renderProject con OfflineAudioContext).
// ===============================================================
import { Synth, drumBank, SR, renderOne } from '../engine/synth.js';
import { SYNTHS, degToMidi } from './model.js';
import { Mixer } from './mixer.js';
import { loadProjectSamples } from './samples.js';
import { loadProjectLib } from './library.js';
import { audio } from '../core/audio.js';

const LIVE_CACHE = new Map(); const LIVE_READY = new Map();

export class Player {
  constructor(ctx, project, bank, samples) {
    this.ctx = ctx; this.p = project; this.bank = bank; this.samples = samples;
    this.mixer = new Mixer(ctx, project);
    this.synth = new Synth(ctx, { drums: this.mixer.master, music: this.mixer.master, bass: this.mixer.master, verb: this.mixer.rev });
    this.offline = typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
    this.pending = []; this.cache = this.offline ? new Map() : LIVE_CACHE;
    this.lib = new Map();
  }
  // En vivo: usar la nota ya sintetizada si existe; si no, sintetizarla en segundo plano
  liveNote(pr, midi, dur, vel) {
    const d = Math.round(dur * 50) / 50; const v = Math.round(vel * 10) / 10;
    const key = `${pr.fn}|${pr.type}|${midi}|${d}|${v}`;
    const hit = LIVE_READY.get(key); if (hit) return hit;
    if (!this.cache.has(key)) {
      if (this.cache.size > 600) { this.cache.clear(); LIVE_READY.clear(); }
      this.cache.set(key, renderOne(d + (pr.fn === 'bass' ? 0.6 : 2.6), (s) => (pr.fn === 'bass' ? s._bass(pr.type, 0.003, midi, d, v) : s._voice(pr.type, 0.003, midi, d, v))).then((b) => { LIVE_READY.set(key, b); return b; }));
    }
    return null;
  }
  // Pre-sintetizar todas las notas del proyecto antes de tocar
  async prewarm() {
    const p = this.p; const sd = 60 / p.bpm / 4;
    p.tracks.forEach((tr) => { if (tr.kind !== 'synth') return; const pr = SYNTHS[tr.preset] || SYNTHS.lead;
      tr.pattern.notes.forEach((n) => this.liveNote(pr, degToMidi(p, pr, n.d) + (tr.pitch || 0), Math.max(0.05, n.len * sd * 0.98), n.vel ?? 1)); });
    await Promise.all([...this.cache.values()]);
  }
  // Exportación: cada nota distinta se sintetiza una vez y se reutiliza (mucho más rápido)
  note(pr, t, midi, dur, vel, ch) {
    const d = Math.round(dur * 50) / 50; const v = Math.round(vel * 10) / 10;
    const key = `${pr.fn}|${pr.type}|${midi}|${d}|${v}`;
    this.pending.push({ key, t, ch, len: d + (pr.fn === 'bass' ? 0.6 : 2.6), fn: (s) => (pr.fn === 'bass' ? s._bass(pr.type, 0.003, midi, d, v) : s._voice(pr.type, 0.003, midi, d, v)) });
  }
  async flush() {
    const list = this.pending; this.pending = [];
    list.forEach((n) => { if (!this.cache.has(n.key)) this.cache.set(n.key, renderOne(n.len, n.fn)); });
    for (const n of list) this.play(await this.cache.get(n.key), n.t, 1, n.ch);
  }
  play(buf, t, v, ch, rate = 1, maxDur = 0, offset = 0) {
    const s = this.ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = v;
    s.connect(g).connect(ch.input);
    s.start(Math.max(this.ctx.currentTime, t), offset);
    if (maxDur) { g.gain.setValueAtTime(v, t + maxDur - 0.02); g.gain.linearRampToValueAtTime(0, t + maxDur); s.stop(t + maxDur + 0.01); }
    ch.sources.add(s); s.onended = () => ch.sources.delete(s);
  }

  // Programar el paso `s` de la escena `sceneIdx` en el instante `t`
  step(sceneIdx, s, t, sd) {
    const p = this.p; const scene = p.scenes[sceneIdx]; if (!scene) return;
    const steps = scene.bars * 16; const mx = this.mixer;
    if (s === 0) this.sceneFx(scene, t, steps * sd);
    for (const tr of p.tracks) {
      if (!scene.on[tr.id] || !mx.audible(tr)) continue;
      const ch = mx.channel(tr);
      const len = tr.pattern.len || 16; const i = s % len;
      const tt = t + (s % 2 ? (p.swing || 0) * sd : 0);
      const rate = Math.pow(2, (tr.pitch || 0) / 12);
      if (tr.kind === 'drum') {
        const v = tr.pattern.steps[i]; if (!v) continue;
        const buf = tr.sampleId ? this.samples.get(tr.sampleId) : tr.sound && tr.sound.startsWith('lib:') ? this.lib.get(tr.sound) : this.bank[tr.sound === 'hat' && i % 2 ? 'hat2' : tr.sound];
        if (buf) this.play(buf, tt, v, ch, rate);
        if (tr.role === 'kick' || /kick/.test(tr.sound)) mx.duckAt(tt, sd);
      } else if (tr.kind === 'synth') {
        const pr = SYNTHS[tr.preset] || SYNTHS.lead;
        this.synth.o = { drums: ch.input, music: ch.input, bass: ch.input, verb: mx.rev };
        for (const n of tr.pattern.notes) {
          if (n.s !== i) continue;
          const midi = degToMidi(p, pr, n.d) + (tr.pitch || 0);
          const dur = Math.max(0.05, n.len * sd * 0.98);
          if (this.offline) { this.note(pr, tt, midi, dur, n.vel ?? 1, ch); continue; }
          const nb = this.liveNote(pr, midi, dur, n.vel ?? 1);
          if (nb) this.play(nb, tt, 1, ch);
          else if (pr.fn === 'bass') this.synth._bass(pr.type, tt, midi, dur, n.vel ?? 1, null, ch.input);
          else this.synth._voice(pr.type, tt, midi, dur, n.vel ?? 1, ch.input);
        }
      } else if (tr.kind === 'sample') {
        const buf = this.samples.get(tr.sampleId); if (!buf) continue;
        if (tr.mode === 'loop') {
          const every = Math.max(1, tr.loopBars || 1) * 16;
          if (s % every === 0) this.play(buf, t, 1, ch, (tr.sampleBpm ? p.bpm / tr.sampleBpm : 1) * rate, Math.min(every, steps - s) * sd);
        } else { const v = tr.pattern.steps[i]; if (v) this.play(buf, tt, v, ch, rate); }
      } else if (tr.kind === 'audio') {
        const buf = this.samples.get(tr.sampleId);
        const off = tr.sync ? p.scenes.slice(0, sceneIdx).reduce((a, x) => a + x.bars * 16, 0) * sd : 0;
        if (buf && s === 0 && off < buf.duration) this.play(buf, t, 1, ch, 1, steps * sd, off);
      }
    }
    // Subida: redoble en el último compás
    if (scene.fx === 'build' && s >= steps - 16) {
      const k = s - (steps - 16); const ch = { input: this.mixer.master, sources: new Set() };
      if (k < 8 ? k % 2 === 0 : true) this.play(this.bank.clap, t, 0.25 + (k / 16) * 0.6, ch);
      if (k >= 12) this.play(this.bank.clap, t + sd / 2, 0.5 + (k / 16) * 0.4, ch);
    }
  }

  sceneFx(scene, t, len) {
    const m = this.mixer; const lp = m.masterLP.frequency; const hp = m.masterHP.frequency; const g = m.master.gain;
    const base = this.p.master ?? 0.9;
    [lp, hp, g].forEach((x) => x.cancelScheduledValues(t));
    lp.setValueAtTime(20000, t); hp.setValueAtTime(10, t); g.setValueAtTime(base, t);
    if (scene.fx === 'fadein') { lp.setValueAtTime(400, t); lp.exponentialRampToValueAtTime(20000, t + len); }
    else if (scene.fx === 'break') { lp.setValueAtTime(1400, t); lp.setValueAtTime(1400, t + len * 0.75); lp.exponentialRampToValueAtTime(20000, t + len); }
    else if (scene.fx === 'build') { hp.setValueAtTime(10, t); hp.exponentialRampToValueAtTime(700, t + len); this.synth.o = { drums: m.master, music: m.master, bass: m.master, verb: m.rev }; this.synth._noiseSweep(t, len, true); }
    else if (scene.fx === 'drop') { this.play(this.bank.crash, t, 0.9, { input: m.master, sources: new Set() }); }
    else if (scene.fx === 'fadeout') { g.setValueAtTime(base, t); g.linearRampToValueAtTime(0.0001, t + len); }
  }
  stopAll() { this.mixer.ch.forEach((ch) => ch.sources.forEach((s) => { try { s.stop(); } catch { /* */ } })); }
}

// ---------------------------------------------------------------
//  Transporte en vivo
// ---------------------------------------------------------------
export class Transport {
  constructor() { this.player = null; this.playing = false; this.queue = []; this.listeners = new Set(); }
  get project() { return this.player && this.player.p; }

  async play(project, { mode = 'scene', scene = 0 } = {}) {
    this.stop();
    const ctx = audio();
    const [bank, samples, lib] = await Promise.all([drumBank(), loadProjectSamples(project), loadProjectLib(project)]);
    const P = new Player(ctx, project, bank, samples); P.lib = lib;
    await P.prewarm();
    this.player = P;
    this.mode = mode; this.sceneIdx = Math.min(scene, project.scenes.length - 1); this.s = 0;
    this.next = ctx.currentTime + 0.1; this.queue = []; this.playing = true;
    this.timer = setInterval(() => this.tick(), 25); this.tick();
    const loop = () => { if (!this.playing) return; this.emitPos(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
    this.emit({ playing: true });
  }
  tick() {
    const P = this.player; if (!P) return; const p = P.p; const ctx = P.ctx;
    while (this.next < ctx.currentTime + 0.12) {
      if (!p.scenes.length) return;
      if (this.sceneIdx >= p.scenes.length) { this.sceneIdx = 0; this.s = 0; }
      const scene = p.scenes[this.sceneIdx]; const sd = 60 / p.bpm / 4;
      try { P.step(this.sceneIdx, this.s, this.next, sd); } catch (e) { console.error(e); }
      this.queue.push({ t: this.next, scene: this.sceneIdx, s: this.s });
      this.next += sd; this.s++;
      if (this.s >= scene.bars * 16) { this.s = 0; if (this.mode === 'song') this.sceneIdx = (this.sceneIdx + 1) % p.scenes.length; }
    }
  }
  emitPos() {
    const ctx = this.player.ctx; let cur = null;
    while (this.queue.length && this.queue[0].t <= ctx.currentTime) cur = this.queue.shift();
    if (cur) this.emit({ pos: cur, level: this.player.mixer.level() });
  }
  stop() {
    if (!this.player) return;
    clearInterval(this.timer); cancelAnimationFrame(this.raf);
    const P = this.player; this.player = null; this.playing = false;
    const g = P.mixer.master.gain; const now = P.ctx.currentTime;
    g.cancelScheduledValues(now); g.setTargetAtTime(0, now, 0.02);
    P.stopAll();
    setTimeout(() => { try { P.mixer.master.disconnect(); P.mixer.analyser.disconnect(); } catch { /* */ } }, 300);
    this.emit({ playing: false });
  }
  setScene(i) { this.sceneIdx = i; this.s = 0; }
  // cambios en vivo de mezcla
  async refreshLib() { if (this.player) { const m = await loadProjectLib(this.player.p); m.forEach((v, k) => this.player.lib.set(k, v)); } }
  update(track) { if (this.player) { this.player.mixer.channel(track); this.player.mixer.update(track); this.player.mixer.refresh(); } }
  setBpm(bpm) { if (this.player) this.player.mixer.setBpm(bpm); }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(e) { this.listeners.forEach((fn) => fn(e)); }
}
export const transport = new Transport();

// ---------------------------------------------------------------
//  Exportar (render offline) — canción completa o una escena
// ---------------------------------------------------------------
export async function renderProject(project, { sceneIdx = null, onProgress = null, tail = 2.5 } = {}) {
  const [bank, samples, lib] = await Promise.all([drumBank(), loadProjectSamples(project), loadProjectLib(project)]);
  const sd = 60 / project.bpm / 4;
  const list = sceneIdx == null ? project.scenes.map((_, i) => i) : [sceneIdx];
  const totalSteps = list.reduce((a, i) => a + project.scenes[i].bars * 16, 0);
  const dur = totalSteps * sd + tail;
  const oc = new OfflineAudioContext(2, Math.ceil(dur * SR), SR);
  const P = new Player(oc, project, bank, samples); P.lib = lib;
  const quantum = 128 / SR;
  let t = 0.05; const jobs = [];
  list.forEach((si) => {
    const bars = project.scenes[si].bars;
    for (let b = 0; b < bars; b++) {
      const t0 = t; const bar = b;
      jobs.push({ t: t0, fn: () => { for (let k = 0; k < 16; k++) P.step(si, bar * 16 + k, t0 + k * sd, sd); return P.flush(); } });
      t += 16 * sd;
    }
  });
  let done = 0;
  for (const j of jobs) {
    const at = Math.floor((j.t - 0.3) / quantum) * quantum;
    if (at <= 0) { await j.fn(); continue; }
    oc.suspend(at).then(() => j.fn()).then(() => { done++; onProgress && onProgress(done / jobs.length); oc.resume(); });
  }
  const out = await oc.startRendering();
  let pk = 0;
  for (let c = 0; c < 2; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; } }
  if (pk > 0.0001) { const k = 0.95 / pk; for (let c = 0; c < 2; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= k; } }
  return out;
}
