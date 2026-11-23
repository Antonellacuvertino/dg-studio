// ===============================================================
//  Biblioteca de loops (patrones listos). Son "recetas": se adaptan
//  solas al BPM y a la tonalidad del proyecto.
// ===============================================================
import { pat } from '../engine/engine.js';
import { newTrack, genAcid, genArp } from './model.js';

const P = (s, len = 16) => { const p = pat(s); return Array.from({ length: len }, (_, i) => p[i % p.length] || 0); };
const N = (list) => list.map(([s, d, len = 1, vel = 1]) => ({ s, d, len, vel }));

export const LOOP_CATS = [
  { id: 'kick', name: 'Bombos', emoji: '🦵' },
  { id: 'bass', name: 'Rumble y bajos', emoji: '🔊' },
  { id: 'hat', name: 'Hi-hats', emoji: '🎩' },
  { id: 'perc', name: 'Percusión', emoji: '🪘' },
  { id: 'snare', name: 'Claps y cajas', emoji: '👏' },
  { id: 'acid', name: 'Acid 303', emoji: '🧪' },
  { id: 'synth', name: 'Stabs y leads', emoji: '🎹' },
  { id: 'pad', name: 'Pads y atmósferas', emoji: '🌫️' },
  { id: 'fx', name: 'FX', emoji: '💫' },
  { id: 'latin', name: 'Latino / urbano', emoji: '🔥' },
];

const D = (id, cat, name, sound, steps, o = {}) => ({ id, cat, name, tags: o.tags || [], make: () => newTrack('drum', { name, role: o.role || cat, sound, steps: P(steps, o.len || 16), vol: o.vol ?? 0.75, pan: o.pan || 0, fx: o.fx }) });
const S = (id, cat, name, preset, notes, o = {}) => ({ id, cat, name, tags: o.tags || [], make: () => newTrack('synth', { name, role: o.role || (cat === 'bass' ? 'bass' : cat === 'pad' ? 'pad' : 'lead'), preset, len: o.len || 16, notes: typeof notes === 'function' ? notes() : N(notes), vol: o.vol ?? 0.65, fx: o.fx }) });

export const LOOPS = [
  // Bombos
  D('k-4x4', 'kick', 'Bombo 4x4', 'kick', 'x...x...x...x...', { tags: ['techno', 'house'], vol: 0.95 }),
  D('k-hard', 'kick', 'Bombo duro 4x4', 'hardkick', 'x...x...x...x...', { tags: ['hard techno'], vol: 0.95 }),
  D('k-hard-push', 'kick', 'Bombo duro con empuje', 'hardkick', 'x...x...x...x.x.', { tags: ['hard techno'], vol: 0.95 }),
  D('k-broken', 'kick', 'Bombo quebrado (rave)', 'hardkick', 'x.....x...x.....', { tags: ['rave'], vol: 0.95 }),
  D('k-dembow', 'kick', 'Bombo reggaetón', 'kick', 'x...x...x...x...', { tags: ['reggaetón'], vol: 0.9 }),
  D('k-trap', 'kick', 'Bombo trap', 'kick', 'x.....x...x.....', { tags: ['trap'], vol: 0.9 }),
  // Rumble / bajos
  S('b-rumble-off', 'bass', 'Rumble a contratiempo', 'rumble', [[2, 0], [6, 0], [10, 0], [14, 0]], { tags: ['techno'], fx: { duck: 0.7 } }),
  S('b-rumble-roll', 'bass', 'Rumble rodante', 'rumble', [[2, 0], [3, 0], [6, 0], [7, 0], [10, 0], [11, 0], [14, 0], [15, 0]], { tags: ['hard techno'], fx: { duck: 0.7 } }),
  S('b-rumble-gallop', 'bass', 'Rumble galope', 'rumble', [[1, 0], [2, 0], [5, 0], [6, 0], [9, 0], [10, 0], [13, 0], [14, 0]], { tags: ['hard techno'], fx: { duck: 0.7 } }),
  S('b-synth-off', 'bass', 'Bajo synth offbeat', 'bass', [[2, 0], [6, 0], [10, 0], [14, 0]], { tags: ['house', 'techno'], fx: { duck: 0.5 } }),
  S('b-reese', 'bass', 'Reese oscuro', 'reese', [[0, 0, 8], [8, 0, 4], [12, -1, 4]], { tags: ['rave', 'dnb'] }),
  S('b-hypno', 'bass', 'Bajo hipnótico', 'bass', [[0, 0], [3, 0], [6, 0], [8, 3], [11, 0], [14, -1]], { tags: ['techno'] }),
  S('b-808', 'bass', '808 trap', 'b808', [[0, 0, 6], [6, 0, 4], [10, -2, 6]], { tags: ['trap'] }),
  // Hats
  D('h-open-off', 'hat', 'Hat abierto offbeat', 'hatOpen', '..x...x...x...x.', { tags: ['techno'], vol: 0.6 }),
  D('h-16', 'hat', 'Hats 16avos', 'hat', 'xgxgxgxgxgxgxgxg', { tags: ['techno'], vol: 0.5 }),
  D('h-gallop', 'hat', 'Hats galope', 'hat', 'xx.xxx.xxx.xxx.x', { tags: ['hard techno'], vol: 0.45 }),
  D('h-ride', 'hat', 'Ride techno', 'ride', '..x...x...x...x.', { tags: ['techno'], vol: 0.5 }),
  D('h-trap', 'hat', 'Hats trap', 'hat', 'x.x.x.x.x.xxx.x.', { tags: ['trap'], vol: 0.5 }),
  // Percusión
  D('p-tribal', 'perc', 'Congas tribales', 'congaHi', '..x.x..x.x..x.x.', { tags: ['hardgroove'], pan: -0.3, fx: { reverb: 0.2 } }),
  D('p-tribal-lo', 'perc', 'Conga grave tribal', 'congaLo', 'x..x...x..x.....', { tags: ['hardgroove'], pan: 0.3 }),
  D('p-shaker', 'perc', 'Shaker', 'shaker', 'xgxgxgxgxgxgxgxg', { tags: ['techno'], vol: 0.55 }),
  D('p-metal', 'perc', 'Percusión metálica', 'metal', '...x..x....x..x.', { tags: ['industrial'], fx: { delay: 0.3 } }),
  D('p-toms', 'perc', 'Toms groove', 'tomLo', 'x.....x...x...x.', { tags: ['hardgroove'], fx: { reverb: 0.25 } }),
  D('p-rim-dem', 'perc', 'Aro dembow', 'rim', '...x..x....x..x.', { tags: ['latino'] }),
  // Claps / cajas
  D('c-clap', 'snare', 'Clap 2 y 4', 'clap', '....x.......x...', { tags: ['techno'], fx: { reverb: 0.25 } }),
  D('c-clap-off', 'snare', 'Clap sincopado', 'clap', '....x.......x..x', { tags: ['techno'], fx: { reverb: 0.25 } }),
  D('c-snare-rave', 'snare', 'Caja rave', 'snare', '....x..x.x..x...', { tags: ['rave'] }),
  D('c-trap', 'snare', 'Clap trap (medio tiempo)', 'clap', '........x.......', { tags: ['trap'] }),
  // Acid
  ...[11, 23, 37, 58, 71, 94].map((seed, i) => S(`a-acid-${i}`, 'acid', `Línea acid #${i + 1}`, 'acid', () => genAcid(seed), { tags: ['acid'], fx: { delay: 0.2, reso: 0.3 } })),
  // Stabs / leads
  S('s-stab-dub', 'synth', 'Stab dub', 'stab', [[3, 0], [3, 2], [3, 4], [10, 0], [10, 2], [10, 4]], { tags: ['techno'], fx: { delay: 0.35, reverb: 0.3, duck: 0.4 } }),
  S('s-hoover', 'synth', 'Hoover rave', 'hoover', [[0, 0, 6], [8, 0, 4], [12, 1, 4]], { tags: ['rave', 'hard techno'], fx: { reverb: 0.25, duck: 0.5 } }),
  S('s-arp', 'synth', 'Arpegio melódico', 'pluck', () => genArp(7), { tags: ['melodic'], fx: { delay: 0.3, reverb: 0.3 } }),
  S('s-arp2', 'synth', 'Arpegio oscuro', 'pluck', () => genArp(19, 16, [0, 2, 3, 7]), { tags: ['melodic'], fx: { delay: 0.3, reverb: 0.3 } }),
  S('s-lead-hook', 'synth', 'Gancho lead', 'lead', [[0, 4, 2], [2, 2], [4, 0, 2], [8, 4], [10, 5], [12, 4, 4]], { tags: ['rave'], len: 16, fx: { delay: 0.25 } }),
  S('s-bell', 'synth', 'Campanas hipnóticas', 'bell', [[0, 7], [3, 4], [6, 7], [10, 9], [13, 4]], { tags: ['hypnotic'], fx: { delay: 0.4, reverb: 0.4 } }),
  // Pads
  S('pad-minor', 'pad', 'Pad oscuro', 'pad', [[0, 0, 16], [0, 2, 16], [0, 4, 16]], { tags: ['techno'], len: 16, fx: { reverb: 0.4, duck: 0.6 } }),
  S('pad-prog', 'pad', 'Pad progresión', 'strings', [[0, 0, 16], [0, 2, 16], [0, 4, 16], [16, 5, 16], [16, 7, 16], [16, 9, 16], [32, 3, 16], [32, 5, 16], [32, 7, 16], [48, 4, 16], [48, 6, 16], [48, 8, 16]], { tags: ['melodic'], len: 64, fx: { reverb: 0.4, duck: 0.5 } }),
  S('pad-super', 'pad', 'Supersaw de drop', 'supersaw', [[0, 0, 8], [0, 2, 8], [0, 4, 8], [8, 0, 8], [8, 2, 8], [8, 4, 8]], { tags: ['rave'], fx: { reverb: 0.35, duck: 0.6 } }),
  // FX
  D('fx-sweep', 'fx', 'Barrido (cada 4 compases)', 'sweep', 'x...............', { len: 64, tags: ['fx'], vol: 0.6 }),
  D('fx-crash', 'fx', 'Platillo cada 8 compases', 'crash', 'x...............', { len: 128, tags: ['fx'], vol: 0.6 }),
  // Latino
  D('l-dembow', 'latin', 'Dembow (caja)', 'snare', '...x..x....x..x.', { tags: ['reggaetón'], role: 'snare' }),
  D('l-guiro', 'latin', 'Güiro cumbia', 'guiro', 'x.xxx.xxx.xxx.xx', { tags: ['cumbia'], role: 'perc' }),
  D('l-conga', 'latin', 'Congas latinas', 'congaHi', 'x..x..x..x..x.x.', { tags: ['dembow'], role: 'perc' }),
  S('l-sub-dem', 'latin', 'Sub reggaetón', 'sub', [[0, 0, 3], [3, 0, 3], [6, 0, 2], [8, 0, 3], [11, 0, 3], [14, 0, 2]], { tags: ['reggaetón'], role: 'bass' }),
];
