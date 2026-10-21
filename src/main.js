import Phaser from 'phaser';
import './style.css';
import { GAME_W, GAME_H } from './js/constants.js';
import { sfx } from './js/Audio.js';
import { BootScene } from './scenes/BootScene.js';
import { BackdropScene } from './scenes/BackdropScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { ResultScene } from './scenes/ResultScene.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#05070c',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: GAME_W,
    height: GAME_H,
  },
  render: {
    antialias: true,
    powerPreference: 'high-performance',
  },
  audio: {
    noAudio: true,
  },
  scene: [BootScene, BackdropScene, MenuScene, GameScene, ResultScene],
});

// 首次交互时解锁 WebAudio
window.addEventListener('pointerdown', () => sfx.ensure(), { once: true });
window.addEventListener('keydown', () => sfx.ensure(), { once: true });

// 调试入口，与 SteelTide 保持一致
window.__game = game;
