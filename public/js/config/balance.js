// @ts-check
/**
 * 遊戲整體數值。調整節奏時優先改這裡。
 */
export const BALANCE = {
  /** 新玩家起始資源 */
  startCoins: 50,
  /** 新玩家起始魚種（固定灰色品質）與陸地寵物 */
  starterFish: 'star_blue',
  starterPet: 'crab',

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
