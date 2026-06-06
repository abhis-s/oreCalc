import { calculateWarIncome } from '../utils/incomeUtils.js';

export function calculateClanWarIncome(clanWarState = {}) {
    const { winRate = 50, drawRate = 0, oresPerAttack = {}, warsPerMonth = 0 } = clanWarState;
    const attacksPerEvent = 2;
    return calculateWarIncome(winRate, drawRate, oresPerAttack, attacksPerEvent, warsPerMonth);
}