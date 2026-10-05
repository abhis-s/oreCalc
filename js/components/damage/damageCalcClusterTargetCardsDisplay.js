/**
 * DOM Rendering Engine for Damage Calculator Cluster Target Cards.
 * Tier 4: UI Presentation (Dedicated exclusively to cluster target card DOM rendering, 0 event listeners).
 */

import { spellsData } from '../../data/spellsData.js';
import { equipmentDamageData } from '../../data/equipmentDamageData.js';
import { getBuildingAssetUrl } from '../../core/buildingAssetHelper.js';
import {
    calculateEarthquakeDamageWithCc,
    calculateRequiredZaps,
    isTargetImmuneToSpell
} from '../../domain/damage/damageFormulas.js';
import {
    getMaxSuperchargeTier
} from '../../domain/damage/defenseProgressionDomain.js';
import { translate } from '../../i18n/translator.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import {
    getDefenseDisplayName,
    getEquipmentDisplayName
} from '../../utils/equipmentMetadata.js';
import {
    getLvlShort,
    getHpUnit,
    renderSuperchargePipsHtml
} from './damageCalcDisplay.js';

/**
 * Renders HTML for all cluster target cards within the active combination.
 *
 * @param {Object} params
 * @param {Object} params.activeCombo - The currently active cluster combination.
 * @param {Array<Object>} params.clusterTargets - The selected cluster target definitions.
 * @param {Set<string>} params.activePairs - Set of active adjacent pair keys (e.g. '0-1').
 * @param {number} params.zapLvl - User lightning spell level.
 * @param {number} params.eqLvl - User earthquake spell level.
 * @param {number} [params.ccZapLvl] - Donated lightning spell level.
 * @param {number} [params.ccEqLvl] - Donated earthquake spell level.
 * @param {boolean} [params.isCcZapEnabled=true] - Whether donated lightning is enabled.
 * @returns {string} Target cards HTML string.
 */
export function renderClusterTargetCardsHtml({
    activeCombo,
    clusterTargets,
    activePairs,
    zapLvl,
    eqLvl,
    ccZapLvl = 13,
    ccEqLvl = 8,
    isCcZapEnabled = true
}) {
    const hpUnit = getHpUnit();
    const zapDmg = spellsData.spells.lightning.levels[zapLvl]?.damage || 720;
    const ccZapDmg = (isCcZapEnabled && ccZapLvl)
        ? (spellsData.spells.lightning.levels[ccZapLvl]?.damage || zapDmg)
        : zapDmg;

    let targetCardsHtml = '';
    (activeCombo.targets || []).forEach((tgt, idx) => {
        const defName = getDefenseDisplayName(tgt.defenseKey);
        const defLvl = tgt.level;
        const defMaxHp = tgt.maxHp;
        const superchargeTier = tgt.superchargeTier || 0;

        let currentHp = defMaxHp;
        let actualEquipDmg = 0;
        let actualEqDmg = 0;
        let actualZapDmg = 0;
        let actualZapCount = 0;
        let neededEqCount = 0;
        let effectiveEqDmg = 0;
        let effectiveZapDmg = 0;
        const flowStepsHtml = [];

        // Equipment stages (applied in order until defense is destroyed)
        const appliedEquipDetails = [];
        if (Array.isArray(tgt.equipment) && tgt.equipment.length > 0) {
            for (const item of tgt.equipment) {
                if (currentHp <= 0) break;
                const equip = equipmentDamageData[item.id];
                const equipName = getEquipmentDisplayName(item.id);
                const rawDmg = item.rawDamage || item.damage;
                const effectiveDmg = Math.min(rawDmg, currentHp);
                actualEquipDmg += rawDmg;
                currentHp = Math.max(0, currentHp - effectiveDmg);
                appliedEquipDetails.push({
                    id: item.id,
                    name: equipName,
                    damage: rawDmg,
                    effectiveDamage: effectiveDmg
                });

                flowStepsHtml.push(`
                    <div class="cluster-target-card__damage-step cluster-target-card__equip-stage">
                        <span class="cluster-target-card__equip-pill" title="${escapeHTML(equipName)}">
                            <orecalc-assets-image
                                src="${equip?.icon || ''}"
                                alt="${escapeHTML(equipName)}"
                                class="cluster-target-card__spell-icon"
                                size="thumbnail">
                            </orecalc-assets-image>
                            <span>-${formatNumber(effectiveDmg)} ${hpUnit}</span>
                        </span>
                    </div>
                `);
            }
        }

        // Earthquake stage (only if target still stands and combo uses EQ)
        const sharedEq = activeCombo.sharedEqCount || 0;
        if (currentHp > 0 && sharedEq > 0) {
            for (let k = 1; k <= sharedEq; k++) {
                const testDmg = calculateEarthquakeDamageWithCc(defMaxHp, eqLvl, k, ccEqLvl, tgt.defenseKey);
                if (testDmg >= currentHp || k === sharedEq) {
                    neededEqCount = k;
                    actualEqDmg = testDmg;
                    break;
                }
            }

            if (actualEqDmg > 0 && neededEqCount > 0) {
                effectiveEqDmg = Math.min(actualEqDmg, currentHp);
                currentHp = Math.max(0, currentHp - effectiveEqDmg);
                const eqLabel = translate('views.damageCalc.offense.spellEarthquake') || 'Earthquake';
                flowStepsHtml.push(`
                    <div class="cluster-target-card__damage-step cluster-target-card__eq-stage">
                        <span class="cluster-target-card__eq-pill" title="${neededEqCount}x ${escapeHTML(eqLabel)}">
                            <span class="cluster-target-card__spell-count">${neededEqCount}x</span>
                            <orecalc-assets-image
                                src="/assets/spells/earthquake.png"
                                alt="Earthquake"
                                class="cluster-target-card__spell-icon"
                                size="thumbnail">
                            </orecalc-assets-image>
                            <span>-${formatNumber(effectiveEqDmg)} ${hpUnit}</span>
                        </span>
                    </div>
                `);
            }
        }

        // Lightning stage (only if target still stands and is not immune to Lightning)
        const isImmuneZap = isTargetImmuneToSpell(tgt.defenseKey, 'lightning');
        if (currentHp > 0 && !isImmuneZap) {
            const zapResult = calculateRequiredZaps(currentHp, zapDmg, ccZapDmg);
            if (zapResult.zapsNeeded > 0) {
                actualZapCount = zapResult.zapsNeeded;
                actualZapDmg = zapResult.totalZapDamage;
                effectiveZapDmg = Math.min(actualZapDmg, currentHp);
                currentHp = Math.max(0, currentHp - effectiveZapDmg);
                const zapLabel = translate('views.damageCalc.offense.spellLightning') || 'Lightning';
                flowStepsHtml.push(`
                    <div class="cluster-target-card__damage-step cluster-target-card__zap-stage">
                        <span class="cluster-target-card__zap-pill" title="${actualZapCount}x ${escapeHTML(zapLabel)}">
                            <span class="cluster-target-card__spell-count">${actualZapCount}x</span>
                            <orecalc-assets-image
                                src="/assets/spells/lightning.png"
                                alt="Lightning"
                                class="cluster-target-card__spell-icon"
                                size="thumbnail">
                            </orecalc-assets-image>
                            <span>-${formatNumber(effectiveZapDmg)} ${hpUnit}</span>
                        </span>
                    </div>
                `);
            }
        }

        const separatorHtml = '<span class="cluster-damage-flow__arrow" aria-hidden="true">&rarr;</span>';
        let damageFlowHtml = flowStepsHtml.join(separatorHtml);
        if (currentHp > 0) {
            damageFlowHtml += `${flowStepsHtml.length > 0 ? separatorHtml : ''}<span class="cluster-target-card__rem-hp">${formatNumber(currentHp)} ${hpUnit}</span>`;
            if (isImmuneZap) {
                damageFlowHtml += ` <span class="cluster-target-card__immune-badge" data-i18n="views.damageCalc.zapQuake.immune">${escapeHTML(translate('views.damageCalc.zapQuake.immune') || 'Immune')}</span>`;
            }
        } else if (flowStepsHtml.length === 0) {
            damageFlowHtml = `<span class="cluster-target-card__rem-hp">${formatNumber(defMaxHp)} ${hpUnit}</span>`;
            if (isImmuneZap) {
                damageFlowHtml += ` <span class="cluster-target-card__immune-badge" data-i18n="views.damageCalc.zapQuake.immune">${escapeHTML(translate('views.damageCalc.zapQuake.immune') || 'Immune')}</span>`;
            }
        }

        // Pairwise adjacency toggles with other targets in cluster
        let adjacenciesHtml = '';
        if (clusterTargets.length === 2) {
            const isLinked = activePairs.has('0-1');
            adjacenciesHtml = `
                <div class="cluster-target-card__adjacencies">
                    <button type="button"
                        class="calc-adjacent-toggle ${isLinked ? 'is-active' : ''}"
                        data-action="toggle-adjacent-pair"
                        data-pair="0-1"
                        role="switch"
                        aria-checked="${isLinked}">
                        <orecalc-assets-svg name="zap-filled" width="13" height="13"></orecalc-assets-svg>
                        <span>${escapeHTML(translate('views.damageCalc.zapQuake.sharedLightningToggle') || 'Shared Lightning')}</span>
                    </button>
                </div>
            `;
        } else if (clusterTargets.length > 2) {
            const otherButtons = clusterTargets
                .map((other, otherIdx) => ({ other, otherIdx }))
                .filter(({ otherIdx }) => otherIdx !== idx)
                .map(({ other, otherIdx }) => {
                    const pairKey = `${Math.min(idx, otherIdx)}-${Math.max(idx, otherIdx)}`;
                    const isLinked = activePairs.has(pairKey);
                    const otherName = getDefenseDisplayName(other.defenseKey);
                    const otherThumb = getBuildingAssetUrl(other.defenseKey, other.level);
                    return `
                        <button type="button"
                            class="calc-adjacent-toggle ${isLinked ? 'is-active' : ''}"
                            data-action="toggle-adjacent-pair"
                            data-pair="${pairKey}"
                            role="switch"
                            aria-checked="${isLinked}"
                            aria-label="${escapeHTML(otherName)} (#${otherIdx + 1})"
                            title="${escapeHTML(otherName)}">
                            <orecalc-assets-svg name="zap-filled" width="11" height="11" class="calc-adjacent-toggle__zap"></orecalc-assets-svg>
                            <orecalc-assets-image src="${otherThumb}" alt="" size="thumbnail" class="calc-adjacent-toggle__thumb"></orecalc-assets-image>
                            <span class="calc-adjacent-toggle__index">#${otherIdx + 1}</span>
                            <span class="calc-adjacent-toggle__name">${escapeHTML(otherName)}</span>
                        </button>
                    `;
                }).join('');

            adjacenciesHtml = `
                <div class="cluster-target-card__adjacencies">
                    <span class="cluster-target-card__adj-label">${escapeHTML(translate('views.damageCalc.zapQuake.sharedLightningToggle') || 'Shared Lightning')}:</span>
                    <div class="cluster-target-card__adj-buttons">
                        ${otherButtons}
                    </div>
                </div>
            `;
        }

        targetCardsHtml += `
            <div class="cluster-target-card"
                data-cluster-target-index="${idx}"
                data-building-key="${tgt.defenseKey}"
                data-building-level="${defLvl}"
                data-supercharge="${superchargeTier}"
                data-max-hp="${defMaxHp}"
                data-equip-dmg="${actualEquipDmg}"
                data-equipment-json="${escapeHTML(JSON.stringify(appliedEquipDetails))}"
                data-eq-dmg="${actualEqDmg}"
                data-shared-eq="${neededEqCount}"
                data-zap-count="${actualZapCount}"
                data-zap-dmg="${actualZapDmg}"
                data-rem-hp="${currentHp}">
                <div class="cluster-target-card__header">
                    <div class="cluster-target-card__identity">
                        <span class="cluster-target-card__index">#${idx + 1}</span>
                        <orecalc-assets-image
                            src="${getBuildingAssetUrl(tgt.defenseKey, defLvl)}"
                            alt="${escapeHTML(defName)}"
                            class="cluster-target-card__thumb"
                            size="thumbnail">
                        </orecalc-assets-image>
                        <div class="cluster-target-card__meta">
                            <div class="cluster-target-card__name-row">
                                <span class="cluster-target-card__name">${escapeHTML(defName)}</span>
                                <button type="button" class="calc-info-btn" data-cluster-target-info="true" aria-label="${escapeHTML(translate('actions.showInfo'))}" data-i18n-aria-label="actions.showInfo">
                                    <orecalc-assets-svg name="info" width="12" height="12"></orecalc-assets-svg>
                                </button>
                            </div>
                            <span class="cluster-target-card__level">
                                ${getLvlShort(tgt.defenseKey)} ${defLvl}
                                ${superchargeTier > 0 ? `
                                    <span class="cluster-target-card__supercharge" title="${escapeHTML(translate('views.damageCalc.offense.superchargeLabel'))} &middot; ${escapeHTML(translate('views.damageCalc.zapQuake.tierLabel', { tier: superchargeTier }))}">
                                         ${renderSuperchargePipsHtml(superchargeTier, getMaxSuperchargeTier(tgt.defenseKey, defLvl), { variant: 'compact' })}
                                    </span>
                                ` : ''}
                            </span>
                        </div>
                    </div>
                    <span class="cluster-target-card__hp">${formatNumber(defMaxHp)} ${hpUnit}</span>
                </div>

                <div class="cluster-target-card__body">
                    <div class="cluster-target-card__damage-flow">
                        ${damageFlowHtml}
                    </div>
                    ${adjacenciesHtml}
                </div>
            </div>
        `;
    });

    return targetCardsHtml;
}
