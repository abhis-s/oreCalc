import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    getHeroMaxLevelForTH,
    getMaxCumulativeHeroLevel,
    getMaxCumulativeLevelForTH,
    getMaxCumulativeLevelsByTH,
    getMaxTownHallLevel,
    getCumulativeHeroLevel,
    getRawCumulativeHeroLevel,
    getTownHallLevel,
    isTrueMaxCumulativeLevel
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

test('getTownHallLevel extracts TH correctly with dynamic max TH fallback', () => {
    assert.equal(getTownHallLevel({ playerProfile: { townHallLevel: 15 } }), 15);
    assert.equal(getTownHallLevel({}), getMaxTownHallLevel());
});

test('getQuestChestReward returns valid non-zero rewards across TH tiers including TH19', () => {
    const normalReward = getQuestChestReward(16, 'normal');
    assert.ok(normalReward.shiny > 0);
    assert.ok(normalReward.glowy > 0);
    assert.ok(normalReward.starry > 0);

    const acceleratedReward = getQuestChestReward(16, 'accelerated');
    assert.ok(acceleratedReward.shiny >= normalReward.shiny);

    const th19Normal = getQuestChestReward(19, 'normal');
    assert.deepEqual(th19Normal, {
        shiny: 2250,
        glowy: 110,
        starry: 65,
        minShiny: 2150,
        maxShiny: 2350,
        minGlowy: 100,
        maxGlowy: 120,
        minStarry: 60,
        maxStarry: 70
    });

    const th19Accelerated = getQuestChestReward(19, 'accelerated');
    assert.deepEqual(th19Accelerated, {
        shiny: 4500,
        glowy: 220,
        starry: 130,
        minShiny: 4400,
        maxShiny: 4600,
        minGlowy: 210,
        maxGlowy: 230,
        minStarry: 125,
        maxStarry: 135
    });

    const th19Heroes = [
        { name: 'Barbarian King', level: 110, village: 'home' },
        { name: 'Archer Queen', level: 110, village: 'home' },
        { name: 'Minion Prince', level: 95, village: 'home' },
        { name: 'Grand Warden', level: 85, village: 'home' },
        { name: 'Royal Champion', level: 55, village: 'home' },
        { name: 'Dragon Duke', level: 1, village: 'home' }
    ];
    const th19SyncedUpcomingNormal = calculateHeroJourneyUpcomingOres({
        playerProfile: { tag: '8PJYGUJC', townHallLevel: 19, heroes: th19Heroes },
        heroJourney: { acceleratedRewards: false }
    });
    const th19SyncedUpcomingAccelerated = calculateHeroJourneyUpcomingOres({
        playerProfile: { tag: '8PJYGUJC', townHallLevel: 19, heroes: th19Heroes },
        heroJourney: { acceleratedRewards: true }
    });
    // Above cumulative level 456: Node 460 quest (TH19 chest) + Node 465 (50 Starry) + Node 498 (60 Starry)
    assert.equal(th19SyncedUpcomingNormal.shiny, 2250);
    assert.equal(th19SyncedUpcomingNormal.glowy, 110);
    assert.equal(th19SyncedUpcomingNormal.starry, 65 + 50 + 60);
    assert.equal(th19SyncedUpcomingAccelerated.shiny, 4500);
    assert.equal(th19SyncedUpcomingAccelerated.glowy, 220);
    assert.equal(th19SyncedUpcomingAccelerated.starry, 130 + 50 + 60);
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

test('getCumulativeHeroLevel walks down from TH19 without 100-level fallback clamping on BK and AQ', () => {
    const th19OwnedHeroesState = {
        playerProfile: {
            townHallLevel: 19,
            ownedHeroes: {
                'Barbarian King': { level: 110 },
                'Archer Queen': { level: 110 },
                'Minion Prince': { level: 95 },
                'Grand Warden': { level: 85 },
                'Royal Champion': { level: 55 },
                'Dragon Duke': { level: 25 }
            }
        }
    };
    assert.equal(getCumulativeHeroLevel(th19OwnedHeroesState), 480);

    const th19ApiHeroesState = {
        playerProfile: {
            townHallLevel: 19,
            heroes: [
                { name: 'Barbarian King', level: 110, village: 'home' },
                { name: 'Archer Queen', level: 110, village: 'home' }
            ]
        }
    };
    assert.equal(getCumulativeHeroLevel(th19ApiHeroesState), 220);

    const th19FallbackGuestState = {
        playerProfile: { townHallLevel: 19 },
        heroes: {
            'Barbarian King': { level: 110, enabled: true },
            'Archer Queen': { level: 110, enabled: true }
        }
    };
    assert.equal(getCumulativeHeroLevel(th19FallbackGuestState), 220);
});

test('TH 19 resolves Hero Journey track cap cleanly while exposing raw cumulative hero levels beyond track max', () => {
    const trackMax = getMaxCumulativeHeroLevel();
    assert.ok(trackMax > 0);
    assert.equal(getMaxCumulativeLevelForTH(19), trackMax);
    assert.equal(getMaxCumulativeLevelForTH(17), getMaxCumulativeLevelsByTH()[17]);
    assert.equal(getMaxCumulativeLevelForTH(6), 0);

    const partialTh19State = {
        playerProfile: {
            townHallLevel: 19,
            heroes: [
                { name: 'Barbarian King', level: 80, village: 'home' },
                { name: 'Archer Queen', level: 80, village: 'home' }
            ]
        }
    };
    assert.equal(getRawCumulativeHeroLevel(partialTh19State), 160);
    assert.equal(getCumulativeHeroLevel(partialTh19State), 160);

    const maxedTh19State = {
        playerProfile: {
            townHallLevel: 19,
            heroes: [
                { name: 'Barbarian King', level: 115, village: 'home' },
                { name: 'Archer Queen', level: 115, village: 'home' },
                { name: 'Minion Prince', level: 100, village: 'home' },
                { name: 'Grand Warden', level: 90, village: 'home' },
                { name: 'Royal Champion', level: 60, village: 'home' },
                { name: 'Dragon Duke', level: 30, village: 'home' }
            ]
        }
    };
    assert.equal(getRawCumulativeHeroLevel(maxedTh19State), 510);
    assert.equal(getCumulativeHeroLevel(maxedTh19State), 510);
    assert.equal(trackMax, 510);
    assert.equal(isTrueMaxCumulativeLevel(510), true);
    assert.deepEqual(calculateHeroJourneyUpcomingOres(maxedTh19State), { shiny: 0, glowy: 0, starry: 0 });
});

test('getHeroMaxLevelForTH resolves TH-scoped caps across hero keys and display names', () => {
    assert.equal(getHeroMaxLevelForTH('barbarianKing', 19), 115);
    assert.equal(getHeroMaxLevelForTH('Barbarian King', 18), 110);
    assert.equal(getHeroMaxLevelForTH('Dragon Duke', 19), 30);
    assert.equal(getHeroMaxLevelForTH('dragonDuke', 18), 25);
    assert.equal(getHeroMaxLevelForTH('dragonDuke', 15), 10);
    assert.equal(getHeroMaxLevelForTH('dragonDuke', 14), 0);
});
