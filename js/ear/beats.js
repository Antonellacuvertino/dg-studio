// ===============================================================
//  Rejilla de tiempos de una canción: BPM preciso + dónde cae el
//  primer tiempo (fase). Se usa para el entrenamiento de beatmatch.
//  Flujo espectral en graves + peine de autocorrelación, con
//  preferencia por el rango de club (118–178 BPM).
// ===============================================================
export async function beatGrid(buf, { maxSec = 90 } = {}) {
  const sr = buf.sampleRate; const L = Math.min(buf.length, Math.floor(maxSec * sr));
  const mono = new Float32Array(L);
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < L; i++) mono[i] += d[i] / buf.numberOfChannels; }
  const band = async (type, f) => {
    const oc = new OfflineAudioContext(1, L, sr); const b = oc.createBuffer(1, L, sr); b.copyToChannel(mono, 0);
    const s = oc.createBufferSource(); s.buffer = b; const fl = oc.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = 0.7;
    s.connect(fl).connect(oc.destination); s.start(); return (await oc.startRendering()).getChannelData(0);
  };
  const [low, high] = await Promise.all([band('lowpass', 160), band('highpass', 2500)]);
  const hop = Math.round(sr / 200); const fps = sr / hop; const N = Math.floor(L / hop);
  const flux = (x) => { const e = new Float32Array(N); for (let k = 0; k < N; k++) { let s = 0; for (let i = k * hop; i < (k + 1) * hop; i++) s += x[i] * x[i]; e[k] = Math.sqrt(s / hop); } const o = new Float32Array(N); for (let k = 1; k < N; k++) o[k] = Math.max(0, e[k] - e[k - 1]); return o; };
  const oL = flux(low), oH = flux(high);
  const on = new Float32Array(N); for (let k = 0; k < N; k++) on[k] = oL[k] * 2 + oH[k];
  const mean = on.reduce((a, b) => a + b, 0) / N; const z = on.map((v) => v - mean);
  const ac = (lag) => { const l = Math.floor(lag), f = lag - l; let s = 0; for (let k = 0; k + l + 1 < N; k++) s += z[k] * (z[k + l] * (1 - f) + z[k + l + 1] * f); return s; };
  const score = (b) => { const lag = (60 / b) * fps; return ac(lag) + 0.5 * ac(lag * 2) + 0.33 * ac(lag * 4) + 0.25 * ac(lag * 3); };
  let best = 0, bpm = 120; for (let b = 60; b <= 190; b += 0.25) { const sc = score(b); if (sc > best) { best = sc; bpm = b; } }
  let pick = bpm, ps = -Infinity;
  for (const b of [bpm, bpm * 2, bpm * 1.5, bpm / 2, bpm * 0.75, (bpm * 4) / 3]) { if (b < 60 || b > 190) continue; const s = score(b) * (b >= 118 && b <= 178 ? 1.25 : 1); if (s > ps) { ps = s; pick = b; } }
  // afinar a 0,05 BPM alrededor del elegido
  for (let b = pick - 0.5; b <= pick + 0.5; b += 0.05) { const s = score(b) * 1.25; if (s > ps) { ps = s; pick = b; } }
  // fase: dónde caen los bombos (graves) al doblar la señal por el periodo
  const per = (60 / pick) * fps; let off = 0, bo = -1;
  for (let p = 0; p < per; p += 0.25) { let s = 0; for (let k = 0; p + k * per < N; k++) { const i = Math.round(p + k * per); s += oL[i] + 0.5 * (oL[i - 1] || 0) + 0.5 * (oL[i + 1] || 0); } if (s > bo) { bo = s; off = p; } }
  return { bpm: Math.round(pick * 100) / 100, offset: off / fps };
}
