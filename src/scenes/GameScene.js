import Phaser from 'phaser';
import { Boids } from '../js/Boids.js';
import { sfx } from '../js/Audio.js';
import { getGestureController } from '../js/GestureController.js';
import {
  GAME_W,
  GAME_H,
  FIELD_Y,
  BOW_X,
  BOW_Y,
  ROUND_SECONDS,
  GRAIN_MAX,
  QUIVER_MAX,
  QUIVER_REFILL,
  BIRD_TYPES,
  FONT_TITLE,
  C,
  S,
} from '../js/constants.js';
import { getBest, setBest } from '../js/storage.js';
import { makeText, drawPanel, makeButton, formatTime, toast } from '../js/ui.js';
import { fitMainCamera } from '../js/layout.js';

const clamp = Phaser.Math.Clamp;

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.useGesture = !!(data && data.useGesture);
    this.gesture = getGestureController();
  }

  create() {
    // ---- 对局状态 ----
    this.roundOver = false;
    this.isPaused = false;
    this.pauseOverlay = null;
    this.elapsed = 0;
    this.timeLeft = ROUND_SECONDS;
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.resonance = 0;
    this.maxCombo = 0;
    this.scared = 0;
    this.twangs = 0;
    this.hits = 0;
    this.grain = GRAIN_MAX;
    this.wave = 0;
    this.waveTimer = 0.8;
    this.shotCooldown = 0;
    this.tones = QUIVER_MAX;
    this.toneRefillT = 0;
    this.lastEmptyHint = -99;
    this.quiverFlash = 0;
    this.toneEmptyFlash = 0;
    this.stringVib = 0;
    this.charge = 0;
    this.pointerCharging = false;
    this.pointerAim = { x: GAME_W / 2, y: 300 };
    this.gestureArmed = false;
    this.gestureCharge = 0;
    this.gestureLostT = 0;
    this.handPresent = false;
    this.gestureHintShown = false;
    this.aim = new Phaser.Math.Vector2(GAME_W / 2, 280);
    this.aimTarget = new Phaser.Math.Vector2(GAME_W / 2, 280);
    this.best = getBest();
    this.alarmPlayed = false;
    this.hudTick = 0;
    this.lastComboShown = 0;
    this.grainPulse = 0;
    this.lastGrainShown = -1;
    this.endStarted = false;

    this.gesture.setHudVisible(this.useGesture);

    fitMainCamera(this);
    this.scene.get('Backdrop')?.setDim(0);

    this.buildWorld();
    this.buildBoids();
    this.buildBow();
    this.buildReticle();
    this.buildHud();
    this.bindInput();

    this.showIntro();
    this.cameras.main.fadeIn(650, 5, 7, 12);
  }

  // ------------------------------------------------------------------
  // 场景搭建
  // ------------------------------------------------------------------

  buildWorld() {
    // 深空 / 星球 / 星田由 Backdrop 场景铺满，主场景只放安全区内容
    // 飞鸟受惊时迸出的星屑
    this.sparkFx = this.add
      .particles(0, 0, 'star_small', {
        lifespan: { min: 500, max: 1050 },
        speed: { min: 70, max: 290 },
        angle: { min: 0, max: 360 },
        gravityY: 30,
        rotate: { min: -220, max: 220 },
        scale: { start: 0.85, end: 0.1 },
        alpha: { start: 0.95, end: 0 },
        tint: [0xe6d3a3, 0x9fb6cc, 0xfff3cf],
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(27);

    // 弦音飞行时拖出的细碎声屑
    this.soundTrailFx = this.add
      .particles(0, 0, 'star_small', {
        lifespan: { min: 220, max: 400 },
        speed: { min: 4, max: 34 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.34, end: 0 },
        alpha: { start: 0.7, end: 0 },
        tint: [0xe6d3a3, 0x9fd8e8, 0xfff3cf],
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(27);

    // 啄食时飞散的星穗
    this.wheatFx = this.add
      .particles(0, 0, 'wheat-grain', {
        lifespan: { min: 600, max: 1050 },
        speed: { min: 40, max: 140 },
        angle: { min: 230, max: 310 },
        gravityY: 180,
        rotate: { min: -30, max: 30 },
        scale: { start: 0.75, end: 0.15 },
        alpha: { start: 0.95, end: 0 },
        tint: [0xc5a059, 0xe6d3a3, 0xa8894c],
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(26);

    // 田间的萤火
    this.add
      .particles(0, 0, 'glow', {
        x: { min: 80, max: 1360 },
        y: { min: 760, max: 892 },
        lifespan: { min: 3200, max: 6800 },
        frequency: 380,
        quantity: 1,
        speedX: { min: -9, max: 9 },
        speedY: { min: -24, max: -5 },
        scale: { start: 0.045, end: 0.13 },
        alpha: { start: 0, end: 0.42 },
        tint: [0xe6d3a3, 0xc5a059],
        blendMode: 'ADD',
      })
      .setDepth(14);
  }

  buildBoids() {
    this.boids = new Boids(this, {
      depth: 10,
      onEat: (bird, type) => this.handleEat(bird, type),
    });
  }

  buildBow() {
    this.add
      .image(BOW_X, 878, 'glow')
      .setTint(0xc5a059)
      .setAlpha(0.2)
      .setScale(2.4)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(22);

    this.lanternGlow = this.add
      .image(BOW_X, 876, 'glow')
      .setTint(0xe6d3a3)
      .setAlpha(0.18)
      .setScale(1.1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(22);

    // 地面基座：弓与弦囊都立在这圈淡金微光里
    const base = this.add.graphics().setDepth(23);
    base.fillStyle(0x04060a, 0.82);
    base.fillEllipse(BOW_X, 878, 188, 38);
    base.lineStyle(1, C.mist, 0.12);
    base.strokeEllipse(BOW_X, 878, 300, 58);
    base.lineStyle(1, C.gold, 0.15);
    base.strokeEllipse(BOW_X, 878, 248, 47);
    base.lineStyle(1, C.gold, 0.2);
    base.strokeEllipse(BOW_X, 878, 188, 38);

    // 基座上的细碎星点，像落在田边的星屑
    const dust = [
      [661, 872, 0.7],
      [694, 885, 0.55],
      [736, 884, 0.8],
      [763, 870, 0.5],
      [644, 883, 0.4],
    ];
    base.fillStyle(C.goldLight, 0.45);
    dust.forEach(([x, y, r]) => base.fillCircle(x, y, r));

    this.quiverG = this.add.graphics().setDepth(24);
    this.bowG = this.add.graphics().setDepth(25);

    // 弓梢星芒：拉弦时被点亮
    this.bowTips = [0, 1].map(() =>
      this.add
        .image(0, 0, 'star_small')
        .setTint(0xffe7b0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(26)
        .setAlpha(0.2)
    );

    this.quiverText = makeText(this, BOW_X + 113, BOW_Y - 2, `弦 × ${QUIVER_MAX}`, {
      size: 12.5,
      color: S.goldLight,
      origin: [0, 0.5],
      letterSpacing: 1.8,
    })
      .setDepth(26)
      .setAlpha(0.85);
    this.quiverColor = S.goldLight;

    this.drawQuiver();
  }

  buildReticle() {
    this.aimGlow = this.add
      .image(this.aim.x, this.aim.y, 'glow')
      .setTint(0xe6d3a3)
      .setAlpha(0.12)
      .setScale(0.45)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(29);
    this.aimStar = this.add
      .image(this.aim.x, this.aim.y, 'star_small')
      .setTint(0xffe7b0)
      .setAlpha(0.85)
      .setScale(0.35)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(30);
    this.reticle = this.add.graphics().setDepth(30);
  }

  buildHud() {
    const hud = this.add.graphics().setDepth(40);
    hud.lineStyle(1, C.gold, 0.55);
    hud.lineBetween(44, 38, 44, 94);
    hud.lineBetween(GAME_W - 44, 38, GAME_W - 44, 94);

    makeText(this, 60, 36, '星 穗', {
      size: 12,
      color: S.gold,
      letterSpacing: 4,
      alpha: 0.9,
    }).setDepth(41);
    this.grainValue = makeText(this, 60, 54, String(GRAIN_MAX), {
      font: FONT_TITLE,
      size: 30,
      color: S.paper,
    }).setDepth(41);
    this.grainBarG = this.add.graphics().setDepth(41);

    makeText(this, GAME_W - 60, 36, '時 辰', {
      size: 12,
      color: S.gold,
      letterSpacing: 4,
      origin: [1, 0],
      alpha: 0.9,
    }).setDepth(41);
    this.timerText = makeText(this, GAME_W - 60, 50, formatTime(ROUND_SECONDS), {
      font: FONT_TITLE,
      size: 32,
      color: S.paper,
      origin: [1, 0],
      letterSpacing: 1,
    }).setDepth(41);
    this.bestText = makeText(this, GAME_W - 60, 88, '', {
      size: 10,
      color: S.dim,
      origin: [1, 0],
      letterSpacing: 1,
    }).setDepth(41);

    makeText(this, 720, 28, '驚 起', {
      size: 12,
      color: S.gold,
      letterSpacing: 5,
      origin: [0.5, 0],
    }).setDepth(41);
    this.scoreText = makeText(this, 720, 42, '0', {
      font: FONT_TITLE,
      size: 58,
      color: S.paper,
      origin: [0.5, 0],
      stroke: '#05070c',
      strokeThickness: 3,
    }).setDepth(41);
    this.comboText = makeText(this, 720, 116, '', {
      size: 16,
      color: S.goldLight,
      origin: [0.5, 0],
      letterSpacing: 2,
    })
      .setDepth(41)
      .setAlpha(0);

    this.resonanceLabel = makeText(this, 720, 138, '絃 鳴', {
      size: 10.5,
      color: S.dim,
      origin: [0.5, 0],
      letterSpacing: 3,
    })
      .setDepth(41)
      .setAlpha(0.7);
    this.resonanceBarG = this.add.graphics().setDepth(41);

    const hint = this.add.graphics().setDepth(40);
    hint.lineStyle(1, C.gold, 0.4);
    hint.lineBetween(44, GAME_H - 54, 44, GAME_H - 28);

    this.modeText = makeText(this, 60, GAME_H - 54, this.modeHintText(), {
      size: 11,
      color: S.paperDim,
      letterSpacing: 1,
    })
      .setDepth(41)
      .setAlpha(0.7);

    const keyHint = this.gesture.available
      ? 'P 暫停    M 靜音    G 手勢'
      : 'P 暫停    M 靜音';
    makeText(this, 60, GAME_H - 34, keyHint, {
      size: 10.5,
      color: S.dim,
      letterSpacing: 1,
    })
      .setDepth(41)
      .setAlpha(0.6);

    this.drawGrainBar();
    this.drawResonance();
    this.updateHudText();
  }

  bindInput() {
    this.input.setDefaultCursor('crosshair');

    this.input.on('pointermove', (pointer) => {
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.pointerAim.x = world.x;
      this.pointerAim.y = world.y;
    });

    this.input.on('pointerdown', (pointer) => {
      if (this.isPaused || this.roundOver) return;
      sfx.ensure();
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.pointerAim.x = world.x;
      this.pointerAim.y = world.y;
      this.pointerCharging = true;
      this.charge = Math.max(this.charge, 0.02);
    });

    this.input.on('pointerup', () => {
      if (this.isPaused || this.roundOver) return;
      if (!this.pointerCharging) return;
      this.pointerCharging = false;
      const power = clamp(this.charge, 0.08, 1);
      this.charge = 0;
      this.fire(power);
    });

    this.input.keyboard.on('keydown-P', () => this.togglePause());
    this.input.keyboard.on('keydown-ESC', () => this.togglePause());
    this.input.keyboard.on('keydown-M', () => {
      const muted = sfx.toggleMute();
      toast(this, muted ? '已靜音' : '已開啟聲音', 150);
    });
    this.input.keyboard.on('keydown-G', () => this.toggleGestureMode());

    this.events.once('shutdown', () => {
      this.boids?.destroy();
      this.input.setDefaultCursor('default');
      this.input.removeAllListeners();
      this.input.keyboard.removeAllListeners();
    });
  }

  modeHintText() {
    if (this.useGesture) return '手勢 · 食指瞄準 / 張指拉弓 / 合攏放弦';
    if (this.sys.game.device.input.touch) return '觸控 · 按住蓄力 / 鬆開放弦';
    return '滑鼠 · 移動瞄準 / 按住蓄力 / 鬆開放弦';
  }

  toggleGestureMode() {
    if (!this.gesture.available) {
      toast(this, '手勢未啟用 · 可在主選單開啟攝影機', 172);
      return;
    }
    this.useGesture = !this.useGesture;
    this.gestureArmed = false;
    this.gestureCharge = 0;
    this.gestureLostT = 0;
    this.gesture.setHudVisible(this.useGesture);
    this.modeText.setText(this.modeHintText());
    toast(this, this.useGesture ? '手勢瞄準 · 已開啟' : '手勢瞄準 · 已關閉，使用滑鼠', 172);
  }

  showIntro() {
    const msg = this.useGesture
      ? '食指瞄準 · 張開拇指與食指拉弓 · 合攏放弦'
      : this.sys.game.device.input.touch
        ? '按住任意位置蓄力 · 鬆開放弦'
        : '移動滑鼠瞄準 · 按住蓄力 · 鬆開放弦';
    const intro = makeText(this, 720, 704, msg, {
      size: 17,
      color: S.goldLight,
      origin: [0.5, 0],
      letterSpacing: 1,
    }).setDepth(45);
    intro.setPadding(16, 8, 16, 8);
    intro.setBackgroundColor('rgba(5, 7, 12, 0.55)');
    this.tweens.add({
      targets: intro,
      alpha: 0,
      delay: 4800,
      duration: 900,
      onComplete: () => intro.destroy(),
    });
  }

  // ------------------------------------------------------------------
  // 主循环
  // ------------------------------------------------------------------

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    if (this.isPaused) return;

    this.lanternGlow.setAlpha(0.13 + Math.sin(this.elapsed * 2.1) * 0.04);

    if (this.roundOver) {
      this.elapsed += dt;
      this.boids.update(dt, this.elapsed);
      return;
    }

    this.elapsed += dt;
    this.timeLeft -= dt;
    this.shotCooldown = Math.max(0, this.shotCooldown - dt);
    this.grainPulse = Math.max(0, this.grainPulse - dt);
    this.stringVib = Math.max(0, this.stringVib - dt * 3.6);
    this.updateQuiver(dt);

    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboTimer = 0;
        this.combo = 0;
      }
    }

    // 波次
    this.waveTimer -= dt;
    if (this.waveTimer <= 0) {
      this.wave += 1;
      const speedScale = 1 + Math.min(0.35, (this.wave - 1) * 0.018);
      this.boids.spawnWave(this.wave, this.elapsed, speedScale);
      this.waveTimer = Math.max(3.6, 5.9 - this.wave * 0.14);
    }

    this.updateAim(dt);
    this.updateGestureShot(dt);
    if (this.pointerCharging) {
      this.charge = Math.min(1, this.charge + dt / 0.72);
    }

    this.boids.update(dt, this.elapsed);
    if (this.roundOver) return;

    this.updateHud(dt);

    if (!this.alarmPlayed && this.grain <= 30) {
      this.alarmPlayed = true;
      sfx.alarm();
      toast(this, '星穗將盡 · 快驚鳥！', 168);
    }

    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.endRound('time');
      return;
    }

    const charge = this.currentCharge();
    sfx.setCharge(this.pointerCharging || this.gestureArmed, charge);
    this.drawBow(charge);
    this.drawQuiver();
    this.drawReticle(charge);
  }

  currentCharge() {
    const pointer = this.pointerCharging ? this.charge : 0;
    const gesture = this.gestureArmed ? this.gestureCharge : 0;
    return Math.max(pointer, gesture);
  }

  /** 弦囊：缓慢聚回弦音，聚满时停表 */
  updateQuiver(dt) {
    if (this.tones < QUIVER_MAX) {
      this.toneRefillT += dt;
      if (this.toneRefillT >= QUIVER_REFILL) {
        this.toneRefillT = 0;
        this.tones = Math.min(QUIVER_MAX, this.tones + 1);
        this.quiverFlash = 1;
      }
    } else {
      this.toneRefillT = 0;
    }
    this.quiverFlash = Math.max(0, this.quiverFlash - dt * 3.2);
    this.toneEmptyFlash = Math.max(0, this.toneEmptyFlash - dt * 2.6);
  }

  updateAim(dt) {
    const state = this.gesture.getState();
    this.handPresent = this.useGesture && state.present;

    if (this.handPresent) {
      this.aimTarget.set(state.x, state.y);
    } else {
      this.aimTarget.set(this.pointerAim.x, this.pointerAim.y);
      if (this.useGesture && !this.gestureHintShown && this.elapsed > 3.2) {
        this.gestureHintShown = true;
        toast(this, '未偵測到手 · 仍可用滑鼠瞄準與放弦', 172);
      }
    }

    this.aimTarget.x = clamp(this.aimTarget.x, 60, GAME_W - 60);
    this.aimTarget.y = clamp(this.aimTarget.y, 70, FIELD_Y + 70);

    const k = 1 - Math.exp(-dt * 18);
    this.aim.x += (this.aimTarget.x - this.aim.x) * k;
    this.aim.y += (this.aimTarget.y - this.aim.y) * k;
  }

  updateGestureShot(dt) {
    if (!this.useGesture) return;
    const state = this.gesture.getState();

    if (state.present) {
      this.gestureLostT = 0;
      const targetCharge = clamp((state.draw - 0.15) / 0.75, 0, 1);

      if (!this.gestureArmed && state.draw > 0.4) {
        this.gestureArmed = true;
        this.gestureCharge = Math.max(0.14, targetCharge);
      }

      if (this.gestureArmed) {
        this.gestureCharge = Math.max(this.gestureCharge, targetCharge);
        if (state.draw < 0.16) {
          const power = clamp(this.gestureCharge, 0.08, 1);
          this.gestureArmed = false;
          this.gestureCharge = 0;
          this.fire(power);
        }
      }
    } else if (this.gestureArmed) {
      this.gestureLostT += dt;
      if (this.gestureLostT > 0.5) {
        this.gestureArmed = false;
        this.gestureCharge = 0;
        toast(this, '手勢遺失 · 弦未發', 172);
      }
    }
  }

  // ------------------------------------------------------------------
  // 放弦与命中
  // ------------------------------------------------------------------

  fire(power) {
    if (this.roundOver || this.isPaused) return;
    if (this.shotCooldown > 0) return;

    if (this.tones <= 0) {
      if (this.elapsed - this.lastEmptyHint > 1.4) {
        this.lastEmptyHint = this.elapsed;
        this.toneEmptyFlash = 1;
        this.stringVib = 0.5;
        sfx.dry();
        toast(this, '弦音已盡 · 聚音中', 772);
      }
      return;
    }

    this.shotCooldown = 0.18;
    this.tones -= 1;
    this.twangs += 1;
    this.stringVib = 1;
    this.pointerCharging = false;
    this.charge = 0;
    this.gestureArmed = false;
    this.gestureCharge = 0;

    const empowered = this.resonance >= 100;
    if (empowered) this.resonance = 0;

    const sx = BOW_X;
    const sy = BOW_Y - 16;
    const tx = this.aim.x;
    const ty = this.aim.y;
    const dist = Math.hypot(tx - sx, ty - sy);

    // 放出的不是箭，而是一弯“声痕”
    const wave = this.add
      .image(sx, sy, 'sound-wave')
      .setDepth(28)
      .setScale(0.62)
      .setBlendMode(Phaser.BlendModes.ADD);
    wave.setRotation(Math.atan2(ty - sy, tx - sx));

    const ctrlX = (sx + tx) / 2 + (ty - sy) * 0.07;
    const ctrlY = Math.min(sy, ty) - 26;
    const duration = 130 + dist * 0.17;

    // 松弦、飞行、命中三段分开，听感能跟上弦音的轨迹
    sfx.setCharge(false);
    sfx.twang(power);
    sfx.flight(duration / 1000, ((tx - BOW_X) / (GAME_W / 2)) * 0.85);

    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: 'Sine.easeIn',
      onUpdate: (tween) => {
        const t = tween.getValue();
        const it = 1 - t;
        const x = it * it * sx + 2 * it * t * ctrlX + t * t * tx;
        const y = it * it * sy + 2 * it * t * ctrlY + t * t * ty;
        const dx = x - wave.x;
        const dy = y - wave.y;
        wave.setPosition(x, y);
        wave.setScale(0.62 + Math.sin(t * Math.PI) * 0.05);
        if (Math.abs(dx) + Math.abs(dy) > 0.05) {
          wave.setRotation(Math.atan2(dy, dx));
        }
        this.soundTrailFx.emitParticleAt(x, y, 1);
      },
      onComplete: () => {
        wave.destroy();
        this.impact(tx, ty, power, empowered);
      },
    });
  }

  impact(x, y, power, empowered = false) {
    if (this.roundOver || this.isPaused) return;

    const radius = (78 + 96 * power) * (empowered ? 1.55 : 1);
    const birds = this.boids.scare(x, y, radius);
    this.playTwangFx(x, y, radius, power, empowered);
    sfx.impact(power, empowered, ((x - BOW_X) / (GAME_W / 2)) * 0.85);
    if (birds.length > 0) sfx.chirp(birds[0].type);

    this.resolveScore(birds, x, y, radius, empowered);
    if (empowered) {
      this.cameras.main.flash(170, 150, 210, 230, false);
      sfx.lock();
    }
  }

  playTwangFx(x, y, radius, power, special = false) {
    const ringScale = (radius * 2.6) / 256;
    const ring = this.add
      .image(x, y, 'ring')
      .setTint(special ? 0x9fd8e8 : 0xe6d3a3)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(26)
      .setScale(0.15)
      .setAlpha(0.9);
    this.tweens.add({
      targets: ring,
      scale: ringScale,
      alpha: 0,
      duration: 480,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });

    const ring2 = this.add
      .image(x, y, 'ring')
      .setTint(special ? 0xdff4ff : 0xc5a059)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(26)
      .setScale(0.1)
      .setAlpha(0.6);
    this.tweens.add({
      targets: ring2,
      scale: ringScale * 1.16,
      alpha: 0,
      delay: 70,
      duration: 620,
      ease: 'Cubic.easeOut',
      onComplete: () => ring2.destroy(),
    });

    const flash = this.add
      .image(x, y, 'glow')
      .setTint(special ? 0xdff4ff : 0xfff3d0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(27)
      .setScale(0.4 + power * 0.5)
      .setAlpha(0.55);
    this.tweens.add({
      targets: flash,
      scale: 0.9 + power * 0.9,
      alpha: 0,
      duration: 320,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });

    const burst = this.add
      .image(x, y, 'star_large')
      .setTint(special ? 0xdff4ff : 0xffe7b0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(28)
      .setScale(0.12)
      .setAlpha(0.95)
      .setRotation(Math.random() * Math.PI);
    this.tweens.add({
      targets: burst,
      scale: 0.9 + power * 0.7,
      rotation: burst.rotation + 0.9,
      alpha: 0,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => burst.destroy(),
    });

    this.cameras.main.shake(90, 0.002 + power * 0.002);
  }

  resolveScore(birds, x, y, radius, empowered = false) {
    const count = birds.length;

    if (count > 0) {
      this.hits += 1;
      this.combo = Math.min(9, this.combo + 1);
      this.comboTimer = 8;
      this.maxCombo = Math.max(this.maxCombo, this.combo);

      let points = 0;
      for (const bird of birds) points += BIRD_TYPES[bird.type].points;

      const big = count >= 6;
      let gain = points * this.combo;
      if (big) gain += 15 * this.combo;
      if (empowered) gain *= 2;

      this.score += gain;
      this.scared += count;

      this.showImpactText(x, y, gain, count, big || empowered);
      if (empowered) {
        this.showBanner(this.combo >= 2 ? `共 鳴 之 絃  ×${this.combo}` : '共 鳴 之 絃');
      } else if (big) {
        this.showBanner(this.combo >= 2 ? `驚 群  ×${this.combo}` : '驚 群');
      }
      sfx.combo(this.combo);

      // 命中蓄“弦鸣”，满弦后下一弦范围与分数翻倍
      const charge = 10 + Math.min(16, count * 1.6) + (big ? 8 : 0);
      const before = this.resonance;
      this.resonance = Math.min(100, this.resonance + charge * (empowered ? 0.6 : 1));
      if (before < 100 && this.resonance >= 100) sfx.lock();

      // 金羽回穗：惊起金羽可以补回星穗
      const golds = birds.filter((b) => b.type === 'gold');
      if (golds.length > 0) {
        const heal = golds.length * 6;
        this.grain = Math.min(GRAIN_MAX, this.grain + heal);
        this.grainPulse = 0.5;
        this.showGrainGain(golds[0], heal);
        this.sparkFx.explode(8, golds[0].x, golds[0].y);
        sfx.chirp('gold');
      }

      const samples = birds.slice(0, 16);
      for (const bird of samples) {
        this.sparkFx.explode(2, bird.x, bird.y);
      }
      this.sparkFx.explode(8, x, y);
    } else {
      this.combo = 0;
      this.comboTimer = 0;
    }
  }

  showGrainGain(bird, amount) {
    const text = makeText(this, bird.x, bird.y + 34, `+${amount} 星穗`, {
      font: FONT_TITLE,
      size: 18,
      color: S.goldLight,
      origin: 0.5,
      stroke: '#05070c',
      strokeThickness: 3,
    }).setDepth(46);
    this.tweens.add({
      targets: text,
      y: text.y - 20,
      alpha: 0,
      delay: 220,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  showImpactText(x, y, gain, count, big) {
    const color = big ? S.goldLight : S.paper;
    const main = makeText(this, x, y - 62, `+${gain}`, {
      font: FONT_TITLE,
      size: big ? 40 : 30,
      color,
      origin: 0.5,
      stroke: '#05070c',
      strokeThickness: 4,
    }).setDepth(46);
    const sub = makeText(this, x, y - 24, `驚起 ${count} 隻`, {
      size: 15,
      color: S.goldLight,
      origin: 0.5,
      stroke: '#05070c',
      strokeThickness: 3,
    })
      .setDepth(46)
      .setAlpha(0.9);

    this.tweens.add({
      targets: [main, sub],
      y: '-=28',
      alpha: 0,
      delay: 180,
      duration: 950,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        main.destroy();
        sub.destroy();
      },
    });
  }

  showBanner(text, x = 720, y = 250) {
    const banner = makeText(this, x, y, text, {
      font: FONT_TITLE,
      size: 44,
      color: S.goldLight,
      origin: 0.5,
      letterSpacing: 10,
      stroke: '#05070c',
      strokeThickness: 6,
    })
      .setDepth(47)
      .setAlpha(0)
      .setScale(1.25);

    this.tweens.add({
      targets: banner,
      alpha: 1,
      scale: 1,
      duration: 240,
      ease: 'Back.easeOut',
    });
    this.tweens.add({
      targets: banner,
      alpha: 0,
      y: y - 26,
      delay: 760,
      duration: 480,
      ease: 'Sine.easeIn',
      onComplete: () => banner.destroy(),
    });
  }

  handleEat(bird, type) {
    if (this.roundOver) return;
    this.grain = Math.max(0, this.grain - type.grain);
    this.grainPulse = 0.5;
    this.wheatFx.explode(6, bird.x, bird.y);
    sfx.peck();

    const loss = makeText(this, 330, 72, `-${type.grain}`, {
      size: 14,
      color: S.red,
      origin: [1, 0],
    }).setDepth(42);
    this.tweens.add({
      targets: loss,
      y: 60,
      alpha: 0,
      duration: 700,
      ease: 'Cubic.easeOut',
      onComplete: () => loss.destroy(),
    });

    if (this.grain <= 0) this.endRound('grain');
  }

  // ------------------------------------------------------------------
  // 弓、准星、HUD
  // ------------------------------------------------------------------

  drawBow(charge) {
    const g = this.bowG;
    g.clear();

    const bx = BOW_X;
    const by = BOW_Y - 8;
    const ang = Math.atan2(this.aim.y - by, this.aim.x - bx);
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const px = -dy;
    const py = dx;

    const tip = 58;
    const curl = 10 + charge * 3;
    const bulge = 34 + charge * 14;

    // 主弓臂端点
    const tip1x = bx + px * tip;
    const tip1y = by + py * tip;
    const tip2x = bx - px * tip;
    const tip2y = by - py * tip;
    // 反曲弓梢：向瞄准方向再弯出一小段
    const end1x = tip1x + dx * curl + px * 3.2;
    const end1y = tip1y + dy * curl + py * 3.2;
    const end2x = tip2x + dx * curl - px * 3.2;
    const end2y = tip2y + dy * curl - py * 3.2;

    const ctrlX = bx + dx * bulge;
    const ctrlY = by + dy * bulge;

    const quadPoint = (ax, ay, cx, cy, bx2, by2, t) => {
      const it = 1 - t;
      return {
        x: it * it * ax + 2 * it * t * cx + t * t * bx2,
        y: it * it * ay + 2 * it * t * cy + t * t * by2,
      };
    };

    // 主弓臂采样点
    const mainPts = [];
    for (let i = 0; i <= 20; i++) {
      mainPts.push(quadPoint(tip1x, tip1y, ctrlX, ctrlY, tip2x, tip2y, i / 20));
    }

    // 弓梢短弧
    const hook1Pts = [];
    const hook2Pts = [];
    const h1cx = tip1x + dx * curl * 0.35 + px * 0.4;
    const h1cy = tip1y + dy * curl * 0.35 + py * 0.4;
    const h2cx = tip2x + dx * curl * 0.35 - px * 0.4;
    const h2cy = tip2y + dy * curl * 0.35 - py * 0.4;
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      hook1Pts.push(quadPoint(tip1x, tip1y, h1cx, h1cy, end1x, end1y, t));
      hook2Pts.push(quadPoint(tip2x, tip2y, h2cx, h2cy, end2x, end2y, t));
    }

    // 分层描金：柔光、墨底、暗金、主金、高光
    const strokeLimb = (pts, w = 1) => {
      g.lineStyle(12 * w, C.gold, 0.05);
      g.strokePoints(pts);
      g.lineStyle(6.8 * w, 0x030509, 0.92);
      g.strokePoints(pts);
      g.lineStyle(3.4 * w, C.goldDeep, 1);
      g.strokePoints(pts);
      g.lineStyle(1.9 * w, C.gold, 1);
      g.strokePoints(pts);
      g.lineStyle(0.8 * w, C.goldLight, 0.85);
      g.strokePoints(pts);
    };

    strokeLimb(mainPts);
    strokeLimb(hook1Pts, 0.72);
    strokeLimb(hook2Pts, 0.72);

    // 弓梢与弓臂的连接处：小束金环，遮住接缝
    [tip1x, tip2x].forEach((x, i) => {
      const y = i === 0 ? tip1y : tip2y;
      g.fillStyle(0x030509, 1);
      g.fillCircle(x, y, 4.4);
      g.lineStyle(1.2, C.gold, 0.95);
      g.strokeCircle(x, y, 4.4);
      g.lineStyle(0.7, C.goldLight, 0.7);
      g.strokeCircle(x, y, 2.2);
    });

    // 弓臂绑绳：两处细金缠线
    [0.2, 0.8].forEach((t) => {
      const p = quadPoint(tip1x, tip1y, ctrlX, ctrlY, tip2x, tip2y, t);
      g.lineStyle(1.4, C.goldDeep, 0.9);
      g.lineBetween(p.x - dx * 3.2, p.y - dy * 3.2, p.x + dx * 3.2, p.y + dy * 3.2);
      g.lineStyle(0.7, C.goldLight, 0.65);
      g.lineBetween(
        p.x - dx * 2.1 + px * 1.2,
        p.y - dy * 2.1 + py * 1.2,
        p.x + dx * 2.1 + px * 1.2,
        p.y + dy * 2.1 + py * 1.2
      );
    });

    // 弓弦与搭弦点
    const pull = 7 + charge * 33;
    const vib = this.stringVib > 0.01 ? Math.sin(this.elapsed * 110) * this.stringVib * 2.2 : 0;
    const nockX = bx - dx * pull + px * vib;
    const nockY = by - dy * pull + py * vib;

    g.lineStyle(2.8, 0x030509, 0.55);
    g.lineBetween(end1x, end1y, nockX, nockY);
    g.lineBetween(end2x, end2y, nockX, nockY);
    g.lineStyle(1.4, C.paper, 0.65 + charge * 0.18);
    g.lineBetween(end1x, end1y, nockX, nockY);
    g.lineBetween(end2x, end2y, nockX, nockY);
    g.lineStyle(0.6, C.goldLight, 0.5);
    g.lineBetween(end1x, end1y, nockX, nockY);
    g.lineBetween(end2x, end2y, nockX, nockY);

    // 弦耳
    [end1x, end2x].forEach((x, i) => {
      const y = i === 0 ? end1y : end2y;
      g.fillStyle(0x030509, 1);
      g.fillCircle(x, y, 2.4);
      g.lineStyle(0.9, C.gold, 0.9);
      g.strokeCircle(x, y, 2.4);
    });

    // 握把：缠绳 + 两端束环
    const gx = 0.25 * tip1x + 0.5 * ctrlX + 0.25 * tip2x;
    const gy = 0.25 * tip1y + 0.5 * ctrlY + 0.25 * tip2y;
    g.lineStyle(10.5, 0x04070c, 0.96);
    g.lineBetween(gx - px * 13, gy - py * 13, gx + px * 13, gy + py * 13);

    g.lineStyle(1.1, C.goldDeep, 0.95);
    [-1, 1].forEach((s) => {
      const ox = dx * 4.2 * s;
      const oy = dy * 4.2 * s;
      g.lineBetween(
        gx - px * 13 + ox,
        gy - py * 13 + oy,
        gx + px * 13 + ox,
        gy + py * 13 + oy
      );
    });
    g.lineStyle(0.8, C.gold, 0.5);
    for (let i = -2; i <= 2; i++) {
      const t = i * 4.6;
      g.lineBetween(
        gx + px * t - dx * 4,
        gy + py * t - dy * 4,
        gx + px * (t + 2.8) + dx * 4,
        gy + py * (t + 2.8) + dy * 4
      );
    }
    g.lineStyle(1.3, C.gold, 0.85);
    [-1, 1].forEach((s) => {
      const x = gx + px * 13 * s;
      const y = gy + py * 13 * s;
      g.lineBetween(x - dx * 4.2, y - dy * 4.2, x + dx * 4.2, y + dy * 4.2);
    });

    // 弦上凝出的一线“声光”（袋空时只拉空弦）
    if (charge > 0.02 && this.tones > 0) {
      const len = 76 + charge * 50;
      const amp = 0.8 + charge * 2.2;
      const pts = [];
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const wobble =
          Math.sin(t * 7.5 - this.elapsed * 16) *
          amp *
          Math.sin(Math.PI * t) *
          (0.3 + charge * 0.7);
        pts.push({
          x: nockX + dx * len * t + px * wobble,
          y: nockY + dy * len * t + py * wobble,
        });
      }

      // 外层柔光
      g.lineStyle(6, C.gold, 0.04 + charge * 0.05);
      g.strokePoints(pts);
      // 弦气主光：自弦结向尖端渐细渐淡
      for (let i = 0; i < pts.length - 1; i++) {
        const t = i / (pts.length - 1);
        g.lineStyle(1.9 - t * 0.9, C.goldLight, (0.72 + charge * 0.24) * (1 - t * 0.45));
        g.lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
        g.lineStyle(0.65 - t * 0.3, C.paper, (0.62 + charge * 0.28) * (1 - t * 0.4));
        g.lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      }

      // 侧旁一道青色泛音
      g.lineStyle(0.7, 0x9fd8e8, 0.14 + charge * 0.22);
      const off = 1.4 + charge * 0.8;
      g.beginPath();
      pts.forEach((p, i) => {
        if (i === 0) g.moveTo(p.x + px * off, p.y + py * off);
        else g.lineTo(p.x + px * off, p.y + py * off);
      });
      g.strokePath();

      // 声光尖端：一点星芒
      const tipP = pts[pts.length - 1];
      const twinkle = 0.6 + 0.4 * Math.sin(this.elapsed * 16);
      const s = (3.6 + charge * 4) * twinkle;
      g.fillStyle(C.paper, 0.92);
      g.fillCircle(tipP.x, tipP.y, 1.2 + charge * 1.3);
      g.lineStyle(0.9, C.goldLight, 0.6 + charge * 0.35);
      g.lineBetween(tipP.x - s, tipP.y, tipP.x + s, tipP.y);
      g.lineBetween(tipP.x, tipP.y - s, tipP.x, tipP.y + s);

      if (charge > 0.65) {
        const k = (charge - 0.65) / 0.35;
        g.lineStyle(1, 0x9fd8e8, 0.25 + k * 0.45);
        g.strokeCircle(tipP.x, tipP.y, 4 + k * 7);
      }
    }

    if (charge > 0.7) {
      const k = (charge - 0.7) / 0.3;
      g.fillStyle(C.goldLight, 0.65 * k);
      g.fillCircle(nockX, nockY, 2.2 + k * 2.5);
      g.lineStyle(1, C.goldLight, 0.35 * k);
      g.strokeCircle(nockX, nockY, 5 + k * 5);
    }

    // 弓梢星芒
    this.bowTips.forEach((spark, i) => {
      const x = i === 0 ? end1x : end2x;
      const y = i === 0 ? end1y : end2y;
      spark.setPosition(x, y);
      spark.setRotation(this.elapsed * (i === 0 ? 0.8 : -0.8));
      spark.setScale(0.16 + charge * 0.2 + Math.sin(this.elapsed * 2.4 + i * 1.9) * 0.015);
      spark.setAlpha(0.18 + charge * 0.5);
    });
  }

  /** 弦囊：弦音数随放弦变化，静置在弓侧 */
  drawQuiver() {
    const g = this.quiverG;
    if (!g) return;
    g.clear();

    const tilt = -0.21;
    const ax = Math.sin(tilt);
    const ay = -Math.cos(tilt);
    const qx = Math.cos(tilt);
    const qy = Math.sin(tilt);
    const ox = BOW_X + 94;
    const oy = BOW_Y + 28;
    const height = 64;
    const wBottom = 8.4;
    const wTop = 11.6;

    const P = (u, v) => ({
      x: ox + ax * u + qx * v,
      y: oy + ay * u + qy * v,
    });

    const body = [P(0, -wBottom), P(0, wBottom), P(height, wTop), P(height, -wTop)];

    // 落影
    g.fillStyle(0x02040a, 0.5);
    g.fillEllipse(ox + 2, oy + 5, 42, 13);

    // 袋身
    g.fillStyle(0x060a11, 0.97);
    g.fillPoints(body, true);
    g.lineStyle(1.4, C.gold, 0.9);
    g.strokePoints(body, true);

    // 侧边高光
    g.lineStyle(1, C.paper, 0.12);
    g.lineBetween(P(7, -wBottom + 2), P(height - 8, -wTop + 3));

    // 缝合线：沿袋身左缘的细金点
    g.fillStyle(C.gold, 0.38);
    for (let u = 7; u <= height - 8; u += 7) {
      const w = wBottom + ((wTop - wBottom) * u) / height;
      const s = P(u, -w + 2.2);
      g.fillCircle(s.x, s.y, 0.55);
    }

    // 底部包边
    g.fillStyle(0x05070c, 1);
    g.fillCircle(ox, oy, wBottom);
    g.lineStyle(1.1, C.gold, 0.5);
    g.strokeCircle(ox, oy, wBottom);

    // 两道皮质束带
    [17, 45].forEach((u, idx) => {
      const w = wBottom + ((wTop - wBottom) * u) / height;
      g.lineStyle(2.6, C.goldDeep, 0.95);
      g.lineBetween(P(u, -w - 0.6).x, P(u, -w - 0.6).y, P(u, w + 0.6).x, P(u, w + 0.6).y);
      g.lineStyle(0.8, C.gold, 0.65);
      g.lineBetween(P(u + 1.5, -w).x, P(u + 1.5, -w).y, P(u + 1.5, w).x, P(u + 1.5, w).y);
      if (idx === 0) {
        const b = P(u, w + 3.6);
        g.fillStyle(C.gold, 0.85);
        g.fillCircle(b.x, b.y, 1.7);
      }
    });

    // 袋身小篆风格的菱形饰纹
    const rune = P(31, 0);
    g.fillStyle(C.gold, 0.4);
    g.fillPoints(
      [
        { x: rune.x, y: rune.y - 3.4 },
        { x: rune.x + 2.8, y: rune.y },
        { x: rune.x, y: rune.y + 3.4 },
        { x: rune.x - 2.8, y: rune.y },
      ],
      true
    );

    // 袋口外翻的金边
    const cuff = [
      P(height - 10, -wTop - 0.4),
      P(height - 10, wTop + 0.4),
      P(height, wTop + 2.6),
      P(height, -wTop - 2.6),
    ];
    g.fillStyle(0x060a11, 0.98);
    g.fillPoints(cuff, true);
    g.lineStyle(1.2, C.gold, 0.9);
    g.strokePoints(cuff, true);

    // 暗色开口
    g.fillStyle(0x02040a, 0.96);
    g.fillPoints(
      [
        P(height - 4.5, -wTop - 1),
        P(height - 0.5, -wTop - 2),
        P(height - 0.5, wTop + 2),
        P(height - 4.5, wTop + 1),
      ],
      true
    );
    g.lineStyle(2.2, C.gold, 0.95);
    g.lineBetween(
      P(height + 0.5, -wTop - 2.6).x,
      P(height + 0.5, -wTop - 2.6).y,
      P(height + 0.5, wTop + 2.6).x,
      P(height + 0.5, wTop + 2.6).y
    );
    g.lineStyle(0.8, C.goldLight, 0.6);
    g.lineBetween(
      P(height + 1.8, -wTop - 1.6).x,
      P(height + 1.8, -wTop - 1.6).y,
      P(height + 1.8, wTop + 1.6).x,
      P(height + 1.8, wTop + 1.6).y
    );

    // 弦音：固定六个音位，每放一弦少一道
    const slots = [-1.7, 1.7, -5.2, 5.2, -8.6, 8.6];
    for (let i = 0; i < this.tones; i++) {
      const v = slots[i];
      const lean = ((i % 3) - 1) * 1.2;
      const tipU = height + 19 + (i % 2) * 4;
      const start = P(height - 12, v * 0.5);
      const end = P(tipU, v + lean);
      const sway = Math.sin(this.elapsed * 2 + i * 1.3) * 1.1;
      const bend = (i % 2 === 0 ? 1 : -1) * 3.2 + sway;
      const ctrl = P(height + 3, v + lean + bend);

      const pts = [];
      for (let s = 0; s <= 10; s++) {
        const t = s / 10;
        const it = 1 - t;
        pts.push({
          x: it * it * start.x + 2 * it * t * ctrl.x + t * t * end.x,
          y: it * it * start.y + 2 * it * t * ctrl.y + t * t * end.y,
        });
      }

      // 弦音：青色微光裹着一线金
      g.lineStyle(4, 0x9fd8e8, 0.045);
      g.strokePoints(pts);
      g.lineStyle(1.4, C.goldLight, 0.85);
      g.strokePoints(pts);
      g.lineStyle(0.55, C.paper, 0.5);
      g.strokePoints(pts);

      // 顶端弦结：小环与一圈淡青光晕
      g.lineStyle(0.9, 0xdff4ff, 0.85);
      g.strokeCircle(end.x, end.y, 2);
      g.fillStyle(C.paper, 0.8);
      g.fillCircle(end.x, end.y, 0.65);
      g.lineStyle(0.7, 0x9fd8e8, 0.32);
      g.strokeCircle(end.x, end.y, 3.6);
    }

    // 聚音 / 弦尽反馈
    if (this.quiverFlash > 0.01) {
      g.lineStyle(2.5, C.goldLight, 0.55 * this.quiverFlash);
      g.strokePoints(body, true);
      const rim = P(height, 0);
      g.fillStyle(C.goldLight, 0.45 * this.quiverFlash);
      g.fillCircle(rim.x, rim.y, 2 + (1 - this.quiverFlash) * 5);
    }
    if (this.toneEmptyFlash > 0.01) {
      g.lineStyle(2, C.red, 0.6 * this.toneEmptyFlash);
      g.strokePoints(body, true);
    }

    // 计数文字
    const labelX = ox + 27;
    const labelY = BOW_Y - 2;
    const full = this.tones >= QUIVER_MAX;
    const label = this.tones > 0 ? `弦 × ${this.tones}` : '聚 音';
    if (this.quiverText.text !== label) this.quiverText.setText(label);
    const color = full ? S.goldLight : this.tones > 0 ? S.paper : S.red;
    if (this.quiverColor !== color) {
      this.quiverColor = color;
      this.quiverText.setColor(color);
    }
    this.quiverText.setAlpha(
      this.tones > 0
        ? 0.7 + this.quiverFlash * 0.3
        : 0.55 + 0.45 * Math.abs(Math.sin(this.elapsed * 5))
    );
    this.quiverText.setScale(1 + this.quiverFlash * 0.08);

    // 聚音进度
    if (!full) {
      const t = clamp(this.toneRefillT / QUIVER_REFILL, 0, 1);
      g.fillStyle(0x05070c, 0.75);
      g.fillRect(labelX, labelY + 15, 48, 2);
      g.fillStyle(this.tones === 0 ? C.red : C.gold, 0.85);
      g.fillRect(labelX, labelY + 15, 48 * t, 2);
    }
  }

  drawReticle(charge) {
    const g = this.reticle;
    g.clear();

    const x = this.aim.x;
    const y = this.aim.y;
    const radius = 78 + 96 * charge;
    const pulse = (Math.sin(this.elapsed * 12) + 1) / 2;

    this.aimGlow.setPosition(x, y);
    this.aimGlow.setScale(0.35 + charge * 0.8);
    this.aimGlow.setAlpha(0.1 + charge * 0.1);
    this.aimStar.setPosition(x, y);
    this.aimStar.setRotation(this.elapsed * 1.1);
    this.aimStar.setScale(0.32 + charge * 0.3);
    this.aimStar.setAlpha(0.5 + charge * 0.45);

    const dashes = 28;
    g.lineStyle(1.1, C.gold, 0.55);
    for (let i = 0; i < dashes; i++) {
      if (i % 2 === 1) continue;
      const a1 = (i / dashes) * Math.PI * 2;
      const a2 = a1 + (Math.PI * 2 / dashes) * 0.62;
      g.beginPath();
      g.arc(x, y, radius, a1, a2);
      g.strokePath();
    }

    if (charge > 0.01) {
      g.lineStyle(6, C.gold, 0.12);
      g.beginPath();
      g.arc(x, y, radius + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge);
      g.strokePath();
      g.lineStyle(2.4, C.goldLight, 0.95);
      g.beginPath();
      g.arc(x, y, radius + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge);
      g.strokePath();
      g.lineStyle(1, C.gold, 0.35);
      g.strokeCircle(x, y, 4 + charge * 5);
    }

    g.lineStyle(1, C.goldLight, 0.8);
    g.lineBetween(x - 15, y, x - 6, y);
    g.lineBetween(x + 6, y, x + 15, y);
    g.lineBetween(x, y - 15, x, y - 6);
    g.lineBetween(x, y + 6, x, y + 15);
    g.fillStyle(C.goldLight, 0.9);
    g.fillCircle(x, y, 1.8);

    if (charge > 0.985) {
      g.lineStyle(1, C.goldLight, 0.2 + pulse * 0.5);
      g.strokeCircle(x, y, radius + 18 + pulse * 4);
    }

    if (this.resonance >= 100) {
      const p = (Math.sin(this.elapsed * 8) + 1) / 2;
      g.lineStyle(1.4, 0x9fd8e8, 0.3 + p * 0.4);
      g.strokeCircle(x, y, radius + 23 + p * 4);
    }
  }

  updateHud(dt) {
    this.hudTick += dt;
    if (this.hudTick < 0.07) {
      this.drawGrainBar();
      this.drawResonance();
      return;
    }
    this.hudTick = 0;
    this.updateHudText();
    this.drawGrainBar();
    this.drawResonance();
  }

  updateHudText() {
    this.scoreText.setText(String(this.score));

    const timer = formatTime(this.timeLeft);
    if (this.timerText.text !== timer) this.timerText.setText(timer);
    if (this.timeLeft <= 15) {
      this.timerText.setColor(S.red);
      this.timerText.setAlpha(0.72 + 0.28 * Math.abs(Math.sin(this.elapsed * 6)));
    } else {
      this.timerText.setColor(S.paper);
      this.timerText.setAlpha(1);
    }

    this.bestText.setText(this.best > 0 ? `最佳 ${this.best}` : '最佳 —');

    const grainInt = Math.ceil(this.grain);
    if (grainInt !== this.lastGrainShown) {
      this.lastGrainShown = grainInt;
      this.grainValue.setText(String(grainInt));
    }
    this.grainValue.setColor(this.grain <= 30 ? S.red : S.paper);

    if (this.combo !== this.lastComboShown) {
      this.lastComboShown = this.combo;
      this.tweens.killTweensOf(this.comboText);
      if (this.combo >= 2) {
        this.comboText.setText(`連 擊  ×${this.combo}`);
        this.comboText.setAlpha(1).setScale(1.22);
        this.tweens.add({
          targets: this.comboText,
          scale: 1,
          duration: 220,
          ease: 'Back.easeOut',
        });
      } else {
        this.comboText.setAlpha(0);
        this.comboText.setText('');
      }
    }

    if (this.combo >= 2) {
      const expiring = this.comboTimer < 2.5;
      this.comboText.setAlpha(
        expiring ? 0.45 + 0.55 * Math.abs(Math.sin(this.elapsed * 10)) : 1
      );
    }

    const full = this.resonance >= 100;
    const resonanceText = full ? '共 鳴' : '絃 鳴';
    if (this.resonanceLabel.text !== resonanceText) {
      this.resonanceLabel.setText(resonanceText);
    }
    this.resonanceLabel.setColor(full ? S.goldLight : S.dim);
    this.resonanceLabel.setAlpha(full ? 0.95 : 0.7);
  }

  drawResonance() {
    const g = this.resonanceBarG;
    if (!g) return;
    g.clear();

    const ratio = clamp(this.resonance / 100, 0, 1);
    const full = ratio >= 0.999;

    g.lineStyle(1, 0xece3d0, 0.1);
    g.lineBetween(650, 154, 790, 154);

    if (ratio > 0) {
      g.lineStyle(2, full ? 0x9fd8e8 : C.gold, 0.9);
      g.lineBetween(650, 154, 650 + 140 * ratio, 154);
    }

    if (full) {
      const p = (Math.sin(this.elapsed * 8) + 1) / 2;
      g.lineStyle(1, 0x9fd8e8, 0.3 + p * 0.4);
      g.lineBetween(650, 150, 790, 150);
    }
  }

  drawGrainBar() {
    const g = this.grainBarG;
    g.clear();

    const ratio = clamp(this.grain / GRAIN_MAX, 0, 1);
    const color = this.grain <= 30 ? C.red : C.gold;

    g.lineStyle(1, 0xece3d0, 0.16);
    g.lineBetween(60, 102, 300, 102);

    if (ratio > 0.001) {
      g.lineStyle(2.2, color, 0.95);
      g.lineBetween(60, 102, 60 + 240 * ratio, 102);
      g.fillStyle(color, 0.95);
      g.fillCircle(60 + 240 * ratio, 102, 1.8);
    }

    g.lineStyle(1, 0xece3d0, 0.1);
    for (let i = 1; i < 4; i++) {
      g.lineBetween(60 + 60 * i, 98, 60 + 60 * i, 106);
    }

    const danger = this.grain <= 30 || this.grainPulse > 0;
    g.setAlpha(danger ? 0.55 + 0.45 * Math.abs(Math.sin(this.elapsed * 7)) : 1);
  }

  // ------------------------------------------------------------------
  // 暂停 / 结算
  // ------------------------------------------------------------------

  togglePause() {
    if (this.roundOver) return;
    if (this.isPaused) this.resumeGame();
    else this.pauseGame();
  }

  pauseGame() {
    if (this.isPaused) return;
    this.isPaused = true;
    this.pointerCharging = false;
    this.charge = 0;
    this.gestureArmed = false;
    this.gestureCharge = 0;
    sfx.setCharge(false);

    this.scene.get('Backdrop')?.setDim(0.5);

    const layer = this.add.container(0, 0).setDepth(80).setAlpha(0);

    // 遮罩铺满相机可见世界，避免宽屏窗口下只盖住设计区而露出接缝
    const dim = this.add.rectangle(0, 0, 10, 10, 0x02040a, 0.55);
    const coverCamera = () => {
      const cam = this.cameras.main;
      const w = cam.width / cam.zoom + 4;
      const h = cam.height / cam.zoom + 4;
      dim.setPosition(cam.midPoint.x, cam.midPoint.y);
      dim.setSize(w, h);
      if (dim.input && dim.input.hitArea) {
        dim.input.hitArea.width = w;
        dim.input.hitArea.height = h;
      }
    };
    coverCamera();
    this.scale.on('resize', coverCamera);
    layer.once('destroy', () => this.scale.off('resize', coverCamera));
    dim.setInteractive();
    layer.add(dim);

    const panel = this.add.graphics();
    drawPanel(panel, 478, 274, 484, 350, { fillAlpha: 0.92 });
    layer.add(panel);

    layer.add(
      makeText(this, 720, 306, '暫 停', {
        font: FONT_TITLE,
        size: 48,
        color: S.paper,
        origin: [0.5, 0],
        letterSpacing: 12,
      })
    );
    layer.add(
      makeText(this, 720, 370, '喘口氣，絃猶未冷。', {
        size: 15,
        color: S.dim,
        origin: [0.5, 0],
        letterSpacing: 1,
      })
    );

    const resume = makeButton(this, {
      x: 720,
      y: 470,
      w: 300,
      h: 56,
      label: '繼續 · 拉弓',
      accent: true,
      fontSize: 19,
      onClick: () => this.resumeGame(),
    });
    layer.add(resume);

    const back = makeButton(this, {
      x: 720,
      y: 542,
      w: 300,
      h: 52,
      label: '歸園 · 返回主選單',
      fontSize: 16,
      onClick: () => this.scene.start('Menu'),
    });
    layer.add(back);

    layer.add(
      makeText(this, 720, 596, 'P / Esc 繼續', {
        size: 11,
        color: S.dim,
        origin: [0.5, 0],
      })
    );

    this.pauseOverlay = layer;
    this.tweens.add({ targets: layer, alpha: 1, duration: 180, ease: 'Sine.easeOut' });
  }

  resumeGame() {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.scene.get('Backdrop')?.setDim(0);
    if (this.pauseOverlay) {
      this.pauseOverlay.destroy(true);
      this.pauseOverlay = null;
    }
  }

  endRound(reason) {
    if (this.roundOver) return;
    this.roundOver = true;
    this.endReason = reason;
    this.pointerCharging = false;
    this.charge = 0;
    this.gestureArmed = false;
    this.gestureCharge = 0;
    sfx.setCharge(false);

    this.reticle.clear();
    this.aimGlow.setVisible(false);
    this.aimStar.setVisible(false);
    this.drawBow(0);

    // 收梢：全场鸟群惊飞
    this.boids.scare(720, 880, 2800);
    this.playTwangFx(720, 760, 240, 1);

    const finaleRing = this.add.graphics().setDepth(26);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 950,
      ease: 'Cubic.easeOut',
      onUpdate: (tween) => {
        const p = tween.getValue();
        finaleRing.clear();
        finaleRing.lineStyle(2.2, C.goldLight, 0.7 * (1 - p));
        finaleRing.strokeCircle(720, 760, 70 + 840 * p);
      },
      onComplete: () => finaleRing.destroy(),
    });

    this.cameras.main.shake(260, 0.006);
    this.cameras.main.flash(220, 197, 160, 89, false);
    sfx.twang(1);
    sfx.finish(reason === 'time');

    const endText = makeText(this, 720, 350, reason === 'time' ? '時 辰 已 盡' : '星 穗 已 盡', {
      font: FONT_TITLE,
      size: 64,
      color: S.goldLight,
      origin: 0.5,
      letterSpacing: 12,
      stroke: '#05070c',
      strokeThickness: 8,
    })
      .setDepth(60)
      .setAlpha(0);

    this.tweens.add({
      targets: endText,
      alpha: 1,
      duration: 460,
      ease: 'Sine.easeOut',
    });

    const data = {
      score: this.score,
      scared: this.scared,
      maxCombo: this.maxCombo,
      twangs: this.twangs,
      hits: this.hits,
      grainLeft: this.grain,
      duration: Math.min(ROUND_SECONDS, this.elapsed),
      reason,
    };

    this.time.delayedCall(1500, () => {
      const best = getBest();
      const newRecord = data.score > best;
      if (newRecord) setBest(data.score);
      this.scene.start('Result', { ...data, best: Math.max(best, data.score), newRecord });
    });
  }
}
