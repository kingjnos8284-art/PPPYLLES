// @ts-check
/** 介面共用的小工具 */

/**
 * 建立元素
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {Record<string, any>} [props]
 * @param {(Node|string|null|undefined|false)[]} [children]
 * @returns {HTMLElementTagNameMap[K]}
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        // CSS 變數（--qc 等）必須用 setProperty 才會生效
        if (sk.startsWith('--')) node.style.setProperty(sk, String(sv));
        else /** @type {any} */ (node.style)[sk] = sv;
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c == null || c === false) continue;
    node.append(c);
  }
  return node;
}

/** @param {string} id */
export function $(id) {
  const n = document.getElementById(id);
  if (!n) throw new Error(`找不到元素 #${id}`);
  return n;
}

/** 大數字縮寫 @param {number} n */
export function fmt(n) {
  if (!isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs < 1000) return abs < 10 && abs % 1 ? n.toFixed(1) : Math.floor(n).toLocaleString('zh-Hant');
  const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
  let u = -1;
  let v = abs;
  while (v >= 1000 && u < units.length - 1) { v /= 1000; u++; }
  return (n < 0 ? '-' : '') + (v >= 100 ? v.toFixed(0) : v.toFixed(v >= 10 ? 1 : 2)) + units[u];
}

/** 每秒產出 @param {number} n */
export function fmtRate(n) {
  if (n < 10) return n.toFixed(2).replace(/\.?0+$/, '') || '0';
  return fmt(n);
}

/** 時間長度 @param {number} sec */
export function fmtDuration(sec) {
  sec = Math.max(0, Math.floor(sec));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d} 天 ${h} 小時`;
  if (h > 0) return `${h} 小時 ${m} 分`;
  if (m > 0) return `${m} 分鐘`;
  return `${sec} 秒`;
}

export function coinIcon() {
  return el('span', { class: 'coin-icon', 'aria-hidden': 'true' });
}
