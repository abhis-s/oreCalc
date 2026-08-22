import { getWarOreValue } from '../../data/incomeSources/warOres.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { CLAN_WAR_DEFAULTS } from '../../domain/income/clanWarIncome.js';
import { adjustWarRates } from '../../utils/incomeUtils.js';
import { logger } from '../../utils/logger.js';

import { bindNumericInput } from '../common/formBindingUtils.js';
import { dom } from '../../dom/domElements.js';

let calculatedStats = {
    clanTag: null,
    winRate: 70,
    drawRate: 0,
    warsCount: 0,
    hasCalculated: false,
    isFetching: false
};

function parseCoCDateTime(str) {
    const year = parseInt(str.substring(0, 4), 10);
    const month = parseInt(str.substring(4, 6), 10) - 1;
    const day = parseInt(str.substring(6, 8), 10);
    const hour = parseInt(str.substring(9, 11), 10);
    const minute = parseInt(str.substring(11, 13), 10);
    const second = parseInt(str.substring(13, 15), 10);
    return new Date(Date.UTC(year, month, day, hour, minute, second));
}

async function triggerWarLogFetch(clanTag) {
    if (calculatedStats.isFetching) return;

    // Cooldown check: 1 hour (3600000 ms)
    const now = Date.now();
    const lastFetch = parseInt(sessionStorage.getItem(`oreCalc_cooldown_warlog_${clanTag}`), 10) || 0;
    if (now - lastFetch < 3600000) {
        logger.debug(`Clan war fetch cooldown active for clan ${clanTag}.`);
        return;
    }

    calculatedStats.isFetching = true;
    try {
        const { fetchClanWarLog } = await import('../../services/apiService.js');
        const data = await fetchClanWarLog(clanTag);

        sessionStorage.setItem(`oreCalc_cooldown_warlog_${clanTag}`, now.toString());

        const wars = data.items || [];

        if (wars.length < 5) {
            calculatedStats.winRate = 70;
            calculatedStats.drawRate = 0;
            calculatedStats.warsCount = 0;
        } else {
            const now = new Date();
            const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

            const warsInLast60Days = wars.filter(w => {
                try {
                    const parsedDate = parseCoCDateTime(w.endTime);
                    return parsedDate >= sixtyDaysAgo;
                } catch (e) {
                    return false;
                }
            });

            let warsToUse = [];
            if (warsInLast60Days.length >= 10) {
                warsToUse = warsInLast60Days;
            } else {
                warsToUse = wars.slice(0, 10);
            }

            let wins = 0;
            let ties = 0;
            if (warsToUse.length < 5) {
                calculatedStats.winRate = 70;
                calculatedStats.drawRate = 0;
                calculatedStats.warsCount = 0;
            } else {
                wins = warsToUse.filter(w => w.result === 'win').length;
                ties = warsToUse.filter(w => w.result === 'tie').length;

                calculatedStats.winRate = Math.round((wins / warsToUse.length) * 100);
                calculatedStats.drawRate = Math.round((ties / warsToUse.length) * 100);
                calculatedStats.warsCount = warsToUse.length;
            }
        }

        // Save only the important bits in the player profile
        if (state.playerProfile) {
            const wins = calculatedStats.warsCount > 0 ? Math.round((calculatedStats.winRate * calculatedStats.warsCount) / 100) : 0;
            const ties = calculatedStats.warsCount > 0 ? Math.round((calculatedStats.drawRate * calculatedStats.warsCount) / 100) : 0;
            state.playerProfile.clanWarStats = {
                winsCount: wins,
                drawsCount: ties,
                warsCount: calculatedStats.warsCount
            };
        }
    } catch (error) {
        logger.error("Failed to fetch clan war log for recommended values:", error);

        sessionStorage.setItem(`oreCalc_cooldown_warlog_${clanTag}`, Date.now().toString()); // Set cooldown on failure so we don't spam

        calculatedStats.winRate = 70;
        calculatedStats.drawRate = 0;
        calculatedStats.warsCount = 0;
        if (state.playerProfile) {
            state.playerProfile.clanWarStats = {
                winsCount: 0,
                drawsCount: 0,
                warsCount: 0
            };
        }
    } finally {
        calculatedStats.hasCalculated = true;
        calculatedStats.isFetching = false;
        // Trigger a silent update to re-evaluate popovers and refresh UI
        handleStateUpdate(() => {}, true);
    }
}

function getWarOrePopoverConfig(oreType) {
    return {
        title: () => translate('validation.amount'),
        min: 0,
        showRecommended: true,
        recommended: () => {
            const playerTH = Number(state.playerProfile?.townHallLevel) || 16;
            return getWarOreValue(oreType, playerTH);
        },
        recommendedLabel: () => {
            const playerTH = Number(state.playerProfile?.townHallLevel) || 16;
            return translate('views.equipment.thShort', { level: playerTH });
        },
        hideRecommendedIfHigher: false,
        clickToFill: {
            max: true,
            recommended: true
        }
    };
}

function ensureClanWarState() {
    if (!state.income.clanWar) state.income.clanWar = { oresPerAttack: {} };
    if (!state.income.clanWar.oresPerAttack) state.income.clanWar.oresPerAttack = {};
}

function updateWarRateState(key, value) {
    ensureClanWarState();
    const newWinRate = key === 'winRate' ? value : (state.income.clanWar.winRate ?? 50);
    const newDrawRate = key === 'drawRate' ? value : (state.income.clanWar.drawRate || 0);
    const changedRate = key === 'winRate' ? 'win' : 'draw';
    const adjusted = adjustWarRates(newWinRate, newDrawRate, changedRate);
    state.income.clanWar.winRate = adjusted.winRate;
    state.income.clanWar.drawRate = adjusted.drawRate;
}

/**
 * Initializes Clan War input event bindings, popovers, and validation.
 */
export function initializeClanWarInputs() {
    const inputs = dom.income?.clanWar;
    if (!inputs) return;

    bindNumericInput(inputs.warsPerMonthInput, {
        inputName: translate('views.income.clanWar.warsPerMonth'),
        popover: {
            title: () => translate('views.income.clanWar.warsPerMonth'),
            min: CLAN_WAR_DEFAULTS.MIN_WARS,
            max: CLAN_WAR_DEFAULTS.MAX_WARS,
            showRecommended: true,
            recommended: CLAN_WAR_DEFAULTS.WARS_PER_MONTH,
            hideRecommendedIfHigher: true,
            clickToFill: {
                min: true,
                max: true,
                recommended: true
            }
        },
        onUpdate: (value) => {
            ensureClanWarState();
            state.income.clanWar.warsPerMonth = value;
        }
    });

    bindNumericInput(inputs.warResults.winRateInput, {
        inputName: translate('views.income.winRate'),
        popover: {
            title: () => translate('views.income.winRate'),
            min: 0,
            max: 100,
            showRange: true,
            showRecommended: true,
            recommended: () => calculatedStats.winRate,
            recommendedLabel: () => {
                if (calculatedStats.warsCount >= 5) {
                    return translate('views.income.clanWar.last60DaysNWars', { count: calculatedStats.warsCount });
                }
                return translate('views.planner.recommended');
            },
            clickToFill: {
                min: true,
                max: true,
                recommended: true
            }
        },
        onUpdate: (value) => updateWarRateState('winRate', value)
    });

    bindNumericInput(inputs.warResults.drawRateInput, {
        inputName: translate('views.income.drawRate'),
        popover: {
            title: () => translate('views.income.drawRate'),
            min: 0,
            max: 100,
            showRange: true,
            showRecommended: true,
            recommended: () => calculatedStats.drawRate,
            recommendedLabel: () => {
                if (calculatedStats.warsCount >= 5) {
                    return translate('views.income.clanWar.last60DaysNWars', { count: calculatedStats.warsCount });
                }
                return translate('views.planner.recommended');
            },
            clickToFill: {
                min: true,
                max: true,
                recommended: true
            }
        },
        onUpdate: (value) => updateWarRateState('drawRate', value)
    });

    ['shiny', 'glowy', 'starry'].forEach((oreType) => {
        bindNumericInput(inputs.oresPerAttack[`${oreType}Input`], {
            inputName: translate(`entities.ores.${oreType}`),
            popover: getWarOrePopoverConfig(oreType),
            onUpdate: (value) => {
                ensureClanWarState();
                state.income.clanWar.oresPerAttack[oreType] = value;
            }
        });
    });
}

/**
 * Populates and synchronizes Clan War input fields with active state.
 * @param {import('../../core/types.js').ClanWarIncomeState} [clanWarState] - Active clan war state object.
 */
export function renderClanWarInputs(clanWarState) {
    const inputs = dom.income?.clanWar;
    if (!inputs) return;

    const safeState = clanWarState || { oresPerAttack: {} };

    if (inputs.warsPerMonthInput) inputs.warsPerMonthInput.value = safeState.warsPerMonth || 0;
    if (inputs.warResults.winRateInput) inputs.warResults.winRateInput.value = safeState.winRate ?? 50;
    if (inputs.warResults.drawRateInput) inputs.warResults.drawRateInput.value = safeState.drawRate || 0;
    if (inputs.oresPerAttack.shinyInput) inputs.oresPerAttack.shinyInput.value = safeState.oresPerAttack?.shiny || 0;
    if (inputs.oresPerAttack.glowyInput) inputs.oresPerAttack.glowyInput.value = safeState.oresPerAttack?.glowy || 0;
    if (inputs.oresPerAttack.starryInput) inputs.oresPerAttack.starryInput.value = safeState.oresPerAttack?.starry || 0;

    const currentClanTag = state.playerProfile?.clan?.tag || (state.playerProfile?.clanWarStats?.winsCount !== undefined || state.playerProfile?.clanWarStats?.winRate !== undefined ? "unknown-clan" : undefined);

    if (!currentClanTag) {
        if (calculatedStats.clanTag !== null) {
            calculatedStats.clanTag = null;
            calculatedStats.winRate = 70;
            calculatedStats.drawRate = 0;
            calculatedStats.warsCount = 0;
            calculatedStats.hasCalculated = true;
        }
    } else {
        const profileStats = state.playerProfile?.clanWarStats;

        if (currentClanTag !== calculatedStats.clanTag || !profileStats) {
            calculatedStats.clanTag = currentClanTag;
            if (profileStats) {
                const wins = profileStats.winsCount ?? 0;
                const ties = profileStats.drawsCount ?? 0;
                const total = profileStats.warsCount ?? 0;
                calculatedStats.winRate = total > 0 ? Math.round((wins / total) * 100) : (profileStats.winRate ?? 70);
                calculatedStats.drawRate = total > 0 ? Math.round((ties / total) * 100) : (profileStats.drawRate ?? 0);
                calculatedStats.warsCount = total;
                calculatedStats.hasCalculated = true;
            } else {
                calculatedStats.winRate = 70;
                calculatedStats.drawRate = 0;
                calculatedStats.warsCount = 0;
                calculatedStats.hasCalculated = false;
            }
            if (currentClanTag !== "unknown-clan") {
                triggerWarLogFetch(currentClanTag);
            }
        } else {
            calculatedStats.clanTag = currentClanTag;
            const wins = profileStats.winsCount ?? 0;
            const ties = profileStats.drawsCount ?? 0;
            const total = profileStats.warsCount ?? 0;
            calculatedStats.winRate = total > 0 ? Math.round((wins / total) * 100) : (profileStats.winRate ?? 70);
            calculatedStats.drawRate = total > 0 ? Math.round((ties / total) * 100) : (profileStats.drawRate ?? 0);
            calculatedStats.warsCount = total;
            calculatedStats.hasCalculated = true;
        }
    }
}
