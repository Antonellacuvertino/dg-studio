// ===============================================================
//  UI: utilidades de interfaz compartidas por todas las secciones
// ===============================================================
export const $ = (id) => document.getElementById(id);
export const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Crear elementos: h('button.cls#id', {onclick, title}, 'texto', hijo...)
export function h(tag, attrs = {}, ...kids) {
  const m = tag.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
  const el = document.createElement(m[1] || 'div');
  (m[2].match(/[.#][\w-]+/g) || []).forEach((p) => (p[0] === '.' ? el.classList.add(p.slice(1)) : (el.id = p.slice(1))));
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'value' && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) el.value = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && k !== 'list' && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach((k) => k != null && k !== false && el.append(k.nodeType ? k : document.createTextNode(k)));
  return el;
}

// ---------- Aviso breve ----------
let toastT;
export function toast(msg, ms = 2800) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), ms);
}

// ---------- Pantalla de "trabajando" ----------
let busyDepth = 0;
export function busy(text) {
  if (text === false) { busyDepth = Math.max(0, busyDepth - 1); if (!busyDepth) $('busy').hidden = true; return; }
  if ($('busy').hidden) busyDepth = 0;
  busyDepth++; $('busy').hidden = false; $('busyText').textContent = text;
}
export const busyText = (text) => { if (!$('busy').hidden) $('busyText').textContent = text; };

// ---------- Candado: evita dobles toques y muestra errores ----------
let locked = false;
export function action(fn, { busyMsg = null } = {}) {
  return async (...args) => {
    if (locked) { toast('Espera, estoy terminando lo anterior…', 1500); return; }
    locked = true; document.body.classList.add('locked');
    if (busyMsg) busy(busyMsg);
    try { return await fn(...args); } catch (e) {
      console.error(e); toast('⚠️ ' + (e && e.message ? e.message : 'Algo falló'), 4000);
    } finally {
      if (busyMsg) busy(false);
      locked = false; document.body.classList.remove('locked');
    }
  };
}
export const isLocked = () => locked;

// ---------- Hoja de opciones (modal inferior) ----------
let sheetResolve = null;
export function sheet(title, { text = '', options = [], input = null, grid = false, body = null, mono = false, cancel = 'Cancelar' } = {}) {
  if (sheetResolve) { sheetResolve(null); sheetResolve = null; }
  return new Promise((resolve) => {
    sheetResolve = resolve;
    $('sheetTitle').textContent = title;
    const tx = $('sheetText'); tx.textContent = text; tx.hidden = !text; tx.className = mono ? 'mono' : '';
    const box = $('sheetBody'); box.innerHTML = ''; box.className = 'sheet-opts' + (grid ? ' grid' : '');
    let inp = null;
    if (body) box.append(body);
    if (input) {
      inp = h(input.multiline ? 'textarea' : 'input', { value: input.value || '', placeholder: input.placeholder || '', type: input.type || 'text' });
      if (input.multiline) inp.rows = 4;
      box.append(inp); setTimeout(() => inp.focus(), 60);
    }
    const done = (v) => { if (sheetResolve !== resolve) return; sheetResolve = null; $('sheet').hidden = true; resolve(v); };
    options.forEach((o) => {
      const b = h('button' + (o.danger ? '.danger' : '') + (o.primary ? '.primary' : ''), { type: 'button' },
        h('b', {}, o.label), o.sub ? h('span', {}, o.sub) : null);
      b.onclick = () => done(inp ? { id: o.id, value: inp.value } : o.id);
      box.append(b);
    });
    $('sheetCancel').textContent = cancel;
    $('sheetCancel').onclick = () => done(null);
    $('sheet').onclick = (e) => { if (e.target === $('sheet')) done(null); };
    $('sheet').hidden = false;
  });
}
export const closeSheet = () => { if (sheetResolve) { const r = sheetResolve; sheetResolve = null; $('sheet').hidden = true; r(null); } };

export async function confirm(title, text, yes = 'Sí', danger = false) {
  return (await sheet(title, { text, options: [{ id: 'yes', label: yes, danger, primary: !danger }] })) === 'yes';
}
export async function prompt(title, value = '', placeholder = '') {
  const r = await sheet(title, { input: { value, placeholder }, options: [{ id: 'ok', label: 'Guardar', primary: true }] });
  return r ? r.value.trim() : null;
}

// ---------- Deslizadores con etiqueta ----------
export function slider(label, value, { min = 0, max = 1, step = 0.01, fmt: f = (v) => Math.round(v * 100) + '%', oninput, onchange } = {}) {
  const val = h('span.sval', {}, f(value));
  const inp = h('input', { type: 'range', min, max, step, value });
  inp.addEventListener('input', () => { val.textContent = f(+inp.value); oninput && oninput(+inp.value); });
  if (onchange) inp.addEventListener('change', () => onchange(+inp.value));
  return h('label.slider', {}, h('span.slabel', {}, label), inp, val);
}

// ---------- Selector de opciones en línea (chips) ----------
export function chips(options, current, onpick, cls = '') {
  const box = h('div.chips' + cls);
  options.forEach((o) => {
    const b = h('button', { type: 'button', class: o.id === current ? 'on' : '' }, o.label);
    b.onclick = () => { box.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); onpick(o.id); };
    box.append(b);
  });
  return box;
}

// Agregar hijos ignorando null/false (evita que aparezca "null" en pantalla)
export const put = (el, ...kids) => { el.append(...kids.flat().filter((x) => x != null && x !== false)); return el; };
