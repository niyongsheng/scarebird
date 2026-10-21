/**
 * 浏览器全屏。
 * 全屏目标取 documentElement，让手势 HUD 等 DOM 覆盖层与画布一起进入全屏。
 * 画布本身由 Phaser.Scale.RESIZE 跟随窗口尺寸，无需额外处理。
 */

const CHANGE_EVENTS = [
  'fullscreenchange',
  'webkitfullscreenchange',
  'mozfullscreenchange',
  'MSFullscreenChange',
];

function getFullscreenElement() {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement ||
    null
  );
}

function getRequestMethod() {
  const el = document.documentElement;
  return (
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.webkitRequestFullScreen ||
    el.mozRequestFullScreen ||
    el.msRequestFullscreen ||
    null
  );
}

function getExitMethod() {
  return (
    document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.webkitCancelFullScreen ||
    document.mozCancelFullScreen ||
    document.msExitFullscreen ||
    null
  );
}

export function isFullscreenActive() {
  return !!getFullscreenElement();
}

export function isFullscreenSupported() {
  return !!getRequestMethod();
}

async function lockLandscape() {
  // 手机横屏游戏：全屏后尝试锁定横向，桌面端 / iOS 会直接忽略
  const orientation = screen.orientation;
  if (!orientation || typeof orientation.lock !== 'function') return;
  try {
    await orientation.lock('landscape');
  } catch {
    /* 不支持或未获得全屏权限时静默放弃 */
  }
}

/** 进入 / 退出全屏，返回切换后是否处于全屏 */
export async function toggleFullscreen() {
  if (isFullscreenActive()) {
    const exit = getExitMethod();
    if (!exit) return true;
    try {
      await Promise.resolve(exit.call(document));
    } catch (error) {
      console.warn('[Fullscreen] 退出全屏失败', error);
    }
    return isFullscreenActive();
  }

  const request = getRequestMethod();
  if (!request) return false;

  try {
    await Promise.resolve(request.call(document.documentElement));
  } catch (error) {
    console.warn('[Fullscreen] 进入全屏失败', error);
    return false;
  }

  if (isFullscreenActive()) lockLandscape();
  return isFullscreenActive();
}

/**
 * 绑定右上角按钮与 F 快捷键，并同步图标状态。
 * 浏览器不支持（如 iPhone Safari）时隐藏按钮。
 */
export function initFullscreen() {
  const button = document.getElementById('fullscreen-toggle');
  if (!button) return;

  if (!isFullscreenSupported()) {
    button.hidden = true;
    return;
  }
  button.hidden = false;

  const sync = () => {
    const active = isFullscreenActive();
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-label', active ? '退出全屏 (F)' : '进入全屏 (F)');
    button.title = active ? '退出全屏 (F)' : '全屏游玩 (F)';
  };

  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await toggleFullscreen();
    sync();
  });

  for (const name of CHANGE_EVENTS) {
    document.addEventListener(name, sync);
  }
  // Safari 的 webkit 事件偶有滞后，窗口尺寸变化时兜底同步
  window.addEventListener('resize', sync);
  sync();

  window.addEventListener('keydown', (event) => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key !== 'f' && event.key !== 'F') return;

    const target = event.target;
    const tag = target && target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (target && target.isContentEditable)) return;

    event.preventDefault();
    toggleFullscreen().then(sync);
  });
}
