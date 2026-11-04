// @ts-check
/**
 * 美術素材載入。
 *
 * 素材清單寫在 /assets/manifest.json。某個項目是 null 或圖片讀取失敗時，
 * 遊戲會自動使用程式畫的占位圖，所以美術可以一張一張慢慢補上。
 *
 * 項目格式：{ "src": "fish/guppy.png", "frames": 1, "fps": 8 }
 *   frames > 1 時，圖片視為「橫向排列的連續動畫格」。
 */

/**
 * @typedef {Object} SpriteEntry
 * @property {HTMLImageElement} img
 * @property {number} frames
 * @property {number} fps
 * @property {number} fw   單格寬
 * @property {number} fh   單格高
 * @property {BgLayout|null} layout  背景圖專用：水族箱與地板位置
 */

/**
 * 背景圖的版面設定，所有數值都是「佔圖片寬／高的比例」(0~1)。
 * @typedef {Object} BgLayout
 * @property {{x0:number,y0:number,x1:number,y1:number,r:number}} tank  水族箱的水域（魚只會畫在這裡面，r 為圓角比例）
 * @property {{x0:number,y0:number,x1:number,y1:number}} swim  魚的游動範圍
 * @property {number} floorY        陸地寵物腳底所在高度
 * @property {[number, number]} floorX  陸地寵物左右可走範圍
 * @property {number} focusX        畫面太窄（手機直拿）時，以這個水平位置為中心裁切
 */

/**
 * @typedef {Object} AssetBank
 * @property {SpriteEntry|null} background          橫向（電腦）背景
 * @property {SpriteEntry|null} backgroundPortrait  直向（手機）背景
 * @property {SpriteEntry|null} sand
 * @property {{ plants: boolean, lightRays: boolean }} effects  背景已畫了水草／光束時可關閉程式產生的版本
 * @property {Record<string, SpriteEntry>} fish
 * @property {Record<string, SpriteEntry>} landPets
 * @property {Record<string, SpriteEntry>} decor
 */

/** @param {string} src @returns {Promise<HTMLImageElement|null>} */
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** @param {any} e @returns {Promise<SpriteEntry|null>} */
async function loadEntry(e) {
  if (!e || typeof e.src !== 'string') return null;
  const img = await loadImage('/assets/' + e.src);
  if (!img) {
    console.warn('[assets] 無法載入', e.src, '，改用占位圖');
    return null;
  }
  const frames = Math.max(1, e.frames | 0 || 1);
  return {
    img, frames, fps: e.fps || 8, fw: img.naturalWidth / frames, fh: img.naturalHeight,
    layout: e.layout ?? null,
  };
}

/** @param {Record<string, any>|undefined} group */
async function loadGroup(group) {
  /** @type {Record<string, SpriteEntry>} */
  const out = {};
  if (!group) return out;
  await Promise.all(Object.entries(group).map(async ([k, v]) => {
    const e = await loadEntry(v);
    if (e) out[k] = e;
  }));
  return out;
}

/** @returns {Promise<AssetBank>} */
export async function loadAssets() {
  /** @type {any} */
  let manifest = {};
  try {
    const res = await fetch('/assets/manifest.json', { cache: 'no-cache' });
    if (res.ok) manifest = await res.json();
  } catch { /* 沒有清單就全部用占位圖 */ }
  const [background, backgroundPortrait, sand, fish, landPets, decor] = await Promise.all([
    loadEntry(manifest.background),
    loadEntry(manifest.backgroundPortrait),
    loadEntry(manifest.sand),
    loadGroup(manifest.fish),
    loadGroup(manifest.landPets),
    loadGroup(manifest.decor),
  ]);
  const effects = {
    plants: manifest.effects?.plants !== false,
    lightRays: manifest.effects?.lightRays !== false,
  };
  return { background, backgroundPortrait, sand, fish, landPets, decor, effects };
}

/**
 * 以中心點繪製素材（寬度固定，高度依比例），支援動畫格。
 * @param {CanvasRenderingContext2D} ctx
 * @param {SpriteEntry} e
 * @param {number} width
 * @param {number} time 秒
 */
export function drawSprite(ctx, e, width, time) {
  const frame = e.frames > 1 ? Math.floor(time * e.fps) % e.frames : 0;
  const h = width * (e.fh / e.fw);
  ctx.drawImage(e.img, frame * e.fw, 0, e.fw, e.fh, -width / 2, -h / 2, width, h);
}

/**
 * 以「cover」方式填滿整個區域（背景用）
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} img
 * @param {number} x @param {number} y @param {number} w @param {number} h
 * @param {number} [anchorY] 0 = 對齊上緣, 0.5 = 置中, 1 = 對齊下緣
 */
export function drawCover(ctx, img, x, y, w, h, anchorY = 0.5) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) * anchorY, dw, dh);
}
