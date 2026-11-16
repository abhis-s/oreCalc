import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { initAppFooter, normalizePath, syncActiveFooterLinks } from '../../js/components/common/appFooter.js';

/**
 * Creates a lightweight anchor stub supporting attribute and classList mutations.
 *
 * @param {string} href
 */
function makeFooterAnchorStub(href) {
    const attrs = new Map([['href', href]]);
    const classes = new Set();
    return {
        getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
        setAttribute: (k, v) => attrs.set(k, String(v)),
        removeAttribute: (k) => attrs.delete(k),
        hasAttribute: (k) => attrs.has(k),
        classList: {
            add: (cls) => classes.add(cls),
            remove: (cls) => classes.delete(cls),
            contains: (cls) => classes.has(cls)
        },
        classes
    };
}

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

    test('syncActiveFooterLinks keeps href present with aria-current="page" and localizes inactive links', () => {
        const originalDocument = globalThis.document;
        const originalWindow = globalThis.window;

        try {
            const mockLinks = [
                makeFooterAnchorStub('/privacy/'),
                makeFooterAnchorStub('/terms/'),
                makeFooterAnchorStub('/licenses/')
            ];

            const mockContainer = {
                querySelectorAll: (sel) => {
                    if (sel === 'a' || sel === 'a[href]') return mockLinks;
                    return [];
                }
            };

            globalThis.window = {
                location: { pathname: '/de/privacy/', search: '' }
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
            assert.equal(mockLinks[0].getAttribute('href'), '/de/privacy/');

            assert.equal(mockLinks[1].classes.has('is-active'), false);
            assert.equal(mockLinks[1].getAttribute('aria-current'), null);
            assert.equal(mockLinks[1].getAttribute('href'), '/de/terms/');

            assert.equal(mockLinks[2].classes.has('is-active'), false);
            assert.equal(mockLinks[2].getAttribute('href'), '/licenses/');
        } finally {
            globalThis.document = originalDocument;
            globalThis.window = originalWindow;
        }
    });

    test('syncActiveFooterLinks reversibly restores exited route links across round-trip navigations', () => {
        const originalDocument = globalThis.document;
        const originalWindow = globalThis.window;

        try {
            const oreLink = makeFooterAnchorStub('/ore-calculator/');
            const hjLink = makeFooterAnchorStub('/hero-journey/');
            const dmgLink = makeFooterAnchorStub('/damage-calculator/');
            const externalLink = makeFooterAnchorStub('https://github.com/abhis-s/oreCalc');
            const brandLink = makeFooterAnchorStub('/');
            const footerLinks = [oreLink, hjLink, dmgLink, externalLink];

            const footerContainer = {
                querySelectorAll: (sel) => {
                    if (sel === 'a' || sel === 'a[href]') return footerLinks;
                    return [];
                }
            };

            globalThis.window = {
                location: { pathname: '/ore-calculator/', search: '?tag=8PJYGUJC' }
            };
            globalThis.document = {
                querySelectorAll: (sel) => {
                    if (sel.includes('.app-footer__list')) return [footerContainer];
                    if (sel.includes('.brand-title-link')) return [brandLink];
                    return [];
                }
            };

            syncActiveFooterLinks();
            assert.equal(oreLink.getAttribute('aria-current'), 'page');
            assert.equal(dmgLink.getAttribute('aria-current'), null);
            assert.equal(dmgLink.getAttribute('href'), '/damage-calculator/?tag=8PJYGUJC');
            assert.equal(externalLink.getAttribute('href'), 'https://github.com/abhis-s/oreCalc');

            globalThis.window.location.pathname = '/de/damage-calculator/';
            syncActiveFooterLinks();
            assert.equal(oreLink.classes.has('is-active'), false);
            assert.equal(oreLink.getAttribute('aria-current'), null);
            assert.equal(oreLink.getAttribute('href'), '/de/ore-calculator/?tag=8PJYGUJC');
            assert.equal(dmgLink.getAttribute('aria-current'), 'page');
            assert.equal(brandLink.getAttribute('href'), '/de/');

            globalThis.window.location.pathname = '/hero-journey/';
            globalThis.window.location.search = '';
            syncActiveFooterLinks();
            assert.equal(dmgLink.getAttribute('aria-current'), null);
            assert.equal(oreLink.getAttribute('href'), '/ore-calculator/');
            assert.equal(hjLink.getAttribute('aria-current'), 'page');
            assert.equal(brandLink.getAttribute('href'), '/');
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
