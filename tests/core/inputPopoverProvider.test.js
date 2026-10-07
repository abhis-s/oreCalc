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
        requestAnimationFrame: (cb) => setTimeout(cb, 16),
        cancelAnimationFrame: (id) => clearTimeout(id),
        matchMedia: () => ({ matches: true })
    };
} else {
    globalThis.window.requestAnimationFrame = (cb) => setTimeout(cb, 16);
    globalThis.window.cancelAnimationFrame = (id) => clearTimeout(id);
}

if (typeof globalThis.HTMLElement === 'undefined') {
    globalThis.HTMLElement = class {};
}

if (typeof globalThis.requestAnimationFrame === 'undefined' || globalThis.requestAnimationFrame) {
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 16);
}

if (typeof globalThis.cancelAnimationFrame === 'undefined' || globalThis.cancelAnimationFrame) {
    globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
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
        this._value = '';
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

    get value() {
        return this._value;
    }

    set value(val) {
        this._value = String(val);
    }

    get innerHTML() {
        return this._innerHTML;
    }

    set innerHTML(val) {
        this._innerHTML = val || '';
        this.children = [];
        const btnRegex = /<div class="([^"]*popover-opt-btn[^"]*)"([^>]*)>([\s\S]*?)<\/div>/g;
        let match;
        while ((match = btnRegex.exec(this._innerHTML)) !== null) {
            const btn = new MockDOMElement('div', '', match[1]);
            const attrStr = match[2];
            const dataAction = attrStr.match(/data-action="([^"]+)"/);
            if (dataAction) btn.dataset.action = dataAction[1];
            const dataIndex = attrStr.match(/data-index="([^"]+)"/);
            if (dataIndex) btn.dataset.index = dataIndex[1];
            this.appendChild(btn);
        }
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
        if (name === 'id') this.id = String(value);
        if (name === 'class') this.className = String(value);
        if (name.startsWith('data-')) {
            const dataKey = name.slice(5).replace(/-([a-z])/g, (_, l) => l.toUpperCase());
            this.dataset[dataKey] = String(value);
        }
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

    removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx !== -1) {
            this.children.splice(idx, 1);
            child.parentNode = null;
            child.parentElement = null;
        }
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
        if (selector === '.popover-opt-btn' && this.classList.contains('popover-opt-btn')) return this;
        if (selector === '.popover-opt-btn.clickable' && this.classList.contains('popover-opt-btn') && this.classList.contains('clickable')) return this;
        if (this.parentNode && typeof this.parentNode.closest === 'function') {
            return this.parentNode.closest(selector);
        }
        return null;
    }

    querySelector(selector) {
        for (const child of this.children) {
            if (selector.includes('clickable') && child.classList.contains('clickable')) return child;
            if (selector.includes('popover-opt-btn') && child.classList.contains('popover-opt-btn')) return child;
            const sub = child.querySelector(selector);
            if (sub) return sub;
        }
        return null;
    }

    querySelectorAll(selector) {
        const results = [];
        for (const child of this.children) {
            if (selector.includes('popover-opt-btn') && child.classList.contains('popover-opt-btn')) results.push(child);
            results.push(...child.querySelectorAll(selector));
        }
        return results;
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

    focus() {
        if (globalThis.document) globalThis.document.activeElement = this;
        this.dispatchEvent({ type: 'focus', target: this, bubbles: false, cancelable: true });
    }

    blur() {
        if (globalThis.document && globalThis.document.activeElement === this) {
            globalThis.document.activeElement = globalThis.document.body;
        }
        this.dispatchEvent({ type: 'blur', target: this, bubbles: false, cancelable: true });
    }
}

const mockBody = new MockDOMElement('body');
globalThis.document = {
    body: mockBody,
    activeElement: mockBody,
    createElement: (tag) => new MockDOMElement(tag),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {}
};

describe('inputPopoverProvider - Mac Trackpad Click & Blur Lifecycle Suite', () => {
    let registerInputPopover;
    let loadTranslations;

    beforeEach(async () => {
        globalThis.fetch = async (url) => {
            if (typeof url === 'string' && url.includes('/en.json')) return { ok: true, json: async () => enJson };
            return { ok: false, status: 404 };
        };
        const transMod = await import('../../js/i18n/translator.js');
        loadTranslations = transMod.loadTranslations;
        await loadTranslations('en');

        const providerMod = await import('../../js/utils/inputPopoverProvider.js');
        registerInputPopover = providerMod.registerInputPopover;
    });

    const createTestInput = (val = '5') => {
        const input = new MockDOMElement('input');
        input.value = val;
        mockBody.appendChild(input);
        return input;
    };

    test('focusing inputElement displays the popover with interactive options', () => {
        const input = createTestInput('5');
        registerInputPopover(input, {
            min: 0,
            max: 20,
            showMin: true,
            showMax: true,
            clickToFill: { min: true, max: true }
        });

        input.focus();
        const popover = input._popoverElement;
        assert.ok(popover, 'Popover element created on registration');
        assert.ok(popover.classList.contains('show'), 'Popover has show class on focus');
    });

    test('mousedown on popover calls preventDefault to protect focus from premature blur', () => {
        const input = createTestInput('5');
        registerInputPopover(input, {
            min: 0,
            max: 20,
            showMin: true,
            showMax: true,
            clickToFill: { min: true, max: true }
        });

        input.focus();
        const popover = input._popoverElement;
        let preventDefaultCalled = false;

        popover.dispatchEvent({
            type: 'mousedown',
            target: popover.querySelector('.popover-opt-btn'),
            preventDefault: () => { preventDefaultCalled = true; },
            stopPropagation: () => {}
        });

        assert.ok(preventDefaultCalled, 'mousedown inside popover calls preventDefault to keep input focus');
    });

    test('clicking an option button selects value and triggers input and change events', () => {
        const input = createTestInput('5');
        let inputEventFired = false;
        let changeEventFired = false;

        input.addEventListener('input', () => { inputEventFired = true; });
        input.addEventListener('change', () => { changeEventFired = true; });

        registerInputPopover(input, {
            min: 0,
            max: 20,
            showMin: true,
            showMax: true,
            clickToFill: { min: true, max: true }
        });

        input.focus();
        const popover = input._popoverElement;
        const maxBtn = popover.children.find(c => c.dataset.action === 'max');
        assert.ok(maxBtn, 'Max button found');

        popover.dispatchEvent({
            type: 'click',
            target: maxBtn,
            preventDefault: () => {},
            stopPropagation: () => {}
        });

        assert.equal(input.value, '20', 'Input value updated to max value');
        assert.ok(inputEventFired, 'Input event fired on selection');
        assert.ok(changeEventFired, 'Change event fired on selection');
    });

    test('physical trackpad click simulation: hold delay does not dismiss popover before release', async () => {
        const input = createTestInput('5');
        registerInputPopover(input, {
            min: 1,
            max: 27,
            showMin: true,
            showMax: true,
            clickToFill: { min: true, max: true }
        });

        input.focus();
        const popover = input._popoverElement;
        const minBtn = popover.children.find(c => c.dataset.action === 'min');
        assert.ok(minBtn, 'Min button found');

        let mousedownPrevented = false;
        popover.dispatchEvent({
            type: 'mousedown',
            target: minBtn,
            preventDefault: () => { mousedownPrevented = true; },
            stopPropagation: () => {}
        });
        assert.ok(mousedownPrevented, 'Mousedown default prevented on down-press');

        // Simulate trackpad mechanical depression hold duration (180ms)
        await new Promise(r => setTimeout(r, 180));
        assert.ok(popover.classList.contains('show'), 'Popover still shown after 180ms trackpad hold');

        // Trackpad released: click dispatches
        popover.dispatchEvent({
            type: 'click',
            target: minBtn,
            preventDefault: () => {},
            stopPropagation: () => {}
        });
        assert.equal(input.value, '1', 'Value selected successfully on release');
    });

    test('outside blur closes popover after timeout window', async () => {
        const input = createTestInput('5');
        registerInputPopover(input, {
            min: 0,
            max: 20
        });

        input.focus();
        const popover = input._popoverElement;
        assert.ok(popover.classList.contains('show'), 'Popover open on focus');

        input.blur();
        assert.ok(popover.classList.contains('show'), 'Popover still open immediately on blur (grace period)');

        await new Promise(r => setTimeout(r, 200));
        assert.ok(!popover.classList.contains('show'), 'Popover closed after blur timeout expires');
    });

    test('escape key dismisses popover immediately', () => {
        const input = createTestInput('5');
        registerInputPopover(input, {
            min: 0,
            max: 20
        });

        input.focus();
        const popover = input._popoverElement;
        assert.ok(popover.classList.contains('show'), 'Popover open');

        input.dispatchEvent({
            type: 'keydown',
            key: 'Escape',
            preventDefault: () => {},
            stopPropagation: () => {}
        });

        assert.ok(!popover.classList.contains('show'), 'Escape key dismissed popover');
    });
});
