// @ts-check
/**
 * 水中寵物設定（目前全部為水母；kind 'fish' 保留給日後的小魚）。
 * 新增種類只要在這裡加一筆，並在 /assets/manifest.json 登記美術，商店與圖鑑會自動出現。
 *
 * kind       'jelly' 水母 / 'fish' 小魚
 * price      購買價格
 * income     成年時每秒產出的資源
 * adultMin   從寶寶長到成年需要的分鐘數
 * size       顯示大小（基準單位；水母為整格動畫圖的寬度，會再乘上 BALANCE.creatureScale）
 * speed      游動速度
 * shape      無美術時的占位圖形
 * colors     占位圖用的 [主色, 輔色]
 */

/**
 * @typedef {Object} Species
 * @property {string} id
 * @property {'jelly'|'fish'} kind
 * @property {string} name
 * @property {string} desc
 * @property {number} price
 * @property {number} income
 * @property {number} adultMin
 * @property {number} size
 * @property {number} speed
 * @property {'fish'|'tall'|'round'|'long'|'jelly'} shape
 * @property {[string, string]} colors
 */

/** @type {Species[]} */
export const SPECIES = [
  // ===== 水母 =====
  {
    id: 'star_blue', kind: 'jelly', name: '星光水母', desc: '傘上閃著一顆小星星，是每座水族箱最初的夥伴。',
    price: 50, income: 0.2, adultMin: 5, size: 105, speed: 16,
    shape: 'jelly', colors: ['#7fb2ff', '#cfe3ff'],
  },
  {
    id: 'sakura', kind: 'jelly', name: '櫻花水母', desc: '傘頂開著一朵櫻花，漂浮時像花瓣在水中飛舞。',
    price: 150, income: 0.6, adultMin: 15, size: 108, speed: 16,
    shape: 'jelly', colors: ['#ff9ec7', '#ffe0ee'],
  },
  {
    id: 'leaf', kind: 'jelly', name: '綠葉水母', desc: '觸手長成了葉子的模樣，看起來就像一株會游泳的植物。',
    price: 300, income: 1.1, adultMin: 25, size: 110, speed: 15,
    shape: 'jelly', colors: ['#7ad968', '#d8ffc9'],
  },
  {
    id: 'flame', kind: 'jelly', name: '烈焰水母', desc: '全身像火焰般溫暖發亮，在水裡也不會熄滅。',
    price: 600, income: 2, adultMin: 40, size: 112, speed: 17,
    shape: 'jelly', colors: ['#ff6a2b', '#ffd27a'],
  },
  {
    id: 'heart', kind: 'jelly', name: '愛心水母', desc: '傘上有一顆粉紅愛心，據說看到牠的人會有好心情。',
    price: 1200, income: 3.8, adultMin: 60, size: 115, speed: 15,
    shape: 'jelly', colors: ['#ff8fc0', '#ffd6e8'],
  },
  {
    id: 'snowflake', kind: 'jelly', name: '冰雪水母', desc: '傘上印著一片雪花，靠近時好像能感覺到一絲涼意。',
    price: 2200, income: 6.5, adultMin: 90, size: 115, speed: 14,
    shape: 'jelly', colors: ['#8ec9ff', '#eef7ff'],
  },
  {
    id: 'amethyst', kind: 'jelly', name: '紫晶水母', desc: '紫水晶般的身體，在光線下會折射出點點星芒。',
    price: 4000, income: 11, adultMin: 120, size: 118, speed: 14,
    shape: 'jelly', colors: ['#9b7bff', '#e3d9ff'],
  },
  {
    id: 'crescent', kind: 'jelly', name: '月夜水母', desc: '傘裡藏著一彎新月和夜空，總是安靜地漂浮。',
    price: 7000, income: 18, adultMin: 180, size: 118, speed: 13,
    shape: 'jelly', colors: ['#5a3fd1', '#c9b8ff'],
  },
  {
    id: 'constellation', kind: 'jelly', name: '星座水母', desc: '傘上連成一組小小的星座，像把夜空帶進了水族箱。',
    price: 12000, income: 29, adultMin: 240, size: 120, speed: 13,
    shape: 'jelly', colors: ['#2a46c9', '#bcd0ff'],
  },
  {
    id: 'flower_garden', kind: 'jelly', name: '花園水母', desc: '觸手上開滿小白花，走到哪裡都是一座花園。',
    price: 20000, income: 46, adultMin: 300, size: 125, speed: 12,
    shape: 'jelly', colors: ['#a9b8ff', '#ffffff'],
  },
  {
    id: 'saturn', kind: 'jelly', name: '土星水母', desc: '身邊繞著一圈金色光環，是來自遙遠星球的訪客。',
    price: 33000, income: 72, adultMin: 420, size: 130, speed: 12,
    shape: 'jelly', colors: ['#ffc65c', '#fff0c2'],
  },
  {
    id: 'crystal', kind: 'jelly', name: '水晶水母', desc: '由透明水晶構成的神祕水母，觸手是一顆顆冰晶。',
    price: 55000, income: 115, adultMin: 540, size: 130, speed: 11,
    shape: 'jelly', colors: ['#7ec8ff', '#e6f6ff'],
  },
  {
    id: 'rainbow', kind: 'jelly', name: '彩虹水母', desc: '傘上流動著七彩光芒，非常難得一見。',
    price: 90000, income: 180, adultMin: 720, size: 132, speed: 11,
    shape: 'jelly', colors: ['#ff9be6', '#b3f5ff'],
  },
  {
    id: 'angel', kind: 'jelly', name: '天使水母', desc: '頭戴光環、背有羽翼，傳說會守護整座水族箱。',
    price: 150000, income: 290, adultMin: 900, size: 135, speed: 10,
    shape: 'jelly', colors: ['#ffffff', '#e9e1ff'],
  },
  {
    id: 'golden_star', kind: 'jelly', name: '金曜水母', desc: '全身閃耀金色光輝的傳說水母，帶著小星星一起漂浮。',
    price: 250000, income: 460, adultMin: 1080, size: 135, speed: 10,
    shape: 'jelly', colors: ['#ffc83d', '#fff1b8'],
  },
];

/** @param {string} id */
export function hasSpecies(id) {
  return SPECIES.some((x) => x.id === id);
}

/** @param {string} id */
export function getSpecies(id) {
  const s = SPECIES.find((x) => x.id === id);
  if (!s) throw new Error(`未知的種類：${id}`);
  return s;
}
