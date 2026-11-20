import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
    isEligibleForCraftPassPrelevel,
    syncCraftPassPreleveling
} from '../../js/domain/equipment/craftPassPrelevelDomain.js';
import { createComingSoonEquipmentItem } from '../../js/domain/equipment/comingSoonEquipmentDomain.js';
import { getDefaultEquipmentUnlockLevel } from '../../js/domain/income/heroJourneyResolution.js';

describe('Craft Pass Pre-Level Domain Suite', () => {
    describe('isEligibleForCraftPassPrelevel', () => {
        test('qualifies unowned Blizzard Axe when year < 2027', () => {
            const state = { playerProfile: null };
            assert.equal(isEligibleForCraftPassPrelevel('blizzardAxe', 'legendary', state, 2026), true);
            assert.equal(isEligibleForCraftPassPrelevel('Blizzard Axe', 'legendary', state, 2026), true);
        });

        test('disqualifies Blizzard Axe when year >= 2027', () => {
            const state = { playerProfile: null };
            assert.equal(isEligibleForCraftPassPrelevel('blizzardAxe', 'legendary', state, 2027), false);
            assert.equal(isEligibleForCraftPassPrelevel('blizzardAxe', 'legendary', state, 2028), false);
        });

        test('disqualifies Blizzard Axe when already owned by the player', () => {
            const state = {
                playerProfile: {
                    ownedEquipment: ['Blizzard Axe']
                }
            };
            assert.equal(isEligibleForCraftPassPrelevel('blizzardAxe', 'legendary', state, 2026), false);
        });

        test('qualifies unowned custom Coming Soon equipment when rarity is legendary', () => {
            const state = { playerProfile: null };
            assert.equal(isEligibleForCraftPassPrelevel('comingSoon', 'legendary', state, 2026), true);
            assert.equal(isEligibleForCraftPassPrelevel('comingSoon', 'legendary', state, 2028), true);
        });

        test('disqualifies custom Coming Soon equipment when rarity is common or epic', () => {
            const state = { playerProfile: null };
            assert.equal(isEligibleForCraftPassPrelevel('comingSoon', 'epic', state, 2026), false);
            assert.equal(isEligibleForCraftPassPrelevel('comingSoon', 'common', state, 2026), false);
        });

        test('disqualifies released live equipment even if unowned', () => {
            const state = {
                playerProfile: {
                    ownedEquipment: []
                }
            };
            assert.equal(isEligibleForCraftPassPrelevel('spikyBall', 'epic', state, 2026), false);
            assert.equal(isEligibleForCraftPassPrelevel('giantGauntlet', 'epic', state, 2026), false);
            assert.equal(isEligibleForCraftPassPrelevel('barbarianPuppet', 'common', state, 2026), false);
        });
    });

    describe('syncCraftPassPreleveling', () => {
        test('sets unowned Blizzard Axe and Coming Soon Legendary to Level 15 when Craft Pass is bought in 2026', () => {
            const heroesState = {
                barbarianKing: {
                    equipment: {
                        blizzardAxe: { level: 1, checked: false },
                        comingSoon: { level: 1, checked: true, type: 'legendary' }
                    }
                }
            };
            const appState = { playerProfile: null };

            syncCraftPassPreleveling(heroesState, true, appState, 2026);

            assert.equal(heroesState.barbarianKing.equipment.blizzardAxe.level, 15);
            assert.equal(heroesState.barbarianKing.equipment.blizzardAxe.checked, false);
            assert.equal(heroesState.barbarianKing.equipment.comingSoon.level, 15);
        });

        test('resets unowned Blizzard Axe and Coming Soon Legendary to Level 1 when Craft Pass is not bought', () => {
            const heroesState = {
                barbarianKing: {
                    equipment: {
                        blizzardAxe: { level: 15, checked: false },
                        comingSoon: { level: 15, checked: true, type: 'legendary' }
                    }
                }
            };
            const appState = { playerProfile: null };

            syncCraftPassPreleveling(heroesState, false, appState, 2026);

            assert.equal(heroesState.barbarianKing.equipment.blizzardAxe.level, 1);
            assert.equal(heroesState.barbarianKing.equipment.comingSoon.level, 1);
        });

        test('strictly never overwrites owned equipment levels during Craft Pass state changes', () => {
            const heroesState = {
                barbarianKing: {
                    equipment: {
                        blizzardAxe: { level: 23, checked: true }
                    }
                }
            };
            const appState = {
                playerProfile: {
                    ownedEquipment: ['Blizzard Axe']
                }
            };

            syncCraftPassPreleveling(heroesState, true, appState, 2026);
            assert.equal(heroesState.barbarianKing.equipment.blizzardAxe.level, 23);

            syncCraftPassPreleveling(heroesState, false, appState, 2026);
            assert.equal(heroesState.barbarianKing.equipment.blizzardAxe.level, 23);
        });
    });

    describe('createComingSoonEquipmentItem with Craft Pass integration', () => {
        test('creates Legendary item at Level 15 when Craft Pass is bought', () => {
            const item = createComingSoonEquipmentItem('legendary', true);
            assert.equal(item.level, 15);
            assert.equal(item.type, 'legendary');
            assert.equal(item.isCustom, true);
        });

        test('creates Legendary item at Level 1 when Craft Pass is not bought', () => {
            const item = createComingSoonEquipmentItem('legendary', false);
            assert.equal(item.level, 1);
            assert.equal(item.type, 'legendary');
        });

        test('creates Epic and Common items at Level 1 regardless of Craft Pass state', () => {
            const epicItem = createComingSoonEquipmentItem('epic', true);
            assert.equal(epicItem.level, 1);
            assert.equal(epicItem.type, 'epic');

            const commonItem = createComingSoonEquipmentItem('common', true);
            assert.equal(commonItem.level, 1);
            assert.equal(commonItem.type, 'common');
        });

        test('getDefaultEquipmentUnlockLevel does not apply Craft Pass prelevel to comingSoon or epic items', () => {
            const stateWithCraftPass = {
                playerProfile: null,
                income: { craftPass: { craftPass: true } },
                heroes: {
                    barbarianKing: {
                        equipment: {
                            comingSoon: { level: 1, type: 'common', isCustom: true }
                        }
                    }
                }
            };
            assert.equal(getDefaultEquipmentUnlockLevel('barbarianKing', 'comingSoon', stateWithCraftPass), 1);
            assert.equal(getDefaultEquipmentUnlockLevel('barbarianKing', 'Giant Gauntlet', stateWithCraftPass), 1);
        });
    });
});
