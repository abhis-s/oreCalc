import { test, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

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
        this.value = '';
        this.type = 'text';
        this.disabled = false;
        this.eventListeners = new Map();
        this.focused = false;

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

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
        if (name === 'id') this.id = String(value);
        if (name === 'class') this.className = String(value);
    }

    getAttribute(name) {
        if (this.attributes.has(name)) return this.attributes.get(name);
        if (name === 'class') return this.classList.toString();
        if (name === 'id') return this.id || null;
        return null;
    }

    hasAttribute(name) {
        return this.attributes.has(name) || (name === 'id' && !!this.id) || (name === 'class' && this.classList.length > 0);
    }

    removeAttribute(name) {
        this.attributes.delete(name);
        if (name === 'class') this.className = '';
        if (name === 'id') this.id = '';
    }

    addEventListener(event, handler, options) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push({ handler, options });
    }

    removeEventListener(event, handler) {
        if (!this.eventListeners.has(event)) return;
        const listeners = this.eventListeners.get(event).filter(l => l.handler !== handler);
        this.eventListeners.set(event, listeners);
    }

    dispatchEvent(event) {
        const listeners = this.eventListeners.get(event.type) || [];
        listeners.forEach(({ handler }) => {
            handler.call(this, event);
        });
        return !event.defaultPrevented;
    }

    querySelector(selector) {
        if (selector.startsWith('.')) {
            const cls = selector.slice(1);
            return this.children.find(child => child.classList && child.classList.contains(cls)) || null;
        }
        return null;
    }

    querySelectorAll(selector) {
        if (selector.startsWith('.')) {
            const cls = selector.slice(1);
            return this.children.filter(child => child.classList && child.classList.contains(cls));
        }
        return [];
    }

    appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
    }

    focus() {
        this.focused = true;
    }
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

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        addEventListener: () => {},
        removeEventListener: () => {},
        requestAnimationFrame: (cb) => { cb(); return 1; },
        cancelAnimationFrame: () => {},
        getComputedStyle: () => ({ display: 'block' }),
        matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
        location: { reload: () => {} }
    };
}

const mockDocumentBody = new MockDOMElement('body');
const elementsById = new Map();

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        body: mockDocumentBody,
        createElement: (tag) => new MockDOMElement(tag),
        getElementById: (id) => elementsById.get(id) || null,
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true
    };
} else {
    globalThis.document.body = mockDocumentBody;
    globalThis.document.createElement = (tag) => new MockDOMElement(tag);
    globalThis.document.getElementById = (id) => elementsById.get(id) || null;
    if (!globalThis.document.addEventListener) globalThis.document.addEventListener = () => {};
    if (!globalThis.document.removeEventListener) globalThis.document.removeEventListener = () => {};
    if (!globalThis.document.dispatchEvent) globalThis.document.dispatchEvent = () => true;
}

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

const { dom } = await import('../../js/dom/domElements.js');
const { closeNavigationDrawer, initializeNavigation } = await import('../../js/components/layout/navigation.js');

describe('Navigation Drawer Backdrop Dismissal & Swipe-to-Close Tests', () => {

    describe('SCSS Pointer Events Alignment Verification', () => {

        test('navigation overlay SCSS specifies pointer-events: auto for .show and pointer-events: none for .closing', () => {
            const navigationScssPath = fs.existsSync(path.join(projectRoot, 'css/layout/navigation/_nav-drawer.scss'))
                ? path.join(projectRoot, 'css/layout/navigation/_nav-drawer.scss')
                : path.join(projectRoot, 'css/layout/_navigation.scss');
            const scssContent = fs.readFileSync(navigationScssPath, 'utf8');

            const overlayMatch = scssContent.match(/&__overlay\s*\{([\s\S]*?)(?=\n\s*&__content|\n\s*\}\s*$)/);
            assert.ok(overlayMatch);

            const overlayBlock = overlayMatch[1];
            assert.match(overlayBlock, /&(\.show|\s*\.show)[\s\S]*?pointer-events:\s*auto;/);
            assert.match(overlayBlock, /&(\.closing|\s*\.closing)[\s\S]*?pointer-events:\s*none;/);
        });

        test('preloader SCSS specifies pointer-events: auto when active and pointer-events: none when hidden', () => {
            const preloaderScssPath = path.join(projectRoot, 'css/components/_preloader.scss');
            const scssContent = fs.readFileSync(preloaderScssPath, 'utf8');

            const preloaderMatch = scssContent.match(/#preloader\s*\{([\s\S]*?)(?=\n\s*@keyframes|\n\s*\}\s*$)/);
            assert.ok(preloaderMatch);

            const preloaderBlock = preloaderMatch[1];
            assert.match(preloaderBlock, /pointer-events:\s*auto;/);

            const hiddenMatch = preloaderBlock.match(/&(\.hidden|\s*\.hidden)[\s\S]*?pointer-events:\s*none;/);
            assert.ok(hiddenMatch);
        });

        test('modal and global overlay SCSS maintain consistent pointer-events declarations', () => {
            const modalScss = fs.readFileSync(path.join(projectRoot, 'css/base/modal/_modal-backdrop.scss'), 'utf8');
            const overlayScss = fs.readFileSync(path.join(projectRoot, 'css/components/_overlay.scss'), 'utf8');

            assert.match(modalScss, /&(\.show|\s*\.show)[\s\S]*?pointer-events:\s*auto;/);
            assert.match(modalScss, /&(\.closing|\s*\.closing)[\s\S]*?pointer-events:\s*none;/);

            assert.match(overlayScss, /&(\.show|\s*\.show)[\s\S]*?pointer-events:\s*auto;/);
            assert.match(overlayScss, /&(\.closing|\s*\.closing)[\s\S]*?pointer-events:\s*none;/);
        });
    });

    describe('Navigation Drawer Dismissal & Trigger Tests', () => {
        let drawerEl;
        let overlayEl;
        let buttonEl;
        let closeEl;
        let tab1;
        let tab2;

        beforeEach(() => {
            globalThis.document.body = new MockDOMElement('body');
            drawerEl = new MockDOMElement('nav', '', 'navigation-drawer');
            overlayEl = new MockDOMElement('div', '', 'navigation-drawer__overlay');
            buttonEl = new MockDOMElement('button', '', 'hamburger');
            closeEl = new MockDOMElement('button', '', 'navigation-drawer__close');

            tab1 = new MockDOMElement('button', '', 'navigation-drawer__tab');
            tab1.dataset.tab = 'home';
            tab2 = new MockDOMElement('button', '', 'navigation-drawer__tab');
            tab2.dataset.tab = 'settings';

            drawerEl.appendChild(tab1);
            drawerEl.appendChild(tab2);

            dom.drawer = {
                drawer: drawerEl,
                overlay: overlayEl,
                button: buttonEl,
                close: closeEl,
                tabs: [tab1, tab2]
            };

            initializeNavigation();
        });

        test('closeNavigationDrawer removes open, show, open-drawer classes and resets aria-expanded', () => {
            drawerEl.classList.add('open');
            overlayEl.classList.add('show');
            globalThis.document.body.classList.add('open-drawer');
            buttonEl.setAttribute('aria-expanded', 'true');

            closeNavigationDrawer();

            assert.equal(drawerEl.classList.contains('open'), false);
            assert.equal(overlayEl.classList.contains('show'), false);
            assert.equal(globalThis.document.body.classList.contains('open-drawer'), false);
            assert.equal(buttonEl.getAttribute('aria-expanded'), 'false');
        });

        test('clicking on backdrop overlay triggers closeNavigationDrawer', () => {
            drawerEl.classList.add('open');
            overlayEl.classList.add('show');
            globalThis.document.body.classList.add('open-drawer');
            buttonEl.setAttribute('aria-expanded', 'true');

            const clickEvent = { type: 'click', target: overlayEl, defaultPrevented: false };
            overlayEl.dispatchEvent(clickEvent);

            assert.equal(drawerEl.classList.contains('open'), false);
            assert.equal(overlayEl.classList.contains('show'), false);
            assert.equal(globalThis.document.body.classList.contains('open-drawer'), false);
            assert.equal(buttonEl.getAttribute('aria-expanded'), 'false');
        });

        test('hamburger button click toggles navigation drawer state', () => {
            assert.equal(drawerEl.classList.contains('open'), false);

            buttonEl.dispatchEvent({ type: 'click', target: buttonEl, defaultPrevented: false });
            assert.equal(drawerEl.classList.contains('open'), true);
            assert.equal(overlayEl.classList.contains('show'), true);
            assert.equal(globalThis.document.body.classList.contains('open-drawer'), true);
            assert.equal(buttonEl.getAttribute('aria-expanded'), 'true');

            buttonEl.dispatchEvent({ type: 'click', target: buttonEl, defaultPrevented: false });
            assert.equal(drawerEl.classList.contains('open'), false);
            assert.equal(overlayEl.classList.contains('show'), false);
            assert.equal(globalThis.document.body.classList.contains('open-drawer'), false);
            assert.equal(buttonEl.getAttribute('aria-expanded'), 'false');
        });
    });
});
