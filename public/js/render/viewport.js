// @ts-check
/**
 * 畫面大小。
 *
 * iPhone「加入主畫面」後以全螢幕開啟時（狀態列為 black-translucent），
 * iOS 回報的視窗高度會少掉頂端狀態列那一段，導致畫面底部出現空白。
 * 這種情況改用螢幕實際尺寸，並把差距寫進 CSS 變數：
 *   --app-h    實際可用高度
 *   --app-gap  實際高度比瀏覽器回報的高度多出的部分（底部元素要往下移這麼多）
 */

function isIosStandalone() {
  const nav = /** @type {any} */ (navigator);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && (nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches);
}

/** @returns {{ w: number, h: number }} */
export function viewportSize() {
  const w = window.innerWidth;
  let h = window.innerHeight;
  if (isIosStandalone()) {
    const long = Math.max(screen.width, screen.height);
    const short = Math.min(screen.width, screen.height);
    const screenH = w > h ? short : long;
    // 只在差距合理（狀態列大約 20～60 點）時修正，避免誤判
    if (screenH > h && screenH - h <= 80) h = screenH;
  }
  return { w, h };
}

/** 更新 CSS 變數，讓版面與畫布一致 */
export function applyViewport() {
  const { h } = viewportSize();
  const root = document.documentElement.style;
  root.setProperty('--app-h', `${h}px`);
  root.setProperty('--app-gap', `${Math.max(0, h - window.innerHeight)}px`);
}
