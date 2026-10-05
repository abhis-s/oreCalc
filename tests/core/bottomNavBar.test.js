import { test, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';

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
    toString() {
        return Array.from(this._classes).join(' ');
    }
}

class MockElement {
    constructor(tagName = 'div', className = '') {
        this.tagName = tagName.toUpperCase();
        this.classList = new MockClassList(className);
        this.children = [];
        this.parentNode = null;
        this.attributes = new Map();
        this.dataset = {};
        this._innerHTML = '';
        this.eventListeners = new Map();

        if (className) this.attributes.set('class', className);
    }

    get innerHTML() {
        return this._innerHTML;
    }

    set innerHTML(value) {
        this._innerHTML = String(value || '');
        this.children = [];
    }

    get className() {
        return this.classList.toString();
    }

    set className(val) {
        this.classList = new MockClassList(val);
    }

    setAttribute(name, val) {
        this.attributes.set(name, String(val));
        if (name === 'class') {
            this.classList = new MockClassList(val);
        }
        if (name.startsWith('data-')) {
            const camel = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            this.dataset[camel] = String(val);
        }
    }

    getAttribute(name) {
        if (name === 'class') return this.className;
        return this.attributes.get(name) || null;
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
    }

    addEventListener(event, handler) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(handler);
    }

    click() {
        const handlers = this.eventListeners.get('click') || [];
        handlers.forEach(h => h({ target: this }));
    }

    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }

    querySelectorAll(selector) {
        const matches = [];
        const isClass = selector.startsWith('.');
        const isAttr = selector.startsWith('[') && selector.endsWith(']');

        const search = (node) => {
            for (const child of node.children) {
                if (isClass && child.classList.contains(selector.slice(1))) {
                    matches.push(child);
                } else if (isAttr) {
                    const inner = selector.slice(1, -1);
                    const [attrName, attrVal] = inner.split('=');
                    const cleanVal = attrVal ? attrVal.replace(/['"]/g, '') : null;
                    if (child.attributes.has(attrName)) {
                        if (cleanVal === null || child.attributes.get(attrName) === cleanVal) {
                            matches.push(child);
                        }
                    }
                }
                search(child);
            }
        };

        search(this);
        return matches;
    }
}

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        createElement: (tag) => new MockElement(tag),
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => []
    };
}

const { renderBottomNavBar } = await import('../../js/components/common/bottomNavBar.js');

describe('Universal Bottom Navigation Bar Component Suite', () => {
    let container;

    const sampleItems = [
        {
            id: 'zapquake',
            i18nKey: 'views.damageCalc.tabs.zapQuake',
            iconOutline: 'zap-outline',
            iconFilled: 'zap-filled'
        },
        {
            id: 'cluster_planner',
            i18nKey: 'views.damageCalc.tabs.clusterPlanner',
            iconOutline: 'shield-outline',
            iconFilled: 'shield-filled'
        },

    ];

    beforeEach(() => {
        container = new MockElement('nav', 'bottom-nav-bar');
    });

    test('renders correct number of navigation buttons with tab identifiers and active states', () => {
        renderBottomNavBar({
            container,
            items: sampleItems,
            activeTabId: 'cluster_planner'
        });

        const buttons = container.querySelectorAll('.nav-button');
        assert.equal(buttons.length, 2, 'Should render exactly 2 navigation buttons');

        const [zapBtn, clusterBtn] = buttons;
        assert.equal(zapBtn.getAttribute('data-tab'), 'zapquake');
        assert.equal(clusterBtn.getAttribute('data-tab'), 'cluster_planner');

        assert.equal(zapBtn.getAttribute('title'), 'views.damageCalc.tabs.zapQuake');
        assert.equal(clusterBtn.getAttribute('title'), 'views.damageCalc.tabs.clusterPlanner');

        assert.equal(zapBtn.classList.contains('active'), false);
        assert.equal(clusterBtn.classList.contains('active'), true);
        assert.equal(clusterBtn.getAttribute('aria-current'), 'page');
    });

    test('supports suffix matching for activeTabId with -tab suffix', () => {
        renderBottomNavBar({
            container,
            items: sampleItems,
            activeTabId: 'zapquake-tab'
        });

        const zapBtn = container.querySelector('[data-tab="zapquake"]');
        assert.ok(zapBtn.classList.contains('active'), 'zapquake should be active when activeTabId is zapquake-tab');
    });

    test('invokes onTabSelect callback on button click with tab id and event', () => {
        let clickedTab = null;
        renderBottomNavBar({
            container,
            items: sampleItems,
            activeTabId: 'zapquake',
            onTabSelect: (id) => {
                clickedTab = id;
            }
        });
        const clusterBtn = container.querySelector('[data-tab="cluster_planner"]');
        clusterBtn.click();

        assert.equal(clickedTab, 'cluster_planner', 'Callback should receive tab identifier');
    });

    test('gracefully handles empty or null container without throwing', () => {
        assert.doesNotThrow(() => {
            renderBottomNavBar({
                container: null,
                items: sampleItems,
                activeTabId: 'zapquake'
            });
        });
    });
});
