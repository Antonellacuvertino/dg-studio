// ===============================================================
//  Cerebro musical de la asistente:
//  - entiende "una canción que se llama X de Y"
//  - arma un plan para hacer tu versión en otro estilo
//  - analiza audios que le envías (canciones, loops o sonidos sueltos)
// ===============================================================
import { GENRES, NOTE_ES } from '../engine/engine.js';
import { analyzeSong, analyzeSounds } from '../engine/analyze.js';
import { CAMELOT } from '../studio/model.js';
import { toMono44 } from '../voice/voice.js';
import { trackPitch } from '../voice/tune.js';

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// ---------- estilo pedido en el texto ----------
const STYLE_WORDS = [
  ['perreorave', /perreo ?rave|tech ?perreo|perreo techno|techengue|perreo a 15|noro\$?s?t|peterblue|part time killer|aleroj/], ['makineo', /makineo|maquineo|makina|galactxtx|crrdr|cera khin/],
  ['hardhouse', /hard ?house|funky house|hard ?bounce|funk tribu|iosio|noise mafia|esca/], ['funkbr', /funk (brasil|brasileno|carioca|mandelao)|baile funk|mandelao|brazilian funk|tamborzao/],
  ['ukbass', /uk ?garage|speed ?garage|bassline|uk ?bass|ned bennett|yasmin regisford/],
  ['guaracha', /guaracha|aleteo|zapateo/], ['hardtechno', /hard ?techno|hard ?tecno|techno duro|tecno duro|schranz/],
  ['technolatino', /techno latino|tecno latino|edit|neoperreo|rkt/], ['acidtechno', /acid|acido/], ['melodictechno', /melodic|melodico/],
  ['industrial', /industrial/], ['hardgroove', /hardgroove|tribal/], ['rave', /rave/], ['techno', /techno|tecno/],
  ['house', /house/], ['reggaeton', /reggaeton|regueton|perreo/], ['trap', /trap/], ['drill', /drill/], ['dembow', /dembow/],
  ['cumbia', /cumbia/], ['pop', /\bpop\b/], ['rock', /\brock\b/], ['edm', /\bedm\b|electronica/],
];
export function styleIn(text) { const t = norm(text); const f = STYLE_WORDS.find(([, re]) => re.test(t)); return f ? f[0] : null; }

// ---------- ¿habla de una canción concreta? ----------
const TRIGGER = /cancion|tema|cover|version|remix|transformar|convertir|pasar a|hacer .* a (techno|tecno|guaracha)/;
const STOP = /\s+(si|que|y|pero|para|porque|a\s+(?:techno|tecno|guaracha|house|un|una)|en\s+(?:techno|tecno|guaracha|version)|,|\.|;|!|\?)\b.*$/;
export function detectSongRequest(text) {
  const raw = text.trim(); const t = norm(raw);
  if (!TRIGGER.test(t)) return null;
  let title = null, artist = null;
  const q = raw.match(/["“«']([^"”»']{2,60})["”»']/); if (q) title = q[1];
  if (!title) {
    const m = t.match(/(?:se llama|llamada|titulada|de nombre|la cancion|el tema|cancion|tema)\s+(.+)/);
    if (m) {
      let rest = m[1];
      const de = rest.match(/^(.+?)\s+(?:de|del|por)\s+(.+)$/);
      if (de) { title = de[1]; artist = de[2]; } else title = rest;
    }
  } else {
    const after = norm(raw.slice(raw.indexOf(q[0]) + q[0].length)); const de = after.match(/^\s*(?:de|del|por)\s+(.+)$/); if (de) artist = de[1];
  }
  if (!title) return null;
  const clean = (s) => (s || '').replace(STOP, '').replace(/^(?:que\s+)?(?:se\s+llama|llamad[ao]|titulad[ao]|de\s+nombre)\s+/, '').replace(/^(una|un)\s+(?=\S)/, '').trim();
  title = clean(norm(title)); artist = clean(artist ? norm(artist) : '');
  if (title.length < 2 || /^(nueva|mia|propia|mi)$/.test(title)) return null;
  return { title, artist, query: `${title} ${artist}`.trim(), target: styleIn(text) };
}

// ---------- plan para hacer tu versión ----------
const KIT = {
  techno: 'bombo 4x4 con punch, palmas en 2 y 4, hat abierto en el contratiempo, ride y un bajo/rumble con sidechain',
  hardtechno: 'bombo duro distorsionado, rumble rodante entre bombos, palmas, hats rápidos y percusión metálica',
  technolatino: 'bombo 4x4 duro + el dembow en el aro y las congas, rumble y stabs; deja espacio para la voz',
  acidtechno: 'bombo 4x4, palmas y una línea acid 303 con resonancia alta',
  guaracha: 'bombo 4x4, palmas en 2 y 4, toms y congas tribales sin parar, hat abierto en el contratiempo, shaker y silbato',
  hardgroove: 'bombo seco, congas y bongós tribales, shaker y hats en groove',
  rave: 'ritmo quebrado (breakbeat), caja rave, bajo reese y un hoover en el drop',
  house: 'bombo 4x4, palmas, hats abiertos en el contratiempo y un bajo saltarín',
  reggaeton: 'bombo 4x4 con la caja del dembow (3-3-2), shaker y un sub-bajo',
  perreorave: 'bombo duro 4x4 a ~155 con el dembow (3-3-2) en el aro, las congas y el sub-bajo; hats rápidos y stabs cortos',
  makineo: 'bombo duro a ~162, palmas en 2 y 4, bajo rodante en todos los huecos entre bombos, hoover y supersaw en el drop',
  hardhouse: 'bombo 4x4, palmas, hat abierto en el contratiempo y el bajo saltando de octava (el "oi-oi" del hard house), stabs de órgano',
  funkbr: 'tamborzão (bombo "x..x..x...x..x.."), palmas, congas y sub-bajo; melodía de campana o flauta y voces cortadas',
  ukbass: 'bombo con saltos, palmas en 2 y 4, shaker con swing y un bajo reese que se mueve; estilo speed garage / bassline',
};
function targetBpm(bpm, G) {
  const mid = (G.bpm[0] + G.bpm[1]) / 2;
  const opts = [[1, 'mismo tempo'], [1.5, '×1,5: cada 2 tiempos del original caben en 3'], [2, 'doble tiempo'], [4 / 3, '×4/3'], [0.5, 'medio tiempo']];
  let best = null;
  opts.forEach(([k, why]) => { const b = bpm * k; const d = b < G.bpm[0] ? G.bpm[0] - b : b > G.bpm[1] ? b - G.bpm[1] : Math.abs(b - mid) * 0.2; if (!best || d < best.d) best = { d, b: Math.round(Math.max(G.bpm[0], Math.min(G.bpm[1], b))), why }; });
  return best;
}
export function remakePlan({ title, artist, bpm, root, mode, genre }, target) {
  const tg = target && GENRES[target] ? target : 'techno'; const G = GENRES[tg];
  const tb = bpm ? targetBpm(bpm, G) : { b: Math.round((G.bpm[0] + G.bpm[1]) / 2), why: '' };
  const key = root != null ? `${NOTE_ES[root]} ${mode === 'minor' ? 'menor' : 'mayor'} (Camelot ${CAMELOT[mode][root]})` : null;
  const lines = [
    `🎯 Plan para tu versión ${G.emoji} ${G.name} de "${title}"${artist ? ' — ' + artist : ''}:`,
    '',
    `1️⃣ Tempo: ${bpm ? `el original va a ${bpm} BPM → tu versión a ${tb.b} BPM${tb.why ? ` (${tb.why})` : ''}` : `${tb.b} BPM`}.`,
    `2️⃣ Tonalidad: ${key ? `${key}. La mantengo para que la melodía y tu voz calcen.` : 'súbeme la canción y la detecto.'}`,
    `3️⃣ Base ${G.name}: ${KIT[tg] || 'el kit del estilo'}.`,
    `4️⃣ El gancho: la melodía y la letra son ${artist ? 'de ' + artist : 'del autor original'}. Grábate cantando o tarareando el coro en 🎤 Voz → Editor (autotune a ${key ? NOTE_ES[root] + (mode === 'minor' ? ' menor' : ' mayor') : 'su tono'}) y súmalo en 🎚️ Mezcla. Yo no copio su audio.`,
    `5️⃣ Estructura para DJ: Intro 16 · Groove 16 · Subida 8 · Drop 32 (el coro) · Break 16 (un verso) · Subida 8 · Drop 32 · Outro 16.`,
    '',
    '⚖️ Para tocarla en tus sets está bien. Para subirla a Spotify/YouTube y monetizar necesitas licencia de la canción original (las distribuidoras gestionan licencias de covers) o permiso de sus autores.',
  ];
  return { text: lines.join('\n'), bpm: tb.b, target: tg };
}

// ---------- analizar un sonido corto ----------
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) { const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a), h = len >> 1; for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let j = 0; j < h; j++) { const x = i + j, y = x + h; const tr = re[y] * cr - im[y] * ci, ti = re[y] * ci + im[y] * cr; re[y] = re[x] - tr; im[y] = im[x] - ti; re[x] += tr; im[x] += ti; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } }
}
const ROLE_PATTERN = {
  kick: 'x...x...x...x...', perc: 'x.xx..x.x.xx..x.', hat: '..x...x...x...x.', snare: '....x.......x...', fx: 'x...............', melody: 'x.....x...x.....',
};
export async function analyzeSound(buffer) {
  const x = await toMono44(buffer); const sr = 44100;
  const hop = 441; const env = []; for (let i = 0; i + hop < x.length; i += hop) { let e = 0; for (let k = i; k < i + hop; k++) e += x[k] * x[k]; env.push(Math.sqrt(e / hop)); }
  const pk = Math.max(...env, 1e-6); const pi = env.indexOf(pk);
  let end = pi; while (end < env.length - 1 && env[end] > pk * 0.05) end++;
  const attack = pi * 0.01;
  // cuánto tiempo se mantiene sonando (sirve igual para golpes y sonidos sostenidos)
  const decay = env.filter((e) => e > pk * 0.25).length * 0.01; void end;
  // golpes (picos) para saber si es un ritmo
  let hits = 0; for (let i = 2; i < env.length - 2; i++) if (env[i] > pk * 0.35 && env[i] > env[i - 1] * 1.3 && env[i] >= env[i + 1] && env[i] > env[i - 2]) hits++;
  // brillo (centroide espectral) alrededor del golpe
  const N = 2048; const re = new Float32Array(N), im = new Float32Array(N); const o = Math.max(0, pi * hop - 200);
  for (let i = 0; i < N; i++) { re[i] = (x[o + i] || 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N)); im[i] = 0; }
  fft(re, im); let num = 0, den = 0; for (let k = 1; k < N / 2; k++) { const m = Math.hypot(re[k], im[k]); num += m * (k * sr) / N; den += m; }
  const centroid = den ? num / den : 0;
  // altura (si es un sonido con nota)
  const { f0 } = await trackPitch(x); const v = [...f0].filter(Boolean); const voiced = v.length / Math.max(1, f0.length);
  const med = v.length ? v.sort((a, b) => a - b)[v.length >> 1] : 0; const midi = med ? Math.round(69 + 12 * Math.log2(med / 440)) : null;
  let role, desc;
  if (hits >= 3 && buffer.duration > 1.2) { role = 'rhythm'; desc = `un ritmo de ${hits} golpes`; }
  else if (voiced > 0.45 && decay > 0.25 && midi) { role = 'melody'; desc = `un sonido con nota (${NOTE_ES[((midi % 12) + 12) % 12]})`; }
  else if (decay > 0.9 && centroid > 1200) { role = 'fx'; desc = 'una textura larga (tipo efecto o ambiente)'; }
  else if (centroid < 450) { role = 'kick'; desc = 'un golpe grave'; }
  else if (centroid > 6500) { role = 'hat'; desc = 'un golpe agudo y brillante'; }
  else if (centroid > 1500 && decay < 0.4) { role = 'snare'; desc = 'un golpe medio, tipo palmada o caja'; }
  else { role = 'perc'; desc = 'un golpe medio, tipo percusión'; }
  return { role, desc, attack, decay, centroid: Math.round(centroid), midi, hits, dur: buffer.duration };
}

export function soundAdvice(s, target) {
  const tg = target && GENRES[target] ? target : null; const G = tg ? GENRES[tg] : null;
  const use = {
    kick: 'Úsalo como capa del bombo (suena "x...x...x...x...") o como tom grave en los contratiempos.',
    perc: `Úsalo como percusión: ${tg === 'guaracha' ? 'en la guaracha va perfecto como tom tribal "x.xx..x.x.xx..x."' : 'ponlo en las casillas entre bombos para darle groove'}.`,
    hat: 'Úsalo como hi-hat o shaker: en el contratiempo ("..x...x...x...x.") o en 16avos suaves.',
    snare: 'Úsalo como palmada/caja en el 2 y el 4 ("....x.......x...") o en los redobles de la subida.',
    fx: 'Úsalo como efecto: al inicio de cada drop, en la intro o en el break (una vez cada 4 compases).',
    melody: 'Úsalo como sonido melódico: cambia su afinación en "⋯" de la fila para hacer el gancho.',
    rhythm: 'Es un ritmo completo: lo convierto en batería con tus propios sonidos y le pongo el estilo que quieras.',
  }[s.role];
  const lines = [
    `🔎 Escuché ${s.desc} de ${s.dur.toFixed(1)} s${s.midi != null && s.role !== 'rhythm' ? ` · nota ${NOTE_ES[((s.midi % 12) + 12) % 12]}` : ''} · brillo ${s.centroid < 450 ? 'oscuro' : s.centroid > 3500 ? 'muy brillante' : 'medio'}.`,
    '',
    `💡 ${use}`,
  ];
  if (G) lines.push('', `${G.emoji} Para tu ${G.name}: ${G.bpm[0]}–${G.bpm[1]} BPM · ${KIT[tg] || 'el kit del estilo'}.`);
  lines.push('', '💾 Ya lo guardé en 🔁 Loops → Tus sonidos.');
  return { text: lines.join('\n'), pattern: ROLE_PATTERN[s.role] || ROLE_PATTERN.perc };
}

export { analyzeSong, analyzeSounds };
