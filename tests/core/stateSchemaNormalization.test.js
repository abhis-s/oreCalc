import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (key) => store.get(key) || null,
        setItem: (key, val) => store.set(key, String(val)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
        get length() { return store.size; }
    };
}

if (typeof globalThis.sessionStorage === 'undefined') {
    const sessionStore = new Map();
    globalThis.sessionStorage = {
        getItem: (key) => sessionStore.get(key) || null,
        setItem: (key, val) => sessionStore.set(key, String(val)),
        removeItem: (key) => sessionStore.delete(key),
        clear: () => sessionStore.clear(),
        get length() { return sessionStore.size; }
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

if (typeof globalThis.HTMLElement === 'undefined') {
    globalThis.HTMLElement = class {};
}

if (typeof globalThis.customElements === 'undefined') {
    globalThis.customElements = {
        get: () => null,
        define: () => {}
    };
}

const stateModule = await import('../../js/core/state.js');
const { getDefaultState, getDefaultPlayerState, initializeState } = stateModule;
const { welcomeState } = await import('../../js/components/welcome/welcomeModalState.js');
const { applyChecklistToProfile, resetWizardState } = await import('../../js/components/welcome/welcomeWizardState.js');
const { processPlayerDataResponse } = await import('../../js/services/serverResponseHandler.js');

beforeEach(() => {
    const fresh = getDefaultState();
    Object.keys(stateModule.state).forEach(k => delete stateModule.state[k]);
    Object.assign(stateModule.state, fresh);
    stateModule.state.uiSettings.cloudSync = false;
    stateModule.state.savedPlayerTags = ['DEFAULT0'];
    stateModule.state.allPlayersData = {};
    resetWizardState();
});

test('getDefaultPlayerState returns complete instantiated income schema with zero undefined sub-properties', () => {
    const playerState = getDefaultPlayerState();

    assert.ok(playerState.storedOres);
    assert.equal(playerState.storedOres.shiny, 0);
    assert.equal(playerState.storedOres.glowy, 0);
    assert.equal(playerState.storedOres.starry, 0);

    const income = playerState.income;
    assert.ok(income);

    assert.ok(income.eventPass);
    assert.equal(income.eventPass.enabled, false);
    assert.equal(income.eventPass.eventPass, false);
    assert.equal(income.eventPass.includeEquipment, false);
    assert.equal(income.eventPass.bonusTrackMedals, 0);
    assert.equal(income.eventPass.purchasedMedals, 0);
    assert.ok(income.eventPass.trader);
    assert.equal(income.eventPass.trader.enabled, false);
    assert.ok(income.eventPass.trader.packs);
    assert.equal(income.eventPass.trader.packs.shiny, 0);

    assert.ok(income.eventTrader);
    assert.equal(income.eventTrader.enabled, false);
    assert.ok(income.eventTrader.packs);
    assert.equal(income.eventTrader.packs.shiny, 0);

    assert.ok(income.clanWar);
    assert.equal(income.clanWar.enabled, false);
    assert.equal(income.clanWar.warsPerMonth, 8);
    assert.equal(income.clanWar.winRate, 70);
    assert.equal(income.clanWar.drawRate, 0);
    assert.ok(income.clanWar.oresPerAttack);
    assert.equal(income.clanWar.oresPerAttack.shiny, 0);

    assert.ok(income.cwl);
    assert.equal(income.cwl.enabled, false);
    assert.equal(income.cwl.hitsPerSeason, 7);
    assert.equal(income.cwl.attacksPerEvent, 7);
    assert.equal(income.cwl.winRate, 50);
    assert.equal(income.cwl.drawRate, 0);
    assert.ok(income.cwl.oresPerAttack);
    assert.equal(income.cwl.oresPerAttack.shiny, 0);

    assert.ok(income.supercellEvents);
    assert.equal(income.supercellEvents.worldChampionship, false);

    assert.ok(income.raidMedals.packs);
    assert.ok(income.gems.packs);
    assert.ok(income.shopOffers.purchases);
});

test('applyChecklistToProfile safely handles empty profile object without throwing', () => {
    const emptyPlayer = {};
    assert.doesNotThrow(() => {
        applyChecklistToProfile(emptyPlayer);
    });

    assert.ok(emptyPlayer.storedOres);
    assert.ok(emptyPlayer.income);
    assert.ok(emptyPlayer.income.eventPass.trader.packs);
    assert.ok(emptyPlayer.income.clanWar.oresPerAttack);
    assert.ok(emptyPlayer.income.cwl.oresPerAttack);
});

test('applyChecklistToProfile resolves crash when income.eventPass is an empty object', () => {
    const playerWithEmptyEventPass = {
        income: {
            eventPass: {}
        }
    };

    welcomeState.tempEventTraderBuy = true;
    welcomeState.tempEventTraderShiny = 3;
    welcomeState.tempEventTraderGlowy = 1;
    welcomeState.tempEventTraderStarry = 0;

    assert.doesNotThrow(() => {
        applyChecklistToProfile(playerWithEmptyEventPass);
    });

    assert.equal(playerWithEmptyEventPass.income.eventPass.trader.enabled, true);
    assert.equal(playerWithEmptyEventPass.income.eventPass.trader.packs.shiny, 3);
    assert.equal(playerWithEmptyEventPass.income.eventPass.trader.packs.glowy, 1);
    assert.equal(playerWithEmptyEventPass.income.eventTrader.packs.shiny, 3);
});

test('applyChecklistToProfile correctly normalizes clanWar and cwl properties', () => {
    const player = {
        playerProfile: { townHallLevel: 15 },
        income: {}
    };

    welcomeState.tempClanWars = true;
    welcomeState.tempClanWarsCount = 10;
    welcomeState.tempClanWarsWinrate = 80;
    welcomeState.tempClanWarsDrawrate = 5;

    welcomeState.tempCwl = true;
    welcomeState.tempCwlHits = 6;
    welcomeState.tempCwlWinrate = 66;
    welcomeState.tempCwlDrawrate = 0;

    welcomeState.tempEventPassBuy = true;
    welcomeState.tempEventBonusMedals = 150;

    applyChecklistToProfile(player);

    assert.equal(player.income.clanWar.enabled, true);
    assert.equal(player.income.clanWar.warsPerMonth, 10);
    assert.equal(player.income.clanWar.winRate, 80);
    assert.equal(player.income.clanWar.drawRate, 5);
    assert.ok(player.income.clanWar.oresPerAttack !== undefined);

    assert.equal(player.income.cwl.enabled, true);
    assert.equal(player.income.cwl.hitsPerSeason, 6);
    assert.equal(player.income.cwl.attacksPerEvent, 6);
    assert.equal(player.income.cwl.winRate, 66);
    assert.ok(player.income.cwl.oresPerAttack !== undefined);

    assert.equal(player.income.eventPass.enabled, true);
    assert.equal(player.income.eventPass.eventPass, true);
    assert.equal(player.income.eventPass.bonusTrackMedals, 150);
});

test('initializeState normalizes player income configuration and preserves settings', () => {
    const legacySavedState = {
        appVersion: '2.0.0',
        savedPlayerTags: ['PLAYER1'],
        allPlayersData: {
            PLAYER1: {
                heroes: {},
                income: {
                    clanWar: { enabled: true, warsPerMonth: 9, winRate: 75, drawRate: 0 },
                    eventPass: { eventPass: true }
                }
            }
        }
    };

    initializeState(legacySavedState);

    const player1 = stateModule.state.allPlayersData['PLAYER1'];
    assert.ok(player1);
    assert.ok(player1.income.clanWar);
    assert.equal(player1.income.clanWar.warsPerMonth, 9);
    assert.equal(player1.income.clanWar.winRate, 75);
    assert.ok(player1.income.eventPass.trader);
    assert.ok(player1.income.eventPass.trader.packs);
    assert.ok(player1.income.eventTrader.packs);
});

test('processPlayerDataResponse creates complete player state with full income defaults on remote fetch', () => {
    const mockApiResponse = {
        tag: '#2PP',
        name: 'ClashLegend',
        townHallLevel: 16,
        trophies: 5500,
        warStars: 1200,
        heroes: [
            { name: 'Barbarian King', level: 95, maxLevel: 95, village: 'home' }
        ],
        heroEquipment: [
            { name: 'Giant Gauntlet', level: 27, village: 'home' }
        ],
        leagueTier: { id: 105000000, name: 'Legends League' }
    };

    processPlayerDataResponse(mockApiResponse);

    const player = stateModule.state.allPlayersData['2PP'];
    assert.ok(player);
    assert.equal(player.playerProfile.name, 'ClashLegend');
    assert.equal(player.playerProfile.townHallLevel, 16);

    assert.ok(player.income.eventPass.trader.packs);
    assert.ok(player.income.eventTrader.packs);
    assert.ok(player.income.clanWar.oresPerAttack);
    assert.ok(player.income.cwl.oresPerAttack);
    assert.ok(player.income.raidMedals.packs);
    assert.ok(player.income.gems.packs);
    assert.ok(player.income.shopOffers.purchases);
    assert.ok(player.income.supercellEvents);
    assert.ok(player.income.prospector);
});
