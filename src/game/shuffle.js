// Fisher-Yates 洗牌（純函數，不變動入參）
export function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 模擬「人手洗牌」的軌跡：分輪、每輪同時換多對
// 視覺特色：玩家看得到每張牌的移動（單張不會太快）
// 回傳 { finalArray, steps: snapshot[] }
//   steps[i] = 第 i 輪結束後的完整陣列快照
export function humanLikeShuffleTrace(arr, rng = Math.random, {
  rounds = 10,         // 洗幾輪
  pairsPerRound = 3,   // 每輪同時交換幾對牌
} = {}) {
  const current = [...arr];
  const steps = [];

  for (let r = 0; r < rounds; r++) {
    const used = new Set();
    for (let p = 0; p < pairsPerRound; p++) {
      let i, j;
      let attempts = 0;
      do {
        i = Math.floor(rng() * current.length);
        j = Math.floor(rng() * current.length);
        attempts++;
      } while ((i === j || used.has(i) || used.has(j)) && attempts < 30);

      if (attempts >= 30) break; // 找不到不衝突的位置，這輪提早結束

      used.add(i);
      used.add(j);
      [current[i], current[j]] = [current[j], current[i]];
    }
    steps.push(current.slice()); // 整輪結束才存 snapshot
  }

  return { finalArray: current, steps };
}
