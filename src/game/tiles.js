// 36 張獨特的麻將牌
// 不像傳統麻將每張 4 張，這裡每張只用 1 張。

export const CATEGORIES = {
  WAN: 'wan',         // 萬
  TONG: 'tong',       // 筒
  TIAO: 'tiao',       // 條
  WIND: 'wind',       // 風（東南西北）
  DRAGON: 'dragon',   // 字（中發白）
  FLOWER: 'flower',   // 花
};

export const TILES = [
  // 萬 1-9
  { id: 0, label: '一萬', category: CATEGORIES.WAN },
  { id: 1, label: '二萬', category: CATEGORIES.WAN },
  { id: 2, label: '三萬', category: CATEGORIES.WAN },
  { id: 3, label: '四萬', category: CATEGORIES.WAN },
  { id: 4, label: '五萬', category: CATEGORIES.WAN },
  { id: 5, label: '六萬', category: CATEGORIES.WAN },
  { id: 6, label: '七萬', category: CATEGORIES.WAN },
  { id: 7, label: '八萬', category: CATEGORIES.WAN },
  { id: 8, label: '九萬', category: CATEGORIES.WAN },

  // 筒 1-9
  { id: 9,  label: '一筒', category: CATEGORIES.TONG },
  { id: 10, label: '二筒', category: CATEGORIES.TONG },
  { id: 11, label: '三筒', category: CATEGORIES.TONG },
  { id: 12, label: '四筒', category: CATEGORIES.TONG },
  { id: 13, label: '五筒', category: CATEGORIES.TONG },
  { id: 14, label: '六筒', category: CATEGORIES.TONG },
  { id: 15, label: '七筒', category: CATEGORIES.TONG },
  { id: 16, label: '八筒', category: CATEGORIES.TONG },
  { id: 17, label: '九筒', category: CATEGORIES.TONG },

  // 條 1-9
  { id: 18, label: '一條', category: CATEGORIES.TIAO },
  { id: 19, label: '二條', category: CATEGORIES.TIAO },
  { id: 20, label: '三條', category: CATEGORIES.TIAO },
  { id: 21, label: '四條', category: CATEGORIES.TIAO },
  { id: 22, label: '五條', category: CATEGORIES.TIAO },
  { id: 23, label: '六條', category: CATEGORIES.TIAO },
  { id: 24, label: '七條', category: CATEGORIES.TIAO },
  { id: 25, label: '八條', category: CATEGORIES.TIAO },
  { id: 26, label: '九條', category: CATEGORIES.TIAO },

  // 風（東南西北）
  { id: 27, label: '東', category: CATEGORIES.WIND },
  { id: 28, label: '南', category: CATEGORIES.WIND },
  { id: 29, label: '西', category: CATEGORIES.WIND },
  { id: 30, label: '北', category: CATEGORIES.WIND },

  // 字（中發白）
  { id: 31, label: '中', category: CATEGORIES.DRAGON },
  { id: 32, label: '發', category: CATEGORIES.DRAGON },
  { id: 33, label: '白', category: CATEGORIES.DRAGON },

  // 花（美術用哭/笑臉）
  { id: 34, label: '哭', category: CATEGORIES.FLOWER },
  { id: 35, label: '笑', category: CATEGORIES.FLOWER },
];

export const TILE_BY_ID = Object.fromEntries(TILES.map((t) => [t.id, t]));

export const BOARD_SIZE = 6;
export const TOTAL_TILES = BOARD_SIZE * BOARD_SIZE; // 36
