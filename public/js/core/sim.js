// @ts-check
import { BALANCE } from '../config/balance.js';
import { getSpecies, SPECIES } from '../config/species.js';
import { getQuality, QUALITIES } from '../config/quality.js';
import { getLandPet } from '../config/landpets.js';

/**
 * 純規則計算，不碰畫面。所有數值結算都經過這裡，
 * 日後若要伺服器驗證，可以把這支檔案直接搬到後端共用。
 */

/** @typedef {import('./state.js').GameState} GameState */
/** @typedef {import('./state.js').FishData} FishData */

/**
 * @param {FishData} f
 * @returns {import('../config/balance.js').StageId}
 */
export function stageOf(f) {
  const sp = getSpecies(f.species);
  const adultSec = sp.adultMin * 60;
  if (f.ageSec < adultSec * BALANCE.fryFraction) return 'fry';
  if (f.ageSec < adultSec) return 'juvenile';
  if (f.ageSec < f.lifeSec * BALANCE.elderFraction) return 'adult';
  return 'elder';
}

/**
 * 成長進度 0~1（幼魚到成魚之間用於平滑縮放）
 * @param {FishData} f
 */
export function growthScale(f) {
  const sp = getSpecies(f.species);
  const adultSec = sp.adultMin * 60;
  const t = Math.min(1, f.ageSec / adultSec);
  const s0 = BALANCE.stages.fry.scale;
  return s0 + (1 - s0) * Math.sqrt(t);
}

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
  const st = BALANCE.stages[stageOf(f)];
  return sp.income * q.incomeMult * st.incomeMult * (1 + bonus);
}

/** 全體每秒產出 @param {GameState} state */
export function totalIncome(state) {
  const bonus = petBonus(state);
  return state.fish.reduce((sum, f) => sum + fishIncome(f, bonus), 0);
}

/**
 * @typedef {Object} AdvanceResult
 * @property {number} earned
 * @property {FishData[]} died
 */

/**
 * 推進遊戲時間。會依序：計算收益 → 增加年齡 → 處理壽終。
 * 長時間（離線）會切成小段計算，確保魚在中途長大或離世時收益正確。
 * @param {GameState} state
 * @param {number} dtSec
 * @param {number} now  現在時間（ms），用來寫入離世紀錄
 * @returns {AdvanceResult}
 */
export function advance(state, dtSec, now) {
  /** @type {AdvanceResult} */
  const result = { earned: 0, died: [] };
  if (dtSec <= 0) return result;
  const STEP = 30;
  let remaining = dtSec;
  while (remaining > 0) {
    const dt = Math.min(STEP, remaining);
    remaining -= dt;
    const bonus = petBonus(state);
    for (const f of state.fish) {
      // 若這一小段中途壽終，只算到壽終為止
      const alive = Math.max(0, Math.min(dt, f.lifeSec - f.ageSec));
      result.earned += fishIncome(f, bonus) * alive;
      f.ageSec += dt;
    }
    const dead = state.fish.filter((f) => f.ageSec >= f.lifeSec);
    if (dead.length) {
      state.fish = state.fish.filter((f) => f.ageSec < f.lifeSec);
      for (const f of dead) {
        result.died.push(f);
        state.memorial.unshift({ species: f.species, quality: f.quality, at: now });
      }
      state.memorial.length = Math.min(state.memorial.length, 50);
    }
  }
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
  const sp = getSpecies(speciesId);
  const q = getQuality(quality);
  // 壽命加入 ±10% 的個體差異，讓魚不會同時離世
  const variance = 0.9 + Math.random() * 0.2;
  /** @type {FishData} */
  const fish = {
    uid: state.nextUid++,
    species: speciesId,
    quality,
    ageSec: 0,
    lifeSec: Math.round(sp.lifeHours * 3600 * q.lifeMult * variance),
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
  if (state.fish.length >= BALANCE.tankCapacity) return { ok: false, reason: '水族箱已經滿了' };
  if (state.coins < sp.price) return { ok: false, reason: '資源不足' };
  state.coins -= sp.price;
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
  if (state.coins < p.price) return { ok: false, reason: '資源不足' };
  state.coins -= p.price;
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
 * 計算離線結算
 * @param {GameState} state
 * @param {number} awaySec  真實離開秒數
 * @param {number} now
 */
export function settleOffline(state, awaySec, now) {
  const capSec = BALANCE.offlineCapHours * 3600;
  const incomeSec = Math.min(awaySec, capSec);
  if (BALANCE.offlineAgingCapped) {
    const r = advance(state, incomeSec, now);
    return { ...r, awaySec, countedSec: incomeSec };
  }
  // 魚照真實時間老化，但收益只算前 capSec 秒
  const before = state.coins;
  const r1 = advance(state, incomeSec, now);
  const r2 = advance(state, awaySec - incomeSec, now);
  state.coins = before + r1.earned;
  state.totalEarned -= r2.earned;
  return { earned: r1.earned, died: [...r1.died, ...r2.died], awaySec, countedSec: incomeSec };
}

/** 圖鑑完成度 @param {GameState} state */
export function codexProgress(state) {
  const species = SPECIES.length;
  const found = SPECIES.filter((s) => state.codex[s.id]).length;
  const qualities = SPECIES.reduce((n, s) => n + (state.codex[s.id]?.qualities.length ?? 0), 0);
  return { species, found, qualities, qualitiesTotal: species * QUALITIES.length };
}
