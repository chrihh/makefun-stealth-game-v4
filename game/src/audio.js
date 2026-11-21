// Tidebound Light — WebAudio synth: gull cries are too cheerful for
// a wrecker's rock, so the sounds are low and wet: stone splashes,
// a foghorn groan when the alarm trips, the clink of the lens key.

export function createAudio() {
  let ctx = null;
  let muted = false;
  const ensure = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const tone = (freq, dur, type, gain, slideTo) => {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
    g.gain.setValueAtTime(gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    osc.connect(g).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + dur);
  };
  const noise = (dur, gain, freq) => {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = ac.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(ac.destination);
    src.start();
  };
  return {
    unlock: ensure,
    toggleMute() { muted = !muted; return muted; },
    get muted() { return muted; },
    splash() { noise(0.28, 0.25, 900); },
    stone() { noise(0.35, 0.3, 700); tone(180, 0.2, 'sine', 0.08, 70); },
    key() { tone(1180, 0.12, 'triangle', 0.16); setTimeout(() => tone(1560, 0.18, 'triangle', 0.14), 70); },
    salvage() { tone(880, 0.1, 'square', 0.07); setTimeout(() => tone(1320, 0.14, 'square', 0.06), 60); },
    alarm() { tone(98, 0.7, 'sawtooth', 0.2, 82); tone(147, 0.7, 'sawtooth', 0.1, 123); },
    caught() { tone(220, 0.4, 'sawtooth', 0.18, 55); noise(0.3, 0.2, 500); },
    clear() { tone(523, 0.16, 'triangle', 0.14); setTimeout(() => tone(784, 0.24, 'triangle', 0.14), 110); },
  };
}
