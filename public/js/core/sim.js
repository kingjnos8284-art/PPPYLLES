// @ts-check
import { BALANCE, tankCapacity, priceOf } from '../config/balance.js';
import { getSpecies, SPECIES } from '../config/species.js';
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
  return getSpecies(f.species).income * (1 + bonus);
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
 * 建立一隻新魚並加入水族箱
 * @param {GameState} state
 * @param {string} speciesId
 */
export function addFish(state, speciesId) {
  getSpecies(speciesId); // 確認種類存在
  /** @type {FishData} */
  const fish = {
    uid: state.nextUid++,
    species: speciesId,
    ageSec: 0,
  };
  state.fish.push(fish);
  const entry = (state.codex[speciesId] ??= { raised: 0 });
  entry.raised += 1;
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
  return { ok: true, fish: addFish(state, speciesId) };
}

/**
 * 放生：讓水母離開水族箱（不退還資源）
 * @param {GameState} state
 * @param {number} uid
 * @returns {FishData|null}
 */
export function releaseFish(state, uid) {
  const f = state.fish.find((x) => x.uid === uid);
  if (!f) return null;
  state.fish = state.fish.filter((x) => x.uid !== uid);
  const entry = state.codex[f.species];
  if (entry) entry.released = (entry.released ?? 0) + 1;
  return f;
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
  return { species, found };
}
