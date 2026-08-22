import { calculateWarIncome } from '../../utils/incomeUtils.js';
import { deepFreeze } from '../../utils/objectUtils.js';

export const CWL_DEFAULTS = deepFreeze({
    HITS_PER_SEASON: 7,
    MIN_HITS: 0,
    MAX_HITS: 7,
    WIN_RATE: 50,
    DRAW_RATE: 0,
    ATTACKS_PER_EVENT: 1
});

/**
 * Calculates monthly and timeframe ore income derived from Clan War Leagues (CWL).
 *
 * @param {import('../../core/types.js').CwlIncomeState} [cwlState={}] - CWL parameters.
 * @returns {import('../../core/types.js').IncomeResult} Composite CWL ore income rates.
 */
export function calculateCwlIncome(cwlState = {}) {
    const {
        winRate = CWL_DEFAULTS.WIN_RATE,
        drawRate = CWL_DEFAULTS.DRAW_RATE,
        oresPerAttack = {},
        hitsPerSeason = 0
    } = cwlState;
    const attacksPerEvent = CWL_DEFAULTS.ATTACKS_PER_EVENT;
    return calculateWarIncome(winRate, drawRate, oresPerAttack, attacksPerEvent, hitsPerSeason);
}
