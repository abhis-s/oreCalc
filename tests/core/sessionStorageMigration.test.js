import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const mockLocalStorageStore = new Map();
const mockSessionStorageStore = new Map();

if (typeof globalThis.localStorage === 'undefined') {
    globalThis.localStorage = {
        getItem: (key) => mockLocalStorageStore.get(key) || null,
        setItem: (key, val) => mockLocalStorageStore.set(key, String(val)),
        removeItem: (key) => mockLocalStorageStore.delete(key),
        clear: () => mockLocalStorageStore.clear(),
        get length() { return mockLocalStorageStore.size; }
    };
}

if (typeof globalThis.sessionStorage === 'undefined') {
    globalThis.sessionStorage = {
        getItem: (key) => mockSessionStorageStore.get(key) || null,
        setItem: (key, val) => mockSessionStorageStore.set(key, String(val)),
        removeItem: (key) => mockSessionStorageStore.delete(key),
        clear: () => mockSessionStorageStore.clear(),
        get length() { return mockSessionStorageStore.size; }
    };
}

if (typeof globalThis.HTMLElement === 'undefined') {
    globalThis.HTMLElement = class {};
}
if (typeof globalThis.HTMLInputElement === 'undefined') {
    globalThis.HTMLInputElement = class extends globalThis.HTMLElement {};
}
if (typeof globalThis.HTMLSelectElement === 'undefined') {
    globalThis.HTMLSelectElement = class extends globalThis.HTMLElement {};
}
if (typeof globalThis.customElements === 'undefined') {
    globalThis.customElements = { define: () => {}, get: () => {} };
}
if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        __ENV__: { APP_VERSION: '2.1.0' },
        location: { hostname: 'localhost', href: 'http://localhost/', reload: () => {} },
        matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
        addEventListener: () => {},
        removeEventListener: () => {},
        scrollTo: () => {},
        getComputedStyle: () => ({ display: 'block' }),
        requestAnimationFrame: (cb) => { cb(); return 1; },
        cancelAnimationFrame: () => {}
    };
}

class MockElement {
    constructor(tagName = 'div') {
        this.tagName = tagName.toUpperCase();
        this.id = '';
        this.className = '';
        this.children = [];
        this.dataset = {};
        this.style = {};
        this._classes = new Set();
        this.classList = {
            add: (...cls) => cls.forEach(c => this._classes.add(c)),
            remove: (...cls) => cls.forEach(c => this._classes.delete(c)),
            contains: (c) => this._classes.has(c)
        };
        this.attributes = new Map();
        this.value = '';
        this.checked = false;
        this.type = 'text';
    }
    setAttribute(name, val) { this.attributes.set(name, String(val)); }
    removeAttribute(name) { this.attributes.delete(name); }
    getAttribute(name) { return this.attributes.get(name); }
    appendChild(child) {
        this.children.push(child);
        return child;
    }
    addEventListener() {}
    removeEventListener() {}
    querySelector() { return null; }
    querySelectorAll() { return []; }
}

const mockDomElements = new Map();

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        getElementById: (id) => mockDomElements.get(id) || null,
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: (tag) => new MockElement(tag),
        body: new MockElement('body'),
        addEventListener: () => {},
        removeEventListener: () => {}
    };
}

const { state, getDefaultState } = await import('../../js/core/state.js');
const { saveState, loadState } = await import('../../js/core/localStorageManager.js');
const { saveCustomChipDraft, clearCustomChipDraft } = await import('../../js/components/planner/createCustomChipsModalInputs.js');

describe('SessionStorage Migration & Transient State Suite', () => {
    beforeEach(() => {
        mockLocalStorageStore.clear();
        mockSessionStorageStore.clear();
        Object.assign(state, getDefaultState());
    });

    test('WP1: QR sync URL parameter uses sessionStorage instead of localStorage', () => {
        globalThis.sessionStorage.setItem('oreCalc_pendingQrUserId', 'test-qr-user-123');

        assert.strictEqual(globalThis.sessionStorage.getItem('oreCalc_pendingQrUserId'), 'test-qr-user-123');
        assert.strictEqual(globalThis.localStorage.getItem('oreCalc_pendingQrUserId'), null);

        globalThis.sessionStorage.removeItem('oreCalc_pendingQrUserId');
        assert.strictEqual(globalThis.sessionStorage.getItem('oreCalc_pendingQrUserId'), null);
    });

    test('WP2: PWA update detection timestamp lives in sessionStorage', () => {
        const detectedAt = Date.now().toString();
        globalThis.sessionStorage.setItem('oreCalcUpdateDetectedAt', detectedAt);

        assert.strictEqual(globalThis.sessionStorage.getItem('oreCalcUpdateDetectedAt'), detectedAt);
        assert.strictEqual(globalThis.localStorage.getItem('oreCalcUpdateDetectedAt'), null);

        globalThis.sessionStorage.removeItem('oreCalcUpdateDetectedAt');
        assert.strictEqual(globalThis.sessionStorage.getItem('oreCalcUpdateDetectedAt'), null);
    });

    test('WP3: saveState strips transient Hero Journey UI filters and scroll positions from localStorage', () => {
        state.savedPlayerTags = ['#TEST123'];
        state.heroJourney = {
            scrollPosition: 1250,
            typeFilter: 'king',
            unclaimedOnly: true,
            filterScrollPositions: { 'all:king': 1250 },
            overrideUnclaimed: [1, 2],
            acceleratedRewards: true,
            hidden: false,
            revealBeyondTH: true
        };

        saveState(state, true);

        const savedPlayerJson = globalThis.localStorage.getItem('oreCalc_player_#TEST123');
        assert.ok(savedPlayerJson);

        const savedPlayer = JSON.parse(savedPlayerJson);
        assert.ok(savedPlayer.heroJourney);
        assert.strictEqual(savedPlayer.heroJourney.scrollPosition, undefined);
        assert.strictEqual(savedPlayer.heroJourney.typeFilter, undefined);
        assert.strictEqual(savedPlayer.heroJourney.unclaimedOnly, undefined);
        assert.strictEqual(savedPlayer.heroJourney.filterScrollPositions, undefined);

        assert.deepStrictEqual(savedPlayer.heroJourney.overrideUnclaimed, [1, 2]);
        assert.strictEqual(savedPlayer.heroJourney.acceleratedRewards, true);
    });

    test('WP4: Custom chip modal draft saves and clears from sessionStorage', () => {
        const mockModal = new MockElement('div');
        mockModal.id = 'create-custom-chips-modal';
        mockDomElements.set('create-custom-chips-modal', mockModal);

        const mockTypeSelect = new MockElement('select');
        mockTypeSelect.id = 'custom-chip-type-select';
        mockTypeSelect.value = 'clanWar';
        mockDomElements.set('custom-chip-type-select', mockTypeSelect);

        mockModal.querySelectorAll = () => [mockTypeSelect];

        saveCustomChipDraft();

        const draftStr = globalThis.sessionStorage.getItem('oreCalc_custom_chip_draft');
        assert.ok(draftStr);
        const parsed = JSON.parse(draftStr);
        assert.strictEqual(parsed.type, 'clanWar');
        assert.strictEqual(globalThis.localStorage.getItem('oreCalc_custom_chip_draft'), null);

        clearCustomChipDraft();
        assert.strictEqual(globalThis.sessionStorage.getItem('oreCalc_custom_chip_draft'), null);
    });
});
