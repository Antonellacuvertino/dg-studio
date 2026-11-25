// ===============================================================
//  Promo cinematográfico "El portal" para Historias de Instagram
//  Escena oscura tipo videojuego: arco de piedra, cristal brillante,
//  rayo de luz, plantas y luciérnagas. Luego la app en un teléfono.
//  1080×1920 · 30 fps · 19,2 s · MP4 (H.264 + AAC)
// ===============================================================
import { Muxer, ArrayBufferTarget } from 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/build/mp4-muxer.mjs';
import { makeProject, newScene } from '../js/studio/model.js';
import { renderProject } from '../js/studio/sequencer.js';

const W = 1080, H = 1920, FPS = 30, BPM = 150, BEAT = 60 / BPM, BAR = BEAT * 4;
const DROP = 4 * BAR;            // 6,4 s
const T_APP = DROP + 2 * BAR;    // 9,6 s
const T_END = T_APP + 3 * BAR;   // 14,4 s
const DUR = 12 * BAR;            // 19,2 s
const cv = document.getElementById('cv'); const g = cv.getContext('2d');
const st = (t) => (document.getElementById('st').textContent = t);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);
const lerp = (a, b, k) => a + (b - a) * k;
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const kick = (t) => (t < DROP ? 0 : Math.exp(-(((t - DROP) % BEAT) / BEAT) * 6));
const RR = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const FONT = 'system-ui, "Segoe UI", Arial';

// color del cristal: azul místico → rojo DG en el drop
function crystal(t) {
  const k = ease((t - DROP) / 0.35);
  return [lerp(70, 255, k) | 0, lerp(150, 40, k) | 0, lerp(255, 80, k) | 0];
}
function power(t) {
  if (t < DROP) return 0.55 + 0.35 * ease(t / DROP) + 0.06 * Math.sin(t * 5);
  return 0.85 + 0.45 * kick(t);
}

// ---------- geometría de la escena ----------
const CX = 540, BASE = 1480, SPRING = 1010, RX = 250; // arco
const CRY = { x: 330, y: 1475 };                          // cristal, al pie del arco (como en el video)
const STONES = [];
for (const side of [-1, 1]) for (let i = 0; i < 7; i++) {
  const hgt = (BASE - SPRING) / 7; STONES.push({ x: CX + side * RX, y: BASE - (i + 0.5) * hgt, w: 118 + rnd(i * 3 + side) * 18, h: hgt - 6, a: 0, j: rnd(i + side * 7 + 20) });
}
for (let i = 0; i <= 16; i++) { const a = Math.PI + (i / 16) * Math.PI; STONES.push({ x: CX + Math.cos(a) * RX, y: SPRING + Math.sin(a) * RX * 1.08, w: 118, h: 52, a: a + Math.PI / 2, j: rnd(i + 60) }); }
const FERNS = Array.from({ length: 22 }, (_, i) => {
  const left = i < 14; const x = left ? 120 + rnd(i) * 360 : 650 + rnd(i) * 330;
  return { x, y: BASE + 10 + rnd(i + 5) * 40, len: 120 + rnd(i + 9) * 170, ang: -Math.PI / 2 + (rnd(i + 11) - 0.5) * 1.9, curl: (rnd(i + 13) - 0.5) * 0.9, ph: rnd(i + 17) * 6 };
});
const BIGLEAF = Array.from({ length: 9 }, (_, i) => ({ x: i < 5 ? -40 + i * 70 : 860 + (i - 5) * 70, y: 1930, len: 380 + rnd(i + 70) * 260, ang: -Math.PI / 2 + (i < 5 ? 0.25 + rnd(i) * 0.6 : -0.25 - rnd(i) * 0.6), curl: (i < 5 ? 1 : -1) * 0.5, ph: rnd(i) * 6 }));
const SHARDS = Array.from({ length: 9 }, (_, i) => ({ dx: (rnd(i + 80) - 0.5) * 110, h: 70 + rnd(i + 81) * 150, w: 16 + rnd(i + 82) * 18, a: (rnd(i + 83) - 0.5) * 0.9 }));
const FLIES = Array.from({ length: 70 }, (_, i) => ({ x: rnd(i + 100) * W, y: 300 + rnd(i + 200) * 1400, sp: 6 + rnd(i + 300) * 22, r: 1.5 + rnd(i + 400) * 3, ph: rnd(i + 500) * 6.28 }));
const DUST = Array.from({ length: 90 }, (_, i) => ({ x: rnd(i + 600), y: rnd(i + 700), sp: 4 + rnd(i + 800) * 10, r: 1 + rnd(i + 900) * 2.2 }));
const PILLARS = [[40, 160, 1500], [230, 90, 1300], [820, 110, 1350], [960, 170, 1550]];

// luz que recibe un punto (cristal + rayo de luz)
const crystalLight = (x, y, p) => p * Math.exp(-Math.hypot(x - CRY.x, (y - CRY.y) * 1.2) / 380);
const shaftX = (y) => lerp(640, 470, clamp(y / 1500)); // centro del rayo de luz según la altura
const shaftLight = (x, y) => Math.exp(-(((x - shaftX(y)) / 150) ** 2)) * 0.9;

function cam(t, f) { // cámara con paralaje (f = profundidad de la capa)
  const z = (1 + (t / DUR) * 0.14 + kick(t) * 0.004) * (1 + (f - 1) * 0.04);
  const px = Math.sin(t * 0.22) * 26 * f, py = Math.cos(t * 0.17) * 12 * f;
  g.setTransform(z, 0, 0, z, CX - CX * z + px, 1150 - 1150 * z + py);
}

function fern(f, t, col, lit) {
  const sway = Math.sin(t * 0.9 + f.ph) * 0.05;
  const a = f.ang + sway; const ex = f.x + Math.cos(a) * f.len, ey = f.y + Math.sin(a) * f.len;
  const mx = (f.x + ex) / 2 + Math.cos(a + Math.PI / 2) * f.len * f.curl * 0.5, my = (f.y + ey) / 2 + Math.sin(a + Math.PI / 2) * f.len * f.curl * 0.5;
  g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo(f.x, f.y); g.quadraticCurveTo(mx, my, ex, ey); g.stroke();
  g.fillStyle = col;
  const n = 12;
  for (let i = 1; i < n; i++) {
    const k = i / n, u = 1 - k;
    const x = u * u * f.x + 2 * u * k * mx + k * k * ex, y = u * u * f.y + 2 * u * k * my + k * k * ey;
    const tx = 2 * u * (mx - f.x) + 2 * k * (ex - mx), ty = 2 * u * (my - f.y) + 2 * k * (ey - my); const ang = Math.atan2(ty, tx);
    const L = f.len * 0.22 * (1 - k * 0.7);
    for (const s of [-1, 1]) { g.save(); g.translate(x, y); g.rotate(ang + s * 1.0); g.beginPath(); g.ellipse(L / 2, 0, L / 2, L * 0.16, 0, 0, 7); g.fill(); g.restore(); }
  }
  if (lit > 0.05) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(0.6, lit); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(f.x, f.y); g.quadraticCurveTo(mx, my, ex, ey); g.stroke(); g.restore(); }
}

function scene(t, logoA = 0) {
  const P = power(t); const [cr, cg, cb] = crystal(t);
  // --- fondo (lejos) ---
  g.setTransform(1, 0, 0, 1, 0, 0);
  let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#04070a'); gr.addColorStop(0.55, '#070b0e'); gr.addColorStop(1, '#020303'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  cam(t, 0.4);
  PILLARS.forEach(([x, w, h], i) => {
    const pg = g.createLinearGradient(x, 0, x + w, 0); pg.addColorStop(0, '#0b1012'); pg.addColorStop(0.5, '#11171a'); pg.addColorStop(1, '#070a0b'); g.fillStyle = pg; g.fillRect(x, BASE - h, w, h);
    for (let k = 0; k < 9; k++) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, BASE - h + k * (h / 9), w, 3); }
    // lianas colgando
    g.strokeStyle = 'rgba(30,48,30,.8)'; g.lineWidth = 3; for (let k = 0; k < 3; k++) { const vx = x + 20 + k * w / 3; g.beginPath(); g.moveTo(vx, BASE - h); g.quadraticCurveTo(vx + Math.sin(t * 0.6 + i + k) * 14, BASE - h + 220, vx + 6, BASE - h + 300 + rnd(i * 9 + k) * 250); g.stroke(); }
  });
  // niebla del fondo
  for (let k = 0; k < 4; k++) { const fx = ((k * 330 + t * 14 * (k % 2 ? 1 : -1)) % 1500 + 1500) % 1500 - 200; const fg = g.createRadialGradient(fx, 1250, 10, fx, 1250, 420); fg.addColorStop(0, 'rgba(120,140,150,0.07)'); fg.addColorStop(1, 'rgba(120,140,150,0)'); g.fillStyle = fg; g.fillRect(fx - 420, 830, 840, 840); }

  // --- rayo de luz cálido desde arriba ---
  cam(t, 0.8);
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 3; k++) {
    const w0 = 70 + k * 45, w1 = 160 + k * 90; const top = shaftX(0) + 20 + k * 10, bot = shaftX(1500);
    const sg = g.createLinearGradient(0, 0, 0, 1520); sg.addColorStop(0, `rgba(255,205,130,${0.13 - k * 0.03})`); sg.addColorStop(0.75, `rgba(255,190,110,${0.06 - k * 0.012})`); sg.addColorStop(1, 'rgba(255,180,100,0)');
    g.fillStyle = sg; g.beginPath(); g.moveTo(top - w0 / 2, -100); g.lineTo(top + w0 / 2, -100); g.lineTo(bot + w1 / 2, 1520); g.lineTo(bot - w1 / 2, 1520); g.closePath(); g.fill();
  }
  // polvo dentro del rayo
  DUST.forEach((d) => { const y = ((d.y * 1500 + t * d.sp) % 1500); const x = shaftX(y) + (d.x - 0.5) * 220; g.fillStyle = `rgba(255,220,170,${0.18 + 0.25 * rnd(d.r * 10)})`; g.beginPath(); g.arc(x, y, d.r, 0, 7); g.fill(); });
  g.restore();

  // --- suelo ---
  cam(t, 1);
  gr = g.createLinearGradient(0, BASE - 30, 0, H); gr.addColorStop(0, '#0e1210'); gr.addColorStop(1, '#030403'); g.fillStyle = gr; g.fillRect(-300, BASE - 10, W + 600, 700);
  for (let k = 0; k < 7; k++) { g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-300, BASE + 20 + k * k * 9); g.lineTo(W + 300, BASE + 20 + k * k * 9); g.stroke(); }
  // charco de luz del cristal y del rayo en el suelo
  g.save(); g.globalCompositeOperation = 'lighter';
  let rg = g.createRadialGradient(CRY.x, BASE + 20, 5, CRY.x, BASE + 20, 520); rg.addColorStop(0, `rgba(${cr},${cg},${cb},${0.45 * P})`); rg.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  g.fillStyle = rg; g.beginPath(); g.ellipse(CRY.x, BASE + 30, 520, 120, 0, 0, 7); g.fill();
  rg = g.createRadialGradient(shaftX(1500), BASE + 20, 5, shaftX(1500), BASE + 20, 260); rg.addColorStop(0, 'rgba(255,200,130,.22)'); rg.addColorStop(1, 'rgba(255,200,130,0)');
  g.fillStyle = rg; g.beginPath(); g.ellipse(shaftX(1500), BASE + 30, 260, 60, 0, 0, 7); g.fill();
  g.restore();

  // --- interior del arco (portal) ---
  g.save(); g.beginPath(); g.moveTo(CX - RX + 50, BASE); g.lineTo(CX - RX + 50, SPRING); g.ellipse(CX, SPRING, RX - 50, (RX - 50) * 1.08, 0, Math.PI, 0); g.lineTo(CX + RX - 50, BASE); g.closePath(); g.clip();
  g.fillStyle = '#020304'; g.fillRect(CX - RX, SPRING - RX * 1.2, RX * 2, BASE - SPRING + RX * 1.2);
  const open = t < DROP ? 0.12 * ease(t / DROP) : 0.55 + 0.35 * kick(t);
  rg = g.createRadialGradient(CX, SPRING + 120, 10, CX, SPRING + 120, 420); rg.addColorStop(0, `rgba(${cr},${cg},${cb},${open})`); rg.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  g.globalCompositeOperation = 'lighter'; g.fillStyle = rg; g.fillRect(CX - RX, SPRING - RX * 1.2, RX * 2, BASE);
  if (t >= DROP) for (let k = 0; k < 4; k++) { const ph = (t * 0.55 + k / 4) % 1; g.strokeStyle = `rgba(${cr},${cg + 60},${cb + 60},${(1 - ph) * 0.45})`; g.lineWidth = 4; g.beginPath(); g.ellipse(CX, SPRING + 120, 40 + ph * 200, 60 + ph * 300, 0, 0, 7); g.stroke(); }
  g.restore();
  if (logoA > 0) { g.save(); g.globalAlpha = logoA; g.font = `900 170px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = `rgb(${cr},${cg},${cb})`; g.shadowBlur = 60; g.fillStyle = '#fff'; g.fillText('DG', CX, SPRING + 110); g.restore(); }

  // --- arco de piedra ---
  STONES.forEach((s) => {
    const cl = crystalLight(s.x, s.y, P), sl = shaftLight(s.x, s.y) * clamp(1 - (BASE - s.y) / 1400 + 0.6);
    const base = 46 + 34 * s.j;
    const r = base + cl * cr * 0.55 + sl * 120, gg = base * 0.95 + cl * cg * 0.55 + sl * 95, b = base * 0.82 + cl * cb * 0.55 + sl * 60;
    g.save(); g.translate(s.x, s.y); g.rotate(s.a);
    const sg = g.createLinearGradient(0, -s.h / 2, 0, s.h / 2); sg.addColorStop(0, `rgb(${Math.min(255, r * 1.25) | 0},${Math.min(255, gg * 1.25) | 0},${Math.min(255, b * 1.25) | 0})`); sg.addColorStop(1, `rgb(${r * 0.55 | 0},${gg * 0.55 | 0},${b * 0.55 | 0})`);
    g.fillStyle = sg; RR(-s.w / 2, -s.h / 2, s.w, s.h, 9); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 3; g.stroke();
    // grietas y musgo
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-s.w * 0.3, -s.h * 0.2); g.lineTo(-s.w * 0.05, s.h * 0.1); g.lineTo(s.w * 0.12, -s.h * 0.05); g.stroke();
    if (s.j > 0.55) { g.fillStyle = `rgba(${60 + cl * 40 | 0},${90 + cl * 60 + sl * 60 | 0},40,.75)`; g.beginPath(); g.ellipse(s.w * (s.j - 0.75), -s.h * 0.35, s.w * 0.22, s.h * 0.18, 0, 0, 7); g.fill(); }
    g.restore();
  });

  // --- plantas alrededor ---
  FERNS.forEach((f) => { const lit = crystalLight(f.x, f.y - 60, P); const sl = shaftLight(f.x, f.y) * 0.5; const col = `rgb(${18 + lit * cr * 0.6 + sl * 90 | 0},${32 + lit * cg * 0.6 + sl * 110 + 25 * lit | 0},${18 + lit * cb * 0.6 + sl * 40 | 0})`; fern(f, t, col, lit); });

  // --- cristal brillante ---
  g.save(); g.globalCompositeOperation = 'lighter';
  rg = g.createRadialGradient(CRY.x, CRY.y - 80, 5, CRY.x, CRY.y - 80, 420 * (0.8 + 0.3 * P)); rg.addColorStop(0, `rgba(${cr},${cg},${cb},${0.8 * P})`); rg.addColorStop(0.35, `rgba(${cr},${cg},${cb},${0.18 * P})`); rg.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  g.fillStyle = rg; g.fillRect(CRY.x - 420, CRY.y - 500, 840, 840);
  SHARDS.forEach((s, i) => {
    g.save(); g.translate(CRY.x + s.dx, CRY.y); g.rotate(s.a);
    const fl = 0.75 + 0.25 * Math.sin(t * 6 + i * 2);
    const sg = g.createLinearGradient(-s.w, 0, s.w, 0); sg.addColorStop(0, `rgba(${cr},${cg},${cb},${0.55 * fl})`); sg.addColorStop(0.5, `rgba(255,255,255,${0.85 * fl * Math.min(1, P)})`); sg.addColorStop(1, `rgba(${cr},${cg},${cb},${0.5 * fl})`);
    g.fillStyle = sg; g.beginPath(); g.moveTo(-s.w, 0); g.lineTo(-s.w * 0.8, -s.h * 0.8); g.lineTo(0, -s.h); g.lineTo(s.w * 0.8, -s.h * 0.8); g.lineTo(s.w, 0); g.closePath(); g.fill();
    g.restore();
  });
  // chispas que suben del cristal
  for (let i = 0; i < 26; i++) { const life = ((t * (0.35 + rnd(i) * 0.4) + rnd(i + 3)) % 1); const x = CRY.x + (rnd(i + 5) - 0.5) * 160 + Math.sin(t * 2 + i) * 14; const y = CRY.y - 60 - life * 520; g.fillStyle = `rgba(${cr},${Math.min(255, cg + 80)},${Math.min(255, cb + 60)},${(1 - life) * 0.9 * Math.min(1, P)})`; g.beginPath(); g.arc(x, y, 2.5 + (1 - life) * 2.5, 0, 7); g.fill(); }
  g.restore();

  // --- luciérnagas ---
  g.save(); g.globalCompositeOperation = 'lighter';
  FLIES.forEach((p) => { const y = ((p.y - t * p.sp) % 1700 + 1700) % 1700 + 150; const x = p.x + Math.sin(t * 0.7 + p.ph) * 30; const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.7 + p.ph * 3)); g.fillStyle = `rgba(255,215,120,${0.55 * tw})`; g.beginPath(); g.arc(x, y, p.r, 0, 7); g.fill(); g.fillStyle = `rgba(255,200,90,${0.12 * tw})`; g.beginPath(); g.arc(x, y, p.r * 5, 0, 7); g.fill(); });
  g.restore();

  // --- hojas grandes en primer plano (desenfocadas, oscuras) ---
  cam(t, 1.6);
  g.save(); g.shadowColor = '#000'; g.shadowBlur = 18; BIGLEAF.forEach((f) => fern(f, t, '#030504', 0)); g.restore();

  // --- etalonaje: viñeta + tono cine ---
  g.setTransform(1, 0, 0, 1, 0, 0);
  const v = g.createRadialGradient(W / 2, H * 0.55, 260, W / 2, H * 0.55, H * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.88)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(0,25,35,.10)'; g.fillRect(0, 0, W, H);
}

// ---------- grano de película ----------
const grain = document.createElement('canvas'); grain.width = 540; grain.height = 960;
(() => { const c = grain.getContext('2d'); const im = c.createImageData(540, 960); for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 18; } c.putImageData(im, 0, 0); })();
function filmGrain(t) { const gx = (Math.floor(t * FPS) * 137) % 540, gy = (Math.floor(t * FPS) * 251) % 960; for (const [ox, oy] of [[0, 0], [1080, 0], [0, 1920], [1080, 1920]]) g.drawImage(grain, ox - gx, oy - gy, 1080, 1920); }

// ---------- textos estilo tráiler ----------
function title(big, small, a, b, t, { y = 380, color = '#fff', sub = '#e9e1dc', size = 92 } = {}) {
  if (t < a || t > b) return;
  const ain = ease((t - a) / 0.45), aout = b >= DUR ? 1 : clamp((b - t) / 0.25), al = ain * aout;
  g.save(); g.globalAlpha = al; g.textAlign = 'center'; g.textBaseline = 'middle';
  const lines = big.split('\n'); let fs = size; g.letterSpacing = '3px';
  do { g.font = `800 ${fs}px ${FONT}`; fs -= 2; } while (Math.max(...lines.map((l) => g.measureText(l).width)) > 960 && fs > 40);
  g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowBlur = 30;
  lines.forEach((l, i) => { g.fillStyle = Array.isArray(color) ? color[i] : color; g.fillText(l, W / 2, y + (1 - ain) * 26 + i * fs * 1.2); });
  const yb = y + (lines.length - 1) * fs * 1.2;
  if (small) {
    g.shadowBlur = 0; const lw = 200 * ease((t - a - 0.2) / 0.5); g.fillStyle = '#ff2d4b'; g.fillRect(W / 2 - lw / 2, yb + fs * 0.75, lw, 5);
    g.letterSpacing = '2px'; g.font = `600 42px ${FONT}`; g.fillStyle = sub; g.shadowBlur = 20; g.fillText(small, W / 2, yb + fs * 0.75 + 62);
  }
  g.restore();
}

// ---------- la app dentro de un teléfono ----------
const PX = 250, PY = 640, PW = 580, PH = 1180; // teléfono
const ROWS = [['Bombo', '#ff2d4b', 'x...x...x...x...'], ['Palmas', '#ff7a1a', '....x.......x...'], ['Hat', '#ffc23d', '..x...x...x...x.'], ['Rumble', '#e0aa55', '..xx..xx..xx..xx'], ['Acid', '#ff5c8a', 'x.xx.x.xx.x.xx.x'], ['Silbato', '#ffb020', '..............x.']];
const sTxt = (s, x, y, size, color = '#fff', weight = 800, align = 'left') => { g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(s, x, y); };
function appGrid(t, w, h) {
  sTxt('DG Studio', 24, 40, 30, '#ff2d4b', 900); sTxt('Hard Techno · 150 BPM', 24, 80, 22, '#c49aa1', 600);
  const step = Math.floor(((t - DROP) / (BEAT / 4)) % 16);
  ROWS.forEach(([n, c, p], r) => {
    const y = 130 + r * 150; sTxt(n, 24, y + 18, 22, '#fff', 700); g.fillStyle = c; g.fillRect(24, y + 34, 40, 4);
    for (let i = 0; i < 16; i++) { const col = i % 8, row = Math.floor(i / 8); const x = 24 + col * 64, yy = y + 48 + row * 46; const on = p[i] === 'x';
      RR(x, yy, 56, 40, 8); g.fillStyle = on ? c : Math.floor(i / 4) % 2 ? '#3a141b' : '#2c0f13'; g.fill();
      if (i === step) { g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke(); } }
  });
  RR(24, h - 110, w - 48, 80, 40); g.fillStyle = '#ff2d4b'; g.fill(); sTxt('■  PLAY', w / 2, h - 70, 30, '#fff', 900, 'center');
}
function appVoice(t, t0, w, h) {
  const lt = t - t0;
  sTxt('Tu letra', 24, 40, 30, '#fff', 900);
  const lyric = 'fuego en la pista hasta que salga el sol'; const n = Math.floor(clamp(lt / 1.1) * lyric.length);
  RR(24, 80, w - 48, 170, 20); g.fillStyle = '#210b0e'; g.fill();
  const words = lyric.slice(0, n).split(' '); let line = '', yy = 130; words.forEach((wd) => { const tt = line + wd + ' '; g.font = `700 32px ${FONT}`; if (g.measureText(tt).width > w - 90) { sTxt(line, 44, yy, 32, '#fff', 700); line = wd + ' '; yy += 46; } else line = tt; }); sTxt(line + (Math.floor(lt * 4) % 2 ? '|' : ''), 44, yy, 32, '#fff', 700);
  for (let i = 0; i < 34; i++) { const x = 30 + i * 15.5; const hh = 16 + 150 * Math.abs(Math.sin(i * 0.6 + lt * 8)) * (0.35 + kick(t) * 0.8); RR(x, 430 - hh / 2, 9, hh, 4); g.fillStyle = i < (lt / 1.6) * 34 ? '#ff2d4b' : '#4a1c23'; g.fill(); }
  sTxt('Tipo de voz', 24, 590, 26, '#c49aa1', 700);
  ['Natural', 'Fina', 'Gruesa', 'Otaku', 'Robot', 'Mi voz'].forEach((c, i) => { const x = 24 + (i % 2) * ((w - 60) / 2 + 12), y = 630 + Math.floor(i / 2) * 104; const sel = i === Math.min(5, Math.floor(lt / 0.4) % 6);
    RR(x, y, (w - 60) / 2, 88, 20); g.fillStyle = sel ? '#3a0b13' : '#210b0e'; g.fill(); if (sel) { g.lineWidth = 4; g.strokeStyle = '#ff2d4b'; g.stroke(); } sTxt(c, x + (w - 60) / 4, y + 44, 30, '#fff', 800, 'center'); });
  RR(24, h - 110, w - 48, 80, 40); g.fillStyle = '#ff2d4b'; g.fill(); sTxt('Autotune  85%', w / 2, h - 70, 28, '#fff', 900, 'center');
}
function appMix(t, t0, w, h) {
  const lt = t - t0;
  sTxt('Mezcla', 24, 40, 30, '#fff', 900); sTxt('beat + voz + coros', 24, 80, 22, '#c49aa1', 600);
  [['Beat', '#ff2d4b', 0, 1], ['Mi voz', '#ffc23d', 0.15, 0.75], ['Coros', '#3ee08f', 0.35, 0.55], ['Grabación', '#4dabff', 0.05, 0.6]].forEach(([n, c, s0, ww], i) => {
    const y = 130 + i * 170; RR(16, y, w - 32, 150, 16); g.fillStyle = '#0d0405'; g.fill();
    const slide = (1 - ease((lt - i * 0.12) / 0.4)) * 400; const x = 26 + s0 * (w - 60) + slide; const lw = ww * (w - 60) * 0.95;
    RR(x, y + 14, lw, 122, 12); g.fillStyle = c + '44'; g.fill(); g.lineWidth = 3; g.strokeStyle = c; g.stroke();
    for (let k = 0; k < lw / 9; k++) { const hh = 8 + 70 * Math.abs(Math.sin(k * 0.9 + i)); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x + 6 + k * 9, y + 82 - hh / 2, 4, hh); }
    sTxt(n, x + 14, y + 36, 22, '#fff', 800);
  });
  const ph = 26 + clamp(lt / 1.6) * (w - 60); g.fillStyle = '#fff'; g.fillRect(ph, 122, 4, 690);
  RR(24, h - 110, w - 48, 80, 40); g.fillStyle = '#ff2d4b'; g.fill(); sTxt('⬇  Exportar MP3', w / 2, h - 70, 28, '#fff', 900, 'center');
}
function phoneApp(t) {
  const lt = t - T_APP; const inA = ease(lt / 0.5), outA = clamp((T_END - t) / 0.3);
  const y = PY + (1 - inA) * 500 + Math.sin(t * 1.4) * 8; const a = inA * outA;
  if (a <= 0) return;
  g.save(); g.globalAlpha = a;
  const [cr, cg, cb] = crystal(t);
  g.shadowColor = `rgba(${cr},${cg},${cb},.55)`; g.shadowBlur = 90 + kick(t) * 40;
  RR(PX, y, PW, PH, 70); g.fillStyle = '#050102'; g.fill(); g.shadowBlur = 0;
  g.lineWidth = 5; g.strokeStyle = '#3d151b'; g.stroke();
  RR(PX + 16, y + 16, PW - 32, PH - 32, 56); g.fillStyle = '#0c0405'; g.fill();
  RR(PX + PW / 2 - 70, y + 30, 140, 34, 17); g.fillStyle = '#000'; g.fill(); // isla
  g.save(); RR(PX + 16, y + 16, PW - 32, PH - 32, 56); g.clip(); g.translate(PX + 30, y + 80);
  const w = PW - 60, h = PH - 110; const idx = Math.floor(lt / BAR);
  if (idx <= 0) appGrid(t, w, h); else if (idx === 1) appVoice(t, T_APP + BAR, w, h); else appMix(t, T_APP + 2 * BAR, w, h);
  const since = lt % BAR; if (lt > BAR && since < 0.12) { g.fillStyle = `rgba(255,255,255,${0.4 * (1 - since / 0.12)})`; g.fillRect(-30, -80, PW, PH); }
  g.restore();
  // reflejo de vidrio
  const gl = g.createLinearGradient(PX, y, PX + PW, y + PH); gl.addColorStop(0, 'rgba(255,255,255,.07)'); gl.addColorStop(0.4, 'rgba(255,255,255,0)'); g.fillStyle = gl; RR(PX + 16, y + 16, PW - 32, PH - 32, 56); g.fill();
  g.restore();
}

// ---------- cuadro completo ----------
export function frame(t) {
  const inApp = t >= T_APP && t < T_END;
  scene(t, t >= T_END ? ease((t - T_END) / 0.8) : (t >= DROP && t < T_APP ? ease((t - DROP - 0.3) / 0.5) * clamp((T_APP - t) / 0.3) : 0));
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (inApp) { // oscurecer la escena detrás del teléfono
    const k = ease((t - T_APP) / 0.5) * clamp((T_END - t) / 0.3); g.fillStyle = `rgba(0,0,0,${0.55 * k})`; g.fillRect(0, 0, W, H);
    phoneApp(t);
  }
  // textos
  title('¿Haces música?', '', 0.5, 3.0, t, { size: 104 });
  title('¿Y si tu teléfono\nfuera tu estudio?', '', 3.2, DROP - 0.1, t, { size: 96, color: ['#fff', '#ff3b57'] });
  title('DG STUDIO', 'Creada por differentgyal', DROP + 0.15, T_APP, t, { size: 130, y: 400 });
  title('BEATS DE TECHNO', 'listos en segundos', T_APP + 0.1, T_APP + BAR, t, { y: 300, size: 80 });
  title('ESCRIBE TU LETRA', 'y la app la canta con tu voz', T_APP + BAR, T_APP + 2 * BAR, t, { y: 300, size: 80 });
  title('MEZCLA PROFESIONAL', 'lista para subir y compartir', T_APP + 2 * BAR, T_END, t, { y: 300, size: 80 });
  title('¿Quieres probarla\ngratis?', 'HÁBLAME AL DM', T_END + 0.3, DUR, t, { y: 330, size: 96, color: ['#fff', '#ff3b57'], sub: '#fff' });
  // firma final abajo
  if (t > T_END + 1.2) { const a = ease((t - T_END - 1.2) / 0.6); g.save(); g.globalAlpha = a; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowBlur = 20; g.letterSpacing = '8px'; g.font = `800 34px ${FONT}`; g.fillStyle = '#fff'; g.fillText('DG STUDIO', W / 2, 1720); g.letterSpacing = '2px'; g.font = `600 36px ${FONT}`; g.fillStyle = '#ff6b80'; g.fillText('Creada por differentgyal', W / 2, 1775); g.restore(); }
  filmGrain(t);
  // destello en el drop
  if (t >= DROP && t < DROP + 0.25) { const [cr, cg, cb] = crystal(t); g.fillStyle = `rgba(${cr},${cg},${cb},${0.55 * (1 - (t - DROP) / 0.25)})`; g.fillRect(0, 0, W, H); }
  // barras de cine al inicio que se abren
  const bars = 140 * (1 - ease((t - 0.2) / 1.6)); if (bars > 1) { g.fillStyle = '#000'; g.fillRect(0, 0, W, bars); g.fillRect(0, H - bars, W, bars); }
  if (t < 0.6) { g.fillStyle = `rgba(0,0,0,${1 - t / 0.6})`; g.fillRect(0, 0, W, H); }
  if (t > DUR - 0.5) { g.fillStyle = `rgba(0,0,0,${(t - (DUR - 0.5)) / 0.5})`; g.fillRect(0, 0, W, H); }
}

// ---------- música hecha con la app ----------
async function music() {
  const p = makeProject('hardtechno', { bpm: BPM, seed: 2026, root: 9, mode: 'minor' });
  const all = Object.fromEntries(p.tracks.map((t) => [t.id, true]));
  const build = Object.fromEntries(p.tracks.filter((t) => t.role !== 'kick').map((t) => [t.id, true]));
  p.scenes = [newScene('Intro', 4, build, 'build'), newScene('Drop', 8, all, 'drop')];
  const buf = await renderProject(p, { tail: 0 });
  const sr = buf.sampleRate; const n = Math.floor(DUR * sr);
  const out = [0, 1].map((c) => { const d = new Float32Array(n); d.set(buf.getChannelData(c).subarray(0, n)); return d; });
  // intro apagada (filtro grave que se abre hacia el drop)
  out.forEach((d) => { let y = 0; const end = Math.floor(DROP * sr); for (let i = 0; i < end; i++) { const k = 0.03 + 0.5 * (i / end) ** 3; y += (d[i] - y) * k; d[i] = y * (0.75 + 0.45 * (i / end)); } });
  const f = Math.floor(0.8 * sr); out.forEach((d) => { for (let i = 0; i < f; i++) d[n - 1 - i] *= i / f; });
  return { sr, ch: out };
}

async function makeVideo() {
  st('Componiendo la música con DG Studio…');
  const { sr, ch } = await music();
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H, frameRate: FPS }, audio: { codec: 'aac', sampleRate: sr, numberOfChannels: 2 }, fastStart: 'in-memory' });
  let err = null;
  const ve = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => (err = e) });
  ve.configure({ codec: 'avc1.640028', width: W, height: H, bitrate: 10_000_000, framerate: FPS });
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
  const r = await fetch('/save?name=DG_Studio_historia_portal.mp4', { method: 'POST', body: blob }).catch(() => null);
  window.__video = { size: blob.size, saved: !!(r && r.ok) };
  st(`✅ Video listo (${(blob.size / 1e6).toFixed(1)} MB)`);
  return window.__video;
}
window.makeVideo = makeVideo; window.frame = frame;
document.getElementById('go').onclick = () => makeVideo().catch((e) => st('Error: ' + e.message));
document.getElementById('prev').onclick = () => { const t0 = performance.now(); const loop = () => { const t = (performance.now() - t0) / 1000; frame(t % DUR); if (t < DUR) requestAnimationFrame(loop); }; loop(); };
frame(8);
