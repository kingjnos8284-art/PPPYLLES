// @ts-check
/**
 * 陸地寵物：住在房間裡（貓在貓跳台、狗在狗窩旁），永遠不會死亡，可以點擊互動。
 *
 * kind         'cat' 貓 / 'dog' 狗：決定牠會待在背景的哪一種位置
 * price        購買價格（0 = 初始贈送）
 * bonus        擁有時全體水中夥伴產出加成（0.05 = +5%）
 * tapReward    點擊互動時，獎勵「目前每秒產出 × 秒數」
 * size / speed / shape / color   沒有美術或背景沒有指定位置時使用的占位設定
 */

/**
 * @typedef {Object} LandPetType
 * @property {string} id
 * @property {'cat'|'dog'} kind
 * @property {string} name
 * @property {string} breed      品種（顯示在名字下方）
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
    id: 'cat_tuxedo', kind: 'cat', name: 'OREO', breed: '賓士貓',
    desc: '金色眼睛的賓士貓，最喜歡窩在貓跳台上看水母漂來漂去。',
    price: 0, bonus: 0.1, tapReward: 20, size: 70, speed: 12, shape: 'capybara', color: '#2b2b33',
  },
  {
    id: 'cat_tabby', kind: 'cat', name: 'LUNA', breed: '虎斑貓',
    desc: '金色眼睛的虎斑貓，好奇心旺盛，常常盯著水母一看就是好久。',
    price: 5000, bonus: 0.1, tapReward: 25, size: 70, speed: 12, shape: 'capybara', color: '#7a5c44',
  },
  {
    id: 'dog_dachshund', kind: 'dog', name: 'NANA', breed: '長毛臘腸',
    desc: '黑卡其色的長毛臘腸狗，總是守在狗窩前，摸摸頭就會開心搖尾巴。',
    price: 5000, bonus: 0.1, tapReward: 30, size: 80, speed: 10, shape: 'capybara', color: '#3a2a1e',
  },
];

/** @param {string} id */
export function hasLandPet(id) {
  return LAND_PETS.some((x) => x.id === id);
}

/** @param {string} id */
export function getLandPet(id) {
  const p = LAND_PETS.find((x) => x.id === id);
  if (!p) throw new Error(`未知的陸地寵物：${id}`);
  return p;
}
