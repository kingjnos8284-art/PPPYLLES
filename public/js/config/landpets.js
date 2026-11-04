// @ts-check
/**
 * 陸地寵物：永遠不會死亡，可以點擊互動。
 *
 * price        購買價格（0 = 初始贈送）
 * bonus        擁有時全體魚隻產出加成（0.05 = +5%）
 * tapReward    點擊互動時，獎勵「目前每秒產出 × 秒數」
 * shape        占位圖形
 */

/**
 * @typedef {Object} LandPetType
 * @property {string} id
 * @property {string} name
 * @property {string} desc
 * @property {number} price
 * @property {number} bonus
 * @property {number} tapReward
 * @property {number} size
 * @property {number} speed
 * @property {'crab'|'turtle'|'capybara'} shape
 * @property {string} color
 */

/** @type {LandPetType[]} */
export const LAND_PETS = [
  {
    id: 'crab', name: '寄居蟹', desc: '在沙地上慢慢散步的小傢伙，摸摸牠會害羞地縮進殼裡。',
    price: 0, bonus: 0.02, tapReward: 20, size: 34, speed: 18, shape: 'crab', color: '#ff7a5c',
  },
  {
    id: 'turtle', name: '陸龜', desc: '慢條斯理的老朋友，陪伴牠會讓整個水族箱更有活力。',
    price: 1500, bonus: 0.05, tapReward: 30, size: 52, speed: 9, shape: 'turtle', color: '#6fbf73',
  },
  {
    id: 'capybara', name: '水豚', desc: '世界上最放鬆的動物，只要牠在，大家都很安心。',
    price: 12000, bonus: 0.1, tapReward: 45, size: 70, speed: 12, shape: 'capybara', color: '#b58457',
  },
];

/** @param {string} id */
export function getLandPet(id) {
  const p = LAND_PETS.find((x) => x.id === id);
  if (!p) throw new Error(`未知的陸地寵物：${id}`);
  return p;
}
