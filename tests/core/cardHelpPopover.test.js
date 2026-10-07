import { test, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        innerWidth: 1024,
        innerHeight: 768,
        addEventListener: () => {},
        removeEventListener: () => {},
        getComputedStyle: () => ({ display: 'block' }),
        matchMedia: () => ({ matches: true })
    };
}

if (typeof globalThis.HTMLElement === 'undefined') {
    globalThis.HTMLElement = class {};
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
    toString() {
        return Array.from(this._classes).join(' ');
    }
}

class MockDOMElement {
    constructor(tagName, id = '', className = '') {
        this.tagName = tagName.toUpperCase();
        this.id = id;
        this._className = className;
        this.classList = new MockClassList(className);
        this.children = [];
        this.parentNode = null;
        this.parentElement = null;
        this.attributes = new Map();
        this.style = {};
        this.dataset = {};
        this._innerHTML = '';
        this.eventListeners = new Map();

        if (id) this.attributes.set('id', id);
        if (className) this.attributes.set('class', className);
    }

    get className() {
        return this.classList ? this.classList.toString() : this._className;
    }

    set className(val) {
        this._className = val || '';
        this.classList = new MockClassList(val);
        this.attributes.set('class', this._className);
    }

    get innerHTML() {
        return this._innerHTML;
    }

    set innerHTML(val) {
        this._innerHTML = val || '';
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
        if (name === 'id') this.id = String(value);
        if (name === 'class') this.className = String(value);
    }

    getAttribute(name) {
        if (name === 'class') return this.className;
        return this.attributes.has(name) ? this.attributes.get(name) : null;
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    hasAttribute(name) {
        return this.attributes.has(name);
    }

    appendChild(child) {
        if (!child) return;
        child.parentNode = this;
        child.parentElement = this;
        this.children.push(child);
        return child;
    }

    addEventListener(event, handler) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(handler);
    }

    removeEventListener(event, handler) {
        if (!this.eventListeners.has(event)) return;
        const list = this.eventListeners.get(event);
        const idx = list.indexOf(handler);
        if (idx !== -1) list.splice(idx, 1);
    }

    dispatchEvent(event) {
        const type = event?.type || event;
        const listeners = this.eventListeners.get(type) || [];
        const evt = typeof event === 'object' ? event : { type, preventDefault: () => {} };
        try {
            if (!evt.target) {
                Object.defineProperty(evt, 'target', { value: this, configurable: true });
            }
        } catch (_) {}
        for (const listener of listeners) {
            listener(evt);
        }
        return !evt.defaultPrevented;
    }

    closest(selector) {
        if (selector.includes(this.className)) return this;
        if (this.parentNode && typeof this.parentNode.closest === 'function') {
            return this.parentNode.closest(selector);
        }
        return null;
    }

    getBoundingClientRect() {
        return { top: 100, bottom: 130, left: 50, right: 150, width: 100, height: 30 };
    }

    contains(node) {
        if (!node) return false;
        if (node === this) return true;
        for (const child of this.children) {
            if (child.contains(node)) return true;
        }
        return false;
    }
}

const mockDocListeners = new Map();
const mockBody = new MockDOMElement('body');
const mockHelpPopover = new MockDOMElement('div', 'card-help-popover', 'card-help-popover');
mockBody.appendChild(mockHelpPopover);

globalThis.document = {
    body: mockBody,
    createElement: (tag) => new MockDOMElement(tag),
    getElementById: (id) => (id === 'card-help-popover' ? mockHelpPopover : null),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: (event, handler) => {
        if (!mockDocListeners.has(event)) mockDocListeners.set(event, []);
        mockDocListeners.get(event).push(handler);
    },
    removeEventListener: (event, handler) => {
        if (!mockDocListeners.has(event)) return;
        const list = mockDocListeners.get(event);
        const idx = list.indexOf(handler);
        if (idx !== -1) list.splice(idx, 1);
    }
};

describe('cardHelpPopover - Hover-to-Click Grace & Pinning Lifecycle Suite', () => {
    let showCardHelpPopover;
    let hideCardHelpPopover;
    let isCardHelpPopoverPinned;
    let loadTranslations;

    beforeEach(async () => {
        globalThis.fetch = async (url) => {
            if (typeof url === 'string' && url.includes('/en.json')) return { ok: true, json: async () => enJson };
            return { ok: false, status: 404 };
        };
        const transMod = await import('../../js/i18n/translator.js');
        loadTranslations = transMod.loadTranslations;
        await loadTranslations('en');

        const popoverMod = await import('../../js/utils/cardHelpPopover.js');
        showCardHelpPopover = popoverMod.showCardHelpPopover;
        hideCardHelpPopover = popoverMod.hideCardHelpPopover;
        isCardHelpPopoverPinned = popoverMod.isCardHelpPopoverPinned;

        hideCardHelpPopover();
    });

    test('showing tooltip via hover sets show class and leaves it unpinned', () => {
        const trigger = new MockDOMElement('button', 'info-btn-1');
        mockBody.appendChild(trigger);

        showCardHelpPopover(trigger, 'Help content text', { isToggle: false });
        assert.ok(mockHelpPopover.classList.contains('show'), 'Popover has show class');
        assert.equal(isCardHelpPopoverPinned(), false, 'Popover is not pinned when opened via hover');
    });

    test('clicking a freshly hovered trigger pins the tooltip instead of dismissing it', () => {
        const trigger = new MockDOMElement('button', 'info-btn-2');
        mockBody.appendChild(trigger);

        // 1. Cursor hovers over trigger
        showCardHelpPopover(trigger, 'Help content text', { isToggle: false });
        assert.ok(mockHelpPopover.classList.contains('show'), 'Tooltip shown via hover');
        assert.equal(isCardHelpPopoverPinned(), false, 'Not pinned initially');

        // 2. User physically clicks the trackpad on the hovered trigger
        showCardHelpPopover(trigger, 'Help content text', { isToggle: true });
        assert.ok(mockHelpPopover.classList.contains('show'), 'Tooltip remains visible after click');
        assert.equal(isCardHelpPopoverPinned(), true, 'Tooltip is now pinned by explicit click');
    });

    test('clicking a second time after pinning toggles the tooltip off', () => {
        const trigger = new MockDOMElement('button', 'info-btn-3');
        mockBody.appendChild(trigger);

        // Hover then click to pin
        showCardHelpPopover(trigger, 'Help content text', { isToggle: false });
        showCardHelpPopover(trigger, 'Help content text', { isToggle: true });
        assert.equal(isCardHelpPopoverPinned(), true, 'Tooltip is pinned');

        // Second click on pinned trigger toggles it off
        showCardHelpPopover(trigger, 'Help content text', { isToggle: true });
        assert.ok(!mockHelpPopover.classList.contains('show'), 'Tooltip dismissed on second click');
        assert.equal(isCardHelpPopoverPinned(), false, 'No longer pinned');
    });

    test('hideCardHelpPopover dismisses tooltip and resets pinned state', () => {
        const trigger = new MockDOMElement('button', 'info-btn-4');
        mockBody.appendChild(trigger);

        showCardHelpPopover(trigger, 'Help text', { isToggle: true });
        assert.ok(mockHelpPopover.classList.contains('show'), 'Tooltip visible');
        assert.equal(isCardHelpPopoverPinned(), true, 'Tooltip pinned');

        hideCardHelpPopover();
        assert.ok(!mockHelpPopover.classList.contains('show'), 'Tooltip dismissed');
        assert.equal(isCardHelpPopoverPinned(), false, 'Pinned state reset');
    });

    test('outside interaction dismisses the active tooltip', () => {
        const trigger = new MockDOMElement('button', 'info-btn-5');
        mockBody.appendChild(trigger);

        showCardHelpPopover(trigger, 'Help text', { isToggle: true });
        assert.ok(mockHelpPopover.classList.contains('show'), 'Tooltip open');

        const outsideElem = new MockDOMElement('div', 'outside-box');
        mockBody.appendChild(outsideElem);

        const pointerdownHandlers = mockDocListeners.get('pointerdown') || [];
        for (const handler of pointerdownHandlers) {
            handler({ target: outsideElem });
        }

        assert.ok(!mockHelpPopover.classList.contains('show'), 'Outside pointerdown closed tooltip');
        assert.equal(isCardHelpPopoverPinned(), false, 'Pinned state reset on outside dismissal');
    });
});
