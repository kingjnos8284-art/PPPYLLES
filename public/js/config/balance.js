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

  /** 水母在畫面上的大小倍率。1 = 美術原始設定大小，數字越小越小 */
  creatureScale: 0.6,
  /** 水母游動速度倍率。1 = species.js 設定的速度 */
  swimSpeed: 2,
  /** 水母每次游動的距離（佔水族箱寬度的比例，0~1）。越大游得越遠 */
  swimRange: 0.7,

  /** 水族箱最多可養幾隻魚 */
  tankCapacity: 12,

  /** 離線收益上限（小時） */
  offlineCapHours: 6,
  /** 離開超過幾秒才顯示「離線收益」視窗 */
  offlinePopupMinSec: 60,

  /** 自動存檔間隔（秒） */
  autosaveSec: 10,
  /** 陸地寵物點擊互動冷卻（秒） */
  petTapCooldownSec: 60,

};


/** 目前的水族箱容量 */
export function tankCapacity() {
  return TEST_MODE.enabled ? TEST_MODE.tankCapacity : BALANCE.tankCapacity;
}

/** 實際購買價格（測試模式免費） @param {number} price */
export function priceOf(price) {
  return TEST_MODE.enabled && TEST_MODE.freeShop ? 0 : price;
}
