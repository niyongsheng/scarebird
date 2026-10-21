import { GAME_W, GAME_H, FIELD_Y } from './constants.js';

function mulberry32(seed) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 星球地平线：中间高、两侧低，像从轨道上方俯视 */
function horizonAt(x) {
  const t = (x - GAME_W / 2) / (GAME_W / 2);
  return FIELD_Y + 22 + t * t * 78;
}

function drawMoon(ctx, x, y, r) {
  const ringRot = -0.21;

  const drawRing = (from, to, alpha) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ringRot);
    ctx.shadowColor = 'rgba(190, 210, 235, 0.25)';
    ctx.shadowBlur = 7;
    ctx.strokeStyle = `rgba(218, 205, 176, ${alpha})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 2.08, r * 0.42, 0, from, to);
    ctx.stroke();
    ctx.strokeStyle = `rgba(158, 192, 224, ${alpha * 0.5})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 2.22, r * 0.48, 0, from, to);
    ctx.stroke();
    ctx.restore();
  };

  // 远侧环（先画，被星球挡住）
  drawRing(Math.PI, Math.PI * 2, 0.22);

  // 月晕
  const halo = ctx.createRadialGradient(x, y, r * 0.7, x, y, r * 4.6);
  halo.addColorStop(0, 'rgba(232, 214, 170, 0.18)');
  halo.addColorStop(0.35, 'rgba(214, 192, 142, 0.07)');
  halo.addColorStop(1, 'rgba(214, 192, 142, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r * 4.6, 0, Math.PI * 2);
  ctx.fill();

  // 月盘
  const disc = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  disc.addColorStop(0, '#fbf4df');
  disc.addColorStop(0.55, '#ecdcb8');
  disc.addColorStop(1, '#cfb98b');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // 环形山
  const craters = [
    [-0.32, -0.18, 0.16],
    [0.26, -0.34, 0.1],
    [0.38, 0.24, 0.13],
    [-0.1, 0.4, 0.09],
    [-0.45, 0.28, 0.07],
    [0.05, 0.02, 0.055],
  ];
  if ('filter' in ctx) ctx.filter = 'blur(3px)';
  craters.forEach(([cx, cy, cr]) => {
    ctx.beginPath();
    ctx.arc(x + cx * r, y + cy * r, cr * r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(124, 104, 72, 0.13)';
    ctx.fill();
  });
  if ('filter' in ctx) ctx.filter = 'none';

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 246, 222, 0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 近侧环（后画，压在星球前方）
  drawRing(0, Math.PI, 0.3);
}

function drawPlanetSurface(ctx, random) {
  const points = [];
  for (let x = -20; x <= GAME_W + 20; x += 10) {
    points.push({ x, y: horizonAt(x) });
  }

  // 大气层薄雾
  const hazeTop = FIELD_Y - 96;
  const haze = ctx.createLinearGradient(0, hazeTop, 0, FIELD_Y + 90);
  haze.addColorStop(0, 'rgba(120, 164, 210, 0)');
  haze.addColorStop(0.62, 'rgba(120, 164, 210, 0.045)');
  haze.addColorStop(1, 'rgba(120, 164, 210, 0.11)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, hazeTop, GAME_W, FIELD_Y + 90 - hazeTop);

  // 星球表面
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.lineTo(GAME_W + 20, GAME_H + 20);
  ctx.lineTo(-20, GAME_H + 20);
  ctx.closePath();

  const surface = ctx.createLinearGradient(0, FIELD_Y, 0, GAME_H);
  surface.addColorStop(0, '#0c1723');
  surface.addColorStop(0.22, '#070e16');
  surface.addColorStop(0.65, '#04080d');
  surface.addColorStop(1, '#020407');
  ctx.fillStyle = surface;
  ctx.fill();

  // 地平线的冷色边缘光
  ctx.save();
  ctx.shadowColor = 'rgba(150, 196, 232, 0.4)';
  ctx.shadowBlur = 14;
  ctx.strokeStyle = 'rgba(190, 220, 242, 0.38)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.restore();

  // 地表星穗：金色光点，不再是草丛
  for (let i = 0; i < 620; i++) {
    const x = random() * GAME_W;
    const top = horizonAt(x);
    const y = top + Math.pow(random(), 0.75) * (GAME_H - top + 12);
    if (y > GAME_H + 8) continue;
    const depth = Math.min(1, (y - top) / Math.max(1, GAME_H - top));
    const r = 0.4 + random() * 0.9 + depth * 0.9;
    const alpha = 0.12 + random() * 0.5;
    ctx.fillStyle = `rgba(${214 + Math.floor(random() * 30)}, ${178 + Math.floor(random() * 30)}, ${104 + Math.floor(random() * 34)}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    if (random() > 0.955) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 7 + depth * 10);
      glow.addColorStop(0, 'rgba(236, 206, 146, 0.3)');
      glow.addColorStop(1, 'rgba(236, 206, 146, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 7 + depth * 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 弓手身后的暖光
  const warm = ctx.createRadialGradient(720, 878, 20, 720, 878, 360);
  warm.addColorStop(0, 'rgba(214, 174, 96, 0.14)');
  warm.addColorStop(0.5, 'rgba(188, 146, 76, 0.045)');
  warm.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = warm;
  ctx.fillRect(320, 560, 800, 340);

  // 几条极淡的横向光带，暗示“田垄”
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const y = 816 + i * 18;
    ctx.strokeStyle = `rgba(210, 172, 96, ${0.035 - i * 0.004})`;
    ctx.beginPath();
    ctx.moveTo(160 + i * 38, y);
    ctx.quadraticCurveTo(720, y - 12 - i * 3, 1280 - i * 38, y);
    ctx.stroke();
  }
}

function drawNebula(ctx, x, y, rx, ry, angle, color, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(${color}, ${alpha})`);
  g.addColorStop(0.42, `rgba(${color}, ${alpha * 0.55})`);
  g.addColorStop(0.75, `rgba(${color}, ${alpha * 0.18})`);
  g.addColorStop(1, `rgba(${color}, 0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 完全由代码绘制的螺旋星系 */
function drawGalaxy(ctx, random, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.22);
  ctx.scale(1, 0.58);

  // 星系外晕
  const halo = ctx.createRadialGradient(0, 0, 10, 0, 0, 330);
  halo.addColorStop(0, 'rgba(150, 140, 200, 0.11)');
  halo.addColorStop(0.5, 'rgba(100, 110, 180, 0.045)');
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, 330, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = 'screen';

  // 旋臂上的星云团
  for (let i = 0; i < 42; i++) {
    const arm = i % 2;
    const t = Math.pow(random(), 0.72);
    const angle = arm * Math.PI + t * 5.2 + (random() - 0.5) * 0.34;
    const radius = 24 + t * 270;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const warm = t < 0.28;
    const color = warm
      ? '210, 184, 148'
      : random() > 0.5
        ? '108, 132, 202'
        : '132, 112, 178';
    const alpha = (0.035 + random() * 0.05) * (1 - t * 0.35);
    drawNebula(ctx, x, y, 28 + random() * 78, 18 + random() * 48, angle + Math.PI / 2, color, alpha);
  }

  // 旋臂星尘
  for (let arm = 0; arm < 2; arm++) {
    for (let i = 0; i < 560; i++) {
      const t = Math.pow(i / 560, 0.85);
      const angle = arm * Math.PI + t * 5.3 + (random() - 0.5) * 0.32;
      const radius = 16 + t * 275 + (random() - 0.5) * 22;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const warm = t < 0.22;
      const a = (0.1 + random() * 0.5) * (1 - t * 0.3);
      ctx.fillStyle = warm
        ? `rgba(246, 228, 190, ${a})`
        : random() > 0.45
          ? `rgba(165, 185, 235, ${a})`
          : `rgba(205, 180, 225, ${a})`;
      ctx.beginPath();
      ctx.arc(x, y, 0.4 + random() * 1.5 * (1 - t * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 臂间散星
  for (let i = 0; i < 280; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 20 + Math.pow(random(), 0.6) * 290;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    ctx.fillStyle = `rgba(180, 200, 240, ${0.06 + random() * 0.25})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.4 + random() * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over';

  // 暗尘带
  ctx.save();
  ctx.rotate(0.15);
  const dust = ctx.createRadialGradient(0, 0, 0, 0, 0, 170);
  dust.addColorStop(0, 'rgba(8, 10, 18, 0.22)');
  dust.addColorStop(1, 'rgba(8, 10, 18, 0)');
  ctx.fillStyle = dust;
  ctx.beginPath();
  ctx.ellipse(0, 12, 150, 46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();

  // 星系核心
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 100);
  core.addColorStop(0, 'rgba(255, 244, 218, 0.46)');
  core.addColorStop(0.18, 'rgba(245, 225, 180, 0.2)');
  core.addColorStop(0.55, 'rgba(190, 170, 200, 0.06)');
  core.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, 100, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 248, 225, 0.68)';
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
}

/** 程序化深空：底色、星云、银河与恒星 */
function drawDeepSky(ctx, random) {
  const sky = ctx.createLinearGradient(0, 0, 0, FIELD_Y + 40);
  sky.addColorStop(0, '#03050b');
  sky.addColorStop(0.25, '#060b16');
  sky.addColorStop(0.55, '#0a1422');
  sky.addColorStop(0.78, '#0e1a28');
  sky.addColorStop(1, '#152430');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, GAME_W, FIELD_Y + 40);

  // 大片星云
  ctx.globalCompositeOperation = 'screen';
  const clouds = [
    [1130, 250, 330, 170, -0.2, '90, 130, 190', 0.1],
    [960, 360, 300, 150, 0.3, '120, 100, 180', 0.08],
    [320, 300, 360, 190, -0.25, '100, 80, 160', 0.08],
    [200, 500, 280, 140, 0.2, '60, 100, 150', 0.06],
    [1320, 520, 260, 160, -0.35, '80, 110, 170', 0.055],
    [700, 170, 300, 130, 0.1, '80, 120, 170', 0.045],
    [500, 560, 320, 120, 0.2, '130, 110, 170', 0.04],
    [860, 600, 300, 140, -0.1, '60, 90, 140', 0.04],
  ];
  for (const [x, y, rx, ry, rot, color, alpha] of clouds) {
    drawNebula(ctx, x, y, rx, ry, rot, color, alpha);
  }

  // 斜贯画面的银河薄雾
  ctx.save();
  ctx.translate(720, 430);
  ctx.rotate(-0.22);
  const band = ctx.createLinearGradient(0, -160, 0, 160);
  band.addColorStop(0, 'rgba(80, 110, 160, 0)');
  band.addColorStop(0.45, 'rgba(100, 130, 180, 0.045)');
  band.addColorStop(0.55, 'rgba(120, 110, 170, 0.05)');
  band.addColorStop(1, 'rgba(80, 110, 160, 0)');
  ctx.fillStyle = band;
  ctx.fillRect(-820, -160, 1640, 320);
  ctx.restore();

  drawGalaxy(ctx, random, 760, 410);

  // 深蓝罩层，保证文字与飞鸟的可读性
  const veil = ctx.createLinearGradient(0, 0, 0, GAME_H);
  veil.addColorStop(0, 'rgba(3, 6, 14, 0.34)');
  veil.addColorStop(0.35, 'rgba(4, 7, 16, 0.36)');
  veil.addColorStop(0.7, 'rgba(5, 9, 18, 0.5)');
  veil.addColorStop(1, 'rgba(3, 4, 8, 0.74)');
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, GAME_W, GAME_H);

  // 罩层后保留一点星系核心的余辉
  const core = ctx.createRadialGradient(760, 410, 0, 760, 410, 150);
  core.addColorStop(0, 'rgba(220, 200, 240, 0.1)');
  core.addColorStop(0.4, 'rgba(150, 140, 200, 0.04)');
  core.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, GAME_W, GAME_H);
}

export function createSkyTexture(scene) {
  if (scene.textures.exists('sky')) return;
  const tex = scene.textures.createCanvas('sky', GAME_W, GAME_H);
  if (!tex) return;
  const ctx = tex.getContext();
  const random = mulberry32(20240418);

  drawDeepSky(ctx, random);

  // 星
  for (let i = 0; i < 260; i++) {
    const x = random() * GAME_W;
    const y = random() * 620;
    const r = 0.35 + random() * 1.3;
    const a = 0.1 + random() * 0.72;
    const tint = random();
    ctx.fillStyle =
      tint > 0.86
        ? `rgba(255, 221, 166, ${a})`
        : tint > 0.7
          ? `rgba(186, 208, 255, ${a})`
          : `rgba(240, 238, 228, ${a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (random() > 0.94) {
      ctx.strokeStyle = `rgba(255, 245, 220, ${a * 0.4})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x - 4, y);
      ctx.lineTo(x + 4, y);
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x, y + 4);
      ctx.stroke();
    }
  }

  drawMoon(ctx, 1086, 196, 86);

  // 薄云
  if ('filter' in ctx) ctx.filter = 'blur(26px)';
  for (let i = 0; i < 9; i++) {
    const cx = 120 + random() * 1200;
    const cy = 250 + random() * 250;
    const rx = 140 + random() * 260;
    const ry = 14 + random() * 30;
    const gold = Math.abs(cx - 1086) < 300;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
    g.addColorStop(0, gold ? 'rgba(206, 180, 130, 0.08)' : 'rgba(150, 175, 195, 0.06)');
    g.addColorStop(1, 'rgba(150, 175, 195, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if ('filter' in ctx) ctx.filter = 'none';

  drawPlanetSurface(ctx, random);

  // 纸纹
  for (let i = 0; i < 5000; i++) {
    const x = random() * GAME_W;
    const y = random() * GAME_H;
    ctx.fillStyle = random() > 0.5 ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 0, 0, 0.018)';
    ctx.fillRect(x, y, 1, 1);
  }

  // 暗角
  const vig = ctx.createRadialGradient(
    GAME_W / 2,
    GAME_H * 0.46,
    GAME_H * 0.32,
    GAME_W / 2,
    GAME_H * 0.48,
    GAME_H * 0.86
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(0.72, 'rgba(0,0,0,0.22)');
  vig.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, GAME_W, GAME_H);

  tex.refresh();
}
