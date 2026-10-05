import { test, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
        location: { hostname: 'localhost' }
    };
}

if (typeof globalThis.requestAnimationFrame === 'undefined') {
    globalThis.requestAnimationFrame = (cb) => { cb(); return 1; };
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

class MockClassList {
    constructor(initial = '') {
        this._classes = new Set(initial ? initial.split(/\s+/).filter(Boolean) : []);
    }
    add(...tokens) {
        tokens.forEach(t => { if (t) this._classes.add(t); });
    }
    remove(...tokens) {
        tokens.forEach(t => this._classes.delete(t));
    }
    contains(token) {
        return this._classes.has(token);
    }
    toggle(token, force) {
        if (typeof force === 'boolean') {
            if (force) this.add(token);
            else this.remove(token);
            return force;
        }
        if (this.contains(token)) {
            this.remove(token);
            return false;
        }
        this.add(token);
        return true;
    }
    get length() {
        return this._classes.size;
    }
    toString() {
        return Array.from(this._classes).join(' ');
    }
}

function matchesSelector(element, selector) {
    if (!selector || !element) return false;
    const s = selector.trim();

    if (s.includes(',')) {
        return s.split(',').some(sub => matchesSelector(element, sub.trim()));
    }

    let remaining = s;
    const tagMatch = remaining.match(/^[a-zA-Z0-9_-]+/);
    if (tagMatch) {
        const tag = tagMatch[0].toUpperCase();
        remaining = remaining.slice(tag.length);
        if (element.tagName !== tag) return false;
    }

    while (remaining.length > 0) {
        if (remaining.startsWith('.')) {
            const classMatch = remaining.match(/^\.([a-zA-Z0-9_-]+)/);
            if (!classMatch) return false;
            if (!element.classList.contains(classMatch[1])) return false;
            remaining = remaining.slice(classMatch[0].length);
        } else if (remaining.startsWith('#')) {
            const idMatch = remaining.match(/^#([a-zA-Z0-9_-]+)/);
            if (!idMatch) return false;
            if (element.id !== idMatch[1]) return false;
            remaining = remaining.slice(idMatch[0].length);
        } else if (remaining.startsWith('[')) {
            const attrMatch = remaining.match(/^\[([a-zA-Z0-9_-]+)(?:([*^$]?=)(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/);
            if (!attrMatch) return false;
            const attrName = attrMatch[1];
            const op = attrMatch[2];
            const attrVal = attrMatch[3] ?? attrMatch[4] ?? attrMatch[5];

            let actualVal = null;
            if (attrName === 'id') actualVal = element.id;
            else if (attrName === 'class') actualVal = element.className;
            else if (attrName === 'type') actualVal = element.type;
            else if (attrName.startsWith('data-')) {
                const dataKey = attrName.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
                actualVal = element.dataset[dataKey];
            } else {
                actualVal = element.getAttribute(attrName);
            }

            if (op === undefined) {
                if (actualVal === null || actualVal === undefined) return false;
            } else if (op === '=') {
                if (String(actualVal) !== String(attrVal)) return false;
            } else if (op === '^=') {
                if (!String(actualVal).startsWith(String(attrVal))) return false;
            } else if (op === '$=') {
                if (!String(actualVal).endsWith(String(attrVal))) return false;
            } else if (op === '*=') {
                if (!String(actualVal).includes(String(attrVal))) return false;
            }
            remaining = remaining.slice(attrMatch[0].length);
        } else {
            break;
        }
    }
    return true;
}

function querySelectorAllInternal(node, selector) {
    const results = [];
    const search = (curr) => {
        if (!curr || !curr.children) return;
        for (const child of curr.children) {
            if (matchesSelector(child, selector)) {
                results.push(child);
            }
            search(child);
        }
    };
    search(node);
    return results;
}

function querySelectorInternal(node, selector) {
    const all = querySelectorAllInternal(node, selector);
    return all.length > 0 ? all[0] : null;
}

class MockDOMElement {
    constructor(tagName = 'div', id = '', className = '') {
        this.tagName = tagName.toUpperCase();
        this.id = id;
        this._className = className;
        this.classList = new MockClassList(className);
        this.children = [];
        this.parentNode = null;
        this.attributes = new Map();
        this.style = {};
        this.dataset = {};
        this._innerHTML = '';
        this.textContent = '';
        this.value = '';
        this.type = 'text';
        this.checked = false;
        this.disabled = false;
        this.eventListeners = new Map();

        if (id) this.attributes.set('id', id);
        if (className) this.attributes.set('class', className);
    }

    get className() {
        return this.classList ? this.classList.toString() : this._className;
    }

    set className(value) {
        this._className = String(value || '');
        this.classList = new MockClassList(this._className);
        this.attributes.set('class', this._className);
    }

    get innerHTML() {
        return this._innerHTML;
    }

    set innerHTML(value) {
        this._innerHTML = String(value || '');
        if (this._innerHTML === '') {
            this.children = [];
        }
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
        if (name === 'id') this.id = String(value);
        if (name === 'class') {
            this.className = String(value);
        }
        if (name.startsWith('data-')) {
            const dataKey = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
            this.dataset[dataKey] = String(value);
        }
    }

    getAttribute(name) {
        if (name === 'class') return this.className;
        return this.attributes.get(name) || null;
    }

    removeAttribute(name) {
        this.attributes.delete(name);
        if (name === 'id') this.id = '';
        if (name === 'class') {
            this.className = '';
        }
        if (name.startsWith('data-')) {
            const dataKey = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
            delete this.dataset[dataKey];
        }
    }

    appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
    }

    removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx !== -1) {
            this.children.splice(idx, 1);
            child.parentNode = null;
        }
        return child;
    }

    querySelector(selector) {
        return querySelectorInternal(this, selector);
    }

    querySelectorAll(selector) {
        return querySelectorAllInternal(this, selector);
    }

    addEventListener(event, handler) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(handler);
    }

    removeEventListener(event, handler) {
        if (this.eventListeners.has(event)) {
            const list = this.eventListeners.get(event);
            const idx = list.indexOf(handler);
            if (idx !== -1) list.splice(idx, 1);
        }
    }

    dispatchEvent(evt) {
        const eventType = typeof evt === 'string' ? evt : (evt.type || 'click');
        const handlers = this.eventListeners.get(eventType) || [];
        const eventObj = typeof evt === 'string' ? { type: evt, target: this, preventDefault: () => {} } : evt;
        handlers.forEach(fn => fn.call(this, eventObj));
        return true;
    }
}

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        createElement(tagName) {
            return new MockDOMElement(tagName);
        },
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() { return true; }
    };
} else {
    globalThis.document.createElement = (tagName) => new MockDOMElement(tagName);
}

const stateModule = await import('../../js/core/state.js');
const { initializeState } = stateModule;
const { dom } = await import('../../js/dom/domElements.js');
const { loadTranslations } = await import('../../js/i18n/translator.js');
const { renderShopOfferGrid, renderShopOfferSelector, renderShopOfferSelectorContent } = await import('../../js/components/income/shopOffersDisplay.js');
const { resolveBestMatchShopOfferSet } = await import('../../js/data/incomeSources/shopOffers.js');

await loadTranslations('en');

describe('Shop Offers TH Set Switching & Dynamic Grid Rendering Suite', () => {
    let mockContainer;
    let mockDropdown;

    beforeEach(() => {
        mockContainer = new MockDOMElement('div', 'shop-offers-checkboxes-container', 'shop-offers-container');
        mockDropdown = new MockDOMElement('select', 'shop-offers-dropdown', 'shop-offers-select');

        if (!dom.income) dom.income = {};
        if (!dom.income.shopOffers) dom.income.shopOffers = {};
        dom.income.shopOffers.checkboxes = mockContainer;
        dom.income.shopOffers.dropdown = mockDropdown;

        stateModule.state.savedPlayerTags = ['#PLAYER1'];
        stateModule.state.uiSettings = {
            language: 'en',
            currency: { code: 'USD' }
        };
        stateModule.state.allPlayersData = {
            '#PLAYER1': {
                playerProfile: { name: 'Test Player', townHallLevel: 16 },
                currency: { globalPricing: {} }
            }
        };
        stateModule.state.income = {
            shopOffers: {
                selectedSet: 'newSet',
                newSet: {},
                '0': {}
            }
        };
    });

    test('renderShopOfferSelectorContent populates only active sets and filters out disabled TH sets', () => {
        renderShopOfferSelectorContent();
        const options = mockDropdown.children;
        assert.equal(options.length, 2);

        const optionValues = options.map(opt => opt.value);
        assert.ok(optionValues.includes('0'));
        assert.ok(optionValues.includes('newSet'));
        assert.ok(!optionValues.includes('16'));
        assert.ok(!optionValues.includes('14'));
        assert.ok(!optionValues.includes('11'));
        assert.ok(!optionValues.includes('8'));

        const newSetOpt = options.find(opt => opt.value === 'newSet');
        assert.equal(newSetOpt.dataset.i18n, 'views.income.shopOffers.newSet');
        assert.equal(newSetOpt.textContent, 'New Set');
    });

    test('renders 4 rows with newSet quantities, tier pricing, and dataset.renderedSet = "newSet"', () => {
        renderShopOfferGrid(stateModule.state.income.shopOffers);

        assert.equal(mockContainer.dataset.renderedSet, 'newSet');
        const rows = mockContainer.querySelectorAll('.offer-grid-row');
        assert.equal(rows.length, 4);

        rows.forEach(row => {
            const costEl = row.querySelector('.offer-cost-display');
            assert.ok(costEl);
            assert.ok(costEl.classList.contains('offer-cost-display'));
        });

        // Row 0: shiny_large (15,000 ores, tier10 -> $9.99 USD)
        assert.ok(rows[0].querySelector('.offer-ore-display').innerHTML.includes('15,000'));
        assert.ok(rows[0].querySelector('.offer-cost-display').innerHTML.includes('9.99'));

        // Row 1: starry (90 ores, tier5 -> $4.99 USD)
        assert.ok(rows[1].querySelector('.offer-ore-display').innerHTML.includes('90'));
        assert.ok(rows[1].querySelector('.offer-cost-display').innerHTML.includes('4.99'));

        // Row 2: glowy (900 ores, tier5 -> $4.99 USD)
        assert.ok(rows[2].querySelector('.offer-ore-display').innerHTML.includes('900'));
        assert.ok(rows[2].querySelector('.offer-cost-display').innerHTML.includes('4.99'));

        // Row 3: shiny_small (7,500 ores, tier5 -> $4.99 USD)
        assert.ok(rows[3].querySelector('.offer-ore-display').innerHTML.includes('7,500'));
        assert.ok(rows[3].querySelector('.offer-cost-display').innerHTML.includes('4.99'));
    });

    test('clears grid and updates dataset.renderedSet to "0" when switching to None (0)', async () => {
        renderShopOfferGrid(stateModule.state.income.shopOffers);
        assert.equal(mockContainer.querySelectorAll('.offer-grid-row').length, 4);

        stateModule.state.income.shopOffers.selectedSet = 0;
        renderShopOfferGrid(stateModule.state.income.shopOffers);

        assert.equal(mockContainer.dataset.renderedSet, '0');

        await new Promise(resolve => setTimeout(resolve, 250));

        const rows = mockContainer.querySelectorAll('.offer-grid-row');
        assert.equal(rows.length, 0);

        stateModule.state.income.shopOffers.selectedSet = '0';
        renderShopOfferGrid(stateModule.state.income.shopOffers);
        await new Promise(resolve => setTimeout(resolve, 250));
        assert.equal(mockContainer.querySelectorAll('.offer-grid-row').length, 0);
        assert.equal(mockContainer.innerHTML.includes('NaN'), false);

        stateModule.state.income.shopOffers.selectedSet = null;
        renderShopOfferGrid(stateModule.state.income.shopOffers);
        await new Promise(resolve => setTimeout(resolve, 250));
        assert.equal(mockContainer.innerHTML.includes('NaN'), false);
    });

    test('re-renders grid with 4 rows when switching from None back to newSet', () => {
        stateModule.state.income.shopOffers.selectedSet = 0;
        renderShopOfferGrid(stateModule.state.income.shopOffers);
        assert.equal(mockContainer.querySelectorAll('.offer-grid-row').length, 0);

        stateModule.state.income.shopOffers.selectedSet = 'newSet';
        renderShopOfferGrid(stateModule.state.income.shopOffers);
        assert.equal(mockContainer.dataset.renderedSet, 'newSet');
        assert.equal(mockContainer.querySelectorAll('.offer-grid-row').length, 4);
    });

    test('performs fast in-place DOM updates when remaining in newSet', () => {
        renderShopOfferGrid(stateModule.state.income.shopOffers);
        const initialRows = mockContainer.querySelectorAll('.offer-grid-row');
        assert.equal(initialRows.length, 4);

        stateModule.state.income.shopOffers['newSet'] = {
            glowy: 2,
            starry: 1
        };

        renderShopOfferGrid(stateModule.state.income.shopOffers);

        const currentRows = mockContainer.querySelectorAll('.offer-grid-row');
        assert.equal(currentRows.length, 4);
        assert.strictEqual(currentRows[0], initialRows[0]);
        assert.strictEqual(currentRows[1], initialRows[1]);

        const glowyCb1 = mockContainer.querySelector('input[type="checkbox"][data-offer-id="glowy"][data-instance="1"]');
        const glowyCb2 = mockContainer.querySelector('input[type="checkbox"][data-offer-id="glowy"][data-instance="2"]');
        const starryCb1 = mockContainer.querySelector('input[type="checkbox"][data-offer-id="starry"][data-instance="1"]');
        const starryCb2 = mockContainer.querySelector('input[type="checkbox"][data-offer-id="starry"][data-instance="2"]');

        assert.equal(glowyCb1.checked, true);
        assert.equal(glowyCb2.checked, true);
        assert.equal(starryCb1.checked, true);
        assert.equal(starryCb2.checked, false);

        const glowySelect = mockContainer.querySelector('select[data-offer-id="glowy"]');
        const starrySelect = mockContainer.querySelector('select[data-offer-id="starry"]');
        assert.equal(glowySelect.value, 2);
        assert.equal(starrySelect.value, 1);
    });

    test('updates cost displays in-place when currency changes within newSet', () => {
        renderShopOfferGrid(stateModule.state.income.shopOffers);
        const rowsUSD = mockContainer.querySelectorAll('.offer-grid-row');
        assert.ok(rowsUSD[0].querySelector('.offer-cost-display').innerHTML.includes('$ 9.99'));

        stateModule.state.uiSettings.currency.code = 'EUR';
        renderShopOfferGrid(stateModule.state.income.shopOffers);

        const rowsEUR = mockContainer.querySelectorAll('.offer-grid-row');
        assert.strictEqual(rowsEUR[0], rowsUSD[0]);
        // shiny_large tier10 in EUR is € 11.99, tier5 in EUR is € 5.99
        assert.ok(rowsEUR[0].querySelector('.offer-cost-display').innerHTML.includes('€ 11.99'));
        assert.ok(rowsEUR[1].querySelector('.offer-cost-display').innerHTML.includes('€ 5.99'));
        assert.ok(rowsEUR[2].querySelector('.offer-cost-display').innerHTML.includes('€ 5.99'));
        assert.ok(rowsEUR[3].querySelector('.offer-cost-display').innerHTML.includes('€ 5.99'));
    });

    test('renderShopOfferSelector syncs dropdown selector value accurately', () => {
        stateModule.state.income.shopOffers.selectedSet = 'newSet';
        renderShopOfferSelector(stateModule.state.income.shopOffers);
        assert.equal(mockDropdown.value, 'newSet');

        stateModule.state.income.shopOffers.selectedSet = 0;
        renderShopOfferSelector(stateModule.state.income.shopOffers);
        assert.equal(mockDropdown.value, '0');

        stateModule.state.income.shopOffers.selectedSet = '0';
        renderShopOfferSelector(stateModule.state.income.shopOffers);
        assert.equal(mockDropdown.value, '0');
    });

    test('resolveBestMatchShopOfferSet prioritizes newSet across all Town Halls', () => {
        assert.equal(resolveBestMatchShopOfferSet(16), 'newSet');
        assert.equal(resolveBestMatchShopOfferSet(14), 'newSet');
        assert.equal(resolveBestMatchShopOfferSet(9), 'newSet');
        assert.equal(resolveBestMatchShopOfferSet(1), 'newSet');
        assert.equal(resolveBestMatchShopOfferSet(undefined), 'newSet');
    });

    test('initializeState automatically migrates disabled sets in localStorage to newSet', () => {
        const persistedState = {
            savedPlayerTags: ['#TAG_LEGACY'],
            allPlayersData: {
                '#TAG_LEGACY': {
                    playerProfile: { name: 'Legacy Player', townHallLevel: 14 },
                    income: {
                        shopOffers: {
                            selectedSet: 14,
                            '14': { glowy: 1 }
                        }
                    }
                }
            }
        };

        initializeState(persistedState);

        const legacyPlayer = stateModule.state.allPlayersData['#TAG_LEGACY'];
        assert.equal(legacyPlayer.income.shopOffers.selectedSet, 'newSet');
        assert.ok(legacyPlayer.income.shopOffers['newSet']);
    });

    test('initializeState preserves explicit None (0) selection from localStorage', () => {
        const persistedState = {
            savedPlayerTags: ['#TAG_NONE'],
            allPlayersData: {
                '#TAG_NONE': {
                    playerProfile: { name: 'None Player', townHallLevel: 16 },
                    income: {
                        shopOffers: {
                            selectedSet: '0',
                            '0': {}
                        }
                    }
                }
            }
        };

        initializeState(persistedState);

        const nonePlayer = stateModule.state.allPlayersData['#TAG_NONE'];
        assert.equal(nonePlayer.income.shopOffers.selectedSet, '0');
    });
});
