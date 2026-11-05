// @ts-check
import { SPECIES, getSpecies } from '../config/species.js';
import { QUALITIES, getQuality } from '../config/quality.js';
import { LAND_PETS, getLandPet } from '../config/landpets.js';
import { BALANCE, TEST_MODE, tankCapacity, priceOf } from '../config/balance.js';
import { DECOR_ENABLED } from '../config/decor.js';
import { buyFish, buyLandPet, codexProgress, fishIncome, petBonus, stageOf } from '../core/sim.js';
import { fishThumb, petThumb } from '../render/thumb.js';
import { el, fmt, fmtRate, fmtDuration, qualityBadge, qualityGem, coinIcon } from './dom.js';
import { openSheet, replaceSheetContent, closeSheet, currentSheet } from './sheet.js';
import { toast } from './toast.js';

/**
 * 各個面板。所有面板都透過 GameContext 讀寫遊戲，不直接碰存檔或畫面細節。
 * @typedef {Object} GameContext
 * @property {() => import('../core/state.js').GameState} getState
 * @property {() => void} commit       數值改變後呼叫：存檔＋更新 HUD
 * @property {(uid: number|null) => void} select   在水族箱中標示某隻魚
 * @property {() => Promise<void>} resetGame
 * @property {(sec: number) => void} fastForward   測試用：快轉遊戲時間
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
        full ? el('div', { class: 'notice' }, ['水族箱已經滿了，等夥伴自然離開後才能再放入新的。']) : null,
        ...[...SPECIES].sort((x, y) => x.price - y.price).map((sp) => {
          // 太貴的魚種先以剪影顯示，累積到一定資源後揭曉，保留一點期待感
          const unlocked = codexAll() || !!state.codex[sp.id] || sp.price <= Math.max(150, state.totalEarned);
          const price = priceOf(sp.price);
          const canBuy = !full && state.coins >= price;
          return el('div', { class: 'card nine-card' }, [
            el('div', { class: 'card-thumb' }, [fishThumb(sp.id, 64, 64, { silhouette: !unlocked })]),
            el('div', {}, [
              el('div', { class: 'card-name' }, [unlocked ? sp.name : '？？？']),
              el('div', { class: 'card-meta' }, [
                `每秒 +${fmtRate(sp.income)} 起・壽命約 ${Math.round(sp.lifeHours / 24 * 10) / 10} 天`,
                el('br'),
                `${fmtDuration(sp.adultMin * 60)}長成`,
              ]),
            ]),
            el('button', {
              class: 'buy-btn nine-btn',
              disabled: !canBuy || undefined,
              onclick: () => {
                const r = buyFish(G.getState(), sp.id);
                if (!r.ok) { toast(r.reason); return; }
                G.commit();
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
              `全體產出 +${Math.round(p.bonus * 100)}%・永遠陪伴`,
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
                if (!r.ok) { toast(r.reason ?? ''); return; }
                G.commit();
                toast(`${p.name} 搬進了房間！點牠可以互動`);
                replaceSheetContent(render());
              },
            }, [coinIcon(), priceLabel(p.price)]),
        ]);
      }));
    } else {
      list = decorNotice();
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

function decorNotice() {
  return el('div', { class: 'notice' }, [
    DECOR_ENABLED ? '' : '裝飾功能即將推出', el('br'),
    '之後可以在水族箱擺放水草、岩石與各種擺飾，部分裝飾還會提升產出。',
  ]);
}

// ================= 購買結果 =================

/** @param {number} uid */
export function openReveal(uid) {
  stopLive();
  const f = G.getState().fish.find((x) => x.uid === uid);
  if (!f) return;
  const sp = getSpecies(f.species);
  const q = getQuality(f.quality);
  const rare = q.id !== 'gray' && q.id !== 'green';
  const node = el('div', { class: 'reveal' }, [
    el('div', { class: 'reveal-hero', style: { '--qc': q.color } }, [fishThumb(sp.id, 170, 170)]),
    el('div', {}, [qualityBadge(q)]),
    el('div', { class: 'reveal-title' }, [`${rare ? '太幸運了！' : ''}獲得 ${q.name}色品質的${sp.name}`]),
    el('div', { class: 'muted' }, [
      `產出倍率 ×${q.incomeMult}・壽命 ×${q.lifeMult}`, el('br'),
      '牠會從幼體開始，慢慢長大。',
    ]),
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
      qualityDots(all ? QUALITIES.map((q) => q.id) : entry?.qualities ?? []),
    ]);
  }));
  openSheet('codex', '水族圖鑑', el('div', {}, [
    el('div', { class: 'codex-summary' }, [
      all
        ? `測試模式：圖鑑全部開放（實際已發現 ${p.found}/${p.species} 種）`
        : `已發現 ${p.found}/${p.species} 種・品質收集 ${p.qualities}/${p.qualitiesTotal}`,
    ]),
    grid,
  ]));
}

/** @param {string[]} owned */
function qualityDots(owned) {
  return el('span', { class: 'q-dots' }, QUALITIES.map((q) => {
    const g = qualityGem(q.id, 'q-dot' + (owned.includes(q.id) ? ' on' : ''));
    g.title = q.name;
    return g;
  }));
}

/** @param {string} speciesId */
function openCodexEntry(speciesId) {
  const state = G.getState();
  const sp = getSpecies(speciesId);
  const entry = state.codex[speciesId];
  const alive = state.fish.filter((f) => f.species === speciesId).length;
  const owned = codexAll() ? QUALITIES.map((q) => q.id) : entry?.qualities ?? [];
  const best = [...QUALITIES].reverse().find((q) => owned.includes(q.id));
  openSheet('codex-entry', sp.name, el('div', {}, [
    el('div', { class: 'info-hero' }, [fishThumb(sp.id, 150, 150)]),
    el('p', { class: 'desc' }, [sp.desc]),
    el('div', { class: 'stat-rows' }, [
      row('已收集品質', qualityDots(owned)),
      row('最高品質', best ? qualityBadge(best) : '—'),
      row('累計飼養', `${entry?.raised ?? 0} 隻`),
      row('目前在水族箱', `${alive} 隻`),
      row('成年基礎產出', `每秒 +${fmtRate(sp.income)}`),
      row('長成時間', fmtDuration(sp.adultMin * 60)),
      row('基礎壽命', fmtDuration(sp.lifeHours * 3600)),
    ]),
    el('button', { class: 'ghost-btn nine-btn2', onclick: openCodex }, ['返回圖鑑']),
  ]));
}

// ================= 魚的資訊 =================

/** @param {number} uid */
export function openFishInfo(uid) {
  const render = () => {
    const state = G.getState();
    const f = state.fish.find((x) => x.uid === uid);
    if (!f) {
      return el('div', { class: 'notice' }, ['牠已經安詳地離開了。']);
    }
    const sp = getSpecies(f.species);
    const q = getQuality(f.quality);
    const stage = BALANCE.stages[stageOf(f)];
    const lifeLeft = f.lifeSec - f.ageSec;
    const lifePct = Math.max(0, 1 - f.ageSec / f.lifeSec);
    const growPct = Math.min(1, f.ageSec / (sp.adultMin * 60));
    return el('div', {}, [
      el('div', { class: 'info-hero' }, [fishThumb(sp.id, 150, 150)]),
      el('div', { class: 'stat-rows' }, [
        row('品質', qualityBadge(q)),
        row('階段', stage.name),
        growPct < 1
          ? rowBar('成長', `還要 ${fmtDuration(sp.adultMin * 60 - f.ageSec)}`, growPct, false)
          : null,
        rowBar('剩餘壽命', fmtDuration(lifeLeft), lifePct, lifePct < 0.15),
        row('目前產出', `每秒 +${fmtRate(fishIncome(f, petBonus(state)))}`),
        row('已陪伴', fmtDuration(f.ageSec)),
      ]),
      el('p', { class: 'desc' }, [sp.desc]),
    ]);
  };
  const sp = getSpecies(G.getState().fish.find((x) => x.uid === uid)?.species ?? SPECIES[0].id);
  G.select(uid);
  openSheet('fish-info', sp.name, render(), {
    onClose: () => { stopLive(); G.select(null); },
  });
  live(render);
}

/** @param {string} label @param {Node|string} value */
function row(label, value) {
  return el('div', { class: 'stat-row' }, [el('span', {}, [label]), el('span', {}, [value])]);
}

/** @param {string} label @param {string} value @param {number} pct @param {boolean} warn */
function rowBar(label, value, pct, warn) {
  return el('div', { style: { padding: '8px 2px', borderBottom: '2px dashed var(--line)' } }, [
    el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '14px' } }, [
      el('span', { style: { color: 'var(--ink-soft)' } }, [label]), el('span', { style: { fontWeight: '700' } }, [value]),
    ]),
    el('div', { class: 'bar' + (warn ? ' warn' : '') }, [el('i', { style: { width: `${(pct * 100).toFixed(1)}%` } })]),
  ]);
}

// ================= 離線收益 =================

/**
 * @param {{ earned: number, died: import('../core/state.js').FishData[], awaySec: number, countedSec: number }} r
 */
export function openOffline(r) {
  stopLive();
  const capped = r.awaySec > r.countedSec + 1;
  const names = r.died.map((f) => getSpecies(f.species).name);
  openSheet('offline', '歡迎回來', el('div', { class: 'reveal' }, [
    el('div', { class: 'muted' }, [`你離開了 ${fmtDuration(r.awaySec)}，水族箱裡的夥伴們幫你累積了`]),
    el('div', { class: 'offline-amount' }, [coinIcon(), `+${fmt(r.earned)}`]),
    capped ? el('div', { class: 'muted' }, [`（離線收益最多計算 ${BALANCE.offlineCapHours} 小時）`]) : null,
    names.length
      ? el('div', { class: 'muted', style: { marginTop: '10px' } }, [`這段期間，${names.join('、')} 安詳地走完了牠的一生。`])
      : null,
    el('button', { class: 'primary-btn nine-btn', onclick: closeSheet }, ['收下']),
  ]));
}

// ================= 裝飾（預留） =================

export function openDecor() {
  stopLive();
  openSheet('decor', '裝飾', decorNotice());
}

// ================= 設定 =================

/** @param {{ canFullscreen: boolean, toggleFullscreen: () => void, standalone: boolean, version: string }} opts */
export function openSettings(opts) {
  stopLive();
  const state = G.getState();
  openSheet('settings', '設定', el('div', {}, [
    el('div', { class: 'about-logo' }, [
      el('img', { src: '/assets/ui/logo-v1.png', alt: '' }),
      el('div', { class: 'boot-title' }, ['PPPYLLES']),
    ]),
    TEST_MODE.enabled && TEST_MODE.tools ? testTools() : null,
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
    el('button', {
      class: 'danger-btn nine-btn2',
      onclick: async () => {
        if (!confirm('確定要清除所有進度、重新開始嗎？此動作無法復原。')) return;
        await G.resetGame();
        closeSheet();
        toast('已重新開始');
      },
    }, ['重新開始遊戲']),
  ]));
}

/** 測試工具（只在測試模式出現） */
function testTools() {
  /** @param {string} label @param {() => void} fn */
  const btn = (label, fn) => el('button', { class: 'ghost-btn nine-btn2', onclick: fn }, [label]);
  return el('div', { class: 'test-tools nine-card' }, [
    el('div', { class: 'test-title' }, ['🧪 測試工具']),
    el('div', { class: 'muted' }, ['測試模式中：購買全部免費、圖鑑全開、水族箱上限 ' + TEST_MODE.tankCapacity + ' 隻。']),
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
