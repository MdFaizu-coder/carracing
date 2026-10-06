// Web Audio API Procedural Sound Engine
// Zero external asset dependencies, zero network requests, instant feedback

class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private isEngineRunning: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tech_race_muted');
      this.isMuted = saved === 'true';
    }
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('tech_race_muted', String(this.isMuted));
    }
    if (this.isMuted && this.engineGain) {
      this.engineGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // Engine sound starts when race starts
  public startEngine() {
    if (this.isEngineRunning) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();

      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(65, this.ctx.currentTime);

      // Lowpass filter to make it sound like a motor/engine, not a raw synth
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350, this.ctx.currentTime);

      this.engineGain.gain.setValueAtTime(this.isMuted ? 0 : 0.04, this.ctx.currentTime);

      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineOsc.start();
      this.isEngineRunning = true;
    } catch {
      // Audio context policy safe fail
    }
  }

  public updateEngine(speedNormalized: number) {
    if (!this.isEngineRunning || !this.engineOsc || !this.ctx || this.isMuted) return;
    try {
      // Speed from 0 to 1 -> freq from 60Hz to 240Hz
      const targetFreq = 60 + Math.abs(speedNormalized) * 180;
      this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.05);

      const targetVol = 0.03 + Math.abs(speedNormalized) * 0.05;
      this.engineGain?.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.05);
    } catch {
      // Safe ignore
    }
  }

  public stopEngine() {
    if (!this.isEngineRunning) return;
    try {
      this.engineGain?.gain.setTargetAtTime(0, this.ctx?.currentTime || 0, 0.1);
      setTimeout(() => {
        this.engineOsc?.stop();
        this.engineOsc?.disconnect();
        this.engineGain?.disconnect();
        this.engineOsc = null;
        this.engineGain = null;
        this.isEngineRunning = false;
      }, 150);
    } catch {
      this.isEngineRunning = false;
    }
  }

  // Checkpoint crossed sound
  public playCheckpoint() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // ignore
    }
  }

  // Lap completed sound
  public playLapComplete() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      [0, 0.08, 0.16].forEach((delay, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
        osc.frequency.setValueAtTime(notes[i], now + delay);

        gain.gain.setValueAtTime(0.15, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now + delay);
        osc.stop(now + delay + 0.25);
      });
    } catch {
      // ignore
    }
  }

  // Obstacle collision crunch
  public playCollision() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // ignore
    }
  }

  // Countdown beep (short beep for 3, 2, 1)
  public playCountdownBeep(isGo: boolean = false) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(isGo ? 880 : 440, now);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.45 : 0.18));

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + (isGo ? 0.45 : 0.18));
    } catch {
      // ignore
    }
  }

  // Finish Fanfare
  public playFinishFanfare() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const chords = [
        { f: 523.25, t: 0.0 }, // C5
        { f: 659.25, t: 0.12 }, // E5
        { f: 783.99, t: 0.24 }, // G5
        { f: 1046.5, t: 0.38 }  // C6
      ];

      chords.forEach((c) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(c.f, now + c.t);

        gain.gain.setValueAtTime(0.2, now + c.t);
        gain.gain.exponentialRampToValueAtTime(0.001, now + c.t + 0.45);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now + c.t);
        osc.stop(now + c.t + 0.45);
      });
    } catch {
      // ignore
    }
  }
}

export const soundManager = new SoundManager();
