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
        },
        heroJourney: {
            overrideUnclaimed: []
        }
    };
    const upcoming = calculateHeroJourneyUpcomingOres(mockState);
    assert.equal(upcoming.shiny, 0);
    assert.equal(upcoming.glowy, 0);
    assert.equal(upcoming.starry, 0);
});
