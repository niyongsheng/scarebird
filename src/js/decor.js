import Phaser from 'phaser';
import { GAME_W } from './constants.js';

/**
 * 用程序化四角星做几颗会呼吸的亮星。
 * 放在鸟群与 UI 之下，只做氛围，不抢视线。
 */
export function addStarTwinkles(scene, options = {}) {
  const count = options.count !== undefined ? options.count : 8;
  const depth = options.depth !== undefined ? options.depth : 5;
  const top = options.top !== undefined ? options.top : 90;
  const bottom = options.bottom !== undefined ? options.bottom : 540;
  const stars = [];

  for (let i = 0; i < count; i++) {
    const key = i % 4 === 0 ? 'star_large' : 'star_medium';
    const x = 70 + Math.random() * (GAME_W - 140);
    const y = top + Math.random() * (bottom - top);
    const tint = i % 2 === 0 ? 0xe6d3a3 : 0xbfd3ff;
    const baseAlpha = 0.18 + Math.random() * 0.32;
    const baseScale = 0.22 + Math.random() * 0.24;

    const star = scene.add
      .image(x, y, key)
      .setTint(tint)
      .setAlpha(baseAlpha)
      .setScale(baseScale)
      .setRotation(Math.random() * 0.8)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(depth);

    scene.tweens.add({
      targets: star,
      alpha: { from: baseAlpha * 0.35, to: baseAlpha },
      scale: { from: baseScale * 0.8, to: baseScale * 1.18 },
      duration: 1700 + Math.random() * 2600,
      delay: Math.random() * 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    stars.push(star);
  }

  return stars;
}
