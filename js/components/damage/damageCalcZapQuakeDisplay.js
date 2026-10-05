/**
 * DOM Rendering Engine for Unified ZapQuake Solver view.
 * Tier 4: UI Presentation (Dedicated exclusively to DOM rendering, 0 event listeners).
 */

import { getDefensesData } from '../../data/defenseTargetsData.js';
import { equipmentDamageData } from '../../data/equipmentDamageData.js';
import { getBuildingAssetUrl } from '../../core/buildingAssetHelper.js';
import {
    getMaxSuperchargeTier,
    isDefenseInSeason,
    getDefenseCategoryTier,
    canEquipmentTarget
} from '../../domain/damage/defenseProgressionDomain.js';
import { getEnabledEquipmentList } from '../../domain/damage/equipmentDamage.js';
import {
    getDashboardComboBuckets,
    shouldComboExpandFullWidth,
    sortDetailedCombos
} from '../../domain/damage/zapQuakeDashboardDomain.js';
import { translate } from '../../i18n/translator.js';
import { renderBattleModifierSwitcher } from '../common/battleModifierSwitcher.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { getActiveModifier } from './damageCalcState.js';
import {
    getDefenseDisplayName,
    getEquipmentDisplayName
} from '../../utils/equipmentMetadata.js';
import {
    getLvlShort,
    getHpUnit,
    renderSuperchargePipsHtml
} from './damageCalcDisplay.js';
import {
    getDamageSourcesGridHtml,
    getDamageSourcesCardMarkup
} from './damageCalcSourcesDisplay.js';

/**
 * Resolves the localized survival summary title.
 *
 * @returns {string} Localized title string.
 */
function getRemainingTitle() {
    return translate('views.damageCalc.zapQuake.remainingDefenses') || 'Remaining Defenses';
}

/**
 * Renders HTML markup for the defense cards/pills within a combo.
 *
 * @param {Array<Object>} filteredDefenses - List of defense items.
 * @param {Object} combo - The parent combination bucket.
 * @param {string} viewMode - 'compact' or 'detailed'.
 * @param {Object} context - Offensive spell/equipment parameters.
 * @returns {string} HTML markup string.
 */
function renderComboDefensesHtml(filteredDefenses, combo, viewMode, context) {
    const { zapLvl, ccZapLvl, eqLvl, ccEqLvl, enabledEquipment, enabledSpells, hpUnit } = context;
    const regEqCount = combo.regEqCount !== undefined ? combo.regEqCount : combo.eqCount;
    const ccEqCount = combo.ccEqCount || 0;
    const regZapCount = combo.regZapCount !== undefined ? combo.regZapCount : combo.zapCount;
    const ccZapCount = combo.ccZapCount || 0;

    let defGridHtml = '';
    for (const d of filteredDefenses) {
        const defData = getDefensesData()[d.defenseKey];
        const defDisplayName = getDefenseDisplayName(d.defenseKey);
        const isCrafted = defData?.subCategory === 'crafted';
        const defSupercharge = d.superchargeTier || 0;
        const cardTooltip = `${defDisplayName} (${getLvlShort(d.defenseKey)} ${d.level} · ${formatNumber(d.maxHp)} ${hpUnit})`;
        const tier = getDefenseCategoryTier(d.defenseKey, defData);

        if (viewMode === 'compact') {
            defGridHtml += `
                <div class="calc-combo-defense-card calc-combo-defense-card--compact ${combo.isRemaining ? 'calc-combo-defense-card--remaining' : ''}"
                    data-action="open-target-combos"
                    data-building-key="${d.defenseKey}"
                    data-tier="${tier}"
                    data-building-level="${d.level}"
                    data-supercharge="${defSupercharge}"
                    data-is-remaining="${combo.isRemaining ? 'true' : 'false'}"
                    data-eq-count="${combo.eqCount || 0}"
                    data-zap-count="${combo.zapCount || 0}"
                    data-reg-eq="${regEqCount}"
                    data-cc-eq="${ccEqCount}"
                    data-reg-zap="${regZapCount}"
                    data-cc-zap="${ccZapCount}"
                    data-zap-level="${zapLvl}"
                    data-cc-zap-level="${ccZapLvl}"
                    data-eq-level="${eqLvl}"
                    data-cc-eq-level="${ccEqLvl}"
                    data-equip='${JSON.stringify((combo.isRemaining ? (combo.equipment || enabledEquipment || []) : (combo.equipment || [])).filter(eq => canEquipmentTarget(eq.id, d.defenseKey, d.level)))}'
                    data-enabled-spells='${escapeHTML(JSON.stringify(enabledSpells))}'
                    data-best-attempt='${escapeHTML(JSON.stringify(d.bestAttempt || null))}'
                    data-max-hp="${d.maxHp}"
                    title="${escapeHTML(cardTooltip)}">
                    <div class="calc-combo-defense-card__thumb-wrapper">
                        <orecalc-assets-image
                            src="${getBuildingAssetUrl(d.defenseKey, d.level)}"
                            alt="${escapeHTML(defDisplayName)}"
                            class="calc-combo-defense-card__thumb"
                            size="thumbnail">
                        </orecalc-assets-image>
                        ${isCrafted ? `
                            <span class="calc-combo-defense-card__seasonal-badge" title="${escapeHTML(translate('views.damageCalc.filters.craftedDefenseTooltip'))}">
                                <orecalc-assets-svg name="timer" width="10" height="10"></orecalc-assets-svg>
                            </span>
                        ` : ''}
                    </div>
                    <button type="button" class="calc-combo-defense-card__info-btn" data-combo-defense-info="true" aria-label="${escapeHTML(translate('views.damageCalc.zapQuake.combinationBreakdownAria') || 'Damage Breakdown')}">
                        <orecalc-assets-svg name="info" width="12" height="12"></orecalc-assets-svg>
                    </button>
                </div>
            `;
        } else {
            defGridHtml += `
                <div class="calc-combo-defense-card ${combo.isRemaining ? 'calc-combo-defense-card--remaining' : ''}"
                    data-action="open-target-combos"
                    data-building-key="${d.defenseKey}"
                    data-tier="${tier}"
                    data-building-level="${d.level}"
                    data-supercharge="${defSupercharge}"
                    data-is-remaining="${combo.isRemaining ? 'true' : 'false'}"
                    data-eq-count="${combo.eqCount || 0}"
                    data-zap-count="${combo.zapCount || 0}"
                    data-reg-eq="${regEqCount}"
                    data-cc-eq="${ccEqCount}"
                    data-reg-zap="${regZapCount}"
                    data-cc-zap="${ccZapCount}"
                    data-zap-level="${zapLvl}"
                    data-cc-zap-level="${ccZapLvl}"
                    data-eq-level="${eqLvl}"
                    data-cc-eq-level="${ccEqLvl}"
                    data-equip='${JSON.stringify((combo.isRemaining ? (combo.equipment || enabledEquipment || []) : (combo.equipment || [])).filter(eq => canEquipmentTarget(eq.id, d.defenseKey, d.level)))}'
                    data-enabled-spells='${escapeHTML(JSON.stringify(enabledSpells))}'
                    data-best-attempt='${escapeHTML(JSON.stringify(d.bestAttempt || null))}'
                    data-max-hp="${d.maxHp}"
                    title="${escapeHTML(cardTooltip)}">
                    <div class="calc-combo-defense-card__thumb-wrapper">
                        <orecalc-assets-image
                            src="${getBuildingAssetUrl(d.defenseKey, d.level)}"
                            alt="${escapeHTML(defDisplayName)}"
                            class="calc-combo-defense-card__thumb"
                            size="thumbnail">
                        </orecalc-assets-image>
                        ${isCrafted ? `
                            <span class="calc-combo-defense-card__seasonal-badge" title="${escapeHTML(translate('views.damageCalc.filters.craftedDefenseTooltip'))}">
                                <orecalc-assets-svg name="timer" width="10" height="10"></orecalc-assets-svg>
                            </span>
                        ` : ''}
                    </div>
                    <div class="calc-combo-defense-card__info">
                        <div class="calc-combo-defense-card__name">${escapeHTML(defDisplayName)}</div>
                        <div class="calc-combo-defense-card__meta">
                            <span class="calc-combo-defense-card__level">
                                ${getLvlShort(d.defenseKey)} ${d.level}
                                ${defSupercharge > 0 ? `
                                    <span class="calc-combo-defense-card__supercharge" title="${escapeHTML(translate('views.damageCalc.offense.superchargeLabel'))} &middot; ${escapeHTML(translate('views.damageCalc.zapQuake.tierLabel', { tier: defSupercharge }))}">
                                        ${renderSuperchargePipsHtml(defSupercharge, getMaxSuperchargeTier(d.defenseKey, d.level), { variant: 'compact' })}
                                    </span>
                                ` : ''}
                            </span>
                            <span class="calc-combo-defense-card__sep" aria-hidden="true">&middot;</span>
                            <span class="calc-combo-defense-card__hp">${formatNumber(d.maxHp || d.hp || 0)} ${hpUnit}</span>
                        </div>
                    </div>
                    <button type="button" class="calc-combo-defense-card__info-btn" data-combo-defense-info="true" aria-label="${escapeHTML(translate('views.damageCalc.zapQuake.combinationBreakdownAria') || 'Damage Breakdown')}">
                        <orecalc-assets-svg name="info" width="12" height="12"></orecalc-assets-svg>
                    </button>
                </div>
            `;
        }
    }
    return defGridHtml;
}

/**
 * Renders the Unified ZapQuake Solver view (combining Spells + Hero Equipment).
 *
 * @param {Object} state - Damage calculator state.
 * @param {HTMLElement} container - Target DOM container.
 */
export function renderZapQuakePanel(state, container) {
    if (!container) return;

    const zq = state.zapQuake;
    const spells = state.offense?.spells || { lightning: 13, earthquake: 8 };
    const zapLvl = spells.lightning || zq.lightningLevel || 13;
    const eqLvl = spells.earthquake || zq.earthquakeLevel || 8;
    const enabledSources = state.offense?.enabledSources || {};

    const ccSpells = state.offense?.ccSpells || { lightning: 13, earthquake: 8 };
    const ccZapLvl = ccSpells.lightning || 13;
    const ccEqLvl = ccSpells.earthquake || 8;
    const isCcZapEnabled = enabledSources.cc_lightning !== false;
    const isCcEqEnabled = enabledSources.cc_earthquake !== false;
    const hpUnit = getHpUnit();
    const ccZapName = translate('views.damageCalc.offense.donatedLightningLabel');
    const ccEqName = translate('views.damageCalc.offense.donatedEarthquakeLabel');

    // Prepare enabled options for solver
    const enabledSpells = {
        lightning: enabledSources.lightning !== false,
        earthquake: enabledSources.earthquake !== false,
        cc_lightning: isCcZapEnabled,
        cc_earthquake: isCcEqEnabled
    };

    const enabledEquipment = getEnabledEquipmentList(state);
    const comboBuckets = getDashboardComboBuckets(state);

    const buildingFilter = zq.buildingFilter || 'all';
    const viewMode = zq.viewMode || 'compact';
    const isRemainingExpanded = Boolean(zq.isRemainingExpanded);
    const query = (zq.searchQuery || '').trim().toLowerCase();

    const renderContext = {
        zapLvl,
        ccZapLvl,
        eqLvl,
        ccEqLvl,
        enabledEquipment,
        enabledSpells,
        hpUnit
    };

    // Filter active and remaining combos in a single pass
    const activeCombos = [];
    let remainingComboData = null;

    for (const combo of comboBuckets) {
        const filteredDefenses = (combo.defenses || []).filter(d => {
            if (!isDefenseInSeason(d.defenseKey)) return false;
            const defObj = getDefensesData()[d.defenseKey];
            const tier = getDefenseCategoryTier(d.defenseKey, defObj);

            if (buildingFilter === 'defenses' && tier !== 1) return false;
            if (buildingFilter === 'heroes' && tier !== 2) return false;
            if (buildingFilter === 'guardians' && tier !== 3) return false;
            if (buildingFilter === 'other' && tier !== 4) return false;

            const defDisplayName = getDefenseDisplayName(d.defenseKey);
            if (query && !d.name.toLowerCase().includes(query) && !d.defenseKey.includes(query) && !defDisplayName.toLowerCase().includes(query)) return false;
            return true;
        });

        if (filteredDefenses.length === 0) continue;

        if (combo.isRemaining) {
            remainingComboData = { combo, filteredDefenses };
        } else {
            activeCombos.push({ combo, filteredDefenses });
        }
    }

    if (viewMode === 'detailed') {
        sortDetailedCombos(activeCombos);
    }

    const allActiveCounts = activeCombos.map(item => item.filteredDefenses.length);

    let comboCardsHtml = '';
    for (const { combo, filteredDefenses } of activeCombos) {
        const defGridHtml = renderComboDefensesHtml(filteredDefenses, combo, viewMode, renderContext);
        const regEqCount = combo.regEqCount !== undefined ? combo.regEqCount : combo.eqCount;
        const ccEqCount = combo.ccEqCount || 0;
        const regZapCount = combo.regZapCount !== undefined ? combo.regZapCount : combo.zapCount;
        const ccZapCount = combo.ccZapCount || 0;

        // Build badges for this combination
        const badgesHtml = [];
        const hasComboBuildings = filteredDefenses.some(d => !getDefensesData()[d.defenseKey] || getDefensesData()[d.defenseKey].category === 'building');
        const hasComboUnits = filteredDefenses.some(d => {
            const def = getDefensesData()[d.defenseKey];
            return def?.category === 'hero' || def?.category === 'guardian';
        });
        const targetScope = (hasComboBuildings && hasComboUnits) ? 'both' : (hasComboUnits ? 'troops' : 'buildings');

        // Hero Equipment badges
        if (Array.isArray(combo.equipment)) {
            for (const eqItem of combo.equipment) {
                const equip = equipmentDamageData[eqItem.id];
                if (!equip) continue;
                const eqEffectiveLevel = eqItem.level;
                const eqRawLevel = eqItem.rawLevel || eqItem.level;
                const eqName = getEquipmentDisplayName(eqItem.id);
                const lvlShortBadge = getLvlShort();
                const badgeAria = `${escapeHTML(eqName)} (${lvlShortBadge} ${eqEffectiveLevel})`;

                badgesHtml.push(`
                    <div class="calc-equip-badge"
                        data-combo-badge="equipment"
                        data-equip-id="${eqItem.id}"
                        data-equip-level="${eqEffectiveLevel}"
                        data-equip-raw-level="${eqRawLevel}"
                        role="button"
                        tabindex="0"
                        aria-label="${badgeAria}">
                        <orecalc-assets-image src="${equip.icon}" alt="${escapeHTML(equip.name)}" size="thumbnail" class="calc-equip-badge__icon"></orecalc-assets-image>
                    </div>
                `);
            }
        }

        // Regular Earthquake badge
        if (regEqCount > 0) {
            badgesHtml.push(`
                <div class="calc-spell-badge calc-spell-badge--eq"
                    data-combo-badge="earthquake"
                    data-eq-count="${regEqCount}"
                    data-eq-level="${eqLvl}"
                    data-target-scope="${targetScope}"
                    role="button"
                    tabindex="0"
                    aria-label="${regEqCount}x ${escapeHTML(translate('views.damageCalc.offense.spellEarthquake'))}">
                    <span class="calc-spell-badge__multiplier">${regEqCount}x</span>
                    <orecalc-assets-image src="/assets/spells/earthquake.png" alt="Earthquake" size="thumbnail" class="calc-spell-badge__icon"></orecalc-assets-image>
                </div>
            `);
        }

        // Donated CC Earthquake badge
        if (ccEqCount > 0) {
            badgesHtml.push(`
                <div class="calc-spell-badge calc-spell-badge--eq calc-spell-badge--cc"
                    data-combo-badge="cc_earthquake"
                    data-eq-count="${ccEqCount}"
                    data-cc-eq-level="${ccEqLvl}"
                    data-target-scope="${targetScope}"
                    role="button"
                    tabindex="0"
                    aria-label="${ccEqCount}x ${escapeHTML(ccEqName)}">
                    <span class="calc-spell-badge__multiplier">${ccEqCount}x</span>
                    <orecalc-assets-image src="/assets/spells/earthquake.png" alt="${escapeHTML(ccEqName)}" size="thumbnail" class="calc-spell-badge__icon"></orecalc-assets-image>
                </div>
            `);
        }

        // Regular Lightning badge
        if (regZapCount > 0) {
            badgesHtml.push(`
                <div class="calc-spell-badge calc-spell-badge--zap"
                    data-combo-badge="lightning"
                    data-zap-count="${regZapCount}"
                    data-zap-level="${zapLvl}"
                    role="button"
                    tabindex="0"
                    aria-label="${regZapCount}x ${escapeHTML(translate('views.damageCalc.offense.spellLightning'))}">
                    <span class="calc-spell-badge__multiplier">${regZapCount}x</span>
                    <orecalc-assets-image src="/assets/spells/lightning.png" alt="Lightning" size="thumbnail" class="calc-spell-badge__icon"></orecalc-assets-image>
                </div>
            `);
        }

        // Donated CC Lightning badge
        if (ccZapCount > 0) {
            badgesHtml.push(`
                <div class="calc-spell-badge calc-spell-badge--zap calc-spell-badge--cc"
                    data-combo-badge="cc_lightning"
                    data-zap-count="${ccZapCount}"
                    data-cc-zap-level="${ccZapLvl}"
                    role="button"
                    tabindex="0"
                    aria-label="${ccZapCount}x ${escapeHTML(ccZapName)}">
                    <span class="calc-spell-badge__multiplier">${ccZapCount}x</span>
                    <orecalc-assets-image src="/assets/spells/lightning.png" alt="${escapeHTML(ccZapName)}" size="thumbnail" class="calc-spell-badge__icon"></orecalc-assets-image>
                </div>
            `);
        }

        const recipeItemsHtml = badgesHtml.map((badge, idx) => `
            <div class="calc-combo-item">
                ${idx > 0 ? '<span class="calc-combo-plus">+</span>' : ''}
                ${badge}
            </div>
        `).join('');

        const isFullWidth = shouldComboExpandFullWidth(filteredDefenses.length, allActiveCounts, viewMode);

        comboCardsHtml += `
            <div class="calc-combo-card ${isFullWidth ? 'calc-combo-card--full-width' : ''}">
                <div class="calc-combo-card__header">
                    <div class="calc-combo-card__spells">
                        ${recipeItemsHtml}
                    </div>
                </div>
                <div class="calc-combo-card__body">
                    <div class="calc-combo-defenses-grid ${viewMode === 'compact' ? 'calc-combo-defenses-grid--compact' : ''}">
                        ${defGridHtml}
                    </div>
                </div>
            </div>
        `;
    }

    let remainingSectionHtml = '';
    if (remainingComboData) {
        const { combo, filteredDefenses } = remainingComboData;
        const remainingTitle = getRemainingTitle();
        const defGridHtml = renderComboDefensesHtml(filteredDefenses, combo, viewMode, renderContext);

        remainingSectionHtml = `
            <div class="calc-remaining-section ${isRemainingExpanded ? 'is-expanded' : ''}">
                <button type="button" class="calc-remaining-header" data-action="toggle-remaining" aria-expanded="${isRemainingExpanded}">
                    <div class="calc-remaining-header__info">
                        <orecalc-assets-svg name="shield-filled" width="16" height="16" class="calc-remaining-icon"></orecalc-assets-svg>
                        <span class="calc-remaining-title">${filteredDefenses.length} ${escapeHTML(remainingTitle)}</span>
                    </div>
                    <span class="calc-remaining-action-text">${isRemainingExpanded ? escapeHTML(translate('views.damageCalc.filters.hideDetails') || 'Hide Details') : escapeHTML(translate('views.damageCalc.filters.showDetails') || 'Show Details')}</span>
                </button>
                ${isRemainingExpanded ? `
                    <div class="calc-remaining-body">
                        <div class="calc-remaining-defenses-tray">
                            <div class="calc-combo-defenses-grid ${viewMode === 'compact' ? 'calc-combo-defenses-grid--compact' : ''}">
                                ${defGridHtml}
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    const hasEnabledSources = enabledSpells.lightning || enabledSpells.earthquake || enabledSpells.cc_lightning || enabledSpells.cc_earthquake || enabledEquipment.length > 0;

    if (!comboCardsHtml && !remainingSectionHtml) {
        if (!hasEnabledSources) {
            comboCardsHtml = `
                <div class="calc-empty-notice">
                    <p class="calc-empty-notice__text" data-i18n="views.damageCalc.offense.emptySourcesNotice">${escapeHTML(translate('views.damageCalc.offense.emptySourcesNotice'))}</p>
                </div>
            `;
        } else {
            comboCardsHtml = `
                <div class="calc-empty-notice">
                    <p class="calc-empty-notice__text" data-i18n="views.damageCalc.filters.noTargetsMatchFilter">${escapeHTML(translate('views.damageCalc.filters.noTargetsMatchFilter'))}</p>
                    <button type="button" class="btn-secondary calc-empty-notice__btn" data-action="reset-zq-filters">
                        <orecalc-assets-svg name="close" width="12" height="12"></orecalc-assets-svg>
                        <span data-i18n="views.damageCalc.filters.resetFiltersBtn">${escapeHTML(translate('views.damageCalc.filters.resetFiltersBtn'))}</span>
                    </button>
                </div>
            `;
        }
    }

    const existingLayout = typeof container.querySelector === 'function'
        ? container.querySelector('.calc-view-combos-layout')
        : null;

    if (existingLayout) {
        const tabsContainer = existingLayout.querySelector('.calc-modifier-bar__tabs-container');
        if (tabsContainer) {
            renderBattleModifierSwitcher(/** @type {HTMLElement} */ (tabsContainer), getActiveModifier(state), {
                includePercentages: true,
                customClass: 'calc-modifier-tabs'
            });
        }

        const sourcesGrid = existingLayout.querySelector('.calc-damage-sources-grid');
        if (sourcesGrid) {
            sourcesGrid.innerHTML = getDamageSourcesGridHtml(state);
        }

        const combosContainer = existingLayout.querySelector('.calc-combos-container');
        if (combosContainer) {
            combosContainer.innerHTML = comboCardsHtml;
        }

        const remainingContainer = existingLayout.querySelector('.calc-remaining-container');
        if (remainingContainer) {
            remainingContainer.innerHTML = remainingSectionHtml;
        } else if (remainingSectionHtml && combosContainer) {
            const newRemaining = document.createElement('div');
            newRemaining.className = 'calc-remaining-container';
            newRemaining.innerHTML = remainingSectionHtml;
            combosContainer.parentNode?.insertBefore(newRemaining, combosContainer.nextSibling);
        }

        const searchWrapper = existingLayout.querySelector('.calc-view-search-wrapper');
        if (searchWrapper && typeof document !== 'undefined') {
            const existingClearBtn = searchWrapper.querySelector('[data-action="clear-zq-search"]');
            if (zq.searchQuery && !existingClearBtn) {
                const clearBtn = document.createElement('button');
                clearBtn.type = 'button';
                clearBtn.className = 'calc-search-clear-btn';
                clearBtn.setAttribute('data-action', 'clear-zq-search');
                clearBtn.setAttribute('aria-label', translate('views.heroJourney.page.clearSearch'));
                clearBtn.innerHTML = '<orecalc-assets-svg name="close" width="12" height="12"></orecalc-assets-svg>';
                searchWrapper.appendChild(clearBtn);
            } else if (!zq.searchQuery && existingClearBtn) {
                existingClearBtn.remove();
            }
        }

        const searchInput = /** @type {HTMLInputElement | null} */ (existingLayout.querySelector('#zq-search-input'));
        if (searchInput && (typeof document === 'undefined' || document.activeElement !== searchInput || !zq.searchQuery)) {
            searchInput.value = zq.searchQuery || '';
        }

        const filterTabs = existingLayout.querySelectorAll?.('.calc-filter-tab[data-zq-filter]') || [];
        filterTabs.forEach(tab => {
            const filterVal = tab.getAttribute('data-zq-filter');
            const isActive = filterVal === buildingFilter;
            tab.classList?.toggle('is-active', isActive);
            tab.setAttribute?.('aria-selected', String(isActive));
        });

        const viewModeBtns = existingLayout.querySelectorAll?.('[data-zq-view-mode]') || [];
        viewModeBtns.forEach(btn => {
            const modeVal = btn.getAttribute('data-zq-view-mode');
            const isActive = modeVal === viewMode;
            btn.classList?.toggle('active', isActive);
            btn.setAttribute?.('aria-checked', String(isActive));
        });
        return;
    }

    container.innerHTML = `
        <div class="calc-tab-layout calc-view-combos-layout">
            ${getDamageSourcesCardMarkup(state)}

            <div class="calc-view-header">
                <div class="calc-view-search-wrapper">
                    <orecalc-assets-svg name="search" class="calc-search-icon" width="15" height="15" aria-hidden="true"></orecalc-assets-svg>
                    <input type="search"
                        id="zq-search-input"
                        class="calc-search-input"
                        placeholder="${escapeHTML(translate('views.damageCalc.filters.searchDefensesPlaceholder'))}"
                        value="${escapeHTML(zq.searchQuery || '')}"
                        aria-label="${escapeHTML(translate('views.damageCalc.filters.searchDefensesPlaceholder'))}"
                        autocomplete="off">
                    ${zq.searchQuery ? `
                        <button type="button" class="calc-search-clear-btn" data-action="clear-zq-search" aria-label="${escapeHTML(translate('views.heroJourney.page.clearSearch'))}">
                            <orecalc-assets-svg name="close" width="12" height="12"></orecalc-assets-svg>
                        </button>
                    ` : ''}
                </div>
                <div class="calc-view-actions">
                    <div class="calc-filter-tabs" role="tablist" aria-label="${escapeHTML(translate('views.damageCalc.filters.filterTargetsAria') || 'Filter targets')}">
                        <button type="button"
                            class="calc-filter-tab ${buildingFilter === 'all' ? 'is-active' : ''}"
                            data-zq-filter="all"
                            role="tab"
                            aria-selected="${buildingFilter === 'all'}">
                            <span data-i18n="views.heroJourney.filters.filterAll">${escapeHTML(translate('views.heroJourney.filters.filterAll') || 'All')}</span>
                        </button>
                        <button type="button"
                            class="calc-filter-tab ${buildingFilter === 'defenses' ? 'is-active' : ''}"
                            data-zq-filter="defenses"
                            role="tab"
                            aria-selected="${buildingFilter === 'defenses'}">
                            <span data-i18n="views.damageCalc.filters.filterDefenses">${escapeHTML(translate('views.damageCalc.filters.filterDefenses') || 'Defenses')}</span>
                        </button>
                        <button type="button"
                            class="calc-filter-tab ${buildingFilter === 'heroes' ? 'is-active' : ''}"
                            data-zq-filter="heroes"
                            role="tab"
                            aria-selected="${buildingFilter === 'heroes'}">
                            <span data-i18n="views.damageCalc.filters.filterHeroes">${escapeHTML(translate('views.damageCalc.filters.filterHeroes') || 'Heroes')}</span>
                        </button>
                        <button type="button"
                            class="calc-filter-tab ${buildingFilter === 'guardians' ? 'is-active' : ''}"
                            data-zq-filter="guardians"
                            role="tab"
                            aria-selected="${buildingFilter === 'guardians'}">
                            <span data-i18n="views.damageCalc.filters.filterGuardians">${escapeHTML(translate('views.damageCalc.filters.filterGuardians') || 'Guardians')}</span>
                        </button>
                        <button type="button"
                            class="calc-filter-tab ${buildingFilter === 'other' ? 'is-active' : ''}"
                            data-zq-filter="other"
                            role="tab"
                            aria-selected="${buildingFilter === 'other'}">
                            <span data-i18n="views.damageCalc.filters.filterOther">${escapeHTML(translate('views.damageCalc.filters.filterOther') || 'Other')}</span>
                        </button>
                    </div>
                    <div class="calc-view-mode-switch segmented-control" role="radiogroup" aria-label="${escapeHTML(translate('views.damageCalc.zapQuake.viewMode') || 'View Mode')}">
                        <button type="button"
                            class="segmented-btn ${viewMode === 'compact' ? 'active' : ''}"
                            data-zq-view-mode="compact"
                            role="radio"
                            aria-checked="${viewMode === 'compact'}">
                            <span data-i18n="views.settings.options.layoutCompactLabel">${escapeHTML(translate('views.settings.options.layoutCompactLabel') || 'Compact')}</span>
                        </button>
                        <button type="button"
                            class="segmented-btn ${viewMode === 'detailed' ? 'active' : ''}"
                            data-zq-view-mode="detailed"
                            role="radio"
                            aria-checked="${viewMode === 'detailed'}">
                            <span data-i18n="views.damageCalc.zapQuake.viewModeDetailed">${escapeHTML(translate('views.damageCalc.zapQuake.viewModeDetailed') || 'Detailed')}</span>
                        </button>
                    </div>
                </div>
            </div>

            <div class="calc-combos-container">
                ${comboCardsHtml}
            </div>
            <div class="calc-remaining-container">
                ${remainingSectionHtml}
            </div>
        </div>
    `;
}
