/**
 * DOM Rendering Engine for Dedicated Cluster Planner view (Multi-Defense Spatial & Shared Lightning Math).
 * Tier 4: UI Presentation (Dedicated exclusively to DOM rendering, 0 event listeners).
 */

import { getDefensesData } from '../../data/defenseTargetsData.js';
import { equipmentDamageData } from '../../data/equipmentDamageData.js';
import { getBuildingAssetUrl } from '../../core/buildingAssetHelper.js';
import { solveClusteredZapQuake } from '../../domain/damage/zapQuakeBatchSolver.js';
import { getEffectiveEquipmentLevel } from '../../domain/damage/damageFormulas.js';
import {
    getMaxSuperchargeTier,
    getMaxDefenseLevelForTownHall
} from '../../domain/damage/defenseProgressionDomain.js';
import {
    renderMobileSpellDockHtml,
    getSuggestedNeighborsForDefense,
    renderClusterPresetsHtml,
    renderClusterWorkflowHtml
} from './damageCalcClusterWidgetsDisplay.js';
import { translate } from '../../i18n/translator.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { getActiveModifier, getShownTownHall, getGlobalSuperchargeTier } from './damageCalcState.js';
import {
    getDefenseDisplayName
} from '../../utils/equipmentMetadata.js';
import {
    renderSuperchargePipsHtml
} from './damageCalcDisplay.js';
import {
    renderBuildingSelectionGrid,
    renderBuildingGridCardsHtml
} from './damageCalcBuildingGridDisplay.js';
import {
    getDamageSourcesCardMarkup,
    getDamageSourcesGridHtml
} from './damageCalcSourcesDisplay.js';
import { renderClusterTargetCardsHtml } from './damageCalcClusterTargetCardsDisplay.js';
import { renderClusterSolutionCardHtml } from './damageCalcClusterSolutionDisplay.js';

/**
 * Renders the Dedicated Cluster Planner view (Visual Grid + Multi-Defense Cluster Inspection).
 *
 * @param {Object} state - Damage calculator state.
 * @param {HTMLElement} container - Target DOM container.
 */
export function renderDefenseBoardPanel(state, container) {
    if (!container) return;

    const zq = state.zapQuake;
    const buildingFilter = zq.buildingFilter || 'all';
    const spells = state.offense?.spells || { lightning: 13, earthquake: 8 };
    const zapLvl = spells.lightning || zq.lightningLevel || 13;
    const eqLvl = spells.earthquake || zq.earthquakeLevel || 8;

    const activeTh = getShownTownHall(state);
    let currentDefense = getDefensesData()[zq.defenseKey];
    if (!currentDefense || (currentDefense.minTH && activeTh < currentDefense.minTH) || (currentDefense.maxTH && activeTh > currentDefense.maxTH)) {
        zq.defenseKey = 'air_defense';
        currentDefense = getDefensesData().air_defense;
    }
    const maxLvl = currentDefense.maxLevel || 1;
    const defaultLevel = state.defenseLevelOverrides?.[zq.defenseKey] || maxLvl;
    const currentLvl = Math.min(zq.defenseLevel || defaultLevel, maxLvl);

    const ccSpellsState = state.offense?.ccSpells || { lightning: 13, earthquake: 8 };
    const ccZapLvl = ccSpellsState.lightning || 13;
    const ccEqLvl = ccSpellsState.earthquake || 8;
    const isCcZapEnabled = state.offense?.enabledSources?.cc_lightning !== false;
    const isCcEqEnabled = state.offense?.enabledSources?.cc_earthquake !== false;

    // Cluster mode is invariant for Tab 2
    zq.multiSelectMode = true;

    // Cluster targets from state — resolve levels from overrides at render-time (no state mutation)
    const overrides = state.defenseLevelOverrides || {};
    let clusterTargets = Array.isArray(zq.selectedCluster)
        ? zq.selectedCluster.map(t => {
            const override = overrides[t.defenseKey];
            return override !== undefined && override !== t.level ? { ...t, level: override } : t;
        })
        : [];

    let resultsCardHtml = '';
    let mobileDockHtml = '';
    let mobileDockRecipeHtml = '';
    let mobileDockDrawerHtml = '';

    if (clusterTargets.length >= 2) {
        const activeEquipKeys = Array.isArray(zq.clusterEquipment) ? zq.clusterEquipment : [];
        const activeEquipSharing = (zq.clusterEquipmentSharing && typeof zq.clusterEquipmentSharing === 'object')
            ? zq.clusterEquipmentSharing
            : {};

        const resolvedClusterEquipment = activeEquipKeys.map(key => {
            const equip = equipmentDamageData[key];
            const defaultLvl = equip?.rarity === 'epic' ? 27 : 18;
            const rawLvl = state.offense?.equipment?.[key] || defaultLvl;
            const effectiveLvl = getEffectiveEquipmentLevel(key, rawLvl, getActiveModifier(state));
            return {
                id: key,
                level: effectiveLvl,
                rawLevel: rawLvl,
                targetIndices: Array.isArray(activeEquipSharing[key]) ? activeEquipSharing[key] : null
            };
        });

        const clusterSolution = solveClusteredZapQuake(clusterTargets, zapLvl, eqLvl, {
            townHallLevel: activeTh,
            adjacentPairs: zq.adjacentPairs || [],
            clusterEquipment: resolvedClusterEquipment,
            ccSpells: {
                lightning: isCcZapEnabled ? ccZapLvl : null,
                earthquake: isCcEqEnabled ? ccEqLvl : null
            }
        });

        const combinations = clusterSolution.combinations || [];
        const selectedIdx = Math.max(0, Math.min(zq.selectedClusterComboIndex || 0, Math.max(0, combinations.length - 1)));
        const activeCombo = combinations[selectedIdx] || clusterSolution.optimalCombination || clusterSolution;

        const activePairs = new Set(
            (zq.adjacentPairs || []).map(p => Array.isArray(p) ? `${p[0]}-${p[1]}` : String(p))
        );

        const targetCardsHtml = renderClusterTargetCardsHtml({
            activeCombo,
            clusterTargets,
            activePairs,
            zapLvl,
            eqLvl,
            ccZapLvl,
            ccEqLvl,
            isCcZapEnabled
        });

        const solutionResult = renderClusterSolutionCardHtml({
            activeCombo,
            clusterSolution,
            clusterTargets,
            resolvedClusterEquipment,
            activeEquipKeys,
            activeEquipSharing,
            state,
            eqLvl,
            zapLvl,
            combinations,
            selectedIdx,
            targetCardsHtml
        });

        resultsCardHtml = solutionResult.resultsCardHtml;
        mobileDockRecipeHtml = solutionResult.mobileDockRecipeHtml;
        mobileDockDrawerHtml = solutionResult.mobileDockDrawerHtml;

        mobileDockHtml = renderMobileSpellDockHtml({
            isCluster: true,
            clusterTargets,
            isClusterDestroyed: solutionResult.isClusterDestroyed,
            targetName: `${escapeHTML(translate('views.damageCalc.clusterPlanner.clusterTitle') || 'Cluster')} (${clusterTargets.length})`,
            targetThumb: getBuildingAssetUrl(clusterTargets[0]?.defenseKey || 'monolith', clusterTargets[0]?.level || 1),
            targetLevel: `${clusterTargets.length} ${escapeHTML(translate('entities.stats.targets') || 'Targets')}`,
            recipeBadgesHtml: mobileDockRecipeHtml,
            eqCount: activeCombo.sharedEqCount,
            zapCount: activeCombo.totalZaps,
            totalHousing: solutionResult.isOverCapacity ? `${activeCombo.totalHousingSpace} / ${solutionResult.maxArmyCapacity}` : activeCombo.totalHousingSpace,
            isOverCapacity: solutionResult.isOverCapacity && solutionResult.isClusterDestroyed,
            maxArmyCapacity: solutionResult.maxArmyCapacity,
            isExpanded: Boolean(zq.mobileDockExpanded),
            drawerContentHtml: mobileDockDrawerHtml
        });
    } else if (clusterTargets.length === 1) {
        const singleTgt = clusterTargets[0];
        const singleDefName = getDefenseDisplayName(singleTgt.defenseKey);
        const singleDefLvl = singleTgt.level;
        const singleThumb = getBuildingAssetUrl(singleTgt.defenseKey, singleDefLvl);
        const singleSupercharge = singleTgt.superchargeTier || 0;
        const singlePromptText = escapeHTML(translate('views.damageCalc.clusterPlanner.clusterPromptSingle', { name: singleDefName }) || 'Add at least 1 neighboring target to calculate shared spells and equipment.');
        const singleProgressText = escapeHTML(translate('views.damageCalc.clusterPlanner.clusterSingleProgress') || '1 of 2 Minimum Targets Selected');
        const selectNextText = escapeHTML(translate('views.damageCalc.clusterPlanner.clusterSelectNextTarget') || 'Select Target #2');
        const suggestedLabelText = escapeHTML(translate('views.damageCalc.clusterPlanner.clusterSuggestedNeighbors') || 'Suggested Neighbors');

        const suggestedKeys = getSuggestedNeighborsForDefense(singleTgt.defenseKey, activeTh);
        const suggestedChipsHtml = suggestedKeys.map(k => {
            const def = getDefensesData()[k];
            const name = getDefenseDisplayName(k);
            const maxThLvl = getMaxDefenseLevelForTownHall(k, activeTh).level;
            const lvl = maxThLvl > 0 ? maxThLvl : (def?.maxLevel || 1);
            const thumb = getBuildingAssetUrl(k, lvl);
            return `
                <button type="button" class="calc-cluster-suggest-btn" data-action="add-cluster-neighbor" data-target-key="${k}" title="${escapeHTML(name)}">
                    <orecalc-assets-image src="${thumb}" alt="${escapeHTML(name)}" size="thumbnail"></orecalc-assets-image>
                    <span>+ ${escapeHTML(name)}</span>
                </button>
            `;
        }).join('');

        resultsCardHtml = `
            <div class="calc-card calc-card--results calc-cluster-placeholder">
                <div class="calc-cluster-placeholder__content">
                    <div class="calc-cluster-single-header">
                        <span class="calc-cluster-single-progress" data-i18n="views.damageCalc.clusterPlanner.clusterSingleProgress">${singleProgressText}</span>
                    </div>
                    <div class="cluster-pair-preview">
                        <div class="cluster-target-card cluster-target-card--preview">
                            <div class="cluster-target-card__header">
                                <div class="cluster-target-card__identity">
                                    <span class="cluster-target-card__index">#1</span>
                                    <orecalc-assets-image
                                        src="${singleThumb}"
                                        alt="${escapeHTML(singleDefName)}"
                                        class="cluster-target-card__thumb"
                                        size="thumbnail">
                                    </orecalc-assets-image>
                                    <div class="cluster-target-card__meta">
                                        <span class="cluster-target-card__name">${escapeHTML(singleDefName)}</span>
                                        <span class="cluster-target-card__level">
                                            Lvl ${singleDefLvl}
                                            ${singleSupercharge > 0 ? `
                                                <span class="cluster-target-card__supercharge" title="${escapeHTML(translate('views.damageCalc.offense.superchargeLabel'))} &middot; ${escapeHTML(translate('views.damageCalc.zapQuake.tierLabel', { tier: singleSupercharge }))}">
                                                    ${renderSuperchargePipsHtml(singleSupercharge, getMaxSuperchargeTier(singleTgt.defenseKey, singleDefLvl), { variant: 'compact' })}
                                                </span>
                                            ` : ''}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="cluster-pair-connector">
                            <orecalc-assets-svg name="link" width="14" height="14"></orecalc-assets-svg>
                        </div>
                        <div class="cluster-target-card cluster-target-card--waiting">
                            <div class="cluster-target-card__waiting-inner">
                                <orecalc-assets-svg name="plus" width="16" height="16"></orecalc-assets-svg>
                                <span data-i18n="views.damageCalc.clusterPlanner.clusterSelectNextTarget">${selectNextText}</span>
                            </div>
                        </div>
                    </div>
                    <p class="calc-cluster-placeholder__hint">${singlePromptText}</p>
                    ${suggestedChipsHtml ? `
                        <div class="calc-cluster-suggestions">
                            <span class="calc-cluster-suggestions__label" data-i18n="views.damageCalc.clusterPlanner.clusterSuggestedNeighbors">${suggestedLabelText}</span>
                            <div class="calc-cluster-suggestions__list">
                                ${suggestedChipsHtml}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    } else {
        const clusterTitleText = escapeHTML(translate('views.damageCalc.clusterPlanner.clusterTitle') || 'Target Cluster');
        const emptyPromptText = escapeHTML(translate('views.damageCalc.clusterPlanner.clusterPromptEmpty') || 'Plan shared Earthquakes, shared Lightning, and Hero Equipment across 2–5 neighboring targets to minimize total spell housing space.');

        resultsCardHtml = `
            <div class="calc-card calc-card--results calc-cluster-placeholder">
                <div class="calc-cluster-placeholder__content">
                    <div class="calc-cluster-hero">
                        <div class="calc-cluster-hero__badge">
                            <orecalc-assets-svg name="bolt-planner" width="32" height="32"></orecalc-assets-svg>
                        </div>
                        <div class="calc-cluster-hero__header">
                            <h3 class="calc-cluster-hero__title">
                                <span data-i18n="views.damageCalc.clusterPlanner.clusterTitle">${clusterTitleText}</span>
                                <button type="button" class="calc-info-btn" data-calc-info="cluster" aria-label="${escapeHTML(translate('actions.showInfo'))}" data-i18n-aria-label="actions.showInfo">
                                    <orecalc-assets-svg name="info" width="14" height="14"></orecalc-assets-svg>
                                </button>
                            </h3>
                            <p class="calc-cluster-hero__subtitle" data-i18n="views.damageCalc.clusterPlanner.clusterPromptEmpty">${emptyPromptText}</p>
                        </div>
                    </div>

                    ${renderClusterPresetsHtml(activeTh)}

                    ${renderClusterWorkflowHtml()}
                </div>
            </div>
        `;
    }

    const inputsCardHtml = `
        <div class="calc-card calc-card--inputs">
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
                <div class="calc-filter-tabs" role="tablist" aria-label="${escapeHTML(translate('views.damageCalc.filters.filterTargetsAria') || 'Filter targets')}">
                    <button type="button" class="calc-filter-tab ${buildingFilter === 'all' ? 'is-active' : ''}" data-zq-filter="all" role="tab" aria-selected="${buildingFilter === 'all'}">
                        <span data-i18n="views.heroJourney.filters.filterAll">${escapeHTML(translate('views.heroJourney.filters.filterAll') || 'All')}</span>
                    </button>
                    <button type="button" class="calc-filter-tab ${buildingFilter === 'defenses' ? 'is-active' : ''}" data-zq-filter="defenses" role="tab" aria-selected="${buildingFilter === 'defenses'}">
                        <span data-i18n="views.damageCalc.filters.filterDefenses">${escapeHTML(translate('views.damageCalc.filters.filterDefenses') || 'Defenses')}</span>
                    </button>
                    <button type="button" class="calc-filter-tab ${buildingFilter === 'heroes' ? 'is-active' : ''}" data-zq-filter="heroes" role="tab" aria-selected="${buildingFilter === 'heroes'}">
                        <span data-i18n="views.damageCalc.filters.filterHeroes">${escapeHTML(translate('views.damageCalc.filters.filterHeroes') || 'Heroes')}</span>
                    </button>
                    <button type="button" class="calc-filter-tab ${buildingFilter === 'guardians' ? 'is-active' : ''}" data-zq-filter="guardians" role="tab" aria-selected="${buildingFilter === 'guardians'}">
                        <span data-i18n="views.damageCalc.filters.filterGuardians">${escapeHTML(translate('views.damageCalc.filters.filterGuardians') || 'Guardians')}</span>
                    </button>
                    <button type="button" class="calc-filter-tab ${buildingFilter === 'other' ? 'is-active' : ''}" data-zq-filter="other" role="tab" aria-selected="${buildingFilter === 'other'}">
                        <span data-i18n="views.damageCalc.filters.filterOther">${escapeHTML(translate('views.damageCalc.filters.filterOther') || 'Other')}</span>
                    </button>
                </div>
            </div>

            ${renderBuildingSelectionGrid({
                activeKey: clusterTargets[0]?.defenseKey || zq.defenseKey,
                activeLevel: clusterTargets[0]?.level || currentLvl,
                searchQuery: zq.searchQuery || '',
                selectedCluster: clusterTargets,
                multiSelectMode: true,
                prefix: 'zq',
                buildingFilter,
                townHallLevel: activeTh,
                superchargeTier: getGlobalSuperchargeTier(state),
                enabledBuildingGroups: state.enabledBuildingGroups,
                defenseLevelOverrides: state.defenseLevelOverrides || null,
                defenseSuperchargeOverrides: state.defenseSuperchargeOverrides || null
            })}
        </div>
    `;

    const viewClass = 'calc-view calc-view--cluster';
    const viewHtml = `
        ${inputsCardHtml}
        ${resultsCardHtml}
    `;

    const existingLayout = typeof container.querySelector === 'function'
        ? container.querySelector('.calc-tab-layout')
        : null;
    const existingView = existingLayout
        ? existingLayout.querySelector('.calc-view--zapquake, .calc-view--cluster')
        : null;

    if (existingLayout && existingView) {
        const sourcesGrid = existingLayout.querySelector('.calc-damage-sources-grid');
        if (sourcesGrid) {
            sourcesGrid.innerHTML = getDamageSourcesGridHtml(state);
        }

        const activeEl = typeof document !== 'undefined' ? /** @type {HTMLElement | null} */ (document.activeElement) : null;
        const searchInputFocused = activeEl && activeEl.id === 'zq-search-input';
        const selectionStart = searchInputFocused ? /** @type {HTMLInputElement} */ (activeEl).selectionStart : null;
        const selectionEnd = searchInputFocused ? /** @type {HTMLInputElement} */ (activeEl).selectionEnd : null;

        const activeAction = activeEl?.dataset?.action || null;
        const activePair = activeEl?.dataset?.pair || null;
        const activeEquipKey = activeEl?.dataset?.equipmentKey || null;
        const activeTradeoffIdx = activeEl?.getAttribute?.('data-cluster-tradeoff-index') ?? null;
        const wasInDrawer = Boolean(activeEl?.closest?.('#calc-mobile-dock-drawer'));

        existingView.className = viewClass;
        existingView.innerHTML = viewHtml;

        const existingBackdrop = existingLayout.querySelector('#calc-mobile-dock-backdrop');
        const existingDock = existingLayout.querySelector('#calc-mobile-spell-dock');

        if (!mobileDockHtml) {
            if (existingBackdrop && typeof existingBackdrop.remove === 'function') {
                existingBackdrop.remove();
            }
            if (existingDock && typeof existingDock.remove === 'function') {
                existingDock.remove();
            }
        } else if (existingDock) {
            const isExpanded = Boolean(zq.mobileDockExpanded);
            if (existingBackdrop) {
                existingBackdrop.classList.toggle('is-active', isExpanded);
            }
            existingDock.classList.toggle('is-expanded', isExpanded);

            const recipeEl = existingDock.querySelector('.calc-mobile-spell-dock__recipe');
            if (recipeEl) {
                recipeEl.innerHTML = mobileDockRecipeHtml;
            }

            const toggleBtn = existingDock.querySelector('#calc-mobile-dock-toggle');
            if (toggleBtn) {
                toggleBtn.setAttribute('aria-expanded', String(isExpanded));
                const toggleLabel = escapeHTML(translate(isExpanded ? 'views.damageCalc.filters.hideDetails' : 'views.damageCalc.filters.showDetails'));
                toggleBtn.setAttribute('aria-label', toggleLabel);
            }

            const chevron = existingDock.querySelector('.calc-mobile-spell-dock__chevron');
            if (chevron) {
                chevron.classList.toggle('is-expanded', isExpanded);
            }

            const drawerEl = /** @type {HTMLElement | null} */ (existingDock.querySelector('#calc-mobile-dock-drawer'));
            if (drawerEl) {
                const prevScrollTop = drawerEl.scrollTop;
                drawerEl.classList.toggle('is-expanded', isExpanded);
                drawerEl.innerHTML = mobileDockDrawerHtml;
                // Preserve scroll position without triggering CSS smooth-scroll animation
                drawerEl.style.scrollBehavior = 'auto';
                drawerEl.scrollTop = prevScrollTop;
                drawerEl.style.scrollBehavior = '';
            }
        } else if (typeof existingLayout.insertAdjacentHTML === 'function') {
            existingLayout.insertAdjacentHTML('beforeend', mobileDockHtml);
        }

        if (searchInputFocused) {
            const newSearchInput = /** @type {HTMLInputElement | null} */ (existingView.querySelector('#zq-search-input'));
            if (newSearchInput) {
                newSearchInput.focus();
                if (selectionStart !== null && selectionEnd !== null) {
                    newSearchInput.setSelectionRange(selectionStart, selectionEnd);
                }
            }
        } else if (activeAction === 'toggle-adjacent-pair' && activePair) {
            const scope = wasInDrawer ? existingDock : existingView;
            const newActiveBtn = scope ? /** @type {HTMLElement | null} */ (scope.querySelector(`[data-action="toggle-adjacent-pair"][data-pair="${activePair}"]`)) : null;
            if (newActiveBtn && typeof newActiveBtn.focus === 'function') {
                newActiveBtn.focus({ preventScroll: true });
            }
        } else if (activeAction === 'toggle-cluster-equipment' && activeEquipKey) {
            const scope = wasInDrawer ? existingDock : existingView;
            const newActiveBtn = scope ? /** @type {HTMLElement | null} */ (scope.querySelector(`[data-action="toggle-cluster-equipment"][data-equipment-key="${activeEquipKey}"]`)) : null;
            if (newActiveBtn && typeof newActiveBtn.focus === 'function') {
                newActiveBtn.focus({ preventScroll: true });
            }
        } else if (activeTradeoffIdx !== null) {
            const scope = wasInDrawer ? existingDock : existingView;
            const newActiveBtn = scope ? /** @type {HTMLElement | null} */ (scope.querySelector(`[data-cluster-tradeoff-index="${activeTradeoffIdx}"]`)) : null;
            if (newActiveBtn && typeof newActiveBtn.focus === 'function') {
                newActiveBtn.focus({ preventScroll: true });
            }
        }
        return;
    }

    container.innerHTML = `
        <div class="calc-tab-layout">
            ${getDamageSourcesCardMarkup(state)}

            <div class="${viewClass}">
                ${viewHtml}
            </div>

            ${mobileDockHtml}
        </div>
    `;
}

/**
 * Targeted search update for Tab 2 (Cluster Planner): replaces only the
 * .calc-building-grid content without triggering a full view re-render.
 * Called directly from the search input handler on every keystroke.
 *
 * @param {Object} state - Damage calculator state.
 * @param {HTMLElement} container - Root calculator container.
 */
export function updateClusterBuildingGridForSearch(state, container) {
    const grid = /** @type {HTMLElement | null} */ (container.querySelector('.calc-building-grid'));
    if (!grid) return;
    const zq = state.zapQuake;
    const clusterTargets = Array.isArray(zq.selectedCluster) ? zq.selectedCluster : [];
    const activeTh = getShownTownHall(state);
    const cardsHtml = renderBuildingGridCardsHtml({
        activeKey: clusterTargets[0]?.defenseKey || zq.defenseKey,
        activeLevel: clusterTargets[0]?.level || zq.defenseLevel || 1,
        searchQuery: zq.searchQuery || '',
        selectedCluster: clusterTargets,
        multiSelectMode: true,
        prefix: 'zq',
        buildingFilter: zq.buildingFilter || 'all',
        townHallLevel: activeTh,
        superchargeTier: getGlobalSuperchargeTier(state),
        enabledBuildingGroups: state.enabledBuildingGroups,
        defenseLevelOverrides: state.defenseLevelOverrides || null,
        defenseSuperchargeOverrides: state.defenseSuperchargeOverrides || null
    });
    grid.className = `calc-building-grid${!cardsHtml ? ' calc-building-grid--empty' : ''}`;
    grid.innerHTML = cardsHtml || `
        <div class="calc-empty-notice">
            <p class="calc-empty-notice__text" data-i18n="views.damageCalc.filters.noTargetsMatchFilter">
                ${escapeHTML(translate('views.damageCalc.filters.noTargetsMatchFilter'))}
            </p>
            <button type="button" class="btn-secondary calc-empty-notice__btn" data-action="reset-cluster-filters">
                <orecalc-assets-svg name="close" width="12" height="12"></orecalc-assets-svg>
                <span data-i18n="views.damageCalc.filters.resetFiltersBtn">${escapeHTML(translate('views.damageCalc.filters.resetFiltersBtn'))}</span>
            </button>
        </div>
    `;
}
