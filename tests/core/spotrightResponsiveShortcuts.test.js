import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    createSpotrightDialog,
    renderSpotrightResults
} from '../../js/components/spotright/spotrightDisplay.js';
import {
    openSpotright,
    closeSpotright
} from '../../js/components/spotright/spotrightController.js';

describe('Spotright Responsive Shortcuts & Touch Behavior Suite', () => {
    /** @type {any} */
    let originalDocument;
    /** @type {any} */
    let originalWindow;

    beforeEach(() => {
        originalDocument = globalThis.document;
        originalWindow = globalThis.window;
    });

    afterEach(() => {
        globalThis.document = originalDocument;
        globalThis.window = originalWindow;
    });

    test('renderSpotrightResults renders clean mechanical keycap without text hints', () => {
        const dummyContainer = {
            innerHTML: ''
        };

        const mockMatches = [
            {
                id: 'nav-home',
                title: 'Overview',
                subtitle: 'Core Hub',
                scope: 'navigation',
                icon: 'view-dashboard',
                isVillage: false,
                isActiveVillage: false
            },
            {
                id: 'village-active',
                title: 'My Base #1',
                subtitle: 'Active Village',
                scope: 'villages',
                icon: 'shield',
                isVillage: true,
                isActiveVillage: true
            }
        ];

        // @ts-ignore
        renderSpotrightResults(dummyContainer, mockMatches, 0);

        const html = dummyContainer.innerHTML;

        // Verify standard item renders mechanical enter keycap without action label
        assert.match(html, /<kbd class="spotright-action-enter"/, 'Standard item must render keyboard return keycap');
        assert.doesNotMatch(html, /class="spotright-action-label"/, 'Item must NOT render text action label');
        assert.doesNotMatch(html, /Go to Hub/, 'Item must NOT inject static actionCue text into DOM');

        // Verify active village renders vector checkmark without action label
        assert.match(html, /<span class="spotright-action-active-icon">/, 'Active village must render checkmark container');
        assert.doesNotMatch(html, /<span class="spotright-action-label">Active<\/span>/, 'Active village must not render action label');

        // Invariant: Zero prohibited dingbats or emojis
        const prohibitedPattern = /[\u2190-\u21FF\u2500-\u257F\u25A0-\u25FF\u2600-\u26FF\u2700-\u27BF\u2022]/u;
        assert.equal(prohibitedPattern.test(html), false, 'Spotright results markup must contain zero prohibited dingbats');
    });

    test('createSpotrightDialog provides footer shortcuts button with label and keycap', () => {
        /** @type {Record<string, any>} */
        const mockDialog = {
            id: '',
            className: '',
            innerHTML: '',
            setAttribute(name, value) {
                this[name] = value;
            }
        };

        // @ts-ignore
        globalThis.document = {
            createElement(tag) {
                if (tag === 'dialog') return mockDialog;
                return {};
            }
        };

        const dialog = createSpotrightDialog();
        const html = dialog.innerHTML;

        assert.match(html, /class="spotright-footer-shortcuts-label"/, 'Footer must provide shortcuts label for responsive collapse');
        assert.match(html, /<kbd class="spotright-footer-kbd">\?<\/kbd>/, 'Footer must provide ? keycap');
    });

    test('spotrightController manages has-physical-keyboard class reactively on dialog', () => {
        const listeners = {};
        const classList = new Set();

        const mockDialog = {
            id: 'clashcalc-spotright',
            className: 'spotright-dialog',
            classList: {
                add(cls) { classList.add(cls); },
                remove(cls) { classList.delete(cls); },
                contains(cls) { return classList.has(cls); }
            },
            addEventListener(evt, fn) {
                listeners[evt] = fn;
            },
            querySelector(sel) {
                if (sel === '#spotright-input') {
                    return {
                        addEventListener(evt, fn) { listeners[`input-${evt}`] = fn; },
                        value: '',
                        focus() {},
                        select() {}
                    };
                }
                return {
                    addEventListener() {},
                    classList: { remove() {} },
                    querySelectorAll() { return []; },
                    appendChild() {}
                };
            },
            querySelectorAll() {
                return [];
            },
            hasAttribute(attr) {
                return attr === 'open';
            },
            setAttribute() {},
            removeAttribute() {},
            showModal() {},
            close() {}
        };

        const mockBody = {
            contains() { return true; },
            appendChild() {}
        };

        // @ts-ignore
        globalThis.document = {
            body: mockBody,
            createElement(tag) {
                if (tag === 'dialog') return mockDialog;
                return {};
            },
            getElementById(id) {
                if (id === 'clashcalc-spotright') return mockDialog;
                return null;
            }
        };

        // @ts-ignore
        globalThis.window = {
            requestAnimationFrame(cb) { cb(0); },
            addEventListener() {}
        };

        // Open spotright to ensure mounted
        openSpotright();

        // 1. Initial state: no physical keyboard class
        assert.equal(classList.has('has-physical-keyboard'), false, 'Should not have has-physical-keyboard initially');

        // 2. Navigation keydown triggers physical keyboard detection
        assert.ok(listeners['input-keydown'], 'Must have input-keydown listener');
        listeners['input-keydown']({
            key: 'ArrowDown',
            preventDefault() {}
        });
        assert.equal(classList.has('has-physical-keyboard'), true, 'ArrowDown must add has-physical-keyboard class');

        // 3. Touch interaction removes physical keyboard indicator
        assert.ok(listeners['touchstart'], 'Must have touchstart listener');
        listeners['touchstart']();
        assert.equal(classList.has('has-physical-keyboard'), false, 'Touch interaction must remove has-physical-keyboard class');

        // 4. Tab key adds it back
        listeners['input-keydown']({
            key: 'Tab',
            preventDefault() {}
        });
        assert.equal(classList.has('has-physical-keyboard'), true, 'Tab key must re-add has-physical-keyboard class');

        // 5. Closing dialog clears class
        closeSpotright();
        assert.equal(classList.has('has-physical-keyboard'), false, 'closeSpotright must clean up has-physical-keyboard class');
    });
});
