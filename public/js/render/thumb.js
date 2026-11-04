// @ts-check
import { getSpecies } from '../config/species.js';
import { getLandPet } from '../config/landpets.js';
import { drawSprite } from './assets.js';
import { drawFishPlaceholder, drawLandPetPlaceholder } from './placeholder.js';

/**
 * 介面用的小圖（商店、圖鑑、資訊頁）。有正式美術時用美術，否則用占位圖。
 */

/** @type {import('./assets.js').AssetBank|null} */
let bank = null;

/** @param {import('./assets.js').AssetBank} assets */
export function setThumbAssets(assets) {
  bank = assets;
}

/** @param {number} w @param {number} h */
function makeCanvas(w, h) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const c = document.createElement('canvas');
  c.width = w * dpr;
  c.height = h * dpr;
  c.style.width = w + 'px';
  c.style.height = h + 'px';
  const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  ctx.scale(dpr, dpr);
  return { c, ctx };
}

/** 把已畫好的內容變成剪影（不依賴 ctx.filter，iPhone 也正常） @param {CanvasRenderingContext2D} ctx @param {number} w @param {number} h */
function toSilhouette(ctx, w, h) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = 'rgba(5,20,35,.85)';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
  void w; void h;
}

/**
 * @param {string} speciesId
 * @param {number} w @param {number} h
 * @param {{ silhouette?: boolean }} [opts]
 */
export function fishThumb(speciesId, w, h, opts = {}) {
  const sp = getSpecies(speciesId);
  const { c, ctx } = makeCanvas(w, h);
  const thumb = bank?.thumbs[speciesId];
  const sprite = bank?.fish[speciesId];
  if (thumb) {
    const s = Math.min(w / thumb.naturalWidth, h / thumb.naturalHeight);
    const dw = thumb.naturalWidth * s, dh = thumb.naturalHeight * s;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(thumb, (w - dw) / 2, (h - dh) / 2, dw, dh);
    if (opts.silhouette) toSilhouette(ctx, w, h);
    return c;
  }
  ctx.translate(w / 2, sp.shape === 'jelly' && !sprite ? h * 0.38 : h / 2);
  if (sprite) {
    drawSprite(ctx, sprite, Math.min(w, h * (sprite.fw / sprite.fh)) * 1.2, 0);
    if (opts.silhouette) toSilhouette(ctx, w, h);
  } else {
    const L = Math.min(w * 0.72, sp.shape === 'jelly' ? h * 0.9 : h * 1.4);
    drawFishPlaceholder(ctx, sp, L, 0.3, opts);
  }
  return c;
}

/** @param {string} petId @param {number} w @param {number} h */
export function petThumb(petId, w, h) {
  const lp = getLandPet(petId);
  const { c, ctx } = makeCanvas(w, h);
  const S = Math.min(w * 0.75, h * 1.3);
  const thumb = bank?.petThumbs[petId];
  if (thumb) {
    const s = Math.min(w / thumb.naturalWidth, h / thumb.naturalHeight);
    const dw = thumb.naturalWidth * s, dh = thumb.naturalHeight * s;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(thumb, (w - dw) / 2, (h - dh) / 2, dw, dh);
  } else {
    ctx.translate(w / 2, h * 0.82);
    drawLandPetPlaceholder(ctx, lp, S, 0, false);
  }
  return c;
}
