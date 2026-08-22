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
        requestAnimationFrame: (cb) => { cb(); return 1; },
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
        globalThis.window.requestAnimationFrame = (cb) => { cb(); return 1; };
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

const domElementsStore = new Map();

function createMockElement(tagName = 'div', id = '', className = '') {
    const attributes = new Map();
    const classListSet = new Set(className ? className.split(/\s+/).filter(Boolean) : []);

    const el = {
        tagName: tagName.toUpperCase(),
        id,
        className,
        isConnected: true,
        classList: {
            add: (...tokens) => tokens.forEach(t => classListSet.add(t)),
            remove: (...tokens) => tokens.forEach(t => classListSet.delete(t)),
            contains: (t) => classListSet.has(t),
            toggle: (t, force) => {
                if (typeof force === 'boolean') {
                    if (force) classListSet.add(t);
                    else classListSet.delete(t);
                    return force;
                }
                if (classListSet.has(t)) {
                    classListSet.delete(t);
                    return false;
                }
                classListSet.add(t);
                return true;
            }
        },
        children: [],
        parentElement: null,
        parentNode: null,
        style: {},
        dataset: {},
        textContent: '',
        value: '',
        checked: false,
        disabled: false,
        _innerHTML: '',
        get innerHTML() {
            return this._innerHTML;
        },
        set innerHTML(val) {
            this._innerHTML = String(val || '');
            if (this._innerHTML === '') {
                this.children = [];
            }
        },
        setAttribute(k, v) { attributes.set(k, String(v)); },
        getAttribute(k) { return attributes.get(k); },
        hasAttribute(k) { return attributes.has(k); },
        removeAttribute(k) { attributes.delete(k); },
        appendChild(child) {
            child.parentNode = this;
            child.parentElement = this;
            this.children.push(child);
            return child;
        },
        removeChild(child) {
            const idx = this.children.indexOf(child);
            if (idx !== -1) {
                this.children.splice(idx, 1);
                child.parentNode = null;
                child.parentElement = null;
            }
            return child;
        },
        querySelector(selector) {
            if (selector.startsWith('#')) {
                const searchId = selector.slice(1);
                return domElementsStore.get(searchId) || null;
            }
            if (selector.startsWith('.')) {
                const searchClass = selector.slice(1);
                return this.children.find(c => c.classList?.contains(searchClass)) || null;
            }
            return null;
        },
        querySelectorAll(selector) {
            if (selector.startsWith('.')) {
                const searchClass = selector.slice(1);
                return this.children.filter(c => c.classList?.contains(searchClass));
            }
            return [];
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true
    };

    if (id) {
        domElementsStore.set(id, el);
    }
    return el;
}

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        getElementById: (id) => domElementsStore.get(id) || null,
        querySelector: (sel) => {
            if (sel.startsWith('#')) return domElementsStore.get(sel.slice(1)) || null;
            return null;
        },
        querySelectorAll: () => [],
        createElement: (tag) => createMockElement(tag),
        body: createMockElement('body', 'body'),
        documentElement: createMockElement('html', 'html'),
        addEventListener: () => {},
        removeEventListener: () => {}
    };
} else {
    const origGetElementById = globalThis.document.getElementById;
    globalThis.document.getElementById = (id) => domElementsStore.get(id) || (origGetElementById ? origGetElementById.call(globalThis.document, id) : null);
}

const { currencyData } = await import('../../js/data/pricingData.js');
const { getCurrencySymbol } = await import('../../js/utils/incomeUtils.js');
const { dom } = await import('../../js/dom/domElements.js');
const { renderIncomeCard } = await import('../../js/components/income/incomeCardHandler.js');

describe('Multi-Character Currency Symbol Spacing & Resource Display Alignment Suite', () => {
    describe('getCurrencySymbol Helper Mappings', () => {
        test('resolves standard single-character and multi-character currency symbols accurately', () => {
            const testCases = [
                { code: 'USD', expected: '$' },
                { code: 'EUR', expected: '€' },
                { code: 'GBP', expected: '£' },
                { code: 'AUD', expected: 'AU$' },
                { code: 'CAD', expected: 'CA$' },
                { code: 'CHF', expected: '₣' },
                { code: 'CNY', expected: '¥' },
                { code: 'INR', expected: '₹' },
                { code: 'JPY', expected: '¥' },
                { code: 'NZD', expected: 'NZ$' },
                { code: 'TRY', expected: '₺' }
            ];

            for (const { code, expected } of testCases) {
                assert.equal(getCurrencySymbol(code), expected, `getCurrencySymbol("${code}") should return "${expected}"`);
            }
        });

        test('falls back to "$" when given an unknown or undefined currency code', () => {
            assert.equal(getCurrencySymbol('UNKNOWN'), '$');
            assert.equal(getCurrencySymbol(undefined), '$');
            assert.equal(getCurrencySymbol(''), '$');
        });
    });

    describe('Home Tab DOM Currency Rendering Across All Supported Currencies', () => {
        let mockMoneySymbol;
        let mockMoneyValue;

        beforeEach(() => {
            domElementsStore.clear();

            const mockTimeframeSelect = createMockElement('select', 'home-income-timeframe-select');
            const mockTotalShiny = createMockElement('div', 'home-income-table-total-shiny');
            const mockTotalGlowy = createMockElement('div', 'home-income-table-total-glowy');
            const mockTotalStarry = createMockElement('div', 'home-income-table-total-starry');

            mockMoneySymbol = createMockElement('span', 'home-money-symbol', 'currency-symbol');
            mockMoneyValue = createMockElement('span', 'home-money-value', 'calculated');

            dom.income = {
                home: {
                    incomeCard: {
                        timeframe: mockTimeframeSelect,
                        table: {
                            totalRow: {
                                shiny: mockTotalShiny,
                                glowy: mockTotalGlowy,
                                starry: mockTotalStarry
                            }
                        },
                        resources: {
                            moneyValue: mockMoneyValue,
                            moneySymbol: mockMoneySymbol
                        }
                    }
                }
            };
        });

        const currencies = Object.keys(currencyData);

        currencies.forEach((code) => {
            test(`renderIncomeCard updates home-money-symbol and home-money-value for ${code} (${currencyData[code].symbol})`, () => {
                const totalIncome = { shiny: 5000, glowy: 250, starry: 15 };
                const uiSettings = { summaryTimeframe: 'monthly', currency: { code } };
                const totalMoneyCost = { [code]: 19.99, USD: 19.99 };

                renderIncomeCard(totalIncome, uiSettings, totalMoneyCost);

                assert.equal(mockMoneySymbol.textContent, currencyData[code].symbol, `Home money symbol must match ${code} symbol`);
                assert.equal(mockMoneyValue.textContent, '19.99', `Home money value must match formatted cost for ${code}`);
            });
        });

        test('renderIncomeCard handles multi-character currency symbols (e.g. AUD, CAD, NZD) properly', () => {
            const multiCharCurrencies = [
                { code: 'AUD', symbol: 'AU$', cost: 29.99 },
                { code: 'CAD', symbol: 'CA$', cost: 28.50 },
                { code: 'NZD', symbol: 'NZ$', cost: 32.00 }
            ];

            for (const { code, symbol, cost } of multiCharCurrencies) {
                const totalIncome = { shiny: 12000, glowy: 600, starry: 40 };
                const uiSettings = { summaryTimeframe: 'monthly', currency: { code } };
                const totalMoneyCost = { [code]: cost };

                renderIncomeCard(totalIncome, uiSettings, totalMoneyCost);

                assert.equal(mockMoneySymbol.textContent, symbol, `Multi-character symbol for ${code} must be set to ${symbol}`);
                assert.equal(mockMoneyValue.textContent, cost.toFixed(2), `Money value for ${code} must format to ${cost.toFixed(2)}`);
            }
        });
    });
});
