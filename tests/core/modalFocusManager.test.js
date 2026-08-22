import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { getInitialModalFocusTarget } from '../../js/utils/modalHistoryManager.js';

class MockClassList {
    constructor(initial = '') {
        this._set = new Set(initial.split(/\s+/).filter(Boolean));
    }
    add(...tokens) { tokens.forEach(t => this._set.add(t)); }
    remove(...tokens) { tokens.forEach(t => this._set.delete(t)); }
    contains(token) { return this._set.has(token); }
    has(token) { return this._set.has(token); }
    get size() { return this._set.size; }
    toString() { return Array.from(this._set).join(' '); }
}

class MockDOMElement {
    constructor(tagName = 'div', attributes = {}, parent = null) {
        this.tagName = tagName.toUpperCase();
        this.attributes = new Map();
        this.classList = new MockClassList();
        this.children = [];
        this.parent = parent;
        this.parentElement = parent;
        this.parentNode = parent;
        this.style = {};
        this.disabled = false;
        this.hidden = false;
        this.tabIndex = 0;

        for (const [key, value] of Object.entries(attributes)) {
            this.setAttribute(key, value);
        }
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
        if (name === 'class') {
            this.classList = new MockClassList(String(value));
        } else if (name === 'id') {
            this.id = String(value);
        } else if (name === 'disabled') {
            this.disabled = true;
        } else if (name === 'hidden') {
            this.hidden = true;
        } else if (name === 'tabindex') {
            this.tabIndex = parseInt(value, 10);
        }
    }

    getAttribute(name) {
        if (this.attributes.has(name)) {
            return this.attributes.get(name);
        }
        if (name === 'class') {
            return this.classList.toString();
        }
        if (name === 'id') {
            return this.id || null;
        }
        if (name === 'tabindex') {
            return String(this.tabIndex);
        }
        return null;
    }

    hasAttribute(name) {
        return this.attributes.has(name) || (name === 'id' && !!this.id) || (name === 'class' && this.classList.size > 0);
    }

    appendChild(child) {
        child.parent = this;
        child.parentElement = this;
        child.parentNode = this;
        this.children.push(child);
        return child;
    }

    matches(selector) {
        const selectorList = selector.split(',').map(s => s.trim());
        return selectorList.some(sel => {
            const parts = sel.split(/\s+/);
            let simple = parts[parts.length - 1];

            const notMatches = Array.from(simple.matchAll(/:not\(([^)]+)\)/g));
            for (const notMatch of notMatches) {
                const innerSelector = notMatch[1].trim();
                if (innerSelector === '[disabled]' && (this.disabled || this.hasAttribute('disabled'))) {
                    return false;
                }
                const innerAttr = innerSelector.match(/^\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\]$/);
                if (innerAttr) {
                    const attrName = innerAttr[1];
                    const attrVal = innerAttr[2];
                    if (attrVal !== undefined) {
                        if (this.getAttribute(attrName) === attrVal) return false;
                    } else if (this.hasAttribute(attrName)) {
                        return false;
                    }
                }
            }
            simple = simple.replace(/:not\([^)]+\)/g, '');

            const tagMatch = simple.match(/^([a-zA-Z0-9_-]+)/);
            if (tagMatch) {
                const tagName = tagMatch[1].toUpperCase();
                if (this.tagName !== tagName) return false;
                simple = simple.slice(tagMatch[0].length);
            }

            const idMatch = simple.match(/#([a-zA-Z0-9_-]+)/);
            if (idMatch) {
                const id = idMatch[1];
                if (this.id !== id) return false;
            }

            const classMatches = simple.match(/\.([a-zA-Z0-9_-]+)/g);
            if (classMatches) {
                for (const cls of classMatches) {
                    const className = cls.slice(1);
                    if (!this.classList.has(className)) return false;
                }
            }

            const attrMatches = Array.from(simple.matchAll(/\[([a-zA-Z0-9_-]+)(?:([*~|^$]?=)"([^"]*)")?\]/g));
            if (attrMatches.length > 0) {
                for (const attrMatch of attrMatches) {
                    const attrName = attrMatch[1];
                    const op = attrMatch[2];
                    const attrVal = attrMatch[3];
                    if (!this.hasAttribute(attrName)) return false;
                    const actualVal = this.getAttribute(attrName);
                    if (op === '=' && actualVal !== attrVal) return false;
                    if (op === '*=' && (!actualVal || !actualVal.includes(attrVal))) return false;
                }
            } else if (simple.startsWith('[') && simple.endsWith(']')) {
                return false;
            }

            return true;
        });
    }

    closest(selector) {
        let current = this;
        while (current) {
            if (typeof current.matches === 'function' && current.matches(selector)) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }

    querySelectorAll(selector) {
        const results = [];
        const selectorList = selector.split(',').map(s => s.trim());

        const traverse = (node) => {
            for (const child of node.children) {
                for (const singleSelector of selectorList) {
                    const parts = singleSelector.split(/\s+/);
                    if (parts.length === 1) {
                        if (child.matches(parts[0])) {
                            results.push(child);
                            break;
                        }
                    } else if (parts.length === 2) {
                        if (child.matches(parts[1]) && child.closest(parts[0])) {
                            results.push(child);
                            break;
                        }
                    } else {
                        if (child.matches(parts[parts.length - 1])) {
                            results.push(child);
                            break;
                        }
                    }
                }
                traverse(child);
            }
        };

        traverse(this);
        return results;
    }

    querySelector(selector) {
        const list = this.querySelectorAll(selector);
        return list.length > 0 ? list[0] : null;
    }

    focus() {
        this.focused = true;
    }
}

describe('WAI-ARIA Modal Initial Focus Target Resolver', () => {

    test('resolves explicit data-modal-autofocus element regardless of position', () => {
        const modal = new MockDOMElement('div', { class: 'modal', id: 'test-modal' });
        const header = modal.appendChild(new MockDOMElement('div', { class: 'modal-header' }));
        header.appendChild(new MockDOMElement('button', { class: 'close-button' }));

        const body = modal.appendChild(new MockDOMElement('div', { class: 'modal-body' }));
        body.appendChild(new MockDOMElement('input', { type: 'text', id: 'first-input' }));
        const designatedTarget = body.appendChild(new MockDOMElement('input', {
            type: 'text',
            id: 'autofocus-target',
            'data-modal-autofocus': ''
        }));

        const target = getInitialModalFocusTarget(modal);
        assert.equal(target, designatedTarget);
    });

    test('resolves native HTML5 autofocus attribute', () => {
        const modal = new MockDOMElement('div', { class: 'modal' });
        const body = modal.appendChild(new MockDOMElement('div', { class: 'modal-body' }));
        body.appendChild(new MockDOMElement('input', { type: 'text', id: 'normal-input' }));
        const autofocusInput = body.appendChild(new MockDOMElement('input', {
            type: 'text',
            id: 'html5-autofocus',
            autofocus: ''
        }));

        const target = getInitialModalFocusTarget(modal);
        assert.equal(target, autofocusInput);
    });

    test('resolves first text/number input in modal body, skipping header close button', () => {
        const modal = new MockDOMElement('div', { class: 'modal', id: 'add-player-modal' });
        const header = modal.appendChild(new MockDOMElement('div', { class: 'modal-header' }));
        header.appendChild(new MockDOMElement('button', { class: 'close-button', id: 'header-close' }));

        const body = modal.appendChild(new MockDOMElement('div', { class: 'modal-body' }));
        const playerTagInput = body.appendChild(new MockDOMElement('input', {
            type: 'text',
            id: 'player-tag-input-modal'
        }));
        body.appendChild(new MockDOMElement('input', { type: 'text', id: 'player-token-input' }));

        const actions = modal.appendChild(new MockDOMElement('div', { class: 'modal-actions' }));
        actions.appendChild(new MockDOMElement('button', { class: 'reject-button' }));
        actions.appendChild(new MockDOMElement('button', { class: 'accept-button' }));

        const target = getInitialModalFocusTarget(modal);
        assert.equal(target, playerTagInput);
    });

    test('resolves first select dropdown in modal body when no text input exists', () => {
        const modal = new MockDOMElement('div', { class: 'modal', id: 'calendar-settings-modal' });
        const header = modal.appendChild(new MockDOMElement('div', { class: 'modal-header' }));
        header.appendChild(new MockDOMElement('button', { class: 'close-button' }));

        const body = modal.appendChild(new MockDOMElement('div', { class: 'modal-body' }));
        const firstSelect = body.appendChild(new MockDOMElement('select', { id: 'calendar-first-day-select' }));
        body.appendChild(new MockDOMElement('input', { type: 'checkbox', id: 'some-switch' }));

        const target = getInitialModalFocusTarget(modal);
        assert.equal(target, firstSelect);
    });

    test('resolves first checkbox or radio toggle in modal body when text inputs are absent', () => {
        const modal = new MockDOMElement('div', { class: 'modal' });
        const header = modal.appendChild(new MockDOMElement('div', { class: 'modal-header' }));
        header.appendChild(new MockDOMElement('button', { class: 'close-button' }));

        const body = modal.appendChild(new MockDOMElement('div', { class: 'modal-body' }));
        const firstCheckbox = body.appendChild(new MockDOMElement('input', { type: 'checkbox', id: 'toggle-1' }));
        body.appendChild(new MockDOMElement('input', { type: 'checkbox', id: 'toggle-2' }));

        const target = getInitialModalFocusTarget(modal);
        assert.equal(target, firstCheckbox);
    });

    test('resolves primary confirm/accept button in modal-actions for confirmation dialogs', () => {
        const modal = new MockDOMElement('div', { class: 'modal', id: 'download-data-modal' });
        const header = modal.appendChild(new MockDOMElement('div', { class: 'modal-header' }));
        header.appendChild(new MockDOMElement('button', { class: 'close-button' }));

        const body = modal.appendChild(new MockDOMElement('div', { class: 'modal-body' }));
        body.appendChild(new MockDOMElement('p', { class: 'info-text' }));

        const actions = modal.appendChild(new MockDOMElement('div', { class: 'modal-actions' }));
        actions.appendChild(new MockDOMElement('button', { class: 'reject-button', id: 'cancel-btn' }));
        const confirmBtn = actions.appendChild(new MockDOMElement('button', {
            class: 'accept-button',
            id: 'confirm-btn'
        }));

        const target = getInitialModalFocusTarget(modal);
        assert.equal(target, confirmBtn);
    });

    test('resolves first interactive body element when no inputs or action buttons exist', () => {
        const modal = new MockDOMElement('div', { class: 'modal', id: 'accent-picker-modal' });
        const header = modal.appendChild(new MockDOMElement('div', { class: 'modal-header' }));
        header.appendChild(new MockDOMElement('button', { class: 'close-button' }));

        const body = modal.appendChild(new MockDOMElement('div', { class: 'modal-body' }));
        const firstSwatch = body.appendChild(new MockDOMElement('button', { class: 'mobile-accent-swatch', id: 'swatch-blue' }));
        body.appendChild(new MockDOMElement('button', { class: 'mobile-accent-swatch', id: 'swatch-gold' }));

        const target = getInitialModalFocusTarget(modal);
        assert.equal(target, firstSwatch);
    });

    test('resolves action button in modal-actions for read-only modals', () => {
        const modal = new MockDOMElement('div', { class: 'modal', id: 'changelog-modal' });
        const header = modal.appendChild(new MockDOMElement('div', { class: 'modal-header' }));
        header.appendChild(new MockDOMElement('button', { class: 'close-button', id: 'header-close' }));

        const body = modal.appendChild(new MockDOMElement('div', { class: 'modal-body' }));
        body.appendChild(new MockDOMElement('div', { class: 'changelog-text' }));

        const actions = modal.appendChild(new MockDOMElement('div', { class: 'modal-actions' }));
        const closeBtn = actions.appendChild(new MockDOMElement('button', { class: 'reject-button', id: 'footer-close' }));

        const target = getInitialModalFocusTarget(modal);
        assert.equal(target, closeBtn);
    });

    test('falls back to header close button when no body or footer candidates exist', () => {
        const modal = new MockDOMElement('div', { class: 'modal', id: 'commits-modal' });
        const header = modal.appendChild(new MockDOMElement('div', { class: 'modal-header' }));
        const headerClose = header.appendChild(new MockDOMElement('button', { class: 'close-button', id: 'close-commits' }));

        const body = modal.appendChild(new MockDOMElement('div', { class: 'modal-body' }));
        body.appendChild(new MockDOMElement('div', { class: 'empty-list' }));

        const target = getInitialModalFocusTarget(modal);
        assert.equal(target, headerClose);
    });

    test('skips disabled and aria-disabled elements', () => {
        const modal = new MockDOMElement('div', { class: 'modal' });
        const body = modal.appendChild(new MockDOMElement('div', { class: 'modal-body' }));
        body.appendChild(new MockDOMElement('input', { type: 'text', id: 'disabled-input', disabled: '' }));
        body.appendChild(new MockDOMElement('input', { type: 'text', id: 'aria-disabled-input', 'aria-disabled': 'true' }));
        const activeInput = body.appendChild(new MockDOMElement('input', { type: 'text', id: 'active-input' }));

        const target = getInitialModalFocusTarget(modal);
        assert.equal(target, activeInput);
    });

    test('skips hidden and display:none elements', () => {
        const modal = new MockDOMElement('div', { class: 'modal' });
        const body = modal.appendChild(new MockDOMElement('div', { class: 'modal-body' }));

        const hiddenContainer = body.appendChild(new MockDOMElement('div', { class: 'hidden' }));
        hiddenContainer.appendChild(new MockDOMElement('input', { type: 'text', id: 'in-hidden-container' }));

        const displayNoneInput = body.appendChild(new MockDOMElement('input', { type: 'text', id: 'display-none-input' }));
        displayNoneInput.style.display = 'none';

        const visibleInput = body.appendChild(new MockDOMElement('input', { type: 'text', id: 'visible-input' }));

        const target = getInitialModalFocusTarget(modal);
        assert.equal(target, visibleInput);
    });

    test('handles null, undefined, and non-element input gracefully', () => {
        assert.equal(getInitialModalFocusTarget(null), null);
        assert.equal(getInitialModalFocusTarget(undefined), null);
        assert.equal(getInitialModalFocusTarget({}), null);
    });
});
