// SOLMAR BAY — synthesized WebAudio SFX + an original music loop. No audio files.
export function createAudio() {
  let ctx = null, master = null, muted = false, musicTimer = null;
  let engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null;
  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
      return true;
    } catch { return false; }
  }
  function tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.25, low = 800) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }
  // A short original loop: warm bass line + sparse plucks (C major pentatonic).
  const BASS = [130.8, 98.0, 110.0, 87.3];
  const PLUCK = [523.25, 587.33, 659.25, 783.99, 880.0];
  let step = 0;
  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicTimer = setInterval(() => {
      if (muted) return;
      const bar = Math.floor(step / 4) % 4;
      tone(BASS[bar], 0.9, 'triangle', 0.16);
      if (step % 2 === 0) tone(PLUCK[(step * 3 + bar) % PLUCK.length], 0.35, 'sine', 0.08);
      step += 1;
    }, 300);
  }
  function engine(speed01, on) {
    if (!ensure() || muted) { if (engineGain) engineGain.gain.value = 0; return; }
    if (!engineOsc) {
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 60;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
      engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
    }
    engineOsc.frequency.value = 55 + speed01 * 140;
    engineGain.gain.value = on ? 0.05 + speed01 * 0.05 : 0;
  }
  function siren(on) {
    if (!ensure()) return;
    if (!sirenOsc) {
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sine'; sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start();
      setInterval(() => { if (sirenOsc) sirenOsc.frequency.value = sirenOsc.frequency.value > 750 ? 650 : 850; }, 450);
    }
    sirenGain.gain.value = on && !muted ? 0.045 : 0;
  }
  return {
    unlock() { ensure(); startMusic(); },
    shot() { noise(0.12, 0.4, 2400); tone(180, 0.08, 'square', 0.2, 60); },
    crash() { noise(0.3, 0.35, 500); },
    pickup() { tone(660, 0.12, 'sine', 0.25); tone(990, 0.18, 'sine', 0.2); },
    mission() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.22), i * 110)); },
    busted() { tone(220, 0.5, 'sawtooth', 0.25, 110); },
    engine, siren,
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.35; return muted; },
    get muted() { return muted; },
  };
}
