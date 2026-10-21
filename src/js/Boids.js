import Phaser from 'phaser';
import { BIRD_TYPES, GAME_W, GAME_H } from './constants.js';

const CELL = 64;
const MIN_X = -280;
const MIN_Y = -340;
const MAX_X = GAME_W + 280;
const MAX_Y = GAME_H + 200;
const COLS = Math.ceil((MAX_X - MIN_X) / CELL);
const ROWS = Math.ceil((MAX_Y - MIN_Y) / CELL);

const PERCEPTION = 60;
const PERCEPTION_2 = PERCEPTION * PERCEPTION;
const SEPARATION = 30;
const SEPARATION_2 = SEPARATION * SEPARATION;
const FRAME_COUNT = 8;

function normalize(x, y) {
  const len = Math.hypot(x, y);
  if (len < 0.0001) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

/**
 * 经典 Reynolds Boids：分离 / 对齐 / 聚合，
 * 叠加目标寻路、受惊逃逸与空间网格邻居查询。
 */
export class Boids {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.ambient = !!options.ambient;
    this.onEat = options.onEat || (() => {});
    this.depth = options.depth || 10;
    this.speedScale = 1;
    this.time = 0;
    this.birds = [];
    this.cells = Array.from({ length: COLS * ROWS }, () => []);
    this._neighbors = [];
    this.trailG = scene.add
      .graphics()
      .setDepth(this.depth - 0.5)
      .setBlendMode(Phaser.BlendModes.ADD);
  }

  _cellIndex(x, y) {
    if (x < MIN_X || x >= MAX_X || y < MIN_Y || y >= MAX_Y) return -1;
    const cx = Math.floor((x - MIN_X) / CELL);
    const cy = Math.floor((y - MIN_Y) / CELL);
    return cy * COLS + cx;
  }

  spawn(typeKey, x, y, vx, vy, options = {}) {
    const type = BIRD_TYPES[typeKey];
    const sprite = this.scene.add.image(x, y, `bird_${typeKey}_0`);
    const scale = type.scale * (0.9 + Math.random() * 0.2);
    sprite.setScale(scale);
    sprite.setDepth(this.depth + y * 0.004);
    const facing = vx >= 0 ? 1 : -1;
    sprite.setFlipX(facing < 0);
    sprite.setRotation(0);

    let glow = null;
    if (typeKey === 'gold') {
      glow = this.scene.add
        .image(x, y, 'glow')
        .setScale(0.42)
        .setTint(0xe3bf68)
        .setAlpha(0.3)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(this.depth - 0.2);
    }

    const bird = {
      type: typeKey,
      x,
      y,
      vx,
      vy,
      facing,
      sprite,
      glow,
      alive: true,
      state: this.ambient ? 'ambient' : 'raid',
      age: 0,
      phase: Math.random(),
      frame: 0,
      delay: options.delay !== undefined ? options.delay : 0.8 + Math.random() * 1.6,
      tx: options.tx !== undefined ? options.tx : 160 + Math.random() * (GAME_W - 320),
      ty: options.ty !== undefined ? options.ty : 770 + Math.random() * 90,
      eatT: 0,
      panicT: 0,
      panicX: 0,
      panicY: 0,
      anchorX: x + (Math.random() - 0.5) * 220,
      anchorY: y + (Math.random() - 0.5) * 140,
      wanderR: 120 + Math.random() * 260,
    };

    this.birds.push(bird);
    return bird;
  }

  /** 菜单 / 结算页的纯观赏鸟群 */
  spawnAmbient(count = 70) {
    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      const type = roll > 0.94 ? 'gold' : roll > 0.78 ? 'crow' : 'sparrow';
      const x = 120 + Math.random() * (GAME_W - 240);
      const y = 140 + Math.random() * 380;
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 60;
      this.spawn(type, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed);
    }
  }

  /** 一波从画面外俯冲入场的鸟群 */
  spawnWave(wave, elapsed, speedScale = 1) {
    this.speedScale = speedScale;
    if (this.birds.length > 230) return;

    const count = Math.min(20, 10 + Math.floor(wave * 1.0));
    const side = Math.floor(Math.random() * 3);
    let cx;
    let cy;
    let baseVx;
    let baseVy;

    if (side === 0) {
      cx = -110;
      cy = 160 + Math.random() * 320;
      baseVx = 82 + Math.random() * 34;
      baseVy = (Math.random() - 0.5) * 30;
    } else if (side === 1) {
      cx = GAME_W + 110;
      cy = 140 + Math.random() * 320;
      baseVx = -(82 + Math.random() * 34);
      baseVy = (Math.random() - 0.5) * 30;
    } else {
      cx = 260 + Math.random() * (GAME_W - 520);
      cy = -110;
      baseVx = (Math.random() - 0.5) * 50;
      baseVy = 80 + Math.random() * 36;
    }

    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      let type = 'sparrow';
      if (elapsed > 34 && roll < 0.06) type = 'gold';
      else if (elapsed > 17 && roll < 0.34) type = 'crow';

      const x = cx + (Math.random() - 0.5) * 190;
      const y = cy + (Math.random() - 0.5) * 100;
      const vx = baseVx + (Math.random() - 0.5) * 34;
      const vy = baseVy + (Math.random() - 0.5) * 26;
      this.spawn(type, x, y, vx, vy, {
        delay: 1.0 + Math.random() * 2.2,
        tx: 150 + Math.random() * (GAME_W - 300),
        ty: 765 + Math.random() * 95,
      });
    }
  }

  _gather(bird) {
    const out = this._neighbors;
    out.length = 0;
    const cx = Math.floor((bird.x - MIN_X) / CELL);
    const cy = Math.floor((bird.y - MIN_Y) / CELL);
    for (let gy = cy - 1; gy <= cy + 1; gy++) {
      if (gy < 0 || gy >= ROWS) continue;
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        if (gx < 0 || gx >= COLS) continue;
        const cell = this.cells[gy * COLS + gx];
        for (let i = 0; i < cell.length; i++) {
          const other = cell[i];
          if (other === bird) continue;
          out.push(other);
          if (out.length >= 28) return out;
        }
      }
    }
    return out;
  }

  update(dt, time) {
    this.time = time;
    const birds = this.birds;

    for (let i = 0; i < this.cells.length; i++) this.cells[i].length = 0;
    for (let i = 0; i < birds.length; i++) {
      const b = birds[i];
      if (!b.alive) continue;
      const idx = this._cellIndex(b.x, b.y);
      if (idx >= 0) this.cells[idx].push(b);
    }

    for (let i = 0; i < birds.length; i++) {
      const b = birds[i];
      if (!b.alive) continue;
      this._updateBird(b, dt, time);
    }

    // 精灵同步、尾迹 + 清理
    const trail = this.trailG;
    trail.clear();

    for (let i = birds.length - 1; i >= 0; i--) {
      const b = birds[i];
      if (!b.alive) {
        b.sprite.destroy();
        if (b.glow) b.glow.destroy();
        birds.splice(i, 1);
        continue;
      }

      const speed = Math.hypot(b.vx, b.vy);

      // 侧视飞鸟：水平朝向 + 随升降轻微俯仰，翅膀在纹理内上下扇动
      if (Math.abs(b.vx) > 5) b.facing = b.vx >= 0 ? 1 : -1;
      const pitch = Math.max(-0.18, Math.min(0.18, b.vy * 0.0014));
      b.sprite.setFlipX(b.facing < 0);
      b.sprite.setRotation(pitch * (b.facing < 0 ? -1 : 1));

      const type = BIRD_TYPES[b.type];
      const flap = b.state === 'panic' ? type.flap * 1.4 : b.state === 'eat' ? 1.6 : type.flap;
      const frame = Math.floor(time * flap + b.phase * 6) % FRAME_COUNT;
      if (frame !== b.frame) {
        b.frame = frame;
        b.sprite.setTexture(`bird_${b.type}_${frame}`);
      }

      if (b.state !== 'eat' && speed > 8) {
        const len = Math.min(24, 4 + speed * 0.09);
        const nx = b.vx / speed;
        const ny = b.vy / speed;
        const alpha = (b.state === 'panic' ? 0.55 : 0.34) * Math.min(1, speed / 90);
        trail.lineStyle(1.15, type.trail || 0xe6d3a3, alpha);
        trail.lineBetween(b.x - nx * len, b.y - ny * len, b.x, b.y);
      }

      b.sprite.setPosition(b.x, b.y);
      b.sprite.setDepth(this.depth + b.y * 0.004);
      if (b.glow) {
        b.glow.setPosition(b.x, b.y);
        b.glow.setAlpha(0.16 + Math.sin(time * 4 + b.phase * 9) * 0.06);
      }
    }
  }

  _updateBird(b, dt, time) {
    const type = BIRD_TYPES[b.type];
    b.age += dt;

    // ---- 状态切换 ----
    if (!this.ambient) {
      if (b.state === 'raid') {
        const dx = b.tx - b.x;
        const dy = b.ty - b.y;
        if (b.age > 2.2 && dx * dx + dy * dy < 34 * 34) {
          b.state = 'eat';
          b.eatT = 1.0 + Math.random() * 0.55;
          b.vx *= 0.25;
          b.vy *= 0.25;
        }
      } else if (b.state === 'eat') {
        b.eatT -= dt;
        if (b.eatT <= 0) {
          b.state = 'leave';
          this.onEat(b, type);
        }
      } else if (b.state === 'panic') {
        b.panicT -= dt;
        if (b.panicT <= 0) b.state = 'leave';
      }
    }

    if (b.state === 'leave') {
      if (b.y < -150 || b.x < -320 || b.x > GAME_W + 320) {
        b.alive = false;
        return;
      }
    } else if (b.state === 'panic') {
      if (b.y < -320 || b.y > GAME_H + 260 || b.x < -340 || b.x > GAME_W + 340) {
        b.alive = false;
        return;
      }
    }

    // ---- 邻居 ----
    const neighbors = this._gather(b);
    let sepX = 0;
    let sepY = 0;
    let aliX = 0;
    let aliY = 0;
    let cohX = 0;
    let cohY = 0;
    let n = 0;

    for (let i = 0; i < neighbors.length; i++) {
      const o = neighbors[i];
      const dx = b.x - o.x;
      const dy = b.y - o.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 0.01) continue;
      if (d2 < SEPARATION_2) {
        const w = 1 / Math.max(10, d2);
        sepX += dx * w;
        sepY += dy * w;
      }
      if (d2 < PERCEPTION_2 && n < 20) {
        aliX += o.vx;
        aliY += o.vy;
        cohX += o.x;
        cohY += o.y;
        n++;
      }
    }

    const panic = b.state === 'panic';
    const maxSpeed =
      type.speed * this.speedScale * (panic ? 1.95 : b.state === 'leave' ? 1.15 : 1);
    let fx = 0;
    let fy = 0;

    if (n > 0) {
      const aliWeight = this.ambient ? 0.5 : 0.55;
      const cohWeight = this.ambient ? 0.28 : 0.45;

      const ali = normalize(aliX / n, aliY / n);
      fx += (ali.x * maxSpeed - b.vx) * aliWeight;
      fy += (ali.y * maxSpeed - b.vy) * aliWeight;

      const coh = normalize(cohX / n - b.x, cohY / n - b.y);
      fx += (coh.x * maxSpeed - b.vx) * cohWeight;
      fy += (coh.y * maxSpeed - b.vy) * cohWeight;
    }

    const sep = normalize(sepX, sepY);
    if (sep.x !== 0 || sep.y !== 0) {
      const sepWeight = panic ? 1.2 : 1.45;
      fx += (sep.x * maxSpeed - b.vx) * sepWeight;
      fy += (sep.y * maxSpeed - b.vy) * sepWeight;
    }

    // ---- 目标行为 ----
    if (b.state === 'eat') {
      // 啄食：几乎停住，只做轻微起伏
      b.vx *= Math.pow(0.01, dt);
      b.vy *= Math.pow(0.01, dt);
      b.vx += Math.sin(time * 3 + b.phase * 8) * 4 * dt;
      b.vy += Math.cos(time * 2.4 + b.phase * 5) * 3 * dt;
    } else {
      let targetX;
      let targetY;
      let weight = 0.95;

      if (this.ambient) {
        targetX = b.anchorX + Math.cos(time * 0.2 + b.phase * 6.2) * b.wanderR;
        targetY = b.anchorY + Math.sin(time * 0.16 + b.phase * 5.1) * b.wanderR * 0.52;
        weight = 0.38;
      } else if (b.state === 'panic') {
        let dx = b.x - b.panicX;
        let dy = b.y - b.panicY;
        if (dx * dx + dy * dy < 4) {
          dx = Math.random() - 0.5;
          dy = -1;
        }
        const flee = normalize(dx, dy - 70);
        targetX = b.x + flee.x * 260;
        targetY = b.y + flee.y * 260;
        weight = 2.3;
      } else if (b.state === 'leave') {
        targetX = b.x + (b.phase - 0.5) * 90;
        targetY = -220;
        weight = 1.15;
      } else if (b.age < b.delay) {
        // 入场时先盘桓，再俯冲
        targetX = b.x + Math.cos(time * 0.9 + b.phase * 6.4) * 150;
        targetY = b.y + Math.sin(time * 0.74 + b.phase * 5.3) * 78;
        weight = 0.42;
      } else {
        targetX = b.tx;
        targetY = b.ty;
        weight = 0.85;
      }

      const seek = normalize(targetX - b.x, targetY - b.y);
      fx += (seek.x * maxSpeed - b.vx) * weight;
      fy += (seek.y * maxSpeed - b.vy) * weight;
    }

    // ---- 环境扰动 ----
    fx += Math.sin(time * 0.8 + b.phase * 7.7) * 4;
    fy += Math.cos(time * 1.1 + b.phase * 5.9) * 3;

    // 边界：非逃逸状态下柔和回避
    if (b.state !== 'panic' && b.state !== 'leave') {
      const margin = 70;
      if (b.x < margin) fx += (margin - b.x) * 2.4;
      if (b.x > GAME_W - margin) fx -= (b.x - (GAME_W - margin)) * 2.4;
      if (b.y < 70) fy += (70 - b.y) * 1.6;
      if (this.ambient) {
        if (b.y > 610) fy -= (b.y - 610) * 2.0;
      }
    }

    // 限制转向力：收紧一些，飞得更顺
    const forceLen = Math.hypot(fx, fy);
    const maxForce = type.speed * (panic ? 2.8 : 1.7);
    if (forceLen > maxForce) {
      fx = (fx / forceLen) * maxForce;
      fy = (fy / forceLen) * maxForce;
    }

    b.vx += fx * dt;
    b.vy += fy * dt;

    // 速度约束
    let speed = Math.hypot(b.vx, b.vy);
    if (speed > maxSpeed) {
      b.vx = (b.vx / speed) * maxSpeed;
      b.vy = (b.vy / speed) * maxSpeed;
      speed = maxSpeed;
    }
    const minSpeed = panic ? 90 : 36;
    if (b.state !== 'eat' && speed < minSpeed) {
      if (speed < 0.001) {
        const a = Math.random() * Math.PI * 2;
        b.vx = Math.cos(a) * minSpeed;
        b.vy = Math.sin(a) * minSpeed;
      } else {
        b.vx = (b.vx / speed) * minSpeed;
        b.vy = (b.vy / speed) * minSpeed;
      }
    }

    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }

  /** 惊弓：返回本次被惊起的鸟（用于计分与音效） */
  scare(x, y, radius) {
    const scared = [];
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      if (!b.alive || b.state === 'panic' || b.state === 'leave') continue;
      const type = BIRD_TYPES[b.type];
      const reach = radius * type.resistance;
      const dx = b.x - x;
      const dy = b.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist > reach) continue;

      let nx = dx;
      let ny = dy;
      if (dist < 0.5) {
        nx = Math.random() - 0.5;
        ny = -1;
      }
      const dir = normalize(nx, ny - reach * 0.18);
      const falloff = 1 - dist / Math.max(reach, 1);
      const power = (190 + 210 * falloff) * (0.8 + Math.random() * 0.45);

      b.state = 'panic';
      b.panicT = 2.4 + Math.random() * 1.7;
      b.panicX = x;
      b.panicY = y;
      b.vx += dir.x * power;
      b.vy += dir.y * power;

      // 程序化感叹号：给受惊飞鸟一个短促的漫画式提示
      if (
        scared.length < 10 &&
        !this.ambient &&
        this.scene.textures.exists('icon_exclamation')
      ) {
        const mark = this.scene.add
          .image(b.x + 11, b.y - 18, 'icon_exclamation')
          .setTint(0xffe0a0)
          .setScale(0.26)
          .setAlpha(0.98)
          .setDepth(this.depth + 8);
        this.scene.tweens.add({
          targets: mark,
          y: mark.y - 15,
          scale: 0.36,
          alpha: 0,
          duration: 560,
          ease: 'Cubic.easeOut',
          onComplete: () => mark.destroy(),
        });
      }

      scared.push(b);
    }
    return scared;
  }

  count() {
    return this.birds.length;
  }

  destroy() {
    for (const b of this.birds) {
      b.sprite.destroy();
      if (b.glow) b.glow.destroy();
    }
    this.birds.length = 0;
    if (this.trailG) {
      this.trailG.destroy();
      this.trailG = null;
    }
  }
}
