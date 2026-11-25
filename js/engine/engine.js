import { Synth, renderOne, drumBank, makeReverb } from './synth.js';
// ===============================================================
//  Motor de beats — sintetiza baterías, bajos, acordes y melodías
//  100% original (sin samples de terceros) => libre de derechos.
// ===============================================================

export const NOTE_ES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
export const NOTE_EN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11] };

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const pat = (s) => [...s].map((c) => (c === 'x' ? 1 : c === 'o' ? 0.55 : c === 'g' ? 0.3 : 0));

// ---------------------------------------------------------------
//  Géneros. Patrones de 16 pasos (semicorcheas) por compás.
// ---------------------------------------------------------------
export const GENRES = {
  trap: {
    name: 'Trap', emoji: '🔥', bpm: [130, 150], mode: 'minor', swing: 0, spb: 12, chordBars: 1,
    kick: ['x.....x...x.....', 'x......x..x...x.', 'x.....xx.....x..', 'x.......x.x.....'],
    snare: ['........x.......'], snareType: 'clap',
    hat: ['x.x.x.x.x.x.x.x.', 'xxx.x.xxx.x.x.xx', 'x.xxx.x.x.xxx.x.'], hatRolls: true,
    bass: { type: '808' }, chords: { type: 'pad', pat: 'x---------------' }, lead: 'bell',
    progs: { minor: [[0, 5, 2, 6], [0, 3, 4, 0], [0, 6, 5, 6], [0, 0, 5, 6], [0, 5, 3, 4]], major: [[0, 4, 5, 3]] },
  },
  drill: {
    name: 'Drill', emoji: '🗡️', bpm: [138, 146], mode: 'minor', swing: 0, spb: 12, chordBars: 1,
    kick: ['x.........x.....', 'x......x...x....', 'x.......x..x....'],
    snare: ['........x.....x.', '........x.......'], snareType: 'snare',
    hat: ['x..x..x.x..x..x.', 'x..x..x...x..x..'], hatRolls: true,
    bass: { type: '808', glide: true }, chords: { type: 'piano', pat: 'x---------------' }, lead: 'bell',
    progs: { minor: [[0, 5, 6, 4], [0, 3, 5, 4], [0, 5, 0, 6]], major: [[5, 3, 4, 2]] },
  },
  reggaeton: {
    name: 'Reggaetón', emoji: '🍑', bpm: [88, 98], mode: 'minor', swing: 0, spb: 10, chordBars: 1,
    kick: ['x...x...x...x...'], snare: ['...x..x....x..x.', '...x..x....x..xx'], snareType: 'snare',
    hat: ['..x...x...x...x.', 'x.x.x.x.x.x.x.x.'],
    perc: [{ type: 'shaker', pat: 'xgogxgogxgogxgog', core: true }],
    bass: { type: 'sub', pat: 'R--R--R-R--R--R-' }, chords: { type: 'pluck', pat: 'x..x..x.x..x..x.' }, lead: 'pluck',
    progs: { minor: [[0, 5, 2, 6], [0, 6, 5, 6], [0, 3, 6, 5], [5, 6, 0, 0]], major: [[0, 4, 5, 3], [5, 3, 0, 4]] },
  },
  dembow: {
    name: 'Dembow', emoji: '🇩🇴', bpm: [114, 124], mode: 'minor', swing: 0, spb: 9, chordBars: 2,
    kick: ['x...x...x...x...'], snare: ['...x..x....x..x.', '..xx..x...xx..x.'], snareType: 'snare',
    hat: ['x.x.x.x.x.x.x.x.'], perc: [{ type: 'conga', pat: 'x..x..x..x..x.x.', core: true }],
    bass: { type: 'synth', pat: 'R...R...R...R...' }, chords: { type: 'stab', pat: 'x.......x.......' }, lead: 'bell',
    progs: { minor: [[0, 5, 6, 0], [0, 3, 4, 0]], major: [[0, 4, 5, 3]] },
  },
  hiphop: {
    name: 'Hip-Hop', emoji: '🎤', bpm: [84, 96], mode: 'minor', swing: 0.18, spb: 13, chordBars: 1, seventh: true,
    kick: ['x......x.x......', 'x.......x.x....x', 'x.x......xx.....'], snare: ['....x.......x...'], snareType: 'snare',
    hat: ['x.x.x.x.x.x.x.x.', 'x.xox.xox.xox.xo'],
    bass: { type: 'synth', pat: 'R.......R.R.....' }, chords: { type: 'piano', pat: 'x-------x-------' }, lead: 'rhodes',
    progs: { minor: [[0, 3, 0, 4], [0, 5, 3, 4], [1, 4, 0, 0]], major: [[1, 4, 0, 5]] },
  },
  lofi: {
    name: 'Lo-Fi', emoji: '☕', bpm: [70, 86], mode: 'minor', swing: 0.25, spb: 11, chordBars: 1, seventh: true, lofi: true,
    kick: ['x......x.x......', 'x.......x.......'], snare: ['....x.......x...'], snareType: 'rim',
    hat: ['x.x.x.x.x.x.x.x.', 'xgx.xgx.xgx.xgx.'],
    bass: { type: 'sub', pat: 'R-------F---R---' }, chords: { type: 'rhodes', pat: 'x-------x-------' }, lead: 'bell',
    progs: { minor: [[1, 4, 0, 5], [0, 3, 6, 2], [3, 4, 2, 5]], major: [[1, 4, 0, 5], [3, 2, 1, 0]] },
  },
  rnb: {
    name: 'R&B', emoji: '💜', bpm: [64, 80], mode: 'minor', swing: 0.12, spb: 9, chordBars: 1, seventh: true,
    kick: ['x......x..x.....', 'x.......xx......'], snare: ['....x.......x...'], snareType: 'clap',
    hat: ['xgxgxgxgxgxgxgxg'], hatRolls: true,
    bass: { type: 'sub', pat: 'R-----.R--R-----' }, chords: { type: 'rhodes', pat: 'x---------------' }, lead: 'bell',
    progs: { minor: [[0, 3, 6, 5], [3, 4, 0, 0], [0, 5, 3, 4]], major: [[3, 4, 2, 5], [0, 5, 1, 4]] },
  },
  pop: {
    name: 'Pop', emoji: '⭐', bpm: [100, 124], mode: 'major', swing: 0, spb: 9, chordBars: 1,
    kick: ['x...x...x...x...', 'x.......x.x.....'], snare: ['....x.......x...'], snareType: 'clap',
    hat: ['..x...x...x...x.', 'x.x.x.x.x.x.x.x.'],
    bass: { type: 'synth', pat: 'R.R.R.R.R.R.R.R.' }, chords: { type: 'pluck', pat: 'x..x..x.x..x..x.' }, lead: 'lead',
    progs: { major: [[0, 4, 5, 3], [5, 3, 0, 4], [0, 5, 3, 4], [3, 4, 0, 5]], minor: [[0, 5, 2, 6]] },
  },
  rock: {
    name: 'Rock', emoji: '🎸', bpm: [110, 150], mode: 'major', swing: 0, spb: 8, chordBars: 1,
    kick: ['x.......x.x.....', 'x.x.....x.x.....'], snare: ['....x.......x...'], snareType: 'snare',
    hat: ['x.x.x.x.x.x.x.x.'],
    bass: { type: 'rock', pat: 'R.R.R.R.R.R.R.R.' }, chords: { type: 'power', pat: 'x.x.x.x.x.x.x.x.' }, lead: 'guitar',
    progs: { major: [[0, 4, 5, 3], [0, 3, 4, 3], [0, 6, 3, 0]], minor: [[0, 5, 6, 0], [0, 3, 6, 5]] },
  },
  reggae: {
    name: 'Reggae', emoji: '🦁', bpm: [70, 84], mode: 'major', swing: 0.1, spb: 8, chordBars: 1,
    kick: ['........x.......'], snare: ['........x.......'], snareType: 'rim',
    hat: ['x.x.x.x.x.x.x.x.'],
    bass: { type: 'reggae', pat: 'R-..R.F-..3.R-..' }, chords: { type: 'skank', pat: '..x...x...x...x.' }, lead: 'organ',
    progs: { major: [[0, 3, 4, 3], [0, 4, 3, 4], [0, 5, 3, 4]], minor: [[0, 3, 0, 3], [0, 6, 5, 6]] },
  },
  dancehall: {
    name: 'Dancehall', emoji: '🇯🇲', bpm: [94, 106], mode: 'minor', swing: 0, spb: 10, chordBars: 1,
    kick: ['x..x..x.x..x..x.', 'x..x...xx..x....'], snare: ['....x.......x...', '...x..x....x..x.'], snareType: 'clap',
    hat: ['x.x.x.x.x.x.x.x.'], perc: [{ type: 'conga', pat: '..x...x...x.x.x.' }],
    bass: { type: 'sub', pat: 'R..R..R.R..R..R.' }, chords: { type: 'stab', pat: '..x...x...x...x.' }, lead: 'bell',
    progs: { minor: [[0, 5, 6, 0], [0, 3, 4, 0]], major: [[0, 4, 5, 3]] },
  },
  afrobeat: {
    name: 'Afrobeat', emoji: '🌍', bpm: [100, 114], mode: 'major', swing: 0.08, spb: 9, chordBars: 1,
    kick: ['x..x..x...x..x..', 'x...x...x...x...'], snare: ['...x..x....x..x.', '....x.......x...'], snareType: 'rim',
    hat: ['x.x.x.x.x.x.x.x.'],
    perc: [{ type: 'shaker', pat: 'xgogxgogxgogxgog', core: true }, { type: 'conga', pat: '..x..x.x..x..x.x' }],
    bass: { type: 'sub', pat: 'R.....R...R..R..' }, chords: { type: 'pluck', pat: 'x..x..x...x..x..' }, lead: 'marimba',
    progs: { major: [[0, 5, 3, 4], [0, 3, 4, 4], [1, 4, 0, 0]], minor: [[0, 6, 5, 6], [0, 3, 6, 5]] },
  },
  house: {
    name: 'House', emoji: '🪩', bpm: [120, 126], mode: 'minor', swing: 0.05, spb: 8, chordBars: 2, seventh: true, duck: true,
    kick: ['x...x...x...x...'], snare: ['....x.......x...'], snareType: 'clap',
    hat: ['..x...x...x...x.'], perc: [{ type: 'shaker', pat: 'gggggggggggggggg', core: true }],
    bass: { type: 'synth', pat: '..R...R...R...R.' }, chords: { type: 'stab', pat: 'x..x..x...x..x..' }, lead: 'pluck',
    progs: { minor: [[0, 5, 3, 4], [0, 3, 0, 6]], major: [[1, 4, 0, 5]] },
  },
  edm: {
    name: 'EDM', emoji: '⚡', bpm: [126, 130], mode: 'minor', swing: 0, spb: 8, chordBars: 1, duck: true, riser: true,
    kick: ['x...x...x...x...'], snare: ['....x.......x...'], snareType: 'clap',
    hat: ['..x...x...x...x.'],
    bass: { type: 'synth', pat: '..R...R...R...R.' },
    chords: { type: 'pluck', pat: 'x..x..x..x..x.x.', chorusType: 'supersaw', chorusPat: 'x---------------' }, lead: 'lead',
    progs: { minor: [[0, 5, 2, 6], [5, 6, 0, 0], [0, 6, 5, 3]], major: [[0, 4, 5, 3]] },
  },
  cumbia: {
    name: 'Cumbia', emoji: '🪗', bpm: [88, 104], mode: 'minor', swing: 0, spb: 9, chordBars: 1,
    kick: ['x.......x.......'], snare: ['....x.......x...'], snareType: 'rim', hat: ['................'],
    perc: [{ type: 'guiro', pat: 'x.xxx.xxx.xxx.xx', core: true }, { type: 'conga', pat: '..x.x...x.x..x..' }],
    bass: { type: 'cumbia', pat: 'R...F...R...F...' }, chords: { type: 'pluck', pat: '..x...x...x...x.' }, lead: 'accordion',
    progs: { minor: [[0, 3, 4, 0], [0, 4, 0, 4], [0, 6, 5, 4]], major: [[0, 3, 4, 0], [0, 4, 0, 4]] },
  },
  techno: {
    name: 'Techno', emoji: '🏭', bpm: [128, 138], mode: 'minor', swing: 0, spb: 8, chordBars: 2, duck: true, openHats: true, riser: true,
    kick: ['x...x...x...x...'], snare: ['....x.......x...', '................', '....x.......x..x'], snareType: 'clap',
    hat: ['..x...x...x...x.'], perc: [{ type: 'shaker', pat: 'xgxgxgxgxgxgxgxg', core: true }, { type: 'conga', pat: '...x......x..x..' }],
    bass: { type: 'synth', pat: '..RR..RR..RR..RR' }, chords: { type: 'stab', pat: '...x.....x....x.' }, lead: 'acid',
    progs: { minor: [[0, 0, 5, 6], [0, 0, 0, 6], [0, 3, 0, 4]], major: [[0, 0, 4, 3]] },
  },
  hardtechno: {
    name: 'Hard Techno', emoji: '⛓️', bpm: [148, 160], mode: 'minor', swing: 0, spb: 8, chordBars: 4, duck: true, openHats: true, hardKick: true, riser: true,
    kick: ['x...x...x...x...'], snare: ['....x.......x...', '................'], snareType: 'clap',
    hat: ['..x...x...x...x.', '..x.x.x...x.x.x.'], perc: [{ type: 'shaker', pat: 'xgxgxgxgxgxgxgxg', core: true }, { type: 'conga', pat: '...x..x....x..x.' }],
    bass: { type: 'rumble', pat: '..RR..RR..RR..RR' }, chords: { type: 'stab', pat: '..x.....x.....x.', chorusType: 'hoover', chorusPat: 'x-------x-------' }, lead: 'acid',
    progs: { minor: [[0, 0, 0, 5], [0, 0, 6, 6], [0, 0, 0, 0]], major: [[0, 0, 4, 4]] },
  },
  acidtechno: {
    name: 'Acid Techno', emoji: '🧪', bpm: [134, 142], mode: 'minor', swing: 0.04, spb: 8, chordBars: 4, duck: true, openHats: true,
    kick: ['x...x...x...x...'], snare: ['....x.......x...'], snareType: 'clap',
    hat: ['..x...x...x...x.'], perc: [{ type: 'shaker', pat: 'gxgxgxgxgxgxgxgx', core: true }],
    bass: { type: 'rumble', pat: '..R...R...R...R.' }, chords: { type: 'acid', pat: 'x.xx.x.xx.x.xx.x' }, lead: 'acid',
    progs: { minor: [[0, 0, 0, 0], [0, 0, 3, 3]], major: [[0, 0, 0, 0]] },
  },
  melodictechno: {
    name: 'Melodic Techno', emoji: '🌌', bpm: [122, 126], mode: 'minor', swing: 0, spb: 8, chordBars: 2, duck: true, seventh: true, riser: true,
    kick: ['x...x...x...x...'], snare: ['....x.......x...', '................'], snareType: 'clap',
    hat: ['..x...x...x...x.'], perc: [{ type: 'shaker', pat: 'gggggggggggggggg', core: true }],
    bass: { type: 'synth', pat: '..R.R.R...R.R.R.' }, chords: { type: 'pad', pat: 'x---------------', chorusType: 'supersaw', chorusPat: 'x---------------' }, lead: 'pluck',
    progs: { minor: [[0, 5, 2, 6], [0, 3, 5, 4], [5, 3, 0, 6]], major: [[0, 4, 5, 3]] },
  },
  industrial: {
    name: 'Industrial', emoji: '🏗️', bpm: [138, 148], mode: 'minor', swing: 0, spb: 8, chordBars: 4, duck: true, hardKick: true,
    kick: ['x...x...x...x...', 'x...x...x...x.x.'], snare: ['....x.......x...'], snareType: 'snare',
    hat: ['xxxxxxxxxxxxxxxx'], perc: [{ type: 'conga', pat: 'x..x..x...x..x..', core: true }],
    bass: { type: 'rumble', pat: '..R...R...R...R.' }, chords: { type: 'stab', pat: 'x.......x.......' }, lead: 'hoover',
    progs: { minor: [[0, 0, 1, 0], [0, 0, 0, 1]], major: [[0, 0, 0, 0]] },
  },
  hardgroove: {
    name: 'Hardgroove', emoji: '🥁', bpm: [140, 148], mode: 'minor', swing: 0.08, spb: 8, chordBars: 4, duck: true, openHats: true,
    kick: ['x...x...x...x...'], snare: ['....x.......x...', '...x....x..x....'], snareType: 'rim',
    hat: ['..x...x...x...x.'], perc: [{ type: 'shaker', pat: 'xgxxxgxxxgxxxgxx', core: true }, { type: 'conga', pat: '..x.x..x.x..x.x.', core: true }],
    bass: { type: 'synth', pat: '..R..RR...R..RR.' }, chords: { type: 'stab', pat: '...x......x.....' }, lead: 'organ',
    progs: { minor: [[0, 0, 3, 0], [0, 0, 0, 6]], major: [[0, 0, 3, 3]] },
  },
  technolatino: {
    name: 'Techno Latino', emoji: '🔥', bpm: [140, 150], mode: 'minor', swing: 0, spb: 9, chordBars: 2, duck: true, openHats: true, hardKick: true, riser: true,
    kick: ['x...x...x...x...'], snare: ['...x..x....x..x.'], snareType: 'rim',
    hat: ['..x...x...x...x.'], perc: [{ type: 'conga', pat: 'x..x..x...x..x..', core: true }, { type: 'shaker', pat: 'gxgxgxgxgxgxgxgx', core: true }],
    bass: { type: 'rumble', pat: '..RR..RR..RR..RR' }, chords: { type: 'stab', pat: 'x..x..x...x..x..', chorusType: 'hoover', chorusPat: 'x-------x-------' }, lead: 'lead',
    progs: { minor: [[0, 5, 6, 0], [0, 0, 5, 6], [0, 3, 4, 0]], major: [[0, 4, 5, 3]] },
  },
  rave: {
    name: 'Neo Rave', emoji: '💥', bpm: [145, 155], mode: 'minor', swing: 0, spb: 9, chordBars: 2, duck: true, hardKick: true, riser: true,
    kick: ['x.....x...x.....', 'x...x...x...x...'], snare: ['....x.......x...', '....x..x.x..x...'], snareType: 'snare',
    hat: ['x.x.x.x.x.x.x.x.'], perc: [{ type: 'shaker', pat: 'gggggggggggggggg', core: true }],
    bass: { type: 'reese', pat: 'R-------R---R---' }, chords: { type: 'hoover', pat: 'x-------x-------' }, lead: 'supersaw',
    progs: { minor: [[0, 5, 6, 4], [0, 6, 5, 6]], major: [[0, 4, 5, 3]] },
  },
  // Guaracha colombiana / aleteo (playlist "guarachasexo": 23 temas, todos a 130 BPM, casi todos en La menor)
  // promedio de los 23: palmas y percusión en LOS 4 TIEMPOS junto al bombo, bajo y hat en el contratiempo
  guaracha: {
    name: 'Guaracha', emoji: '🦜', bpm: [129, 131], mode: 'minor', root: 9, swing: 0, spb: 9, chordBars: 2, duck: true, openHats: true, riser: true, snareVol: 1, hatVol: 0.15, noRollHat: true,
    kick: ['x...x...x...x...'], snare: ['x...x...x...x...', 'x...x...x...x..x'], snareType: 'clap',
    hat: ['..x...x...x...x.'], perc: [{ type: 'conga', pat: '.x...xx..x.x.x..', core: true, vol: 0.4 }, { type: 'shaker', pat: 'gxgxgxgxgxgxgxgx', core: true, vol: 0.22 }],
    bass: { type: 'synth', pat: '..R...R...R...R.' }, chords: { type: 'stab', pat: 'x.......x.......', chorusType: 'lead', chorusPat: '..x.x...x.x.....' }, lead: 'lead',
    progs: { minor: [[0, 5, 6, 4], [0, 0, 5, 6], [0, 6, 5, 6]], major: [[0, 4, 5, 3]] },
  },
  // --- estilos de la playlist de differentgyal (54 temas analizados, casi todos 140-170 BPM) ---
  perreorave: { // Noro$t, PETERBLUE, Part Time Killer: el dembow (3-3-2) en el bajo sobre bombo 4x4 a ~155
    name: 'Perreo Rave', emoji: '🍑', bpm: [150, 158], mode: 'minor', swing: 0, spb: 9, chordBars: 2, duck: true, hardKick: true, riser: true,
    kick: ['x...x...x...x...'], snare: ['...x..x....x..x.', '...x..x....x..xx'], snareType: 'rim',
    hat: ['..x...x...x...x.', 'x.x.x.x.x.x.x.x.'], perc: [{ type: 'conga', pat: 'x..x..x.x..x..x.', core: true }, { type: 'shaker', pat: 'gxgxgxgxgxgxgxgx' }],
    bass: { type: 'sub', pat: 'R..R..R.R..R..R.' }, chords: { type: 'stab', pat: 'x..x..x...x..x..' }, lead: 'pluck',
    progs: { minor: [[0, 5, 6, 0], [0, 0, 5, 6], [0, 3, 4, 0]], major: [[0, 4, 5, 3]] },
  },
  makineo: { // Galactxtx, CRRDR, Cera Khin: bajo rodante en cada 16avo libre, ~162
    name: 'Makineo', emoji: '⚙️', bpm: [158, 166], mode: 'minor', swing: 0, spb: 9, chordBars: 2, duck: true, hardKick: true, openHats: true, riser: true,
    kick: ['x...x...x...x...'], snare: ['....x.......x...', '....x.......x.x.'], snareType: 'clap',
    hat: ['..x...x...x...x.'], perc: [{ type: 'shaker', pat: 'xgxgxgxgxgxgxgxg', core: true }],
    bass: { type: 'rumble', pat: '.RRR.RRR.RRR.RRR' }, chords: { type: 'hoover', pat: 'x-------x-------', chorusType: 'supersaw', chorusPat: 'x---x---x---x---' }, lead: 'supersaw',
    progs: { minor: [[0, 5, 6, 4], [0, 6, 5, 6], [0, 0, 5, 6]], major: [[0, 4, 5, 3]] },
  },
  hardhouse: { // Funk Tribu, IOSIO, Noise Mafia: bajo saltando de octava en el contratiempo, ~152
    name: 'Hard House', emoji: '🪩', bpm: [148, 155], mode: 'minor', swing: 0, spb: 8, chordBars: 2, duck: true, hardKick: true, openHats: true,
    kick: ['x...x...x...x...'], snare: ['....x.......x...'], snareType: 'clap',
    hat: ['..x...x...x...x.'], perc: [{ type: 'shaker', pat: 'gxgggxgggxgggxgg', core: true }],
    bass: { type: 'synth', pat: '..RO..RO..RO..RO' }, chords: { type: 'stab', pat: '..x...x...x..x..', chorusType: 'hoover', chorusPat: 'x-------x-------' }, lead: 'organ',
    progs: { minor: [[0, 0, 5, 6], [0, 3, 0, 4], [0, 0, 3, 3]], major: [[0, 0, 4, 4]] },
  },
  funkbr: { // SEQUENCIA DA XOTA, LUPA NA CARA, MUEVE ESE CULO: tamborzão + sub y melodía de campana
    name: 'Funk Brasil', emoji: '🇧🇷', bpm: [135, 150], mode: 'minor', swing: 0, spb: 9, chordBars: 2, duck: true,
    kick: ['x..x..x...x..x..', 'x..x..x.x..x..x.'], snare: ['....x..x....x...', '....x.......x..x'], snareType: 'clap',
    hat: ['................', '..x...x...x...x.'], perc: [{ type: 'conga', pat: 'x.x..x.x..x.x..x', core: true }],
    bass: { type: 'sub', pat: 'R..R..R...R..R..' }, chords: { type: 'pluck', pat: 'x..x..x...x..x..' }, lead: 'bell',
    progs: { minor: [[0, 0, 5, 5], [0, 6, 5, 6], [0, 0, 3, 4]], major: [[0, 4, 5, 4]] },
  },
  ukbass: { // Ned Bennett, Yasmin Regisford: bombo con saltos, palmas en 2 y 4 y bajo reese, ~145
    name: 'UK Bass', emoji: '🇬🇧', bpm: [138, 150], mode: 'minor', swing: 0.1, spb: 8, chordBars: 2, duck: true, openHats: true,
    kick: ['x...x...x...x...', 'x.....x.x...x...'], snare: ['....x.......x...'], snareType: 'clap',
    hat: ['..x...x...x...x.'], perc: [{ type: 'shaker', pat: 'xgxxxgxxxgxxxgxx', core: true }],
    bass: { type: 'reese', pat: 'R.R...R...R.R...' }, chords: { type: 'stab', pat: 'x..x......x.....' }, lead: 'organ',
    progs: { minor: [[0, 0, 5, 6], [0, 3, 0, 6]], major: [[0, 4, 0, 4]] },
  },
  balada: {
    name: 'Balada', emoji: '🌹', bpm: [64, 80], mode: 'major', swing: 0, spb: 8, chordBars: 1,
    kick: ['x.......x.......'], snare: ['....x.......x...'], snareType: 'snare', hat: ['xgxgxgxgxgxgxgxg'],
    bass: { type: 'sub', pat: 'R-------R-------' }, chords: { type: 'arp', pat: 'x.x.x.x.x.x.x.x.' }, lead: 'strings',
    progs: { major: [[0, 4, 5, 3], [0, 5, 3, 4], [3, 4, 2, 5]], minor: [[0, 5, 3, 4], [0, 6, 5, 4]] },
  },
};
export const GENRE_KEYS = Object.keys(GENRES);

// ---------------------------------------------------------------
//  Teoría musical
// ---------------------------------------------------------------
export const degSemi = (scale, d) => scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
function chordMidis(song, deg, seventh) {
  const sc = SCALES[song.mode];
  const base = 48 + song.root;
  const degs = seventh ? [deg, deg + 2, deg + 4, deg + 6] : [deg, deg + 2, deg + 4];
  return degs.map((d) => { let n = base + degSemi(sc, d); while (n < 52) n += 12; while (n >= 72) n -= 12; return n; }).sort((a, b) => a - b);
}
const lowNote = (pc, base) => base + ((pc - 4 + 12) % 12); // rango Mi..Re#

// ---------------------------------------------------------------
//  Renderizador offline
// ---------------------------------------------------------------
export const SR = 44100;

export function chordDegAt(song, bar) {
  const g = GENRES[song.genre];
  return song.prog[Math.floor(bar / (g.chordBars || 1)) % song.prog.length];
}

export function songLength(song) {
  const barDur = (60 / song.bpm) * 4;
  return song.sections.reduce((a, s) => a + s.bars, 0) * barDur;
}

export async function renderSong(song, opts = {}) {
  const barDur = (60 / song.bpm) * 4;
  const totalBars = song.sections.reduce((a, s) => a + s.bars, 0);
  let dur = totalBars * barDur + 2.5;
  if (opts.voice) dur = Math.max(dur, (opts.voiceOffset || 0) + opts.voice.duration + 2);
  const ctx = new OfflineAudioContext(2, Math.ceil(dur * SR), SR);
  const R = new Renderer(ctx, song, opts, totalBars * barDur);
  await R.buildBank();
  R.schedule();
  // Programar compás a compás: el navegador procesa todos los nodos
  // conectados en cada instante, así que solo creamos los del compás
  // que está por sonar (render ~50x más rápido en canciones largas).
  const quantum = 128 / SR;
  for (const job of R.jobs.sort((a, b) => a.t - b.t)) {
    const at = Math.floor((job.t - 0.25) / quantum) * quantum;
    if (at <= 0) { await job.fn(); continue; }
    ctx.suspend(at).then(() => job.fn()).then(() => ctx.resume());
  }
  const out = await ctx.startRendering();
  // normalizar para evitar saturación
  let pk = 0;
  for (let c = 0; c < out.numberOfChannels; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) { const v = d[i] < 0 ? -d[i] : d[i]; if (v > pk) pk = v; } }
  if (pk > 0.0001) { const k = 0.95 / pk; for (let c = 0; c < out.numberOfChannels; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= k; } }
  return out;
}

class Renderer extends Synth {
  constructor(ctx, song, opts, beatEnd) {
    super(ctx);
    this.song = song; this.opts = opts; this.g = GENRES[song.genre];
    this.pending = []; this.cache = new Map();
    this.r = rng(song.seed * 7 + 3);
    this.beatEnd = beatEnd;
    this.jobs = [];
    this.step = 60 / song.bpm / 4;
    this.samples = (song.kit && song.kit.samples) || {};

    // Buses
    const master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.15;
    master.connect(comp).connect(ctx.destination);
    this.master = master;

    this.beat = ctx.createGain(); this.beat.gain.value = opts.voice ? 0.72 : 1; this.beat.connect(master);
    this.drums = ctx.createGain(); this.drums.gain.value = 0.9; this.drums.connect(this.beat);
    this.duck = ctx.createGain(); this.duck.connect(this.beat);
    this.musicFilter = ctx.createBiquadFilter(); this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = this.g.lofi ? 3200 : 18000;
    this.musicFilter.connect(this.duck);
    this.music = ctx.createGain(); this.music.gain.value = 0.8; this.music.connect(this.musicFilter);

    this.verb = makeReverb(ctx, 0.9);
    const vg = ctx.createGain(); vg.gain.value = 0.35; this.verb.out.connect(vg).connect(this.beat);
    this.verbSend = ctx.createGain(); this.verbSend.gain.value = 1; this.verbSend.connect(this.verb);
    this.o = { drums: this.drums, music: this.music, bass: this.duck, verb: this.verbSend };
  }

  // Reverb algorítmica (filtros comb en paralelo): mucho más ligera que la convolución
  combReverb() {
    const c = this.ctx; const input = c.createGain(); const merger = c.createChannelMerger(2); const out = c.createGain();
    const pre = c.createBiquadFilter(); pre.type = 'highpass'; pre.frequency.value = 250; input.connect(pre);
    [[0.0297, 0.0371, 0.0411, 0.0437], [0.0313, 0.0353, 0.0429, 0.0461]].forEach((times, ch) => {
      const sum = c.createGain(); sum.gain.value = 0.25;
      times.forEach((dt) => {
        const d = c.createDelay(0.2); d.delayTime.value = dt * 1.6;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3500;
        const fb = c.createGain(); fb.gain.value = 0.8;
        pre.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(sum);
      });
      sum.connect(merger, 0, ch);
    });
    merger.connect(out);
    input.out = out;
    return input;
  }
  impulse(sec) {
    const len = Math.floor(SR * sec); const b = this.ctx.createBuffer(2, len, SR);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    return b;
  }

  sample(name, t, v) {
    const s = this.ctx.createBufferSource(); s.buffer = this.samples[name];
    const g = this.gain(v * 0.95); s.connect(g).connect(this.drums); s.start(t);
  }

  // ---------- banco de sonidos (cada golpe se sintetiza una sola vez) ----------
  async buildBank() { this.bank = await drumBank(); }
  playBuf(buf, t, v, out, send = 0) {
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const g = this.gain(v); s.connect(g).connect(out);
    if (send) { const sg = this.gain(send); g.connect(sg).connect(this.verbSend); }
    s.start(Math.max(0, t - 0.003));
  }
  kick(t, v) {
    if (this.g.duck) { const p = this.duck.gain; p.setValueAtTime(0.45, t); p.linearRampToValueAtTime(1, t + 0.22); }
    if (this.samples.kick) return this.sample('kick', t, v);
    this.playBuf(this.bank[this.g.hardKick ? 'hardkick' : 'kick'], t, v, this.drums);
  }
  snare(t, v) {
    if (this.samples.snare) return this.sample('snare', t, v);
    const type = this.song.snareType || this.g.snareType;
    this.playBuf(this.bank[type === 'clap' ? 'clap' : type === 'rim' ? 'rim' : 'snare'], t, v, this.drums, 0.6);
  }
  hat(t, v, open = false) {
    if (this.samples.hat && !open) return this.sample('hat', t, v);
    this.playBuf(this.bank[open ? 'hatOpen' : this.r() < 0.5 ? 'hat' : 'hat2'], t, v, this.drums);
  }
  shaker(t, v) { this.playBuf(this.bank.shaker, t, v, this.drums); }
  guiro(t, v) { this.playBuf(this.bank.guiro, t, v, this.drums); }
  conga(t, v, hi) { this.playBuf(this.bank[hi ? 'congaHi' : 'congaLo'], t, v, this.drums); }
  crash(t) { this.playBuf(this.bank.crash, t, 1, this.drums, 0.6); }

  // ---------- notas: se sintetizan una vez por (tipo, nota, duración) ----------
  voice(type, t, midi, dur, v, out = this.music) {
    const d = Math.round(dur * 50) / 50;
    this.pending.push({ key: `v|${type}|${midi}|${d}`, len: d + 2.6, fn: (r) => r._voice(type, 0.003, midi, d, 1), t, v, out, send: this.verbSendFor(type) });
  }
  bass(type, t, midi, dur, v, glideTo) {
    const d = Math.round(dur * 50) / 50;
    this.pending.push({ key: `b|${type}|${midi}|${d}|${glideTo || 0}`, len: d + 0.6, fn: (r) => r._bass(type, 0.003, midi, d, 1, glideTo), t, v, out: this.duck });
  }
  async flush() {
    const list = this.pending; this.pending = [];
    list.forEach((p) => { if (!this.cache.has(p.key)) this.cache.set(p.key, renderOne(p.len, p.fn)); });
    for (const p of list) {
      const buf = await this.cache.get(p.key);
      const s = this.ctx.createBufferSource(); s.buffer = buf;
      const g = this.gain(p.v); s.connect(g).connect(p.out);
      if (p.send) g.connect(p.send);
      s.start(Math.max(0, p.t - 0.003));
    }
  }

  riser(t, len) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; s.start(t); s.stop(t + len);
    const f = this.filt('bandpass', 400, 2); f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(9000, t + len);
    const g = this.gain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + len);
    s.connect(f).connect(g).connect(this.beat);
  }

  verbSendFor(type) {
    if (!this._sends) this._sends = {};
    if (!this._sends[type]) {
      const amt = { pad: 0.5, strings: 0.6, bell: 0.5, marimba: 0.3, pluck: 0.35, piano: 0.35, arp: 0.45, rhodes: 0.3, lead: 0.3, organ: 0.2 }[type] ?? 0.15;
      const g = this.gain(amt); g.connect(this.verbSend); this._sends[type] = g;
    }
    return this._sends[type];
  }
  // ---------- secuenciación ----------
  stepTime(barStart, i) {
    const sw = this.song.swing ?? this.g.swing ?? 0;
    return barStart + i * this.step + (i % 2 ? sw * this.step : 0);
  }

  schedule() {
    const { song, g } = this; const r = this.r;
    const barDur = this.step * 16;
    const prog = song.prog;
    const drums = song.drums;
    const motif = makeMotif(rng(song.seed + 99), g);
    let bar = 0;

    if (g.lofi) this.vinyl(this.beatEnd);

    song.sections.forEach((sec, si) => {
      const type = sec.type;
      const isLast = si === song.sections.length - 1;
      const next = song.sections[si + 1];
      for (let b = 0; b < sec.bars; b++, bar++) {
        const barN = bar;
        const t0 = barN * barDur;
        this.jobs.push({ t: t0, fn: () => {
        const chordIdx = Math.floor(barN / (g.chordBars || 1)) % prog.length;
        const deg = prog[chordIdx];
        const nextDeg = prog[Math.floor((barN + 1) / (g.chordBars || 1)) % prog.length];
        if (g.lofi) this.vinylClicks(t0, t0 + barDur);
        const lastBarOfSec = b === sec.bars - 1;

        const on = {
          kick: type === 'verse' || type === 'chorus' || (type === 'bridge' && b >= sec.bars - 2),
          snare: type === 'verse' || type === 'chorus',
          hat: type !== 'intro' || b >= sec.bars - 2 || sec.bars <= 2,
          bass: type === 'verse' || type === 'chorus' || type === 'bridge',
          chords: true,
          lead: type === 'chorus' || (type === 'bridge' && b % 2 === 1),
        };
        if (type === 'outro') { on.hat = b < sec.bars - 1; }

        if (type === 'intro' && b === 0) {
          const f = this.musicFilter.frequency;
          f.setValueAtTime(500, t0); f.exponentialRampToValueAtTime(g.lofi ? 3200 : 18000, t0 + sec.bars * barDur);
        }
        if (type === 'chorus' && b === 0) this.crash(t0);
        if (g.riser && lastBarOfSec && next && next.type === 'chorus') this.riser(t0, barDur);

        // --- batería ---
        for (let i = 0; i < 16; i++) {
          const t = this.stepTime(t0, i);
          const hv = (v) => v * (0.85 + 0.15 * r());
          const fill = lastBarOfSec && next && next.type !== 'outro' && i >= 12 && (type === 'verse' || type === 'chorus');
          if (on.kick && drums.kick[i]) this.kick(t, hv(drums.kick[i]));
          if (on.snare && drums.snare[i]) this.snare(t, hv(drums.snare[i]));
          if (fill && !drums.snare[i] && (i % 2 === 0 || r() < 0.5)) this.snare(t, 0.25 + (i - 12) * 0.12);
          if (on.hat && drums.hat[i]) {
            if (g.hatRolls && r() < 0.14 && (type === 'verse' || type === 'chorus')) {
              const n = pick(r, [2, 3, 4]);
              for (let k = 0; k < n; k++) this.hat(t + (k * this.step) / n, hv(0.55 + 0.1 * k));
            } else this.hat(t, hv(drums.hat[i]), !!g.openHats);
          }
          if (type === 'chorus' && i === 14 && !g.hatRolls && r() < 0.5) this.hat(t, 0.6, true);
          (g.perc || []).forEach((p, pi) => {
            const pv = pat(p.pat)[i];
            if (!pv) return;
            if (!(p.core ? type !== 'intro' && type !== 'outro' : type === 'chorus')) return;
            if (p.type === 'shaker') this.shaker(t, hv(pv));
            else if (p.type === 'guiro') this.guiro(t, hv(pv));
            else this.conga(t, hv(pv), (i + pi) % 3 === 0);
          });
        }

        // --- bajo ---
        if (on.bass) this.bassBar(t0, deg, nextDeg, drums);

        // --- acordes ---
        if (on.chords) {
          const ch = g.chords;
          const ctype = type === 'chorus' && ch.chorusType ? ch.chorusType : ch.type;
          const cpat = type === 'chorus' && ch.chorusPat ? ch.chorusPat : ch.pat;
          const notes = ctype === 'power' ? powerChord(song, deg) : chordMidis(song, deg, g.seventh);
          const cv = type === 'intro' || type === 'outro' ? 0.8 : type === 'verse' ? 0.85 : 1;
          let arpI = 0;
          eachHit(cpat, (i, len) => {
            const t = this.stepTime(t0, i); const d = len * this.step;
            if (ctype === 'arp') { this.voice('arp', t, notes[arpI++ % notes.length] + (arpI > notes.length ? 12 : 0), d * 2, cv); }
            else notes.forEach((n) => this.voice(ctype, t, n, d * 0.95, cv));
          });
        }

        // --- melodía (gancho) ---
        if (on.lead && g.lead) {
          const half = (barN % 2) * 16;
          motif.forEach((m) => {
            if (m.step < half || m.step >= half + 16) return;
            const i = m.step - half;
            const midi = leadMidi(song, deg + m.rel);
            this.voice(g.lead, this.stepTime(t0, i), midi, m.len * this.step, 0.9, this.music);
          });
        }
        return this.flush();
        } });
      }
    });

    // fade out final
    const fadeStart = Math.max(0, this.beatEnd - barDur * 2);
    this.beat.gain.setValueAtTime(this.beat.gain.value, fadeStart);
    this.beat.gain.linearRampToValueAtTime(0.0001, this.beatEnd + 1.5);

    // voz
    if (this.opts.voice) this.addVoice(this.opts.voice, this.opts.voiceOffset || 0, this.opts.voiceGain ?? 1);
  }

  bassBar(t0, deg, nextDeg, drums) {
    const { song, g } = this; const sc = SCALES[song.mode];
    const rootPc = (song.root + degSemi(sc, deg)) % 12;
    if (g.bass.type === '808') {
      const hits = []; drums.kick.forEach((v, i) => v && hits.push(i));
      if (!hits.length) hits.push(0);
      const note = lowNote(rootPc, 28);
      const nextNote = lowNote((song.root + degSemi(sc, nextDeg)) % 12, 28);
      hits.forEach((i, k) => {
        const end = k < hits.length - 1 ? hits[k + 1] : 16;
        const len = Math.min(end - i, 10);
        const glide = (g.bass.glide || this.r() < 0.25) && k === hits.length - 1 && nextNote !== note ? nextNote : null;
        this.bass('808', this.stepTime(t0, i), note, len * this.step, 1, glide);
      });
      return;
    }
    const root = lowNote(rootPc, 28 + 12 * (['sub', 'rumble', 'reese'].includes(g.bass.type) ? 0 : 1));
    const fifth = root + 7, oct = root + 12, third = root + (degSemi(sc, deg + 2) - degSemi(sc, deg));
    eachHit(g.bass.pat, (i, len, ch) => {
      const m = ch === 'F' ? fifth : ch === 'O' ? oct : ch === '3' ? third : root;
      this.bass(g.bass.type, this.stepTime(t0, i), m, len * this.step * 0.95, 0.95);
    }, 'RFO3');
  }

  vinyl(end) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; s.start(0); s.stop(end);
    const g = this.gain(0.012); s.connect(this.filt('bandpass', 3000, 0.5)).connect(g).connect(this.beat);
  }
  vinylClicks(from, to) {
    for (let t = from + Math.random() * 0.3; t < to; t += 0.15 + Math.random() * 0.6) {
      const cg = this.gain(); this.env(cg.gain, t, 0.0005, 0.08 * Math.random(), 0, 0.004);
      this.noiseSrc(t, 0.01).connect(this.filt('highpass', 2000)).connect(cg).connect(this.beat);
    }
  }

  addVoice(buf, offset, level) {
    const c = this.ctx; const s = c.createBufferSource(); s.buffer = buf;
    const hp = this.filt('highpass', 90);
    const pres = c.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 3500; pres.gain.value = 3;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -24; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.12;
    const g = this.gain(1.5 * level);
    s.connect(hp).connect(pres).connect(comp).connect(g).connect(this.master);
    const vs = this.gain(this.opts.voiceSpace ?? 0.18); g.connect(vs).connect(this.verb);
    if (offset >= 0) s.start(offset); else s.start(0, -offset);
  }
}

function eachHit(p, fn, hitChars = 'x') {
  const s = [...p];
  for (let i = 0; i < 16; i++) {
    if (!hitChars.includes(s[i])) continue;
    let len = 1; while (i + len < 16 && s[i + len] === '-') len++;
    fn(i, len, s[i]);
  }
}
function powerChord(song, deg) {
  const r = 40 + ((song.root + degSemi(SCALES[song.mode], deg)) % 12);
  return [r, r + 7, r + 12];
}
function leadMidi(song, d) {
  const base = 60 + song.root - (song.root > 6 ? 12 : 0);
  return base + degSemi(SCALES[song.mode], d);
}
function makeMotif(r, g) {
  const slow = g.bpm[1] <= 90;
  const density = slow ? 0.9 : 0.7;
  const out = []; let rel = pick(r, [0, 2, 4]);
  for (let s = 0; s < 32; s++) {
    const prob = (s % 4 === 0 ? 0.6 : s % 2 === 0 ? 0.35 : 0.12) * density;
    if (r() < prob) {
      if (s % 8 === 0) rel = pick(r, [0, 2, 4, 7]);
      else rel = Math.max(-2, Math.min(9, rel + pick(r, [-2, -1, -1, 1, 1, 2, 0])));
      out.push({ step: s, rel, len: 1 });
    }
  }
  for (let i = 0; i < out.length; i++) {
    const nxt = i < out.length - 1 ? out[i + 1].step : 32;
    out[i].len = Math.min(nxt - out[i].step, slow ? 6 : 4);
  }
  return out;
}
