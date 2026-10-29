import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    resolveAppRoute,
    isNavigableLink,
    computeSynchronizedBodyClasses,
    registerAppRoute,
    getAppRouteHandler,
    ROUTE_SCRIPT_MAP,
    NAVIGATION_TIMEOUT_MS
} from '../../js/core/appShellNavigator.js';

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

    describe('View Transition Resilience and Lifecycle Contract', () => {
        test('rejection of transition.finished does not cause unhandled promise rejection when swap succeeds', async () => {
            let swapExecuted = false;
            const performSwap = async () => {
                swapExecuted = true;
            };

            const mockViewTransition = {
                updateCallbackDone: Promise.resolve(),
                finished: Promise.reject(new Error('InvalidStateError: View transition was skipped because document visibility state is hidden.'))
            };

            const runTransitionSafely = async (transition, callback) => {
                await callback();
                if (transition.updateCallbackDone) {
                    await transition.updateCallbackDone;
                }
                if (transition.finished) {
                    try {
                        await transition.finished;
                    } catch (_) {
                        // Expected: skipped transition should not propagate
                    }
                }
            };

            await assert.doesNotReject(async () => {
                await runTransitionSafely(mockViewTransition, performSwap);
            });
            assert.equal(swapExecuted, true);
        });

        test('rejection of updateCallbackDone propagates failure for browser fallback reload', async () => {
            const mockFailingTransition = {
                updateCallbackDone: Promise.reject(new Error('Swap failed')),
                finished: Promise.resolve()
            };

            const runTransitionSafely = async (transition, callback) => {
                await callback();
                if (transition.updateCallbackDone) {
                    await transition.updateCallbackDone;
                }
                if (transition.finished) {
                    try {
                        await transition.finished;
                    } catch (_) {}
                }
            };

            await assert.rejects(async () => {
                await runTransitionSafely(mockFailingTransition, async () => {});
            }, /Swap failed/);
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
});
