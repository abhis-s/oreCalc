import { calculateWarIncome } from '../../utils/incomeUtils.js';
import { deepFreeze } from '../../utils/objectUtils.js';

export const CLAN_WAR_DEFAULTS = deepFreeze({
    WARS_PER_MONTH: 8,
    MIN_WARS: 0,
    MAX_WARS: 15,
    WIN_RATE: 50,
    DRAW_RATE: 0,
    ATTACKS_PER_EVENT: 2
});

/**
 * Calculates monthly and timeframe ore income derived from regular Clan Wars.
 *
 * @param {import('../../core/types.js').ClanWarIncomeState} [clanWarState={}] - Clan war parameters.
 * @returns {import('../../core/types.js').IncomeResult} Composite clan war ore income rates.
 */
export function calculateClanWarIncome(clanWarState = {}) {
    const {
        winRate = CLAN_WAR_DEFAULTS.WIN_RATE,
        drawRate = CLAN_WAR_DEFAULTS.DRAW_RATE,
        oresPerAttack = {},
        warsPerMonth = 0
    } = clanWarState;
    const attacksPerEvent = CLAN_WAR_DEFAULTS.ATTACKS_PER_EVENT;
    return calculateWarIncome(winRate, drawRate, oresPerAttack, attacksPerEvent, warsPerMonth);
}
