export const GAME_W = 1440;
export const GAME_H = 900;

export const FIELD_Y = 748;
export const BOW_X = 720;
export const BOW_Y = 842;

export const ROUND_SECONDS = 90;
export const GRAIN_MAX = 120;

/** 弦囊容量与聚音间隔（秒） */
export const QUIVER_MAX = 6;
export const QUIVER_REFILL = 0.45;

export const FONT_TITLE =
  '"Songti TC", "Songti SC", "STSong", "SimSun", "Noto Serif TC", "Noto Serif SC", serif';
export const FONT_KAI =
  '"Kaiti TC", "Kaiti SC", "STKaiti", "KaiTi", "STFangsong", "FangSong", "Songti TC", "Songti SC", serif';
export const FONT_SEAL = '"LXGW Seal", "Kaiti TC", "Kaiti SC", "STKaiti", serif';
// 界面默认使用楷体，标题与数字使用宋体
export const FONT_UI = FONT_KAI;

/** 十六进制色值（Phaser / Graphics） */
export const C = {
  ink: 0x05070c,
  inkSoft: 0x0a1018,
  inkPanel: 0x070b11,
  paper: 0xece3d0,
  paperDim: 0xb8ad97,
  gold: 0xc5a059,
  goldLight: 0xe6d3a3,
  goldDeep: 0x7c6435,
  red: 0xc8503c,
  redLight: 0xeb7a5f,
  mist: 0x8fa5b5,
  wheat: 0xa8894c,
};

/** CSS 色值（Text 样式） */
export const S = {
  ink: '#05070c',
  paper: '#ece3d0',
  paperDim: '#b8ad97',
  gold: '#c5a059',
  goldLight: '#e6d3a3',
  goldDeep: '#7c6435',
  dim: '#807a6d',
  red: '#d9634d',
};

export const BIRD_TYPES = {
  sparrow: {
    key: 'sparrow',
    label: '麻雀',
    points: 1,
    speed: 116,
    scale: 0.42,
    resistance: 1.0,
    grain: 2,
    flap: 10,
    body: '#151d26',
    rim: '#b59c6e',
    trail: 0xe8dcc0,
  },
  crow: {
    key: 'crow',
    label: '烏鴉',
    points: 2,
    speed: 140,
    scale: 0.52,
    resistance: 0.9,
    grain: 3,
    flap: 8,
    body: '#0c0f15',
    rim: '#94a8bd',
    trail: 0x8fb4d8,
  },
  gold: {
    key: 'gold',
    label: '金羽',
    points: 5,
    speed: 168,
    scale: 0.42,
    resistance: 0.74,
    grain: 1,
    flap: 12,
    body: '#e3bf68',
    rim: '#fff2c8',
    trail: 0xe8c46a,
  },
};

const RANKS = [
  { min: 0, name: '初聞絃音', note: '絃聲初起，群鳥未驚。' },
  { min: 120, name: '絃上清風', note: '手起絃落，已有幾分準頭。' },
  { min: 320, name: '一弦驚群', note: '一絃既發，四野皆驚。' },
  { min: 620, name: '驚弓之鳥', note: '不待弦落，聞聲即散。' },
  { min: 1000, name: '百步穿楊', note: '絃無虛發，鳥不敢落。' },
  { min: 1600, name: '射日神手', note: '此絃一出，長空為之一空。' },
];

export function rankFor(score) {
  let rank = RANKS[0];
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (score >= RANKS[i].min) {
      rank = RANKS[i];
      index = i;
    }
  }
  const next = RANKS[index + 1] || null;
  return { ...rank, index, next };
}

/** 字号自适应的文字工厂，统一提高清晰度 */
export function makeText(scene, x, y, text, style = {}) {
  const txt = scene.add.text(x, y, text, style);
  txt.setResolution(2);
  return txt;
}
