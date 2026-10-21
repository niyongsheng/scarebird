import { GAME_W, GAME_H } from './constants.js';

const CDN_BASES = [
  'https://cdn.jsdelivr.net/npm/',
  'https://unpkg.com/',
];

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function loadScript(src, timeout = 14000) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => {
      script.remove();
      reject(new Error(`load timeout: ${src}`));
    }, timeout);
    script.onload = () => {
      window.clearTimeout(timer);
      resolve();
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      script.remove();
      reject(new Error(`load failed: ${src}`));
    };
    document.head.appendChild(script);
  });
}

/**
 * MediaPipe Hands 封装。
 * 对外的坐标系与游戏画布一致（1440 × 900），并做指数平滑。
 *
 * 手势约定：
 *  - 食指指尖 (8)  -> 瞄准
 *  - 拇指尖 (4) 与食指指尖的距离 -> 拉弓量 draw (0..1)
 */
class GestureController {
  constructor() {
    this.active = false;
    this.enabling = null;
    this.hands = null;
    this.camera = null;
    this.cameraRunning = false;
    this.cdnBase = null;
    this.lastSeenAt = 0;
    this.lastResultAt = 0;
    this.present = false;
    this.rawAimX = GAME_W * 0.5;
    this.rawAimY = 320;
    this.smoothX = GAME_W * 0.5;
    this.smoothY = 320;
    this.draw = 0;
    this.pinch = 1;
    this.statusText = '';
    this.locked = false;
    this.onStatus = null;

    this.hud = document.getElementById('gesture-hud');
    this.video = this.hud ? this.hud.querySelector('.input_video') : null;
    this.canvas = this.hud ? this.hud.querySelector('.hand-overlay') : null;
    this.statusEl = this.hud ? this.hud.querySelector('.gesture-status') : null;

    if (this.canvas) {
      this.canvas.width = 320;
      this.canvas.height = 240;
    }
    this._clearOverlay();
  }

  get available() {
    return this.active;
  }

  async enable() {
    if (this.active) return true;
    if (this.enabling) return this.enabling;

    this.enabling = (async () => {
      try {
        this._setStatus('連接中');
        if (!this.hands) await this._boot();
        this._ensureCamera();
        this.cameraRunning = true;
        await Promise.race([
          this.camera.start(),
          new Promise((_, reject) =>
            window.setTimeout(() => reject(new Error('camera start timeout')), 18000)
          ),
        ]);
        this.active = true;
        this.lastSeenAt = 0;
        this._setStatus('等待手勢');
        return true;
      } catch (error) {
        console.warn('[Gesture] 启动失败：', error);
        this.active = false;
        this.cameraRunning = false;
        try {
          if (this.camera) this.camera.stop();
        } catch (e) {
          /* ignore */
        }
        this._setStatus('攝影機不可用');
        this.setHudVisible(false);
        this._clearOverlay();
        return false;
      } finally {
        this.enabling = null;
      }
    })();

    return this.enabling;
  }

  disable() {
    this.active = false;
    this.cameraRunning = false;
    this.present = false;
    try {
      if (this.camera) this.camera.stop();
    } catch (e) {
      /* ignore */
    }
    this._clearOverlay();
    this.setHudVisible(false);
    this._setStatus('已關閉');
  }

  async _loadMediaPipe() {
    if (window.Hands && window.Camera) {
      this.cdnBase = CDN_BASES[0];
      return;
    }

    let lastError = null;
    for (const base of CDN_BASES) {
      try {
        await loadScript(`${base}@mediapipe/hands/hands.js`);
        await loadScript(`${base}@mediapipe/camera_utils/camera_utils.js`);
        if (window.Hands && window.Camera) {
          this.cdnBase = base;
          return;
        }
        lastError = new Error('MediaPipe globals missing');
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('MediaPipe 載入失敗');
  }

  async _boot() {
    await this._loadMediaPipe();

    this.hands = new window.Hands({
      locateFile: (file) => `${this.cdnBase}@mediapipe/hands/${file}`,
    });
    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.62,
      minTrackingConfidence: 0.58,
    });
    this.hands.onResults((results) => this._onResults(results));
  }

  _ensureCamera() {
    if (this.camera) return;
    this.camera = new window.Camera(this.video, {
      onFrame: async () => {
        if (!this.cameraRunning || !this.hands) return;
        try {
          await this.hands.send({ image: this.video });
        } catch (e) {
          /* 单帧失败不打断 */
        }
      },
      width: 640,
      height: 480,
    });
  }

  _onResults(results) {
    const now = performance.now();
    this.lastResultAt = now;
    const landmarks =
      results.multiHandLandmarks && results.multiHandLandmarks.length > 0
        ? results.multiHandLandmarks[0]
        : null;

    if (!landmarks) {
      this.present = false;
      this.draw *= 0.75;
      this.pinch = 1;
      this._setLocked(false);
      this._setStatus('等待手勢');
      this._clearOverlay();
      return;
    }

    this.present = true;
    this.lastSeenAt = now;
    this._setLocked(true);
    this._setStatus('已鎖定');

    const index = landmarks[8];
    const thumb = landmarks[4];

    // 镜像 x，让手向右移动时光标也向右
    const mx = 1 - index.x;
    const nx = clamp((mx - 0.1) / 0.8, 0, 1);
    const ny = clamp((index.y - 0.06) / 0.8, 0, 1);
    this.rawAimX = nx * GAME_W;
    this.rawAimY = ny * GAME_H;

    const smooth = 0.42;
    this.smoothX += (this.rawAimX - this.smoothX) * smooth;
    this.smoothY += (this.rawAimY - this.smoothY) * smooth;

    const pinchDist = Math.hypot(thumb.x - index.x, thumb.y - index.y);
    this.pinch += (pinchDist - this.pinch) * 0.5;
    const draw = clamp((pinchDist - 0.04) / 0.22, 0, 1);
    this.draw += (draw - this.draw) * 0.55;

    this._drawSkeleton(landmarks);
  }

  /** 供游戏每帧读取 */
  getState() {
    const fresh = this.active && performance.now() - this.lastSeenAt < 450;
    return {
      available: this.active,
      present: fresh,
      x: this.smoothX,
      y: this.smoothY,
      draw: fresh ? this.draw : 0,
      pinch: this.pinch,
    };
  }

  setHudVisible(visible) {
    if (!this.hud) return;
    this.hud.classList.toggle('is-visible', !!visible);
    this.hud.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  _setStatus(text) {
    if (this.statusText === text) return;
    this.statusText = text;
    if (this.statusEl) this.statusEl.textContent = text;
    if (this.onStatus) this.onStatus(text);
  }

  _setLocked(locked) {
    if (this.locked === locked) return;
    this.locked = locked;
    if (this.hud) this.hud.classList.toggle('is-locked', locked);
  }

  _clearOverlay() {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  _drawSkeleton(landmarks) {
    const canvas = this.canvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const px = (p) => (1 - p.x) * w;
    const py = (p) => p.y * h;

    ctx.lineCap = 'round';

    // 骨架连线
    ctx.strokeStyle = 'rgba(197, 160, 89, 0.52)';
    ctx.lineWidth = 1.4;
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.beginPath();
      ctx.moveTo(px(landmarks[a]), py(landmarks[a]));
      ctx.lineTo(px(landmarks[b]), py(landmarks[b]));
      ctx.stroke();
    }

    // 关节
    for (let i = 0; i < landmarks.length; i++) {
      const isTip = i === 4 || i === 8;
      ctx.beginPath();
      ctx.arc(px(landmarks[i]), py(landmarks[i]), isTip ? 3.4 : 1.8, 0, Math.PI * 2);
      ctx.fillStyle = isTip ? 'rgba(255, 243, 208, 0.95)' : 'rgba(230, 211, 163, 0.55)';
      ctx.fill();
    }

    // 食指瞄准环
    const ix = px(landmarks[8]);
    const iy = py(landmarks[8]);
    ctx.strokeStyle = 'rgba(230, 211, 163, 0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ix, iy, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ix, iy, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 243, 208, 0.9)';
    ctx.fill();

    // 拇指—食指拉弓量
    const tx = px(landmarks[4]);
    const ty = py(landmarks[4]);
    ctx.strokeStyle = `rgba(239, 122, 95, ${0.45 + this.draw * 0.5})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(ix, iy);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

let instance = null;

export function getGestureController() {
  if (!instance) instance = new GestureController();
  return instance;
}
