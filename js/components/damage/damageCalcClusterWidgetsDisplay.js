/**
 * Accessory and Widget DOM Rendering Engine for Cluster Planner (Trade-offs Bar, Mobile Dock, Presets).
 * Tier 4: UI Presentation (Dedicated exclusively to DOM rendering, 0 event listeners, 0 state mutations).
 */

import { getDefensesData } from '../../data/defenseTargetsData.js';
import { equipmentDamageData } from '../../data/equipmentDamageData.js';
import { getClusterPresetsForTownHall } from '../../data/clusterPresetsData.js';
import { getBuildingAssetUrl } from '../../core/buildingAssetHelper.js';
import { getMaxDefenseLevelForTownHall } from '../../domain/damage/defenseProgressionDomain.js';
import { translate } from '../../i18n/translator.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import {
    getDefenseDisplayName,
    getEquipmentDisplayName
} from '../../utils/equipmentMetadata.js';

/**
 * Generates the inline Earthquake trade-offs switcher markup for single or cluster combinations.
 *
 * @param {Array<Object>} combinations - List of viable spell combinations.
 * @param {number} activeIndex - Currently selected combination index.
 * @returns {string} Rendered HTML markup.
 */
export function renderTradeoffsBarHtml(combinations, activeIndex = 0) {
    if (!Array.isArray(combinations) || combinations.length <= 1) return '';

    const titleText = escapeHTML(translate('views.damageCalc.clusterPlanner.spellOptionsTitle'));
    const optimalText = escapeHTML(translate('views.damageCalc.zapQuake.tradeoffOptimalBadge'));
    const spaceUnit = escapeHTML(translate('views.damageCalc.clusterPlanner.spellSpaceLabel'));

    const pillsHtml = combinations.map((c, idx) => {
        const isActive = idx === activeIndex;
        const isOptimal = idx === 0;
        const isOverCapacity = Boolean(c.exceedsCapacity);
        const pillClasses = ['calc-tradeoff-pill'];
        if (isActive) pillClasses.push('is-active');
        if (isOverCapacity) pillClasses.push('calc-tradeoff-pill--overcapacity');

        const overcapacityTitle = isOverCapacity && c.maxArmyCapacity
            ? ` title="${escapeHTML(translate('views.damageCalc.offense.exceedsCapacity', { max: c.maxArmyCapacity }))}"`
            : '';
        const eqCount = c.sharedEqCount ?? c.eqCount ?? 0;
        const zapCount = c.totalZaps ?? c.zapCount ?? 0;
        const spellItems = [];
        if (eqCount > 0) {
            spellItems.push(`
                <span class="calc-tradeoff-spell-item">
                    <strong>${eqCount}</strong>
                    <orecalc-assets-image src="/assets/spells/earthquake.png" alt="${escapeHTML(translate('views.damageCalc.offense.spellEarthquake'))}" data-i18n-alt="views.damageCalc.offense.spellEarthquake" size="thumbnail" class="calc-tradeoff-pill__spell-icon"></orecalc-assets-image>
                </span>
            `);
        }
        if (zapCount > 0) {
            spellItems.push(`
                <span class="calc-tradeoff-spell-item">
                    <strong>${zapCount}</strong>
                    <orecalc-assets-image src="/assets/spells/lightning.png" alt="${escapeHTML(translate('views.damageCalc.offense.spellLightning'))}" data-i18n-alt="views.damageCalc.offense.spellLightning" size="thumbnail" class="calc-tradeoff-pill__spell-icon"></orecalc-assets-image>
                </span>
            `);
        }
        const spellSummary = spellItems.join('<span class="calc-tradeoff-plus">+</span>') || `<strong>0</strong> ${spaceUnit}`;
        const ariaText = `${eqCount} Earthquake, ${zapCount} Lightning, ${c.totalHousingSpace} housing space${isOptimal ? ', optimal' : ''}${isOverCapacity ? ', exceeds capacity' : ''}`;

        return `
            <button type="button"
                class="${pillClasses.join(' ')}"
                data-tradeoff-index="${idx}"
                data-cluster-tradeoff-index="${idx}"
                ${isOverCapacity ? 'data-overcapacity="true"' : ''}
                ${overcapacityTitle}
                role="radio"
                aria-checked="${isActive}"
                aria-label="${escapeHTML(ariaText)}">
                <span class="calc-tradeoff-pill__spells">
                    ${spellSummary}
                </span>
                ${isOptimal ? `<span class="calc-tradeoff-pill__tag calc-tradeoff-pill__tag--optimal" title="${optimalText}" aria-label="${optimalText}"><orecalc-assets-svg name="thumbs-up" width="12" height="12"></orecalc-assets-svg></span>` : ''}
            </button>
        `;
    }).join('');

    return `
        <div class="calc-tradeoffs-container" role="radiogroup" aria-label="${titleText}">
            <div class="calc-tradeoffs-container__header">
                <span class="calc-tradeoffs-container__title">${titleText}</span>
            </div>
            <div class="calc-tradeoffs-container__pills">
                ${pillsHtml}
            </div>
        </div>
    `;
}

/**
 * Generates the persistent docked bottom sheet markup for mobile viewports.
 *
 * @param {Object} params
 * @param {boolean} [params.isCluster] - True if cluster mode is active.
 * @param {Array<Object>} [params.clusterTargets] - Array of cluster targets.
 * @param {boolean} [params.isClusterDestroyed=true] - Whether the cluster combination destroys all targets.
 * @param {string} [params.targetName] - Primary target name (fallback).
 * @param {string} [params.targetThumb] - Primary target thumbnail URL (fallback).
 * @param {string} [params.targetLevel] - Primary target level string (fallback).
 * @param {string} [params.recipeBadgesHtml] - Rendered combo recipe badges HTML (equipment + spells).
 * @param {number} [params.eqCount=0] - Active Earthquake count (fallback).
 * @param {number} [params.zapCount=0] - Active Lightning count (fallback).
 * @param {number|string} params.totalHousing - Active total housing space.
 * @param {boolean} [params.isOverCapacity=false] - Whether combination exceeds max army capacity.
 * @param {number} [params.maxArmyCapacity=12] - Maximum army spell housing capacity.
 * @param {boolean} params.isExpanded - Whether the mobile detail drawer is expanded.
 * @param {string} params.drawerContentHtml - Inner content for expanded drawer.
 * @returns {string} Rendered HTML markup.
 */
export function renderMobileSpellDockHtml({
    isCluster,
    clusterTargets = [],
    isClusterDestroyed = true,
    targetName,
    targetThumb,
    targetLevel,
    recipeBadgesHtml = '',
    eqCount = 0,
    zapCount = 0,
    totalHousing,
    isOverCapacity = false,
    maxArmyCapacity = 12,
    isExpanded,
    drawerContentHtml
}) {
    const toggleLabel = escapeHTML(translate(isExpanded ? 'views.damageCalc.filters.hideDetails' : 'views.damageCalc.filters.showDetails'));
    const titleKey = isClusterDestroyed ? 'views.damageCalc.clusterPlanner.clusterSolutionBadge' : 'views.damageCalc.zapQuake.cannotDestroyBadge';
    const titleText = escapeHTML(translate(titleKey));

    let badgesHtml = recipeBadgesHtml;
    if (!badgesHtml) {
        if (!isClusterDestroyed) {
            badgesHtml = `<span class="calc-spell-badge calc-spell-badge--indestructible" data-i18n="views.damageCalc.zapQuake.cannotDestroyBadge">${escapeHTML(translate('views.damageCalc.zapQuake.cannotDestroyBadge') || 'Cannot Destroy')}</span>`;
        } else {
            if (eqCount > 0) {
                badgesHtml += `
                    <div class="calc-spell-badge calc-spell-badge--eq" aria-hidden="true">
                        <span class="calc-spell-badge__multiplier">${eqCount}x</span>
                        <orecalc-assets-image src="/assets/spells/earthquake.png" alt="${escapeHTML(translate('views.damageCalc.offense.spellEarthquake'))}" data-i18n-alt="views.damageCalc.offense.spellEarthquake" size="thumbnail" class="calc-spell-badge__icon"></orecalc-assets-image>
                    </div>
                `;
            }
            if (zapCount > 0) {
                if (badgesHtml) badgesHtml += '<span class="calc-combo-plus">+</span>';
                badgesHtml += `
                    <div class="calc-spell-badge calc-spell-badge--zap" aria-hidden="true">
                        <span class="calc-spell-badge__multiplier">${zapCount}x</span>
                        <orecalc-assets-image src="/assets/spells/lightning.png" alt="${escapeHTML(translate('views.damageCalc.offense.spellLightning'))}" data-i18n-alt="views.damageCalc.offense.spellLightning" size="thumbnail" class="calc-spell-badge__icon"></orecalc-assets-image>
                    </div>
                `;
            }
        }
    }

    return `
        <div class="calc-mobile-dock-backdrop ${isExpanded ? 'is-active' : ''}" id="calc-mobile-dock-backdrop" aria-hidden="true"></div>
        <div class="calc-mobile-spell-dock ${isExpanded ? 'is-expanded' : ''}" id="calc-mobile-spell-dock">
            <div class="calc-mobile-spell-dock__bar">
                <span class="calc-mobile-spell-dock__title${!isClusterDestroyed ? ' calc-mobile-spell-dock__title--indestructible' : ''}" data-i18n="${titleKey}">${titleText}</span>
                <div class="calc-mobile-spell-dock__recipe">
                    ${badgesHtml}
                </div>
                <button type="button"
                    id="calc-mobile-dock-toggle"
                    class="calc-mobile-spell-dock__toggle"
                    aria-expanded="${isExpanded}"
                    aria-controls="calc-mobile-dock-drawer"
                    aria-label="${toggleLabel}">
                    <orecalc-assets-svg name="dropdown" class="calc-mobile-spell-dock__chevron ${isExpanded ? 'is-expanded' : ''}" width="14" height="14"></orecalc-assets-svg>
                </button>
            </div>
            <div id="calc-mobile-dock-drawer" class="calc-mobile-spell-dock__drawer ${isExpanded ? 'is-expanded' : ''}">
                ${drawerContentHtml}
            </div>
        </div>
    `;
}

/**
 * Resolves suggested complementary neighbors for a defense at the active Town Hall.
 *
 * @param {string} defenseKey - Selected defense key.
 * @param {number} activeTh - Active Town Hall level.
 * @returns {Array<string>} Array of up to 3 candidate defense keys.
 */
export function getSuggestedNeighborsForDefense(defenseKey, activeTh) {
    const candidates = ['monolith', 'scattershot', 'inferno_tower', 'spell_tower', 'air_defense', 'eagle_artillery', 'clan_castle', 'cake_a_pult'];
    return candidates
        .filter(k => k !== defenseKey && getDefensesData()[k] && (!getDefensesData()[k].minTH || activeTh >= getDefensesData()[k].minTH))
        .slice(0, 3);
}

/**
 * Renders the Popular Cluster Presets cards for the empty state.
 *
 * @param {number} activeTh - Current Town Hall level.
 * @returns {string} HTML markup.
 */
export function renderClusterPresetsHtml(activeTh) {
    const presets = getClusterPresetsForTownHall(activeTh);
    if (!presets || presets.length === 0) {
        return '';
    }

    const presetCardsHtml = presets.map(preset => {
        const titleText = escapeHTML(translate(preset.titleKey) || preset.defaultTitle);
        const descText = escapeHTML(translate(preset.descKey) || preset.defaultDesc);
        const loadBtnText = escapeHTML(translate('actions.load') || 'Load');

        const targetsThumbsHtml = preset.targets.map((tgtKey, i) => {
            const def = getDefensesData()[tgtKey];
            const name = getDefenseDisplayName(tgtKey);
            const maxThLvl = getMaxDefenseLevelForTownHall(tgtKey, activeTh).level;
            const lvl = maxThLvl > 0 ? maxThLvl : (def?.maxLevel || 1);
            const thumb = getBuildingAssetUrl(tgtKey, lvl);
            return `
                <span class="calc-cluster-preset-thumb" title="${escapeHTML(name)} (#${i + 1})">
                    <orecalc-assets-image src="${thumb}" alt="${escapeHTML(name)}" size="thumbnail"></orecalc-assets-image>
                </span>
            `;
        }).join('');

        const equipBadgesHtml = preset.equipment.map(eqKey => {
            const eqData = equipmentDamageData[eqKey];
            const eqName = getEquipmentDisplayName(eqKey);
            return `
                <span class="calc-cluster-preset-equip" title="${escapeHTML(eqName)}">
                    <orecalc-assets-image src="${eqData?.icon || ''}" alt="${escapeHTML(eqName)}" size="thumbnail"></orecalc-assets-image>
                </span>
            `;
        }).join('');

        return `
            <div class="calc-cluster-preset-card" data-action="apply-cluster-preset" data-preset-id="${preset.id}" role="button" tabindex="0">
                <div class="calc-cluster-preset-card__header">
                    <div class="calc-cluster-preset-card__info">
                        <span class="calc-cluster-preset-card__title" data-i18n="${preset.titleKey}">${titleText}</span>
                        <span class="calc-cluster-preset-card__desc" data-i18n="${preset.descKey}">${descText}</span>
                    </div>
                    <button type="button" class="btn-secondary calc-cluster-preset-card__btn" data-i18n="actions.load">
                        ${loadBtnText}
                    </button>
                </div>
                <div class="calc-cluster-preset-card__preview">
                    <div class="calc-cluster-preset-card__targets">
                        ${targetsThumbsHtml}
                    </div>
                    <div class="calc-cluster-preset-card__divider"></div>
                    <div class="calc-cluster-preset-card__equipment">
                        ${equipBadgesHtml}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    const sectionTitle = escapeHTML(translate('views.damageCalc.clusterPlanner.clusterPopularPresetsTitle') || 'Try a Popular Cluster');

    return `
        <div class="calc-cluster-presets">
            <span class="calc-cluster-presets__title" data-i18n="views.damageCalc.clusterPlanner.clusterPopularPresetsTitle">${sectionTitle}</span>
            <div class="calc-cluster-presets__grid">
                ${presetCardsHtml}
            </div>
        </div>
    `;
}

/**
 * Renders the 3-step workflow guide for cluster planning.
 *
 * @returns {string} HTML markup.
 */
export function renderClusterWorkflowHtml() {
    const workflowTitle = escapeHTML(translate('views.damageCalc.clusterPlanner.clusterWorkflowTitle') || 'How Cluster Planning Works');
    const step1Title = escapeHTML(translate('views.damageCalc.clusterPlanner.clusterStep1Title') || '1. Pick 2–5 Targets');
    const step1Desc = escapeHTML(translate('views.damageCalc.clusterPlanner.clusterStep1Desc') || 'Select up to 5 defenses grouped close together on the base.');
    const step2Title = escapeHTML(translate('views.damageCalc.clusterPlanner.clusterStep2Title') || '2. Shared Spells & Equipment');
    const step2Desc = escapeHTML(translate('views.damageCalc.clusterPlanner.clusterStep2Desc') || 'Shared Earthquakes soften the cluster; hero equipment and shared lightnings cut required spells.');
    const step3Title = escapeHTML(translate('views.damageCalc.clusterPlanner.clusterStep3Title') || '3. Optimal Spell Housing');
    const step3Desc = escapeHTML(translate('views.damageCalc.clusterPlanner.clusterStep3Desc') || 'Get the exact minimal spell combination to destroy every target within your army capacity.');

    return `
        <div class="calc-cluster-workflow">
            <span class="calc-cluster-workflow__title" data-i18n="views.damageCalc.clusterPlanner.clusterWorkflowTitle">${workflowTitle}</span>
            <div class="calc-cluster-steps-grid">
                <div class="calc-cluster-step-card">
                    <div class="calc-cluster-step-card__icon-wrap">
                        <orecalc-assets-svg name="swords-filled" width="18" height="18"></orecalc-assets-svg>
                    </div>
                    <span class="calc-cluster-step-card__title" data-i18n="views.damageCalc.clusterPlanner.clusterStep1Title">${step1Title}</span>
                    <span class="calc-cluster-step-card__desc" data-i18n="views.damageCalc.clusterPlanner.clusterStep1Desc">${step1Desc}</span>
                </div>
                <div class="calc-cluster-step-card">
                    <div class="calc-cluster-step-card__icon-wrap">
                        <orecalc-assets-svg name="zap-filled" width="18" height="18"></orecalc-assets-svg>
                    </div>
                    <span class="calc-cluster-step-card__title" data-i18n="views.damageCalc.clusterPlanner.clusterStep2Title">${step2Title}</span>
                    <span class="calc-cluster-step-card__desc" data-i18n="views.damageCalc.clusterPlanner.clusterStep2Desc">${step2Desc}</span>
                </div>
                <div class="calc-cluster-step-card">
                    <div class="calc-cluster-step-card__icon-wrap">
                        <orecalc-assets-svg name="check-circle-filled" width="18" height="18"></orecalc-assets-svg>
                    </div>
                    <span class="calc-cluster-step-card__title" data-i18n="views.damageCalc.clusterPlanner.clusterStep3Title">${step3Title}</span>
                    <span class="calc-cluster-step-card__desc" data-i18n="views.damageCalc.clusterPlanner.clusterStep3Desc">${step3Desc}</span>
                </div>
            </div>
        </div>
    `;
}
