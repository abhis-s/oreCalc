import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { initAppFooter, normalizePath, syncActiveFooterLinks } from '../../js/components/common/appFooter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

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

    test('partials/footer.html declares standardized nav.* i18n keys for all legal links', () => {
        const footerHtmlPath = path.join(projectRoot, 'partials/footer.html');
        const content = fs.readFileSync(footerHtmlPath, 'utf8');

        assert.match(content, /data-i18n="nav\.privacy"/, 'Footer must declare nav.privacy');
        assert.match(content, /data-i18n="nav\.tos"/, 'Footer must declare nav.tos');
        assert.match(content, /data-i18n="nav\.licenses"/, 'Footer must declare nav.licenses');
        assert.doesNotMatch(content, /data-i18n="views\.settings\.licenses"/, 'Footer must not use views.settings.licenses');
    });

    test('standalone legal HTML templates declare clean, standard anchor tags in footer', () => {
        const legalFiles = [
            'legal/privacy-en.html',
            'legal/privacy-de.html',
            'legal/terms-en.html',
            'legal/terms-de.html',
            'legal/licenses.html'
        ];

        for (const relFile of legalFiles) {
            const filePath = path.join(projectRoot, relFile);
            const content = fs.readFileSync(filePath, 'utf8');

            assert.doesNotMatch(content, /<span class="footer__link is-active"/, `${relFile} must not contain hardcoded active span in footer`);
            assert.match(content, /<a href="[^"]*" class="footer__link"/, `${relFile} must declare standard anchor footer links`);
        }
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

    test('partials/footer.html declares copyright break element for desktop two-line layout', () => {
        const footerHtmlPath = path.join(projectRoot, 'partials/footer.html');
        const content = fs.readFileSync(footerHtmlPath, 'utf8');

        assert.match(content, /<br class="app-footer__copyright-break">/, 'Footer must contain copyright break element');
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

    test('partials/footer.html declares Bug Report and Contact buttons in Development & Support with Strategy 1 ordering', () => {
        const footerHtmlPath = path.join(projectRoot, 'partials/footer.html');
        const content = fs.readFileSync(footerHtmlPath, 'utf8');

        assert.match(content, /data-modal-target="bug-report-modal"/, 'Footer must declare bug-report-modal target');
        assert.match(content, /data-i18n="views\.settings\.bugReport\.title"/, 'Footer must declare views.settings.bugReport.title');
        assert.match(content, /data-modal-target="contact-modal"/, 'Footer must declare contact-modal target');
        assert.match(content, /data-i18n="views\.settings\.about\.contact"/, 'Footer must declare views.settings.about.contact');

        const githubIdx = content.indexOf('data-i18n="views.settings.about.github"');
        const crowdinIdx = content.indexOf('data-i18n="views.settings.about.crowdin"');
        const bugIdx = content.indexOf('data-modal-target="bug-report-modal"');
        const contactIdx = content.indexOf('data-modal-target="contact-modal"');
        const coffeeIdx = content.indexOf('data-i18n="views.settings.about.buyMeACoffee"');

        assert.ok(githubIdx < crowdinIdx, 'GitHub must precede Help Us Translate');
        assert.ok(crowdinIdx < bugIdx, 'Help Us Translate must precede Bug Report');
        assert.ok(bugIdx < contactIdx, 'Bug Report must precede Contact');
        assert.ok(contactIdx < coffeeIdx, 'Contact must precede Buy Me a Coffee');
    });

    test('partials/footer.html declares Changelog modal button in brand meta row and item--costs on project costs', () => {
        const footerHtmlPath = path.join(projectRoot, 'partials/footer.html');
        const content = fs.readFileSync(footerHtmlPath, 'utf8');

        assert.match(content, /data-modal-target="changelog-modal"/, 'Footer must declare changelog-modal target');
        assert.match(content, /data-i18n="views\.changelog\.title"/, 'Footer must declare views.changelog.title');
        assert.match(content, /class="[^"]*app-footer__meta-changelog[^"]*"/, 'Footer must declare app-footer__meta-changelog class');
        assert.match(content, /class="[^"]*app-footer__item--costs[^"]*"/, 'Project costs must declare app-footer__item--costs class');
    });

    test('partials/navigation-drawer.html declares full footer links and copyright break', () => {
        const drawerHtmlPath = path.join(projectRoot, 'partials/navigation-drawer.html');
        const content = fs.readFileSync(drawerHtmlPath, 'utf8');

        assert.match(content, /data-i18n="nav\.privacy"/, 'Drawer must declare nav.privacy');
        assert.match(content, /data-i18n="nav\.tos"/, 'Drawer must declare nav.tos');
        assert.match(content, /data-i18n="nav\.licenses"/, 'Drawer must declare nav.licenses');
        assert.match(content, /data-modal-target="running-costs-modal"/, 'Drawer must declare running-costs-modal');
        assert.match(content, /<br class="navigation-drawer__copyright-break">/, 'Drawer must declare copyright break');
    });
});
