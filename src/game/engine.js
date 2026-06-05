// 遊戲核心狀態機（純函數風格）
// 所有狀態變動回傳新 state，不就地修改

import { TILES, TOTAL_TILES } from './tiles.js';
import { shuffle, humanLikeShuffleTrace } from './shuffle.js';
import { detectCompletedLines, findNewLines } from './bingo.js';

export const FLIP_RESULT = {
  OK: 'OK',
  EMPTY_SLOT: 'EMPTY_SLOT',     // 規則 ③：翻空格
  NO_FLIPS_LEFT: 'NO_FLIPS_LEFT',
};

export const DEFAULT_FLIP_BUDGET = 15;

// 模式：影響 Phase 2 洗牌結構
//   casual = 半運氣（企劃書原本）：6 輪可見 + 隱藏重洗一次
//   memory = 動腦：10 輪全可見，沒有隱藏段
export const GAME_MODES = { CASUAL: 'casual', MEMORY: 'memory' };

// 建立新一局
// rng: 可注入 seeded random（測試用）
export function createGame({
  flipBudget = DEFAULT_FLIP_BUDGET,
  rng = Math.random,
  mode = GAME_MODES.CASUAL,
} = {}) {
  const tileIds = TILES.map((t) => t.id);

  // 規則 ①：每局隨機到不同位置
  const bingoTarget = shuffle(tileIds, rng);

  const isMemory = mode === GAME_MODES.MEMORY;
  // 動腦模式 10 輪（補回沒有隱藏段的隨機度）
  const rounds = isMemory ? 10 : 6;

  const visible = humanLikeShuffleTrace(
    bingoTarget,
    rng,
    { rounds, pairsPerRound: 1 }
  );
  // 半運氣再做隱藏段重洗；動腦直接用可見段最終結果（玩家追到哪就是哪）
  const shuffleArea = isMemory
    ? visible.finalArray
    : shuffle(visible.finalArray, rng);

  return {
    bingoTarget,
    shuffleArea,                  // Phase 2 結束 / Phase 3 起始狀態
    bingoRevealed: Array(TOTAL_TILES).fill(false),
    flipsRemaining: flipBudget,
    completedLines: [],
    shuffleSteps: visible.steps,  // 可見段 snapshots
    mode,                         // 給 App.jsx 知道要不要播隱藏段
  };
}

// 翻一張洗牌區的牌
// 回傳 { state, result, flippedTile, targetIndex, newLines }
export function flipTile(state, shuffleIndex) {
  // 規則 ④：成功才扣次數 — 先擋無效情境，狀態不變

  if (state.flipsRemaining <= 0) {
    return { state, result: FLIP_RESULT.NO_FLIPS_LEFT };
  }

  const tile = state.shuffleArea[shuffleIndex];

  // 規則 ③：不能翻空格
  if (tile === null || tile === undefined) {
    return { state, result: FLIP_RESULT.EMPTY_SLOT };
  }

  // 找該牌在 Bingo 區的目標位置
  const targetIndex = state.bingoTarget.indexOf(tile);

  // 更新狀態（不就地修改）
  const newShuffleArea = state.shuffleArea.slice();
  newShuffleArea[shuffleIndex] = null;

  const newRevealed = state.bingoRevealed.slice();
  newRevealed[targetIndex] = true;

  // 規則 ②：偵測新完成的線（讓 UI 立刻發光）
  const currentLines = detectCompletedLines(newRevealed);
  const newLines = findNewLines(state.completedLines, currentLines);

  const newState = {
    ...state,
    shuffleArea: newShuffleArea,
    bingoRevealed: newRevealed,
    flipsRemaining: state.flipsRemaining - 1,
    completedLines: currentLines,
  };

  return {
    state: newState,
    result: FLIP_RESULT.OK,
    flippedTile: tile,
    targetIndex,
    newLines,
  };
}

// 遊戲是否結束
export function isGameOver(state) {
  return state.flipsRemaining <= 0;
}

// 評價（cap 在 3 條）
export const RANKS = ['摃龜', '小贏', '老手', '傳說'];

export function getRank(state) {
  const lines = Math.min(state.completedLines.length, 3);
  return { lines, label: RANKS[lines] };
}
