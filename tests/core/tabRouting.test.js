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

const { constructTabUrl } = await import('../../js/components/layout/tabs.js');
const {
    constructDamageTabUrl,
    resolveDamageTabFromUrl
} = await import('../../js/components/damage/damageCalcTabNav.js');

describe("Tab Routing & Canonical URL Construction", () => {
    describe("Default English Tool Route (/ore-calculator/)", () => {
        const basePath = "/ore-calculator/";

        test("home tab constructs clean tool URL with zero hash", () => {
            const url = constructTabUrl("home", basePath, "");
            assert.strictEqual(url, "/ore-calculator/");
        });

        test("sub-tabs append corresponding hash identifiers", () => {
            assert.strictEqual(constructTabUrl("equipment", basePath, ""), "/ore-calculator/#equipment");
            assert.strictEqual(constructTabUrl("income", basePath, ""), "/ore-calculator/#income");
            assert.strictEqual(constructTabUrl("planner", basePath, ""), "/ore-calculator/#planner");
            assert.strictEqual(constructTabUrl("settings", basePath, ""), "/ore-calculator/#settings");
        });

        test("normalizes -tab suffix cleanly", () => {
            assert.strictEqual(constructTabUrl("home-tab", basePath, ""), "/ore-calculator/");
            assert.strictEqual(constructTabUrl("equipment-tab", basePath, ""), "/ore-calculator/#equipment");
            assert.strictEqual(constructTabUrl("income-tab", basePath, ""), "/ore-calculator/#income");
            assert.strictEqual(constructTabUrl("planner-tab", basePath, ""), "/ore-calculator/#planner");
            assert.strictEqual(constructTabUrl("settings-tab", basePath, ""), "/ore-calculator/#settings");
        });
    });

    describe("Player Tag Query Parameter Preservation", () => {
        const basePath = "/ore-calculator/";
        const search = "?tag=8PJYGUJC";

        test("preserves player tag parameter on home tab with zero hash", () => {
            const url = constructTabUrl("home", basePath, search);
            assert.strictEqual(url, "/ore-calculator/?tag=8PJYGUJC");
        });

        test("preserves player tag parameter when switching between sub-tabs", () => {
            assert.strictEqual(constructTabUrl("equipment", basePath, search), "/ore-calculator/?tag=8PJYGUJC#equipment");
            assert.strictEqual(constructTabUrl("income", basePath, search), "/ore-calculator/?tag=8PJYGUJC#income");
            assert.strictEqual(constructTabUrl("planner", basePath, search), "/ore-calculator/?tag=8PJYGUJC#planner");
            assert.strictEqual(constructTabUrl("settings", basePath, search), "/ore-calculator/?tag=8PJYGUJC#settings");
        });

        test("preserves compound query parameters intact", () => {
            const compoundSearch = "?tag=8PJYGUJC&preview=true&ref=card";
            assert.strictEqual(
                constructTabUrl("income", basePath, compoundSearch),
                "/ore-calculator/?tag=8PJYGUJC&preview=true&ref=card#income"
            );
        });
    });

    describe("Localized Tool Routes & Legacy Fallback", () => {
        test("preserves German localized tool route", () => {
            assert.strictEqual(
                constructTabUrl("equipment", "/de/ore-calculator/", "?tag=TEST"),
                "/de/ore-calculator/?tag=TEST#equipment"
            );
            assert.strictEqual(
                constructTabUrl("home", "/de/ore-calculator/", "?tag=TEST"),
                "/de/ore-calculator/?tag=TEST"
            );
        });

        test("preserves Turkish localized tool route", () => {
            assert.strictEqual(
                constructTabUrl("planner", "/tr/ore-calculator/", ""),
                "/tr/ore-calculator/#planner"
            );
        });

        test("preserves Chinese localized tool route", () => {
            assert.strictEqual(
                constructTabUrl("settings", "/zh/ore-calculator/", "?tag=CH123"),
                "/zh/ore-calculator/?tag=CH123#settings"
            );
        });

        test("preserves legacy root route for backwards compatibility", () => {
            assert.strictEqual(constructTabUrl("home", "/", "?tag=8PJYGUJC"), "/?tag=8PJYGUJC");
            assert.strictEqual(constructTabUrl("income", "/", "?tag=8PJYGUJC"), "/?tag=8PJYGUJC#income");
        });
    });

    describe("Defensive Edge Cases", () => {
        test("handles empty or falsy tabKey gracefully by returning base path without hash", () => {
            assert.strictEqual(constructTabUrl("", "/ore-calculator/", "?tag=123"), "/ore-calculator/?tag=123");
            assert.strictEqual(constructTabUrl(null, "/ore-calculator/", "?tag=123"), "/ore-calculator/?tag=123");
            assert.strictEqual(constructTabUrl(undefined, "/ore-calculator/", "?tag=123"), "/ore-calculator/?tag=123");
        });

        test("falls back safely when pathname and search are omitted in non-browser environment", () => {
            const url = constructTabUrl("equipment");
            assert.strictEqual(url, "/#equipment");
        });
    });
});

describe("Damage Calculator Tab Routing & Canonical URL Construction", () => {
    describe("Default English Tool Route (/damage-calculator/)", () => {
        const basePath = "/damage-calculator/";

        test("zapquake tab constructs clean tool URL with zero hash", () => {
            const url = constructDamageTabUrl("zapquake", basePath, "");
            assert.strictEqual(url, "/damage-calculator/");
        });

        test("sub-tabs append corresponding hash identifiers", () => {
            assert.strictEqual(constructDamageTabUrl("cluster_planner", basePath, ""), "/damage-calculator/#cluster_planner");
        });

        test("normalizes -tab suffix cleanly", () => {
            assert.strictEqual(constructDamageTabUrl("zapquake-tab", basePath, ""), "/damage-calculator/");
            assert.strictEqual(constructDamageTabUrl("cluster_planner-tab", basePath, ""), "/damage-calculator/#cluster_planner");
        });
    });

    describe("Damage Calculator Query Parameter Preservation", () => {
        const basePath = "/damage-calculator/";
        const search = "?tag=8PJYGUJC";

        test("preserves player tag parameter on zapquake tab with zero hash", () => {
            const url = constructDamageTabUrl("zapquake", basePath, search);
            assert.strictEqual(url, "/damage-calculator/?tag=8PJYGUJC");
        });

        test("preserves player tag parameter when switching to sub-tabs", () => {
            assert.strictEqual(constructDamageTabUrl("cluster_planner", basePath, search), "/damage-calculator/?tag=8PJYGUJC#cluster_planner");
        });

        test("preserves compound query parameters intact", () => {
            const compoundSearch = "?tag=8PJYGUJC&preview=true&ref=card";
            assert.strictEqual(
                constructDamageTabUrl("cluster_planner", basePath, compoundSearch),
                "/damage-calculator/?tag=8PJYGUJC&preview=true&ref=card#cluster_planner"
            );
        });
    });

    describe("Damage Calculator Localized Tool Routes", () => {
        test("preserves German localized tool route", () => {
            assert.strictEqual(
                constructDamageTabUrl("cluster_planner", "/de/damage-calculator/", "?tag=TEST"),
                "/de/damage-calculator/?tag=TEST#cluster_planner"
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
                "/zh/damage-calculator/?tag=CH123#cluster_planner"
            );
        });
    });

    describe("Damage Calculator URL Tab Resolution", () => {
        test("resolves canonical hash identifiers strictly", () => {
            assert.strictEqual(resolveDamageTabFromUrl("#cluster_planner", ""), "cluster_planner");
            assert.strictEqual(resolveDamageTabFromUrl("#zapquake", ""), "zapquake");
        });

        test("resolves query parameters strictly", () => {
            assert.strictEqual(resolveDamageTabFromUrl("", "?tab=cluster_planner"), "cluster_planner");
            assert.strictEqual(resolveDamageTabFromUrl("", "?tab=zapquake"), "zapquake");
        });

        test("returns null for unrecognized or invalid hashes", () => {
            assert.strictEqual(resolveDamageTabFromUrl("#unknown", ""), null);
            assert.strictEqual(resolveDamageTabFromUrl("#equipment", ""), null);
            assert.strictEqual(resolveDamageTabFromUrl("#defense_board", ""), null);
            assert.strictEqual(resolveDamageTabFromUrl("", "?tab=defense_board"), null);
            assert.strictEqual(resolveDamageTabFromUrl("#cluster", ""), null);
            assert.strictEqual(resolveDamageTabFromUrl("", ""), null);
        });
    });
});
