import { GAME_W, GAME_H } from './constants.js';

/** 主场景相机：完整容纳 1440×900 设计稿，底部对齐，HUD/标题永远不被裁切 */
export function fitMainCamera(scene) {
  const cam = scene.cameras.main;
  cam.setBackgroundColor('rgba(0,0,0,0)');

  const layout = () => {
    const w = scene.scale.width;
    const h = scene.scale.height;
    cam.setSize(w, h);
    const scale = Math.min(w / GAME_W, h / GAME_H);
    cam.setZoom(scale);
    const viewH = h / scale;
    cam.centerOn(GAME_W / 2, GAME_H - viewH / 2);
  };

  layout();
  scene.scale.on('resize', layout);
  scene.events.once('shutdown', () => scene.scale.off('resize', layout));
}

/** 背景相机：铺满整个窗口，底部对齐，不出现黑边 */
export function coverBackdropCamera(scene) {
  const cam = scene.cameras.main;

  const layout = () => {
    const w = scene.scale.width;
    const h = scene.scale.height;
    cam.setSize(w, h);
    const scale = Math.max(w / GAME_W, h / GAME_H);
    cam.setZoom(scale);
    const viewH = h / scale;
    cam.centerOn(GAME_W / 2, GAME_H - viewH / 2);
  };

  layout();
  scene.scale.on('resize', layout);
  scene.events.once('shutdown', () => scene.scale.off('resize', layout));
}
