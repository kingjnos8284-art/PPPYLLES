// @ts-check
import { BALANCE } from '../config/balance.js';
import { totalIncome } from '../core/sim.js';
import { $, fmt, fmtRate } from './dom.js';

const coinValue = $('hud-coin-value');
const coinRate = $('hud-coin-rate');
const tank = $('hud-tank');

/** @param {import('../core/state.js').GameState} state */
export function updateHud(state) {
  coinValue.textContent = fmt(state.coins);
  coinRate.textContent = `+${fmtRate(totalIncome(state))}/秒`;
  tank.textContent = `水族 ${state.fish.length}/${BALANCE.tankCapacity}`;
}
