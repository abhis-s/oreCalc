import { getSourceById } from '../../data/incomeSourceRegistry.js';
import { oreMaxValues } from '../../data/oreConversionData.js';
import { translate } from '../../i18n/translator.js';

import { CUSTOM_CHIP_LIMITS } from '../../core/constants.js';
import { state } from '../../core/state.js';

import { convertOres, findOptimalConversionSchedule, getBaseIncome, getUpgradeRequirements } from '../../domain/income/prospectorManager.js';
import { safeJsonParse } from '../../utils/jsonUtils.js';
import { closeModalAnimated, openModal } from '../../utils/modalHistoryManager.js';
import { animateValue, formatNumber } from '../../utils/numberFormatter.js';

import { getGlobalPriorityList } from './priorityListScheduler.js';

export const oreTypes = {
    shiny: 'assets/shiny_ore.png',
    glowy: 'assets/glowy_ore.png',
    starry: 'assets/starry_ore.png',
};

export const oreLimits = CUSTOM_CHIP_LIMITS;

export const prospectorUIState = {
    fromOre: 'shiny',
    toOre: 'glowy',
    fromAmount: 0
};

/**
 * Computes recommendations for the prospector conversion based on active priority plan.
 * @returns {Array<{ fromOre: string, toOre: string, fromAmount: number, toAmount: number, days: number }>}
 */
export function getNextUpgradeProspectorRecommendations() {
    try {
        const { globalPriorityList } = getGlobalPriorityList();
        if (!globalPriorityList || globalPriorityList.length === 0) return [];

        const nextReq = getUpgradeRequirements(globalPriorityList, true, state);
        const stored = {
            shiny: parseFloat(String(state.storedOres?.shiny || 0)) || 0,
            glowy: parseFloat(String(state.storedOres?.glowy || 0)) || 0,
            starry: parseFloat(String(state.storedOres?.starry || 0)) || 0
        };
        const baseIncome = getBaseIncome(state);
        const opt = findOptimalConversionSchedule(nextReq, stored, baseIncome);

        if (opt && opt.conversions && opt.conversions.length > 0) {
            return opt.conversions.map(c => {
                const fromRate = oreMaxValues[c.from];
                const toRate = convertOres(c.from, c.to, fromRate);
                return {
                    fromOre: c.from,
                    toOre: c.to,
                    fromAmount: fromRate,
                    toAmount: toRate,
                    days: c.days
                };
            });
        }
    } catch (e) {
        console.error('Error fetching next upgrade prospector recommendations:', e);
    }
    return [];
}

/**
 * Returns the highest priority prospector recommendation.
 * @returns {Object|null}
 */
export function getNextUpgradeProspectorRecommendation() {
    const recs = getNextUpgradeProspectorRecommendations();
    if (recs.length === 0) return null;
    const sortedConvs = [...recs].sort((a, b) => b.days - a.days);
    return sortedConvs[0];
}

/**
 * Live updates the per-chip ore rewards preview box.
 */
export function updatePerChipRewardsPreview() {
    const previewEl = document.getElementById('custom-chip-rewards-preview');
    if (!previewEl) return;

    const typeSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('custom-chip-type-select'));
    const selectedType = typeSelect ? typeSelect.value : '';

    if (!['starBonus', 'clanWar', 'cwl', 'prospector'].includes(selectedType)) {
        previewEl.style.display = 'none';
        return;
    }

    let shiny = 0;
    let glowy = 0;
    let starry = 0;

    switch (selectedType) {
        case 'starBonus': {
            const multiplierSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('custom-chip-starBonus-multiplier'));
            if (multiplierSelect) {
                const multiplier = multiplierSelect.value;
                const baseIncome = getSourceById('starBonus')?.getBaseIncome(state) || { shiny: 0, glowy: 0, starry: 0 };
                const multValue = parseInt(multiplier.replace('x', ''), 10) || 1;
                shiny = baseIncome.shiny * multValue;
                glowy = baseIncome.glowy * multValue;
                starry = baseIncome.starry * multValue;
            }
            break;
        }

        case 'clanWar': {
            const cwResult = /** @type {HTMLSelectElement|null} */ (document.getElementById('custom-chip-clanWar-result'))?.value || 'win';
            const cwRawShiny = parseInt(/** @type {HTMLInputElement|null} */ (document.getElementById('custom-chip-clanWar-shiny'))?.value || '0', 10) || 0;
            const cwRawGlowy = parseInt(/** @type {HTMLInputElement|null} */ (document.getElementById('custom-chip-clanWar-glowy'))?.value || '0', 10) || 0;
            const cwRawStarry = parseInt(/** @type {HTMLInputElement|null} */ (document.getElementById('custom-chip-clanWar-starry'))?.value || '0', 10) || 0;
            const cwFactor = cwResult === 'win' ? 1.0 : (cwResult === 'loss' ? 0.5 : 0.75);
            shiny = Math.round(2 * cwRawShiny * cwFactor);
            glowy = Math.round(2 * cwRawGlowy * cwFactor);
            starry = Math.round(2 * cwRawStarry * cwFactor);
            break;
        }

        case 'cwl': {
            const cwlResult = /** @type {HTMLSelectElement|null} */ (document.getElementById('custom-chip-cwl-result'))?.value || 'win';
            const cwlRawShiny = parseInt(/** @type {HTMLInputElement|null} */ (document.getElementById('custom-chip-cwl-shiny'))?.value || '0', 10) || 0;
            const cwlRawGlowy = parseInt(/** @type {HTMLInputElement|null} */ (document.getElementById('custom-chip-cwl-glowy'))?.value || '0', 10) || 0;
            const cwlRawStarry = parseInt(/** @type {HTMLInputElement|null} */ (document.getElementById('custom-chip-cwl-starry'))?.value || '0', 10) || 0;
            const cwlFactor = cwlResult === 'win' ? 1.0 : (cwlResult === 'loss' ? 0.5 : 0.75);
            shiny = Math.round(1 * cwlRawShiny * cwlFactor);
            glowy = Math.round(1 * cwlRawGlowy * cwlFactor);
            starry = Math.round(1 * cwlRawStarry * cwlFactor);
            break;
        }

        case 'prospector': {
            const fromDropdown = document.getElementById('custom-chip-prospector-from-ore');
            const toDropdown = document.getElementById('custom-chip-prospector-to-ore');
            const fromOre = fromDropdown?.dataset.value || 'shiny';
            const toOre = toDropdown?.dataset.value || 'glowy';
            const fromAmount = parseInt(/** @type {HTMLInputElement|null} */ (document.getElementById('custom-chip-prospector-from-amount'))?.value || '0', 10) || 0;
            const toAmount = parseInt(/** @type {HTMLInputElement|null} */ (document.getElementById('custom-chip-prospector-to-amount'))?.value || '0', 10) || 0;

            if (fromOre !== toOre && fromAmount > 0 && toAmount > 0) {
                const tempOres = { shiny: 0, glowy: 0, starry: 0 };
                tempOres[fromOre] = -fromAmount;
                tempOres[toOre] = toAmount;
                shiny = tempOres.shiny;
                glowy = tempOres.glowy;
                starry = tempOres.starry;
            }
            break;
        }
    }

    const updateEl = (id, val) => {
        const el = document.getElementById(id);
        if (!el) return;

        const prevVal = typeof el._currentNumericValue === 'number'
            ? el._currentNumericValue
            : (parseInt(el.textContent.replace(/[^0-9-]/g, ''), 10) || 0);
        const endVal = Math.round(val || 0);
        el._currentNumericValue = endVal;

        const formatSigned = (v) => {
            const rounded = Math.round(v);
            if (rounded > 0) return `+${formatNumber(rounded)}`;
            return formatNumber(rounded);
        };

        if (el.textContent && prevVal !== endVal) {
            animateValue(el, prevVal, endVal, 500, formatSigned);
        } else {
            el.textContent = formatSigned(endVal);
        }

        if (endVal < 0) {
            el.style.color = 'var(--color-danger)';
        } else if (endVal > 0) {
            el.style.color = 'var(--color-success)';
        } else {
            el.style.color = '';
        }
    };

    updateEl('custom-chip-preview-shiny', shiny);
    updateEl('custom-chip-preview-glowy', glowy);
    updateEl('custom-chip-preview-starry', starry);

    previewEl.style.display = 'flex';
}

/**
 * Updates min/max limits for prospector inputs.
 */
export function updateProspectorInputLimits() {
    const fromOre = prospectorUIState.fromOre;
    const toOre = prospectorUIState.toOre;

    const fromAmountInput = /** @type {HTMLInputElement|null} */ (document.getElementById('custom-chip-prospector-from-amount'));
    const toAmountInput = /** @type {HTMLInputElement|null} */ (document.getElementById('custom-chip-prospector-to-amount'));

    if (fromAmountInput && oreLimits[fromOre]) {
        const limit = oreLimits[fromOre];
        fromAmountInput.max = String(limit.max);
        fromAmountInput.maxLength = limit.maxlength;
        fromAmountInput.setAttribute('max', String(limit.max));
        fromAmountInput.setAttribute('maxlength', String(limit.maxlength));

        const val = parseInt(fromAmountInput.value, 10) || 0;
        if (val > limit.max) {
            fromAmountInput.value = String(limit.max);
            fromAmountInput.dataset.lastValidValue = limit.max.toString();
        }
    }

    if (toAmountInput && oreLimits[toOre]) {
        const limit = oreLimits[toOre];
        toAmountInput.max = String(limit.max);
        toAmountInput.maxLength = limit.maxlength;
        toAmountInput.setAttribute('max', String(limit.max));
        toAmountInput.setAttribute('maxlength', String(limit.maxlength));

        const val = parseInt(toAmountInput.value, 10) || 0;
        if (val > limit.max) {
            toAmountInput.value = String(limit.max);
            toAmountInput.dataset.lastValidValue = limit.max.toString();
        }
    }
}

/**
 * Updates option contents in custom dropdown elements.
 */
export function updateModalProspectorDropdowns() {
    const fromDropdown = document.getElementById('custom-chip-prospector-from-ore');
    const toDropdown = document.getElementById('custom-chip-prospector-to-ore');
    if (!fromDropdown || !toDropdown) return;

    const fromOreValue = fromDropdown.dataset.value || 'shiny';
    let toOreValue = toDropdown.dataset.value || 'glowy';

    if (fromOreValue === toOreValue) {
        const newToOre = Object.keys(oreTypes).find(ore => ore !== fromOreValue);
        if (newToOre) {
            toOreValue = newToOre;
            toDropdown.dataset.value = toOreValue;
            const toSelected = toDropdown.querySelector('.dropdown-selected');
            if (toSelected) {
                toSelected.innerHTML = `<orecalc-assets-image src="${oreTypes[toOreValue]}" alt="${toOreValue}" size="thumbnail"></orecalc-assets-image>`;
            }
            prospectorUIState.toOre = toOreValue;
        }
    }

    const fromOreOptions = fromDropdown.querySelector('.dropdown-options');
    if (fromOreOptions) {
        fromOreOptions.innerHTML = '';
        Object.keys(oreTypes).forEach(ore => {
            if (ore !== fromOreValue) {
                const option = document.createElement('div');
                option.classList.add('dropdown-option');
                option.setAttribute('tabindex', '0');
                option.setAttribute('role', 'option');
                option.dataset.value = ore;
                option.innerHTML = `<orecalc-assets-image src="${oreTypes[ore]}" alt="${translate('entities.ores.' + ore)}" size="thumbnail"></orecalc-assets-image>`;
                fromOreOptions.appendChild(option);
            }
        });
    }

    const toOreOptions = toDropdown.querySelector('.dropdown-options');
    if (toOreOptions) {
        toOreOptions.innerHTML = '';
        Object.keys(oreTypes).forEach(ore => {
            if (ore !== fromOreValue && ore !== toOreValue) {
                const option = document.createElement('div');
                option.classList.add('dropdown-option');
                option.setAttribute('tabindex', '0');
                option.setAttribute('role', 'option');
                option.dataset.value = ore;
                option.innerHTML = `<orecalc-assets-image src="${oreTypes[ore]}" alt="${translate('entities.ores.' + ore)}" size="thumbnail"></orecalc-assets-image>`;
                toOreOptions.appendChild(option);
            }
        });
    }

    updateProspectorInputLimits();
}

/**
 * Prefills modal input fields according to chosen chip category.
 * @param {string} type
 */
export function prefillModalInputs(type) {
    if (!type) return;

    if (!state.planner.calendar.customChipSettings) {
        state.planner.calendar.customChipSettings = {};
    }
    if (!state.planner.calendar.customChipSettings[type]) {
        state.planner.calendar.customChipSettings[type] = {};
    }
    const settings = state.planner.calendar.customChipSettings[type];

    const setVal = (id, val) => {
        const el = /** @type {HTMLInputElement|null} */ (document.getElementById(id));
        if (el) el.value = String(val);
    };

    const setChecked = (id, checked) => {
        const el = /** @type {HTMLInputElement|null} */ (document.getElementById(id));
        if (el) el.checked = checked;
    };

    switch (type) {
        case 'extras':
            setVal('custom-chip-extras-shiny', settings.shiny || 0);
            setVal('custom-chip-extras-glowy', settings.glowy || 0);
            setVal('custom-chip-extras-starry', settings.starry || 0);
            setVal('custom-chip-extras-count', settings.count || 1);
            break;

        case 'starBonus': {
            const multiplierSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('custom-chip-starBonus-multiplier'));
            if (multiplierSelect) multiplierSelect.value = settings.multiplier || '2x';
            setVal('custom-chip-starBonus-count', settings.count || 1);
            setChecked('custom-chip-starBonus-monthly', settings.monthly || false);
            break;
        }

        case 'shopOffers': {
            const shopOres = state.derived?.incomeSources?.shopOffers?.monthly || {};
            setVal('custom-chip-shopOffers-shiny', shopOres.shiny || settings.shiny || 0);
            setVal('custom-chip-shopOffers-glowy', shopOres.glowy || settings.glowy || 0);
            setVal('custom-chip-shopOffers-starry', shopOres.starry || settings.starry || 0);
            setChecked('custom-chip-shopOffers-monthly', settings.monthly || false);
            break;
        }

        case 'gemTrader': {
            const gemOres = state.derived?.incomeSources?.gemTrader?.weekly || {};
            setVal('custom-chip-gemTrader-shiny', gemOres.shiny || settings.shiny || 0);
            setVal('custom-chip-gemTrader-glowy', gemOres.glowy || settings.glowy || 0);
            setVal('custom-chip-gemTrader-starry', gemOres.starry || settings.starry || 0);
            setChecked('custom-chip-gemTrader-weekly', settings.weekly || false);
            break;
        }

        case 'raidMedalTrader': {
            const raidOres = state.derived?.incomeSources?.raidMedalTrader?.weekly || {};
            setVal('custom-chip-raidMedalTrader-shiny', raidOres.shiny || settings.shiny || 0);
            setVal('custom-chip-raidMedalTrader-glowy', raidOres.glowy || settings.glowy || 0);
            setVal('custom-chip-raidMedalTrader-starry', raidOres.starry || settings.starry || 0);
            setChecked('custom-chip-raidMedalTrader-weekly', settings.weekly || false);
            break;
        }

        case 'eventTrader': {
            const eventTraderOres = state.derived?.incomeSources?.eventTrader?.bimonthly || {};
            setVal('custom-chip-eventTrader-shiny', eventTraderOres.shiny || settings.shiny || 0);
            setVal('custom-chip-eventTrader-glowy', eventTraderOres.glowy || settings.glowy || 0);
            setVal('custom-chip-eventTrader-starry', eventTraderOres.starry || settings.starry || 0);
            setChecked('custom-chip-eventTrader-monthly', settings.monthly || false);
            break;
        }

        case 'eventPass': {
            const eventPassOres = state.derived?.incomeSources?.eventPass?.bimonthly || {};
            setVal('custom-chip-eventPass-shiny', eventPassOres.shiny || settings.shiny || 0);
            setVal('custom-chip-eventPass-glowy', eventPassOres.glowy || settings.glowy || 0);
            setVal('custom-chip-eventPass-starry', eventPassOres.starry || settings.starry || 0);
            setChecked('custom-chip-eventPass-monthly', settings.monthly || false);
            break;
        }

        case 'clanWar': {
            const cwOres = state.income?.clanWar?.oresPerAttack || {};
            setVal('custom-chip-clanWar-shiny', cwOres.shiny || settings.shiny || 0);
            setVal('custom-chip-clanWar-glowy', cwOres.glowy || settings.glowy || 0);
            setVal('custom-chip-clanWar-starry', cwOres.starry || settings.starry || 0);
            setVal('custom-chip-clanWar-count', settings.count || 1);
            setChecked('custom-chip-clanWar-monthly', settings.monthly || false);
            const cwRes = /** @type {HTMLSelectElement|null} */ (document.getElementById('custom-chip-clanWar-result'));
            if (cwRes) cwRes.value = settings.result || 'win';
            break;
        }

        case 'cwl': {
            const cwlOres = state.income?.cwl?.oresPerAttack || {};
            setVal('custom-chip-cwl-shiny', cwlOres.shiny || settings.shiny || 0);
            setVal('custom-chip-cwl-glowy', cwlOres.glowy || settings.glowy || 0);
            setVal('custom-chip-cwl-starry', cwlOres.starry || settings.starry || 0);
            setVal('custom-chip-cwl-count', settings.count || 1);
            setChecked('custom-chip-cwl-monthly', settings.monthly || false);
            const cwlRes = /** @type {HTMLSelectElement|null} */ (document.getElementById('custom-chip-cwl-result'));
            if (cwlRes) cwlRes.value = settings.result || 'win';
            break;
        }

        case 'supercellEvents': {
            setVal('custom-chip-supercellEvents-shiny', (settings.shiny !== undefined && settings.shiny !== 0) ? settings.shiny : 1000);
            setVal('custom-chip-supercellEvents-glowy', (settings.glowy !== undefined && settings.glowy !== 0) ? settings.glowy : 50);
            setVal('custom-chip-supercellEvents-starry', (settings.starry !== undefined && settings.starry !== 0) ? settings.starry : 10);
            setChecked('custom-chip-supercellEvents-override', settings.globalOverride || false);
            break;
        }

        case 'prospector': {
            const rec = getNextUpgradeProspectorRecommendation();
            const fromOre = rec ? rec.fromOre : (state.income?.prospector?.fromOre || settings.fromOre || 'shiny');
            const toOre = rec ? rec.toOre : (state.income?.prospector?.toOre || settings.toOre || 'glowy');

            prospectorUIState.fromOre = fromOre;
            prospectorUIState.toOre = toOre;

            let fromAmount = rec ? rec.fromAmount : (state.income?.prospector?.fromAmount || settings.fromAmount || 0);
            let toVal = rec ? rec.toAmount : convertOres(fromOre, toOre, fromAmount);
            if (toVal <= 0) {
                fromAmount = 0;
                toVal = 0;
            }
            prospectorUIState.fromAmount = fromAmount;

            const fromDropdown = document.getElementById('custom-chip-prospector-from-ore');
            const toDropdown = document.getElementById('custom-chip-prospector-to-ore');

            if (fromDropdown) {
                fromDropdown.dataset.value = prospectorUIState.fromOre;
                const fromSelected = fromDropdown.querySelector('.dropdown-selected');
                if (fromSelected) {
                    fromSelected.innerHTML = `<orecalc-assets-image src="${oreTypes[prospectorUIState.fromOre]}" alt="${translate('entities.ores.' + prospectorUIState.fromOre)}" size="thumbnail"></orecalc-assets-image>`;
                }
            }

            if (toDropdown) {
                toDropdown.dataset.value = prospectorUIState.toOre;
                const toSelected = toDropdown.querySelector('.dropdown-selected');
                if (toSelected) {
                    toSelected.innerHTML = `<orecalc-assets-image src="${oreTypes[prospectorUIState.toOre]}" alt="${translate('entities.ores.' + prospectorUIState.toOre)}" size="thumbnail"></orecalc-assets-image>`;
                }
            }

            setVal('custom-chip-prospector-from-amount', prospectorUIState.fromAmount);
            setVal('custom-chip-prospector-to-amount', toVal);

            updateModalProspectorDropdowns();

            setVal('custom-chip-prospector-count', rec ? rec.days : (settings.count || 1));
            setChecked('custom-chip-prospector-monthly', settings.monthly || false);
            break;
        }
    }

    const activeSection = document.getElementById(`custom-chip-section-${type}`);
    if (activeSection) {
        const numInputs = activeSection.querySelectorAll('input[type="number"]');
        numInputs.forEach(input => {
            /** @type {HTMLInputElement} */ (input).dataset.lastValidValue = /** @type {HTMLInputElement} */ (input).value;
        });
    }

    updatePerChipRewardsPreview();
}

/**
 * Resets and displays the create custom chips modal.
 */
export function openCreateCustomChipsModal() {
    const modal = document.getElementById('create-custom-chips-modal');
    if (!modal) return;

    const typeSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('custom-chip-type-select'));
    if (typeSelect) {
        typeSelect.value = '';
    }

    const dynamicInputsContainer = document.getElementById('custom-chip-dynamic-inputs');
    if (dynamicInputsContainer) {
        dynamicInputsContainer.style.display = 'none';
    }

    const sections = modal.querySelectorAll('.custom-chip-section');
    sections.forEach(sec => {
        /** @type {HTMLElement} */ (sec).style.display = 'none';
    });

    const numInputs = modal.querySelectorAll('input[type="number"]');
    numInputs.forEach(input => {
        const htmlInput = /** @type {HTMLInputElement} */ (input);
        if (htmlInput.id.endsWith('-count')) {
            htmlInput.value = '1';
            htmlInput.min = '1';
            htmlInput.dataset.lastValidValue = '1';
        } else {
            htmlInput.value = '0';
            htmlInput.dataset.lastValidValue = '0';
        }
    });

    const selects = modal.querySelectorAll('select:not(#custom-chip-type-select)');
    selects.forEach(sel => {
        /** @type {HTMLSelectElement} */ (sel).selectedIndex = 0;
    });

    const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        /** @type {HTMLInputElement} */ (cb).checked = false;
    });

    const draftStr = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('oreCalc_custom_chip_draft') : null;
    if (draftStr) {
        const draft = safeJsonParse(draftStr, null);
        if (draft && draft.type && typeSelect) {
            typeSelect.value = draft.type;
            if (dynamicInputsContainer) dynamicInputsContainer.style.display = 'block';
            const activeSection = document.getElementById(`custom-chip-section-${draft.type}`);
            if (activeSection) {
                activeSection.style.display = 'block';
            }
            if (draft.type === 'prospector') {
                prefillModalInputs('prospector');
            } else {
                prefillModalInputs(draft.type);
            }
            if (draft.values) {
                for (const inputId in draft.values) {
                    const el = document.getElementById(inputId);
                    if (el) {
                        if (el instanceof HTMLInputElement && el.type === 'checkbox') {
                            el.checked = Boolean(draft.values[inputId]);
                        } else if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
                            el.value = String(draft.values[inputId]);
                            el.dataset.lastValidValue = String(draft.values[inputId]);
                        }
                    }
                }
            }
            updatePerChipRewardsPreview();
        }
    }

    openModal(modal);
}

/**
 * Closes the create custom chips modal.
 */
export function closeCreateCustomChipsModal() {
    const modal = document.getElementById('create-custom-chips-modal');
    if (modal) closeModalAnimated(modal);
}
