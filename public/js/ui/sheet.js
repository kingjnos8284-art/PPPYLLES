// @ts-check
import { $ } from './dom.js';
import { sfx } from '../audio/audio.js';

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
/** 鎖定中的面板（例如開始時選寵物）不能被點背景、按 ✕ 或 Esc 關掉，也不會被其他面板蓋掉 */
let locked = false;

/**
 * @param {string} id
 * @param {string} heading
 * @param {Node} content
 * @param {{ onClose?: () => void, locked?: boolean, silent?: boolean }} [opts]
 */
export function openSheet(id, heading, content, opts = {}) {
  if (locked && id !== currentId) return;
  if (!currentId && !opts.silent) sfx('open');
  if (currentId && onCloseCb) onCloseCb();
  locked = !!opts.locked;
  sheet.classList.toggle('is-locked', locked);
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
  sfx('close');
  locked = false;
  sheet.classList.remove('is-locked');
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

/** 玩家自己關閉（鎖定中的面板不理會） */
function userClose() {
  if (!locked) closeSheet();
}

$('sheet-close').addEventListener('click', userClose);
backdrop.addEventListener('click', userClose);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') userClose();
});
