import Phaser from 'phaser';
import { getGestureController } from '../js/GestureController.js';
import { GAME_W, GAME_H, FONT_TITLE, C, S, rankFor } from '../js/constants.js';
import { makeText, drawPanel, makeButton, formatTime, toast } from '../js/ui.js';
import { shareResult } from '../js/Share.js';
import { fitMainCamera } from '../js/layout.js';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  init(data) {
    this.stats = data;
    this.gesture = getGestureController();
  }

  create() {
    const data = this.stats;
    const rank = rankFor(data.score);
    this.rank = rank;
    this.sharing = false;
    this.gesture.setHudVisible(false);

    // 深空背景由 Backdrop 铺满；这里只渲染战报 UI
    fitMainCamera(this);
    this.scene.get('Backdrop')?.setDim(0.66);

    // 面板阴影
    const shadow = this.add.graphics().setDepth(14);
    shadow.fillStyle(0x000000, 0.35);
    shadow.fillRoundedRect(340, 130, 780, 660, 4);

    const panel = this.add.graphics().setDepth(15);
    drawPanel(panel, 330, 120, 780, 660, { fillAlpha: 0.9, accentAlpha: 0.9 });

    makeText(this, 720, 148, 'SCAREBIRD · 一 絃 驚 群', {
      size: 11,
      color: S.gold,
      origin: [0.5, 0],
      letterSpacing: 4,
    })
      .setDepth(21)
      .setAlpha(0.8);

    makeText(this, 720, 172, '戰 報', {
      font: FONT_TITLE,
      size: 42,
      color: S.paper,
      origin: [0.5, 0],
      letterSpacing: 16,
    }).setDepth(21);

    const divider = this.add.graphics().setDepth(21);
    divider.lineStyle(1, C.gold, 0.32);
    divider.lineBetween(470, 238, 690, 238);
    divider.lineBetween(750, 238, 970, 238);
    divider.fillStyle(C.gold, 0.85);
    divider.fillTriangle(720, 232, 726, 238, 714, 238);

    makeText(this, 720, 258, '總 分', {
      size: 13,
      color: S.gold,
      origin: [0.5, 0],
      letterSpacing: 5,
    }).setDepth(21);

    const scoreText = makeText(this, 720, 278, '0', {
      font: FONT_TITLE,
      size: 88,
      color: S.paper,
      origin: [0.5, 0],
      stroke: '#05070c',
      strokeThickness: 4,
    }).setDepth(21);

    this.tweens.addCounter({
      from: 0,
      to: data.score,
      duration: 950,
      ease: 'Cubic.easeOut',
      onUpdate: (tween) => {
        scoreText.setText(String(Math.round(tween.getValue())));
      },
      onComplete: () => {
        scoreText.setText(String(data.score));
      },
    });

    if (data.newRecord) {
      const badge = this.add.container(884, 300).setDepth(22).setRotation(-0.06);
      const bg = this.add.graphics();
      bg.fillStyle(0xb8442f, 0.94);
      bg.fillRect(-48, -16, 96, 32);
      bg.lineStyle(1, 0xf0ddc0, 0.8);
      bg.strokeRect(-43, -12, 86, 24);
      badge.add(bg);
      badge.add(
        makeText(this, 0, 0, '新 紀 錄', {
          font: FONT_TITLE,
          size: 14,
          color: '#f4e6cf',
          origin: 0.5,
          letterSpacing: 2,
        })
      );
      this.tweens.add({
        targets: badge,
        scale: { from: 1.35, to: 1 },
        alpha: { from: 0, to: 1 },
        duration: 420,
        delay: 750,
        ease: 'Back.easeOut',
      });
    }

    makeText(this, 720, 398, rank.name, {
      font: FONT_TITLE,
      size: 32,
      color: S.goldLight,
      origin: [0.5, 0],
      letterSpacing: 6,
    }).setDepth(21);

    makeText(this, 720, 442, rank.note, {
      size: 14,
      color: S.paperDim,
      origin: [0.5, 0],
      lineSpacing: 6,
    }).setDepth(21);

    const accuracy = data.twangs > 0 ? Math.round((data.hits / data.twangs) * 100) : 0;
    const stats = [
      ['驚 起', `${data.scared} 隻`],
      ['最高連擊', data.maxCombo > 0 ? `×${data.maxCombo}` : '—'],
      ['命中率', data.twangs > 0 ? `${accuracy}%` : '—'],
      ['放 弦', `${data.twangs} 響`],
      ['剩餘星穗', `${Math.ceil(data.grainLeft)}`],
      ['用 時', formatTime(data.duration)],
    ];

    const columns = [500, 720, 940];
    stats.forEach((item, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = columns[col];
      const y = 500 + row * 68;
      makeText(this, x, y, item[1], {
        font: FONT_TITLE,
        size: 26,
        color: S.paper,
        origin: [0.5, 0],
        letterSpacing: 1,
      }).setDepth(21);
      makeText(this, x, y + 32, item[0], {
        size: 11,
        color: S.dim,
        origin: [0.5, 0],
        letterSpacing: 2,
      }).setDepth(21);
    });

    const reasonText =
      data.reason === 'grain' ? '星穗被啄空 · 只待來年再守' : '九十秒已盡 · 鳥群散去';
    makeText(this, 720, 636, reasonText, {
      size: 12,
      color: data.reason === 'grain' ? S.red : S.dim,
      origin: [0.5, 0],
      letterSpacing: 1,
    }).setDepth(21);

    makeText(
      this,
      720,
      660,
      data.newRecord ? `歷史最佳 · ${data.best}  ·  新紀錄` : `歷史最佳 · ${data.best || '—'}`,
      {
        size: 12,
        color: S.gold,
        origin: [0.5, 0],
        letterSpacing: 1,
      }
    )
      .setDepth(21)
      .setAlpha(0.85);

    const restartBtn = makeButton(this, {
      x: 470,
      y: 716,
      w: 220,
      h: 54,
      label: '再來一局 · R',
      accent: true,
      fontSize: 16,
      onClick: () => this.restart(),
    });

    const menuBtn = makeButton(this, {
      x: 720,
      y: 716,
      w: 220,
      h: 54,
      label: '歸園 · Esc',
      fontSize: 15,
      onClick: () => this.scene.start('Menu'),
    });

    const shareBtn = makeButton(this, {
      x: 970,
      y: 716,
      w: 220,
      h: 54,
      label: '分享戰績 · S',
      fontSize: 16,
      onClick: () => this.share(),
    });

    this.actionButtons = [restartBtn, menuBtn, shareBtn];

    makeText(this, 720, 810, '驚弓之鳥 · SCAREBIRD · 鳥群算法', {
      size: 10,
      color: S.dim,
      origin: [0.5, 0],
      letterSpacing: 3,
    })
      .setDepth(21)
      .setAlpha(0.55);

    this.input.keyboard.on('keydown-R', () => this.restart());
    this.input.keyboard.on('keydown-SPACE', () => this.restart());
    this.input.keyboard.on('keydown-S', () => this.share());
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('Menu'));

    this.cameras.main.fadeIn(450, 5, 7, 12);

    this.events.once('shutdown', () => {
      this.input.removeAllListeners();
      this.input.keyboard.removeAllListeners();
    });
  }

  restart() {
    this.scene.start('Game', { useGesture: this.gesture.available });
  }

  async share() {
    if (this.sharing) return;
    this.sharing = true;

    // 截图中不要出现底部三个操作按钮
    this.actionButtons.forEach((button) => button.setVisible(false));
    await new Promise((resolve) => window.setTimeout(resolve, 90));

    try {
      const message = await shareResult(this, this.stats, this.rank);
      if (this.scene.isActive()) toast(this, message, 760);
    } catch (error) {
      console.error('[Share] 生成战报失败', error);
      if (this.scene.isActive()) toast(this, '生成分享圖失敗，請重試', 760);
    } finally {
      if (this.scene.isActive()) {
        this.actionButtons.forEach((button) => button.setVisible(true));
      }
      this.sharing = false;
    }
  }
}
