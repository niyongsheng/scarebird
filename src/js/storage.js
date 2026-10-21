const BEST_KEY = 'scarebird.best';
const MUTE_KEY = 'scarebird.muted';

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : raw;
  } catch (e) {
    return fallback;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch (e) {
    /* 隐私模式下忽略 */
  }
}

export function getBest() {
  const n = Number(read(BEST_KEY, 0));
  return Number.isFinite(n) ? n : 0;
}

export function setBest(score) {
  write(BEST_KEY, Math.max(0, Math.round(score)));
}

export function getMuted() {
  return read(MUTE_KEY, '0') === '1';
}

export function setMuted(muted) {
  write(MUTE_KEY, muted ? '1' : '0');
}
