# Lottie 動畫資料夾

把 Lottie JSON 檔放到這裡，前端會自動載入。

## 目前用到的檔名

| 檔名 | 用途 | 載入位置 | 沒檔時的 fallback |
|---|---|---|---|
| `firework.json` | Phase 2 主特效（鞭炮 or 煙火）| `<FireworkOverlay>` | 原本的 CSS 鞭炮（已內建）|
| `firework2.json` | Phase 2 疊加層（可選，例如鞭炮+煙火組合）| `<FireworkOverlay>` | 不顯示（單一 firework 就夠）|
| `confetti.json` | Phase 4 結算撒花 | `<ResultScreen>` | （目前無 fallback）|
| `flame.json` | （預留）翻牌飛行時的尾燄 | `<FlyingTile>` | 純位移 |

> 第二層 `firework2.json` 用 `mix-blend-mode: screen` 疊加，亮的部分會混合、暗的會透明，適合把鞭炮 + 煙火兩個動畫一起放。

## 怎麼找 Lottie 檔

### 1. LottieFiles（最大資源庫）
- 網址：https://lottiefiles.com/
- 搜尋關鍵字：`firework`、`firecracker`、`confetti`、`chinese new year`、`celebration`
- 注意 **License**：
  - **Free** 標籤可商用
  - **Premium** 需訂閱
  - **Lottie Files Free License** 可商用但要保留 credit
- 點動畫後選 **Download Lottie JSON**（不是 .lottie 檔，要 .json）

### 2. IconScout / Storyset / Pixabay
- 也有免費 Lottie 資源
- 同樣注意 license

### 3. 美術自己做
- After Effects + **Bodymovin** 插件導出 JSON
- 規則：
  - 不要用太多 expression（lottie-web 不支援所有）
  - shape layer 比 image layer 通用
  - 控制 FPS 在 30 以內
  - 檔案大小盡量 < 200KB

## 推薦的台味鞭炮 / 煙火搜尋

```
fireworks         // 煙火
firecracker       // 鞭炮
chinese new year  // 過年
celebration       // 慶祝
confetti          // 彩花
sparkle           // 閃光
```

## 用法（已寫好）

```jsx
import { LottieFx } from '../components/LottieFx';

// 從 public/lotties 路徑載入
<LottieFx path="/lotties/firework.json" loop />

// 或 import 進來（小檔可以這樣）
import data from './firework.json';
<LottieFx animationData={data} />

// 沒檔案時走 fallback
<LottieFx
  path="/lotties/firework.json"
  fallback={<CssFireworkFallback />}
/>
```
