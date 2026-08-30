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

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        addEventListener: () => {},
        removeEventListener: () => {},
        __ENV__: { APP_VERSION: '2.1.0' },
        location: { hostname: 'localhost' }
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

const { state, getDefaultState } = await import('../../js/core/state.js');
const { MAX_SAVED_PLAYERS } = await import('../../js/core/constants.js');
const {
    switchActivePlayer,
    handleStateUpdate,
    registerStateUpdateCallback
} = await import('../../js/core/stateManager.js');
const { recalculateAll } = await import('../../js/core/calculator.js');
const { autoPlaceIncomeChipsForRange } = await import('../../js/utils/autoPlaceChips.js');

beforeEach(() => {
    const fresh = getDefaultState();
    Object.keys(state).forEach(k => delete state[k]);
    Object.assign(state, fresh);
    state.uiSettings.cloudSync = false;
    state.savedPlayerTags = ['DEFAULT0'];
    state.allPlayersData = {
        DEFAULT0: {
            heroes: { barbarianKing: { level: 1 } },
            storedOres: { shiny: 0, glowy: 0, starry: 0 },
            income: {},
            planner: { calendar: { isDirty: false } },
            playerProfile: null
        }
    };
});

test('switchActivePlayer binds player partition references and removes DEFAULT0', () => {
    const player1Data = {
        heroes: { barbarianKing: { level: 50 } },
        storedOres: { shiny: 5000, glowy: 200, starry: 10 },
        income: { gems: { packs: { shiny: 1 } } },
        planner: { calendar: { isDirty: false } },
        playerProfile: { name: 'Player One', townHallLevel: 15 },
        currency: { code: 'EUR' }
    };

    state.allPlayersData['PLAYER1'] = player1Data;

    switchActivePlayer('PLAYER1');

    assert.equal(state.savedPlayerTags[0], 'PLAYER1');
    assert.equal(state.savedPlayerTags.includes('DEFAULT0'), false);
    assert.equal(state.allPlayersData['DEFAULT0'], undefined);

    assert.equal(state.heroes, player1Data.heroes);
    assert.equal(state.storedOres, player1Data.storedOres);
    assert.equal(state.income, player1Data.income);
    assert.equal(state.planner, player1Data.planner);
    assert.equal(state.playerProfile, player1Data.playerProfile);

    assert.equal(state.uiSettings.currency.code, 'EUR');
});

test('switchActivePlayer enforces MAX_SAVED_PLAYERS bounds on savedPlayerTags', () => {
    state.savedPlayerTags = [];
    state.allPlayersData = {};

    for (let i = 1; i <= MAX_SAVED_PLAYERS + 2; i++) {
        const tag = `TAG_${i}`;
        state.allPlayersData[tag] = {
            heroes: {},
            storedOres: { shiny: i },
            income: {},
            planner: {}
        };
        switchActivePlayer(tag);
    }

    assert.equal(state.savedPlayerTags.length, MAX_SAVED_PLAYERS);
    assert.equal(state.savedPlayerTags[0], `TAG_${MAX_SAVED_PLAYERS + 2}`);
});

test('switchActivePlayer handles non-existent player tags gracefully without mutation', () => {
    const initialHeroes = state.heroes;
    switchActivePlayer('NON_EXISTENT_TAG');

    assert.equal(state.heroes, initialHeroes);
    assert.equal(state.savedPlayerTags[0], 'DEFAULT0');
});

test('handleStateUpdate executes state update, marks calendar dirty, and invokes registered callback', () => {
    let callbackInvoked = false;
    let callbackSilentArg = null;

    registerStateUpdateCallback((s, silent) => {
        callbackInvoked = true;
        callbackSilentArg = silent;
    });

    state.planner = { calendar: { isDirty: false } };

    handleStateUpdate(() => {
        state.storedOres = { shiny: 9999, glowy: 500, starry: 50 };
    }, false);

    assert.equal(state.storedOres.shiny, 9999);
    assert.equal(state.planner.calendar.isDirty, true);
    assert.ok(state.timestamp !== undefined);
    assert.equal(callbackInvoked, true);
    assert.equal(callbackSilentArg, false);
});

test('switchActivePlayer provides defensive defaults when player partition is partial or missing slices', () => {
    state.allPlayersData['PARTIAL_PLAYER'] = {
        heroes: { barbarianKing: { level: 10 } }
        // income, planner, storedOres omitted
    };

    switchActivePlayer('PARTIAL_PLAYER');

    assert.ok(state.income, 'income slice should fall back to default');
    assert.ok(state.planner, 'planner slice should fall back to default');
    assert.ok(state.storedOres, 'storedOres slice should fall back to default');

    // recalculateAll must execute cleanly without throwing TypeErrors
    assert.doesNotThrow(() => {
        recalculateAll(state);
    });

    assert.ok(state.derived.requiredOres !== undefined);
    assert.ok(state.derived.totalIncome !== undefined);
});

test('recalculateAll handles completely uninitialized or empty state safely', () => {
    const emptyState = {};
    assert.doesNotThrow(() => {
        recalculateAll(emptyState);
    });
    assert.ok(emptyState.derived !== undefined);
    assert.ok(emptyState.income !== undefined);
});

test('autoPlaceIncomeChipsForRange handles missing calendar gracefully without throwing', () => {
    state.planner = {};
    assert.doesNotThrow(() => {
        autoPlaceIncomeChipsForRange(1, 2026, 12, 2026, true);
    });
});
