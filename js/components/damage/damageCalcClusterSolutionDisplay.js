/**
 * DOM Rendering Engine for Damage Calculator Cluster Solution Card & Hero Sections.
 * Tier 4: UI Presentation (Dedicated exclusively to DOM generation for cluster results).
 */

import { getDefensesData } from '../../data/defenseTargetsData.js';
import { equipmentDamageData } from '../../data/equipmentDamageData.js';
import { getBuildingAssetUrl } from '../../core/buildingAssetHelper.js';
import {
    getEffectiveEquipmentLevel,
    isTargetImmuneToSpell
} from '../../domain/damage/damageFormulas.js';
import { translate } from '../../i18n/translator.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { getActiveModifier } from './damageCalcState.js';
import {
    getDefenseDisplayName,
    getEquipmentDisplayName
} from '../../utils/equipmentMetadata.js';
import {
    getLvlShort
} from './damageCalcDisplay.js';
import { renderTradeoffsBarHtml } from './damageCalcClusterWidgetsDisplay.js';

const DAMAGE_EQUIPMENT_KEYS = Object.freeze([
    'spiky_ball',
    'giant_arrow',
    'fireball',
    'seeking_shield',
    'flame_blower',
    'rocket_backpack'
]);

/**
 * Renders the Cluster Solution Hero Card, spell badges, equipment sharing, and mobile drawer markup.
 *
 * @param {Object} params
 * @param {Object} params.activeCombo - Active combination solution.
 * @param {Object} params.clusterSolution - Full cluster solution object.
 * @param {Array<Object>} params.clusterTargets - Selected cluster target definitions.
 * @param {Array<Object>} params.resolvedClusterEquipment - Resolved equipment levels and target scopes.
 * @param {Array<string>} params.activeEquipKeys - Active equipment keys.
 * @param {Object} params.activeEquipSharing - Equipment to targets index map.
 * @param {Object} params.state - Damage calculator global state.
 * @param {number} params.eqLvl - Earthquake level.
 * @param {number} params.zapLvl - Lightning level.
 * @param {Array<Object>} params.combinations - List of alternative combinations.
 * @param {number} params.selectedIdx - Currently selected combination index.
 * @param {string} params.targetCardsHtml - Pre-rendered cluster target cards HTML.
 * @returns {{ resultsCardHtml: string, mobileDockRecipeHtml: string, mobileDockDrawerHtml: string, isClusterDestroyed: boolean, isOverCapacity: boolean, maxArmyCapacity: number }}
 */
export function renderClusterSolutionCardHtml({
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
}) {
    const lvlShort = getLvlShort();
    const isClusterDestroyed = Boolean(clusterSolution.allDestroyed && activeCombo.allDestroyed);

    const hasClusterBuildings = clusterTargets.some(t => !getDefensesData()[t.defenseKey] || getDefensesData()[t.defenseKey].category === 'building');
    const hasClusterUnits = clusterTargets.some(t => {
        const def = getDefensesData()[t.defenseKey];
        return def?.category === 'hero' || def?.category === 'guardian';
    });
    const clusterScope = (hasClusterBuildings && hasClusterUnits) ? 'both' : (hasClusterUnits ? 'troops' : 'buildings');

    const clusterBadges = [];
    for (const eq of resolvedClusterEquipment) {
        const equip = equipmentDamageData[eq.id];
        if (!equip) continue;
        const eqEffectiveLevel = eq.level;
        const eqRawLevel = eq.rawLevel || eq.level;
        const equipName = getEquipmentDisplayName(eq.id);
        const badgeAria = `${escapeHTML(equipName)} (${lvlShort} ${eqEffectiveLevel})`;

        clusterBadges.push(`
            <div class="calc-equip-badge"
                data-combo-badge="equipment"
                data-equip-id="${eq.id}"
                data-equip-level="${eqEffectiveLevel}"
                data-equip-raw-level="${eqRawLevel}"
                role="button"
                tabindex="0"
                aria-label="${badgeAria}">
                <orecalc-assets-image src="${equip.icon}" alt="${escapeHTML(equipName)}" size="thumbnail" class="calc-equip-badge__icon"></orecalc-assets-image>
            </div>
        `);
    }
    if (activeCombo.sharedEqCount > 0) {
        clusterBadges.push(`
            <div class="calc-spell-badge calc-spell-badge--eq"
                data-combo-badge="earthquake"
                data-eq-count="${activeCombo.sharedEqCount}"
                data-eq-level="${eqLvl}"
                data-target-scope="${clusterScope}"
                role="button"
                tabindex="0"
                aria-label="${activeCombo.sharedEqCount}x ${escapeHTML(translate('views.damageCalc.offense.spellEarthquake') || 'Earthquake')}">
                <span class="calc-spell-badge__multiplier">${activeCombo.sharedEqCount}x</span>
                <orecalc-assets-image src="/assets/spells/earthquake.png" alt="Earthquake" size="thumbnail" class="calc-spell-badge__icon"></orecalc-assets-image>
            </div>
        `);
    }
    if (activeCombo.totalZaps > 0) {
        clusterBadges.push(`
            <div class="calc-spell-badge calc-spell-badge--zap"
                data-combo-badge="lightning"
                data-zap-count="${activeCombo.totalZaps}"
                data-zap-level="${zapLvl}"
                role="button"
                tabindex="0"
                aria-label="${activeCombo.totalZaps}x ${escapeHTML(translate('views.damageCalc.offense.spellLightning') || 'Lightning')}">
                <span class="calc-spell-badge__multiplier">${activeCombo.totalZaps}x</span>
                <orecalc-assets-image src="/assets/spells/lightning.png" alt="Lightning" size="thumbnail" class="calc-spell-badge__icon"></orecalc-assets-image>
            </div>
        `);
    }
    if (!isClusterDestroyed) {
        clusterBadges.push(`
            <span class="calc-spell-badge calc-spell-badge--indestructible" data-i18n="views.damageCalc.zapQuake.cannotDestroyBadge">
                ${escapeHTML(translate('views.damageCalc.zapQuake.cannotDestroyBadge') || 'Cannot Destroy')}
            </span>
        `);
    }
    const clusterBadgesHtml = clusterBadges.map((badge, idx) => `
        <div class="calc-combo-item">
            ${idx > 0 ? '<span class="calc-combo-plus">+</span>' : ''}
            ${badge}
        </div>
    `).join('');

    const maxArmyCapacity = clusterSolution.maxArmyCapacity || 14;
    const isOverCapacity = activeCombo.totalHousingSpace > maxArmyCapacity;

    const tradeoffsHtml = renderTradeoffsBarHtml(combinations, selectedIdx);

    const equipmentSectionTitle = escapeHTML(translate('views.equipment.heroEquipment'));
    const allTargetsText = escapeHTML(translate('views.damageCalc.clusterPlanner.clusterEquipmentAllTargets'));
    const hitsText = escapeHTML(translate('views.damageCalc.clusterPlanner.clusterEquipmentHits'));

    const equipButtonsHtml = DAMAGE_EQUIPMENT_KEYS.map(key => {
        const equip = equipmentDamageData[key];
        const defaultLvl = equip?.rarity === 'epic' ? 27 : 18;
        const rawLvl = state.offense?.equipment?.[key] || defaultLvl;
        const effectiveLvl = getEffectiveEquipmentLevel(key, rawLvl, getActiveModifier(state));
        const isDowngraded = effectiveLvl < rawLvl;
        const isSelected = activeEquipKeys.includes(key);
        const equipName = getEquipmentDisplayName(key);

        return `
            <button type="button"
                class="calc-cluster-equip-btn ${isSelected ? 'is-active' : 'is-inactive'} ${isDowngraded ? 'is-downgraded' : ''}"
                data-action="toggle-cluster-equipment"
                data-equipment-key="${key}"
                role="switch"
                aria-checked="${isSelected}"
                aria-label="${escapeHTML(equipName)} (${lvlShort} ${effectiveLvl})"
                title="${escapeHTML(equipName)} (${lvlShort} ${effectiveLvl})">
                <orecalc-assets-image src="${equip?.icon || ''}" alt="${escapeHTML(equipName)}" size="thumbnail" class="calc-cluster-equip-btn__icon"></orecalc-assets-image>
                <span class="calc-cluster-equip-btn__lvl ${isDowngraded ? 'calc-cluster-equip-btn__lvl--downgraded' : ''}">${effectiveLvl}</span>
            </button>
        `;
    }).join('');

    let equipSharingHtml = '';
    if (activeEquipKeys.length > 0) {
        const sharingRows = activeEquipKeys.map(key => {
            const equip = equipmentDamageData[key];
            const equipName = getEquipmentDisplayName(key);
            const assignedTargets = activeEquipSharing[key];
            const isAllTargets = !Array.isArray(assignedTargets) || assignedTargets.length === clusterTargets.length;

            const targetPills = clusterTargets.map((target, tIdx) => {
                const isTargetHit = isAllTargets || assignedTargets.includes(tIdx);
                const defName = getDefenseDisplayName(target.defenseKey);
                const defThumb = getBuildingAssetUrl(target.defenseKey, target.level);
                return `
                    <button type="button"
                        class="calc-cluster-share-target ${isTargetHit ? 'is-active' : ''}"
                        data-action="toggle-equipment-target"
                        data-equipment-key="${key}"
                        data-target-index="${tIdx}"
                        role="switch"
                        aria-checked="${isTargetHit}"
                        aria-label="${escapeHTML(defName)} (#${tIdx + 1})"
                        title="${escapeHTML(defName)} (#${tIdx + 1})">
                        <span class="calc-cluster-share-target__index">#${tIdx + 1}</span>
                        <orecalc-assets-image src="${defThumb}" alt="${escapeHTML(defName)}" size="thumbnail" class="calc-cluster-share-target__thumb"></orecalc-assets-image>
                    </button>
                `;
            }).join('');

            return `
                <div class="calc-cluster-sharing-row">
                    <div class="calc-cluster-sharing-row__header">
                        <span class="calc-cluster-sharing-row__label" title="${escapeHTML(equipName)}">
                            <orecalc-assets-image src="${equip?.icon || ''}" alt="${escapeHTML(equipName)}" size="thumbnail" class="calc-cluster-sharing-row__icon"></orecalc-assets-image>
                            <strong>${hitsText}:</strong>
                        </span>
                        <button type="button"
                            class="calc-cluster-share-all-btn ${isAllTargets ? 'is-active' : ''}"
                            data-action="toggle-equipment-all-targets"
                            data-equipment-key="${key}">
                            <orecalc-assets-svg name="check" width="12" height="12"></orecalc-assets-svg>
                            <span>${allTargetsText}</span>
                        </button>
                    </div>
                    <div class="calc-cluster-sharing-row__targets">
                        ${targetPills}
                    </div>
                </div>
            `;
        }).join('');

        equipSharingHtml = `
            <div class="calc-cluster-equipment-sharing">
                ${sharingRows}
            </div>
        `;
    }

    const equipmentSectionHtml = `
        <div class="calc-cluster-equipment-section">
            <div class="calc-cluster-equipment-section__header">
                <span class="calc-cluster-equipment-section__title">${equipmentSectionTitle}</span>
            </div>
            <div class="calc-cluster-equipment-section__chips">
                ${equipButtonsHtml}
            </div>
            ${equipSharingHtml}
        </div>
    `;

    const immuneTargets = clusterTargets.filter(t => isTargetImmuneToSpell(t.defenseKey, 'lightning'));
    let indestructibleBannerHtml = '';
    if (!isClusterDestroyed) {
        const noticeTitle = immuneTargets.length > 0
            ? escapeHTML(translate('views.damageCalc.clusterPlanner.clusterImmuneNoticeTitle') || 'Immune to Lightning Spells')
            : escapeHTML(translate('views.damageCalc.clusterPlanner.clusterIndestructibleTitle') || 'Cluster Cannot Be Destroyed');
        const noticeDesc = immuneTargets.length > 0
            ? escapeHTML(translate('views.damageCalc.clusterPlanner.clusterImmuneNoticeDesc') || 'Town Hall and Clan Castle are immune to Lightning spells. Use high-damage Hero Equipment (e.g. Fireball) to destroy them, or select defenses vulnerable to spells.')
            : escapeHTML(translate('views.damageCalc.clusterPlanner.clusterIndestructibleDesc') || 'The selected cluster cannot be destroyed with your current spells and equipment. Equip Hero Equipment or adjust your targets.');

        indestructibleBannerHtml = `
            <div class="calc-cluster-indestructible-banner">
                <orecalc-assets-svg name="info" width="16" height="16" class="calc-cluster-indestructible-banner__icon"></orecalc-assets-svg>
                <div class="calc-cluster-indestructible-banner__text">
                    <span class="calc-cluster-indestructible-banner__title">${noticeTitle}</span>
                    <p class="calc-cluster-indestructible-banner__desc">${noticeDesc}</p>
                </div>
            </div>
        `;
    }

    const resultsCardHtml = `
        <div class="calc-card calc-card--results">
            <div class="solution-hero-card solution-hero-card--cluster${!isClusterDestroyed ? ' is-indestructible' : ''}">
                <div class="solution-hero-card__header">
                    <div class="solution-hero-card__header-left">
                        <span class="solution-hero-card__badge${!isClusterDestroyed ? ' solution-hero-card__badge--indestructible' : ''}" data-i18n="${!isClusterDestroyed ? 'views.damageCalc.zapQuake.cannotDestroyBadge' : 'views.damageCalc.clusterPlanner.clusterSolutionBadge'}">${escapeHTML(translate(!isClusterDestroyed ? 'views.damageCalc.zapQuake.cannotDestroyBadge' : 'views.damageCalc.clusterPlanner.clusterSolutionBadge') || (!isClusterDestroyed ? 'Cannot Destroy' : 'Cluster Solution'))}</span>
                    </div>
                    <div class="solution-hero-card__header-right">
                        ${isOverCapacity && isClusterDestroyed ? `
                            <span class="calc-capacity-warning">${escapeHTML(translate('views.damageCalc.offense.exceedsCapacity', { max: maxArmyCapacity }) || `Exceeds ${maxArmyCapacity} Capacity`)}</span>
                        ` : ''}
                        <button type="button" class="calc-info-btn" data-calc-info="cluster" aria-label="${escapeHTML(translate('actions.showInfo'))}" data-i18n-aria-label="actions.showInfo">
                            <orecalc-assets-svg name="info" width="14" height="14"></orecalc-assets-svg>
                        </button>
                    </div>
                </div>

                <div class="solution-hero-card__spells">
                    ${clusterBadgesHtml}
                </div>

                ${indestructibleBannerHtml}

                ${equipmentSectionHtml}

                ${tradeoffsHtml}
            </div>

            <div class="cluster-targets-grid">
                ${targetCardsHtml}
            </div>
        </div>
    `;

    const mobileDockRecipeHtml = clusterBadgesHtml;
    const mobileDockDrawerHtml = `
        ${indestructibleBannerHtml}
        ${equipmentSectionHtml}
        ${tradeoffsHtml}
        <div class="cluster-targets-grid">
            ${targetCardsHtml}
        </div>
    `;

    return {
        resultsCardHtml,
        mobileDockRecipeHtml,
        mobileDockDrawerHtml,
        isClusterDestroyed,
        isOverCapacity,
        maxArmyCapacity
    };
}
