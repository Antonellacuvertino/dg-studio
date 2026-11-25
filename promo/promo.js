// ===============================================================
//  Video promocional de DG Studio para Historias de Instagram
//  1080×1920 · 30 fps · 16 s · MP4 (H.264 + AAC)
//  La música es un beat hard techno generado con la propia app.
// ===============================================================
import { Muxer, ArrayBufferTarget } from 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/build/mp4-muxer.mjs';
import { makeProject, newScene } from '../js/studio/model.js';
import { renderProject } from '../js/studio/sequencer.js';

const W = 1080, H = 1920, FPS = 30, BPM = 150, BEAT = 60 / BPM, BAR = BEAT * 4;
const DUR = 16; const DROP = 2 * BAR; // el drop cae a los 3,2 s
const cv = document.getElementById('cv'); const g = cv.getContext('2d');
const st = (t) => (document.getElementById('st').textContent = t);
const RED = '#ff2d4b', RED2 = '#e3102f', GOLD = '#e0aa55';
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
let rnd = 7; const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);

// ---------- fondo de leopardo (se dibuja una vez) ----------
const leo = document.createElement('canvas'); leo.width = W * 1.3; leo.height = H * 1.3;
(() => {
  const c = leo.getContext('2d');
  const gr = c.createLinearGradient(0, 0, 0, leo.height); gr.addColorStop(0, '#5a0614'); gr.addColorStop(0.5, '#3a040e'); gr.addColorStop(1, '#1a0206');
  c.fillStyle = gr; c.fillRect(0, 0, leo.width, leo.height);
  for (let i = 0; i < 170; i++) {
    const x = rand() * leo.width, y = rand() * leo.height, r = 26 + rand() * 30;
    c.fillStyle = 'rgba(224,150,80,0.30)'; c.beginPath(); c.ellipse(x, y, r * 0.75, r * 0.6, rand() * 3, 0, 7); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.85)';
    const n = 4 + ((rand() * 2) | 0);
    for (let k = 0; k < n; k++) { const a = (k / n) * 6.28 + rand() * 0.6; c.beginPath(); c.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.85, r * 0.42, r * 0.26, a + 1.57, 0, 7); c.fill(); }
  }
})();

// ---------- utilidades de dibujo ----------
function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function text(s, x, y, size, { color = '#fff', weight = 900, align = 'center', alpha = 1, shadow = true, font = 'system-ui, "Segoe UI", Arial' } = {}) {
  g.save(); g.globalAlpha = alpha; g.font = `${weight} ${size}px ${font}`; g.textAlign = align; g.textBaseline = 'middle';
  if (shadow) { g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 24; g.shadowOffsetY = 6; }
  g.fillStyle = color; g.fillText(s, x, y); g.restore();
}
function gradText(s, x, y, size, alpha = 1) {
  g.save(); g.globalAlpha = alpha; g.font = `900 ${size}px system-ui, "Segoe UI", Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
  let m = g.measureText(s).width;
  if (m > W * 0.86) { size = Math.floor((size * W * 0.86) / m); g.font = `900 ${size}px system-ui, "Segoe UI", Arial`; m = g.measureText(s).width; } const gr = g.createLinearGradient(x - m / 2, 0, x + m / 2, 0); gr.addColorStop(0, '#ff5a72'); gr.addColorStop(1, '#e3102f');
  g.shadowColor = 'rgba(255,45,75,.6)'; g.shadowBlur = 40; g.fillStyle = gr; g.fillText(s, x, y); g.restore();
}
function pill(s, x, y, size, bg = RED2, alpha = 1) {
  g.save(); g.globalAlpha = alpha; g.font = `800 ${size}px system-ui, "Segoe UI", Arial`; const w = g.measureText(s).width + size * 1.4; const h = size * 1.9;
  rr(x - w / 2, y - h / 2, w, h, h / 2); g.fillStyle = bg; g.fill(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, x, y + 2); g.restore();
}
function phone(x, y, w, h, alpha = 1) {
  g.save(); g.globalAlpha = alpha; g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 60;
  rr(x, y, w, h, 70); g.fillStyle = '#050102'; g.fill(); g.shadowBlur = 0;
  g.lineWidth = 6; g.strokeStyle = '#3d151b'; g.stroke();
  rr(x + 18, y + 18, w - 36, h - 36, 54); g.fillStyle = '#120607'; g.fill();
  g.restore();
}
const beatPhase = (t) => ((t % BEAT) / BEAT);
const kickPulse = (t) => (t < DROP ? 0 : Math.exp(-beatPhase(t) * 7));

// ---------- escenas ----------
function background(t) {
  const z = 1 + t * 0.012 + kickPulse(t) * 0.015; const ox = -W * 0.15 - t * 6, oy = -H * 0.15 - t * 10;
  g.save(); g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-W / 2, -H / 2); g.drawImage(leo, ox, oy); g.restore();
  const v = g.createRadialGradient(W / 2, H * 0.45, 200, W / 2, H / 2, H * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.55, 'rgba(0,0,0,.35)'); v.addColorStop(1, 'rgba(0,0,0,.8)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  // destello rojo en cada bombo
  if (t >= DROP) { g.fillStyle = `rgba(255,30,60,${kickPulse(t) * 0.12})`; g.fillRect(0, 0, W, H); }
}

function sceneIntro(t) { // 0 → 3,2 s
  const a1 = ease(t / 0.5) * clamp((1.5 - t) / 0.3);
  text('¿Haces música?', W / 2, H * 0.42, 92, { alpha: a1 });
  const a2 = ease((t - 1.5) / 0.4);
  text('¿Y si tu teléfono', W / 2, H * 0.40, 84, { alpha: a2 });
  text('fuera tu estudio?', W / 2, H * 0.40 + 110, 84, { alpha: a2, color: RED });
  // barra de subida (build)
  const p = clamp(t / DROP); rr(W * 0.2, H * 0.62, W * 0.6, 14, 7); g.fillStyle = 'rgba(255,255,255,.12)'; g.fill();
  rr(W * 0.2, H * 0.62, W * 0.6 * p, 14, 7); g.fillStyle = RED; g.fill();
}

function sceneLogo(t) { // 3,2 → 5,6 s
  const lt = t - DROP; const s = 0.6 + 0.4 * ease(lt / 0.25) + kickPulse(t) * 0.05;
  if (lt < 0.12) { g.fillStyle = `rgba(255,255,255,${1 - lt / 0.12})`; g.fillRect(0, 0, W, H); }
  g.save(); g.translate(W / 2, H * 0.4); g.scale(s, s);
  rr(-170, -170, 340, 340, 80); g.fillStyle = '#000'; g.fill(); g.drawImage(leo, 200, 300, 600, 600, -170, -170, 340, 340);
  g.lineWidth = 10; g.strokeStyle = RED; rr(-170, -170, 340, 340, 80); g.stroke();
  text('DG', 0, 8, 170, { color: RED });
  g.restore();
  gradText('DG STUDIO', W / 2, H * 0.4 + 300, 130, ease((lt - 0.15) / 0.3));
  text('by differentgyal', W / 2, H * 0.4 + 410, 56, { weight: 700, color: '#ffd6dc', alpha: ease((lt - 0.35) / 0.3) });
  text('Tu estudio de música en el teléfono', W / 2, H * 0.4 + 540, 52, { weight: 800, alpha: ease((lt - 0.8) / 0.4) });
}

const ROWS = [['Bombo', '#ff2d4b', 'x...x...x...x...'], ['Palmas', '#ff7a1a', '....x.......x...'], ['Hat', '#ffc23d', '..x...x...x...x.'], ['Rumble', '#e0aa55', '..xx..xx..xx..xx'], ['Acid', '#ff5c8a', 'x.xx.x.xx.x.xx.x']];
function sceneGrid(t, t0) { // beat grid
  const lt = t - t0; const a = ease(lt / 0.35);
  text('🟥 Haz beats tocando casillas', W / 2, 330, 64, { alpha: a });
  const py = 470 + (1 - a) * 200; phone(120, py, 840, 1180, a);
  g.save(); g.globalAlpha = a;
  // tarjetas de estilo
  [['Hard Techno', '#ff2d4b', '152 BPM'], ['Techno Latino', '#ff7a1a', '145 BPM'], ['Acid', '#ffc23d', '138 BPM']].forEach(([n, c, b], i) => {
    const x = 170 + i * 255; rr(x, py + 80, 235, 160, 26); g.fillStyle = c; g.fill();
    if (i === 0) { g.lineWidth = 7; g.strokeStyle = '#fff'; g.stroke(); }
    text(n, x + 18, py + 135, 34, { align: 'left', color: '#160406', shadow: false });
    text(b, x + 18, py + 190, 26, { align: 'left', color: '#160406', weight: 700, shadow: false, alpha: a * 0.75 });
  });
  // cuadrícula
  const step = Math.floor(((t - DROP) / (BEAT / 4)) % 16 + 16) % 16;
  ROWS.forEach(([n, c, p], r) => {
    const y = py + 300 + r * 150;
    rr(160, y, 150, 120, 18); g.fillStyle = '#210b0e'; g.fill(); g.fillStyle = c; g.fillRect(160, y, 10, 120);
    text(n, 182, y + 60, 30, { align: 'left', shadow: false });
    for (let i = 0; i < 16; i++) {
      const on = p[i] === 'x'; const x = 325 + i * 37.5;
      rr(x, y, 32, 120, 8); g.fillStyle = on ? c : Math.floor(i / 4) % 2 ? '#3a141b' : '#2c0f13'; g.fill();
      if (i === step) { g.lineWidth = 5; g.strokeStyle = '#fff'; rr(x - 3, y - 3, 38, 126, 10); g.stroke(); }
      if (on && i === step) { g.fillStyle = 'rgba(255,255,255,.5)'; rr(x, y, 32, 120, 8); g.fill(); }
    }
  });
  g.restore();
  pill('16 estilos · sonidos libres para monetizar', W / 2, py + 1100, 36, 'rgba(225,10,45,.9)', a);
}

function sceneVoice(t, t0) {
  const lt = t - t0; const a = ease(lt / 0.3);
  text('🎤 Tu voz + autotune', W / 2, 330, 70, { alpha: a });
  phone(120, 470, 840, 1180, a);
  g.save(); g.globalAlpha = a;
  const lyric = 'fuego en la pista hasta que salga el sol'; const n = Math.floor(clamp(lt / 1.2) * lyric.length);
  rr(170, 560, 740, 240, 26); g.fillStyle = '#210b0e'; g.fill();
  text('✍️ ' + lyric.slice(0, n) + (Math.floor(lt * 4) % 2 ? '|' : ''), 200, 680, 38, { align: 'left', weight: 700, shadow: false });
  // forma de onda que sigue el bombo
  for (let i = 0; i < 46; i++) { const x = 180 + i * 16; const hgt = 20 + 120 * Math.abs(Math.sin(i * 0.7 + lt * 9)) * (0.4 + kickPulse(t)); rr(x, 900 - hgt / 2, 10, hgt, 5); g.fillStyle = i < (lt / 2.4) * 46 ? RED : '#4a1c23'; g.fill(); }
  const chips = [['🌸', 'Otaku'], ['🪶', 'Fina'], ['🐻', 'Gruesa'], ['🔥', 'Ronca'], ['🤖', 'Robot'], ['🧬', 'Mi voz']];
  chips.forEach(([e, c], i) => { const ap = ease((lt - 0.4 - i * 0.12) / 0.2); const x = 170 + (i % 2) * 375, y = 1040 + Math.floor(i / 2) * 150;
    g.globalAlpha = a * ap; rr(x, y, 355, 120, 24); g.fillStyle = i === 0 ? '#3a0b13' : '#210b0e'; g.fill(); if (i === 0) { g.lineWidth = 5; g.strokeStyle = RED; g.stroke(); }
    text(`${e} ${c}`, x + 177, y + 60, 42, { shadow: false }); });
  g.restore();
  pill('Escribe la letra · la app la canta', W / 2, 1570, 38, 'rgba(225,10,45,.9)', a);
}

function sceneMix(t, t0) {
  const lt = t - t0; const a = ease(lt / 0.3);
  text('🎚️ Junta voces y beats', W / 2, 330, 70, { alpha: a });
  phone(120, 470, 840, 1180, a);
  g.save(); g.globalAlpha = a;
  const lanes = [['Beat hard techno', '#ff2d4b', 0, 1], ['Mi voz', '#ffc23d', 0.18, 0.75], ['Coros', '#3ee08f', 0.4, 0.5], ['Grabación', '#4dabff', 0.1, 0.55]];
  lanes.forEach(([n, c, s, w], i) => {
    const y = 600 + i * 190; rr(170, y, 740, 160, 20); g.fillStyle = '#0d0405'; g.fill();
    const slide = (1 - ease((lt - i * 0.15) / 0.4)) * 500;
    const x = 190 + s * 700 + slide; const ww = w * 680;
    rr(x, y + 20, ww, 120, 16); g.fillStyle = c + '44'; g.fill(); g.lineWidth = 4; g.strokeStyle = c; g.stroke();
    for (let k = 0; k < ww / 10; k++) { const hh = 10 + 80 * Math.abs(Math.sin(k * 0.9 + i)); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x + 6 + k * 10, y + 80 - hh / 2, 5, hh); }
    text(n, x + 16, y + 42, 28, { align: 'left', shadow: false });
  });
  const ph = 190 + clamp(lt / 2.4) * 700; g.fillStyle = '#fff'; g.fillRect(ph, 590, 5, 770);
  g.restore();
  pill('⬇️ Exporta MP3 / WAV para tu set de DJ', W / 2, 1570, 38, 'rgba(225,10,45,.9)', a);
}

function sceneStyles(t, t0) {
  const lt = t - t0; const words = ['HARD TECHNO', 'TECHNO LATINO', 'ACID', 'REGGAETÓN', 'TRAP', 'RAVE'];
  const i = Math.min(words.length - 1, Math.floor(lt / (BEAT)));
  gradText(words[i], W / 2, H * 0.44, 132 + kickPulse(t) * 14);
  text('y muchos estilos más', W / 2, H * 0.44 + 150, 56, { weight: 700, alpha: ease(lt / 0.4) });
}

function sceneCTA(t, t0) {
  const lt = t - t0; const a = ease(lt / 0.3); const out = clamp((DUR - t) / 0.25);
  g.save(); g.globalAlpha = out;
  g.translate(W / 2, 520); const s = 0.8 + 0.2 * a + kickPulse(t) * 0.04; g.scale(s, s);
  rr(-120, -120, 240, 240, 56); g.fillStyle = '#000'; g.fill(); g.drawImage(leo, 400, 500, 400, 400, -120, -120, 240, 240); g.lineWidth = 8; g.strokeStyle = RED; rr(-120, -120, 240, 240, 56); g.stroke();
  text('DG', 0, 6, 120, { color: RED }); g.restore();
  g.save(); g.globalAlpha = out;
  gradText('PRUÉBALA GRATIS', W / 2, 820, 104, a);
  text('Crea · Canta · Mezcla · Exporta', W / 2, 940, 50, { weight: 700, alpha: a });
  pill('antonellacuvertino.github.io/dg-studio', W / 2, 1110, 40, RED2, ease((lt - 0.3) / 0.3));
  text('🔗 Link en mi perfil', W / 2, 1250, 52, { weight: 800, alpha: ease((lt - 0.5) / 0.3) });
  text('iPhone: Safari → Compartir → Añadir a inicio', W / 2, 1360, 38, { weight: 600, color: '#ffd6dc', alpha: ease((lt - 0.7) / 0.3) });
  text('by differentgyal', W / 2, 1480, 44, { weight: 800, color: GOLD, alpha: ease((lt - 0.9) / 0.3) });
  g.restore();
}

const T = { logo: DROP, grid: DROP + 1.5 * BAR, voice: DROP + 3 * BAR, mix: DROP + 4.5 * BAR, styles: DROP + 5.5 * BAR, cta: DROP + 5.5 * BAR + 3 * BEAT };
export function frame(t) {
  background(t);
  if (t < T.logo) sceneIntro(t);
  else if (t < T.grid) sceneLogo(t);
  else if (t < T.voice) sceneGrid(t, T.grid);
  else if (t < T.mix) sceneVoice(t, T.voice);
  else if (t < T.styles) sceneMix(t, T.mix);
  else if (t < T.cta) sceneStyles(t, T.styles);
  else sceneCTA(t, T.cta);
  // fundido de entrada
  if (t < 0.3) { g.fillStyle = `rgba(0,0,0,${1 - t / 0.3})`; g.fillRect(0, 0, W, H); }
}

// ---------- música: beat hard techno hecho con la app ----------
async function music() {
  const p = makeProject('hardtechno', { bpm: BPM, seed: 2026, root: 9, mode: 'minor' });
  const all = Object.fromEntries(p.tracks.map((t) => [t.id, true]));
  const build = Object.fromEntries(p.tracks.filter((t) => t.role !== 'kick').map((t) => [t.id, true]));
  const bars = Math.ceil((DUR - DROP) / BAR);
  p.scenes = [newScene('Subida', 2, build, 'build'), newScene('Drop', bars, all, 'drop')];
  const buf = await renderProject(p, { tail: 0 });
  // recortar a DUR y fundido final
  const sr = buf.sampleRate; const n = Math.floor(DUR * sr); const out = [0, 1].map((c) => Float32Array.from(buf.getChannelData(c).subarray(0, n)));
  const f = Math.floor(0.8 * sr); out.forEach((d) => { for (let i = 0; i < f; i++) d[n - 1 - i] *= i / f; });
  return { sr, ch: out };
}

// ---------- codificar MP4 ----------
async function makeVideo() {
  st('Componiendo la música con DG Studio…');
  const { sr, ch } = await music();
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H, frameRate: FPS }, audio: { codec: 'aac', sampleRate: sr, numberOfChannels: 2 }, fastStart: 'in-memory' });
  let err = null;
  const ve = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => (err = e) });
  ve.configure({ codec: 'avc1.640028', width: W, height: H, bitrate: 10_000_000, framerate: FPS });
  const ae = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => (err = e) });
  ae.configure({ codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: 2, bitrate: 192000 });
  // audio en bloques de 1 s
  for (let o = 0; o < ch[0].length; o += sr) {
    const len = Math.min(sr, ch[0].length - o); const data = new Float32Array(len * 2);
    data.set(ch[0].subarray(o, o + len), 0); data.set(ch[1].subarray(o, o + len), len);
    ae.encode(new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: len, numberOfChannels: 2, timestamp: Math.round((o / sr) * 1e6), data }));
  }
  const frames = DUR * FPS;
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
  st('Guardando…');
  const r = await fetch('/save?name=DG_Studio_historia_instagram.mp4', { method: 'POST', body: blob }).catch(() => null);
  window.__video = { size: blob.size, saved: !!(r && r.ok), url: URL.createObjectURL(blob) };
  st(`✅ Video listo (${(blob.size / 1e6).toFixed(1)} MB)${r && r.ok ? ' · guardado en promo/out' : ''}`);
  return window.__video;
}
window.makeVideo = makeVideo; window.frame = frame;
document.getElementById('go').onclick = () => makeVideo().catch((e) => st('Error: ' + e.message));
document.getElementById('prev').onclick = () => { const t0 = performance.now(); const loop = () => { const t = (performance.now() - t0) / 1000; frame(t % DUR); if (t < DUR) requestAnimationFrame(loop); }; loop(); };
frame(4.2);
