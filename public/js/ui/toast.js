// @ts-check
import { $, el } from './dom.js';

const stack = $('toast-stack');

/** @param {string} text */
export function toast(text) {
  const t = el('div', { class: 'toast' }, [text]);
  stack.append(t);
  while (stack.children.length > 3) stack.firstElementChild?.remove();
  setTimeout(() => t.remove(), 3300);
}
