import { handleStateUpdate } from '../../core/stateManager.js';
import { state } from '../../core/state.js';

import { convertOres, getStepValue, findOptimalConversionSchedule } from '../../incomeCalculations/prospectorManager.js';
import { getGlobalPriorityList } from './priorityListModal.js';
import { getUpgradeRequirements, getBaseIncome } from '../income/prospectorDisplay.js';

import { addValidation } from '../../utils/inputValidator.js';
import { getSourceById } from '../../data/incomeSourceRegistry.js';
import { oreMaxValues } from '../../data/oreConversionData.js';
import { registerInputPopover } from '../../utils/inputPopoverProvider.js';
import { translate } from '../../i18n/translator.js';
import { warOreTownHallValues } from '../../data/incomeSources/warOres.js';

import { renderIncomeChips } from './incomeChips.js';

import { showAlert } from '../../ui/noticeModal.js';

const oreTypes = {
    shiny: 'assets/shiny_ore.png',
    glowy: 'assets/glowy_ore.png',
    starry: 'assets/starry_ore.png',
};

const oreLimits = {
    shiny: { max: 25000, maxlength: 5 },
    glowy: { max: 2500, maxlength: 4 },
    starry: { max: 500, maxlength: 3 }
};

function getNextUpgradeProspectorRecommendations() {
    try {
        const { globalPriorityList } = getGlobalPriorityList();
        if (!globalPriorityList || globalPriorityList.length === 0) return [];

        const nextReq = getUpgradeRequirements(globalPriorityList, true);
        const stored = {
            shiny: parseFloat(state.storedOres?.shiny) || 0,
            glowy: parseFloat(state.storedOres?.glowy) || 0,
            starry: parseFloat(state.storedOres?.starry) || 0
        };
        const baseIncome = getBaseIncome();
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

function getNextUpgradeProspectorRecommendation() {
    const recs = getNextUpgradeProspectorRecommendations();
    if (recs.length === 0) return null;
    const sortedConvs = [...recs].sort((a, b) => b.days - a.days);
    return sortedConvs[0];
}

let prospectorUIState = {
    fromOre: 'shiny',
    toOre: 'glowy',
    fromAmount: 0
};

let isProspectorInitialized = false;

function syncProspectorUI() {
    const fromDropdown = document.getElementById('custom-chip-prospector-from-ore');
    const toDropdown = document.getElementById('custom-chip-prospector-to-ore');

    if (!isProspectorInitialized) {
        isProspectorInitialized = true;
        
        initializeModalCustomDropdown(fromDropdown, 'from');
        initializeModalCustomDropdown(toDropdown, 'to');
    }

    prefillModalInputs('prospector');
}

function updatePerChipRewardsPreview() {
    const previewEl = document.getElementById('custom-chip-rewards-preview');
    if (!previewEl) return;

    const typeSelect = document.getElementById('custom-chip-type-select');
    const selectedType = typeSelect ? typeSelect.value : '';

    if (!['starBonus', 'clanWar', 'cwl', 'prospector'].includes(selectedType)) {
        previewEl.style.display = 'none';
        return;
    }

    let shiny = 0;
    let glowy = 0;
    let starry = 0;

    switch (selectedType) {
        case 'starBonus':
            const multiplierSelect = document.getElementById('custom-chip-starBonus-multiplier');
            if (multiplierSelect) {
                const multiplier = multiplierSelect.value;
                const baseIncome = getSourceById('starBonus')?.getBaseIncome(state) || { shiny: 0, glowy: 0, starry: 0 };
                const multValue = parseInt(multiplier.replace('x', ''), 10) || 1;
                shiny = baseIncome.shiny * multValue;
                glowy = baseIncome.glowy * multValue;
                starry = baseIncome.starry * multValue;
            }
            break;

        case 'clanWar':
            const cwResult = document.getElementById('custom-chip-clanWar-result')?.value || 'win';
            const cwRawShiny = parseInt(document.getElementById('custom-chip-clanWar-shiny')?.value, 10) || 0;
            const cwRawGlowy = parseInt(document.getElementById('custom-chip-clanWar-glowy')?.value, 10) || 0;
            const cwRawStarry = parseInt(document.getElementById('custom-chip-clanWar-starry')?.value, 10) || 0;
            const cwFactor = cwResult === 'win' ? 1.0 : (cwResult === 'loss' ? 0.5 : 0.75);
            shiny = Math.round(2 * cwRawShiny * cwFactor);
            glowy = Math.round(2 * cwRawGlowy * cwFactor);
            starry = Math.round(2 * cwRawStarry * cwFactor);
            break;

        case 'cwl':
            const cwlResult = document.getElementById('custom-chip-cwl-result')?.value || 'win';
            const cwlRawShiny = parseInt(document.getElementById('custom-chip-cwl-shiny')?.value, 10) || 0;
            const cwlRawGlowy = parseInt(document.getElementById('custom-chip-cwl-glowy')?.value, 10) || 0;
            const cwlRawStarry = parseInt(document.getElementById('custom-chip-cwl-starry')?.value, 10) || 0;
            const cwlFactor = cwlResult === 'win' ? 1.0 : (cwResult === 'loss' ? 0.5 : 0.75);
            shiny = Math.round(1 * cwlRawShiny * cwlFactor);
            glowy = Math.round(1 * cwlRawGlowy * cwlFactor);
            starry = Math.round(1 * cwlRawStarry * cwlFactor);
            break;

        case 'prospector':
            const fromDropdown = document.getElementById('custom-chip-prospector-from-ore');
            const toDropdown = document.getElementById('custom-chip-prospector-to-ore');
            const fromOre = fromDropdown ? fromDropdown.dataset.value : 'shiny';
            const toOre = toDropdown ? toDropdown.dataset.value : 'glowy';
            const fromAmount = parseInt(document.getElementById('custom-chip-prospector-from-amount')?.value, 10) || 0;
            const toAmount = parseInt(document.getElementById('custom-chip-prospector-to-amount')?.value, 10) || 0;
            
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

    // Update text elements and set classes for positive/negative numbers
    const updateEl = (id, val) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = val > 0 ? `+${val}` : val;
        
        // Dynamic coloring
        if (val < 0) {
            el.style.color = 'var(--color-danger)';
        } else if (val > 0) {
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

function prefillModalInputs(type) {
    if (!type) return;

    if (!state.planner.calendar.customChipSettings) {
        state.planner.calendar.customChipSettings = {};
    }
    if (!state.planner.calendar.customChipSettings[type]) {
        state.planner.calendar.customChipSettings[type] = {};
    }
    const settings = state.planner.calendar.customChipSettings[type];

    switch (type) {
        case 'extras':
            document.getElementById('custom-chip-extras-shiny').value = settings.shiny || 0;
            document.getElementById('custom-chip-extras-glowy').value = settings.glowy || 0;
            document.getElementById('custom-chip-extras-starry').value = settings.starry || 0;
            const extrasCount = document.getElementById('custom-chip-extras-count');
            if (extrasCount) extrasCount.value = settings.count || 1;
            break;

        case 'starBonus':
            const multiplierSelect = document.getElementById('custom-chip-starBonus-multiplier');
            const starBonusCount = document.getElementById('custom-chip-starBonus-count');
            const starBonusMonthly = document.getElementById('custom-chip-starBonus-monthly');

            if (multiplierSelect) multiplierSelect.value = settings.multiplier || '2x';
            if (starBonusCount) starBonusCount.value = settings.count || 1;
            if (starBonusMonthly) starBonusMonthly.checked = settings.monthly || false;
            break;

        case 'shopOffers':
            const shopOres = state.derived?.incomeSources?.shopOffers?.monthly || {};
            document.getElementById('custom-chip-shopOffers-shiny').value = shopOres.shiny || settings.shiny || 0;
            document.getElementById('custom-chip-shopOffers-glowy').value = shopOres.glowy || settings.glowy || 0;
            document.getElementById('custom-chip-shopOffers-starry').value = shopOres.starry || settings.starry || 0;
            document.getElementById('custom-chip-shopOffers-monthly').checked = settings.monthly || false;
            break;

        case 'gemTrader':
            const gemOres = state.derived?.incomeSources?.gemTrader?.weekly || {};
            document.getElementById('custom-chip-gemTrader-shiny').value = gemOres.shiny || settings.shiny || 0;
            document.getElementById('custom-chip-gemTrader-glowy').value = gemOres.glowy || settings.glowy || 0;
            document.getElementById('custom-chip-gemTrader-starry').value = gemOres.starry || settings.starry || 0;
            document.getElementById('custom-chip-gemTrader-weekly').checked = settings.weekly || false;
            break;

        case 'raidMedalTrader':
            const raidOres = state.derived?.incomeSources?.raidMedalTrader?.weekly || {};
            document.getElementById('custom-chip-raidMedalTrader-shiny').value = raidOres.shiny || settings.shiny || 0;
            document.getElementById('custom-chip-raidMedalTrader-glowy').value = raidOres.glowy || settings.glowy || 0;
            document.getElementById('custom-chip-raidMedalTrader-starry').value = raidOres.starry || settings.starry || 0;
            document.getElementById('custom-chip-raidMedalTrader-weekly').checked = settings.weekly || false;
            break;

        case 'eventTrader':
            const eventTraderOres = state.derived?.incomeSources?.eventTrader?.bimonthly || {};
            document.getElementById('custom-chip-eventTrader-shiny').value = eventTraderOres.shiny || settings.shiny || 0;
            document.getElementById('custom-chip-eventTrader-glowy').value = eventTraderOres.glowy || settings.glowy || 0;
            document.getElementById('custom-chip-eventTrader-starry').value = eventTraderOres.starry || settings.starry || 0;
            document.getElementById('custom-chip-eventTrader-monthly').checked = settings.monthly || false;
            break;

        case 'eventPass':
            const eventPassOres = state.derived?.incomeSources?.eventPass?.bimonthly || {};
            document.getElementById('custom-chip-eventPass-shiny').value = eventPassOres.shiny || settings.shiny || 0;
            document.getElementById('custom-chip-eventPass-glowy').value = eventPassOres.glowy || settings.glowy || 0;
            document.getElementById('custom-chip-eventPass-starry').value = eventPassOres.starry || settings.starry || 0;
            document.getElementById('custom-chip-eventPass-monthly').checked = settings.monthly || false;
            break;

        case 'clanWar':
            const cwOres = state.income?.clanWar?.oresPerAttack || {};
            document.getElementById('custom-chip-clanWar-shiny').value = cwOres.shiny || settings.shiny || 0;
            document.getElementById('custom-chip-clanWar-glowy').value = cwOres.glowy || settings.glowy || 0;
            document.getElementById('custom-chip-clanWar-starry').value = cwOres.starry || settings.starry || 0;
            document.getElementById('custom-chip-clanWar-count').value = settings.count || 1;
            document.getElementById('custom-chip-clanWar-monthly').checked = settings.monthly || false;
            document.getElementById('custom-chip-clanWar-result').value = settings.result || 'win';
            break;

        case 'cwl':
            const cwlOres = state.income?.cwl?.oresPerAttack || {};
            document.getElementById('custom-chip-cwl-shiny').value = cwlOres.shiny || settings.shiny || 0;
            document.getElementById('custom-chip-cwl-glowy').value = cwlOres.glowy || settings.glowy || 0;
            document.getElementById('custom-chip-cwl-starry').value = cwlOres.starry || settings.starry || 0;
            document.getElementById('custom-chip-cwl-count').value = settings.count || 1;
            document.getElementById('custom-chip-cwl-monthly').checked = settings.monthly || false;
            document.getElementById('custom-chip-cwl-result').value = settings.result || 'win';
            break;

        case 'supercellEvents':
            document.getElementById('custom-chip-supercellEvents-shiny').value = (settings.shiny !== undefined && settings.shiny !== 0) ? settings.shiny : 1000;
            document.getElementById('custom-chip-supercellEvents-glowy').value = (settings.glowy !== undefined && settings.glowy !== 0) ? settings.glowy : 50;
            document.getElementById('custom-chip-supercellEvents-starry').value = (settings.starry !== undefined && settings.starry !== 0) ? settings.starry : 10;
            document.getElementById('custom-chip-supercellEvents-override').checked = settings.globalOverride || false;
            break;

        case 'prospector':
            {
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
                const fromAmountInput = document.getElementById('custom-chip-prospector-from-amount');
                const toAmountInput = document.getElementById('custom-chip-prospector-to-amount');
                const countInput = document.getElementById('custom-chip-prospector-count');
                const monthlyCheckbox = document.getElementById('custom-chip-prospector-monthly');

                if (fromDropdown) {
                    fromDropdown.dataset.value = prospectorUIState.fromOre;
                    fromDropdown.querySelector('.dropdown-selected').innerHTML = `<orecalc-assets-image src="${oreTypes[prospectorUIState.fromOre]}" alt="${translate('ores.' + prospectorUIState.fromOre)}" size="thumbnail"></orecalc-assets-image>`;
                }

                if (toDropdown) {
                    toDropdown.dataset.value = prospectorUIState.toOre;
                    toDropdown.querySelector('.dropdown-selected').innerHTML = `<orecalc-assets-image src="${oreTypes[prospectorUIState.toOre]}" alt="${translate('ores.' + prospectorUIState.toOre)}" size="thumbnail"></orecalc-assets-image>`;
                }

                if (fromAmountInput) fromAmountInput.value = prospectorUIState.fromAmount;
                if (toAmountInput) toAmountInput.value = toVal;

                updateModalProspectorDropdowns();

                if (countInput) countInput.value = rec ? rec.days : (settings.count || 1);
                if (monthlyCheckbox) monthlyCheckbox.checked = settings.monthly || false;
            }
            break;
    }
    
    // Sync dataset.lastValidValue for all inputs we populated
    const activeSection = document.getElementById(`custom-chip-section-${type}`);
    if (activeSection) {
        const numInputs = activeSection.querySelectorAll('input[type="number"]');
        numInputs.forEach(input => {
            input.dataset.lastValidValue = input.value;
        });
    }

    updatePerChipRewardsPreview();
}

function initializeModalCustomDropdown(dropdownElement, whichOre) {
    const selected = dropdownElement.querySelector('.dropdown-selected');
    const options = dropdownElement.querySelector('.dropdown-options');

    dropdownElement.setAttribute('tabindex', '0');
    dropdownElement.setAttribute('role', 'combobox');
    dropdownElement.setAttribute('aria-haspopup', 'listbox');
    dropdownElement.setAttribute('aria-expanded', 'false');
    const labelKey = whichOre === 'from' ? 'income.prospector.fromOre' : 'income.prospector.toOre';
    dropdownElement.setAttribute('aria-label', translate(labelKey));

    selected.addEventListener('click', () => {
        dropdownElement.classList.toggle('open');
        dropdownElement.setAttribute('aria-expanded', dropdownElement.classList.contains('open') ? 'true' : 'false');
    });

    document.addEventListener('click', (e) => {
        if (!dropdownElement.contains(e.target)) {
            dropdownElement.classList.remove('open');
            dropdownElement.setAttribute('aria-expanded', 'false');
        }
    });

    options.addEventListener('click', (e) => {
        const option = e.target.closest('.dropdown-option');
        if (option) {
            const value = option.dataset.value;
            const imgSrc = oreTypes[value];
            selected.innerHTML = `<orecalc-assets-image src="${imgSrc}" alt="${translate('ores.' + value)}" size="thumbnail"></orecalc-assets-image>`;
            dropdownElement.dataset.value = value;
            if (whichOre === 'from') {
                prospectorUIState.fromOre = value;
            } else {
                prospectorUIState.toOre = value;
            }

            updateModalProspectorDropdowns();

            // Auto-update inputs if matching next target recommendation is found
            const recs = getNextUpgradeProspectorRecommendations();
            const matchingRec = recs.find(r => r.fromOre === prospectorUIState.fromOre && r.toOre === prospectorUIState.toOre);
            if (matchingRec) {
                const fromAmountInput = document.getElementById('custom-chip-prospector-from-amount');
                const toAmountInput = document.getElementById('custom-chip-prospector-to-amount');
                const countInput = document.getElementById('custom-chip-prospector-count');
                
                prospectorUIState.fromAmount = matchingRec.fromAmount;
                if (fromAmountInput) {
                    fromAmountInput.value = matchingRec.fromAmount;
                    fromAmountInput.dataset.lastValidValue = matchingRec.fromAmount;
                }
                if (toAmountInput) {
                    toAmountInput.value = matchingRec.toAmount;
                    toAmountInput.dataset.lastValidValue = matchingRec.toAmount;
                }
                if (countInput) {
                    countInput.value = matchingRec.days;
                    countInput.dataset.lastValidValue = matchingRec.days;
                }
            }

            updatePerChipRewardsPreview();
            dropdownElement.classList.remove('open');
            dropdownElement.setAttribute('aria-expanded', 'false');
        }
    });

    dropdownElement.addEventListener('keydown', (e) => {
        const target = e.target;
        const isOpen = dropdownElement.classList.contains('open');

        if (target === dropdownElement) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                dropdownElement.classList.toggle('open');
                dropdownElement.setAttribute('aria-expanded', dropdownElement.classList.contains('open') ? 'true' : 'false');
                if (dropdownElement.classList.contains('open')) {
                    const firstOpt = options.querySelector('.dropdown-option');
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
                const next = target.nextElementSibling;
                if (next && next.classList.contains('dropdown-option')) {
                    next.focus();
                }
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const prev = target.previousElementSibling;
                if (prev && prev.classList.contains('dropdown-option')) {
                    prev.focus();
                }
            }
        }
    });
}

function updateProspectorInputLimits() {
    const fromOre = prospectorUIState.fromOre;
    const toOre = prospectorUIState.toOre;

    const fromAmountInput = document.getElementById('custom-chip-prospector-from-amount');
    const toAmountInput = document.getElementById('custom-chip-prospector-to-amount');

    if (fromAmountInput && oreLimits[fromOre]) {
        const limit = oreLimits[fromOre];
        fromAmountInput.max = limit.max;
        fromAmountInput.maxLength = limit.maxlength;
        fromAmountInput.setAttribute('max', limit.max);
        fromAmountInput.setAttribute('maxlength', limit.maxlength);

        let val = parseInt(fromAmountInput.value, 10) || 0;
        if (val > limit.max) {
            fromAmountInput.value = limit.max;
            fromAmountInput.dataset.lastValidValue = limit.max.toString();
        }
    }

    if (toAmountInput && oreLimits[toOre]) {
        const limit = oreLimits[toOre];
        toAmountInput.max = limit.max;
        toAmountInput.maxLength = limit.maxlength;
        toAmountInput.setAttribute('max', limit.max);
        toAmountInput.setAttribute('maxlength', limit.maxlength);

        let val = parseInt(toAmountInput.value, 10) || 0;
        if (val > limit.max) {
            toAmountInput.value = limit.max;
            toAmountInput.dataset.lastValidValue = limit.max.toString();
        }
    }
}

function updateModalProspectorDropdowns() {
    const fromDropdown = document.getElementById('custom-chip-prospector-from-ore');
    const toDropdown = document.getElementById('custom-chip-prospector-to-ore');

    const fromOreValue = fromDropdown.dataset.value;
    let toOreValue = toDropdown.dataset.value;

    if (fromOreValue === toOreValue) {
        const newToOre = Object.keys(oreTypes).find(ore => ore !== fromOreValue);
        if (newToOre) {
            toOreValue = newToOre;
            toDropdown.dataset.value = toOreValue;
            toDropdown.querySelector('.dropdown-selected').innerHTML = `<orecalc-assets-image src="${oreTypes[toOreValue]}" alt="${toOreValue}" size="thumbnail"></orecalc-assets-image>`;
            prospectorUIState.toOre = toOreValue;
        }
    }

    const fromOreOptions = fromDropdown.querySelector('.dropdown-options');
    fromOreOptions.innerHTML = '';
    Object.keys(oreTypes).forEach(ore => {
        if (ore !== fromOreValue) {
            const option = document.createElement('div');
            option.classList.add('dropdown-option');
            option.setAttribute('tabindex', '0');
            option.setAttribute('role', 'option');
            option.dataset.value = ore;
            option.innerHTML = `<orecalc-assets-image src="${oreTypes[ore]}" alt="${translate('ores.' + ore)}" size="thumbnail"></orecalc-assets-image>`;
            fromOreOptions.appendChild(option);
        }
    });

    const toOreOptions = toDropdown.querySelector('.dropdown-options');
    toOreOptions.innerHTML = '';
    Object.keys(oreTypes).forEach(ore => {
        if (ore !== fromOreValue && ore !== toOreValue) {
            const option = document.createElement('div');
            option.classList.add('dropdown-option');
            option.setAttribute('tabindex', '0');
            option.setAttribute('role', 'option');
            option.dataset.value = ore;
            option.innerHTML = `<orecalc-assets-image src="${oreTypes[ore]}" alt="${translate('ores.' + ore)}" size="thumbnail"></orecalc-assets-image>`;
            toOreOptions.appendChild(option);
        }
    });

    updateProspectorInputLimits();
}

export function openCreateCustomChipsModal() {
    const modal = document.getElementById('create-custom-chips-modal');
    if (!modal) return;

    // Reset select and input values
    const typeSelect = document.getElementById('custom-chip-type-select');
    if (typeSelect) {
        typeSelect.value = '';
    }

    const dynamicInputsContainer = document.getElementById('custom-chip-dynamic-inputs');
    if (dynamicInputsContainer) {
        dynamicInputsContainer.style.display = 'none';
    }

    // Hide all sub sections
    const sections = document.querySelectorAll('.custom-chip-section');
    sections.forEach(sec => sec.style.display = 'none');

    // Reset numeric values
    const numInputs = modal.querySelectorAll('input[type="number"]');
    numInputs.forEach(input => {
        if (input.id.endsWith('-count')) {
            input.value = '1';
            input.min = '1';
            input.dataset.lastValidValue = '1';
        } else {
            input.value = '0';
            input.dataset.lastValidValue = '0';
        }
    });

    const selects = modal.querySelectorAll('select:not(#custom-chip-type-select)');
    selects.forEach(sel => {
        sel.selectedIndex = 0;
    });

    const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = false;
    });



    // Show modal
    modal.classList.add('show');
    const overlay = document.getElementById('overlay');
    if (overlay) overlay.classList.add('show');
}

export function initializeCreateCustomChipsModalListeners() {
    const modal = document.getElementById('create-custom-chips-modal');
    if (!modal) return;

    // Register all numeric inputs inside this modal for validation
    const numberInputs = modal.querySelectorAll('input[type="number"]');
    numberInputs.forEach(input => {
        addValidation(input, { inputName: input.id });
    });

    // --- Popover Registrations ---
    // 1. Extras Section
    const extrasShiny = document.getElementById('custom-chip-extras-shiny');
    if (extrasShiny) {
        registerInputPopover(extrasShiny, {
            title: () => translate('ores.shiny'),
            min: 0,
            max: 25000,
            showRange: true,
            clickToFill: { max: true }
        });
    }
    const extrasGlowy = document.getElementById('custom-chip-extras-glowy');
    if (extrasGlowy) {
        registerInputPopover(extrasGlowy, {
            title: () => translate('ores.glowy'),
            min: 0,
            max: 2500,
            showRange: true,
            clickToFill: { max: true }
        });
    }
    const extrasStarry = document.getElementById('custom-chip-extras-starry');
    if (extrasStarry) {
        registerInputPopover(extrasStarry, {
            title: () => translate('ores.starry'),
            min: 0,
            max: 500,
            showRange: true,
            clickToFill: { max: true }
        });
    }
    const extrasCount = document.getElementById('custom-chip-extras-count');
    if (extrasCount) {
        registerInputPopover(extrasCount, {
            title: () => translate('planner.createCustomChipsModal.numChips') || 'Number of chips',
            min: 1,
            max: 9,
            showRange: true,
            clickToFill: { max: true }
        });
    }

    // 2. Star Bonus Section
    const starBonusCount = document.getElementById('custom-chip-starBonus-count');
    if (starBonusCount) {
        registerInputPopover(starBonusCount, {
            title: () => translate('planner.createCustomChipsModal.numChips') || 'Number of chips',
            min: 1,
            max: 15,
            showRange: true,
            clickToFill: { max: true }
        });
    }

    // Helper for Reset/Recommended (Dynamic values)
    const registerResetPopover = (elementId, oreType, getRecFn) => {
        const input = document.getElementById(elementId);
        if (!input) return;
        const limits = { shiny: 25000, glowy: 2500, starry: 500 };
        registerInputPopover(input, {
            title: () => translate(`ores.${oreType}`),
            min: 0,
            max: limits[oreType] || 25000,
            showRange: true,
            showRecommended: true,
            recommended: getRecFn,
            recommendedLabel: () => translate('actions.reset') || 'Reset',
            clickToFill: { max: true, recommended: true }
        });
    };

    // 3. Shop Offers
    registerResetPopover('custom-chip-shopOffers-shiny', 'shiny', () => state.derived?.incomeSources?.shopOffers?.monthly?.shiny || 0);
    registerResetPopover('custom-chip-shopOffers-glowy', 'glowy', () => state.derived?.incomeSources?.shopOffers?.monthly?.glowy || 0);
    registerResetPopover('custom-chip-shopOffers-starry', 'starry', () => state.derived?.incomeSources?.shopOffers?.monthly?.starry || 0);

    // 4. Gem Trader
    registerResetPopover('custom-chip-gemTrader-shiny', 'shiny', () => state.derived?.incomeSources?.gemTrader?.weekly?.shiny || 0);
    registerResetPopover('custom-chip-gemTrader-glowy', 'glowy', () => state.derived?.incomeSources?.gemTrader?.weekly?.glowy || 0);
    registerResetPopover('custom-chip-gemTrader-starry', 'starry', () => state.derived?.incomeSources?.gemTrader?.weekly?.starry || 0);

    // 5. Raid Medal Trader
    registerResetPopover('custom-chip-raidMedalTrader-shiny', 'shiny', () => state.derived?.incomeSources?.raidMedalTrader?.weekly?.shiny || 0);
    registerResetPopover('custom-chip-raidMedalTrader-glowy', 'glowy', () => state.derived?.incomeSources?.raidMedalTrader?.weekly?.glowy || 0);
    registerResetPopover('custom-chip-raidMedalTrader-starry', 'starry', () => state.derived?.incomeSources?.raidMedalTrader?.weekly?.starry || 0);

    // 6. Event Trader
    registerResetPopover('custom-chip-eventTrader-shiny', 'shiny', () => state.derived?.incomeSources?.eventTrader?.bimonthly?.shiny || 0);
    registerResetPopover('custom-chip-eventTrader-glowy', 'glowy', () => state.derived?.incomeSources?.eventTrader?.bimonthly?.glowy || 0);
    registerResetPopover('custom-chip-eventTrader-starry', 'starry', () => state.derived?.incomeSources?.eventTrader?.bimonthly?.starry || 0);

    // 7. Event Pass
    registerResetPopover('custom-chip-eventPass-shiny', 'shiny', () => state.derived?.incomeSources?.eventPass?.bimonthly?.shiny || 0);
    registerResetPopover('custom-chip-eventPass-glowy', 'glowy', () => state.derived?.incomeSources?.eventPass?.bimonthly?.glowy || 0);
    registerResetPopover('custom-chip-eventPass-starry', 'starry', () => state.derived?.incomeSources?.eventPass?.bimonthly?.starry || 0);

    // 8. Supercell Events
    registerResetPopover('custom-chip-supercellEvents-shiny', 'shiny', () => 1000);
    registerResetPopover('custom-chip-supercellEvents-glowy', 'glowy', () => 50);
    registerResetPopover('custom-chip-supercellEvents-starry', 'starry', () => 10);

    // Helper for War inputs (Clan War & CWL)
    const registerWarPopover = (elementId, oreType) => {
        const input = document.getElementById(elementId);
        if (!input) return;
        const limits = { shiny: 1110, glowy: 39, starry: 6 };
        registerInputPopover(input, {
            title: () => translate('validation.amount'),
            min: 0,
            max: limits[oreType] || 1110,
            showRecommended: true,
            recommended: () => {
                const playerTH = parseInt(state.playerProfile?.townHallLevel || 16, 10);
                let checkTH = playerTH;
                if (checkTH < 8) checkTH = 8;
                else if (checkTH > 16) checkTH = 16;
                return warOreTownHallValues[oreType][checkTH] !== undefined ? warOreTownHallValues[oreType][checkTH] : 0;
            },
            recommendedLabel: () => {
                const playerTH = parseInt(state.playerProfile?.townHallLevel || 16, 10);
                return `TH ${playerTH}`;
            },
            hideRecommendedIfHigher: true,
            clickToFill: { max: true, recommended: true }
        });
    };

    // 9. Clan War
    registerWarPopover('custom-chip-clanWar-shiny', 'shiny');
    registerWarPopover('custom-chip-clanWar-glowy', 'glowy');
    registerWarPopover('custom-chip-clanWar-starry', 'starry');
    const clanWarCount = document.getElementById('custom-chip-clanWar-count');
    if (clanWarCount) {
        registerInputPopover(clanWarCount, {
            title: () => translate('planner.createCustomChipsModal.numChips') || 'Number of chips',
            min: 1,
            max: 15,
            showRange: true,
            clickToFill: { max: true }
        });
    }

    // 10. CWL
    registerWarPopover('custom-chip-cwl-shiny', 'shiny');
    registerWarPopover('custom-chip-cwl-glowy', 'glowy');
    registerWarPopover('custom-chip-cwl-starry', 'starry');
    const cwlCount = document.getElementById('custom-chip-cwl-count');
    if (cwlCount) {
        registerInputPopover(cwlCount, {
            title: () => translate('planner.createCustomChipsModal.numChips') || 'Number of chips',
            min: 1,
            max: 7,
            showRange: true,
            clickToFill: { max: true }
        });
    }

    // 11. Prospector
    const prospectorFromAmount = document.getElementById('custom-chip-prospector-from-amount');
    if (prospectorFromAmount) {
        registerInputPopover(prospectorFromAmount, {
            title: () => translate('income.prospector.fromOre') || 'From Ore',
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
                const gpFromOre = state.income?.prospector?.fromOre || 'shiny';
                return state.income?.prospector?.fromAmount || 0;
            },
            recommendedLabel: () => {
                const recs = getNextUpgradeProspectorRecommendations();
                const fromOre = document.getElementById('custom-chip-prospector-from-ore')?.dataset.value || 'shiny';
                const toOre = document.getElementById('custom-chip-prospector-to-ore')?.dataset.value || 'glowy';
                const rec = recs.find(r => r.fromOre === fromOre && r.toOre === toOre);
                return rec ? translate('income.prospector.tips.nextTitle') : translate('actions.reset');
            },
            clickToFill: { max: true, recommended: true }
        });
    }
    const prospectorToAmount = document.getElementById('custom-chip-prospector-to-amount');
    if (prospectorToAmount) {
        registerInputPopover(prospectorToAmount, {
            title: () => translate('income.prospector.toOre') || 'To Ore',
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
                return rec ? translate('income.prospector.tips.nextTitle') : translate('actions.reset');
            },
            clickToFill: { max: true, recommended: true }
        });
    }
    const prospectorCount = document.getElementById('custom-chip-prospector-count');
    if (prospectorCount) {
        registerInputPopover(prospectorCount, {
            title: () => translate('planner.createCustomChipsModal.numChips') || 'Number of chips',
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
                return rec ? translate('income.prospector.tips.nextTitle') : translate('actions.reset');
            },
            clickToFill: { max: true, recommended: true }
        });
    }

    const typeSelect = document.getElementById('custom-chip-type-select');
    const dynamicInputsContainer = document.getElementById('custom-chip-dynamic-inputs');

    if (typeSelect) {
        typeSelect.addEventListener('change', (e) => {
            const selectedType = e.target.value;
            const sections = modal.querySelectorAll('.custom-chip-section');
            sections.forEach(sec => sec.style.display = 'none');

            if (selectedType) {
                if (dynamicInputsContainer) dynamicInputsContainer.style.display = 'block';
                const activeSection = document.getElementById(`custom-chip-section-${selectedType}`);
                if (activeSection) {
                    activeSection.style.display = 'block';
                }
                if (selectedType === 'prospector') {
                    syncProspectorUI();
                } else {
                    prefillModalInputs(selectedType);
                }
            } else {
                if (dynamicInputsContainer) dynamicInputsContainer.style.display = 'none';
            }
            updatePerChipRewardsPreview();
        });
    }

    const previewTriggers = [
        'custom-chip-starBonus-multiplier',
        'custom-chip-clanWar-result',
        'custom-chip-clanWar-shiny',
        'custom-chip-clanWar-glowy',
        'custom-chip-clanWar-starry',
        'custom-chip-cwl-result',
        'custom-chip-cwl-shiny',
        'custom-chip-cwl-glowy',
        'custom-chip-cwl-starry',
        'custom-chip-prospector-from-amount',
        'custom-chip-prospector-to-amount'
    ];

    previewTriggers.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const eventType = el.tagName === 'SELECT' ? 'change' : 'input';
            el.addEventListener(eventType, updatePerChipRewardsPreview);
        }
    });

    const closeBtn = document.getElementById('close-create-custom-chips-modal-btn');
    const cancelBtn = document.getElementById('cancel-create-custom-chips-btn');
    const saveBtn = document.getElementById('save-create-custom-chips-btn');

    const closeModal = () => {
        modal.classList.remove('show');
        const overlay = document.getElementById('overlay');
        if (overlay) overlay.classList.remove('show');
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const selectedType = typeSelect.value;
            if (!selectedType) return;

            const customChips = state.planner.calendar.customChips || [];
            if (!state.planner.calendar.customChipSettings) {
                state.planner.calendar.customChipSettings = {};
            }
            if (!state.planner.calendar.customChipSettings[selectedType]) {
                state.planner.calendar.customChipSettings[selectedType] = {};
            }
            const settings = state.planner.calendar.customChipSettings[selectedType];
            
            let count = 1;
            let chipData = { type: selectedType, isCustom: true };

            switch (selectedType) {
                case 'extras':
                    chipData.customType = 'Extras';
                    chipData.shiny = parseInt(document.getElementById('custom-chip-extras-shiny').value, 10) || 0;
                    chipData.glowy = parseInt(document.getElementById('custom-chip-extras-glowy').value, 10) || 0;
                    chipData.starry = parseInt(document.getElementById('custom-chip-extras-starry').value, 10) || 0;
                    chipData.isRecurring = false;
                    count = parseInt(document.getElementById('custom-chip-extras-count').value, 10) || 1;
                    settings.count = count;
                    settings.shiny = chipData.shiny;
                    settings.glowy = chipData.glowy;
                    settings.starry = chipData.starry;

                    // Check if duplicate exists in customChips
                    const isDuplicateInContainer = customChips.some(c => 
                        (c.type === 'extras' || c.type === 'custom') && 
                        c.shiny === chipData.shiny && 
                        c.glowy === chipData.glowy && 
                        c.starry === chipData.starry
                    );
                    
                    // Check if duplicate exists on calendar dates
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

                    if (isDuplicateInContainer || isDuplicateOnCalendar) {
                        await showAlert(translate('errors.duplicateCustomType'));
                        return;
                    }
                    break;
                case 'starBonus':
                    const multiplier = document.getElementById('custom-chip-starBonus-multiplier').value;
                    const starBonusType = 'starBonus' + multiplier; // e.g. "starBonus3x"
                    count = parseInt(document.getElementById('custom-chip-starBonus-count').value, 10) || 1;
                    settings.monthly = document.getElementById('custom-chip-starBonus-monthly').checked;
                    settings.count = count;
                    settings.multiplier = multiplier;
                    chipData.type = starBonusType;
                    chipData.multiplier = multiplier;
                    chipData.isRecurring = settings.monthly;

                    // Fetch base Star Bonus income and apply multiplier
                    const baseIncome = getSourceById('starBonus')?.getBaseIncome(state) || { shiny: 0, glowy: 0, starry: 0 };
                    const multValue = parseInt(multiplier.replace('x', ''), 10) || 1;
                    chipData.shiny = baseIncome.shiny * multValue;
                    chipData.glowy = baseIncome.glowy * multValue;
                    chipData.starry = baseIncome.starry * multValue;
                    break;
                case 'shopOffers':
                    chipData.shiny = parseInt(document.getElementById('custom-chip-shopOffers-shiny').value, 10) || 0;
                    chipData.glowy = parseInt(document.getElementById('custom-chip-shopOffers-glowy').value, 10) || 0;
                    chipData.starry = parseInt(document.getElementById('custom-chip-shopOffers-starry').value, 10) || 0;
                    settings.monthly = document.getElementById('custom-chip-shopOffers-monthly').checked;
                    settings.shiny = chipData.shiny;
                    settings.glowy = chipData.glowy;
                    settings.starry = chipData.starry;
                    chipData.isRecurring = settings.monthly;
                    break;
                case 'gemTrader':
                    chipData.shiny = parseInt(document.getElementById('custom-chip-gemTrader-shiny').value, 10) || 0;
                    chipData.glowy = parseInt(document.getElementById('custom-chip-gemTrader-glowy').value, 10) || 0;
                    chipData.starry = parseInt(document.getElementById('custom-chip-gemTrader-starry').value, 10) || 0;
                    settings.weekly = document.getElementById('custom-chip-gemTrader-weekly').checked;
                    settings.shiny = chipData.shiny;
                    settings.glowy = chipData.glowy;
                    settings.starry = chipData.starry;
                    chipData.isRecurring = settings.weekly;
                    break;
                case 'raidMedalTrader':
                    chipData.shiny = parseInt(document.getElementById('custom-chip-raidMedalTrader-shiny').value, 10) || 0;
                    chipData.glowy = parseInt(document.getElementById('custom-chip-raidMedalTrader-glowy').value, 10) || 0;
                    chipData.starry = parseInt(document.getElementById('custom-chip-raidMedalTrader-starry').value, 10) || 0;
                    settings.weekly = document.getElementById('custom-chip-raidMedalTrader-weekly').checked;
                    settings.shiny = chipData.shiny;
                    settings.glowy = chipData.glowy;
                    settings.starry = chipData.starry;
                    chipData.isRecurring = settings.weekly;
                    break;
                case 'eventTrader':
                    chipData.shiny = parseInt(document.getElementById('custom-chip-eventTrader-shiny').value, 10) || 0;
                    chipData.glowy = parseInt(document.getElementById('custom-chip-eventTrader-glowy').value, 10) || 0;
                    chipData.starry = parseInt(document.getElementById('custom-chip-eventTrader-starry').value, 10) || 0;
                    settings.monthly = document.getElementById('custom-chip-eventTrader-monthly').checked;
                    settings.shiny = chipData.shiny;
                    settings.glowy = chipData.glowy;
                    settings.starry = chipData.starry;
                    chipData.isRecurring = settings.monthly;
                    break;
                case 'eventPass':
                    chipData.shiny = parseInt(document.getElementById('custom-chip-eventPass-shiny').value, 10) || 0;
                    chipData.glowy = parseInt(document.getElementById('custom-chip-eventPass-glowy').value, 10) || 0;
                    chipData.starry = parseInt(document.getElementById('custom-chip-eventPass-starry').value, 10) || 0;
                    settings.monthly = document.getElementById('custom-chip-eventPass-monthly').checked;
                    settings.shiny = chipData.shiny;
                    settings.glowy = chipData.glowy;
                    settings.starry = chipData.starry;
                    chipData.isRecurring = settings.monthly;
                    break;
                case 'clanWar':
                    chipData.result = document.getElementById('custom-chip-clanWar-result').value;
                    const cwRawShiny = parseInt(document.getElementById('custom-chip-clanWar-shiny').value, 10) || 0;
                    const cwRawGlowy = parseInt(document.getElementById('custom-chip-clanWar-glowy').value, 10) || 0;
                    const cwRawStarry = parseInt(document.getElementById('custom-chip-clanWar-starry').value, 10) || 0;
                    const cwFactor = chipData.result === 'win' ? 1.0 : (chipData.result === 'loss' ? 0.5 : 0.75);
                    
                    chipData.shiny = Math.round(2 * cwRawShiny * cwFactor);
                    chipData.glowy = Math.round(2 * cwRawGlowy * cwFactor);
                    chipData.starry = Math.round(2 * cwRawStarry * cwFactor);

                    count = parseInt(document.getElementById('custom-chip-clanWar-count').value, 10) || 1;
                    settings.monthly = document.getElementById('custom-chip-clanWar-monthly').checked;
                    settings.count = count;
                    settings.shiny = cwRawShiny;
                    settings.glowy = cwRawGlowy;
                    settings.starry = cwRawStarry;
                    settings.result = chipData.result;
                    chipData.isRecurring = settings.monthly;
                    break;
                case 'cwl':
                    chipData.result = document.getElementById('custom-chip-cwl-result').value;
                    const cwlRawShiny = parseInt(document.getElementById('custom-chip-cwl-shiny').value, 10) || 0;
                    const cwlRawGlowy = parseInt(document.getElementById('custom-chip-cwl-glowy').value, 10) || 0;
                    const cwlRawStarry = parseInt(document.getElementById('custom-chip-cwl-starry').value, 10) || 0;
                    const cwlFactor = chipData.result === 'win' ? 1.0 : (chipData.result === 'loss' ? 0.5 : 0.75);
                    
                    chipData.shiny = Math.round(1 * cwlRawShiny * cwlFactor);
                    chipData.glowy = Math.round(1 * cwlRawGlowy * cwlFactor);
                    chipData.starry = Math.round(1 * cwlRawStarry * cwlFactor);

                    count = parseInt(document.getElementById('custom-chip-cwl-count').value, 10) || 1;
                    settings.monthly = document.getElementById('custom-chip-cwl-monthly').checked;
                    settings.count = count;
                    settings.shiny = cwlRawShiny;
                    settings.glowy = cwlRawGlowy;
                    settings.starry = cwlRawStarry;
                    settings.result = chipData.result;
                    chipData.isRecurring = settings.monthly;
                    break;
                case 'supercellEvents':
                    chipData.shiny = parseInt(document.getElementById('custom-chip-supercellEvents-shiny').value, 10) || 0;
                    chipData.glowy = parseInt(document.getElementById('custom-chip-supercellEvents-glowy').value, 10) || 0;
                    chipData.starry = parseInt(document.getElementById('custom-chip-supercellEvents-starry').value, 10) || 0;
                    settings.globalOverride = document.getElementById('custom-chip-supercellEvents-override').checked;
                    settings.shiny = chipData.shiny;
                    settings.glowy = chipData.glowy;
                    settings.starry = chipData.starry;
                    chipData.isRecurring = false;
                    break;
                case 'prospector':
                    const fromOre = document.getElementById('custom-chip-prospector-from-ore').dataset.value;
                    const fromAmount = parseInt(document.getElementById('custom-chip-prospector-from-amount').value, 10) || 0;
                    const toOre = document.getElementById('custom-chip-prospector-to-ore').dataset.value;
                    const toAmount = parseInt(document.getElementById('custom-chip-prospector-to-amount').value, 10) || 0;

                    if (fromOre === toOre) {
                        await showAlert(translate('validation.prospectorSameOre'));
                        return;
                    }

                    if (fromAmount <= 0 || toAmount <= 0) {
                        await showAlert(translate('validation.prospectorZeroAmount'));
                        return;
                    }

                    chipData.shiny = 0;
                    chipData.glowy = 0;
                    chipData.starry = 0;
                    chipData[fromOre] = -fromAmount;
                    chipData[toOre] = toAmount;

                    count = parseInt(document.getElementById('custom-chip-prospector-count').value, 10) || 1;
                    settings.monthly = document.getElementById('custom-chip-prospector-monthly').checked;
                    settings.count = count;
                    settings.shiny = chipData.shiny;
                    settings.glowy = chipData.glowy;
                    settings.starry = chipData.starry;
                    chipData.isRecurring = settings.monthly;
                    break;
            }

            // Check for zero ores (for all types except starBonus)
            if (selectedType !== 'starBonus') {
                if ((chipData.shiny || 0) === 0 && (chipData.glowy || 0) === 0 && (chipData.starry || 0) === 0) {
                    await showAlert(translate('errors.atLeastOneOreRequired'));
                    return;
                }
            }

            handleStateUpdate(() => {
                for (let i = 0; i < count; i++) {
                    const shortId = Math.random().toString(36).substring(2, 7);
                    const newId = `custom-${chipData.type}-${shortId}-${i}`;
                    const finalChipData = { ...chipData, instance: i + 1, id: newId };
                    customChips.push(finalChipData);
                }
                state.planner.calendar.customChips = customChips;
            });

            closeModal();
            if (state.planner?.calendar?.view?.month) {
                renderIncomeChips(state.planner.calendar.view.month.split('-')[0], parseInt(state.planner.calendar.view.month.split('-')[1], 10) - 1);
            }
        });
    }
}
