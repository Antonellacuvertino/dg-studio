// ===============================================================
//  ASISTENTE 🐆: entiende lo que quieres hacer y te guía con acciones.
//  Modo local (gratis, sin internet) + modo Claude opcional (tu clave).
// ===============================================================
import { h, toast, action, sheet, confirm, prompt } from '../core/ui.js';
import { put } from '../core/ui.js';
import { db } from '../core/db.js';
import { state, emit, on, saveVoiceSettings } from '../core/state.js';
import { GENRES, NOTE_ES } from '../engine/engine.js';
import { LOOPS } from '../studio/loops.js';
import { newScene, TECHNO, keyLabel } from '../studio/model.js';
import { currentProject, newFromStyle, addTrack, saveSoon } from './studio.js';

let root = null; let chatEl = null;
const history = []; // {role:'user'|'assistant', content}
let claudeKey = null;
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.6.0/+esm';

export async function initAssistant(el) {
  root = el; claudeKey = await db.kvGet('claudeKey', null);
  render();
  bot(`¡Hola ${state.artist}! 🐆 Soy tu asistente de producción. Cuéntame qué quieres lograr y te llevo paso a paso.\n\nPor ejemplo: "quiero hacer un hard techno oscuro a 150 para tocar en mi set" o "quiero que mi letra suene con autotune".`, [
    { label: '⛓️ Hard techno para DJ', run: () => send('quiero hacer un hard techno para dj') },
    { label: '🔥 Techno latino con voz', run: () => send('quiero un techno latino con mi voz') },
    { label: '🎤 Mi voz con autotune', run: () => send('cómo pongo autotune a mi voz') },
    { label: '🧬 Recrear una canción', run: () => send('quiero hacer algo parecido a una canción') },
  ]);
}

function render() {
  const ta = h('textarea', { placeholder: 'Escribe lo que quieres hacer…', rows: 1 });
  ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } };
  const go = () => { const v = ta.value.trim(); if (!v) return; ta.value = ''; send(v); };
  chatEl = h('div.chat');
  root.innerHTML = '';
  put(root, 
    h('div.row', { style: { marginTop: '14px' } }, h('div.avatar', {}, '🐆'),
      h('div.grow', {}, h('b', {}, 'Asistente DG'), h('div.muted.small', {}, claudeKey ? 'Modo Claude (IA) · conectado' : 'Modo guía local · gratis')),
      h('button.btn.sm', { onclick: action(settings) }, '⚙️')),
    chatEl,
    h('div.chatbar', {}, ta, h('button.btn.primary', { onclick: go }, '➤')));
  history.forEach((m) => draw(m));
}

function draw(m) {
  const el = h('div.msg.' + (m.role === 'user' ? 'me' : 'bot'), {}, m.content);
  if (m.acts && m.acts.length) el.append(h('div.acts', {}, ...m.acts.map((a) => h('button', { onclick: action(async () => { await a.run(); }) }, a.label))));
  chatEl.append(el);
  requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'end' }));
}
function bot(content, acts = []) { const m = { role: 'assistant', content, acts }; history.push(m); if (chatEl) draw(m); }
function me(content) { const m = { role: 'user', content }; history.push(m); if (chatEl) draw(m); }

async function send(text) {
  me(text);
  if (claudeKey) { try { await askClaude(text); return; } catch (e) { console.error(e); bot(`No pude hablar con Claude (${e.message}). Te respondo en modo local:`); } }
  local(text);
}

// ---------------------------------------------------------------
//  Acciones que el asistente puede ejecutar
// ---------------------------------------------------------------
const ACTIONS = {
  crear_proyecto: async (genre = 'hardtechno', bpm, mood) => {
    const G = GENRES[genre] || GENRES.hardtechno; const b = bpm ? Math.max(60, Math.min(200, +bpm)) : null;
    const p = await newFromStyle(GENRES[genre] ? genre : 'hardtechno', { bpm: b || undefined, mode: mood === 'mayor' ? 'major' : mood === 'menor' ? 'minor' : undefined, dj: TECHNO.has(genre) });
    p.guide = TECHNO.has(genre); saveSoon();
    emit('goto', 'studio');
    toast(`✨ Proyecto ${G.name} creado`);
  },
  ir: async (tab) => emit('goto', tab),
  loop: async (id) => { const l = LOOPS.find((x) => x.id === id); if (!l) return; if (!currentProject()) await newFromStyle('hardtechno'); addTrack(l.make()); emit('goto', 'studio'); },
  bpm: async (v) => { const p = currentProject(); if (!p) return; p.bpm = Math.max(60, Math.min(200, Math.round(+v))); saveSoon(); emit('project', p); emit('goto', 'studio'); toast(`Tempo: ${p.bpm} BPM`); },
  guia: async () => { const p = currentProject(); if (!p) return; p.guide = true; saveSoon(); emit('goto', 'studio'); },
  sidechain: async () => { const p = currentProject(); if (!p) return; p.tracks.forEach((t) => { if (['bass', 'pad', 'chords'].includes(t.role)) t.fx.duck = Math.max(t.fx.duck || 0, t.role === 'bass' ? 0.7 : 0.5); }); saveSoon(); emit('goto', 'studio'); toast('Sidechain aplicado a bajos, pads y acordes'); },
  drop: async () => {
    const p = currentProject(); if (!p) return;
    const all = Object.fromEntries(p.tracks.map((t) => [t.id, true]));
    const build = Object.fromEntries(p.tracks.filter((t) => t.role !== 'kick').map((t) => [t.id, true]));
    p.scenes.push(newScene('Subida', 8, build, 'build'), newScene('Drop', 32, all, 'drop'));
    saveSoon(); emit('goto', 'studio'); toast('＋ Subida (8) y Drop (32)');
  },
  autotune: async (v) => { state.voice.tune = Math.max(0, Math.min(1, +v / 100)); await saveVoiceSettings(); toast(`Autotune ${Math.round(state.voice.tune * 100)}%`); emit('goto', 'voice'); },
};

// ---------------------------------------------------------------
//  Guía local (sin internet)
// ---------------------------------------------------------------
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const GENRE_WORDS = [
  ['hardtechno', /hard ?techno|hard ?tecno|techno duro|tecno duro|schranz|hardtechno/],
  ['technolatino', /latino|edit|perreo|neoperreo|rkt|guaracha|techno con (reggaeton|dembow)/],
  ['acidtechno', /acid|acido|303/], ['melodictechno', /melodic|melodico/], ['industrial', /industrial/],
  ['hardgroove', /hardgroove|groove|tribal/], ['rave', /rave/], ['techno', /techno|tecno/],
  ['reggaeton', /reggaeton|regueton/], ['trap', /trap/], ['drill', /drill/], ['dembow', /dembow/], ['house', /house/], ['edm', /edm|festival/],
  ['pop', /\bpop\b/], ['rock', /rock/], ['reggae', /reggae/], ['cumbia', /cumbia/], ['rnb', /r&b|rnb/], ['lofi', /lo-?fi/], ['afrobeat', /afro/], ['balada', /balada/], ['hiphop', /hip ?hop|boom ?bap/],
];
function local(text) {
  const t = norm(text);
  const genre = (GENRE_WORDS.find(([, re]) => re.test(t)) || [])[0] || null;
  const bpm = (t.match(/(\d{2,3})\s*(bpm)?/) || [])[1];
  const bpmN = bpm && +bpm >= 60 && +bpm <= 200 ? +bpm : null;
  const mood = /oscur|dark|triste|nocturn/.test(t) ? 'menor' : /feliz|alegre|luminos/.test(t) ? 'mayor' : null;
  const P = currentProject();

  if (/autotune|afinar|afinad|robot|t-?pain/.test(t)) {
    const pct = (t.match(/(\d{1,3})\s*%/) || [])[1];
    return bot('Para tu voz hay dos caminos:\n\n1️⃣ Letra escrita → la app la canta con tu voz. En 🎤 Voz ajusta "Autotune": 20–40% suena natural, 80–100% es el efecto robótico del trap/reggaetón.\n2️⃣ Tu voz grabada de verdad → en 🎤 Voz → "Afinar mi grabación" la llevas a la escala del tema (sube "Velocidad" para el efecto robot).\n\nY en ✍️ Crear → "🎼 Editar melodía" subes o bajas cada sílaba a mano.', [
      ...(pct ? [{ label: `Poner autotune en ${pct}%`, run: () => ACTIONS.autotune(pct) }] : [{ label: 'Autotune natural (30%)', run: () => ACTIONS.autotune(30) }, { label: 'Autotune robot (90%)', run: () => ACTIONS.autotune(90) }]),
      { label: '🎤 Abrir Voz', run: () => ACTIONS.ir('voice') }]);
  }
  if (/mi voz|cantar|cante|letra|escrib/.test(t) && !/loop/.test(t)) {
    return bot(`¡Vamos! Así se hace una canción con tu voz${genre ? ' en ' + GENRES[genre].name : ''}:\n\n1. 🎤 Voz → "Crear mi voz" (≈45 s, una sola vez).\n2. ✍️ Crear → escribe tu letra (aunque sea corta).\n3. Elige estilo${genre ? ` (${GENRES[genre].name})` : ''} y duración — con "Normal" o "Larga" la alargo con coros, chops y ecos.\n4. ✨ Crear canción → escucha → "🎼 Editar melodía" si quieres cambiar notas.\n5. Si quieres que suene 100% real: "🧬 Voz realista con IA".`, [
      { label: '🎤 Crear mi voz', run: () => ACTIONS.ir('voice') }, { label: '✍️ Ir a Crear', run: () => ACTIONS.ir('create') }]);
  }
  if (/parecid|recrear|como la cancion|identific|analiz|igual a/.test(t)) {
    return bot('Sube el tema en 🔁 Loops → "🧬 Recrear una canción". Detecto BPM, tonalidad con clave Camelot (para mezclar en DJ), patrón de batería y estilo, y te armo un proyecto parecido —o una versión hard techno / techno latino— sin copiar el audio original.', [{ label: '🔁 Ir a Recrear', run: () => ACTIONS.ir('loops') }]);
  }
  if (/drop|subida|build|break/.test(t)) {
    return bot('Un drop pega cuando antes hay tensión:\n• Subida (8 compases): quita el bombo, sube un filtro, ruido blanco y redoble que acelera.\n• Drop (16–32): vuelve todo de golpe + platillo.\n• Break antes de la subida: solo pads/melodía, filtro cerrado.\n\nEn el Estudio cada escena tiene "✨ Efecto" (Subida, Drop, Break). ¿Te agrego una Subida + Drop al proyecto?', [{ label: '＋ Agregar Subida + Drop', run: () => ACTIONS.drop() }]);
  }
  if (/sidechain|bombeo|pump|mezcl|volumen|suena (mal|saturad|embarrad)/.test(t)) {
    return bot('Trucos de mezcla para techno:\n• Sidechain: el bajo/rumble y los pads bajan cada vez que suena el bombo → deja espacio al kick ("bombeo").\n• "Quitar graves" en hats, claps y melodías (nada más que el bombo y el bajo abajo de 150 Hz).\n• Saturación suave en el rumble para que se escuche en parlantes chicos.\n• Reverb en claps y percusión, delay en el acid/stabs.\n¿Aplico sidechain automático a bajos y pads?', [{ label: '✅ Aplicar sidechain', run: () => ACTIONS.sidechain() }]);
  }
  if (/export|usb|rekordbox|serato|traktor|pendrive|descarg/.test(t)) {
    return bot('Para tocarlo en tu set: Estudio → ⋯ Proyecto → "💿 Exportar WAV (calidad DJ)". El nombre del archivo trae el BPM y la clave Camelot (ej. 8A) para que mezcles en armonía: 8A pega con 7A, 9A y 8B.\nTip: deja intro y outro de 16–32 compases solo con batería para empalmar.', [{ label: '🧭 Abrir guía DJ', run: () => ACTIONS.guia() }]);
  }
  if (/tonalidad|camelot|clave|key|escala/.test(t)) {
    return bot(`Tu proyecto está en ${P ? keyLabel(P, NOTE_ES) : '—'}. En el Estudio → ⋯ Proyecto → "🎼 Tonalidad" la cambias y todas las notas se transponen solas. Para DJ: mezcla temas con el mismo número Camelot o ±1 (8A ↔ 7A/9A) o el mismo número con otra letra (8A ↔ 8B).`, [{ label: '🎛️ Ir al Estudio', run: () => ACTIONS.ir('studio') }]);
  }
  if (/loop|acid|rumble|bombo|kick|hat|percusion|bajo/.test(t) && !/quiero (hacer|crear|armar)/.test(t)) {
    const pick = /acid|303/.test(t) ? 'a-acid-0' : /rumble/.test(t) ? 'b-rumble-roll' : /bombo|kick/.test(t) ? (/duro|hard/.test(t) ? 'k-hard' : 'k-4x4') : /hat/.test(t) ? 'h-open-off' : /percusion|tribal/.test(t) ? 'p-tribal' : 'b-rumble-off';
    const l = LOOPS.find((x) => x.id === pick);
    return bot(`En 🔁 Loops hay kits listos que se adaptan solos al tempo y tono de tu proyecto. Te recomiendo empezar con "${l.name}".`, [{ label: `＋ Agregar "${l.name}"`, run: () => ACTIONS.loop(pick) }, { label: '🔁 Ver todos los loops', run: () => ACTIONS.ir('loops') }]);
  }
  if (bpmN && /bpm|tempo|velocidad/.test(t) && !genre) {
    return bot(`¿Pongo tu proyecto a ${bpmN} BPM?`, [{ label: `⏱ ${bpmN} BPM`, run: () => ACTIONS.bpm(bpmN) }]);
  }
  if (genre || /hacer|crear|armar|producir|track|tema|beat|set|dj/.test(t)) {
    const g = genre || (/dj|set/.test(t) ? 'hardtechno' : 'techno');
    const G = GENRES[g]; const b = bpmN || Math.round((G.bpm[0] + G.bpm[1]) / 2);
    const dj = TECHNO.has(g);
    return bot(`${G.emoji} ¡${G.name} a ${b} BPM${mood ? ', ' + (mood === 'menor' ? 'oscuro' : 'luminoso') : ''}! Te propongo:\n\n1. Creo el proyecto con kit, ${dj ? 'rumble, ' : ''}bajo y melodía en tonalidad ${mood === 'mayor' ? 'mayor' : 'menor'}${dj ? ', con estructura DJ: Intro 16 · Groove 16 · Subida 8 · Drop 32 · Break 16 · Subida 8 · Drop 32 · Outro 16' : ''}.\n2. En el Estudio prueba cada pista (▶) y cambia lo que no te guste: 🎲 genera variaciones.\n3. Suma loops (acid, percusión tribal, hats) desde 🔁 Loops.\n4. ${dj ? 'Sigue la 🧭 guía DJ y exporta en WAV para tu USB.' : 'Exporta en MP3 con tu licencia.'}`, [
      { label: `✨ Crear ${G.name} ${b} BPM`, run: () => ACTIONS.crear_proyecto(g, b, mood) },
      ...(dj ? [{ label: '🧪 + línea acid', run: () => ACTIONS.loop('a-acid-1') }] : [])]);
  }
  if (/ayuda|que puedes|como funciona|hola|empez/.test(t)) {
    return bot('Esto es lo que hay en tu estudio:\n✍️ Crear — escribe una letra o graba tu voz y sale una canción completa (beat + voz + mezcla).\n🎛️ Estudio — pistas, pasos, piano roll, escenas (intro/drop/break), mezcla con sidechain y exportación para DJ.\n🔁 Loops — kits techno listos, tus sonidos y "recrear canción".\n🎤 Voz — tu voz clonada, autotune y afinador.\nDime qué quieres lograr y te llevo.');
  }
  bot('Cuéntame un poco más: ¿qué estilo, para qué (canción con voz, track para DJ, beat para rapear) y qué onda (oscuro, bailable, rápido)?', [
    { label: '⛓️ Hard techno DJ', run: () => send('hard techno para dj') }, { label: '🎤 Canción con mi voz', run: () => send('quiero cantar mi letra') }, { label: '🧪 Acid', run: () => send('quiero hacer acid techno') }]);
}

// ---------------------------------------------------------------
//  Modo Claude (opcional, con tu propia clave de API)
// ---------------------------------------------------------------
let clientPromise = null;
async function client() {
  if (!clientPromise) clientPromise = import(SDK_URL).then((m) => new m.default({ apiKey: claudeKey, dangerouslyAllowBrowser: true }));
  return clientPromise;
}
function systemPrompt() {
  const P = currentProject();
  const genres = Object.entries(GENRES).map(([k, g]) => `${k} (${g.name}, ${g.bpm[0]}-${g.bpm[1]} BPM)`).join(', ');
  return `Eres el asistente de producción musical de DG Studio, una app web de ${state.artist}, productora/DJ que quiere hacer sobre todo techno (hard techno, techno latino con voces) para tocar en sus sets, y también canciones con su voz.
Responde siempre en español, cercano y concreto, en pocas líneas. Guía paso a paso usando las secciones de la app: ✍️ Crear (letra o voz → canción completa con voz cantada, autotune, coros, chops), 🎛️ Estudio (pistas, pasos, piano roll, escenas Intro/Subida/Drop/Break/Outro, mezcla con sidechain, exportar MP3/WAV para DJ), 🔁 Loops (kits listos, sonidos propios, recrear una canción subida), 🎤 Voz (crear su voz, autotune, afinador).
Proyecto abierto: ${P ? `"${P.name}", ${P.bpm} BPM, ${keyLabel(P, NOTE_ES)}, ${P.tracks.length} pistas (${P.tracks.map((t) => t.name).join(', ')}), escenas: ${P.scenes.map((s) => `${s.name}:${s.bars}`).join(' ')}` : 'ninguno'}.
Puedes proponer acciones que la usuaria toca como botones. Escríbelas al final, una por línea, con este formato exacto:
[[crear_proyecto|<estilo>|<bpm>|<menor o mayor>]]  estilos válidos: ${genres}
[[ir|create]] [[ir|studio]] [[ir|loops]] [[ir|voice]]
[[loop|<id>]]  ids: ${LOOPS.map((l) => l.id).join(', ')}
[[bpm|<número>]] [[guia]] [[sidechain]] [[drop]] [[autotune|<0-100>]]
No inventes otras acciones. No copies canciones de otros artistas: ayuda a crear música original inspirada en estilos.`;
}
async function askClaude(text) {
  const c = await client();
  const msgs = history.filter((m) => m.content && (m.role === 'user' || m.role === 'assistant')).slice(-16).map((m) => ({ role: m.role, content: m.raw || m.content }));
  // la conversación debe empezar con un mensaje de la usuaria
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  const thinking = h('div.msg.bot', {}, '🐆 pensando…'); chatEl.append(thinking);
  let res;
  try {
    res = await c.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: systemPrompt(),
      messages: msgs,
    });
  } finally { thinking.remove(); }
  if (res.stop_reason === 'refusal') { bot('No puedo ayudar con eso, pero cuéntame qué música quieres crear 🎶'); return; }
  const raw = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  const acts = [];
  const LABEL = { crear_proyecto: (g, b) => `✨ Crear ${(GENRES[g] || {}).name || g}${b ? ' ' + b + ' BPM' : ''}`, ir: (t) => ({ create: '✍️ Ir a Crear', studio: '🎛️ Ir al Estudio', loops: '🔁 Ir a Loops', voice: '🎤 Ir a Voz' }[t] || 'Ir'), loop: (id) => `＋ ${(LOOPS.find((l) => l.id === id) || {}).name || id}`, bpm: (v) => `⏱ ${v} BPM`, guia: () => '🧭 Guía DJ', sidechain: () => '✅ Sidechain', drop: () => '＋ Subida + Drop', autotune: (v) => `🎤 Autotune ${v}%` };
  const clean = raw.replace(/\[\[([a-z_]+)((?:\|[^\]|]*)*)\]\]/g, (_, name, args) => {
    const a = args.split('|').slice(1).map((x) => x.trim());
    if (ACTIONS[name]) acts.push({ label: LABEL[name] ? LABEL[name](...a) : name, run: () => ACTIONS[name](...a) });
    return '';
  }).trim();
  const m = { role: 'assistant', content: clean || '👍', raw, acts };
  history.push(m); draw(m);
}

async function settings() {
  const id = await sheet('⚙️ Asistente', {
    text: claudeKey ? 'Modo Claude activo: las respuestas las genera la IA Claude con tu clave de API.' : 'Ahora usas la guía local (gratis, sin internet). Puedes conectar Claude, la IA de Anthropic, para conversar libremente: necesitas una clave de API de console.anthropic.com (es de pago por uso; cada mensaje cuesta unos centavos).',
    options: claudeKey
      ? [{ id: 'off', label: '🔌 Desconectar Claude (volver a guía local)' }, { id: 'clear', label: '🧹 Borrar conversación' }]
      : [{ id: 'on', label: '🔑 Conectar Claude con mi clave', primary: true, sub: 'Se guarda solo en este dispositivo' }, { id: 'clear', label: '🧹 Borrar conversación' }],
  });
  if (id === 'on') {
    const k = await prompt('Clave de API de Anthropic', '', 'sk-ant-…');
    if (!k) return;
    if (!(await confirm('¿Guardar la clave?', 'Quedará guardada solo en este navegador. No la uses en una app publicada que otras personas puedan abrir con tu cuenta, y no compartas tu dispositivo.', 'Guardar'))) return;
    claudeKey = k; clientPromise = null; await db.kvSet('claudeKey', k); render(); toast('Claude conectado');
  } else if (id === 'off') { claudeKey = null; clientPromise = null; await db.kvSet('claudeKey', null); render(); }
  else if (id === 'clear') { history.length = 0; render(); }
}

on('project', () => { /* el contexto del proyecto se lee en cada mensaje */ });
