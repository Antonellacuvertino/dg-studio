// ===============================================================
//  El "productor": decide estilo, tempo, tono, estructura y
//  encaja la letra / la voz sobre el beat.
// ===============================================================
import { GENRES, GENRE_KEYS, rng, pick, pat } from './engine.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

function fitBpm(bpm, [lo, hi]) {
  let best = bpm, bd = Infinity;
  [bpm, bpm * 2, bpm / 2].forEach((b) => {
    const d = b < lo ? lo - b : b > hi ? b - hi : 0;
    if (d < bd) { bd = d; best = clamp(b, lo, hi); }
  });
  return Math.round(best);
}

/**
 * @param {object} p
 *  lyrics: resultado de analyzeLyrics | null
 *  voice:  {info, buffer} | null
 *  dna:    ADN de canción subida | null   (usar su ritmo)
 *  sounds: resultado de analyzeSounds | null
 *  genre:  forzar estilo | null
 *  seed:   número
 *  takeMode: si se grabará sobre el beat (sin offset de voz)
 */
export function produce(p) {
  const seed = p.seed >>> 0;
  const r = rng(seed);
  const L = p.lyrics && p.lyrics.lines.length ? p.lyrics : null;
  const V = p.voice ? p.voice.info : null;

  // ---------- 1. Estilo ----------
  let genre = p.genre;
  const why = [];
  if (!genre) {
    if (p.dna) { genre = p.dna.genre; why.push('mismo groove que la canción que subiste'); }
    else if (p.sounds) { genre = p.sounds.genre; why.push('tu ritmo se parece a este estilo'); }
    else {
      const sc = {}; GENRE_KEYS.forEach((g) => { sc[g] = L ? L.scores[g] : 0.3; });
      if (V) {
        GENRE_KEYS.forEach((g) => {
          const G = GENRES[g]; const fb = fitBpm(V.bpm, G.bpm);
          if (V.conf > 0.15 && Math.abs(fb - V.bpm) < 3) sc[g] += 0.6;
        });
        if (V.singing) { sc.pop += 0.6; sc.rnb += 0.5; sc.balada += 0.4; sc.reggaeton += 0.3; why.push('detecté melodía cantada'); }
        else { sc.trap += 0.6; sc.hiphop += 0.6; sc.drill += 0.3; sc.reggaeton += 0.3; why.push('detecté flow rapeado'); }
      }
      // un poco de azar entre los 3 mejores para que "Otro beat" varíe
      const top = GENRE_KEYS.slice().sort((a, b) => sc[b] - sc[a]).slice(0, 3);
      genre = p.variation ? pick(r, top) : top[0];
      if (L) {
        const kw = Object.keys(L.scores).filter((g) => g === genre)[0];
        if (kw && L.scores[genre] > 1) why.push('palabras de tu letra suenan a ' + GENRES[genre].name);
        if (L.avgSyll > 12) why.push('versos largos → flow rápido');
        else if (L.avgSyll && L.avgSyll < 9) why.push('versos cortos → melódico');
      }
    }
  }
  const G = GENRES[genre];
  if (p.genre) why.unshift(`estilo ${G.name} elegido por ti`);

  // ---------- 2. Tempo ----------
  let bpm;
  if (p.dna) bpm = fitBpm(p.dna.bpm, [60, 190]);
  else if (p.sounds) bpm = p.genre ? fitBpm(p.sounds.bpm, G.bpm) : p.sounds.bpm;
  else if (V && V.conf > 0.12) { bpm = fitBpm(V.bpm, G.bpm); why.push(`tempo ajustado a tu voz (${bpm} BPM)`); }
  else if (L) {
    // más sílabas por línea → tempo más lento dentro del rango del estilo
    const dens = clamp((L.avgSyll - G.spb * 0.7) / (G.spb * 0.9), 0, 1);
    bpm = Math.round(G.bpm[1] - dens * (G.bpm[1] - G.bpm[0]) + (r() - 0.5) * 4);
    bpm = clamp(bpm, G.bpm[0], G.bpm[1]);
  } else bpm = Math.round(G.bpm[0] + r() * (G.bpm[1] - G.bpm[0]));

  // ---------- 3. Tonalidad ----------
  let root, mode;
  if (p.dna) { root = p.dna.root; mode = p.dna.mode; }
  else if (V && V.keyConf > 0.3) { root = V.root; mode = V.mode; why.push('tonalidad sacada de tu voz'); }
  else {
    mode = (L && L.mood) || G.mode;
    root = (L ? hash(L.lines.map((l) => l.text).join()) + seed : seed) % 12;
  }
  if (!G.progs[mode]) mode = G.mode;
  const prog = pick(r, G.progs[mode]);

  // ---------- 4. Batería ----------
  let drums, kit = null, snareType;
  if (p.sounds) { drums = p.sounds.drums; kit = { samples: p.sounds.samples }; }
  else if (p.dna) { drums = p.dna.drums; }
  else drums = { kick: pat(pick(r, G.kick)), snare: pat(pick(r, G.snare)), hat: pat(pick(r, G.hat)) };

  // ---------- 5. Estructura + letra ----------
  const barDur = (60 / bpm) * 4;
  const sections = []; const timeline = [];
  // Duración objetivo (en compases): alarga la canción repitiendo el gancho y con vocal chops
  const TARGET = { auto: 0, short: 90, normal: 150, long: 210, dj: 360 };
  const techno = ['techno', 'hardtechno', 'acidtechno', 'melodictechno', 'industrial', 'hardgroove', 'technolatino', 'rave', 'house', 'edm'].includes(genre);
  const intro = p.length === 'dj' ? 32 : techno && p.length && p.length !== 'auto' ? 16 : bpm < 90 ? 2 : 4;
  const outro = p.length === 'dj' ? 32 : techno && p.length && p.length !== 'auto' ? 16 : 4;
  const targetBars = Math.max(0, Math.round(((TARGET[p.length || 'auto'] || 0) * bpm) / 240) - outro);
  sections.push({ type: 'intro', bars: intro });
  let bar = intro; let chopN = 0;

  const spb = G.spb * (bpm / ((G.bpm[0] + G.bpm[1]) / 2)) ** -1; // sílabas que caben en un compás
  const addBlock = (b, type = b.type) => {
    let bars = 0; const startBar = bar;
    b.lines.forEach((ln) => {
      const n = ln.syll <= spb * 1.25 ? 1 : ln.syll <= spb * 2.4 ? 2 : Math.ceil(ln.syll / spb);
      timeline.push({ text: ln.text, rhyme: ln.rhyme, time: (startBar + bars) * barDur, bars: n, section: type });
      bars += n;
    });
    bars = Math.max(4, Math.ceil(bars / 4) * 4);
    sections.push({ type, bars }); bar += bars;
  };
  const addChops = (hook, bars, type = 'verse') => {
    const text = hook.lines[hook.lines.length - 1].text;
    timeline.push({ text, chop: true, time: bar * barDur, bars, section: 'chop' });
    sections.push({ type: chopN++ % 3 === 2 ? 'bridge' : type, bars }); bar += bars;
  };
  if (L) {
    const blocks = L.blocks.slice();
    let hook = blocks.filter((b) => b.type === 'chorus').pop();
    const verses = blocks.filter((b) => b.type !== 'chorus');
    if (!targetBars) {
      if (hook && blocks.length >= 2 && !V) blocks.push(hook); // coro final
      blocks.forEach((b) => addBlock(b));
    } else {
      if (!hook) hook = verses.length > 1 ? verses.pop() : verses[0];
      const seq = [];
      if (verses.length && verses[0] !== hook) seq.push(['v', 0]);
      seq.push(['h']);
      seq.push(verses[1] && verses[1] !== hook ? ['v', 1] : ['c', 8]);
      seq.push(['h']); seq.push(['c', 8]); seq.push(['h']);
      let vi = 2;
      while (bar < targetBars - 12) { seq.push(verses[vi] && verses[vi] !== hook ? ['v', vi++] : ['c', 8]); seq.push(['h']); if (seq.length > 40) break; }
      for (const [k, x] of seq) {
        if (bar >= targetBars - 4 && k !== 'h') continue;
        if (k === 'v') addBlock(verses[x], 'verse');
        else if (k === 'h') addBlock(hook, 'chorus');
        else addChops(hook, x, 'verse');
        if (bar >= targetBars) break;
      }
    }
  }
  if (V && !p.takeMode) {
    const need = Math.ceil(V.duration / barDur);
    let have = bar - intro;
    let toggle = sections.length > 1 ? 'chorus' : 'verse';
    while (have < need) { const n = Math.min(8, Math.max(4, Math.ceil((need - have) / 4) * 4)); sections.push({ type: toggle, bars: n }); have += n; bar += n; toggle = toggle === 'verse' ? 'chorus' : 'verse'; }
  }
  if (sections.length === 1) {
    ['verse', 'chorus', 'verse', 'chorus'].forEach((t) => { sections.push({ type: t, bars: 8 }); bar += 8; });
  }
  sections.push({ type: 'outro', bars: outro });

  const song = {
    genre, bpm, root, mode, prog, seed, sections, drums, kit, snareType,
    swing: p.sounds ? 0 : undefined,
    timeline, why,
    voiceOffset: V && !p.takeMode ? intro * barDur : 0,
  };
  return song;
}
