// ===============================================================
//  👂 Oído: entrenamiento de beatmatch (como un DJ) con TUS canciones
//  - Beatmatch: la canción A suena a su tempo; la B entra desfasada y
//    a otro tempo. Con el pitch y los empujones (nudge) la cuadras de oído.
//  - ¿Qué BPM?: escucha un fragmento y adivina su tempo.
// ===============================================================
import { h, put, toast, busy, busyText, action, chips } from '../core/ui.js';
import { audio, pickFile, decode, stopPreview } from '../core/audio.js';
import { db } from '../core/db.js';
import { emit, on } from '../core/state.js';
import { addSample, listSamples, sampleBuffer, updateSample } from '../studio/samples.js';
import { transport } from '../studio/sequencer.js';
import { beatGrid } from '../ear/beats.js';

let root = null;
const ui = { mode: 'match', help: false, level: 'normal' };
let game = null; // ejercicio en curso
let stats = { matches: 0, best: 0, bpmRight: 0, bpmTotal: 0 };

export async function initEar(el) {
  root = el;
  stats = await db.kvGet('earStats', stats);
  on('tab', (t) => { if (t !== 'ear') stopGame(); else render(); });
  render();
}

// ---------- canciones disponibles ----------
async function songs() {
  const all = await listSamples();
  return all.filter((s) => s.dur >= 12 && (s.kind === 'audio' || s.kind === 'loop') && !(s.tags || []).includes('voz'));
}
async function gridOf(s) {
  if (s.grid && s.grid.v === 2) return s.grid;
  const buf = await sampleBuffer(s.id); if (!buf) return null;
  const g = await beatGrid(buf); s.grid = { ...g, v: 2 }; if (!s.bpm) s.bpm = Math.round(g.bpm);
  updateSample(s).catch(() => {});
  return s.grid;
}

// ---------- pantalla ----------
async function render() {
  if (!root) return;
  const list = await songs();
  root.innerHTML = '';
  put(root,
    h('div.card.leo', {},
      h('h3', {}, '👂 Entrena tu oído', h('small', {}, 'con las canciones que subes')),
      h('p.muted.small', { style: { margin: '0 0 10px' } }, 'Practica como DJ: cuadra el tempo y los golpes de dos canciones solo escuchando. Usa audífonos.'),
      chips([{ id: 'match', label: '🎧 Beatmatch' }, { id: 'bpm', label: '⏱ ¿Qué BPM?' }], ui.mode, (m) => { stopGame(); ui.mode = m; render(); }),
      h('div.muted.small', { style: { marginTop: '8px' } }, `Cuadrados: ${stats.matches} · Mejor puntaje: ${stats.best} · BPM acertados: ${stats.bpmRight}/${stats.bpmTotal}`)),
    list.length ? null : h('div.card', {},
      h('p', {}, 'Aún no tienes canciones en tu biblioteca.'),
      h('p.muted.small', {}, 'Sube canciones aquí o en 🔁 Loops. Con una sola canción ya puedes practicar: la app la usa en los dos lados.')),
    h('div.grid2', { style: { marginTop: '10px' } },
      h('button.btn', { onclick: action(uploadSong) }, '📁 Subir canción'),
      h('button.btn', { onclick: () => emit('goto', 'loops') }, '🔁 Ir a mis sonidos')),
    ui.mode === 'match' ? matchCard(list) : bpmCard(list));
}

async function uploadSong() {
  const f = await pickFile(); if (!f) return;
  busy('Guardando la canción…');
  try {
    const buf = await decode(f);
    if (buf.duration < 12) { toast('Sube una canción de más de 12 segundos'); return; }
    const name = f.name.replace(/\.[^.]+$/, '').slice(0, 40);
    busyText('Buscando sus tiempos…');
    const g = await beatGrid(buf);
    const rec = await addSample({ name, blob: f, buffer: buf, bpm: Math.round(g.bpm), kind: 'audio', tags: ['cancion', name] });
    rec.grid = { ...g, v: 2 }; await updateSample(rec);
    toast(`💾 ${name} · ${g.bpm.toFixed(1)} BPM`);
  } finally { busy(false); }
  render();
}

// =================================================================
//  🎧 BEATMATCH
// =================================================================
function matchCard(list) {
  const box = h('div.card', { style: { marginTop: '10px' } },
    h('h3', {}, '🎧 Beatmatch'),
    h('p.muted.small', { style: { margin: '0 0 8px' } }, 'A suena a su tempo. B entra más rápida o más lenta y fuera de golpe. Mueve el Pitch hasta que no se "galopen", y usa ◀ ▶ para empujarla hasta que los bombos suenen como uno solo.'),
    h('div.row', {}, h('span.muted.small', {}, 'Dificultad'),
      chips([{ id: 'facil', label: 'Fácil' }, { id: 'normal', label: 'Normal' }, { id: 'pro', label: 'Pro' }], ui.level, (v) => { ui.level = v; })),
    h('label.row', { style: { marginTop: '6px', gap: '8px' } }, h('input', { type: 'checkbox', checked: ui.help, onchange: (e) => { ui.help = e.target.checked; if (game) game.paint(); } }), h('span.small', {}, '👀 Ayuda visual (luces de golpe y BPM)')),
    h('button.btn.primary.block', { style: { marginTop: '10px' }, disabled: !list.length, onclick: action(() => startMatch(list)) }, '▶ Nuevo ejercicio'),
    h('div#matchArea'));
  return box;
}

function pickPair(list, grids) {
  // B a ±16 % de A (o al doble / mitad); si no hay, se usa la misma canción
  const opts = [];
  for (const a of list) for (const b of list) {
    const ga = grids.get(a.id), gb = grids.get(b.id); if (!ga || !gb) continue;
    for (const k of [1, 2, 0.5]) { const r = ga.bpm / (gb.bpm * k); if (r > 0.86 && r < 1.14) opts.push({ a, b, k }); }
  }
  const diff = opts.filter((o) => o.a.id !== o.b.id);
  const pool = diff.length ? diff : opts;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function startMatch(list) {
  stopGame();
  busy('Escuchando tus canciones…');
  const grids = new Map();
  try {
    const sample = list.slice().sort(() => Math.random() - 0.5).slice(0, 6);
    for (let i = 0; i < sample.length; i++) { busyText(`Buscando los tiempos… ${i + 1}/${sample.length}`); const g = await gridOf(sample[i]); if (g) grids.set(sample[i].id, g); }
    list = sample;
  } finally { busy(false); }
  const pair = pickPair(list, grids); if (!pair) { toast('No pude encontrar el tempo de tus canciones'); return; }
  const [bufA, bufB] = await Promise.all([sampleBuffer(pair.a.id), sampleBuffer(pair.b.id)]);
  game = new Match(pair, grids.get(pair.a.id), grids.get(pair.b.id), bufA, bufB);
  game.start();
}

class Match {
  constructor(pair, gA, gB, bufA, bufB) {
    Object.assign(this, { pair, ga: gA, gb: gB, bufA, bufB });
    this.perA = 60 / gA.bpm; this.perB = 60 / (gB.bpm * pair.k); // periodo de B "en su compás" (con ×2 / ×½)
    this.target = this.perB / this.perA;                          // playbackRate que cuadra B con A
    const lvl = { facil: [0.02, 0.03], normal: [0.03, 0.06], pro: [0.05, 0.09] }[ui.level];
    const off = lvl[0] + Math.random() * (lvl[1] - lvl[0]);
    this.pitch = (this.target * (Math.random() < 0.5 ? 1 - off : 1 + off)); // rate inicial (desafinado)
    this.nudge = 1; this.monitor = 'both';
  }
  // segmento en bucle: 32 tiempos (8 compases) desde la mitad de la canción, alineado a sus golpes
  loopOf(buf, g, per) {
    const beats = 32; const len = beats * per; const n0 = Math.max(0, Math.floor((buf.duration * 0.35 - g.offset) / per));
    let start = g.offset + n0 * per; if (start + len > buf.duration) start = Math.max(g.offset, buf.duration - len - per);
    return { start, end: Math.min(buf.duration, start + len) };
  }
  start() {
    stopPreview(); transport.stop();
    const c = audio(); this.c = c;
    this.out = c.createGain(); this.out.gain.value = 0.85; this.out.connect(c.destination);
    this.vA = c.createGain(); this.vB = c.createGain(); this.vA.connect(this.out); this.vB.connect(this.out);
    this.lA = this.loopOf(this.bufA, this.ga, this.perA);
    this.lB = this.loopOf(this.bufB, this.gb, this.perB);
    const t0 = c.currentTime + 0.15;
    this.sA = this.src(this.bufA, this.lA, 1); this.sA.connect(this.vA); this.sA.start(t0, this.lA.start);
    // B entra unos tiempos después y fuera de golpe
    const lateBeats = 4 + Math.random() * 0.6 + 0.2;
    this.sB = this.src(this.bufB, this.lB, this.pitch); this.sB.connect(this.vB);
    this.tB0 = t0 + lateBeats * this.perA; this.sB.start(this.tB0, this.lB.start);
    // seguimiento de la posición (para medir la fase)
    this.posA = { t: t0, p: this.lA.start, r: 1 };
    this.posB = { t: this.tB0, p: this.lB.start, r: this.pitch };
    this.setMonitor('both');
    this.ui(); this.loop();
  }
  src(buf, l, rate) { const s = this.c.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = l.start; s.loopEnd = l.end; s.playbackRate.value = rate; return s; }
  pos(P, l) { const now = this.c.currentTime; if (now < P.t) return P.p; let p = P.p + (now - P.t) * P.r; const len = l.end - l.start; if (p >= l.end) p = l.start + ((p - l.start) % len); return p; }
  setRateB(r) {
    const p = this.pos(this.posB, this.lB); this.posB = { t: Math.max(this.c.currentTime, this.posB.t), p, r };
    this.sB.playbackRate.setValueAtTime(r, this.c.currentTime);
  }
  setMonitor(m) { this.monitor = m; this.vA.gain.value = m === 'B' ? 0 : 1; this.vB.gain.value = m === 'A' ? 0 : 1; }
  phaseErr() { // en milisegundos (+ = B adelantada)
    const pa = this.pos(this.posA, this.lA), pb = this.pos(this.posB, this.lB);
    const m1 = (x) => ((x % 1) + 1) % 1; const fa = m1((pa - this.ga.offset) / this.perA), fb = m1((pb - this.gb.offset) / this.perB);
    let d = (fb - fa) % 1; if (d > 0.5) d -= 1; if (d < -0.5) d += 1;
    return d * this.perA * 1000;
  }
  bpmA() { return this.ga.bpm; }
  bpmB() { return this.gb.bpm * this.pair.k * this.pitch; }
  ui() {
    const area = root.querySelector('#matchArea'); if (!area) return; area.innerHTML = '';
    const pctNow = () => ((this.pitch - 1) * 100);
    this.lightA = h('span.beatlight'); this.lightB = h('span.beatlight.b');
    this.info = h('div.small.muted', { style: { minHeight: '18px' } });
    const pitchVal = h('b', {}, '');
    const showPitch = () => { pitchVal.textContent = `${pctNow() >= 0 ? '+' : ''}${pctNow().toFixed(1)} %`; };
    const range = h('input', { type: 'range', min: -16, max: 16, step: 0.05, value: pctNow(), style: { width: '100%' } });
    range.oninput = () => { this.pitch = 1 + +range.value / 100; this.setRateB(this.pitch * this.nudge); showPitch(); };
    const fine = (d) => { this.pitch = Math.max(0.84, Math.min(1.16, this.pitch + d / 100)); range.value = pctNow(); this.setRateB(this.pitch * this.nudge); showPitch(); };
    const nudgeBtn = (label, k) => { const b = h('button.btn.big', { style: { touchAction: 'none' } }, label);
      const down = (e) => { e.preventDefault(); this.nudge = k; this.setRateB(this.pitch * k); b.classList.add('on'); };
      const up = () => { if (this.nudge === 1) return; this.nudge = 1; this.setRateB(this.pitch); b.classList.remove('on'); };
      b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up); return b; };
    showPitch();
    put(area,
      h('div.deckrow', {}, h('div.deck', {}, this.lightA, h('div', {}, h('b', {}, 'A · referencia'), h('div.small.muted', {}, this.pair.a.name))),
        h('div.deck', {}, this.lightB, h('div', {}, h('b', {}, 'B · cuádrala'), h('div.small.muted', {}, this.pair.b.name)))),
      h('div.row', { style: { marginTop: '8px' } }, h('span.small', {}, 'Escuchar:'), chips([{ id: 'A', label: 'Solo A' }, { id: 'both', label: 'A + B' }, { id: 'B', label: 'Solo B' }], 'both', (m) => this.setMonitor(m))),
      h('div', { style: { marginTop: '10px' } }, h('div.row', {}, h('span.small', {}, 'Pitch de B'), h('span.grow'), pitchVal), range,
        h('div.grid2', { style: { marginTop: '6px' } }, h('button.btn.sm', { onclick: () => fine(-0.1) }, '− 0,1 %'), h('button.btn.sm', { onclick: () => fine(0.1) }, '+ 0,1 %'))),
      h('div.small.muted', { style: { marginTop: '10px' } }, 'Empujar B (mantén apretado):'),
      h('div.grid2', {}, nudgeBtn('◀ Frenar', 0.96), nudgeBtn('Acelerar ▶', 1.04)),
      this.info,
      h('div.grid2', { style: { marginTop: '10px' } },
        h('button.btn.primary', { onclick: () => this.check() }, '✅ Comprobar'),
        h('button.btn', { onclick: () => { stopGame(); render(); } }, '■ Parar')),
      h('div#matchResult'));
  }
  paint() { if (!ui.help && this.info) { this.info.textContent = ''; } }
  loop() {
    const tick = () => {
      if (game !== this) return;
      const now = this.c.currentTime;
      const flash = (el, P, l, g, per, k) => { const p = this.pos(P, l); const ph = (((p - g.offset) / per) % 1 + 1) % 1; el.classList.toggle('on', now >= P.t && ph < 0.12 && (k === 'A' ? this.monitor !== 'B' : this.monitor !== 'A')); };
      if (ui.help) {
        flash(this.lightA, this.posA, this.lA, this.ga, this.perA, 'A'); flash(this.lightB, this.posB, this.lB, this.gb, this.perB, 'B');
        this.info.textContent = `A ${this.bpmA().toFixed(1)} BPM · B ${this.bpmB().toFixed(1)} BPM`;
      } else { this.lightA.classList.remove('on'); this.lightB.classList.remove('on'); }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  check() {
    const tErr = (Math.abs(this.bpmB() - this.bpmA()) / this.bpmA()) * 100;
    const ms = this.phaseErr();
    const score = Math.max(0, Math.round(100 - tErr * 35 - Math.abs(ms) * 0.9));
    const stars = score >= 90 ? '⭐⭐⭐' : score >= 70 ? '⭐⭐' : score >= 45 ? '⭐' : '—';
    const tMsg = tErr < 0.15 ? '✅ Tempo cuadrado' : `${this.bpmB() > this.bpmA() ? '⏩ B va más rápida' : '⏪ B va más lenta'} (${tErr.toFixed(1)} %): ${this.bpmB() > this.bpmA() ? 'baja' : 'sube'} el pitch`;
    const pMsg = Math.abs(ms) < 15 ? '✅ Golpes juntos' : `${ms > 0 ? 'B va adelantada' : 'B va atrasada'} ${Math.abs(ms).toFixed(0)} ms: ${ms > 0 ? 'frénala ◀' : 'acelérala ▶'}`;
    const res = root.querySelector('#matchResult');
    if (res) { res.innerHTML = ''; put(res, h('div.card', { style: { marginTop: '10px', textAlign: 'center' } }, h('div', { style: { fontSize: '28px' } }, stars), h('b', {}, `${score} puntos`), h('div.small', {}, tMsg), h('div.small', {}, pMsg), h('div.small.muted', {}, `Real: A ${this.bpmA().toFixed(1)} BPM · B ${this.bpmB().toFixed(1)} BPM`))); }
    if (score >= 70) stats.matches++;
    stats.best = Math.max(stats.best, score); db.kvSet('earStats', stats);
  }
  stop() { cancelAnimationFrame(this.raf); [this.sA, this.sB].forEach((s) => { try { s.stop(); } catch { /* */ } }); try { this.out.disconnect(); } catch { /* */ } }
}

function stopGame() { if (game) { game.stop(); game = null; } }

// =================================================================
//  ⏱ ¿QUÉ BPM?
// =================================================================
function bpmCard(list) {
  const area = h('div#bpmArea');
  const box = h('div.card', { style: { marginTop: '10px' } },
    h('h3', {}, '⏱ ¿Qué BPM?'),
    h('p.muted.small', { style: { margin: '0 0 8px' } }, 'Escucha 15 segundos de una de tus canciones y elige su tempo. Tip: cuenta los bombos durante 15 segundos y multiplica por 4.'),
    h('button.btn.primary.block', { disabled: !list.length, onclick: action(() => startBpm(list, area)) }, '▶ Nueva pregunta'),
    area);
  return box;
}
async function startBpm(list, area) {
  stopGame();
  const s = list[Math.floor(Math.random() * list.length)];
  busy('Preparando…'); let g, buf;
  try { g = await gridOf(s); buf = await sampleBuffer(s.id); } finally { busy(false); }
  if (!g || !buf) { toast('No pude leer esa canción'); return; }
  const real = Math.round(g.bpm);
  const set = new Set([real]); while (set.size < 4) { const d = (Math.random() < 0.5 ? -1 : 1) * (3 + Math.floor(Math.random() * 12)); set.add(real + d); }
  const opts = [...set].sort((a, b) => a - b);
  const c = audio(); const out = c.createGain(); out.gain.value = 0.85; out.connect(c.destination);
  const src = c.createBufferSource(); src.buffer = buf; src.connect(out);
  const from = Math.min(Math.max(0, buf.duration * 0.35), Math.max(0, buf.duration - 15));
  src.start(c.currentTime + 0.05, from, 15);
  game = { stop: () => { try { src.stop(); } catch { /* */ } try { out.disconnect(); } catch { /* */ } } };
  area.innerHTML = '';
  const res = h('div.small', { style: { marginTop: '8px', textAlign: 'center' } });
  put(area, h('p.small', { style: { marginTop: '10px' } }, `🎵 ${s.name}`),
    h('div.grid2', {}, ...opts.map((b) => h('button.btn', { onclick: (e) => {
      stats.bpmTotal++; const ok = b === real; if (ok) stats.bpmRight++; db.kvSet('earStats', stats);
      area.querySelectorAll('button').forEach((x) => { x.disabled = true; if (+x.dataset.b === real) x.classList.add('primary'); });
      e.target.classList.add(ok ? 'primary' : 'danger');
      res.textContent = ok ? `✅ ¡Bien! Va a ${g.bpm.toFixed(1)} BPM` : `❌ Era ${real} BPM (${g.bpm.toFixed(1)}). ${b > real ? 'Te pasaste' : 'Te quedaste corta'} por ${Math.abs(b - real)}.`;
    }, 'data-b': b }, `${b} BPM`))), res);
}
