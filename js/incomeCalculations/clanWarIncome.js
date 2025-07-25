import { calculateWarIncome } from '../utils/incomeUtils.js';
export function calculateClanWarIncome(clanWarState) {
    const { winRate, drawRate, oresPerAttack, warsPerMonth } = clanWarState;
    const attacksPerEvent = 2;
    return calculateWarIncome(winRate, drawRate, oresPerAttack, attacksPerEvent, warsPerMonth);
}