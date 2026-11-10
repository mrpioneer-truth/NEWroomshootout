'use strict';
window.G = window.G || {};
// 발사음은 WebAudio 버퍼로 겹쳐 재생한다. 음악과 보스 등장음은 각각 독립 재생한다.
(function (G) {
  const TRACKS = {
    ambience: 0.32, ending: 0.6, shift: 0.55, neon: 0.4,
    weaver: 0.49, marionette: 0.5, whiteout: 0.56, strider: 0.52,
    reservoir: 0.6, orchard: 0.48,
    procession: 0.56, veil: 0.5, 'veil-shroud': 0.5, origin: 0.52, 'origin-awake': 0.58,
  };
  const ONE_SHOTS = ['ending', 'shift', 'neon'];
  const TRACK_FILES = { marionette: 'masquerade' };
  const CUES = { whistle: 0.72, knocks: 0.66, chant: 0.78, strobo: 0.58, encounter: 0.68, scream: 0.65 };
  const SFX_GAP = { hit: 0.03, orb: 0.12, hurt: 0.15 };
  const WEAPONS = {
    shot:    { sample: 'nine',   rate: 1.02, low: 200, high: 7700, gain: 0.82 },
    smg:     { sample: 'nine',   rate: 1.34, low: 420, high: 6600, gain: 0.64, duration: 0.2 },
    shotgun: { sample: 'twelve', rate: 0.82, low: 55,  high: 4100, gain: 0.96 },
    rifle:   { sample: 'doom',   rate: 1.09, low: 155, high: 6200, gain: 0.85 },
    flash:   { sample: 'doom',   rate: 0.69, low: 38,  high: 2900, gain: 0.88 },
    laser:   { sample: 'laser',  rate: 1.11, low: 130, high: 8400, gain: 0.56 },
  };
  const MASTER_LEVEL = 0.45;
  let ctx = null, master = null, gunBus = null, noise = null, enabled = true, music = null;
  let activeCue = null, musicName = null;
  const media = {};
  const cues = {};
  const shotBuffers = {};
  const lastPlayed = {};

  function mixMusic() {
    if (music) music.volume = TRACKS[musicName] * (activeCue ? 0.5 : 1);
  }

  function tone(type, f0, f1, dur, vol, delay) {
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function hiss(cutoff, dur, vol) {
    const t = ctx.currentTime;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise;
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  function decodeShots() {
    Object.entries(G.WeaponSamples || {}).forEach(([name, encoded]) => {
      const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
      ctx.decodeAudioData(bytes.buffer).then((buffer) => {
        shotBuffers[name] = buffer;
      }).catch(() => console.warn('발사음을 디코딩하지 못했습니다:', name));
    });
  }

  function playShot(weapon, strength) {
    const buffer = shotBuffers[weapon.sample];
    if (!buffer) return false;
    const start = ctx.currentTime;
    const duration = Math.min(weapon.duration || buffer.duration, buffer.duration);
    const end = start + duration / weapon.rate;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = weapon.rate;
    const bassCut = ctx.createBiquadFilter();
    bassCut.type = 'highpass';
    bassCut.frequency.value = weapon.low;
    const topCut = ctx.createBiquadFilter();
    topCut.type = 'lowpass';
    topCut.frequency.value = weapon.high;
    const level = ctx.createGain();
    level.gain.setValueAtTime(weapon.gain * strength, start);
    level.gain.setTargetAtTime(0, end - Math.min(0.035, (end - start) / 2), 0.008);
    source.connect(bassCut).connect(topCut).connect(level).connect(gunBus);
    source.start(start, 0, duration);
    return true;
  }

  const SOUNDS = {
    shot: () => { hiss(2600, 0.09, 0.5); tone('sine', 140, 45, 0.1, 0.5); },
    laser: () => { tone('triangle', 1680, 230, 0.092, 0.25); tone('sine', 190, 76, 0.075, 0.28); },
    rifle: () => { hiss(4200, 0.22, 0.6); tone('sine', 110, 30, 0.25, 0.7); },
    shotgun: () => { hiss(1800, 0.26, 0.75); tone('sine', 90, 30, 0.22, 0.7); },
    botshot: () => hiss(2200, 0.05, 0.12),
    hit: () => tone('square', 1300, 900, 0.03, 0.12),
    crit: () => { tone('square', 1800, 1500, 0.05, 0.16); tone('sine', 2600, 2400, 0.08, 0.1, 0.02); },
    kill: () => tone('sawtooth', 420, 70, 0.22, 0.2),
    hurt: () => { hiss(500, 0.18, 0.5); tone('sine', 90, 50, 0.15, 0.35); },
    boom: () => { hiss(700, 0.5, 0.8); tone('sine', 80, 25, 0.5, 0.6); },
    orb: () => tone('sine', 700, 320, 0.18, 0.1),
    pickup: () => { tone('sine', 880, 880, 0.08, 0.2); tone('sine', 1320, 1320, 0.12, 0.18, 0.07); },
    level: () => [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.16, 0.22, i * 0.08)),
    skill: () => tone('sawtooth', 200, 1200, 0.3, 0.16),
    event: () => { tone('triangle', 660, 660, 0.1, 0.18); tone('triangle', 990, 990, 0.16, 0.16, 0.1); },
    clear: () => [392, 523, 659].forEach((f, i) => tone('triangle', f, f, 0.2, 0.2, i * 0.1)),
  };

  const audio = {
    init() {
      Object.keys(TRACKS).forEach((name) => {
        const a = new Audio('assets/' + (TRACK_FILES[name] || name) + '.mp3');
        a.preload = ONE_SHOTS.includes(name) || name === 'ambience' ? 'auto' : 'metadata';
        a.volume = TRACKS[name];
        a.loop = !ONE_SHOTS.includes(name);
        a.addEventListener('error', () => console.warn('음원을 불러오지 못했습니다:', name));
        media[name] = a;
      });
      Object.entries(CUES).forEach(([name, volume]) => {
        const a = new Audio('assets/sfx/' + name + '.mp3');
        a.preload = 'auto';
        a.volume = volume;
        a.addEventListener('ended', () => { if (activeCue === a) this.stopCue(); });
        a.addEventListener('error', () => {
          if (activeCue === a) this.stopCue();
          console.warn('보스 음원을 불러오지 못했습니다:', name);
        });
        cues[name] = a;
      });
    },

    unlock() {
      try {
        if (!ctx) {
          ctx = new (window.AudioContext || window.webkitAudioContext)();
          master = ctx.createGain();
          master.gain.value = enabled ? MASTER_LEVEL : 0;
          master.connect(ctx.destination);
          gunBus = ctx.createDynamicsCompressor();
          gunBus.threshold.value = -12;
          gunBus.knee.value = 8;
          gunBus.ratio.value = 5;
          gunBus.attack.value = 0.003;
          gunBus.release.value = 0.1;
          gunBus.connect(master);
          noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
          const d = noise.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
          decodeShots();
        }
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      } catch (err) {
        console.warn('WebAudio를 사용할 수 없습니다:', err);
      }
    },

    sfx(name, strength = 1) {
      if (!enabled || !ctx || strength <= 0) return;
      const weapon = WEAPONS[name];
      const ally = weapon && strength < 1;
      const synth = ally ? SOUNDS.botshot : (SOUNDS[name] || (weapon && SOUNDS.shot));
      if (!synth) return;
      const key = ally ? 'ally' : name;
      const gap = ally ? 0.047 : weapon ? 0.023 : (SFX_GAP[name] || 0);
      const now = ctx.currentTime;
      if (now - (lastPlayed[key] ?? -Infinity) < gap) return;
      lastPlayed[key] = now;
      if (!weapon || !playShot(weapon, strength)) synth();
    },

    relay: null, // 방장: 음악·효과음을 접속자에게도 보낸다

    current: () => musicName,

    play(name, local) {
      if (!local && this.relay) this.relay('sfx', name);
      const a = media[name];
      if (!enabled || !a) return;
      a.currentTime = 0;
      a.play().catch(() => {});
    },

    music(name) {
      if (this.relay) this.relay('music', name);
      if (music && music !== media[name]) music.pause();
      if (name === 'ending') this.stopCue();
      const changed = name !== musicName;
      musicName = name;
      music = media[name] || null;
      if (music && changed) music.currentTime = 0;
      mixMusic();
      if (enabled && music) music.play().catch(() => {});
    },

    cue(name) {
      if (this.relay) this.relay('cue', name);
      const a = cues[name];
      if (!enabled || !a) return;
      this.stopCue();
      activeCue = a;
      mixMusic();
      a.currentTime = 0;
      a.play().catch(() => { if (activeCue === a && a.paused) this.stopCue(); });
    },

    stopCue() {
      if (!activeCue) return;
      activeCue.pause();
      activeCue = null;
      mixMusic();
    },

    isOn: () => enabled,

    toggle() {
      enabled = !enabled;
      if (!enabled && G.Voice) G.Voice.stop();
      if (master) master.gain.setTargetAtTime(enabled ? MASTER_LEVEL : 0, ctx.currentTime, 0.016);
      if (!enabled) {
        this.stopCue();
        Object.values(media).forEach((a) => a.pause());
      }
      else if (music) music.play().catch(() => {});
      return enabled;
    },
  };

  G.audio = audio;
})(window.G);
