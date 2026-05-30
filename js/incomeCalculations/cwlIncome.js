import { calculateWarIncome } from '../utils/incomeUtils.js';

export function calculateCwlIncome(cwlState = {}) {
    const { winRate = 50, drawRate = 0, oresPerAttack = {}, hitsPerSeason = 0 } = cwlState;
    const attacksPerEvent = 1;
    return calculateWarIncome(winRate, drawRate, oresPerAttack, attacksPerEvent, hitsPerSeason);
}