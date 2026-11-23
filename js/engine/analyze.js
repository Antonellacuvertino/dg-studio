// ===============================================================
//  Análisis: letra (sílabas, rimas, estilo) y audio (BPM, tono,
//  patrón de batería, sonidos -> ritmo).
// ===============================================================
import { GENRES, GENRE_KEYS, pat } from './engine.js';

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// ---------------------------------------------------------------
//  LETRA
// ---------------------------------------------------------------
const VOW = 'aeiouáéíóúüy';
const STRONG = 'aeoáéíóú';

function nuclei(word) {
  // devuelve núcleos vocálicos [{start, end, text}] separando hiatos
  const w = word.toLowerCase(); const out = [];
  let i = 0;
  while (i < w.length) {
    const isV = (c, pos) => VOW.includes(c) && !(c === 'y' && pos < w.length - 1 && VOW.includes(w[pos + 1]));
    if (!isV(w[i], i)) { i++; continue; }
    let j = i + 1; while (j < w.length && isV(w[j], j)) j++;
    let s = i;
    for (let k = i + 1; k < j; k++) {
      if (STRONG.includes(w[k]) && STRONG.includes(w[k - 1])) { out.push({ start: s, end: k, text: w.slice(s, k) }); s = k; }
    }
    out.push({ start: s, end: j, text: w.slice(s, j) });
    i = j;
  }
  return out;
}

export function syllables(word) {
  const n = nuclei(word.replace(/[^a-záéíóúüñ]/gi, ''));
  if (/[a-z]e$/i.test(word) && /[^aeiou]e$/i.test(word) && /[a-z]{4,}/i.test(word) && /(th|ck|ke|ve|me|ne|re|se)$/i.test(word) && n.length > 1 && isEnglishish(word)) return n.length - 1;
  return Math.max(1, n.length);
}
const EN = new Set('the you me my your love baby know want like night just money gang drip feel make take time life girl boy yeah oh tonight heart forever never ever'.split(' '));
const isEnglishish = (w) => EN.has(w.toLowerCase());

function rhymeKey(word) {
  const w = word.toLowerCase().replace(/[^a-záéíóúüñ]/g, '');
  if (!w) return null;
  const nu = nuclei(w);
  if (!nu.length) return { as: w, con: w };
  let idx = nu.findIndex((n) => /[áéíóú]/.test(n.text));
  if (idx === -1) idx = /[aeiouns]$/.test(w) && nu.length > 1 ? nu.length - 2 : nu.length - 1;
  const tail = w.slice(nu[idx].start);
  const as = nu.slice(idx).map((n) => {
    const t = norm(n.text).replace('y', 'i');
    const strong = [...t].find((c) => 'aeo'.includes(c));
    return strong || t[t.length - 1];
  }).join('');
  return { as, con: norm(tail) };
}

const KW = {
  trap: 'trap calle money dinero plata cash flow drip glock joya joyas cadena lean perco gang bichota codeina tumba millones lambo rari envidia envidiosos trapero placa corillo bando bandido diamantes marca gucci prada fendi lujo',
  drill: 'drill opp opps glock pistola balas bala tiroteo oscuro guerra enemigo enemigos smoke block barrio muerte calles sombra',
  reggaeton: 'perreo perrear bellaco bellaca gata mami papi baby bebe discoteca disco party fiesta culo bailar baila bailando noche sudor pegao pegaito reggaeton shorty nena beso besos cama sexy caliente rumba jangueo janguear toto gyal duro suelo',
  dembow: 'dembow tiguere vaina klk manito dale jevi jevo chercha tigueraje',
  hiphop: 'rap rapear rimas rima micro microfono verso versos barras hiphop lirica letra escuela vinilo freestyle batalla tinta cuaderno poeta poesia',
  lofi: 'lluvia cafe soledad tarde nostalgia recuerdos recuerdo estudiar calma tranquilo dormir luna ventana chill relax cansado domingo',
  rnb: 'piel deseo labios cuerpo suave lento sensual contigo tocarte love kiss touch miradas intimo seda perfume',
  pop: 'corazon feliz sonrisa juntos siempre brillar estrellas cielo magia suenos heart tonight forever enamorada enamorado alegria colores',
  rock: 'rock guitarra grito gritar rebelde rebeldia fuego furia rabia carretera sistema romper destruir infierno sangre tormenta gritos rugir',
  reggae: 'jah paz rasta babylon babilonia natural raiz raices ganja hierba sol mar playa unidad conciencia africa zion irie humildad hermanos',
  dancehall: 'dancehall wine whine riddim jamaica vibes tun boom selector yard bumbum',
  afrobeat: 'afro africa lagos vibe vibes ginger omo wahala tambor tambores calor ritmo cintura',
  house: 'house club dj pista luces energia groove underground manos bailar',
  edm: 'festival drop volar laser euforia arriba explosion electro rave infinito',
  cumbia: 'cumbia pollera guira acordeon sonidera baile tropical sabrosura cintura caderas sabor pueblo cerveza chela bailemos villera',
  hardtechno: 'hard duro dura martillo velocidad rapido golpe bunker hardtechno schranz',
  acidtechno: 'acid acido 303 squelch',
  melodictechno: 'melodico melodica emocion universo estrellas cosmos viaje sueño',
  industrial: 'industrial metal fabrica acero maquina oxido',
  hardgroove: 'groove tribal tambores tribu',
  technolatino: 'edit perreo techno latino neoperreo rkt mami bellaca gata chilena',
  rave: 'rave neo neorave euforia saltar',
  techno: 'techno tecno rave warehouse bunker maquina maquinas industrial berlin hipnotico repetir oscuridad acido strobo',
  balada: 'lagrimas lloro llorar adios perdon extrano extranarte olvidar dolor herida triste tristeza partiste despedida roto jamas nunca silencio',
};
const KWS = Object.fromEntries(Object.entries(KW).map(([k, v]) => [k, new Set(v.split(' '))]));
const NEG = new Set('triste tristeza dolor llorar lloro lagrimas muerte oscuro sombra solo soledad roto herida odio rabia nunca jamas adios perdi perdido frio guerra enemigo envidia sangre infierno extrano miedo'.split(' '));
const POS = new Set('feliz alegria sonrisa amor brillar sol luz cielo bailar fiesta vida magia juntos siempre paz libre libertad gozar disfrutar sueno suenos'.split(' '));
const PRIOR = { reggaeton: 0.7, trap: 0.7, pop: 0.6, hiphop: 0.45, rnb: 0.4, drill: 0.3, balada: 0.35, rock: 0.35, reggae: 0.3, dembow: 0.25, cumbia: 0.3, afrobeat: 0.3, dancehall: 0.25, lofi: 0.3, house: 0.2, edm: 0.2, techno: 0.3, hardtechno: 0.3, acidtechno: 0.2, melodictechno: 0.2, industrial: 0.15, hardgroove: 0.15, technolatino: 0.3, rave: 0.15 };

export function analyzeLyrics(text) {
  const raw = (text || '').replace(/\r/g, '');
  const blocksRaw = raw.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const blocks = []; const lines = [];
  const words = [];
  blocksRaw.forEach((b) => {
    const ls = b.split('\n').map((l) => l.trim()).filter(Boolean);
    let label = null;
    if (/^\[?\(?\s*(coro|estribillo|chorus|hook|pre-?coro|puente|bridge|verso|verse|intro|outro)\b/i.test(ls[0]) && ls[0].length < 30) {
      label = norm(ls.shift()).replace(/[^a-z-]/g, '');
    }
    if (!ls.length) return;
    const blk = { label, lines: [] };
    ls.forEach((l) => {
      const ws = l.split(/\s+/).filter((w) => /[a-záéíóúüñ]/i.test(w));
      const syll = ws.reduce((a, w) => a + syllables(w), 0);
      const last = ws[ws.length - 1] || '';
      const line = { text: l, syll, rk: rhymeKey(last) };
      blk.lines.push(line); lines.push(line);
      ws.forEach((w) => words.push(norm(w.replace(/[^a-záéíóúüñ]/gi, ''))));
    });
    blocks.push(blk);
  });

  // Coros: etiquetados o bloques repetidos
  const seen = {};
  blocks.forEach((b) => { const k = norm(b.lines.map((l) => l.text).join('|')); seen[k] = (seen[k] || 0) + 1; });
  blocks.forEach((b) => {
    const k = norm(b.lines.map((l) => l.text).join('|'));
    b.type = b.label ? (/coro|estribillo|chorus|hook/.test(b.label) ? 'chorus' : /puente|bridge/.test(b.label) ? 'bridge' : 'verse') : seen[k] > 1 ? 'chorus' : 'verse';
  });
  if (!blocks.some((b) => b.type === 'chorus') && blocks.length >= 3) {
    // el bloque más corto con más rimas repetidas se vuelve gancho
    let best = 1; blocks.forEach((b, i) => { if (i > 0 && b.lines.length < blocks[best].lines.length) best = i; });
    blocks[best].type = 'chorus';
  }

  // Esquema de rima
  const counts = {}; lines.forEach((l) => l.rk && (counts[l.rk.as] = (counts[l.rk.as] || 0) + 1));
  const letters = {}; let next = 0;
  lines.forEach((l) => {
    if (l.rk && counts[l.rk.as] > 1) { if (!(l.rk.as in letters)) letters[l.rk.as] = next++; l.rhyme = letters[l.rk.as]; } else l.rhyme = -1;
  });
  const rhymed = lines.filter((l) => l.rhyme >= 0).length;

  // Estilo
  const avgSyll = lines.length ? lines.reduce((a, l) => a + l.syll, 0) / lines.length : 0;
  const scores = {};
  GENRE_KEYS.forEach((g) => { scores[g] = PRIOR[g] || 0.2; });
  words.forEach((w) => GENRE_KEYS.forEach((g) => { if (KWS[g].has(w)) scores[g] += 1; }));
  if (avgSyll > 12) { scores.trap += 0.8; scores.hiphop += 0.8; scores.drill += 0.5; }
  if (avgSyll < 9 && lines.length) { scores.pop += 0.5; scores.balada += 0.4; scores.rock += 0.3; scores.reggae += 0.2; }
  const excl = (raw.match(/!/g) || []).length; scores.reggaeton += excl * 0.1; scores.edm += excl * 0.1;
  const neg = words.filter((w) => NEG.has(w)).length, pos = words.filter((w) => POS.has(w)).length;
  const mood = neg > pos ? 'minor' : pos > neg ? 'major' : null;
  if (neg > pos) { scores.balada += 0.3; scores.drill += 0.2; scores.lofi += 0.2; }
  const ranking = GENRE_KEYS.slice().sort((a, b) => scores[b] - scores[a]);

  return { blocks, lines, avgSyll, rhymed, scores, ranking, mood, wordCount: words.length };
}

// ---------------------------------------------------------------
//  AUDIO
// ---------------------------------------------------------------
const ASR = 22050, N = 1024, HOP = 512, HOPSEC = HOP / ASR;

export async function toMono(buffer, maxSec = 600) {
  const dur = Math.min(buffer.duration, maxSec);
  const oc = new OfflineAudioContext(1, Math.ceil(dur * ASR), ASR);
  const s = oc.createBufferSource(); s.buffer = buffer; s.connect(oc.destination); s.start();
  return (await oc.startRendering()).getChannelData(0);
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang), h = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < h; j++) {
        const a = i + j, b = a + h;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
const HANN = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));

async function features(x) {
  const nf = Math.max(1, Math.floor((x.length - N) / HOP));
  const flux = new Float32Array(nf), low = new Float32Array(nf), mid = new Float32Array(nf), high = new Float32Array(nf);
  const rms = new Float32Array(nf), cent = new Float32Array(nf);
  const chroma = new Float64Array(12);
  const re = new Float32Array(N), im = new Float32Array(N);
  let prev = new Float32Array(N / 2), cur = new Float32Array(N / 2);
  let prevLow = 0;
  const binHz = ASR / N;
  const pcOf = new Int8Array(N / 2).fill(-1);
  for (let k = 3; k < N / 2; k++) { const f = k * binHz; if (f > 60 && f < 2200) pcOf[k] = ((Math.round(12 * Math.log2(f / 440)) + 69) % 12 + 12) % 12; }
  for (let fi = 0; fi < nf; fi++) {
    const o = fi * HOP; let e = 0;
    for (let i = 0; i < N; i++) { const v = x[o + i] || 0; re[i] = v * HANN[i]; im[i] = 0; e += v * v; }
    rms[fi] = Math.sqrt(e / N);
    fft(re, im);
    let fl = 0, fl0 = 0, fl1 = 0, fl2 = 0, cs = 0, ms = 0, lowE = 0;
    for (let k = 1; k < N / 2; k++) {
      const mag = Math.hypot(re[k], im[k]);
      const m = Math.log1p(100 * mag);
      cur[k] = m;
      const d = m - prev[k];
      if (k * binHz < 140) lowE += mag * mag;
      if (d > 0) { fl += d; const f = k * binHz; if (f > 1800 && f < 5000) fl1 += d; else if (f > 7000) fl2 += d; }
      cs += k * binHz * m; ms += m;
      if (pcOf[k] >= 0) chroma[pcOf[k]] += m * m;
    }
    lowE = Math.sqrt(lowE); fl0 = Math.max(0, lowE - prevLow); prevLow = lowE;
    flux[fi] = fl; low[fi] = fl0; mid[fi] = fl1; high[fi] = fl2; cent[fi] = ms ? cs / ms : 0;
    const t = prev; prev = cur; cur = t;
    if (fi % 2000 === 1999) await new Promise((r) => setTimeout(r));
  }
  return { nf, flux, low, mid, high, rms, cent, chroma };
}

function tempo(env, lo = 70, hi = 180) {
  const n = env.length; const m = env.reduce((a, b) => a + b, 0) / n;
  const e = Float32Array.from(env, (v) => v - m);
  const ac = (L) => { const i0 = Math.floor(L), fr = L - i0; let s = 0; for (let i = 0; i + i0 + 1 < n; i++) s += e[i] * (e[i + i0] * (1 - fr) + e[i + i0 + 1] * fr); return s / (n - L); };
  let best = 0, bestBpm = 100, zero = ac(0) || 1;
  for (let bpm = lo; bpm <= hi; bpm += 0.5) {
    const L = 60 / (bpm * HOPSEC);
    const w = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 110) / 0.8, 2));
    const s = (ac(L) + 0.5 * ac(2 * L) + 0.25 * ac(4 * L)) * (0.6 + 0.4 * w);
    if (s > best) { best = s; bestBpm = bpm; }
  }
  return { bpm: Math.round(bestBpm), conf: Math.max(0, Math.min(1, best / zero)) };
}

function keyOf(chroma) {
  const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  const corr = (a, b) => { const ma = a.reduce((x, y) => x + y) / 12, mb = b.reduce((x, y) => x + y) / 12; let n = 0, da = 0, db = 0; for (let i = 0; i < 12; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; } return n / Math.sqrt(da * db || 1); };
  let best = { root: 0, mode: 'minor', c: -2 };
  for (let r = 0; r < 12; r++) {
    const rot = Array.from({ length: 12 }, (_, i) => chroma[(i + r) % 12]);
    const cM = corr(rot, MAJ), cm = corr(rot, MIN);
    if (cM > best.c) best = { root: r, mode: 'major', c: cM };
    if (cm > best.c) best = { root: r, mode: 'minor', c: cm };
  }
  return best;
}

function beatGrid(env, bpm) {
  const P = 60 / (bpm * HOPSEC); let bo = 0, bs = -1;
  for (let o = 0; o < P; o += 0.5) { let s = 0; for (let k = o; k < env.length; k += P) s += env[Math.round(k)] || 0; if (s > bs) { bs = s; bo = o; } }
  return { P, offset: bo };
}

function stepPattern(band, P, offset, rot = 0) {
  const sf = P / 4; const out = new Float32Array(16); const cnt = new Float32Array(16);
  for (let k = 0; ; k++) {
    const pos = offset + (k + rot) * sf; const i = Math.round(pos);
    if (i + 1 >= band.length) break;
    const v = Math.max(band[i - 1] || 0, band[i], band[i + 1]);
    out[k % 16] += v; cnt[k % 16]++;
  }
  for (let i = 0; i < 16; i++) out[i] /= cnt[i] || 1;
  const mx = Math.max(...out), mn = Math.min(...out);
  return Array.from(out, (v) => (mx - mn > 1e-6 ? (v - mn) / (mx - mn) : 0));
}

const q = (arr, hi = 0.6, mid = 0.38) => arr.map((v) => (v > hi ? 1 : v > mid ? 0.55 : 0));
const sim = (a, b) => { let s = 0, sa = 0, sb = 0; for (let i = 0; i < 16; i++) { s += Math.min(a[i], b[i]); sa += a[i]; sb += b[i]; } return sa && sb ? s / Math.sqrt(sa * sb) : 0; };

export function guessGenre(bpm, kick, snare, all = null) {
  let best = 'pop', bs = -1;
  GENRE_KEYS.forEach((g) => {
    const G = GENRES[g];
    let s;
    if (all) {
      // patrón combinado (bombo + caja + bajo) vs plantilla del estilo
      s = Math.max(...G.kick.flatMap((kp) => G.snare.map((sp) => {
        const k = pat(kp), sn = pat(sp), b = G.bass.pat ? [...G.bass.pat].map((c) => ('RFO3'.includes(c) ? 0.5 : 0)) : k;
        return sim(all, k.map((v, i) => Math.max(v, sn[i], b[i])));
      })));
    } else {
      s = Math.max(...G.kick.map((p) => sim(kick, pat(p)))) + Math.max(...G.snare.map((p) => sim(snare, pat(p))));
    }
    let fit = 0;
    [bpm, bpm * 2, bpm / 2].forEach((b, i) => { if (b >= G.bpm[0] - 4 && b <= G.bpm[1] + 4) fit = Math.max(fit, i ? 0.75 : 1); });
    s += fit * 1.2;
    if (s > bs) { bs = s; best = g; }
  });
  return best;
}

// Canción completa -> "ADN" del ritmo
export async function analyzeSong(buffer, onProgress) {
  onProgress && onProgress('Escuchando la canción…');
  const x = await toMono(buffer, 120);
  const F = await features(x);
  onProgress && onProgress('Detectando el tempo…');
  let { bpm, conf } = tempo(F.flux, 65, 185);
  const { P, offset } = beatGrid(F.flux, bpm);
  let best = null;
  for (let rot = 0; rot < 16; rot++) {
    const kick = stepPattern(F.low, P, offset, rot), snare = stepPattern(F.mid, P, offset, rot);
    const s = kick[0] * 2 + kick[8] * 0.5 - snare[0] * 0.5 + Math.max(snare[4] + snare[12], snare[8] * 1.6, (snare[3] + snare[6] + snare[11] + snare[14]) / 2);
    if (!best || s > best.s) best = { s, rot, kick, snare };
  }
  const hat = stepPattern(F.high, P, offset, best.rot);
  const all = q(stepPattern(F.flux, P, offset, best.rot), 0.55, 0.35);
  const key = keyOf(F.chroma);
  let kick = q(best.kick, 0.72, 0.55); if (!kick[0]) kick[0] = 1;
  let snare = q(best.snare, 0.72, 0.55);
  let hatQ = q(hat, 0.5, 0.3);
  // hats muy densos a tempo lento => probablemente es medio tiempo (trap/drill)
  if (bpm < 90 && hatQ.filter(Boolean).length >= 12) bpm *= 2;
  if (hatQ.filter(Boolean).length > 13 || !hatQ.some(Boolean)) hatQ = pat('x.x.x.x.x.x.x.x.');
  let genre = guessGenre(bpm, kick, snare, all);
  // la caja "dembow" es inconfundible
  const dem = Math.max(sim(snare, pat('...x..x....x..x.')), sim(all, pat('x..xx.x.x..xx.x.')));
  if (dem > 0.8) genre = bpm >= 108 ? 'dembow' : bpm >= 80 ? 'reggaeton' : genre;
  // si bombo y caja no se separaron bien, usar la plantilla del estilo más cercano
  const G = GENRES[genre];
  const separated = sim(kick, snare) < 0.6 && snare.some(Boolean);
  if (!separated) {
    const pickBest = (list) => list.map(pat).sort((a, b) => sim(all, b) - sim(all, a))[0];
    kick = pickBest(G.kick); snare = pickBest(G.snare);
  }
  const energy = F.rms.reduce((a, b) => a + b, 0) / F.nf;
  return { bpm, conf, root: key.root, mode: key.mode, drums: { kick, snare, hat: hatQ }, genre, energy, duration: buffer.duration, separated };
}

// Voz cantada / rapeada
export async function analyzeVoice(buffer, onProgress) {
  onProgress && onProgress('Escuchando tu voz…');
  const x = await toMono(buffer);
  const F = await features(x);
  const { bpm, conf } = tempo(F.flux, 60, 160);
  const key = keyOf(F.chroma);
  // tono fundamental por autocorrelación (FFT)
  const f0s = []; const M = 2048; const re = new Float32Array(M), im = new Float32Array(M);
  const thr = Math.max(0.01, Math.max(...F.rms) * 0.15);
  for (let fi = 0; fi < F.nf; fi += 2) {
    if (F.rms[fi] < thr) continue;
    const o = fi * HOP;
    for (let i = 0; i < M; i++) { re[i] = i < N ? (x[o + i] || 0) * HANN[i] : 0; im[i] = 0; }
    fft(re, im);
    for (let i = 0; i < M; i++) { re[i] = re[i] * re[i] + im[i] * im[i]; im[i] = 0; }
    fft(re, im);
    const r0 = re[0] || 1; let bl = 0, bv = 0;
    for (let L = Math.floor(ASR / 900); L < Math.floor(ASR / 75); L++) { const v = re[L] / r0; if (v > bv) { bv = v; bl = L; } }
    if (bv > 0.45 && bl) f0s.push(ASR / bl);
  }
  const midis = f0s.map((f) => 69 + 12 * Math.log2(f / 440)).sort((a, b) => a - b);
  const med = midis.length ? midis[Math.floor(midis.length / 2)] : 60;
  const sd = midis.length ? Math.sqrt(midis.reduce((a, m) => a + (m - med) ** 2, 0) / midis.length) : 0;
  const voicedRatio = f0s.length / Math.max(1, F.nf / 2);
  const singing = sd > 2.2 && voicedRatio > 0.25;
  return { bpm, conf, root: key.root, mode: key.mode, keyConf: key.c, medianMidi: med, pitchSpread: sd, singing, duration: buffer.duration };
}

// Sonidos (beatbox, golpes, palmas) -> ritmo + kit con tus propios sonidos
export async function analyzeSounds(buffer, onProgress) {
  onProgress && onProgress('Separando tus sonidos…');
  const x = await toMono(buffer, 60);
  const F = await features(x);
  const env = F.flux; const n = env.length;
  const mx = Math.max(...env) || 1;
  const maxLow = Math.max(...F.low) || 1;
  const onsets = [];
  for (let i = 1; i < n - 1; i++) {
    let s = 0, c = 0; for (let k = Math.max(0, i - 10); k < Math.min(n, i + 10); k++) { s += env[k]; c++; }
    const thr = s / c + 0.12 * mx;
    if (env[i] > thr && env[i] >= env[i - 1] && env[i] >= env[i + 1] && (!onsets.length || i - onsets[onsets.length - 1].f > 3)) {
      const c0 = (F.cent[i] + (F.cent[i + 1] || 0) + (F.cent[i + 2] || 0)) / 3;
      const lowR = Math.max(F.low[i], F.low[i + 1] || 0) / maxLow;
      onsets.push({ f: i, t: i * HOPSEC, cent: c0, low: lowR, e: Math.max(F.rms[i], F.rms[i + 1] || 0, F.rms[i + 2] || 0) });
    }
  }
  if (onsets.length < 2) throw new Error('No detecté suficientes golpes. Graba sonidos más marcados (boom, tss, pa).');

  // k-means 1D sobre log(centroide) con sesgo de graves
  const feat = onsets.map((o) => Math.log(o.cent + 50) - o.low * 1.5);
  const k = Math.min(3, onsets.length);
  const sorted = feat.slice().sort((a, b) => a - b);
  let cents = Array.from({ length: k }, (_, i) => sorted[Math.floor(((i + 0.5) / k) * sorted.length)]);
  let asg = [];
  for (let it = 0; it < 20; it++) {
    asg = feat.map((v) => cents.reduce((bi, c, ci) => (Math.abs(v - c) < Math.abs(v - cents[bi]) ? ci : bi), 0));
    cents = cents.map((c, ci) => { const m = feat.filter((_, i) => asg[i] === ci); return m.length ? m.reduce((a, b) => a + b) / m.length : c; });
  }
  const order = cents.map((c, i) => [c, i]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
  const roles = k === 3 ? ['kick', 'snare', 'hat'] : k === 2 ? ['kick', 'snare'] : ['kick'];
  const roleOf = {}; order.forEach((ci, r) => { roleOf[ci] = roles[r]; });
  onsets.forEach((o, i) => { o.role = roleOf[asg[i]]; });

  let { bpm } = onsets.length >= 4 ? tempo(env, 70, 160) : { bpm: 90 };
  const step = 60 / bpm / 4; const t0 = onsets[0].t;
  const emax = Math.max(...onsets.map((o) => o.e)) || 1;
  const drums = { kick: new Array(16).fill(0), snare: new Array(16).fill(0), hat: new Array(16).fill(0) };
  onsets.forEach((o) => { const s = ((Math.round((o.t - t0) / step) % 16) + 16) % 16; drums[o.role][s] = Math.max(drums[o.role][s], o.e / emax > 0.5 ? 1 : 0.55); });
  if (!drums.kick.some(Boolean)) drums.kick[0] = 1;

  // recortar muestras: el golpe más fuerte de cada tipo
  const full = buffer.getChannelData(0); const sr = buffer.sampleRate;
  const samples = {};
  roles.forEach((role) => {
    const cand = onsets.filter((o) => o.role === role).sort((a, b) => b.e - a.e)[0];
    if (!cand) return;
    const idx = onsets.indexOf(cand);
    const start = Math.max(0, Math.floor((cand.t - 0.01) * sr));
    const nextT = idx < onsets.length - 1 ? onsets[idx + 1].t : cand.t + 0.5;
    const len = Math.max(Math.floor(0.06 * sr), Math.floor(Math.min(nextT - cand.t, role === 'hat' ? 0.18 : 0.45) * sr));
    const ab = new AudioBuffer({ length: len, numberOfChannels: 1, sampleRate: sr });
    const d = ab.getChannelData(0); let pk = 0;
    for (let i = 0; i < len; i++) { d[i] = full[start + i] || 0; pk = Math.max(pk, Math.abs(d[i])); }
    const fade = Math.floor(0.02 * sr);
    for (let i = 0; i < len; i++) { let g = pk ? 0.9 / pk : 1; if (i > len - fade) g *= (len - i) / fade; if (i < 40) g *= i / 40; d[i] *= g; }
    samples[role] = ab;
  });

  return { bpm, drums, samples, hits: onsets.length, genre: guessGenre(bpm, drums.kick, drums.snare) };
}

// Tempo rápido de un loop o sample (para la biblioteca de sonidos)
export async function quickTempo(buffer) {
  if (buffer.duration < 1.5) return { bpm: null, conf: 0 };
  const x = await toMono(buffer, 60);
  const F = await features(x);
  const r = tempo(F.flux, 70, 180);
  return r;
}
