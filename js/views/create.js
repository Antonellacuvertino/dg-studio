// ===============================================================
//  CREAR: escribe tu letra (o graba/sube voz) → canción completa
// ===============================================================
import { h, toast, busy, busyText, action, sheet, confirm, chips, slider, fmt, uid } from '../core/ui.js';
import { put } from '../core/ui.js';
import { db } from '../core/db.js';
import { state, saveVoiceSettings, on, emit } from '../core/state.js';
import { audio, pickFile, decode, playPreview, stopPreview, shareOrSave, saveBlob, safeName } from '../core/audio.js';
import { GENRES, GENRE_KEYS, NOTE_ES, renderSong, songLength } from '../engine/engine.js';
import { analyzeLyrics, analyzeSong, analyzeVoice, analyzeSounds } from '../engine/analyze.js';
import { produce } from '../engine/producer.js';
import { toMp3, toWav, sha256, licenseText } from '../engine/export.js';
import { planVocals, renderVocals, melodyView, toBuffer } from '../voice/voice.js';
import { renderVocalMix, arrangeRecording } from '../voice/arrange.js';
import { autotune } from '../voice/tune.js';
import { singer, singerName, loadRef, getProfile } from '../voice/profile.js';
import { makeProject, newTrack, newScene, CAMELOT, TECHNO } from '../studio/model.js';
import { addSample } from '../studio/samples.js';
import { openProject } from './studio.js';
import { recordOverlay, fillPrompter, highlight, WavePlayer } from './shared.js';

let root = null;
const S = {
  genre: null, length: 'normal', seed: (Math.random() * 1e9) | 0,
  voice: null, dna: null, dnaChoice: null, sounds: null,
  song: null, mix: null, beatOnly: null, vocals: null, notes: null, prof: null,
  take: null, takeOffset: 0, aiVoice: false, title: '', lastMp3: null, flags: {},
};
let player = null;

const ORDER = () => ['auto', 'hardtechno', 'technolatino', 'techno', 'acidtechno', 'rave', 'industrial', 'hardgroove', 'melodictechno', ...GENRE_KEYS.filter((k) => !TECHNO.has(k)), 'house', 'edm'];

export async function initCreate(el) {
  root = el;
  S.lyrics = await db.kvGet('lyrics', '');
  S.length = await db.kvGet('createLength', 'normal');
  player = new WavePlayer({ onTime: (t) => { const pr = root.querySelector('#prompter'); if (pr && S.song) highlight(pr, t, S.song.timeline); } });
  render();
  on('tab', (t) => { if (t !== 'create') player.stop(); });
  on('useVoice', ({ buffer, name }) => { S.voice = { buffer, name, info: null }; analyzeVoice(buffer).then((info) => { if (S.voice && S.voice.buffer === buffer) S.voice.info = info; }); render(); toast('Voz lista: toca ✨ Crear canción'); });
  on('profile', () => render());
}

// ---------------------------------------------------------------
function render() {
  if (!root) return;
  root.innerHTML = '';
  const ta = h('textarea.lyrics#lyrics', { placeholder: 'Escribe tu letra aquí…\n\nDeja una línea en blanco entre versos y coro, o escribe [Coro] encima del coro. Aunque sea corta, la alargo con repeticiones, chops y ecos.' });
  ta.value = S.lyrics || '';
  let saveT; ta.oninput = () => { S.lyrics = ta.value; clearTimeout(saveT); saveT = setTimeout(() => db.kvSet('lyrics', ta.value), 400); };
  const prof = singer();
  put(root, 
    h('h2.vt', {}, '✍️ Crear canción'),
    h('p.vs', {}, 'Escribe, graba o sube audio: el productor elige estilo, arma el beat, canta y mezcla.'),
    h('div.card.leo', {},
      ta,
      attachments(),
      h('div.muted.small', { style: { marginTop: '10px' } }, 'Estilo'),
      chips(ORDER().filter((k, i, a) => a.indexOf(k) === i && (k === 'auto' || GENRES[k])).map((k) => ({ id: k, label: k === 'auto' ? '🤖 Auto' : `${GENRES[k].emoji} ${GENRES[k].name}` })), S.genre || 'auto', (k) => { S.genre = k === 'auto' ? null : k; }),
      h('div.muted.small', { style: { marginTop: '6px' } }, 'Duración'),
      chips([{ id: 'auto', label: 'Según la letra' }, { id: 'short', label: 'Corta ~1:30' }, { id: 'normal', label: 'Normal ~2:30' }, { id: 'long', label: 'Larga ~3:30' }, { id: 'dj', label: 'DJ extendida ~6:00' }], S.length, (k) => { S.length = k; db.kvSet('createLength', k); }),
      h('button.btn.block', { style: { marginTop: '8px', justifyContent: 'space-between' }, onclick: action(voiceQuick) },
        h('span', {}, `🗣️ Canta: ${prof ? (prof === getProfile() ? 'Mi voz' : 'Voz DG') : 'sin voz'}`),
        h('span.muted', {}, `Autotune ${Math.round(state.voice.tune * 100)}% ▾`)),
      h('div.row', { style: { marginTop: '10px' } },
        h('button.btn.icon', { title: 'Grabar', onclick: action(recordInput) }, '🎤'),
        h('button.btn.icon', { title: 'Subir audio', onclick: action(uploadInput) }, '📎'),
        h('button.btn.primary.big.grow', { onclick: action(() => create()) }, '✨ Crear canción'))),
    S.song ? resultCard() : null,
  );
}

function attachments() {
  const box = h('div.att');
  const chip = (label, onx, buf) => {
    const c = h('div.chip', {}, h('span', {}, label));
    if (buf) c.append(h('button', { onclick: () => playPreview(buf) }, '▶'));
    c.append(h('button', { onclick: () => { onx(); render(); } }, '✕'));
    box.append(c);
  };
  if (S.voice) chip(`🎤 ${S.voice.name} · ${fmt(S.voice.buffer.duration)}`, () => (S.voice = null), S.voice.buffer);
  if (S.dna) chip(`🧬 Ritmo de "${S.dna.name}" · ${S.dna.dna.bpm} BPM`, () => { S.dna = null; S.dnaChoice = null; });
  if (S.sounds) chip(`🥁 Tus sonidos · ${S.sounds.data.hits} golpes`, () => (S.sounds = null));
  return box;
}

async function voiceQuick() {
  const v = state.voice;
  const body = h('div', {},
    chips([{ id: 'auto', label: '🤖 Auto' }, { id: 'mine', label: '🧬 Mi voz' }, { id: 'dg', label: '🎤 Voz DG' }, { id: 'none', label: '🔇 Sin voz' }], v.who, (x) => { v.who = x; }),
    slider('Autotune', v.tune, { fmt: (x) => (x < 0.15 ? 'Natural' : x > 0.8 ? 'Robot' : Math.round(x * 100) + '%'), oninput: (x) => (v.tune = x) }),
    slider('Tono', v.transpose, { min: -12, max: 12, step: 1, fmt: (x) => `${x > 0 ? '+' : ''}${x} st`, oninput: (x) => (v.transpose = x) }),
    slider('Coros dobles', v.double, { oninput: (x) => (v.double = x) }),
    slider('Ad-libs/ecos', v.adlibs, { oninput: (x) => (v.adlibs = x) }));
  const r = await sheet('🗣️ Voz de la canción', { body, options: [{ id: 'ok', label: 'Listo', primary: true }, { id: 'more', label: '🎤 Más ajustes y crear mi voz', sub: 'Abre la sección Voz' }], cancel: 'Cerrar' });
  await saveVoiceSettings();
  if (r === 'more') emit('goto', 'voice');
  render();
  if (S.song && r === 'ok' && !S.voice && (await confirm('¿Aplicar a la canción actual?', 'Vuelvo a cantar la letra con los nuevos ajustes (el beat no cambia).', 'Aplicar'))) await revoice();
}

// ---------- entradas de audio ----------
async function recordInput() {
  const r = await recordOverlay('Canta, rapea o haz sonidos (boom, tss, pa)…'); if (!r) return;
  await handleAudio(r.buffer, 'Grabación', true);
}
async function uploadInput() {
  const f = await pickFile(); if (!f) return;
  busy('Abriendo audio…'); let buf; try { buf = await decode(f); } finally { busy(false); }
  await handleAudio(buf, f.name.replace(/\.[^.]+$/, ''), false);
}
async function handleAudio(buf, name, recorded) {
  if (buf.duration < 0.4) { toast('El audio es demasiado corto'); return; }
  const opts = [
    { id: 'voice', label: '🎤 Es mi voz', sub: 'Le hago un beat a medida, la mezclo y la alargo con chops' },
    { id: 'tune', label: '🎯 Es mi voz y quiero afinarla primero', sub: 'Autotune a la escala de la canción' },
    { id: 'sounds', label: '🥁 Son sonidos para un ritmo', sub: 'Beatbox, palmas, golpes → batería con tus sonidos' },
  ];
  if (!recorded) opts.splice(1, 0, { id: 'song', label: '🎵 Es una canción', sub: 'Aprendo su ritmo (BPM, tono, batería) para usarlo' });
  const kind = await sheet('¿Qué es este audio?', { text: `${name} · ${fmt(buf.duration)}`, options: opts });
  if (!kind) return;
  if (kind === 'voice' || kind === 'tune' || kind === 'sounds') {
    const g = await sheet(kind === 'sounds' ? '¿Qué estilo quieres con tu ritmo?' : '¿Qué estilo le pongo a tu voz?', { grid: true, options: ORDER().filter((k, i, a) => a.indexOf(k) === i && (k === 'auto' || GENRES[k])).map((k) => ({ id: k, label: k === 'auto' ? '🤖 Auto' : `${GENRES[k].emoji} ${GENRES[k].name}` })) });
    if (!g) return; S.genre = g === 'auto' ? null : g;
  }
  if (kind === 'voice' || kind === 'tune') {
    busy('Escuchando tu voz…');
    try {
      const info = await analyzeVoice(buf, (m) => busyText(m));
      let b = buf;
      if (kind === 'tune') { busyText('Afinando…'); b = await autotune(buf, { root: info.root, mode: info.mode, amount: 0.6 + state.voice.tune * 0.4, speed: 0.4 + state.voice.tune * 0.6, onProgress: (p) => busyText(`Afinando… ${Math.round(p * 100)}%`) }); }
      S.voice = { buffer: b, info, name };
    } finally { busy(false); }
    toast(S.voice.info.singing ? 'Voz cantada detectada 🎶' : 'Flow detectado 🎤');
    if (!S.dna) await create();
  } else if (kind === 'sounds') {
    busy('Separando tus sonidos…');
    try { S.sounds = { name, data: await analyzeSounds(buf, (m) => busyText(m)) }; } finally { busy(false); }
    toast(`${S.sounds.data.hits} golpes · ${S.sounds.data.bpm} BPM`);
    await create();
  } else if (kind === 'song') {
    busy('Analizando la canción…');
    try { S.dna = { name, dna: await analyzeSong(buf, (m) => busyText(m)) }; } finally { busy(false); }
    S.dnaChoice = null; await askDna();
  }
}
async function askDna() {
  const d = S.dna.dna;
  const ch = await sheet('Guardé el ritmo de la canción 🧬', {
    text: `${d.bpm} BPM · ${NOTE_ES[d.root]} ${d.mode === 'minor' ? 'menor' : 'mayor'} (${CAMELOT[d.mode][d.root]}) · suena a ${GENRES[d.genre].name}`,
    options: [
      { id: 'rhythm', label: '🥁 Canción con el ritmo de esta música', primary: true, sub: 'Re-sintetizo su groove (sin copiar audio) y le pongo tu letra o voz' },
      { id: 'lyrics', label: '📝 Beat nuevo para mi letra', sub: 'Ignoro esta canción' },
      { id: 'voice', label: '🎤 Beat nuevo para mi audio', sub: 'Según tu voz grabada' },
    ] });
  if (!ch) return;
  S.dnaChoice = ch;
  if (ch === 'lyrics' && !(S.lyrics || '').trim()) { toast('Escribe tu letra y toca ✨ Crear'); return; }
  if (ch === 'voice' && !S.voice) { toast('Graba o sube tu voz y toca ✨ Crear'); return; }
  await create();
}

// ---------------------------------------------------------------
//  Producir
// ---------------------------------------------------------------
async function create({ variation = false } = {}) {
  audio(); player.stop(); stopPreview();
  const text = (S.lyrics || '').trim();
  const L = text ? analyzeLyrics(text) : null;
  if (!L && !S.voice && !S.dna && !S.sounds) { toast('Escribe una letra, graba tu voz o sube un audio'); root.querySelector('#lyrics').focus(); return; }
  if (S.dna && !S.dnaChoice) { await askDna(); return; }
  const useDna = S.dna && S.dnaChoice === 'rhythm';
  const useL = S.dna && S.dnaChoice === 'voice' ? null : L;
  const useV = S.dna && S.dnaChoice === 'lyrics' ? null : S.voice;
  if (useV && !useV.info) { busy('Escuchando tu voz…'); try { useV.info = await analyzeVoice(useV.buffer); } finally { busy(false); } }
  busy('El productor está escuchando…');
  try {
    await new Promise((r) => setTimeout(r, 30));
    const song = produce({ lyrics: useV ? null : useL, voice: useV, dna: useDna ? S.dna.dna : null, sounds: S.sounds ? S.sounds.data : null, genre: S.genre, seed: S.seed, variation, length: S.length });
    if (useV && useL) song.timeline = []; // con voz grabada no hay letra a tiempo
    let voiceOpt = {};
    S.notes = null; S.prof = null; S.vocals = null;
    if (useV) {
      if (S.length !== 'auto') {
        busyText('Armando tu voz: frases, gancho y chops…');
        const intro = song.sections[0].bars;
        const arr = arrangeRecording(useV.buffer, song, { introBars: intro, targetBars: Math.round((({ short: 90, normal: 150, long: 210, dj: 360 })[S.length] * song.bpm) / 240), double: state.voice.double });
        song.sections = arr.sections; voiceOpt = { voice: arr.buffer, voiceOffset: 0 };
      } else voiceOpt = { voice: useV.buffer, voiceOffset: song.voiceOffset };
      S.vocals = voiceOpt.voice;
    } else if (useL) {
      const prof = singer();
      if (prof) {
        busyText(`🗣️ Cantando tu letra con ${singerName(prof)}…`);
        await new Promise((r) => setTimeout(r, 30));
        S.notes = planVocals(song, prof, state.voice); S.prof = prof;
        S.vocals = renderVocalMix(song, S.notes, prof, state.voice, songLength(song) + 1.5);
        voiceOpt = { voice: S.vocals, voiceOffset: 0 };
      }
    }
    busyText(`Mezclando ${GENRES[song.genre].emoji} ${GENRES[song.genre].name} · ${song.bpm} BPM…`);
    voiceOpt.voiceSpace = 0.05 + state.voice.space * 0.4;
    const mix = await renderSong(song, voiceOpt);
    Object.assign(S, { song, mix, beatOnly: voiceOpt.voice ? null : mix, take: null, aiVoice: false, lastMp3: null, voiceOpt });
    S.flags = { hasVoice: !!voiceOpt.voice, recorded: !!useV, fromRef: !!useDna, fromSounds: !!S.sounds };
    if (!S.title || S.titleAuto !== false) { S.title = L && L.lines[0] ? L.lines[0].text.replace(/[^\p{L}\p{N} ¿?¡!']/gu, '').slice(0, 40) : `${GENRES[song.genre].name} ${song.bpm}`; S.titleAuto = true; }
  } finally { busy(false); }
  render();
  player.set(S.mix);
  root.querySelector('#result') && root.querySelector('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Volver a cantar (tras editar melodía o ajustes) sin cambiar el beat
async function revoice() {
  if (!S.song || !S.notes && !S.prof && !(S.lyrics || '').trim()) return;
  const prof = singer(); if (!prof) { toast('Elige quién canta en 🗣️'); return; }
  busy('Volviendo a cantar…');
  try {
    S.notes = planVocals(S.song, prof, state.voice); S.prof = prof;
    S.vocals = renderVocalMix(S.song, S.notes, prof, state.voice, songLength(S.song) + 1.5);
    S.mix = await renderSong(S.song, { voice: S.vocals, voiceOffset: 0, voiceSpace: 0.05 + state.voice.space * 0.4 });
    S.take = null; S.aiVoice = false; S.lastMp3 = null; S.flags.hasVoice = true;
  } finally { busy(false); }
  render(); player.set(S.mix); player.play(0);
}

// ---------------------------------------------------------------
//  Resultado
// ---------------------------------------------------------------
function resultCard() {
  const song = S.song; const G = GENRES[song.genre];
  const title = h('input', { value: S.title, style: { fontSize: '20px', fontWeight: '800', background: 'transparent', border: '0', padding: '2px 0' } });
  title.oninput = () => { S.title = title.value; S.titleAuto = false; S.lastMp3 = null; };
  const who = S.take ? '🎤 tu toma' : S.aiVoice ? '🧬 tu voz (IA)' : S.flags.recorded ? '🎤 tu voz' : S.prof ? (S.prof === getProfile() ? '🧬 canta tu voz' : '🤖 canta Voz DG') : '🎹 instrumental';
  const pr = h('ol.prompter#prompter'); fillPrompter(pr, song.timeline);
  const canSing = !!S.notes;
  return h('div.card#result', {},
    title,
    h('div.meta', {}, ...[`${G.emoji} ${G.name}`, `${song.bpm} BPM`, `${NOTE_ES[song.root]} ${song.mode === 'minor' ? 'menor' : 'mayor'} · ${CAMELOT[song.mode][song.root]}`, fmt(S.mix.duration), who, S.flags.fromSounds ? '🥁 tus sonidos' : '', S.flags.fromRef ? '🧬 ritmo de referencia' : ''].filter(Boolean).map((t) => h('span', {}, t))),
    h('p.why', {}, '🎧 ' + (song.why.length ? song.why.join(' · ') : 'Estilo elegido por el productor')),
    player.el,
    h('div.grid2', { style: { marginTop: '10px' } },
      h('button.btn', { onclick: action(async () => { S.seed = (Math.random() * 1e9) | 0; await create({ variation: true }); }) }, '🎲 Otro beat'),
      h('button.btn', { onclick: action(melodyEditor), disabled: !canSing }, '🎼 Editar melodía'),
      h('button.btn', { onclick: action(recordOver) }, S.take ? '🎙️ Otra toma' : '🎙️ Grabar encima'),
      h('button.btn', { onclick: action(toStudio) }, '🎛️ Abrir en Estudio'),
      h('button.btn.primary', { onclick: action(downloadMp3) }, '⬇️ MP3'),
      h('button.btn', { onclick: action(showLicense) }, '📜 Licencia')),
    canSing || S.aiVoice ? h('button.btn.block', { style: { marginTop: '8px', borderColor: 'var(--gold)' }, onclick: action(aiVoice) }, S.aiVoice ? '🧬 Voz IA aplicada ✓ (cambiar)' : '🧬 Voz realista con IA (Colab)') : null,
    S.take ? h('div', { style: { marginTop: '8px' } }, slider('Sincronía', 0, { min: -0.3, max: 0.3, step: 0.01, fmt: (v) => `${Math.round(v * 1000)} ms`, onchange: action(async (v) => { busy('Re-sincronizando…'); try { S.mix = await renderSong(S.song, { voice: S.take, voiceOffset: S.takeOffset - v }); S.lastMp3 = null; } finally { busy(false); } player.set(S.mix); }) })) : null,
    pr);
}

// ---------- editor de melodía ----------
async function melodyEditor() {
  if (!S.notes || !S.prof) return;
  S.song.melodyEdits = S.song.melodyEdits || {};
  const lines = melodyView(S.song, S.prof, state.voice);
  const body = h('div');
  const NOTE = (m) => NOTE_ES[((Math.round(m) % 12) + 12) % 12] + (Math.floor(Math.round(m) / 12) - 1);
  const draw = () => {
    body.innerHTML = '';
    body.append(h('p.muted.small', { style: { margin: '0 0 6px' } }, '▲▼ sube o baja cada sílaba por la escala. Las líneas repetidas (coro) cambian juntas.'),
      h('div.row', {}, h('button.btn.sm', { onclick: () => { state.voice.transpose = Math.min(12, state.voice.transpose + 1); refresh(); } }, '⬆ Todo +1'), h('button.btn.sm', { onclick: () => { state.voice.transpose = Math.max(-12, state.voice.transpose - 1); refresh(); } }, '⬇ Todo −1'), h('span.muted.small', {}, `Tono ${state.voice.transpose > 0 ? '+' : ''}${state.voice.transpose}`)));
    lines.forEach((L) => {
      const ed = S.song.melodyEdits[L.text] || [];
      body.append(h('div.mel-line', {}, h('div.mt', {}, L.text),
        h('div.mel-syl', {}, ...L.notes.map((n) => h('div.s' + (ed[n.k] ? '.ed' : ''), {},
          h('button', { onclick: () => bump(L.text, n.k, 1) }, '▲'),
          h('span.nm', {}, n.syl), h('span.nt', {}, NOTE(n.midi)),
          h('button', { onclick: () => bump(L.text, n.k, -1) }, '▼'))))));
    });
  };
  const refresh = () => { const nl = melodyView(S.song, S.prof, state.voice); lines.splice(0, lines.length, ...nl); draw(); };
  const bump = (text, k, d) => { const e = (S.song.melodyEdits[text] = S.song.melodyEdits[text] || []); e[k] = (e[k] || 0) + d; refresh(); };
  draw();
  const r = await sheet('🎼 Editar melodía', { body, options: [{ id: 'apply', label: '✅ Aplicar y escuchar', primary: true }, { id: 'reset', label: '↺ Quitar mis cambios' }], cancel: 'Cerrar' });
  if (r === 'reset') { S.song.melodyEdits = {}; await revoice(); }
  else if (r === 'apply') { await saveVoiceSettings(); await revoice(); }
}

// ---------- grabar encima del beat ----------
async function recordOver() {
  player.stop();
  if (!S.beatOnly) { busy('Preparando el beat…'); try { S.beatOnly = await renderSong(S.song); } finally { busy(false); } }
  const ok = await sheet('🎙️ Grabar sobre el beat', { text: 'Usa audífonos para que el beat no se cuele en el micrófono. La letra se irá marcando a tiempo.', options: [{ id: 'go', label: '🔴 Empezar', primary: true }, { id: 'tune', label: '🔴 Empezar y afinar al terminar', sub: `Autotune ${Math.round(state.voice.tune * 100)}%` }] });
  if (!ok) return;
  const r = await recordOverlay('Grabando sobre el beat…', { backing: S.beatOnly, lines: S.song.timeline.length ? S.song.timeline : null });
  if (!r) return;
  busy('Mezclando tu toma…');
  try {
    let take = r.buffer;
    if (ok === 'tune') { busyText('Afinando tu toma…'); take = await autotune(take, { root: S.song.root, mode: S.song.mode, amount: 0.6 + state.voice.tune * 0.4, speed: 0.3 + state.voice.tune * 0.7 }); }
    S.take = take; S.takeOffset = r.offset;
    S.mix = await renderSong(S.song, { voice: take, voiceOffset: r.offset, voiceSpace: 0.05 + state.voice.space * 0.4 });
    S.flags.hasVoice = true; S.lastMp3 = null; S.aiVoice = false;
  } finally { busy(false); }
  render(); player.set(S.mix); toast('¡Toma lista!');
}

// ---------- pasar al estudio ----------
async function toStudio() {
  const song = S.song;
  const p = makeProject(song.genre, { bpm: song.bpm, root: song.root, mode: song.mode, prog: song.prog, drums: song.drums, name: S.title || 'Desde Crear', seed: song.seed });
  const ids = (roles) => Object.fromEntries(p.tracks.filter((t) => roles.includes(t.role)).map((t) => [t.id, true]));
  const MAP = { intro: ['chords', 'hat', 'pad'], verse: ['kick', 'snare', 'hat', 'perc', 'bass', 'chords'], chorus: ['kick', 'snare', 'hat', 'perc', 'bass', 'chords', 'lead', 'pad'], bridge: ['chords', 'lead', 'pad', 'perc'], outro: ['chords', 'pad', 'hat'] };
  const NAMES = { intro: 'Intro', verse: 'Verso', chorus: 'Coro', bridge: 'Puente', outro: 'Outro' };
  p.scenes = song.sections.map((s) => newScene(NAMES[s.type] || s.type, s.bars, ids(MAP[s.type] || MAP.verse), s.type === 'chorus' ? 'drop' : s.type === 'intro' ? 'fadein' : s.type === 'outro' ? 'fadeout' : 'none'));
  const voc = S.take || S.vocals;
  if (voc) {
    busy('Guardando la voz en el proyecto…');
    try {
      let v = voc; const off = S.take ? S.takeOffset : (S.voiceOpt && S.voiceOpt.voiceOffset) || 0;
      if (off) { // alinear al inicio del tema
        const sr = v.sampleRate; const shift = Math.round(off * sr); const len = v.length + shift; const b = new AudioBuffer({ length: Math.max(1, len), numberOfChannels: v.numberOfChannels, sampleRate: sr });
        for (let c = 0; c < v.numberOfChannels; c++) { const src = v.getChannelData(c); const dst = b.getChannelData(c); for (let i = 0; i < dst.length; i++) { const k = i - shift; dst[i] = k >= 0 && k < src.length ? src[k] : 0; } }
        v = b;
      }
      const rec = await addSample({ name: `Voz · ${S.title || 'canción'}`.slice(0, 40), buffer: v, kind: 'audio' });
      const t = newTrack('audio', { name: 'Voz', role: 'vox', sampleId: rec.id, vol: 0.95, fx: { reverb: 0.15 } }); t.sync = true;
      p.tracks.push(t); p.scenes.forEach((s) => (s.on[t.id] = true));
    } finally { busy(false); }
  }
  await openProject(p);
  emit('goto', 'studio');
}

// ---------- exportar ----------
function tags() {
  const song = S.song; const y = new Date().getFullYear(); const EN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return { title: S.title || 'Mi canción', artist: state.artist, album: `${state.artist} — DG Studio`, genre: GENRES[song.genre].name, year: String(y), bpm: String(song.bpm),
    key: `${EN[song.root]}${song.mode === 'minor' ? 'm' : ''} (${CAMELOT[song.mode][song.root]})`, copyright: `℗ © ${y} ${state.artist}. Todos los derechos reservados.`,
    comment: `Producido por ${state.artist} con DG Studio. Beat original sintetizado, ID DG-${song.seed}.` };
}
async function buildMp3() {
  if (S.lastMp3) return S.lastMp3;
  busy('Creando MP3…');
  try { S.lastMp3 = await toMp3(S.mix, tags(), (p) => busyText(`Creando MP3… ${Math.round(p * 100)}%`)); return S.lastMp3; } finally { busy(false); }
}
const fileName = (ext) => `${safeName(state.artist)} - ${safeName(S.title)}.${ext}`;
async function downloadMp3() {
  player.stop();
  let blob;
  try { blob = await buildMp3(); } catch (e) {
    if ((await sheet('MP3 no disponible', { text: (e.message || '') + '\n¿Descargar en WAV?', options: [{ id: 'wav', label: '⬇️ Descargar WAV', primary: true }] })) === 'wav') await shareOrSave(toWav(S.mix), fileName('wav'));
    return;
  }
  await shareOrSave(blob, fileName('mp3'));
}
async function showLicense() {
  let blob; try { blob = await buildMp3(); } catch { blob = toWav(S.mix); }
  const t = tags(); const song = S.song;
  const sung = S.aiVoice ? `${state.artist} (convertida con IA Seed-VC)` : S.prof ? (S.prof === getProfile() ? state.artist : 'la Voz DG de la app') : null;
  const txt = licenseText({ title: t.title, artist: state.artist, date: Date.now(), genre: t.genre, bpm: song.bpm, key: `${NOTE_ES[song.root]} ${song.mode === 'minor' ? 'menor' : 'mayor'}`, duration: fmt(S.mix.duration), seed: song.seed, hash: await sha256(blob), hasVoice: S.flags.hasVoice && !sung, sung, fromRef: S.flags.fromRef, fromSounds: S.flags.fromSounds });
  if ((await sheet('📜 Licencia de autoría', { text: txt, mono: true, options: [{ id: 'save', label: '⬇️ Guardar certificado (.txt)', primary: true }] })) === 'save') await shareOrSave(new Blob([txt], { type: 'text/plain' }), fileName('licencia.txt'));
}

// ---------- voz realista con IA (Colab) ----------
async function aiVoice() {
  const ref = await loadRef();
  const id = await sheet('🧬 Voz realista con IA', {
    text: `Una IA gratis (Seed-VC en Google Colab) le pone el timbre real de tu voz a esta canción.\n1. Descarga los archivos.\n2. colab.research.google.com → Archivo → Subir cuaderno → DG_Voz_IA.ipynb → GPU (T4) → ejecutar.\n3. Importa voz_ia.wav aquí.${ref ? '' : '\n\n⚠️ Graba tu voz en 🎤 Voz (incluye el paso de 15 s): mejora mucho el resultado.'}`,
    options: [
      { id: 'files', label: '⬇️ 1. Voz guía + mi voz', sub: 'voz_guia.wav y mi_voz.wav' },
      { id: 'nb', label: '📓 2. Cuaderno de Colab', sub: 'DG_Voz_IA.ipynb (solo la primera vez)' },
      { id: 'import', label: '📥 3. Importar voz IA', primary: true, sub: 'voz_ia.wav' },
    ] });
  if (id === 'files') {
    if (!S.notes || !S.prof) { toast('Primero crea la canción con tu letra cantada'); return; }
    busy('Preparando voz guía…');
    let guide; try { guide = toBuffer([renderVocals(S.notes, S.prof, songLength(S.song) + 1.5, { ...state.voice, breath: 0 })]); } finally { busy(false); }
    saveBlob(toWav(guide), 'voz_guia.wav');
    let refBuf;
    if (ref) { refBuf = new AudioBuffer({ length: ref.length, numberOfChannels: 1, sampleRate: 22050 }); refBuf.copyToChannel(Float32Array.from(ref), 0); }
    else if (getProfile()) { const parts = ['a', 'e', 'i', 'o', 'u', 'm'].map((k) => getProfile().sources[k].data); const len = parts.reduce((a, p) => a + p.length, 0); const out = new Float32Array(len); let o = 0; parts.forEach((p) => { out.set(p, o); o += p.length; }); refBuf = toBuffer([out]); }
    if (refBuf) setTimeout(() => saveBlob(toWav(refBuf), 'mi_voz.wav'), 700); else toast('Crea tu voz en 🎤 Voz para descargar mi_voz.wav');
  } else if (id === 'nb') {
    saveBlob(await (await fetch('DG_Voz_IA.ipynb')).blob(), 'DG_Voz_IA.ipynb');
  } else if (id === 'import') {
    const f = await pickFile('audio/*,.wav'); if (!f) return;
    busy('Mezclando tu voz IA con el beat…');
    try {
      const v = await decode(f);
      S.mix = await renderSong(S.song, { voice: v, voiceOffset: 0, voiceSpace: 0.05 + state.voice.space * 0.4 });
      S.aiVoice = true; S.take = null; S.lastMp3 = null; S.vocals = v;
    } finally { busy(false); }
    render(); player.set(S.mix); toast('¡Voz IA aplicada!');
  }
}
void uid;
