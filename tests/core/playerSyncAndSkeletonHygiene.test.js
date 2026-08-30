import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (key) => store.get(key) || null,
        setItem: (key, val) => store.set(key, String(val)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
        key: (index) => Array.from(store.keys())[index] || null,
        get length() { return store.size; }
    };
}

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        addEventListener: () => {},
        removeEventListener: () => {},
        __ENV__: { APP_VERSION: '2.2.0' },
        location: { hostname: 'localhost', href: 'http://localhost/', pathname: '/', search: '', hash: '' }
    };
}

const { state, getDefaultState } = await import('../../js/core/state.js');
const { loadPlayerData, PLAYER_PREFIX, getPlayerStorageKey } = await import('../../js/core/localStorageManager.js');
const { syncPlayerToStorage } = await import('../../js/components/heroJourney/heroJourneyState.js');
const { processPlayerDataResponse } = await import('../../js/services/serverResponseHandler.js');

beforeEach(() => {
    localStorage.clear();
    const fresh = getDefaultState();
    Object.keys(state).forEach(k => delete state[k]);
    Object.assign(state, fresh);
    state.uiSettings.cloudSync = false;
    state.savedPlayerTags = ['DEFAULT0'];
    state.allPlayersData = {};
});

test('syncPlayerToStorage writes heroJourney partition without synthesizing default heroes', () => {
    const apiPayload = {
        tag: '#8PJYGUJC',
        name: 'TestPlayer',
        townHallLevel: 14,
        heroes: [
            { name: 'Barbarian King', level: 40, maxLevel: 80, village: 'home', equipment: [{ name: 'Barbarian Puppet', level: 10 }] }
        ],
        heroEquipment: [
            { name: 'Barbarian Puppet', level: 10, village: 'home' }
        ]
    };

    syncPlayerToStorage(apiPayload, { isAccelerated: false, revealBeyondTH: false, typeFilter: 'all', unclaimedOnly: false, showTable: true });

    const canonicalKey = getPlayerStorageKey('8PJYGUJC');
    assert.ok(localStorage.getItem(canonicalKey), 'Should write partition for heroJourney preferences');

    const cached = loadPlayerData('8PJYGUJC');
    assert.ok(cached, 'loadPlayerData should return profile metadata');
    assert.equal(cached.heroes, undefined, 'loadPlayerData must NOT synthesize default heroes where all equipment is checked');
});

test('loadPlayerData returns undefined heroes for partition missing heroes', () => {
    const canonicalKey = getPlayerStorageKey('CORRUPT_TAG');
    localStorage.setItem(canonicalKey, JSON.stringify({
        playerProfile: { name: 'Corrupt', tag: 'CORRUPT_TAG', townHallLevel: 15 },
        heroJourney: { acceleratedRewards: false }
        // heroes slice omitted
    }));

    const result = loadPlayerData('CORRUPT_TAG');
    assert.ok(result);
    assert.equal(result.heroes, undefined, 'heroes must be undefined when partition has no heroes');
});

test('processPlayerDataResponse sets unowned equipment to checked: false on initial sync', () => {
    const apiPayload = {
        tag: '#8PJYGUJC',
        name: 'TestPlayer',
        townHallLevel: 14,
        heroes: [
            { name: 'Barbarian King', level: 40, maxLevel: 80, village: 'home', equipment: [{ name: 'Barbarian Puppet', level: 10 }] },
            { name: 'Archer Queen', level: 40, maxLevel: 80, village: 'home', equipment: [{ name: 'Archer Puppet', level: 10 }] }
        ],
        heroEquipment: [
            { name: 'Barbarian Puppet', level: 10, village: 'home' },
            { name: 'Archer Puppet', level: 10, village: 'home' }
        ]
    };

    processPlayerDataResponse(apiPayload, { updateOrder: true });

    const playerState = state.allPlayersData['8PJYGUJC'];
    assert.ok(playerState, 'Player state should be initialized');

    // Owned equipment should be checked: true
    assert.equal(playerState.heroes['Barbarian King'].equipment['Barbarian Puppet'].checked, true);
    assert.equal(playerState.heroes['Archer Queen'].equipment['Archer Puppet'].checked, true);

    // Unowned equipment (e.g. Giant Gauntlet, Spiky Ball, Frozen Arrow, Magic Mirror) MUST be checked: false
    assert.equal(playerState.heroes['Barbarian King'].equipment['Giant Gauntlet'].checked, false);
    assert.equal(playerState.heroes['Barbarian King'].equipment['Spiky Ball'].checked, false);
    assert.equal(playerState.heroes['Archer Queen'].equipment['Frozen Arrow'].checked, false);
    assert.equal(playerState.heroes['Archer Queen'].equipment['Magic Mirror'].checked, false);
});

test('processPlayerDataResponse preserves user manual checks on subsequent refreshes', () => {
    const apiPayload = {
        tag: '#8PJYGUJC',
        name: 'TestPlayer',
        townHallLevel: 14,
        heroes: [
            { name: 'Barbarian King', level: 40, maxLevel: 80, village: 'home', equipment: [{ name: 'Barbarian Puppet', level: 10 }] }
        ],
        heroEquipment: [
            { name: 'Barbarian Puppet', level: 10, village: 'home' }
        ]
    };

    processPlayerDataResponse(apiPayload, { updateOrder: true });

    state.allPlayersData['8PJYGUJC'].heroes['Barbarian King'].equipment['Giant Gauntlet'].checked = true;

    processPlayerDataResponse(apiPayload, { updateOrder: false });

    const playerState = state.allPlayersData['8PJYGUJC'];
    assert.equal(playerState.heroes['Barbarian King'].equipment['Giant Gauntlet'].checked, true);
    assert.equal(playerState.heroes['Barbarian King'].equipment['Spiky Ball'].checked, false);
});

test('adding new player initializes clean Hero Journey defaults and prevents state pollution from active player', () => {
    const player1Payload = {
        tag: '#PLAYER1',
        name: 'Player One',
        townHallLevel: 15,
        heroes: [{ name: 'Barbarian King', level: 50, maxLevel: 85, village: 'home' }]
    };
    processPlayerDataResponse(player1Payload, { updateOrder: true });

    state.heroJourney.acceleratedRewards = true;
    state.heroJourney.revealBeyondTH = true;
    state.heroJourney.typeFilter = 'quest';
    state.heroJourney.unclaimedOnly = true;

    const player2Payload = {
        tag: '#PLAYER2',
        name: 'Player Two',
        townHallLevel: 12,
        heroes: [{ name: 'Barbarian King', level: 20, maxLevel: 65, village: 'home' }]
    };
    processPlayerDataResponse(player2Payload, { updateOrder: true });

    const player2State = state.allPlayersData['PLAYER2'];
    assert.ok(player2State, 'Player 2 should be in state.allPlayersData');
    assert.equal(player2State.heroJourney.acceleratedRewards, false, 'acceleratedRewards must default to false');
    assert.equal(player2State.heroJourney.revealBeyondTH, false, 'revealBeyondTH must default to false');
    assert.equal(player2State.heroJourney.hidden, false, 'hidden must default to false');
    assert.equal(player2State.heroJourney.typeFilter, undefined, 'typeFilter must not be in player partition');
    assert.equal(player2State.heroJourney.unclaimedOnly, undefined, 'unclaimedOnly must not be in player partition');
    assert.equal(player2State.heroJourney.showTable, undefined, 'showTable must not exist on state');

    assert.equal(state.heroJourney.acceleratedRewards, false);
    assert.equal(state.heroJourney.revealBeyondTH, false);
    assert.equal(state.heroJourney.hidden, false);

    const storedStr = localStorage.getItem(getPlayerStorageKey('PLAYER2'));
    assert.ok(storedStr);
    const stored = JSON.parse(storedStr);
    assert.deepEqual(stored.heroJourney, {
        acceleratedRewards: false,
        revealBeyondTH: false,
        hidden: false
    });
});

test('loadState sanitizes all stray keys from heroJourney across all player partitions in localStorage', async () => {
    const { loadState, PLAYER_TAGS_KEY } = await import('../../js/core/localStorageManager.js');

    localStorage.setItem(PLAYER_TAGS_KEY, JSON.stringify(['DIRTYTAG']));

    // Create a partition with arbitrary stray keys
    const dirtyKey = getPlayerStorageKey('DIRTYTAG');
    localStorage.setItem(dirtyKey, JSON.stringify({
        heroes: {},
        heroJourney: {
            acceleratedRewards: true,
            revealBeyondTH: false,
            hidden: true,
            scrollPosition: 1200,
            typeFilter: 'skins',
            unclaimedOnly: true,
            showTable: true,
            tableMaximized: true,
            filterScrollPositions: { 'all:all': 500 },
            strayBogusKey1: 'junk',
            strayBogusKey2: 12345
        }
    }));

    loadState();

    const cleanedStr = localStorage.getItem(dirtyKey);
    assert.ok(cleanedStr);
    const cleaned = JSON.parse(cleanedStr);
    assert.deepEqual(cleaned.heroJourney, {
        acceleratedRewards: true,
        revealBeyondTH: false,
        hidden: true
    });
});
