import { FONT_TITLE, FONT_KAI, FONT_SEAL } from './constants.js';

function snapshot(game) {
  return new Promise((resolve, reject) => {
    try {
      game.renderer.snapshot((image) => {
        if (image && image.width) resolve(image);
        else reject(new Error('snapshot failed'));
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 把结算画面截成一张带页脚的战报图，然后依次尝试：
 * 系统分享 → 复制到剪贴板 → 下载 PNG。
 */
export async function shareResult(scene, stats, rank) {
  const image = await snapshot(scene.game);

  const poster = document.createElement('canvas');
  const W = image.width;
  const baseH = image.height;
  const H = baseH + 110;
  poster.width = W;
  poster.height = H;
  const ctx = poster.getContext('2d');

  ctx.drawImage(image, 0, 0, W, baseH);

  // 页脚
  const footer = ctx.createLinearGradient(0, baseH, 0, H);
  footer.addColorStop(0, '#060a12');
  footer.addColorStop(1, '#03050a');
  ctx.fillStyle = footer;
  ctx.fillRect(0, baseH, W, 110);

  ctx.strokeStyle = 'rgba(197, 160, 89, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(64, baseH + 0.5);
  ctx.lineTo(W - 64, baseH + 0.5);
  ctx.stroke();

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e6d3a3';
  ctx.font = `26px ${FONT_TITLE}`;
  ctx.fillText('驚弓之鳥', 64, baseH + 42);

  ctx.fillStyle = 'rgba(236, 227, 208, 0.55)';
  ctx.font = `12px ${FONT_KAI}`;
  ctx.fillText('S C A R E B I R D   ·   星 野 飛 鳥   ·   手 繪 星 空', 64, baseH + 74);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(236, 227, 208, 0.6)';
  ctx.font = `16px ${FONT_KAI}`;
  ctx.fillText('絃聲一起，群鳥皆驚', W - 170, baseH + 56);

  // 小印
  const sx = W - 118;
  const sy = baseH + 24;
  const sw = 58;
  const sh = 62;
  ctx.fillStyle = '#b8442f';
  ctx.fillRect(sx, sy, sw, sh);
  ctx.strokeStyle = 'rgba(240, 221, 192, 0.8)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(sx + 5, sy + 5, sw - 10, sh - 10);
  ctx.fillStyle = '#f6e8d2';
  ctx.textAlign = 'center';
  ctx.font = `30px ${FONT_SEAL}`;
  ctx.fillText('驚', sx + sw / 2, sy + 30);

  // 弓形符号
  ctx.strokeStyle = '#f3e4cb';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sx + sw / 2 - 5, sy + 50, 8, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx + sw / 2 - 13, sy + 42);
  ctx.lineTo(sx + sw / 2 - 13, sy + 58);
  ctx.moveTo(sx + sw / 2 - 13, sy + 50);
  ctx.lineTo(sx + sw / 2 + 3, sy + 50);
  ctx.stroke();

  const blob = await new Promise((resolve, reject) => {
    poster.toBlob((result) => (result ? resolve(result) : reject(new Error('toBlob failed'))), 'image/png');
  });

  const filename = `scarebird-${stats.score}-${Date.now()}.png`;
  const file = new File([blob], filename, { type: 'image/png' });
  const text = `驚弓之鳥 · ${rank.name}｜${stats.score} 分 · 驚起 ${stats.scared} 隻 · 最高連擊 ×${stats.maxCombo}`;

  // 1. 系统分享（手机 / 支持 Web Share 的浏览器）
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: '驚弓之鳥 · 戰報',
        text,
      });
      return '戰報已分享';
    }
  } catch (error) {
    if (error && error.name === 'AbortError') return '已取消分享';
  }

  // 2. 复制图片到剪贴板
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return '戰報圖已複製';
    }
  } catch (error) {
    /* 继续降级 */
  }

  // 3. 下载
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  return '戰報圖已下載';
}
