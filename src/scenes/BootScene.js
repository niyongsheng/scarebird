import Phaser from 'phaser';
import { createSkyTexture } from '../js/background.js';
import { createGameTextures } from '../js/textures.js';
import { makeText } from '../js/ui.js';
import { FONT_TITLE, S } from '../js/constants.js';
import { fitMainCamera } from '../js/layout.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.cameras.main.setBackgroundColor('#05070c');
    fitMainCamera(this);

    makeText(this, 720, 412, '研 墨', {
      font: FONT_TITLE,
      size: 42,
      color: S.goldLight,
      origin: 0.5,
      letterSpacing: 12,
    }).setAlpha(0.85);

    const progress = makeText(this, 720, 470, '正在展開星圖與飛鳥…', {
      size: 13,
      color: S.dim,
      origin: 0.5,
      letterSpacing: 2,
    });

    this.load.on('progress', (value) => {
      progress.setText(`正在展開星圖與飛鳥…  ${Math.round(value * 100)}%`);
    });


  }

  create() {
    createSkyTexture(this);
    createGameTextures(this);

    // 等小篆字体就绪再进菜单，避免印章先以楷体闪一下
    const fontReady =
      document.fonts && document.fonts.load
        ? document.fonts.load('48px "LXGW Seal"', '驚').catch(() => null)
        : Promise.resolve(null);
    const timeout = new Promise((resolve) => window.setTimeout(resolve, 1400));

    Promise.race([fontReady, timeout]).then(() => {
      this.time.delayedCall(80, () => {
        this.scene.launch('Backdrop');
        this.scene.manager.sendToBack('Backdrop');
        this.scene.start('Menu');
      });
    });
  }
}
