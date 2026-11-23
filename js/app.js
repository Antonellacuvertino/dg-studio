// ===============================================================
//  DG Studio — arranque y navegación
// ===============================================================
import { $, toast, prompt, action, closeSheet } from './core/ui.js';
import { db, persist } from './core/db.js';
import { state, loadState, setArtist, on, emit } from './core/state.js';
import { unlockOnGesture, stopPreview } from './core/audio.js';
import { transport } from './studio/sequencer.js';
import { initCreate } from './views/create.js';
import { initStudio, refreshStudio } from './views/studio.js';
import { initLoops } from './views/loops.js';
import { initVoice } from './views/voice.js';
import { initAssistant } from './views/assistant.js';

const TABS = ['create', 'studio', 'loops', 'voice', 'assistant'];

function show(tab) {
  if (!TABS.includes(tab)) tab = 'create';
  closeSheet(); stopPreview();
  state.tab = tab;
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('on', v.id === `v-${tab}`));
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  emit('tab', tab);
  if (tab === 'studio') refreshStudio();
  window.scrollTo({ top: 0 });
  db.kvSet('tab', tab);
}

async function migrateOld() {
  // datos de la versión anterior (localStorage)
  try {
    const a = localStorage.getItem('dg_artist'); if (a && !(await db.kvGet('artist', null))) await db.kvSet('artist', JSON.parse(a));
    const l = localStorage.getItem('dg_lyrics'); if (l && !(await db.kvGet('lyrics', null))) await db.kvSet('lyrics', JSON.parse(l));
  } catch { /* sin datos previos */ }
}

async function boot() {
  unlockOnGesture();
  await migrateOld();
  await loadState();
  persist();
  $('artistName').textContent = state.artist;
  $('artistBtn').onclick = action(async () => {
    const v = await prompt('Nombre artístico (aparece en tus MP3 y licencias)', state.artist);
    if (v) { await setArtist(v); $('artistName').textContent = v; toast('Nombre guardado'); }
  });
  document.querySelectorAll('#tabs button').forEach((b) => (b.onclick = () => show(b.dataset.tab)));
  on('goto', show);
  // cada sección se inicia por separado: si una falla, las demás siguen funcionando
  const inits = [[initStudio, 'v-studio'], [initCreate, 'v-create'], [initLoops, 'v-loops'], [initVoice, 'v-voice'], [initAssistant, 'v-assistant']];
  for (const [fn, id] of inits) {
    try { await fn($(id)); } catch (e) { console.error(id, e); $(id).innerHTML = `<div class="card">⚠️ Esta sección no pudo cargar: ${e.message}</div>`; }
  }
  show(await db.kvGet('tab', 'create'));
  document.addEventListener('visibilitychange', () => { if (document.hidden && transport.playing) transport.stop(); });
}
boot().catch((e) => { console.error(e); toast('⚠️ Error al iniciar: ' + e.message, 6000); });

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
