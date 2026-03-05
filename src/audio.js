class AudioController {
  constructor() {
    this.ctx = null;
    this.bgmOscillators = [];
    this.bgmGain = null;
    this.isPlayingBGM = false;
    this.initAudio = this.initAudio.bind(this);
  }

  initAudio() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playDrop() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.1);
  }

  playClear() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.setValueAtTime(880, t + 0.1);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  playBGM() {
    if (!this.ctx) this.initAudio();
    if (this.isPlayingBGM) return;
    this.isPlayingBGM = true;

    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.05;
    this.bgmGain.connect(this.ctx.destination);

    // simple drone
    const t = this.ctx.currentTime;
    const freqs = [110, 165, 220]; // A2, E3, A3

    freqs.forEach(f => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      osc.connect(this.bgmGain);
      osc.start(t);
      this.bgmOscillators.push(osc);
    });
  }

  stopBGM() {
    this.isPlayingBGM = false;
    this.bgmOscillators.forEach(osc => osc.stop());
    this.bgmOscillators = [];
    if (this.bgmGain) {
      this.bgmGain.disconnect();
    }
  }
}

export const audio = new AudioController();