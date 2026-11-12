/**
 * DOM Rendering Engine for Damage Calculator Rules, Feature Info, and Strike Log Note Popovers.
 * Tier 4: UI Presentation (Dedicated exclusively to popover HTML generation, 0 event listeners).
 */

import { equipmentDamageData } from '../../data/equipmentDamageData.js';
import { BUILDER_REPAIR_PER_HIT } from '../../domain/damage/attackSimulator.js';
import { translate } from '../../i18n/translator.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { getActiveModifier } from './damageCalcState.js';
import { getDefenseDisplayName } from '../../utils/equipmentMetadata.js';
import {
    getLvlShort,
    getHpUnit
} from './damageCalcDisplay.js';
import {
    getEquipmentStatsPopoverContent,
    getDamageSourcePopoverContent
} from './damageCalcOffensePopoversDisplay.js';

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
                <clashcalc-assets-svg name="info" width="18" height="18" class="popover-img"></clashcalc-assets-svg>
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
                <clashcalc-assets-image src="/assets/supercharge/supercharge_bolt.png" alt="Supercharge" class="popover-img"></clashcalc-assets-image>
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
                <clashcalc-assets-image src="/assets/buildings/clan_castle/level_14.png" alt="Clan Castle" class="popover-img"></clashcalc-assets-image>
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
                <clashcalc-assets-svg name="info" width="18" height="18" class="popover-img"></clashcalc-assets-svg>
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
                <clashcalc-assets-image src="/assets/buildings/town_hall/level_17.png" alt="Town Hall" class="popover-img"></clashcalc-assets-image>
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
                <clashcalc-assets-image src="/assets/buildings/builders_hut/level_${currentHutLvl}.png" alt="${escapeHTML(title)}" class="popover-img"></clashcalc-assets-image>
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
                <clashcalc-assets-image src="${equipmentDamageData.giant_arrow?.icon ? '/' + equipmentDamageData.giant_arrow.icon : '/assets/equipment/archer_queen/AQ_giant_arrow.png'}" alt="Giant Arrow" class="popover-img"></clashcalc-assets-image>
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
                <clashcalc-assets-image src="/assets/buildings/town_hall/level_17.png" alt="Town Hall" class="popover-img"></clashcalc-assets-image>
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
                <clashcalc-assets-image src="/assets/buildings/builders_hut/level_8.png" alt="Builder" class="popover-img"></clashcalc-assets-image>
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
            <clashcalc-assets-svg name="info" width="18" height="18" class="popover-img"></clashcalc-assets-svg>
            <div class="popover-title-group">
                <span class="popover-title">${escapeHTML(translate('views.damageCalc.popovers.combatNoteTitle') || 'Combat Note')}</span>
                <span class="popover-badge">${escapeHTML(translate('views.damageCalc.popovers.simulationBadge') || 'Simulation')}</span>
            </div>
        `,
        body: `<p>${escapeHTML(translate('views.damageCalc.popovers.combatNoteBody') || 'Combat rule or mechanics modifier applied during this simulation step.')}</p>`
    };
}
