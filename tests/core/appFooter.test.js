import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { initAppFooter, normalizePath, syncActiveFooterLinks } from '../../js/components/common/appFooter.js';

describe('Application Footer Centralization & Regularization', () => {
    test('normalizePath strips locale prefixes and trailing slashes correctly', () => {
        assert.equal(normalizePath('/'), '/');
        assert.equal(normalizePath(''), '/');
        assert.equal(normalizePath('/privacy/'), '/privacy');
        assert.equal(normalizePath('/privacy'), '/privacy');
        assert.equal(normalizePath('/de/privacy/'), '/privacy');
        assert.equal(normalizePath('/de/privacy'), '/privacy');
        assert.equal(normalizePath('/tr/terms/'), '/terms');
        assert.equal(normalizePath('/zh/licenses/'), '/licenses');
        assert.equal(normalizePath('/ore-calculator/'), '/ore-calculator');
        assert.equal(normalizePath('/hero-journey/'), '/hero-journey');
        assert.equal(normalizePath('/de/'), '/');
        assert.equal(normalizePath('/tr/'), '/');
        assert.equal(normalizePath('/zh/'), '/');
    });

    test('syncActiveFooterLinks disables and activates matching footer link for current route', () => {
        const originalDocument = globalThis.document;
        const originalWindow = globalThis.window;

        try {
            const createMockLink = (href) => {
                const attrs = new Map([['href', href]]);
                const classes = new Set();
                return {
                    getAttribute: (k) => attrs.get(k) || null,
                    setAttribute: (k, v) => attrs.set(k, v),
                    removeAttribute: (k) => attrs.delete(k),
                    classList: {
                        add: (cls) => classes.add(cls),
                        contains: (cls) => classes.has(cls)
                    },
                    classes
                };
            };

            const mockLinks = [
                createMockLink('/privacy/'),
                createMockLink('/terms/')
            ];

            const mockContainer = {
                querySelectorAll: (sel) => {
                    if (sel === 'a[href]') return mockLinks;
                    return [];
                }
            };

            globalThis.window = {
                location: { pathname: '/de/privacy/' }
            };
            globalThis.document = {
                querySelectorAll: (sel) => {
                    if (sel.includes('.footer__links')) return [mockContainer];
                    return [];
                }
            };

            syncActiveFooterLinks('.footer__links');

            assert.equal(mockLinks[0].classes.has('is-active'), true);
            assert.equal(mockLinks[0].getAttribute('aria-current'), 'page');
            assert.equal(mockLinks[0].getAttribute('href'), null);

            assert.equal(mockLinks[1].classes.has('is-active'), false);
            assert.equal(mockLinks[1].getAttribute('href'), '/terms/');
        } finally {
            globalThis.document = originalDocument;
            globalThis.window = originalWindow;
        }
    });

    test('initAppFooter hydrates copyright with break element for app-footer__copyright', () => {
        const originalDocument = globalThis.document;
        const originalWindow = globalThis.window;

        try {
            const footerCopyrightP = {
                innerHTML: '',
                closest: (sel) => sel === '.app-footer__copyright' ? {} : null
            };
            const drawerCopyright = {
                innerHTML: '',
                classList: { contains: (cls) => cls === 'navigation-drawer__copyright' },
                closest: (sel) => sel === '.navigation-drawer__copyright' ? {} : null
            };

            const versionDisplay = { textContent: '' };

            globalThis.window = {
                location: { pathname: '/' },
                __ENV__: { APP_VERSION: '2.2.0' }
            };
            globalThis.document = {
                querySelectorAll: (sel) => {
                    if (sel.includes('.app-copyright p')) return [footerCopyrightP, drawerCopyright];
                    if (sel.includes('#app-version-display')) return [versionDisplay];
                    return [];
                }
            };

            initAppFooter();

            assert.match(footerCopyrightP.innerHTML, /<br class="app-footer__copyright-break">\s*<span data-i18n="app\.allRightsReserved">All rights reserved\.<\/span>/);
            assert.match(drawerCopyright.innerHTML, /<br class="navigation-drawer__copyright-break">\s*<span data-i18n="app\.allRightsReserved">All rights reserved\.<\/span>/);
        } finally {
            globalThis.document = originalDocument;
            globalThis.window = originalWindow;
        }
    });
});
