// 美術素材集中對應
// 用 import.meta.glob 批次載入（支援中文路徑），再用檔名挑出對應 URL
const BASE = './assets/小巴の數位互動設計';

function pick(globObj, filename) {
  const key = Object.keys(globObj).find((k) => k.endsWith('/' + filename));
  if (!key) console.warn('[assets] 找不到', filename, '於', Object.keys(globObj));
  return key ? globObj[key] : undefined;
}

/* ===== 牌面 ===== */
const wanG = import.meta.glob('./assets/小巴の數位互動設計/牌面/Wan/*.png', { eager: true, import: 'default' });
const tonG = import.meta.glob('./assets/小巴の數位互動設計/牌面/Ton/*.png', { eager: true, import: 'default' });
const soG  = import.meta.glob('./assets/小巴の數位互動設計/牌面/So/*.png', { eager: true, import: 'default' });
const bigG = import.meta.glob('./assets/小巴の數位互動設計/牌面/大字/*.png', { eager: true, import: 'default' });
const backG = import.meta.glob('./assets/小巴の數位互動設計/牌面/背*.png', { eager: true, import: 'default' });

// tile id → 圖片 URL（對應 src/game/tiles.js 的 id 順序）
export const TILE_IMAGES = {
  // 萬 1-9
  0: pick(wanG, '1w.png'), 1: pick(wanG, '2w.png'), 2: pick(wanG, '3w.png'),
  3: pick(wanG, '4w.png'), 4: pick(wanG, '5w.png'), 5: pick(wanG, '6w.png'),
  6: pick(wanG, '7w.png'), 7: pick(wanG, '8w.png'), 8: pick(wanG, '9w.png'),
  // 筒 1-9
  9: pick(tonG, '1t.png'), 10: pick(tonG, '2t.png'), 11: pick(tonG, '3t.png'),
  12: pick(tonG, '4t.png'), 13: pick(tonG, '5t.png'), 14: pick(tonG, '6t.png'),
  15: pick(tonG, '7t.png'), 16: pick(tonG, '8t.png'), 17: pick(tonG, '9t.png'),
  // 條 1-9
  18: pick(soG, '1s.png'), 19: pick(soG, '2s.png'), 20: pick(soG, '3s.png'),
  21: pick(soG, '4s.png'), 22: pick(soG, '5s.png'), 23: pick(soG, '6s.png'),
  24: pick(soG, '7s.png'), 25: pick(soG, '8s.png'), 26: pick(soG, '9s.png'),
  // 風 東南西北
  27: pick(bigG, 'E.png'), 28: pick(bigG, 'S.png'), 29: pick(bigG, 'W.png'), 30: pick(bigG, 'N.png'),
  // 字 中發白
  31: pick(bigG, '中.png'), 32: pick(bigG, '發.png'), 33: pick(bigG, '白.png'),
  // 花（哭/笑）
  34: pick(bigG, 'Cry.png'), 35: pick(bigG, 'Smile.png'),
};

export const TILE_BACK = pick(backG, '背.png');

/* ===== Logo / 老闆 / 按鈕 / 物件 ===== */
const rootG = import.meta.glob('./assets/小巴の數位互動設計/*.png', { eager: true, import: 'default' });
export const LOGO = pick(rootG, 'logo.png');
export const OWNER = {
  idle: pick(rootG, '老闆_默認.png'),
  think: pick(rootG, '老闆_思考.png'),
  happy: pick(rootG, '老闆_讚啦.png'),
};
export const BTN_START = pick(rootG, '開始.png');
export const BTN_START_HOVER = pick(rootG, '開始_選取.png');
export const BTN_GALLERY = pick(rootG, '物品.png');
export const BTN_GALLERY_HOVER = pick(rootG, '物品_選取.png');
export const BTN_TUTORIAL = pick(rootG, '教學.png');
export const BTN_TUTORIAL_HOVER = pick(rootG, '教學_選取.png');
export const SHELF = pick(rootG, '鐵架.png');

/* ===== 娃娃 1-10 ===== */
const dollG = import.meta.glob('./assets/小巴の數位互動設計/娃/*.png', { eager: true, import: 'default' });
export const DOLL_IMAGES = {};
for (let i = 1; i <= 10; i++) DOLL_IMAGES[i] = pick(dollG, `${i}.png`);

/* ===== 背景 ===== */
const bgG = import.meta.glob('./assets/小巴の數位互動設計/桌布&背景/*', { eager: true, import: 'default' });
export const BG_MAIN = pick(bgG, 'G-01.webp');
export const BG_FELT = pick(bgG, 'G-02.png');

/* ===== 音效 ===== */
const sfxG = import.meta.glob('./assets/小巴の數位互動設計/音/*.mp3', { eager: true, import: 'default' });
export const SFX = {
  bgm: pick(sfxG, 'BGM.mp3'),
  click: pick(sfxG, 'Effect-Click.mp3'),
  lose: pick(sfxG, 'Effect-Lose.mp3'),
  victory: pick(sfxG, 'Effect-Victory.mp3'),
};

/* ===== 老闆語音 ===== */
const tutG = import.meta.glob('./assets/小巴の數位互動設計/音/Tutorial/*.wav', { eager: true, import: 'default' });
// 教學 8 段語音（對應 OPENING_LINES）
export const TUTORIAL_VOICES = Array.from({ length: 8 }, (_, i) =>
  pick(tutG, `Tutorial_0${i + 1}.wav`)
);
const vlG = import.meta.glob('./assets/小巴の數位互動設計/音/Victory-Lose/*.wav', { eager: true, import: 'default' });
export const VOICE = {
  lose: pick(vlG, 'Lose.wav'),
  victory1: pick(vlG, 'Victory_01.wav'),
  victory2: pick(vlG, 'Victory_02.wav'),
};
