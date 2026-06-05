// Lottie 通用包裝元件
// 用法：
//   1. import JSON 直接傳：
//      import data from '../lotties/firework.json';
//      <LottieFx animationData={data} />
//
//   2. 從 public 路徑載入：
//      <LottieFx path="/lotties/firework.json" />
//      會自動考慮 vite 的 base URL（GitHub Pages 部署時前綴會對）
//
//   3. 沒檔案 / 載入失敗 / Lottie 渲染 throw 時，自動 fallback：
//      <LottieFx path="/lotties/firework.json" fallback={<CssFirework />} />

import { Component, useEffect, useState } from 'react';
import Lottie from 'lottie-react';

/* 包住 <Lottie> — 如果它在 render 時 throw（例如 JSON 用了 lottie-web 不支援的 expression）
   就 fallback 而不是讓錯誤冒到外層把整個 app 弄壞 */
class LottieBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    console.error('[LottieFx] Lottie render error:', error);
  }
  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}

export function LottieFx({
  animationData,
  path,
  loop = true,
  autoplay = true,
  style,
  className,
  fallback = null,
  onComplete,
}) {
  const [state, setState] = useState(animationData ? 'ready' : 'loading');
  const [data, setData] = useState(animationData ?? null);

  useEffect(() => {
    if (animationData) {
      setData(animationData);
      setState('ready');
      return;
    }
    if (!path) {
      setState('failed');
      return;
    }
    let cancelled = false;
    setState('loading');

    const fullPath = path.startsWith('http') || path.startsWith('//')
      ? path
      : `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

    fetch(fullPath)
      .then((r) => (r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)))
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setState('ready');
      })
      .catch((err) => {
        console.warn(`[LottieFx] Failed to load ${fullPath}:`, err);
        if (!cancelled) setState('failed');
      });

    return () => { cancelled = true; };
  }, [animationData, path]);

  if (state === 'failed') return fallback;
  if (state === 'loading') return fallback ?? null;
  return (
    <LottieBoundary fallback={fallback}>
      <Lottie
        animationData={data}
        loop={loop}
        autoplay={autoplay}
        style={style}
        className={className}
        onComplete={onComplete}
      />
    </LottieBoundary>
  );
}
