import { getMuted, setMuted } from './storage.js';

/**
 * 零素材 WebAudio 合成音效。
 * 弓弦、弦音、鸟鸣、啄食、连击、收梢，全部现场合成。
 */
class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = getMuted();
  }

  ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      // 轻压缩：蓄力、飞行、命中、连击层层叠加时不至于削波
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 24;
      comp.ratio.value = 5;
      comp.attack.value = 0.003;
      comp.release.value = 0.22;
      this.master.connect(comp).connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  toggleMute() {
    this.muted = !this.muted;
    setMuted(this.muted);
    if (this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, t, 0.02);
    }
    return this.muted;
  }

  _now() {
    return this.ensure() ? this.ctx.currentTime : 0;
  }

  _noiseBuffer(seconds = 0.4) {
    const ctx = this.ensure();
    if (!ctx) return null;
    // 白噪声缓冲按长度缓存，避免每次放弦都重新生成
    const key = Math.round(seconds * 100) / 100;
    if (!this._noiseCache) this._noiseCache = new Map();
    const cached = this._noiseCache.get(key);
    if (cached) return cached;
    const len = Math.max(1, Math.floor(ctx.sampleRate * key));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._noiseCache.set(key, buffer);
    return buffer;
  }

  /** 立体声声像节点；浏览器不支持时返回 null，声音保持居中 */
  _panner(ctx, pan = 0) {
    if (!ctx.createStereoPanner) return null;
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime);
    return panner;
  }

  /** 松弦：低频拨弦 + 空气震颤 */
  twang(charge = 0.5) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const power = 0.55 + charge * 0.45;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.5 * power, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    gain.connect(this.master);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(198 - charge * 40, t);
    osc.frequency.exponentialRampToValueAtTime(62, t + 0.28);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, t);
    filter.frequency.exponentialRampToValueAtTime(260, t + 0.3);

    osc.connect(filter).connect(gain);
    osc.start(t);
    osc.stop(t + 0.46);

    // 松弦瞬间的脆响
    const snap = ctx.createBufferSource();
    snap.buffer = this._noiseBuffer(0.05);
    const snapFilter = ctx.createBiquadFilter();
    snapFilter.type = 'highpass';
    snapFilter.frequency.value = 1800;
    const snapGain = ctx.createGain();
    snapGain.gain.setValueAtTime(0.0001, t);
    snapGain.gain.exponentialRampToValueAtTime(0.09 * power, t + 0.004);
    snapGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    snap.connect(snapFilter).connect(snapGain).connect(this.master);
    snap.start(t);
    snap.stop(t + 0.05);

    // 弦的第二次余响
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(392, t + 0.01);
    osc2.frequency.exponentialRampToValueAtTime(147, t + 0.22);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.14 * power, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc2.connect(g2).connect(this.master);
    osc2.start(t + 0.01);
    osc2.stop(t + 0.28);
  }

  /**
   * 蓄力：分层逐渐蓄满——低鸣、摩擦、低频、弦丝依次浮出，
   * 音高与脉动随力度爬升，左右声场同时向两侧张开。
   * 由主循环每帧驱动；力度拉满时轻轻一响，提示可以放弦。
   */
  setCharge(active, level = 0) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const lv = Math.max(0, Math.min(1, level));

    if (!active) {
      this._stopCharge(ctx, t);
      this._chargePinged = false;
      return;
    }

    if (!this.chargeVoice) this.chargeVoice = this._makeChargeVoice(ctx);
    const v = this.chargeVoice;

    if (this._chargeLevel === undefined || Math.abs(lv - this._chargeLevel) > 0.008) {
      this._chargeLevel = lv;
      const freq = 72 + lv * 78;
      const width = 0.1 + lv * 0.62;
      const sheen = Math.max(0, (lv - 0.4) / 0.6);

      v.gain.gain.setTargetAtTime(0.03 + lv * 0.11, t, 0.05);
      v.oscL.frequency.setTargetAtTime(freq, t, 0.06);
      v.oscR.frequency.setTargetAtTime(freq, t, 0.06);
      v.sub.frequency.setTargetAtTime(freq * 0.5, t, 0.06);
      v.subGain.gain.setTargetAtTime(lv * lv * 0.22, t, 0.06);
      v.filter.frequency.setTargetAtTime(260 + lv * 950, t, 0.06);
      v.sheenGain.gain.setTargetAtTime(sheen * sheen * 0.1, t, 0.08);
      v.lfo.frequency.setTargetAtTime(4.4 + lv * 3.4, t, 0.08);
      v.lfoDepth.gain.setTargetAtTime(1.5 + lv * 7, t, 0.08);
      v.tremLfo.frequency.setTargetAtTime(5 + lv * 6, t, 0.08);
      v.tremDepth.gain.setTargetAtTime(lv * 0.2, t, 0.08);
      v.tremGain.gain.setTargetAtTime(1 - lv * 0.1, t, 0.08);
      v.panLfo.frequency.setTargetAtTime(0.5 + lv * 2.1, t, 0.1);
      v.panDepth.gain.setTargetAtTime(0.08 + lv * 0.4, t, 0.1);
      v.panDepthInv.gain.setTargetAtTime(-(0.08 + lv * 0.4), t, 0.1);
      if (v.panL) v.panL.pan.setTargetAtTime(-width, t, 0.08);
      if (v.panR) v.panR.pan.setTargetAtTime(width, t, 0.08);
      if (v.panSheen) v.panSheen.pan.setTargetAtTime(width * 0.8, t, 0.08);
    }

    if (lv >= 0.985 && !this._chargePinged) {
      this._chargePinged = true;
      this._chargePing(ctx, t);
    } else if (lv < 0.6) {
      this._chargePinged = false;
    }
  }

  _makeChargeVoice(ctx) {
    const t = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.connect(this.master);

    // 颤音层：蓄得越满，脉动越快越深
    const tremGain = ctx.createGain();
    tremGain.gain.setValueAtTime(1, t);
    tremGain.connect(gain);
    const tremLfo = ctx.createOscillator();
    tremLfo.type = 'sine';
    tremLfo.frequency.setValueAtTime(5, t);
    const tremDepth = ctx.createGain();
    tremDepth.gain.setValueAtTime(0, t);
    tremLfo.connect(tremDepth);
    tremDepth.connect(tremGain.gain);

    // 弦身：两只轻微失谐的三角波分置左右，蓄满时声场张开
    const oscL = ctx.createOscillator();
    oscL.type = 'triangle';
    oscL.frequency.setValueAtTime(72, t);
    oscL.detune.setValueAtTime(-6, t);
    const oscLGain = ctx.createGain();
    oscLGain.gain.value = 0.34;
    const panL = this._panner(ctx, -0.1);
    if (panL) oscL.connect(oscLGain).connect(panL).connect(tremGain);
    else oscL.connect(oscLGain).connect(tremGain);

    const oscR = ctx.createOscillator();
    oscR.type = 'triangle';
    oscR.frequency.setValueAtTime(72, t);
    oscR.detune.setValueAtTime(6, t);
    const oscRGain = ctx.createGain();
    oscRGain.gain.value = 0.34;
    const panR = this._panner(ctx, 0.1);
    if (panR) oscR.connect(oscRGain).connect(panR).connect(tremGain);
    else oscR.connect(oscRGain).connect(tremGain);

    // 低八度：蓄到后半程才浮出，补足“蓄满”的重量
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(36, t);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.0001, t);
    sub.connect(subGain).connect(tremGain);

    // 麻绳与木弓的摩擦
    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBuffer(1.4);
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(260, t);
    filter.Q.value = 2.2;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.5;
    const panNoise = this._panner(ctx, 0);
    if (panNoise) noise.connect(filter).connect(noiseGain).connect(panNoise).connect(tremGain);
    else noise.connect(filter).connect(noiseGain).connect(tremGain);

    // 弦丝：越拉越紧的高频细响，接近蓄满时从两侧浮出
    const sheen = ctx.createBufferSource();
    sheen.buffer = this._noiseBuffer(1.4);
    sheen.loop = true;
    const sheenFilter = ctx.createBiquadFilter();
    sheenFilter.type = 'bandpass';
    sheenFilter.frequency.setValueAtTime(3200, t);
    sheenFilter.Q.value = 2.8;
    const sheenGain = ctx.createGain();
    sheenGain.gain.setValueAtTime(0.0001, t);
    const panSheen = this._panner(ctx, 0.1);
    if (panSheen) sheen.connect(sheenFilter).connect(sheenGain).connect(panSheen).connect(tremGain);
    else sheen.connect(sheenFilter).connect(sheenGain).connect(tremGain);

    // 绷紧的弦在轻颤：低频振荡同时调制音高与摩擦的亮度
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(4.4, t);
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.setValueAtTime(1.5, t);
    lfo.connect(lfoDepth);
    lfoDepth.connect(oscL.frequency);
    lfoDepth.connect(oscR.frequency);
    lfoDepth.connect(filter.frequency);

    // 摩擦声缓慢左右摆，弦丝反向摆，形成立体声宽度
    const panLfo = ctx.createOscillator();
    panLfo.type = 'sine';
    panLfo.frequency.setValueAtTime(0.5, t);
    const panDepth = ctx.createGain();
    panDepth.gain.setValueAtTime(0.08, t);
    const panDepthInv = ctx.createGain();
    panDepthInv.gain.setValueAtTime(-0.08, t);
    panLfo.connect(panDepth);
    panLfo.connect(panDepthInv);
    if (panNoise) panDepth.connect(panNoise.pan);
    if (panSheen) panDepthInv.connect(panSheen.pan);

    noise.start(t);
    sheen.start(t);
    oscL.start(t);
    oscR.start(t);
    sub.start(t);
    lfo.start(t);
    tremLfo.start(t);
    panLfo.start(t);

    return {
      gain,
      tremGain,
      oscL,
      oscR,
      sub,
      subGain,
      noise,
      sheen,
      sheenGain,
      filter,
      lfo,
      lfoDepth,
      tremLfo,
      tremDepth,
      panL,
      panR,
      panNoise,
      panSheen,
      panLfo,
      panDepth,
      panDepthInv,
    };
  }

  _stopCharge(ctx, t) {
    const v = this.chargeVoice;
    this.chargeVoice = null;
    this._chargeLevel = undefined;
    if (!v) return;
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setTargetAtTime(0.0001, t, 0.03);
    [v.oscL, v.oscR, v.sub, v.noise, v.sheen, v.lfo, v.tremLfo, v.panLfo].forEach((node) => {
      try {
        node.stop(t + 0.22);
      } catch {
        /* 已经停止 */
      }
    });
    v.noise.onended = () => {
      try {
        v.gain.disconnect();
      } catch {
        /* 已断开 */
      }
    };
  }

  /** 蓄力拉满的提示音：两声清亮的泛音 */
  _chargePing(ctx, t) {
    [1318.5, 1975.53].forEach((freq, i) => {
      const start = t + i * 0.04;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.055, start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);
      osc.connect(g).connect(this.master);
      osc.start(start);
      osc.stop(start + 0.36);
    });
  }

  /**
   * 弦音飞行：起手破空 + 渐弱的哨音，随落点偏转方位。
   * @param {number} duration 飞行时长（秒）
   * @param {number} panTo 落点方位，-1 左 / 0 中 / 1 右
   */
  flight(duration = 0.3, panTo = 0) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const d = Math.max(0.14, duration);
    const pan = Math.max(-0.85, Math.min(0.85, panTo));

    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.2, t + 0.025);
    out.gain.setValueAtTime(0.2, t + Math.max(0.05, d - 0.09));
    out.gain.exponentialRampToValueAtTime(0.0001, t + d);

    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(0, t);
      panner.pan.linearRampToValueAtTime(pan, t + d);
      out.connect(panner).connect(this.master);
    } else {
      out.connect(this.master);
    }

    // 破空：一瞬间掠过的高频气声
    const air = ctx.createBufferSource();
    air.buffer = this._noiseBuffer(1.4);
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'bandpass';
    airFilter.Q.value = 1.1;
    airFilter.frequency.setValueAtTime(1800, t);
    airFilter.frequency.exponentialRampToValueAtTime(760, t + d);
    const airGain = ctx.createGain();
    airGain.gain.setValueAtTime(0.0001, t);
    airGain.gain.exponentialRampToValueAtTime(0.85, t + 0.015);
    airGain.gain.exponentialRampToValueAtTime(0.28, t + d * 0.6);
    air.connect(airFilter).connect(airGain).connect(out);
    air.start(t);
    air.stop(t + d + 0.02);

    // 弦音哨音：高频随飞行略微下滑
    const whistle = ctx.createOscillator();
    whistle.type = 'sine';
    whistle.frequency.setValueAtTime(2100, t);
    whistle.frequency.exponentialRampToValueAtTime(1250, t + d);
    const wg = ctx.createGain();
    wg.gain.setValueAtTime(0.0001, t);
    wg.gain.exponentialRampToValueAtTime(0.05, t + 0.03);
    wg.gain.exponentialRampToValueAtTime(0.0001, t + d);
    whistle.connect(wg).connect(out);
    whistle.start(t);
    whistle.stop(t + d + 0.02);
  }

  /**
   * 命中：由亮到暗的五层——脆响、实体、低频、气浪、弦鸣尾音。
   * 主体与高频定位到命中点，低频居中，尾音向左右铺开。
   * @param {number} power 力度 0–1
   * @param {boolean} empowered 是否共鸣之弦
   * @param {number} pan 命中方位，-1 左 / 0 中 / 1 右
   */
  impact(power = 0.5, empowered = false, pan = 0) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const p = 0.55 + power * 0.45;
    const panHit = Math.max(-0.9, Math.min(0.9, pan));

    // 命中点声像：脆响与实体声从落点传来
    const hitBus = ctx.createGain();
    const hitPan = this._panner(ctx, panHit);
    if (hitPan) hitBus.connect(hitPan).connect(this.master);
    else hitBus.connect(this.master);

    // 1) 起音脆响：给“击中”一个清晰的轮廓
    const crack = ctx.createBufferSource();
    crack.buffer = this._noiseBuffer(0.05);
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = 'highpass';
    crackFilter.frequency.setValueAtTime(2600, t);
    crackFilter.frequency.exponentialRampToValueAtTime(4200, t + 0.03);
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.0001, t);
    crackGain.gain.exponentialRampToValueAtTime(0.16 * p, t + 0.004);
    crackGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
    crack.connect(crackFilter).connect(crackGain).connect(hitBus);
    crack.start(t);
    crack.stop(t + 0.06);

    // 2) 实体闷响：短促的“木”感，撑起中频
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(240 + power * 40, t);
    body.frequency.exponentialRampToValueAtTime(96, t + 0.11);
    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = 'lowpass';
    bodyFilter.frequency.setValueAtTime(1600, t);
    bodyFilter.frequency.exponentialRampToValueAtTime(500, t + 0.16);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.0001, t);
    bodyGain.gain.exponentialRampToValueAtTime(0.3 * p, t + 0.005);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    body.connect(bodyFilter).connect(bodyGain).connect(hitBus);
    body.start(t);
    body.stop(t + 0.22);

    // 3) 低频余震：居中，补足重量
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(96, t);
    sub.frequency.exponentialRampToValueAtTime(44, t + 0.4);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.0001, t);
    subGain.gain.exponentialRampToValueAtTime(0.32 * p, t + 0.012);
    subGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    sub.connect(subGain).connect(this.master);
    sub.start(t);
    sub.stop(t + 0.52);

    // 4) 气浪：从落点散开的一层沙沙声
    const air = ctx.createBufferSource();
    air.buffer = this._noiseBuffer(0.36);
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'bandpass';
    airFilter.Q.value = 0.8;
    airFilter.frequency.setValueAtTime(1500, t);
    airFilter.frequency.exponentialRampToValueAtTime(380, t + 0.3);
    const airGain = ctx.createGain();
    airGain.gain.setValueAtTime(0.0001, t);
    airGain.gain.exponentialRampToValueAtTime(0.15 * p, t + 0.012);
    airGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    air.connect(airFilter).connect(airGain).connect(hitBus);
    air.start(t);
    air.stop(t + 0.36);

    // 5) 弦鸣尾音：G 与 D 在左右两侧轻轻散开，给命中一个好听的收束
    const rings = [
      { freq: 392, spread: -0.24 },
      { freq: 587.33, spread: 0.24 },
    ];
    rings.forEach(({ freq, spread }, i) => {
      const start = t + 0.02 + i * 0.008;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.985, start + 0.55);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.055, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.62);
      const rp = this._panner(ctx, panHit * 0.5 + spread);
      if (rp) osc.connect(g).connect(rp).connect(this.master);
      else osc.connect(g).connect(this.master);
      osc.start(start);
      osc.stop(start + 0.64);
    });

    // 共鸣之弦：高八度的 C 大三和弦，向两侧铺得更宽
    if (empowered) {
      [1046.5, 1318.51, 1567.98].forEach((freq, i) => {
        const start = t + 0.03 + i * 0.025;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.05, start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.85);
        const rp = this._panner(ctx, Math.max(-0.9, Math.min(0.9, panHit * 0.4 + (i - 1) * 0.35)));
        if (rp) osc.connect(g).connect(rp).connect(this.master);
        else osc.connect(g).connect(this.master);
        osc.start(start);
        osc.stop(start + 0.87);
      });
    }
  }

  /** 弦尽：干涩的弦扣轻响 */
  dry() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.09);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1400;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.055, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + 0.09);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(88, t + 0.07);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  /** 鸟群惊起的短促叫声 */
  chirp(kind = 'sparrow') {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const base = kind === 'crow' ? 320 : kind === 'gold' ? 1180 : 760;
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const start = t + i * 0.055 + Math.random() * 0.02;
      const freq = base * (0.85 + Math.random() * 0.4);
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.7, start + 0.05);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.8, start + 0.12);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.09, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
      osc.connect(gain).connect(this.master);
      osc.start(start);
      osc.stop(start + 0.16);
    }
  }

  /** 啄食星穗 */
  peck() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.06);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.13, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + 0.07);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  /** 连击：五声音阶逐级上扬 */
  combo(level = 1) {
    const ctx = this.ensure();
    if (!ctx) return;
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1567.98];
    const freq = scale[Math.min(scale.length - 1, Math.max(0, level - 1))];
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.34);
  }

  /** 星穗告急 */
  alarm() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    [0, 0.16].forEach((delay, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(i === 0 ? 330 : 262, t + delay);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + delay);
      g.gain.exponentialRampToValueAtTime(0.1, t + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.14);
      osc.connect(g).connect(this.master);
      osc.start(t + delay);
      osc.stop(t + delay + 0.16);
    });
  }

  /** 收梢 / 结算 */
  finish(won = false) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const notes = won ? [392, 523.25, 659.25, 783.99] : [392, 349.23, 293.66, 220];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      const start = t + i * 0.13;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);
      osc.connect(g).connect(this.master);
      osc.start(start);
      osc.stop(start + 0.72);
    });
  }

  /** 界面点击 */
  click() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(1320, t + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  /** 手势锁定提示 */
  lock() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.19);
  }
}

export const sfx = new Sfx();
