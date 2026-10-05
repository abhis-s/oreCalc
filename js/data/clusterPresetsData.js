/**
 * Configuration and resolver for recommended ZapQuake / Fireball cluster presets.
 * Presets are bracketed by Town Hall level (TH 16 to TH 18) to ensure only valid unlocked
 * defenses are presented to the user.
 */

/**
 * @typedef {Object} ClusterPreset
 * @property {string} id - Unique preset identifier ('preset_1', 'preset_2').
 * @property {string} titleKey - Localization key for preset title.
 * @property {string} defaultTitle - Fallback English title.
 * @property {string} descKey - Localization key for preset description.
 * @property {string} defaultDesc - Fallback English description.
 * @property {Array<string>} targets - Defense building keys included in the cluster.
 * @property {Array<string>} equipment - Hero equipment keys included in the cluster.
 */

/**
 * Resolves available recommended cluster presets for a specific Town Hall level.
 * Gated exclusively to Town Hall 16 through 18 where merged and high-density defenses exist.
 *
 * @param {number|string} townHallLevel - Active Town Hall level.
 * @returns {Array<ClusterPreset>} Array of available presets, or empty array if TH < 16.
 */
export function getClusterPresetsForTownHall(townHallLevel) {
    const th = Math.max(1, Math.min(18, Math.floor(Number(townHallLevel) || 18)));

    if (th >= 18) {
        return [
            {
                id: 'preset_1',
                titleKey: 'views.damageCalc.presets.fireballBlastPresetTitle',
                defaultTitle: 'Fireball Core Blast',
                descKey: 'views.damageCalc.presets.fireballBlastPresetDesc',
                defaultDesc: '5 Targets · Fireball',
                targets: ['cake_a_pult', 'inferno_tower', 'super_wizard_tower', 'multi_archer_tower', 'spell_tower'],
                equipment: ['fireball']
            },
            {
                id: 'preset_2',
                titleKey: 'views.damageCalc.presets.arrowBackpackPresetTitle',
                defaultTitle: 'Arrow Backpack Snipe',
                descKey: 'views.damageCalc.presets.arrowBackpackPresetDesc',
                defaultDesc: '3 Targets · Giant Arrow & Rocket Backpack',
                targets: ['revenge_tower', 'clan_castle', 'monolith'],
                equipment: ['giant_arrow', 'rocket_backpack']
            }
        ];
    }

    if (th === 17) {
        return [
            {
                id: 'preset_1',
                titleKey: 'views.damageCalc.presets.fireballBlastPresetTitle',
                defaultTitle: 'Fireball Core Blast',
                descKey: 'views.damageCalc.presets.fireballBlastPresetDesc',
                defaultDesc: '5 Targets · Fireball',
                targets: ['cake_a_pult', 'inferno_tower', 'firespitter', 'multi_archer_tower', 'spell_tower'],
                equipment: ['fireball']
            },
            {
                id: 'preset_2',
                titleKey: 'views.damageCalc.presets.arrowBackpackPresetTitle',
                defaultTitle: 'Arrow Backpack Snipe',
                descKey: 'views.damageCalc.presets.arrowBackpackPresetDesc',
                defaultDesc: '3 Targets · Giant Arrow & Rocket Backpack',
                targets: ['multi_gear_tower', 'clan_castle', 'monolith'],
                equipment: ['giant_arrow', 'rocket_backpack']
            }
        ];
    }

    if (th === 16) {
        return [
            {
                id: 'preset_1',
                titleKey: 'views.damageCalc.presets.fireballBlastPresetTitle',
                defaultTitle: 'Fireball Core Blast',
                descKey: 'views.damageCalc.presets.fireballBlastPresetDesc',
                defaultDesc: '5 Targets · Fireball',
                targets: ['cake_a_pult', 'inferno_tower', 'eagle_artillery', 'multi_archer_tower', 'spell_tower'],
                equipment: ['fireball']
            },
            {
                id: 'preset_2',
                titleKey: 'views.damageCalc.presets.arrowBackpackPresetTitle',
                defaultTitle: 'Arrow Backpack Snipe',
                descKey: 'views.damageCalc.presets.arrowBackpackPresetDesc',
                defaultDesc: '3 Targets · Giant Arrow & Rocket Backpack',
                targets: ['ricochet_cannon', 'clan_castle', 'monolith'],
                equipment: ['giant_arrow', 'rocket_backpack']
            }
        ];
    }

    return [];
}
