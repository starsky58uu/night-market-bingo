// 手勢辨識元件
// - 用 MediaPipe Tasks Vision 抓 21 點手部 landmark
// - 自己寫規則判定「握拳 / 張手 / 指向 / 比二 / 搖手」
// - 失敗時顯示原因 + 提供重試
//
// 用法：
//   <HandTracker onGesture={(g) => console.log(g)} />
//
// 第一次載入會從 CDN 抓 ~5MB 的 wasm + .task 模型，會慢一下。

import { useCallback, useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm';

/* 棋盤 grid 大小 + 鏡頭內「有效控制區」(視覺座標 0~1)
   範圍設在手的「舒適活動區」：手在鏡頭中段小幅移動就能掃過 6 排，
   不必把手伸到畫面最底（之前 0.98 根本構不到最下排）。
   App.jsx 跟 HandTracker 都用同一份，確保鏡頭顯示的格子跟翻牌位置一致 */
export const CURSOR_GRID_SIZE = 6;
export const CURSOR_ACTIVE_ZONE = { x: [0.15, 0.85], y: [0.2, 0.8] };

// 對 App 的訊號標籤
export const GESTURE_POINT = '指向';   // 食指伸直、其他三指彎 → 移動 cursor
export const GESTURE_FLIP = '翻牌';    // 從指向狀態食指彎下 → 翻當前格
export const GESTURE_OPEN = '張手';    // 五指張開（校正/預留功能用）
export const GESTURE_PEACE = '比二';   // 食指+中指伸、其餘彎（校正/預留功能用）
export const GESTURE_NONE = '—';

/* 判定每根手指的伸/彎
   座標：x/y 都是 0~1，y 朝下。tip.y 比 pip.y 小 = 指尖在上 = 伸直 */
const EXT_MARGIN = 0.03;   // 伸直門檻
const BENT_MARGIN = 0.015; // 彎曲門檻（比伸直寬鬆，因為彎下時 y 變化沒那麼大）

function fingerState(tip, pip) {
  if (tip.y < pip.y - EXT_MARGIN) return 'ext';
  if (tip.y > pip.y - BENT_MARGIN) return 'bent';
  return 'mid';
}

/* 回傳手部狀態：
   - indexExt   食指明確伸直
   - indexBent  食指明確彎曲
   - othersBent 中指+無名指+小指 都彎曲（撥頭髮/張手時這三指通常不會同時彎）
*/
/* 檢查關鍵 landmark 是否都在鏡頭內（不貼邊）— 太靠邊時 mediapipe 估計不準 */
function isHandInFrame(landmarks) {
  // 檢查食指尖、中指尖、手腕（最關鍵的點）
  const SAFE = 0.05; // 距邊緣 5% 內視為「快出框」不可信
  const checkPts = [0, 4, 8, 12, 16, 20]; // 手腕 + 5 個指尖
  return checkPts.every((i) => {
    const p = landmarks[i];
    return p.x > SAFE && p.x < 1 - SAFE && p.y > SAFE && p.y < 1 - SAFE;
  });
}

function analyzeHand(landmarks) {
  const index = fingerState(landmarks[8], landmarks[6]);
  const middle = fingerState(landmarks[12], landmarks[10]);
  const ring = fingerState(landmarks[16], landmarks[14]);
  const pinky = fingerState(landmarks[20], landmarks[18]);
  const othersBent = middle === 'bent' && ring === 'bent' && pinky === 'bent';
  return {
    indexExt: index === 'ext',
    indexBent: index === 'bent',
    middleExt: middle === 'ext',
    ringExt: ring === 'ext',
    pinkyExt: pinky === 'ext',
    othersBent,
    // 五指張開（含拇指就不檢查，四指都伸即可）
    allExt: index === 'ext' && middle === 'ext' && ring === 'ext' && pinky === 'ext',
    // 比二：食指+中指明顯伸，無名小指「不伸直」即可（mid 或 bent 都算）
    // 放寬無名小指條件，因為比 YA 時這兩指自然狀態通常是 mid 而非 bent
    peace: index === 'ext' && middle === 'ext' && ring !== 'ext' && pinky !== 'ext',
  };
}

export function HandTracker({
  onGesture,
  fallback = null,
  cellOccupied = null,
  activeZone = CURSOR_ACTIVE_ZONE,
  extraGestures = false,  // 校正時開啟：額外偵測張手/比二
}) {
  // cellOccupied: boolean[36] — 洗牌區哪些格還有牌，畫進鏡頭 grid 當「第二副牌」
  const cellOccupiedRef = useRef(cellOccupied);
  cellOccupiedRef.current = cellOccupied;
  // activeZone: 校正後的手部活動範圍（視覺座標）
  const activeZoneRef = useRef(activeZone);
  activeZoneRef.current = activeZone;
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const landmarkerRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  // 手勢狀態機
  //   'idle'     沒在指（或撥頭髮等無效姿勢）
  //   'pointing' 穩定指向中，可移動 cursor / 等待彎指翻牌
  // POINT_STABLE：要連續幾幀「指向」才進入 pointing（避免閃進閃出）
  // 進入 pointing 前要穩定，才不會撥頭髮瞬間誤觸
  const POINT_STABLE = 3;
  const POINT_LOOKBACK = 6;
  // 指向→彎曲的過渡寬容幀數：這期間 cursor 鎖住不動，等彎好觸發翻牌
  const GRACE_FRAMES = 12;
  const fsmRef = useRef({ state: 'idle', pointCount: 0, buffer: [], grace: 0 });
  // 張手/比二的防抖（校正用）
  const extraGesturesRef = useRef(extraGestures);
  extraGesturesRef.current = extraGestures;
  const extraStableRef = useRef({ candidate: GESTURE_NONE, count: 0 });
  const EXTRA_STABLE = 3;

  // 用 ref 存 callback，避免 onGesture 每次 render 換 reference 觸發整個 mediapipe 重 init
  const onGestureRef = useRef(onGesture);
  useEffect(() => { onGestureRef.current = onGesture; }, [onGesture]);

  const [status, setStatus] = useState('init');
  // 'init' | 'loading-model' | 'opening-camera' | 'running' | 'error' | 'denied'
  const [gesture, setGesture] = useState(GESTURE_NONE);
  const [errMsg, setErrMsg] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (landmarkerRef.current) {
      try { landmarkerRef.current.close(); } catch { /* noop */ }
      landmarkerRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setStatus('loading-model');
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        if (cancelled) return;
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numHands: 1,
        });
        if (cancelled) return;
        landmarkerRef.current = landmarker;

        setStatus('opening-camera');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;
        setStatus('running');

        const tick = () => {
          if (cancelled) return;
          const v = videoRef.current;
          if (v && v.readyState >= 2 && landmarkerRef.current) {
            const result = landmarkerRef.current.detectForVideo(v, performance.now());
            if (result.landmarks?.length > 0) {
              const landmarks = result.landmarks[0];
              const hand = analyzeHand(landmarks);
              const indexTip = landmarks[8];
              const point = { x: indexTip.x, y: indexTip.y };
              const fsm = fsmRef.current;

              // 「指向」= 食指伸 + 其他三指彎（撥頭髮通常不滿足「其他三指都彎」）
              const isPointing = hand.indexExt && hand.othersBent;
              // 「翻牌扳機」= 在 pointing 狀態下，食指彎下
              const isFlipTrigger =
                fsm.state === 'pointing' && hand.indexBent && hand.othersBent;

              let activePointing = false;

              if (isFlipTrigger) {
                // 翻牌：用「彎指前 LOOKBACK 幀」的位置，避免彎下時指尖偏移
                const buf = fsm.buffer;
                const payload = buf.length > 0
                  ? buf[Math.max(0, buf.length - POINT_LOOKBACK)]
                  : point;
                onGestureRef.current?.(GESTURE_FLIP, payload);
                setGesture(GESTURE_FLIP);
                // 翻完回 idle，必須重新指向才能再翻
                fsmRef.current = { state: 'idle', pointCount: 0, buffer: [], grace: 0 };
              } else if (isPointing) {
                fsm.pointCount += 1;
                fsm.grace = 0;
                fsm.buffer.push(point);
                if (fsm.buffer.length > 14) fsm.buffer.shift();
                if (fsm.state === 'pointing' || fsm.pointCount >= POINT_STABLE) {
                  fsm.state = 'pointing';
                  activePointing = true;
                  onGestureRef.current?.(GESTURE_POINT, point);
                  setGesture(GESTURE_POINT);
                }
              } else if (fsm.state === 'pointing') {
                // 過渡幀（食指彎到一半）：保持 cursor 不動，給寬容期等彎好觸發翻牌
                // 關鍵：不清 buffer、不重置、不 emit NONE → cursor 不會亂跳
                fsm.grace = (fsm.grace || 0) + 1;
                activePointing = true; // 鏡頭格子也維持高亮在原位
                if (fsm.grace > GRACE_FRAMES) {
                  fsmRef.current = { state: 'idle', pointCount: 0, buffer: [], grace: 0 };
                  onGestureRef.current?.(GESTURE_NONE, null);
                  setGesture(GESTURE_NONE);
                }
              } else {
                // idle 狀態：校正模式額外偵測張手/比二（防抖）
                fsm.pointCount = 0;
                if (extraGesturesRef.current) {
                  // 只在手「完整在框內」才接受 → 跑出鏡頭時不誤判
                  const inFrame = isHandInFrame(landmarks);
                  const extra = !inFrame ? GESTURE_NONE
                    : hand.allExt ? GESTURE_OPEN
                    : hand.peace ? GESTURE_PEACE
                    : GESTURE_NONE;
                  const s = extraStableRef.current;
                  if (extra !== GESTURE_NONE) {
                    if (s.candidate === extra) s.count += 1;
                    else { s.candidate = extra; s.count = 1; }
                    if (s.count === EXTRA_STABLE) {
                      onGestureRef.current?.(extra, null);
                      setGesture(extra);
                    }
                  } else {
                    extraStableRef.current = { candidate: GESTURE_NONE, count: 0 };
                  }
                }
              }

              drawOverlay(overlayRef.current, landmarks, activePointing, cellOccupiedRef.current, activeZoneRef.current);
            } else {
              if (fsmRef.current.state !== 'idle') {
                onGestureRef.current?.(GESTURE_NONE, null);
              }
              fsmRef.current = { state: 'idle', pointCount: 0, buffer: [], grace: 0 };
              setGesture(GESTURE_NONE);
              clearOverlay(overlayRef.current);
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        if (cancelled) return;
        console.error('[HandTracker] init failed:', err);
        const isPermission = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
        setStatus(isPermission ? 'denied' : 'error');
        // 把 err.name 也帶上，diagnoseError 才知道是哪種錯
        setErrMsg(`${err?.name ?? 'Error'}: ${err?.message ?? err}`);
      }
    }

    init();
    return () => { cancelled = true; cleanup(); };
  }, [cleanup, retryKey]);

  if (status === 'error' || status === 'denied') {
    const help = diagnoseError(errMsg);
    return (
      <div className="hand-tracker hand-tracker--error">
        {fallback}
        <div className="hand-tracker__error-msg">
          <div className="hand-tracker__error-title">{help.title}</div>
          <div className="hand-tracker__error-help">{help.help}</div>
          <div className="hand-tracker__error-detail">{errMsg}</div>
          <button
            className="btn-mock btn-mock--small"
            onClick={() => { setErrMsg(''); setStatus('init'); setRetryKey((k) => k + 1); }}
          >
            重試
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hand-tracker">
      <video ref={videoRef} playsInline muted className="hand-tracker__video" />
      <canvas ref={overlayRef} width={480} height={360} className="hand-tracker__overlay" />
      <div className="hand-tracker__badges">
        <span className="hand-tracker__status">
          {status === 'loading-model' && '載入模型⋯'}
          {status === 'opening-camera' && '開啟鏡頭⋯'}
          {status === 'running' && '辨識中'}
          {status === 'init' && '初始化⋯'}
        </span>
        {status === 'running' && (
          <span className="hand-tracker__gesture">{gesture}</span>
        )}
      </div>
    </div>
  );
}

/* 在 canvas 上畫：有效區域邊框 + 6×6 grid + 指尖所在格高亮 + 21 點骨架
   讓玩家直接看到「我手指在鏡頭哪一格 = 棋盤 cursor 哪一格」 */
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],          // thumb
  [0,5],[5,6],[6,7],[7,8],          // index
  [5,9],[9,10],[10,11],[11,12],     // middle
  [9,13],[13,14],[14,15],[15,16],   // ring
  [13,17],[17,18],[18,19],[19,20],  // pinky
  [0,17],                            // palm base
];

function drawOverlay(canvas, landmarks, isPointing, cellOccupied, zone = CURSOR_ACTIVE_ZONE) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // 有效控制區（視覺座標，畫面已被 video CSS 鏡像，所以直接用視覺 0~1）
  const x0 = zone.x[0] * w;
  const x1 = zone.x[1] * w;
  const y0 = zone.y[0] * h;
  const y1 = zone.y[1] * h;
  const cw = (x1 - x0) / CURSOR_GRID_SIZE;
  const ch = (y1 - y0) / CURSOR_GRID_SIZE;

  // 1) Active zone 邊框（金黃虛線）
  ctx.strokeStyle = 'rgba(244, 192, 65, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.setLineDash([]);

  // 2) 每格牌狀態（鏡頭 = 洗牌區的鏡像副本）
  //    有牌 → 米白色塊（蓋牌感）；已翻空 → 不畫（透出鏡頭畫面）
  if (cellOccupied) {
    for (let r = 0; r < CURSOR_GRID_SIZE; r++) {
      for (let c = 0; c < CURSOR_GRID_SIZE; c++) {
        if (!cellOccupied[r * CURSOR_GRID_SIZE + c]) continue;
        const cx = x0 + c * cw;
        const cy = y0 + r * ch;
        ctx.fillStyle = 'rgba(241, 230, 200, 0.82)';
        ctx.fillRect(cx + 1.5, cy + 1.5, cw - 3, ch - 3);
        ctx.strokeStyle = 'rgba(140, 110, 50, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx + 1.5, cy + 1.5, cw - 3, ch - 3);
      }
    }
  }

  // 3) 6×6 grid 線
  ctx.strokeStyle = 'rgba(244, 192, 65, 0.3)';
  ctx.lineWidth = 1;
  for (let i = 1; i < CURSOR_GRID_SIZE; i++) {
    const fx = x0 + cw * i;
    ctx.beginPath(); ctx.moveTo(fx, y0); ctx.lineTo(fx, y1); ctx.stroke();
    const fy = y0 + ch * i;
    ctx.beginPath(); ctx.moveTo(x0, fy); ctx.lineTo(x1, fy); ctx.stroke();
  }

  // 5) 食指尖（指向手勢的判斷依據）— 在視覺座標
  const indexTip = landmarks[8];
  const tipX = (1 - indexTip.x) * w;  // 視覺鏡像
  const tipY = indexTip.y * h;

  // 6) 指尖所在格實心發光 — 指向中一律畫，超出 active zone clamp 到邊排
  //    跟棋盤 cursor 完全同步（App.jsx 也是 clamp）
  if (isPointing) {
    const last = CURSOR_GRID_SIZE - 1;
    const col = Math.min(last, Math.max(0, Math.floor((tipX - x0) / cw)));
    const row = Math.min(last, Math.max(0, Math.floor((tipY - y0) / ch)));
    const cellX = x0 + col * cw;
    const cellY = y0 + row * ch;
    // 實心金黃發光（蓋過牌色塊，明顯標示「我選這格」）
    ctx.fillStyle = 'rgba(232, 179, 57, 0.85)';
    ctx.fillRect(cellX + 1, cellY + 1, cw - 2, ch - 2);
    ctx.strokeStyle = 'rgba(255, 220, 100, 1)';
    ctx.lineWidth = 3;
    ctx.strokeRect(cellX + 1, cellY + 1, cw - 2, ch - 2);
    // 標籤 (row,col)
    ctx.fillStyle = 'rgba(20, 16, 12, 0.95)';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${row},${col}`, cellX + cw / 2, cellY + ch / 2);
  }

  // 5) 21 點骨架（mediapipe 原始座標，配合 ctx scale(-1,1) 變視覺鏡像）
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.strokeStyle = 'rgba(230, 57, 70, 0.85)';
  ctx.lineWidth = 2;
  HAND_CONNECTIONS.forEach(([a, b]) => {
    ctx.beginPath();
    ctx.moveTo(landmarks[a].x * w, landmarks[a].y * h);
    ctx.lineTo(landmarks[b].x * w, landmarks[b].y * h);
    ctx.stroke();
  });
  ctx.fillStyle = 'rgba(230, 57, 70, 0.95)';
  landmarks.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  // 食指尖加大圓點（最關鍵的一點）
  ctx.fillStyle = 'rgba(232, 179, 57, 1)';
  ctx.beginPath();
  ctx.arc(landmarks[8].x * w, landmarks[8].y * h, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function clearOverlay(canvas) {
  if (!canvas) return;
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

/* 根據錯誤類型給玩家具體 troubleshoot 建議 */
function diagnoseError(msg) {
  // 安全 context 檢查（HTTPS 或 localhost 才行）
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return {
      title: '⚠ 不安全的環境',
      help: `getUserMedia 需要 HTTPS 或 localhost。目前位置：${location.origin}`,
    };
  }
  if (msg.includes('NotAllowedError') || msg.includes('PermissionDeniedError')) {
    return {
      title: '⚠ 鏡頭權限被拒絕',
      help: '點網址列左邊的鎖頭 / ⓘ 圖示 → 把「相機」設成允許 → 重新整理。Windows 也檢查：設定 → 隱私 → 相機 → 允許桌面 app 使用。',
    };
  }
  if (msg.includes('NotFoundError') || msg.includes('DevicesNotFoundError')) {
    return {
      title: '⚠ 找不到鏡頭',
      help: '電腦沒接鏡頭，或鏡頭被系統停用。檢查裝置管理員。',
    };
  }
  if (msg.includes('NotReadableError') || msg.includes('TrackStartError')) {
    return {
      title: '⚠ 鏡頭被其他程式佔用',
      help: '關閉 Teams / Zoom / OBS / 其他開鏡頭的分頁，再重試。',
    };
  }
  if (msg.includes('OverconstrainedError')) {
    return {
      title: '⚠ 鏡頭不支援要求的解析度',
      help: '這台鏡頭可能太舊或不支援 320×240。',
    };
  }
  if (msg.includes('Failed to fetch') || msg.includes('Network') || msg.includes('HTTP')) {
    return {
      title: '⚠ 模型 / WASM 載入失敗',
      help: '從 CDN 抓 mediapipe 失敗。檢查網路連線、或公司網路是否擋了 storage.googleapis.com / jsdelivr.net。',
    };
  }
  return {
    title: '⚠ 鏡頭初始化失敗',
    help: '請看下方錯誤訊息；F12 → Console 也有完整 stack。',
  };
}
