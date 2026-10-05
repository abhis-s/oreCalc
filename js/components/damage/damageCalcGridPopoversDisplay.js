/**
 * DOM Rendering Engine for Damage Calculator Grid & Target Popovers (Combos, Clusters, Casualties).
 * Tier 4: UI Presentation (Dedicated exclusively to popover HTML generation, 0 event listeners).
 */

import { getDefensesData } from '../../data/defenseTargetsData.js';
import { spellsData } from '../../data/spellsData.js';
import { equipmentDamageData } from '../../data/equipmentDamageData.js';
import { getBuildingAssetUrl } from '../../core/buildingAssetHelper.js';
import { solveZapQuakeCombinations } from '../../domain/damage/zapQuakeSolver.js';
import { simulateSequenceAcrossAllDefenses } from '../../domain/damage/attackSimulator.js';
import { calculateEquipmentDamage } from '../../domain/damage/equipmentDamage.js';
import {
    calculateEarthquakeDamage,
    getEffectiveEquipmentLevel
} from '../../domain/damage/damageFormulas.js';
import {
    getMaxSuperchargeTier,
    getMaxDefenseLevelForTownHall,
    canEquipmentTarget,
    isUnitTarget
} from '../../domain/damage/defenseProgressionDomain.js';
import { translate } from '../../i18n/translator.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { safeJsonParse } from '../../utils/jsonUtils.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { getActiveModifier, getShownTownHall } from './damageCalcState.js';
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
    getLightningStatsPopoverContent,
    getEarthquakeStatsPopoverContent,
    getEquipmentStatsPopoverContent
} from './damageCalcOffensePopoversDisplay.js';

/**
 * Builds damage breakdown popover for a defense targeted by a spell/equipment combination.
 * @param {HTMLElement} elem
 * @param {Object} state
 * @returns {{ header: string, body: string } | null}
 */
export function getComboBreakdownPopoverContent(elem, state) {
    const card = /** @type {HTMLElement | null} */ (
        elem?.closest
            ? (elem.closest('.calc-combo-defense-card, [data-combo-row-index], .calc-target-combo-row'))
            : elem
    );
    if (!card) return null;

    const buildingKey = card.dataset?.buildingTarget || card.dataset?.buildingKey || card.getAttribute?.('data-building-target') || card.getAttribute?.('data-building-key');
    const level = Number(card.dataset?.buildingLevel ?? card.getAttribute?.('data-building-level')) || 1;
    const supercharge = Number(card.dataset?.supercharge ?? card.getAttribute?.('data-supercharge')) || 0;
    const eqCount = Number(card.dataset?.eqCount ?? card.getAttribute?.('data-eq-count')) || 0;
    const zapCount = Number(card.dataset?.zapCount ?? card.getAttribute?.('data-zap-count')) || 0;
    const maxHp = Number(card.dataset?.maxHp ?? card.dataset?.targetHp ?? card.getAttribute?.('data-max-hp') ?? card.getAttribute?.('data-target-hp')) || 0;
    const equip = safeJsonParse(card.dataset?.equip ?? card.getAttribute?.('data-equip'), []);

    const def = getDefensesData()[buildingKey || ''];
    if (!def) return null;

    const defName = getDefenseDisplayName(buildingKey);
    const zapLvl = Number(card.dataset?.zapLevel ?? card.getAttribute?.('data-zap-level')) || (state.offense?.spells?.lightning || 13);
    const eqLvl = Number(card.dataset?.eqLevel ?? card.getAttribute?.('data-eq-level')) || (state.offense?.spells?.earthquake || 8);
    const ccZapLvl = Number(card.dataset?.ccZapLevel ?? card.getAttribute?.('data-cc-zap-level')) || (state.offense?.ccSpells?.lightning || zapLvl);
    const ccEqLvl = Number(card.dataset?.ccEqLevel ?? card.getAttribute?.('data-cc-eq-level')) || (state.offense?.ccSpells?.earthquake || eqLvl);
    const zapDmg = spellsData.spells?.lightning?.levels?.[zapLvl]?.damage || 720;
    const ccZapDmg = spellsData.spells?.lightning?.levels?.[ccZapLvl]?.damage || zapDmg;
    const lvlShort = getLvlShort();
    const hpUnit = getHpUnit();

    if (card.dataset?.isRemaining === 'true' || card.getAttribute?.('data-is-remaining') === 'true') {
        const isImmuneLightning = Boolean(def.immunities?.lightning);
        const isImmuneEarthquake = Boolean(def.immunities?.earthquake);
        const immuneLabel = translate('views.damageCalc.zapQuake.immune');

        // Resolve whether lightning or earthquake is enabled in active offense loadout
        const rawEnabledSpells = card.dataset?.enabledSpells ?? card.getAttribute?.('data-enabled-spells');
        let isLightningEnabled = true;
        let isEarthquakeEnabled = true;

        if (rawEnabledSpells) {
            const parsed = safeJsonParse(rawEnabledSpells, null);
            if (parsed) {
                isLightningEnabled = Boolean(parsed.lightning || parsed.cc_lightning);
                isEarthquakeEnabled = Boolean(parsed.earthquake || parsed.cc_earthquake);
            }
        } else if (state?.offense?.enabledSources) {
            const src = state.offense.enabledSources;
            isLightningEnabled = (src.lightning !== false) || (src.cc_lightning !== false);
            isEarthquakeEnabled = (src.earthquake !== false) || (src.cc_earthquake !== false);
        }

        let bestAttempt = null;
        const rawBestAttempt = card.dataset?.bestAttempt ?? card.getAttribute?.('data-best-attempt');
        if (rawBestAttempt) {
            bestAttempt = safeJsonParse(rawBestAttempt, null);
        }

        if (!bestAttempt) {
            const activeMod = getActiveModifier(state);
            const enabledEquipment = [];
            if (Array.isArray(equip) && equip.length > 0) {
                for (const eqItem of equip) {
                    if (canEquipmentTarget(eqItem.id, buildingKey, level)) {
                        enabledEquipment.push(eqItem);
                    }
                }
            } else if (state?.offense?.enabledSources) {
                for (const [key, enabled] of Object.entries(state.offense.enabledSources)) {
                    if (enabled && equipmentDamageData[key] && canEquipmentTarget(key, buildingKey, level)) {
                        const rawLvl = state.offense.equipment?.[key] || (equipmentDamageData[key].rarity === 'epic' ? 27 : 18);
                        enabledEquipment.push({ id: key, level: rawLvl, rawLevel: rawLvl });
                    }
                }
            }

            const solution = solveZapQuakeCombinations(buildingKey, level, zapLvl, eqLvl, {
                superchargeTier: supercharge,
                townHallLevel: getShownTownHall(state),
                enabledSpells: {
                    lightning: isLightningEnabled,
                    earthquake: isEarthquakeEnabled,
                    cc_lightning: Boolean(state?.offense?.ccSpells?.lightning && (state?.offense?.enabledSources?.cc_lightning !== false)),
                    cc_earthquake: Boolean(state?.offense?.ccSpells?.earthquake && (state?.offense?.enabledSources?.cc_earthquake !== false))
                },
                enabledEquipment,
                leagueId: activeMod || 'standard',
                ccSpells: {
                    lightning: state?.offense?.ccSpells?.lightning ? ccZapLvl : null,
                    earthquake: state?.offense?.ccSpells?.earthquake ? ccEqLvl : null
                }
            });
            bestAttempt = solution.bestAttempt;
        }

        const totalDamage = bestAttempt?.totalDamage ?? 0;
        const remainingHp = bestAttempt?.remainingHp ?? maxHp;
        const pctDealt = bestAttempt?.percentDealt != null
            ? bestAttempt.percentDealt.toFixed(1)
            : (maxHp > 0 ? ((totalDamage / maxHp) * 100).toFixed(1) : '0.0');
        const pctRemaining = bestAttempt?.percentRemaining != null
            ? bestAttempt.percentRemaining.toFixed(1)
            : (maxHp > 0 ? ((remainingHp / maxHp) * 100).toFixed(1) : '100.0');

        const rows = [];

        // Equipment breakdown rows
        if (Array.isArray(bestAttempt?.equipment) && bestAttempt.equipment.length > 0) {
            for (const item of bestAttempt.equipment) {
                const eqName = getEquipmentDisplayName(item.id);
                const levelAnnotation = ` (${lvlShort} ${item.level})`;
                rows.push({
                    name: `${eqName}${levelAnnotation}`,
                    value: `-${formatNumber(item.damage)} ${hpUnit}`
                });
            }
        }

        // Earthquake breakdown row (only show immunity if earthquake was enabled)
        const eqSpellName = translate('views.damageCalc.offense.spellEarthquake') || 'Earthquake';
        if (isImmuneEarthquake) {
            if (isEarthquakeEnabled) {
                rows.push({
                    name: eqSpellName,
                    value: `0 ${hpUnit} (${immuneLabel})`
                });
            }
        } else if ((bestAttempt?.eqCount || 0) > 0) {
            const eqCount = bestAttempt.eqCount;
            const eqDmg = bestAttempt.eqDamage || 0;
            const eqPct = maxHp > 0 ? ((eqDmg / maxHp) * 100).toFixed(1) : '0.0';
            rows.push({
                name: `${eqCount}x ${eqSpellName} (${eqPct}%)`,
                value: `-${formatNumber(eqDmg)} ${hpUnit}`
            });
        }

        // Lightning breakdown row (only show immunity if lightning was enabled)
        const zapSpellName = translate('views.damageCalc.offense.spellLightning') || 'Lightning';
        if (isImmuneLightning) {
            if (isLightningEnabled) {
                rows.push({
                    name: zapSpellName,
                    value: `0 ${hpUnit} (${immuneLabel})`
                });
            }
        } else if ((bestAttempt?.zapCount || 0) > 0) {
            const zapCount = bestAttempt.zapCount;
            const zapDmgVal = bestAttempt.zapDamage || 0;
            rows.push({
                name: `${zapCount}x ${zapSpellName} (${formatNumber(zapDmg)} ${translate('views.damageCalc.zapQuake.each') || 'each'})`,
                value: `-${formatNumber(zapDmgVal)} ${hpUnit}`
            });
        }

        let rowsHtml = '';
        for (const r of rows) {
            rowsHtml += `
                <div class="calc-breakdown-row">
                    <span>${escapeHTML(r.name)}</span>
                    <span class="font-weight-semibold">${escapeHTML(r.value)}</span>
                </div>
            `;
        }

        const totalDamageLabel = translate('views.damageCalc.zapQuake.totalDamageLabel');
        const remainingHpLabel = translate('views.damageCalc.zapQuake.remainingHp');

        const maxTiers = getMaxSuperchargeTier(buildingKey || '', level);
        const superchargeHtml = supercharge > 0
            ? ` ${renderSuperchargePipsHtml(supercharge, maxTiers, { variant: 'compact' })}`
            : '';

        return {
            header: `
                <orecalc-assets-image src="${getBuildingAssetUrl(buildingKey, level)}" alt="${escapeHTML(defName)}" class="popover-img"></orecalc-assets-image>
                <div class="popover-title-group">
                    <span class="popover-title">${escapeHTML(defName)} (${escapeHTML(getLvlShort(buildingKey))} ${level})${superchargeHtml}</span>
                    <span class="popover-badge font-color-warning">${formatNumber(maxHp)} ${hpUnit}</span>
                </div>
            `,
            body: `
                <div class="calc-breakdown-list">
                    ${rowsHtml}
                    <div class="calc-breakdown-row calc-breakdown-row--total">
                        <span>${escapeHTML(totalDamageLabel)}</span>
                        <span>${totalDamage > 0 ? '-' + formatNumber(totalDamage) : '0'} ${hpUnit} (${pctDealt}%)</span>
                    </div>
                    <div class="calc-breakdown-row calc-breakdown-row--remaining">
                        <span>${escapeHTML(remainingHpLabel)}</span>
                        <span>${formatNumber(remainingHp)} ${hpUnit} (${pctRemaining}%)</span>
                    </div>
                </div>
            `
        };
    }

    let totalDamage = 0;
    const rows = [];

    if (Array.isArray(equip)) {
        for (const eqItem of equip) {
            const eqData = equipmentDamageData[eqItem.id];
            const rawLvl = eqItem.rawLevel || eqItem.level || state?.offense?.equipment?.[eqItem.id] || (eqData?.rarity === 'epic' ? 27 : 18);
            const activeMod = getActiveModifier(state);
            const effLvl = getEffectiveEquipmentLevel(eqItem.id, rawLvl, activeMod);
            const eqResult = calculateEquipmentDamage(eqItem.id, rawLvl, buildingKey || '', level, {
                modifier: activeMod,
                leagueId: activeMod,
                superchargeTier: supercharge
            });
            const dmg = eqResult.rawDamage || eqResult.damageDealt;
            const isGaAirDef = eqItem.id === 'giant_arrow' && buildingKey === 'air_defense';
            totalDamage += dmg;
            const levelAnnotation = ` (${lvlShort} ${effLvl})`;
            const eqDisplayName = getEquipmentDisplayName(eqItem.id);
            const adDisplayName = getDefenseDisplayName('air_defense');
            rows.push({
                name: `${eqDisplayName}${levelAnnotation}${isGaAirDef ? ` (2x ${adDisplayName})` : ''}`,
                dmg: `-${formatNumber(dmg)} ${hpUnit}`
            });
        }
    }

    const regEqAttr = card.dataset?.regEq ?? card.getAttribute?.('data-reg-eq');
    const ccEqAttr = card.dataset?.ccEq ?? card.getAttribute?.('data-cc-eq');
    let regEqCount = regEqAttr != null ? (Number(regEqAttr) || 0) : eqCount;
    let ccEqCount = ccEqAttr != null ? (Number(ccEqAttr) || 0) : 0;
    if (regEqCount + ccEqCount === 0 && eqCount > 0) {
        regEqCount = eqCount;
    }

    const eqStrikes = [];
    if (ccEqLvl > eqLvl) {
        for (let i = 0; i < ccEqCount; i++) eqStrikes.push({ level: ccEqLvl, isCc: true });
        for (let i = 0; i < regEqCount; i++) eqStrikes.push({ level: eqLvl, isCc: false });
    } else {
        for (let i = 0; i < regEqCount; i++) eqStrikes.push({ level: eqLvl, isCc: false });
        for (let i = 0; i < ccEqCount; i++) eqStrikes.push({ level: ccEqLvl, isCc: true });
    }

    let damagingStrikeIndex = 1;
    const isHeroOrUnit = isUnitTarget(def);
    for (let i = 1; i <= eqStrikes.length; i++) {
        const strike = eqStrikes[i - 1];
        const lvlData = spellsData.spells?.earthquake?.levels?.[strike.level];
        const rawPct = isHeroOrUnit
            ? (lvlData?.troopDamagePct ?? 0)
            : (lvlData?.damagePct || 0.29);
        const basePct = rawPct * 100;
        const divider = (2 * damagingStrikeIndex) - 1;
        const strikePct = basePct / divider;
        const dmg = calculateEarthquakeDamage(maxHp, strike.level, damagingStrikeIndex, def);
        if (dmg > 0) damagingStrikeIndex++;
        totalDamage += dmg;
        const ccAbbr = translate('views.damageCalc.offense.clanCastleAbbr');
        rows.push({
            name: `${translate('views.damageCalc.offense.spellEarthquake') || 'Earthquake'} #${i}${strike.isCc ? ` (${ccAbbr})` : ''} (${strikePct.toFixed(1)}%)`,
            dmg: `-${formatNumber(dmg)} ${hpUnit}`
        });
    }

    const regZapAttr = card.dataset?.regZap ?? card.getAttribute?.('data-reg-zap');
    const ccZapAttr = card.dataset?.ccZap ?? card.getAttribute?.('data-cc-zap');
    let regZapCount = regZapAttr != null ? (Number(regZapAttr) || 0) : zapCount;
    let ccZapCount = ccZapAttr != null ? (Number(ccZapAttr) || 0) : 0;
    if (regZapCount + ccZapCount === 0 && zapCount > 0) {
        regZapCount = zapCount;
    }

    if (regZapCount > 0) {
        const totalRegZapDmg = regZapCount * zapDmg;
        totalDamage += totalRegZapDmg;
        rows.push({
            name: `${regZapCount}x ${translate('views.damageCalc.offense.spellLightning') || 'Lightning'} (${formatNumber(zapDmg)} ${translate('views.damageCalc.zapQuake.each') || 'each'})`,
            dmg: `-${formatNumber(totalRegZapDmg)} ${hpUnit}`
        });
    }

    if (ccZapCount > 0) {
        const totalCcZapDmg = ccZapCount * ccZapDmg;
        totalDamage += totalCcZapDmg;
        const ccAbbr = translate('views.damageCalc.offense.clanCastleAbbr');
        rows.push({
            name: `${ccZapCount}x ${translate('views.damageCalc.offense.spellLightning') || 'Lightning'} (${ccAbbr}) (${formatNumber(ccZapDmg)} ${translate('views.damageCalc.zapQuake.each') || 'each'})`,
            dmg: `-${formatNumber(totalCcZapDmg)} ${hpUnit}`
        });
    }

    const overkill = totalDamage - maxHp;
    const isOverkill = overkill >= 0;

    let rowsHtml = '';
    for (const r of rows) {
        rowsHtml += `
            <div class="calc-breakdown-row">
                <span>${escapeHTML(r.name)}</span>
                <span class="font-weight-semibold">${escapeHTML(r.dmg)}</span>
            </div>
        `;
    }

    const overkillLabel = translate('views.damageCalc.zapQuake.overkillLabel');
    const remainingLabel = translate('views.damageCalc.zapQuake.remainingHp');
    rowsHtml += `
        <div class="calc-breakdown-row ${isOverkill ? 'calc-breakdown-row--overkill' : 'calc-breakdown-row--remaining'}">
            <span>${escapeHTML(isOverkill ? overkillLabel : remainingLabel)}</span>
            <span>${isOverkill ? '+' + formatNumber(overkill) + ' ' + hpUnit : formatNumber(maxHp - totalDamage) + ' ' + hpUnit}</span>
        </div>
    `;

    const maxTiers = getMaxSuperchargeTier(buildingKey || '', level);
    const superchargeHtml = supercharge > 0
        ? ` ${renderSuperchargePipsHtml(supercharge, maxTiers, { variant: 'compact' })}`
        : '';

    return {
        header: `
            <orecalc-assets-image src="${getBuildingAssetUrl(buildingKey, level)}" alt="${escapeHTML(defName)}" class="popover-img"></orecalc-assets-image>
            <div class="popover-title-group">
                <span class="popover-title">${escapeHTML(defName)} (${escapeHTML(getLvlShort(buildingKey))} ${level})${superchargeHtml}</span>
                <span class="popover-badge">${formatNumber(maxHp)} ${hpUnit}</span>
            </div>
        `,
        body: `<div class="calc-breakdown-list">${rowsHtml}</div>`
    };
}

/**
 * Builds damage breakdown popover for a cluster target card.
 * @param {HTMLElement} elem
 * @returns {{ header: string, body: string } | null}
 */
export function getClusterTargetPopoverContent(elem) {
    const card = /** @type {HTMLElement | null} */ (
        elem?.closest
            ? (elem.closest('.cluster-target-card') || elem.closest('[data-cluster-target-info]'))
            : elem
    );
    if (!card) return null;

    const buildingKey = card.dataset?.buildingKey || card.getAttribute?.('data-building-key') || '';
    const level = Number(card.dataset?.buildingLevel ?? card.getAttribute?.('data-building-level')) || 1;
    const supercharge = Number(card.dataset?.supercharge ?? card.getAttribute?.('data-supercharge')) || 0;
    const maxHp = Number(card.dataset?.maxHp ?? card.getAttribute?.('data-max-hp')) || 0;
    const eqDmg = Number(card.dataset?.eqDmg ?? card.getAttribute?.('data-eq-dmg')) || 0;
    const remHp = Number(card.dataset?.remHp ?? card.getAttribute?.('data-rem-hp')) || 0;
    const zapCt = Number(card.dataset?.zapCount ?? card.getAttribute?.('data-zap-count')) || 0;
    const zapDmg = Number(card.dataset?.zapDmg ?? card.getAttribute?.('data-zap-dmg')) || 0;
    const sharedEq = Number(card.dataset?.sharedEq ?? card.getAttribute?.('data-shared-eq')) || 0;

    const def = getDefensesData()[buildingKey || ''];
    if (!def) return null;

    const defName = getDefenseDisplayName(buildingKey);
    const lvlShort = getLvlShort(buildingKey);
    const hpUnit = getHpUnit();

    // Parse applied equipment if present
    const rawEquipJson = card.dataset?.equipmentJson ?? card.getAttribute?.('data-equipment-json');
    let rawEquipStr = rawEquipJson;
    if (typeof rawEquipStr === 'string' && rawEquipStr.includes('&quot;')) {
        rawEquipStr = rawEquipStr.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    }
    const appliedEquip = safeJsonParse(rawEquipStr, []);

    let totalDamage = 0;
    const rows = [];

    // Equipment stages
    if (Array.isArray(appliedEquip) && appliedEquip.length > 0) {
        for (const item of appliedEquip) {
            const eqDisplayName = item.name || getEquipmentDisplayName(item.id);
            const dmg = Number(item.rawDamage || item.damage) || 0;
            totalDamage += dmg;
            rows.push({
                name: eqDisplayName,
                dmg: `-${formatNumber(dmg)} ${hpUnit}`
            });
        }
    } else {
        const singleEquipDmg = Number(card.dataset?.equipDmg ?? card.getAttribute?.('data-equip-dmg')) || 0;
        if (singleEquipDmg > 0) {
            totalDamage += singleEquipDmg;
            rows.push({
                name: translate('nav.equipment'),
                dmg: `-${formatNumber(singleEquipDmg)} ${hpUnit}`
            });
        }
    }

    // Earthquake stage
    if (sharedEq > 0 && eqDmg > 0) {
        totalDamage += eqDmg;
        const sharedEqLabel = translate('views.damageCalc.popovers.sharedEarthquake', { count: sharedEq });
        rows.push({
            name: sharedEqLabel,
            dmg: `-${formatNumber(eqDmg)} ${hpUnit}`
        });
    }

    // Lightning stage
    if (zapCt > 0) {
        const effectiveZapDmg = zapDmg > 0 ? zapDmg : Math.max(0, maxHp - totalDamage - remHp);
        totalDamage += effectiveZapDmg;
        const zapSpellName = translate('views.damageCalc.offense.spellLightning');
        const zapLabel = `${zapCt}x ${zapSpellName}`;
        rows.push({
            name: zapLabel,
            dmg: `-${formatNumber(effectiveZapDmg)} ${hpUnit}`
        });
    }

    let rowsHtml = '';
    for (const r of rows) {
        rowsHtml += `
            <div class="calc-breakdown-row">
                <span>${escapeHTML(r.name)}</span>
                <span class="font-weight-semibold font-color-danger">${escapeHTML(r.dmg)}</span>
            </div>
        `;
    }

    // Terminal Overkill or Remaining row
    const overkill = totalDamage - maxHp;
    const isDestroyed = overkill >= 0 || remHp <= 0;
    const overkillLabel = translate('views.damageCalc.zapQuake.overkillLabel');
    const remainingLabel = translate('views.income.remaining');

    rowsHtml += `
        <div class="calc-breakdown-row ${isDestroyed ? 'calc-breakdown-row--overkill' : 'calc-breakdown-row--remaining'}">
            <span>${escapeHTML(isDestroyed ? overkillLabel : remainingLabel)}</span>
            <span>${isDestroyed ? '+' + formatNumber(Math.max(0, overkill)) + ' ' + hpUnit : formatNumber(Math.max(0, maxHp - totalDamage)) + ' ' + hpUnit}</span>
        </div>
    `;

    const maxTiers = getMaxSuperchargeTier(buildingKey || '', level);
    const superchargeHtml = supercharge > 0
        ? ` ${renderSuperchargePipsHtml(supercharge, maxTiers, { variant: 'compact' })}`
        : '';

    return {
        header: `
            <orecalc-assets-image src="${getBuildingAssetUrl(buildingKey, level)}" alt="${escapeHTML(defName)}" class="popover-img"></orecalc-assets-image>
            <div class="popover-title-group">
                <span class="popover-title">${escapeHTML(defName)} (${escapeHTML(lvlShort)} ${level})${superchargeHtml}</span>
                <span class="popover-badge font-color-warning">${formatNumber(maxHp)} ${hpUnit}</span>
            </div>
        `,
        body: `<div class="calc-breakdown-list">${rowsHtml}</div>`
    };
}

/**
 * Builds damage breakdown popover for a casualty card.
 * @param {HTMLElement} elem
 * @param {Object} state
 * @returns {{ header: string, body: string } | null}
 */
export function getCasualtyPopoverContent(elem, state) {
    const card = /** @type {HTMLElement | null} */ (
        elem?.closest
            ? (elem.closest('.calc-casualty-card, [data-casualty-info]') || elem.closest('[data-casualty-info-btn]'))
            : elem
    );
    if (!card) return null;

    const buildingKey = card.dataset?.casualtyInfo || card.getAttribute?.('data-casualty-info') || card.dataset?.casualtyInfoBtn || card.getAttribute?.('data-casualty-info-btn');
    if (!buildingKey) return null;

    const activeMod = getActiveModifier(state);
    const multiSim = simulateSequenceAcrossAllDefenses(state.simulator.steps, {
        modifier: activeMod,
        leagueId: activeMod,
        townHallLevel: getShownTownHall(state),
        defenseLevelOverrides: state.defenseLevelOverrides || {},
        defenseSuperchargeOverrides: state.defenseSuperchargeOverrides || {}
    });

    const rec = multiSim.find(c => c.defenseKey === buildingKey);
    if (!rec) return null;

    const defName = getDefenseDisplayName(buildingKey);
    const strikeLogs = rec.strikeLog || rec.timeline || [];
    const hpUnit = getHpUnit();

    let rowsHtml = '';
    if (strikeLogs.length > 0) {
        for (const t of strikeLogs) {
            const isHeal = t.damageDealt < 0;
            const dmgText = isHeal
                ? `+${formatNumber(Math.abs(t.damageDealt))} ${hpUnit}`
                : (t.damageDealt > 0 ? `-${formatNumber(t.damageDealt)} ${hpUnit}` : `0 ${hpUnit}`);
            rowsHtml += `
                <div class="calc-breakdown-row">
                    <span>#${t.stepIndex} ${escapeHTML(t.name || t.id)}</span>
                    <span class="font-weight-semibold ${isHeal ? 'font-color-success' : 'font-color-danger'}">${dmgText}</span>
                </div>
            `;
        }
    } else {
        rowsHtml = `<div class="calc-breakdown-row"><span>${escapeHTML(translate('views.damageCalc.zapQuake.noStrikesDealt') || 'No strikes dealt.')}</span></div>`;
    }

    const statusLabel = translate('views.damageCalc.popovers.status');
    const destroyedLabel = translate('views.damageCalc.filters.filterDestroyed');
    const survivesLabel = translate('views.damageCalc.filters.filterSurvived');
    const statusText = rec.isDestroyed
        ? `${destroyedLabel} (+${formatNumber(rec.overkill || 0)} ${hpUnit})`
        : `${survivesLabel} (${formatNumber(rec.remainingHp || 0)} ${hpUnit})`;

    rowsHtml += `
        <div class="calc-breakdown-row calc-breakdown-row--total">
            <span>${escapeHTML(translate('views.damageCalc.zapQuake.totalDamageLabel'))}</span>
            <span>${formatNumber(rec.totalDamageDealt)} ${hpUnit}</span>
        </div>
        <div class="calc-breakdown-row ${rec.isDestroyed ? 'calc-breakdown-row--overkill' : 'calc-breakdown-row--remaining'}">
            <span>${escapeHTML(statusLabel)}</span>
            <span>${escapeHTML(statusText)}</span>
        </div>
    `;

    const maxTiers = getMaxSuperchargeTier(buildingKey, rec.level || 1);
    const supercharge = (rec && rec.supercharge) || 0;
    const superchargeHtml = supercharge > 0
        ? ` ${renderSuperchargePipsHtml(supercharge, maxTiers, { variant: 'compact' })}`
        : '';

    return {
        header: `
            <orecalc-assets-image src="${getBuildingAssetUrl(buildingKey, rec.level || 1)}" alt="${escapeHTML(defName)}" class="popover-img"></orecalc-assets-image>
            <div class="popover-title-group">
                <span class="popover-title">${escapeHTML(defName)} (${escapeHTML(getLvlShort(buildingKey))} ${rec.level || 1})${superchargeHtml}</span>
                <span class="popover-badge">${formatNumber(rec.initialHp)} ${hpUnit}</span>
            </div>
        `,
        body: `<div class="calc-breakdown-list">${rowsHtml}</div>`
    };
}

/**
 * Infers target scope ('buildings' | 'troops' | 'both') from element attributes or surrounding card context.
 *
 * @param {HTMLElement} elem
 * @returns {'buildings' | 'troops' | 'both'}
 */
function resolveTargetScopeFromContext(elem) {
    const directScope = elem?.dataset?.targetScope || elem?.getAttribute?.('data-target-scope');
    if (directScope === 'buildings' || directScope === 'troops' || directScope === 'both') {
        return directScope;
    }
    const container = elem?.closest?.('.calc-combo-card, .calc-cluster-result-card, .calc-combo-row, .calc-combo-group');
    if (!container) return 'buildings';

    const targetNodes = container.querySelectorAll?.('[data-building-key], [data-defense-key]');
    if (!targetNodes || targetNodes.length === 0) return 'buildings';

    let hasBuildings = false;
    let hasUnits = false;
    targetNodes.forEach(node => {
        const key = node.getAttribute('data-building-key') || node.getAttribute('data-defense-key');
        if (!key) return;
        const def = getDefensesData()[key];
        if (def?.category === 'hero' || def?.category === 'guardian') {
            hasUnits = true;
        } else {
            hasBuildings = true;
        }
    });

    if (hasBuildings && hasUnits) return 'both';
    if (hasUnits) return 'troops';
    return 'buildings';
}

/**
 * Resolves content for combo card badges (equipment, earthquake, lightning, cc_earthquake, cc_lightning).
 *
 * @param {HTMLElement} elem - Badge element.
 * @param {string} badgeType - 'equipment' | 'earthquake' | 'lightning' | 'cc_earthquake' | 'cc_lightning'.
 * @param {Object} [state] - Damage calculator state.
 * @returns {{ header: string, body: string } | null}
 */
export function getComboBadgePopoverContent(elem, badgeType, state) {
    if (!elem) return null;

    if (badgeType === 'equipment') {
        const equipId = elem.dataset?.equipId || elem.getAttribute?.('data-equip-id') || '';
        const equipLevel = Number(elem.dataset?.equipLevel ?? elem.getAttribute?.('data-equip-level')) || 18;
        const rawLevelAttr = elem.dataset?.equipRawLevel ?? elem.getAttribute?.('data-equip-raw-level');
        const rawLevel = rawLevelAttr ? (Number(rawLevelAttr) || equipLevel) : equipLevel;
        const activeMod = getActiveModifier(state);
        return getEquipmentStatsPopoverContent(equipId, equipLevel, { modifier: activeMod, leagueId: activeMod, rawLevel, isCombo: true });
    }
    if (badgeType === 'earthquake') {
        const eqCount = Number(elem.dataset?.eqCount ?? elem.getAttribute?.('data-eq-count')) || 1;
        const eqLevel = Number(elem.dataset?.eqLevel ?? elem.getAttribute?.('data-eq-level')) || (state?.offense?.spells?.earthquake || 8);
        const ccAttr = elem.dataset?.ccEqLevel ?? elem.getAttribute?.('data-cc-eq-level');
        const ccEqLevel = ccAttr ? (Number(ccAttr) || null) : null;
        const targetScope = resolveTargetScopeFromContext(elem);
        return getEarthquakeStatsPopoverContent({ level: eqLevel, count: eqCount, isCombo: true, ccLevel: ccEqLevel, targetScope });
    }
    if (badgeType === 'cc_earthquake') {
        const eqCount = Number(elem.dataset?.eqCount ?? elem.getAttribute?.('data-eq-count')) || 1;
        const ccAttr = elem.dataset?.ccEqLevel ?? elem.getAttribute?.('data-cc-eq-level');
        const ccEqLevel = ccAttr ? (Number(ccAttr) || 8) : (state?.offense?.ccSpells?.earthquake || 8);
        const targetScope = resolveTargetScopeFromContext(elem);
        return getEarthquakeStatsPopoverContent({ level: ccEqLevel, count: eqCount, isCombo: true, isCc: true, targetScope });
    }
    if (badgeType === 'lightning') {
        const zapCount = Number(elem.dataset?.zapCount ?? elem.getAttribute?.('data-zap-count')) || 1;
        const zapLevel = Number(elem.dataset?.zapLevel ?? elem.getAttribute?.('data-zap-level')) || (state?.offense?.spells?.lightning || 13);
        const ccAttr = elem.dataset?.ccZapLevel ?? elem.getAttribute?.('data-cc-zap-level');
        const ccZapLevel = ccAttr ? (Number(ccAttr) || null) : null;
        return getLightningStatsPopoverContent({ level: zapLevel, count: zapCount, isCombo: true, ccLevel: ccZapLevel });
    }
    if (badgeType === 'cc_lightning') {
        const zapCount = Number(elem.dataset?.zapCount ?? elem.getAttribute?.('data-zap-count')) || 1;
        const ccAttr = elem.dataset?.ccZapLevel ?? elem.getAttribute?.('data-cc-zap-level');
        const ccZapLevel = ccAttr ? (Number(ccAttr) || 13) : (state?.offense?.ccSpells?.lightning || 13);
        return getLightningStatsPopoverContent({ level: ccZapLevel, count: zapCount, isCombo: true, isCc: true });
    }
    if (badgeType === 'remaining') {
        const title = translate('views.damageCalc.zapQuake.remainingDefenses');
        const badge = translate('views.damageCalc.filters.filterSurvived');
        const body = translate('views.damageCalc.popovers.remainingDefensesBody');
        return {
            header: `
                <orecalc-assets-svg name="shield-filled" width="18" height="18" class="popover-img font-color-warning"></orecalc-assets-svg>
                <div class="popover-title-group">
                    <span class="popover-title">${escapeHTML(title)}</span>
                    <span class="popover-badge">${escapeHTML(badge)}</span>
                </div>
            `,
            body: `<p>${escapeHTML(body)}</p>`
        };
    }
    return null;
}

/**
 * Resolves popover content for target combo rows shared with other defenses.
 *
 * @param {string[]} defenseKeys - List of defense keys sharing the combination.
 * @param {Object} [state] - Damage calculator state.
 * @returns {{ header: string, body: string } | null}
 */
export function getSharedComboPopoverContent(defenseKeys, state) {
    if (!Array.isArray(defenseKeys) || defenseKeys.length === 0) return null;

    const title = translate('views.damageCalc.zapQuake.sharedComboPopoverTitle');
    const currentTH = getShownTownHall(state);

    const rowsHtml = defenseKeys.map(key => {
        const name = getDefenseDisplayName(key);
        const defLvl = state?.defenseLevelOverrides?.[key]
            ?? getMaxDefenseLevelForTownHall(key, currentTH)?.level
            ?? 1;
        const assetUrl = getBuildingAssetUrl(key, defLvl);

        return `
            <div class="calc-shared-defense-item">
                <orecalc-assets-image src="${assetUrl}" alt="${escapeHTML(name)}" class="calc-shared-defense-item__img" size="thumbnail"></orecalc-assets-image>
                <span class="calc-shared-defense-item__name">${escapeHTML(name)}</span>
            </div>
        `;
    }).join('');

    return {
        header: `
            <orecalc-assets-svg name="link" width="16" height="16" class="popover-img font-color-muted"></orecalc-assets-svg>
            <div class="popover-title-group">
                <span class="popover-title">${escapeHTML(title)}</span>
            </div>
            <span class="popover-badge">${defenseKeys.length}</span>
        `,
        body: `<div class="calc-shared-defenses-list">${rowsHtml}</div>`
    };
}
