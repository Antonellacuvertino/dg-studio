// ===============================================================
//  Buscar canciones por nombre (catálogo público de Deezer) y
//  analizar su vista previa de 30 s: BPM, tonalidad, batería y estilo.
//  Solo se analiza: el audio no se guarda ni se reutiliza.
// ===============================================================
import { decode } from '../core/audio.js';
import { analyzeSong } from '../engine/analyze.js';

function jsonp(url, ms = 9000) {
  return new Promise((resolve, reject) => {
    const cb = 'dz' + Math.random().toString(36).slice(2);
    const s = document.createElement('script');
    const done = () => { delete window[cb]; s.remove(); clearTimeout(tm); };
    const tm = setTimeout(() => { done(); reject(new Error('Sin respuesta del catálogo de música')); }, ms);
    window[cb] = (d) => { done(); resolve(d); };
    s.onerror = () => { done(); reject(new Error('No pude conectarme al catálogo de música (¿sin internet?)')); };
    s.src = url + (url.includes('?') ? '&' : '?') + 'output=jsonp&callback=' + cb;
    document.head.append(s);
  });
}

export async function searchSong(q, limit = 5) {
  const r = await jsonp('https://api.deezer.com/search?q=' + encodeURIComponent(q) + '&limit=' + limit);
  return (r.data || []).map((t) => ({ id: t.id, title: t.title, artist: t.artist && t.artist.name, album: t.album && t.album.title, duration: t.duration, preview: t.preview, cover: t.album && t.album.cover_medium }));
}
export async function trackInfo(id) {
  const t = await jsonp('https://api.deezer.com/track/' + id);
  return { id: t.id, title: t.title, artist: t.artist && t.artist.name, album: t.album && t.album.title, year: (t.release_date || '').slice(0, 4), bpm: t.bpm ? Math.round(t.bpm) : null, duration: t.duration, preview: t.preview };
}
// Analizar la vista previa de 30 s (BPM, tono, batería, estilo)
export async function analyzePreview(url, onProgress) {
  const r = await fetch(url); if (!r.ok) throw new Error('No pude descargar la vista previa');
  const buf = await decode(await r.arrayBuffer());
  return analyzeSong(buf, onProgress);
}
