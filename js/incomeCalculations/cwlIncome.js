import { calculateWarIncome } from '../utils/incomeUtils.js';

export function calculateCwlIncome(cwlState) {
    const { winRate, drawRate, oresPerAttack, hitsPerSeason } = cwlState;
    const attacksPerEvent = 1;
    return calculateWarIncome(winRate, drawRate, oresPerAttack, attacksPerEvent, hitsPerSeason);
}