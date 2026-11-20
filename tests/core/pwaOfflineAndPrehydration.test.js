import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { sweepObsoleteStorageKeys } from '../../js/core/storageMigrations.js';
import { removePlayerTag } from '../../js/core/playerStorage.js';
import { state } from '../../js/core/state.js';

describe('PWA Offline, Zero-Flash Startup & Pre-Hydration Contracts', () => {
    const projectRoot = process.cwd();

    // Mock DOM and localStorage for unit test execution
    const mockStorage = new Map();
    const originalLocalStorage = globalThis.localStorage;
    const originalDocument = globalThis.document;

    beforeEach(() => {
        mockStorage.clear();
        globalThis.localStorage = {
            getItem: (key) => mockStorage.get(key) || null,
            setItem: (key, val) => mockStorage.set(key, String(val)),
            removeItem: (key) => mockStorage.delete(key),
            clear: () => mockStorage.clear(),
            get length() { return mockStorage.size; },
            key: (i) => Array.from(mockStorage.keys())[i] || null
        };
    });

    afterEach(() => {
        globalThis.localStorage = originalLocalStorage;
        globalThis.document = originalDocument;
    });

    test('service-worker-src.js normalizes candidate URLs across all tools and strips search queries', () => {
        const swContent = fs.readFileSync(path.join(projectRoot, 'service-worker-src.js'), 'utf8');

        assert.match(swContent, /toolSubpath\s*=\s*['"]ore-calculator\/['"]/);
        assert.match(swContent, /toolSubpath\s*=\s*['"]hero-journey\/['"]/);
        assert.match(swContent, /toolSubpath\s*=\s*['"]damage-calculator\/['"]/);
        assert.match(swContent, /toolSubpath\s*=\s*['"]account\/['"]/);

        assert.match(swContent, /precacheController\.matchPrecache\(candidate\)/);
        assert.match(swContent, /cleanUrl\.search\s*=\s*['"]['"]/);
    });

    test('partials/head-theme-bootstrap.html contains synchronous startup redirect logic with zero emojis', () => {
        const bootstrapContent = fs.readFileSync(path.join(projectRoot, 'partials/head-theme-bootstrap.html'), 'utf8');

        assert.match(bootstrapContent, /display-mode:\s*standalone/);
        assert.match(bootstrapContent, /window\.navigator\.standalone/);
        assert.match(bootstrapContent, /source=pwa/);
        assert.match(bootstrapContent, /clashCalc_sessionLaunched/);
        assert.match(bootstrapContent, /window\.location\.replace/);

        const emojiPattern = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}]/u;
        assert.ok(!emojiPattern.test(bootstrapContent), 'Bootstrap script must contain zero emojis');
    });

    test('ore-calculator/index.html includes synchronous pre-hydration script after main content', () => {
        const indexContent = fs.readFileSync(path.join(projectRoot, 'ore-calculator/index.html'), 'utf8');

        assert.match(indexContent, /clashCalc_player_/);
        assert.match(indexContent, /home-profile-player-name/);
        assert.match(indexContent, /home-profile-th-badge-img/);
        assert.doesNotMatch(indexContent, /clashCalc_cachedHomeProfile_/);
        assert.doesNotMatch(indexContent, /clashCalc_cachedPlayerName_/);
        assert.doesNotMatch(indexContent, /clashCalc_cachedHomeOres_/);

        const emojiPattern = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}]/u;
        assert.ok(!emojiPattern.test(indexContent), 'ore-calculator/index.html must contain zero emojis');
    });

    test('sweepObsoleteStorageKeys purges legacy cached home snapshots and player names from localStorage', () => {
        globalThis.localStorage.setItem('clashCalc_cachedHomeProfile_8PJYGUJC', 'card-html');
        globalThis.localStorage.setItem('clashCalc_cachedPlayerName_8PJYGUJC', 'Player');
        globalThis.localStorage.setItem('clashCalc_cachedHomeOres_8PJYGUJC', '{"shiny":100}');
        globalThis.localStorage.setItem('clashCalc_playerTags', JSON.stringify(['8PJYGUJC']));
        globalThis.localStorage.setItem('clashCalc_player_8PJYGUJC', JSON.stringify({ playerProfile: { tag: '8PJYGUJC' } }));

        const deleted = sweepObsoleteStorageKeys(['8PJYGUJC']);

        assert.strictEqual(globalThis.localStorage.getItem('clashCalc_cachedHomeProfile_8PJYGUJC'), null);
        assert.strictEqual(globalThis.localStorage.getItem('clashCalc_cachedPlayerName_8PJYGUJC'), null);
        assert.strictEqual(globalThis.localStorage.getItem('clashCalc_cachedHomeOres_8PJYGUJC'), null);
        assert.ok(deleted.includes('clashCalc_cachedHomeProfile_8PJYGUJC'));
        assert.ok(deleted.includes('clashCalc_cachedPlayerName_8PJYGUJC'));
        assert.ok(deleted.includes('clashCalc_cachedHomeOres_8PJYGUJC'));
    });

    test('removePlayerTag purges player partition from disk', () => {
        globalThis.localStorage.setItem('clashCalc_player_8PJYGUJC', JSON.stringify({ playerProfile: { tag: '8PJYGUJC' } }));
        globalThis.localStorage.setItem('clashCalc_playerTags', JSON.stringify(['8PJYGUJC', '2PP']));

        state.savedPlayerTags = ['8PJYGUJC', '2PP'];
        removePlayerTag('8PJYGUJC');

        assert.strictEqual(globalThis.localStorage.getItem('clashCalc_player_8PJYGUJC'), null);
    });
});
