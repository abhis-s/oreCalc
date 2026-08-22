import { test, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const domStore = new Map();
const docListeners = new Map();

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

function parseHTML(html) {
    const root = new MockDOMElement('div');
    const stack = [root];
    const tagRegex = /<!--[\s\S]*?-->|<(\/)?([a-zA-Z0-9\-]+)([^>]*?)(\/)?>|([^<]+)/g;
    let match;

    while ((match = tagRegex.exec(html)) !== null) {
        if (match[0].startsWith('<!--')) continue;

        const isClosing = match[1] === '/';
        const tagName = match[2];
        const attrStr = match[3] || '';
        const isSelfClosing = match[4] === '/' || ['img', 'br', 'hr', 'input'].includes(tagName?.toLowerCase());
        const textContent = match[5];

        if (tagName) {
            if (isClosing) {
                if (stack.length > 1 && stack[stack.length - 1].tagName === tagName.toUpperCase()) {
                    stack.pop();
                }
            } else {
                const elem = new MockDOMElement(tagName);

                const attrRegex = /([a-zA-Z0-9\-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
                let attrMatch;
                while ((attrMatch = attrRegex.exec(attrStr)) !== null) {
                    const attrName = attrMatch[1];
                    const attrVal = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';
                    if (attrName === 'class') {
                        elem.className = attrVal;
                    } else if (attrName === 'id') {
                        elem.id = attrVal;
                        domStore.set(attrVal, elem);
                    } else {
                        elem.setAttribute(attrName, attrVal);
                    }
                }

                stack[stack.length - 1].appendChild(elem);

                if (!isSelfClosing) {
                    stack.push(elem);
                }
            }
        } else if (textContent && textContent.trim()) {
            const current = stack[stack.length - 1];
            current.textContent = (current.textContent ? current.textContent + ' ' : '') + textContent.trim();
        }
    }

    return root.children;
}

class MockDOMElement {
    constructor(tagName = 'div', id = '', className = '') {
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
        this._textContent = '';
        this.eventListeners = new Map();

        if (id) {
            this.attributes.set('id', id);
            domStore.set(id, this);
        }
        if (className) {
            this.attributes.set('class', className);
        }
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
        this.children = [];
        if (this._innerHTML) {
            const parsedChildren = parseHTML(this._innerHTML);
            parsedChildren.forEach(c => this.appendChild(c));
        }
    }

    get textContent() {
        return this._textContent;
    }

    set textContent(val) {
        this._textContent = val || '';
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
        if (name === 'id') {
            this.id = String(value);
            domStore.set(this.id, this);
        }
        if (name === 'class') {
            this.className = String(value);
        }
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
        if (child) {
            child.parentNode = this;
            child.parentElement = this;
            this.children.push(child);
        }
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

    cloneNode(deep = false) {
        const clone = new MockDOMElement(this.tagName.toLowerCase(), '', this.className);
        this.attributes.forEach((v, k) => clone.setAttribute(k, v));
        Object.assign(clone.dataset, this.dataset);
        clone.innerHTML = this.innerHTML;
        return clone;
    }

    contains(node) {
        if (node === this) return true;
        for (const child of this.children) {
            if (child === node || (child.contains && child.contains(node))) {
                return true;
            }
        }
        return false;
    }

    closest(selector) {
        if (!selector) return null;
        const parts = selector.split(',').map(s => s.trim());
        let cur = this;
        while (cur) {
            for (const sel of parts) {
                if (sel.startsWith('.') && cur.classList && cur.classList.contains(sel.slice(1))) {
                    return cur;
                }
                if (sel.startsWith('#') && cur.id === sel.slice(1)) {
                    return cur;
                }
            }
            cur = cur.parentElement || cur.parentNode;
        }
        return null;
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

    getBoundingClientRect() {
        return {
            top: 100,
            left: 100,
            bottom: 140,
            right: 200,
            width: 100,
            height: 40,
            x: 100,
            y: 100
        };
    }
}

function matchesSelector(element, selector) {
    if (!element || !selector) return false;
    const s = selector.trim();
    if (s.startsWith('#')) return element.id === s.slice(1);
    if (s.startsWith('.')) {
        const classNames = s.split('.').filter(Boolean);
        return classNames.every(c => element.classList.contains(c));
    }
    return element.tagName === s.toUpperCase();
}

function querySelectorInternal(root, selector) {
    for (const child of root.children) {
        if (matchesSelector(child, selector)) return child;
        const found = querySelectorInternal(child, selector);
        if (found) return found;
    }
    return null;
}

function querySelectorAllInternal(root, selector, results = []) {
    for (const child of root.children) {
        if (matchesSelector(child, selector)) results.push(child);
        querySelectorAllInternal(child, selector, results);
    }
    return results;
}

const mockBody = new MockDOMElement('body', 'body');

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        innerWidth: 1024,
        innerHeight: 768,
        location: { hostname: 'localhost', origin: 'https://orecalc.tech', pathname: '/' },
        addEventListener: () => {},
        removeEventListener: () => {},
        getComputedStyle: () => ({ display: 'block', marginTop: '5px', marginBottom: '5px' }),
        requestAnimationFrame: (cb) => { cb(); return 1; },
        cancelAnimationFrame: () => {},
        matchMedia: () => ({ matches: true })
    };
} else {
    if (!globalThis.window.innerWidth) globalThis.window.innerWidth = 1024;
    if (!globalThis.window.innerHeight) globalThis.window.innerHeight = 768;
    if (!globalThis.window.location) globalThis.window.location = { hostname: 'localhost', origin: 'https://orecalc.tech', pathname: '/' };
    if (!globalThis.window.getComputedStyle) globalThis.window.getComputedStyle = () => ({ display: 'block', marginTop: '5px', marginBottom: '5px' });
    if (!globalThis.window.requestAnimationFrame) globalThis.window.requestAnimationFrame = (cb) => { cb(); return 1; };
    if (!globalThis.window.matchMedia) globalThis.window.matchMedia = () => ({ matches: true });
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

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        body: mockBody,
        getElementById: (id) => domStore.get(id) || null,
        querySelector: (sel) => {
            if (sel.startsWith('#')) return domStore.get(sel.slice(1)) || null;
            return querySelectorInternal(mockBody, sel);
        },
        querySelectorAll: (sel) => querySelectorAllInternal(mockBody, sel),
        createElement: (tag) => new MockDOMElement(tag),
        addEventListener: (event, handler) => {
            if (!docListeners.has(event)) docListeners.set(event, []);
            docListeners.get(event).push(handler);
        },
        removeEventListener: (event, handler) => {
            if (docListeners.has(event)) {
                const list = docListeners.get(event);
                const idx = list.indexOf(handler);
                if (idx !== -1) list.splice(idx, 1);
            }
        },
        dispatchEvent: (evt) => {
            const eventType = typeof evt === 'string' ? evt : (evt.type || '');
            const handlers = docListeners.get(eventType) || [];
            handlers.forEach(fn => fn(evt));
            return true;
        }
    };
} else {
    if (!globalThis.document.body) {
        globalThis.document.body = mockBody;
    }
    globalThis.document.getElementById = (id) => domStore.get(id) || null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));
const deJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/de.json'), 'utf8'));

globalThis.fetch = async (url) => {
    if (url.includes('/en.json')) return { ok: true, json: async () => enJson };
    if (url.includes('/de.json')) return { ok: true, json: async () => deJson };
    return { ok: false, status: 404 };
};

const { state } = await import('../../js/core/state.js');
const { loadTranslations, translate } = await import('../../js/i18n/translator.js');
const { renderDraggableList } = await import('../../js/components/planner/priorityListModalDisplay.js');
const { hideCardHelpPopover } = await import('../../js/utils/cardHelpPopover.js');
const { initializePriorityList } = await import('../../js/components/planner/priorityList.js');

describe('Priority List Step Ores Popover Suite', () => {
    let editorElement;
    let popoverElement;

    beforeEach(async () => {
        state.uiSettings = { language: 'en' };
        await loadTranslations('en');

        editorElement = globalThis.document.getElementById('priority-list-editor');
        if (!editorElement) {
            editorElement = new MockDOMElement('div', 'priority-list-editor', 'priority-list-editor');
            mockBody.appendChild(editorElement);
        } else {
            editorElement.innerHTML = '';
        }

        popoverElement = globalThis.document.getElementById('card-help-popover');
        if (!popoverElement) {
            popoverElement = new MockDOMElement('div', 'card-help-popover', 'card-help-popover');
            mockBody.appendChild(popoverElement);
        } else {
            popoverElement.innerHTML = '';
            popoverElement.classList.remove('show');
        }

        if (!globalThis.document.getElementById('reset-priority-list-modal-btn')) {
            const resetBtn = new MockDOMElement('button', 'reset-priority-list-modal-btn');
            mockBody.appendChild(resetBtn);
        }

        if (!globalThis.document.getElementById('priority-list-modal-info-btn')) {
            const infoBtn = new MockDOMElement('button', 'priority-list-modal-info-btn');
            mockBody.appendChild(infoBtn);
        }

        if (!globalThis.document.getElementById('priority-list-message-container')) {
            const msgContainer = new MockDOMElement('div', 'priority-list-message-container');
            mockBody.appendChild(msgContainer);
        }

        state.heroes = {
            'Barbarian King': {
                level: 95,
                equipment: {
                    giantGauntlet: {
                        name: 'Giant Gauntlet',
                        level: 1,
                        type: 'epic',
                        upgradePlan: {
                            '1': { targetLevel: 18, enabled: true, priorityIndex: 1 }
                        }
                    }
                }
            }
        };
    });

    describe('Clean DOM Rendering without Inline Tooltip Subtrees', () => {
        test('renders .priority-item-ores as accessible interactive pill without legacy .priority-item-tooltip subtree', () => {
            const mockList = [
                {
                    heroName: 'Barbarian King',
                    name: 'Giant Gauntlet',
                    step: 1,
                    targetLevel: 18,
                    image: 'assets/giant_gauntlet.png',
                    completionDate: new Date('2026-09-01'),
                    oresPreCompletion: { shiny: 1200, glowy: 80, starry: 10 },
                    requiredOres: { shiny: 15000, glowy: 600, starry: 120 },
                    bottleneckOre: 'glowy'
                }
            ];

            renderDraggableList(mockList, []);

            const item = editorElement.querySelector('.priority-list-editor-item');
            assert.ok(item);

            const oresPill = item.querySelector('.priority-item-ores');
            assert.ok(oresPill);
            assert.strictEqual(oresPill.getAttribute('role'), 'button');
            assert.strictEqual(oresPill.getAttribute('tabindex'), '0');
            assert.strictEqual(oresPill.getAttribute('aria-label'), translate('views.income.ores.storedTitle'));

            const legacyTooltip = item.querySelector('.priority-item-tooltip');
            assert.strictEqual(legacyTooltip, null);
        });
    });

    describe('Popover Content & Display on Interaction', () => {
        test('displays rich glassmorphism popover on click with equipment, bottleneck, and required ores breakdown', () => {
            const mockList = [
                {
                    heroName: 'Barbarian King',
                    name: 'Giant Gauntlet',
                    step: 1,
                    targetLevel: 18,
                    image: 'assets/giant_gauntlet.png',
                    completionDate: new Date('2026-09-01'),
                    oresPreCompletion: { shiny: 1200, glowy: 400, starry: 50 },
                    requiredOres: { shiny: 15000, glowy: 1920, starry: 120 },
                    bottleneckOre: 'glowy'
                }
            ];

            renderDraggableList(mockList, []);

            const oresPill = editorElement.querySelector('.priority-item-ores');
            assert.ok(oresPill);

            oresPill.click();

            assert.ok(popoverElement.classList.contains('show'));
            assert.ok(popoverElement.innerHTML.includes('Giant Gauntlet'));
            assert.ok(popoverElement.innerHTML.includes('1 &rarr; 18'));
            assert.ok(popoverElement.innerHTML.includes(`${translate('views.income.ores.bottleneckLabel')}: <span class="ore-text-glowy">${translate('entities.ores.glowy')}</span>`));
            assert.ok(popoverElement.innerHTML.includes(translate('views.income.ores.tooltipReached')));
            assert.ok(popoverElement.innerHTML.includes(translate('views.income.prospector.tooltipConsider')));
            assert.ok(popoverElement.innerHTML.includes(translate('views.income.ores.tooltipRequired')));
            assert.ok(popoverElement.innerHTML.includes('15,000') && popoverElement.innerHTML.includes('1,920') && popoverElement.innerHTML.includes('120'));
        });

        test('toggles popover off when clicking the same trigger again', () => {
            const mockList = [
                {
                    heroName: 'Barbarian King',
                    name: 'Giant Gauntlet',
                    step: 1,
                    targetLevel: 18,
                    image: 'assets/giant_gauntlet.png',
                    completionDate: new Date('2026-09-01'),
                    oresPreCompletion: { shiny: 1200, glowy: 400, starry: 50 },
                    requiredOres: { shiny: 15000, glowy: 1920, starry: 120 },
                    bottleneckOre: 'glowy'
                }
            ];

            renderDraggableList(mockList, []);

            const oresPill = editorElement.querySelector('.priority-item-ores');
            oresPill.click();
            assert.ok(popoverElement.classList.contains('show'));

            oresPill.click();
            assert.strictEqual(popoverElement.classList.contains('show'), false);
        });

        test('triggers popover on keyboard Enter and Space keys', () => {
            const mockList = [
                {
                    heroName: 'Barbarian King',
                    name: 'Giant Gauntlet',
                    step: 1,
                    targetLevel: 18,
                    image: 'assets/giant_gauntlet.png',
                    completionDate: new Date('2026-09-01'),
                    oresPreCompletion: { shiny: 1200, glowy: 400, starry: 50 },
                    requiredOres: { shiny: 15000, glowy: 1920, starry: 120 },
                    bottleneckOre: 'glowy'
                }
            ];

            renderDraggableList(mockList, []);
            const oresPill = editorElement.querySelector('.priority-item-ores');

            let prevented = false;
            oresPill.dispatchEvent({
                type: 'keydown',
                key: 'Enter',
                preventDefault: () => { prevented = true; },
                stopPropagation: () => {}
            });
            assert.ok(prevented);
            assert.ok(popoverElement.classList.contains('show'));

            hideCardHelpPopover();
            assert.strictEqual(popoverElement.classList.contains('show'), false);

            prevented = false;
            oresPill.dispatchEvent({
                type: 'keydown',
                key: ' ',
                preventDefault: () => { prevented = true; },
                stopPropagation: () => {}
            });
            assert.ok(prevented);
            assert.ok(popoverElement.classList.contains('show'));
        });

        test('handles desktop mouse hover and leave cleanly', () => {
            const mockList = [
                {
                    heroName: 'Barbarian King',
                    name: 'Giant Gauntlet',
                    step: 1,
                    targetLevel: 18,
                    image: 'assets/giant_gauntlet.png',
                    completionDate: new Date('2026-09-01'),
                    oresPreCompletion: { shiny: 1200, glowy: 400, starry: 50 },
                    requiredOres: { shiny: 15000, glowy: 1920, starry: 120 },
                    bottleneckOre: 'glowy'
                }
            ];

            renderDraggableList(mockList, []);
            const oresPill = editorElement.querySelector('.priority-item-ores');

            oresPill.dispatchEvent({
                type: 'pointerenter',
                pointerType: 'mouse'
            });
            assert.ok(popoverElement.classList.contains('show'));

            oresPill.dispatchEvent({
                type: 'pointerleave',
                pointerType: 'mouse'
            });
            assert.strictEqual(popoverElement.classList.contains('show'), false);

            oresPill.dispatchEvent({
                type: 'pointerenter',
                pointerType: 'touch'
            });
            assert.strictEqual(popoverElement.classList.contains('show'), false);
        });
    });

    describe('Edge Cases and Safety Guards', () => {
        test('does not render .priority-item-ores when step has error or order mismatch', () => {
            const errorList = [
                {
                    heroName: 'Barbarian King',
                    name: 'Giant Gauntlet',
                    step: 2,
                    targetLevel: 18,
                    image: 'assets/giant_gauntlet.png',
                    error: true,
                    message: 'Order error'
                }
            ];

            renderDraggableList(errorList, []);

            const item = editorElement.querySelector('.priority-list-editor-item');
            assert.ok(item);
            const oresPill = item.querySelector('.priority-item-ores');
            assert.strictEqual(oresPill, null);
        });

        test('safely handles missing optional ore breakdown properties', () => {
            const incompleteList = [
                {
                    heroName: 'Barbarian King',
                    name: 'Giant Gauntlet',
                    step: 1,
                    targetLevel: 18,
                    image: 'assets/giant_gauntlet.png',
                    completionDate: new Date('2026-09-01'),
                }
            ];

            assert.doesNotThrow(() => {
                renderDraggableList(incompleteList, []);
            });

            const item = editorElement.querySelector('.priority-list-editor-item');
            assert.ok(item);
            assert.strictEqual(item.querySelector('.priority-item-ores'), null);
        });
    });
});
