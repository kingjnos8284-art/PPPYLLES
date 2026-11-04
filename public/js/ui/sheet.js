// @ts-check
import { $ } from './dom.js';

/**
 * 面板（手機為底部抽屜，桌機為置中視窗）。同一時間只開一個。
 */

const sheet = $('sheet');
const backdrop = $('sheet-backdrop');
const title = $('sheet-title');
const body = $('sheet-body');

/** @type {(() => void)|null} */
let onCloseCb = null;
/** @type {string|null} */
let currentId = null;

/**
 * @param {string} id
 * @param {string} heading
 * @param {Node} content
 * @param {{ onClose?: () => void }} [opts]
 */
export function openSheet(id, heading, content, opts = {}) {
  if (currentId && onCloseCb) onCloseCb();
  currentId = id;
  onCloseCb = opts.onClose ?? null;
  title.textContent = heading;
  body.replaceChildren(content);
  body.scrollTop = 0;
  sheet.hidden = false;
  backdrop.hidden = false;
}

/** 更新目前面板的內容（不重播動畫） @param {Node} content */
export function replaceSheetContent(content) {
  const top = body.scrollTop;
  body.replaceChildren(content);
  body.scrollTop = top;
}

export function closeSheet() {
  if (!currentId) return;
  sheet.hidden = true;
  backdrop.hidden = true;
  const cb = onCloseCb;
  currentId = null;
  onCloseCb = null;
  cb?.();
}

export function currentSheet() {
  return currentId;
}

$('sheet-close').addEventListener('click', closeSheet);
backdrop.addEventListener('click', closeSheet);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
});
