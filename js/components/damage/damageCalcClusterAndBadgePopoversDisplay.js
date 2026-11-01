/**
 * DOM Rendering Engine for Cluster Target, Combo Badge, and Shared Combo Popovers.
 * Tier 4: UI Presentation (Dedicated exclusively to popover HTML generation, 0 event listeners).
 */

import { getDefensesData } from '../../data/defenseTargetsData.js';
import { getBuildingAssetUrl } from '../../core/buildingAssetHelper.js';
import {
    getMaxSuperchargeTier,
    getMaxDefenseLevelForTownHall
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
            <clashcalc-assets-image src="${getBuildingAssetUrl(buildingKey, level)}" alt="${escapeHTML(defName)}" class="popover-img"></clashcalc-assets-image>
            <div class="popover-title-group">
                <span class="popover-title">${escapeHTML(defName)} (${escapeHTML(lvlShort)} ${level})${superchargeHtml}</span>
                <span class="popover-badge font-color-warning">${formatNumber(maxHp)} ${hpUnit}</span>
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
                <clashcalc-assets-svg name="shield-filled" width="18" height="18" class="popover-img font-color-warning"></clashcalc-assets-svg>
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
                <clashcalc-assets-image src="${assetUrl}" alt="${escapeHTML(name)}" class="calc-shared-defense-item__img" size="thumbnail"></clashcalc-assets-image>
                <span class="calc-shared-defense-item__name">${escapeHTML(name)}</span>
            </div>
        `;
    }).join('');

    return {
        header: `
            <clashcalc-assets-svg name="link" width="16" height="16" class="popover-img font-color-muted"></clashcalc-assets-svg>
            <div class="popover-title-group">
                <span class="popover-title">${escapeHTML(title)}</span>
            </div>
            <span class="popover-badge">${defenseKeys.length}</span>
        `,
        body: `<div class="calc-shared-defenses-list">${rowsHtml}</div>`
    };
}
