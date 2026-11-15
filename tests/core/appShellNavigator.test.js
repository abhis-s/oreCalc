import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    resolveAppRoute,
    isNavigableLink,
    registerAppRoute,
    getAppRouteHandler,
    registerNavigatorUiHooks,
    initAppShellNavigator,
    ROUTE_SCRIPT_MAP,
    NAVIGATION_TIMEOUT_MS
} from '../../js/core/appShellNavigator.js';
import { computeSynchronizedBodyClasses } from '../../js/core/appShellDomSync.js';
import { renderNavigationDrawerContent } from '../../js/components/common/navigationDrawerDisplay.js';

describe('Persistent App Shell Navigator Suite', () => {

    describe('Canonical Route Resolution', () => {
        test('resolves root and localized landing hub paths', () => {
            assert.equal(resolveAppRoute('/'), 'hub');
            assert.equal(resolveAppRoute(''), 'hub');
            assert.equal(resolveAppRoute('/de'), 'hub');
            assert.equal(resolveAppRoute('/de/'), 'hub');
            assert.equal(resolveAppRoute('/tr'), 'hub');
            assert.equal(resolveAppRoute('/tr/'), 'hub');
            assert.equal(resolveAppRoute('/zh'), 'hub');
            assert.equal(resolveAppRoute('/zh/'), 'hub');
        });

        test('resolves ore-calculator paths across locales', () => {
            assert.equal(resolveAppRoute('/ore-calculator'), 'ore-calculator');
            assert.equal(resolveAppRoute('/ore-calculator/'), 'ore-calculator');
            assert.equal(resolveAppRoute('/de/ore-calculator'), 'ore-calculator');
            assert.equal(resolveAppRoute('/de/ore-calculator/'), 'ore-calculator');
            assert.equal(resolveAppRoute('/tr/ore-calculator/'), 'ore-calculator');
            assert.equal(resolveAppRoute('/zh/ore-calculator/'), 'ore-calculator');
        });

        test('resolves hero-journey paths across locales', () => {
            assert.equal(resolveAppRoute('/hero-journey'), 'hero-journey');
            assert.equal(resolveAppRoute('/hero-journey/'), 'hero-journey');
            assert.equal(resolveAppRoute('/de/hero-journey'), 'hero-journey');
            assert.equal(resolveAppRoute('/de/hero-journey/'), 'hero-journey');
            assert.equal(resolveAppRoute('/tr/hero-journey/'), 'hero-journey');
            assert.equal(resolveAppRoute('/zh/hero-journey/'), 'hero-journey');
        });

        test('resolves damage-calculator paths across locales', () => {
            assert.equal(resolveAppRoute('/damage-calculator'), 'damage-calculator');
            assert.equal(resolveAppRoute('/damage-calculator/'), 'damage-calculator');
            assert.equal(resolveAppRoute('/de/damage-calculator'), 'damage-calculator');
            assert.equal(resolveAppRoute('/de/damage-calculator/'), 'damage-calculator');
            assert.equal(resolveAppRoute('/tr/damage-calculator/'), 'damage-calculator');
            assert.equal(resolveAppRoute('/zh/damage-calculator/'), 'damage-calculator');
        });

        test('resolves account paths across locales', () => {
            assert.equal(resolveAppRoute('/account'), 'account');
            assert.equal(resolveAppRoute('/account/'), 'account');
            assert.equal(resolveAppRoute('/de/account'), 'account');
            assert.equal(resolveAppRoute('/de/account/'), 'account');
            assert.equal(resolveAppRoute('/tr/account/'), 'account');
            assert.equal(resolveAppRoute('/zh/account/'), 'account');
        });

        test('rejects legal pages and external paths as non-soft-navigable', () => {
            assert.equal(resolveAppRoute('/privacy'), null);
            assert.equal(resolveAppRoute('/privacy/'), null);
            assert.equal(resolveAppRoute('/de/privacy/'), null);
            assert.equal(resolveAppRoute('/terms'), null);
            assert.equal(resolveAppRoute('/terms/'), null);
            assert.equal(resolveAppRoute('/licenses'), null);
            assert.equal(resolveAppRoute('/licenses/'), null);
            assert.equal(resolveAppRoute('/about/'), null);
            assert.equal(resolveAppRoute('/unknown/path'), null);
            assert.equal(resolveAppRoute(null), null);
            assert.equal(resolveAppRoute(''), 'hub');
        });
    });

    describe('Link Eligibility & Interception Rules', () => {
        /**
         * Creates a mock anchor element for testing link criteria.
         * @param {Record<string, string>} [attributes={}]
         * @returns {HTMLAnchorElement}
         */
        function createMockAnchor(attributes = {}) {
            return /** @type {HTMLAnchorElement} */ ({
                getAttribute: (name) => attributes[name] || null,
                hasAttribute: (name) => Object.hasOwn(attributes, name)
            });
        }

        test('accepts valid internal tool links', () => {
            const anchor = createMockAnchor({ href: '/hero-journey/' });
            const result = isNavigableLink(anchor);
            assert.equal(result.isNavigable, true);
            assert.equal(result.route, 'hero-journey');

            const damageWithTag = createMockAnchor({ href: '/damage-calculator/?tag=8PJYGUJC' });
            const damageResult = isNavigableLink(damageWithTag);
            assert.equal(damageResult.isNavigable, true);
            assert.equal(damageResult.route, 'damage-calculator');

            const oreWithTag = createMockAnchor({ href: '/ore-calculator/?tag=8PJYGUJC' });
            assert.equal(isNavigableLink(oreWithTag).isNavigable, true);
            assert.equal(isNavigableLink(oreWithTag).route, 'ore-calculator');
        });

        test('rejects hash-only and scheme links', () => {
            assert.equal(isNavigableLink(createMockAnchor({ href: '#' })).isNavigable, false);
            assert.equal(isNavigableLink(createMockAnchor({ href: '#section' })).isNavigable, false);
            assert.equal(isNavigableLink(createMockAnchor({ href: 'javascript:void(0)' })).isNavigable, false);
            assert.equal(isNavigableLink(createMockAnchor({ href: 'mailto:info@clashcalc.com' })).isNavigable, false);
            assert.equal(isNavigableLink(createMockAnchor({ href: 'tel:+123456789' })).isNavigable, false);
        });

        test('rejects links with target other than _self', () => {
            const anchorBlank = createMockAnchor({ href: '/ore-calculator/', target: '_blank' });
            assert.equal(isNavigableLink(anchorBlank).isNavigable, false);

            const anchorSelf = createMockAnchor({ href: '/ore-calculator/', target: '_self' });
            assert.equal(isNavigableLink(anchorSelf).isNavigable, true);
        });

        test('rejects download links and modal trigger targets', () => {
            const anchorDownload = createMockAnchor({ href: '/account/', download: '' });
            assert.equal(isNavigableLink(anchorDownload).isNavigable, false);

            const anchorModal = createMockAnchor({ href: '/about/', 'data-modal-target': 'running-costs-modal' });
            assert.equal(isNavigableLink(anchorModal).isNavigable, false);
        });

        test('rejects keyboard modifier events and non-primary mouse clicks', () => {
            const anchor = createMockAnchor({ href: '/damage-calculator/' });

            const metaEvent = /** @type {MouseEvent} */ ({ metaKey: true, button: 0 });
            assert.equal(isNavigableLink(anchor, metaEvent).isNavigable, false);

            const ctrlEvent = /** @type {MouseEvent} */ ({ ctrlKey: true, button: 0 });
            assert.equal(isNavigableLink(anchor, ctrlEvent).isNavigable, false);

            const shiftEvent = /** @type {MouseEvent} */ ({ shiftKey: true, button: 0 });
            assert.equal(isNavigableLink(anchor, shiftEvent).isNavigable, false);

            const altEvent = /** @type {MouseEvent} */ ({ altKey: true, button: 0 });
            assert.equal(isNavigableLink(anchor, altEvent).isNavigable, false);

            const rightClickEvent = /** @type {MouseEvent} */ ({ button: 2 });
            assert.equal(isNavigableLink(anchor, rightClickEvent).isNavigable, false);

            const normalClickEvent = /** @type {MouseEvent} */ ({ button: 0 });
            assert.equal(isNavigableLink(anchor, normalClickEvent).isNavigable, true);
        });

        test('rejects non-navigable legal routes', () => {
            const anchorPrivacy = createMockAnchor({ href: '/privacy/' });
            assert.equal(isNavigableLink(anchorPrivacy).isNavigable, false);

            const anchorTerms = createMockAnchor({ href: '/terms/' });
            assert.equal(isNavigableLink(anchorTerms).isNavigable, false);
        });

        test('rejects modal target triggers and modal dismissal links', () => {
            const anchorModal = createMockAnchor({
                href: '/about/',
                'data-modal-target': 'running-costs-modal'
            });
            assert.equal(isNavigableLink(anchorModal).isNavigable, false);

            const anchorDialog = createMockAnchor({
                href: '/about/',
                'data-dialog-target': 'changelog-modal'
            });
            assert.equal(isNavigableLink(anchorDialog).isNavigable, false);

            const anchorDismiss = createMockAnchor({
                href: '#',
                'data-modal-dismiss': 'true'
            });
            assert.equal(isNavigableLink(anchorDismiss).isNavigable, false);
        });
    });

    describe('Synchronized Body Class Calculations', () => {
        test('preserves dark mode and projects target tool namespaces', () => {
            assert.equal(
                computeSynchronizedBodyClasses('dark-mode landing-page', 'hero-journey'),
                'dark-mode hero-journey-page'
            );
            assert.equal(
                computeSynchronizedBodyClasses('dark-mode hero-journey-page', 'damage-calculator'),
                'dark-mode damage-calc-page'
            );
            assert.equal(
                computeSynchronizedBodyClasses('dark-mode damage-calc-page', 'account'),
                'dark-mode account-page'
            );
            assert.equal(
                computeSynchronizedBodyClasses('dark-mode account-page', 'hub'),
                'dark-mode landing-page'
            );
            assert.equal(
                computeSynchronizedBodyClasses('dark-mode landing-page', 'ore-calculator'),
                'dark-mode'
            );
        });

        test('preserves light mode theme during transitions', () => {
            assert.equal(
                computeSynchronizedBodyClasses('light-mode landing-page', 'hero-journey'),
                'light-mode hero-journey-page'
            );
            assert.equal(
                computeSynchronizedBodyClasses('light-mode hero-journey-page', 'ore-calculator'),
                'light-mode'
            );
        });

        test('preserves active has-player badge across view transitions', () => {
            assert.equal(
                computeSynchronizedBodyClasses('dark-mode landing-page has-player', 'ore-calculator', true),
                'dark-mode has-player'
            );
            assert.equal(
                computeSynchronizedBodyClasses('dark-mode', 'hero-journey', true),
                'dark-mode hero-journey-page has-player'
            );
        });
    });

    describe('Route Lifecycle Registry', () => {
        test('correctly registers and retrieves lifecycle mount/destroy handlers', () => {
            let mounted = false;
            let destroyed = false;

            const handlers = {
                mount: () => { mounted = true; },
                destroy: () => { destroyed = true; }
            };

            registerAppRoute('hub', handlers);
            const retrieved = getAppRouteHandler('hub');

            assert.ok(retrieved);
            assert.equal(typeof retrieved.mount, 'function');
            assert.equal(typeof retrieved.destroy, 'function');

            retrieved.mount();
            assert.equal(mounted, true);

            retrieved.destroy?.();
            assert.equal(destroyed, true);
        });

        test('declares script paths for all 5 primary tool routes in route script map', () => {
            assert.equal(ROUTE_SCRIPT_MAP.hub, '/js/landingApp.js');
            assert.equal(ROUTE_SCRIPT_MAP['ore-calculator'], '/js/app.js');
            assert.equal(ROUTE_SCRIPT_MAP['hero-journey'], '/js/heroJourneyApp.js');
            assert.equal(ROUTE_SCRIPT_MAP['damage-calculator'], '/js/damageApp.js');
            assert.equal(ROUTE_SCRIPT_MAP.account, '/js/accountApp.js');
        });
    });

    describe('Navigation Timeout Watchdog Contract', () => {
        test('exports NAVIGATION_TIMEOUT_MS set to exactly 6000ms', () => {
            assert.equal(NAVIGATION_TIMEOUT_MS, 6000);
        });

        test('watchdog abort controller signals abort when timeout elapses', async () => {
            const controller = new AbortController();
            let aborted = false;
            controller.signal.addEventListener('abort', () => {
                aborted = true;
            });

            const timeoutId = setTimeout(() => {
                controller.abort();
            }, 10);

            await new Promise(resolve => setTimeout(resolve, 30));
            clearTimeout(timeoutId);

            assert.equal(aborted, true);
            assert.equal(controller.signal.aborted, true);
        });

        test('clearing watchdog timer prevents abort signal from firing', async () => {
            const controller = new AbortController();
            let aborted = false;
            controller.signal.addEventListener('abort', () => {
                aborted = true;
            });

            const timeoutId = setTimeout(() => {
                controller.abort();
            }, 50);

            clearTimeout(timeoutId);
            await new Promise(resolve => setTimeout(resolve, 80));

            assert.equal(aborted, false);
            assert.equal(controller.signal.aborted, false);
        });
    });

    describe('Drawer Forward Navigation & Modal History Contract', () => {
        test('initAppShellNavigator closes drawer without fetching when clicking same-page drawer link', () => {
            const prevWin = globalThis.window;
            const prevDoc = globalThis.document;
            const prevFetch = globalThis.fetch;

            let clickHandler = null;
            let closedDrawer = null;
            let fetchCount = 0;
            const mockDrawerEl = { id: 'navigation-drawer' };

            globalThis.window = /** @type {any} */ ({
                location: {
                    href: 'http://localhost/hero-journey/?tag=8PJYGUJC',
                    origin: 'http://localhost',
                    pathname: '/hero-journey/',
                    search: '?tag=8PJYGUJC',
                    hash: ''
                },
                history: { state: null },
                addEventListener: () => {}
            });
            globalThis.document = /** @type {any} */ ({
                getElementById: (id) => (id === 'navigation-drawer' ? mockDrawerEl : null),
                querySelectorAll: () => [],
                addEventListener: (type, fn) => {
                    if (type === 'click') clickHandler = fn;
                }
            });
            globalThis.fetch = async () => {
                fetchCount++;
                throw new Error('Should not fetch on same-page drawer click');
            };

            try {
                registerNavigatorUiHooks({
                    onCloseDrawer: (el) => {
                        closedDrawer = el;
                    }
                });
                initAppShellNavigator();
                assert.equal(typeof clickHandler, 'function');

                const samePageAnchor = {
                    getAttribute: (name) => (name === 'href' ? '/hero-journey/?tag=8PJYGUJC' : null),
                    hasAttribute: () => false,
                    closest: (sel) => {
                        if (sel === 'a') return samePageAnchor;
                        if (sel === '.navigation-drawer') return mockDrawerEl;
                        return null;
                    }
                };

                let defaultPrevented = false;
                clickHandler({
                    target: samePageAnchor,
                    button: 0,
                    preventDefault: () => { defaultPrevented = true; }
                });

                assert.equal(defaultPrevented, true);
                assert.equal(closedDrawer, mockDrawerEl);
                assert.equal(fetchCount, 0);
            } finally {
                globalThis.window = prevWin;
                globalThis.document = prevDoc;
                globalThis.fetch = prevFetch;
            }
        });

        test('initAppShellNavigator uses replaceState when navigating from drawer and pushState for standard links', async () => {
            const prevWin = globalThis.window;
            const prevDoc = globalThis.document;
            const prevFetch = globalThis.fetch;
            const prevDOMParser = globalThis.DOMParser;

            let clickHandler = null;
            const historyCalls = [];
            const mockDrawerEl = { id: 'navigation-drawer' };

            globalThis.window = /** @type {any} */ ({
                location: {
                    href: 'http://localhost/',
                    origin: 'http://localhost',
                    pathname: '/',
                    search: '',
                    hash: ''
                },
                history: {
                    state: null,
                    pushState: (_state, _title, url) => {
                        historyCalls.push({ type: 'push', url });
                        const parsed = new URL(url, 'http://localhost');
                        globalThis.window.location.href = parsed.href;
                        globalThis.window.location.pathname = parsed.pathname;
                        globalThis.window.location.search = parsed.search;
                    },
                    replaceState: (_state, _title, url) => {
                        historyCalls.push({ type: 'replace', url });
                        const parsed = new URL(url, 'http://localhost');
                        globalThis.window.location.href = parsed.href;
                        globalThis.window.location.pathname = parsed.pathname;
                        globalThis.window.location.search = parsed.search;
                    }
                },
                scrollTo: () => {},
                addEventListener: () => {}
            });
            globalThis.document = /** @type {any} */ ({
                title: 'ClashCalc',
                head: { querySelectorAll: () => [], appendChild: () => {} },
                body: { className: 'dark-mode landing-page', classList: { remove: () => {} }, appendChild: () => {} },
                documentElement: { dataset: {}, removeAttribute: () => {}, classList: { contains: () => true } },
                getElementById: () => null,
                querySelector: () => null,
                querySelectorAll: () => [],
                addEventListener: (type, fn) => {
                    if (type === 'click') clickHandler = fn;
                }
            });
            globalThis.fetch = async () => /** @type {any} */ ({
                ok: true,
                text: async () => '<!DOCTYPE html><html><head><title>Dest</title></head><body><main id="main-content"></main></body></html>'
            });
            globalThis.DOMParser = /** @type {any} */ (class {
                parseFromString() {
                    return {
                        title: 'Dest',
                        querySelector: () => null,
                        querySelectorAll: () => [],
                        getElementById: () => null
                    };
                }
            });

            try {
                registerAppRoute('damage-calculator', { mount: () => {}, destroy: () => {} });
                registerAppRoute('hero-journey', { mount: () => {}, destroy: () => {} });
                initAppShellNavigator();

                const drawerAnchor = {
                    classList: { add: () => {}, remove: () => {} },
                    setAttribute: () => {},
                    getAttribute: (name) => (name === 'href' ? '/damage-calculator/?tag=8PJYGUJC' : null),
                    hasAttribute: () => false,
                    closest: (sel) => {
                        if (sel === 'a') return drawerAnchor;
                        if (sel === '.navigation-drawer') return mockDrawerEl;
                        return null;
                    }
                };

                clickHandler({
                    target: drawerAnchor,
                    button: 0,
                    preventDefault: () => {}
                });
                await new Promise(resolve => setTimeout(resolve, 20));

                assert.equal(historyCalls.length, 1);
                assert.equal(historyCalls[0].type, 'replace');
                assert.equal(historyCalls[0].url, 'http://localhost/damage-calculator/?tag=8PJYGUJC');

                const standardAnchor = {
                    getAttribute: (name) => (name === 'href' ? '/hero-journey/?tag=8PJYGUJC' : null),
                    hasAttribute: () => false,
                    closest: (sel) => (sel === 'a' ? standardAnchor : null)
                };

                clickHandler({
                    target: standardAnchor,
                    button: 0,
                    preventDefault: () => {}
                });
                await new Promise(resolve => setTimeout(resolve, 20));

                assert.equal(historyCalls.length, 2);
                assert.equal(historyCalls[1].type, 'push');
                assert.equal(historyCalls[1].url, 'http://localhost/hero-journey/?tag=8PJYGUJC');
            } finally {
                globalThis.window = prevWin;
                globalThis.document = prevDoc;
                globalThis.fetch = prevFetch;
                globalThis.DOMParser = prevDOMParser;
            }
        });
    });

    describe('Drawer Dock Active Tool Synchronization & Route Immunity', () => {
        test('renderNavigationDrawerContent locks active dock button to current route regardless of stale activeTool option', () => {
            const prevWin = globalThis.window;
            const prevDoc = globalThis.document;

            const dockChildren = [];
            const mockDockContainer = {
                set innerHTML(_val) {
                    dockChildren.length = 0;
                },
                appendChild: (el) => {
                    dockChildren.push(el);
                }
            };
            const mockDrawer = {
                dataset: {},
                addEventListener: () => {},
                querySelector: (sel) => (sel === '.navigation-drawer__dock' ? mockDockContainer : null)
            };

            globalThis.window = /** @type {any} */ ({
                location: {
                    pathname: '/de/damage-calculator/',
                    search: '?tag=8PJYGUJC',
                    origin: 'http://localhost',
                    href: 'http://localhost/de/damage-calculator/?tag=8PJYGUJC'
                }
            });
            globalThis.document = /** @type {any} */ ({
                createElement: (tag) => ({
                    tagName: tag.toUpperCase(),
                    className: '',
                    dataset: {},
                    href: '',
                    innerHTML: '',
                    attributes: {},
                    setAttribute(k, v) { this.attributes[k] = v; },
                    getAttribute(k) { return this.attributes[k] || null; }
                }),
                getElementById: () => null,
                querySelector: () => null,
                querySelectorAll: () => []
            });

            try {
                renderNavigationDrawerContent({
                    drawerEl: /** @type {any} */ (mockDrawer),
                    activeTool: 'ore-calculator',
                    playerTag: '8PJYGUJC'
                });

                const activeBtn = dockChildren.find(btn => btn.className.includes('is-active'));
                assert.ok(activeBtn, 'Expected one dock button to be marked active');
                assert.equal(activeBtn.dataset.tool, 'damage-calculator');
                assert.equal(activeBtn.getAttribute('aria-current'), 'page');

                const oreBtn = dockChildren.find(btn => btn.dataset.tool === 'ore-calculator');
                assert.ok(oreBtn);
                assert.equal(oreBtn.className.includes('is-active'), false);
                assert.equal(oreBtn.getAttribute('aria-current'), null);
            } finally {
                globalThis.window = prevWin;
                globalThis.document = prevDoc;
            }
        });

        test('unregisters state callback safely without throwing on state updates', async () => {
            const { handleStateUpdate, registerStateUpdateCallback } = await import('../../js/core/stateManager.js');
            let callbackFired = false;
            registerStateUpdateCallback(() => { callbackFired = true; });
            handleStateUpdate(() => {}, true);
            assert.equal(callbackFired, true);

            registerStateUpdateCallback(null);
            callbackFired = false;
            handleStateUpdate(() => {}, true);
            assert.equal(callbackFired, false);
        });

        test('initStandaloneAddPlayerModal re-binds on replaced #add-player-modal and updates onLoadPlayer callback', async () => {
            const { initStandaloneAddPlayerModal } = await import('../../js/components/player/standaloneAddPlayerModal.js');
            const prevDoc = globalThis.document;

            const makeModalMock = () => {
                const listeners = {};
                const inputListeners = {};
                const btnListeners = {};
                const modal = {
                    id: 'add-player-modal',
                    classList: { contains: () => false, add() {}, remove() {} },
                    addEventListener: (evt, fn) => { listeners[evt] = fn; }
                };
                const tagInput = {
                    id: 'player-tag-input-modal',
                    value: '#8PJYGUJC',
                    classList: { contains: () => false, add() {}, remove() {} },
                    addEventListener: (evt, fn) => { inputListeners[evt] = fn; },
                    focus() {}
                };
                const loadBtn = {
                    id: 'load-player-modal-btn',
                    disabled: false,
                    textContent: 'Load',
                    addEventListener: (evt, fn) => { btnListeners[evt] = fn; }
                };
                const errorEl = {
                    id: 'player-tag-error-message',
                    textContent: '',
                    classList: { add() {}, remove() {} }
                };
                return { modal, tagInput, loadBtn, errorEl, btnListeners };
            };

            let activeDom = makeModalMock();
            globalThis.document = /** @type {any} */ ({
                getElementById: (id) => {
                    if (id === 'add-player-modal') return activeDom.modal;
                    if (id === 'player-tag-input-modal') return activeDom.tagInput;
                    if (id === 'load-player-modal-btn') return activeDom.loadBtn;
                    if (id === 'player-tag-error-message') return activeDom.errorEl;
                    return null;
                },
                addEventListener() {},
                querySelectorAll: () => []
            });

            try {
                const calls = [];
                initStandaloneAddPlayerModal({
                    onLoadPlayer: async (tag) => {
                        calls.push(`first:${tag}`);
                        return { success: true };
                    }
                });

                assert.equal(typeof activeDom.btnListeners.click, 'function');
                await activeDom.btnListeners.click();
                assert.deepEqual(calls, ['first:8PJYGUJC']);

                // Simulate route transition replacing #add-player-modal with a fresh DOM node and new callback
                activeDom = makeModalMock();
                initStandaloneAddPlayerModal({
                    onLoadPlayer: async (tag) => {
                        calls.push(`second:${tag}`);
                        return { success: true };
                    }
                });

                assert.equal(typeof activeDom.btnListeners.click, 'function', 'Must bind click listener to newly replaced modal button');
                await activeDom.btnListeners.click();
                assert.deepEqual(calls, ['first:8PJYGUJC', 'second:8PJYGUJC']);
            } finally {
                globalThis.document = prevDoc;
            }
        });
    });
});
