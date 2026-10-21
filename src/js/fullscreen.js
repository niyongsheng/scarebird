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

function isIOS() {
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** 从主画面启动（已添加到主屏幕）时本身就是全屏，无需再请求 */
function isStandaloneDisplay() {
  const standalone =
    window.matchMedia &&
    window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
  return standalone || window.navigator.standalone === true;
}

let hintTimer = 0;

function hideHint() {
  const hint = document.getElementById('fullscreen-hint');
  if (hint) hint.hidden = true;
}

function showUnsupportedHint() {
  const hint = document.getElementById('fullscreen-hint');
  if (!hint) return;
  hint.textContent = isIOS()
    ? 'iPhone 的瀏覽器不支援網頁全屏：請點 Safari 的「分享」→「加入主畫面」，從主畫面啟動即可全屏遊玩。'
    : '目前瀏覽器不支援全屏：請改用系統瀏覽器（Chrome / Safari）開啟，或將遊戲加入主畫面。';
  hint.hidden = false;
  window.clearTimeout(hintTimer);
  hintTimer = window.setTimeout(hideHint, 8000);
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
 * 不支持 Fullscreen API 的浏览器（如 iPhone Safari）仍保留按钮，
 * 点击时引导「加入主画面」；从主画面启动时本身就是全屏。
 */
export function initFullscreen() {
  const button = document.getElementById('fullscreen-toggle');
  if (!button) return;

  const hint = document.getElementById('fullscreen-hint');
  hint?.addEventListener('click', hideHint);

  if (isStandaloneDisplay()) {
    button.hidden = true;
    return;
  }

  const supported = isFullscreenSupported();
  button.hidden = false;
  if (!supported) {
    button.setAttribute('aria-label', '全屏說明');
    button.title = '此瀏覽器不支援全屏，點擊查看說明';
  }

  const sync = () => {
    const active = isFullscreenActive();
    button.classList.toggle('is-active', active);
    if (supported) {
      button.setAttribute('aria-label', active ? '退出全屏 (F)' : '進入全屏 (F)');
      button.title = active ? '退出全屏 (F)' : '全屏遊玩 (F)';
    }
  };

  const requestToggle = async () => {
    const wasActive = isFullscreenActive();
    const active = await toggleFullscreen();
    sync();
    if (!wasActive && !active) showUnsupportedHint();
  };

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    requestToggle();
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
    requestToggle();
  });
}
