import { test, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));

if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (key) => store.get(key) || null,
        setItem: (key, val) => store.set(key, String(val)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
        get length() { return store.size; }
    };
}

if (typeof globalThis.sessionStorage === 'undefined') {
    const sessionStore = new Map();
    globalThis.sessionStorage = {
        getItem: (key) => sessionStore.get(key) || null,
        setItem: (key, val) => sessionStore.set(key, String(val)),
        removeItem: (key) => sessionStore.delete(key),
        clear: () => sessionStore.clear(),
        get length() { return sessionStore.size; }
    };
}

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        addEventListener: () => {},
        removeEventListener: () => {},
        requestAnimationFrame: (cb) => { cb(performance.now() + 1000); return 1; },
        cancelAnimationFrame: () => {},
        getComputedStyle: () => ({ display: 'block', getPropertyValue: () => '' }),
        matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
        __ENV__: { APP_VERSION: '2.1.0' },
        location: { hostname: 'localhost' }
    };
} else {
    if (!globalThis.window.matchMedia) {
        globalThis.window.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
    }
    if (!globalThis.window.getComputedStyle) {
        globalThis.window.getComputedStyle = () => ({ display: 'block', getPropertyValue: () => '' });
    }
    if (!globalThis.window.requestAnimationFrame) {
        globalThis.window.requestAnimationFrame = (cb) => { cb(performance.now() + 1000); return 1; };
    }
    if (!globalThis.window.cancelAnimationFrame) {
        globalThis.window.cancelAnimationFrame = () => {};
    }
}

if (typeof globalThis.requestAnimationFrame === 'undefined') {
    globalThis.requestAnimationFrame = (cb) => { cb(performance.now() + 1000); return 1; };
} else {
    globalThis.requestAnimationFrame = (cb) => { cb(performance.now() + 1000); return 1; };
}

if (typeof globalThis.cancelAnimationFrame === 'undefined') {
    globalThis.cancelAnimationFrame = () => {};
}

if (typeof globalThis.HTMLElement === 'undefined') {
    globalThis.HTMLElement = class {};
}

if (typeof globalThis.customElements === 'undefined') {
    globalThis.customElements = {
        get: () => null,
        define: () => {}
    };
}

globalThis.fetch = async (url) => {
    if (typeof url === 'string' && url.includes('en.json')) {
        return { ok: true, json: async () => enJson };
    }
    return { ok: false, status: 404 };
};

function createMockElement(id = '') {
    return {
        id,
        isConnected: true,
        textContent: '',
        _currentNumericValue: undefined,
        style: {}
    };
}

const { dom } = await import('../../js/dom/domElements.js');
const { renderRequiredOres } = await import('../../js/components/equipment/requiredOresDisplay.js');

describe('Equipment & Home Required Ores Display Animation Suite', () => {
    let eqShinyEl, eqGlowyEl, eqStarryEl;
    let homeShinyEl, homeGlowyEl, homeStarryEl;

    beforeEach(() => {
        eqShinyEl = createMockElement('eq-shiny-ore-result');
        eqGlowyEl = createMockElement('eq-glowy-ore-result');
        eqStarryEl = createMockElement('eq-starry-ore-result');

        homeShinyEl = createMockElement('home-result-quantity-shiny');
        homeGlowyEl = createMockElement('home-result-quantity-glowy');
        homeStarryEl = createMockElement('home-result-quantity-starry');

        dom.equipment = {
            results: {
                quantity: {
                    shiny: eqShinyEl,
                    glowy: eqGlowyEl,
                    starry: eqStarryEl
                }
            }
        };

        dom.income = {
            home: {
                results: {
                    quantity: {
                        shiny: homeShinyEl,
                        glowy: homeGlowyEl,
                        starry: homeStarryEl
                    }
                }
            }
        };
    });

    describe('Initial Value Rendering & State Tracking', () => {
        test('formats integer values and assigns _currentNumericValue on first render', () => {
            renderRequiredOres({
                shiny: 12000,
                glowy: 2400,
                starry: 180
            });

            assert.equal(eqShinyEl.textContent, '12,000');
            assert.equal(eqShinyEl._currentNumericValue, 12000);
            assert.equal(eqGlowyEl.textContent, '2,400');
            assert.equal(eqGlowyEl._currentNumericValue, 2400);
            assert.equal(eqStarryEl.textContent, '180');
            assert.equal(eqStarryEl._currentNumericValue, 180);

            assert.equal(homeShinyEl.textContent, '12,000');
            assert.equal(homeShinyEl._currentNumericValue, 12000);
            assert.equal(homeGlowyEl.textContent, '2,400');
            assert.equal(homeGlowyEl._currentNumericValue, 2400);
            assert.equal(homeStarryEl.textContent, '180');
        });

        test('rounds floating point inputs to nearest integer', () => {
            renderRequiredOres({
                shiny: 1234.56,
                glowy: 789.4,
                starry: 45.9
            });

            assert.equal(eqShinyEl._currentNumericValue, 1235);
            assert.equal(eqShinyEl.textContent, '1,235');
            assert.equal(eqGlowyEl._currentNumericValue, 789);
            assert.equal(eqGlowyEl.textContent, '789');
            assert.equal(eqStarryEl._currentNumericValue, 46);
            assert.equal(eqStarryEl.textContent, '46');
        });
    });

    describe('Numeric Transitions and Re-renders', () => {
        test('smoothly transitions values from initial to new target values', () => {
            renderRequiredOres({
                shiny: 5000,
                glowy: 600,
                starry: 50
            });

            assert.equal(eqShinyEl._currentNumericValue, 5000);
            assert.equal(eqGlowyEl._currentNumericValue, 600);
            assert.equal(eqStarryEl._currentNumericValue, 50);

            renderRequiredOres({
                shiny: 25000,
                glowy: 3500,
                starry: 400
            });

            assert.equal(eqShinyEl._currentNumericValue, 25000);
            assert.equal(eqShinyEl.textContent, '25,000');
            assert.equal(eqGlowyEl._currentNumericValue, 3500);
            assert.equal(eqGlowyEl.textContent, '3,500');
            assert.equal(eqStarryEl._currentNumericValue, 400);
            assert.equal(eqStarryEl.textContent, '400');

            assert.equal(homeShinyEl._currentNumericValue, 25000);
            assert.equal(homeShinyEl.textContent, '25,000');
            assert.equal(homeGlowyEl._currentNumericValue, 3500);
            assert.equal(homeGlowyEl.textContent, '3,500');
            assert.equal(homeStarryEl._currentNumericValue, 400);
            assert.equal(homeStarryEl.textContent, '400');
        });

        test('transitions to zero when all required ores are cleared', () => {
            renderRequiredOres({
                shiny: 10000,
                glowy: 1000,
                starry: 100
            });

            renderRequiredOres({
                shiny: 0,
                glowy: 0,
                starry: 0
            });

            assert.equal(eqShinyEl._currentNumericValue, 0);
            assert.equal(eqShinyEl.textContent, '0');
            assert.equal(eqGlowyEl._currentNumericValue, 0);
            assert.equal(eqGlowyEl.textContent, '0');
            assert.equal(eqStarryEl._currentNumericValue, 0);
            assert.equal(eqStarryEl.textContent, '0');

            assert.equal(homeShinyEl._currentNumericValue, 0);
            assert.equal(homeShinyEl.textContent, '0');
            assert.equal(homeGlowyEl._currentNumericValue, 0);
            assert.equal(homeGlowyEl.textContent, '0');
            assert.equal(homeStarryEl._currentNumericValue, 0);
            assert.equal(homeStarryEl.textContent, '0');
        });
    });

    describe('Dual-Tab Synchronization', () => {
        test('keeps Equipment tab and Home tab results cards perfectly synchronized', () => {
            const dataSets = [
                { shiny: 35000, glowy: 4200, starry: 360 },
                { shiny: 18000, glowy: 2000, starry: 150 },
                { shiny: 95000, glowy: 8400, starry: 720 }
            ];

            for (const data of dataSets) {
                renderRequiredOres(data);

                assert.equal(eqShinyEl.textContent, homeShinyEl.textContent);
                assert.equal(eqShinyEl._currentNumericValue, homeShinyEl._currentNumericValue);

                assert.equal(eqGlowyEl.textContent, homeGlowyEl.textContent);
                assert.equal(eqGlowyEl._currentNumericValue, homeGlowyEl._currentNumericValue);

                assert.equal(eqStarryEl.textContent, homeStarryEl.textContent);
                assert.equal(eqStarryEl._currentNumericValue, homeStarryEl._currentNumericValue);
            }
        });
    });

    describe('Boundary, Partial & Null Safety', () => {
        test('handles undefined argument gracefully defaulting to 0', () => {
            assert.doesNotThrow(() => {
                renderRequiredOres(undefined);
            });

            assert.equal(eqShinyEl._currentNumericValue, 0);
            assert.equal(eqShinyEl.textContent, '0');
            assert.equal(eqGlowyEl._currentNumericValue, 0);
            assert.equal(eqGlowyEl.textContent, '0');
            assert.equal(eqStarryEl._currentNumericValue, 0);
            assert.equal(eqStarryEl.textContent, '0');
        });

        test('handles null argument gracefully defaulting to 0', () => {
            assert.doesNotThrow(() => {
                renderRequiredOres(null);
            });

            assert.equal(eqShinyEl._currentNumericValue, 0);
            assert.equal(eqShinyEl.textContent, '0');
            assert.equal(eqGlowyEl._currentNumericValue, 0);
            assert.equal(eqGlowyEl.textContent, '0');
            assert.equal(eqStarryEl._currentNumericValue, 0);
            assert.equal(eqStarryEl.textContent, '0');
        });

        test('handles empty object gracefully defaulting each ore to 0', () => {
            assert.doesNotThrow(() => {
                renderRequiredOres({});
            });

            assert.equal(eqShinyEl._currentNumericValue, 0);
            assert.equal(eqShinyEl.textContent, '0');
            assert.equal(eqGlowyEl._currentNumericValue, 0);
            assert.equal(eqGlowyEl.textContent, '0');
            assert.equal(eqStarryEl._currentNumericValue, 0);
            assert.equal(eqStarryEl.textContent, '0');
        });

        test('handles partial ore objects with missing keys', () => {
            renderRequiredOres({
                shiny: 8000
            });

            assert.equal(eqShinyEl._currentNumericValue, 8000);
            assert.equal(eqShinyEl.textContent, '8,000');
            assert.equal(eqGlowyEl._currentNumericValue, 0);
            assert.equal(eqGlowyEl.textContent, '0');
            assert.equal(eqStarryEl._currentNumericValue, 0);
            assert.equal(eqStarryEl.textContent, '0');
        });

        test('handles negative ore values safely', () => {
            renderRequiredOres({
                shiny: -100,
                glowy: -50,
                starry: 0
            });

            assert.equal(eqShinyEl._currentNumericValue, -100);
            assert.equal(eqGlowyEl._currentNumericValue, -50);
            assert.equal(eqStarryEl._currentNumericValue, 0);
        });
    });

    describe('DOM Resiliency & Missing Nodes', () => {
        test('handles completely undefined dom.equipment gracefully', () => {
            dom.equipment = undefined;

            assert.doesNotThrow(() => {
                renderRequiredOres({ shiny: 1000, glowy: 200, starry: 20 });
            });

            assert.equal(homeShinyEl._currentNumericValue, 1000);
            assert.equal(homeShinyEl.textContent, '1,000');
        });

        test('handles completely undefined dom.income gracefully', () => {
            dom.income = undefined;

            assert.doesNotThrow(() => {
                renderRequiredOres({ shiny: 1000, glowy: 200, starry: 20 });
            });

            assert.equal(eqShinyEl._currentNumericValue, 1000);
            assert.equal(eqShinyEl.textContent, '1,000');
        });

        test('handles partial missing ore elements in equipment results', () => {
            dom.equipment.results.quantity.glowy = null;

            assert.doesNotThrow(() => {
                renderRequiredOres({ shiny: 3000, glowy: 500, starry: 40 });
            });

            assert.equal(eqShinyEl._currentNumericValue, 3000);
            assert.equal(eqStarryEl._currentNumericValue, 40);
            assert.equal(homeGlowyEl._currentNumericValue, 500);
        });

        test('handles both dom trees being undefined simultaneously', () => {
            dom.equipment = undefined;
            dom.income = undefined;

            assert.doesNotThrow(() => {
                renderRequiredOres({ shiny: 5000, glowy: 800, starry: 80 });
            });
        });
    });
});
