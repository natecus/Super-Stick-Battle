import type { GameEvent } from './types';

export class SketchAudio {
  enabled = false;
  private context: AudioContext | null = null;

  async toggle(): Promise<boolean> {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.context ??= new AudioContext();
      try { await this.context.resume(); } catch { this.enabled = false; }
      this.tone(440, 660, 0.07, 'sine', 0.035);
    }
    return this.enabled;
  }

  play(event: GameEvent) {
    if (!this.enabled) return;
    switch (event.type) {
      case 'jump': this.tone(230, 500, 0.1, 'sine', 0.03); break;
      case 'hit': this.tone(180, 55, 0.1, 'triangle', 0.07); break;
      case 'shot': this.tone(720, 280, 0.09, 'triangle', 0.025); break;
      case 'ultra': this.tone(140, 850, 0.35, 'sawtooth', 0.025); break;
      case 'ko': this.tone(380, 45, 0.4, 'triangle', 0.06); break;
      case 'win': this.tone(440, 880, 0.6, 'sine', 0.04); break;
      case 'explosion': this.tone(130, 35, 0.3, 'triangle', 0.06); break;
      case 'enrage': this.tone(110, 300, 0.45, 'sawtooth', 0.025); break;
    }
  }

  private tone(start: number, end: number, duration: number, type: OscillatorType, volume: number) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const context = this.context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(start, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(end, context.currentTime + duration);
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(volume, context.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + duration + 0.01);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}
