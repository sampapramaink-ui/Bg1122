// Web Audio API Synthesizer for UI audio effects, background music, and haptic feedback

class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private bgMusicEnabled: boolean = true;
  private soundEffectsEnabled: boolean = true;
  private hapticEnabled: boolean = true;
  private lastDealerSpokenText: string = '';
  private lastDealerSpokenTime: number = 0;
  private isAudioUnlocked: boolean = false;

  private bgOsc1: OscillatorNode | null = null;
  private bgOsc2: OscillatorNode | null = null;
  private bgGainNode: GainNode | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlockHandler = () => {
        this.unlockAudio();
      };
      ['touchstart', 'touchend', 'click', 'pointerdown', 'keydown'].forEach(evt => {
        window.addEventListener(evt, unlockHandler, { once: false, passive: true });
      });

      // Keep audio context alive on visibility change & screen unlock
      document.addEventListener('visibilitychange', () => {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
      });

      // Warm up voices when ready
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = () => {
          try {
            window.speechSynthesis.getVoices();
          } catch (_) {}
        };
      }
    }
  }

  public unlockAudio() {
    if (typeof window === 'undefined') return;
    try {
      this.initCtx();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      if ('speechSynthesis' in window) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.getVoices();
      }
      this.isAudioUnlocked = true;
    } catch (_) {}
  }

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
    if (this.isMuted) {
      this.stopBgMusic();
    } else if (this.bgMusicEnabled) {
      this.startBgMusic();
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setSoundEffectsEnabled(enabled: boolean) {
    this.soundEffectsEnabled = enabled;
  }

  public getSoundEffectsEnabled(): boolean {
    return this.soundEffectsEnabled;
  }

  public setHapticEnabled(enabled: boolean) {
    this.hapticEnabled = enabled;
  }

  public getHapticEnabled(): boolean {
    return this.hapticEnabled;
  }

  public setBgMusicEnabled(enabled: boolean) {
    this.bgMusicEnabled = enabled;
    if (enabled && !this.isMuted) {
      this.startBgMusic();
    } else {
      this.stopBgMusic();
    }
  }

  public getBgMusicEnabled(): boolean {
    return this.bgMusicEnabled;
  }

  public triggerHaptic(duration: number | number[] = 30) {
    if (this.hapticEnabled && typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(duration);
      } catch (e) {
        // Haptics not supported or blocked
      }
    }
  }

  public startBgMusic() {
    if (!this.bgMusicEnabled || this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.bgOsc1) return; // Already playing

      const now = this.ctx.currentTime;
      this.bgOsc1 = this.ctx.createOscillator();
      this.bgOsc2 = this.ctx.createOscillator();
      this.bgGainNode = this.ctx.createGain();

      this.bgOsc1.type = 'sine';
      this.bgOsc1.frequency.setValueAtTime(130.81, now); // C3 chord tone

      this.bgOsc2.type = 'triangle';
      this.bgOsc2.frequency.setValueAtTime(196.00, now); // G3 chord tone

      // Soft background volume
      this.bgGainNode.gain.setValueAtTime(0.015, now);

      this.bgOsc1.connect(this.bgGainNode);
      this.bgOsc2.connect(this.bgGainNode);
      this.bgGainNode.connect(this.ctx.destination);

      this.bgOsc1.start(now);
      this.bgOsc2.start(now);
    } catch (e) {
      console.warn('BG music playback error', e);
    }
  }

  public stopBgMusic() {
    try {
      if (this.bgOsc1) {
        this.bgOsc1.stop();
        this.bgOsc1.disconnect();
        this.bgOsc1 = null;
      }
      if (this.bgOsc2) {
        this.bgOsc2.stop();
        this.bgOsc2.disconnect();
        this.bgOsc2 = null;
      }
      if (this.bgGainNode) {
        this.bgGainNode.disconnect();
        this.bgGainNode = null;
      }
    } catch (e) {
      console.warn('BG music stop error', e);
    }
  }

  public playClick() {
    this.triggerHaptic(15);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playCoin() {
    this.triggerHaptic([30, 40, 50]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(987.77, now); // B5
      osc1.frequency.setValueAtTime(1318.51, now + 0.08); // E6

      osc2.frequency.setValueAtTime(1975.53, now);
      osc2.frequency.setValueAtTime(2637.02, now + 0.08);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.3);
      osc2.stop(now + 0.3);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playChime() {
    this.triggerHaptic([20, 40]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(880, now); // A5
      osc1.frequency.setValueAtTime(1320, now + 0.1); // E6

      osc2.frequency.setValueAtTime(1760, now); // A6
      osc2.frequency.setValueAtTime(2640, now + 0.1);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.35);
      osc2.stop(now + 0.35);
    } catch (e) {
      console.warn('Audio chime play error', e);
    }
  }

  public playWinFanfare() {
    this.triggerHaptic([50, 50, 100, 150]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);

        gain.gain.setValueAtTime(0.2, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.4);
      });
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playWin() {
    this.playWinFanfare();
  }

  public playLoss() {
    this.triggerHaptic([40, 60]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.25);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playCountdownTick() {
    this.triggerHaptic(10);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1000, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.03);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.03);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playCountdownBeep(isFinal: boolean = false) {
    this.triggerHaptic(isFinal ? [40, 40] : 15);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = isFinal ? 'square' : 'sine';
      osc.frequency.setValueAtTime(isFinal ? 1200 : 800, now);
      if (isFinal) {
        osc.frequency.setValueAtTime(1500, now + 0.08);
      }
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (isFinal ? 0.25 : 0.08));
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + (isFinal ? 0.25 : 0.08));
    } catch (e) {
      console.warn('Audio countdown beep error', e);
    }
  }

  public playSpinWhoosh() {
    this.triggerHaptic(20);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.4;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(200, now);
      filter.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
      filter.frequency.exponentialRampToValueAtTime(100, now + 0.4);
      filter.Q.setValueAtTime(3, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      whiteNoise.start(now);
      whiteNoise.stop(now + 0.4);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playThunderStrike() {
    this.triggerHaptic([60, 40, 80, 50, 150]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // 1. High-frequency electric crackle / zap sizzle (noise + highpass)
      const noiseBuffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.35), this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (Math.random() > 0.4 ? 1 : 0.2);
      }
      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = noiseBuffer;
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.setValueAtTime(2500, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.25, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      noiseNode.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noiseNode.start(now);

      // 2. High-voltage electric arc oscillators
      const zapOsc = this.ctx.createOscillator();
      zapOsc.type = 'sawtooth';
      zapOsc.frequency.setValueAtTime(1400, now);
      zapOsc.frequency.exponentialRampToValueAtTime(180, now + 0.25);
      const zapGain = this.ctx.createGain();
      zapGain.gain.setValueAtTime(0.2, now);
      zapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      zapOsc.connect(zapGain);
      zapGain.connect(this.ctx.destination);
      zapOsc.start(now);
      zapOsc.stop(now + 0.28);

      // 3. Deep Thunder boom (Sub-bass rumble)
      const thunderOsc = this.ctx.createOscillator();
      thunderOsc.type = 'triangle';
      thunderOsc.frequency.setValueAtTime(120, now + 0.05);
      thunderOsc.frequency.exponentialRampToValueAtTime(35, now + 0.9);
      const thunderGain = this.ctx.createGain();
      thunderGain.gain.setValueAtTime(0.01, now);
      thunderGain.gain.linearRampToValueAtTime(0.35, now + 0.08);
      thunderGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      thunderOsc.connect(thunderGain);
      thunderGain.connect(this.ctx.destination);
      thunderOsc.start(now + 0.05);
      thunderOsc.stop(now + 0.9);
    } catch (e) {
      console.warn('Audio playThunderStrike error', e);
    }
  }

  public playBallClick() {
    this.triggerHaptic(15);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.exponentialRampToValueAtTime(2200, now + 0.015);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.015);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playCheer() {
    this.triggerHaptic([40, 60, 80, 100]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.5, 1318.51];
      freqs.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0.15, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.5);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.5);
      });
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playLightningZap() {
    this.triggerHaptic([30, 50, 70, 90]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      
      // Electric saw/zap wave
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.3);
      
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.3);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {
      console.warn('Audio lightning zap error', e);
    }
  }

  public playSpinTick() {
    this.triggerHaptic(10);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.02);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.02);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playCarRollingSound() {
    this.triggerHaptic(8);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220 + Math.random() * 120, now);
      osc.frequency.exponentialRampToValueAtTime(450 + Math.random() * 150, now + 0.05);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playLoudWinSound() {
    this.triggerHaptic([80, 100, 120, 200, 300]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // High Loud Fanfare Chords (C Major, G Major, High C Octave Burst)
      const chordNotes = [
        [261.63, 329.63, 392.00, 523.25],          // C4 major chord
        [392.00, 493.88, 587.33, 783.99],          // G4 major chord
        [523.25, 659.25, 783.99, 1046.50, 1318.51] // C5 major climax chord
      ];

      chordNotes.forEach((chord, chordIdx) => {
        const startTime = now + chordIdx * 0.18;
        chord.forEach((freq) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = chordIdx === 2 ? 'sawtooth' : 'triangle';
          osc.frequency.setValueAtTime(freq, startTime);

          // Loud clear gain volume
          gain.gain.setValueAtTime(0.28, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.65);

          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(startTime);
          osc.stop(startTime + 0.65);
        });
      });

      // High celebratory synth chime arpeggio
      const chimes = [1046.50, 1318.51, 1567.98, 2093.00, 2637.02];
      chimes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + 0.55 + idx * 0.08);

        gain.gain.setValueAtTime(0.3, now + 0.55 + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55 + idx * 0.08 + 0.45);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + 0.55 + idx * 0.08);
        osc.stop(now + 0.55 + idx * 0.08 + 0.45);
      });
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playCardDeal() {
    this.triggerHaptic(12);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      
      // Card friction whoosh (filtered white noise burst)
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.07);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(3200, now + 0.06);
      filter.Q.setValueAtTime(3, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(now);
      noise.stop(now + 0.07);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playCardFlip() {
    this.triggerHaptic(18);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Crisp card slap/snap
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.04);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playChipPlace() {
    this.triggerHaptic(15);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Ceramic casino chip click (dual high resonance tones)
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(2400, now);
      osc1.frequency.exponentialRampToValueAtTime(1800, now + 0.035);
      osc2.frequency.setValueAtTime(3600, now);
      osc2.frequency.exponentialRampToValueAtTime(2800, now + 0.035);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.035);
      osc2.stop(now + 0.035);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playBetsClosed() {
    this.triggerHaptic([40, 80, 40]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Low resonant casino gong / bell
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(440, now); // A4
      osc2.frequency.setValueAtTime(880, now); // A5

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.8);
      osc2.stop(now + 0.8);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playLossSound() {
    this.triggerHaptic([30, 60]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.35);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playDragonRoar() {
    this.triggerHaptic([60, 40, 80]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Deep, mystical Dragon roar sound with brass frequency sweeps
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(120, now);
      osc1.frequency.exponentialRampToValueAtTime(280, now + 0.25);
      osc1.frequency.exponentialRampToValueAtTime(80, now + 0.7);

      osc2.frequency.setValueAtTime(90, now);
      osc2.frequency.exponentialRampToValueAtTime(180, now + 0.25);
      osc2.frequency.exponentialRampToValueAtTime(60, now + 0.7);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.75);
      osc2.stop(now + 0.75);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playTigerRoar() {
    this.triggerHaptic([50, 40, 90]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Fierce predatory growl / strike tone
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(220, now);
      osc1.frequency.exponentialRampToValueAtTime(140, now + 0.3);
      osc1.frequency.exponentialRampToValueAtTime(70, now + 0.65);

      osc2.frequency.setValueAtTime(340, now);
      osc2.frequency.exponentialRampToValueAtTime(200, now + 0.25);
      osc2.frequency.exponentialRampToValueAtTime(80, now + 0.65);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.7);
      osc2.stop(now + 0.7);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playChipSelect() {
    this.playClick();
  }

  public playChipPlacement() {
    this.playChipPlace();
  }

  public playWinCoin() {
    this.playCoin();
  }

  public playError() {
    this.triggerHaptic([50, 50]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.setValueAtTime(120, now + 0.08);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playDragonTigerWinFanfare() {
    this.triggerHaptic([60, 40, 80, 120]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // 1. Deep Imperial Gong & Warm Sub-Bass Foundation
      const gongOsc = this.ctx.createOscillator();
      const gongGain = this.ctx.createGain();
      gongOsc.type = 'sine';
      gongOsc.frequency.setValueAtTime(130.81, now); // C3 deep sub
      gongOsc.frequency.exponentialRampToValueAtTime(65.41, now + 1.8);
      gongGain.gain.setValueAtTime(0.35, now);
      gongGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
      gongOsc.connect(gongGain);
      gongGain.connect(this.ctx.destination);
      gongOsc.start(now);
      gongOsc.stop(now + 1.8);

      // 2. Lush Major Triad Warm Synth Pad (C Major 9: C4, E4, G4, B4, D5)
      const chordPitches = [261.63, 329.63, 392.00, 493.88, 587.33];
      chordPitches.forEach((freq, idx) => {
        if (!this.ctx) return;
        const padOsc = this.ctx.createOscillator();
        const padGain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        padOsc.type = 'triangle';
        padOsc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(1800, now + 0.4);
        filter.frequency.exponentialRampToValueAtTime(400, now + 1.6);

        padGain.gain.setValueAtTime(0.01, now);
        padGain.gain.linearRampToValueAtTime(0.12 / chordPitches.length, now + 0.15 + idx * 0.02);
        padGain.gain.exponentialRampToValueAtTime(0.001, now + 1.7);

        padOsc.connect(filter);
        filter.connect(padGain);
        padGain.connect(this.ctx.destination);

        padOsc.start(now);
        padOsc.stop(now + 1.7);
      });

      // 3. Triumphant Asian Casino Fanfare Brass Arpeggio (Pentatonic Dragon-Tiger scale)
      const fanfareNotes = [
        { f: 392.00, t: 0.0, d: 0.22 },   // G4
        { f: 523.25, t: 0.10, d: 0.22 },  // C5
        { f: 587.33, t: 0.20, d: 0.22 },  // D5
        { f: 659.25, t: 0.30, d: 0.26 },  // E5
        { f: 783.99, t: 0.42, d: 0.32 },  // G5
        { f: 1046.50, t: 0.56, d: 0.95 }  // C6 High Victory Note
      ];

      fanfareNotes.forEach((n) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(n.f, now + n.t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1600, now + n.t);
        filter.frequency.exponentialRampToValueAtTime(3200, now + n.t + 0.08);
        filter.frequency.exponentialRampToValueAtTime(800, now + n.t + n.d);

        gain.gain.setValueAtTime(0.24, now + n.t);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + n.t);
        osc.stop(now + n.t + n.d);
      });

      // 4. Shimmering Guzheng / Crystal Sparkle Arpeggio Cascade
      const sparkles = [1046.50, 1174.66, 1318.51, 1567.98, 2093.00, 2637.02];
      sparkles.forEach((f, i) => {
        if (!this.ctx) return;
        const sOsc = this.ctx.createOscillator();
        const sGain = this.ctx.createGain();
        sOsc.type = 'sine';
        sOsc.frequency.setValueAtTime(f, now + 0.65 + i * 0.05);
        sGain.gain.setValueAtTime(0.14, now + 0.65 + i * 0.05);
        sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65 + i * 0.05 + 0.45);
        sOsc.connect(sGain);
        sGain.connect(this.ctx.destination);
        sOsc.start(now + 0.65 + i * 0.05);
        sOsc.stop(now + 0.65 + i * 0.05 + 0.45);
      });
    } catch (e) {
      console.warn('Dragon Tiger win fanfare error', e);
    }
  }

  public playAndarBaharWinFanfare() {
    this.triggerHaptic([50, 60, 90, 140]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // 1. Warm Resonant Tanpura / Drone Bass Pad (D root chord)
      const droneNotes = [146.83, 220.00, 293.66]; // D3, A3, D4
      droneNotes.forEach((freq) => {
        if (!this.ctx) return;
        const dOsc = this.ctx.createOscillator();
        const dGain = this.ctx.createGain();
        const dFilter = this.ctx.createBiquadFilter();

        dOsc.type = 'triangle';
        dOsc.frequency.setValueAtTime(freq, now);

        dFilter.type = 'lowpass';
        dFilter.frequency.setValueAtTime(600, now);
        dFilter.frequency.exponentialRampToValueAtTime(1400, now + 0.3);
        dFilter.frequency.exponentialRampToValueAtTime(300, now + 1.8);

        dGain.gain.setValueAtTime(0.01, now);
        dGain.gain.linearRampToValueAtTime(0.08, now + 0.1);
        dGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

        dOsc.connect(dFilter);
        dFilter.connect(dGain);
        dGain.connect(this.ctx.destination);

        dOsc.start(now);
        dOsc.stop(now + 1.8);
      });

      // 2. High-energy Indian Casino Sitar / Shehnai Melodic Cascade with Pitch Micro-Modulation
      const abNotes = [
        { f: 440.00, t: 0.0, d: 0.16, bend: 445 },   // A4
        { f: 554.37, t: 0.08, d: 0.16, bend: 560 },  // C#5
        { f: 587.33, t: 0.16, d: 0.16, bend: 595 },  // D5
        { f: 659.25, t: 0.24, d: 0.18, bend: 668 },  // E5
        { f: 740.00, t: 0.34, d: 0.22, bend: 752 },  // F#5
        { f: 880.00, t: 0.44, d: 0.28, bend: 890 },  // A5
        { f: 1108.73, t: 0.56, d: 0.35, bend: 1120 },// C#6
        { f: 1174.66, t: 0.70, d: 0.90, bend: 1185 } // D6 Final High Triumph Ring
      ];

      abNotes.forEach((n) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(n.f, now + n.t);
        // Subtle microtonal ornament
        osc.frequency.exponentialRampToValueAtTime(n.bend, now + n.t + 0.04);
        osc.frequency.exponentialRampToValueAtTime(n.f, now + n.t + 0.1);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1800, now + n.t);
        filter.frequency.exponentialRampToValueAtTime(3600, now + n.t + 0.06);
        filter.frequency.exponentialRampToValueAtTime(1000, now + n.t + n.d);

        gain.gain.setValueAtTime(0.20, now + n.t);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + n.t);
        osc.stop(now + n.t + n.d);
      });

      // 3. Celebratory Golden Coin Shower & Santoor Glockenspiel Sparkles
      const coinTones = [1479.98, 1760.00, 2217.46, 2637.02, 2959.96, 3520.00];
      coinTones.forEach((f, i) => {
        if (!this.ctx) return;
        const cOsc = this.ctx.createOscillator();
        const cGain = this.ctx.createGain();
        cOsc.type = 'sine';
        cOsc.frequency.setValueAtTime(f, now + 0.6 + i * 0.06);
        cGain.gain.setValueAtTime(0.14, now + 0.6 + i * 0.06);
        cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6 + i * 0.06 + 0.4);
        cOsc.connect(cGain);
        cGain.connect(this.ctx.destination);
        cOsc.start(now + 0.6 + i * 0.06);
        cOsc.stop(now + 0.6 + i * 0.06 + 0.4);
      });
    } catch (e) {
      console.warn('Andar Bahar win fanfare error', e);
    }
  }

  public playTieGong() {
    this.triggerHaptic([100, 50, 100]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Resonant harmonized oriental temple bell
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const osc3 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc3.type = 'sine';

      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc2.frequency.setValueAtTime(659.25, now); // E5
      osc3.frequency.setValueAtTime(783.99, now); // G5

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc1.connect(gain);
      osc2.connect(gain);
      osc3.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc3.start(now);
      osc1.stop(now + 1.2);
      osc2.stop(now + 1.2);
      osc3.stop(now + 1.2);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playPlaneTakeoff() {
    this.triggerHaptic([30, 40, 60]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // 1. Heavy Propeller & Jet Engine accelerating roar (Sawtooth + Triangle)
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(90, now);
      osc1.frequency.exponentialRampToValueAtTime(360, now + 0.8);

      osc2.frequency.setValueAtTime(180, now);
      osc2.frequency.exponentialRampToValueAtTime(720, now + 0.8);

      gain1.gain.setValueAtTime(0.35, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

      // Low-pass filter for rich aerodynamic body
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(2400, now + 0.7);

      osc1.connect(gain1);
      osc2.connect(gain1);
      gain1.connect(filter);
      filter.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.9);
      osc2.stop(now + 0.9);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playPlaneCrash() {
    this.triggerHaptic([100, 80, 150]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // 1. Sub-bass ground impact thump
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(150, now);
      subOsc.frequency.exponentialRampToValueAtTime(25, now + 0.6);
      subGain.gain.setValueAtTime(0.45, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      subOsc.connect(subGain);
      subGain.connect(this.ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.65);

      // 2. Heavy explosive metallic crunch & distortion
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sawtooth';
      osc2.type = 'square';

      osc1.frequency.setValueAtTime(320, now);
      osc1.frequency.exponentialRampToValueAtTime(35, now + 0.7);

      osc2.frequency.setValueAtTime(240, now);
      osc2.frequency.exponentialRampToValueAtTime(20, now + 0.8);

      gain1.gain.setValueAtTime(0.40, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      // Resonant filter for blast boom
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.frequency.exponentialRampToValueAtTime(150, now + 0.7);

      osc1.connect(gain1);
      osc2.connect(gain1);
      gain1.connect(filter);
      filter.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.85);
      osc2.stop(now + 0.85);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playCashoutWin() {
    this.triggerHaptic([30, 40, 50]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Bright happy victory chime / cash register chime
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.setValueAtTime(880.00, now + 0.08); // A5
      osc1.frequency.setValueAtTime(1174.66, now + 0.16); // D6

      osc2.frequency.setValueAtTime(1174.66, now);
      osc2.frequency.setValueAtTime(1760.00, now + 0.16);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.45);
      osc2.stop(now + 0.45);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playCashoutBigWin() {
    this.triggerHaptic([50, 50, 50, 100]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Glorious 4-chord fanfare for 10x+ mega multiplier cashouts
      const freqs = [523.25, 659.25, 783.99, 1046.50, 1318.51];
      freqs.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0.18, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.5);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.5);
      });
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  // ==========================================
  // MULTI-LANGUAGE LIVE CASINO DEALER SPEECH (বাংলা, हिन्दी, English)
  // ==========================================
  public speakDealer(text: string, langCode: 'bn' | 'hi' | 'en' = 'en') {
    if (this.isMuted || !this.soundEffectsEnabled) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    // Prevent stutter / rapid duplicate speech within 1.2s
    const now = Date.now();
    if (this.lastDealerSpokenText === text && (now - this.lastDealerSpokenTime) < 1200) {
      return;
    }
    this.lastDealerSpokenText = text;
    this.lastDealerSpokenTime = now;

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.cancel(); // cancel any lingering utterance
      const utterance = new SpeechSynthesisUtterance(text);
      
      const langTagMap: Record<string, string> = {
        bn: 'bn-IN',
        hi: 'hi-IN',
        en: 'en-IN'
      };

      utterance.lang = langTagMap[langCode] || 'en-IN';
      utterance.rate = langCode === 'bn' ? 0.95 : 1.0;
      utterance.pitch = 1.05;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const targetPrefix = langCode === 'bn' ? 'bn' : langCode === 'hi' ? 'hi' : 'en';
        const matchedVoice = voices.find(v => v.lang.toLowerCase().startsWith(targetPrefix));
        if (matchedVoice) {
          utterance.voice = matchedVoice;
        }
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Dealer voice error', e);
    }
  }

  // 1. User Enters Game / Welcome Announcement
  public speakWelcome(userName: string = 'Player', lang: 'bn' | 'hi' | 'en' = 'en') {
    const cleanName = userName || 'Player';
    const textMap = {
      bn: `স্বাগতম ${cleanName}! আন্দার বাহারে দয়া করে আপনার বাজি ধরুন।`,
      hi: `स्वागत है ${cleanName}! अंदर बाहर में कृपया अपनी बेट लगाएं।`,
      en: `Welcome ${cleanName}! Please place your bets on Andar Bahar.`
    };
    this.speakDealer(textMap[lang] || textMap.en, lang);
  }

  // 2. Please Place Your Bets Announcement
  public speakPleasePlaceBets(lang: 'bn' | 'hi' | 'en' = 'en') {
    const textMap = {
      bn: 'দয়া করে আপনার বাজি ধরুন। বাজি চালু আছে।',
      hi: 'कृपया अपनी बेट लगाएं। बेटिंग चालू है।',
      en: 'Please place your bets. Betting is now open.'
    };
    this.speakDealer(textMap[lang] || textMap.en, lang);
  }

  // 2.5 Bet Placed Confirmation Announcement
  public speakBetPlaced(side: string, amount: number, lang: 'bn' | 'hi' | 'en' = 'en') {
    const sideText: Record<string, Record<string, string>> = {
      andar: { bn: 'আন্দার', hi: 'अंदर', en: 'Andar' },
      bahar: { bn: 'বাহার', hi: 'बाहर', en: 'Bahar' }
    };
    const chosenSide = sideText[side] ? sideText[side][lang] || sideText[side].en : side;
    const textMap = {
      bn: `${chosenSide} এ ₹${amount} বাজি ধরা হয়েছে। শুভকামনা!`,
      hi: `${chosenSide} पर ₹${amount} की बेट लगाई गई। ऑल द बेस्ट!`,
      en: `₹${amount} bet placed on ${chosenSide}. Good luck!`
    };
    this.speakDealer(textMap[lang] || textMap.en, lang);
  }

  // 3. Do Not Bet / Bets Closed Announcement
  public speakNoMoreBets(lang: 'bn' | 'hi' | 'en' = 'en') {
    const textMap = {
      bn: 'আর কোনো বাজি নেওয়া হবে না, দয়া করে আর বাজি ধরবেন না। বাজি বন্ধ।',
      hi: 'बेट्स बंद! कृपया अब कोई बेट न लगाएं। कोई और बेट स्वीकार नहीं होगी।',
      en: 'No more bets please, bets are closed. Do not bet now.'
    };
    this.speakDealer(textMap[lang] || textMap.en, lang);
  }

  // 4. Cards Dealing Announcement
  public speakDealingCards(lang: 'bn' | 'hi' | 'en' = 'en') {
    const textMap = {
      bn: 'কার্ড ডিলিং শুরু হচ্ছে। দেখা যাক কে জিতে!',
      hi: 'कार्ड्स बांटे जा रहे हैं। देखते हैं कौन जीतता है!',
      en: 'Dealing cards now. Let us see who wins!'
    };
    this.speakDealer(textMap[lang] || textMap.en, lang);
  }

  // 6. Round Winner Announcement
  public speakRoundWinner(winner: 'andar' | 'bahar', lang: 'bn' | 'hi' | 'en' = 'en', userName?: string, wonAmount?: number) {
    if (wonAmount && wonAmount > 0) {
      const cleanName = userName || 'Player';
      const winUserMap = {
        bn: `অভিনন্দন ${cleanName}! ${winner === 'andar' ? 'আন্দার' : 'বাহার'} জয়ী হয়েছে এবং আপনি ₹${wonAmount} জিতেছেন!`,
        hi: `बधाई हो ${cleanName}! ${winner === 'andar' ? 'अंदर' : 'बाहर'} की जीत हुई और आप ₹${wonAmount} जीत गए!`,
        en: `Congratulations ${cleanName}! ${winner === 'andar' ? 'Andar' : 'Bahar'} wins and you won ₹${wonAmount}!`
      };
      this.speakDealer(winUserMap[lang] || winUserMap.en, lang);
    } else {
      const regularWinMap = {
        bn: `${winner === 'andar' ? 'আন্দার' : 'বাহার'} জয়ী হয়েছে!`,
        hi: `${winner === 'andar' ? 'अंदर' : 'बाहर'} की जीत हुई!`,
        en: `${winner === 'andar' ? 'Andar' : 'Bahar'} wins!`
      };
      this.speakDealer(regularWinMap[lang] || regularWinMap.en, lang);
    }
  }

  // ==========================================
  // ROULETTE LIVE DEALER VOICE ANNOUNCEMENTS
  // ==========================================
  public speakRouletteWelcome(userName: string = 'Player', lang: 'bn' | 'hi' | 'en' = 'hi') {
    const cleanName = userName || 'Player';
    const textMap = {
      bn: `স্বাগতম ${cleanName}! হিন্দি লাইটনিং রুলেটে আপনার বাজি ধরুন।`,
      hi: `स्वागत है ${cleanName}! हिंदी लाइटनिंग रूले में अपनी बेट लगाएं।`,
      en: `Welcome ${cleanName}! Place your bets on Lightning Roulette.`
    };
    this.speakDealer(textMap[lang] || textMap.hi, lang);
  }

  public speakRoulettePlaceBets(lang: 'bn' | 'hi' | 'en' = 'hi') {
    const textMap = {
      bn: 'দয়া করে আপনার রুলেট বাজি ধরুন। বাজি চালু আছে।',
      hi: 'कृपया अपनी बेट लगाएं। बेट्स ओपन हैं।',
      en: 'Please place your bets. Betting is open.'
    };
    this.speakDealer(textMap[lang] || textMap.hi, lang);
  }

  public speakRouletteNoMoreBets(lang: 'bn' | 'hi' | 'en' = 'hi') {
    const textMap = {
      bn: 'আর কোনো বাজি নেওয়া হবে না, বাজি বন্ধ।',
      hi: 'बेट्स बंद! नो मोर बेट्स प्लीज।',
      en: 'No more bets please. Bets are closed.'
    };
    this.speakDealer(textMap[lang] || textMap.hi, lang);
  }

  public speakRouletteSpinning(lang: 'bn' | 'hi' | 'en' = 'hi') {
    const textMap = {
      bn: 'রুলেট হুইল ঘুরছে। দেখা যাক লাইটনিং নম্বর কী আসে!',
      hi: 'रूले व्हील घूम रहा है। देखते हैं लाइटनिंग नंबर क्या आता है!',
      en: 'Wheel is spinning. Let us see the winning number!'
    };
    this.speakDealer(textMap[lang] || textMap.hi, lang);
  }

  public speakRouletteResult(winningNumber: number, color: string, multiplier?: number, lang: 'bn' | 'hi' | 'en' = 'hi') {
    const colorText: Record<string, Record<string, string>> = {
      red: { bn: 'লাল', hi: 'लाल', en: 'Red' },
      black: { bn: 'কালো', hi: 'काला', en: 'Black' },
      green: { bn: 'সবুজ', hi: 'हरा', en: 'Green' }
    };
    const cName = colorText[color] ? colorText[color][lang] || colorText[color].en : color;
    const multStr = multiplier && multiplier > 1 ? ` with ${multiplier}X multiplier` : '';
    const textMap = {
      bn: `উইনিং নম্বর ${winningNumber}, ${cName}${multStr}!`,
      hi: `विनिंग नंबर ${winningNumber}, ${cName}${multStr}!`,
      en: `Winning number is ${winningNumber}, ${cName}${multStr}!`
    };
    this.speakDealer(textMap[lang] || textMap.hi, lang);
  }

  // ==========================================
  // DRAGON TIGER LIVE DEALER VOICE ANNOUNCEMENTS
  // ==========================================
  public speakDragonTigerWelcome(userName: string = 'Player', lang: 'bn' | 'hi' | 'en' = 'en') {
    const cleanName = userName || 'Player';
    const textMap = {
      bn: `স্বাগতম ${cleanName}! ড্রাগন টাইগারে আপনার বাজি ধরুন।`,
      hi: `स्वागत है ${cleanName}! ड्रैगन टाइगर में अपनी बेट लगाएं।`,
      en: `Welcome ${cleanName}! Place your bets on Dragon Tiger.`
    };
    this.speakDealer(textMap[lang] || textMap.en, lang);
  }

  public speakDragonTigerPlaceBets(lang: 'bn' | 'hi' | 'en' = 'en') {
    const textMap = {
      bn: 'দয়া করে আপনার বাজি ধরুন। ড্রাগন নাকি টাইগার?',
      hi: 'कृपया अपनी बेट लगाएं। ड्रैगन या टाइगर?',
      en: 'Please place your bets. Dragon or Tiger?'
    };
    this.speakDealer(textMap[lang] || textMap.en, lang);
  }

  public speakDragonTigerNoMoreBets(lang: 'bn' | 'hi' | 'en' = 'en') {
    const textMap = {
      bn: 'বাজি বন্ধ। আর কোনো বাজি গ্রহণ করা হবে না।',
      hi: 'बेट्स बंद! कोई और बेट स्वीकार नहीं होगी।',
      en: 'No more bets please. Bets are now closed.'
    };
    this.speakDealer(textMap[lang] || textMap.en, lang);
  }

  public speakDragonTigerDealing(lang: 'bn' | 'hi' | 'en' = 'en') {
    const textMap = {
      bn: 'ড্রাগন এবং টাইগারের কার্ড ওপেন হচ্ছে।',
      hi: 'ड्रैगन और टाइगर के कार्ड्स बांटे जा रहे हैं।',
      en: 'Dealing cards for Dragon and Tiger.'
    };
    this.speakDealer(textMap[lang] || textMap.en, lang);
  }

  public speakDragonTigerResult(winner: 'dragon' | 'tiger' | 'tie', lang: 'bn' | 'hi' | 'en' = 'en', userName?: string, wonAmount?: number) {
    const winName: Record<string, Record<string, string>> = {
      dragon: { bn: 'ড্রাগন', hi: 'ड्रैगन', en: 'Dragon' },
      tiger: { bn: 'টাইগার', hi: 'टाइगर', en: 'Tiger' },
      tie: { bn: 'টাই (Tie)', hi: 'टाई (Tie)', en: 'Tie' }
    };
    const target = winName[winner] ? winName[winner][lang] || winName[winner].en : winner;
    if (wonAmount && wonAmount > 0) {
      const cleanName = userName || 'Player';
      const textMap = {
        bn: `অভিনন্দন ${cleanName}! ${target} জয়ী হয়েছে এবং আপনি ₹${wonAmount} জিতেছেন!`,
        hi: `बधाई हो ${cleanName}! ${target} की जीत हुई और आप ₹${wonAmount} जीत गए!`,
        en: `Congratulations ${cleanName}! ${target} wins and you won ₹${wonAmount}!`
      };
      this.speakDealer(textMap[lang] || textMap.en, lang);
    } else {
      const textMap = {
        bn: `${target} জয়ী হয়েছে!`,
        hi: `${target} की जीत हुई!`,
        en: `${target} wins!`
      };
      this.speakDealer(textMap[lang] || textMap.en, lang);
    }
  }

  // ==========================================
  // AVIATOR / CRASH LIVE VOICE ANNOUNCEMENTS
  // ==========================================
  public speakAviatorWelcome(userName: string = 'Player', lang: 'bn' | 'hi' | 'en' = 'en') {
    const cleanName = userName || 'Player';
    const textMap = {
      bn: `স্বাগতম ${cleanName}! এভিয়েটরে আপনার বাজি ধরুন।`,
      hi: `स्वागत है ${cleanName}! एविएटर में अपनी बेट लगाएं।`,
      en: `Welcome ${cleanName}! Place your bets on Aviator.`
    };
    this.speakDealer(textMap[lang] || textMap.en, lang);
  }

  public speakAviatorTakeoff(lang: 'bn' | 'hi' | 'en' = 'en') {
    const textMap = {
      bn: 'প্লেন উড়ছে! সঠিক সময়ে ক্যাশআউট করুন!',
      hi: 'प्लेन उड़ चुका है! समय पर कैशआउट करें!',
      en: 'Plane is taking off! Cash out in time!'
    };
    this.speakDealer(textMap[lang] || textMap.en, lang);
  }

  public speakAviatorCrashed(multiplier: number, lang: 'bn' | 'hi' | 'en' = 'en') {
    const textMap = {
      bn: `ফ্লাই অ্যাওয়ে! ${multiplier.toFixed(2)}x এ ক্র্যাশ করেছে।`,
      hi: `फ्लीड अवे! ${multiplier.toFixed(2)}x पर क्रैश हुआ।`,
      en: `Flew away! Crashed at ${multiplier.toFixed(2)}x.`
    };
    this.speakDealer(textMap[lang] || textMap.en, lang);
  }

  /**
   * Helper to normalize English/Bengali game names for crystal-clear spoken announcement
   */
  public getBengaliGameName(rawName?: string, description?: string, title?: string): string {
    const combined = `${rawName || ''} ${description || ''} ${title || ''}`.toLowerCase();
    
    if (combined.includes('super car') || combined.includes('supercar') || combined.includes('three super car') || combined.includes('car draw')) {
      return 'সুপার কার';
    }
    if (combined.includes('roulette') || combined.includes('রুলেট')) {
      return 'রুলেট';
    }
    if (combined.includes('andar') || combined.includes('bahar') || combined.includes('আন্দর') || combined.includes('বাহার')) {
      return 'আন্দর বাহার';
    }
    if (combined.includes('dragon') || combined.includes('tiger') || combined.includes('ড্রাগন') || combined.includes('টাইগার')) {
      return 'ড্রাগন টাইগার';
    }
    if (combined.includes('crash') || combined.includes('aviator') || combined.includes('ক্র্যাশ') || combined.includes('এভিয়েটর')) {
      return 'ক্র্যাশ';
    }
    if (combined.includes('wheel') || combined.includes('fortune') || combined.includes('spin') || combined.includes('ফরচুন')) {
      return 'হুইল অফ ফরচুন';
    }
    if (combined.includes('lottery') || combined.includes('ticket') || combined.includes('লটারি') || combined.includes('ড্র')) {
      return 'লটারি';
    }
    if (rawName && rawName.trim().length > 0) {
      return rawName.trim();
    }
    return 'ক্যাসিনো';
  }

  /**
   * Ultra-Clear Personalized Bengali Speech for Users (Deposit & Withdrawal Live Voice Announcements)
   * Calls the user loud and clear by their registered name in Bengali!
   */
  public speakUserTransactionVoice(options: {
    type: 'deposit_pending' | 'deposit_approved' | 'deposit_rejected' | 'withdrawal_pending' | 'withdrawal_approved' | 'withdrawal_rejected';
    userName?: string;
    amount?: number;
    reason?: string;
    method?: string;
  }) {
    if (this.isMuted || !this.soundEffectsEnabled || typeof window === 'undefined') return;

    try {
      this.unlockAudio();

      let rawName = (options.userName || 'ইউজার').trim();
      if (rawName.includes('@')) {
        rawName = rawName.split('@')[0];
      }
      // Clean special symbols but keep Bengali, alphanumeric, and spaces
      rawName = rawName.replace(/[^a-zA-Z0-9\u0980-\u09FF\s]/g, '').trim() || 'ইউজার';

      let textToSpeak = '';
      const amtStr = typeof options.amount === 'number' && options.amount > 0 ? `₹${options.amount.toLocaleString('en-IN')} ` : '';

      switch (options.type) {
        case 'deposit_pending':
          textToSpeak = `${rawName}, আপনার ${amtStr}ডিপোজিট পেন্ডিংয়ে আছে। ভেরিফিকেশন চলছে।`;
          break;
        case 'deposit_approved':
          textToSpeak = `${rawName}, অভিনন্দন! আপনার ${amtStr}ডিপোজিট সফল হয়েছে এবং আপনার অ্যাকাউন্টে ক্রেডিট হয়ে গেছে!`;
          break;
        case 'deposit_rejected':
          textToSpeak = `${rawName}, দুঃখিত, আপনার ${amtStr}ডিপোজিট রিজেক্ট হয়ে গেছে। অনুগ্রহ করে সঠিক তথ্য পুনরায় জমা দিন।`;
          break;
        case 'withdrawal_pending':
          textToSpeak = `${rawName}, আপনার ${amtStr}উইথড্র রিকোয়েস্ট পেন্ডিংয়ে আছে। প্রসেসিং চলছে।`;
          break;
        case 'withdrawal_approved':
          textToSpeak = `${rawName}, অভিনন্দন! আপনার ${amtStr}উইথড্র অনুমোদিত হয়েছে এবং টাকা আপনার অ্যাকাউন্টে পাঠিয়ে দেওয়া হয়েছে!`;
          break;
        case 'withdrawal_rejected':
          textToSpeak = `${rawName}, দুঃখিত, আপনার ${amtStr}উইথড্র রিজেক্ট হয়ে গেছে এবং টাকা আপনার ওয়ালেটে ফেরত দেওয়া হয়েছে।`;
          break;
      }

      // Play corresponding chime first
      if (options.type === 'deposit_approved' || options.type === 'withdrawal_approved') {
        this.playWin();
      } else if (options.type === 'deposit_rejected' || options.type === 'withdrawal_rejected') {
        this.playLoss();
      } else {
        this.playCoin();
      }

      // 1. Android Native Bridge Support if running inside native Android WebView
      const win = window as any;
      if (win.AndroidBridge && typeof win.AndroidBridge.speakText === 'function') {
        win.AndroidBridge.speakText(textToSpeak, 'bn');
        return;
      }
      if (win.Android && typeof win.Android.speak === 'function') {
        win.Android.speak(textToSpeak);
        return;
      }

      // 2. Web Speech Synthesis for browser / PWA
      if (!('speechSynthesis' in window)) return;

      // Resume speech engine in case browser paused it
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      // Cancel any ongoing speech to announce this critical update immediately
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'bn-IN';
      utterance.rate = 0.92; // Slightly measured for maximum vocal clarity
      utterance.pitch = 1.05;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const bengaliVoice = voices.find(v => 
          v.lang.toLowerCase().includes('bn') || 
          v.name.toLowerCase().includes('bangla') || 
          v.name.toLowerCase().includes('bengali')
        );
        const indianVoice = voices.find(v => v.lang.toLowerCase().includes('in') || v.lang.toLowerCase().includes('hi'));
        
        if (bengaliVoice) {
          utterance.voice = bengaliVoice;
        } else if (indianVoice) {
          utterance.voice = indianVoice;
        }
      }

      setTimeout(() => {
        try {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
          window.speechSynthesis.speak(utterance);
        } catch (err) {
          console.warn('SpeechSynthesis user voice error:', err);
        }
      }, 350);

    } catch (e) {
      console.warn('User transaction voice error:', e);
    }
  }

  /**
   * Ultra-Loud, Crystal-Clear Bengali Speech Synthesis for Admin Real-Time Microphone Alerts
   */
  public speakAdminBengaliAlert(options: {
    type: 'deposit' | 'withdrawal' | 'ticket' | 'bet' | 'login' | 'general';
    gameName?: string;
    amount?: number;
    userName?: string;
    description?: string;
    title?: string;
  }) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (this.isMuted || !this.soundEffectsEnabled) return;

    try {
      // Formulate exact high-impact Bengali phrase requested by admin
      let textToSpeak = '';
      const type = options.type;

      if (type === 'deposit') {
        textToSpeak = 'অ্যালার্ট! আপনার অ্যাকাউন্টে নতুন ডিপোজিট এসেছে!';
      } else if (type === 'withdrawal') {
        textToSpeak = 'অ্যালার্ট! নতুন উইথড্রয়াল রিকোয়েস্ট এসেছে!';
      } else if (type === 'bet' || type === 'ticket') {
        const gameBn = this.getBengaliGameName(options.gameName, options.description, options.title);
        textToSpeak = `অ্যালার্ট! ${gameBn} গেমে নতুন বেট ধরা হয়েছে!`;
      } else if (type === 'login') {
        textToSpeak = 'অ্যালার্ট! নতুন ইউজার সিস্টেমে প্রবেশ করেছে!';
      } else {
        const gameBn = this.getBengaliGameName(options.gameName, options.description, options.title);
        textToSpeak = `অ্যালার্ট! ${gameBn} নোটিফিকেশন এসেছে!`;
      }

      // Resume speech engine in case browser paused it
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'bn-IN';
      utterance.rate = 0.95; // Crisp, perfectly enunciated speed
      utterance.pitch = 1.08; // High clarity and prominent vocal tone
      utterance.volume = 1.0; // Maximum allowed system volume

      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        // Find best Bengali voice (or fallback to high-definition Indian voice)
        const bengaliVoice = voices.find(v => 
          v.lang.toLowerCase().includes('bn') || 
          v.name.toLowerCase().includes('bangla') || 
          v.name.toLowerCase().includes('bengali')
        );
        const indianVoice = voices.find(v => v.lang.toLowerCase().includes('in') || v.lang.toLowerCase().includes('hi'));
        
        if (bengaliVoice) {
          utterance.voice = bengaliVoice;
        } else if (indianVoice) {
          utterance.voice = indianVoice;
        }
      }

      // Small delay after siren chime so chime finishes and microphone voice shouts clearly
      setTimeout(() => {
        try {
          window.speechSynthesis.speak(utterance);
        } catch (err) {
          console.warn('SpeechSynthesis error:', err);
        }
      }, 380);

    } catch (e) {
      console.warn('Admin voice alert speech error:', e);
    }
  }

  /**
   * Loud Synthesized Admin Alert Siren & Chime + Bengali Voice Announcement
   * Triggered in real-time when a user deposits, requests withdrawal, buys tickets, or places casino wagers
   */
  public playAdminLoudAlert(
    type: 'deposit' | 'withdrawal' | 'ticket' | 'bet' | 'login' | 'general' = 'general',
    details?: {
      gameName?: string;
      amount?: number;
      userName?: string;
      description?: string;
      title?: string;
    }
  ) {
    this.triggerHaptic([60, 60, 100, 60, 150]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      if (type === 'deposit') {
        // High-energy ascending cash register & crystal chime bell (₹ Deposit alert)
        const notes = [880, 1174.66, 1479.98, 1760, 2349.32]; // A5, D6, F#6, A6, D7
        notes.forEach((freq, idx) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.07);
          
          gain.gain.setValueAtTime(0.7, now + idx * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.45);

          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + idx * 0.07);
          osc.stop(now + idx * 0.07 + 0.45);
        });
      } else if (type === 'withdrawal') {
        // Urgent distinct dual-pulse chime (Withdrawal Request Alert)
        const tones = [1046.50, 783.99, 1046.50, 1318.51]; // C6, G5, C6, E6
        tones.forEach((freq, idx) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + idx * 0.09);

          gain.gain.setValueAtTime(0.65, now + idx * 0.09);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.35);

          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + idx * 0.09);
          osc.stop(now + idx * 0.09 + 0.35);
        });
      } else if (type === 'ticket') {
        // Ticket purchase electronic lottery bell
        const freqs = [1200, 1500, 1800, 2400];
        freqs.forEach((freq, idx) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);

          gain.gain.setValueAtTime(0.55, now + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.25);

          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.25);
        });
      } else if (type === 'bet') {
        // Live Casino Wager dual sweep siren & laser punch
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'triangle';

        osc1.frequency.setValueAtTime(800, now);
        osc1.frequency.linearRampToValueAtTime(1500, now + 0.08);
        osc1.frequency.linearRampToValueAtTime(800, now + 0.16);
        osc1.frequency.linearRampToValueAtTime(1700, now + 0.24);

        osc2.frequency.setValueAtTime(1200, now);
        osc2.frequency.linearRampToValueAtTime(2200, now + 0.12);
        osc2.frequency.linearRampToValueAtTime(1100, now + 0.24);

        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.4);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.4);
        osc2.stop(now + 0.4);
      } else {
        // General Crystal Bell Alert
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, now);
        osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.1);
        gain.gain.setValueAtTime(0.55, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (e) {
      console.warn('Admin loud alert audio error:', e);
    }

    // Trigger Loud Bengali Voice Announcement on top of chime!
    this.speakAdminBengaliAlert({
      type,
      gameName: details?.gameName,
      amount: details?.amount,
      userName: details?.userName,
      description: details?.description,
      title: details?.title
    });
  }

  public playAdminAlert(type: 'deposit' | 'withdrawal' | 'ticket' | 'bet' | 'login' | 'general' = 'bet', details?: any) {
    this.playAdminLoudAlert(type, details);
  }
}

export const soundFx = new SoundManager();
