// @ts-check
import { BALANCE } from '../config/balance.js';

/**
 * 存檔資料結構。所有會被存起來的東西都在這裡，
 * 日後換成伺服器存檔時，整包 GameState 就是要上傳的內容。
 */

export const SAVE_VERSION = 1;

/**
 * @typedef {Object} FishData
 * @property {number} uid
 * @property {string} species
 * @property {import('../config/quality.js').QualityId} quality
 * @property {number} ageSec        已存活秒數（遊戲內時間）
 * @property {number} lifeSec       壽命秒數（購買時決定）
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
 * @property {import('../config/quality.js').QualityId[]} qualities  曾經獲得的品質
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
 * @property {{ species: string, quality: string, at: number }[]} memorial  離世紀錄（保留最近 50 筆）
 * @property {{ owned: string[], placed: { id: string, x: number, y: number }[] }} decor  預留
 * @property {{ userId: string|null }} account  預留：日後帳號系統
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
  // 範例：if (raw.version === 1) { raw.newField = ...; raw.version = 2; }
  if (raw.version > SAVE_VERSION) return null; // 比程式還新的存檔，不認得
  raw.decor ??= { owned: [], placed: [] };
  raw.account ??= { userId: null };
  raw.memorial ??= [];
  return /** @type {GameState} */ (raw);
}
