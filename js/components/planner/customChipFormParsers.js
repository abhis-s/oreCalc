import { getSourceById } from '../../data/incomeSourceRegistry.js';
import { translate } from '../../i18n/translator.js';

import { showAlert } from '../../ui/noticeModal.js';

/**
 * Checks for duplicate custom chips in container or on the calendar.
 * @param {import('../../core/types.js').AppState} state
 * @param {Array<any>} customChips
 * @param {Object} chipData
 * @returns {boolean}
 */
function checkDuplicateExtras(state, customChips, chipData) {
    const isDuplicateInContainer = customChips.some(c =>
        (c.type === 'extras' || c.type === 'custom') &&
        c.shiny === chipData.shiny &&
        c.glowy === chipData.glowy &&
        c.starry === chipData.starry
    );

    let isDuplicateOnCalendar = false;
    for (const mYKey in state.planner.calendar.dates) {
        for (const dKey in state.planner.calendar.dates[mYKey]) {
            const chipIds = state.planner.calendar.dates[mYKey][dKey];
            if (chipIds.some(id => {
                const customData = state.planner.calendar.customChipData?.[id];
                return (id.startsWith('custom-extras-') || id.startsWith('custom-custom-')) &&
                    customData &&
                    customData.shiny === chipData.shiny &&
                    customData.glowy === chipData.glowy &&
                    customData.starry === chipData.starry;
            })) {
                isDuplicateOnCalendar = true;
                break;
            }
        }
        if (isDuplicateOnCalendar) break;
    }

    return isDuplicateInContainer || isDuplicateOnCalendar;
}

/**
 * Parses form inputs for a selected chip type into chipData, settings, and count.
 * @param {string} selectedType
 * @param {import('../../core/types.js').AppState} state
 * @param {Array<any>} customChips
 * @returns {Promise<{ count: number, chipData: any, settings: any } | null>}
 */
export async function parseCustomChipFormData(selectedType, state, customChips) {
    if (!state.planner.calendar.customChipSettings) {
        state.planner.calendar.customChipSettings = {};
    }
    if (!state.planner.calendar.customChipSettings[selectedType]) {
        state.planner.calendar.customChipSettings[selectedType] = {};
    }
    const settings = state.planner.calendar.customChipSettings[selectedType];

    let count = 1;
    const chipData = { type: selectedType, isCustom: true };

    const getNum = (id, fallback = 0) => parseInt(/** @type {HTMLInputElement|null} */ (document.getElementById(id))?.value || '0', 10) || fallback;
    const getChecked = (id) => /** @type {HTMLInputElement|null} */ (document.getElementById(id))?.checked || false;
    const getSelectVal = (id, fallback = '') => /** @type {HTMLSelectElement|null} */ (document.getElementById(id))?.value || fallback;

    switch (selectedType) {
        case 'extras':
            chipData.customType = 'Extras';
            chipData.shiny = getNum('custom-chip-extras-shiny', 0);
            chipData.glowy = getNum('custom-chip-extras-glowy', 0);
            chipData.starry = getNum('custom-chip-extras-starry', 0);
            chipData.isRecurring = false;
            count = getNum('custom-chip-extras-count', 1);
            settings.count = count;
            settings.shiny = chipData.shiny;
            settings.glowy = chipData.glowy;
            settings.starry = chipData.starry;

            if (checkDuplicateExtras(state, customChips, chipData)) {
                await showAlert(translate('errors.duplicateCustomType'));
                return null;
            }
            break;
        case 'starBonus': {
            const multiplier = getSelectVal('custom-chip-starBonus-multiplier', '2x');
            const starBonusType = 'starBonus' + multiplier;
            count = getNum('custom-chip-starBonus-count', 1);
            settings.monthly = getChecked('custom-chip-starBonus-monthly');
            settings.count = count;
            settings.multiplier = multiplier;
            chipData.type = starBonusType;
            chipData.multiplier = multiplier;
            chipData.isRecurring = settings.monthly;

            const baseIncome = getSourceById('starBonus')?.getBaseIncome(state) || { shiny: 0, glowy: 0, starry: 0 };
            const multValue = parseInt(multiplier.replace('x', ''), 10) || 1;
            chipData.shiny = baseIncome.shiny * multValue;
            chipData.glowy = baseIncome.glowy * multValue;
            chipData.starry = baseIncome.starry * multValue;
            break;
        }
        case 'shopOffers':
            chipData.shiny = getNum('custom-chip-shopOffers-shiny', 0);
            chipData.glowy = getNum('custom-chip-shopOffers-glowy', 0);
            chipData.starry = getNum('custom-chip-shopOffers-starry', 0);
            settings.monthly = getChecked('custom-chip-shopOffers-monthly');
            settings.shiny = chipData.shiny;
            settings.glowy = chipData.glowy;
            settings.starry = chipData.starry;
            chipData.isRecurring = settings.monthly;
            break;
        case 'gemTrader':
            chipData.shiny = getNum('custom-chip-gemTrader-shiny', 0);
            chipData.glowy = getNum('custom-chip-gemTrader-glowy', 0);
            chipData.starry = getNum('custom-chip-gemTrader-starry', 0);
            settings.weekly = getChecked('custom-chip-gemTrader-weekly');
            settings.shiny = chipData.shiny;
            settings.glowy = chipData.glowy;
            settings.starry = chipData.starry;
            chipData.isRecurring = settings.weekly;
            break;
        case 'raidMedalTrader':
            chipData.shiny = getNum('custom-chip-raidMedalTrader-shiny', 0);
            chipData.glowy = getNum('custom-chip-raidMedalTrader-glowy', 0);
            chipData.starry = getNum('custom-chip-raidMedalTrader-starry', 0);
            settings.weekly = getChecked('custom-chip-raidMedalTrader-weekly');
            settings.shiny = chipData.shiny;
            settings.glowy = chipData.glowy;
            settings.starry = chipData.starry;
            chipData.isRecurring = settings.weekly;
            break;
        case 'eventTrader':
            chipData.shiny = getNum('custom-chip-eventTrader-shiny', 0);
            chipData.glowy = getNum('custom-chip-eventTrader-glowy', 0);
            chipData.starry = getNum('custom-chip-eventTrader-starry', 0);
            settings.monthly = getChecked('custom-chip-eventTrader-monthly');
            settings.shiny = chipData.shiny;
            settings.glowy = chipData.glowy;
            settings.starry = chipData.starry;
            chipData.isRecurring = settings.monthly;
            break;
        case 'eventPass':
            chipData.shiny = getNum('custom-chip-eventPass-shiny', 0);
            chipData.glowy = getNum('custom-chip-eventPass-glowy', 0);
            chipData.starry = getNum('custom-chip-eventPass-starry', 0);
            settings.monthly = getChecked('custom-chip-eventPass-monthly');
            settings.shiny = chipData.shiny;
            settings.glowy = chipData.glowy;
            settings.starry = chipData.starry;
            chipData.isRecurring = settings.monthly;
            break;
        case 'clanWar': {
            chipData.result = getSelectVal('custom-chip-clanWar-result', 'win');
            const cwRawShiny = getNum('custom-chip-clanWar-shiny', 0);
            const cwRawGlowy = getNum('custom-chip-clanWar-glowy', 0);
            const cwRawStarry = getNum('custom-chip-clanWar-starry', 0);
            const cwFactor = chipData.result === 'win' ? 1.0 : (chipData.result === 'loss' ? 0.5 : 0.75);

            chipData.shiny = Math.round(2 * cwRawShiny * cwFactor);
            chipData.glowy = Math.round(2 * cwRawGlowy * cwFactor);
            chipData.starry = Math.round(2 * cwRawStarry * cwFactor);

            count = getNum('custom-chip-clanWar-count', 1);
            settings.monthly = getChecked('custom-chip-clanWar-monthly');
            settings.count = count;
            settings.shiny = cwRawShiny;
            settings.glowy = cwRawGlowy;
            settings.starry = cwRawStarry;
            settings.result = chipData.result;
            chipData.isRecurring = settings.monthly;
            break;
        }
        case 'cwl': {
            chipData.result = getSelectVal('custom-chip-cwl-result', 'win');
            const cwlRawShiny = getNum('custom-chip-cwl-shiny', 0);
            const cwlRawGlowy = getNum('custom-chip-cwl-glowy', 0);
            const cwlRawStarry = getNum('custom-chip-cwl-starry', 0);
            const cwlFactor = chipData.result === 'win' ? 1.0 : (chipData.result === 'loss' ? 0.5 : 0.75);

            chipData.shiny = Math.round(1 * cwlRawShiny * cwlFactor);
            chipData.glowy = Math.round(1 * cwlRawGlowy * cwlFactor);
            chipData.starry = Math.round(1 * cwlRawStarry * cwlFactor);

            count = getNum('custom-chip-cwl-count', 1);
            settings.monthly = getChecked('custom-chip-cwl-monthly');
            settings.count = count;
            settings.shiny = cwlRawShiny;
            settings.glowy = cwlRawGlowy;
            settings.starry = cwlRawStarry;
            settings.result = chipData.result;
            chipData.isRecurring = settings.monthly;
            break;
        }
        case 'supercellEvents':
            chipData.shiny = getNum('custom-chip-supercellEvents-shiny', 1000);
            chipData.glowy = getNum('custom-chip-supercellEvents-glowy', 50);
            chipData.starry = getNum('custom-chip-supercellEvents-starry', 10);
            settings.globalOverride = getChecked('custom-chip-supercellEvents-override');
            settings.shiny = chipData.shiny;
            settings.glowy = chipData.glowy;
            settings.starry = chipData.starry;
            chipData.isRecurring = false;
            break;
        case 'prospector': {
            const fromOre = document.getElementById('custom-chip-prospector-from-ore')?.dataset.value || 'shiny';
            const fromAmount = getNum('custom-chip-prospector-from-amount', 0);
            const toOre = document.getElementById('custom-chip-prospector-to-ore')?.dataset.value || 'glowy';
            const toAmount = getNum('custom-chip-prospector-to-amount', 0);

            if (fromOre === toOre) {
                await showAlert(translate('validation.prospectorSameOre'));
                return null;
            }

            if (fromAmount <= 0 || toAmount <= 0) {
                await showAlert(translate('validation.prospectorZeroAmount'));
                return null;
            }

            chipData.shiny = 0;
            chipData.glowy = 0;
            chipData.starry = 0;
            chipData[fromOre] = -fromAmount;
            chipData[toOre] = toAmount;

            count = getNum('custom-chip-prospector-count', 1);
            settings.monthly = getChecked('custom-chip-prospector-monthly');
            settings.count = count;
            settings.shiny = chipData.shiny;
            settings.glowy = chipData.glowy;
            settings.starry = chipData.starry;
            chipData.isRecurring = settings.monthly;
            break;
        }
    }

    if (selectedType !== 'starBonus') {
        if ((chipData.shiny || 0) === 0 && (chipData.glowy || 0) === 0 && (chipData.starry || 0) === 0) {
            await showAlert(translate('errors.atLeastOneOreRequired'));
            return null;
        }
    }

    return { count, chipData, settings };
}
