import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    getMaxCumulativeLevelsByTH,
    getCumulativeHeroLevel,
    getTownHallLevel
} from '../../js/domain/income/heroJourneyLevels.js';
import {
    getQuestChestReward,
    calculateHeroJourneyUpcomingOres
} from '../../js/domain/income/heroJourneyIncome.js';

test('getMaxCumulativeLevelsByTH returns memoized monotonically increasing caps per Town Hall', () => {
    const caps = getMaxCumulativeLevelsByTH();
    assert.ok(caps[7] > 0);
    assert.ok(caps[10] > caps[7]);
    assert.ok(caps[15] > caps[10]);
    assert.ok(caps[18] >= caps[17]);

    const capsSecondCall = getMaxCumulativeLevelsByTH();
    assert.equal(caps, capsSecondCall);
});

test('getCumulativeHeroLevel computes sum of active hero levels correctly', () => {
    const mockState = {
        heroes: {
            'Barbarian King': { level: 50 },
            'Archer Queen': { level: 50 },
            'Grand Warden': { level: 30 },
            'Royal Champion': { level: 20 }
        }
    };
    const totalLevel = getCumulativeHeroLevel(mockState);
    assert.equal(totalLevel, 150);
});

test('getTownHallLevel extracts TH correctly with fallback to 16', () => {
    assert.equal(getTownHallLevel({ playerProfile: { townHallLevel: 15 } }), 15);
    assert.equal(getTownHallLevel({}), 16);
});

test('getQuestChestReward returns valid non-zero rewards for valid Town Hall', () => {
    const normalReward = getQuestChestReward(16, 'normal');
    assert.ok(normalReward.shiny > 0);
    assert.ok(normalReward.glowy > 0);
    assert.ok(normalReward.starry > 0);

    const acceleratedReward = getQuestChestReward(16, 'accelerated');
    assert.ok(acceleratedReward.shiny >= normalReward.shiny);
});

test('calculateHeroJourneyUpcomingOres returns 0 ores for maxed player', () => {
    const mockState = {
        heroes: {
            barbarianKing: { level: 95 },
            archerQueen: { level: 95 },
            grandWarden: { level: 70 },
            royalChampion: { level: 45 },
            minionPrince: { level: 90 }
        },
        playerProfile: {
            townHallLevel: 18,
            ownedHeroes: ['barbarianKing', 'archerQueen', 'grandWarden', 'royalChampion', 'minionPrince']
        }
    };
    const upcoming = calculateHeroJourneyUpcomingOres(mockState);
    assert.equal(upcoming.shiny, 0);
    assert.equal(upcoming.glowy, 0);
    assert.equal(upcoming.starry, 0);
});

test('getResolvedEquipmentReward resolves exact canonical equipment and unlock levels', async () => {
    const { getResolvedEquipmentReward, getDefaultEquipmentUnlockLevel } = await import('../../js/domain/income/heroJourneyResolution.js');
    const { heroJourneyNodes } = await import('../../js/data/heroJourneyData.js');

    const node20 = heroJourneyNodes.find(n => n.level === 20);
    const resolved20 = getResolvedEquipmentReward(node20, {});
    assert.equal(resolved20.resolvedKey, 'giantGauntlet');
    assert.equal(resolved20.equipmentLevel, 1);
    assert.equal(resolved20.isFallbackStarry, false);

    const node50 = heroJourneyNodes.find(n => n.level === 50);
    const resolved50 = getResolvedEquipmentReward(node50, {});
    assert.equal(resolved50.resolvedKey, 'frozenArrow');
    assert.equal(resolved50.equipmentLevel, 6);
    assert.equal(resolved50.isFallbackStarry, false);

    const node99 = heroJourneyNodes.find(n => n.level === 99);
    const resolved99 = getResolvedEquipmentReward(node99, {});
    assert.equal(resolved99.resolvedKey, 'darkCrown');
    assert.equal(resolved99.equipmentLevel, 9);

    const node203 = heroJourneyNodes.find(n => n.level === 203);
    const resolved203 = getResolvedEquipmentReward(node203, {});
    assert.equal(resolved203.resolvedKey, 'magicMirror');
    assert.equal(resolved203.equipmentLevel, 12);

    const node354 = heroJourneyNodes.find(n => n.level === 354);
    const resolved354 = getResolvedEquipmentReward(node354, {});
    assert.equal(resolved354.resolvedKey, 'lavaloonPuppet');
    assert.equal(resolved354.equipmentLevel, 15);

    // Test owned equipment fallback to 50 Starry Ore for synced player when entire pool is owned
    const mockSyncedAllAQ = {
        playerProfile: {
            tag: '#PLAYER1',
            ownedEquipment: {
                'Frozen Arrow': 18,
                'Magic Mirror': 18,
                'Action Figure': 18,
                'Monolith Arrow': 18
            }
        }
    };
    const resolvedOwnedMirror = getResolvedEquipmentReward(node203, mockSyncedAllAQ);
    assert.equal(resolvedOwnedMirror.isFallbackStarry, true);
    assert.equal(resolvedOwnedMirror.fallbackStarry, 50);

    // Test planner checkbox decoupling: checking planner does NOT trigger track fallback for guest
    const mockPlannerChecked = {
        heroes: {
            'Archer Queen': {
                equipment: {
                    'Magic Mirror': { level: 18, checked: true }
                }
            }
        }
    };
    const resolvedPlannerChecked = getResolvedEquipmentReward(node203, mockPlannerChecked);
    assert.equal(resolvedPlannerChecked.resolvedKey, 'magicMirror');
    assert.equal(resolvedPlannerChecked.isFallbackStarry, false);

    // Test getDefaultEquipmentUnlockLevel
    assert.equal(getDefaultEquipmentUnlockLevel('archerQueen', 'magicMirror'), 12);
    assert.equal(getDefaultEquipmentUnlockLevel('barbarianKing', 'giantGauntlet'), 1);
    assert.equal(getDefaultEquipmentUnlockLevel('grandWarden', 'lavaloonPuppet'), 15);
});
