// @ts-check
import { BALANCE, tankCapacity, priceOf } from '../config/balance.js';
import { getSpecies, SPECIES } from '../config/species.js';
import { getQuality, QUALITIES } from '../config/quality.js';
import { getLandPet } from '../config/landpets.js';

/**
 * 純規則計算，不碰畫面。所有數值結算都經過這裡，
 * 日後若要伺服器驗證，可以把這支檔案直接搬到後端共用。
 */

/** @typedef {import('./state.js').GameState} GameState */
/** @typedef {import('./state.js').FishData} FishData */

/** 陸地寵物帶來的總加成 @param {GameState} state */
export function petBonus(state) {
  return state.landPets.reduce((sum, p) => sum + getLandPet(p.type).bonus, 0);
}

/**
 * 單隻魚每秒產出
 * @param {FishData} f
 * @param {number} bonus
 */
export function fishIncome(f, bonus) {
  const sp = getSpecies(f.species);
  const q = getQuality(f.quality);
  return sp.income * q.incomeMult * (1 + bonus);
}

/** 全體每秒產出 @param {GameState} state */
export function totalIncome(state) {
  const bonus = petBonus(state);
  return state.fish.reduce((sum, f) => sum + fishIncome(f, bonus), 0);
}

/**
 * @typedef {Object} AdvanceResult
 * @property {number} earned
 */

/**
 * 推進遊戲時間：累積收益，並記錄每隻夥伴已陪伴的時間。
 * 水中寵物沒有成長與壽命，不會離世。
 * @param {GameState} state
 * @param {number} dtSec
 * @returns {AdvanceResult}
 */
export function advance(state, dtSec) {
  /** @type {AdvanceResult} */
  const result = { earned: 0 };
  if (dtSec <= 0) return result;
  result.earned = totalIncome(state) * dtSec;
  for (const f of state.fish) f.ageSec += dtSec;
  state.coins += result.earned;
  state.totalEarned += result.earned;
  return result;
}

/**
 * 依權重抽品質
 * @param {() => number} [rand]
 * @returns {import('../config/quality.js').QualityId}
 */
export function rollQuality(rand = Math.random) {
  const total = QUALITIES.reduce((s, q) => s + q.weight, 0);
  let r = rand() * total;
  for (const q of QUALITIES) {
    r -= q.weight;
    if (r < 0) return q.id;
  }
  return QUALITIES[0].id;
}

/**
 * 建立一隻新魚並加入水族箱
 * @param {GameState} state
 * @param {string} speciesId
 * @param {import('../config/quality.js').QualityId} quality
 */
export function addFish(state, speciesId, quality) {
  getSpecies(speciesId); // 確認種類存在
  /** @type {FishData} */
  const fish = {
    uid: state.nextUid++,
    species: speciesId,
    quality,
    ageSec: 0,
  };
  state.fish.push(fish);
  const entry = (state.codex[speciesId] ??= { qualities: [], raised: 0 });
  entry.raised += 1;
  if (!entry.qualities.includes(quality)) entry.qualities.push(quality);
  return fish;
}

/**
 * @typedef {{ ok: true, fish: FishData } | { ok: false, reason: string }} BuyResult
 */

/**
 * 購買魚苗
 * @param {GameState} state
 * @param {string} speciesId
 * @returns {BuyResult}
 */
export function buyFish(state, speciesId) {
  const sp = getSpecies(speciesId);
  const price = priceOf(sp.price);
  if (state.fish.length >= tankCapacity()) return { ok: false, reason: '水族箱已經滿了' };
  if (state.coins < price) return { ok: false, reason: '資源不足' };
  state.coins -= price;
  return { ok: true, fish: addFish(state, speciesId, rollQuality()) };
}

/**
 * 購買陸地寵物
 * @param {GameState} state
 * @param {string} petId
 * @returns {{ ok: boolean, reason?: string }}
 */
export function buyLandPet(state, petId) {
  const p = getLandPet(petId);
  if (state.landPets.some((x) => x.type === petId)) return { ok: false, reason: '已經擁有' };
  const price = priceOf(p.price);
  if (state.coins < price) return { ok: false, reason: '資源不足' };
  state.coins -= price;
  state.landPets.push({ type: petId, lastTapAt: 0, affection: 0 });
  return { ok: true };
}

/**
 * 與陸地寵物互動
 * @param {GameState} state
 * @param {string} petId
 * @param {number} now
 * @returns {{ ok: boolean, reward: number, cooldownLeft: number }}
 */
export function tapLandPet(state, petId, now) {
  const pet = state.landPets.find((x) => x.type === petId);
  if (!pet) return { ok: false, reward: 0, cooldownLeft: 0 };
  const cd = BALANCE.petTapCooldownSec * 1000;
  const left = pet.lastTapAt + cd - now;
  pet.affection += 1;
  if (left > 0) return { ok: false, reward: 0, cooldownLeft: left / 1000 };
  pet.lastTapAt = now;
  // 至少給 1，避免剛開始產出極低時沒有回饋
  const reward = Math.max(1, totalIncome(state) * getLandPet(petId).tapReward);
  state.coins += reward;
  state.totalEarned += reward;
  return { ok: true, reward, cooldownLeft: 0 };
}

/**
 * 計算離線結算：收益最多計算 BALANCE.offlineCapHours 小時
 * @param {GameState} state
 * @param {number} awaySec  真實離開秒數
 */
export function settleOffline(state, awaySec) {
  const countedSec = Math.min(awaySec, BALANCE.offlineCapHours * 3600);
  const r = advance(state, countedSec);
  // 已陪伴時間照真實時間計算
  for (const f of state.fish) f.ageSec += awaySec - countedSec;
  return { earned: r.earned, awaySec, countedSec };
}

/** 圖鑑完成度 @param {GameState} state */
export function codexProgress(state) {
  const species = SPECIES.length;
  const found = SPECIES.filter((s) => state.codex[s.id]).length;
  const qualities = SPECIES.reduce((n, s) => n + (state.codex[s.id]?.qualities.length ?? 0), 0);
  return { species, found, qualities, qualitiesTotal: species * QUALITIES.length };
}
