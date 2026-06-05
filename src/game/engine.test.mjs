// 簡易 smoke test，不用框架
// 跑法：node src/game/engine.test.mjs

import {
  createGame,
  flipTile,
  FLIP_RESULT,
  isGameOver,
  getRank,
  ALL_LINES,
  TOTAL_TILES,
  TILES,
} from './index.js';

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) { console.log(`  ✓ ${name}`); pass++; }
  else      { console.log(`  ✗ ${name}`); fail++; }
}

// seeded random，讓測試可重現
function makeRng(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

console.log('\n[ALL_LINES] 結構');
ok('共 14 條線', ALL_LINES.length === 14);
ok('6 條橫', ALL_LINES.filter((l) => l.type === 'row').length === 6);
ok('6 條直', ALL_LINES.filter((l) => l.type === 'col').length === 6);
ok('2 條主對角', ALL_LINES.filter((l) => l.type === 'diag').length === 2);
ok('每條線 6 格', ALL_LINES.every((l) => l.cells.length === 6));

console.log('\n[createGame] 初始狀態');
const game = createGame({ rng: makeRng(42) });
ok('bingoTarget 36 格', game.bingoTarget.length === TOTAL_TILES);
ok('shuffleArea 36 格', game.shuffleArea.length === TOTAL_TILES);
ok('剩餘翻牌 15', game.flipsRemaining === 15);
ok('沒有完成線', game.completedLines.length === 0);
ok('bingoTarget 包含全部 36 張牌',
  new Set(game.bingoTarget).size === TOTAL_TILES &&
  game.bingoTarget.every((id) => id >= 0 && id < TOTAL_TILES)
);
ok('shuffleArea 跟 bingoTarget 是同一組牌',
  [...game.shuffleArea].sort((a,b) => a-b).join(',') ===
  [...game.bingoTarget].sort((a,b) => a-b).join(',')
);

console.log('\n[flipTile] 翻一張正常牌');
const r1 = flipTile(game, 0);
ok('result = OK', r1.result === FLIP_RESULT.OK);
ok('剩餘翻牌 14', r1.state.flipsRemaining === 14);
ok('洗牌區該格變 null', r1.state.shuffleArea[0] === null);
ok('Bingo 區目標位置變 true', r1.state.bingoRevealed[r1.targetIndex] === true);
ok('翻到的牌就是洗牌區原本的牌', r1.flippedTile === game.shuffleArea[0]);

console.log('\n[flipTile] 翻空格');
const r2 = flipTile(r1.state, 0); // 剛才翻過了
ok('result = EMPTY_SLOT', r2.result === FLIP_RESULT.EMPTY_SLOT);
ok('規則 ③④：不扣次數', r2.state.flipsRemaining === 14);
ok('state 不變', r2.state === r1.state);

console.log('\n[完整連線] 手動補滿第一橫排');
// 把目標 row 0 (indices 0~5) 對應的牌在洗牌區的位置找出來，逐一翻
let s = createGame({ rng: makeRng(7) });
const targetRow0 = s.bingoTarget.slice(0, 6); // row 0 要的 6 張牌的 id
let newLineEvents = 0;
for (const tileId of targetRow0) {
  const shuffleIdx = s.shuffleArea.indexOf(tileId);
  const r = flipTile(s, shuffleIdx);
  s = r.state;
  if (r.newLines.length > 0) newLineEvents++;
}
ok('row 0 已 6 格全 revealed',
  [0,1,2,3,4,5].every((i) => s.bingoRevealed[i])
);
ok('completedLines 含 row 0',
  s.completedLines.some((l) => l.type === 'row' && l.index === 0)
);
ok('共觸發 1 次 newLines 事件（最後一張補完時）', newLineEvents === 1);

console.log('\n[評價] cap 在 3');
const fakeState = { completedLines: [{},{},{},{}] };
ok('4 條也算 3 條（傳說）', getRank(fakeState).lines === 3);
ok('4 條也算傳說', getRank(fakeState).label === '傳說');
ok('0 條 = 摃龜', getRank({ completedLines: [] }).label === '摃龜');

console.log('\n[isGameOver]');
const overState = { ...game, flipsRemaining: 0 };
ok('剩 0 次 = game over', isGameOver(overState));
ok('剩 1 次 = 還沒結束', !isGameOver({ ...game, flipsRemaining: 1 }));

console.log(`\n${pass} passed, ${fail} failed.\n`);
process.exit(fail === 0 ? 0 : 1);
