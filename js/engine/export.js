// ===============================================================
//  Exportar: MP3 (lamejs) con etiquetas ID3 de autoría + licencia
// ===============================================================

function id3(tags) {
  const frames = [];
  const utf16 = (s) => { const b = new Uint8Array(2 + s.length * 2); b[0] = 0xff; b[1] = 0xfe; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); b[2 + i * 2] = c & 255; b[3 + i * 2] = c >> 8; } return b; };
  const frame = (id, body) => {
    const f = new Uint8Array(10 + body.length);
    for (let i = 0; i < 4; i++) f[i] = id.charCodeAt(i);
    const n = body.length; f[4] = (n >>> 24) & 255; f[5] = (n >>> 16) & 255; f[6] = (n >>> 8) & 255; f[7] = n & 255;
    f.set(body, 10); frames.push(f);
  };
  const text = (id, s) => { if (!s) return; const u = utf16(String(s)); const b = new Uint8Array(1 + u.length); b[0] = 1; b.set(u, 1); frame(id, b); };
  text('TIT2', tags.title); text('TPE1', tags.artist); text('TPE2', tags.artist); text('TCOM', tags.artist);
  text('TALB', tags.album); text('TCON', tags.genre); text('TYER', tags.year); text('TBPM', tags.bpm);
  text('TKEY', tags.key); text('TCOP', tags.copyright); text('TENC', 'DG Studio');
  if (tags.comment) {
    const d = utf16(''), c = utf16(tags.comment);
    const b = new Uint8Array(1 + 3 + d.length + 2 + c.length); b[0] = 1; b[1] = 115; b[2] = 112; b[3] = 97; // 'spa'
    b.set(d, 4); b.set(c, 4 + d.length + 2); frame('COMM', b);
  }
  const size = frames.reduce((a, f) => a + f.length, 0);
  const h = new Uint8Array(10 + size);
  h.set([73, 68, 51, 3, 0, 0, (size >> 21) & 127, (size >> 14) & 127, (size >> 7) & 127, size & 127]);
  let o = 10; frames.forEach((f) => { h.set(f, o); o += f.length; });
  return h;
}

export async function toMp3(buffer, tags, onProgress) {
  if (!window.lamejs) throw new Error('No se pudo cargar el codificador MP3 (necesita internet la primera vez).');
  const ch = Math.min(2, buffer.numberOfChannels);
  const enc = new lamejs.Mp3Encoder(ch, buffer.sampleRate, 192);
  const L = buffer.getChannelData(0), R = ch > 1 ? buffer.getChannelData(1) : null;
  const toI16 = (src, a, b) => { const o = new Int16Array(b - a); for (let i = a; i < b; i++) { const s = Math.max(-1, Math.min(1, src[i])); o[i - a] = s < 0 ? s * 0x8000 : s * 0x7fff; } return o; };
  const parts = [id3(tags)];
  const block = 1152 * 40;
  for (let i = 0; i < L.length; i += block) {
    const e = Math.min(L.length, i + block);
    const l = toI16(L, i, e);
    const out = R ? enc.encodeBuffer(l, toI16(R, i, e)) : enc.encodeBuffer(l);
    if (out.length) parts.push(new Uint8Array(out));
    if ((i / block) % 20 === 0) { onProgress && onProgress(i / L.length); await new Promise((r) => setTimeout(r)); }
  }
  const end = enc.flush(); if (end.length) parts.push(new Uint8Array(end));
  return new Blob(parts, { type: 'audio/mpeg' });
}

export function toWav(buffer) {
  const ch = buffer.numberOfChannels, len = buffer.length, sr = buffer.sampleRate;
  const ab = new ArrayBuffer(44 + len * ch * 2); const v = new DataView(ab);
  const ws = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  ws(0, 'RIFF'); v.setUint32(4, 36 + len * ch * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); ws(36, 'data'); v.setUint32(40, len * ch * 2, true);
  const data = Array.from({ length: ch }, (_, c) => buffer.getChannelData(c));
  let o = 44; for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, data[c][i])); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
  return new Blob([ab], { type: 'audio/wav' });
}

export async function sha256(blob) {
  if (!crypto.subtle) return '(no disponible fuera de https/localhost)';
  const h = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function licenseText(info) {
  const fecha = new Date(info.date);
  return `CERTIFICADO DE AUTORÍA Y LICENCIA
=====================================

Obra:            ${info.title}
Artista / Autor: ${info.artist}
Fecha:           ${fecha.toLocaleString('es')}  (${fecha.toISOString()})
Estilo:          ${info.genre}
Tempo:           ${info.bpm} BPM
Tonalidad:       ${info.key}
Duración:        ${info.duration}
ID de beat:      DG-${info.seed}
Huella SHA-256 del archivo MP3:
${info.hash}

DECLARACIÓN
-----------
El instrumental (beat) de esta obra fue generado de forma original por
síntesis de audio dentro de la aplicación "DG Studio", propiedad de
${info.artist}. No contiene muestras (samples) de grabaciones de terceros.
${info.hasVoice ? `La voz y la letra fueron interpretadas/escritas por ${info.artist}.\n` : ''}${info.fromRef ? 'El patrón rítmico se inspiró en una canción de referencia, pero el audio fue\nre-sintetizado: no se copió ninguna grabación original.\n' : ''}${info.sung ? `La voz fue sintetizada a partir del timbre de ${info.sung}.
` : ''}${info.fromSounds ? `La batería se construyó con sonidos grabados por ${info.artist}.\n` : ''}
LICENCIA
--------
© ${fecha.getFullYear()} ${info.artist}. Todos los derechos reservados.
${info.artist} es titular de la obra y puede usarla comercialmente,
incluida su monetización en YouTube, plataformas de streaming, redes sociales
y venta, sin pagar regalías a DG Studio.

La huella SHA-256 permite demostrar que este archivo exacto existía en la
fecha indicada. Para protección legal plena, registra la obra en la oficina
de derechos de autor de tu país.
`;
}
