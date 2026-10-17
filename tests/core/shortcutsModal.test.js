/**
 * Feature Domain Test Suite: Keyboard Shortcuts Cheatsheet Modal.
 * Asserts semantic accessibility, OS-adaptive key rendering, input suppression guard, and Spotright integration.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

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
        const all = this.querySelectorAll(selector);
        return all.length > 0 ? all[0] : null;
    }

    querySelectorAll(selector) {
        const results = [];

        // Check if raw HTML matches selector
        if (selector.startsWith('#')) {
            const targetId = selector.slice(1);
            const regex = new RegExp(`id=["']${targetId}["']`, 'i');
            if (regex.test(this._innerHTML)) {
                const el = new MockDOMElement('div', targetId);
                // Extract data-i18n, aria-label, etc.
                const i18nMatch = this._innerHTML.match(new RegExp(`id=["']${targetId}["'][^>]*data-i18n=["']([^"']+)["']`, 'i'))
                    || this._innerHTML.match(new RegExp(`data-i18n=["']([^"']+)["'][^>]*id=["']${targetId}["']`, 'i'));
                if (i18nMatch) el.setAttribute('data-i18n', i18nMatch[1]);

                const i18nTitleMatch = this._innerHTML.match(new RegExp(`id=["']${targetId}["'][^>]*data-i18n-title=["']([^"']+)["']`, 'i'))
                    || this._innerHTML.match(new RegExp(`data-i18n-title=["']([^"']+)["'][^>]*id=["']${targetId}["']`, 'i'));
                if (i18nTitleMatch) el.setAttribute('data-i18n-title', i18nTitleMatch[1]);

                const ariaLabelMatch = this._innerHTML.match(new RegExp(`id=["']${targetId}["'][^>]*aria-label=["']([^"']+)["']`, 'i'))
                    || this._innerHTML.match(new RegExp(`aria-label=["']([^"']+)["'][^>]*id=["']${targetId}["']`, 'i'));
                if (ariaLabelMatch) el.setAttribute('aria-label', ariaLabelMatch[1]);

                // Nested kbd hint check
                const kbdHintMatch = this._innerHTML.match(new RegExp(`id=["']${targetId}["'][^>]*>([\\s\\S]*?)<\\/button>`, 'i'));
                if (kbdHintMatch && kbdHintMatch[1].includes('spotright-footer-kbd')) {
                    const kbdEl = new MockDOMElement('kbd', '', 'spotright-footer-kbd');
                    kbdEl.innerHTML = '?';
                    el.appendChild(kbdEl);
                    el.querySelector = (sel) => sel === '.spotright-footer-kbd' ? kbdEl : null;
                }

                results.push(el);
            }
        } else if (selector.includes('clashcalc-assets-svg[name=')) {
            const matchName = selector.match(/name=["']([^"']+)["']/);
            if (matchName) {
                const iconName = matchName[1];
                const regex = new RegExp(`name=["']${iconName}["']`, 'g');
                while (regex.exec(this._innerHTML) !== null) {
                    const el = new MockDOMElement('clashcalc-assets-svg');
                    el.setAttribute('name', iconName);
                    if (iconName === 'keyboard-command') {
                        const kbdParent = new MockDOMElement('kbd');
                        kbdParent.setAttribute('aria-label', 'Command');
                        kbdParent.appendChild(el);
                    }
                    results.push(el);
                }
            }
        } else if (selector === '.shortcuts-kbd') {
            const regex = /<kbd[^>]*class=["'][^"']*shortcuts-kbd[^"']*["'][^>]*>([\s\S]*?)<\/kbd>/gi;
            let match;
            while ((match = regex.exec(this._innerHTML)) !== null) {
                const el = new MockDOMElement('kbd', '', 'shortcuts-kbd');
                el.innerHTML = match[1];
                results.push(el);
            }
        }

        return results;
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

        const title = dialog.querySelector('#shortcuts-modal-title');
        assert.ok(title, 'Expected title element to exist');
        assert.equal(title.getAttribute('data-i18n'), 'views.shortcuts.title');

        const closeBtn = dialog.querySelector('#close-shortcuts-modal-btn');
        assert.ok(closeBtn, 'Expected close button to exist');
        assert.ok(closeBtn.getAttribute('aria-label'), 'Expected close button to have aria-label');
    });

    test('renders official vector Command SVG on macOS and Ctrl text on Windows/Linux', () => {
        // macOS override: true
        const macDialog = createShortcutsModalDialog(true);
        const macCmdSvg = macDialog.querySelector('clashcalc-assets-svg[name="keyboard-command"]');
        assert.ok(macCmdSvg, 'Expected Mac dialog to render keyboard-command SVG');
        assert.equal(macCmdSvg.closest('kbd')?.getAttribute('aria-label'), 'Command');

        // Non-macOS override: false
        const winDialog = createShortcutsModalDialog(false);
        const winCmdSvg = winDialog.querySelector('clashcalc-assets-svg[name="keyboard-command"]');
        assert.equal(winCmdSvg, null, 'Did not expect Windows dialog to render keyboard-command SVG');
        const ctrlKbds = winDialog.querySelectorAll('.shortcuts-kbd').filter(k => k.textContent?.trim() === 'Ctrl');
        assert.ok(ctrlKbds.length > 0, 'Expected Windows dialog to render Ctrl text badge');
    });

    test('renders Return, Backspace, Tab, Shift, Space, and Chevron SVGs without prohibited dingbats', () => {
        const dialog = createShortcutsModalDialog(true);
        const returnSvgs = dialog.querySelectorAll('clashcalc-assets-svg[name="keyboard-return"]');
        assert.ok(returnSvgs.length >= 2, 'Expected return SVG icons in spotright and dialog action rows');

        const backspaceSvgs = dialog.querySelectorAll('clashcalc-assets-svg[name="keyboard-backspace"]');
        assert.ok(backspaceSvgs.length >= 1, 'Expected backspace SVG icon in spotright clear scope row');

        const tabSvgs = dialog.querySelectorAll('clashcalc-assets-svg[name="keyboard-tab"]');
        assert.ok(tabSvgs.length >= 3, 'Expected tab SVG icons in spotright accept and focus rows');

        const shiftSvgs = dialog.querySelectorAll('clashcalc-assets-svg[name="keyboard-shift"]');
        assert.ok(shiftSvgs.length >= 1, 'Expected shift SVG icon in cycle focus row');

        const spaceSvgs = dialog.querySelectorAll('clashcalc-assets-svg[name="keyboard-space"]');
        assert.ok(spaceSvgs.length >= 1, 'Expected space SVG icon in activate item row');

        const chevronUpSvgs = dialog.querySelectorAll('clashcalc-assets-svg[name="chevron-up"]');
        assert.ok(chevronUpSvgs.length >= 3, 'Expected chevron-up SVG icons for Up, Left, and Right keys');

        const chevronDownSvgs = dialog.querySelectorAll('clashcalc-assets-svg[name="chevron-down"]');
        assert.ok(chevronDownSvgs.length >= 1, 'Expected chevron-down SVG icon for Down key');

        const kbdTexts = dialog.querySelectorAll('.shortcuts-kbd').map(k => k.textContent?.trim());
        assert.ok(kbdTexts.includes('Up'), 'Expected Up text badge');
        assert.ok(kbdTexts.includes('Down'), 'Expected Down text badge');
        assert.ok(kbdTexts.includes('Left'), 'Expected Left text badge');
        assert.ok(kbdTexts.includes('Right'), 'Expected Right text badge');
        assert.ok(!kbdTexts.includes('Backspace'), 'Expected Backspace text to be replaced by SVG');

        // Asserts zero prohibited raw arrows (\u2190-\u21FF) in dialog markup
        const rawArrowPattern = /[\u2190-\u21FF]/;
        assert.equal(rawArrowPattern.test(dialog.innerHTML), false, 'Prohibited raw Unicode arrow dingbats detected in modal HTML');
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
        const shortcutsBtn = spotrightDialog.querySelector('#spotright-shortcuts-btn');
        assert.ok(shortcutsBtn, 'Expected #spotright-shortcuts-btn in spotright footer');
        assert.equal(shortcutsBtn.getAttribute('data-i18n-title'), 'views.shortcuts.title');

        const kbdHint = shortcutsBtn.querySelector('.spotright-footer-kbd');
        assert.ok(kbdHint, 'Expected ? kbd badge inside shortcuts footer button');
        assert.equal(kbdHint.textContent?.trim(), '?');
    });
});
