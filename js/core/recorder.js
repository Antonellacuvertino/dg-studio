// ===============================================================
//  Grabadora con pausa: micrófono, lo que suena en el Estudio, o ambos
// ===============================================================
import { audio, setSession } from './audio.js';
import { Mixer } from '../studio/mixer.js';

function pickMime() {
  const opts = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
  return opts.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
}

export class SessionRecorder {
  /** source: 'mic' | 'studio' | 'both' */
  constructor(source = 'mic') { this.source = source; this.state = 'idle'; this.elapsed = 0; }

  async start() {
    if (!window.MediaRecorder) throw new Error('Este navegador no permite grabar. En iPhone usa Safari con la app publicada.');
    const c = audio();
    this.dest = c.createMediaStreamDestination();
    this.an = c.createAnalyser(); this.an.fftSize = 512;
    const tap = c.createGain(); tap.connect(this.dest); tap.connect(this.an); this.tap = tap;
    if (this.source !== 'mic') Mixer.tap = tap; // el Estudio enviará su salida aquí
    if (this.source !== 'studio') {
      setSession('play-and-record');
      try { this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
      catch (e) { this.cleanup(); throw new Error(e && e.name === 'NotAllowedError' ? 'Permiso de micrófono denegado. Actívalo en Ajustes → Safari → Micrófono.' : 'No pude acceder al micrófono'); }
      this.micSrc = c.createMediaStreamSource(this.stream); this.micSrc.connect(tap);
    }
    const mime = pickMime();
    this.rec = new MediaRecorder(this.dest.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = []; this.rec.ondataavailable = (e) => e.data && e.data.size && this.chunks.push(e.data);
    await new Promise((r) => { this.rec.onstart = r; this.rec.start(250); });
    this.state = 'rec'; this.t0 = performance.now(); this.elapsed = 0;
  }
  pause() { if (this.state !== 'rec') return; try { this.rec.pause(); } catch { /* */ } this.elapsed += performance.now() - this.t0; this.state = 'paused'; }
  resume() { if (this.state !== 'paused') return; try { this.rec.resume(); } catch { /* */ } this.t0 = performance.now(); this.state = 'rec'; }
  time() { return (this.elapsed + (this.state === 'rec' ? performance.now() - this.t0 : 0)) / 1000; }
  level() { if (!this.an) return 0; const a = new Float32Array(this.an.fftSize); this.an.getFloatTimeDomainData(a); let m = 0; for (const v of a) m = Math.max(m, Math.abs(v)); return m; }
  async stop() {
    if (!this.rec) return null;
    const blob = await new Promise((r) => { this.rec.onstop = () => r(new Blob(this.chunks, { type: this.rec.mimeType || 'audio/webm' })); try { this.rec.stop(); } catch { r(new Blob(this.chunks)); } });
    this.cleanup(); this.state = 'idle';
    return blob.size > 800 ? blob : null;
  }
  cleanup() {
    if (Mixer.tap === this.tap) Mixer.tap = null;
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    try { this.micSrc && this.micSrc.disconnect(); this.tap && this.tap.disconnect(); } catch { /* */ }
    setSession('playback');
  }
}
