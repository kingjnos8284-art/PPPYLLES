// @ts-check
/**
 * 測試模式：正式上線前改成 false。
 *   freeShop      所有購買不花資源
 *   codexAll      圖鑑全部顯示（不會寫進存檔，關閉後恢復正常）
 *   tankCapacity  測試時的水族箱容量（方便一次放入全部種類）
 *   tools         設定頁出現「測試工具」（快轉時間、清空水族箱等）
 */
export const TEST_MODE = {
  enabled: true,
  freeShop: true,
  codexAll: true,
  tankCapacity: 30,
  tools: true,
};

/**
 * 遊戲整體數值。調整節奏時優先改這裡。
 */
export const BALANCE = {
  /** 新玩家起始資源 */
  startCoins: 50,
  /** 新玩家起始魚種（固定灰色品質）與陸地寵物 */
  starterFish: 'star_blue',
  starterPet: 'cat_tuxedo',

  /** 水族箱最多可養幾隻魚 */
  tankCapacity: 12,

  /** 離線收益上限（小時） */
  offlineCapHours: 6,
  /**
   * 離線期間魚的成長與老化是否也只算到上限為止。
   * true：離開 3 天回來，魚只老了 6 小時（較溫和，魚不會在玩家不在時大量死亡）
   * false：魚照真實時間老化，但收益仍只算 6 小時
   */
  offlineAgingCapped: true,
  /** 離開超過幾秒才顯示「離線收益」視窗 */
  offlinePopupMinSec: 60,

  /** 自動存檔間隔（秒） */
  autosaveSec: 10,
  /** 陸地寵物點擊互動冷卻（秒） */
  petTapCooldownSec: 60,

  /**
   * 成長階段。
   * until：以「到成魚所需時間」或「壽命」的比例界定
   *   fry       幼魚   0 ~ 成魚時間 × 0.4
   *   juvenile  成長期 ~ 成魚時間
   *   adult     成魚   ~ 壽命 × 0.85
   *   elder     年老   ~ 壽命（到期後自然離世）
   */
  stages: {
    fry:      { name: '幼體',   incomeMult: 0.3, scale: 0.55 },
    juvenile: { name: '成長期', incomeMult: 0.6, scale: 0.7 },
    adult:    { name: '成年',   incomeMult: 1.0, scale: 1.0 },
    elder:    { name: '年老',   incomeMult: 0.7, scale: 1.0 },
  },
  fryFraction: 0.4,
  elderFraction: 0.85,
};

/** @typedef {keyof typeof BALANCE.stages} StageId */

/** 目前的水族箱容量 */
export function tankCapacity() {
  return TEST_MODE.enabled ? TEST_MODE.tankCapacity : BALANCE.tankCapacity;
}

/** 實際購買價格（測試模式免費） @param {number} price */
export function priceOf(price) {
  return TEST_MODE.enabled && TEST_MODE.freeShop ? 0 : price;
}
