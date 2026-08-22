import { getWarOreValue, WAR_ORE_MAX_LIMITS } from '../../data/incomeSources/warOres.js';
import { translate } from '../../i18n/translator.js';

import { CUSTOM_CHIP_LIMITS } from '../../core/constants.js';
import { state } from '../../core/state.js';

import { convertOres } from '../../domain/income/prospectorManager.js';
import { registerInputPopover } from '../../utils/inputPopoverProvider.js';

import {
    getNextUpgradeProspectorRecommendations,
    oreLimits,
    oreTypes,
    prospectorUIState,
    updateModalProspectorDropdowns,
    updatePerChipRewardsPreview
} from './createCustomChipsModalDisplay.js';

/**
 * Initializes and wires custom accessible combobox dropdowns for prospector conversion.
 * @param {HTMLElement} dropdownElement
 * @param {'from'|'to'} whichOre
 */
export function initializeModalCustomDropdown(dropdownElement, whichOre) {
    const selected = dropdownElement.querySelector('.dropdown-selected');
    const options = dropdownElement.querySelector('.dropdown-options');
    if (!selected || !options) return;

    dropdownElement.setAttribute('tabindex', '0');
    dropdownElement.setAttribute('role', 'combobox');
    dropdownElement.setAttribute('aria-haspopup', 'listbox');
    dropdownElement.setAttribute('aria-expanded', 'false');
    const labelKey = whichOre === 'from' ? 'views.income.prospector.fromOre' : 'views.income.prospector.toOre';
    dropdownElement.setAttribute('aria-label', translate(labelKey));

    selected.addEventListener('click', () => {
        dropdownElement.classList.toggle('open');
        dropdownElement.setAttribute('aria-expanded', dropdownElement.classList.contains('open') ? 'true' : 'false');
    });

    document.addEventListener('click', (e) => {
        const target = /** @type {Node} */ (e.target);
        if (!dropdownElement.contains(target)) {
            dropdownElement.classList.remove('open');
            dropdownElement.setAttribute('aria-expanded', 'false');
        }
    });

    options.addEventListener('click', (e) => {
        const target = /** @type {HTMLElement} */ (e.target);
        const option = target.closest('.dropdown-option');
        if (option) {
            const htmlOption = /** @type {HTMLElement} */ (option);
            const value = htmlOption.dataset.value || 'shiny';
            const imgSrc = oreTypes[value];
            selected.innerHTML = `<orecalc-assets-image src="${imgSrc}" alt="${translate('entities.ores.' + value)}" size="thumbnail"></orecalc-assets-image>`;
            dropdownElement.dataset.value = value;
            if (whichOre === 'from') {
                prospectorUIState.fromOre = value;
            } else {
                prospectorUIState.toOre = value;
            }

            updateModalProspectorDropdowns();

            const recs = getNextUpgradeProspectorRecommendations();
            const matchingRec = recs.find(r => r.fromOre === prospectorUIState.fromOre && r.toOre === prospectorUIState.toOre);
            if (matchingRec) {
                const fromAmountInput = /** @type {HTMLInputElement|null} */ (document.getElementById('custom-chip-prospector-from-amount'));
                const toAmountInput = /** @type {HTMLInputElement|null} */ (document.getElementById('custom-chip-prospector-to-amount'));
                const countInput = /** @type {HTMLInputElement|null} */ (document.getElementById('custom-chip-prospector-count'));

                prospectorUIState.fromAmount = matchingRec.fromAmount;
                if (fromAmountInput) {
                    fromAmountInput.value = String(matchingRec.fromAmount);
                    fromAmountInput.dataset.lastValidValue = String(matchingRec.fromAmount);
                }
                if (toAmountInput) {
                    toAmountInput.value = String(matchingRec.toAmount);
                    toAmountInput.dataset.lastValidValue = String(matchingRec.toAmount);
                }
                if (countInput) {
                    countInput.value = String(matchingRec.days);
                    countInput.dataset.lastValidValue = String(matchingRec.days);
                }
            }

            updatePerChipRewardsPreview();
            dropdownElement.classList.remove('open');
            dropdownElement.setAttribute('aria-expanded', 'false');
        }
    });

    dropdownElement.addEventListener('keydown', (e) => {
        const target = /** @type {HTMLElement} */ (e.target);

        if (target === dropdownElement) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                dropdownElement.classList.toggle('open');
                dropdownElement.setAttribute('aria-expanded', dropdownElement.classList.contains('open') ? 'true' : 'false');
                if (dropdownElement.classList.contains('open')) {
                    const firstOpt = /** @type {HTMLElement|null} */ (options.querySelector('.dropdown-option'));
                    if (firstOpt) {
                        setTimeout(() => firstOpt.focus(), 50);
                    }
                }
            }
        } else if (target.classList.contains('dropdown-option')) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                target.click();
                dropdownElement.focus();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                dropdownElement.classList.remove('open');
                dropdownElement.setAttribute('aria-expanded', 'false');
                dropdownElement.focus();
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault();
                const next = /** @type {HTMLElement|null} */ (target.nextElementSibling);
                if (next && next.classList.contains('dropdown-option')) {
                    next.focus();
                }
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const prev = /** @type {HTMLElement|null} */ (target.previousElementSibling);
                if (prev && prev.classList.contains('dropdown-option')) {
                    prev.focus();
                }
            }
        }
    });
}

/**
 * Registers all popovers and numeric pickers for custom chips.
 */
export function registerCustomChipsPopovers() {
    const extrasShiny = document.getElementById('custom-chip-extras-shiny');
    if (extrasShiny) {
        registerInputPopover(extrasShiny, {
            title: () => translate('entities.ores.shiny'),
            min: 0,
            max: CUSTOM_CHIP_LIMITS.shiny.max,
            showRange: true,
            clickToFill: { max: true }
        });
    }
    const extrasGlowy = document.getElementById('custom-chip-extras-glowy');
    if (extrasGlowy) {
        registerInputPopover(extrasGlowy, {
            title: () => translate('entities.ores.glowy'),
            min: 0,
            max: CUSTOM_CHIP_LIMITS.glowy.max,
            showRange: true,
            clickToFill: { max: true }
        });
    }
    const extrasStarry = document.getElementById('custom-chip-extras-starry');
    if (extrasStarry) {
        registerInputPopover(extrasStarry, {
            title: () => translate('entities.ores.starry'),
            min: 0,
            max: CUSTOM_CHIP_LIMITS.starry.max,
            showRange: true,
            clickToFill: { max: true }
        });
    }
    const extrasCount = document.getElementById('custom-chip-extras-count');
    if (extrasCount) {
        registerInputPopover(extrasCount, {
            title: () => translate('views.planner.createCustomChipsModal.numChips'),
            min: 1,
            max: 9,
            showRange: true,
            clickToFill: { max: true }
        });
    }

    const starBonusCount = document.getElementById('custom-chip-starBonus-count');
    if (starBonusCount) {
        registerInputPopover(starBonusCount, {
            title: () => translate('views.planner.createCustomChipsModal.numChips'),
            min: 1,
            max: 15,
            showRange: true,
            clickToFill: { max: true }
        });
    }

    // Helper for Reset/Recommended Popovers
    const registerResetPopover = (elementId, oreType, getRecFn) => {
        const input = document.getElementById(elementId);
        if (!input) return;
        registerInputPopover(input, {
            title: () => translate(`entities.ores.${oreType}`),
            min: 0,
            max: CUSTOM_CHIP_LIMITS[oreType]?.max || 25000,
            showRange: true,
            showRecommended: true,
            recommended: getRecFn,
            recommendedLabel: () => translate('actions.reset'),
            clickToFill: { max: true, recommended: true }
        });
    };

    registerResetPopover('custom-chip-shopOffers-shiny', 'shiny', () => state.derived?.incomeSources?.shopOffers?.monthly?.shiny || 0);
    registerResetPopover('custom-chip-shopOffers-glowy', 'glowy', () => state.derived?.incomeSources?.shopOffers?.monthly?.glowy || 0);
    registerResetPopover('custom-chip-shopOffers-starry', 'starry', () => state.derived?.incomeSources?.shopOffers?.monthly?.starry || 0);

    registerResetPopover('custom-chip-gemTrader-shiny', 'shiny', () => state.derived?.incomeSources?.gemTrader?.weekly?.shiny || 0);
    registerResetPopover('custom-chip-gemTrader-glowy', 'glowy', () => state.derived?.incomeSources?.gemTrader?.weekly?.glowy || 0);
    registerResetPopover('custom-chip-gemTrader-starry', 'starry', () => state.derived?.incomeSources?.gemTrader?.weekly?.starry || 0);

    registerResetPopover('custom-chip-raidMedalTrader-shiny', 'shiny', () => state.derived?.incomeSources?.raidMedalTrader?.weekly?.shiny || 0);
    registerResetPopover('custom-chip-raidMedalTrader-glowy', 'glowy', () => state.derived?.incomeSources?.raidMedalTrader?.weekly?.glowy || 0);
    registerResetPopover('custom-chip-raidMedalTrader-starry', 'starry', () => state.derived?.incomeSources?.raidMedalTrader?.weekly?.starry || 0);

    registerResetPopover('custom-chip-eventTrader-shiny', 'shiny', () => state.derived?.incomeSources?.eventTrader?.bimonthly?.shiny || 0);
    registerResetPopover('custom-chip-eventTrader-glowy', 'glowy', () => state.derived?.incomeSources?.eventTrader?.bimonthly?.glowy || 0);
    registerResetPopover('custom-chip-eventTrader-starry', 'starry', () => state.derived?.incomeSources?.eventTrader?.bimonthly?.starry || 0);

    registerResetPopover('custom-chip-eventPass-shiny', 'shiny', () => state.derived?.incomeSources?.eventPass?.bimonthly?.shiny || 0);
    registerResetPopover('custom-chip-eventPass-glowy', 'glowy', () => state.derived?.incomeSources?.eventPass?.bimonthly?.glowy || 0);
    registerResetPopover('custom-chip-eventPass-starry', 'starry', () => state.derived?.incomeSources?.eventPass?.bimonthly?.starry || 0);

    registerResetPopover('custom-chip-supercellEvents-shiny', 'shiny', () => 1000);
    registerResetPopover('custom-chip-supercellEvents-glowy', 'glowy', () => 50);
    registerResetPopover('custom-chip-supercellEvents-starry', 'starry', () => 10);

    // Helper for War inputs (Clan War & CWL)
    const registerWarPopover = (elementId, oreType) => {
        const input = document.getElementById(elementId);
        if (!input) return;
        registerInputPopover(input, {
            title: () => translate('validation.amount'),
            min: 0,
            max: WAR_ORE_MAX_LIMITS[oreType] || 1110,
            showRecommended: true,
            recommended: () => {
                const playerTH = Number(state.playerProfile?.townHallLevel) || 16;
                return getWarOreValue(oreType, playerTH);
            },
            recommendedLabel: () => {
                const playerTH = Number(state.playerProfile?.townHallLevel) || 16;
                return translate('views.equipment.thShort', { level: playerTH });
            },
            hideRecommendedIfHigher: true,
            clickToFill: { max: true, recommended: true }
        });
    };

    registerWarPopover('custom-chip-clanWar-shiny', 'shiny');
    registerWarPopover('custom-chip-clanWar-glowy', 'glowy');
    registerWarPopover('custom-chip-clanWar-starry', 'starry');
    const clanWarCount = document.getElementById('custom-chip-clanWar-count');
    if (clanWarCount) {
        registerInputPopover(clanWarCount, {
            title: () => translate('views.planner.createCustomChipsModal.numChips'),
            min: 1,
            max: 15,
            showRange: true,
            clickToFill: { max: true }
        });
    }

    registerWarPopover('custom-chip-cwl-shiny', 'shiny');
    registerWarPopover('custom-chip-cwl-glowy', 'glowy');
    registerWarPopover('custom-chip-cwl-starry', 'starry');
    const cwlCount = document.getElementById('custom-chip-cwl-count');
    if (cwlCount) {
        registerInputPopover(cwlCount, {
            title: () => translate('views.planner.createCustomChipsModal.numChips'),
            min: 1,
            max: 7,
            showRange: true,
            clickToFill: { max: true }
        });
    }

    const prospectorFromAmount = document.getElementById('custom-chip-prospector-from-amount');
    if (prospectorFromAmount) {
        registerInputPopover(prospectorFromAmount, {
            title: () => translate('views.income.prospector.fromOre'),
            min: 0,
            max: () => {
                const fromOre = document.getElementById('custom-chip-prospector-from-ore')?.dataset.value || 'shiny';
                return oreLimits[fromOre]?.max || 25000;
            },
            showRange: true,
            showRecommended: true,
            recommended: () => {
                const recs = getNextUpgradeProspectorRecommendations();
                const fromOre = document.getElementById('custom-chip-prospector-from-ore')?.dataset.value || 'shiny';
                const toOre = document.getElementById('custom-chip-prospector-to-ore')?.dataset.value || 'glowy';
                const rec = recs.find(r => r.fromOre === fromOre && r.toOre === toOre);
                if (rec) return rec.fromAmount;
                return state.income?.prospector?.fromAmount || 0;
            },
            recommendedLabel: () => {
                const recs = getNextUpgradeProspectorRecommendations();
                const fromOre = document.getElementById('custom-chip-prospector-from-ore')?.dataset.value || 'shiny';
                const toOre = document.getElementById('custom-chip-prospector-to-ore')?.dataset.value || 'glowy';
                const rec = recs.find(r => r.fromOre === fromOre && r.toOre === toOre);
                return rec ? translate('views.income.prospector.tips.nextTitle') : translate('actions.reset');
            },
            clickToFill: { max: true, recommended: true }
        });
    }

    const prospectorToAmount = document.getElementById('custom-chip-prospector-to-amount');
    if (prospectorToAmount) {
        registerInputPopover(prospectorToAmount, {
            title: () => translate('views.income.prospector.toOre'),
            min: 0,
            max: () => {
                const toOre = document.getElementById('custom-chip-prospector-to-ore')?.dataset.value || 'glowy';
                return oreLimits[toOre]?.max || 2500;
            },
            showRange: true,
            showRecommended: true,
            recommended: () => {
                const recs = getNextUpgradeProspectorRecommendations();
                const fromOre = document.getElementById('custom-chip-prospector-from-ore')?.dataset.value || 'shiny';
                const toOre = document.getElementById('custom-chip-prospector-to-ore')?.dataset.value || 'glowy';
                const rec = recs.find(r => r.fromOre === fromOre && r.toOre === toOre);
                if (rec) return rec.toAmount;
                const gpFromOre = state.income?.prospector?.fromOre || 'shiny';
                const activeToOre = state.income?.prospector?.toOre || 'glowy';
                const allOres = ['shiny', 'glowy', 'starry'];
                const otherOres = allOres.filter(ore => ore !== gpFromOre);
                const gpToOre = otherOres.find(ore => ore !== activeToOre) || activeToOre;
                const gpFromAmount = state.income?.prospector?.fromAmount || 0;
                const toVal = convertOres(gpFromOre, gpToOre, gpFromAmount);
                return toVal <= 0 ? 0 : toVal;
            },
            recommendedLabel: () => {
                const recs = getNextUpgradeProspectorRecommendations();
                const fromOre = document.getElementById('custom-chip-prospector-from-ore')?.dataset.value || 'shiny';
                const toOre = document.getElementById('custom-chip-prospector-to-ore')?.dataset.value || 'glowy';
                const rec = recs.find(r => r.fromOre === fromOre && r.toOre === toOre);
                return rec ? translate('views.income.prospector.tips.nextTitle') : translate('actions.reset');
            },
            clickToFill: { max: true, recommended: true }
        });
    }

    const prospectorCount = document.getElementById('custom-chip-prospector-count');
    if (prospectorCount) {
        registerInputPopover(prospectorCount, {
            title: () => translate('views.planner.createCustomChipsModal.numChips'),
            min: 1,
            max: 30,
            showRange: true,
            showRecommended: true,
            recommended: () => {
                const recs = getNextUpgradeProspectorRecommendations();
                const fromOre = document.getElementById('custom-chip-prospector-from-ore')?.dataset.value || 'shiny';
                const toOre = document.getElementById('custom-chip-prospector-to-ore')?.dataset.value || 'glowy';
                const rec = recs.find(r => r.fromOre === fromOre && r.toOre === toOre);
                return rec ? rec.days : 1;
            },
            recommendedLabel: () => {
                const recs = getNextUpgradeProspectorRecommendations();
                const fromOre = document.getElementById('custom-chip-prospector-from-ore')?.dataset.value || 'shiny';
                const toOre = document.getElementById('custom-chip-prospector-to-ore')?.dataset.value || 'glowy';
                const rec = recs.find(r => r.fromOre === fromOre && r.toOre === toOre);
                return rec ? translate('views.income.prospector.tips.nextTitle') : translate('actions.reset');
            },
            clickToFill: { max: true, recommended: true }
        });
    }
}
