// 連線判定
// 6×6 棋盤，index = row * 6 + col
// 規則 ⑤：只算 2 條主對角線（左上→右下、右上→左下）

import { BOARD_SIZE } from './tiles.js';

// 預先生成 14 條可能線：6 橫 + 6 直 + 2 對角
function buildLines() {
  const lines = [];

  // 6 條橫
  for (let r = 0; r < BOARD_SIZE; r++) {
    lines.push({
      type: 'row',
      index: r,
      cells: Array.from({ length: BOARD_SIZE }, (_, c) => r * BOARD_SIZE + c),
    });
  }

  // 6 條直
  for (let c = 0; c < BOARD_SIZE; c++) {
    lines.push({
      type: 'col',
      index: c,
      cells: Array.from({ length: BOARD_SIZE }, (_, r) => r * BOARD_SIZE + c),
    });
  }

  // 主對角（左上→右下）：(0,0) (1,1) (2,2) ... → indices 0, 7, 14, 21, 28, 35
  lines.push({
    type: 'diag',
    index: 0,
    cells: Array.from({ length: BOARD_SIZE }, (_, i) => i * BOARD_SIZE + i),
  });

  // 反對角（右上→左下）：(0,5) (1,4) ... → indices 5, 10, 15, 20, 25, 30
  lines.push({
    type: 'diag',
    index: 1,
    cells: Array.from({ length: BOARD_SIZE }, (_, i) => i * BOARD_SIZE + (BOARD_SIZE - 1 - i)),
  });

  return lines;
}

export const ALL_LINES = buildLines();

// 偵測目前所有已完成的線
export function detectCompletedLines(bingoRevealed) {
  return ALL_LINES.filter((line) => line.cells.every((i) => bingoRevealed[i]));
}

// 兩條線是否相同（用 type + index 判斷）
export function isSameLine(a, b) {
  return a.type === b.type && a.index === b.index;
}

// 找出「這次新完成的線」（用來觸發即時發光）
export function findNewLines(prevLines, currentLines) {
  return currentLines.filter(
    (cur) => !prevLines.some((prev) => isSameLine(prev, cur))
  );
}
