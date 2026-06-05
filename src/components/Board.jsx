// 6×6 棋盤元件
// <Board>      可移動的牌（Phase 1 看牌、Phase 2 洗牌、Phase 3 洗牌區）
// <BingoBoard> 靜態格（Phase 3 Bingo 區）淡淡目標 + 已補實 + 發光連線

import { TILE_BY_ID, BOARD_SIZE } from '../game/tiles.js';
import { TILE_IMAGES, TILE_BACK } from '../assets.js';

const EMPTY_SET = new Set();

export function Board({
  tiles,
  mode = 'face-up',
  onTileClick,
  movingIds = EMPTY_SET,
  peekingPos = null,      // 比二完整偷看：該位置完整顯示
  blurPeekPos = null,     // 張手模糊偷瞄：該位置露下半模糊
  showHoverPeek = false,  // 滑鼠 hover 露下半模糊（動腦模式啟用）
  gestureHoverPos = null, // 手勢「指向」的目標格 — cursor 顯示
}) {
  const items = [];
  tiles.forEach((tileId, pos) => {
    if (tileId === null || tileId === undefined) return;
    const row = Math.floor(pos / BOARD_SIZE);
    const col = pos % BOARD_SIZE;
    items.push({ tileId, pos, row, col });
  });

  const clickable = mode === 'shuffle-area';
  const showBack = mode === 'face-down' || mode === 'shuffle-area';
  const cursorRow = gestureHoverPos !== null ? Math.floor(gestureHoverPos / BOARD_SIZE) : null;
  const cursorCol = gestureHoverPos !== null ? gestureHoverPos % BOARD_SIZE : null;

  return (
    <div className="board board--motion">
      {gestureHoverPos !== null && (
        <div
          className="board__cursor"
          style={{ transform: `translate(${cursorCol * 100}%, ${cursorRow * 100}%)` }}
        >
          <span className="board__cursor-label">{cursorRow},{cursorCol}</span>
        </div>
      )}
      {items.map(({ tileId, pos, row, col }) => {
        const isMoving = movingIds.has(tileId);
        const isPeeking = peekingPos === pos;     // 比二：完整顯示
        const isBlurPeek = blurPeekPos === pos;   // 張手：露下半模糊
        const cls = [
          'board-tile',
          `board-tile--${mode}`,
          isMoving ? 'board-tile--moving' : '',
          isPeeking ? 'board-tile--peeking' : '',
          showHoverPeek ? 'board-tile--peekable' : '',
        ].filter(Boolean).join(' ');
        const label = TILE_BY_ID[tileId].label;

        return (
          <button
            key={tileId}
            className={cls}
            data-tile-id={tileId}
            data-pos={pos}
            style={{ transform: `translate(${col * 100}%, ${row * 100}%)` }}
            disabled={!clickable}
            onClick={() => clickable && onTileClick?.(pos, tileId)}
            aria-label={`格 ${pos}・${label}`}
          >
            <span className="board-tile__face">
              <img
                className="board-tile__img"
                src={showBack ? TILE_BACK : TILE_IMAGES[tileId]}
                alt={showBack ? '牌背' : label}
                draggable={false}
              />

              {/* 露下半模糊偷瞄：hover（showHoverPeek）或張手（isBlurPeek）觸發 */}
              {(showHoverPeek || isBlurPeek) && (
                <img
                  className={`board-tile__peek-img${isBlurPeek ? ' is-show' : ''}`}
                  src={TILE_IMAGES[tileId]}
                  alt={label}
                  draggable={false}
                />
              )}

              {/* 比二完整偷看：完整顯示 1.5 秒 */}
              {isPeeking && (
                <img
                  className="board-tile__peek-img board-tile__peek-img--full"
                  src={TILE_IMAGES[tileId]}
                  alt={label}
                  draggable={false}
                />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function BingoBoard({ target, revealed, glowingCells = [] }) {
  const glowSet = new Set(glowingCells);
  return (
    <div className="board board--bingo">
      {target.map((tileId, pos) => {
        const isRevealed = revealed[pos];
        const isGlowing = glowSet.has(pos);
        const cls = ['board-cell'];
        if (isRevealed) cls.push('revealed');
        if (isGlowing) cls.push('glow');
        return (
          <div key={pos} data-bingo-pos={pos} className={cls.join(' ')}>
            <img
              className={isRevealed ? 'board-cell__img' : 'board-cell__img ghost'}
              src={TILE_IMAGES[tileId]}
              alt={TILE_BY_ID[tileId].label}
              draggable={false}
            />
          </div>
        );
      })}
    </div>
  );
}
