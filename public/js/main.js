// @ts-check
import { BALANCE } from './config/balance.js';
import { getSpecies } from './config/species.js';
import { getLandPet } from './config/landpets.js';
import { createNewState } from './core/state.js';
import { addFish, advance, settleOffline, tapLandPet } from './core/sim.js';
import { backend } from './services/index.js';
import { loadAssets } from './render/assets.js';
import { applyViewport } from './render/viewport.js';
import { Scene } from './render/scene.js';
import { setThumbAssets } from './render/thumb.js';
import { updateHud } from './ui/hud.js';
import {
  initPanels, openStarterPick, openShop, openCodex, openDecor, openSettings, openFishInfo, openOffline, currentSheet,
} from './ui/panels.js';
import { toast } from './ui/toast.js';
import { $, fmt } from './ui/dom.js';

const VERSION = '0.1.0';

/** @type {import('./core/state.js').GameState} */
let state;
/** @type {Scene} */
let scene;

/** @param {number} now */
function newGame(now) {
  const s = createNewState(now);
  addFish(s, BALANCE.starterFish);
  return s;
}

async function save() {
  await backend.save.save(state);
}

function commit() {
  updateHud(state);
  save();
}

/**
 * 結算「從上次結算到現在」的時間。
 * 短時間（畫面持續開著）直接推進；長時間（切到背景、關掉再開）視為離線，套用 6 小時上限。
 * @param {number} now
 * @param {boolean} allowPopup
 */
function catchUp(now, allowPopup) {
  const elapsed = (now - state.lastTick) / 1000;
  state.lastTick = now;
  if (elapsed <= 0) return; // 手機時間被往回調時，不給也不扣
  if (elapsed < 15) {
    advance(state, elapsed);
    return;
  }
  const r = settleOffline(state, elapsed);
  commit();
  if (allowPopup && elapsed >= BALANCE.offlinePopupMinSec && r.earned >= 1) {
    openOffline(r);
  }
}

applyViewport();

async function boot() {
  const [saved, now] = await Promise.all([backend.save.load(), backend.time.now()]);
  state = saved ?? newGame(now);
  const assets = await loadAssets(state.theme);
  state.theme = assets.theme;
  setThumbAssets(assets);

  const canvas = /** @type {HTMLCanvasElement} */ ($('stage'));
  scene = new Scene(canvas, () => state, assets);
  scene.onGrownUp = (f) => toast(`${getSpecies(f.species).name} 長大了！`);

  initPanels({
    getState: () => state,
    commit,
    select: (uid) => { scene.selectedUid = uid; },
    resetGame: async () => {
      await backend.save.clear();
      state = newGame(Date.now());
      // 重新開始時背景也回到預設
      if (assets.theme !== state.theme) { await assets.setTheme(state.theme); scene.resize(); }
      commit();
    },
    themes: () => assets.themes,
    setTheme: async (id) => {
      const ok = await assets.setTheme(id);
      if (!ok) return;
      state.theme = id;
      scene.resize();
      commit();
    },
    onReleased: (uid) => { scene.releaseEffect(uid); scene.selectedUid = null; },
    fastForward: (sec) => {
      // 不受離線上限限制，直接推進遊戲時間（成長、老化、收益都會發生）
      advance(state, sec);
      commit();
    },
  });

  // 測試用：網址加上 ?debug 時可從主控台存取
  if (location.search.includes('debug')) /** @type {any} */ (window).__game = { scene, get state() { return state; } };

  catchUp(now, true);
  updateHud(state);
  save();
  bindInput(canvas);
  startLoop();

  $('boot').classList.add('done');
  setTimeout(() => $('boot').remove(), 600);
  // 還沒有陸地寵物（新遊戲，或上次選之前就關掉了）：請玩家選第一隻
  if (state.landPets.length === 0) setTimeout(openStarterPick, 500);
}

function startLoop() {
  let last = performance.now();
  let hudAt = 0;
  let saveAt = performance.now();
  /** @param {number} t */
  const frame = (t) => {
    const dt = Math.min(0.1, (t - last) / 1000);
    last = t;
    catchUp(Date.now(), true);
    scene.update(dt);
    scene.draw();
    if (t - hudAt > 250) { hudAt = t; updateHud(state); }
    if (t - saveAt > BALANCE.autosaveSec * 1000) { saveAt = t; save(); }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** @param {HTMLCanvasElement} canvas */
function bindInput(canvas) {
  canvas.addEventListener('pointerdown', (e) => {
    const hit = scene.hitTest(e.clientX, e.clientY);
    if (!hit) return;
    if (hit.kind === 'fish') {
      openFishInfo(hit.uid);
    } else {
      const now = Date.now();
      const r = tapLandPet(state, hit.type, now);
      const pos = scene.petReact(hit.type, r.ok);
      if (pos) {
        if (r.ok) scene.floatText(pos.x, pos.y, `+${fmt(r.reward)}`);
        else scene.floatText(pos.x, pos.y, '♥', '#ff9ac0');
      }
      if (r.ok) commit();
      else if (currentSheet() == null && Math.random() < 0.2) {
        toast(`${getLandPet(hit.type).name} 很開心！${Math.ceil(r.cooldownLeft)} 秒後可以再領取獎勵`);
      }
    }
  });

  document.querySelectorAll('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const which = /** @type {HTMLElement} */ (btn).dataset.open;
      if (which === 'shop') openShop();
      else if (which === 'codex') openCodex();
      else if (which === 'decor') openDecor();
      else if (which === 'settings') openSettings({
        canFullscreen: !!document.fullscreenEnabled,
        toggleFullscreen,
        standalone: isStandalone(),
        version: VERSION,
      });
    });
  });

  /** @type {number|undefined} */
  let resizeTimer;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => { applyViewport(); scene.resize(); }, 120);
  };
  window.addEventListener('resize', onResize);
  window.visualViewport?.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  // 離開頁面時立刻存檔
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
    else catchUp(Date.now(), true);
  });
  window.addEventListener('pagehide', () => { save(); });
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => toast('此裝置不支援全螢幕'));
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || /** @type {any} */ (navigator).standalone === true;
}

if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

boot().catch((err) => {
  console.error(err);
  const sub = document.querySelector('.boot-sub');
  if (sub) sub.textContent = '載入失敗，請重新整理頁面';
});
