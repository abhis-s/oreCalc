import { test, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));

globalThis.fetch = async (url) => {
    if (String(url).includes('/en.json')) return { ok: true, json: async () => enJson };
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
    get value() {
        return Array.from(this._classes).join(' ');
    }
}

class MockElement {
    constructor(tagName) {
        this.tagName = tagName ? tagName.toUpperCase() : 'DIV';
        this.id = '';
        this._className = '';
        this.classList = new MockClassList();
        this.innerHTML = '';
        this.textContent = '';
        this.dataset = {};
        this.style = {};
        this.children = [];
        this.parentNode = null;
        this._listeners = new Map();
    }

    get className() {
        return this.classList.value;
    }

    set className(val) {
        this._className = val;
        this.classList = new MockClassList(val);
    }

    appendChild(child) {
        if (child.parentNode) {
            child.parentNode.removeChild(child);
        }
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

    remove() {
        if (this.parentNode) {
            this.parentNode.removeChild(this);
        }
    }

    addEventListener(type, listener) {
        if (!this._listeners.has(type)) {
            this._listeners.set(type, []);
        }
        this._listeners.get(type).push(listener);
    }

    removeEventListener(type, listener) {
        const list = this._listeners.get(type);
        if (list) {
            const idx = list.indexOf(listener);
            if (idx !== -1) list.splice(idx, 1);
        }
    }

    dispatchEvent(event) {
        const list = this._listeners.get(event?.type || '');
        if (list) {
            list.forEach(fn => fn(event));
        }
        return true;
    }

    setAttribute(k, v) {
        this[k] = v;
    }

    getAttribute(k) {
        return this[k] ?? null;
    }

    contains(el) {
        if (el === this) return true;
        return this.children.some(c => c.contains(el));
    }
}

globalThis.window = {
    innerWidth: 1024,
    addEventListener: () => {},
    removeEventListener: () => {}
};

globalThis.document = {
    body: new MockElement('body'),
    createElement: (tag) => new MockElement(tag),
    getElementById: (id) => {
        const find = (el) => {
            if (el.id === id) return el;
            for (const child of el.children) {
                const res = find(child);
                if (res) return res;
            }
            return null;
        };
        return find(globalThis.document.body);
    }
};

globalThis.requestAnimationFrame = (cb) => {
    cb();
    return 1;
};

const { loadTranslations } = await import('../../js/i18n/translator.js');
await loadTranslations('en');

const {
    showToast,
    showApiErrorToast,
    formatApiErrorMessage,
    resetApiErrorCooldown,
    API_ERROR_COOLDOWN_MS
} = await import('../../js/ui/toast.js');

describe('API Error Toast System & Mute Cooldown Suite', () => {

    beforeEach(() => {
        resetApiErrorCooldown();
        globalThis.document.body.children = [];
    });

    test('formatApiErrorMessage resolves translation keys and sanitizes HTML tags', () => {
        const errorKeyMsg = formatApiErrorMessage('apiErrors.503');
        assert.ok(typeof errorKeyMsg === 'string');
        assert.ok(errorKeyMsg.length > 0);
        assert.equal(errorKeyMsg.includes('apiErrors.503'), false);

        const htmlRaw = 'Failed to load player: <code>Clash API Maintenance</code>';
        const sanitized = formatApiErrorMessage(htmlRaw);
        assert.equal(sanitized, 'Failed to load player: Clash API Maintenance');

        const objectWithErrorType = {
            success: false,
            errorType: 'apiErrors.503',
            message: 'Raw server payload'
        };
        const resolvedObj = formatApiErrorMessage(objectWithErrorType);
        assert.ok(resolvedObj.length > 0);
        assert.equal(resolvedObj.includes('apiErrors.503'), false);

        const fallback = formatApiErrorMessage(null);
        assert.ok(typeof fallback === 'string' && fallback.length > 0);
    });

    test('showApiErrorToast renders an error toast and tags it with api-error marker', () => {
        const toast = showApiErrorToast('apiErrors.503');
        assert.ok(toast);
        assert.equal(toast.classList.contains('toast-api-error'), true);
        assert.equal(toast.classList.contains('toast-error'), true);
        assert.equal(toast.dataset.toastCategory, 'api-error');

        const container = globalThis.document.getElementById('toast-container');
        assert.ok(container);
        assert.ok(container.children.includes(toast));
    });

    test('showApiErrorToast enforces 2-minute mute cooldown and drops duplicate errors', () => {
        assert.equal(API_ERROR_COOLDOWN_MS, 120000);

        const firstToast = showApiErrorToast('apiErrors.503');
        assert.ok(firstToast, 'First API error toast should be displayed');

        const secondToast = showApiErrorToast('apiErrors.500');
        assert.equal(secondToast, null, 'Second API error toast within 2 minutes must be dropped');

        const thirdToast = showApiErrorToast('apiErrors.serverOffline');
        assert.equal(thirdToast, null, 'Third API error toast within 2 minutes must be dropped');

        const container = globalThis.document.getElementById('toast-container');
        const apiToasts = container.children.filter(c => c.classList.contains('toast-api-error'));
        assert.equal(apiToasts.length, 1);
    });

    test('showApiErrorToast displays a new error once 2-minute timer has expired', () => {
        const firstToast = showApiErrorToast('apiErrors.503');
        assert.ok(firstToast);

        const droppedToast = showApiErrorToast('apiErrors.500');
        assert.equal(droppedToast, null);

        resetApiErrorCooldown();

        const afterMuteToast = showApiErrorToast('apiErrors.500');
        assert.ok(afterMuteToast, 'Error toast after cooldown expiration should be displayed');
    });

    test('showApiErrorToast enforces strictly at most 1 visible API error toast at a time', () => {
        const firstToast = showApiErrorToast('apiErrors.503');
        assert.ok(firstToast);

        resetApiErrorCooldown();

        const secondToast = showApiErrorToast('apiErrors.500');
        assert.ok(secondToast);

        const container = globalThis.document.getElementById('toast-container');
        const apiToasts = container.children.filter(c => c.classList.contains('toast-api-error'));
        assert.equal(apiToasts.length, 1);
        assert.equal(apiToasts[0], secondToast);
    });

    test('base showToast configuration is preserved and unaffected by API error mute', () => {
        const apiToast = showApiErrorToast('apiErrors.503');
        assert.ok(apiToast);

        const droppedApiToast = showApiErrorToast('apiErrors.500');
        assert.equal(droppedApiToast, null);

        const validationToast1 = showToast('Please enter a valid amount', 'warning');
        assert.ok(validationToast1, 'Standard validation warning toast must not be muted');

        const validationToast2 = showToast('Value cannot be negative', 'error');
        assert.ok(validationToast2, 'Standard validation error toast must not be muted');

        const successToast = showToast('Settings saved successfully', 'success');
        assert.ok(successToast, 'Standard success toast must not be muted');

        const container = globalThis.document.getElementById('toast-container');
        assert.equal(container.children.length, 4);
    });

    test('showApiErrorToast tracks cooldown strictly in memory', () => {
        const firstToast = showApiErrorToast('apiErrors.503');
        assert.ok(firstToast);

        const suppressedToast = showApiErrorToast('apiErrors.500');
        assert.equal(suppressedToast, null);

        resetApiErrorCooldown();

        const retryToast = showApiErrorToast('apiErrors.500');
        assert.ok(retryToast);
    });
});
