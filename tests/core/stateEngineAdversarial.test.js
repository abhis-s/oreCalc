import { test, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';

if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (key) => store.has(key) ? store.get(key) : null,
        setItem: (key, val) => store.set(key, String(val)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
        get length() { return store.size; },
        key: (i) => Array.from(store.keys())[i] || null
    };
}

if (typeof globalThis.sessionStorage === 'undefined') {
    const sessionStore = new Map();
    globalThis.sessionStorage = {
        getItem: (key) => sessionStore.has(key) ? sessionStore.get(key) : null,
        setItem: (key, val) => sessionStore.set(key, String(val)),
        removeItem: (key) => sessionStore.delete(key),
        clear: () => sessionStore.clear(),
        get length() { return sessionStore.size; },
        key: (i) => Array.from(sessionStore.keys())[i] || null
    };
}

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        addEventListener: () => {},
        removeEventListener: () => {},
        __ENV__: { APP_VERSION: '2.1.0' },
        location: { hostname: 'localhost' }
    };
}

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        dispatchEvent: () => true,
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => []
    };
}

if (typeof globalThis.CustomEvent === 'undefined') {
    globalThis.CustomEvent = class CustomEvent {
        constructor(type, eventInitDict) {
            this.type = type;
            this.detail = eventInitDict?.detail;
        }
    };
}

const stateModule = await import('../../js/core/state.js');
const {
    state,
    getDefaultState,
    getDefaultPlayerState,
    initializeState,
    DEFAULT_CUSTOM_CHIP_SETTINGS
} = stateModule;

const localStorageManager = await import('../../js/core/localStorageManager.js');
const {
    resetState,
    saveState,
    loadState,
    setResettingState,
    getResettingState,
    updateSavedPlayerTags,
    updateAllPlayersData
} = localStorageManager;

const { calculateStarBonusIncome } = await import('../../js/domain/income/starBonusIncome.js');
const { calculateEventPassIncome } = await import('../../js/domain/income/eventPassIncome.js');
const { migrateFullState, compareVersions } = await import('../../js/core/stateCleanup.js');
const { recalculateAll } = await import('../../js/core/calculator.js');

describe('Adversarial Challenge: State Engine Modernization (Milestone 1)', () => {

    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        setResettingState(false);
        const fresh = getDefaultState();
        for (const k of Object.keys(state)) {
            delete state[k];
        }
        Object.assign(state, fresh);
        state.savedPlayerTags = ['DEFAULT0'];
        state.allPlayersData = {};
    });

    describe('1. resetState() Storage Destruction & Race-Condition Adversarial Tests', () => {
        test('resetState() thoroughly wipes multi-origin partitioned player keys, app settings, and session flags', () => {
            localStorage.setItem('oreCalc_playerTags', JSON.stringify(['TAG1', 'TAG2', 'TAG3']));
            localStorage.setItem('oreCalc_player_TAG1', JSON.stringify({ name: 'Player 1' }));
            localStorage.setItem('oreCalc_player_TAG2', JSON.stringify({ name: 'Player 2' }));
            localStorage.setItem('oreCalc_player_TAG3', JSON.stringify({ name: 'Player 3' }));
            localStorage.setItem('oreCalc_appSettings', JSON.stringify({ theme: 'dark', currency: { code: 'EUR' } }));
            localStorage.setItem('oreCalc_userId', 'user-12345-uuid');
            localStorage.setItem('oreCalculatorState', '{"legacy": true}');
            localStorage.setItem('unrelated_third_party_key', 'should_also_be_cleared');

            sessionStorage.setItem('oreCalc_showChangelog', 'true');
            sessionStorage.setItem('active_session_token', 'xyz987');

            assert.equal(localStorage.length, 8);
            assert.equal(sessionStorage.length, 2);

            resetState();

            assert.equal(localStorage.length, 0);
            assert.equal(sessionStorage.length, 0);
            assert.equal(getResettingState(), true);
        });

        test('resetState() aborts pending debounced saveState timers to prevent race condition revival', async () => {
            state.savedPlayerTags = ['P_RACE'];
            state.allPlayersData = {
                P_RACE: { heroes: {}, storedOres: { shiny: 9999 }, income: {}, planner: {} }
            };

            saveState(state, false);

            resetState();

            assert.equal(localStorage.length, 0);

            await new Promise(resolve => setTimeout(resolve, 1100));

            assert.equal(localStorage.length, 0);
            assert.equal(localStorage.getItem('oreCalc_player_P_RACE'), null);
        });

        test('resetState() handles localStorage / sessionStorage throwing exceptions gracefully', () => {
            const originalClear = localStorage.clear;
            const originalSessionClear = sessionStorage.clear;

            localStorage.clear = () => {
                throw new DOMException('The quota has been exceeded or access is denied', 'QuotaExceededError');
            };
            sessionStorage.clear = () => {
                throw new DOMException('Storage access blocked in private browsing mode', 'SecurityError');
            };

            assert.doesNotThrow(() => {
                resetState();
            });

            assert.equal(getResettingState(), true);

            localStorage.clear = originalClear;
            sessionStorage.clear = originalSessionClear;
        });

        test('loadState() handles completely corrupted, truncated, and malicious JSON in storage', () => {
            localStorage.setItem('oreCalc_playerTags', '<<<INVALID JSON>>>');
            localStorage.setItem('oreCalc_appSettings', '{"broken": [1, 2,');
            localStorage.setItem('oreCalc_player_DEFAULT0', 'undefined');

            const loaded = loadState();

            assert.ok(loaded);
            assert.deepEqual(loaded.savedPlayerTags, ['DEFAULT0']);
            assert.ok(loaded.allPlayersData['DEFAULT0']);
            assert.deepEqual(loaded.uiSettings, {});
        });

        test('loadState() automatically migrates legacy monolithic oreCalculatorState key into partitioned state', () => {
            const legacyStatePayload = {
                appVersion: '1.9.0',
                timestamp: '2026-01-01T00:00:00Z',
                savedPlayerTags: ['#LEGACY1'],
                allPlayersData: {
                    LEGACY1: {
                        heroes: {
                            "Barbarian King": {
                                enabled: true,
                                equipment: {
                                    "Giant Gauntlet": { level: 18, checked: true }
                                }
                            }
                        },
                        income: {
                            starBonus: { league: 105000036 }
                        }
                    }
                },
                uiSettings: {
                    currency: 'EUR',
                    language: 'de'
                }
            };

            localStorage.setItem('oreCalculatorState', JSON.stringify(legacyStatePayload));

            const loaded = loadState();
            assert.ok(loaded);
            assert.equal(localStorage.getItem('oreCalculatorState'), null);
            assert.ok(localStorage.getItem('oreCalc_playerTags'));
            assert.ok(localStorage.getItem('oreCalc_player_LEGACY1'));
            assert.ok(localStorage.getItem('oreCalc_appSettings'));
        });
    });

    describe('2. DEFAULT_CUSTOM_CHIP_SETTINGS Immutability & Multi-Player Isolation', () => {
        test('DEFAULT_CUSTOM_CHIP_SETTINGS is deeply frozen across all chip types', () => {
            assert.ok(Object.isFrozen(DEFAULT_CUSTOM_CHIP_SETTINGS));

            const chipKeys = [
                'custom', 'starBonus', 'shopOffers', 'gemTrader', 'raidMedalTrader',
                'eventTrader', 'eventPass', 'clanWar', 'cwl', 'supercellEvents', 'prospector'
            ];

            for (const key of chipKeys) {
                assert.ok(
                    Object.isFrozen(DEFAULT_CUSTOM_CHIP_SETTINGS[key]),
                    `DEFAULT_CUSTOM_CHIP_SETTINGS.${key} must be frozen`
                );
            }
        });

        test('Attempting direct property mutation on DEFAULT_CUSTOM_CHIP_SETTINGS throws or fails in strict mode', () => {
            assert.throws(() => {
                // @ts-ignore
                DEFAULT_CUSTOM_CHIP_SETTINGS.starBonus.monthly = true;
            }, TypeError);

            assert.throws(() => {
                // @ts-ignore
                DEFAULT_CUSTOM_CHIP_SETTINGS.clanWar.shiny = 9999;
            }, TypeError);

            assert.throws(() => {
                // @ts-ignore
                DEFAULT_CUSTOM_CHIP_SETTINGS.newMaliciousProp = 'hacked';
            }, TypeError);
        });

        test('State isolation: Modifying customChipSettings for Player A does not affect Player B', () => {
            const playerA = getDefaultPlayerState();
            const playerB = getDefaultPlayerState();

            playerA.planner.calendar.customChipSettings.starBonus.monthly = true;
            playerA.planner.calendar.customChipSettings.starBonus.count = 4;
            playerA.planner.calendar.customChipSettings.clanWar.shiny = 1200;

            assert.equal(playerB.planner.calendar.customChipSettings.starBonus.monthly, false);
            assert.equal(playerB.planner.calendar.customChipSettings.starBonus.count, 0);
            assert.equal(playerB.planner.calendar.customChipSettings.clanWar.shiny, 0);

            assert.equal(DEFAULT_CUSTOM_CHIP_SETTINGS.starBonus.monthly, false);
            assert.equal(DEFAULT_CUSTOM_CHIP_SETTINGS.starBonus.count, 0);
            assert.equal(DEFAULT_CUSTOM_CHIP_SETTINGS.clanWar.shiny, 0);
        });

        test('Chip type isolation: Modifying one chip type in customChipSettings does not affect others', () => {
            const player = getDefaultPlayerState();
            const chipSettings = player.planner.calendar.customChipSettings;

            chipSettings.clanWar.monthly = true;
            chipSettings.clanWar.shiny = 600;

            assert.equal(chipSettings.cwl.monthly, false);
            assert.equal(chipSettings.cwl.shiny, 0);
            assert.equal(chipSettings.shopOffers.shiny, 0);
            assert.equal(chipSettings.supercellEvents.shiny, 0);
        });
    });

    describe('3. ensureStateDefaults & initializeState Robustness on Malformed Inputs', () => {
        test('initializeState handles null, empty, or primitive savedState without throwing', () => {
            assert.doesNotThrow(() => initializeState(null));
            assert.doesNotThrow(() => initializeState({}));
            assert.doesNotThrow(() => initializeState(/** @type {any} */ ('malformed-string')));
            assert.doesNotThrow(() => initializeState(/** @type {any} */ (12345)));
        });

        test('initializeState repairs deeply stripped and missing player objects in allPlayersData', () => {
            const partialSavedState = {
                appVersion: '2.0.0',
                savedPlayerTags: ['P1', 'P2'],
                allPlayersData: {
                    P1: {
                        heroes: {},
                        storedOres: null,
                        income: null,
                        planner: null,
                        currency: null
                    },
                    P2: {
                        heroes: {
                            "Barbarian King": {
                                equipment: {
                                    "Giant Gauntlet": { level: 1 }
                                }
                            }
                        },
                        income: {
                            clanWar: null,
                            cwl: {},
                            eventPass: { trader: null }
                        },
                        planner: {
                            calendar: {
                                view: { month: '1999-01', week: '1999-01' },
                                customChipSettings: null
                            }
                        }
                    }
                }
            };

            initializeState(partialSavedState);

            const p1 = stateModule.state.allPlayersData['P1'];
            assert.ok(p1);
            assert.ok(p1.heroes);
            assert.ok(p1.storedOres);
            assert.equal(p1.storedOres.shiny, 0);
            assert.ok(p1.income);
            assert.ok(p1.income.starBonus);
            assert.ok(p1.planner);
            assert.ok(p1.planner.calendar.customChipSettings);

            const p2 = stateModule.state.allPlayersData['P2'];
            assert.ok(p2);
            assert.ok(p2.income.clanWar);
            assert.ok(p2.income.cwl.oresPerAttack);
            assert.ok(p2.income.eventPass.trader.packs);
            assert.ok(p2.planner.calendar.customChipSettings.clanWar);

            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            assert.equal(p2.planner.calendar.view.month, currentMonth);
        });

        test('initializeState properly normalizes legacy string currency values to objects', () => {
            const stateWithLegacyCurrency = {
                appVersion: '2.0.0',
                savedPlayerTags: ['PLAYER_CURR'],
                uiSettings: {
                    currency: 'EUR'
                },
                allPlayersData: {
                    PLAYER_CURR: {
                        currency: 'GBP'
                    }
                }
            };

            initializeState(stateWithLegacyCurrency);

            assert.equal(typeof stateModule.state.uiSettings.currency, 'object');
            assert.equal(stateModule.state.uiSettings.currency.code, 'GBP');
            assert.equal(typeof stateModule.state.allPlayersData['PLAYER_CURR'].currency, 'object');
            assert.equal(stateModule.state.allPlayersData['PLAYER_CURR'].currency.code, 'GBP');
        });

        test('getDefaultPlayerState returns fresh unshared references across multiple calls', () => {
            const s1 = getDefaultPlayerState();
            const s2 = getDefaultPlayerState();

            assert.notEqual(s1, s2);
            assert.notEqual(s1.heroes, s2.heroes);
            assert.notEqual(s1.storedOres, s2.storedOres);
            assert.notEqual(s1.income, s2.income);
            assert.notEqual(s1.planner, s2.planner);
            assert.notEqual(s1.planner.calendar.customChipSettings, s2.planner.calendar.customChipSettings);
            assert.notEqual(s1.planner.calendar.customChipSettings.clanWar, s2.planner.calendar.customChipSettings.clanWar);
        });
    });

    describe('4. Domain Income Calculation Boundary & Adversarial Inputs', () => {
        test('calculateStarBonusIncome handles division by zero and extreme frequency / duration safely', () => {
            const zeroFreqState = {
                "2x": {
                    frequency: 0,
                    duration: 10
                }
            };

            const result = calculateStarBonusIncome(105000036, zeroFreqState);
            assert.ok(Number.isFinite(result.daily.shiny));
            assert.ok(Number.isFinite(result.monthly.shiny));
            assert.ok(result.daily.shiny > 0);

            const extremeState = {
                "2x": {
                    frequency: 1000,
                    duration: 999999
                },
                thUpgrades: {
                    "TH16": true,
                    "TH17": true,
                    "TH18": true
                }
            };

            const extremeResult = calculateStarBonusIncome(105000036, extremeState);
            assert.ok(Number.isFinite(extremeResult.daily.shiny));
            assert.ok(Number.isFinite(extremeResult.monthly.glowy));
            assert.ok(Number.isFinite(extremeResult.monthly.starry));
        });

        test('calculateStarBonusIncome handles unranked, string, negative, or unknown league IDs', () => {
            const res1 = calculateStarBonusIncome('invalid-league-id');
            assert.ok(Number.isFinite(res1.daily.shiny));

            const res2 = calculateStarBonusIncome(-500);
            assert.ok(Number.isFinite(res2.daily.shiny));

            const res3 = calculateStarBonusIncome(999999999);
            assert.ok(Number.isFinite(res3.daily.shiny));
        });

        test('calculateEventPassIncome calculates correct pricing across all currencies in single pass', () => {
            const freePass = calculateEventPassIncome({ eventPass: false });
            assert.equal(freePass.type, 'free');
            assert.equal(freePass.monthly.USD, 0);
            assert.equal(freePass.monthly.EUR, 0);

            const paidPass = calculateEventPassIncome({
                eventPass: true,
                bonusTrackMedals: 500,
                purchasedMedals: 100,
                includeEquipment: true
            });

            assert.equal(paidPass.type, 'event');
            assert.ok(paidPass.monthly.USD > 0);
            assert.ok(paidPass.monthly.EUR > 0);
            assert.ok(paidPass.monthly.GBP > 0);
            assert.ok(Number.isFinite(paidPass.availableMedals));
        });
    });

    describe('5. Semver Version Comparison Utility (compareVersions)', () => {
        test('compareVersions correctly evaluates version precedence and handles prefixes/suffixes', () => {
            assert.equal(compareVersions('2.0.0', '1.9.9'), 1);
            assert.equal(compareVersions('1.9.9', '2.0.0'), -1);
            assert.equal(compareVersions('2.1.0', '2.1.0'), 0);
            assert.equal(compareVersions('v2.1.0+build123', '2.1.0'), 0);
            assert.equal(compareVersions('2.1.1', '2.1.0'), 1);
            assert.equal(compareVersions('3.0.0', '2.9.9.9'), 1);
            assert.equal(compareVersions(/** @type {any} */ (null), '1.0.0'), -1);
        });
    });

    describe('6. Player Partition Lifecycle & Tag Management', () => {
        const { removePlayerTag } = localStorageManager;

        test('removePlayerTag protects DEFAULT0 from deletion', () => {
            stateModule.state.savedPlayerTags = ['DEFAULT0'];
            stateModule.state.allPlayersData = { DEFAULT0: getDefaultPlayerState() };

            removePlayerTag('DEFAULT0');

            assert.deepEqual(stateModule.state.savedPlayerTags, ['DEFAULT0']);
            assert.ok(stateModule.state.allPlayersData['DEFAULT0']);
        });

        test('removePlayerTag reseeds DEFAULT0 guest state when last remaining real player is removed', () => {
            stateModule.state.savedPlayerTags = ['SOLO_PLAYER'];
            stateModule.state.allPlayersData = {
                SOLO_PLAYER: {
                    heroes: {},
                    storedOres: { shiny: 500, glowy: 50, starry: 5 },
                    income: {},
                    planner: {}
                }
            };
            localStorage.setItem('oreCalc_player_SOLO_PLAYER', JSON.stringify(stateModule.state.allPlayersData['SOLO_PLAYER']));

            removePlayerTag('SOLO_PLAYER');

            assert.deepEqual(stateModule.state.savedPlayerTags, ['DEFAULT0']);
            assert.ok(stateModule.state.allPlayersData['DEFAULT0']);
            assert.equal(localStorage.getItem('oreCalc_player_SOLO_PLAYER'), null);
            assert.ok(localStorage.getItem('oreCalc_player_DEFAULT0'));
        });

        test('updateSavedPlayerTags strips DEFAULT0 when a real tag is added', () => {
            stateModule.state.savedPlayerTags = ['DEFAULT0'];
            stateModule.state.allPlayersData = { DEFAULT0: getDefaultPlayerState() };
            localStorage.setItem('oreCalc_player_DEFAULT0', JSON.stringify(stateModule.state.allPlayersData['DEFAULT0']));

            updateSavedPlayerTags('NEW_REAL_PLAYER');

            assert.deepEqual(stateModule.state.savedPlayerTags, ['NEW_REAL_PLAYER']);
            assert.equal(stateModule.state.allPlayersData['DEFAULT0'], undefined);
            assert.equal(localStorage.getItem('oreCalc_player_DEFAULT0'), null);
        });
    });

    describe('7. recalculateAll Derived State Stress & Graceful Degradation', () => {
        test('recalculateAll handles empty and partial player state slices without throwing', () => {
            const bareState = {
                uiSettings: {},
                heroes: {},
                storedOres: { shiny: 0, glowy: 0, starry: 0 },
                income: {},
                planner: {
                    calendar: {
                        dates: {},
                        customChips: [],
                        customChipData: {},
                        customChipSettings: Object.fromEntries(
                            Object.entries(DEFAULT_CUSTOM_CHIP_SETTINGS).map(([k, v]) => [k, { ...v }])
                        )
                    }
                },
                derived: {
                    requiredOres: {},
                    incomeSources: {},
                    totalIncome: {},
                    remainingTime: { shiny: 'N/A', glowy: 'N/A', starry: 'N/A' }
                }
            };

            assert.doesNotThrow(() => {
                recalculateAll(bareState);
            });

            assert.ok(bareState.derived.requiredOres);
            assert.ok(bareState.derived.incomeSources);
            assert.ok(bareState.derived.totalIncome);
            assert.ok(bareState.derived.remainingTime);
        });
    });
});
