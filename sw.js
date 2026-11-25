// Service worker: primero red; si no hay conexión, usa la copia guardada.
const CACHE = 'dg-studio-v9';
const SHELL = ['./', 'index.html', 'css/app.css', 'manifest.json', 'DG_Voz_IA.ipynb',
  'js/app.js', 'js/core/ui.js', 'js/core/db.js', 'js/core/audio.js', 'js/core/state.js',
  'js/engine/engine.js', 'js/engine/synth.js', 'js/engine/analyze.js', 'js/engine/producer.js', 'js/engine/export.js',
  'js/voice/voice.js', 'js/voice/tune.js', 'js/voice/arrange.js', 'js/voice/profile.js',
  'js/studio/model.js', 'js/studio/mixer.js', 'js/studio/sequencer.js', 'js/studio/loops.js', 'js/studio/samples.js',
  'js/views/shared.js', 'js/views/beatgrid.js', 'js/views/soundpicker.js', 'js/views/voicetypes.js', 'js/views/multitrack.js', 'js/views/voiceeditor.js', 'js/views/recordercard.js', 'js/multi/engine.js', 'js/multi/send.js', 'js/core/recorder.js', 'js/voice/fx.js', 'js/studio/songkit.js', 'js/studio/recipes.js', 'js/studio/library.js', 'samples/index.json', 'js/views/create.js', 'js/views/studio.js', 'js/views/loops.js', 'js/views/voice.js', 'js/views/assistant.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || e.request.url.includes('api.anthropic.com')) return;
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
