// Starlight Relay — every sound is synthesised with WebAudio. No audio
// files, no network. The context is created on the first user gesture, so
// browsers with autoplay policies stay quiet until the player acts.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.16;
      this.master.connect(this.ctx.destination);
      return true;
    } catch (err) {
      return false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.16;
  }

  tone(freq, options = {}) {
    const { dur = 0.12, type = "sine", gain = 1, delay = 0, slide = null } = options;
    if (!this.ensure()) return;
    try {
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch (err) {
      /* Sound is decoration: never let it break the game. */
    }
  }

  click() {
    this.tone(660, { dur: 0.06, type: "triangle", gain: 0.5 });
  }

  rotate() {
    this.tone(520, { dur: 0.08, type: "triangle", gain: 0.6, slide: 780 });
  }

  place() {
    this.tone(392, { dur: 0.1, type: "triangle", gain: 0.6 });
    this.tone(587.33, { dur: 0.12, type: "triangle", gain: 0.5, delay: 0.05 });
  }

  pickup() {
    this.tone(587.33, { dur: 0.09, type: "triangle", gain: 0.5, slide: 392 });
  }

  error() {
    this.tone(160, { dur: 0.18, type: "sawtooth", gain: 0.22, slide: 110 });
  }

  lantern(step) {
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const f = scale[step % scale.length];
    this.tone(f, { dur: 0.35, type: "sine", gain: 0.7 });
    this.tone(f * 2, { dur: 0.25, type: "sine", gain: 0.22 });
  }

  levelWin() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this.tone(f, { dur: 0.3, type: "triangle", gain: 0.55, delay: i * 0.09 });
    });
  }

  gameWin() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568.0].forEach((f, i) => {
      this.tone(f, { dur: 0.35, type: "triangle", gain: 0.55, delay: i * 0.11 });
    });
  }

  levelFail() {
    [329.63, 261.63, 196.0].forEach((f, i) => {
      this.tone(f, { dur: 0.25, type: "triangle", gain: 0.5, delay: i * 0.14 });
    });
  }
}
