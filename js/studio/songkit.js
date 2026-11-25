// ===============================================================
//  "Kit parecido": al subir una canción, se crean loops parecidos
//  (bombo, caja, hats, percusión, bajo, acordes, melodía) a su BPM y
//  tonalidad, re-sintetizados (sin copiar el audio), y se guardan
//  directo en Mis sonidos.
// ===============================================================
import { makeProject, newScene } from './model.js';
import { renderProject } from './sequencer.js';
import { addSample } from './samples.js';

const LABEL = { kick: 'Bombo', snare: 'Caja/Palmas', hat: 'Hats', perc: 'Percusión', bass: 'Bajo', chords: 'Acordes', pad: 'Pad', lead: 'Melodía' };

export async function saveSongKit(dna, songName, onProgress) {
  const p = makeProject(dna.genre, { bpm: dna.bpm, root: dna.root, mode: dna.mode, drums: dna.drums, seed: Math.round(dna.bpm * 1000 + dna.root) });
  const bars = 4; const saved = []; const short = songName.slice(0, 22);
  // un loop por rol (si hay dos pistas del mismo rol, se juntan)
  const roles = [...new Set(p.tracks.map((t) => t.role))].filter((r) => LABEL[r]);
  const jobs = [...roles.map((r) => ({ name: LABEL[r], ids: p.tracks.filter((t) => t.role === r).map((t) => t.id) })), { name: 'Beat completo', ids: p.tracks.map((t) => t.id) }];
  for (let i = 0; i < jobs.length; i++) {
    const j = jobs[i];
    onProgress && onProgress(i / jobs.length, j.name);
    const proj = { ...p, scenes: [newScene('kit', bars, Object.fromEntries(j.ids.map((id) => [id, true])))] };
    const buffer = await renderProject(proj, { tail: 0 });
    const rec = await addSample({ name: `${short} · ${j.name}`, buffer, bpm: dna.bpm, kind: 'loop', tags: ['kit', songName] });
    saved.push(rec);
  }
  onProgress && onProgress(1, 'listo');
  return saved;
}
