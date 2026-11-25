// ===============================================================
//  Promo "de madrugada" (estilo video filmado de noche, tipo TikTok)
//  Pieza oscura · monitor con la app · teclado rojo · luz de ambiente
//  1080×1920 · 30 fps · ~17,6 s · MP4 (H.264 + AAC)
// ===============================================================
import { Muxer, ArrayBufferTarget } from 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/build/mp4-muxer.mjs';
import { makeProject, newScene } from '../js/studio/model.js';
import { renderProject } from '../js/studio/sequencer.js';

const W = 1080, H = 1920, FPS = 30, BPM = 150, BEAT = 60 / BPM, BAR = BEAT * 4;
const DROP = 2 * BAR; const DUR = 11 * BAR; // 17,6 s
const cv = document.getElementById('cv'); const g = cv.getContext('2d');
const st = (t) => (document.getElementById('st').textContent = t);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);
const kick = (t) => (t < DROP ? 0 : Math.exp(-(((t - DROP) % BEAT) / BEAT) * 6));
const T2 = 8.0, T3 = 12.8; // cambios de texto

// ---------- pantalla del monitor (contenido de la app) ----------
const SW = 1000, SH = 640;
const scr = document.createElement('canvas'); scr.width = SW; scr.height = SH; const s = scr.getContext('2d');
const glow = document.createElement('canvas'); glow.width = SW / 4; glow.height = SH / 4; const gl = glow.getContext('2d');
const RR = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
const T = (c, str, x, y, size, color = '#fff', weight = 800, align = 'left') => { c.font = `${weight} ${size}px system-ui, "Segoe UI", Arial`; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(str, x, y); };
const ROWS = [['Bombo duro', '#ff2d4b', 'x...x...x...x...'], ['Palmas', '#ff7a1a', '....x.......x...'], ['Hat abierto', '#ffc23d', '..x...x...x...x.'], ['Rumble', '#e0aa55', '..xx..xx..xx..xx'], ['Acid 303', '#ff5c8a', 'x.xx.x.xx.x.xx.x'], ['Silbato', '#ffb020', '..............x.']];

function screenGrid(t) {
  s.fillStyle = '#0c0405'; s.fillRect(0, 0, SW, SH);
  T(s, 'DG Studio', 34, 40, 30, '#ff2d4b', 900); T(s, 'Hard Techno · 150 BPM · La menor', 210, 41, 20, '#c49aa1', 600);
  RR(s, SW - 150, 18, 120, 44, 22); s.fillStyle = t >= DROP ? '#ff2d4b' : '#3a141b'; s.fill(); T(s, t >= DROP ? '■ PLAY' : '▶ PLAY', SW - 90, 41, 18, '#fff', 800, 'center');
  const step = t >= DROP ? Math.floor(((t - DROP) / (BEAT / 4)) % 16) : -1;
  ROWS.forEach(([n, c, p], r) => {
    const y = 90 + r * 88;
    RR(s, 30, y, 170, 74, 12); s.fillStyle = '#210b0e'; s.fill(); s.fillStyle = c; s.fillRect(30, y, 6, 74); T(s, n, 48, y + 37, 19, '#fff', 700);
    for (let i = 0; i < 16; i++) {
      const x = 215 + i * 47.5; const on = p[i] === 'x';
      RR(s, x, y, 42, 74, 8); s.fillStyle = on ? c : Math.floor(i / 4) % 2 ? '#3a141b' : '#2c0f13'; s.fill();
      if (i === step) { s.fillStyle = on ? 'rgba(255,255,255,.65)' : 'rgba(255,255,255,.12)'; RR(s, x, y, 42, 74, 8); s.fill(); }
    }
  });
}
function screenVoice(t, t0) {
  s.fillStyle = '#0c0405'; s.fillRect(0, 0, SW, SH);
  T(s, '🎤 Editor de voz', 34, 40, 28, '#fff', 900); T(s, 'Autotune 85% · La menor · Eco', 300, 41, 20, '#c49aa1', 600);
  const lt = t - t0;
  for (let i = 0; i < 96; i++) { const x = 34 + i * 9.8; const hh = 20 + 220 * Math.abs(Math.sin(i * 0.37 + 1.3) * Math.sin(i * 0.11)) * (0.6 + kick(t) * 0.5); RR(s, x, 260 - hh / 2, 6, hh, 3); s.fillStyle = i < lt * 30 ? '#ff2d4b' : '#4a1c23'; s.fill(); }
  [['🌸 Otaku', 0], ['🪶 Fina', 1], ['🐻 Gruesa', 2], ['🤖 Robot', 3]].forEach(([l, i]) => { const x = 34 + i * 238; RR(s, x, 430, 222, 70, 16); s.fillStyle = i === 3 ? '#3a0b13' : '#210b0e'; s.fill(); if (i === 3) { s.lineWidth = 3; s.strokeStyle = '#ff2d4b'; s.stroke(); } T(s, l, x + 111, 465, 24, '#fff', 800, 'center'); });
  T(s, '✍️ fuego en la pista hasta que salga el sol', 34, 570, 24, '#ffd6dc', 700);
}
function screenMix(t, t0) {
  s.fillStyle = '#0c0405'; s.fillRect(0, 0, SW, SH);
  T(s, '🎚️ Mezcla', 34, 40, 28, '#fff', 900); T(s, 'beat + voz + coros', 200, 41, 20, '#c49aa1', 600);
  const lt = t - t0;
  [['Beat hard techno', '#ff2d4b', 0, 0.98], ['Mi voz', '#ffc23d', 0.15, 0.7], ['Coros', '#3ee08f', 0.4, 0.45], ['Grabación', '#4dabff', 0.08, 0.5]].forEach(([n, c, st0, w], i) => {
    const y = 90 + i * 130; RR(s, 30, y, SW - 60, 112, 12); s.fillStyle = '#140608'; s.fill();
    const slide = (1 - ease((lt - i * 0.12) / 0.4)) * 400; const x = 40 + st0 * 900 + slide; const ww = w * 900;
    RR(s, x, y + 10, ww, 92, 10); s.fillStyle = c + '40'; s.fill(); s.lineWidth = 3; s.strokeStyle = c; s.stroke();
    for (let k = 0; k < ww / 8; k++) { const hh = 8 + 60 * Math.abs(Math.sin(k * 0.8 + i)); s.fillStyle = 'rgba(255,255,255,.55)'; s.fillRect(x + 4 + k * 8, y + 56 - hh / 2, 4, hh); }
    T(s, n, x + 12, y + 26, 18, '#fff', 700);
  });
  const ph = 40 + clamp(lt / 2.4) * 900; s.fillStyle = '#fff'; s.fillRect(ph, 84, 3, 530);
}
function screenEnd(t, t0) {
  const lt = t - t0;
  const gr = s.createLinearGradient(0, 0, SW, SH); gr.addColorStop(0, '#2a0409'); gr.addColorStop(1, '#0b0203'); s.fillStyle = gr; s.fillRect(0, 0, SW, SH);
  const sc = 0.85 + 0.15 * ease(lt / 0.5) + kick(t) * 0.03;
  s.save(); s.translate(SW / 2, 170); s.scale(sc, sc);
  RR(s, -70, -70, 140, 140, 34); s.fillStyle = '#000'; s.fill(); s.lineWidth = 6; s.strokeStyle = '#ff2d4b'; s.stroke(); T(s, 'DG', 0, 4, 70, '#ff2d4b', 900, 'center'); s.restore();
  s.globalAlpha = ease((lt - 0.2) / 0.4);
  T(s, '¿Quieres probarla', SW / 2, 330, 64, '#fff', 900, 'center');
  T(s, 'gratis?', SW / 2, 410, 72, '#ff2d4b', 900, 'center');
  s.globalAlpha = ease((lt - 0.6) / 0.4);
  T(s, 'DG Studio · by differentgyal', SW / 2, 520, 28, '#e0aa55', 800, 'center');
  s.globalAlpha = 1;
}
function drawScreen(t) {
  if (t < T2) screenGrid(t);
  else if (t < T2 + 2.4) screenVoice(t, T2);
  else if (t < T3) screenMix(t, T2 + 2.4);
  else screenEnd(t, T3);
  // líneas de escaneo de pantalla grabada con el teléfono
  s.fillStyle = 'rgba(255,255,255,0.025)'; for (let y = 0; y < SH; y += 4) s.fillRect(0, y, SW, 1);
  gl.clearRect(0, 0, glow.width, glow.height); gl.filter = 'blur(6px)'; gl.drawImage(scr, 0, 0, glow.width, glow.height); gl.filter = 'none';
}

// ---------- grano de película ----------
const grain = document.createElement('canvas'); grain.width = 540; grain.height = 960;
(() => { const c = grain.getContext('2d'); const im = c.createImageData(540, 960); for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 22; } c.putImageData(im, 0, 0); })();

// ---------- teclado rojo ----------
function keyboard(t) {
  const lit = 0.45 + 0.55 * (t < DROP ? 0.35 + 0.1 * Math.sin(t * 2) : 0.55 + 0.45 * kick(t));
  g.save(); g.translate(150, 1520); g.transform(1, 0.12, -0.55, 0.55, 0, 0); // perspectiva de teclado sobre la mesa
  for (let r = 0; r < 5; r++) for (let k = 0; k < 14; k++) {
    const x = k * 82 + (r % 2) * 20, y = r * 88; const w = k === 13 && r === 4 ? 160 : 70;
    const a = lit * (0.7 + 0.3 * Math.sin(k * 0.9 + r * 1.7 + t * 3));
    g.fillStyle = `rgba(${200 + 55 * a | 0},${10 + 20 * a | 0},${30 + 20 * a | 0},${0.35 + 0.6 * a})`;
    g.shadowColor = 'rgba(255,20,50,.9)'; g.shadowBlur = 30 * a;
    RR(g, x, y, w, 70, 10); g.fill();
    g.shadowBlur = 0; g.fillStyle = 'rgba(0,0,0,.35)'; RR(g, x + 8, y + 8, w - 16, 44, 7); g.fill();
  }
  g.restore();
}

// ---------- texto tipo TikTok ----------
function caption(str, alpha, y = 470) {
  if (alpha <= 0) return;
  g.save(); g.globalAlpha = alpha; g.translate(W / 2, y); g.rotate(-0.07);
  g.font = '600 64px system-ui, "Segoe UI", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const lines = str.split('\n');
  lines.forEach((ln, i) => {
    const yy = (i - (lines.length - 1) / 2) * 80;
    g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineJoin = 'round'; g.strokeText(ln, 0, yy);
    g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 16; g.fillText(ln, 0, yy); g.shadowBlur = 0;
  });
  g.restore();
}

// ---------- cuadro completo ----------
export function frame(t) {
  // cámara en mano: deriva lenta + pequeño temblor
  const sx = Math.sin(t * 0.7) * 10 + Math.sin(t * 2.3) * 3, sy = Math.cos(t * 0.5) * 8 + Math.sin(t * 3.1) * 2;
  const rot = -0.075 + Math.sin(t * 0.4) * 0.008; const zoom = 1.04 + t * 0.004 + kick(t) * 0.006;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#030102'; g.fillRect(0, 0, W, H);
  g.save(); g.translate(W / 2 + sx, H / 2 + sy); g.rotate(rot); g.scale(zoom, zoom); g.translate(-W / 2, -H / 2);
  // luz roja de ambiente (arriba a la izquierda)
  const flick = 0.85 + 0.15 * Math.sin(t * 7.3) * Math.sin(t * 1.9);
  let rg = g.createRadialGradient(80, 120, 20, 80, 120, 700); rg.addColorStop(0, `rgba(200,0,20,${0.75 * flick})`); rg.addColorStop(1, 'rgba(120,0,10,0)');
  g.fillStyle = rg; g.fillRect(-200, -200, 1200, 1200);
  g.fillStyle = `rgba(160,0,15,${0.55 * flick})`; g.fillRect(-60, -60, 320, 440);
  // monitor
  drawScreen(t);
  const mx = 40, my = 640, mw = 1000, mh = 640;
  // halo de la pantalla
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.55 + kick(t) * 0.25; g.drawImage(glow, mx - 140, my - 120, mw + 280, mh + 240); g.restore();
  g.fillStyle = '#050203'; RR(g, mx - 22, my - 22, mw + 44, mh + 44, 18); g.fill();
  g.drawImage(scr, mx, my, mw, mh);
  // rayos de luz desde la pantalla
  g.save(); g.globalCompositeOperation = 'lighter';
  const ray = g.createLinearGradient(0, my - 380, 0, my + 100); ray.addColorStop(0, 'rgba(255,200,140,0)'); ray.addColorStop(1, `rgba(255,170,120,${0.10 + 0.08 * kick(t)})`);
  g.fillStyle = ray; g.beginPath(); g.moveTo(330, my - 380); g.lineTo(470, my - 380); g.lineTo(720, my + 60); g.lineTo(420, my + 60); g.closePath(); g.fill();
  g.restore();
  // reflejo en la mesa
  const refl = g.createLinearGradient(0, my + mh + 30, 0, my + mh + 260); refl.addColorStop(0, `rgba(255,40,70,${0.18 + 0.1 * kick(t)})`); refl.addColorStop(1, 'rgba(255,40,70,0)');
  g.fillStyle = refl; g.fillRect(mx, my + mh + 30, mw, 230);
  keyboard(t);
  g.restore();
  g.setTransform(1, 0, 0, 1, 0, 0);
  // viñeta + grano
  const v = g.createRadialGradient(W / 2, H * 0.48, 300, W / 2, H / 2, H * 0.72); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.85)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  const gx = (Math.floor(t * FPS) * 137) % 540, gy = (Math.floor(t * FPS) * 251) % 960;
  g.globalAlpha = 0.9; g.drawImage(grain, -gx, -gy, 1080, 1920); g.drawImage(grain, 1080 - gx, -gy, 1080, 1920); g.drawImage(grain, -gx, 1920 - gy, 1080, 1920); g.drawImage(grain, 1080 - gx, 1920 - gy, 1080, 1920); g.globalAlpha = 1;
  // textos
  caption('Yo produciendo techno\na las 3:69 AM 🐆', ease((t - 0.4) / 0.4) * clamp((T2 - t) / 0.25));
  caption('la app me arma el beat,\ncanta mi letra y me lo mezcla 🔥', ease((t - T2) / 0.3) * clamp((T3 - t) / 0.25));
  caption('¿Quieres probarla gratis?\nHáblame al DM 📩', ease((t - T3 - 0.3) / 0.4));
  // destello suave en el drop
  if (t >= DROP && t < DROP + 0.15) { g.fillStyle = `rgba(255,60,90,${0.35 * (1 - (t - DROP) / 0.15)})`; g.fillRect(0, 0, W, H); }
  // fundidos de entrada y salida
  if (t < 0.4) { g.fillStyle = `rgba(0,0,0,${1 - t / 0.4})`; g.fillRect(0, 0, W, H); }
  if (t > DUR - 0.35) { g.fillStyle = `rgba(0,0,0,${(t - (DUR - 0.35)) / 0.35})`; g.fillRect(0, 0, W, H); }
}

// ---------- música (hecha con la app): suena "apagada" en la intro y se abre en el drop ----------
async function music() {
  const p = makeProject('hardtechno', { bpm: BPM, seed: 2026, root: 9, mode: 'minor' });
  const all = Object.fromEntries(p.tracks.map((t) => [t.id, true]));
  const build = Object.fromEntries(p.tracks.filter((t) => t.role !== 'kick').map((t) => [t.id, true]));
  p.scenes = [newScene('Intro', 2, build, 'build'), newScene('Drop', 9, all, 'drop')];
  const buf = await renderProject(p, { tail: 0 });
  const sr = buf.sampleRate; const n = Math.floor(DUR * sr);
  const out = [0, 1].map((c) => Float32Array.from(buf.getChannelData(c).subarray(0, n)));
  // "se escucha desde otra pieza" en la intro: filtro grave
  out.forEach((d) => { let y = 0; const end = Math.floor(DROP * sr); for (let i = 0; i < end; i++) { const k = 0.04 + 0.5 * (i / end) ** 3; y += (d[i] - y) * k; d[i] = y * (0.8 + 0.4 * (i / end)); } });
  const f = Math.floor(0.6 * sr); out.forEach((d) => { for (let i = 0; i < f; i++) d[n - 1 - i] *= i / f; });
  return { sr, ch: out };
}

async function makeVideo() {
  st('Componiendo la música con DG Studio…');
  const { sr, ch } = await music();
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H, frameRate: FPS }, audio: { codec: 'aac', sampleRate: sr, numberOfChannels: 2 }, fastStart: 'in-memory' });
  let err = null;
  const ve = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => (err = e) });
  ve.configure({ codec: 'avc1.640028', width: W, height: H, bitrate: 9_000_000, framerate: FPS });
  const ae = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => (err = e) });
  ae.configure({ codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: 2, bitrate: 192000 });
  for (let o = 0; o < ch[0].length; o += sr) {
    const len = Math.min(sr, ch[0].length - o); const data = new Float32Array(len * 2);
    data.set(ch[0].subarray(o, o + len), 0); data.set(ch[1].subarray(o, o + len), len);
    ae.encode(new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: len, numberOfChannels: 2, timestamp: Math.round((o / sr) * 1e6), data }));
  }
  const frames = Math.round(DUR * FPS);
  for (let i = 0; i < frames; i++) {
    frame(i / FPS);
    const vf = new VideoFrame(cv, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
    ve.encode(vf, { keyFrame: i % (FPS * 2) === 0 }); vf.close();
    if (ve.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 0));
    if (i % 30 === 0) st(`Creando video… ${Math.round((i / frames) * 100)}%`);
    if (err) throw err;
  }
  await ve.flush(); await ae.flush(); muxer.finalize();
  const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
  const r = await fetch('/save?name=DG_Studio_historia_madrugada.mp4', { method: 'POST', body: blob }).catch(() => null);
  window.__video = { size: blob.size, saved: !!(r && r.ok) };
  st(`✅ Video listo (${(blob.size / 1e6).toFixed(1)} MB)`);
  return window.__video;
}
window.makeVideo = makeVideo; window.frame = frame;
document.getElementById('go').onclick = () => makeVideo().catch((e) => st('Error: ' + e.message));
document.getElementById('prev').onclick = () => { const t0 = performance.now(); const loop = () => { const t = (performance.now() - t0) / 1000; frame(t % DUR); if (t < DUR) requestAnimationFrame(loop); }; loop(); };
frame(5);
