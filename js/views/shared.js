// ===============================================================
//  Piezas compartidas entre secciones: grabadora, forma de onda,
//  reproductor de resultado.
// ===============================================================
import { $, h, fmt, toast, esc } from '../core/ui.js';
import { audio, startRecorder, decode, stopPreview } from '../core/audio.js';

// Grabadora a pantalla completa. Devuelve {blob, buffer, t0} o null.
// opts.backing: AudioBuffer que suena mientras grabas (grabar sobre el beat)
// opts.lines: letra para ir marcando a tiempo
export async function recordOverlay(hint, { backing = null, lines = null, maxSec = 600 } = {}) {
  stopPreview();
  let rec;
  try { rec = await startRecorder(); } catch (e) { toast(e.message, 4500); return null; }
  const c = audio();
  let src = null, startAt = 0, beatPerf = 0;
  if (backing) {
    startAt = c.currentTime + 0.15; beatPerf = performance.now() + 150;
    src = c.createBufferSource(); src.buffer = backing; src.connect(c.destination); src.start(startAt);
  }
  $('recHint').textContent = hint;
  const pr = $('recPrompter'); pr.innerHTML = ''; pr.hidden = !lines;
  if (lines) fillPrompter(pr, lines);
  $('rec').hidden = false;
  const t0 = performance.now();
  return new Promise((resolve) => {
    let raf;
    const tick = () => {
      const el = (performance.now() - t0) / 1000;
      $('recTime').textContent = fmt(el);
      $('recLevel').style.width = `${Math.min(100, rec.level() * 120)}%`;
      if (lines && src) highlight(pr, c.currentTime - startAt, lines, true);
      if (el > maxSec) finish();
      raf = requestAnimationFrame(tick);
    };
    const finish = async () => {
      cancelAnimationFrame(raf); $('recStop').onclick = null;
      if (src) { src.onended = null; try { src.stop(); } catch { /* */ } }
      $('rec').hidden = true;
      const blob = await rec.stop();
      if (blob.size < 1000) { toast('La grabación quedó vacía'); resolve(null); return; }
      let buffer = null; try { buffer = await decode(blob); } catch { toast('No pude leer la grabación'); resolve(null); return; }
      const lat = (c.outputLatency || 0.04) + (c.baseLatency || 0.01) + 0.03;
      resolve({ blob, buffer, offset: backing ? (rec.t0 - beatPerf) / 1000 - lat : 0 });
    };
    $('recStop').onclick = finish;
    if (src) src.onended = finish;
    tick();
  });
}

export function fillPrompter(el, timeline) {
  el.innerHTML = ''; let sec = null;
  const colors = ['#ff2d4b', '#ffc23d', '#3ee08f', '#4dabff', '#c77dff', '#ff7a1a', '#e0aa55', '#2ed1e6'];
  timeline.forEach((ln, i) => {
    if (ln.chop) return;
    if (ln.section !== sec) { sec = ln.section; el.append(h('li.sec', {}, { verse: 'Verso', chorus: 'Coro', bridge: 'Puente', chop: 'Chops' }[sec] || sec)); }
    const letter = ln.rhyme >= 0 ? String.fromCharCode(65 + (ln.rhyme % 26)) : '';
    el.append(h('li', { 'data-i': i, html: `<span class="t">${fmt(ln.time)}</span><span class="rh" style="color:${colors[ln.rhyme % colors.length] || 'transparent'}">${letter}</span><span>${esc(ln.text)}</span>` }));
  });
}
export function highlight(el, t, timeline, scroll = false) {
  let cur = -1;
  for (let i = 0; i < timeline.length; i++) if (!timeline[i].chop && timeline[i].time <= t + 0.05) cur = i;
  el.querySelectorAll('li[data-i]').forEach((li) => {
    const on = +li.dataset.i === cur;
    if (on && !li.classList.contains('now')) { li.classList.add('now'); if (scroll) li.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    else if (!on) li.classList.remove('now');
  });
}

// Reproductor con forma de onda (para resultados de Crear y Voz)
export class WavePlayer {
  constructor({ onTime = null } = {}) {
    this.btn = h('button.play.always', { onclick: () => this.toggle() }, '▶');
    this.cv = h('canvas'); this.time = h('div.time', {}, '0:00');
    this.wave = h('div.wave', {}, this.cv, this.time);
    this.wave.onclick = (e) => { if (!this.buf) return; const r = this.wave.getBoundingClientRect(); this.play(((e.clientX - r.left) / r.width) * this.buf.duration); };
    this.el = h('div.player', {}, this.btn, this.wave);
    this.onTime = onTime; this.src = null; this.buf = null; this.offset = 0; this.peaks = null;
  }
  set(buf) { this.stop(); this.buf = buf; this.offset = 0; this.peaks = null; requestAnimationFrame(() => this.draw(0)); }
  toggle() { if (this.src) this.stop(); else this.play(this.offset); }
  play(from = 0) {
    if (!this.buf) return; this.stop(); stopPreview();
    const c = audio(); if (from >= this.buf.duration - 0.05) from = 0;
    const s = c.createBufferSource(); s.buffer = this.buf; s.connect(c.destination); s.start(0, from);
    this.src = s; this.start = c.currentTime - from; this.btn.textContent = '❚❚';
    s.onended = () => { if (this.src === s) { this.src = null; this.offset = 0; this.btn.textContent = '▶'; this.draw(0); } };
    const tick = () => { if (this.src !== s) return; const t = c.currentTime - this.start; this.draw(t / this.buf.duration); this.time.textContent = `${fmt(t)} / ${fmt(this.buf.duration)}`; this.onTime && this.onTime(t); this.raf = requestAnimationFrame(tick); };
    tick();
  }
  stop() {
    if (this.src) { const s = this.src; this.src = null; s.onended = null; try { s.stop(); } catch { /* */ } this.offset = audio().currentTime - this.start; }
    cancelAnimationFrame(this.raf); this.btn.textContent = '▶';
  }
  draw(prog) {
    const cv = this.cv; const dpr = window.devicePixelRatio || 1; const w = cv.clientWidth * dpr, hh = cv.clientHeight * dpr;
    if (!w || !this.buf) return;
    if (cv.width !== w) { cv.width = w; cv.height = hh; this.peaks = null; }
    if (!this.peaks) {
      const d = this.buf.getChannelData(0); const bars = Math.floor(w / (3 * dpr)); const per = Math.max(1, Math.floor(d.length / bars)); const pk = new Float32Array(bars);
      for (let i = 0; i < bars; i++) { let m = 0; for (let j = i * per; j < (i + 1) * per; j += 32) m = Math.max(m, Math.abs(d[j] || 0)); pk[i] = m; }
      this.peaks = pk;
    }
    const g = cv.getContext('2d'); g.clearRect(0, 0, w, hh);
    const grad = g.createLinearGradient(0, 0, w, 0); grad.addColorStop(0, '#ff2d4b'); grad.addColorStop(1, '#e0aa55');
    const bw = w / this.peaks.length;
    this.peaks.forEach((v, i) => { const bh = Math.max(2 * dpr, v * hh * 0.9); g.fillStyle = i / this.peaks.length <= prog ? grad : '#4a1c23'; g.fillRect(i * bw, (hh - bh) / 2, bw * 0.6, bh); });
    if (!this.src) this.time.textContent = fmt(this.buf.duration);
  }
}
