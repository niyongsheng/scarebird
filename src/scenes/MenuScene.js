import Phaser from 'phaser';
import { Boids } from '../js/Boids.js';
import { sfx } from '../js/Audio.js';
import { getGestureController } from '../js/GestureController.js';
import { GAME_W, GAME_H, FONT_TITLE, FONT_SEAL, S, C } from '../js/constants.js';
import { getBest } from '../js/storage.js';
import { makeText, titleText, drawPanel, makeButton, toast } from '../js/ui.js';
import { fitMainCamera } from '../js/layout.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    this.gesture = getGestureController();
    // 菜单页按钮较多，摄像头预览留到对局内显示
    this.gesture.setHudVisible(false);
    this.starting = false;

    // 深空背景由常驻 Backdrop 场景铺满，主场景只保留安全区内容
    fitMainCamera(this);
    this.scene.get('Backdrop')?.setDim(0);

    // ---- 观赏飞鸟（偏右上，给标题留出呼吸） ----
    this.flock = new Boids(this, { ambient: true, depth: 12 });
    this.flock.spawnAmbient(110);
    for (const bird of this.flock.birds) {
      bird.x = 700 + Math.random() * 640;
      bird.y = 100 + Math.random() * 380;
      bird.anchorX = 720 + Math.random() * 620;
      bird.anchorY = 110 + Math.random() * 340;
      bird.sprite.setPosition(bird.x, bird.y);
      if (bird.glow) bird.glow.setPosition(bird.x, bird.y);
    }

    // ---- 标题区 ----
    const eyebrow = makeText(this, 144, 164, 'BOIDS · 星野飛鳥 · 手勢互動', {
      size: 13,
      color: S.gold,
      letterSpacing: 5,
      alpha: 0,
    });
    const title = titleText(this, 136, 192, '驚弓之鳥', 132, {
      color: S.paper,
      letterSpacing: 2,
      alpha: 0,
    });
    const rule = this.add.graphics().setDepth(20).setAlpha(0);
    rule.lineStyle(1, C.gold, 0.5);
    rule.lineBetween(146, 386, 620, 386);
    rule.fillStyle(C.gold, 0.9);
    rule.fillRect(146, 383, 26, 2);

    const subtitle = makeText(this, 144, 408, '絃聲一起，群鳥皆驚', {
      font: FONT_TITLE,
      size: 30,
      color: S.paper,
      letterSpacing: 3,
      alpha: 0,
    });
    const desc = makeText(
      this,
      144,
      464,
      '虛弓無箭，只以絃聲驚起飛鳥。\n守住星田裡的星穗，別讓它們落下來。',
      {
        size: 16,
        color: S.paperDim,
        lineSpacing: 11,
        alpha: 0,
      }
    );

    const best = getBest();
    const bestText = makeText(
      this,
      144,
      552,
      best > 0 ? `歷史最佳  ·  ${best}` : '歷史最佳  ·  尚無戰績',
      {
        size: 15,
        color: S.gold,
        letterSpacing: 2,
        alpha: 0,
      }
    );

    // 印章：上方为小篆“惊”，下方以弓形符号写意“弓”
    const sealW = 104;
    const sealH = 118;
    const seal = this.add
      .container(760, 238)
      .setDepth(21)
      .setAlpha(0)
      .setRotation(0.025);

    const sealShadow = this.add.graphics();
    sealShadow.fillStyle(0x000000, 0.26);
    sealShadow.fillRect(-sealW / 2 + 4, -sealH / 2 + 5, sealW, sealH);
    seal.add(sealShadow);

    const sealBg = this.add.graphics();
    sealBg.fillStyle(0xb8442f, 0.96);
    sealBg.fillRect(-sealW / 2, -sealH / 2, sealW, sealH);

    // 印泥的斑驳
    for (let i = 0; i < 30; i++) {
      sealBg.fillStyle(0x7c2a1c, 0.08 + Math.random() * 0.14);
      sealBg.fillRect(
        -sealW / 2 + 3 + Math.random() * (sealW - 6),
        -sealH / 2 + 3 + Math.random() * (sealH - 6),
        1 + Math.random() * 2.2,
        1 + Math.random() * 2.2
      );
    }

    // 磕边
    for (let i = 0; i < 11; i++) {
      const edge = Math.floor(Math.random() * 4);
      let cx;
      let cy;
      if (edge === 0) {
        cx = -sealW / 2 + Math.random() * sealW;
        cy = -sealH / 2;
      } else if (edge === 1) {
        cx = -sealW / 2 + Math.random() * sealW;
        cy = sealH / 2 - 2;
      } else if (edge === 2) {
        cx = -sealW / 2;
        cy = -sealH / 2 + Math.random() * sealH;
      } else {
        cx = sealW / 2 - 2;
        cy = -sealH / 2 + Math.random() * sealH;
      }
      sealBg.fillStyle(0x1a1010, 0.28 + Math.random() * 0.3);
      sealBg.fillRect(cx, cy, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }

    sealBg.lineStyle(1.6, 0xf0ddc0, 0.84);
    sealBg.strokeRect(-sealW / 2 + 7, -sealH / 2 + 7, sealW - 14, sealH - 14);
    sealBg.lineStyle(1, 0xf0ddc0, 0.28);
    sealBg.strokeRect(-sealW / 2 + 11, -sealH / 2 + 11, sealW - 22, sealH - 22);
    seal.add(sealBg);

    const sealText = makeText(this, 0, -20, '驚', {
      font: FONT_SEAL,
      size: 58,
      color: '#f6e8d2',
      origin: 0.5,
    });
    seal.add(sealText);

    const bowMark = this.add.graphics();
    const ivory = 0xf3e4cb;
    bowMark.lineStyle(3.2, ivory, 0.95);
    bowMark.beginPath();
    bowMark.arc(-6, 30, 15, -Math.PI / 2, Math.PI / 2, false);
    bowMark.strokePath();
    bowMark.lineStyle(1.2, ivory, 0.8);
    bowMark.lineBetween(-6, 15, -6, 45);
    bowMark.lineStyle(2.4, ivory, 0.9);
    bowMark.lineBetween(9, 25, 9, 35);
    bowMark.lineStyle(1.4, ivory, 0.9);
    bowMark.lineBetween(-6, 30, 15, 30);
    bowMark.lineBetween(-6, 30, -14, 25);
    bowMark.lineBetween(-6, 30, -14, 35);
    bowMark.fillStyle(ivory, 0.95);
    bowMark.fillTriangle(19, 30, 13, 26.5, 13, 33.5);
    seal.add(bowMark);

    [eyebrow, title, subtitle, desc, bestText, seal, rule].forEach((item) => item.setDepth(21));

    this.tweens.add({
      targets: [eyebrow, title, subtitle, desc, bestText, seal],
      alpha: 1,
      duration: 900,
      ease: 'Cubic.easeOut',
      delay: 110,
    });
    this.tweens.add({
      targets: rule,
      alpha: 1,
      duration: 700,
      delay: 380,
    });

    // ---- 玩法面板 ----
    const panel = this.add.graphics().setDepth(20);
    drawPanel(panel, 952, 232, 368, 382, { fillAlpha: 0.8 });

    makeText(this, 984, 258, '玩 法', {
      size: 21,
      color: S.goldLight,
      letterSpacing: 7,
    }).setDepth(21);
    makeText(this, 984, 292, '守星穗，驚飛鳥；一絃驚起越多，分數越高。', {
      size: 12,
      color: S.dim,
      letterSpacing: 0.5,
    }).setDepth(21);

    const rows = [
      ['01', '瞄準', '移動手掌 · 或移動滑鼠'],
      ['02', '拉弓', '拇指食指張開 · 或按住蓄力'],
      ['03', '放弦', '拇指食指合攏 · 或鬆手'],
    ];
    rows.forEach((row, i) => {
      const y = 336 + i * 46;
      makeText(this, 984, y, row[0], {
        size: 13,
        color: S.gold,
        letterSpacing: 1,
      }).setDepth(21);
      makeText(this, 1020, y - 2, row[1], {
        size: 17,
        color: S.paper,
        letterSpacing: 2,
      }).setDepth(21);
      makeText(this, 1082, y, row[2], {
        size: 13,
        color: S.paperDim,
      }).setDepth(21);
    });

    const divider = this.add.graphics().setDepth(21);
    divider.lineStyle(1, C.gold, 0.22);
    divider.lineBetween(984, 476, 1288, 476);

    makeText(this, 984, 496, '麻雀 1  ·  烏鴉 2  ·  金羽 5', {
      size: 13,
      color: S.paperDim,
      letterSpacing: 1,
    }).setDepth(21);
    makeText(this, 984, 526, '連擊越高，絃聲越值錢。', {
      size: 13,
      color: S.paperDim,
    }).setDepth(21);
    makeText(this, 984, 556, '九十秒內，別讓星穗見底。', {
      size: 13,
      color: S.paperDim,
    }).setDepth(21);
    makeText(this, 984, 584, '金羽回穗 · 滿絃共鳴，下一弦翻倍', {
      size: 12,
      color: S.gold,
      alpha: 0.85,
      letterSpacing: 0.5,
    }).setDepth(21);

    // ---- 按钮 ----
    this.primaryBtn = makeButton(this, {
      x: 1136,
      y: 668,
      w: 336,
      h: 64,
      label: '開   弓',
      sub: this.gesture.available ? '手勢控制 · 已就緒' : '滑鼠 / 觸控 · 按住蓄力',
      accent: true,
      fontSize: 24,
      onClick: () => this.startGame(),
    });

    this.gestureBtn = makeButton(this, {
      x: 1136,
      y: 748,
      w: 336,
      h: 56,
      label: this.gesture.available ? '手勢已啟用 · 點此關閉' : '啟用手勢控制',
      sub: this.gesture.available ? '食指瞄準 · 張指拉弓 · 合攏放弦' : '需要攝影機 · 推薦 Chrome / Edge',
      fontSize: 17,
      accent: false,
      onClick: () => this.toggleGesture(),
    });

    makeText(this, 1136, 800, '手勢影像僅在本機處理，不會上傳', {
      size: 10.5,
      color: S.dim,
      origin: 0.5,
      alpha: 0.7,
    }).setDepth(21);

    makeText(this, 144, GAME_H - 54, '靈感取自《戰國策》· 更羸虛弓落雁', {
      size: 12,
      color: S.dim,
      letterSpacing: 1,
      alpha: 0.75,
    }).setDepth(21);
    makeText(this, GAME_W - 40, GAME_H - 54, 'F 全屏 · SCAREBIRD · 星野手繪', {
      size: 10,
      color: S.gold,
      letterSpacing: 3,
      alpha: 0.55,
      origin: [1, 0],
    }).setDepth(21);

    // ---- 键盘 ----
    this.input.keyboard.on('keydown-SPACE', () => this.startGame());
    this.input.keyboard.on('keydown-ENTER', () => this.startGame());

    this.events.once('shutdown', () => {
      this.flock?.destroy();
      this.input.removeAllListeners();
      this.input.keyboard.removeAllListeners();
    });
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    this.flock.update(dt, time / 1000);
  }

  startGame() {
    if (this.starting) return;
    this.starting = true;
    sfx.ensure();
    this.scene.start('Game', { useGesture: this.gesture.available });
  }

  async toggleGesture() {
    if (this.gesture.enabling) return;

    if (this.gesture.available) {
      this.gesture.disable();
      this.refreshGestureUi();
      toast(this, '已關閉手勢，可隨時用滑鼠遊玩', 760);
      return;
    }

    this.gestureBtn.setLabel('正在連接攝影機…');
    this.gestureBtn.setSub('請在瀏覽器提示中允許使用攝影機');
    const ok = await this.gesture.enable();
    if (!this.scene.isActive()) return;

    this.refreshGestureUi();
    if (ok) {
      sfx.lock();
      toast(this, '手勢已就緒 · 食指瞄準，張指拉弓', 760);
    } else {
      toast(this, '攝影機不可用，已保留滑鼠 / 觸控操作', 760);
    }
  }

  refreshGestureUi() {
    const active = this.gesture.available;
    this.primaryBtn.setSub(active ? '手勢控制 · 已就緒' : '滑鼠 / 觸控 · 按住蓄力');
    this.gestureBtn.setLabel(active ? '手勢已啟用 · 點此關閉' : '啟用手勢控制');
    this.gestureBtn.setSub(
      active ? '食指瞄準 · 張指拉弓 · 合攏放弦' : '需要攝影機 · 推薦 Chrome / Edge'
    );
  }
}
