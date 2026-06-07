import { useEffect, useMemo, useRef, useState } from 'react';
import './index.css';
import {
  createGame,
  flipTile,
  FLIP_RESULT,
  isGameOver,
  getRank,
  TILE_BY_ID,
} from './game/index.js';
import { Board, BingoBoard } from './components/Board.jsx';
import { LottieFx } from './components/LottieFx.jsx';
import {
  LOGO, OWNER, BTN_START, BTN_START_HOVER, BTN_GALLERY, BTN_GALLERY_HOVER,
  BTN_TUTORIAL, BTN_TUTORIAL_HOVER,
  SHELF, DOLL_IMAGES, BG_MAIN, BG_FELT,
  SFX, TUTORIAL_VOICES, VOICE,
} from './assets.js';
import { playBgm, stopBgm, playSfx, playVoice, stopVoice } from './audio.js';
import {
  HandTracker,
  CURSOR_GRID_SIZE,
  GESTURE_POINT,
  GESTURE_FLIP,
  GESTURE_OPEN,
  GESTURE_PEACE,
  GESTURE_NONE,
} from './components/HandTracker.jsx';

const PHASES = {
  START: 'START',
  OPENING: 'OPENING',
  RULES: 'RULES',
  GALLERY: 'GALLERY',
  CALIBRATE: 'CALIBRATE',
  MEMORIZE: 'MEMORIZE',
  SHUFFLE: 'SHUFFLE',
  FLIP: 'FLIP',
  RESULT: 'RESULT',
};

/* ===== 手勢校正：每個人手的活動範圍不同，校正後存起來 ===== */
const ZONE_KEY = 'night-market-bingo.handZone';
const DEFAULT_ZONE = { x: [0.15, 0.85], y: [0.2, 0.8] };
const RANGE_SECONDS = 10;  // 範圍校正倒數秒數（給足時間繞四個角）

/* 校正精靈步驟 */
const CALIB_STEPS = [
  { key: 'range', icon: '🖐', title: '移動範圍', hint: '別緊張～伸出食指，慢慢在鏡頭前往四個角落各停一下（左上→右上→右下→左下）' },
  { key: 'peace', icon: '✌', title: '翻牌動作', hint: '比出 YA（食指 + 中指）— 這就是「翻牌」' },
  { key: 'open',  icon: '✋', title: '張開手',   hint: '五指完全張開讓鏡頭看見' },
];
function loadZone() {
  try {
    const raw = localStorage.getItem(ZONE_KEY);
    if (!raw) return DEFAULT_ZONE;
    const z = JSON.parse(raw);
    if (z?.x?.length === 2 && z?.y?.length === 2) return z;
    return DEFAULT_ZONE;
  } catch { return DEFAULT_ZONE; }
}
function saveZone(z) {
  try { localStorage.setItem(ZONE_KEY, JSON.stringify(z)); } catch { /* noop */ }
}

/* 戰利品娃娃（美術 10 隻：1-5 普通、6-8 稀有、9-10 傳說）*/
const DOLLS = Array.from({ length: 10 }, (_, i) => {
  const id = i + 1;
  const rarity = id <= 5 ? 'common' : id <= 8 ? 'rare' : 'legendary';
  return { id, img: DOLL_IMAGES[id], rarity };
});

const RARITY_LABEL = { common: '普通', rare: '稀有', legendary: '傳說' };

/* ===== 模式 ===== */
const MODES = {
  CASUAL: 'casual',  // 半運氣：Bingo 區顯示淡淡目標
  MEMORY: 'memory',  // 動腦：Bingo 區只有空格，靠記憶
};
const MODE_KEY = 'night-market-bingo.mode';
function loadMode() {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === MODES.MEMORY ? MODES.MEMORY : MODES.CASUAL;
  } catch { return MODES.CASUAL; }
}
function saveMode(m) {
  try { localStorage.setItem(MODE_KEY, m); } catch { /* noop */ }
}

/* ===== 收藏持久化 ===== */
const STORAGE_KEY = 'night-market-bingo.collected';

function loadCollected() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function saveCollected(set) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch { /* noop — 隱私模式 / quota 滿都可能 fail，忽略 */ }
}

/* 結算抽獎：依線數對應稀有度，從未獲得名單隨機抽
   若該稀有度已全收齊，往下降一階 */
function pickReward(lines, collected) {
  let rarity;
  if (lines >= 3) rarity = 'legendary';
  else if (lines === 2) rarity = 'rare';
  else if (lines === 1) rarity = 'common';
  else return null; // 0 線無獎

  const tryRarity = (r) => DOLLS.filter((d) => d.rarity === r && !collected.has(d.id));
  let pool = tryRarity(rarity);
  if (pool.length === 0 && rarity === 'legendary') pool = tryRarity('rare');
  if (pool.length === 0) pool = tryRarity('common');
  if (pool.length === 0) return null; // 全收齊

  return pool[Math.floor(Math.random() * pool.length)];
}

// Start 進遊戲：簡短開場（2 句，配開頭+結尾語音）
const INTRO_LINES = [
  '哎唷少年仔，來來來！這攤麻將賓果，連線娃娃就送你！',
  '好啦，加油啊少年仔！',
];
const INTRO_POSES = ['happy', 'happy'];

// 點「教學」才看完整 8 段（配 TUTORIAL_VOICES 語音）
const TUTORIAL_LINES = [
  '哎唷，少年仔！來來來，過來這邊！只要連線娃娃就是你的，阿伯教你！',
  '這個棋盤六乘六，三十六張牌。萬、筒、索，加字牌，全部都有！',
  '先給你看哦！我很大方，讓你看十秒，快點記一記，蓋起來後哭也沒路用啊！',
  '眼睛給我睜金金！頭幾張換哪去，你若記得住，後面贏定了。',
  '好啊，換你囉！你有十五次機會，一次翻一張，省著點用啊少年仔！',
  '看到沒？翻開的牌自己會飛過去！右邊那個就是你的 Bingo 區。',
  '橫的、直的、斜的，連成一條就贏一條！最多三條，連越多娃娃越帥哦！',
  '好啦，加油啊少年仔！',
];
const TUTORIAL_POSES = ['happy', 'idle', 'think', 'think', 'happy', 'idle', 'happy', 'happy'];
// 遊玩時的閒話家常（無語音）
const GAME_HECKLES = [
  '想這麼久，你是在算命嗎？翻下去就對了啦！',
  '這款記性去考試一定考一百分！浪費在夜市啊哈哈！',
  '剩沒幾次了，一翻要值一翻的，想清楚再動手哦！',
  '那個娃娃是阿伯去批發市場一隻一隻摸過挑的！',
  '今晚風有一點大，阿伯的攤布差點飛走，嚇阿伯一跳！',
  '阿伯今仔日賣的臭豆腐，旁邊那攤說比他的好吃，哈哈！',
];
// 簡短開場的語音（教學第 1 段 + 最後一段「加油」）
const INTRO_VOICES = [TUTORIAL_VOICES[0], TUTORIAL_VOICES[7]];

// Title 老闆閒聊：點他講話 + 換表情（pose: idle / think / happy）
const OWNER_CHATS = [
  { pose: 'happy', text: '少年仔！要不要試試手氣啊？' },
  { pose: 'think', text: '嗯⋯今晚生意還不錯啦。' },
  { pose: 'idle',  text: '阿伯這攤擺了二十年啦。' },
  { pose: 'happy', text: '欸欸欸！別只是看，玩一局嘛！' },
  { pose: 'think', text: '那個娃娃是阿伯去批發市場一隻一隻摸過挑的！' },
  { pose: 'happy', text: '輸贏是其次啦，開心就好！' },
  { pose: 'idle',  text: '今晚風有一點大，攤布差點飛走，嚇阿伯一跳！' },
  { pose: 'think', text: '旁邊那攤臭豆腐說比阿伯的好吃，哈哈！' },
  { pose: 'happy', text: '你看起來就是會贏的款！來啦！' },
];

// 結算台詞（依完成線數）
function resultLine(lines) {
  if (lines >= 3) return '三條線！！！少年仔你是神仙下凡嗎！大隻娃娃帶走，下次再來哦！';
  if (lines >= 1) return '哇！連起來啊！少年仔你厲害！偶就知道你有料！';
  return '哎唷，差一點啊！沒關係啦，下次記牌記好一點，娃娃等你！';
}

const MEMORIZE_SECONDS = 10;
const SHUFFLE_STEP_MS = 1200;  // 可見段每輪洗牌間隔（動畫 1s + 0.2s 停頓）
const HIDDEN_SHUFFLE_MS = 2600; // 隱藏段（鞭炮特效）總時長
const GLOW_DURATION_MS = 1800; // 連線發光持續時間
const FLY_DURATION_MS = 700;   // 翻牌飛回 Bingo 區的時間

/* 動腦模式 — 限次偷看 */
const PEEK_BUDGET = 3;
const PEEK_DURATION_MS = 1500;   // 比二完整偷看
const BLUR_PEEK_MS = 1400;       // 張手露下半模糊偷瞄

/* ============== 白膜 SVG ============== */
function OwnerMock({ pose = 'idle' }) {
  return (
    <svg viewBox="0 0 100 140" preserveAspectRatio="xMidYMid meet" aria-label={`owner ${pose}`}>
      <circle cx="50" cy="28" r="18" fill="none" stroke="#8a8478" strokeWidth="1.5" />
      <path d="M28 50 L72 50 L78 130 L22 130 Z" fill="none" stroke="#8a8478" strokeWidth="1.5" />
      <line x1="50" y1="50" x2="50" y2="130" stroke="#b6afa1" strokeWidth="1" strokeDasharray="2 3" />
      <path d="M72 56 L88 64 L84 78" fill="none" stroke="#8a8478" strokeWidth="1.5" />
      <circle cx="84" cy="78" r="5" fill="none" stroke="#8a8478" strokeWidth="1.5" />
      <text x="50" y="138" textAnchor="middle" fontSize="6" fill="#b6afa1" letterSpacing="1">
        {`owner / ${pose}`}
      </text>
    </svg>
  );
}

/* 台式鞭炮 + 煙火特效（Phase 2 隱藏洗牌段用） */
const BIG_CHARS = ['洗！', '發！', '炸！', '中！'];
const SPARK_COUNT = 40;
const FLOAT_CHARS = ['發', '中', '炸', '金', '紅', '福', '喜', '財'];

function FireworkOverlay() {
  // 優先使用 Lottie；沒有檔案就 fallback 到純 CSS 鞭炮
  // 可疊加多個 Lottie：firework.json（主）+ firework2.json（疊加層）
  return (
    <div className="firework">
      <div className="firework__bg" />

      {/* 主煙火 / 鞭炮 — 沒檔走 CSS fallback */}
      <LottieFx
        path="/lotties/firework.json"
        loop
        className="firework__lottie"
        fallback={<CssFireworkFallback />}
      />

      {/* 第二層煙火（可選，疊加播放）— 沒檔就什麼都不顯示 */}
      <LottieFx
        path="/lotties/firework2.json"
        loop
        className="firework__lottie firework__lottie--overlay"
        fallback={null}
      />
    </div>
  );
}

/* 純 CSS 鞭炮 fallback — 當 /lotties/firework.json 不存在時顯示 */
function CssFireworkFallback() {
  const [charIdx, setCharIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setCharIdx((i) => (i + 1) % BIG_CHARS.length), 500);
    return () => clearInterval(t);
  }, []);

  // 隨機火花參數（只在 mount 時算一次）
  const sparks = useMemo(
    () =>
      Array.from({ length: SPARK_COUNT }).map(() => ({
        dx: (Math.random() - 0.5) * 1400,
        dy: (Math.random() - 0.5) * 1000,
        delay: Math.random() * 1.6,
        color: ['#f4c041', '#e63946', '#fff8a0', '#ff9b3d'][Math.floor(Math.random() * 4)],
        size: 8 + Math.random() * 10,
      })),
    []
  );
  const floats = useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => ({
        char: FLOAT_CHARS[i % FLOAT_CHARS.length],
        left: Math.random() * 90 + 5,
        top: Math.random() * 80 + 10,
        delay: Math.random() * 1.2,
        rotate: (Math.random() - 0.5) * 60,
        size: 24 + Math.random() * 36,
      })),
    []
  );

  return (
    <>
      {/* 左右兩串鞭炮 */}
      <div className="firecracker firecracker--left">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className="firecracker__bead" style={{ animationDelay: `${i * 0.06}s` }} />
        ))}
      </div>
      <div className="firecracker firecracker--right">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className="firecracker__bead" style={{ animationDelay: `${i * 0.06}s` }} />
        ))}
      </div>

      {/* 漂浮的吉祥字 */}
      {floats.map((f, i) => (
        <span
          key={`float-${i}`}
          className="firework__float"
          style={{
            left: `${f.left}%`,
            top: `${f.top}%`,
            fontSize: `${f.size}px`,
            transform: `rotate(${f.rotate}deg)`,
            animationDelay: `${f.delay}s`,
          }}
        >
          {f.char}
        </span>
      ))}

      {/* 火花散落 */}
      {sparks.map((s, i) => (
        <span
          key={`spark-${i}`}
          className="firework__spark"
          style={{
            '--dx': `${s.dx}px`,
            '--dy': `${s.dy}px`,
            '--c': s.color,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}

      {/* 中央大字輪播（搖晃） */}
      <div className="firework__big" key={charIdx}>
        {BIG_CHARS[charIdx]}
      </div>
    </>
  );
}

function HandMock() {
  return (
    <svg viewBox="0 0 80 80" width="60%" height="60%" aria-label="手勢">
      <circle cx="40" cy="50" r="14" fill="none" stroke="#8a8478" strokeWidth="1.5" />
      <line x1="40" y1="36" x2="40" y2="14" stroke="#8a8478" strokeWidth="2" strokeLinecap="round" />
      <circle cx="40" cy="14" r="3" fill="#8a8478" />
      <line x1="30" y1="42" x2="24" y2="32" stroke="#b6afa1" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="50" y1="42" x2="56" y2="32" stroke="#b6afa1" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/* 圖片按鈕：hover 換 _選取 圖 */
function ImgButton({ src, hoverSrc, onClick, className = '', alt = '' }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      className={`img-btn ${className}`}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <img src={hov && hoverSrc ? hoverSrc : src} alt={alt} draggable={false} />
    </button>
  );
}

/* ============== 主元件 ============== */
function App() {
  const [phase, setPhase] = useState(PHASES.START);

  /* Dialog */
  const [openingIdx, setOpeningIdx] = useState(0);
  const [heckleIdx, setHeckleIdx] = useState(0);

  /* Game state */
  const [game, setGame] = useState(null);

  /* 戰利品收藏 — 從 localStorage 載入，跨重整保留 */
  const [collected, setCollected] = useState(() => loadCollected());
  /* 本局結算抽到的新娃娃（給結算畫面展示用） */
  const [newDoll, setNewDoll] = useState(null);

  /* Phase 1：倒數 */
  const [countdown, setCountdown] = useState(MEMORIZE_SECONDS);

  /* Phase 2：洗牌動畫進度 */
  const [shuffleStep, setShuffleStep] = useState(0);
  const [liveArr, setLiveArr] = useState(null);
  const [movingIds, setMovingIds] = useState(new Set());
  // 'visible' 玩家可見追蹤 / 'hidden' 鞭炮特效遮蔽
  const [shuffleSubPhase, setShuffleSubPhase] = useState('visible');

  /* Phase 3：發光中的格子 */
  const [glowingCells, setGlowingCells] = useState([]);
  const glowTimers = useRef({});

  /* Phase 3：翻牌飛行動畫 */
  const [flying, setFlying] = useState(null);
  // flying: { tileId, fromRect, toRect, srcPos, arrived } | null

  /* 手勢辨識 */
  const [currentGesture, setCurrentGesture] = useState('—');
  // 食指指向時的「目標格」(0-35)，給 cursor 用
  const [gestureHoverPos, setGestureHoverPos] = useState(null);
  // 最後一次指向的格子（張手/比二作用對象，cursor 清掉後仍記得）
  const lastPointedPosRef = useRef(null);

  /* 手勢校正：玩家專屬的手部活動範圍 + 多步驟精靈 */
  const [handZone, setHandZone] = useState(() => loadZone());
  const [calibStepIdx, setCalibStepIdx] = useState(0);
  const [calibStepDone, setCalibStepDone] = useState(false); // 當前步驟完成 → 顯示 ✓
  const [rangeCountdown, setRangeCountdown] = useState(RANGE_SECONDS);
  const calibAccRef = useRef(null);     // 範圍累積（視覺座標）
  // 洗牌後回到哪：校正完成要進的 phase
  const afterCalibRef = useRef(PHASES.FLIP);

  /* 測試模式：無視翻牌次數限制，可一直翻完 36 張 */
  const [testMode, setTestMode] = useState(false);

  /* 遊戲模式：casual（半運氣）/ memory（動腦） */
  const [mode, setMode] = useState(() => loadMode());

  /* Title 老闆互動：點他換表情 + 講話 */
  const [titleOwnerChat, setTitleOwnerChat] = useState(null); // { pose, text } | null
  const titleChatIdxRef = useRef(0);
  const titleChatTimerRef = useRef(null);
  const handleOwnerClick = () => {
    const chat = OWNER_CHATS[titleChatIdxRef.current % OWNER_CHATS.length];
    titleChatIdxRef.current += 1;
    setTitleOwnerChat(chat);
    playSfx(SFX.click);
    clearTimeout(titleChatTimerRef.current);
    titleChatTimerRef.current = setTimeout(() => setTitleOwnerChat(null), 3500);
  };
  const changeMode = (m) => { setMode(m); saveMode(m); };

  /* 動腦模式工具：完整偷看（比二，限次）+ 模糊偷瞄（張手，不限次） */
  const [peeksRemaining, setPeeksRemaining] = useState(PEEK_BUDGET);
  const [peekMode, setPeekMode] = useState(false);     // 切換到「點任一張完整偷看」狀態
  const [peekingPos, setPeekingPos] = useState(null);  // 比二：完整顯示的位置
  const [blurPeekPos, setBlurPeekPos] = useState(null); // 張手：露下半模糊的位置
  const blurTimerRef = useRef(null);

  /* 開新一局：在進 Phase 1 前呼叫 */
  const startGame = () => {
    const g = createGame({ mode });
    setGame(g);
    setCountdown(MEMORIZE_SECONDS);
    setShuffleStep(0);
    setLiveArr(g.bingoTarget);   // Phase 2 從目標配置開始洗
    setMovingIds(new Set());
    setShuffleSubPhase('visible');
    setGlowingCells([]);
    setNewDoll(null);
    // 動腦工具
    setPeeksRemaining(PEEK_BUDGET);
    setPeekMode(false);
    setPeekingPos(null);
    setBlurPeekPos(null);
    setGestureHoverPos(null);
    lastPointedPosRef.current = null;
    // 兩種模式都先校正手勢（鏡頭開好）再進記憶
    enterCalibration(PHASES.MEMORIZE);
  };

  /* 進結算前先抽獎、寫入 collected + localStorage */
  const goToResult = (finalGame) => {
    const lines = finalGame ? Math.min(finalGame.completedLines.length, 3) : 0;
    const doll = pickReward(lines, collected);
    if (doll) {
      setNewDoll(doll);
      setCollected((prev) => {
        const next = new Set(prev);
        next.add(doll.id);
        saveCollected(next);
        return next;
      });
    } else {
      setNewDoll(null);
    }
    // 結算音效 + 老闆語音
    if (lines >= 1) {
      playSfx(SFX.victory);
      playVoice(lines >= 3 ? VOICE.victory2 : VOICE.victory1);
    } else {
      playSfx(SFX.lose);
      playVoice(VOICE.lose);
    }
    setPhase(PHASES.RESULT);
  };

  /* 一進來就播 BGM；被瀏覽器擋住就等首次互動補播 */
  useEffect(() => {
    playBgm(SFX.bgm);
    const resume = () => playBgm(SFX.bgm);
    window.addEventListener('pointerdown', resume);
    return () => window.removeEventListener('pointerdown', resume);
  }, []);

  /* 教學語音：OPENING 播簡短開場、RULES 播完整教學 */
  useEffect(() => {
    if (phase === PHASES.OPENING) playVoice(INTRO_VOICES[openingIdx]);
    else if (phase === PHASES.RULES) playVoice(TUTORIAL_VOICES[openingIdx]);
    else return;
    return () => stopVoice();
  }, [phase, openingIdx]);

  /* Phase 1 倒數 */
  useEffect(() => {
    if (phase !== PHASES.MEMORIZE) return;
    if (countdown <= 0) {
      setPhase(PHASES.SHUFFLE);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  /* Phase 2 整段流程：closure 控制，不依賴 React state 推進
     可見段 → 切隱藏段 → 鞭炮特效 → 進 Phase 3 一氣呵成 */
  useEffect(() => {
    if (phase !== PHASES.SHUFFLE || !game) return;
    if (import.meta.env.DEV) console.log('[Phase2] start, steps =', game.shuffleSteps.length);

    let cancelled = false;
    const timers = [];
    let step = 0;
    let prevArr = game.bingoTarget;

    const runVisible = () => {
      if (cancelled) return;

      if (step >= game.shuffleSteps.length) {
        setMovingIds(new Set());
        // 動腦模式：洗牌全可見，沒有隱藏段，直接進 Phase 3
        if (game.mode === 'memory') {
          if (import.meta.env.DEV) console.log('[Phase2] visible done → FLIP (memory)');
          timers.push(setTimeout(() => {
            if (cancelled) return;
            setPhase(PHASES.FLIP);
          }, 600));
          return;
        }
        // 半運氣：鞭炮蓋住偷洗一次
        if (import.meta.env.DEV) console.log('[Phase2] visible done → hidden (casual)');
        setShuffleSubPhase('hidden');

        timers.push(setTimeout(() => {
          if (cancelled) return;
          if (import.meta.env.DEV) console.log('[Phase2] hidden swap final');
          setLiveArr(game.shuffleArea);
        }, 700));

        timers.push(setTimeout(() => {
          if (cancelled) return;
          if (import.meta.env.DEV) console.log('[Phase2] → FLIP');
          setPhase(PHASES.FLIP);
        }, HIDDEN_SHUFFLE_MS));
        return;
      }

      const nextArr = game.shuffleSteps[step];
      const ids = new Set();
      for (let i = 0; i < nextArr.length; i++) {
        if (nextArr[i] !== prevArr[i]) ids.add(nextArr[i]);
      }
      prevArr = nextArr;

      setMovingIds(ids);
      setLiveArr(nextArr);
      step += 1;
      setShuffleStep(step);

      timers.push(setTimeout(runVisible, SHUFFLE_STEP_MS));
    };

    timers.push(setTimeout(runVisible, SHUFFLE_STEP_MS));

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      if (import.meta.env.DEV) console.log('[Phase2] cleanup');
    };
  }, [phase, game]);

  /* Phase 3 攤主吐槽輪播 */
  useEffect(() => {
    if (phase !== PHASES.FLIP) return;
    const t = setInterval(() => {
      setHeckleIdx((i) => (i + 1) % GAME_HECKLES.length);
    }, 3500);
    return () => clearInterval(t);
  }, [phase]);

  /* commit：真正改 game state（連線發光 + game over）
     測試模式 → 把扣掉的次數補回去、不自動進結算 */
  const commitFlip = (pos, gameSnapshot) => {
    const r = flipTile(gameSnapshot, pos);
    if (r.result !== FLIP_RESULT.OK) return;
    const finalState = testMode
      ? { ...r.state, flipsRemaining: gameSnapshot.flipsRemaining }
      : r.state;
    setGame(finalState);
    playSfx(SFX.click);

    // 規則 ②：新完成的線立即發光
    if (r.newLines.length > 0) {
      playSfx(SFX.victory);
      const cells = [...new Set(r.newLines.flatMap((l) => l.cells))];
      setGlowingCells((prev) => [...new Set([...prev, ...cells])]);
      cells.forEach((c) => {
        if (glowTimers.current[c]) clearTimeout(glowTimers.current[c]);
        glowTimers.current[c] = setTimeout(() => {
          setGlowingCells((prev) => prev.filter((x) => x !== c));
          delete glowTimers.current[c];
        }, GLOW_DURATION_MS);
      });
    }
    if (!testMode && isGameOver(finalState)) {
      setTimeout(() => goToResult(finalState), 1000);
    }
  };

  /* 動腦：完整偷看一張，不消耗翻牌次數，只消耗偷看次數 */
  const doPeek = (pos) => {
    if (peeksRemaining <= 0) return;
    if (peekingPos !== null) return;  // 已經在看，不重疊
    setPeekingPos(pos);
    setPeeksRemaining((n) => n - 1);
    setTimeout(() => {
      setPeekingPos(null);
      // 用完自動退出 peekMode
      setPeeksRemaining((n) => {
        if (n <= 0) setPeekMode(false);
        return n;
      });
    }, PEEK_DURATION_MS);
  };

  /* 動腦：張手 → 露下半模糊偷瞄某格（不限次，像摸牌摸個大概） */
  const doBlurPeek = (pos) => {
    setBlurPeekPos(pos);
    clearTimeout(blurTimerRef.current);
    blurTimerRef.current = setTimeout(() => setBlurPeekPos(null), BLUR_PEEK_MS);
  };

  /* 翻牌動作：算位置 → 飛行 overlay → 落地後 commit */
  const handleFlip = (pos) => {
    // 動腦偷看模式：點哪格就完整顯示那格，不真翻
    if (peekMode && mode === 'memory') {
      doPeek(pos);
      return;
    }
    if (flying) return;          // 動畫中不接受新點擊
    if (!game) return;
    if (!testMode && game.flipsRemaining <= 0) return;

    const tile = game.shuffleArea[pos];
    if (tile === null || tile === undefined) return;

    const targetIndex = game.bingoTarget.indexOf(tile);
    const sourceEl = document.querySelector(`.board-tile[data-tile-id="${tile}"]`);
    const targetEl = document.querySelector(`.board-cell[data-bingo-pos="${targetIndex}"]`);

    // 找不到 DOM（極少數情況） → 直接 commit 跳過動畫
    if (!sourceEl || !targetEl) {
      commitFlip(pos, game);
      return;
    }

    const fromRect = sourceEl.getBoundingClientRect();
    const toRect = targetEl.getBoundingClientRect();
    const gameSnapshot = game; // 抓住目前 state，避免 commit 時被別的 effect 改掉

    setFlying({ tileId: tile, fromRect, toRect, srcPos: pos, arrived: false });

    // 下兩個 frame 觸發 transition（先 mount，再改 transform）
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFlying((prev) => (prev ? { ...prev, arrived: true } : null));
      });
    });

    setTimeout(() => {
      commitFlip(pos, gameSnapshot);
      setFlying(null);
    }, FLY_DURATION_MS + 20);
  };

  /* 手勢處理：POINT 更新 cursor、FIST 翻當前格 */
  const handleGesture = (g, point) => {
    setCurrentGesture(g);

    // 把指尖 normalized 座標映射到棋盤格 index（用校正後的 handZone）
    const pointToPos = (p) => {
      const [xMin, xMax] = handZone.x;
      const [yMin, yMax] = handZone.y;
      const remap = (v, lo, hi) => Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
      const x = remap(1 - p.x, xMin, xMax);
      const y = remap(p.y, yMin, yMax);
      const last = CURSOR_GRID_SIZE - 1;
      const col = Math.min(last, Math.floor(x * CURSOR_GRID_SIZE));
      const row = Math.min(last, Math.floor(y * CURSOR_GRID_SIZE));
      return row * CURSOR_GRID_SIZE + col;
    };

    if (g === GESTURE_POINT && point) {
      // 只要食指還伸著就顯示 cursor。手超出 active zone 時 clamp 到最近的邊排
      // （pointToPos 內已 clamp），這樣最底排/邊排不用精準對準就能選到
      const pos = pointToPos(point);
      setGestureHoverPos(pos);
      lastPointedPosRef.current = pos;
      return;
    }

    // 比二 = 翻牌（明確的手勢，不易誤觸）
    if (g === GESTURE_PEACE && phase === PHASES.FLIP) {
      const pos = lastPointedPosRef.current ?? gestureHoverPos;
      if (pos !== null && pos !== undefined) handleFlip(pos);
      return;
    }

    // 彎食指 = 完整偷看最後指向的牌（動腦專屬，限 3 次）
    if (g === GESTURE_FLIP && phase === PHASES.FLIP && mode === 'memory') {
      const pos = lastPointedPosRef.current;
      if (pos !== null && pos !== undefined) doPeek(pos);
      return;
    }

    // 張手 = 露下半模糊偷瞄最後指向的牌（兩種模式都有，不限次）
    if (g === GESTURE_OPEN && phase === PHASES.FLIP) {
      const pos = lastPointedPosRef.current;
      if (pos !== null && pos !== undefined) doBlurPeek(pos);
      return;
    }

    if (g === GESTURE_NONE) {
      // 手不在畫面 / 非指向姿勢 → 清掉 cursor（但 lastPointedPos 保留給張手/比二）
      setGestureHoverPos(null);
    }
  };

  /* 進入校正精靈（洗牌後 / Title 按鈕都走這） */
  const enterCalibration = (after = PHASES.FLIP) => {
    afterCalibRef.current = after;
    calibAccRef.current = null;
    setCalibStepIdx(0);
    setCalibStepDone(false);
    setRangeCountdown(RANGE_SECONDS);
    setCurrentGesture('—');
    setPhase(PHASES.CALIBRATE);
  };

  /* 完成一步 → 顯示 ✓ 後跳下一步；最後一步 → 進遊戲 */
  const advanceCalibStep = () => {
    setCalibStepDone(true);
    setTimeout(() => {
      setCalibStepIdx((idx) => {
        const next = idx + 1;
        if (next >= CALIB_STEPS.length) {
          setPhase(afterCalibRef.current);
          return idx;
        }
        setCalibStepDone(false);
        if (CALIB_STEPS[next].key === 'range') setRangeCountdown(RANGE_SECONDS);
        return next;
      });
    }, 700);
  };

  /* 校正中收手勢 */
  const handleCalibrateGesture = (g) => {
    setCurrentGesture(g);
    if (calibStepDone) return;
    const step = CALIB_STEPS[calibStepIdx]?.key;
    // range 在倒數 useEffect 處理累積；這裡只處理手勢觸發的步驟
    if (step === 'flip' && g === GESTURE_FLIP) advanceCalibStep();
    else if (step === 'open' && g === GESTURE_OPEN) advanceCalibStep();
    else if (step === 'peace' && g === GESTURE_PEACE) advanceCalibStep();
  };

  /* range 步驟：邊倒數邊累積指尖範圍。用 onGesture 同一條路徑收 point */
  const handleCalibratePoint = (g, point) => {
    setCurrentGesture(g);
    if (CALIB_STEPS[calibStepIdx]?.key !== 'range') return;
    if (g !== GESTURE_POINT || !point) return;
    const vx = 1 - point.x;
    const vy = point.y;
    const acc = calibAccRef.current;
    if (!acc) calibAccRef.current = { minX: vx, maxX: vx, minY: vy, maxY: vy };
    else {
      acc.minX = Math.min(acc.minX, vx); acc.maxX = Math.max(acc.maxX, vx);
      acc.minY = Math.min(acc.minY, vy); acc.maxY = Math.max(acc.maxY, vy);
    }
  };

  /* 統一的校正 onGesture：range 走累積、其他走觸發 */
  const onCalibGesture = (g, point) => {
    if (CALIB_STEPS[calibStepIdx]?.key === 'range') handleCalibratePoint(g, point);
    else handleCalibrateGesture(g);
  };

  /* range 步驟倒數 */
  useEffect(() => {
    if (phase !== PHASES.CALIBRATE) return;
    if (CALIB_STEPS[calibStepIdx]?.key !== 'range') return;
    if (calibStepDone) return;
    if (rangeCountdown <= 0) {
      const acc = calibAccRef.current;
      if (acc && acc.maxX - acc.minX > 0.2 && acc.maxY - acc.minY > 0.15) {
        // 內縮 -3%（往外擴）讓邊角更好抓，原本 +5% 內縮會讓邊緣難點到
        const padX = (acc.maxX - acc.minX) * -0.03;
        const padY = (acc.maxY - acc.minY) * -0.03;
        const zone = {
          x: [acc.minX + padX, acc.maxX - padX],
          y: [acc.minY + padY, acc.maxY - padY],
        };
        setHandZone(zone);
        saveZone(zone);
      }
      advanceCalibStep();
      return;
    }
    const t = setTimeout(() => setRangeCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, calibStepIdx, calibStepDone, rangeCountdown]);

  /* 飛行中，洗牌區那格暫時隱藏（牌已經在飛了） */
  const visibleShuffleArea =
    game && flying
      ? game.shuffleArea.map((id, i) => (i === flying.srcPos ? null : id))
      : game?.shuffleArea;

  const goRules = () => { setOpeningIdx(0); setPhase(PHASES.RULES); };

  return (
    <div className="app" style={{ backgroundImage: `url(${BG_MAIN})` }}>


      {/* ============== 01. TITLE ============== */}
      {phase === PHASES.START && (
        <div className="title-screen scene-fade">
          {/* 上方大 logo 置中 */}
          <img className="title-logo-img" src={LOGO} alt="黑哥麻將" draggable={false} />

          {/* 老闆絕對定位右側（可點互動） */}
          <img
            className="title-owner"
            src={OWNER[titleOwnerChat?.pose ?? 'idle']}
            alt="老闆"
            draggable={false}
            onClick={handleOwnerClick}
          />
          {titleOwnerChat && (
            <div className="title-owner-bubble">{titleOwnerChat.text}</div>
          )}

          {/* 下方兩招牌置中 */}
          <div className="title-buttons">
            <ImgButton
              className="title-img-btn"
              src={BTN_START} hoverSrc={BTN_START_HOVER} alt="開始"
              onClick={() => { playBgm(SFX.bgm); setOpeningIdx(0); setPhase(PHASES.OPENING); }}
            />
            <ImgButton
              className="title-img-btn"
              src={BTN_GALLERY} hoverSrc={BTN_GALLERY_HOVER} alt="物品"
              onClick={() => setPhase(PHASES.GALLERY)}
            />
          </div>

          {/* 右下角教學招牌 */}
          <ImgButton
            className="title-tutorial-btn"
            src={BTN_TUTORIAL} hoverSrc={BTN_TUTORIAL_HOVER} alt="教學"
            onClick={goRules}
          />

        </div>
      )}

      {/* ============== 02-A. 開場白 ============== */}
      {phase === PHASES.OPENING && (
        <div className="dialog-screen scene-fade">
          <div className="dialog-owner">
            <img className="owner-img" src={OWNER[INTRO_POSES[openingIdx] ?? 'idle']} alt="老闆" draggable={false} />
          </div>
          <div className="bubble bubble--owner dialog-bubble">
            <p>{INTRO_LINES[openingIdx]}</p>
            <div className="dialog-progress">
              {INTRO_LINES.map((_, i) => (
                <span key={i} className={i === openingIdx ? 'dot active' : 'dot'} />
              ))}
            </div>
            <button
              className="dialog-next"
              onClick={() => {
                if (openingIdx < INTRO_LINES.length - 1) setOpeningIdx(openingIdx + 1);
                else startGame();
              }}
            >
              {openingIdx < INTRO_LINES.length - 1 ? '下一句 ▸' : '開始 ▸'}
            </button>
          </div>
        </div>
      )}

      {/* ============== 02-B. 教學重看（逐句，複用 openingIdx） ============== */}
      {phase === PHASES.RULES && (
        <div className="dialog-screen scene-fade">
          <div className="dialog-owner">
            <img className="owner-img" src={OWNER[TUTORIAL_POSES[openingIdx] ?? 'think']} alt="老闆" draggable={false} />
          </div>
          <div className="bubble bubble--owner dialog-bubble">
            <p>{TUTORIAL_LINES[openingIdx]}</p>
            <div className="dialog-progress">
              {TUTORIAL_LINES.map((_, i) => (
                <span key={i} className={i === openingIdx ? 'dot active' : 'dot'} />
              ))}
            </div>
            <button
              className="dialog-next"
              onClick={() => {
                if (openingIdx < TUTORIAL_LINES.length - 1) setOpeningIdx(openingIdx + 1);
                else setPhase(game ? PHASES.FLIP : PHASES.START);
              }}
            >
              {openingIdx < TUTORIAL_LINES.length - 1 ? '下一句 ▸' : '我知道了 ▸'}
            </button>
          </div>
        </div>
      )}

      {/* ============== 02-C. Gallery / 戰利品架 ============== */}
      {phase === PHASES.GALLERY && (
        <div className="gallery-screen scene-fade">
          <button className="icon-btn gallery-back" onClick={() => setPhase(PHASES.START)} aria-label="返回">◂</button>
          <div className="gallery-stats">
            <b>{collected.size}</b> / {DOLLS.length}
          </div>

          <div className="gallery-main">
            <div className="doll-shelf" style={{ backgroundImage: `url(${SHELF})` }}>
              {/* 3 排錯落：上 2、中 3、下 5（仿示意圖） */}
              {[[0, 2], [2, 5], [5, 10]].map(([start, end], rowIdx) => (
                <div key={rowIdx} className="doll-row">
                  {DOLLS.slice(start, end).map((d) => {
                    const owned = collected.has(d.id);
                    return (
                      <div
                        key={d.id}
                        className={`doll doll--${d.rarity}${owned ? '' : ' doll--locked'}`}
                      >
                        <img className="doll__img" src={d.img} alt="" draggable={false} />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <img className="gallery-owner" src={OWNER.idle} alt="老闆" draggable={false} />
          </div>
        </div>
      )}

      {/* ============== 校正手勢精靈 ============== */}
      {phase === PHASES.CALIBRATE && (() => {
        const step = CALIB_STEPS[calibStepIdx];
        const isRange = step.key === 'range';
        return (
          <div className="phase-screen scene-fade">
            <div className="phase-header">
              <h2 className="phase-title">{step.icon} 校正 {calibStepIdx + 1}/{CALIB_STEPS.length}：{step.title}</h2>
              {isRange && !calibStepDone && (
                <div className={`countdown ${rangeCountdown <= 3 ? 'countdown--warn' : ''}`}>
                  <span className="countdown__num">{rangeCountdown}</span>
                  <span className="countdown__label">秒</span>
                </div>
              )}
            </div>

            {/* 步驟進度點 */}
            <div className="calib-steps">
              {CALIB_STEPS.map((s, i) => (
                <span
                  key={s.key}
                  className={`calib-step-dot${i === calibStepIdx ? ' active' : ''}${i < calibStepIdx ? ' done' : ''}`}
                >
                  {i < calibStepIdx ? '✓' : s.icon}
                </span>
              ))}
            </div>

            <div className="calib-body">
              <div className="calib-camera">
                <HandTracker
                  onGesture={onCalibGesture}
                  fallback={<HandMock />}
                  activeZone={handZone}
                  extraGestures
                />
                {calibStepDone && <div className="calib-check">✓</div>}
              </div>
              <div className="bubble bubble--player calib-hint">
                <span className="mock__tag">{step.title}</span>
                {step.hint}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              {!isRange && (
                <button className="btn-mock btn-mock--small" onClick={advanceCalibStep}>
                  偵測不到？跳過這步
                </button>
              )}
              <button
                className="btn-mock btn-mock--small"
                onClick={() => setPhase(afterCalibRef.current)}
              >
                跳過全部校正
              </button>
            </div>
          </div>
        );
      })()}

      {/* ============== Phase 1 — 展牌記憶 ============== */}
      {phase === PHASES.MEMORIZE && game && (
        <div className="phase-screen phase-screen--full scene-fade">
          <div className="memorize-hint">記住牌的位置！</div>
          <div className={`count-float ${countdown <= 3 ? 'count-float--warn' : ''}`}>
            {countdown}
          </div>
          <div className="board-wrap board-wrap--big">
            <Board tiles={game.bingoTarget} mode="face-up" />
          </div>
        </div>
      )}

      {/* ============== Phase 2 — 蓋牌洗牌 ============== */}
      {phase === PHASES.SHUFFLE && game && liveArr && (
        <div className="phase-screen phase-screen--full scene-fade">
          <div className="board-wrap board-wrap--big">
            <Board tiles={liveArr} mode="face-down" movingIds={movingIds} />
          </div>
          {/* 隱藏段：台式鞭炮特效 overlay */}
          {shuffleSubPhase === 'hidden' && <FireworkOverlay />}
        </div>
      )}

      {/* ============== Phase 3 — 遊戲主畫面 ============== */}
      {phase === PHASES.FLIP && game && (
        <div className="game-screen scene-fade" style={{ backgroundImage: `url(${BG_FELT})` }}>
          <div className="game-top">
            <div className="mini-owner">
              <img className="mini-owner__avatar" src={OWNER.happy} alt="老闆" draggable={false} />
              <div className="bubble bubble--owner mini-owner__say">
                {GAME_HECKLES[heckleIdx]}
              </div>
            </div>

            <div className="remain">
              <b>{testMode ? '∞' : game.flipsRemaining}</b>
              <span className="remain__sub">{Math.min(game.completedLines.length, 3)}/3</span>
            </div>

            <div className="game-top__right">
              {/* 動腦模式才有「偷看」按鈕 */}
              {mode === 'memory' && (
                <button
                  className={`btn-mock btn-mock--small${peekMode ? ' btn-mock--active' : ''}`}
                  onClick={() => setPeekMode((v) => !v)}
                  disabled={peeksRemaining <= 0}
                >
                  🔍 ({peeksRemaining})
                </button>
              )}
              <ImgButton
                className="hud-tutorial-btn"
                src={BTN_TUTORIAL} hoverSrc={BTN_TUTORIAL_HOVER} alt="教學"
                onClick={goRules}
              />
            </div>
          </div>

          <div className="game-row">
            <div className="area">
              <div className="board-wrap board-wrap--game">
                <Board
                  tiles={visibleShuffleArea}
                  mode="shuffle-area"
                  onTileClick={(pos) => handleFlip(pos)}
                  peekingPos={peekingPos}
                  blurPeekPos={blurPeekPos}
                  showHoverPeek
                  gestureHoverPos={gestureHoverPos}
                />
              </div>
            </div>

            <div className="area">
              <div className="board-wrap board-wrap--game">
                <BingoBoard
                  target={game.bingoTarget}
                  revealed={game.bingoRevealed}
                  glowingCells={glowingCells}
                />
              </div>
            </div>

            <div className="area camera-area">
              <div className="camera-box">
                <HandTracker
                  onGesture={handleGesture}
                  fallback={<HandMock />}
                  cellOccupied={visibleShuffleArea?.map((id) => id !== null && id !== undefined)}
                  activeZone={handZone}
                  extraGestures
                />
              </div>
              <div className="camera-hint">
                {currentGesture === GESTURE_NONE && '伸食指對準金框 → 比 YA 翻牌'}
                {currentGesture === GESTURE_POINT && gestureHoverPos !== null && (
                  <>☝ ({Math.floor(gestureHoverPos / 6)},{gestureHoverPos % 6})</>
                )}
                {currentGesture === GESTURE_POINT && gestureHoverPos === null && '☝ 框外'}
                {currentGesture === GESTURE_PEACE && '✌ 翻牌！'}
                {currentGesture === GESTURE_OPEN && '✋ 偷瞄'}
                {currentGesture === GESTURE_FLIP && '🫳 偷看'}
              </div>

              <div className="gesture-guide">
                <div className={`gesture-guide__item${currentGesture === GESTURE_POINT ? ' is-active' : ''}`}>
                  <span className="gesture-guide__icon">☝</span>
                  <span className="gesture-guide__label">伸食指</span>
                  <span className="gesture-guide__action">移動</span>
                </div>
                <div className={`gesture-guide__item${currentGesture === GESTURE_PEACE ? ' is-active' : ''}`}>
                  <span className="gesture-guide__icon">✌</span>
                  <span className="gesture-guide__label">比 YA</span>
                  <span className="gesture-guide__action">翻牌</span>
                </div>
                <div className={`gesture-guide__item${currentGesture === GESTURE_OPEN ? ' is-active' : ''}`}>
                  <span className="gesture-guide__icon">✋</span>
                  <span className="gesture-guide__label">張手</span>
                  <span className="gesture-guide__action">模糊偷瞄</span>
                </div>
                {mode === 'memory' && (
                  <div className={`gesture-guide__item${currentGesture === GESTURE_FLIP ? ' is-active' : ''}`}>
                    <span className="gesture-guide__icon">🫳</span>
                    <span className="gesture-guide__label">彎食指</span>
                    <span className="gesture-guide__action">完整偷看 ({peeksRemaining})</span>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ============== Phase 4 — 結算 ============== */}
      {phase === PHASES.RESULT && (() => {
        const lines = game ? Math.min(game.completedLines.length, 3) : 0;
        return (
          <div className="result-screen scene-fade">
            {/* 大老闆右側站立 */}
            <img
              className="result-owner-big"
              src={lines >= 1 ? OWNER.happy : OWNER.idle}
              alt="老闆"
              draggable={false}
            />

            {/* 對話框左上角 */}
            <div className="bubble bubble--owner result-bubble">
              {resultLine(lines)}
            </div>

            {/* 獲得的娃娃，置中 */}
            {newDoll && (
              <div className={`prize-card prize-card--${newDoll.rarity}`}>
                <span className="prize-card__banner">★ 新獲得 ★</span>
                <img className="prize-card__img" src={newDoll.img} alt="" draggable={false} />
              </div>
            )}

            {/* 按鈕：左下 */}
            <div className="result-actions">
              <ImgButton className="title-img-btn" src={BTN_GALLERY} hoverSrc={BTN_GALLERY_HOVER}
                alt="戰利品架" onClick={() => setPhase(PHASES.GALLERY)} />
              <ImgButton className="title-img-btn" src={BTN_START} hoverSrc={BTN_START_HOVER}
                alt="再來一局" onClick={() => setPhase(PHASES.START)} />
            </div>
          </div>
        );
      })()}

      {/* 翻牌飛行 overlay（fixed positioning，最上層） */}
      {flying && (
        <div
          className="flying-tile"
          style={{
            top: `${flying.fromRect.top}px`,
            left: `${flying.fromRect.left}px`,
            width: `${flying.fromRect.width}px`,
            height: `${flying.fromRect.height}px`,
            transform: flying.arrived
              ? `translate(${flying.toRect.left - flying.fromRect.left}px, ${flying.toRect.top - flying.fromRect.top}px) scale(${flying.toRect.width / flying.fromRect.width})`
              : 'translate(0, 0) scale(1)',
          }}
        >
          <span className="flying-tile__face">
            {TILE_BY_ID[flying.tileId].label}
          </span>
        </div>
      )}

    </div>
  );
}

export default App;
