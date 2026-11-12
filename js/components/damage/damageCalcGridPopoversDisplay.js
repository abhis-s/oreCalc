/**
 * DOM Rendering Engine for Damage Calculator Grid & Target Breakdown Popovers.
 * Tier 4: UI Presentation (Dedicated exclusively to popover HTML generation, 0 event listeners).
 */

import { getDefensesData } from '../../data/defenseTargetsData.js';
import { spellsData } from '../../data/spellsData.js';
import { equipmentDamageData } from '../../data/equipmentDamageData.js';
import { getBuildingAssetUrl } from '../../core/buildingAssetHelper.js';
import { solveZapQuakeCombinations } from '../../domain/damage/zapQuakeSolver.js';
import { calculateEquipmentDamage } from '../../domain/damage/equipmentDamage.js';
import {
    calculateEarthquakeDamage,
    getEffectiveEquipmentLevel
} from '../../domain/damage/damageFormulas.js';
import {
    getMaxSuperchargeTier,
    canEquipmentTarget,
    isUnitTarget
} from '../../domain/damage/defenseProgressionDomain.js';
import { translate } from '../../i18n/translator.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { safeJsonParse } from '../../utils/jsonUtils.js';
import { formatFloat, formatNumber } from '../../utils/numberFormatter.js';
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
            ? formatFloat(bestAttempt.percentDealt, 1)
            : (maxHp > 0 ? formatFloat((totalDamage / maxHp) * 100, 1) : formatFloat(0, 1));
        const pctRemaining = bestAttempt?.percentRemaining != null
            ? formatFloat(bestAttempt.percentRemaining, 1)
            : (maxHp > 0 ? formatFloat((remainingHp / maxHp) * 100, 1) : formatFloat(100, 1));

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
            const eqPct = maxHp > 0 ? formatFloat((eqDmg / maxHp) * 100, 1) : formatFloat(0, 1);
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
                <clashcalc-assets-image src="${getBuildingAssetUrl(buildingKey, level)}" alt="${escapeHTML(defName)}" class="popover-img"></clashcalc-assets-image>
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
            name: `${translate('views.damageCalc.offense.spellEarthquake') || 'Earthquake'} #${i}${strike.isCc ? ` (${ccAbbr})` : ''} (${formatFloat(strikePct, 1)}%)`,
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
            <clashcalc-assets-image src="${getBuildingAssetUrl(buildingKey, level)}" alt="${escapeHTML(defName)}" class="popover-img"></clashcalc-assets-image>
            <div class="popover-title-group">
                <span class="popover-title">${escapeHTML(defName)} (${escapeHTML(getLvlShort(buildingKey))} ${level})${superchargeHtml}</span>
                <span class="popover-badge">${formatNumber(maxHp)} ${hpUnit}</span>
            </div>
        `,
        body: `<div class="calc-breakdown-list">${rowsHtml}</div>`
    };
}
