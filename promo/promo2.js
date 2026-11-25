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
// ---------- escena cinematográfica: portal de piedra en la niebla ----------
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const PART = Array.from({ length: 110 }, (_, i) => ({ x: rnd(i) * SW, y: rnd(i + 99) * SH, sp: 8 + rnd(i + 7) * 26, r: 0.8 + rnd(i + 3) * 2.6, ph: rnd(i + 5) * 6.28 }));
const STONES = Array.from({ length: 19 }, (_, i) => ({ a: Math.PI + (i / 18) * Math.PI, j: rnd(i + 40) }));
function portal(t, power, logoA) {
  const cx = 600, base = 520, rx = 150, ry = 230; const push = 1 + t * 0.012; const cy = base - ry * 0.45;
  s.save(); s.translate(cx, base - 120); s.scale(push, push); s.translate(-cx, -(base - 120));
  // cueva / cielo
  let gr = s.createLinearGradient(0, 0, 0, SH); gr.addColorStop(0, '#05070d'); gr.addColorStop(0.6, '#0a0b14'); gr.addColorStop(1, '#020204'); s.fillStyle = gr; s.fillRect(-200, -200, SW + 400, SH + 400);
  // rayos de luz desde arriba
  s.save(); s.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 4; k++) { const x0 = 300 + k * 55 + Math.sin(t * 0.3 + k) * 10; const rg = s.createLinearGradient(x0, -50, x0 + 260, base); rg.addColorStop(0, `rgba(255,215,170,${0.10 + k * 0.015})`); rg.addColorStop(1, 'rgba(255,190,140,0)'); s.fillStyle = rg; s.beginPath(); s.moveTo(x0, -60); s.lineTo(x0 + 40 + k * 10, -60); s.lineTo(x0 + 330, base + 40); s.lineTo(x0 + 230, base + 40); s.closePath(); s.fill(); }
  s.restore();
  // suelo
  gr = s.createLinearGradient(0, base - 20, 0, SH); gr.addColorStop(0, '#0d0c12'); gr.addColorStop(1, '#030304'); s.fillStyle = gr; s.fillRect(-200, base - 10, SW + 400, SH);
  // reflejo del núcleo en el suelo
  let rg = s.createRadialGradient(cx, base + 10, 5, cx, base + 10, 380); rg.addColorStop(0, `rgba(255,30,60,${0.55 * power})`); rg.addColorStop(1, 'rgba(255,0,30,0)');
  s.save(); s.globalCompositeOperation = 'lighter'; s.fillStyle = rg; s.beginPath(); s.ellipse(cx, base + 10, 380, 80, 0, 0, 7); s.fill(); s.restore();
  // núcleo del portal
  rg = s.createRadialGradient(cx, cy, 4, cx, cy, ry * 1.2); rg.addColorStop(0, `rgba(255,230,235,${0.9 * power})`); rg.addColorStop(0.18, `rgba(255,40,75,${0.85 * power})`); rg.addColorStop(0.6, `rgba(150,0,30,${0.35 * power})`); rg.addColorStop(1, 'rgba(60,0,10,0)');
  s.save(); s.globalCompositeOperation = 'lighter'; s.fillStyle = rg; s.beginPath(); s.ellipse(cx, cy, rx * 1.9, ry * 1.3, 0, 0, 7); s.fill();
  for (let k = 0; k < 3; k++) { const ph = (t * 0.6 + k / 3) % 1; s.strokeStyle = `rgba(255,70,100,${(1 - ph) * 0.5 * power})`; s.lineWidth = 3; s.beginPath(); s.ellipse(cx, cy, rx * 0.4 * (0.3 + ph), ry * 0.45 * (0.3 + ph), 0, 0, 7); s.stroke(); }
  s.restore();
  // logo dentro del portal
  if (logoA > 0) { s.save(); s.globalAlpha = logoA; s.shadowColor = '#ff2d4b'; s.shadowBlur = 40; T(s, 'DG', cx, cy, 92, '#fff', 900, 'center'); s.shadowBlur = 0; s.restore(); }
  // arco de piedras
  STONES.forEach((st) => {
    const x = cx + Math.cos(st.a) * rx, y = base + Math.sin(st.a) * ry; const lit = 0.35 + 0.65 * power;
    s.save(); s.translate(x, y); s.rotate(st.a + Math.PI / 2);
    const sg = s.createLinearGradient(0, -26, 0, 26); sg.addColorStop(0, `rgb(${70 + 120 * lit * (0.6 + 0.4 * st.j) | 0},${62 + 40 * lit | 0},${60 + 40 * lit | 0})`); sg.addColorStop(1, '#141216');
    s.fillStyle = sg; RR(s, -30 - st.j * 6, -26, 60 + st.j * 12, 52, 10); s.fill();
    s.strokeStyle = 'rgba(0,0,0,.55)'; s.lineWidth = 2; s.stroke(); s.restore();
  });
  // rocas y plantas en silueta
  s.fillStyle = '#040405';
  [[120, 560, 160, 70], [880, 570, 200, 60], [420, 600, 120, 40], [760, 610, 140, 36]].forEach(([x, y, w, hh]) => { s.beginPath(); s.ellipse(x, y, w, hh, 0, 0, 7); s.fill(); });
  for (let k = 0; k < 26; k++) { const x = 380 + rnd(k + 200) * 460, hh = 20 + rnd(k + 300) * 50, sw = Math.sin(t * 1.2 + k) * 4; s.strokeStyle = `rgba(${40 + 90 * power * rnd(k) | 0},${30 + 50 * rnd(k + 1) | 0},30,0.9)`; s.lineWidth = 3; s.beginPath(); s.moveTo(x, base + 14); s.quadraticCurveTo(x + sw, base - hh / 2, x + sw * 2, base + 14 - hh); s.stroke(); }
  // niebla
  for (let k = 0; k < 5; k++) { const fx = (((k * 260 + t * 18 * (k % 2 ? 1 : -1)) % 1400) + 1400) % 1400 - 200; const fg = s.createRadialGradient(fx, base - 10, 10, fx, base - 10, 260); fg.addColorStop(0, 'rgba(150,140,170,0.10)'); fg.addColorStop(1, 'rgba(150,140,170,0)'); s.fillStyle = fg; s.fillRect(fx - 260, base - 200, 520, 360); }
  // partículas
  s.save(); s.globalCompositeOperation = 'lighter';
  PART.forEach((pa) => { const y = ((pa.y - t * pa.sp) % SH + SH) % SH; const x = pa.x + Math.sin(t * 0.8 + pa.ph) * 12; const d = Math.hypot(x - cx, y - (base - 100)); const warm = clamp(1 - d / 420) * power; s.fillStyle = `rgba(255,${160 - 120 * warm | 0},${140 - 100 * warm | 0},${0.25 + 0.6 * warm})`; s.beginPath(); s.arc(x, y, pa.r * (1 + warm), 0, 7); s.fill(); });
  s.restore();
  s.restore();
}
// cortes rápidos de la app, uno por compás
function screenApp(t) {
  const lt = t - T2; const idx = Math.floor(lt / BAR);
  if (idx === 0) screenGrid(t); else if (idx === 1) screenVoice(t, T2 + BAR); else screenMix(t, T2 + 2 * BAR);
  const since = lt % BAR; if (since < 0.1) { s.fillStyle = `rgba(255,255,255,${0.35 * (1 - since / 0.1)})`; s.fillRect(0, 0, SW, SH); }
}
function screenEnd(t, t0) {
  const lt = t - t0;
  portal(t, 0.9 + kick(t) * 0.25, ease(lt / 0.6));
  const gr = s.createLinearGradient(0, 380, 0, SH); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.45, 'rgba(0,0,0,.78)'); gr.addColorStop(1, 'rgba(0,0,0,.92)'); s.fillStyle = gr; s.fillRect(0, 380, SW, SH - 380);
  const a1 = ease((lt - 0.4) / 0.6), a2 = ease((lt - 1.0) / 0.6), a3 = ease((lt - 1.6) / 0.6);
  s.save();
  s.letterSpacing = '2px'; s.globalAlpha = a1; T(s, '¿Quieres probarla gratis?', SW / 2, 520 + (1 - a1) * 14, 50, '#fff', 800, 'center');
  s.letterSpacing = '8px'; s.globalAlpha = a2; T(s, 'HÁBLAME AL DM', SW / 2, 585 + (1 - a2) * 14, 32, '#ff3b57', 800, 'center');
  s.letterSpacing = '6px'; s.globalAlpha = a3 * 0.85; T(s, 'DG STUDIO', SW / 2, 40, 20, '#d9c3c7', 700, 'center');
  s.restore();
}
function drawScreen(t) {
  if (t < T2) { const power = t < DROP ? 0.15 + 0.35 * ease(t / DROP) : 0.75 + kick(t) * 0.35; portal(t, power, ease((t - DROP - 1.2) / 0.8) * clamp((T2 - t) / 0.4)); }
  else if (t < T3) screenApp(t);
  else screenEnd(t, T3);
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

// ---------- textos estilo anuncio (limpios, sin inclinar) ----------
const LINES = [
  [0.5, DROP - 0.1, 'TU MÚSICA', 'empieza aquí'],
  [DROP + 0.1, 5.6, 'ESCRIBE TU LETRA', 'y la app la convierte en canción'],
  [5.6, T2, 'BEAT · VOZ · MEZCLA', 'todo en tu teléfono'],
  [T2, T2 + BAR, 'BEATS DE TECHNO', 'listos en segundos'],
  [T2 + BAR, T2 + 2 * BAR, 'TU VOZ CON AUTOTUNE', 'natural, fina, gruesa u otaku'],
  [T2 + 2 * BAR, T3, 'MEZCLA PROFESIONAL', 'lista para subir y compartir'],
  [T3 + 0.2, DUR, 'CREA TU PRIMER TEMA HOY', 'Creada por differentgyal'],
];
function proText(t) {
  for (const [a, b, big, small] of LINES) {
    if (t < a || t > b) continue;
    const ain = ease((t - a) / 0.35), aout = b >= DUR ? 1 : clamp((b - t) / 0.2), al = ain * aout;
    const y = 430 + (1 - ain) * 24;
    g.save(); g.globalAlpha = al; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,.85)'; g.shadowBlur = 24;
    g.letterSpacing = '6px'; let fs = 76; do { g.font = `900 ${fs}px system-ui, "Segoe UI", Arial`; fs -= 2; } while (g.measureText(big).width > 960 && fs > 40); g.fillStyle = '#fff'; g.fillText(big, W / 2, y);
    // línea roja que se dibuja
    g.shadowBlur = 0; const lw = 220 * ease((t - a - 0.15) / 0.4); g.fillStyle = '#ff2d4b'; g.fillRect(W / 2 - lw / 2, y + 58, lw, 5);
    g.letterSpacing = '2px'; g.font = '600 40px system-ui, "Segoe UI", Arial'; g.fillStyle = big.startsWith('CREA') ? '#ff6b80' : '#e9d3d6'; g.shadowBlur = 18; g.fillText(small, W / 2, y + 112);
    g.restore();
  }
}

// ---------- cuadro completo ----------
export function frame(t) {
  // cámara en mano: deriva lenta + pequeño temblor
  const sx = Math.sin(t * 0.35) * 6, sy = Math.cos(t * 0.27) * 5 - t * 2;
  const rot = -0.02 + Math.sin(t * 0.25) * 0.004; const zoom = 1.04 + t * 0.004 + kick(t) * 0.006;
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
  proText(t);
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
