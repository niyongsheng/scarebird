import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../js/constants.js';
import { addStarTwinkles } from '../js/decor.js';
import { coverBackdropCamera } from '../js/layout.js';

/**
 * 常驻背景场景：深空、星球、星田铺满整个窗口。
 * 菜单 / 对局 / 结算都以透明相机叠在它上面。
 */
export class BackdropScene extends Phaser.Scene {
  constructor() {
    super('Backdrop');
  }

  create() {
    this.cameras.main.setBackgroundColor('#05070c');

    this.add.image(0, 0, 'sky').setOrigin(0).setDepth(0);

    const moonGlow = this.add
      .image(1086, 196, 'glow')
      .setTint(0xe6d3a3)
      .setScale(3.7)
      .setAlpha(0.08)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(1);
    this.tweens.add({
      targets: moonGlow,
      alpha: { from: 0.06, to: 0.12 },
      scale: { from: 3.5, to: 4.1 },
      duration: 5200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    addStarTwinkles(this, { count: 14, depth: 5 });

    this.dim = this.add
      .rectangle(0, 0, GAME_W, GAME_H, 0x02040a, 1)
      .setOrigin(0)
      .setAlpha(0)
      .setDepth(100);

    coverBackdropCamera(this);
  }

  setDim(alpha) {
    if (!this.dim) return;
    this.dim.setAlpha(alpha);
  }
}
