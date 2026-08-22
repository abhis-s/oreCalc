import { test, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

if (typeof globalThis.HTMLElement === 'undefined') {
    globalThis.HTMLElement = class {};
}

if (typeof globalThis.customElements === 'undefined') {
    globalThis.customElements = {
        get: () => null,
        define: () => {}
    };
}

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
        this.disabled = false;
        this.eventListeners = new Map();
        this.onclick = null;

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

    get nextSibling() {
        if (!this.parentNode) return null;
        const idx = this.parentNode.children.indexOf(this);
        if (idx === -1 || idx === this.parentNode.children.length - 1) return null;
        return this.parentNode.children[idx + 1];
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
    }

    hasAttribute(name) {
        return this.attributes.has(name);
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
        const eventType = typeof evt === 'string' ? evt : (evt.type || '');
        const handlers = this.eventListeners.get(eventType) || [];
        handlers.forEach(fn => fn(evt));
        if (eventType === 'click' && typeof this.onclick === 'function') {
            this.onclick(evt);
        }
        return true;
    }

    click() {
        const evt = {
            type: 'click',
            target: this,
            preventDefault: () => {},
            stopPropagation: () => {}
        };
        this.dispatchEvent(evt);
    }
}

function matchesSelector(element, selector) {
    if (!element || !selector) return false;
    const s = selector.trim();
    if (s.startsWith('#')) {
        return element.id === s.slice(1);
    }
    if (s.startsWith('.')) {
        const classNames = s.split('.').filter(Boolean);
        return classNames.every(c => element.classList.contains(c));
    }
    if (s.toUpperCase() === element.tagName) {
        return true;
    }
    return false;
}

function querySelectorInternal(root, selector) {
    const all = querySelectorAllInternal(root, selector);
    return all.length > 0 ? all[0] : null;
}

function querySelectorAllInternal(root, selector) {
    const results = [];
    const search = (node) => {
        node.children.forEach(child => {
            if (matchesSelector(child, selector)) {
                results.push(child);
            }
            search(child);
        });
    };
    search(root);
    return results;
}

const mockDocumentBody = new MockDOMElement('body', 'body');
const elementsById = new Map();

const mockWindow = {
    addEventListener: () => {},
    removeEventListener: () => {},
    requestAnimationFrame: (cb) => { cb(); return 1; },
    cancelAnimationFrame: () => {},
    scrollTo: () => {},
    location: { hostname: 'localhost' },
    __ENV__: { APP_VERSION: '2.1.0', VITE_API_BASE_URL: 'https://api.orecalc.tech' }
};

if (typeof globalThis.window === 'undefined') {
    globalThis.window = mockWindow;
}
if (typeof global.window === 'undefined') {
    global.window = mockWindow;
}

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        body: mockDocumentBody,
        createElement: (tag) => new MockDOMElement(tag),
        getElementById: (id) => elementsById.get(id) || null,
        querySelector: (sel) => querySelectorInternal(mockDocumentBody, sel),
        querySelectorAll: (sel) => querySelectorAllInternal(mockDocumentBody, sel),
        addEventListener: () => {},
        removeEventListener: () => {}
    };
} else {
    globalThis.document.getElementById = (id) => elementsById.get(id) || null;
    globalThis.document.querySelector = (sel) => querySelectorInternal(mockDocumentBody, sel);
    globalThis.document.querySelectorAll = (sel) => querySelectorAllInternal(mockDocumentBody, sel);
    globalThis.document.createElement = (tag) => new MockDOMElement(tag);
}

if (typeof globalThis.sessionStorage === 'undefined') {
    const store = new Map();
    globalThis.sessionStorage = {
        getItem: (k) => store.get(k) || null,
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear()
    };
}

if (typeof globalThis.localStorage === 'undefined') {
    const localStore = new Map();
    globalThis.localStorage = {
        getItem: (k) => localStore.get(k) || null,
        setItem: (k, v) => localStore.set(k, String(v)),
        removeItem: (k) => localStore.delete(k),
        clear: () => localStore.clear()
    };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));
const deJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/de.json'), 'utf8'));

const { state } = await import('../../js/core/state.js');
const { loadTranslations } = await import('../../js/i18n/translator.js');
const { formatInvoiceMonth, renderRunningCostsData } = await import('../../js/components/appSettings/settingsModals.js');

describe('Project Running Costs Modal Breakdown & Accordion Recovery Suite', () => {
    beforeEach(async () => {
        elementsById.clear();
        mockDocumentBody.children = [];

        globalThis.fetch = async (url) => {
            if (url.includes('/en.json')) return { ok: true, json: async () => enJson };
            if (url.includes('/de.json')) return { ok: true, json: async () => deJson };
            return { ok: false, status: 404 };
        };

        state.uiSettings = { language: 'en' };
        await loadTranslations('en');
    });

    describe('formatInvoiceMonth', () => {
        test('accurately formats ISO dashed month (e.g. "2026-07") into English and German', async () => {
            state.uiSettings = { language: 'en' };
            assert.equal(formatInvoiceMonth('2026-07'), 'July 2026');

            state.uiSettings = { language: 'de' };
            await loadTranslations('de');
            assert.equal(formatInvoiceMonth('2026-07'), 'Juli 2026');
        });

        test('accurately formats continuous non-dashed month (e.g. "202607") into English and German', async () => {
            state.uiSettings = { language: 'en' };
            assert.equal(formatInvoiceMonth('202607'), 'July 2026');

            state.uiSettings = { language: 'de' };
            await loadTranslations('de');
            assert.equal(formatInvoiceMonth('202607'), 'Juli 2026');
        });

        test('handles various calendar months correctly across year boundaries', () => {
            state.uiSettings = { language: 'en' };
            assert.equal(formatInvoiceMonth('2025-01'), 'January 2025');
            assert.equal(formatInvoiceMonth('202512'), 'December 2025');
            assert.equal(formatInvoiceMonth('2026-05'), 'May 2026');
        });

        test('gracefully handles non-matching strings, null, and undefined values', () => {
            assert.equal(formatInvoiceMonth('2026'), '2026');
            assert.equal(formatInvoiceMonth('invalid-month'), 'invalid-month');
            assert.equal(formatInvoiceMonth(''), '');
            assert.equal(formatInvoiceMonth(null), '');
            assert.equal(formatInvoiceMonth(undefined), '');
        });
    });

    describe('renderRunningCostsData', () => {
        test('sets and clears .is-mock class based on payload isMock property', () => {
            const modal = new MockDOMElement('div', 'running-costs-modal');
            const totalValue = new MockDOMElement('span');
            const historyContainer = new MockDOMElement('div');
            const updateDate = new MockDOMElement('span');

            renderRunningCostsData(modal, { isMock: true, totalCostTillDate: 50 }, totalValue, historyContainer, updateDate);
            assert.ok(modal.classList.contains('is-mock'));

            renderRunningCostsData(modal, { isMock: false, totalCostTillDate: 50 }, totalValue, historyContainer, updateDate);
            assert.ok(!modal.classList.contains('is-mock'));
        });

        test('formats totalCostTillDate and lastUpdated date correctly', () => {
            const modal = new MockDOMElement('div');
            const totalValue = new MockDOMElement('span');
            const historyContainer = new MockDOMElement('div');
            const updateDate = new MockDOMElement('span');

            const payload = {
                isMock: false,
                totalCostTillDate: 128.5,
                lastUpdated: '2026-06-04T12:00:00.000Z',
                breakdown: []
            };

            state.uiSettings = { language: 'en' };
            renderRunningCostsData(modal, payload, totalValue, historyContainer, updateDate);

            assert.equal(totalValue.textContent, '$128.50');
            assert.ok(updateDate.textContent.includes('2026'));
        });

        test('renders highlighted services first with .highlighted class', () => {
            const modal = new MockDOMElement('div');
            const historyContainer = new MockDOMElement('div');

            const payload = {
                breakdown: [
                    {
                        month: '2026-06',
                        totalCost: 55,
                        services: [
                            { name: 'Standard Service 1', cost: 10, highlight: false },
                            { name: 'Special Infrastructure', cost: 45, highlight: true }
                        ]
                    }
                ]
            };

            renderRunningCostsData(modal, payload, null, historyContainer, null);

            const card = historyContainer.querySelector('.costs-month-card');
            assert.ok(card);

            const rows = card.querySelectorAll('.costs-service-row');
            assert.equal(rows.length, 2);

            assert.ok(rows[0].classList.contains('highlighted'));
            assert.equal(rows[0].querySelector('.costs-service-name').textContent, 'Special Infrastructure');
            assert.equal(rows[0].querySelector('.costs-service-cost').textContent, '$45.00');

            assert.ok(!rows[1].classList.contains('highlighted'));
            assert.equal(rows[1].querySelector('.costs-service-name').textContent, 'Standard Service 1');
            assert.equal(rows[1].querySelector('.costs-service-cost').textContent, '$10.00');
        });

        test('renders standard services directly without accordion when standardServices.length <= 2', () => {
            const modal = new MockDOMElement('div');
            const historyContainer = new MockDOMElement('div');

            const payload = {
                breakdown: [
                    {
                        month: '2026-05',
                        totalCost: 37,
                        services: [
                            { name: 'Compute Engine', cost: 9.5 },
                            { name: 'Networking', cost: 27.5 }
                        ]
                    }
                ]
            };

            renderRunningCostsData(modal, payload, null, historyContainer, null);

            const card = historyContainer.querySelector('.costs-month-card');
            assert.ok(card);

            const rows = card.querySelectorAll('.costs-service-row');
            assert.equal(rows.length, 2);

            const toggleBtn = card.querySelector('.costs-toggle-expand-btn');
            assert.equal(toggleBtn, null);

            const othersRow = card.querySelector('.others-row');
            assert.equal(othersRow, null);

            const extraServices = card.querySelectorAll('.extra-service');
            assert.equal(extraServices.length, 0);
        });

        test('renders top 2 standard services, others row, and extra services with accordion button when standardServices > 2', () => {
            const modal = new MockDOMElement('div');
            const historyContainer = new MockDOMElement('div');

            const payload = {
                breakdown: [
                    {
                        month: '2026-04',
                        totalCost: 100,
                        services: [
                            { name: 'Featured Service', cost: 40, highlight: true },
                            { name: 'Compute Engine', cost: 25, highlight: false },
                            { name: 'Cloud Storage', cost: 15, highlight: false },
                            { name: 'Networking', cost: 12, highlight: false },
                            { name: 'Cloud DNS', cost: 8, highlight: false }
                        ]
                    }
                ]
            };

            renderRunningCostsData(modal, payload, null, historyContainer, null);

            const card = historyContainer.querySelector('.costs-month-card');
            assert.ok(card);

            const highlightedRows = card.querySelectorAll('.costs-service-row.highlighted');
            assert.equal(highlightedRows.length, 1);
            assert.equal(highlightedRows[0].querySelector('.costs-service-name').textContent, 'Featured Service');

            const othersRow = card.querySelector('.costs-service-row.others-row');
            assert.ok(othersRow);
            assert.equal(othersRow.querySelector('.costs-service-name').textContent, 'Others');
            assert.equal(othersRow.querySelector('.costs-service-cost').textContent, '$20.00');

            const extraServices = card.querySelectorAll('.costs-service-row.extra-service');
            assert.equal(extraServices.length, 2);
            assert.equal(extraServices[0].querySelector('.costs-service-name').textContent, 'Networking');
            assert.equal(extraServices[0].querySelector('.costs-service-cost').textContent, '$12.00');
            assert.equal(extraServices[1].querySelector('.costs-service-name').textContent, 'Cloud DNS');
            assert.equal(extraServices[1].querySelector('.costs-service-cost').textContent, '$8.00');

            const toggleBtn = card.querySelector('.costs-toggle-expand-btn');
            assert.ok(toggleBtn);

            const btnText = toggleBtn.querySelector('.btn-text');
            assert.ok(btnText);
            assert.equal(btnText.textContent, 'Show More');
            assert.equal(btnText.getAttribute('data-i18n'), 'actions.showMore');

            const icon = toggleBtn.querySelector('orecalc-assets-svg');
            assert.ok(icon);
            assert.equal(icon.getAttribute('name'), 'dropdown');
        });

        test('toggles .expanded class and updates button text on expand toggle click', () => {
            const modal = new MockDOMElement('div');
            const historyContainer = new MockDOMElement('div');

            const payload = {
                breakdown: [
                    {
                        month: '2026-03',
                        totalCost: 60,
                        services: [
                            { name: 'S1', cost: 20 },
                            { name: 'S2', cost: 15 },
                            { name: 'S3', cost: 15 },
                            { name: 'S4', cost: 10 }
                        ]
                    }
                ]
            };

            renderRunningCostsData(modal, payload, null, historyContainer, null);

            const card = historyContainer.querySelector('.costs-month-card');
            const toggleBtn = card.querySelector('.costs-toggle-expand-btn');
            const btnText = toggleBtn.querySelector('.btn-text');

            assert.ok(!card.classList.contains('expanded'));
            assert.equal(btnText.textContent, 'Show More');
            assert.equal(btnText.getAttribute('data-i18n'), 'actions.showMore');

            toggleBtn.click();
            assert.ok(card.classList.contains('expanded'));
            assert.equal(btnText.textContent, 'Show Less');
            assert.equal(btnText.getAttribute('data-i18n'), 'actions.showLess');

            toggleBtn.click();
            assert.ok(!card.classList.contains('expanded'));
            assert.equal(btnText.textContent, 'Show More');
            assert.equal(btnText.getAttribute('data-i18n'), 'actions.showMore');
        });

        test('renders monthly footer notes when item.footer is present', () => {
            const modal = new MockDOMElement('div');
            const historyContainer = new MockDOMElement('div');

            const payload = {
                breakdown: [
                    {
                        month: '2026-02',
                        totalCost: 45,
                        services: [
                            { name: 'S1', cost: 25 },
                            { name: 'S2', cost: 20 }
                        ],
                        footer: '* Includes annual domain renewal fee for orecalc.tech.'
                    },
                    {
                        month: '2026-01',
                        totalCost: 30,
                        services: [
                            { name: 'S1', cost: 30 }
                        ]
                    }
                ]
            };

            renderRunningCostsData(modal, payload, null, historyContainer, null);

            const cards = historyContainer.querySelectorAll('.costs-month-card');
            assert.equal(cards.length, 2);

            const footer0 = cards[0].querySelector('.costs-month-footer');
            assert.ok(footer0);
            assert.equal(footer0.textContent, '* Includes annual domain renewal fee for orecalc.tech.');

            const footer1 = cards[1].querySelector('.costs-month-footer');
            assert.equal(footer1, null);
        });

        test('renders localized text in German when active language is de', async () => {
            state.uiSettings = { language: 'de' };
            await loadTranslations('de');

            const modal = new MockDOMElement('div');
            const historyContainer = new MockDOMElement('div');

            const payload = {
                breakdown: [
                    {
                        month: '2026-07',
                        totalCost: 80,
                        services: [
                            { name: 'S1', cost: 30 },
                            { name: 'S2', cost: 20 },
                            { name: 'S3', cost: 15 },
                            { name: 'S4', cost: 15 }
                        ]
                    }
                ]
            };

            renderRunningCostsData(modal, payload, null, historyContainer, null);

            const card = historyContainer.querySelector('.costs-month-card');
            const monthName = card.querySelector('.costs-month-name');
            assert.equal(monthName.textContent, 'Juli 2026');

            const othersRow = card.querySelector('.others-row');
            assert.equal(othersRow.querySelector('.costs-service-name').textContent, 'Sonstige');

            const toggleBtn = card.querySelector('.costs-toggle-expand-btn');
            const btnText = toggleBtn.querySelector('.btn-text');
            assert.equal(btnText.textContent, 'Mehr anzeigen');

            toggleBtn.click();
            assert.equal(btnText.textContent, 'Weniger anzeigen');
        });
    });
});
