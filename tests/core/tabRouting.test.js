import { test, describe } from "node:test";
import assert from "node:assert/strict";

if (typeof globalThis.window === 'undefined') {
    globalThis.window = /** @type {any} */ ({
        addEventListener: () => {},
        removeEventListener: () => {},
        matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
        location: { pathname: '/', search: '', hash: '' }
    });
}

if (typeof globalThis.document === 'undefined') {
    globalThis.document = /** @type {any} */ ({
        addEventListener: () => {},
        removeEventListener: () => {},
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => []
    });
}

if (typeof globalThis.localStorage === 'undefined') {
    const mockStorage = new Map();
    globalThis.localStorage = /** @type {any} */ ({
        getItem: (k) => mockStorage.get(k) || null,
        setItem: (k, v) => mockStorage.set(k, String(v)),
        removeItem: (k) => mockStorage.delete(k),
        clear: () => mockStorage.clear()
    });
}

import { readFileSync as _rfs } from 'node:fs';
import _path from 'node:path';
import { fileURLToPath as _ftu } from 'node:url';
const _tdir = _path.dirname(_ftu(import.meta.url));
const _tgdir = _path.resolve(_tdir, '../../js/data/targets');
globalThis.fetch = (url) => {
    const _f = String(url).split('/').pop();
    const _d = JSON.parse(_rfs(_path.resolve(_tgdir, _f), 'utf8'));
    return Promise.resolve({ json: () => Promise.resolve(_d) });
};
import { preloadDefensesData } from '../../js/data/defenseTargetsData.js';
await preloadDefensesData();

const { constructTabUrl, resolveTabFromUrl } = await import('../../js/components/layout/tabs.js');
const {
    constructDamageTabUrl,
    resolveDamageTabFromUrl
} = await import('../../js/components/damage/damageCalcTabNav.js');

describe("Tab Routing & Canonical URL Construction", () => {
    describe("Default English Tool Route (/ore-calculator/)", () => {
        const basePath = "/ore-calculator/";

        test("home tab constructs clean tool URL with zero query or hash", () => {
            const url = constructTabUrl("home", basePath, "");
            assert.strictEqual(url, "/ore-calculator/");
        });

        test("sub-tabs append canonical ?tab= query parameter", () => {
            assert.strictEqual(constructTabUrl("equipment", basePath, ""), "/ore-calculator/?tab=equipment");
            assert.strictEqual(constructTabUrl("income", basePath, ""), "/ore-calculator/?tab=income");
            assert.strictEqual(constructTabUrl("planner", basePath, ""), "/ore-calculator/?tab=planner");
            assert.strictEqual(constructTabUrl("settings", basePath, ""), "/ore-calculator/?tab=settings");
        });

        test("normalizes -tab suffix cleanly", () => {
            assert.strictEqual(constructTabUrl("home-tab", basePath, ""), "/ore-calculator/");
            assert.strictEqual(constructTabUrl("equipment-tab", basePath, ""), "/ore-calculator/?tab=equipment");
            assert.strictEqual(constructTabUrl("income-tab", basePath, ""), "/ore-calculator/?tab=income");
            assert.strictEqual(constructTabUrl("planner-tab", basePath, ""), "/ore-calculator/?tab=planner");
            assert.strictEqual(constructTabUrl("settings-tab", basePath, ""), "/ore-calculator/?tab=settings");
        });
    });

    describe("Player Tag Query Parameter Preservation", () => {
        const basePath = "/ore-calculator/";
        const search = "?tag=8PJYGUJC";

        test("preserves player tag parameter on home tab without adding tab parameter", () => {
            const url = constructTabUrl("home", basePath, search);
            assert.strictEqual(url, "/ore-calculator/?tag=8PJYGUJC");
        });

        test("preserves player tag parameter when switching between sub-tabs", () => {
            assert.strictEqual(constructTabUrl("equipment", basePath, search), "/ore-calculator/?tag=8PJYGUJC&tab=equipment");
            assert.strictEqual(constructTabUrl("income", basePath, search), "/ore-calculator/?tag=8PJYGUJC&tab=income");
            assert.strictEqual(constructTabUrl("planner", basePath, search), "/ore-calculator/?tag=8PJYGUJC&tab=planner");
            assert.strictEqual(constructTabUrl("settings", basePath, search), "/ore-calculator/?tag=8PJYGUJC&tab=settings");
        });

        test("cleans tab parameter when switching back to home tab", () => {
            assert.strictEqual(
                constructTabUrl("home", basePath, "?tag=8PJYGUJC&tab=equipment"),
                "/ore-calculator/?tag=8PJYGUJC"
            );
        });

        test("preserves compound query parameters intact", () => {
            const compoundSearch = "?tag=8PJYGUJC&preview=true&ref=card";
            assert.strictEqual(
                constructTabUrl("income", basePath, compoundSearch),
                "/ore-calculator/?tag=8PJYGUJC&preview=true&ref=card&tab=income"
            );
        });
    });

    describe("Localized Tool Routes & Legacy Fallback", () => {
        test("preserves German localized tool route", () => {
            assert.strictEqual(
                constructTabUrl("equipment", "/de/ore-calculator/", "?tag=TEST"),
                "/de/ore-calculator/?tag=TEST&tab=equipment"
            );
            assert.strictEqual(
                constructTabUrl("home", "/de/ore-calculator/", "?tag=TEST"),
                "/de/ore-calculator/?tag=TEST"
            );
        });

        test("preserves Turkish localized tool route", () => {
            assert.strictEqual(
                constructTabUrl("planner", "/tr/ore-calculator/", ""),
                "/tr/ore-calculator/?tab=planner"
            );
        });

        test("preserves Chinese localized tool route", () => {
            assert.strictEqual(
                constructTabUrl("settings", "/zh/ore-calculator/", "?tag=CH123"),
                "/zh/ore-calculator/?tag=CH123&tab=settings"
            );
        });

        test("preserves legacy root route for backwards compatibility", () => {
            assert.strictEqual(constructTabUrl("home", "/", "?tag=8PJYGUJC"), "/?tag=8PJYGUJC");
            assert.strictEqual(constructTabUrl("income", "/", "?tag=8PJYGUJC"), "/?tag=8PJYGUJC&tab=income");
        });
    });

    describe("Defensive Edge Cases & Optional Anchors", () => {
        test("handles empty or falsy tabKey gracefully by returning base path without tab param", () => {
            assert.strictEqual(constructTabUrl("", "/ore-calculator/", "?tag=123"), "/ore-calculator/?tag=123");
            assert.strictEqual(constructTabUrl(null, "/ore-calculator/", "?tag=123"), "/ore-calculator/?tag=123");
            assert.strictEqual(constructTabUrl(undefined, "/ore-calculator/", "?tag=123"), "/ore-calculator/?tag=123");
        });

        test("falls back safely when pathname and search are omitted in non-browser environment", () => {
            const url = constructTabUrl("equipment");
            assert.strictEqual(url, "/?tab=equipment");
        });

        test("attaches DOM element anchor hash cleanly when provided", () => {
            assert.strictEqual(
                constructTabUrl("equipment", "/ore-calculator/", "?tag=8PJYGUJC", "equip-giantArrow"),
                "/ore-calculator/?tag=8PJYGUJC&tab=equipment#equip-giantArrow"
            );
        });
    });

    describe("Ore Calculator URL Tab Resolution", () => {
        test("resolves canonical ?tab= query parameter", () => {
            assert.strictEqual(resolveTabFromUrl("?tab=equipment", ""), "equipment-tab");
            assert.strictEqual(resolveTabFromUrl("?tab=income", ""), "income-tab");
            assert.strictEqual(resolveTabFromUrl("?tab=planner", ""), "planner-tab");
            assert.strictEqual(resolveTabFromUrl("?tab=settings", ""), "settings-tab");
            assert.strictEqual(resolveTabFromUrl("?tab=home", ""), "home-tab");
        });

        test("resolves legacy tab hash identifiers for backward compatibility", () => {
            assert.strictEqual(resolveTabFromUrl("", "#equipment"), "equipment-tab");
            assert.strictEqual(resolveTabFromUrl("", "#income"), "income-tab");
            assert.strictEqual(resolveTabFromUrl("", "#planner"), "planner-tab");
            assert.strictEqual(resolveTabFromUrl("", "#settings"), "settings-tab");
            assert.strictEqual(resolveTabFromUrl("", "#home"), "home-tab");
        });

        test("resolves spotright deep link hashes to equipment tab", () => {
            assert.strictEqual(resolveTabFromUrl("", "#equip-giantArrow"), "equipment-tab");
            assert.strictEqual(resolveTabFromUrl("", "#hero-archerQueen"), "equipment-tab");
        });

        test("query parameter takes precedence over legacy hash", () => {
            assert.strictEqual(resolveTabFromUrl("?tab=planner", "#income"), "planner-tab");
        });

        test("falls back to home-tab for empty or unrecognized values", () => {
            assert.strictEqual(resolveTabFromUrl("", ""), "home-tab");
            assert.strictEqual(resolveTabFromUrl("?tab=unknown", ""), "home-tab");
            assert.strictEqual(resolveTabFromUrl("", "#unknown"), "home-tab");
        });
    });
});

describe("Damage Calculator Tab Routing & Canonical URL Construction", () => {
    describe("Default English Tool Route (/damage-calculator/)", () => {
        const basePath = "/damage-calculator/";

        test("zapquake tab constructs clean tool URL with zero query or hash", () => {
            const url = constructDamageTabUrl("zapquake", basePath, "");
            assert.strictEqual(url, "/damage-calculator/");
        });

        test("sub-tabs append canonical ?tab= parameter in kebab-case", () => {
            assert.strictEqual(constructDamageTabUrl("cluster_planner", basePath, ""), "/damage-calculator/?tab=cluster-planner");
            assert.strictEqual(constructDamageTabUrl("cluster-planner", basePath, ""), "/damage-calculator/?tab=cluster-planner");
        });

        test("normalizes -tab suffix cleanly", () => {
            assert.strictEqual(constructDamageTabUrl("zapquake-tab", basePath, ""), "/damage-calculator/");
            assert.strictEqual(constructDamageTabUrl("cluster_planner-tab", basePath, ""), "/damage-calculator/?tab=cluster-planner");
        });
    });

    describe("Damage Calculator Query Parameter Preservation", () => {
        const basePath = "/damage-calculator/";
        const search = "?tag=8PJYGUJC";

        test("preserves player tag parameter on zapquake tab without adding tab parameter", () => {
            const url = constructDamageTabUrl("zapquake", basePath, search);
            assert.strictEqual(url, "/damage-calculator/?tag=8PJYGUJC");
        });

        test("preserves player tag parameter when switching to cluster-planner", () => {
            assert.strictEqual(constructDamageTabUrl("cluster_planner", basePath, search), "/damage-calculator/?tag=8PJYGUJC&tab=cluster-planner");
            assert.strictEqual(constructDamageTabUrl("cluster-planner", basePath, search), "/damage-calculator/?tag=8PJYGUJC&tab=cluster-planner");
        });

        test("preserves compound query parameters intact", () => {
            const compoundSearch = "?tag=8PJYGUJC&preview=true&ref=card";
            assert.strictEqual(
                constructDamageTabUrl("cluster_planner", basePath, compoundSearch),
                "/damage-calculator/?tag=8PJYGUJC&preview=true&ref=card&tab=cluster-planner"
            );
        });
    });

    describe("Damage Calculator Localized Tool Routes", () => {
        test("preserves German localized tool route", () => {
            assert.strictEqual(
                constructDamageTabUrl("cluster_planner", "/de/damage-calculator/", "?tag=TEST"),
                "/de/damage-calculator/?tag=TEST&tab=cluster-planner"
            );
            assert.strictEqual(
                constructDamageTabUrl("zapquake", "/de/damage-calculator/", "?tag=TEST"),
                "/de/damage-calculator/?tag=TEST"
            );
        });

        test("preserves Turkish localized tool route", () => {
            assert.strictEqual(
                constructDamageTabUrl("zapquake", "/tr/damage-calculator/", ""),
                "/tr/damage-calculator/"
            );
        });

        test("preserves Chinese localized tool route", () => {
            assert.strictEqual(
                constructDamageTabUrl("cluster_planner", "/zh/damage-calculator/", "?tag=CH123"),
                "/zh/damage-calculator/?tag=CH123&tab=cluster-planner"
            );
        });
    });

    describe("Damage Calculator URL Tab Resolution", () => {
        test("resolves canonical query parameter (?tab=cluster-planner)", () => {
            assert.strictEqual(resolveDamageTabFromUrl("", "?tab=cluster-planner"), "cluster_planner");
            assert.strictEqual(resolveDamageTabFromUrl("", "?tab=cluster_planner"), "cluster_planner");
            assert.strictEqual(resolveDamageTabFromUrl("", "?tab=zapquake"), "zapquake");
        });

        test("resolves legacy hash identifiers for backwards compatibility", () => {
            assert.strictEqual(resolveDamageTabFromUrl("#cluster_planner", ""), "cluster_planner");
            assert.strictEqual(resolveDamageTabFromUrl("#cluster-planner", ""), "cluster_planner");
            assert.strictEqual(resolveDamageTabFromUrl("#zapquake", ""), "zapquake");
        });

        test("returns null for unrecognized or invalid hashes and parameters", () => {
            assert.strictEqual(resolveDamageTabFromUrl("#unknown", ""), null);
            assert.strictEqual(resolveDamageTabFromUrl("#equipment", ""), null);
            assert.strictEqual(resolveDamageTabFromUrl("#defense_board", ""), null);
            assert.strictEqual(resolveDamageTabFromUrl("", "?tab=defense_board"), null);
            assert.strictEqual(resolveDamageTabFromUrl("#cluster", ""), null);
            assert.strictEqual(resolveDamageTabFromUrl("", ""), null);
        });
    });

    describe("Instant Tab Transition Contract", () => {
        test("tab switching does not set transitionType or transitionDirection on document.documentElement", async () => {
            const docElement = { dataset: {} };
            const previousDoc = globalThis.document;
            const previousWin = globalThis.window;
            const previousHistory = globalThis.history;

            let clickHandler = null;
            let popstateHandler = null;

            globalThis.history = { pushState: () => {}, replaceState: () => {} };

            globalThis.document = /** @type {any} */ ({
                documentElement: docElement,
                addEventListener: () => {},
                removeEventListener: () => {},
                getElementById: () => null,
                querySelector: () => null,
                querySelectorAll: () => [],
                body: {
                    classList: { remove: () => {}, add: () => {}, toggle: () => {}, contains: () => false },
                    addEventListener: (evt, handler) => {
                        if (evt === 'click') clickHandler = handler;
                    }
                }
            });

            globalThis.window = /** @type {any} */ ({
                addEventListener: (evt, handler) => {
                    if (evt === 'popstate') popstateHandler = handler;
                },
                removeEventListener: () => {},
                matchMedia: () => ({ matches: false }),
                location: { pathname: '/ore-calculator/', search: '', hash: '' },
                scrollTo: () => {},
                history: globalThis.history
            });

            try {
                const { dom } = await import('../../js/dom/domElements.js');
                dom.fab = { main: null, menu: null };
                dom.tabs = { buttons: [], contents: [] };

                const { initializeTabs } = await import('../../js/components/layout/tabs.js');
                const { state } = await import('../../js/core/state.js');

                state.activeTab = 'home-tab';
                initializeTabs();

                assert.ok(typeof clickHandler === 'function', 'click handler should be registered');
                assert.ok(typeof popstateHandler === 'function', 'popstate handler should be registered');

                // Simulate clicking the equipment tab button
                const mockEquipmentBtn = {
                    dataset: { tab: 'equipment' },
                    classList: { contains: () => false },
                    closest: (sel) => (sel === '[data-tab]' ? mockEquipmentBtn : null)
                };

                clickHandler({ target: mockEquipmentBtn });

                assert.strictEqual(state.activeTab, 'equipment-tab');
                assert.strictEqual(docElement.dataset.transitionType, undefined, 'Must not set transitionType');
                assert.strictEqual(docElement.dataset.transitionDirection, undefined, 'Must not set transitionDirection');

                // Simulate popstate back to home
                globalThis.window.location.search = '';
                popstateHandler();

                assert.strictEqual(state.activeTab, 'home-tab');
                assert.strictEqual(docElement.dataset.transitionType, undefined, 'Must not set transitionType on popstate');
                assert.strictEqual(docElement.dataset.transitionDirection, undefined, 'Must not set transitionDirection on popstate');
            } finally {
                globalThis.document = previousDoc;
                globalThis.window = previousWin;
                globalThis.history = previousHistory;
            }
        });
    });
});
