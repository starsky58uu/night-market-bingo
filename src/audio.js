// 簡單音訊管理（原生 Audio）
// BGM 循環、音效一次性、語音同時只播一個

let bgm = null;
let voice = null;

export function playBgm(src, volume = 0.35) {
  if (!src) return;
  // 已建立過：若被瀏覽器擋住而暫停，補播一次
  if (bgm) {
    if (bgm.paused) bgm.play().catch(() => {});
    return;
  }
  bgm = new Audio(src);
  bgm.loop = true;
  bgm.volume = volume;
  bgm.play().catch(() => {}); // 自動播放被擋就靜默，等使用者互動再補播
}

export function stopBgm() {
  if (bgm) { bgm.pause(); bgm = null; }
}

export function playSfx(src, volume = 0.7) {
  if (!src) return;
  const a = new Audio(src);
  a.volume = volume;
  a.play().catch(() => {});
}

// 播語音（會打斷上一句），回傳 Audio 以便接 onended
export function playVoice(src, volume = 1) {
  stopVoice();
  if (!src) return null;
  voice = new Audio(src);
  voice.volume = volume;
  voice.play().catch(() => {});
  return voice;
}

export function stopVoice() {
  if (voice) { voice.pause(); voice = null; }
}
