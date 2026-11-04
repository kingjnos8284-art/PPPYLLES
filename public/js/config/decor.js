// @ts-check
/**
 * 裝飾系統（預留，尚未開放）。
 *
 * 之後開放時，在這裡新增裝飾品即可。存檔已預留 state.decor.owned / state.decor.placed，
 * 畫面也預留了 decor 圖層（render/scene.js 的 drawDecor），擺放位置以「沙地上的比例座標」記錄，
 * 這樣不同螢幕尺寸看到的位置一致。
 */

/**
 * @typedef {Object} DecorType
 * @property {string} id
 * @property {string} name
 * @property {number} price
 * @property {number} bonus      擺放時的產出加成（可為 0，純觀賞）
 * @property {'floor'|'back'} layer  floor = 沙地前景，back = 背景
 */

/** @type {DecorType[]} */
export const DECOR = [];

export const DECOR_ENABLED = false;
