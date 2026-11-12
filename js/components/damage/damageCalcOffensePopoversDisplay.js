/**
 * DOM Rendering Engine for Damage Calculator Offense Popovers (Equipment & Spells).
 * Tier 4: UI Presentation (Dedicated exclusively to popover HTML generation, 0 event listeners).
 */

import { equipmentDamageData } from '../../data/equipmentDamageData.js';
import { spellsData } from '../../data/spellsData.js';
import { getEffectiveEquipmentLevel } from '../../domain/damage/damageFormulas.js';
import { translate } from '../../i18n/translator.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { formatFloat, formatNumber } from '../../utils/numberFormatter.js';
import { getActiveModifier } from './damageCalcState.js';
import {
    getDefenseDisplayName,
    getEquipmentDisplayName,
    getHeroDisplayName
} from '../../utils/equipmentMetadata.js';
import {
    getLvlShort,
    getHpUnit
} from './damageCalcDisplay.js';

/**
 * Builds contextual stats popover for a specific Hero Equipment.
 *
 * @param {string} equipmentId - Equipment key.
 * @param {number} level - Equipment level.
 * @param {Object} [options={}] - Options (e.g. modifier, leagueId, rawLevel, isCombo, isDamageSource, isAction).
 * @returns {{ header: string, body: string } | null}
 */
export function getEquipmentStatsPopoverContent(equipmentId, level, options = {}) {
    const equip = equipmentDamageData[equipmentId];
    if (!equip) return null;

    const modifierKey = options.modifier || options.modifierKey || options.leagueId || 'standard';
    const isEpic = equip.rarity === 'epic';
    const maxLvl = equip.maxLevel || (isEpic ? 27 : 18);
    const rawLevel = options.rawLevel != null ? options.rawLevel : level;
    const safeRawLvl = Math.min(Math.max(1, rawLevel || maxLvl), maxLvl);
    const effectiveLvl = getEffectiveEquipmentLevel(equipmentId, safeRawLvl, modifierKey);
    const safeLvl = Math.min(Math.max(1, effectiveLvl), maxLvl);
    const isCombo = Boolean(options.isCombo);
    const isDamageSource = Boolean(options.isDamageSource);

    const heroName = getHeroDisplayName(equip.hero);
    const eqName = getEquipmentDisplayName(equipmentId);
    const lvlShort = getLvlShort();
    const hpUnit = getHpUnit();
    const damageLabel = translate('entities.stats.damage');
    const damageRadiusLabel = translate('entities.stats.damageRadius');
    const favoriteTargetLabel = translate('entities.stats.favoriteTarget');
    const numberOfTargetsLabel = translate('entities.stats.numberOfTargets');
    const damagePerHitLabel = translate('entities.stats.damagePerHit');
    const tilesText = translate('views.equipment.tilesSuffix');
    const heroLabel = translate('app.alts.hero');

    const bullets = [];
    if (!isCombo && !isDamageSource && !options.isAction) {
        bullets.push(`<li><strong>${escapeHTML(heroLabel)}:</strong> ${escapeHTML(heroName)}</li>`);
    }

    switch (equipmentId) {
        case 'giant_arrow': {
            const dmg = equip.damageByLevel[safeLvl] || 0;
            const adMultiplier = equip.airDefenseMultiplier || 2.0;
            const adDmg = Math.floor(dmg * adMultiplier);
            const radius = equip.radius || 1.0;
            const adDisplayName = getDefenseDisplayName('air_defense');
            bullets.push(`<li><strong>${escapeHTML(damageLabel)}:</strong> ${formatNumber(dmg)} ${hpUnit}</li>`);
            bullets.push(`<li><strong>${escapeHTML(favoriteTargetLabel)}:</strong> ${escapeHTML(adDisplayName)} (2x · ${formatNumber(adDmg)} ${hpUnit})</li>`);
            bullets.push(`<li><strong>${escapeHTML(damageRadiusLabel)}:</strong> ${formatFloat(radius, 1)} ${escapeHTML(tilesText)}</li>`);
            break;
        }

        case 'fireball': {
            const dmg = equip.damageByLevel[safeLvl] || 0;
            const radius = equip.radiusByLevel?.[safeLvl] || 4.0;
            bullets.push(`<li><strong>${escapeHTML(damageLabel)}:</strong> ${formatNumber(dmg)} ${hpUnit}</li>`);
            bullets.push(`<li><strong>${escapeHTML(damageRadiusLabel)}:</strong> ${formatFloat(radius, 1)} ${escapeHTML(tilesText)}</li>`);
            break;
        }

        case 'spiky_ball': {
            const dmg = equip.damageByLevel[safeLvl] || 0;
            const targets = equip.targetsByLevel?.[safeLvl] || 2;
            bullets.push(`<li><strong>${escapeHTML(damagePerHitLabel)}:</strong> ${formatNumber(dmg)} ${hpUnit}</li>`);
            bullets.push(`<li><strong>${escapeHTML(numberOfTargetsLabel)}:</strong> ${targets}</li>`);
            break;
        }

        case 'seeking_shield': {
            const dmg = equip.damageByLevel[safeLvl] || 0;
            const targets = equip.numberOfTargets || 4;
            bullets.push(`<li><strong>${escapeHTML(damagePerHitLabel)}:</strong> ${formatNumber(dmg)} ${hpUnit}</li>`);
            bullets.push(`<li><strong>${escapeHTML(numberOfTargetsLabel)}:</strong> ${targets}</li>`);
            bullets.push(`<li><strong>${escapeHTML(favoriteTargetLabel)}:</strong> ${escapeHTML(translate('views.damageCalc.filters.filterDefenses'))}</li>`);
            break;
        }

        case 'flame_blower': {
            const dmg = equip.damageByLevel[safeLvl] || 0;
            bullets.push(`<li><strong>${escapeHTML(damageLabel)}:</strong> ${formatNumber(dmg)} ${hpUnit}</li>`);
            break;
        }

        case 'rocket_backpack': {
            const dmg = equip.damageByLevel[safeLvl] || 0;
            const radius = equip.radius || 4.0;
            bullets.push(`<li><strong>${escapeHTML(damageLabel)}:</strong> ${formatNumber(dmg)} ${hpUnit}</li>`);
            bullets.push(`<li><strong>${escapeHTML(damageRadiusLabel)}:</strong> ${formatFloat(radius, 1)} ${escapeHTML(tilesText)}</li>`);
            break;
        }

        default:
            break;
    }

    const headerTitle = `${escapeHTML(eqName)} (${escapeHTML(lvlShort)} ${safeLvl})`;
    const headerBadge = isDamageSource
        ? translate('nav.equipment')
        : escapeHTML(heroName);

    return {
        header: `
            <clashcalc-assets-image src="/${equip.icon}" alt="${escapeHTML(eqName)}" class="popover-img"></clashcalc-assets-image>
            <div class="popover-title-group">
                <span class="popover-title">${headerTitle}</span>
                <span class="popover-badge">${headerBadge}</span>
            </div>
        `,
        body: `<ul class="calc-popover-stat-list">${bullets.join('')}</ul>`
    };
}

/**
 * Builds contextual stats popover for Earthquake spell.
 *
 * @param {Object} options
 * @param {number} [options.level=8]
 * @param {number} [options.count=1]
 * @param {boolean} [options.isCombo=false]
 * @param {number|null} [options.ccLevel=null]
 * @param {boolean} [options.isCc=false]
 * @param {'buildings'|'troops'|'both'} [options.targetScope='buildings']
 * @returns {{ header: string, body: string } | null}
 */
export function getEarthquakeStatsPopoverContent({ level = 8, count = 1, isCombo = false, ccLevel = null, isCc = false, targetScope = 'buildings' } = {}) {
    const eqConfig = spellsData.spells?.earthquake;
    if (!eqConfig) return null;

    const safeLvl = Math.min(Math.max(1, level || 8), 8);
    const levelInfo = eqConfig.levels[safeLvl] || eqConfig.levels[8];
    const basePct = (levelInfo.damagePct || 0.29) * 100;
    const troopBasePct = (levelInfo.troopDamagePct ?? 0) * 100;
    const radius = levelInfo.radius || 4.7;
    const buildingDamageLabel = translate('entities.stats.buildingDamage');
    const troopDamageLabel = translate('entities.stats.troopDamage');
    const damageRadiusLabel = translate('entities.stats.damageRadius');
    const tilesText = translate('views.equipment.tilesSuffix');
    const totalLabel = translate('views.income.totalLabel');
    const totalDamageLabel = translate('views.damageCalc.zapQuake.totalDamageLabel');
    const eqSpellName = translate('views.damageCalc.offense.spellEarthquake');
    const ccSpellName = translate('views.damageCalc.offense.donatedEarthquakeLabel');
    const strike1Text = translate('views.damageCalc.popovers.strikeNumber', { number: 1 }) || 'Strike 1';
    const buildingsLabel = translate('views.damageCalc.popovers.statBuildings');
    const troopsLabel = translate('views.damageCalc.popovers.statTroops');

    if (!isCombo) {
        const strikes = [
            { label: translate('views.damageCalc.popovers.strikeNumber', { number: 1 }) || 'Strike 1', pct: basePct / 1, cum: basePct / 1 },
            { label: translate('views.damageCalc.popovers.strikeNumber', { number: 2 }) || 'Strike 2', pct: basePct / 3, cum: (basePct / 1) + (basePct / 3) },
            { label: translate('views.damageCalc.popovers.strikeNumber', { number: 3 }) || 'Strike 3', pct: basePct / 5, cum: (basePct / 1) + (basePct / 3) + (basePct / 5) },
            { label: translate('views.damageCalc.popovers.strikeNumber', { number: 4 }) || 'Strike 4', pct: basePct / 7, cum: (basePct / 1) + (basePct / 3) + (basePct / 5) + (basePct / 7) },
            { label: translate('views.damageCalc.popovers.strikeNumber', { number: '5+' }) || 'Strike 5+', pct: basePct / 9, cum: (basePct / 1) + (basePct / 3) + (basePct / 5) + (basePct / 7) + (basePct / 9), isFifth: true }
        ];

        let dimRowsHtml = '';
        for (const s of strikes) {
            const isFifth = Boolean(s.isFifth);
            dimRowsHtml += `
                <div class="calc-breakdown-row">
                    <span>${s.label}</span>
                    <span class="font-weight-semibold">${formatFloat(s.pct, 1)}%${isFifth ? ` ${escapeHTML(translate('views.damageCalc.zapQuake.each'))}` : ` <span class="calc-breakdown-meta">(${formatFloat(s.cum, 1)}% ${escapeHTML(totalLabel.toLowerCase())})</span>`}</span>
                </div>
            `;
        }

        const spellBadgeText = isCc
            ? translate('views.damageCalc.offense.donatedSpellBadge')
            : translate('views.damageCalc.zapQuake.spellBadge');
        const wallsLabel = translate('views.damageCalc.popovers.walls');
        const wallBreakCondition = translate('views.damageCalc.popovers.wallBreakCondition');
        const immunitiesLabel = translate('views.damageCalc.popovers.immunities');
        const eqImmuneNames = escapeHTML(translate('entities.defenses.storages') || 'Storages');
        const diminishingTitle = translate('views.damageCalc.popovers.diminishingTitle');
        const lvlShort = getLvlShort();
        const titleText = isCc
            ? `${escapeHTML(ccSpellName)} (${escapeHTML(lvlShort)} ${safeLvl})`
            : `${escapeHTML(eqSpellName)} (${escapeHTML(lvlShort)} ${safeLvl})`;

        return {
            header: `
                <clashcalc-assets-image src="/assets/spells/earthquake.png" alt="Earthquake" class="popover-img"></clashcalc-assets-image>
                <div class="popover-title-group">
                    <span class="popover-title">${titleText}</span>
                    <span class="popover-badge">${escapeHTML(spellBadgeText)}</span>
                </div>
            `,
            body: `
                <ul class="calc-popover-stat-list">
                    <li><strong>${escapeHTML(buildingDamageLabel)}:</strong> ${formatFloat(basePct, 1)}%</li>
                    ${troopBasePct > 0 ? `<li><strong>${escapeHTML(troopDamageLabel)}:</strong> ${formatFloat(troopBasePct, 1)}%</li>` : ''}
                    <li><strong>${escapeHTML(damageRadiusLabel)}:</strong> ${formatFloat(radius, 1)} ${escapeHTML(tilesText)}</li>
                    <li><strong>${escapeHTML(wallsLabel)}:</strong> ${escapeHTML(wallBreakCondition)}</li>
                    <li><strong>${escapeHTML(immunitiesLabel)}:</strong> ${eqImmuneNames}</li>
                </ul>
                <div class="calc-popover-diminishing-section">
                    <div class="calc-popover-diminishing-title">${escapeHTML(diminishingTitle)}</div>
                    <div class="calc-breakdown-list">
                        ${dimRowsHtml}
                    </div>
                </div>
            `
        };
    }

    let cumBldPct = 0;
    let cumTroopPct = 0;
    let strikeRowsHtml = '';

    for (let i = 1; i <= count; i++) {
        const isDonated = (i === 1 && ccLevel != null && ccLevel > safeLvl);
        const effLvl = isDonated ? ccLevel : safeLvl;
        const effInfo = eqConfig.levels[effLvl] || levelInfo;
        const effBldBase = (effInfo.damagePct || 0.29) * 100;
        const effTroopBase = (effInfo.troopDamagePct ?? 0) * 100;
        const divider = (2 * i) - 1;

        const strikeBldPct = effBldBase / divider;
        const strikeTroopPct = effTroopBase / divider;
        cumBldPct += strikeBldPct;
        cumTroopPct += strikeTroopPct;

        const ccAbbr = translate('views.damageCalc.offense.clanCastleAbbr');
        const strikeTitle = `${escapeHTML(translate('views.damageCalc.offense.spellEarthquake'))} #${i}${isDonated ? ` (${escapeHTML(ccAbbr)})` : ''}`;

        let strikeValueHtml = '';
        if (targetScope === 'buildings') {
            strikeValueHtml = `<span class="font-weight-semibold">${formatFloat(strikeBldPct, 1)}%</span>`;
        } else if (targetScope === 'troops') {
            strikeValueHtml = `<span class="font-weight-semibold">${formatFloat(strikeTroopPct, 1)}%</span>`;
        } else {
            strikeValueHtml = `<span class="font-weight-semibold">${formatFloat(strikeBldPct, 1)}% <span class="calc-breakdown-meta">(${escapeHTML(buildingsLabel)})</span> &middot; ${formatFloat(strikeTroopPct, 1)}% <span class="calc-breakdown-meta">(${escapeHTML(troopsLabel)})</span></span>`;
        }

        strikeRowsHtml += `
            <div class="calc-breakdown-row">
                <span>${strikeTitle}</span>
                ${strikeValueHtml}
            </div>
        `;
    }

    let breakdownSectionHtml = '';
    if (count > 1) {
        const orderedBreakdownTitle = translate('views.damageCalc.popovers.orderedStrikeBreakdown');
        let totalValueHtml = '';
        if (targetScope === 'buildings') {
            totalValueHtml = `<span>${formatFloat(cumBldPct, 1)}%</span>`;
        } else if (targetScope === 'troops') {
            totalValueHtml = `<span>${formatFloat(cumTroopPct, 1)}%</span>`;
        } else {
            totalValueHtml = `<span>${formatFloat(cumBldPct, 1)}% <span class="calc-breakdown-meta">(${escapeHTML(buildingsLabel)})</span> &middot; ${formatFloat(cumTroopPct, 1)}% <span class="calc-breakdown-meta">(${escapeHTML(troopsLabel)})</span></span>`;
        }

        breakdownSectionHtml = `
            <div class="calc-popover-diminishing-section">
                <div class="calc-popover-diminishing-title">${escapeHTML(orderedBreakdownTitle)}</div>
                <div class="calc-breakdown-list">
                    ${strikeRowsHtml}
                    <div class="calc-breakdown-row calc-breakdown-row--total">
                        <span>${escapeHTML(totalDamageLabel)}</span>
                        ${totalValueHtml}
                    </div>
                </div>
            </div>
        `;
    }

    const comboSpellBadgeText = isCc
        ? translate('views.damageCalc.offense.donatedSpellBadge')
        : translate('views.damageCalc.zapQuake.spellBadge');

    let statListHtml = '';
    if (targetScope === 'buildings') {
        statListHtml = `
            <li><strong>${escapeHTML(buildingDamageLabel)}:</strong> ${formatFloat(basePct, 1)}%${count > 1 ? ` (${escapeHTML(strike1Text)})` : ''}</li>
            <li><strong>${escapeHTML(damageRadiusLabel)}:</strong> ${formatFloat(radius, 1)} ${escapeHTML(tilesText)}</li>
        `;
    } else if (targetScope === 'troops') {
        statListHtml = `
            <li><strong>${escapeHTML(troopDamageLabel)}:</strong> ${formatFloat(troopBasePct, 1)}%${count > 1 ? ` (${escapeHTML(strike1Text)})` : ''}</li>
            <li><strong>${escapeHTML(damageRadiusLabel)}:</strong> ${formatFloat(radius, 1)} ${escapeHTML(tilesText)}</li>
        `;
    } else {
        statListHtml = `
            <li><strong>${escapeHTML(buildingDamageLabel)}:</strong> ${formatFloat(basePct, 1)}%${count > 1 ? ` (${escapeHTML(strike1Text)})` : ''}</li>
            <li><strong>${escapeHTML(troopDamageLabel)}:</strong> ${formatFloat(troopBasePct, 1)}%${count > 1 ? ` (${escapeHTML(strike1Text)})` : ''}</li>
            <li><strong>${escapeHTML(damageRadiusLabel)}:</strong> ${formatFloat(radius, 1)} ${escapeHTML(tilesText)}</li>
        `;
    }

    return {
        header: `
            <clashcalc-assets-image src="/assets/spells/earthquake.png" alt="Earthquake" class="popover-img"></clashcalc-assets-image>
            <div class="popover-title-group">
                <span class="popover-title">${count}x ${escapeHTML(isCc ? ccSpellName : eqSpellName)}</span>
                <span class="popover-badge">${escapeHTML(comboSpellBadgeText)}</span>
            </div>
        `,
        body: `
            <ul class="calc-popover-stat-list">
                ${statListHtml}
            </ul>
            ${breakdownSectionHtml}
        `
    };
}

/**
 * Builds contextual stats popover for Lightning spell.
 *
 * @param {Object} options
 * @param {number} [options.level=13]
 * @param {number} [options.count=1]
 * @param {boolean} [options.isCombo=false]
 * @param {number|null} [options.ccLevel=null]
 * @param {boolean} [options.isCc=false]
 * @returns {{ header: string, body: string } | null}
 */
export function getLightningStatsPopoverContent({ level = 13, count = 1, isCombo = false, ccLevel = null, isCc = false } = {}) {
    const zapConfig = spellsData.spells?.lightning;
    if (!zapConfig) return null;

    const safeLvl = Math.min(Math.max(1, level || 13), 13);
    const levelInfo = zapConfig.levels[safeLvl] || zapConfig.levels[13];
    const zapDmg = levelInfo.damage || 720;
    const radius = zapConfig.radius || 2.0;
    const damageLabel = translate('entities.stats.damage');
    const damageRadiusLabel = translate('entities.stats.damageRadius');
    const tilesText = translate('views.equipment.tilesSuffix');
    const totalDamageLabel = translate('views.damageCalc.zapQuake.totalDamageLabel');

    const zapSpellName = translate('views.damageCalc.offense.spellLightning');
    const ccZapName = translate('views.damageCalc.offense.donatedLightningLabel');
    const spellBadgeText = isCc
        ? translate('views.damageCalc.offense.donatedSpellBadge')
        : translate('views.damageCalc.zapQuake.spellBadge');
    const stunEffectLabel = translate('views.damageCalc.popovers.stunEffect');
    const immunitiesLabel = translate('views.damageCalc.popovers.immunities');
    const lvlShort = getLvlShort();
    const hpUnit = getHpUnit();
    const titleText = isCc
        ? `${escapeHTML(ccZapName)} (${escapeHTML(lvlShort)} ${safeLvl})`
        : `${escapeHTML(zapSpellName)} (${escapeHTML(lvlShort)} ${safeLvl})`;

    if (!isCombo) {
        const zapImmuneNames = [
            getDefenseDisplayName('town_hall'),
            getDefenseDisplayName('clan_castle'),
            translate('entities.defenses.storages') || 'Storages'
        ].map(escapeHTML).join(', ');

        return {
            header: `
                <clashcalc-assets-image src="/assets/spells/lightning.png" alt="Lightning" class="popover-img"></clashcalc-assets-image>
                <div class="popover-title-group">
                    <span class="popover-title">${titleText}</span>
                    <span class="popover-badge">${escapeHTML(spellBadgeText)}</span>
                </div>
            `,
            body: `
                <ul class="calc-popover-stat-list">
                    <li><strong>${escapeHTML(damageLabel)}:</strong> ${formatNumber(zapDmg)} ${hpUnit}</li>
                    <li><strong>${escapeHTML(damageRadiusLabel)}:</strong> ${formatFloat(radius, 1)} ${escapeHTML(tilesText)}</li>
                    <li><strong>${escapeHTML(stunEffectLabel)}:</strong> ${formatFloat(0.1, 1)}s</li>
                    <li><strong>${escapeHTML(immunitiesLabel)}:</strong> ${zapImmuneNames}</li>
                </ul>
            `
        };
    }

    const hasCc = (ccLevel != null && ccLevel > safeLvl);
    const ccZapDmg = hasCc ? (zapConfig.levels[ccLevel]?.damage || 720) : null;
    const totalZapDmg = hasCc
        ? (ccZapDmg + (count - 1) * zapDmg)
        : (count * zapDmg);

    const damageCalculationLabel = translate('views.damageCalc.popovers.damageCalculation');

    let calcSectionHtml = '';
    if (count > 1) {
        if (hasCc) {
            calcSectionHtml = `
                <div class="calc-popover-diminishing-section">
                    <div class="calc-popover-diminishing-title">${escapeHTML(damageCalculationLabel)}</div>
                    <div class="calc-breakdown-list">
                        <div class="calc-breakdown-row"><span>1x ${escapeHTML(translate('views.damageCalc.offense.donatedSpellBadge') || 'Donation')} (${escapeHTML(lvlShort)} ${ccLevel})</span><span class="font-weight-semibold">${formatNumber(ccZapDmg)} ${hpUnit}</span></div>
                        <div class="calc-breakdown-row"><span>${count - 1}x ${escapeHTML(translate('views.damageCalc.popovers.personalStrike') || 'Personal')} (${formatNumber(zapDmg)} ${escapeHTML(translate('views.damageCalc.zapQuake.each'))})</span><span class="font-weight-semibold">${formatNumber((count - 1) * zapDmg)} ${hpUnit}</span></div>
                        <div class="calc-breakdown-row calc-breakdown-row--total"><span>${escapeHTML(totalDamageLabel)}</span><span>${formatNumber(totalZapDmg)} ${hpUnit}</span></div>
                    </div>
                </div>
            `;
        } else {
            calcSectionHtml = `
                <div class="calc-popover-diminishing-section">
                    <div class="calc-popover-diminishing-title">${escapeHTML(damageCalculationLabel)}</div>
                    <div class="calc-breakdown-list">
                        <div class="calc-breakdown-row"><span>${count}x ${escapeHTML(translate('views.damageCalc.offense.spellLightning'))} &times; ${formatNumber(zapDmg)} ${hpUnit}</span><span class="font-weight-semibold">${formatNumber(totalZapDmg)} ${hpUnit}</span></div>
                        <div class="calc-breakdown-row calc-breakdown-row--total"><span>${escapeHTML(totalDamageLabel)}</span><span>${formatNumber(totalZapDmg)} ${hpUnit}</span></div>
                    </div>
                </div>
            `;
        }
    }

    const ccAbbr = translate('views.damageCalc.offense.clanCastleAbbr');
    const strikeDmgText = count > 1
        ? `${formatNumber(zapDmg)} ${hpUnit} ${escapeHTML(translate('views.damageCalc.zapQuake.each'))}${hasCc ? ` (${escapeHTML(ccAbbr)}: ${formatNumber(ccZapDmg)} ${hpUnit})` : ''}`
        : (hasCc ? `${formatNumber(ccZapDmg)} ${hpUnit} (${escapeHTML(translate('views.damageCalc.offense.donatedSpellBadge') || 'Donated')})` : `${formatNumber(zapDmg)} ${hpUnit}`);

    return {
        header: `
            <clashcalc-assets-image src="/assets/spells/lightning.png" alt="Lightning" class="popover-img"></clashcalc-assets-image>
            <div class="popover-title-group">
                <span class="popover-title">${count}x ${escapeHTML(isCc ? ccZapName : zapSpellName)}</span>
                <span class="popover-badge">${escapeHTML(spellBadgeText)}</span>
            </div>
        `,
        body: `
            <ul class="calc-popover-stat-list">
                <li><strong>${escapeHTML(damageLabel)}:</strong> ${strikeDmgText}</li>
                <li><strong>${escapeHTML(damageRadiusLabel)}:</strong> ${formatFloat(radius, 1)} ${escapeHTML(tilesText)}</li>
            </ul>
            ${calcSectionHtml}
        `
    };
}

/**
 * Resolves content for damage source popover in the ZapQuake solver damage sources bar.
 *
 * @param {string} sourceKey - Source key.
 * @param {number} level - Source level.
 * @param {Object} [state] - Damage calculator state.
 * @returns {{ header: string, body: string } | null}
 */
export function getDamageSourcePopoverContent(sourceKey, level, state) {
    if (!sourceKey) return null;

    if (sourceKey === 'lightning') {
        const zapLvl = level || state?.offense?.spells?.lightning || 13;
        return getLightningStatsPopoverContent({ level: zapLvl, count: 1, isCombo: false });
    }
    if (sourceKey === 'cc_lightning') {
        const ccZapLvl = level || state?.offense?.ccSpells?.lightning || 13;
        return getLightningStatsPopoverContent({ level: ccZapLvl, count: 1, isCombo: false, isCc: true });
    }
    if (sourceKey === 'earthquake') {
        const eqLvl = level || state?.offense?.spells?.earthquake || 8;
        return getEarthquakeStatsPopoverContent({ level: eqLvl, count: 1, isCombo: false });
    }
    if (sourceKey === 'cc_earthquake') {
        const ccEqLvl = level || state?.offense?.ccSpells?.earthquake || 8;
        return getEarthquakeStatsPopoverContent({ level: ccEqLvl, count: 1, isCombo: false, isCc: true });
    }
    if (equipmentDamageData[sourceKey]) {
        const rawLvl = state?.offense?.equipment?.[sourceKey] || equipmentDamageData[sourceKey].maxLevel || (equipmentDamageData[sourceKey].rarity === 'epic' ? 27 : 18);
        const activeMod = getActiveModifier(state);
        return getEquipmentStatsPopoverContent(sourceKey, level, { modifier: activeMod, leagueId: activeMod, rawLevel: rawLvl, isDamageSource: true });
    }
    return null;
}
