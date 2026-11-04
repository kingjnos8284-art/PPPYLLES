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

/**
 * @param {string} speciesId
 * @param {number} w @param {number} h
 * @param {{ silhouette?: boolean }} [opts]
 */
export function fishThumb(speciesId, w, h, opts = {}) {
  const sp = getSpecies(speciesId);
  const { c, ctx } = makeCanvas(w, h);
  ctx.translate(w / 2, sp.shape === 'jelly' ? h * 0.38 : h / 2);
  const L = Math.min(w * 0.72, sp.shape === 'jelly' ? h * 0.9 : h * 1.4);
  const sprite = bank?.fish[speciesId];
  if (sprite) {
    if (opts.silhouette) ctx.filter = 'brightness(0) opacity(.8)';
    drawSprite(ctx, sprite, L, 0);
  } else {
    drawFishPlaceholder(ctx, sp, L, 0.3, opts);
  }
  return c;
}

/** @param {string} petId @param {number} w @param {number} h */
export function petThumb(petId, w, h) {
  const lp = getLandPet(petId);
  const { c, ctx } = makeCanvas(w, h);
  const S = Math.min(w * 0.75, h * 1.3);
  const sprite = bank?.landPets[petId];
  if (sprite) {
    ctx.translate(w / 2, h / 2);
    drawSprite(ctx, sprite, S, 0);
  } else {
    ctx.translate(w / 2, h * 0.82);
    drawLandPetPlaceholder(ctx, lp, S, 0, false);
  }
  return c;
}
