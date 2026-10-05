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
    toString() {
        return Array.from(this._classes).join(' ');
    }
}

class MockElement {
    constructor(tagName = 'div', className = '') {
        this.tagName = tagName.toUpperCase();
        this.className = className;
        this.classList = new MockClassList(className);
        this.clientWidth = 0;
        this.offsetWidth = 0;
        this.style = {};
        this._attributes = new Map();
        this._listeners = new Map();
        this._children = [];
    }
    setAttribute(k, v) { this._attributes.set(k, String(v)); }
    getAttribute(k) { return this._attributes.get(k) || null; }
    removeAttribute(k) { this._attributes.delete(k); }
    prepend(...children) {
        this._children.unshift(...children);
    }
    appendChild(child) {
        this._children.push(child);
    }
    addEventListener(event, fn) {
        if (!this._listeners.has(event)) this._listeners.set(event, []);
        this._listeners.get(event).push(fn);
    }
    removeEventListener(event, fn) {
        if (!this._listeners.has(event)) return;
        this._listeners.set(event, this._listeners.get(event).filter(cb => cb !== fn));
    }
    dispatchEvent(event) {
        const type = typeof event === 'string' ? event : event?.type;
        const cbs = this._listeners.get(type) || [];
        cbs.forEach(cb => cb(event));
        return true;
    }
    contains(child) {
        if (child === this) return true;
        return this._children.some(c => (c === child || (c.contains && c.contains(child))));
    }
    querySelector(selector) {
        const parts = selector.split(',').map(s => s.trim());
        for (const part of parts) {
            for (const child of this._children) {
                if (part.startsWith('.') && child.classList.contains(part.slice(1))) return child;
                if (part.startsWith('#') && child.id === part.slice(1)) return child;
                if (child.tagName.toLowerCase() === part.toLowerCase()) return child;
                if (child.querySelector) {
                    const match = child.querySelector(part);
                    if (match) return match;
                }
            }
        }
        return null;
    }
}

let mockDocument;
let mockWindow;
let windowListeners = new Map();

function setupMockEnvironment() {
    windowListeners.clear();

    mockWindow = {
        addEventListener: (event, fn) => {
            if (!windowListeners.has(event)) windowListeners.set(event, []);
            windowListeners.get(event).push(fn);
        },
        removeEventListener: (event, fn) => {
            if (!windowListeners.has(event)) return;
            windowListeners.set(event, windowListeners.get(event).filter(cb => cb !== fn));
        },
        requestAnimationFrame: (cb) => cb(),
        matchMedia: (query) => ({
            matches: query.includes('hover: hover') ? true : false,
            addEventListener: () => {},
            removeEventListener: () => {}
        }),
        getComputedStyle: () => ({ display: 'flex' })
    };

    mockDocument = {
        body: new MockElement('body'),
        createElement: (tag) => new MockElement(tag),
        querySelector: () => null,
        querySelectorAll: () => []
    };

    globalThis.window = mockWindow;
    globalThis.document = mockDocument;
}

const {
    initAppHeader,
    initAppHeaderScrollObserver,
    initAppHeaderPlayerDropdownInteractions
} = await import('../../js/components/common/appHeader.js');

describe('Modular Application Header (appHeader.js)', () => {
    beforeEach(() => {
        setupMockEnvironment();
    });

    describe('Scroll Sentinel Observer', () => {
        test('creates .app-header-sentinel and attaches IntersectionObserver', () => {
            let observedTarget = null;
            let observerCallback = null;

            globalThis.IntersectionObserver = class {
                constructor(cb) {
                    observerCallback = cb;
                }
                observe(el) {
                    observedTarget = el;
                }
                disconnect() {
                    observedTarget = null;
                }
            };

            const header = new MockElement('header', 'app-header');
            const cleanup = initAppHeaderScrollObserver(header);

            assert.ok(observedTarget !== null, 'Observer must attach to sentinel element');
            assert.strictEqual(observedTarget.className, 'app-header-sentinel');

            // Simulate scroll off top (not intersecting -> is-scrolled: true)
            observerCallback([{ isIntersecting: false }]);
            assert.strictEqual(header.classList.contains('is-scrolled'), true);

            // Simulate scroll back to top (intersecting -> is-scrolled: false)
            observerCallback([{ isIntersecting: true }]);
            assert.strictEqual(header.classList.contains('is-scrolled'), false);

            cleanup();
            assert.strictEqual(observedTarget, null, 'Cleanup must disconnect observer');
        });
    });

    describe('Player Dropdown Interaction Lifecycle', () => {
        test('opens on mouseenter and schedules close on mouseleave', async () => {
            const container = new MockElement('div', 'player-dropdown-container');
            const button = new MockElement('button', 'player-dropdown-button');
            const list = new MockElement('div', 'player-dropdown-list');
            const arrow = new MockElement('span', 'dropdown-arrow');
            const useEl = new MockElement('use');
            arrow._children.push(useEl);

            container._children.push(button, list, arrow);

            const cleanup = initAppHeaderPlayerDropdownInteractions(container);

            container.dispatchEvent({ type: 'mouseenter' });
            assert.strictEqual(list.classList.contains('show'), true);
            assert.strictEqual(button.classList.contains('open'), true);
            assert.strictEqual(useEl.getAttribute('href'), '#icon-chevron-up');

            container.dispatchEvent({ type: 'mouseleave' });
            // Wait for 150ms timeout
            await new Promise(r => setTimeout(r, 150));
            assert.strictEqual(list.classList.contains('show'), false);
            assert.strictEqual(button.classList.contains('open'), false);
            assert.strictEqual(useEl.getAttribute('href'), '#icon-chevron-down');

            // Scroll dismisses open dropdown
            container.dispatchEvent({ type: 'mouseenter' });
            assert.strictEqual(list.classList.contains('show'), true);

            const scrollCbs = windowListeners.get('scroll') || [];
            scrollCbs.forEach(cb => cb());
            assert.strictEqual(list.classList.contains('show'), false);

            cleanup();
        });
    });

    describe('Master Initialization (initAppHeader)', () => {
        test('initializes modular subsystems and destroys cleanly without error', () => {
            const header = new MockElement('header', 'app-header');
            const inner = new MockElement('div', 'app-header__inner');
            inner.clientWidth = 800;
            header._children.push(inner);

            mockDocument.querySelector = (sel) => {
                if (sel.includes('app-header')) return header;
                return null;
            };

            const appHeaderInstance = initAppHeader({ headerElement: header });

            assert.strictEqual(typeof appHeaderInstance.updateLayout, 'function');
            assert.strictEqual(typeof appHeaderInstance.destroy, 'function');

            assert.doesNotThrow(() => {
                appHeaderInstance.updateLayout();
                appHeaderInstance.destroy();
            });
        });
    });
});
