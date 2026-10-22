// Böngészőben generált hangok (Web Audio API): korszakonkénti ambient hangulatok
// és rövid hangeffektek. Nincs külső hangfájl.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI note -> Hz
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class Soundscape {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.7;
    this.mood = null;
    this.active = null;
    this.onBoom = null;
    this.ksCache = new Map();
  }

  async start() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = (this.ctx = new AC());
      this.master = ctx.createGain();
      this.master.gain.value = this.enabled ? this.volume : 0;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(ctx.destination);
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this.impulse(3.2, 2.6);
      this.reverbIn = ctx.createGain();
      this.reverbIn.gain.value = 0.55;
      this.reverbIn.connect(this.reverb).connect(this.master);
      this.white = this.noiseBuffer('white');
      this.brown = this.noiseBuffer('brown');
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  setEnabled(on) {
    this.enabled = on;
    if (!this.ctx) return;
    const g = this.master.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setTargetAtTime(on ? this.volume : 0, this.ctx.currentTime, 0.25);
  }

  setVolume(v) {
    this.volume = v;
    if (this.ctx && this.enabled) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  // ------------------------------------------------------------------ building blocks
  impulse(seconds, decay) {
    const { ctx } = this;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  noiseBuffer(kind) {
    const { ctx } = this;
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return buf;
  }

  noise(kind = 'white', loop = true) {
    const s = this.ctx.createBufferSource();
    s.buffer = kind === 'brown' ? this.brown : this.white;
    s.loop = loop;
    if (loop) s.loopStart = Math.random();
    return s;
  }

  filter(type, freq, q = 1) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  gain(v = 0) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    return g;
  }

  lfo(rate, depth, target) {
    const o = this.ctx.createOscillator();
    o.frequency.value = rate;
    const g = this.gain(depth);
    o.connect(g).connect(target);
    o.start();
    return o;
  }

  env(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  out(node, dest, wet = 0.3) {
    node.connect(dest);
    if (wet > 0) {
      const s = this.gain(wet);
      node.connect(s).connect(this.reverbIn);
    }
  }

  // ------------------------------------------------------------------ continuous layers
  wind(bus, level = 0.2, center = 500) {
    const src = this.noise();
    const bp = this.filter('bandpass', center, 0.7);
    const g = this.gain(level);
    src.connect(bp).connect(g).connect(bus);
    const l1 = this.lfo(rand(0.05, 0.08), center * 0.55, bp.frequency);
    const l2 = this.lfo(rand(0.1, 0.16), level * 0.7, g.gain);
    src.start();
    return [src, l1, l2];
  }

  rumble(bus, level = 0.25) {
    const src = this.noise('brown');
    const lp = this.filter('lowpass', 90, 0.5);
    const g = this.gain(level);
    src.connect(lp).connect(g).connect(bus);
    const l = this.lfo(0.07, level * 0.5, g.gain);
    src.start();
    return [src, l];
  }

  drone(bus, freqs, { type = 'sawtooth', cutoff = 500, level = 0.05 } = {}) {
    const lp = this.filter('lowpass', cutoff, 0.8);
    const g = this.gain(level);
    lp.connect(g);
    this.out(g, bus, 0.4);
    const nodes = [this.lfo(0.045, cutoff * 0.35, lp.frequency)];
    for (const f of freqs) {
      for (const det of [-4, 4]) {
        const o = this.ctx.createOscillator();
        o.type = type;
        o.frequency.value = f;
        o.detune.value = det;
        o.connect(lp);
        o.start();
        nodes.push(o);
      }
    }
    return nodes;
  }

  choir(bus, freqs, level = 0.035) {
    const f1 = this.filter('bandpass', 700, 4);
    const f2 = this.filter('bandpass', 1150, 5);
    const g = this.gain(level);
    f1.connect(g);
    f2.connect(g);
    this.out(g, bus, 0.8);
    const nodes = [this.lfo(0.11, 60, f1.frequency)];
    for (const f of freqs) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      this.lfo(rand(4.5, 5.5), f * 0.006, o.frequency);
      o.connect(f1);
      o.connect(f2);
      o.start();
      nodes.push(o);
    }
    return nodes;
  }

  radio(bus, level = 0.05) {
    const src = this.noise();
    const hp = this.filter('highpass', 1800);
    const bp = this.filter('bandpass', 3200, 0.6);
    const g = this.gain(level);
    src.connect(hp).connect(bp).connect(g).connect(bus);
    const l = this.lfo(0.3, level * 0.6, g.gain);
    src.start();
    return [src, l];
  }

  crowd(bus, level = 0.06) {
    const src = this.noise('brown');
    const bp = this.filter('bandpass', 600, 0.9);
    const g = this.gain(level);
    src.connect(bp).connect(g).connect(bus);
    const l1 = this.lfo(0.21, level * 0.6, g.gain);
    const l2 = this.lfo(0.13, 220, bp.frequency);
    src.start();
    return [src, l1, l2];
  }

  // ------------------------------------------------------------------ one-shot voices
  bell(t, f, level, dest) {
    const partials = [[0.5, 0.45, 7], [1, 1, 5], [1.19, 0.5, 4], [1.5, 0.35, 3.5], [2, 0.45, 3], [2.5, 0.2, 2.2], [3, 0.16, 1.8], [4.2, 0.08, 1.2]];
    const g = this.gain(1);
    this.out(g, dest, 0.7);
    for (const [r, a, d] of partials) {
      const o = this.ctx.createOscillator();
      o.frequency.value = f * r;
      const e = this.gain();
      this.env(e, t, level * a, 0.004, d);
      o.connect(e).connect(g);
      o.start(t);
      o.stop(t + d + 0.1);
    }
  }

  drum(t, f, level, dest, decay = 0.5) {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(f * 2.4, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
    const e = this.gain();
    this.env(e, t, level, 0.003, decay);
    o.connect(e);
    this.out(e, dest, 0.25);
    o.start(t);
    o.stop(t + decay + 0.1);
    const n = this.noise('white', false);
    const lp = this.filter('lowpass', 1100);
    const ne = this.gain();
    this.env(ne, t, level * 0.35, 0.002, 0.06);
    n.connect(lp).connect(ne).connect(dest);
    n.start(t);
    n.stop(t + 0.1);
  }

  tick(t, level, dest, freq = 3500, decay = 0.05) {
    const n = this.noise('white', false);
    const bp = this.filter('bandpass', freq, 1.2);
    const e = this.gain();
    this.env(e, t, level, 0.001, decay);
    n.connect(bp).connect(e);
    this.out(e, dest, 0.15);
    n.start(t, Math.random());
    n.stop(t + decay + 0.05);
  }

  snare(t, level, dest) {
    this.tick(t, level, dest, 2400, 0.16);
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = 190;
    const e = this.gain();
    this.env(e, t, level * 0.5, 0.002, 0.07);
    o.connect(e).connect(dest);
    o.start(t);
    o.stop(t + 0.12);
  }

  tone(t, f, dur, level, dest, { type = 'sine', vibrato = 0, attack = 0.05, wet = 0.5, cutoff = 0 } = {}) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    if (vibrato) {
      const l = this.ctx.createOscillator();
      l.frequency.value = 5.2;
      const lg = this.gain(0);
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * vibrato, t + Math.min(0.3, dur * 0.5));
      l.connect(lg).connect(o.frequency);
      l.start(t);
      l.stop(t + dur + 0.3);
    }
    const e = this.gain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.exponentialRampToValueAtTime(level, t + attack);
    e.gain.setValueAtTime(level, t + Math.max(attack, dur - 0.08));
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
    let node = o;
    if (cutoff) {
      const lp = this.filter('lowpass', cutoff, 0.7);
      o.connect(lp);
      node = lp;
    }
    node.connect(e);
    this.out(e, dest, wet);
    o.start(t);
    o.stop(t + dur + 0.35);
  }

  flute(t, notes, dest, level = 0.05) {
    let tt = t;
    for (const [n, d] of notes) {
      const f = NOTE(n);
      this.tone(tt, f, d, level, dest, { vibrato: 0.006, attack: 0.09, wet: 0.8 });
      const br = this.noise('white', false);
      const bp = this.filter('bandpass', f * 2, 6);
      const e = this.gain();
      this.env(e, tt, level * 0.35, 0.06, d);
      br.connect(bp).connect(e).connect(dest);
      br.start(tt, Math.random());
      br.stop(tt + d + 0.2);
      tt += d;
    }
    return tt - t;
  }

  pluck(t, f, level, dest) {
    const key = Math.round(f);
    let buf = this.ksCache.get(key);
    if (!buf) {
      const sr = this.ctx.sampleRate;
      const len = Math.floor(sr * 1.6);
      buf = this.ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      const N = Math.max(2, Math.round(sr / f));
      for (let i = 0; i < N; i++) d[i] = Math.random() * 2 - 1;
      for (let i = N; i < len; i++) d[i] = 0.497 * (d[i - N] + d[i - N + 1]);
      this.ksCache.set(key, buf);
    }
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    const hp = this.filter('highpass', 120);
    const e = this.gain(level);
    s.connect(hp).connect(e);
    this.out(e, dest, 0.35);
    s.start(t);
  }

  musicBox(t, f, level, dest) {
    for (const [r, a, d] of [[1, 1, 1.6], [2, 0.25, 0.9], [5.4, 0.08, 0.25]]) {
      const o = this.ctx.createOscillator();
      o.frequency.value = f * r;
      const e = this.gain();
      this.env(e, t, level * a, 0.003, d);
      o.connect(e);
      this.out(e, dest, 0.5);
      o.start(t);
      o.stop(t + d + 0.1);
    }
  }

  chime(t, f, level, dest) {
    for (const [r, a, d] of [[1, 1, 2.6], [2.76, 0.3, 1.2], [5.4, 0.1, 0.5]]) {
      const o = this.ctx.createOscillator();
      o.frequency.value = f * r;
      const e = this.gain();
      this.env(e, t, level * a, 0.004, d);
      o.connect(e);
      this.out(e, dest, 0.8);
      o.start(t);
      o.stop(t + d + 0.1);
    }
  }

  boom(t, level, dest) {
    const n = this.noise('brown', false);
    const lp = this.filter('lowpass', 160, 0.7);
    const e = this.gain();
    this.env(e, t, level, 0.01, 2.6);
    n.connect(lp).connect(e);
    this.out(e, dest, 0.5);
    n.start(t, Math.random() * 2);
    n.stop(t + 3);
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(58, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 1.2);
    const oe = this.gain();
    this.env(oe, t, level * 0.9, 0.01, 1.4);
    o.connect(oe).connect(dest);
    o.start(t);
    o.stop(t + 1.6);
    const delay = Math.max(0, (t - this.ctx.currentTime) * 1000);
    setTimeout(() => this.onBoom?.(level), delay);
  }

  morse(t, text, dest, level = 0.04) {
    const code = { S: '...', O: '---', H: '....', U: '..-', N: '-.', G: '--.', A: '.-', R: '.-.', Y: '-.--', E: '.', T: '-' };
    const u = 0.075;
    let tt = t;
    for (const ch of text) {
      if (ch === ' ') { tt += u * 4; continue; }
      for (const s of code[ch] || '') {
        const d = s === '.' ? u : u * 3;
        const o = this.ctx.createOscillator();
        o.frequency.value = 680;
        const e = this.gain();
        e.gain.setValueAtTime(0, tt);
        e.gain.linearRampToValueAtTime(level, tt + 0.005);
        e.gain.setValueAtTime(level, tt + d - 0.005);
        e.gain.linearRampToValueAtTime(0, tt + d);
        o.connect(e).connect(dest);
        o.start(tt);
        o.stop(tt + d + 0.02);
        tt += d + u;
      }
      tt += u * 2;
    }
    return tt - t;
  }

  // ------------------------------------------------------------------ moods
  setMood(mood) {
    if (!this.ctx || mood === this.mood) return;
    this.mood = mood;
    const old = this.active;
    if (old) {
      old.alive = false;
      old.timers.forEach(clearTimeout);
      old.bus.gain.cancelScheduledValues(this.ctx.currentTime);
      old.bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.7);
      setTimeout(() => {
        old.nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } });
        old.bus.disconnect();
      }, 4000);
    }
    const bus = this.gain(0);
    bus.connect(this.master);
    bus.gain.setTargetAtTime(1, this.ctx.currentTime + 0.3, 0.9);
    const st = (this.active = { bus, nodes: [], timers: [], alive: true });
    const add = (arr) => st.nodes.push(...arr);
    const every = (minS, maxS, fn, first = rand(minS, maxS) * 0.5) => {
      const loop = (wait) => {
        st.timers.push(setTimeout(() => {
          if (!st.alive) return;
          fn(this.ctx.currentTime + 0.05);
          loop(rand(minS, maxS));
        }, wait * 1000));
      };
      loop(first);
    };
    // Steady rhythm scheduled in short look-ahead windows
    const rhythm = (bpm, steps, fn) => {
      const spb = 60 / bpm / 4;
      let next = this.ctx.currentTime + 0.4;
      let i = 0;
      const tick = () => {
        if (!st.alive) return;
        while (next < this.ctx.currentTime + 0.6) {
          fn(i % steps, next, i);
          next += spb;
          i++;
        }
        st.timers.push(setTimeout(tick, 200));
      };
      tick();
    };
    const PENTA = [62, 65, 67, 69, 72, 74, 77]; // D minor pentatonic
    const folkPhrase = () => {
      const len = 4 + Math.floor(Math.random() * 4);
      let idx = 4 + Math.floor(Math.random() * 3);
      const out = [];
      for (let i = 0; i < len; i++) {
        out.push([PENTA[idx], pick([0.35, 0.45, 0.7, 0.9])]);
        idx = Math.max(0, Math.min(PENTA.length - 1, idx + pick([-2, -1, -1, 1, 0])));
      }
      out.push([62, 1.6]);
      return out;
    };

    switch (mood) {
      case 'steppe':
        add(this.wind(bus, 0.2, 520));
        add(this.drone(bus, [NOTE(38), NOTE(45)], { cutoff: 380, level: 0.045 }));
        every(9, 16, (t) => this.flute(t, folkPhrase(), bus, 0.045), 2.5);
        break;
      case 'horde':
        add(this.wind(bus, 0.24, 450));
        add(this.drone(bus, [NOTE(38), NOTE(45)], { cutoff: 420, level: 0.045 }));
        every(10, 16, (t) => { for (let k = 0; k < 14; k++) { const b = t + k * 0.48; [0, 0.1, 0.21].forEach((o, j) => this.drum(b + o, 70 + j * 8, 0.12 - k * 0.006, bus, 0.18)); } }, 1);
        every(12, 20, (t) => this.flute(t, folkPhrase(), bus, 0.04), 6);
        break;
      case 'coronation':
        add(this.drone(bus, [NOTE(38), NOTE(45), NOTE(50)], { type: 'triangle', cutoff: 900, level: 0.05 }));
        add(this.choir(bus, [NOTE(50), NOTE(57), NOTE(62)], 0.03));
        [0, 2.4, 4.8].forEach((d) => this.bell(this.ctx.currentTime + 0.6 + d, NOTE(55), 0.09, bus));
        every(10, 15, (t) => this.bell(t, pick([NOTE(55), NOTE(62)]), 0.07, bus));
        break;
      case 'mongol':
        add(this.wind(bus, 0.28, 380));
        add(this.drone(bus, [NOTE(33), NOTE(40)], { cutoff: 300, level: 0.06 }));
        rhythm(92, 16, (s, t) => {
          if (s === 0 || s === 6 || s === 8) this.drum(t, 55, 0.3, bus, 0.7);
          else if (s === 11 || s === 14) this.drum(t, 75, 0.14, bus, 0.35);
        });
        break;
      case 'battle':
        add(this.drone(bus, [NOTE(33), NOTE(40), NOTE(45)], { cutoff: 340, level: 0.055 }));
        add(this.wind(bus, 0.16, 400));
        rhythm(118, 8, (s, t) => {
          if (s === 0 || s === 3 || s === 4) this.drum(t, 60, 0.26, bus, 0.55);
          if (s === 6) this.snare(t, 0.07, bus);
        });
        every(6, 11, (t) => this.boom(t, 0.35, bus), 2);
        break;
      case 'ottoman': {
        add(this.drone(bus, [NOTE(38)], { cutoff: 600, level: 0.035 }));
        rhythm(100, 8, (s, t) => {
          if (s === 0 || s === 4) this.drum(t, 62, 0.22, bus, 0.5);
          if (s === 2 || s === 3 || s === 6) this.tick(t, 0.09, bus, 3200, 0.05);
        });
        const HICAZ = [62, 63, 66, 67, 69, 70, 72, 74];
        every(9, 14, (t) => {
          let tt = t;
          let i = 4;
          for (let k = 0; k < 7; k++) {
            const d = pick([0.25, 0.25, 0.5]);
            this.tone(tt, NOTE(HICAZ[i]), d, 0.03, bus, { type: 'square', cutoff: 1600, vibrato: 0.004, attack: 0.02, wet: 0.4 });
            tt += d;
            i = Math.max(0, Math.min(7, i + pick([-1, -1, 1, -2])));
          }
        }, 3);
        break;
      }
      case 'baroque': {
        const prog = [[50, 53, 57], [55, 58, 62], [48, 52, 55], [53, 57, 60], [46, 50, 53], [55, 58, 62], [57, 61, 64], [50, 53, 57]];
        rhythm(76, 64, (s, t) => {
          const ch = prog[Math.floor(s / 8)];
          const pat = [0, 1, 2, 1, 2, 1, 2, 1];
          const n = ch[pat[s % 8]] + (s % 8 >= 4 ? 12 : 0);
          this.pluck(t, NOTE(n), 0.16, bus);
          if (s % 8 === 0) this.pluck(t, NOTE(ch[0] - 12), 0.18, bus);
        });
        every(14, 22, (t) => this.bell(t, NOTE(62), 0.04, bus), 8);
        break;
      }
      case 'revolution':
        add(this.crowd(bus, 0.05));
        rhythm(108, 16, (s, t) => {
          if ([0, 4, 8, 10, 12].includes(s)) this.snare(t, 0.06, bus);
          if (s === 14 || s === 15) this.snare(t, 0.035, bus);
        });
        this.bugle(this.ctx.currentTime + 0.8, bus);
        every(16, 26, (t) => this.bugle(t, bus), 14);
        break;
      case 'waltz': {
        const mel = [76, 73, 69, 71, 73, 74, 76, 76, 78, 76, null, null, 74, 71, 68, 69, 71, 73, 74, 74, 76, 73, null, null];
        const bass = [45, 45, 52, 52, 50, 50, 45, 45];
        rhythm(132, 24, (s, t, i) => {
          if (s % 3 === 0) this.musicBox(t, NOTE(bass[Math.floor(s / 3) % 8]), 0.06, bus);
          else this.musicBox(t, NOTE(61 + (s % 3 === 1 ? 0 : 4)), 0.025, bus);
          const m = mel[s];
          if (m && Math.floor(i / 24) % 2 === 0) this.musicBox(t, NOTE(m), 0.07, bus);
        });
        break;
      }
      case 'war':
        add(this.rumble(bus, 0.3));
        add(this.wind(bus, 0.12, 350));
        every(3.5, 9, (t) => this.boom(t, rand(0.2, 0.42), bus), 1.5);
        break;
      case 'requiem':
        add(this.drone(bus, [NOTE(38), NOTE(41), NOTE(45)], { type: 'triangle', cutoff: 520, level: 0.05 }));
        add(this.wind(bus, 0.1, 420));
        this.bell(this.ctx.currentTime + 0.8, NOTE(43), 0.12, bus);
        every(7, 9, (t) => this.bell(t, NOTE(43), 0.09, bus));
        break;
      case 'ww2':
        add(this.rumble(bus, 0.3));
        add(this.radio(bus, 0.025));
        this.siren(this.ctx.currentTime + 0.5, bus);
        every(4, 9, (t) => this.boom(t, rand(0.2, 0.4), bus), 5);
        every(14, 22, (t) => this.morse(t, 'SOS', bus, 0.03), 9);
        break;
      case 'postwar':
        add(this.radio(bus, 0.03));
        add(this.drone(bus, [NOTE(36), NOTE(43), NOTE(46)], { type: 'triangle', cutoff: 480, level: 0.04 }));
        every(6, 11, (t) => { for (let k = 0; k < 9; k++) this.tick(t + k * rand(0.08, 0.16), 0.11, bus, 2800, 0.03); }, 1.5);
        break;
      case 'uprising':
        add(this.radio(bus, 0.035));
        add(this.drone(bus, [NOTE(36), NOTE(43)], { cutoff: 360, level: 0.045 }));
        every(5, 10, (t) => this.boom(t, rand(0.18, 0.32), bus), 3);
        every(12, 18, (t) => this.morse(t, 'SOS', bus, 0.035), 2);
        break;
      case 'freedom': {
        add(this.drone(bus, [NOTE(50), NOTE(57), NOTE(64), NOTE(66)], { type: 'triangle', cutoff: 1100, level: 0.04 }));
        const MAJ = [74, 76, 78, 81, 83, 86];
        every(1.6, 3.5, (t) => this.chime(t, NOTE(pick(MAJ)), 0.04, bus), 1);
        break;
      }
      case 'europe': {
        add(this.drone(bus, [NOTE(45), NOTE(52), NOTE(61), NOTE(64)], { type: 'triangle', cutoff: 1300, level: 0.04 }));
        const ode = [76, 76, 77, 79, 79, 77, 76, 74, 72, 72, 74, 76, 76, 74, 74];
        const durs = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, 0.5, 2];
        let t = this.ctx.currentTime + 1.2;
        ode.forEach((n, i) => { this.chime(t, NOTE(n), 0.06, bus); t += durs[i] * 0.42; });
        every(1.4, 3, (tt) => this.chime(tt, NOTE(pick([81, 83, 86, 88, 91])), 0.025, bus), 8);
        break;
      }
      default:
        add(this.wind(bus, 0.15, 500));
    }
  }

  bugle(t, dest) {
    const notes = [[67, 0.18], [72, 0.18], [76, 0.18], [79, 0.5], [76, 0.18], [79, 0.9]];
    let tt = t;
    for (const [n, d] of notes) {
      this.tone(tt, NOTE(n), d, 0.04, dest, { type: 'sawtooth', cutoff: 2000, attack: 0.03, vibrato: 0.003, wet: 0.6 });
      tt += d + 0.03;
    }
  }

  siren(t, dest) {
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    const f = o.frequency;
    f.setValueAtTime(260, t);
    for (let k = 0; k < 3; k++) {
      f.linearRampToValueAtTime(620, t + k * 4 + 2);
      f.linearRampToValueAtTime(260, t + k * 4 + 4);
    }
    const e = this.gain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.exponentialRampToValueAtTime(0.035, t + 1.5);
    e.gain.setValueAtTime(0.035, t + 10);
    e.gain.exponentialRampToValueAtTime(0.0001, t + 12);
    o.connect(e);
    this.out(e, dest, 0.9);
    o.start(t);
    o.stop(t + 12.2);
  }

  // ------------------------------------------------------------------ cues
  cue(name) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime + 0.02;
    const dest = this.master;
    switch (name) {
      case 'whoosh': {
        const n = this.noise('white', false);
        const bp = this.filter('bandpass', 300, 1.4);
        bp.frequency.setValueAtTime(260, t);
        bp.frequency.exponentialRampToValueAtTime(2400, t + 0.55);
        bp.frequency.exponentialRampToValueAtTime(700, t + 1.2);
        const e = this.gain();
        e.gain.setValueAtTime(0.0001, t);
        e.gain.exponentialRampToValueAtTime(0.16, t + 0.45);
        e.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
        n.connect(bp).connect(e);
        this.out(e, dest, 0.4);
        n.start(t, Math.random());
        n.stop(t + 1.4);
        break;
      }
      case 'page':
        for (let k = 0; k < 6; k++) this.tick(t + k * 0.045 + Math.random() * 0.02, 0.09 - k * 0.01, dest, 1800 + k * 300, 0.09);
        break;
      case 'type':
        for (let k = 0; k < 5; k++) this.tick(t + k * rand(0.07, 0.12), 0.12, dest, 2900, 0.025);
        this.tick(t + 0.62, 0.1, dest, 5200, 0.12);
        break;
      case 'radio': {
        const o = this.ctx.createOscillator();
        o.frequency.setValueAtTime(300, t);
        o.frequency.exponentialRampToValueAtTime(2200, t + 0.7);
        const e = this.gain();
        this.env(e, t, 0.03, 0.05, 0.75);
        o.connect(e).connect(dest);
        o.start(t);
        o.stop(t + 0.9);
        const n = this.noise('white', false);
        const hp = this.filter('highpass', 1500);
        const ne = this.gain();
        this.env(ne, t, 0.06, 0.05, 0.8);
        n.connect(hp).connect(ne).connect(dest);
        n.start(t, Math.random());
        n.stop(t + 1);
        break;
      }
      case 'tick':
        this.tick(t, 0.05, dest, 4200, 0.03);
        break;
      case 'boom':
        this.boom(t + 0.2, 0.5, dest);
        break;
      case 'bell':
        this.bell(t, NOTE(55), 0.1, dest);
        break;
      case 'tear': {
        const n = this.noise('white', false);
        const bp = this.filter('bandpass', 900, 0.8);
        bp.frequency.setValueAtTime(500, t);
        bp.frequency.linearRampToValueAtTime(2600, t + 0.9);
        const e = this.gain(0);
        for (let k = 0; k < 40; k++) e.gain.setValueAtTime(rand(0.02, 0.22) * (1 - k / 45), t + k * 0.022);
        e.gain.setValueAtTime(0, t + 0.95);
        n.connect(bp).connect(e);
        this.out(e, dest, 0.3);
        n.start(t, Math.random());
        n.stop(t + 1);
        this.boom(t + 0.25, 0.4, dest);
        break;
      }
      case 'stamp':
        this.drum(t, 85, 0.25, dest, 0.18);
        this.tick(t, 0.12, dest, 1200, 0.08);
        break;
      case 'sparkle':
        [0, 0.08, 0.17, 0.27, 0.38].forEach((d, i) => this.chime(t + d, NOTE(84 + [0, 4, 7, 12, 16][i]), 0.035, dest));
        break;
      default:
    }
  }
}
