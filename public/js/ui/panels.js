// @ts-check
import { SPECIES, getSpecies } from '../config/species.js';
import { LAND_PETS, getLandPet } from '../config/landpets.js';
import { BALANCE, TEST_MODE, tankCapacity, priceOf } from '../config/balance.js';
import { adoptStarterPet, buyFish, buyLandPet, buyTheme, ownsTheme, releaseFish, codexProgress, fishIncome, petBonus, stageOf, growthProgress } from '../core/sim.js';
import { fishThumb, petThumb } from '../render/thumb.js';
import { el, fmt, fmtRate, fmtDuration, coinIcon } from './dom.js';
import { openSheet, replaceSheetContent, closeSheet, currentSheet } from './sheet.js';
import { toast } from './toast.js';
import { sfx, getVolumes, setVolume } from '../audio/audio.js';

/**
 * 各個面板。所有面板都透過 GameContext 讀寫遊戲，不直接碰存檔或畫面細節。
 * @typedef {Object} GameContext
 * @property {() => import('../core/state.js').GameState} getState
 * @property {() => void} commit       數值改變後呼叫：存檔＋更新 HUD
 * @property {(uid: number|null) => void} select   在水族箱中標示某隻魚
 * @property {() => Promise<void>} resetGame
 * @property {(sec: number) => void} fastForward   測試用：快轉遊戲時間
 * @property {(uid: number, x?: number, y?: number) => void} onReleased  放生後的畫面效果
 * @property {() => import('../render/assets.js').ThemeInfo[]} themes   所有房間主題
 * @property {(id: string) => Promise<void>} setTheme                   切換房間主題
 */

/** @type {GameContext} */
let G;
/** @type {number|undefined} */
let liveTimer;

/** @param {GameContext} ctx */
export function initPanels(ctx) {
  G = ctx;
}

/** 面板開著時定時刷新（讓按鈕可用狀態、倒數等即時更新） @param {() => Node} render */
function live(render) {
  clearInterval(liveTimer);
  liveTimer = window.setInterval(() => replaceSheetContent(render()), 1000);
}
function stopLive() {
  clearInterval(liveTimer);
}

// ================= 商店 =================

/** @type {'fish'|'pets'|'decor'} */
let shopTab = 'fish';

/** @param {'fish'|'pets'|'decor'} [tab] */
export function openShop(tab) {
  if (tab) shopTab = tab;
  const sheetId = 'shop';
  const render = () => {
    const state = G.getState();
    const tabs = el('div', { class: 'tabs' }, [
      tabBtn('水母', 'fish'),
      tabBtn('貓狗', 'pets'),
      tabBtn('裝飾', 'decor'),
    ]);
    /** @type {Node} */
    let list;
    if (shopTab === 'fish') {
      const full = state.fish.length >= tankCapacity();
      list = el('div', { class: 'card-list' }, [
        full ? el('div', { class: 'notice' }, ['水族箱已經滿了。']) : null,
        ...[...SPECIES].sort((x, y) => x.price - y.price).map((sp) => {
          // 沒擁有過的種類先蓋黑、名稱 ？？？；目前珍珠夠買時才揭曉並開放購買
          const price = priceOf(sp.price);
          const unlocked = codexAll() || !!state.codex[sp.id] || state.coins >= price;
          const canBuy = unlocked && !full && state.coins >= price;
          return el('div', { class: 'card nine-card' }, [
            el('div', { class: 'card-thumb' }, [fishThumb(sp.id, 64, 64, { silhouette: !unlocked })]),
            el('div', {}, [
              el('div', { class: 'card-name' }, [unlocked ? sp.name : '？？？']),
              el('div', { class: 'card-meta' }, [unlocked
                ? `成年每秒 +${fmtRate(sp.income)}・${fmtDuration(sp.adultMin * 60)}長大`
                : '珍珠夠了就會揭曉'],),
            ]),
            el('button', {
              class: 'buy-btn nine-btn',
              disabled: !canBuy || undefined,
              onclick: () => {
                const r = buyFish(G.getState(), sp.id);
                if (!r.ok) { sfx('fail'); toast(r.reason); return; }
                G.commit();
                sfx('buy');
                openReveal(r.fish.uid);
              },
            }, [coinIcon(), priceLabel(sp.price)]),
          ]);
        }),
      ]);
    } else if (shopTab === 'pets') {
      list = el('div', { class: 'card-list' }, LAND_PETS.map((p) => {
        const owned = state.landPets.find((x) => x.type === p.id);
        return el('div', { class: 'card nine-card' }, [
          el('div', { class: 'card-thumb' }, [petThumb(p.id, 64, 64)]),
          el('div', {}, [
            el('div', { class: 'card-name' }, [p.name]),
            el('div', { class: 'card-meta' }, [
              `${p.breed}・全體產出 +${Math.round(p.bonus * 100)}%`,
              owned ? el('br') : null,
              owned ? `已互動 ${owned.affection} 次` : null,
            ]),
          ]),
          owned
            ? el('button', { class: 'buy-btn nine-btn2', disabled: true }, ['已擁有'])
            : el('button', {
              class: 'buy-btn nine-btn',
              disabled: state.coins < priceOf(p.price) || undefined,
              onclick: () => {
                const r = buyLandPet(G.getState(), p.id);
                if (!r.ok) { sfx('fail'); toast(r.reason ?? ''); return; }
                G.commit();
                sfx('buy');
                sfx(p.kind);
                toast(`${p.name} 搬進了房間！點牠可以互動`);
                replaceSheetContent(render());
              },
            }, [coinIcon(), priceLabel(p.price)]),
        ]);
      }));
    } else {
      list = decorList(() => replaceSheetContent(render()));
    }
    return el('div', {}, [tabs, list]);
  };

  /** @param {string} label @param {'fish'|'pets'|'decor'} id */
  function tabBtn(label, id) {
    return el('button', {
      class: 'tab ' + (shopTab === id ? 'nine-tab-on is-active' : 'nine-tab'),
      onclick: () => { shopTab = id; replaceSheetContent(render()); },
    }, [label]);
  }

  openSheet(sheetId, '商店', render(), { onClose: stopLive });
  live(render);
}

/** 測試模式下圖鑑全開 */
function codexAll() {
  return TEST_MODE.enabled && TEST_MODE.codexAll;
}

/** 價格標示：測試模式顯示「免費」並保留原價參考 @param {number} price */
function priceLabel(price) {
  return priceOf(price) === 0 && price > 0 ? `免費` : fmt(price);
}

/**
 * 裝飾：目前是房間背景。免費或已解鎖的可以直接使用，其他要花珍珠解鎖。
 * @param {() => void} refresh
 */
function decorList(refresh) {
  const state = G.getState();
  return el('div', {}, [
    el('div', { class: 'codex-summary' }, ['房間背景']),
    el('div', { class: 'card-list' }, G.themes().map((t) => {
      const owned = ownsTheme(state, t.id, t.price);
      const using = state.theme === t.id;
      /** @type {Node} */
      let action;
      if (using) {
        action = el('button', { class: 'buy-btn nine-btn2', disabled: true }, ['使用中']);
      } else if (owned) {
        action = el('button', {
          class: 'buy-btn nine-btn',
          onclick: async (/** @type {MouseEvent} */ e) => {
            /** @type {HTMLButtonElement} */ (e.currentTarget).disabled = true;
            await G.setTheme(t.id);
            toast(`房間換成了「${t.name}」`);
            refresh();
          },
        }, ['使用']);
      } else {
        action = el('button', {
          class: 'buy-btn nine-btn',
          disabled: state.coins < priceOf(t.price) || undefined,
          onclick: async () => {
            const r = buyTheme(G.getState(), t.id, t.price);
            if (!r.ok) { sfx('fail'); toast(r.reason ?? ''); return; }
            G.commit();
            sfx('unlock');
            await G.setTheme(t.id);
            toast(`解鎖了「${t.name}」！`);
            refresh();
          },
        }, [coinIcon(), priceLabel(t.price)]);
      }
      return el('div', { class: 'card nine-card decor-card' }, [
        t.thumb ? el('img', { class: 'decor-thumb', src: '/assets/' + t.thumb, alt: '', draggable: 'false' }) : el('div'),
        el('div', {}, [
          el('div', { class: 'card-name' }, [t.name]),
          el('div', { class: 'card-meta' }, [owned ? '已擁有' : '解鎖後可隨時切換']),
        ]),
        action,
      ]);
    })),
    el('div', { class: 'notice' }, ['更多裝飾即將推出。']),
  ]);
}

// ================= 購買結果 =================

/** @param {number} uid */
export function openReveal(uid) {
  stopLive();
  const f = G.getState().fish.find((x) => x.uid === uid);
  if (!f) return;
  const sp = getSpecies(f.species);
  sfx('newFish');
  const node = el('div', { class: 'reveal' }, [
    el('div', { class: 'reveal-hero' }, [fishThumb(sp.id, 170, 170)]),
    el('div', { class: 'reveal-title' }, [`${sp.name} 來到了水族箱！`]),
    el('div', { class: 'muted' }, ['現在還是寶寶，', `大約 ${fmtDuration(sp.adultMin * 60)}後長大。`, el('br'), '長大後產出會越來越多。']),
    el('button', { class: 'primary-btn nine-btn', onclick: () => openShop() }, ['繼續逛商店']),
    el('button', { class: 'ghost-btn nine-btn2', onclick: () => { closeSheet(); G.select(uid); } }, ['去看看牠']),
  ]);
  openSheet('reveal', '新夥伴', node);
}

// ================= 圖鑑 =================

export function openCodex() {
  stopLive();
  const state = G.getState();
  const p = codexProgress(state);
  const all = codexAll();
  const grid = el('div', { class: 'codex-grid' }, SPECIES.map((sp) => {
    const entry = state.codex[sp.id];
    const known = all || !!entry;
    return el('button', {
      class: 'codex-cell nine-card' + (known ? '' : ' locked'),
      onclick: () => known ? openCodexEntry(sp.id) : toast('尚未發現這個種類'),
    }, [
      el('div', { class: 'card-thumb' }, [fishThumb(sp.id, 76, 76, { silhouette: !known })]),
      el('div', { class: 'name' }, [known ? sp.name : '？？？']),
    ]);
  }));
  openSheet('codex', '水族圖鑑', el('div', {}, [
    el('div', { class: 'codex-summary' }, [
      all
        ? `測試模式：圖鑑全部開放（實際已發現 ${p.found}/${p.species} 種）`
        : `已發現 ${p.found}/${p.species} 種`,
    ]),
    grid,
  ]));
}

/** @param {string} speciesId */
function openCodexEntry(speciesId) {
  const state = G.getState();
  const sp = getSpecies(speciesId);
  const entry = state.codex[speciesId];
  const alive = state.fish.filter((f) => f.species === speciesId).length;
  openSheet('codex-entry', sp.name, el('div', {}, [
    el('div', { class: 'info-hero' }, [fishThumb(sp.id, 150, 150)]),
    el('p', { class: 'desc' }, [sp.desc]),
    el('div', { class: 'stat-rows' }, [
      row('累計飼養', `${entry?.raised ?? 0} 隻`),
      row('累計放生', `${entry?.released ?? 0} 隻`),
      row('目前在水族箱', `${alive} 隻`),
      row('成年產出', `每秒 +${fmtRate(sp.income)}`),
      row('長大時間', fmtDuration(sp.adultMin * 60)),
    ]),
    el('button', { class: 'ghost-btn nine-btn2', onclick: openCodex }, ['返回圖鑑']),
  ]));
}

// ================= 魚的資訊 =================

/** @param {number} uid */
export function openFishInfo(uid) {
  let confirming = false;
  const render = () => {
    const state = G.getState();
    const f = state.fish.find((x) => x.uid === uid);
    if (!f) {
      return el('div', { class: 'notice' }, ['找不到這隻夥伴。']);
    }
    const sp = getSpecies(f.species);
    return el('div', {}, [
      el('div', { class: 'info-hero' }, [fishThumb(sp.id, 150, 150)]),
      el('div', { class: 'stat-rows' }, [
        row('階段', BALANCE.stages[stageOf(f)].name),
        growthRow(f, sp),
        row('目前產出', `每秒 +${fmtRate(fishIncome(f, petBonus(state)))}`),
        row('已陪伴', fmtDuration(f.ageSec)),
      ]),
      el('p', { class: 'desc' }, [sp.desc]),
      confirming
        ? el('div', { class: 'release-confirm' }, [
          el('div', { class: 'muted' }, [`確定要讓${sp.name}回到大海嗎？放生後不會退還珍珠。`]),
          el('div', { class: 'release-row' }, [
            el('button', { class: 'ghost-btn nine-btn2', onclick: () => { confirming = false; replaceSheetContent(render()); } }, ['再想想']),
            el('button', {
              class: 'danger-btn nine-btn2',
              onclick: () => {
                const r = releaseFish(G.getState(), uid);
                if (!r) return;
                G.commit();
                G.onReleased(uid);
                closeSheet();
                sfx('release');
                toast(`${sp.name} 回到了大海，祝牠一路順風`);
              },
            }, ['放生']),
          ]),
        ])
        : el('button', {
          class: 'ghost-btn nine-btn2',
          onclick: () => { confirming = true; replaceSheetContent(render()); },
        }, ['放生']),
    ]);
  };
  const sp = getSpecies(G.getState().fish.find((x) => x.uid === uid)?.species ?? SPECIES[0].id);
  G.select(uid);
  openSheet('fish-info', sp.name, render(), {
    onClose: () => { stopLive(); G.select(null); },
  });
  live(render);
}

/**
 * 成長進度列（長大後顯示「已長大」）
 * @param {import('../core/state.js').FishData} f
 * @param {import('../config/species.js').Species} sp
 */
function growthRow(f, sp) {
  const p = growthProgress(f);
  if (p >= 1) return row('成長', '已長大');
  return el('div', { class: 'stat-row growth-row' }, [
    el('span', {}, ['成長']),
    el('div', { class: 'growth' }, [
      el('div', { class: 'bar' }, [el('i', { style: { width: `${(p * 100).toFixed(1)}%` } })]),
      el('span', { class: 'growth-left' }, [`還要 ${fmtDuration(sp.adultMin * 60 - f.ageSec)}`]),
    ]),
  ]);
}

/** @param {string} label @param {Node|string} value */
function row(label, value) {
  return el('div', { class: 'stat-row' }, [el('span', {}, [label]), el('span', {}, [value])]);
}

// ================= 離線收益 =================

/**
 * @param {{ earned: number, awaySec: number, countedSec: number }} r
 */
export function openOffline(r) {
  stopLive();
  const capped = r.awaySec > r.countedSec + 1;
  sfx('offline');
  openSheet('offline', '歡迎回來', el('div', { class: 'reveal' }, [
    el('div', { class: 'muted' }, [`你離開了 ${fmtDuration(r.awaySec)}，水族箱裡的夥伴們幫你累積了`]),
    el('div', { class: 'offline-amount' }, [coinIcon(), `+${fmt(r.earned)}`]),
    capped ? el('div', { class: 'muted' }, [`（離線收益最多計算 ${BALANCE.offlineCapHours} 小時）`]) : null,
    el('button', { class: 'primary-btn nine-btn', onclick: closeSheet }, ['收下']),
  ]), { silent: true });
}

// ================= 裝飾（預留） =================

export function openDecor() {
  stopLive();
  const render = () => decorList(() => replaceSheetContent(render()));
  openSheet('decor', '裝飾', render(), { onClose: stopLive });
  live(render);
}

// ================= 設定 =================

/** @param {{ canFullscreen: boolean, toggleFullscreen: () => void, standalone: boolean, version: string }} opts */
export function openSettings(opts) {
  stopLive();
  const state = G.getState();
  openSheet('settings', '設定', el('div', {}, [
    el('div', { class: 'about-title' }, ['PPPYLLES']),
    TEST_MODE.enabled && TEST_MODE.tools ? testTools() : null,
    volumeBlock(),
    el('div', { class: 'stat-rows' }, [
      row('累計獲得資源', fmt(state.totalEarned)),
      row('水族箱夥伴', `${state.fish.length} 隻`),
      row('陸地寵物', `${state.landPets.length} 隻`),
      row('帳號', '訪客（帳號功能即將推出）'),
      row('版本', opts.version),
    ]),
    opts.canFullscreen
      ? el('button', { class: 'primary-btn nine-btn', onclick: opts.toggleFullscreen }, ['切換全螢幕'])
      : null,
    !opts.standalone
      ? el('p', { class: 'muted', style: { marginTop: '14px' } }, [
        '手機上想要完全滿版：在瀏覽器選單選擇「加入主畫面」，從主畫面打開就不會有網址列。',
      ])
      : null,
    resetBlock(),
  ]));
}

/** 音樂、音效音量（存在這台裝置，不跟著存檔） */
function volumeBlock() {
  const v = getVolumes();
  /** @param {'music'|'sfx'} kind @param {string} label */
  const slider = (kind, label) => {
    const val = el('span', { class: 'vol-val' }, [volText(v[kind])]);
    const input = el('input', {
      type: 'range', min: 0, max: 100, step: 5, value: Math.round(v[kind] * 100),
      class: 'vol-range', 'aria-label': label,
      oninput: () => {
        const x = Number(input.value) / 100;
        setVolume(kind, x);
        val.textContent = volText(x);
      },
      onchange: () => { if (kind === 'sfx') sfx('buy'); },
    });
    return el('label', { class: 'vol-row' }, [el('span', { class: 'vol-label' }, [label]), input, val]);
  };
  return el('div', { class: 'vol-block' }, [slider('music', '音樂'), slider('sfx', '音效')]);
}

/** @param {number} x */
function volText(x) {
  return x <= 0 ? '關閉' : `${Math.round(x * 100)}%`;
}

/**
 * 重新開始：在面板內兩段式確認。
 * 不使用瀏覽器的 confirm()：加入主畫面的網頁 App 裡它常常不會跳出、直接當成取消。
 */
function resetBlock() {
  const box = el('div', { class: 'reset-block' }, []);
  const ask = () => {
    box.replaceChildren(el('button', { class: 'danger-btn nine-btn2', onclick: confirmStep }, ['重新開始遊戲']));
  };
  const confirmStep = () => {
    box.replaceChildren(el('div', { class: 'release-confirm' }, [
      el('div', { class: 'muted' }, ['確定要清除所有進度、重新開始嗎？此動作無法復原。']),
      el('div', { class: 'release-row' }, [
        el('button', { class: 'ghost-btn nine-btn2', onclick: ask }, ['再想想']),
        el('button', {
          class: 'danger-btn nine-btn2',
          onclick: async () => {
            await G.resetGame();
            closeSheet();
            toast('已重新開始');
            openStarterPick();
          },
        }, ['確定重新開始']),
      ]),
    ]));
  };
  ask();
  return box;
}

/**
 * 開始遊戲時選擇第一隻陸地寵物（三選一、免費）。選好之前面板關不掉。
 */
export function openStarterPick() {
  const cards = LAND_PETS.map((p) => el('div', { class: 'card nine-card' }, [
    el('div', { class: 'card-thumb' }, [petThumb(p.id, 64, 64)]),
    el('div', {}, [
      el('div', { class: 'card-name' }, [p.name]),
      el('div', { class: 'card-meta' }, [`${p.breed}・全體產出 +${Math.round(p.bonus * 100)}%`]),
      el('div', { class: 'card-meta starter-desc' }, [p.desc]),
    ]),
    el('button', {
      class: 'buy-btn nine-btn',
      onclick: () => {
        if (!adoptStarterPet(G.getState(), p.id)) return;
        G.commit();
        closeSheet();
        sfx(p.kind);
        toast(`${p.name} 搬進了房間！點水母或 ${p.name} 看看`);
      },
    }, ['就是牠']),
  ]));
  openSheet('starter', '選擇你的第一隻夥伴', el('div', {}, [
    el('p', { class: 'muted starter-lead' }, [
      '牠會免費陪著你。其他夥伴之後可以在商店用珍珠帶回家。',
    ]),
    el('div', { class: 'card-list' }, cards),
  ]), { locked: true });
}

/** 測試工具（只在測試模式出現） */
function testTools() {
  /** @param {string} label @param {() => void} fn */
  const btn = (label, fn) => el('button', { class: 'ghost-btn nine-btn2', onclick: fn }, [label]);
  return el('div', { class: 'test-tools nine-card' }, [
    el('div', { class: 'test-title' }, ['測試工具']),
    el('div', { class: 'muted' }, [
      '測試模式中：'
      + (TEST_MODE.freeShop ? '購買全部免費、' : '')
      + (TEST_MODE.codexAll ? '圖鑑全開、' : '')
      + '水族箱上限 ' + TEST_MODE.tankCapacity + ' 隻。',
    ]),
    el('div', { class: 'test-grid' }, [
      btn('快轉 10 分鐘', () => { G.fastForward(600); toast('時間快轉了 10 分鐘'); }),
      btn('快轉 1 小時', () => { G.fastForward(3600); toast('時間快轉了 1 小時'); }),
      btn('快轉 1 天', () => { G.fastForward(86400); toast('時間快轉了 1 天'); }),
      btn('每種各放一隻', () => {
        const st = G.getState();
        let n = 0;
        for (const sp of SPECIES) {
          if (st.fish.length >= tankCapacity()) break;
          if (st.fish.some((f) => f.species === sp.id)) continue;
          const r = buyFish(st, sp.id);
          if (r.ok) n++;
        }
        G.commit();
        toast(n ? `放入了 ${n} 隻新夥伴` : '每種都已經有了，或水族箱已滿');
      }),
      btn('清空水族箱', () => {
        const st = G.getState();
        st.fish = [];
        G.commit();
        toast('水族箱已清空');
      }),
      btn('擁有全部貓狗', () => {
        const st = G.getState();
        for (const p of LAND_PETS) buyLandPet(st, p.id);
        G.commit();
        toast('全部貓狗都來了');
      }),
    ]),
  ]);
}

export { currentSheet, closeSheet };
