import { BIRD_TYPES } from './constants.js';

function canvasTexture(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, w, h);
  draw(ctx, w, h);
  tex.refresh();
}

/* ------------------------------------------------------------------ */
/* 手绘飞鸟：侧视剪影 + 分羽翼，避免在缩小时出现“人脸感”               */
/* ------------------------------------------------------------------ */

const BIRD_ART = {
  sparrow: {
    bodyLen: 28,
    bodyH: 14,
    headR: 6.4,
    beakLen: 9.5,
    wingLen: 46,
    featherW: 3.2,
    flapMax: 0.45,
    flapBias: 0.72,
    tailType: 'fork',
    tailLen: 27,
    tailSpread: 15,
    crest: true,
    body: '#eddbb8',
    bodyDeep: '#c6ae83',
    belly: '#f8ecd5',
    wing: '#dcc69f',
    wingTip: 'rgba(178, 150, 103, 0.95)',
    wingFar: '#b39d76',
    wingFarTip: 'rgba(141, 117, 80, 0.95)',
    rim: '#a98f63',
    rimBright: '#fff3d9',
    rimAlpha: 0.42,
    eye: '#382e1f',
    beak: '#c9a15a',
    aura: null,
    cap: 'rgba(146, 107, 57, 0.24)',
    line: 0.65,
  },
  crow: {
    bodyLen: 32,
    bodyH: 15,
    headR: 7.1,
    beakLen: 10.5,
    wingLen: 50,
    featherW: 3.6,
    flapMax: 0.42,
    flapBias: 0.7,
    tailType: 'wedge',
    tailLen: 27,
    tailSpread: 17,
    crest: false,
    body: '#223a52',
    bodyDeep: '#0a1420',
    belly: '#2d4763',
    wing: '#28445f',
    wingTip: 'rgba(14, 24, 37, 0.95)',
    wingFar: '#1e344a',
    wingFarTip: 'rgba(12, 21, 32, 0.95)',
    rim: '#8fb6da',
    rimBright: '#d8ecff',
    rimAlpha: 0.55,
    eye: '#dff2ff',
    beak: '#9cc4e6',
    aura: 'rgba(120, 165, 215, 0.14)',
    line: 0.7,
  },
  gold: {
    bodyLen: 29,
    bodyH: 14.5,
    headR: 6.5,
    beakLen: 9.8,
    wingLen: 48,
    featherW: 3.4,
    flapMax: 0.48,
    flapBias: 0.76,
    tailType: 'swallow',
    tailLen: 28,
    tailSpread: 11,
    crest: true,
    body: '#f1d186',
    bodyDeep: '#bd8c3a',
    belly: '#ffe8b4',
    wing: '#e3b95a',
    wingTip: 'rgba(178, 127, 34, 0.95)',
    wingFar: '#c99c46',
    wingFarTip: 'rgba(151, 106, 34, 0.95)',
    rim: '#ffeeb8',
    rimBright: '#fff9dc',
    rimAlpha: 0.48,
    eye: '#3a280a',
    beak: '#e6bd63',
    aura: 'rgba(243, 207, 112, 0.18)',
    cap: 'rgba(177, 123, 35, 0.26)',
    line: 0.65,
  },
};

const FLAP_FRAMES = 8;

/** 一片尖羽：根部略宽，向尖端收锋，并带一点后掠弧度 */
function drawFeatherBlade(ctx, x, y, angle, len, w, bend, art, far, alpha = 1) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = -dy;
  const ny = dx;

  const tipX = x + dx * len;
  const tipY = y + dy * len;
  const midX = x + dx * len * 0.52;
  const midY = y + dy * len * 0.52;

  ctx.beginPath();
  ctx.moveTo(x + nx * w, y + ny * w);
  ctx.quadraticCurveTo(
    midX + nx * w * 0.6 - nx * bend * 0.5,
    midY + ny * w * 0.6 - ny * bend * 0.5,
    tipX,
    tipY
  );
  ctx.quadraticCurveTo(
    midX - nx * w * 0.12 - nx * bend * 0.55,
    midY - ny * w * 0.12 - ny * bend * 0.55,
    x - nx * w * 0.38,
    y - ny * w * 0.38
  );
  ctx.closePath();

  const grad = ctx.createLinearGradient(x, y, tipX, tipY);
  grad.addColorStop(0, far ? art.wingFar : art.wing);
  grad.addColorStop(0.62, far ? art.wingFarTip : art.wingTip);
  grad.addColorStop(1, far ? art.wingFar : art.wingTip);
  ctx.fillStyle = grad;
  ctx.globalAlpha = alpha;
  ctx.fill();

  ctx.strokeStyle = far ? art.rim : art.rim;
  ctx.globalAlpha = (far ? 0.2 : 0.28) * alpha;
  ctx.lineWidth = far ? 0.4 : 0.5;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * 翅膀由一小段翼臂和四根初级飞羽组成。
 * 飞羽从腕部呈扇形展开，翼尖是一排尖锋，而不是一片圆叶。
 */
function drawWingSide(ctx, art, shoulderX, shoulderY, alpha, far) {
  const scale = far ? 0.92 : 1;
  const L = art.wingLen * scale;
  const a = Math.PI + alpha;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const nx = -uy;
  const ny = ux;
  const armLen = L * 0.44;
  const wristX = shoulderX + ux * armLen;
  const wristY = shoulderY + uy * armLen;
  const featherLen = L - armLen;
  const w = art.featherW * scale;

  // 翼臂 / 覆羽
  const rootW = w * 1.0;
  const wristW = w * 1.6;
  ctx.beginPath();
  ctx.moveTo(shoulderX + nx * rootW, shoulderY + ny * rootW);
  ctx.quadraticCurveTo(
    shoulderX + ux * armLen * 0.5 + nx * wristW * 0.9,
    shoulderY + uy * armLen * 0.5 + ny * wristW * 0.9,
    wristX + nx * wristW,
    wristY + ny * wristW
  );
  ctx.quadraticCurveTo(
    wristX - nx * wristW * 0.2 + ux * 1.5,
    wristY - ny * wristW * 0.2 + uy * 1.5,
    wristX - nx * wristW * 0.75,
    wristY - ny * wristW * 0.75
  );
  ctx.quadraticCurveTo(
    shoulderX + ux * armLen * 0.48 - nx * rootW * 0.4,
    shoulderY + uy * armLen * 0.48 - ny * rootW * 0.4,
    shoulderX - nx * rootW * 0.5,
    shoulderY - ny * rootW * 0.5
  );
  ctx.closePath();
  const armGrad = ctx.createLinearGradient(shoulderX, shoulderY, wristX, wristY);
  armGrad.addColorStop(0, far ? art.wingFar : art.wing);
  armGrad.addColorStop(1, far ? art.wingFarTip : art.wingTip);
  ctx.fillStyle = armGrad;
  ctx.fill();
  ctx.strokeStyle = art.rim;
  ctx.globalAlpha = far ? 0.2 : 0.3;
  ctx.lineWidth = 0.45;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 初级飞羽：从后侧短羽向前侧长羽依次绘制，最外侧长羽压在最上面
  const specs = [
    { off: -0.3, len: 0.7 },
    { off: -0.2, len: 0.82 },
    { off: -0.1, len: 0.92 },
    { off: 0, len: 1 },
  ];
  specs.forEach((spec, i) => {
    drawFeatherBlade(
      ctx,
      wristX,
      wristY,
      a + spec.off,
      featherLen * spec.len,
      w * (0.85 + i * 0.05),
      1.0 + i * 0.3,
      art,
      far
    );
  });

  // 腕部小覆羽，遮住羽根
  drawFeatherBlade(
    ctx,
    wristX - ux * 1.2,
    wristY - uy * 1.2,
    a - 0.08,
    featherLen * 0.34,
    w * 0.9,
    0.8,
    art,
    far,
    far ? 0.85 : 0.95
  );
}

function drawTail(ctx, art, cx, cy) {
  const rootX = cx - art.bodyLen * 0.5 + 2;
  const rootY = cy - art.bodyH * 0.12;
  const spread = art.tailSpread;
  const lift = art.tailType === 'swallow' ? 1.4 : 2.6;

  // 尾羽分开画，小尺寸下也能看出是鸟尾而不是鱼鳍
  let specs;
  if (art.tailType === 'swallow') {
    specs = [
      { off: 0.24, len: 1.0, w: 2.6 },
      { off: -0.01, len: 0.5, w: 2.8 },
      { off: -0.26, len: 0.96, w: 2.5 },
    ];
  } else if (art.tailType === 'fork') {
    specs = [
      { off: 0.22, len: 0.96, w: 2.5 },
      { off: -0.02, len: 0.62, w: 2.8 },
      { off: -0.24, len: 0.92, w: 2.4 },
    ];
  } else {
    specs = [
      { off: 0.2, len: 0.78, w: 2.8 },
      { off: 0.0, len: 1.0, w: 3.1 },
      { off: -0.2, len: 0.78, w: 2.8 },
    ];
  }

  for (const spec of specs) {
    const angle = Math.PI - spec.off * 2.2;
    const len = art.tailLen * spec.len;
    const w = spec.w;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const nx = -dy;
    const ny = dx;
    const tipX = rootX + dx * len;
    const tipY = rootY + dy * len + spec.off * spread * 0.12 - lift;
    const midX = rootX + dx * len * 0.5;
    const midY = rootY + dy * len * 0.5;

    ctx.beginPath();
    ctx.moveTo(rootX + nx * w, rootY + ny * w);
    ctx.quadraticCurveTo(
      midX + nx * w * 0.9,
      midY + ny * w * 0.9,
      tipX,
      tipY
    );
    ctx.quadraticCurveTo(
      midX - nx * w * 0.5,
      midY - ny * w * 0.5,
      rootX - nx * w * 0.6,
      rootY - ny * w * 0.6
    );
    ctx.closePath();

    const g = ctx.createLinearGradient(rootX, rootY, tipX, tipY);
    g.addColorStop(0, art.bodyDeep);
    g.addColorStop(0.65, art.wingTip);
    g.addColorStop(1, art.wingFarTip || art.wingTip);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = art.rim;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 0.4;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawBody(ctx, art, cx, cy) {
  const L = art.bodyLen;
  const H = art.bodyH;
  const tailX = cx - L * 0.5;
  const headX = cx + L * 0.39;
  const headY = cy - H * 0.52;
  const headR = art.headR;
  const beakBaseX = headX + headR * 0.78;
  const backY = cy - H * 0.42;

  // 头、背、腹一笔画成，头部保留一个小颈窝
  const bodyGrad = ctx.createLinearGradient(0, cy - H * 0.7, 0, cy + H * 0.7);
  bodyGrad.addColorStop(0, art.bodyDeep);
  bodyGrad.addColorStop(0.36, art.body);
  bodyGrad.addColorStop(1, art.belly);

  ctx.beginPath();
  ctx.moveTo(beakBaseX, headY - 0.9);
  ctx.bezierCurveTo(
    headX + 2.2,
    headY - headR * 1.12,
    headX - headR * 0.4,
    headY - headR * 1.22,
    headX - headR * 1.05,
    headY - headR * 0.35
  );
  // 颈窝
  ctx.bezierCurveTo(
    headX - headR * 1.65,
    headY + headR * 0.35,
    headX - headR * 2.4,
    backY + 1.8,
    headX - headR * 3.1,
    backY
  );
  // 背线到尾部
  ctx.bezierCurveTo(
    cx,
    backY - 0.5,
    tailX + L * 0.3,
    backY + 0.3,
    tailX,
    cy - 0.7
  );
  // 尾根
  ctx.quadraticCurveTo(tailX - 1.5, cy + 1.2, tailX + 2.5, cy + 1.6);
  // 腹部
  ctx.bezierCurveTo(
    cx - L * 0.1,
    cy + H * 0.6,
    headX - L * 0.3,
    cy + H * 0.9,
    headX - headR * 1.55,
    cy + H * 0.36
  );
  // 胸口与喉部
  ctx.bezierCurveTo(
    headX - headR * 0.55,
    cy + H * 0.28,
    beakBaseX - 0.8,
    headY + 2.1,
    beakBaseX,
    headY + 1.3
  );
  ctx.closePath();
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  ctx.strokeStyle = art.rim;
  ctx.globalAlpha = art.rimAlpha;
  ctx.lineWidth = art.line;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 头顶到背脊的羽色，压住“鱼身”的错觉
  if (art.cap) {
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(
      cx - art.bodyLen * 0.04,
      cy - art.bodyH * 0.78,
      art.bodyLen * 0.56,
      art.bodyH * 0.95,
      0,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = art.cap;
    ctx.fill();
    ctx.restore();
  }

  // 背脊柔光
  ctx.beginPath();
  ctx.moveTo(headX - headR * 0.95, headY - headR * 0.4);
  ctx.bezierCurveTo(
    headX - L * 0.3,
    backY + 0.4,
    tailX + L * 0.34,
    backY + 0.9,
    tailX + 5,
    cy - 0.2
  );
  ctx.strokeStyle = art.rimBright;
  ctx.globalAlpha = art.rimAlpha * 0.6;
  ctx.lineWidth = 0.55;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 胸腹暖光
  ctx.beginPath();
  ctx.moveTo(tailX + L * 0.3, cy + H * 0.22);
  ctx.quadraticCurveTo(
    cx,
    cy + H * 0.63,
    headX - headR * 1.35,
    cy + H * 0.25
  );
  ctx.strokeStyle = art.rimBright;
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 喙
  ctx.beginPath();
  ctx.moveTo(beakBaseX - 0.6, headY - 1.2);
  ctx.quadraticCurveTo(
    beakBaseX + 3.2,
    headY - 0.8,
    beakBaseX + art.beakLen,
    headY + 0.2
  );
  ctx.quadraticCurveTo(
    beakBaseX + 3.0,
    headY + 1.15,
    beakBaseX - 0.6,
    headY + 1.35
  );
  ctx.closePath();
  ctx.fillStyle = art.beak;
  ctx.fill();
  ctx.strokeStyle = art.rim;
  ctx.globalAlpha = 0.32;
  ctx.lineWidth = 0.35;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 眼睛：一点墨，不再画成圆瞪的大眼
  ctx.beginPath();
  ctx.arc(headX + 1.2, headY - 1.05, 0.82, 0, Math.PI * 2);
  ctx.fillStyle = art.eye;
  ctx.fill();

  // 冠羽
  if (art.crest) {
    ctx.strokeStyle = art.rim;
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(headX - 0.4, headY - headR * 0.95);
    ctx.quadraticCurveTo(
      headX - 4,
      headY - headR * 1.7,
      headX - 7.4,
      headY - headR * 1.85
    );
    ctx.moveTo(headX + 1.3, headY - headR * 1.02);
    ctx.quadraticCurveTo(
      headX - 1.6,
      headY - headR * 1.65,
      headX - 4.6,
      headY - headR * 1.9
    );
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawSelfDrawnBird(ctx, w, h, key, frame) {
  const art = BIRD_ART[key];
  const cx = w / 2;
  const cy = h / 2 + 3;
  const phase = (frame / FLAP_FRAMES) * Math.PI * 2;
  const alpha = Math.sin(phase) * art.flapMax + art.flapBias;

  ctx.clearRect(0, 0, w, h);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (art.aura) {
    const aura = ctx.createRadialGradient(cx, cy, 2, cx, cy, art.wingLen * 1.25);
    aura.addColorStop(0, art.aura);
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, w, h);
  }

  const shoulderX = cx - art.bodyLen * 0.02;
  const shoulderY = cy - art.bodyH * 0.48;

  // 远翼在身体后，近翼压在身体前
  drawWingSide(ctx, art, shoulderX - 1.6, shoulderY - 1.2, alpha - 0.08, true);
  drawTail(ctx, art, cx, cy);
  drawBody(ctx, art, cx, cy);
  drawWingSide(ctx, art, shoulderX, shoulderY, alpha, false);

  // 肩部收羽，压住翼根
  ctx.strokeStyle = art.rim;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(shoulderX - 2, shoulderY + 1.6);
  ctx.quadraticCurveTo(shoulderX - 8, shoulderY + 4.4, shoulderX - 12, shoulderY + 3.2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function makeFourPointStar(scene, key, size) {
  canvasTexture(scene, key, 64, 64, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;

    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 1.15);
    glow.addColorStop(0, 'rgba(255,255,255,0.5)');
    glow.addColorStop(0.45, 'rgba(255,255,255,0.1)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.beginPath();
    ctx.moveTo(cx, cy - size);
    ctx.quadraticCurveTo(cx + size * 0.12, cy - size * 0.12, cx + size, cy);
    ctx.quadraticCurveTo(cx + size * 0.12, cy + size * 0.12, cx, cy + size);
    ctx.quadraticCurveTo(cx - size * 0.12, cy + size * 0.12, cx - size, cy);
    ctx.quadraticCurveTo(cx - size * 0.12, cy - size * 0.12, cx, cy - size);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.98)';
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - size * 1.15, cy);
    ctx.lineTo(cx + size * 1.15, cy);
    ctx.moveTo(cx, cy - size * 1.15);
    ctx.lineTo(cx, cy + size * 1.15);
    ctx.stroke();
  });
}

function makeExclamation(scene) {
  canvasTexture(scene, 'icon_exclamation', 64, 64, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;

    const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 28);
    glow.addColorStop(0, 'rgba(255,255,255,0.22)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineCap = 'round';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx, cy + 3);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy + 9, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();
  });
}

function makeGlow(scene) {
  canvasTexture(scene, 'glow', 128, 128, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.18, 'rgba(255,255,255,0.65)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
}

function makeRing(scene) {
  canvasTexture(scene, 'ring', 256, 256, (ctx, w) => {
    const c = w / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 5;
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(c, c, w * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c, c, w * 0.47, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function makeSoundWave(scene) {
  // 一弯向前推进的声波：青色余响裹着金色锋面，尾后带两道更淡的波前
  canvasTexture(scene, 'sound-wave', 120, 72, (ctx, w, h) => {
    const cy = h / 2;
    const topY = 5;
    const bottomY = h - 5;
    const dy = cy - topY;
    const chordX = 58;
    const leadX = 84;

    // 过 (chordX, topY)、(chordX, bottomY) 与 (midX, cy) 的圆弧
    const arcThrough = (midX) => {
      const cx =
        (midX * midX - chordX * chordX - dy * dy) / (2 * (midX - chordX));
      const r = midX - cx;
      const edge = Math.atan2(topY - cy, chordX - cx);
      return { cx, r, edge };
    };

    const lead = arcThrough(leadX);
    const trail = arcThrough(75);

    // 拖在身后的声尾
    const tail = [
      { y: 0, alpha: 0.24, w: 1.4, color: '230, 211, 163' },
      { y: -5, alpha: 0.15, w: 1, color: '159, 216, 232' },
      { y: 5, alpha: 0.15, w: 1, color: '159, 216, 232' },
    ];
    tail.forEach((line) => {
      ctx.beginPath();
      ctx.moveTo(54, cy + line.y);
      ctx.quadraticCurveTo(28, cy + line.y * 1.8, 7, cy + line.y * 1.2);
      ctx.strokeStyle = `rgba(${line.color}, ${line.alpha})`;
      ctx.lineWidth = line.w;
      ctx.stroke();
    });

    // 身后两道更淡的波前
    [61, 65].forEach((midX, i) => {
      const echo = arcThrough(midX);
      ctx.beginPath();
      ctx.arc(echo.cx, cy, echo.r, echo.edge, -echo.edge, false);
      ctx.strokeStyle = `rgba(159, 216, 232, ${0.18 - i * 0.06})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // 波身：只在锋面附近明亮，往后迅速化开
    const grad = ctx.createLinearGradient(chordX - 4, 0, leadX + 4, 0);
    grad.addColorStop(0, 'rgba(159, 216, 232, 0.02)');
    grad.addColorStop(0.55, 'rgba(159, 216, 232, 0.16)');
    grad.addColorStop(0.85, 'rgba(230, 211, 163, 0.58)');
    grad.addColorStop(1, 'rgba(255, 248, 224, 0.96)');
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(255, 240, 200, 0.75)';
    ctx.shadowBlur = 11;
    ctx.beginPath();
    ctx.moveTo(chordX, topY);
    ctx.arc(lead.cx, cy, lead.r, lead.edge, -lead.edge, false);
    ctx.arc(trail.cx, cy, trail.r, -trail.edge, trail.edge, true);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // 金色锋面
    ctx.beginPath();
    ctx.arc(lead.cx, cy, lead.r, lead.edge, -lead.edge, false);
    ctx.strokeStyle = 'rgba(255, 250, 235, 0.95)';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // 内侧青色泛音
    ctx.beginPath();
    ctx.arc(lead.cx, cy, lead.r - 3, lead.edge * 0.92, -lead.edge * 0.92, false);
    ctx.strokeStyle = 'rgba(159, 216, 232, 0.62)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // 锋面尖端星芒
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leadX - 6, cy);
    ctx.lineTo(leadX + 4, cy);
    ctx.moveTo(leadX, cy - 7);
    ctx.lineTo(leadX, cy + 7);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.arc(leadX, cy, 2.2, 0, Math.PI * 2);
    ctx.fill();
  });
}

function makeWheat(scene) {
  canvasTexture(scene, 'wheat-grain', 24, 32, (ctx, w, h) => {
    ctx.translate(w / 2, h / 2);
    ctx.strokeStyle = 'rgba(230, 211, 163, 0.9)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.42);
    ctx.lineTo(0, -h * 0.05);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const y = -h * 0.35 + i * h * 0.12;
      ctx.beginPath();
      ctx.moveTo(0, y + h * 0.08);
      ctx.quadraticCurveTo(-w * 0.16, y, -w * 0.24, y - h * 0.06);
      ctx.moveTo(0, y + h * 0.08);
      ctx.quadraticCurveTo(w * 0.16, y, w * 0.24, y - h * 0.06);
      ctx.stroke();
    }
  });
}

function makeVignette(scene) {
  canvasTexture(scene, 'vignette', 512, 512, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, w * 0.3, w / 2, w / 2, w * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.72, 'rgba(0,0,0,0.28)');
    g.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
}

export function createGameTextures(scene) {
  Object.values(BIRD_TYPES).forEach((type) => {
    for (let frame = 0; frame < FLAP_FRAMES; frame++) {
      canvasTexture(scene, `bird_${type.key}_${frame}`, 104, 104, (ctx, w, h) => {
        drawSelfDrawnBird(ctx, w, h, type.key, frame);
      });
    }
  });

  makeFourPointStar(scene, 'star_large', 23);
  makeFourPointStar(scene, 'star_medium', 18);
  makeFourPointStar(scene, 'star_small', 7);
  makeExclamation(scene);

  makeGlow(scene);
  makeRing(scene);
  makeSoundWave(scene);
  makeWheat(scene);
  makeVignette(scene);
}
