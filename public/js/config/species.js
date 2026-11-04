// @ts-check
/**
 * 魚種設定（水中寵物）。新增魚種只要在這裡加一筆，圖鑑和商店會自動出現。
 *
 * price      購買魚苗價格
 * income     成魚、灰色品質時每秒產出的資源
 * adultMin   從幼魚長到成魚需要的分鐘數
 * lifeHours  基本壽命（小時，會再乘上品質的 lifeMult）
 * size       成魚時的顯示長度（基準單位，畫面會依螢幕大小縮放）
 * speed      游動速度
 * shape      占位圖形：fish / tall / round / long / jelly（有正式美術後就不使用）
 * colors     占位圖用的 [主色, 輔色]
 */

/**
 * @typedef {Object} Species
 * @property {string} id
 * @property {string} name
 * @property {string} desc
 * @property {number} price
 * @property {number} income
 * @property {number} adultMin
 * @property {number} lifeHours
 * @property {number} size
 * @property {number} speed
 * @property {'fish'|'tall'|'round'|'long'|'jelly'} shape
 * @property {[string, string]} colors
 */

/** @type {Species[]} */
export const SPECIES = [
  {
    id: 'guppy', name: '孔雀魚', desc: '最常見的入門魚，尾巴像小小的扇子，數量多了會很熱鬧。',
    price: 20, income: 0.1, adultMin: 5, lifeHours: 36, size: 34, speed: 60,
    shape: 'fish', colors: ['#ff9f43', '#5ad1ff'],
  },
  {
    id: 'neon', name: '霓虹燈魚', desc: '身上有一道會發光的藍色條紋，喜歡成群游動。',
    price: 60, income: 0.25, adultMin: 15, lifeHours: 48, size: 30, speed: 75,
    shape: 'fish', colors: ['#3fd0ff', '#ff4f6d'],
  },
  {
    id: 'clown', name: '小丑魚', desc: '橘白相間的經典海水魚，個性活潑。',
    price: 150, income: 0.6, adultMin: 30, lifeHours: 72, size: 44, speed: 55,
    shape: 'fish', colors: ['#ff7a1a', '#ffffff'],
  },
  {
    id: 'angel', name: '神仙魚', desc: '身形高挑優雅，緩慢地在水草間穿梭。',
    price: 400, income: 1.5, adultMin: 60, lifeHours: 72, size: 56, speed: 40,
    shape: 'tall', colors: ['#e8eef5', '#2b3a55'],
  },
  {
    id: 'betta', name: '鬥魚', desc: '擁有華麗長鰭的獨行俠，鰭的顏色非常鮮豔。',
    price: 900, income: 3, adultMin: 120, lifeHours: 96, size: 54, speed: 35,
    shape: 'fish', colors: ['#c2185b', '#7c4dff'],
  },
  {
    id: 'discus', name: '七彩神仙', desc: '圓盤般的身體帶著彩色花紋，被稱為熱帶魚之王。',
    price: 2500, income: 7, adultMin: 240, lifeHours: 120, size: 64, speed: 32,
    shape: 'round', colors: ['#ff6b4a', '#2ec4b6'],
  },
  {
    id: 'arowana', name: '龍魚', desc: '修長的身軀覆蓋著金屬光澤的鱗片，象徵好運。',
    price: 8000, income: 20, adultMin: 480, lifeHours: 168, size: 120, speed: 30,
    shape: 'long', colors: ['#d9b44a', '#8a5a1c'],
  },
  {
    id: 'jelly', name: '月亮水母', desc: '半透明的身體隨水流一張一縮，看著就很放鬆。',
    price: 20000, income: 45, adultMin: 720, lifeHours: 168, size: 60, speed: 18,
    shape: 'jelly', colors: ['#b8e6ff', '#ff9ad5'],
  },
];

/** @param {string} id */
export function getSpecies(id) {
  const s = SPECIES.find((x) => x.id === id);
  if (!s) throw new Error(`未知的魚種：${id}`);
  return s;
}
