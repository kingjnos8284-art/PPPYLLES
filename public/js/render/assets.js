// @ts-check
/**
 * 美術素材載入。
 *
 * 素材清單寫在 /assets/manifest.json。某個項目是 null 或圖片讀取失敗時，
 * 遊戲會自動使用程式畫的占位圖，所以美術可以一張一張慢慢補上。
 *
 * 項目格式：{ "src": "jelly/star_blue-v1.webp", "cols": 6, "rows": 4, "frames": 24, "fps": 10,
 *            "thumb": "jelly/star_blue-thumb-v1.webp" }
 *   cols × rows 為動畫圖集的格數（由左到右、由上到下播放）；只有一列時可只寫 frames。
 *   thumb 為商店／圖鑑用的小圖（選用）。
 *   hover 為停在原地時的動畫圖集（選用，例如小魚的懸浮動作）。
 *   魚類圖必須「頭朝右」，往左游時遊戲會自動鏡像翻轉。
 *
 * 水中寵物的動畫圖集較大，採「用到才下載」：只有水族箱裡有這個種類時才載入。
 */

/**
 * @typedef {Object} SpriteEntry
 * @property {HTMLImageElement} img
 * @property {number} frames
 * @property {number} fps
 * @property {number} cols
 * @property {number} fw   單格寬
 * @property {number} fh   單格高
 * @property {BgLayout|null} layout  背景圖專用：水族箱與地板位置
 * @property {SpriteEntry|null} [hover]  停在原地時的動畫（選用，格式與主圖相同）
 * @property {{x:number,y:number}[]} [tops]  每一格身體最上緣的位置（相對格子中心，以格寬為 1），用來放選取箭頭
 */

/**
 * 背景圖的版面設定，所有數值都是「佔圖片寬／高的比例」(0~1)。
 * @typedef {Object} BgLayout
 * @property {{x0:number,y0:number,x1:number,y1:number,r:number}} tank  水族箱的水域（魚只會畫在這裡面，r 為圓角比例）
 * @property {{x0:number,y0:number,x1:number,y1:number}} swim  魚的游動範圍
 * @property {number} floorY        陸地寵物腳底所在高度
 * @property {[number, number]} floorX  陸地寵物左右可走範圍
 * @property {number} focusX        畫面太窄（手機直拿）時，以這個水平位置為中心裁切
 * @property {boolean} [fitWidth]  畫面比圖細長時，完整顯示整張寬度（貼齊上緣、下方延伸地板），不裁切左右
 * @property {PetLayout} [pets]      陸地寵物的固定位置（貓跳台、狗窩等）
 */

/**
 * @typedef {Object} PetSpot
 * @property {'cat'|'dog'} kind   這個位置給貓或狗
 * @property {number} x           腳底位置（佔圖片寬／高的比例）
 * @property {number} y
 * @property {number} face        在這個位置面向：1 = 右，-1 = 左
 * @property {number} [rank]      固定位置的順序：同種類中第幾隻擁有的寵物坐這裡（1 = 第一隻，例如貓跳台頂層）
 * @property {boolean} [fallback] 備用位置：只有其他位置被選單擋住或超出畫面時才使用
 */

/**
 * @typedef {Object} PetLayout
 * @property {number} catSize     貓的動畫格寬度（佔圖片寬度的比例）
 * @property {number} dogSize
 * @property {PetSpot[]} spots
 */

/**
 * @typedef {Object} ThemeInfo
 * @property {string} id
 * @property {string} name
 * @property {string} [thumb]
 * @property {number} price   解鎖價格（0 = 免費）
 */

/**
 * 陸地寵物的一組動畫。所有圖都以「腳底」對齊：anchorY 是腳底在畫格中的高度比例。
 * @typedef {Object} PetSprites
 * @property {Record<string, SpriteEntry>} states  sit / lie / idle / sleep 等循環動作
 * @property {SpriteEntry|null} interact           點擊時播放一次的動作
 * @property {number} facing                       圖中角色面向：1 = 右，-1 = 左
 * @property {number} anchorY
 */

/**
 * @typedef {Object} AssetBank
 * @property {string} theme                        目前主題 id
 * @property {ThemeInfo[]} themes                   所有主題（名稱、縮圖）
 * @property {(id: string) => Promise<boolean>} setTheme  切換主題（載入對應背景）
 * @property {SpriteEntry|null} background          橫向（電腦）背景
 * @property {SpriteEntry|null} backgroundPortrait  直向（手機）背景
 * @property {SpriteEntry|null} sand
 * @property {{ plants: boolean, lightRays: boolean }} effects  背景已畫了水草／光束時可關閉程式產生的版本
 * @property {Record<string, SpriteEntry>} fish       已載入的水中寵物動畫（用到才載入）
 * @property {Record<string, HTMLImageElement>} thumbs  水中寵物小圖
 * @property {(id: string) => void} requestFish     要求載入某個種類的動畫
 * @property {Record<string, PetSprites>} pets        已載入的陸地寵物動畫（用到才載入）
 * @property {Record<string, HTMLImageElement>} petThumbs  陸地寵物小圖
 * @property {(id: string) => void} requestPet      要求載入某隻陸地寵物的動畫
 * @property {HTMLImageElement|null} heartBubble    互動時的愛心對話框
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
  const cols = Math.max(1, e.cols | 0 || e.frames | 0 || 1);
  const rows = Math.max(1, e.rows | 0 || 1);
  const frames = Math.max(1, Math.min(cols * rows, e.frames | 0 || cols * rows));
  const hover = typeof e.hover === 'string' ? await loadEntry({ ...e, src: e.hover, hover: undefined }) : null;
  return {
    img, frames, cols, fps: e.fps || 8,
    fw: img.naturalWidth / cols, fh: img.naturalHeight / rows,
    layout: e.layout ?? null,
    hover,
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

/**
 * @param {string} [themeId] 一開始要使用的主題
 * @returns {Promise<AssetBank>}
 */
export async function loadAssets(themeId) {
  /** @type {any} */
  let manifest = {};
  try {
    const res = await fetch('/assets/manifest.json', { cache: 'no-cache' });
    if (res.ok) manifest = await res.json();
  } catch { /* 沒有清單就全部用占位圖 */ }
  const fishDefs = manifest.fish ?? {};
  /** @type {Record<string, HTMLImageElement>} */
  const thumbs = {};
  const petDefs = manifest.landPets ?? {};
  /** @type {Record<string, HTMLImageElement>} */
  const petThumbs = {};
  /** @type {HTMLImageElement|null} */
  let heartBubble = null;
  // 主題：每個主題有自己的橫／直背景與特效設定；舊格式（頂層 background）視為單一主題
  /** @type {Record<string, any>} */
  const themeDefs = manifest.themes ?? {
    default: { name: '預設', background: manifest.background, backgroundPortrait: manifest.backgroundPortrait, effects: manifest.effects },
  };
  const themeIds = Object.keys(themeDefs);
  const startTheme = themeId && themeDefs[themeId] ? themeId : themeIds[0];
  /** @type {Record<string, { background: SpriteEntry|null, backgroundPortrait: SpriteEntry|null }>} */
  const themeCache = {};
  /** @param {string} id */
  const loadTheme = async (id) => {
    if (!themeCache[id]) {
      const d = themeDefs[id];
      const [bg, bgp] = await Promise.all([loadEntry(d.background), loadEntry(d.backgroundPortrait)]);
      themeCache[id] = { background: bg, backgroundPortrait: bgp };
    }
    return themeCache[id];
  };
  /** @param {any} d */
  const effectsOf = (d) => ({ plants: d?.effects?.plants !== false, lightRays: d?.effects?.lightRays !== false });

  const [first, sand, decor] = await Promise.all([
    loadTheme(startTheme),
    loadEntry(manifest.sand),
    loadGroup(manifest.decor),
    manifest.ui?.heartBubble ? loadImage('/assets/' + manifest.ui.heartBubble).then((i) => { heartBubble = i; }) : null,
    ...Object.entries(petDefs).map(async ([k, v]) => {
      if (!v || typeof v.thumb !== 'string') return;
      const img = await loadImage('/assets/' + v.thumb);
      if (img) petThumbs[k] = img;
    }),
    ...Object.entries(fishDefs).map(async ([k, v]) => {
      if (!v || typeof v.thumb !== 'string') return;
      const img = await loadImage('/assets/' + v.thumb);
      if (img) thumbs[k] = img;
    }),
  ]);
  /** @type {Record<string, SpriteEntry>} */
  const fish = {};
  const pending = new Set();
  /** @param {string} id */
  const requestFish = (id) => {
    if (fish[id] || pending.has(id) || !fishDefs[id]) return;
    pending.add(id);
    loadEntry(fishDefs[id]).then((e) => {
      if (!e) return;
      try { e.tops = measureTops(e); } catch { /* 量不到就用預設位置 */ }
      fish[id] = e;
    });
  };
  /** @type {Record<string, PetSprites>} */
  const pets = {};
  const pendingPets = new Set();
  /** @param {string} id */
  const requestPet = (id) => {
    const d = petDefs[id];
    if (pets[id] || pendingPets.has(id) || !d || !d.states) return;
    pendingPets.add(id);
    const base = { cols: d.cols ?? 6, rows: d.rows ?? 4, frames: d.frames ?? 24, fps: d.fps ?? 10 };
    Promise.all([
      ...Object.entries(d.states).map(async ([st, src]) => /** @type {[string, SpriteEntry|null]} */ ([st, await loadEntry({ ...base, src })])),
    ]).then(async (list) => {
      /** @type {Record<string, SpriteEntry>} */
      const states = {};
      for (const [st, e] of list) if (e) states[st] = e;
      if (!Object.keys(states).length) return;
      const interact = d.interact ? await loadEntry({ ...base, ...d.interact }) : null;
      pets[id] = { states, interact, facing: d.facing === -1 ? -1 : 1, anchorY: d.anchorY ?? 0.5 };
    });
  };
  /** @type {AssetBank} */
  const bank = {
    theme: startTheme,
    themes: themeIds.map((id) => ({ id, name: themeDefs[id].name ?? id, thumb: themeDefs[id].thumb, price: themeDefs[id].price ?? 0 })),
    setTheme: async (id) => {
      if (!themeDefs[id]) return false;
      const t = await loadTheme(id);
      bank.theme = id;
      bank.background = t.background;
      bank.backgroundPortrait = t.backgroundPortrait;
      bank.effects = effectsOf(themeDefs[id]);
      return true;
    },
    background: first.background, backgroundPortrait: first.backgroundPortrait,
    effects: effectsOf(themeDefs[startTheme]),
    sand, fish, thumbs, requestFish,
    pets, petThumbs, requestPet, heartBubble, decor,
  };
  return bank;
}

/**
 * 量出每一格身體最上緣的位置（水母傘頂），讓選取箭頭可以浮在頭頂上方
 * @param {SpriteEntry} e
 */
function measureTops(e) {
  const S = 96; // 縮小量測即可
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d', { willReadFrequently: true }));
  /** @type {{x:number,y:number}[]} */
  const out = [];
  for (let i = 0; i < e.frames; i++) {
    g.clearRect(0, 0, S, S);
    g.drawImage(e.img, (i % e.cols) * e.fw, Math.floor(i / e.cols) * e.fh, e.fw, e.fh, 0, 0, S, S);
    const d = g.getImageData(0, 0, S, S).data;
    let top = -1;
    for (let y = 0; y < S && top < 0; y++) {
      let n = 0;
      for (let x = 0; x < S; x++) if (d[(y * S + x) * 4 + 3] > 80) n++;
      if (n >= 2) top = y;
    }
    if (top < 0) { out.push({ x: 0, y: -0.38 }); continue; }
    // 傘頂附近幾列的水平中心
    let sx = 0, n = 0;
    for (let y = top; y < Math.min(S, top + 6); y++) {
      for (let x = 0; x < S; x++) if (d[(y * S + x) * 4 + 3] > 80) { sx += x; n++; }
    }
    out.push({ x: (n ? sx / n : S / 2) / S - 0.5, y: top / S - 0.5 });
  }
  return out;
}

/**
 * 以中心點繪製素材（寬度固定，高度依比例），支援動畫格。
 * @param {CanvasRenderingContext2D} ctx
 * @param {SpriteEntry} e
 * @param {number} width
 * @param {number} time 秒
 */
export function drawSprite(ctx, e, width, time) {
  const frame = e.frames > 1 ? Math.floor(Math.max(0, time) * e.fps) % e.frames : 0;
  const sx = (frame % e.cols) * e.fw;
  const sy = Math.floor(frame / e.cols) * e.fh;
  const h = width * (e.fh / e.fw);
  ctx.drawImage(e.img, sx, sy, e.fw, e.fh, -width / 2, -h / 2, width, h);
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
