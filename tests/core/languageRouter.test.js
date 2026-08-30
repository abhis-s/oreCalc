import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
    getLanguageFromPath,
    detectLanguage,
    syncLanguageUrl,
    isValidRoute
} from '../../js/core/languageRouter.js';
import { state } from '../../js/core/state.js';

function mockGlobal(prop, value) {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, prop);
    Object.defineProperty(globalThis, prop, {
        value,
        configurable: true,
        writable: true
    });
    return () => {
        if (originalDescriptor) {
            Object.defineProperty(globalThis, prop, originalDescriptor);
        } else {
            // @ts-ignore
            delete globalThis[prop];
        }
    };
}

describe('Language Router Domain Suite', () => {
    let cleanups = [];

    beforeEach(() => {
        cleanups = [];
        state.uiSettings = {};
    });

    afterEach(() => {
        cleanups.forEach(fn => fn());
        cleanups = [];
        state.uiSettings = {};
    });

    describe('getLanguageFromPath', () => {
        test('returns null on root or empty paths', () => {
            const cleanupWindow = mockGlobal('window', { location: { pathname: '/' } });
            cleanups.push(cleanupWindow);
            assert.equal(getLanguageFromPath(), null);
        });

        test('extracts supported language codes from path', () => {
            const paths = [
                { path: '/en', expected: 'en' },
                { path: '/en/', expected: 'en' },
                { path: '/en/planner', expected: 'en' },
                { path: '/de', expected: 'de' },
                { path: '/de/', expected: 'de' },
                { path: '/de/settings', expected: 'de' },
                { path: '/tr', expected: 'tr' },
                { path: '/tr/', expected: 'tr' },
                { path: '/zh', expected: 'zh' },
                { path: '/zh/equipment', expected: 'zh' }
            ];

            for (const { path, expected } of paths) {
                const cleanup = mockGlobal('window', { location: { pathname: path } });
                assert.equal(getLanguageFromPath(), expected, `Failed for path: ${path}`);
                cleanup();
            }
        });

        test('returns null for unknown language or non-language prefixes', () => {
            const paths = ['/fr', '/es', '/privacy', '/terms', '/licenses', '/some/nested/route'];
            for (const path of paths) {
                const cleanup = mockGlobal('window', { location: { pathname: path } });
                assert.equal(getLanguageFromPath(), null, `Should return null for: ${path}`);
                cleanup();
            }
        });
    });

    describe('detectLanguage', () => {
        test('prioritizes path language when present in URL', () => {
            cleanups.push(mockGlobal('window', { location: { pathname: '/de/' } }));
            cleanups.push(mockGlobal('localStorage', { getItem: () => 'tr' }));
            cleanups.push(mockGlobal('navigator', { languages: ['zh-CN', 'en'] }));
            state.uiSettings = { language: 'zh' };

            assert.equal(detectLanguage(), 'de');
        });

        test('falls back to saved state or localStorage when path has no language prefix', () => {
            cleanups.push(mockGlobal('window', { location: { pathname: '/' } }));
            cleanups.push(mockGlobal('localStorage', { getItem: (key) => key === 'oreCalc_appSettings' ? JSON.stringify({ language: 'tr' }) : null }));
            cleanups.push(mockGlobal('navigator', { languages: ['zh-CN', 'en'] }));
            state.uiSettings = {};

            assert.equal(detectLanguage(), 'tr');
        });

        test('falls back to navigator.languages when no saved preference exists', () => {
            cleanups.push(mockGlobal('window', { location: { pathname: '/' } }));
            cleanups.push(mockGlobal('localStorage', { getItem: () => null }));
            cleanups.push(mockGlobal('navigator', { languages: ['zh-CN', 'en'] }));
            state.uiSettings = {};

            assert.equal(detectLanguage(), 'zh');
        });

        test('defaults to English (en) when no matching language is detected', () => {
            cleanups.push(mockGlobal('window', { location: { pathname: '/' } }));
            cleanups.push(mockGlobal('localStorage', { getItem: () => null }));
            cleanups.push(mockGlobal('navigator', { languages: ['fr-FR', 'es-ES'] }));
            state.uiSettings = {};

            assert.equal(detectLanguage(), 'en');
        });
    });

    describe('syncLanguageUrl', () => {
        test('normalizes /en/ to clean root / on initial visit without full reload', () => {
            let replacedUrl = null;
            let pushedUrl = null;
            const mockCanonical = { href: '' };

            cleanups.push(mockGlobal('window', {
                location: { pathname: '/en/', hash: '' }
            }));
            cleanups.push(mockGlobal('document', {
                documentElement: { lang: '' },
                querySelector: (sel) => sel === 'link[rel="canonical"]' ? mockCanonical : null
            }));
            cleanups.push(mockGlobal('history', {
                replaceState: (_state, _title, url) => { replacedUrl = url; },
                pushState: (_state, _title, url) => { pushedUrl = url; }
            }));

            syncLanguageUrl('en', true);

            assert.equal(replacedUrl, '/');
            assert.equal(pushedUrl, null);
            assert.equal(globalThis.document.documentElement.lang, 'en');
            assert.equal(mockCanonical.href, 'https://orecalc.tech/');
        });

        test('normalizes /en/#planner to /#planner without duplicating /en/', () => {
            let replacedUrl = null;
            const mockCanonical = { href: '' };

            cleanups.push(mockGlobal('window', {
                location: { pathname: '/en/', hash: '#planner' }
            }));
            cleanups.push(mockGlobal('document', {
                documentElement: { lang: '' },
                querySelector: (sel) => sel === 'link[rel="canonical"]' ? mockCanonical : null
            }));
            cleanups.push(mockGlobal('history', {
                replaceState: (_state, _title, url) => { replacedUrl = url; },
                pushState: () => {}
            }));

            syncLanguageUrl('en', true);

            assert.equal(replacedUrl, '/#planner');
            assert.equal(globalThis.document.documentElement.lang, 'en');
            assert.equal(mockCanonical.href, 'https://orecalc.tech/');
        });

        test('switches language from /de/#equipment to English /#equipment cleanly', () => {
            let pushedUrl = null;
            const mockCanonical = { href: '' };

            cleanups.push(mockGlobal('window', {
                location: { pathname: '/de/', hash: '#equipment' }
            }));
            cleanups.push(mockGlobal('document', {
                documentElement: { lang: 'de' },
                querySelector: (sel) => sel === 'link[rel="canonical"]' ? mockCanonical : null
            }));
            cleanups.push(mockGlobal('history', {
                replaceState: () => {},
                pushState: (_state, _title, url) => { pushedUrl = url; }
            }));

            syncLanguageUrl('en', false);

            assert.equal(pushedUrl, '/#equipment');
            assert.equal(globalThis.document.documentElement.lang, 'en');
            assert.equal(mockCanonical.href, 'https://orecalc.tech/');
        });

        test('switches language from root /#planner to German /de/#planner', () => {
            let pushedUrl = null;
            const mockCanonical = { href: '' };

            cleanups.push(mockGlobal('window', {
                location: { pathname: '/', hash: '#planner' }
            }));
            cleanups.push(mockGlobal('document', {
                documentElement: { lang: 'en' },
                querySelector: (sel) => sel === 'link[rel="canonical"]' ? mockCanonical : null
            }));
            cleanups.push(mockGlobal('history', {
                replaceState: () => {},
                pushState: (_state, _title, url) => { pushedUrl = url; }
            }));

            syncLanguageUrl('de', false);

            assert.equal(pushedUrl, '/de/#planner');
            assert.equal(globalThis.document.documentElement.lang, 'de');
            assert.equal(mockCanonical.href, 'https://orecalc.tech/de/');
        });

        test('ignores unsupported language codes safely', () => {
            let pushedUrl = null;
            cleanups.push(mockGlobal('history', {
                pushState: (_s, _t, url) => { pushedUrl = url; },
                replaceState: () => {}
            }));

            syncLanguageUrl('unsupported');
            assert.equal(pushedUrl, null);
        });

        test('switches language on standalone tool sub-routes retaining trailing slash and query params', () => {
            let pushedUrl = null;
            const mockCanonical = { href: '' };

            cleanups.push(mockGlobal('window', {
                location: { pathname: '/hero-journey/', search: '?tag=9L0V9G9C9', hash: '' }
            }));
            cleanups.push(mockGlobal('document', {
                documentElement: { lang: 'en' },
                querySelector: (sel) => sel === 'link[rel="canonical"]' ? mockCanonical : null
            }));
            cleanups.push(mockGlobal('history', {
                replaceState: () => {},
                pushState: (_state, _title, url) => { pushedUrl = url; }
            }));

            syncLanguageUrl('de', false);

            assert.equal(pushedUrl, '/de/hero-journey/?tag=9L0V9G9C9');
            assert.equal(globalThis.document.documentElement.lang, 'de');
            assert.equal(mockCanonical.href, 'https://orecalc.tech/de/hero-journey/');
        });

        test('normalizes sub-route without trailing slash to include trailing slash', () => {
            let replacedUrl = null;
            const mockCanonical = { href: '' };

            cleanups.push(mockGlobal('window', {
                location: { pathname: '/de/hero-journey', search: '?tag=9L0V9G9C9', hash: '' }
            }));
            cleanups.push(mockGlobal('document', {
                documentElement: { lang: 'de' },
                querySelector: (sel) => sel === 'link[rel="canonical"]' ? mockCanonical : null
            }));
            cleanups.push(mockGlobal('history', {
                replaceState: (_state, _title, url) => { replacedUrl = url; },
                pushState: () => {}
            }));

            syncLanguageUrl('de', true);

            assert.equal(replacedUrl, '/de/hero-journey/?tag=9L0V9G9C9');
            assert.equal(globalThis.document.documentElement.lang, 'de');
            assert.equal(mockCanonical.href, 'https://orecalc.tech/de/hero-journey/');
        });
    });

    describe('isValidRoute', () => {
        test('recognizes standard application routes and root pages', () => {
            assert.equal(isValidRoute('/'), true);
            assert.equal(isValidRoute('/index.html'), true);
            assert.equal(isValidRoute('/404'), true);
            assert.equal(isValidRoute('/404.html'), true);
            assert.equal(isValidRoute('/hero-journey'), true);
            assert.equal(isValidRoute('/privacy'), true);
            assert.equal(isValidRoute('/terms'), true);
            assert.equal(isValidRoute('/licenses'), true);
        });

        test('recognizes valid localized routes and subroutes', () => {
            assert.equal(isValidRoute('/en'), true);
            assert.equal(isValidRoute('/en/'), true);
            assert.equal(isValidRoute('/en/hero-journey'), true);
            assert.equal(isValidRoute('/de'), true);
            assert.equal(isValidRoute('/de/'), true);
            assert.equal(isValidRoute('/de/hero-journey'), true);
            assert.equal(isValidRoute('/de/privacy'), true);
            assert.equal(isValidRoute('/de/terms'), true);
            assert.equal(isValidRoute('/tr/hero-journey'), true);
            assert.equal(isValidRoute('/zh/hero-journey'), true);
        });

        test('rejects unrecognized routes and fake path subroutes', () => {
            assert.equal(isValidRoute('/unknown-page'), false);
            assert.equal(isValidRoute('/de/unknown-subroute'), false);
            assert.equal(isValidRoute('/de/planner'), false);
            assert.equal(isValidRoute('/de/settings'), false);
            assert.equal(isValidRoute('/tr/income'), false);
            assert.equal(isValidRoute('/zh/equipment'), false);
            assert.equal(isValidRoute('/fr/planner'), false);
            assert.equal(isValidRoute('/hero-journey/random'), false);
        });
    });
});
