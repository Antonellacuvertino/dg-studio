// ===============================================================
//  Recetas de ritmo ("beat grids"): cada estilo en una tarjeta con
//  su BPM, una fila por instrumento y un consejo de producción.
//  x = golpe fuerte · o = golpe suave · . = silencio  (16 pasos = 1 compás)
//  Bajos/sintes: los números son notas de la escala (0 = nota base).
// ===============================================================
export const RECIPES = [
  { id: 'guaracha', name: 'Guaracha', bpm: 132, color: '#ffb020', genre: 'guaracha',
    tip: 'Guaracha / aleteo: bombo 4x4, palmas en 2 y 4, toms y congas tribales que no paran, hat abierto en el contratiempo y el silbato de carnaval. Ideal para meter sonidos de la calle como percusión.',
    rows: [['Bombo', 'lib:808-kick-punch', 'x...x...x...x...'], ['Palmas', 'lib:808-clap', '....x.......x...'], ['Hat abierto', 'lib:808-openhat', '..x...x...x...x.'], ['Tom tribal', 'lib:808-tom-mid', 'x.xx..x.x.xx..x.'], ['Conga', 'lib:808-conga-hi', '..x..x...x..x.x.'], ['Shaker', 'lib:ac-shaker', 'xoxoxoxoxoxoxoxo'], ['Silbato', 'whistle', '..............x.']],
    synths: [['Bajo', 'bass', '..0...0...0..00.', 0.6]] },
  { id: 'perreorave', name: 'Perreo Rave', bpm: 155, color: '#ff4fa3', genre: 'perreorave',
    tip: 'Lo que más se repite en tu playlist (Noro$t, PETERBLUE): bombo duro 4x4 a 155 y encima el dembow 3-3-2 en el aro, las congas y el sub. El sub sigue al dembow, no al bombo.',
    rows: [['Bombo', 'hardkick', 'x...x...x...x...'], ['Aro dembow', 'lib:808-rim', '...x..x....x..x.'], ['Conga', 'lib:808-conga-hi', 'x..x..x.x..x..x.'], ['Hat', 'lib:808-hat', 'x.x.x.x.x.x.x.x.'], ['Hat abierto', 'lib:808-openhat', '..x...x...x...x.'], ['Shaker', 'lib:ac-shaker', 'oxoxoxoxoxoxoxox']],
    synths: [['Sub dembow', 'sub', '0..0..0.0..0..0.', 0]] },
  { id: 'makineo', name: 'Makineo', bpm: 162, color: '#ff6a2d', genre: 'makineo',
    tip: 'Estilo Galactxtx / CRRDR: el bajo "rueda" en los 3 huecos entre cada bombo y no para nunca. En el drop, hoover y supersaw.',
    rows: [['Bombo', 'hardkick', 'x...x...x...x...'], ['Palmas', 'lib:808-clap', '....x.......x...'], ['Hat abierto', 'lib:808-openhat', '..x...x...x...x.'], ['Shaker', 'lib:ac-shaker', 'xoxoxoxoxoxoxoxo'], ['Cowbell', 'lib:808-cowbell', '......x.......x.']],
    synths: [['Rumble rodante', 'rumble', '.000.000.000.000', 0.7], ['Hoover', 'hoover', '0.......0...1...', 0.2]] },
  { id: 'hardhouse', name: 'Hard House', bpm: 152, color: '#d94dff', genre: 'hardhouse',
    tip: 'Estilo Funk Tribu / IOSIO: el bajo va en el contratiempo y salta una octava ("oi-oi"). Palmas en 2 y 4 y stabs de órgano.',
    rows: [['Bombo', 'hardkick', 'x...x...x...x...'], ['Palmas', 'lib:808-clap', '....x.......x...'], ['Hat abierto', 'lib:808-openhat-long', '..x...x...x...x.'], ['Shaker', 'lib:808-maracas', 'oooooooooooooooo'], ['Pandereta', 'lib:ac-tambourine', '....x.......x...']],
    synths: [['Bajo oi-oi', 'bass', '..07..07..07..07', 0.5], ['Órgano', 'organ', '..0...0...0..0..', 0.3]] },
  { id: 'funkbr', name: 'Funk Brasil', bpm: 145, color: '#2ee08a', genre: 'funkbr',
    tip: 'Tamborzão: el bombo hace "x..x..x...x..x..". Palmas, congas y un sub grave; la melodía con campana (bell) y frases de voz cortadas.',
    rows: [['Bombo', 'lib:808-kick-boom', 'x..x..x...x..x..'], ['Palmas', 'lib:808-clap', '....x..x....x...'], ['Conga', 'lib:808-conga-mid', 'x.x..x.x..x.x..x'], ['Agogó', 'lib:ac-agogo', '..x.......x.....']],
    synths: [['Sub', 'sub', '0..0..0...0..0..', 0], ['Campana', 'bell', '0...3...5...3...', 0.25]] },
  { id: 'ukbass', name: 'UK Bass', bpm: 145, color: '#3d9bff', genre: 'ukbass',
    tip: 'Speed garage / bassline (Ned Bennett, Yasmin Regisford): bombo que salta, palmas en 2 y 4, shaker con swing y un bajo reese que se mueve.',
    rows: [['Bombo', 'lib:808-kick-punch', 'x.....x.x...x...'], ['Palmas', 'lib:808-clap', '....x.......x...'], ['Hat abierto', 'lib:808-openhat', '..x...x...x...x.'], ['Shaker', 'lib:ac-shaker', 'xoxxxoxxxoxxxoxx']],
    synths: [['Reese', 'reese', '0.0...0...0.0...', 0.4]] },
  { id: 'hardtechno', name: 'Hard Techno', bpm: 152, color: '#ff2d4b', genre: 'hardtechno',
    tip: 'Bombo distorsionado en los 4 tiempos y rumble en los contratiempos: el bajo "rueda" entre bombo y bombo. Sidechain fuerte.',
    rows: [['Bombo', 'hardkick', 'x...x...x...x...'], ['Palmas', 'lib:808-clap', '....x.......x...'], ['Hat abierto', 'lib:808-openhat', '..x...x...x...x.'], ['Hat', 'lib:808-hat', 'xoxoxoxoxoxoxoxo'], ['Metal', 'lib:ac-brake', '...x......x..x..']],
    synths: [['Rumble', 'rumble', '..0.0...0.0...0.0', 0.7], ['Acid', 'acid', '0.0.3..07.0.-1.3.', 0.2]] },
  { id: 'technolatino', name: 'Techno Latino', bpm: 145, color: '#ff7a1a', genre: 'technolatino',
    tip: 'Bombo techno 4x4 + el "dembow" del reggaetón en el aro y las congas. Deja espacio en el medio para la voz.',
    rows: [['Bombo', 'hardkick', 'x...x...x...x...'], ['Aro dembow', 'lib:808-rim', '...x..x....x..x.'], ['Hat abierto', 'lib:808-openhat', '..x...x...x...x.'], ['Conga', 'lib:808-conga-hi', 'x..x..x...x..x..'], ['Shaker', 'lib:ac-shaker', 'oxoxoxoxoxoxoxox']],
    synths: [['Rumble', 'rumble', '..0...0...0...0.', 0.7]] },
  { id: 'techno', name: 'Techno', bpm: 132, color: '#c4122f', genre: 'techno',
    tip: 'Techno clásico: bombo 4x4, palmas en 2 y 4, hat abierto en cada contratiempo y un ride que da brillo.',
    rows: [['Bombo', 'lib:808-kick-punch', 'x...x...x...x...'], ['Palmas', 'lib:808-clap', '....x.......x...'], ['Hat abierto', 'lib:808-openhat', '..x...x...x...x.'], ['Ride', 'ride', 'x.x.x.x.x.x.x.x.']],
    synths: [['Bajo', 'bass', '..0...0...0...0.', 0.5]] },
  { id: 'acid', name: 'Acid', bpm: 138, color: '#ffc23d', genre: 'acidtechno',
    tip: 'La 303 hace todo: notas cortas, algunas acentuadas y saltos de octava. Sube la resonancia en Mezcla.',
    rows: [['Bombo', 'lib:808-kick-punch', 'x...x...x...x...'], ['Palmas', 'lib:808-clap', '....x.......x...'], ['Hat', 'lib:808-hat', 'oxoxoxoxoxoxoxox']],
    synths: [['Acid 303', 'acid', '0.07.0.3.0..7.-1.', 0.2]] },
  { id: 'hardgroove', name: 'Hardgroove', bpm: 144, color: '#e0aa55', genre: 'hardgroove',
    tip: 'Groove tribal: congas y bongós llenan los huecos, el shaker no para. Casi sin melodía.',
    rows: [['Bombo', 'lib:808-kick-tight', 'x...x...x...x...'], ['Bongó', 'lib:ac-bongo', '..x.x..x.x..x.x.'], ['Conga', 'lib:ac-conga', 'x..x...x..x.....'], ['Shaker', 'lib:ac-shaker', 'xoxxxoxxxoxxxoxx'], ['Hat abierto', 'lib:808-openhat', '..x...x...x...x.']] },
  { id: 'rave', name: 'Neo Rave', bpm: 150, color: '#ff5c8a', genre: 'rave',
    tip: 'Ritmo quebrado (breakbeat) y un hoover enorme en el drop.',
    rows: [['Bombo', 'hardkick', 'x.....x...x.....'], ['Caja', 'lib:808-snare-snap', '....x..x.x..x...'], ['Hat', 'lib:808-hat', 'x.x.x.x.x.x.x.x.']],
    synths: [['Hoover', 'hoover', '0.......0...1...', 0.2]] },
  { id: 'house', name: 'House', bpm: 124, color: '#ffd23d', genre: 'house',
    tip: 'Hats abiertos en los contratiempos: el "tss" que hace que el house suene a house.',
    rows: [['Bombo', 'lib:808-kick', 'x...x...x...x...'], ['Palmas', 'lib:808-clap', '....x.......x...'], ['Hat abierto', 'lib:808-openhat', '..x...x...x...x.'], ['Shaker', 'lib:808-maracas', 'oooooooooooooooo']] },
  { id: 'reggaeton', name: 'Reggaetón', bpm: 94, color: '#ff3d8b', genre: 'reggaeton',
    tip: 'El dembow: bombo en los 4 tiempos y la caja en el 4 y el 7 de cada medio compás (3-3-2).',
    rows: [['Bombo', 'lib:808-kick', 'x...x...x...x...'], ['Caja dembow', 'lib:808-snare', '...x..x....x..x.'], ['Hat', 'lib:808-hat', '..x...x...x...x.'], ['Shaker', 'lib:ac-shaker', 'oxoxoxoxoxoxoxox']],
    synths: [['Sub', 'sub', '0..0..0.0..0..0.', 0] ] },
  { id: 'dembow', name: 'Dembow', bpm: 118, color: '#ff8a3d', genre: 'dembow',
    tip: 'Más rápido que el reggaetón y con congas: energía de fiesta dominicana.',
    rows: [['Bombo', 'lib:808-kick', 'x...x...x...x...'], ['Caja', 'lib:808-snare-snap', '..xx..x...xx..x.'], ['Conga', 'lib:808-conga-mid', 'x..x..x..x..x.x.'], ['Hat', 'lib:808-hat', 'x.x.x.x.x.x.x.x.']] },
  { id: 'trap', name: 'Trap', bpm: 140, color: '#9b5cff', genre: 'trap',
    tip: 'Medio tiempo: la palma cae en el 3. Los hats en 16avos con redobles le dan el estilo.',
    rows: [['Bombo', 'lib:808-kick-long', 'x.....x...x.....'], ['Palmas', 'lib:808-clap', '........x.......'], ['Hat', 'lib:808-hat', 'xxx.x.xxx.x.x.xx']],
    synths: [['808', 'b808', '0.....0...-2.....', 0]] },
  { id: 'drill', name: 'Drill', bpm: 142, color: '#6d5bff', genre: 'drill',
    tip: 'Bombo y caja desplazados, hats en tresillos. El 808 se desliza entre notas.',
    rows: [['Bombo', 'lib:808-kick-boom', 'x.........x.....'], ['Caja', 'lib:808-snare', '........x.....x.'], ['Hat', 'lib:808-hat', 'x..x..x.x..x..x.']] },
  { id: 'boombap', name: 'Boom bap', bpm: 90, color: '#2eb6ff', genre: 'hiphop',
    tip: 'Hip-hop clásico: bombo "boom" y caja "bap" en 2 y 4, hats en corcheas con swing.',
    rows: [['Bombo', 'lib:ac-kick', 'x......x.x......'], ['Caja', 'lib:ac-snare', '....x.......x...'], ['Hat', 'lib:ac-hat', 'x.x.x.x.x.x.x.x.']] },
  { id: 'lapop', name: 'LA pop', bpm: 100, color: '#ff7ab8', genre: 'pop',
    tip: 'Pop moderno: bombo con empuje, palmas en 2 y 4 y hats constantes.',
    rows: [['Bombo', 'lib:808-kick-punch', 'x.....x.x.......'], ['Palmas', 'lib:808-clap', '....x.......x...'], ['Hat', 'lib:808-hat', 'xxxxxxxxxxxxxxxx']] },
  { id: 'rock', name: 'Rock', bpm: 120, color: '#ff6b4d', genre: 'rock',
    tip: 'Batería real: bombo en 1 y 3, caja en 2 y 4, hi-hat en corcheas.',
    rows: [['Bombo', 'lib:ac-kick', 'x.......x.x.....'], ['Caja', 'lib:ac-snare', '....x.......x...'], ['Hi-hat', 'lib:ac-hat', 'x.x.x.x.x.x.x.x.'], ['Platillo', 'lib:ac-cymbal', 'x...............']] },
  { id: 'afro', name: 'Afrobeat', bpm: 106, color: '#3ee08f', genre: 'afrobeat',
    tip: 'Percusión que se cruza: aro, shaker y congas sincopadas.',
    rows: [['Bombo', 'lib:808-kick', 'x..x..x...x..x..'], ['Aro', 'lib:808-rim', '...x..x....x..x.'], ['Shaker', 'lib:ac-shaker', 'xoooxoooxoooxooo'], ['Conga', 'lib:ac-conga', '..x..x.x..x..x.x']] },
  { id: 'cumbia', name: 'Cumbia', bpm: 96, color: '#2ed1e6', genre: 'cumbia',
    tip: 'El güiro marca todo el ritmo; bombo en 1 y 3 y el bajo salta entre nota base y quinta.',
    rows: [['Bombo', 'lib:ac-kick', 'x.......x.......'], ['Güiro', 'lib:ac-guiro', 'x.xxx.xxx.xxx.xx'], ['Aro', 'lib:808-rim', '....x.......x...'], ['Conga', 'lib:ac-conga', '..x.x...x.x..x..']],
    synths: [['Bajo', 'sub', '0...4...0...4...', 0]] },
];

// Convertir la notación de las recetas
export const stepsFrom = (s) => [...s].slice(0, 16).map((c) => (c === 'x' ? 1 : c === 'o' ? 0.55 : 0)).concat(new Array(Math.max(0, 16 - s.length)).fill(0));
export function notesFrom(s) {
  // admite números negativos: "0.0.3..07.0.-1.3."
  const out = []; let step = 0; let i = 0;
  while (i < s.length && step < 16) {
    if (s[i] === '.') { step++; i++; continue; }
    let m = s.slice(i).match(/^-?\d/); if (!m) { i++; continue; }
    out.push({ s: step, d: +m[0], len: 1, vel: 1 }); step++; i += m[0].length;
  }
  return out;
}
