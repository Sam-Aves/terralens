// TERRALENS – Web Audio synthesizer
// No external sound files needed. Mirrors the GDScript synth in welcome_screen.gd.

type OscType = 'sine' | 'square' | 'sawtooth' | 'triangle';

function getCtx(): AudioContext | null {
  try {
    const W = window as unknown as { webkitAudioContext?: typeof AudioContext };
    return new (window.AudioContext || W.webkitAudioContext!)();
  } catch {
    return null;
  }
}

function tone(freq: number, duration: number, type: OscType = 'sine', vol = 0.12) {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  const now = ctx.currentTime;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.start(now);
  osc.stop(now + duration);
}

export const sound = {
  enabled: true,

  playRadarPing() {
    if (!this.enabled) return;
    tone(1200, 0.18, 'sine', 0.10);
  },

  playSuccessChime() {
    if (!this.enabled) return;
    const ctx = getCtx();
    if (!ctx) return;
    const notes = [659.25, 783.99, 987.77, 1318.5];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(ctx.destination);
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.09;
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  },

  playTrophyFanfare() {
    if (!this.enabled) return;
    const ctx = getCtx();
    if (!ctx) return;
    const notes = [440, 554.37, 659.25, 880, 1108.73];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(ctx.destination);
      osc.type = 'square';
      const t = ctx.currentTime + i * 0.07;
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.start(t);
      osc.stop(t + 0.14);
    });
  },

  playKeyClick() {
    if (!this.enabled) return;
    tone(720, 0.03, 'triangle', 0.07);
  },

  playLaunchFanfare() {
    if (!this.enabled) return;
    tone(960, 0.22, 'sine', 0.15);
  },
};

/** Rising chime for a rank-up. */
export function playRankUp() {
  if (!sound.enabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'triangle';
    const t = ctx.currentTime + i * 0.11;
    osc.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.start(t); osc.stop(t + 0.3);
  });
}

/** Very quiet radar hum for the lab. start() is safe to call repeatedly. */
let humCtx: AudioContext | null = null;
export const ambience = {
  start() {
    if (humCtx || !sound.enabled) return;
    const ctx = getCtx();
    if (!ctx) return;
    humCtx = ctx;
    const out = ctx.createGain(); out.gain.value = 0.012; out.connect(ctx.destination);
    [55, 82.5].forEach(f => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(out); o.start(); });
    const lfo = ctx.createOscillator(); const depth = ctx.createGain();
    lfo.frequency.value = 0.25; depth.gain.value = 0.006; lfo.connect(depth); depth.connect(out.gain); lfo.start();
  },
  stop() {
    if (!humCtx) return;
    humCtx.close().catch(() => {});
    humCtx = null;
  },
};
