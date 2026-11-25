// ===============================================================
//  Límite de descargas de la versión beta: 5 descargas y luego
//  bloqueo de 24 horas (contado desde la 5.ª descarga).
//  Se guarda en el navegador (localStorage + IndexedDB).
//  Solo se aplica en la beta (window.DG_BETA).
// ===============================================================
import { db } from './db.js';
import { sheet, toast } from './ui.js';

export const MAX_DL = 5;
export const BLOCK_MS = 24 * 60 * 60 * 1000;
const KEY = 'dgBetaDownloads';
export const quotaOn = () => !!window.DG_BETA;

const fromLS = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };
async function read() {
  const a = fromLS(); let b = null; try { b = await db.kvGet(KEY, null); } catch { /* sin IndexedDB */ }
  // se queda con el más estricto de los dos (por si borraron uno)
  let s = [a, b].filter(Boolean).sort((x, y) => (y.until || 0) - (x.until || 0) || (y.n || 0) - (x.n || 0))[0] || { n: 0, until: 0 };
  if (s.until && Date.now() >= s.until) s = { n: 0, until: 0 }; // pasaron las 24 h: se reinicia
  return s;
}
async function write(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* */ } try { await db.kvSet(KEY, s); } catch { /* */ } }

export async function downloadStatus() {
  const s = await read();
  return { left: s.until ? 0 : Math.max(0, MAX_DL - s.n), until: s.until || 0, used: s.n };
}
const when = (t) => new Date(t).toLocaleString('es', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
function wait(t) { const m = Math.max(1, Math.ceil((t - Date.now()) / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; }

// Llamar ANTES de preparar una descarga. Devuelve false (y avisa) si está bloqueada.
export async function canDownload() {
  if (!quotaOn()) return true;
  const st = await downloadStatus();
  if (st.left > 0) return true;
  await sheet('⏳ Límite de descargas de la beta', {
    text: `Ya usaste tus ${MAX_DL} descargas de la versión beta.\n\nPodrás descargar de nuevo en ${wait(st.until)} (el ${when(st.until)}).\n\nMientras tanto puedes seguir creando en el Estudio y en Loops: tus proyectos quedan guardados.`,
    options: [{ id: 'ok', label: 'Entendido', primary: true }], cancel: 'Cerrar',
  });
  return false;
}
// Llamar DESPUÉS de una descarga que sí se hizo.
export async function countDownload() {
  if (!quotaOn()) return;
  const s = await read(); s.n = (s.n || 0) + 1;
  if (s.n >= MAX_DL) s.until = Date.now() + BLOCK_MS;
  await write(s);
  const left = MAX_DL - s.n;
  toast(left > 0 ? `⬇️ Descarga lista · te quedan ${left} de ${MAX_DL} en la beta` : `⬇️ Descarga lista · era tu última: se reactivan en 24 h`, 4000);
}
