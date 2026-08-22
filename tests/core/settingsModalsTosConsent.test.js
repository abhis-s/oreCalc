import { test, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';

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

    insertBefore(newChild, referenceChild) {
        newChild.parentNode = this;
        if (!referenceChild) {
            this.children.push(newChild);
            return newChild;
        }
        const idx = this.children.indexOf(referenceChild);
        if (idx === -1) {
            this.children.push(newChild);
        } else {
            this.children.splice(idx, 0, newChild);
        }
        return newChild;
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

    click() {
        if (typeof this.onclick === 'function') {
            this.onclick({ preventDefault: () => {} });
        }
        this.dispatchEvent('click');
    }
}

function matchesSelector(element, selector) {
    if (!selector || !element) return false;
    const s = selector.trim();
    if (s.startsWith('#')) {
        return element.id === s.slice(1);
    }
    if (s.startsWith('.')) {
        return element.classList.contains(s.slice(1));
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

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        addEventListener: () => {},
        removeEventListener: () => {},
        requestAnimationFrame: (cb) => { cb(); return 1; },
        cancelAnimationFrame: () => {},
        scrollTo: () => {},
        location: { hostname: 'localhost' },
        __ENV__: { APP_VERSION: '2.1.0' }
    };
} else {
    if (!globalThis.window.location) {
        globalThis.window.location = { hostname: 'localhost' };
    }
    if (!globalThis.window.__ENV__) {
        globalThis.window.__ENV__ = { APP_VERSION: '2.1.0' };
    }
}

const documentEventListeners = new Map();

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        body: mockDocumentBody,
        createElement: (tag) => new MockDOMElement(tag),
        getElementById: (id) => elementsById.get(id) || null,
        querySelector: (sel) => querySelectorInternal(mockDocumentBody, sel),
        querySelectorAll: (sel) => querySelectorAllInternal(mockDocumentBody, sel),
        addEventListener: (event, handler) => {
            if (!documentEventListeners.has(event)) documentEventListeners.set(event, []);
            documentEventListeners.get(event).push(handler);
        },
        removeEventListener: (event, handler) => {
            if (documentEventListeners.has(event)) {
                const list = documentEventListeners.get(event);
                const idx = list.indexOf(handler);
                if (idx !== -1) list.splice(idx, 1);
            }
        },
        dispatchEvent: (evt) => {
            const eventType = typeof evt === 'string' ? evt : (evt.type || '');
            const handlers = documentEventListeners.get(eventType) || [];
            handlers.forEach(fn => fn(evt));
            return true;
        }
    };
} else {
    globalThis.document.getElementById = (id) => elementsById.get(id) || null;
    globalThis.document.querySelector = (sel) => querySelectorInternal(mockDocumentBody, sel);
    globalThis.document.querySelectorAll = (sel) => querySelectorAllInternal(mockDocumentBody, sel);
    globalThis.document.createElement = (tag) => new MockDOMElement(tag);
    globalThis.document.addEventListener = (event, handler) => {
        if (!documentEventListeners.has(event)) documentEventListeners.set(event, []);
        documentEventListeners.get(event).push(handler);
    };
    globalThis.document.removeEventListener = (event, handler) => {
        if (documentEventListeners.has(event)) {
            const list = documentEventListeners.get(event);
            const idx = list.indexOf(handler);
            if (idx !== -1) list.splice(idx, 1);
        }
    };
    globalThis.document.dispatchEvent = (evt) => {
        const eventType = typeof evt === 'string' ? evt : (evt.type || '');
        const handlers = documentEventListeners.get(eventType) || [];
        handlers.forEach(fn => fn(evt));
        return true;
    };
}

if (typeof globalThis.CustomEvent === 'undefined') {
    globalThis.CustomEvent = class CustomEvent {
        constructor(type, eventInitDict = {}) {
            this.type = type;
            this.detail = eventInitDict.detail || null;
        }
    };
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

const { state, EFFECTIVE_DATE_TERMS } = await import('../../js/core/state.js');
const { openTermsOfUseModal } = await import('../../js/components/appSettings/settingsModals.js');
const { migrateAppSettings } = await import('../../js/core/stateCleanup.js');
const { translate } = await import('../../js/i18n/translator.js');

describe('Settings Modals ToS Consent Standardization Suite', () => {
    let termsModal;
    let termsModalActions;
    let closeTermsBtn;
    let acceptTermsBtn;
    let closeHeaderBtn;

    beforeEach(() => {
        elementsById.clear();
        documentEventListeners.clear();
        mockDocumentBody.children = [];

        termsModal = new MockDOMElement('div', 'terms-modal', 'modal');
        const termsContent = new MockDOMElement('div', '', 'modal-content');
        termsModalActions = new MockDOMElement('div', '', 'modal-actions');
        closeHeaderBtn = new MockDOMElement('button', 'close-terms-header-btn', 'close-header-btn');
        closeTermsBtn = new MockDOMElement('button', 'close-terms-modal-btn', 'reject-button');
        acceptTermsBtn = new MockDOMElement('button', 'accept-terms-modal-btn', 'accept-button');
        acceptTermsBtn.style.display = 'none';

        termsModal.appendChild(closeHeaderBtn);
        termsModalActions.appendChild(closeTermsBtn);
        termsModalActions.appendChild(acceptTermsBtn);
        termsContent.appendChild(termsModalActions);
        termsModal.appendChild(termsContent);

        elementsById.set('terms-modal', termsModal);
        elementsById.set('close-terms-header-btn', closeHeaderBtn);
        elementsById.set('close-terms-modal-btn', closeTermsBtn);
        elementsById.set('accept-terms-modal-btn', acceptTermsBtn);

        if (!state.uiSettings) state.uiSettings = {};
        state.uiSettings.uiTimestamps = {
            privacy: null,
            tos: null,
            welcome: null,
            tour: null
        };
        state.uiSettings.language = 'en';
    });

    test('openTermsOfUseModal: Informational Mode when tos timestamp is valid and >= EFFECTIVE_DATE_TERMS', () => {
        state.uiSettings.uiTimestamps.tos = EFFECTIVE_DATE_TERMS + 5000;
        delete state.uiSettings.uiTimestamps.terms;

        openTermsOfUseModal();

        assert.equal(closeTermsBtn.classList.contains('reject-button'), true);
        assert.equal(closeTermsBtn.getAttribute('data-i18n'), 'actions.close');
        assert.equal(closeTermsBtn.textContent, translate('actions.close'));
        assert.equal(acceptTermsBtn.style.display, 'none');
    });

    test('openTermsOfUseModal: Consent Mode when tos timestamp is null, missing, or outdated', () => {
        state.uiSettings.uiTimestamps.tos = null;
        delete state.uiSettings.uiTimestamps.terms;

        openTermsOfUseModal();

        assert.equal(closeTermsBtn.classList.contains('reject-button'), true);
        assert.equal(closeTermsBtn.getAttribute('data-i18n'), 'actions.cancel');
        assert.equal(closeTermsBtn.textContent, translate('actions.cancel'));
        assert.equal(acceptTermsBtn.style.display, 'inline-flex');
        assert.equal(acceptTermsBtn.getAttribute('data-i18n'), 'actions.accept');
        assert.equal(acceptTermsBtn.textContent, translate('actions.accept'));
    });

    test('openTermsOfUseModal: Legacy fallback works when only terms timestamp is present in state', () => {
        state.uiSettings.uiTimestamps.tos = null;
        state.uiSettings.uiTimestamps.terms = EFFECTIVE_DATE_TERMS + 10000;

        openTermsOfUseModal();

        assert.equal(closeTermsBtn.getAttribute('data-i18n'), 'actions.close');
        assert.equal(acceptTermsBtn.style.display, 'none');
    });

    test('openTermsOfUseModal: Legacy fallback enters Consent Mode when terms timestamp is outdated', () => {
        state.uiSettings.uiTimestamps.tos = null;
        state.uiSettings.uiTimestamps.terms = EFFECTIVE_DATE_TERMS - 10000;

        openTermsOfUseModal();

        assert.equal(closeTermsBtn.getAttribute('data-i18n'), 'actions.cancel');
        assert.equal(acceptTermsBtn.style.display, 'inline-flex');
    });

    test('handleAccept: Sets state.uiSettings.uiTimestamps.tos and prunes legacy terms key', () => {
        state.uiSettings.uiTimestamps.tos = null;
        state.uiSettings.uiTimestamps.terms = 1700000000000;

        let closeEventFired = false;
        documentEventListeners.set('terms:close', [() => { closeEventFired = true; }]);

        openTermsOfUseModal();
        assert.equal(acceptTermsBtn.style.display, 'inline-flex');

        const startTime = Date.now();
        acceptTermsBtn.click();

        assert.ok(typeof state.uiSettings.uiTimestamps.tos === 'number');
        assert.ok(state.uiSettings.uiTimestamps.tos >= startTime);
        assert.equal('terms' in state.uiSettings.uiTimestamps, false);
        assert.equal(closeEventFired, true);
    });

    test('migrateAppSettings: Normalizes legacy terms to tos and omits orphaned terms property', () => {
        const oldUI = {
            currency: 'USD',
            language: 'en',
            uiTimestamps: {
                privacy: 1786060800000,
                terms: 1780617600000,
                welcome: 1780617600000,
                tour: 1780617600000
            }
        };

        const migrated = migrateAppSettings(oldUI);

        assert.equal(migrated.uiTimestamps.tos, 1780617600000);
        assert.equal('terms' in migrated.uiTimestamps, false);
        assert.equal(migrated.uiTimestamps.privacy, 1786060800000);
        assert.equal(migrated.uiTimestamps.welcome, 1780617600000);
        assert.equal(migrated.uiTimestamps.tour, 1780617600000);
    });

    test('migrateAppSettings: Prefers canonical tos over legacy terms when both are present', () => {
        const oldUI = {
            currency: 'EUR',
            uiTimestamps: {
                privacy: 1786060800000,
                tos: 1790000000000,
                terms: 1780000000000,
                welcome: null,
                tour: null
            }
        };

        const migrated = migrateAppSettings(oldUI);

        assert.equal(migrated.uiTimestamps.tos, 1790000000000);
        assert.equal('terms' in migrated.uiTimestamps, false);
    });
});
