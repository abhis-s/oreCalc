import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

if (typeof globalThis.HTMLElement === 'undefined') {
    globalThis.HTMLElement = class {};
}
if (typeof globalThis.customElements === 'undefined') {
    globalThis.customElements = { define: () => {}, get: () => {} };
}
if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        __ENV__: { APP_VERSION: '2.1.0' },
        location: { hostname: 'localhost', href: 'http://localhost/' },
        matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
        addEventListener: () => {},
        removeEventListener: () => {},
        scrollTo: () => {},
        getComputedStyle: () => ({ display: 'block' }),
        requestAnimationFrame: (cb) => { cb(); return 1; },
        cancelAnimationFrame: () => {}
    };
}

class MockElement {
    constructor(tagName = 'div') {
        this.tagName = tagName.toUpperCase();
        this.id = '';
        this.className = '';
        this.children = [];
        this.dataset = {};
        this.style = {};
        this._classes = new Set();
        this.classList = {
            add: (...cls) => cls.forEach(c => this._classes.add(c)),
            remove: (...cls) => cls.forEach(c => this._classes.delete(c)),
            contains: (c) => this._classes.has(c) || this.className.split(' ').includes(c)
        };
        this.attributes = new Map();
        this._innerHTML = '';
        this.textContent = '';
    }
    get innerHTML() { return this._innerHTML; }
    set innerHTML(val) {
        this._innerHTML = val;
        if (val === '') {
            this.children = [];
        }
    }
    setAttribute(name, val) { this.attributes.set(name, String(val)); }
    removeAttribute(name) { this.attributes.delete(name); }
    getAttribute(name) { return this.attributes.get(name); }
    appendChild(child) {
        this.children.push(child);
        return child;
    }
    addEventListener() {}
    removeEventListener() {}
    querySelector(selector) {
        if (selector === '.priority-list-loader') {
            return this.children.find(c => c.classList.contains('priority-list-loader')) || (this.innerHTML.includes('priority-list-loader') ? new MockElement('div') : null);
        }
        if (selector === '.button-loader') {
            return this.innerHTML.includes('button-loader') ? new MockElement('span') : null;
        }
        if (selector === '.placeholder-text') {
            return this.children.find(c => c.classList.contains('placeholder-text')) || (this.innerHTML.includes('placeholder-text') ? new MockElement('p') : null);
        }
        return null;
    }
    querySelectorAll(selector) {
        if (selector === '.priority-list-item') {
            return this.children.filter(c => c.classList.contains('priority-list-item'));
        }
        return [];
    }
}

const mockDomElements = new Map();

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        getElementById: (id) => mockDomElements.get(id) || null,
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: (tag) => new MockElement(tag),
        body: new MockElement('body'),
        addEventListener: () => {},
        removeEventListener: () => {}
    };
}

const { state, getDefaultState } = await import('../../js/core/state.js');
const { initializePriorityList } = await import('../../js/components/planner/priorityList.js');
const { loadTranslations } = await import('../../js/i18n/translator.js');

let testTimestamp = 5000000;

describe('Priority List Hydration & Jumping Dots Loader Suite', () => {
    let mockCard;

    beforeEach(async () => {
        await loadTranslations('en');
        Object.assign(state, getDefaultState());
        state.timestamp = ++testTimestamp;

        mockCard = new MockElement('div');
        mockCard.id = 'priority-list-card';
        mockDomElements.set('priority-list-card', mockCard);

        state.heroes = {
            barbarianKing: {
                level: 95,
                equipment: {
                    giantGauntlet: {
                        level: 1,
                        upgradePlan: {
                            1: { enabled: true, targetLevel: 18, priorityIndex: 1 }
                        }
                    }
                }
            }
        };
        state.planner = {
            calendar: {
                isHydrated: true,
                dates: {},
                settings: {},
                view: {
                    month: '2026-09',
                    week: '2026-36'
                }
            }
        };
    });

    test('renders priority list loader when calendar is unhydrated and items exist', () => {
        state.planner.calendar.isHydrated = false;

        initializePriorityList();

        const container = mockCard.children.find(c => c.id === 'priority-list-container');
        assert.ok(container);
        assert.ok(container.innerHTML.includes('priority-list-loader'));
        assert.ok(container.innerHTML.includes('button-loader'));
    });

    test('renders placeholder text without loader when priority list is empty', () => {
        state.planner.calendar.isHydrated = false;
        state.heroes.barbarianKing.equipment.giantGauntlet.upgradePlan[1].enabled = false;

        initializePriorityList();

        const container = mockCard.children.find(c => c.id === 'priority-list-container');
        assert.ok(container);
        assert.strictEqual(container.innerHTML.includes('priority-list-loader'), false);
        const placeholder = container.children.find(c => c.classList.contains('placeholder-text'));
        assert.ok(placeholder);
    });

    test('renders priority items when calendar is hydrated', () => {
        state.planner.calendar.isHydrated = true;

        initializePriorityList();

        const container = mockCard.children.find(c => c.id === 'priority-list-container');
        assert.ok(container);
        assert.strictEqual(container.innerHTML.includes('priority-list-loader'), false);
        const items = container.children.filter(c => c.classList.contains('priority-list-item'));
        assert.strictEqual(items.length, 1);
    });

    test('explicitly renders loader when options.loading is true', () => {
        state.planner.calendar.isHydrated = true;

        initializePriorityList({ loading: true });

        const container = mockCard.children.find(c => c.id === 'priority-list-container');
        assert.ok(container);
        assert.ok(container.innerHTML.includes('priority-list-loader'));
        assert.ok(container.innerHTML.includes('button-loader'));
    });

    test('does not produce premature sequence error banner when items cannot complete due to insufficient income', () => {
        state.planner.calendar.isHydrated = true;
        state.heroes.barbarianKing.equipment.spikyBall = {
            level: 1,
            upgradePlan: {
                1: { enabled: true, targetLevel: 27, priorityIndex: 2 }
            }
        };
        state.storedOres = { shiny: 0, glowy: 0, starry: 0 };
        state.income = { starBonus: { league: 0 } };
        state.timestamp = ++testTimestamp;

        initializePriorityList();

        const container = mockCard.children.find(c => c.id === 'priority-list-container');
        assert.ok(container);
        const items = container.children.filter(c => c.classList.contains('priority-list-item'));
        assert.strictEqual(items.length, 2);

        const errorSeparator = container.children.find(c => c.classList?.contains('priority-error-truncated-separator'));
        assert.strictEqual(errorSeparator, undefined);

        const errorMsg = container.children.find(c => c.classList?.contains('priority-error-truncated-msg'));
        assert.strictEqual(errorMsg, undefined);
    });

    test('renders sequence error banner when steps are truly inverted', () => {
        state.planner.calendar.isHydrated = true;
        state.heroes.barbarianKing.equipment.giantGauntlet.upgradePlan = {
            1: { enabled: true, targetLevel: 15, priorityIndex: 2 },
            2: { enabled: true, targetLevel: 18, priorityIndex: 1 }
        };
        state.timestamp = ++testTimestamp;

        initializePriorityList();

        const container = mockCard.children.find(c => c.id === 'priority-list-container');
        assert.ok(container);

        const errorMsg = container.children.find(c => c.classList?.contains('priority-error-truncated-msg'));
        assert.ok(errorMsg);
    });
});
