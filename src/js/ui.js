import Phaser from 'phaser';
import { FONT_TITLE, FONT_UI, C, S } from './constants.js';
import { sfx } from './Audio.js';

export function makeText(scene, x, y, content, options = {}) {
  const style = {
    fontFamily: options.font || FONT_UI,
    fontSize: options.size || 20,
    color: options.color || S.paper,
    align: options.align || 'left',
  };
  if (options.letterSpacing !== undefined) style.letterSpacing = options.letterSpacing;
  if (options.lineSpacing !== undefined) style.lineSpacing = options.lineSpacing;
  if (options.stroke) style.stroke = options.stroke;
  if (options.strokeThickness) style.strokeThickness = options.strokeThickness;
  if (options.shadow) style.shadow = options.shadow;

  const txt = scene.add.text(x, y, content, style);
  txt.setResolution(2);
  if (options.origin !== undefined) {
    const ox = Array.isArray(options.origin) ? options.origin[0] : options.origin;
    const oy = Array.isArray(options.origin) ? options.origin[1] : options.origin;
    txt.setOrigin(ox, oy);
  }
  if (options.alpha !== undefined) txt.setAlpha(options.alpha);
  if (options.depth !== undefined) txt.setDepth(options.depth);
  if (options.wordWrap !== undefined) txt.setWordWrapWidth(options.wordWrap);
  return txt;
}

export const titleText = (scene, x, y, content, size = 96, options = {}) =>
  makeText(scene, x, y, content, {
    font: FONT_TITLE,
    size,
    color: S.paper,
    ...options,
  });

export function drawPanel(g, x, y, w, h, options = {}) {
  g.fillStyle(C.ink, options.fillAlpha !== undefined ? options.fillAlpha : 0.62);
  g.fillRoundedRect(x, y, w, h, options.radius || 3);
  g.lineStyle(1, C.gold, options.borderAlpha !== undefined ? options.borderAlpha : 0.16);
  g.strokeRoundedRect(x, y, w, h, options.radius || 3);
  g.fillStyle(C.gold, options.accentAlpha !== undefined ? options.accentAlpha : 0.7);
  g.fillRect(x, y + 18, 1.5, h - 36);
}

/**
 * 器物风格按钮：细金线、暗底、悬停点亮。
 */
export function makeButton(scene, config) {
  const {
    x,
    y,
    w = 280,
    h = 58,
    label = '',
    sub = '',
    accent = false,
    fontSize = 22,
    onClick = () => {},
    depth = 20,
  } = config;

  const container = scene.add.container(x, y).setDepth(depth);
  const bg = scene.add.graphics();
  const labelY = sub ? -7 : 0;
  const labelText = makeText(scene, 0, labelY, label, {
    size: fontSize,
    color: accent ? S.goldLight : S.paper,
    align: 'center',
    letterSpacing: 3,
  }).setOrigin(0.5);
  container.add(bg);
  container.add(labelText);

  let subText = null;
  if (sub) {
    subText = makeText(scene, 0, 15, sub, {
      size: 11,
      color: accent ? S.paperDim : S.dim,
      align: 'center',
      letterSpacing: 1,
    }).setOrigin(0.5);
    container.add(subText);
  }

  let enabled = true;
  const draw = (state) => {
    bg.clear();
    const hover = state === 'hover';
    const down = state === 'down';
    if (accent) {
      bg.fillStyle(C.inkPanel, down ? 0.92 : hover ? 0.84 : 0.66);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 2);
      bg.lineStyle(1, C.gold, down ? 1 : hover ? 0.95 : 0.78);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 2);
      bg.fillStyle(C.gold, hover ? 0.95 : 0.72);
      bg.fillRect(-w / 2 + 16, h / 2 - 2.5, w - 32, 1.5);
    } else {
      bg.fillStyle(C.inkPanel, down ? 0.92 : hover ? 0.8 : 0.62);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 2);
      bg.lineStyle(1, C.gold, down ? 1 : hover ? 0.85 : 0.32);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 2);
      bg.fillStyle(C.gold, hover ? 0.9 : 0.45);
      bg.fillRect(-w / 2, -h / 2 + 12, 2, h - 24);
    }
    if (!enabled) {
      bg.fillStyle(0x05070c, 0.45);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 2);
    }
  };
  draw('idle');

  const hit = new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h);
  container.setInteractive({ hitArea: hit, hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true });

  container.on('pointerover', () => {
    if (enabled) draw('hover');
  });
  container.on('pointerout', () => draw('idle'));
  container.on('pointerdown', (pointer, localX, localY, event) => {
    if (!enabled) return;
    if (event && event.stopPropagation) event.stopPropagation();
    draw('down');
  });
  container.on('pointerup', (pointer, localX, localY, event) => {
    if (!enabled) return;
    if (event && event.stopPropagation) event.stopPropagation();
    draw('hover');
    sfx.ensure();
    sfx.click();
    onClick();
  });

  container.setLabel = (text) => labelText.setText(text);
  container.setSub = (text) => {
    if (subText) subText.setText(text);
  };
  container.setEnabled = (value) => {
    enabled = value;
    if (value) {
      container.setInteractive({
        hitArea: hit,
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      });
    } else {
      container.disableInteractive();
    }
    draw('idle');
  };
  return container;
}

export function formatTime(seconds) {
  const clamped = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function toast(scene, message, y = 800) {
  const t = makeText(scene, 720, y, message, {
    size: 17,
    color: S.goldLight,
    align: 'center',
    letterSpacing: 1,
  }).setOrigin(0.5);
  t.setPadding(16, 9, 16, 9);
  t.setBackgroundColor('rgba(5, 7, 12, 0.82)');
  t.setDepth(1000);
  scene.tweens.add({
    targets: t,
    alpha: 0,
    y: y - 16,
    delay: 1900,
    duration: 700,
    ease: 'Sine.easeIn',
    onComplete: () => t.destroy(),
  });
  return t;
}
