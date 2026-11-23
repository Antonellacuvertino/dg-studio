import { GENRES, GENRE_KEYS, NOTE_ES, renderSong, songLength } from './engine.js';
import { SOUNDS, toMono44, prepSource, finishProfile, serializeProfile, deserializeProfile, defaultProfile, planVocals, renderVocals, demoVocals, f32ToB64, b64ToF32 } from './voice.js';
import { analyzeLyrics, analyzeSong, analyzeVoice, analyzeSounds } from './analyze.js';
import { produce } from './producer.js';
import { toMp3, toWav, sha256, licenseText } from './export.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
};

// ---------------------------------------------------------------
//  Estado
// ---------------------------------------------------------------
const S = {
  artist: store.get('dg_artist', 'differentgyal'),
  genre: null,
  seed: (Math.random() * 1e9) | 0,
  voice: null,   // {buffer, info, name}
  dna: null,     // {name, dna}
  dnaChoice: null, // 'lyrics' | 'voice' | 'rhythm'
  sounds: null,  // {name, data}
  song: null, mix: null, beatOnly: null,
  take: null, takeOffset: 0, syncMs: 0,
  lastMp3: null,
  vocal: store.get('dg_vocal', 'auto'), // 'auto' | 'mine' | 'dg' | 'none'
  profile: null,
};
try { S.profile = deserializeProfile(store.get('dg_voice', null)); } catch { S.profile = null; }
let ctx;
// iPhone: que suene aunque el interruptor de silencio esté activado
const setSession = (type) => { try { if (navigator.audioSession) navigator.audioSession.type = type; } catch { /* no soportado */ } };
const audio = () => {
  if (!ctx) { setSession('playback'); ctx = new (window.AudioContext || window.webkitAudioContext)(); }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};

// ---------------------------------------------------------------
//  UI básica
// ---------------------------------------------------------------
$('artistName').textContent = S.artist;
$('lyrics').value = store.get('dg_lyrics', '');
$('lyrics').addEventListener('input', () => store.set('dg_lyrics', $('lyrics').value));

function toast(msg, ms = 2600) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), ms);
}
function busy(text) { if (text === false) { $('busy').hidden = true; return; } $('busy').hidden = false; $('busyText').textContent = text; }
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const keyName = (song) => `${NOTE_ES[song.root]} ${song.mode === 'minor' ? 'menor' : 'mayor'}`;

function sheet(title, text, options, { mono = false, input = null, grid = false } = {}) {
  return new Promise((resolve) => {
    $('sheetTitle').textContent = title;
    $('sheetText').textContent = text || ''; $('sheetText').hidden = !text; $('sheetText').className = mono ? 'mono' : '';
    const box = $('sheetOpts'); box.innerHTML = ''; box.className = 'sheet-opts' + (grid ? ' grid' : '');
    let inp;
    if (input) { inp = document.createElement('input'); inp.value = input.value || ''; inp.placeholder = input.placeholder || ''; box.appendChild(inp); setTimeout(() => inp.focus(), 50); }
    options.forEach((o) => {
      const b = document.createElement('button');
      b.innerHTML = `<b>${o.label}</b>${o.sub ? `<span>${o.sub}</span>` : ''}`;
      b.onclick = () => { close(); resolve(inp ? { id: o.id, value: inp.value } : o.id); };
      box.appendChild(b);
    });
    const close = () => { $('sheet').hidden = true; };
    $('sheetCancel').onclick = () => { close(); resolve(null); };
    $('sheet').hidden = false;
  });
}

// Botones de estilo
function renderGenres() {
  const box = $('genres'); box.innerHTML = '';
  const mk = (id, label) => {
    const b = document.createElement('button'); b.textContent = label; b.className = S.genre === id ? 'on' : '';
    b.onclick = () => { S.genre = id; renderGenres(); if (S.song) create({ keepSeed: true }); };
    box.appendChild(b);
  };
  mk(null, '🤖 Auto');
  GENRE_KEYS.forEach((g) => mk(g, `${GENRES[g].emoji} ${GENRES[g].name}`));
}
renderGenres();

async function askGenre(title) {
  const opts = [{ id: 'auto', label: '🤖 Auto', sub: 'Que elija el productor' }].concat(GENRE_KEYS.map((g) => ({ id: g, label: `${GENRES[g].emoji} ${GENRES[g].name}`, sub: `${GENRES[g].bpm[0]}–${GENRES[g].bpm[1]} BPM` })));
  const id = await sheet(title, '', opts, { grid: true });
  if (id == null) return false;
  S.genre = id === 'auto' ? null : id; renderGenres();
  return true;
}

// Quién canta la letra
const vocalProfile = () => {
  const m = S.vocal === 'auto' ? (S.profile ? 'mine' : 'dg') : S.vocal;
  if (m === 'none') return null;
  if (m === 'mine' && S.profile) return S.profile;
  return defaultProfile();
};
function updateVocalBtn() {
  const p = vocalProfile();
  $('vocalBtn').innerHTML = `🗣️ Letra cantada por: <b>${p ? (p === S.profile ? 'Mi voz' : 'Voz DG (sintética)') : 'nadie (solo beat)'}</b> ▾`;
  $('voiceState').textContent = S.profile ? 'Mi voz ✓' : 'Mi voz';
}
updateVocalBtn();
$('vocalBtn').onclick = async () => {
  const opts = [
    S.profile ? { id: 'mine', label: '🧬 Mi voz', sub: 'Tu timbre, guardado en este dispositivo' } : { id: 'create', label: '🧬 Crear mi voz (30 s)', sub: 'Analizo tu voz y la guardo para cantar tus letras' },
    { id: 'dg', label: '🤖 Voz DG (sintética)', sub: 'Voz de la app' },
    { id: 'none', label: '🔇 Sin voz', sub: 'Solo el beat; puedes grabarte encima' },
  ];
  if (S.profile) opts.push({ id: 'create', label: '🔁 Volver a grabar mi voz', sub: '' });
  const id = await sheet('¿Quién canta tu letra?', '', opts);
  if (!id) return;
  if (id === 'create') { openWizard(); return; }
  S.vocal = id; store.set('dg_vocal', id); updateVocalBtn();
  if (S.song) create();
};

// Adjuntos
function renderAttachments() {
  const box = $('attachments'); box.innerHTML = '';
  const add = (icon, label, onRemove, buf) => {
    const c = document.createElement('div'); c.className = 'chip-att';
    c.innerHTML = `<span>${icon} ${label}</span>`;
    if (buf) { const p = document.createElement('button'); p.className = 'play-mini'; p.textContent = '▶'; p.onclick = () => preview(buf, p); c.appendChild(p); }
    const x = document.createElement('button'); x.textContent = '✕'; x.onclick = () => { onRemove(); renderAttachments(); };
    c.appendChild(x); box.appendChild(c);
  };
  if (S.voice) add('🎤', `Tu voz · ${fmt(S.voice.buffer.duration)}`, () => (S.voice = null), S.voice.buffer);
  if (S.dna) add('🧬', `Ritmo de "${S.dna.name}" · ${S.dna.dna.bpm} BPM`, () => { S.dna = null; S.dnaChoice = null; });
  if (S.sounds) add('🥁', `Tus sonidos · ${S.sounds.data.hits} golpes`, () => (S.sounds = null));
  const lib = store.get('dg_dna', []);
  if (!S.dna && lib.length) {
    const b = document.createElement('button'); b.className = 'chip-att'; b.style.paddingRight = '12px';
    b.textContent = `🧬 Ritmos guardados (${lib.length})`;
    b.onclick = async () => {
      const id = await sheet('Ritmos guardados', 'Ritmos aprendidos de canciones que subiste.', lib.map((x, i) => ({ id: String(i), label: x.name, sub: `${x.dna.bpm} BPM · ${GENRES[x.dna.genre].name}` })));
      if (id == null) return;
      S.dna = { name: lib[+id].name, dna: lib[+id].dna }; S.dnaChoice = null; renderAttachments(); await askDnaChoice();
    };
    box.appendChild(b);
  }
}

let prevSrc = null;
function preview(buf, btn) {
  const c = audio();
  if (prevSrc) { try { prevSrc.stop(); } catch {} prevSrc = null; if (btn.textContent === '■') { btn.textContent = '▶'; return; } }
  stopPlayer();
  const s = c.createBufferSource(); s.buffer = buf; s.connect(c.destination); s.start();
  btn.textContent = '■'; s.onended = () => { btn.textContent = '▶'; }; prevSrc = s;
}

// ---------------------------------------------------------------
//  Grabación (voz libre o sobre el beat)
// ---------------------------------------------------------------
function pickMime() {
  const opts = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
  return opts.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
}
async function startRecorder() {
  if (!navigator.mediaDevices || !window.MediaRecorder) throw new Error('Este navegador no permite grabar. Usa Safari (iPhone) o Chrome con https / localhost.');
  setSession('play-and-record');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = []; rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const started = new Promise((r) => (rec.onstart = () => r(performance.now())));
  rec.start(250);
  const t0 = await started;
  const stopped = () => new Promise((r) => { rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); setSession('playback'); r(new Blob(chunks, { type: rec.mimeType || mime })); }; rec.stop(); });
  return { t0, stop: stopped };
}
let recTimer;
function showRec(hint, lines) {
  $('recOverlay').hidden = false; $('recHint').textContent = hint;
  const lp = $('livePrompter'); lp.innerHTML = ''; lp.hidden = !lines;
  if (lines) fillPrompter(lp, lines);
  const start = performance.now();
  recTimer = setInterval(() => { $('recTime').textContent = fmt((performance.now() - start) / 1000); }, 250);
}
function hideRec() { clearInterval(recTimer); $('recOverlay').hidden = true; $('recTime').textContent = '0:00'; }

$('recBtn').onclick = async () => {
  audio();
  let r;
  try { r = await startRecorder(); } catch (e) { toast(e.message || 'No pude acceder al micrófono'); return; }
  showRec('Canta, rapea o haz sonidos (boom, tss, pa)…');
  $('stopBtn').onclick = async () => {
    hideRec();
    const blob = await r.stop();
    await handleAudio(blob, 'Grabación', true);
  };
};

$('fileIn').onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (f) await handleAudio(f, f.name.replace(/\.[^.]+$/, ''), false);
};

async function decode(blob) {
  const c = audio();
  const ab = await blob.arrayBuffer();
  return await new Promise((res, rej) => { const p = c.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
}

async function handleAudio(blob, name, recorded) {
  let buf;
  try { busy('Abriendo audio…'); buf = await decode(blob); } catch { busy(false); toast('No pude leer ese archivo de audio'); return; } finally { busy(false); }
  if (buf.duration < 0.4) { toast('El audio es demasiado corto'); return; }
  const opts = [
    { id: 'voice', label: '🎤 Es mi voz', sub: 'Cantando o rapeando: le hago un beat a tu medida y la mezclo' },
    { id: 'clone', label: '🧬 Quiero que aprendas mi voz', sub: 'Te guío con 7 sonidos para cantar tus letras escritas' },
    { id: 'sounds', label: '🥁 Son sonidos para un ritmo', sub: 'Beatbox, palmas, golpes: los convierto en una batería' },
  ];
  if (!recorded) opts.splice(1, 0, { id: 'song', label: '🎵 Es una canción', sub: 'Aprendo su ritmo (BPM, tono, batería) y lo guardo' });
  const kind = await sheet('¿Qué es este audio?', `${name} · ${fmt(buf.duration)}`, opts);
  if (!kind) return;
  if (kind === 'clone') { openWizard(); return; }
  if ((kind === 'voice' || kind === 'sounds') && !(await askGenre(kind === 'voice' ? '¿Qué estilo le pongo a tu voz?' : '¿Qué estilo quieres con tu ritmo?'))) return;
  try {
    if (kind === 'voice') {
      busy('Escuchando tu voz…');
      const info = await analyzeVoice(buf, busy);
      S.voice = { buffer: buf, info, name };
      busy(false); renderAttachments();
      toast(info.singing ? 'Voz cantada detectada 🎶' : 'Flow detectado 🎤');
      if (!S.dna) await create();
    } else if (kind === 'sounds') {
      busy('Separando tus sonidos…');
      const data = await analyzeSounds(buf, busy);
      S.sounds = { name, data };
      busy(false); renderAttachments();
      toast(`${data.hits} golpes · ${data.bpm} BPM`);
      await create();
    } else if (kind === 'song') {
      busy('Analizando la canción…');
      const dna = await analyzeSong(buf, busy);
      S.dna = { name, dna };
      const lib = store.get('dg_dna', []); lib.unshift({ name, dna, date: Date.now() }); store.set('dg_dna', lib.slice(0, 30));
      busy(false); renderAttachments();
      await askDnaChoice();
    }
  } catch (e) { busy(false); console.error(e); toast(e.message || 'Algo falló analizando el audio'); }
}

async function askDnaChoice() {
  const d = S.dna.dna;
  const ch = await sheet('Guardé el ritmo de la canción 🧬',
    `${d.bpm} BPM · ${NOTE_ES[d.root]} ${d.mode === 'minor' ? 'menor' : 'mayor'} · suena a ${GENRES[d.genre].name}\n¿Qué quieres que haga?`, [
      { id: 'rhythm', label: '🥁 Una canción con el ritmo de esta música', sub: 'Re-sintetizo su groove (sin copiar el audio) y le pongo tu letra o voz' },
      { id: 'lyrics', label: '📝 Un beat nuevo para mi letra', sub: 'Ignoro esta canción y produzco según lo que escribiste' },
      { id: 'voice', label: '🎤 Un beat nuevo para mi audio', sub: 'Produzco según tu voz grabada' },
    ]);
  if (!ch) return;
  if (ch === 'lyrics' && !$('lyrics').value.trim()) { S.dnaChoice = ch; $('lyrics').focus(); toast('Escribe tu letra y toca ✨ Crear'); return; }
  if (ch === 'voice' && !S.voice) { S.dnaChoice = ch; toast('Graba o sube tu voz y toca ✨ Crear'); return; }
  S.dnaChoice = ch; await create();
}

// ---------------------------------------------------------------
//  Crear canción
// ---------------------------------------------------------------
$('createBtn').onclick = () => create();
$('againBtn').onclick = () => { S.seed = (Math.random() * 1e9) | 0; create({ variation: true }); };

async function create({ variation = false } = {}) {
  audio(); stopPlayer();
  const text = $('lyrics').value.trim();
  const L = text ? analyzeLyrics(text) : null;
  if (!L && !S.voice && !S.dna && !S.sounds) { toast('Escribe una letra, graba tu voz o sube un audio'); $('lyrics').focus(); return; }
  if (S.dna && !S.dnaChoice) { await askDnaChoice(); return; }
  const useDna = S.dna && S.dnaChoice === 'rhythm';
  const useL = S.dna && S.dnaChoice === 'voice' ? null : L;
  const useV = S.dna && S.dnaChoice === 'lyrics' ? null : S.voice;

  busy('El productor está escuchando…');
  await new Promise((r) => setTimeout(r, 30));
  try {
    const song = produce({ lyrics: useL, voice: useV, dna: useDna ? S.dna.dna : null, sounds: S.sounds ? S.sounds.data : null, genre: S.genre, seed: S.seed, variation });
    busy(`Produciendo ${GENRES[song.genre].emoji} ${GENRES[song.genre].name} · ${song.bpm} BPM…`);
    let voiceOpt = useV ? { voice: useV.buffer, voiceOffset: song.voiceOffset } : {};
    const prof = !useV && useL ? vocalProfile() : null;
    if (prof) {
      busy(`🗣️ Cantando tu letra con ${prof === S.profile ? 'tu voz' : 'la Voz DG'}…`);
      await new Promise((r) => setTimeout(r, 30));
      const notes = planVocals(song, prof);
      voiceOpt = { voice: renderVocals(notes, prof, songLength(song) + 1), voiceOffset: 0 };
      S.guide = voiceOpt.voice;
      busy(`Mezclando ${GENRES[song.genre].emoji} ${GENRES[song.genre].name} · ${song.bpm} BPM…`);
    }
    const mix = await renderSong(song, voiceOpt);
    S.song = song; S.mix = mix; S.beatOnly = voiceOpt.voice ? null : mix; S.take = null; S.lastMp3 = null; S.syncMs = 0;
    S.hasVoice = !!voiceOpt.voice; S.fromRef = !!useDna; S.fromSounds = !!S.sounds;
    S.sung = prof ? (prof === S.profile ? S.artist : 'la Voz DG de la app') : null;
    if (!prof) S.guide = null;
    S.aiVoice = false;
    showResult(L);
  } catch (e) { console.error(e); toast('Error produciendo: ' + (e.message || e)); }
  busy(false);
}

function showResult(L) {
  const song = S.song; const G = GENRES[song.genre];
  $('result').hidden = false;
  if (!$('title').value || $('title').dataset.auto === '1') {
    $('title').value = (L && L.lines[0] ? L.lines[0].text.replace(/[^\p{L}\p{N} ¿?¡!']/gu, '').slice(0, 40) : `${G.name} ${song.bpm}`) || 'Mi canción';
    $('title').dataset.auto = '1';
  }
  $('title').oninput = () => ($('title').dataset.auto = '0');
  const final = currentAudio();
  $('meta').innerHTML = [
    `${G.emoji} ${G.name}`, `${song.bpm} BPM`, keyName(song), fmt(final.duration),
    S.take ? '🎤 tu toma' : S.aiVoice ? '🧬 tu voz (IA)' : S.sung ? (S.sung === S.artist ? '🧬 canta tu voz' : '🤖 canta Voz DG') : S.hasVoice ? '🎤 con voz' : '🎹 instrumental', S.fromSounds ? '🥁 tus sonidos' : '', S.fromRef ? '🧬 ritmo de referencia' : '',
  ].filter(Boolean).map((t) => `<span>${t}</span>`).join('');
  $('why').textContent = song.why.length ? '🎧 ' + song.why.join(' · ') : '🎧 Estilo elegido por el productor automático';
  $('syncBox').hidden = !S.take;
  $('aiBtn').hidden = !S.guide || !!S.take;
  $('aiBtn').textContent = S.aiVoice ? '🧬 Voz IA aplicada ✓ (cambiar)' : '🧬 Voz realista (IA)';
  fillPrompter($('prompter'), song.timeline);
  drawWave(final);
  $('takeBtn').textContent = S.take ? '🎙️ Grabar otra toma' : '🎙️ Grabar sobre el beat';
  $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
const currentAudio = () => S.mix;

function fillPrompter(el, timeline) {
  el.innerHTML = '';
  let sec = null;
  const colors = getComputedStyle(document.documentElement).getPropertyValue('--rh').split(',').map((s) => s.trim());
  timeline.forEach((ln, i) => {
    if (ln.section !== sec) { sec = ln.section; const h = document.createElement('li'); h.className = 'sec'; h.textContent = { verse: 'Verso', chorus: 'Coro', bridge: 'Puente' }[sec] || sec; el.appendChild(h); }
    const li = document.createElement('li'); li.dataset.i = i;
    const letter = ln.rhyme >= 0 ? String.fromCharCode(65 + (ln.rhyme % 26)) : '';
    li.innerHTML = `<span class="t">${fmt(ln.time)}</span><span class="rh" style="color:${colors[ln.rhyme % colors.length] || 'transparent'}">${letter}</span><span>${escapeHtml(ln.text)}</span>`;
    el.appendChild(li);
  });
}
const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function highlight(el, t) {
  const tl = S.song ? S.song.timeline : []; let cur = -1;
  for (let i = 0; i < tl.length; i++) if (tl[i].time <= t + 0.05) cur = i;
  el.querySelectorAll('li[data-i]').forEach((li) => {
    const on = +li.dataset.i === cur;
    if (on && !li.classList.contains('now')) { li.classList.add('now'); if (el.classList.contains('live')) li.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    else if (!on) li.classList.remove('now');
  });
}

// ---------------------------------------------------------------
//  Reproductor
// ---------------------------------------------------------------
const P = { src: null, start: 0, offset: 0, playing: false, raf: 0 };
function stopPlayer() {
  if (P.src) { P.src.onended = null; try { P.src.stop(); } catch {} P.src = null; }
  if (P.playing) P.offset = Math.min(currentAudio()?.duration || 0, ctx.currentTime - P.start);
  P.playing = false; cancelAnimationFrame(P.raf); $('playBtn').textContent = '▶';
}
function play(from = P.offset) {
  const c = audio(); const buf = currentAudio(); if (!buf) return;
  if (prevSrc) { try { prevSrc.stop(); } catch {} prevSrc = null; }
  stopPlayer();
  if (from >= buf.duration - 0.05) from = 0;
  const s = c.createBufferSource(); s.buffer = buf; s.connect(c.destination); s.start(0, from);
  P.src = s; P.start = c.currentTime - from; P.playing = true; $('playBtn').textContent = '❚❚';
  s.onended = () => { P.playing = false; P.offset = 0; $('playBtn').textContent = '▶'; drawWave(buf, 0); };
  const tick = () => { if (!P.playing) return; const t = c.currentTime - P.start; drawWave(buf, t / buf.duration); $('time').textContent = `${fmt(t)} / ${fmt(buf.duration)}`; highlight($('prompter'), t); P.raf = requestAnimationFrame(tick); };
  tick();
}
$('playBtn').onclick = () => (P.playing ? stopPlayer() : play());
$('wave').onclick = (e) => { const b = currentAudio(); if (!b) return; const r = e.currentTarget.getBoundingClientRect(); P.offset = ((e.clientX - r.left) / r.width) * b.duration; play(P.offset); };

let peaksCache = { buf: null, w: 0, peaks: null };
function drawWave(buf, prog = 0) {
  const cv = $('wave'); const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth * dpr, h = cv.clientHeight * dpr; if (!w) return;
  if (cv.width !== w) { cv.width = w; cv.height = h; }
  if (peaksCache.buf !== buf || peaksCache.w !== w) {
    const d = buf.getChannelData(0); const bars = Math.floor(w / (3 * dpr)); const per = Math.floor(d.length / bars); const pk = new Float32Array(bars);
    for (let i = 0; i < bars; i++) { let m = 0; for (let j = i * per; j < (i + 1) * per; j += 16) m = Math.max(m, Math.abs(d[j])); pk[i] = m; }
    peaksCache = { buf, w, peaks: pk };
  }
  const g = cv.getContext('2d'); g.clearRect(0, 0, w, h);
  const pk = peaksCache.peaks; const bw = w / pk.length;
  const grad = g.createLinearGradient(0, 0, w, 0); grad.addColorStop(0, '#ff3d8b'); grad.addColorStop(1, '#7c4dff');
  pk.forEach((v, i) => { const bh = Math.max(2 * dpr, v * h * 0.9); g.fillStyle = i / pk.length <= prog ? grad : '#3a3850'; g.fillRect(i * bw, (h - bh) / 2, bw * 0.6, bh); });
  if (!P.playing) $('time').textContent = fmt(buf.duration);
}
addEventListener('resize', () => S.mix && drawWave(S.mix));

// ---------------------------------------------------------------
//  Grabar sobre el beat (estudio)
// ---------------------------------------------------------------
$('takeBtn').onclick = async () => {
  if (!S.song) return;
  const c = audio(); stopPlayer();
  if (!S.beatOnly) { busy('Preparando pista instrumental…'); S.beatOnly = await renderSong(S.song); busy(false); }
  const go = await sheet('Grabar sobre el beat 🎧', 'Usa audífonos para que el beat no se cuele en el micrófono. La letra se irá marcando a tiempo.', [{ id: 'go', label: '🔴 Empezar a grabar' }]);
  if (!go) return;
  let r;
  try { r = await startRecorder(); } catch (e) { toast(e.message || 'No pude acceder al micrófono'); return; }
  const startAt = c.currentTime + 0.15;
  const beatPerf = performance.now() + 150;
  const s = c.createBufferSource(); s.buffer = S.beatOnly; s.connect(c.destination); s.start(startAt);
  showRec('Grabando sobre el beat…', S.song.timeline);
  let raf; const tick = () => { highlight($('livePrompter'), c.currentTime - startAt); raf = requestAnimationFrame(tick); }; tick();
  const finish = async () => {
    cancelAnimationFrame(raf); s.onended = null; try { s.stop(); } catch {}
    hideRec();
    const blob = await r.stop();
    busy('Mezclando tu voz con el beat…');
    try {
      const take = await decode(blob);
      const lat = (c.outputLatency || 0.04) + (c.baseLatency || 0.01) + 0.03;
      S.take = take; S.takeOffset = (r.t0 - beatPerf) / 1000 - lat;
      await remixTake();
      showResult(null);
      toast('¡Toma lista! Escúchala y descarga el MP3');
    } catch (e) { console.error(e); toast('No pude procesar la grabación'); }
    busy(false);
  };
  $('stopBtn').onclick = finish;
  s.onended = finish;
};
async function remixTake() {
  S.mix = await renderSong(S.song, { voice: S.take, voiceOffset: S.takeOffset + S.syncMs / 1000 });
  S.hasVoice = true; S.sung = null; S.lastMp3 = null;
}
$('sync').oninput = () => ($('syncVal').textContent = `${$('sync').value} ms`);
$('syncApply').onclick = async () => { S.syncMs = -(+$('sync').value); busy('Re-sincronizando…'); await remixTake(); busy(false); showResult(null); };

// ---------------------------------------------------------------
//  Descargar MP3 + licencia
// ---------------------------------------------------------------
function tags() {
  const song = S.song; const y = new Date().getFullYear();
  return {
    title: $('title').value || 'Mi canción', artist: S.artist, album: `${S.artist} — DG Studio`, genre: GENRES[song.genre].name,
    year: String(y), bpm: String(song.bpm), key: `${['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][song.root]}${song.mode === 'minor' ? 'm' : ''}`,
    copyright: `℗ © ${y} ${S.artist}. Todos los derechos reservados.`,
    comment: `Producido por ${S.artist} con DG Studio. Beat original sintetizado, ID DG-${song.seed}.`,
  };
}
async function buildMp3() {
  if (S.lastMp3) return S.lastMp3;
  busy('Creando MP3…');
  try {
    const blob = await toMp3(currentAudio(), tags(), (p) => busy(`Creando MP3… ${Math.round(p * 100)}%`));
    S.lastMp3 = blob; return blob;
  } finally { busy(false); }
}
const fileName = (ext) => `${S.artist} - ${($('title').value || 'cancion').replace(/[\\/:*?"<>|]/g, '')}.${ext}`;
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
async function shareOrSave(blob, name, type) {
  const file = new File([blob], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  saveBlob(blob, name);
}
$('mp3Btn').onclick = async () => {
  if (!S.song) return; stopPlayer();
  let blob;
  try { blob = await buildMp3(); } catch (e) {
    const w = await sheet('MP3 no disponible', (e.message || '') + '\n¿Descargar en WAV (calidad máxima)?', [{ id: 'wav', label: '⬇️ Descargar WAV' }]);
    if (w) saveBlob(toWav(currentAudio()), fileName('wav'));
    return;
  }
  await shareOrSave(blob, fileName('mp3'), 'audio/mpeg');
};
$('licBtn').onclick = async () => {
  if (!S.song) return; stopPlayer();
  let blob; try { blob = await buildMp3(); } catch { blob = toWav(currentAudio()); }
  const t = tags();
  const txt = licenseText({
    title: t.title, artist: S.artist, date: Date.now(), genre: t.genre, bpm: S.song.bpm, key: keyName(S.song),
    duration: fmt(currentAudio().duration), seed: S.song.seed, hash: await sha256(blob),
    hasVoice: S.hasVoice && !S.sung, sung: S.sung, fromRef: S.fromRef, fromSounds: S.fromSounds,
  });
  const ch = await sheet('Licencia de autoría 📜', txt, [{ id: 'save', label: '⬇️ Guardar certificado (.txt)' }], { mono: true });
  if (ch) await shareOrSave(new Blob([txt], { type: 'text/plain' }), fileName('licencia.txt'), 'text/plain');
};

// ---------------------------------------------------------------
//  Asistente: analizar y guardar MI voz
// ---------------------------------------------------------------
const REF_TEXT = 'Hola, soy differentgyal. Estoy grabando mi voz para crear mis canciones. Me gusta la música, el ritmo y la calle; cuando canto siento que todo puede cambiar, y por eso nunca me rindo.';
const WIZ = {
  a: ['A', 'Di "aaaaa" sostenido, como cantando una nota larga.'], e: ['E', 'Ahora "eeeee", parejo y en el mismo tono.'],
  i: ['I', '"iiiii" sostenido.'], o: ['O', '"ooooo" sostenido.'], u: ['U', '"uuuuu" sostenido.'],
  m: ['M', 'Tararea con la boca cerrada: "mmmmm".'], s: ['S', 'Un siseo suave: "sssss".'],
  ref: ['🎙️', 'Último paso (para la voz realista con IA): lee en voz alta, con tu forma natural de cantar o hablar:\n"' + REF_TEXT + '"'],
};
const STEPS = [...SOUNDS, 'ref'];
let wizSources = {}, wizIdx = 0;
function wizRender() {
  const k = STEPS[wizIdx];
  $('wizSteps').innerHTML = STEPS.map((x, i) => `<span class="${wizSources[x] ? 'done' : i === wizIdx ? 'cur' : ''}">${x === 'ref' ? '🎙' : x}</span>`).join('');
  if (k) {
    $('wizBig').textContent = WIZ[k][0]; $('wizHint').textContent = WIZ[k][1]; $('wizRec').hidden = false;
    $('wizRec').textContent = k === 'ref' ? '🔴 Grabar 15 segundos' : `🔴 Grabar "${k.repeat(4)}"`;
  }
}
function openWizard() {
  wizSources = {}; wizIdx = 0; $('wizMeter').style.width = '0';
  $('wizTest').hidden = !S.profile; $('wiz').hidden = false; wizRender();
}
// referencia de voz real (para la IA), guardada aparte a 22,05 kHz
const REF_SR = 22050;
function loadRef() { const b = store.get('dg_voice_ref', null); return b ? b64ToF32(b) : null; }
function saveRef(x44) { const d = new Float32Array(Math.floor(x44.length / 2)); for (let i = 0; i < d.length; i++) d[i] = (x44[2 * i] + x44[2 * i + 1]) / 2; store.set('dg_voice_ref', f32ToB64(d)); return !!store.get('dg_voice_ref', null); }
$('voiceBtn').onclick = openWizard;
$('wizClose').onclick = () => { $('wiz').hidden = true; };
$('wizTest').onclick = () => { const p = S.profile || defaultProfile(); preview(demoVocals(p), $('wizTest')); };
$('wizRec').onclick = async () => {
  if (!$('wizConsent').checked) { toast('Marca la casilla: solo se puede crear con tu propia voz'); return; }
  const k = STEPS[wizIdx]; audio();
  let r; try { r = await startRecorder(); } catch (e) { toast(e.message || 'No pude acceder al micrófono'); return; }
  $('wizRec').disabled = true; $('wizRec').textContent = '● Grabando…';
  const t0 = performance.now(); const DUR = k === 'ref' ? 15000 : 2600;
  await new Promise((res) => { const iv = setInterval(() => { const p = (performance.now() - t0) / DUR; $('wizMeter').style.width = `${Math.min(100, p * 100)}%`; if (p >= 1) { clearInterval(iv); res(); } }, 60); });
  const blob = await r.stop(); $('wizRec').disabled = false;
  try {
    const x = await toMono44(await decode(blob));
    if (k === 'ref') {
      let e = 0; for (let i = 0; i < x.length; i += 8) e += x[i] * x[i];
      if (Math.sqrt(e / (x.length / 8)) < 0.01) { wizRender(); $('wizHint').textContent = 'Casi no te escuché 😕 Habla más cerca del micrófono y repite.'; return; }
      if (!saveRef(x)) toast('No hubo espacio para guardar la referencia');
      wizSources.ref = true;
    } else {
      const src = prepSource(x, k !== 's');
      if (!src) { wizRender(); $('wizHint').textContent = 'No te escuché bien 😕 Acércate al micrófono y mantén el sonido más fuerte y parejo.'; return; }
      wizSources[k] = src;
      if (wizIdx === SOUNDS.length - 1) {
        S.profile = finishProfile(wizSources, S.artist);
        store.set('dg_voice', serializeProfile(S.profile));
        if (!store.get('dg_voice', null)) toast('Tu voz quedó lista para esta sesión, pero no hubo espacio para guardarla');
        S.vocal = 'mine'; store.set('dg_vocal', 'mine'); updateVocalBtn();
      }
    }
    wizIdx++;
  } catch (e) { console.error(e); toast('No pude procesar la grabación'); wizRender(); return; }
  $('wizMeter').style.width = '0';
  if (wizIdx < STEPS.length) { wizRender(); return; }
  wizRender(); $('wizBig').textContent = '✓'; $('wizRec').hidden = true; $('wizTest').hidden = false;
  $('wizHint').textContent = '¡Tu voz quedó guardada en este dispositivo! Escribe una letra y toca ✨ Crear canción.';
};

// ---------------------------------------------------------------
//  Voz realista con IA (Seed-VC en Google Colab)
// ---------------------------------------------------------------
function refBuffer() {
  const d = loadRef();
  if (d) { const b = new AudioBuffer({ length: d.length, numberOfChannels: 1, sampleRate: REF_SR }); b.copyToChannel(d, 0); return b; }
  if (!S.profile) return null;
  // sin referencia leída: unir las vocales grabadas
  const parts = SOUNDS.filter((k) => S.profile.sources[k] && !S.profile.sources[k].noise).map((k) => S.profile.sources[k].data);
  const len = parts.reduce((a, p) => a + p.length, 0); const out = new Float32Array(len); let o = 0;
  parts.forEach((p) => { out.set(p, o); o += p.length; });
  const b = new AudioBuffer({ length: len, numberOfChannels: 1, sampleRate: 44100 }); b.copyToChannel(out, 0); return b;
}
$('aiBtn').onclick = async () => {
  if (!S.guide) return; stopPlayer();
  const hasRef = !!loadRef();
  const id = await sheet('🧬 Voz realista con IA',
    `Una IA gratis (Seed-VC en Google Colab, con GPU de Google) le pone el timbre real de tu voz a esta canción.\n\n1. Descarga los archivos.\n2. Abre colab.research.google.com → Archivo → Subir cuaderno → DG_Voz_IA.ipynb. Elige GPU (T4) y ejecuta las celdas.\n3. Descarga voz_ia.wav e impórtala aquí.${hasRef ? '' : '\n\n⚠️ Aún no grabaste tu referencia de 15 s (🗣️ Mi voz → último paso). Usaré tus vocales grabadas, pero el resultado mejora mucho con la referencia.'}`, [
      { id: 'files', label: '⬇️ 1. Descargar voz guía + mi voz', sub: 'voz_guia.wav y mi_voz.wav' },
      { id: 'nb', label: '📓 2. Descargar cuaderno de Colab', sub: 'DG_Voz_IA.ipynb (solo la primera vez)' },
      { id: 'import', label: '📥 3. Importar voz IA', sub: 'El archivo voz_ia.wav que te devuelve Colab' },
      ...(S.aiVoice ? [{ id: 'undo', label: '↩️ Volver a la voz sintética', sub: '' }] : []),
    ]);
  if (id === 'files') {
    const ref = refBuffer();
    if (!ref) { toast('Primero crea tu voz en 🗣️ Mi voz'); openWizard(); return; }
    saveBlob(toWav(S.guide), 'voz_guia.wav');
    setTimeout(() => saveBlob(toWav(ref), 'mi_voz.wav'), 700);
  } else if (id === 'nb') {
    const res = await fetch('DG_Voz_IA.ipynb'); saveBlob(await res.blob(), 'DG_Voz_IA.ipynb');
  } else if (id === 'import') {
    $('aiIn').click();
  } else if (id === 'undo') {
    busy('Volviendo a la voz sintética…');
    S.mix = await renderSong(S.song, { voice: S.guide, voiceOffset: 0 }); S.aiVoice = false; S.lastMp3 = null;
    busy(false); showResult(null);
  }
};
$('aiIn').onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f || !S.song) return;
  busy('Mezclando tu voz IA con el beat…');
  try {
    const v = await decode(f);
    if (Math.abs(v.duration - S.guide.duration) > 3) toast('Ojo: este audio no dura lo mismo que la voz guía; puede quedar desfasado');
    S.mix = await renderSong(S.song, { voice: v, voiceOffset: 0 });
    S.aiVoice = true; S.sung = S.artist + ' (convertida con IA Seed-VC)'; S.lastMp3 = null;
    showResult(null); toast('¡Voz IA aplicada! Escúchala y descarga el MP3');
  } catch (err) { console.error(err); toast('No pude leer ese archivo'); }
  busy(false);
};

// Nombre artístico
$('artistBtn').onclick = async () => {
  const r = await sheet('Nombre artístico', 'Aparece en el MP3 y en la licencia.', [{ id: 'ok', label: 'Guardar' }], { input: { value: S.artist } });
  if (r && r.value.trim()) { S.artist = r.value.trim(); store.set('dg_artist', S.artist); $('artistName').textContent = S.artist; S.lastMp3 = null; }
};

// PWA offline
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
renderAttachments();
