import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    ZERO_ORES,
    selectActivePlayerTag,
    selectActivePlayer,
    selectActiveHeroes,
    selectStoredOres,
    selectIncome,
    selectPlanner,
    selectPlayerProfile,
    selectHeroJourney,
    selectDerived,
    selectDerivedSourceIncome,
    selectUISettings
} from '../../js/core/selectors.js';

test('ZERO_ORES is an immutable frozen singleton with zero ore values', () => {
    assert.deepEqual(ZERO_ORES, { shiny: 0, glowy: 0, starry: 0 });
    assert.equal(Object.isFrozen(ZERO_ORES), true);
    assert.throws(() => {
        // @ts-ignore
        ZERO_ORES.shiny = 100;
    }, /Cannot assign to read only property/);
});

test('selectActivePlayerTag extracts active tag with DEFAULT0 fallback', () => {
    assert.equal(selectActivePlayerTag({ savedPlayerTags: ['PLAYER1', 'PLAYER2'] }), 'PLAYER1');
    assert.equal(selectActivePlayerTag({ savedPlayerTags: [] }), 'DEFAULT0');
    assert.equal(selectActivePlayerTag({}), 'DEFAULT0');
    assert.equal(selectActivePlayerTag(null), 'DEFAULT0');
    assert.equal(selectActivePlayerTag(undefined), 'DEFAULT0');
});

test('selectActivePlayer resolves partitioned player record or returns null', () => {
    const state = {
        savedPlayerTags: ['PLAYER1'],
        allPlayersData: {
            PLAYER1: { heroes: { barbarianKing: { level: 50 } } }
        }
    };
    assert.deepEqual(selectActivePlayer(state), { heroes: { barbarianKing: { level: 50 } } });

    const missingPlayerState = {
        savedPlayerTags: ['NON_EXISTENT'],
        allPlayersData: {}
    };
    assert.equal(selectActivePlayer(missingPlayerState), null);
    assert.equal(selectActivePlayer(null), null);
});

test('selectActiveHeroes, selectStoredOres, selectIncome, selectPlanner resolve root or partitioned state', () => {
    const rootState = {
        heroes: { barbarianKing: { level: 95 } },
        storedOres: { shiny: 5000, glowy: 200, starry: 10 },
        income: { starBonus: { league: 105000036 } },
        planner: { customMaxLevel: { barbarianPuppet: 18 } }
    };
    assert.deepEqual(selectActiveHeroes(rootState), { barbarianKing: { level: 95 } });
    assert.deepEqual(selectStoredOres(rootState), { shiny: 5000, glowy: 200, starry: 10 });
    assert.deepEqual(selectIncome(rootState), { starBonus: { league: 105000036 } });
    assert.deepEqual(selectPlanner(rootState), { customMaxLevel: { barbarianPuppet: 18 } });

    const partitionedState = {
        savedPlayerTags: ['PLAYER_P'],
        allPlayersData: {
            PLAYER_P: {
                heroes: { archerQueen: { level: 90 } },
                storedOres: { shiny: 1200, glowy: 50, starry: 0 },
                income: { gems: {} },
                planner: {}
            }
        }
    };
    assert.deepEqual(selectActiveHeroes(partitionedState), { archerQueen: { level: 90 } });
    assert.deepEqual(selectStoredOres(partitionedState), { shiny: 1200, glowy: 50, starry: 0 });
    assert.deepEqual(selectIncome(partitionedState), { gems: {} });
    assert.deepEqual(selectPlanner(partitionedState), {});
});

test('selectDerivedSourceIncome extracts timeframe rates from derived state', () => {
    const state = {
        derived: {
            incomeSources: {
                starBonus: {
                    daily: { shiny: 1000, glowy: 54, starry: 0 },
                    baseDaily: { shiny: 1000, glowy: 54, starry: 0 },
                    monthly: { shiny: 30440, glowy: 1643.76, starry: 0 }
                },
                raidMedalTrader: {
                    weekly: { shiny: 3000, glowy: 120, starry: 0 }
                }
            }
        }
    };

    assert.deepEqual(selectDerivedSourceIncome(state, 'starBonus', 'daily'), { shiny: 1000, glowy: 54, starry: 0 });
    assert.deepEqual(selectDerivedSourceIncome(state, 'starBonus', 'baseDaily'), { shiny: 1000, glowy: 54, starry: 0 });
    assert.deepEqual(selectDerivedSourceIncome(state, 'starBonus'), { shiny: 30440, glowy: 1643.76, starry: 0 });
    assert.deepEqual(selectDerivedSourceIncome(state, 'raidMedalTrader', 'weekly'), { shiny: 3000, glowy: 120, starry: 0 });
    assert.deepEqual(selectDerivedSourceIncome(state, 'gemTrader', 'weekly'), ZERO_ORES);
});

test('selectors return safe immutable defaults on empty or null states', () => {
    assert.deepEqual(selectActiveHeroes(null), {});
    assert.equal(selectStoredOres(null), ZERO_ORES);
    assert.deepEqual(selectIncome(null), {});
    assert.deepEqual(selectPlanner(null), {});
    assert.equal(selectPlayerProfile(null), null);
    assert.equal(selectHeroJourney(null), null);
    assert.deepEqual(selectDerived(null), {});
    assert.deepEqual(selectDerivedSourceIncome(null, 'starBonus'), ZERO_ORES);
    assert.deepEqual(selectDerivedSourceIncome({}, 'starBonus'), ZERO_ORES);
    assert.deepEqual(selectUISettings(null), {});
});
