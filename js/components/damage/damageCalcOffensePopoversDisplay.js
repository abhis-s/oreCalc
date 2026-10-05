/**
 * DOM Rendering Engine for Damage Calculator Offense & Rules Popovers.
 * Tier 4: UI Presentation (Dedicated exclusively to popover HTML generation, 0 event listeners).
 */

import { equipmentDamageData } from '../../data/equipmentDamageData.js';
import { spellsData } from '../../data/spellsData.js';
import { BUILDER_REPAIR_PER_HIT } from '../../domain/damage/attackSimulator.js';
import { getEffectiveEquipmentLevel } from '../../domain/damage/damageFormulas.js';
import { translate } from '../../i18n/translator.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { formatNumber } from '../../utils/numberFormatter.js';
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
 * Resolves content for generic feature info popovers.
 * @param {string} infoKey
 * @returns {{ header: string, body: string } | null}
 */
export function getGenericInfoPopoverContent(infoKey) {
    if (infoKey === 'modifier') {
        const bullets = [
            `<li><strong>${escapeHTML(translate('views.equipment.modifiers.legend3') || 'Legend III')} (+10%):</strong> ${escapeHTML(translate('views.damageCalc.popovers.modifierLegend3') || 'Def. DPS +10%, heroes +10%, guardians +5%; atk. heroes -5%.')}</li>`,
            `<li><strong>${escapeHTML(translate('views.equipment.modifiers.legend2') || 'Legend II')} (+15%):</strong> ${escapeHTML(translate('views.damageCalc.popovers.modifierLegend2') || 'Def. DPS +15%, heroes +15%, guardians +10%; atk. heroes -10%.')}</li>`,
            `<li><strong>${escapeHTML(translate('views.equipment.modifiers.legend1') || 'Legend I')} (+20%):</strong> ${escapeHTML(translate('views.damageCalc.popovers.modifierLegend1') || 'Def. DPS +20%, heroes +20%, guardians +20%; atk. heroes -20%.')}</li>`,
            `<li><strong>${escapeHTML(translate('views.equipment.modifiers.esports') || 'Esports')} Mode:</strong> ${escapeHTML(translate('views.damageCalc.popovers.modifierEsports') || 'Legend I bonuses; Common eq. -3 lvls, Epic eq. -6 lvls.')}</li>`
        ];
        return {
            header: `
                <orecalc-assets-svg name="info" width="18" height="18" class="popover-img"></orecalc-assets-svg>
                <div class="popover-title-group">
                    <span class="popover-title">${escapeHTML(translate('views.damageCalc.popovers.modifierTitle') || 'Battle Modifiers & League Rules')}</span>
                    <span class="popover-badge">${escapeHTML(translate('views.damageCalc.offense.battleModifier') || 'Modifiers')}</span>
                </div>
            `,
            body: `<ul class="calc-popover-stat-list">${bullets.join('')}</ul>`
        };
    }
    if (infoKey === 'supercharge') {
        return {
            header: `
                <orecalc-assets-image src="/assets/supercharge/supercharge_bolt.png" alt="Supercharge" class="popover-img"></orecalc-assets-image>
                <div class="popover-title-group">
                    <span class="popover-title">${escapeHTML(translate('views.damageCalc.popovers.superchargeTitle') || 'Supercharge')}</span>
                    <span class="popover-badge">${escapeHTML(translate('views.damageCalc.offense.superchargeLabel') || 'Supercharge')}</span>
                </div>
            `,
            body: `<p>${escapeHTML(translate('views.damageCalc.popovers.superchargeBody') || '')}</p>`
        };
    }
    if (infoKey === 'cc_spells') {
        return {
            header: `
                <orecalc-assets-image src="/assets/buildings/clan_castle/level_14.png" alt="Clan Castle" class="popover-img"></orecalc-assets-image>
                <div class="popover-title-group">
                    <span class="popover-title">${escapeHTML(translate('views.damageCalc.offense.clanCastleDonatedSpellsTitle') || 'Clan Castle Spells')}</span>
                    <span class="popover-badge">${escapeHTML(translate('views.damageCalc.offense.donatedSpellBadge') || 'Donation')}</span>
                </div>
            `,
            body: `<p>${escapeHTML(translate('views.damageCalc.popovers.ccSpellsBody') || '')}</p>`
        };
    }
    if (infoKey === 'cluster') {
        const bullets = [
            `<li><strong>${escapeHTML(translate('views.damageCalc.popovers.clusterEqTitle') || 'Shared Earthquake')}:</strong> ${escapeHTML(translate('views.damageCalc.popovers.clusterEqBody') || 'Covers a 4.7-tile radius (~9.4 tiles diameter), softening all clustered defenses simultaneously with diminishing percentage damage.')}</li>`,
            `<li><strong>${escapeHTML(translate('views.damageCalc.zapQuake.sharedLightningToggle') || 'Shared Lightning')}:</strong> ${escapeHTML(translate('views.damageCalc.popovers.clusterZapBody') || 'Adjacent defenses (within a 2-tile radius) share Lightning strikes to eliminate both targets with fewer total spells.')}</li>`,
            `<li><strong>${escapeHTML(translate('views.equipment.heroEquipment') || 'Hero Equipment')}:</strong> ${escapeHTML(translate('views.damageCalc.popovers.clusterEquipBody') || 'High-damage hero abilities (e.g. Fireball) can be toggled to soften targets before spell deployment.')}</li>`
        ];
        return {
            header: `
                <orecalc-assets-svg name="info" width="18" height="18" class="popover-img"></orecalc-assets-svg>
                <div class="popover-title-group">
                    <span class="popover-title">${escapeHTML(translate('views.damageCalc.popovers.clusterTitle') || 'Clustered ZapQuake Mechanics')}</span>
                    <span class="popover-badge">${escapeHTML(translate('views.damageCalc.clusterPlanner.clusterModeToggle') || 'Cluster')}</span>
                </div>
            `,
            body: `<ul class="calc-popover-stat-list">${bullets.join('')}</ul>`
        };
    }
    if (infoKey === 'spell_immunity') {
        return {
            header: `
                <orecalc-assets-image src="/assets/buildings/town_hall/level_17.png" alt="Town Hall" class="popover-img"></orecalc-assets-image>
                <div class="popover-title-group">
                    <span class="popover-title">${escapeHTML(translate('views.damageCalc.popovers.spellImmunityTitle') || 'Spell Immunity')}</span>
                    <span class="popover-badge">${escapeHTML(translate('views.damageCalc.zapQuake.immune') || 'Immune')}</span>
                </div>
            `,
            body: `<p>${escapeHTML(translate('views.damageCalc.popovers.spellImmunityBody') || '')}</p>`
        };
    }
    return null;
}

/**
 * Delegates to canonical surgical combat stat popovers.
 *
 * @param {string} actionKey - Action key.
 * @param {Object} [state] - Damage calculator state.
 * @returns {{ header: string, body: string } | null}
 */
export function getActionInfoPopoverContent(actionKey, state = null) {
    if (!actionKey) return null;

    if (actionKey === 'builder_repair') {
        const currentHutLvl = state?.simulator?.builderHutLevel || state?.builderHutLevel || 1;
        const title = translate('views.damageCalc.offense.builderRepairLabel');
        const currentHealRate = BUILDER_REPAIR_PER_HIT[currentHutLvl] || 71.25;
        const lvlShort = getLvlShort();
        const hpUnit = getHpUnit();
        const buildingLabel = translate('views.damageCalc.popovers.statBuilding');
        const buildersHutText = getDefenseDisplayName('builders_hut');
        const repairLabel = translate('views.damageCalc.popovers.statRepair');
        const conditionLabel = translate('views.damageCalc.popovers.statCondition');
        const conditionText = translate('views.damageCalc.popovers.builderRepairCondition');

        return {
            header: `
                <orecalc-assets-image src="/assets/buildings/builders_hut/level_${currentHutLvl}.png" alt="${escapeHTML(title)}" class="popover-img"></orecalc-assets-image>
                <div class="popover-title-group">
                    <span class="popover-title">${escapeHTML(title)}</span>
                    <span class="popover-badge">${escapeHTML(buildingLabel)}</span>
                </div>
            `,
            body: `
                <ul class="calc-popover-stat-list">
                    <li><strong>${escapeHTML(buildingLabel)}:</strong> ${escapeHTML(buildersHutText)} (${escapeHTML(lvlShort)} ${currentHutLvl})</li>
                    <li><strong>${escapeHTML(repairLabel)}:</strong> ${escapeHTML(translate('views.damageCalc.popovers.perHit', { amount: formatNumber(currentHealRate), unit: hpUnit }))}</li>
                    <li><strong>${escapeHTML(conditionLabel)}:</strong> ${escapeHTML(conditionText)}</li>
                </ul>
            `
        };
    }

    if (equipmentDamageData[actionKey]) {
        const rawLvl = state?.offense?.equipment?.[actionKey] || equipmentDamageData[actionKey].maxLevel || (equipmentDamageData[actionKey].rarity === 'epic' ? 27 : 18);
        const activeMod = getActiveModifier(state);
        return getEquipmentStatsPopoverContent(actionKey, rawLvl, { modifier: activeMod, leagueId: activeMod, rawLevel: rawLvl, isAction: true });
    }

    return getDamageSourcePopoverContent(actionKey, null, state);
}

/**
 * Resolves content for strike log note explanation popovers.
 * @param {string} noteCode
 * @returns {{ header: string, body: string }}
 */
export function getNoteCodePopoverContent(noteCode) {
    if (noteCode === 'giant_arrow_air_defense_2x') {
        return {
            header: `
                <orecalc-assets-image src="${equipmentDamageData.giant_arrow?.icon ? '/' + equipmentDamageData.giant_arrow.icon : '/assets/equipment/giant_arrow.png'}" alt="Giant Arrow" class="popover-img"></orecalc-assets-image>
                <div class="popover-title-group">
                    <span class="popover-title">${escapeHTML(translate('views.damageCalc.popovers.giantArrowVulnerabilityTitle') || 'Giant Arrow (2x Damage)')}</span>
                    <span class="popover-badge">${escapeHTML(translate('entities.defenses.airDefense') || 'Air Defense')}</span>
                </div>
            `,
            body: `<p>${escapeHTML(translate('views.damageCalc.popovers.giantArrowVulnerabilityBody') || 'Giant Arrow deals 200% damage against all Air Defenses.')}</p>`
        };
    }
    if (noteCode === 'target_immune_to_lightning' || noteCode === 'target_immune_to_earthquake') {
        return {
            header: `
                <orecalc-assets-image src="/assets/buildings/town_hall/level_17.png" alt="Town Hall" class="popover-img"></orecalc-assets-image>
                <div class="popover-title-group">
                    <span class="popover-title">${escapeHTML(translate('views.damageCalc.popovers.spellImmunityTitle') || 'Spell Immunity Rules')}</span>
                    <span class="popover-badge">${escapeHTML(translate('views.damageCalc.zapQuake.immune') || 'Immune')}</span>
                </div>
            `,
            body: `<p>${escapeHTML(translate('views.damageCalc.popovers.spellImmunityBody') || '')}</p>`
        };
    }
    if (noteCode === 'repair_ticks') {
        return {
            header: `
                <orecalc-assets-image src="/assets/buildings/builders_hut/level_8.png" alt="Builder" class="popover-img"></orecalc-assets-image>
                <div class="popover-title-group">
                    <span class="popover-title">${escapeHTML(translate('views.damageCalc.popovers.builderRepairTitle') || 'Builder Repair Mechanics')}</span>
                    <span class="popover-badge">${escapeHTML(translate('views.damageCalc.offense.builderRepairLabel') || 'Builder Repair')}</span>
                </div>
            `,
            body: `<p>${escapeHTML(translate('views.damageCalc.popovers.builderRepairBody') || '')}</p>`
        };
    }
    return {
        header: `
            <orecalc-assets-svg name="info" width="18" height="18" class="popover-img"></orecalc-assets-svg>
            <div class="popover-title-group">
                <span class="popover-title">${escapeHTML(translate('views.damageCalc.popovers.combatNoteTitle') || 'Combat Note')}</span>
                <span class="popover-badge">${escapeHTML(translate('views.damageCalc.popovers.simulationBadge') || 'Simulation')}</span>
            </div>
        `,
        body: `<p>${escapeHTML(translate('views.damageCalc.popovers.combatNoteBody') || 'Combat rule or mechanics modifier applied during this simulation step.')}</p>`
    };
}

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
            bullets.push(`<li><strong>${escapeHTML(damageRadiusLabel)}:</strong> ${radius.toFixed(1)} ${escapeHTML(tilesText)}</li>`);
            break;
        }

        case 'fireball': {
            const dmg = equip.damageByLevel[safeLvl] || 0;
            const radius = equip.radiusByLevel?.[safeLvl] || 4.0;
            bullets.push(`<li><strong>${escapeHTML(damageLabel)}:</strong> ${formatNumber(dmg)} ${hpUnit}</li>`);
            bullets.push(`<li><strong>${escapeHTML(damageRadiusLabel)}:</strong> ${radius.toFixed(1)} ${escapeHTML(tilesText)}</li>`);
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
            bullets.push(`<li><strong>${escapeHTML(damageRadiusLabel)}:</strong> ${radius.toFixed(1)} ${escapeHTML(tilesText)}</li>`);
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
            <orecalc-assets-image src="/${equip.icon}" alt="${escapeHTML(eqName)}" class="popover-img"></orecalc-assets-image>
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
                    <span class="font-weight-semibold">${s.pct.toFixed(1)}%${isFifth ? ` ${escapeHTML(translate('views.damageCalc.zapQuake.each'))}` : ` <span class="calc-breakdown-meta">(${s.cum.toFixed(1)}% ${escapeHTML(totalLabel.toLowerCase())})</span>`}</span>
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
                <orecalc-assets-image src="/assets/spells/earthquake.png" alt="Earthquake" class="popover-img"></orecalc-assets-image>
                <div class="popover-title-group">
                    <span class="popover-title">${titleText}</span>
                    <span class="popover-badge">${escapeHTML(spellBadgeText)}</span>
                </div>
            `,
            body: `
                <ul class="calc-popover-stat-list">
                    <li><strong>${escapeHTML(buildingDamageLabel)}:</strong> ${basePct.toFixed(1)}%</li>
                    ${troopBasePct > 0 ? `<li><strong>${escapeHTML(troopDamageLabel)}:</strong> ${troopBasePct.toFixed(1)}%</li>` : ''}
                    <li><strong>${escapeHTML(damageRadiusLabel)}:</strong> ${radius.toFixed(1)} ${escapeHTML(tilesText)}</li>
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
            strikeValueHtml = `<span class="font-weight-semibold">${strikeBldPct.toFixed(1)}%</span>`;
        } else if (targetScope === 'troops') {
            strikeValueHtml = `<span class="font-weight-semibold">${strikeTroopPct.toFixed(1)}%</span>`;
        } else {
            strikeValueHtml = `<span class="font-weight-semibold">${strikeBldPct.toFixed(1)}% <span class="calc-breakdown-meta">(${escapeHTML(buildingsLabel)})</span> &middot; ${strikeTroopPct.toFixed(1)}% <span class="calc-breakdown-meta">(${escapeHTML(troopsLabel)})</span></span>`;
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
            totalValueHtml = `<span>${cumBldPct.toFixed(1)}%</span>`;
        } else if (targetScope === 'troops') {
            totalValueHtml = `<span>${cumTroopPct.toFixed(1)}%</span>`;
        } else {
            totalValueHtml = `<span>${cumBldPct.toFixed(1)}% <span class="calc-breakdown-meta">(${escapeHTML(buildingsLabel)})</span> &middot; ${cumTroopPct.toFixed(1)}% <span class="calc-breakdown-meta">(${escapeHTML(troopsLabel)})</span></span>`;
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
            <li><strong>${escapeHTML(buildingDamageLabel)}:</strong> ${basePct.toFixed(1)}%${count > 1 ? ` (${escapeHTML(strike1Text)})` : ''}</li>
            <li><strong>${escapeHTML(damageRadiusLabel)}:</strong> ${radius.toFixed(1)} ${escapeHTML(tilesText)}</li>
        `;
    } else if (targetScope === 'troops') {
        statListHtml = `
            <li><strong>${escapeHTML(troopDamageLabel)}:</strong> ${troopBasePct.toFixed(1)}%${count > 1 ? ` (${escapeHTML(strike1Text)})` : ''}</li>
            <li><strong>${escapeHTML(damageRadiusLabel)}:</strong> ${radius.toFixed(1)} ${escapeHTML(tilesText)}</li>
        `;
    } else {
        statListHtml = `
            <li><strong>${escapeHTML(buildingDamageLabel)}:</strong> ${basePct.toFixed(1)}%${count > 1 ? ` (${escapeHTML(strike1Text)})` : ''}</li>
            <li><strong>${escapeHTML(troopDamageLabel)}:</strong> ${troopBasePct.toFixed(1)}%${count > 1 ? ` (${escapeHTML(strike1Text)})` : ''}</li>
            <li><strong>${escapeHTML(damageRadiusLabel)}:</strong> ${radius.toFixed(1)} ${escapeHTML(tilesText)}</li>
        `;
    }

    return {
        header: `
            <orecalc-assets-image src="/assets/spells/earthquake.png" alt="Earthquake" class="popover-img"></orecalc-assets-image>
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
                <orecalc-assets-image src="/assets/spells/lightning.png" alt="Lightning" class="popover-img"></orecalc-assets-image>
                <div class="popover-title-group">
                    <span class="popover-title">${titleText}</span>
                    <span class="popover-badge">${escapeHTML(spellBadgeText)}</span>
                </div>
            `,
            body: `
                <ul class="calc-popover-stat-list">
                    <li><strong>${escapeHTML(damageLabel)}:</strong> ${formatNumber(zapDmg)} ${hpUnit}</li>
                    <li><strong>${escapeHTML(damageRadiusLabel)}:</strong> ${radius.toFixed(1)} ${escapeHTML(tilesText)}</li>
                    <li><strong>${escapeHTML(stunEffectLabel)}:</strong> 0.1s</li>
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
            <orecalc-assets-image src="/assets/spells/lightning.png" alt="Lightning" class="popover-img"></orecalc-assets-image>
            <div class="popover-title-group">
                <span class="popover-title">${count}x ${escapeHTML(isCc ? ccZapName : zapSpellName)}</span>
                <span class="popover-badge">${escapeHTML(spellBadgeText)}</span>
            </div>
        `,
        body: `
            <ul class="calc-popover-stat-list">
                <li><strong>${escapeHTML(damageLabel)}:</strong> ${strikeDmgText}</li>
                <li><strong>${escapeHTML(damageRadiusLabel)}:</strong> ${radius.toFixed(1)} ${escapeHTML(tilesText)}</li>
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
