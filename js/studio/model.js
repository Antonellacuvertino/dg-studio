// ===============================================================
//  Modelo de proyecto del Estudio
//  proyecto = BPM + tonalidad + pistas (cada una con su patrón en bucle)
//           + escenas (secciones del tema: Intro, Drop, Break…)
//  En cada escena se elige qué pistas suenan: así se arma el track.
// ===============================================================
import { GENRES, SCALES, degSemi, rng, pick, pat } from '../engine/engine.js';
import { DRUMS } from '../engine/synth.js';
import { uid } from '../core/ui.js';

export const TECHNO = new Set(['perreorave', 'makineo', 'hardhouse', 'funkbr', 'ukbass', 'guaracha', 'techno', 'hardtechno', 'acidtechno', 'melodictechno', 'industrial', 'hardgroove', 'technolatino', 'rave', 'house', 'edm']);

export const SYNTHS = {
  acid: { name: 'Acid 303', fn: 'voice', type: 'acid', oct: 3 },
  rumble: { name: 'Rumble', fn: 'bass', type: 'rumble', oct: 1 },
  reese: { name: 'Reese', fn: 'bass', type: 'reese', oct: 1 },
  sub: { name: 'Sub', fn: 'bass', type: 'sub', oct: 1 },
  b808: { name: '808', fn: 'bass', type: '808', oct: 1 },
  bass: { name: 'Bajo synth', fn: 'bass', type: 'synth', oct: 2 },
  stab: { name: 'Stab', fn: 'voice', type: 'stab', oct: 4 },
  hoover: { name: 'Hoover rave', fn: 'voice', type: 'hoover', oct: 4 },
  supersaw: { name: 'Supersaw', fn: 'voice', type: 'supersaw', oct: 4 },
  pad: { name: 'Pad', fn: 'voice', type: 'pad', oct: 4 },
  strings: { name: 'Cuerdas', fn: 'voice', type: 'strings', oct: 4 },
  pluck: { name: 'Pluck', fn: 'voice', type: 'pluck', oct: 5 },
  lead: { name: 'Lead', fn: 'voice', type: 'lead', oct: 5 },
  bell: { name: 'Campana', fn: 'voice', type: 'bell', oct: 5 },
  piano: { name: 'Piano', fn: 'voice', type: 'piano', oct: 4 },
  rhodes: { name: 'Rhodes', fn: 'voice', type: 'rhodes', oct: 4 },
  organ: { name: 'Órgano', fn: 'voice', type: 'organ', oct: 4 },
  marimba: { name: 'Marimba', fn: 'voice', type: 'marimba', oct: 5 },
  accordion: { name: 'Acordeón', fn: 'voice', type: 'accordion', oct: 5 },
  guitar: { name: 'Guitarra', fn: 'voice', type: 'guitar', oct: 4 },
};
export const DRUM_LIST = Object.entries(DRUMS).filter(([k]) => k !== 'hat2').map(([id, [name]]) => ({ id, name }));
const COLORS = ['#ff2d4b', '#ff7a1a', '#ffc23d', '#d9a441', '#ff5c8a', '#c4122f', '#e85d3a', '#b8860b', '#ff9e7a', '#a8122a'];

export const SCENE_FX = { none: 'Normal', build: 'Subida (build)', drop: 'Drop (platillo)', break: 'Break (filtro)', fadein: 'Entrada suave', fadeout: 'Salida suave' };
export const CAMELOT = { major: ['8B', '3B', '10B', '5B', '12B', '7B', '2B', '9B', '4B', '11B', '6B', '1B'], minor: ['5A', '12A', '7A', '2A', '9A', '4A', '11A', '6A', '1A', '8A', '3A', '10A'] };

// ---------- notas ----------
export function degToMidi(project, preset, d) {
  const sc = SCALES[project.mode] || SCALES.minor;
  return 12 * (preset.oct + 1) + project.root + degSemi(sc, d);
}

// ---------- fábrica de pistas ----------
let colorI = 0;
export function newTrack(kind, opts = {}) {
  const t = {
    id: uid(), kind, name: opts.name || 'Pista', color: opts.color || COLORS[colorI++ % COLORS.length], role: opts.role || 'perc',
    sound: opts.sound || 'kick', preset: opts.preset || 'acid', sampleId: opts.sampleId || null,
    mode: opts.mode || 'hits', loopBars: opts.loopBars || 1, sampleBpm: opts.sampleBpm || null, pitch: opts.pitch || 0,
    pattern: { len: opts.len || 16, steps: opts.steps || new Array(opts.len || 16).fill(0), notes: opts.notes || [] },
    vol: opts.vol ?? 0.8, pan: opts.pan ?? 0, mute: false, solo: false,
    fx: { cutoff: 1, hp: 0, reso: 0.1, drive: 0, reverb: 0.08, delay: 0, duck: 0, ...(opts.fx || {}) },
  };
  if (t.pattern.steps.length < t.pattern.len) t.pattern.steps = t.pattern.steps.concat(new Array(t.pattern.len - t.pattern.steps.length).fill(0));
  return t;
}

export function newScene(name, bars, on = {}, fx = 'none') { return { id: uid(), name, bars, on, fx }; }

export function emptyProject(name = 'Mi track') {
  return { id: uid(), name, created: Date.now(), updated: Date.now(), bpm: 140, swing: 0, root: 9, mode: 'minor', master: 0.9, genre: 'techno', tracks: [], scenes: [newScene('Loop', 8)] };
}

// ---------- generadores ----------
export function genAcid(seed, len = 16) {
  const r = rng(seed); const notes = []; const degs = [0, 0, 0, 0, 2, 3, 4, 6, 7, -1, -3];
  for (let s = 0; s < len; s++) {
    if (r() < (s % 4 === 0 ? 0.85 : 0.6)) {
      const d = pick(r, degs) + (r() < 0.15 ? 7 : 0);
      const l = r() < 0.25 ? 2 : 1;
      notes.push({ s, d, len: l, vel: r() < 0.3 ? 1 : 0.65 });
      if (l === 2) s++;
    }
  }
  return notes;
}
export function genBass(seed, len = 16, style = 'offbeat') {
  const r = rng(seed); const notes = [];
  for (let s = 0; s < len; s++) {
    const pos = s % 4;
    let hit = style === 'offbeat' ? pos === 2 : style === 'rolling' ? pos !== 0 : style === 'gallop' ? pos === 2 || pos === 3 : r() < 0.4;
    if (hit) notes.push({ s, d: r() < 0.85 ? 0 : pick(r, [4, 7, -2]), len: 1, vel: pos === 2 ? 1 : 0.75 });
  }
  return notes;
}
export function genArp(seed, len = 16, chord = [0, 2, 4, 7]) {
  const r = rng(seed); const shape = pick(r, [[0, 1, 2, 3], [0, 2, 1, 3], [3, 2, 1, 0], [0, 1, 2, 1]]);
  return Array.from({ length: len }, (_, s) => ({ s, d: chord[shape[s % 4]] + (s % 8 >= 4 && r() < 0.5 ? 7 : 0), len: 1, vel: s % 4 === 0 ? 1 : 0.7 }));
}
export function genDrum(sound, seed, len = 16) {
  const r = rng(seed); const v = new Array(len).fill(0);
  const set = (i, x) => { if (i < len) v[i] = x; };
  for (let b = 0; b < len; b += 16) {
    if (/kick/.test(sound)) { [0, 4, 8, 12].forEach((i) => set(b + i, 1)); if (r() < 0.4) set(b + 14 + (r() < 0.5 ? 1 : 0), 0.55); }
    else if (sound === 'clap' || sound === 'snare') { set(b + 4, 1); set(b + 12, 1); if (r() < 0.4) set(b + 15, 0.55); }
    else if (sound === 'hatOpen') [2, 6, 10, 14].forEach((i) => set(b + i, 1));
    else if (sound === 'hat' || sound === 'shaker') for (let i = 0; i < 16; i++) set(b + i, i % 4 === 2 ? 1 : r() < 0.6 ? 0.55 : 0);
    else if (sound === 'ride') [2, 6, 10, 14].forEach((i) => set(b + i, i % 8 === 2 ? 1 : 0.55));
    else for (let i = 0; i < 16; i++) set(b + i, r() < 0.3 ? (r() < 0.5 ? 1 : 0.55) : 0);
  }
  return v;
}

// ---------- plantilla desde un estilo ----------
function fromPat(str, len) { const p = pat(str); return Array.from({ length: len }, (_, i) => p[i % 16] || 0); }

export function makeProject(genreKey, o = {}) {
  const G = GENRES[genreKey] || GENRES.techno;
  const r = rng(o.seed || (Math.random() * 1e9) | 0);
  const bpm = o.bpm || Math.round((G.bpm[0] + G.bpm[1]) / 2);
  const p = emptyProject(o.name || `${G.name} ${bpm}`);
  Object.assign(p, { bpm, genre: genreKey, root: o.root ?? (r() * 12) | 0, mode: o.mode || G.mode, swing: G.swing || 0, scenes: [] });
  const prog = o.prog || pick(r, G.progs[p.mode] || G.progs[G.mode]);
  const chordBars = G.chordBars || 1;
  const degAt = (bar) => prog[Math.floor(bar / chordBars) % prog.length];
  const bars = Math.max(1, Math.min(4, prog.length * chordBars));
  const L = 16 * (prog.every((d) => d === prog[0]) ? 1 : bars);
  const T = [];
  const dr = o.drums || null;

  // Batería
  const kickSound = G.hardKick ? 'hardkick' : 'kick';
  T.push(newTrack('drum', { name: G.hardKick ? 'Bombo duro' : 'Bombo', role: 'kick', sound: kickSound, steps: dr ? dr.kick.slice() : fromPat(pick(r, G.kick), 16), vol: 0.95 }));
  const sn = G.snareType === 'clap' ? 'clap' : G.snareType === 'rim' ? 'rim' : 'snare';
  T.push(newTrack('drum', { name: DRUMS[sn][0], role: 'snare', sound: sn, steps: dr ? dr.snare.slice() : fromPat(pick(r, G.snare), 16), vol: 0.75, fx: { reverb: 0.2 } }));
  T.push(newTrack('drum', { name: G.openHats ? 'Hat abierto' : 'Hi-hat', role: 'hat', sound: G.openHats ? 'hatOpen' : 'hat', steps: dr ? dr.hat.slice() : fromPat(pick(r, G.hat), 16), vol: 0.6, pan: 0.15 }));
  if (TECHNO.has(genreKey)) T.push(newTrack('drum', { name: 'Hat rodante', role: 'hat', sound: 'hat', steps: genDrum('hat', r() * 1e9, 16), vol: 0.45, pan: -0.2 }));
  (G.perc || []).forEach((pc, i) => {
    const snd = pc.type === 'conga' ? (i % 2 ? 'congaLo' : 'congaHi') : pc.type;
    T.push(newTrack('drum', { name: DRUMS[snd][0], role: 'perc', sound: snd, steps: fromPat(pc.pat, 16), vol: 0.55, pan: i % 2 ? 0.3 : -0.3, fx: { reverb: 0.15 } }));
  });
  if (genreKey === 'industrial') T.push(newTrack('drum', { name: 'Metálico', role: 'perc', sound: 'metal', steps: genDrum('metal', r() * 1e9, 16), vol: 0.5, fx: { delay: 0.25 } }));

  // Bajo
  const bt = G.bass.type; const bPreset = { '808': 'b808', sub: 'sub', rumble: 'rumble', reese: 'reese', synth: 'bass' }[bt] || 'bass';
  const bassNotes = [];
  for (let bar = 0; bar < L / 16; bar++) {
    const deg = degAt(bar);
    if (bt === '808') {
      const k = T[0].pattern.steps.slice(0, 16); const hits = []; k.forEach((v, i) => v && hits.push(i));
      hits.forEach((i, j) => bassNotes.push({ s: bar * 16 + i, d: deg, len: Math.min((hits[j + 1] ?? 16) - i, 8), vel: 1 }));
    } else {
      const s = [...G.bass.pat];
      for (let i = 0; i < 16; i++) {
        if (!'RFO3'.includes(s[i])) continue;
        let len = 1; while (i + len < 16 && s[i + len] === '-') len++;
        bassNotes.push({ s: bar * 16 + i, d: deg + ({ F: 4, O: 7, 3: 2 }[s[i]] || 0), len, vel: 1 });
      }
    }
  }
  T.push(newTrack('synth', { name: SYNTHS[bPreset].name, role: 'bass', preset: bPreset, len: L, notes: bassNotes, vol: 0.85 }));

  // Acordes / stabs / acid
  const ch = G.chords; const chType = ch.type === 'skank' ? 'stab' : ch.type === 'arp' ? 'piano' : ch.type === 'power' ? 'guitar' : ch.type;
  if (ch.type === 'acid') {
    T.push(newTrack('synth', { name: 'Acid 303', role: 'lead', preset: 'acid', len: 16, notes: genAcid(r() * 1e9), vol: 0.7, fx: { delay: 0.2, reso: 0.3 } }));
  } else if (SYNTHS[chType]) {
    const notes = [];
    for (let bar = 0; bar < L / 16; bar++) {
      const deg = degAt(bar); const s = [...ch.pat]; let ai = 0;
      for (let i = 0; i < 16; i++) {
        if (s[i] !== 'x') continue;
        let len = 1; while (i + len < 16 && s[i + len] === '-') len++;
        const tones = G.seventh ? [0, 2, 4, 6] : [0, 2, 4];
        if (ch.type === 'arp') notes.push({ s: bar * 16 + i, d: deg + tones[ai++ % tones.length], len: 2, vel: 0.9 });
        else tones.forEach((tn) => notes.push({ s: bar * 16 + i, d: deg + tn, len, vel: 0.9 }));
      }
    }
    T.push(newTrack('synth', { name: SYNTHS[chType].name, role: 'chords', preset: chType, len: L, notes, vol: 0.6, fx: { reverb: 0.3, duck: G.duck ? 0.5 : 0 } }));
  }
  if (ch.chorusType && SYNTHS[ch.chorusType]) {
    const notes = [];
    for (let bar = 0; bar < L / 16; bar++) [0, 2, 4].forEach((tn) => notes.push({ s: bar * 16, d: degAt(bar) + tn, len: 16, vel: 0.8 }));
    T.push(newTrack('synth', { name: SYNTHS[ch.chorusType].name, role: 'pad', preset: ch.chorusType, len: L, notes, vol: 0.5, fx: { reverb: 0.35, duck: 0.6 } }));
  }

  // Melodía / gancho
  if (G.lead && SYNTHS[G.lead] && ch.type !== 'acid') {
    let notes;
    if (G.lead === 'acid') notes = genAcid(r() * 1e9, 16);
    else {
      notes = []; let rel = pick(r, [0, 2, 4]);
      for (let s = 0; s < 32 && s < Math.max(L, 32); s++) {
        if (r() < (s % 4 === 0 ? 0.55 : s % 2 === 0 ? 0.3 : 0.1)) {
          rel = s % 8 === 0 ? pick(r, [0, 2, 4, 7]) : Math.max(-2, Math.min(9, rel + pick(r, [-2, -1, 1, 1, 2])));
          notes.push({ s, d: degAt(Math.floor(s / 16)) + rel, len: 1, vel: 0.85 });
        }
      }
      notes.forEach((n, i) => { n.len = Math.min((notes[i + 1] ? notes[i + 1].s : 32) - n.s, 4); });
    }
    T.push(newTrack('synth', { name: SYNTHS[G.lead].name, role: 'lead', preset: G.lead, len: G.lead === 'acid' ? 16 : 32, notes, vol: 0.55, fx: { delay: 0.25, reverb: 0.25, duck: G.duck ? 0.4 : 0 } }));
  }
  p.tracks = T;
  if (G.duck) T.forEach((t) => { if (t.role === 'bass') t.fx.duck = 0.7; });

  // Escenas (estructura)
  const ids = (roles) => Object.fromEntries(T.filter((t) => roles.includes(t.role)).map((t) => [t.id, true]));
  const ALL = ['kick', 'snare', 'hat', 'perc', 'bass', 'chords', 'lead', 'pad'];
  if (TECHNO.has(genreKey) || o.dj) {
    p.scenes = [
      newScene('Intro', 16, ids(['kick', 'hat']), 'fadein'),
      newScene('Groove', 16, ids(['kick', 'hat', 'perc', 'bass'])),
      newScene('Subida', 8, ids(['hat', 'perc', 'bass', 'snare', 'chords']), 'build'),
      newScene('Drop', 32, ids(['kick', 'snare', 'hat', 'perc', 'bass', 'chords', 'lead']), 'drop'),
      newScene('Break', 16, ids(['chords', 'pad', 'lead', 'perc']), 'break'),
      newScene('Subida 2', 8, ids(['hat', 'perc', 'snare', 'chords', 'lead']), 'build'),
      newScene('Drop 2', 32, ids(ALL), 'drop'),
      newScene('Outro', 16, ids(['kick', 'hat', 'perc']), 'fadeout'),
    ];
  } else {
    p.scenes = [
      newScene('Intro', 4, ids(['chords', 'hat', 'pad']), 'fadein'),
      newScene('Verso', 8, ids(['kick', 'snare', 'hat', 'perc', 'bass', 'chords'])),
      newScene('Coro', 8, ids(ALL), 'drop'),
      newScene('Verso 2', 8, ids(['kick', 'snare', 'hat', 'perc', 'bass', 'chords'])),
      newScene('Coro 2', 8, ids(ALL), 'drop'),
      newScene('Puente', 4, ids(['chords', 'lead', 'pad']), 'break'),
      newScene('Coro final', 8, ids(ALL), 'drop'),
      newScene('Outro', 4, ids(['chords', 'pad']), 'fadeout'),
    ];
  }
  return p;
}

export const projectBars = (p) => p.scenes.reduce((a, s) => a + s.bars, 0);
export const projectSeconds = (p) => (projectBars(p) * 4 * 60) / p.bpm;
export function touch(p) { p.updated = Date.now(); }
export function keyLabel(p, NOTE) { return `${NOTE[p.root]} ${p.mode === 'minor' ? 'menor' : 'mayor'} · ${CAMELOT[p.mode][p.root]}`; }
