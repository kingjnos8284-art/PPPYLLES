// @ts-check
/**
 * 品質系統：灰 > 綠 > 紫 > 金 > 紅
 * weight      購買魚苗時抽到的機率權重（總和不必是 100）
 * incomeMult  資源產出倍率
 * aura        是否在水族箱中顯示光暈
 */

/** @typedef {'gray'|'green'|'purple'|'gold'|'red'} QualityId */

/**
 * @typedef {Object} Quality
 * @property {QualityId} id
 * @property {string} name
 * @property {string} color
 * @property {number} weight
 * @property {number} incomeMult
 * @property {boolean} aura
 */

/** @type {Quality[]} */
export const QUALITIES = [
  { id: 'gray',   name: '灰', color: '#9aa4ad', weight: 60, incomeMult: 1,   aura: false },
  { id: 'green',  name: '綠', color: '#4cd17a', weight: 25, incomeMult: 1.6, aura: false },
  { id: 'purple', name: '紫', color: '#a86bff', weight: 10, incomeMult: 2.8, aura: true },
  { id: 'gold',   name: '金', color: '#ffc83d', weight: 4,  incomeMult: 5,   aura: true },
  { id: 'red',    name: '紅', color: '#ff4d5e', weight: 1,  incomeMult: 10,  aura: true },
];

/** @param {string} id */
export function getQuality(id) {
  return QUALITIES.find((q) => q.id === id) ?? QUALITIES[0];
}
