// ===============================================================
//  Audio: contexto único, iPhone, micrófono, previsualización y archivos
// ===============================================================
let ctx = null;

// iPhone: que suene aunque el interruptor de silencio esté activado
export const setSession = (type) => { try { if (navigator.audioSession) navigator.audioSession.type = type; } catch { /* no soportado */ } };

export function audio() {
  if (!ctx) { setSession('playback'); ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' }); }
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  return ctx;
}
// Desbloquear el audio con el primer toque (requisito de iOS)
export function unlockOnGesture() {
  const go = () => { audio(); window.removeEventListener('pointerdown', go, true); };
  window.addEventListener('pointerdown', go, true);
}

export async function decode(blobOrBuffer) {
  const c = audio();
  const ab = blobOrBuffer instanceof ArrayBuffer ? blobOrBuffer.slice(0) : await blobOrBuffer.arrayBuffer();
  return new Promise((res, rej) => {
    const p = c.decodeAudioData(ab, res, () => rej(new Error('No pude leer ese archivo de audio')));
    if (p && p.then) p.then(res, () => rej(new Error('No pude leer ese archivo de audio')));
  });
}

// ---------- Grabación con micrófono ----------
function pickMime() {
  const opts = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
  return opts.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
}
export async function startRecorder({ clean = false } = {}) {
  if (!navigator.mediaDevices || !window.MediaRecorder) throw new Error('Este navegador no permite grabar. En iPhone usa Safari con la app publicada (https).');
  setSession('play-and-record');
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: clean, noiseSuppression: clean, autoGainControl: false } });
  } catch (e) {
    setSession('playback');
    throw new Error(e && e.name === 'NotAllowedError' ? 'Permiso de micrófono denegado. Actívalo en Ajustes → Safari → Micrófono.' : 'No pude acceder al micrófono');
  }
  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = []; rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
  const started = new Promise((r) => (rec.onstart = () => r(performance.now())));
  rec.start(250);
  const t0 = await started;
  let stopped = null;
  const stop = () => {
    if (stopped) return stopped;
    stopped = new Promise((r) => {
      rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); setSession('playback'); r(new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' })); };
      try { rec.stop(); } catch { stream.getTracks().forEach((t) => t.stop()); setSession('playback'); r(new Blob(chunks)); }
    });
    return stopped;
  };
  // medidor de nivel
  const c = audio(); const src = c.createMediaStreamSource(stream); const an = c.createAnalyser(); an.fftSize = 512; src.connect(an);
  const buf = new Float32Array(an.fftSize);
  const level = () => { an.getFloatTimeDomainData(buf); let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v)); return m; };
  return { t0, stop, level };
}

// ---------- Previsualización (un solo sonido a la vez) ----------
let prev = null;
export function stopPreview() {
  if (prev) { const p = prev; prev = null; try { p.src.onended = null; p.src.stop(); } catch { /* ya terminó */ } p.done && p.done(); }
}
export function playPreview(buffer, { onend = null, rate = 1, loop = false, gain = 1 } = {}) {
  stopPreview();
  const c = audio(); const s = c.createBufferSource(); s.buffer = buffer; s.playbackRate.value = rate; s.loop = loop;
  const g = c.createGain(); g.gain.value = gain; s.connect(g).connect(c.destination); s.start();
  prev = { src: s, done: onend };
  s.onended = () => { if (prev && prev.src === s) { prev = null; onend && onend(); } };
  return () => { if (prev && prev.src === s) stopPreview(); };
}
export const isPreviewing = () => !!prev;

// ---------- Guardar / compartir archivos ----------
export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function shareOrSave(blob, name) {
  const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
  if (/iPhone|iPad|Android/i.test(navigator.userAgent) && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  saveBlob(blob, name);
}
export const safeName = (s) => String(s || 'cancion').replace(/[\\/:*?"<>|]/g, '').trim() || 'cancion';

// Elegir un archivo de audio
export function pickFile(accept = 'audio/*,video/*,.mp3,.m4a,.wav,.aac,.ogg,.webm,.caf,.mov,.mp4,.aif,.aiff,.flac') {
  return new Promise((resolve) => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept;
    inp.onchange = () => resolve(inp.files[0] || null);
    inp.click();
  });
}
