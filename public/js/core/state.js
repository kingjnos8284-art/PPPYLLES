// @ts-check
import { BALANCE } from '../config/balance.js';
import { hasSpecies } from '../config/species.js';
import { hasLandPet } from '../config/landpets.js';

/**
 * 存檔資料結構。所有會被存起來的東西都在這裡，
 * 日後換成伺服器存檔時，整包 GameState 就是要上傳的內容。
 */

export const SAVE_VERSION = 5;

/**
 * @typedef {Object} FishData
 * @property {number} uid
 * @property {string} species
 * @property {number} ageSec        已陪伴秒數
 * @property {string} [nickname]
 */

/**
 * @typedef {Object} LandPetData
 * @property {string} type
 * @property {number} lastTapAt     上次互動時間（ms）
 * @property {number} affection     互動次數
 */

/**
 * @typedef {Object} CodexEntry
 * @property {number} [released]  累計放生數
 * @property {number} raised        累計飼養數
 */

/**
 * @typedef {Object} GameState
 * @property {number} version
 * @property {number} createdAt
 * @property {number} lastTick       最後一次結算時間（ms），用來計算離線收益
 * @property {number} coins
 * @property {number} totalEarned
 * @property {number} nextUid
 * @property {FishData[]} fish
 * @property {LandPetData[]} landPets
 * @property {Record<string, CodexEntry>} codex
 * @property {any[]} memorial  舊版的離世紀錄（已不再使用，保留欄位相容舊存檔）
 * @property {{ owned: string[], placed: { id: string, x: number, y: number }[] }} decor  預留
 * @property {{ userId: string|null }} account  預留：日後帳號系統
 * @property {string} theme        房間主題（forest / stellar）
 */

/**
 * @param {number} now
 * @returns {GameState}
 */
export function createNewState(now) {
  /** @type {GameState} */
  const state = {
    version: SAVE_VERSION,
    createdAt: now,
    lastTick: now,
    coins: BALANCE.startCoins,
    totalEarned: 0,
    nextUid: 1,
    fish: [],
    landPets: [{ type: BALANCE.starterPet, lastTapAt: 0, affection: 0 }],
    codex: {},
    memorial: [],
    decor: { owned: [], placed: [] },
    account: { userId: null },
    theme: 'forest',
  };
  return state;
}

/**
 * 舊版存檔升級。每次改動存檔結構時，SAVE_VERSION +1 並在這裡加一段轉換。
 * @param {any} raw
 * @returns {GameState|null}
 */
export function migrate(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.version !== 'number') return null;
  if (raw.version > SAVE_VERSION) return null; // 比程式還新的存檔，不認得
  raw.decor ??= { owned: [], placed: [] };
  raw.account ??= { userId: null };
  // 原木房間已移除：舊存檔改用森林精靈屋
  if (!raw.theme || raw.theme === 'room') raw.theme = 'forest';
  // 星空水晶館改為要購買的裝飾：之前已經在用的玩家直接保留
  if (raw.theme === 'stellar' && !raw.decor.owned.includes('bg:stellar')) raw.decor.owned.push('bg:stellar');
  raw.memorial ??= [];

  // v1 → v2：生物名單改為水母為主。已移除的種類換成星光水母（保留品質與年齡），圖鑑只留現有種類
  if (raw.version === 1) {
    for (const f of raw.fish ?? []) {
      if (!hasSpecies(f.species)) f.species = 'star_blue';
    }
    raw.version = 2;
  }
  // v2 → v3：陸地寵物改為貓狗。寄居蟹換成賓士貓，陸龜／水豚換成長毛臘腸（不另扣款）
  if (raw.version === 2) {
    /** @type {Record<string, string>} */
    const map = { crab: 'cat_tuxedo', turtle: 'dog_dachshund', capybara: 'dog_dachshund' };
    for (const p of raw.landPets ?? []) if (map[p.type]) p.type = map[p.type];
    raw.version = 3;
  }
  // v3 → v4：移除藍倒吊、小丑魚、河豚。已擁有的換成同品質、同年齡的星光水母
  if (raw.version === 3) {
    for (const f of raw.fish ?? []) {
      if (!hasSpecies(f.species)) f.species = 'star_blue';
    }
    raw.version = 4;
  }
  // 陸地寵物：去除不認得與重複的，並確保有初始寵物
  /** @type {Set<string>} */
  const seenPets = new Set();
  raw.landPets = (raw.landPets ?? []).filter((/** @type {any} */ p) => {
    if (!hasLandPet(p.type) || seenPets.has(p.type)) return false;
    seenPets.add(p.type);
    return true;
  });
  if (!seenPets.has(BALANCE.starterPet)) raw.landPets.unshift({ type: BALANCE.starterPet, lastTapAt: 0, affection: 0 });

  // 已移除成長、壽命與品質：清掉舊存檔的對應欄位（v4 → v5）
  for (const f of raw.fish ?? []) { delete f.lifeSec; delete f.quality; }
  for (const e of Object.values(raw.codex ?? {})) delete /** @type {any} */ (e).qualities;
  if (raw.version === 4) raw.version = 5;

  // 保險：任何不認得的種類都清掉，避免畫面出錯
  raw.fish = (raw.fish ?? []).filter((/** @type {any} */ f) => hasSpecies(f.species));
  for (const k of Object.keys(raw.codex ?? {})) if (!hasSpecies(k)) delete raw.codex[k];
  for (const f of raw.fish) {
    const e = (raw.codex[f.species] ??= { raised: 0 });
    e.raised = Math.max(e.raised, 1);
  }
  raw.memorial = raw.memorial.filter((/** @type {any} */ m) => hasSpecies(m.species));
  return /** @type {GameState} */ (raw);
}
