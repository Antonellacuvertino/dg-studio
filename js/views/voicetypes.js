// ===============================================================
//  Tarjetas de "tipo de voz" con vista previa
// ===============================================================
import { h, toast, sheet, closeSheet } from '../core/ui.js';
import { state, saveVoiceSettings } from '../core/state.js';
import { playPreview, stopPreview } from '../core/audio.js';
import { VOICE_TYPES, demoVocals, defaultProfile } from '../voice/voice.js';
import { getProfile, applyVoiceType } from '../voice/profile.js';

const profFor = (t) => (t.base === 'dg' ? defaultProfile() : t.base === 'mine' ? getProfile() || defaultProfile() : (state.voice.who === 'dg' || !getProfile() ? defaultProfile() : getProfile()));

export function voiceTypeCards(onChange) {
  const box = h('div.vtypes');
  VOICE_TYPES.forEach((t) => {
    const needsMine = t.base === 'mine' && !getProfile();
    const pb = h('button.vt-play', { title: 'Escuchar' }, '▶');
    pb.onclick = (e) => {
      e.stopPropagation();
      if (pb.textContent === '■') { stopPreview(); return; }
      box.querySelectorAll('.vt-play').forEach((x) => (x.textContent = '▶'));
      try { pb.textContent = '■'; playPreview(demoVocals(profFor(t), { ...state.voice, ...t.set }), { onend: () => (pb.textContent = '▶') }); } catch (err) { pb.textContent = '▶'; toast(err.message); }
    };
    const card = h('div.vtype' + (state.voice.type === t.id ? '.on' : ''), { role: 'button', tabindex: 0 },
      h('span.ve', {}, t.emoji), h('div.vn', {}, h('b', {}, t.name), h('span', {}, needsMine ? 'Primero crea tu voz' : t.sub)), pb);
    card.onclick = async () => {
      applyVoiceType(t.id); await saveVoiceSettings();
      box.querySelectorAll('.vtype').forEach((x) => x.classList.remove('on')); card.classList.add('on');
      if (needsMine) toast('Usaré la Voz DG hasta que crees tu voz en 🎤 Voz');
      onChange && onChange(t);
    };
    box.append(card);
  });
  return box;
}

export async function pickVoiceType() {
  let picked = null;
  const body = voiceTypeCards((t) => { picked = t; });
  await sheet('🎤 Tipo de voz', { text: '▶ para escuchar cada una. Toca la tarjeta para elegirla.', body, cancel: 'Listo' });
  stopPreview();
  return picked;
}
void closeSheet;
