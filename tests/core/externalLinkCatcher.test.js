import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { initExternalLinkCatcher } from '../../js/components/common/externalLinkCatcher.js';

describe('External Link Catcher Domain Suite', () => {
    let mockDocument;
    let clickListeners = [];
    let openedUrls = [];
    let modalOkCallback = null;
    let modalCancelCallback = null;

    beforeEach(() => {
        clickListeners = [];
        openedUrls = [];
        modalOkCallback = null;
        modalCancelCallback = null;

        globalThis.window = {
            location: {
                host: 'clashcalc.com',
                href: 'https://clashcalc.com/'
            },
            open: (url, target, features) => {
                openedUrls.push({ url, target, features });
            }
        };

        const mockModal = {
            id: 'notice-modal',
            showModal: () => {},
            close: () => {},
            classList: { add: () => {}, remove: () => {} },
            addEventListener: (ev, cb) => {
                if (ev === 'cancel') modalCancelCallback = cb;
            },
            removeEventListener: () => {}
        };
        const mockOkBtn = {
            addEventListener: (ev, cb) => { if (ev === 'click') modalOkCallback = cb; },
            removeEventListener: () => {},
            setAttribute: () => {}
        };
        const mockCancelBtn = {
            addEventListener: (ev, cb) => { if (ev === 'click') modalCancelCallback = cb; },
            removeEventListener: () => {},
            setAttribute: () => {},
            style: {}
        };
        const mockElem = {
            textContent: '',
            innerHTML: '',
            setAttribute: () => {}
        };

        mockDocument = {
            addEventListener: (event, handler) => {
                if (event === 'click') clickListeners.push(handler);
            },
            removeEventListener: (event, handler) => {
                if (event === 'click') {
                    clickListeners = clickListeners.filter(h => h !== handler);
                }
            },
            createElement: (tag) => ({
                tagName: tag.toUpperCase(),
                textContent: '',
                innerHTML: '',
                setAttribute: () => {},
                appendChild: () => {},
                childNodes: []
            }),
            getElementById: (id) => {
                if (id === 'notice-modal') return mockModal;
                if (id === 'notice-modal-title') return mockElem;
                if (id === 'notice-modal-message') return mockElem;
                if (id === 'notice-modal-ok-btn') return mockOkBtn;
                if (id === 'notice-modal-cancel-btn') return mockCancelBtn;
                if (id === 'overlay') return null;
                return null;
            }
        };

        globalThis.document = mockDocument;
    });

    function createMockAnchor({ href = '', classes = [], closestMap = {} } = {}) {
        return {
            tagName: 'A',
            getAttribute: (attr) => (attr === 'href' ? href : null),
            classList: {
                contains: (cls) => classes.includes(cls)
            },
            closest: (selector) => {
                if (selector === 'a') return createMockAnchor({ href, classes, closestMap });
                return closestMap[selector] || null;
            }
        };
    }

    test('returns a no-op function when root element is null or lacks addEventListener', () => {
        const cleanup = initExternalLinkCatcher(null);
        assert.equal(typeof cleanup, 'function');
        assert.doesNotThrow(() => cleanup());
    });

    test('attaches and detaches delegated click listener properly', () => {
        const cleanup = initExternalLinkCatcher(mockDocument);
        assert.equal(clickListeners.length, 1);

        cleanup();
        assert.equal(clickListeners.length, 0);
    });

    test('ignores non-anchor click targets', async () => {
        initExternalLinkCatcher(mockDocument);
        const handler = clickListeners[0];

        let defaultPrevented = false;
        await handler({
            target: { closest: () => null },
            preventDefault: () => { defaultPrevented = true; }
        });

        assert.equal(defaultPrevented, false);
        assert.equal(openedUrls.length, 0);
    });

    test('bypasses anchor tags with in-page hash or javascript: hrefs', async () => {
        initExternalLinkCatcher(mockDocument);
        const handler = clickListeners[0];

        for (const href of ['#top', '#hero-journey-table', 'javascript:void(0)']) {
            let defaultPrevented = false;
            const target = createMockAnchor({ href });
            await handler({
                target,
                preventDefault: () => { defaultPrevented = true; }
            });
            assert.equal(defaultPrevented, false);
            assert.equal(openedUrls.length, 0);
        }
    });

    test('bypasses internal domain migration CTA banners', async () => {
        initExternalLinkCatcher(mockDocument);
        const handler = clickListeners[0];

        const targetWithClass = createMockAnchor({
            href: 'https://clashcalc.com/ore-calculator/',
            classes: ['domain-notice-cta']
        });
        let defaultPrevented = false;
        await handler({
            target: targetWithClass,
            preventDefault: () => { defaultPrevented = true; }
        });
        assert.equal(defaultPrevented, false);
        assert.equal(openedUrls.length, 0);

        const targetWithinBanner = createMockAnchor({
            href: 'https://clashcalc.com/hero-journey/',
            closestMap: {
                '.domain-notice': {}
            }
        });
        defaultPrevented = false;
        await handler({
            target: targetWithinBanner,
            preventDefault: () => { defaultPrevented = true; }
        });
        assert.equal(defaultPrevented, false);
        assert.equal(openedUrls.length, 0);
    });

    test('bypasses same-host and relative internal links', async () => {
        initExternalLinkCatcher(mockDocument);
        const handler = clickListeners[0];

        const internalHrefs = [
            '/ore-calculator/',
            '/hero-journey/',
            '/terms/',
            'https://clashcalc.com/privacy/'
        ];

        for (const href of internalHrefs) {
            let defaultPrevented = false;
            const target = createMockAnchor({ href });
            await handler({
                target,
                preventDefault: () => { defaultPrevented = true; }
            });
            assert.equal(defaultPrevented, false);
            assert.equal(openedUrls.length, 0);
        }
    });

    test('intercepts external HTTP/HTTPS links and opens in new tab when confirmed', async () => {
        initExternalLinkCatcher(mockDocument);
        const handler = clickListeners[0];

        let defaultPrevented = false;
        const target = createMockAnchor({ href: 'https://github.com/abhis-s/oreCalc' });

        const clickPromise = handler({
            target,
            preventDefault: () => { defaultPrevented = true; }
        });

        if (modalOkCallback) modalOkCallback();
        await clickPromise;

        assert.equal(defaultPrevented, true);
        assert.equal(openedUrls.length, 1);
        assert.equal(openedUrls[0].url, 'https://github.com/abhis-s/oreCalc');
        assert.equal(openedUrls[0].target, '_blank');
        assert.equal(openedUrls[0].features, 'noopener,noreferrer');
    });

    test('canceling confirmation prevents window.open from being called', async () => {
        initExternalLinkCatcher(mockDocument);
        const handler = clickListeners[0];

        let defaultPrevented = false;
        const target = createMockAnchor({ href: 'https://buymeacoffee.com/orecalc' });

        const clickPromise = handler({
            target,
            preventDefault: () => { defaultPrevented = true; }
        });

        if (modalCancelCallback) modalCancelCallback();
        await clickPromise;

        assert.equal(defaultPrevented, true);
        assert.equal(openedUrls.length, 0);
    });

    test('intercepts mailto: links and prompts mailto confirmation', async () => {
        initExternalLinkCatcher(mockDocument);
        const handler = clickListeners[0];

        let defaultPrevented = false;
        const target = createMockAnchor({ href: 'mailto:support@orecalc.tech' });

        const clickPromise = handler({
            target,
            preventDefault: () => { defaultPrevented = true; }
        });

        if (modalOkCallback) modalOkCallback();
        await clickPromise;

        assert.equal(defaultPrevented, true);
        assert.equal(globalThis.window.location.href, 'mailto:support@orecalc.tech');
    });
});
