import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

let localStorageStore = new Map();
globalThis.localStorage = {
    getItem: (key) => localStorageStore.get(key) ?? null,
    setItem: (key, val) => localStorageStore.set(key, String(val)),
    removeItem: (key) => localStorageStore.delete(key),
    clear: () => localStorageStore.clear(),
    key: (index) => Array.from(localStorageStore.keys())[index] ?? null,
    get length() { return localStorageStore.size; }
};

let sessionStorageStore = new Map();
globalThis.sessionStorage = {
    getItem: (key) => sessionStorageStore.get(key) ?? null,
    setItem: (key, val) => sessionStorageStore.set(key, String(val)),
    removeItem: (key) => sessionStorageStore.delete(key),
    clear: () => sessionStorageStore.clear(),
    get length() { return sessionStorageStore.size; }
};

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
const { processPlayerDataResponse } = await import('../../js/services/serverResponseHandler.js');
const { loadState, saveState, removePlayerTag, updateSavedPlayerTags } = await import('../../js/core/localStorageManager.js');
const { switchActivePlayer } = await import('../../js/core/stateManager.js');

beforeEach(() => {
    localStorageStore.clear();
    sessionStorageStore.clear();
    const fresh = getDefaultState();
    Object.keys(stateModule.state).forEach(k => delete stateModule.state[k]);
    Object.assign(stateModule.state, fresh);
    stateModule.state.uiSettings.cloudSync = false;
    stateModule.state.savedPlayerTags = ['DEFAULT0'];
    stateModule.state.allPlayersData = {
        DEFAULT0: getDefaultPlayerState()
    };
});

test('guest state migration copies storedOres from DEFAULT0 when first API player is added', () => {
    stateModule.state.allPlayersData['DEFAULT0'].storedOres = {
        shiny: 45000,
        glowy: 3200,
        starry: 180
    };

    const mockApiResponse = {
        tag: '#2PP001',
        name: 'ChiefClasher',
        townHallLevel: 15,
        trophies: 4200,
        warStars: 800,
        heroes: [
            { name: 'Barbarian King', level: 80, maxLevel: 90, village: 'home' }
        ],
        heroEquipment: [
            { name: 'Giant Gauntlet', level: 18, village: 'home' }
        ],
        leagueTier: { id: 105000000, name: 'Legends League' }
    };

    processPlayerDataResponse(mockApiResponse, { updateOrder: true });

    const player = stateModule.state.allPlayersData['2PP001'];
    assert.ok(player);
    assert.equal(player.storedOres.shiny, 45000);
    assert.equal(player.storedOres.glowy, 3200);
    assert.equal(player.storedOres.starry, 180);

    assert.equal(stateModule.state.storedOres.shiny, 45000);
    assert.equal(stateModule.state.storedOres.glowy, 3200);
    assert.equal(stateModule.state.storedOres.starry, 180);
});

test('guest state migration copies custom income settings from DEFAULT0 to newly added player', () => {
    stateModule.state.allPlayersData['DEFAULT0'].income = {
        clanWar: {
            enabled: true,
            warsPerMonth: 10,
            winRate: 85,
            drawRate: 5,
            oresPerAttack: { shiny: 900, glowy: 50, starry: 5 },
            warPerformance: { thLevel: 16 }
        },
        cwl: {
            enabled: true,
            hitsPerSeason: 7,
            attacksPerEvent: 7,
            winRate: 80,
            drawRate: 0,
            oresPerAttack: { shiny: 1000, glowy: 60, starry: 6 }
        },
        shopOffers: {
            enabled: true,
            selectedSet: 16,
            purchases: { '16': { 'pack_1': 2 } }
        },
        raidMedals: {
            enabled: true,
            earned: 1500,
            packs: { shiny: 3, glowy: 2, starry: 1 }
        },
        gems: {
            enabled: true,
            packs: { shiny: 0, glowy: 3, starry: 2 }
        },
        eventPass: {
            enabled: true,
            eventPass: true,
            includeEquipment: true,
            bonusTrackMedals: 250,
            purchasedMedals: 1000,
            trader: { enabled: true, packs: { shiny: 1, glowy: 4, starry: 2 } }
        },
        eventTrader: {
            enabled: true,
            packs: { shiny: 2, glowy: 1, starry: 0 }
        },
        supercellEvents: {
            enabled: true,
            worldChampionship: true
        },
        prospector: {
            fromOre: 'shiny',
            toOre: 'starry',
            assistedConversion: false
        },
        starBonus: {
            league: 105000000,
            "2x": { frequency: 3, duration: 4, lastEvent: '2026-06' },
            thUpgrades: { '16': '2026-07-01' }
        }
    };

    const mockApiResponse = {
        tag: '#8ABC123',
        name: 'Tactician',
        townHallLevel: 16,
        heroes: [],
        heroEquipment: []
    };

    processPlayerDataResponse(mockApiResponse, { updateOrder: true });

    const player = stateModule.state.allPlayersData['8ABC123'];
    assert.ok(player);

    assert.equal(player.income.clanWar.enabled, true);
    assert.equal(player.income.clanWar.warsPerMonth, 10);
    assert.equal(player.income.clanWar.winRate, 85);
    assert.equal(player.income.clanWar.drawRate, 5);
    assert.equal(player.income.cwl.enabled, true);
    assert.equal(player.income.cwl.winRate, 80);

    assert.equal(player.income.shopOffers.enabled, true);
    assert.deepEqual(player.income.shopOffers.purchases, { '16': { 'pack_1': 2 } });
    assert.equal(player.income.raidMedals.earned, 1500);
    assert.equal(player.income.raidMedals.packs.glowy, 2);
    assert.equal(player.income.gems.packs.starry, 2);

    assert.equal(player.income.eventPass.eventPass, true);
    assert.equal(player.income.eventPass.includeEquipment, true);
    assert.equal(player.income.eventPass.bonusTrackMedals, 250);
    assert.equal(player.income.eventPass.trader.packs.glowy, 4);
    assert.equal(player.income.eventTrader.packs.shiny, 2);

    assert.equal(player.income.supercellEvents.worldChampionship, true);
    assert.equal(player.income.prospector.toOre, 'starry');
    assert.equal(player.income.prospector.assistedConversion, false);

    assert.equal(player.income.starBonus["2x"].frequency, 3);
    assert.equal(player.income.starBonus["2x"].duration, 4);
});

test('guest state migration copies custom planner chips and hero journey settings', () => {
    stateModule.state.allPlayersData['DEFAULT0'].planner = {
        customMaxLevel: { barbarianKing: 95 },
        calendar: {
            settings: { firstDayOfWeek: 'monday', showChipIcons: false, autoPlaceScope: 'month' },
            view: { select: 'weekly', month: '2026-08', week: '2026-33' },
            dates: { '2026-08': { '15': ['chip-123'] } },
            customChips: [{ id: 'chip-123', label: 'Raid Medal Batch', shiny: 1000, glowy: 200, starry: 0 }],
            customChipData: { 'chip-123': { notes: 'Saved from weekend' } },
            isDirty: true,
            customChipSettings: {
                custom: { 'chip-123': true }
            }
        }
    };

    stateModule.state.allPlayersData['DEFAULT0'].heroJourney = {
        hidden: true,
        unclaimedOnly: true,
        typeFilter: 'equipment',
        scrollPosition: 450,
        rewardMode: 'accelerated',
        acceleratedRewards: true,
        overrideUnclaimed: [15, 30]
    };

    stateModule.state.allPlayersData['DEFAULT0'].currency = {
        code: 'GBP',
        globalPricing: { pack_1: 4.99 }
    };

    const mockApiResponse = {
        tag: '#99XYZ',
        name: 'PlannerPro',
        townHallLevel: 16,
        heroes: [],
        heroEquipment: []
    };

    processPlayerDataResponse(mockApiResponse, { updateOrder: true });

    const player = stateModule.state.allPlayersData['99XYZ'];
    assert.ok(player);

    assert.equal(player.planner.customMaxLevel.barbarianKing, 95);
    assert.equal(player.planner.calendar.settings.firstDayOfWeek, 'monday');
    assert.equal(player.planner.calendar.settings.showChipIcons, false);
    assert.equal(player.planner.calendar.customChips.length, 1);
    assert.equal(player.planner.calendar.customChips[0].id, 'chip-123');
    assert.equal(player.planner.calendar.customChipData['chip-123'].notes, 'Saved from weekend');

    assert.equal(player.heroJourney.hidden, true);
    assert.equal(player.heroJourney.unclaimedOnly, true);
    assert.equal(player.heroJourney.typeFilter, 'equipment');
    assert.equal(player.heroJourney.acceleratedRewards, true);
    assert.equal(player.heroJourney.rewardMode, 'accelerated');

    assert.equal(player.currency.code, 'GBP');
    assert.equal(player.currency.globalPricing.pack_1, 4.99);
});

test('authoritative API data overrides guest placeholder hero and equipment levels', () => {
    stateModule.state.allPlayersData['DEFAULT0'].storedOres = { shiny: 12000, glowy: 800, starry: 40 };

    const mockApiResponse = {
        tag: '#API_HERO',
        name: 'MaxKing',
        townHallLevel: 16,
        trophies: 5800,
        warStars: 2100,
        heroes: [
            { name: 'Barbarian King', level: 95, maxLevel: 95, village: 'home' },
            { name: 'Archer Queen', level: 95, maxLevel: 95, village: 'home' }
        ],
        heroEquipment: [
            { name: 'Giant Gauntlet', level: 27, village: 'home' },
            { name: 'Spiky Ball', level: 27, village: 'home' },
            { name: 'Frozen Arrow', level: 27, village: 'home' }
        ],
        leagueTier: { id: 105000000, name: 'Legends League' }
    };

    processPlayerDataResponse(mockApiResponse, { updateOrder: true });

    const player = stateModule.state.allPlayersData['API_HERO'];
    assert.ok(player);

    assert.equal(player.playerProfile.name, 'MaxKing');
    assert.equal(player.playerProfile.townHallLevel, 16);
    assert.equal(player.playerProfile.trophies, 5800);
    assert.equal(player.playerProfile.warStars, 2100);

    assert.equal(player.heroes['Barbarian King'].level, 95);
    assert.equal(player.heroes['Barbarian King'].enabled, true);
    assert.equal(player.heroes['Archer Queen'].level, 95);
    assert.equal(player.heroes['Archer Queen'].enabled, true);

    assert.equal(player.heroes['Barbarian King'].equipment['Giant Gauntlet'].level, 27);
    assert.equal(player.heroes['Barbarian King'].equipment['Giant Gauntlet'].checked, true);
    assert.equal(player.heroes['Archer Queen'].equipment['Frozen Arrow'].level, 27);
    assert.equal(player.heroes['Archer Queen'].equipment['Frozen Arrow'].checked, true);

    assert.equal(player.storedOres.shiny, 12000);
    assert.equal(player.storedOres.glowy, 800);
    assert.equal(player.storedOres.starry, 40);
});

test('deterministic removal of DEFAULT0 occurs in both updateOrder: true and updateOrder: false flows', () => {
    stateModule.state.savedPlayerTags = ['DEFAULT0'];
    stateModule.state.allPlayersData = {
        DEFAULT0: getDefaultPlayerState()
    };
    localStorage.setItem('oreCalc_player_DEFAULT0', JSON.stringify(getDefaultPlayerState()));

    const mockProfile1 = {
        tag: '#PRO1',
        name: 'PlayerOne',
        townHallLevel: 14,
        heroes: [],
        heroEquipment: []
    };

    processPlayerDataResponse(mockProfile1, { updateOrder: true });

    assert.equal(stateModule.state.savedPlayerTags.includes('DEFAULT0'), false);
    assert.equal(stateModule.state.allPlayersData['DEFAULT0'], undefined);
    assert.equal(localStorage.getItem('oreCalc_player_DEFAULT0'), null);

    stateModule.state.savedPlayerTags = ['DEFAULT0'];
    stateModule.state.allPlayersData = {
        DEFAULT0: getDefaultPlayerState()
    };
    localStorage.setItem('oreCalc_player_DEFAULT0', JSON.stringify(getDefaultPlayerState()));

    const mockProfile2 = {
        tag: '#PRO2',
        name: 'PlayerTwo',
        townHallLevel: 15,
        heroes: [],
        heroEquipment: []
    };

    processPlayerDataResponse(mockProfile2, { updateOrder: false });

    assert.equal(stateModule.state.savedPlayerTags.includes('DEFAULT0'), false);
    assert.equal(stateModule.state.allPlayersData['DEFAULT0'], undefined);
    assert.equal(localStorage.getItem('oreCalc_player_DEFAULT0'), null);
    assert.ok(stateModule.state.savedPlayerTags.includes('PRO2'));
});

test('clean re-seeding of DEFAULT0 when all real players are deleted', () => {
    stateModule.state.savedPlayerTags = ['REAL1', 'REAL2'];
    stateModule.state.allPlayersData = {
        REAL1: { ...getDefaultPlayerState(), playerProfile: { name: 'One', tag: 'REAL1' } },
        REAL2: { ...getDefaultPlayerState(), playerProfile: { name: 'Two', tag: 'REAL2' } }
    };
    saveState(stateModule.state, true);

    removePlayerTag('REAL1');
    assert.deepEqual(stateModule.state.savedPlayerTags, ['REAL2']);
    assert.ok(stateModule.state.allPlayersData['REAL2']);
    assert.equal(stateModule.state.allPlayersData['REAL1'], undefined);

    removePlayerTag('REAL2');

    assert.deepEqual(stateModule.state.savedPlayerTags, ['DEFAULT0']);
    assert.ok(stateModule.state.allPlayersData['DEFAULT0']);
    assert.equal(stateModule.state.playerProfile, null);
    assert.ok(stateModule.state.heroes);
    assert.ok(stateModule.state.storedOres);

    const diskTags = JSON.parse(localStorage.getItem('oreCalc_playerTags') || '[]');
    assert.deepEqual(diskTags, ['DEFAULT0']);
    assert.ok(localStorage.getItem('oreCalc_player_DEFAULT0'));
    assert.equal(localStorage.getItem('oreCalc_player_REAL2'), null);
});

test('loadState sanitization strips DEFAULT0 from multi-tag arrays in localStorage', () => {
    localStorage.setItem('oreCalc_playerTags', JSON.stringify(['TAGA', 'DEFAULT0', 'TAGB']));
    localStorage.setItem('oreCalc_player_TAGA', JSON.stringify({ ...getDefaultPlayerState(), storedOres: { shiny: 500 } }));
    localStorage.setItem('oreCalc_player_TAGB', JSON.stringify({ ...getDefaultPlayerState(), storedOres: { shiny: 900 } }));
    localStorage.setItem('oreCalc_player_DEFAULT0', JSON.stringify(getDefaultPlayerState()));

    const loaded = loadState();

    assert.ok(loaded);
    assert.deepEqual(loaded.savedPlayerTags, ['TAGA', 'TAGB']);
    assert.ok(loaded.allPlayersData['TAGA']);
    assert.ok(loaded.allPlayersData['TAGB']);
    assert.equal(loaded.allPlayersData['DEFAULT0'], undefined);
    assert.equal(localStorage.getItem('oreCalc_player_DEFAULT0'), null);
});

test('initializeState strips DEFAULT0 from savedState when real tags are present', () => {
    const rawState = {
        appVersion: '2.1.0',
        savedPlayerTags: ['PLAYER_ONE', 'DEFAULT0'],
        allPlayersData: {
            PLAYER_ONE: getDefaultPlayerState(),
            DEFAULT0: getDefaultPlayerState()
        }
    };

    initializeState(rawState);

    assert.deepEqual(stateModule.state.savedPlayerTags, ['PLAYER_ONE']);
    assert.ok(stateModule.state.allPlayersData['PLAYER_ONE']);
    assert.equal(stateModule.state.allPlayersData['DEFAULT0'], undefined);
});
