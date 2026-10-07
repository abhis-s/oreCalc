import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEYS } from '../../js/core/constants.js';
import { buildClashCalcTargetUrl } from '../../js/utils/clashCalcUrl.js';
import {
    showMigrationBlockerModal,
    resetAndSwitchGuestUser
} from '../../js/components/common/migrationBlocker.js';

describe('OreCalc Migration Blocker & Guest Reset Suite', () => {
    let mockLocalStorage = {};
    let mockSessionStorage = {};
    let mockLocation = {};

    beforeEach(() => {
        mockLocalStorage = {};
        mockSessionStorage = {};

        globalThis.localStorage = {
            getItem: (key) => mockLocalStorage[key] ?? null,
            setItem: (key, val) => { mockLocalStorage[key] = String(val); },
            removeItem: (key) => { delete mockLocalStorage[key]; },
            clear: () => { mockLocalStorage = {}; }
        };

        globalThis.sessionStorage = {
            getItem: (key) => mockSessionStorage[key] ?? null,
            setItem: (key, val) => { mockSessionStorage[key] = String(val); },
            removeItem: (key) => { delete mockSessionStorage[key]; },
            clear: () => { mockSessionStorage = {}; }
        };

        mockLocation = {
            pathname: '/ore-calculator/',
            search: '?userId=old-migrated-uuid&tag=2PP0V2RGY',
            href: 'https://orecalc.tech/ore-calculator/?userId=old-migrated-uuid&tag=2PP0V2RGY'
        };
        globalThis.window = {
            location: mockLocation
        };
    });

    test('buildClashCalcTargetUrl routes correctly with resolved parameters', () => {
        const target = buildClashCalcTargetUrl({
            currentPath: '/ore-calculator/',
            currentSearch: '?someParam=123',
            userId: 'test-migrated-uuid-1234',
            activePlayerTag: '#2PP0V2RGY'
        });

        const url = new URL(target);
        assert.equal(url.origin, 'https://clashcalc.com');
        assert.equal(url.pathname, '/ore-calculator/');
        assert.equal(url.searchParams.get('userId'), 'test-migrated-uuid-1234');
        assert.equal(url.searchParams.get('tag'), '#2PP0V2RGY');
        assert.equal(url.searchParams.get('someParam'), '123');
    });

    test('resetAndSwitchGuestUser clears storage, sets fresh UUID, and resets URL to clean pathname', () => {
        mockLocalStorage[STORAGE_KEYS.USER_ID] = 'old-migrated-uuid';
        mockLocalStorage[STORAGE_KEYS.MIGRATED_TO_CLASHCALC] = 'true';
        mockLocalStorage['oreCalc_player_2PP0V2RGY'] = '{"name":"Chief"}';
        mockSessionStorage['oreCalc_some_session_key'] = 'active';

        resetAndSwitchGuestUser();

        assert.equal(mockLocation.href, '/ore-calculator/');
        assert.equal(mockSessionStorage['oreCalc_some_session_key'], undefined);
        assert.equal(mockLocalStorage[STORAGE_KEYS.MIGRATED_TO_CLASHCALC], undefined);
        assert.equal(mockLocalStorage['oreCalc_player_2PP0V2RGY'], undefined);

        const newUserId = mockLocalStorage[STORAGE_KEYS.USER_ID];
        assert.ok(newUserId);
        assert.notEqual(newUserId, 'old-migrated-uuid');
        // Valid RFC 4122 v4 UUID regex
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        assert.match(newUserId, uuidRegex);
    });

    test('showMigrationBlockerModal configures modal and prevents cancel escape', () => {
        let cancelPrevented = false;
        let isOpened = false;

        let ctaFocused = false;
        const fakeCta = {
            href: '',
            addEventListener: () => {},
            focus: () => { ctaFocused = true; }
        };
        const fakeReset = { addEventListener: () => {} };
        const classes = new Set();
        const fakeDialog = {
            id: 'migrated-blocker-modal',
            open: false,
            classList: {
                add: (c) => classes.add(c),
                contains: (c) => classes.has(c)
            },
            querySelector(sel) {
                if (sel === '#migrated-blocker-cta-btn') return fakeCta;
                if (sel === '#migrated-blocker-reset-btn') return fakeReset;
                return { textContent: '' };
            },
            addEventListener(event, handler) {
                if (event === 'cancel') {
                    const e = { preventDefault: () => { cancelPrevented = true; } };
                    handler(e);
                }
            },
            showModal() {
                isOpened = true;
                this.open = true;
            }
        };

        globalThis.document = {
            getElementById(id) {
                if (id === 'migrated-blocker-modal') return fakeDialog;
                return null;
            }
        };

        const result = showMigrationBlockerModal({
            userId: 'custom-migrated-user',
            tag: '2PP0V2RGY'
        });

        assert.equal(result, fakeDialog);
        assert.equal(isOpened, true);
        assert.equal(classes.has('show'), true);
        assert.equal(cancelPrevented, true);
        assert.ok(fakeCta.href.includes('https://clashcalc.com'));
        assert.ok(fakeCta.href.includes('userId=custom-migrated-user'));
        assert.equal(ctaFocused, true);
    });
});
