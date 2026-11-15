/**
 * Configuration and resolver for recommended ZapQuake / Fireball cluster presets.
 * Presets are bracketed by Town Hall level (TH 16+) to ensure only valid unlocked
 * defenses are presented to the user.
 */

import { MAX_TOWN_HALL } from '../core/constants.js';
import { getDefensesData } from './defenseTargetsData.js';
import {
    isClusterDefenseSunsetForTownHall,
    isDefenseInSeason
} from '../domain/damage/defenseProgressionDomain.js';

/**
 * @typedef {Object} ClusterPreset
 * @property {string} id - Unique preset identifier ('preset_1', 'preset_2').
 * @property {string} titleKey - Localization key for preset title.
 * @property {string} defaultTitle - Fallback English title.
 * @property {string} descKey - Localization key for preset description.
 * @property {string} defaultDesc - Fallback English description.
 * @property {Array<string>} targets - Defense building keys included in the cluster.
 * @property {Array<string>} equipment - Hero equipment keys included in the cluster.
 * @property {number} [baseTargetCount] - Original target count prior to seasonal expiry filtering.
 */

const TH_CLUSTER_TIERS = Object.freeze([
    { minTH: 19, primary: 'firecracker_tower', secondary: 'spiky_tower' },
    { minTH: 18, primary: 'super_wizard_tower', secondary: 'revenge_tower' },
    { minTH: 17, primary: 'firespitter', secondary: 'multi_gear_tower' },
    { minTH: 16, primary: 'eagle_artillery', secondary: 'ricochet_cannon' }
]);

/**
 * Resolves available recommended cluster presets for a specific Town Hall level.
 * Gated to Town Hall 16 and above where merged and high-density defenses exist,
 * excluding crafted/seasonal defenses once past their expiry date.
 *
 * @param {number|string} townHallLevel - Active Town Hall level.
 * @param {Date|string|number} [referenceDate=new Date()] - Reference date for seasonal defense filtering.
 * @returns {Array<ClusterPreset>} Array of available presets, or empty array if TH < 16.
 */
export function getClusterPresetsForTownHall(townHallLevel, referenceDate = new Date()) {
    const th = Math.max(1, Math.min(MAX_TOWN_HALL, Math.floor(Number(townHallLevel) || MAX_TOWN_HALL)));
    const tier = TH_CLUSTER_TIERS.find(entry => th >= entry.minTH);
    if (!tier) return [];

    const defs = getDefensesData();
    const hasLoadedDefs = Boolean(defs && Object.keys(defs).length > 0);
    const filterEligibleTargets = (targets) => {
        if (!hasLoadedDefs) return targets;
        return targets.filter(key => {
            const def = defs[key];
            if (!def) return false;
            if (isClusterDefenseSunsetForTownHall(def, th)) return false;
            return isDefenseInSeason(def, referenceDate);
        });
    };

    const rawPresets = [
        {
            id: 'preset_1',
            titleKey: 'views.damageCalc.presets.fireballBlastPresetTitle',
            defaultTitle: 'Fireball Core Blast',
            descKey: 'views.damageCalc.presets.fireballBlastPresetDesc',
            defaultDesc: '5 Targets · Fireball',
            targets: ['cake_a_pult', 'inferno_tower', tier.primary, 'multi_archer_tower', 'spell_tower'],
            equipment: ['fireball']
        },
        {
            id: 'preset_2',
            titleKey: 'views.damageCalc.presets.arrowBackpackPresetTitle',
            defaultTitle: 'Arrow Backpack Snipe',
            descKey: 'views.damageCalc.presets.arrowBackpackPresetDesc',
            defaultDesc: '3 Targets · Giant Arrow & Rocket Backpack',
            targets: [tier.secondary, 'clan_castle', 'monolith'],
            equipment: ['giant_arrow', 'rocket_backpack']
        }
    ];

    return rawPresets
        .map(preset => {
            const activeTargets = filterEligibleTargets(preset.targets);
            return {
                ...preset,
                baseTargetCount: preset.targets.length,
                targets: activeTargets
            };
        })
        .filter(preset => preset.targets.length >= 2);
}
