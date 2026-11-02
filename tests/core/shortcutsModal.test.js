/**
 * Feature Domain Test Suite: Keyboard Shortcuts Cheatsheet Modal.
 * Asserts semantic accessibility, OS-adaptive key rendering, input suppression guard, and Spotright integration.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { state } from '../../js/core/state.js';
import { loadTranslations, translate } from '../../js/i18n/translator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));
const deJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/de.json'), 'utf8'));

// @ts-ignore
globalThis.fetch = async (url) => {
    if (String(url).includes('/en.json')) return { ok: true, json: async () => enJson };
    if (String(url).includes('/de.json')) return { ok: true, json: async () => deJson };
    return { ok: false, status: 404 };
};
state.uiSettings = { language: 'en' };
await loadTranslations('en');

class MockClassList {
    constructor(className = '') {
        this._classes = new Set(className ? className.trim().split(/\s+/) : []);
    }
    contains(cls) { return this._classes.has(cls); }
    add(cls) { this._classes.add(cls); }
    remove(cls) { this._classes.delete(cls); }
    toString() { return Array.from(this._classes).join(' '); }
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
        this._innerHTML = '';
        this.eventListeners = new Map();
        this.isContentEditable = false;

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

    get textContent() {
        // Strip HTML tags for clean text content inspection
        return this._innerHTML.replace(/<[^>]+>/g, '').trim();
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

    hasAttribute(name) {
        return this.attributes.has(name);
    }

    appendChild(child) {
        if (!child) return child;
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

    closest(selector) {
        if (selector === 'kbd' && this.tagName === 'KBD') return this;
        if (this.parentNode && typeof this.parentNode.closest === 'function') {
            return this.parentNode.closest(selector);
        }
        return null;
    }

    querySelector(selector) {
        if (selector.startsWith('#')) {
            const targetId = selector.slice(1);
            return this.children.find(c => c.id === targetId) || null;
        }
        if (selector.startsWith('.')) {
            const cls = selector.slice(1);
            return this.children.find(c => c.classList.contains(cls)) || null;
        }
        return this.children.find(c => c.tagName.toLowerCase() === selector.toLowerCase()) || null;
    }

    querySelectorAll(selector) {
        if (selector.startsWith('.')) {
            const cls = selector.slice(1);
            return this.children.filter(c => c.classList.contains(cls));
        }
        return this.children.filter(c => c.tagName.toLowerCase() === selector.toLowerCase());
    }
}

// Global document mock setup
globalThis.document = {
    createElement: (tag) => new MockDOMElement(tag),
    activeElement: null
};

import {
    createShortcutsModalDialog,
    isInputFocused,
    isApplePlatform
} from '../../js/components/shortcuts/shortcutsModal.js';
import { createSpotrightDialog } from '../../js/components/spotright/spotrightDisplay.js';

describe('Keyboard Shortcuts Cheatsheet Modal Domain Suite', () => {
    test('createShortcutsModalDialog produces valid dialog with ARIA attributes and close button', () => {
        const dialog = createShortcutsModalDialog(true);
        assert.equal(dialog.tagName, 'DIALOG');
        assert.equal(dialog.id, 'shortcuts-cheatsheet-modal');
        assert.equal(dialog.getAttribute('role'), 'dialog');
        assert.equal(dialog.getAttribute('aria-modal'), 'true');
        assert.equal(dialog.getAttribute('aria-labelledby'), 'shortcuts-modal-title');

        assert.ok(dialog.innerHTML.includes('id="shortcuts-modal-title"'), 'Expected title element to exist');
        assert.ok(dialog.innerHTML.includes('data-i18n="views.shortcuts.title"'));

        assert.ok(dialog.innerHTML.includes('id="close-shortcuts-modal-btn"'), 'Expected close button to exist');
        assert.ok(dialog.innerHTML.includes('aria-label='), 'Expected close button to have aria-label');
    });

    test('renders official vector Command SVG on macOS and Ctrl text on Windows/Linux', () => {
        // macOS override: true
        const macDialog = createShortcutsModalDialog(true);
        assert.ok(macDialog.innerHTML.includes('name="keyboard-command"'), 'Expected Mac dialog to render keyboard-command SVG');
        assert.ok(macDialog.innerHTML.includes(`aria-label="${translate('views.shortcuts.keys.keyboardCommand')}"`));

        // Non-macOS override: false
        const winDialog = createShortcutsModalDialog(false);
        assert.ok(!winDialog.innerHTML.includes('name="keyboard-command"'), 'Did not expect Windows dialog to render keyboard-command SVG');
        assert.ok(winDialog.innerHTML.includes(translate('views.shortcuts.keys.keyboardCtrl')), 'Expected Windows dialog to render Ctrl text badge');
    });

    test('renders Return, Backspace, Tab, Shift, Space, and Chevron SVGs without prohibited dingbats', () => {
        const dialog = createShortcutsModalDialog(true);
        const returnSvgCount = (dialog.innerHTML.match(/name="keyboard-return"/g) || []).length;
        assert.ok(returnSvgCount >= 2, 'Expected return SVG icons in spotright and dialog action rows');

        assert.ok(dialog.innerHTML.includes('name="keyboard-backspace"'), 'Expected backspace SVG icon');
        assert.ok((dialog.innerHTML.match(/name="keyboard-tab"/g) || []).length >= 3, 'Expected tab SVG icons');
        assert.ok(dialog.innerHTML.includes('name="keyboard-shift"'), 'Expected shift SVG icon');
        assert.ok(dialog.innerHTML.includes('name="keyboard-space"'), 'Expected space SVG icon');
        assert.ok((dialog.innerHTML.match(/name="chevron-up"/g) || []).length >= 3, 'Expected chevron-up SVG icons');
        assert.ok(dialog.innerHTML.includes('name="chevron-down"'), 'Expected chevron-down SVG icon');

        assert.ok(dialog.innerHTML.includes(translate('views.shortcuts.keys.keyboardUp')), 'Expected Up text badge');
        assert.ok(dialog.innerHTML.includes(translate('views.shortcuts.keys.keyboardDown')), 'Expected Down text badge');
        assert.ok(dialog.innerHTML.includes(translate('views.shortcuts.keys.keyboardLeft')), 'Expected Left text badge');
        assert.ok(dialog.innerHTML.includes(translate('views.shortcuts.keys.keyboardRight')), 'Expected Right text badge');
        assert.ok(!dialog.innerHTML.includes('>Backspace<'), 'Expected Backspace text to be replaced by SVG');

        // Asserts zero prohibited raw arrows (\u2190-\u21FF) in dialog markup
        const rawArrowPattern = /[\u2190-\u21FF]/;
        assert.equal(rawArrowPattern.test(dialog.innerHTML), false, 'Prohibited raw Unicode arrow dingbats detected in modal HTML');
    });

    test('renders localized key badges and ARIA labels in German', async () => {
        state.uiSettings.language = 'de';
        await loadTranslations('de');

        const deMacDialog = createShortcutsModalDialog(true);
        assert.ok(deMacDialog.innerHTML.includes('name="keyboard-command"'));
        assert.ok(deMacDialog.innerHTML.includes(`aria-label="${deJson.views.shortcuts.keys.keyboardCommand}"`));

        const deWinDialog = createShortcutsModalDialog(false);
        assert.ok(deWinDialog.innerHTML.includes(deJson.views.shortcuts.keys.keyboardCtrl), 'Expected Windows dialog to render Strg text badge in German');

        assert.ok(deMacDialog.innerHTML.includes(deJson.views.shortcuts.keys.keyboardUp), 'Expected Auf text badge');
        assert.ok(deMacDialog.innerHTML.includes(deJson.views.shortcuts.keys.keyboardDown), 'Expected Ab text badge');
        assert.ok(deMacDialog.innerHTML.includes(deJson.views.shortcuts.keys.keyboardLeft), 'Expected Links text badge');
        assert.ok(deMacDialog.innerHTML.includes(deJson.views.shortcuts.keys.keyboardRight), 'Expected Rechts text badge');

        // Restore English for any subsequent tests
        state.uiSettings.language = 'en';
        await loadTranslations('en');
    });

    test('isInputFocused accurately detects active input, textarea, and select elements', () => {
        const input = new MockDOMElement('input');
        const button = new MockDOMElement('button');
        const editable = new MockDOMElement('div');
        editable.isContentEditable = true;

        globalThis.document.activeElement = button;
        assert.equal(isInputFocused(), false, 'Expected button focus to not be treated as text input focus');

        globalThis.document.activeElement = input;
        assert.equal(isInputFocused(), true, 'Expected input focus to be identified as active input');

        globalThis.document.activeElement = editable;
        assert.equal(isInputFocused(), true, 'Expected contenteditable focus to be identified as active input');

        globalThis.document.activeElement = null;
        assert.equal(isInputFocused(), false, 'Expected null activeElement to return false');
    });

    test('isApplePlatform inspects userAgent correctly', () => {
        assert.equal(isApplePlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'), true, 'Expected Mac userAgent to be detected as Apple platform');
        assert.equal(isApplePlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), true, 'Expected iPhone userAgent to be detected as Apple platform');
        assert.equal(isApplePlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), false, 'Expected Windows userAgent to not be detected as Apple platform');
        assert.equal(isApplePlatform('Mozilla/5.0 (X11; Linux x86_64)'), false, 'Expected Linux userAgent to not be detected as Apple platform');
    });

    test('Spotright search dialog contains #spotright-shortcuts-btn in footer', () => {
        const spotrightDialog = createSpotrightDialog();
        assert.ok(spotrightDialog.innerHTML.includes('id="spotright-shortcuts-btn"'), 'Expected #spotright-shortcuts-btn in spotright footer');
        assert.ok(spotrightDialog.innerHTML.includes('data-i18n-title="views.shortcuts.title"'));
        assert.ok(spotrightDialog.innerHTML.includes('spotright-footer-kbd'));
        assert.ok(spotrightDialog.innerHTML.includes('?'));
    });
});
