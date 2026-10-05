/**
 * DOM Rendering Engine for Damage Calculator Building Selection Grid & Cluster Toolbar.
 * Tier 4: UI Presentation (Dedicated exclusively to building grid DOM rendering, 0 event listeners).
 */

import { getDefensesData } from '../../data/defenseTargetsData.js';
import { getBuildingAssetUrl } from '../../core/buildingAssetHelper.js';
import {
    getMaxSuperchargeTier,
    getDefaultSuperchargeTier,
    isDefenseInSeason,
    getBuildingGroupId,
    getDefenseCategoryTier,
    getMaxDefenseLevelForTownHall
} from '../../domain/damage/defenseProgressionDomain.js';
import { translate } from '../../i18n/translator.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { getDefenseDisplayName } from '../../utils/equipmentMetadata.js';
import {
    getLvlShort,
    renderSuperchargePipsHtml
} from './damageCalcDisplay.js';

/**
 * Canonical building category groupings for visual filtering.
 * all is lazily resolved on first access so the fetch cache is guaranteed populated.
 */
let _defenseGroupsAll = null;
const DEFENSE_GROUPS = Object.freeze({
    get all() {
        if (!_defenseGroupsAll) _defenseGroupsAll = Object.freeze(Object.keys(getDefensesData()));
        return _defenseGroupsAll;
    },
    fortifications: Object.freeze([
        'gold_storage',
        'elixir_storage', 'dark_elixir_storage'
    ])
});

/**
 * Generates only the card HTML for a building selection grid (no wrappers).
 * Used by renderBuildingSelectionGrid and targeted search update paths.
 *
 * @param {Object} options
 * @param {string} [options.activeKey]
 * @param {number} [options.activeLevel]
 * @param {string} [options.searchQuery='']
 * @param {Array} [options.selectedCluster=[]]
 * @param {boolean} [options.multiSelectMode=false]
 * @param {string} [options.prefix='zq']
 * @param {string} [options.buildingFilter='all']
 * @param {boolean} [options.excludeFortifications=false]
 * @param {number|null} [options.townHallLevel=null]
 * @param {number} [options.superchargeTier=2]
 * @param {Date|string|number} [options.referenceDate]
 * @param {Object | null} [options.enabledBuildingGroups=null] - Group visibility states.
 * @param {Object | null} [options.defenseLevelOverrides=null] - Per-building level overrides from state.
 * @param {Object | null} [options.defenseSuperchargeOverrides=null] - Per-building supercharge overrides from state.
 * @returns {string} HTML string of card buttons only.
 */
export function renderBuildingGridCardsHtml({
    activeKey,
    activeLevel,
    searchQuery = '',
    selectedCluster = [],
    multiSelectMode = false,
    prefix = 'zq',
    buildingFilter = 'all',
    excludeFortifications = false,
    townHallLevel = null,
    superchargeTier = 2,
    referenceDate = new Date(),
    enabledBuildingGroups = null,
    defenseLevelOverrides = null,
    defenseSuperchargeOverrides = null
}) {
    const buildingList = DEFENSE_GROUPS.all;
    const query = (searchQuery || '').trim().toLowerCase();

    let cardsHtml = '';
    for (const k of buildingList) {
        const d = getDefensesData()[k];
        if (!d) continue;
        if (!isDefenseInSeason(d, referenceDate)) continue;

        const info = townHallLevel != null ? getMaxDefenseLevelForTownHall(k, townHallLevel) : { level: d.maxLevel, status: 'available' };
        const isUnavailable = info.status === 'locked' || info.status === 'sunset';

        if (enabledBuildingGroups) {
            const groupId = getBuildingGroupId(k, townHallLevel != null ? townHallLevel : 18);
            // Defenses invariant: defenses group is always enabled
            const isGroupEnabled = groupId === 'defenses'
                ? true
                : (enabledBuildingGroups[groupId] !== undefined ? Boolean(enabledBuildingGroups[groupId]) : (groupId !== 'unavailable'));
            if (!isGroupEnabled) continue;
        } else if (townHallLevel != null) {
            if (d.minTH && townHallLevel < d.minTH) continue;
            if ('maxTH' in d && typeof d.maxTH === 'number' && townHallLevel > d.maxTH) continue;
        }
        const tier = getDefenseCategoryTier(k, d);
        const isDefense = tier === 1;
        const isHero = tier === 2;
        const isGuardian = tier === 3;
        const isOther = tier === 4;

        if (buildingFilter === 'defenses' && !isDefense) continue;
        if (buildingFilter === 'heroes' && !isHero) continue;
        if (buildingFilter === 'guardians' && !isGuardian) continue;
        if (buildingFilter === 'other' && !isOther) continue;
        if (excludeFortifications && isOther) continue;

        const defDisplayName = getDefenseDisplayName(k);
        if (query && !k.toLowerCase().includes(query) && !defDisplayName.toLowerCase().includes(query)) {
            continue;
        }

        const availableLevels = Object.entries(d.levels)
            .filter(([_, lvlData]) => !townHallLevel || (lvlData.th && lvlData.th <= townHallLevel))
            .map(([lvl]) => Number(lvl));
        const maxLvl = isUnavailable
            ? (info.status === 'locked' ? 1 : (d.maxLevel || 1))
            : (availableLevels.length > 0 ? Math.max(...availableLevels) : (d.maxLevel || 1));
        const clusterIndex = multiSelectMode ? selectedCluster.findIndex(t => t.defenseKey === k) : -1;
        const isInCluster = multiSelectMode && clusterIndex !== -1;
        const cardLevel = isInCluster
            ? (selectedCluster[clusterIndex]?.level ?? maxLvl)
            : ((k === activeKey) ? activeLevel : (defenseLevelOverrides?.[k] ?? maxLvl));
        const isSelected = (k === activeKey);
        const isCrafted = d.subCategory === 'crafted';
        const defaultCardTier = getDefaultSuperchargeTier(k, cardLevel, townHallLevel != null ? townHallLevel : 18);
        const maxSc = getMaxSuperchargeTier(k, cardLevel);
        const effectiveGlobalSc = superchargeTier !== undefined ? Math.min(superchargeTier, maxSc) : defaultCardTier;
        const cardSupercharge = isSelected
            ? (superchargeTier !== undefined ? Math.min(superchargeTier, maxSc) : defaultCardTier)
            : (isInCluster
                ? (selectedCluster[clusterIndex]?.superchargeTier ?? defaultCardTier)
                : (defenseSuperchargeOverrides?.[k] !== undefined ? defenseSuperchargeOverrides[k] : effectiveGlobalSc));

        cardsHtml += `
            <button type="button"
                class="calc-building-card ${isSelected ? 'is-selected' : ''} ${isInCluster ? 'is-in-cluster' : ''}"
                data-prefix="${prefix}"
                data-building-key="${k}"
                role="listitem"
                aria-pressed="${isSelected}"
                aria-label="${escapeHTML(defDisplayName)} (${getLvlShort(d)} ${cardLevel})"
                title="${escapeHTML(defDisplayName)}">
                <div class="calc-building-card__img-wrapper">
                    <orecalc-assets-image
                        src="${getBuildingAssetUrl(k, cardLevel)}"
                        alt="${escapeHTML(defDisplayName)}"
                        class="calc-building-card__img"
                        size="standard">
                    </orecalc-assets-image>
                    ${isInCluster ? `<span class="calc-building-card__cluster-badge">${clusterIndex + 1}</span>` : ''}
                    ${isCrafted ? `
                        <span class="calc-building-card__seasonal-badge" title="${escapeHTML(translate('views.damageCalc.filters.craftedDefenseTooltip'))}">
                            <orecalc-assets-svg name="timer" width="14" height="14"></orecalc-assets-svg>
                        </span>
                    ` : ''}
                </div>
                <div class="calc-building-card__info">
                    <span class="calc-building-card__level">
                        ${getLvlShort(d)} ${cardLevel}
                        ${cardSupercharge > 0 ? ` ${renderSuperchargePipsHtml(cardSupercharge, getMaxSuperchargeTier(k, cardLevel), { variant: 'compact' })}` : ''}
                    </span>
                </div>
            </button>
        `;
    }
    return cardsHtml;
}

/**
 * Renders the Visual Building Selection Grid with Category Filtering.
 *
 * @param {Object} options
 * @param {string} options.activeKey - Currently active building key.
 * @param {number} options.activeLevel - Level of active building.
 * @param {string} [options.searchQuery=''] - Search query string.
 * @param {Array<{ defenseKey: string, level: number, superchargeTier?: number }>} [options.selectedCluster=[]] - Active cluster.
 * @param {boolean} [options.multiSelectMode=false] - Whether multi-select cluster mode is active.
 * @param {string} [options.prefix='zq'] - Unique prefix ('zq', 'eq', 'sim').
 * @param {'all' | 'defenses' | 'heroes' | 'guardians' | 'other'} [options.buildingFilter='all'] - Active category filter.
 * @param {boolean} [options.excludeFortifications=false] - Exclude storages/fortifications.
 * @param {number | null} [options.townHallLevel=null] - Optional player Town Hall for lifecycle filtering.
 * @param {number} [options.superchargeTier=2] - Active supercharge tier for currently selected defense.
 * @param {Date|string|number} [options.referenceDate=new Date()] - Reference date for seasonal filtering.
 * @param {boolean} [options.showClusterToggle=false] - Whether to render inline cluster toggle switch.
 * @param {Object | null} [options.enabledBuildingGroups=null] - Group visibility states.
 * @param {Object | null} [options.defenseLevelOverrides=null] - Per-building level overrides from state.
 * @param {Object | null} [options.defenseSuperchargeOverrides=null] - Per-building supercharge overrides from state.
 * @returns {string} HTML string.
 */
export function renderBuildingSelectionGrid({
    activeKey,
    activeLevel,
    searchQuery = '',
    selectedCluster = [],
    multiSelectMode = false,
    prefix = 'zq',
    buildingFilter = 'all',
    excludeFortifications = false,
    townHallLevel = null,
    superchargeTier = 2,
    referenceDate = new Date(),
    showClusterToggle = false,
    enabledBuildingGroups = null,
    defenseLevelOverrides = null,
    defenseSuperchargeOverrides = null
}) {
    const isZapQuakeTab = prefix === 'zq';

    const cardsHtml = renderBuildingGridCardsHtml({
        activeKey,
        activeLevel,
        searchQuery,
        selectedCluster,
        multiSelectMode,
        prefix,
        buildingFilter,
        excludeFortifications,
        townHallLevel,
        superchargeTier,
        referenceDate,
        enabledBuildingGroups,
        defenseLevelOverrides,
        defenseSuperchargeOverrides
    });

    let clusterToolbarHtml = '';
    if (isZapQuakeTab && multiSelectMode) {
        let chipItemsHtml = '';
        selectedCluster.forEach((target, idx) => {
            const defName = getDefenseDisplayName(target.defenseKey);
            const isTargetActive = target.defenseKey === activeKey ? 'is-active-target' : '';
            const cardSupercharge = target.superchargeTier || 0;
            const superchargeHtml = cardSupercharge > 0
                ? `<span class="calc-cluster-chip__supercharge" title="${escapeHTML(translate('views.damageCalc.offense.superchargeLabel'))} &middot; ${escapeHTML(translate('views.damageCalc.zapQuake.tierLabel', { tier: cardSupercharge }))}">${renderSuperchargePipsHtml(cardSupercharge, getMaxSuperchargeTier(target.defenseKey, target.level), { variant: 'compact' })}</span>`
                : '';
            const thumbUrl = getBuildingAssetUrl(target.defenseKey, target.level);

            chipItemsHtml += `
                <div class="calc-cluster-chip ${isTargetActive}" data-cluster-index="${idx}" title="${escapeHTML(defName)} (${getLvlShort(target.defenseKey)} ${target.level})">
                    <span class="calc-cluster-chip__index">#${idx + 1}</span>
                    <orecalc-assets-image src="${thumbUrl}" alt="${escapeHTML(defName)}" size="thumbnail" class="calc-cluster-chip__thumb"></orecalc-assets-image>
                    <span class="calc-cluster-chip__level">${getLvlShort(target.defenseKey)} ${target.level}</span>
                    ${superchargeHtml}
                    <button type="button" class="calc-cluster-chip__remove" data-cluster-remove="${idx}" aria-label="${escapeHTML(translate('actions.remove'))}: ${escapeHTML(defName)}">
                        <orecalc-assets-svg name="close" width="10" height="10"></orecalc-assets-svg>
                    </button>
                </div>
            `;
        });

        if (selectedCluster.length === 0) {
            chipItemsHtml = `
                <div class="calc-cluster-toolbar__empty-hint">
                    <span class="calc-cluster-toolbar__empty-prompt">
                        <orecalc-assets-svg name="plus" width="12" height="12" class="calc-cluster-toolbar__empty-icon"></orecalc-assets-svg>
                        <span data-i18n="views.damageCalc.clusterPlanner.clusterEmptyToolbarPrompt">${escapeHTML(translate('views.damageCalc.clusterPlanner.clusterEmptyToolbarPrompt') || 'Select defenses below to add to cluster (min. 2, max. 5)')}</span>
                    </span>
                    <div class="calc-cluster-ghost-slots" aria-hidden="true">
                        <span class="calc-cluster-ghost-slot is-required" title="${escapeHTML(translate('views.damageCalc.clusterPlanner.targetSlotTitle', { number: 1 }))}" data-i18n-title="views.damageCalc.clusterPlanner.targetSlotTitle" data-i18n-title-args='{"number":1}'>1</span>
                        <span class="calc-cluster-ghost-slot is-required" title="${escapeHTML(translate('views.damageCalc.clusterPlanner.targetSlotTitle', { number: 2 }))}" data-i18n-title="views.damageCalc.clusterPlanner.targetSlotTitle" data-i18n-title-args='{"number":2}'>2</span>
                        <span class="calc-cluster-ghost-slot" title="${escapeHTML(translate('views.damageCalc.clusterPlanner.targetSlotTitle', { number: 3 }))}" data-i18n-title="views.damageCalc.clusterPlanner.targetSlotTitle" data-i18n-title-args='{"number":3}'>3</span>
                        <span class="calc-cluster-ghost-slot" title="${escapeHTML(translate('views.damageCalc.clusterPlanner.targetSlotTitle', { number: 4 }))}" data-i18n-title="views.damageCalc.clusterPlanner.targetSlotTitle" data-i18n-title-args='{"number":4}'>4</span>
                        <span class="calc-cluster-ghost-slot" title="${escapeHTML(translate('views.damageCalc.clusterPlanner.targetSlotTitle', { number: 5 }))}" data-i18n-title="views.damageCalc.clusterPlanner.targetSlotTitle" data-i18n-title-args='{"number":5}'>5</span>
                    </div>
                </div>
            `;
        }

        const isMax = selectedCluster.length >= 5;
        const countBadge = `<span class="calc-cluster-toolbar__separator">&middot;</span><span class="${isMax ? 'calc-cluster-counter is-max' : 'calc-cluster-counter'}">${selectedCluster.length}/5${isMax ? ` &middot; ${escapeHTML(translate('validation.max') || 'MAX')}` : ''}</span>`;

        const clearBtnHtml = selectedCluster.length > 0
            ? `<button type="button" id="zq-cluster-clear" class="btn-text calc-cluster-clear-btn"><span data-i18n="views.damageCalc.clusterPlanner.clearSelectionBtn">${escapeHTML(translate('views.damageCalc.clusterPlanner.clearSelectionBtn') || 'Clear Selection')}</span></button>`
            : '';

        const noticeHtml = selectedCluster.length >= 2
            ? `<div class="calc-cluster-notice">
                <orecalc-assets-image src="/assets/spells/earthquake.png" alt="${escapeHTML(translate('views.damageCalc.offense.spellEarthquake'))}" data-i18n-alt="views.damageCalc.offense.spellEarthquake" size="thumbnail" class="calc-cluster-notice__icon"></orecalc-assets-image>
                <span data-i18n="views.damageCalc.clusterPlanner.clusterSharedNotice">${escapeHTML(translate('views.damageCalc.clusterPlanner.clusterSharedNotice') || 'Shared Earthquake damage applied across cluster')}</span>
            </div>`
            : '';

        clusterToolbarHtml = `
            <div class="calc-cluster-toolbar${selectedCluster.length === 0 ? ' is-empty' : ''}">
                <div class="calc-cluster-toolbar__header">
                    <span class="calc-cluster-toolbar__title">
                        <orecalc-assets-svg name="swords-filled" width="16" height="16"></orecalc-assets-svg>
                        <span data-i18n="views.damageCalc.clusterPlanner.clusterTitle">${escapeHTML(translate('views.damageCalc.clusterPlanner.clusterTitle') || 'Target Cluster')}</span>
                        ${countBadge}
                    </span>
                    ${clearBtnHtml}
                </div>
                <div class="calc-cluster-chips-list">
                    ${chipItemsHtml}
                </div>
                ${noticeHtml}
            </div>
        `;
    }

    const clusterToggleHtml = (isZapQuakeTab && showClusterToggle) ? `
        <div class="calc-cluster-toggle-bar">
            <button type="button"
                id="zq-multi-toggle"
                class="calc-cluster-switch ${multiSelectMode ? 'is-active' : ''}"
                role="switch"
                aria-checked="${multiSelectMode}">
                <span class="calc-cluster-switch__track">
                    <span class="calc-cluster-switch__thumb"></span>
                </span>
                <span class="calc-cluster-switch__text">
                    <span class="calc-cluster-switch__title" data-i18n="views.damageCalc.clusterPlanner.clusterModeToggle">${escapeHTML(translate('views.damageCalc.clusterPlanner.clusterModeToggle'))}</span>
                </span>
            </button>
            <button type="button" class="calc-info-btn" data-calc-info="cluster" aria-label="${escapeHTML(translate('actions.showInfo'))}" data-i18n-aria-label="actions.showInfo">
                <orecalc-assets-svg name="info" width="14" height="14"></orecalc-assets-svg>
            </button>
            ${multiSelectMode && selectedCluster.length > 1 ? `
                <span class="calc-multi-counter-pill">${selectedCluster.length} Defenses</span>
            ` : ''}
        </div>
    ` : '';

    return `
        <div class="calc-selector-container">
            ${clusterToggleHtml}
            ${clusterToolbarHtml}

            <div class="calc-building-grid${!cardsHtml ? ' calc-building-grid--empty' : ''}" role="list">
                ${cardsHtml || `
                    <div class="calc-empty-notice">
                        <p class="calc-empty-notice__text" data-i18n="views.damageCalc.filters.noTargetsMatchFilter">
                            ${escapeHTML(translate('views.damageCalc.filters.noTargetsMatchFilter'))}
                        </p>
                        <button type="button" class="btn-secondary calc-empty-notice__btn" data-action="reset-cluster-filters">
                            <orecalc-assets-svg name="close" width="12" height="12"></orecalc-assets-svg>
                            <span data-i18n="views.damageCalc.filters.resetFiltersBtn">${escapeHTML(translate('views.damageCalc.filters.resetFiltersBtn'))}</span>
                        </button>
                    </div>
                `}
            </div>
        </div>
    `;
}
