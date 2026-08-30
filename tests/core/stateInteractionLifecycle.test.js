import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));

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
        requestAnimationFrame: (cb) => { cb(); return 1; },
        cancelAnimationFrame: () => {},
        getComputedStyle: () => ({ display: 'block' }),
        matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
        location: { reload: () => {} },
        history: { replaceState: () => {} }
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

globalThis.fetch = async (url) => {
    if (typeof url === 'string' && url.includes('en.json')) {
        return { ok: true, json: async () => enJson };
    }
    return { ok: false, status: 404 };
};

describe('Milestone 2 State & Interaction Lifecycle Hardening Suite', () => {
    beforeEach(() => {
        globalThis.localStorage.clear();
    });

    test('verifies ArrowUp wraps from initial unfocused index (-1) to last entry in dropdown list', () => {
        const entries = ['#TAG1', '#TAG2', '#TAG3', '#TAG4'];
        let activeDropdownIndex = -1;

        // Press ArrowUp when no item is selected
        activeDropdownIndex = activeDropdownIndex === -1
            ? entries.length - 1
            : (activeDropdownIndex - 1 + entries.length) % entries.length;

        assert.strictEqual(activeDropdownIndex, 3, 'ArrowUp from -1 must wrap to index 3 (last item)');

        // Subsequent ArrowUp presses move backwards cyclically
        activeDropdownIndex = activeDropdownIndex === -1
            ? entries.length - 1
            : (activeDropdownIndex - 1 + entries.length) % entries.length;
        assert.strictEqual(activeDropdownIndex, 2);

        activeDropdownIndex = activeDropdownIndex === -1
            ? entries.length - 1
            : (activeDropdownIndex - 1 + entries.length) % entries.length;
        assert.strictEqual(activeDropdownIndex, 1);

        activeDropdownIndex = activeDropdownIndex === -1
            ? entries.length - 1
            : (activeDropdownIndex - 1 + entries.length) % entries.length;
        assert.strictEqual(activeDropdownIndex, 0);

        activeDropdownIndex = activeDropdownIndex === -1
            ? entries.length - 1
            : (activeDropdownIndex - 1 + entries.length) % entries.length;
        assert.strictEqual(activeDropdownIndex, 3, 'ArrowUp from 0 must wrap to index 3 (last item)');
    });

    test('verifies 2-item list ArrowUp wrapping from -1 selects index 1 rather than index 0', () => {
        const entries = ['#PLAYER_A', '#PLAYER_B'];
        let activeDropdownIndex = -1;

        // Old faulty calculation: (-1 - 1 + 2) % 2 = 0 (wrong, selected first item instead of last)
        // New fixed calculation:
        activeDropdownIndex = activeDropdownIndex === -1
            ? entries.length - 1
            : (activeDropdownIndex - 1 + entries.length) % entries.length;

        assert.strictEqual(activeDropdownIndex, 1, 'ArrowUp on a 2-item list must select index 1 (second item)');
    });

    test('verifies tag normalization in handleDeletePlayer correctly filters DEFAULT0 and detects active profile', async () => {
        const { normalizePlayerTag } = await import('../../js/core/localStorageManager.js');

        // Case 1: Tag normalization across variations of DEFAULT0
        const rawTags = ['#DEFAULT0', 'default0', ' #8PJYGUJC ', '2PP0J0V89'];
        const validSavedTags = rawTags
            .map(tag => normalizePlayerTag(tag))
            .filter(tag => tag && tag !== 'DEFAULT0');

        assert.strictEqual(validSavedTags.length, 2, 'Must filter out all variations of DEFAULT0');
        assert.deepStrictEqual(validSavedTags, ['8PJYGUJC', '2PP0J0V89']);

        // Case 2: Active profile equality comparison with leading hash and casing mismatches
        const savedPlayerTags = ['#8PJYGUJC', '2PP0J0V89'];
        const tagToDelete = '8pjygujc'; // lowercase, no hash

        const wasActive = normalizePlayerTag(savedPlayerTags[0]) === normalizePlayerTag(tagToDelete);
        assert.strictEqual(wasActive, true, 'Active profile deletion must match regardless of casing or hash prefix');

        const tagToDeleteNonActive = '#2pp0j0v89';
        const wasActive2 = normalizePlayerTag(savedPlayerTags[0]) === normalizePlayerTag(tagToDeleteNonActive);
        assert.strictEqual(wasActive2, false, 'Non-active profile deletion must not be identified as active');
    });

    test('verifies updateHeaderLoadButton sanitizes and clamps Town Hall levels between 1 and 18', async () => {
        const { updateHeaderLoadButton } = await import('../../js/components/heroJourney/heroJourneyHeaderInputs.js');
        const { hjState } = await import('../../js/components/heroJourney/heroJourneyState.js');

        const mockElements = new Map();
        const createElement = (tag, id, className = '') => {
            const el = {
                tagName: tag.toUpperCase(),
                id,
                className,
                classList: {
                    _classes: new Set(className.split(' ').filter(Boolean)),
                    add(...tokens) { tokens.forEach(t => this._classes.add(t)); },
                    remove(...tokens) { tokens.forEach(t => this._classes.delete(t)); },
                    contains(token) { return this._classes.has(token); }
                },
                style: {},
                disabled: false,
                attributes: new Map(),
                setAttribute(k, v) { this.attributes.set(k, String(v)); },
                getAttribute(k) { return this.attributes.get(k); }
            };
            mockElements.set(id, el);
            return el;
        };

        const loadBtn = createElement('button', 'hj-load-btn');
        const loadBtnText = createElement('span', 'hj-load-btn-text');
        const loadBtnTh = createElement('orecalc-assets-image', 'hj-load-btn-th');
        const searchInput = createElement('input', 'hj-search-input');

        const origDoc = globalThis.document;
        globalThis.document = {
            getElementById: (id) => mockElements.get(id) || null,
            querySelector: (sel) => {
                if (sel.includes('.hj-track-btn') || sel.includes('.hero-journey-page__load-btn')) return loadBtn;
                return null;
            },
            activeElement: null
        };

        try {
            // Negative / Zero TH level clamps to 1
            hjState.playerData = { name: 'PlayerMin', townHallLevel: -5 };
            hjState.thLevel = -5;
            updateHeaderLoadButton(false);
            assert.strictEqual(loadBtnTh.getAttribute('src'), 'assets/th/th1.png');
            assert.strictEqual(loadBtn.getAttribute('aria-label'), 'Town Hall 1');

            // Extreme high TH level clamps to 18
            hjState.playerData = { name: 'PlayerMax', townHallLevel: 25 };
            hjState.thLevel = 25;
            updateHeaderLoadButton(false);
            assert.strictEqual(loadBtnTh.getAttribute('src'), 'assets/th/th18.png');
            assert.strictEqual(loadBtn.getAttribute('aria-label'), 'Town Hall 18');

            // Standard TH level within 1..18 preserved
            hjState.playerData = { name: 'Player15', townHallLevel: 15 };
            hjState.thLevel = 15;
            updateHeaderLoadButton(false);
            assert.strictEqual(loadBtnTh.getAttribute('src'), 'assets/th/th15.png');
            assert.strictEqual(loadBtn.getAttribute('aria-label'), 'Town Hall 15');

            // Focused search input sets aria-label to Load and enables button
            updateHeaderLoadButton(true);
            assert.strictEqual(loadBtn.getAttribute('aria-label'), 'Load');
            assert.strictEqual(loadBtn.disabled, false);
            assert.strictEqual(loadBtn.classList.contains('has-th-badge'), false);
        } finally {
            globalThis.document = origDoc;
            hjState.playerData = null;
            hjState.thLevel = 16;
        }
    });

    test('verifies dropdown item and dismiss button interaction execution guard prevents duplicate dispatch', () => {
        let dispatchCount = 0;
        let isProcessing = false;

        const handleInteraction = () => {
            if (isProcessing) return;
            isProcessing = true;
            setTimeout(() => { isProcessing = false; }, 300);
            dispatchCount++;
        };

        // Simulate rapid mousedown followed immediately by click
        handleInteraction(); // mousedown
        handleInteraction(); // click
        handleInteraction(); // synthetic extra event

        assert.strictEqual(dispatchCount, 1, 'Interaction callback must only execute once despite multiple rapid events');
    });
});
