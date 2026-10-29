import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

import {
    GLOBAL_MAX_CLIPBOARD_LENGTH,
    CLIPBOARD_PATTERNS,
    cleanUuid,
    resolveInputPattern,
    isClipboardReadPreGranted,
    triggerButtonErrorFeedback,
    applyValueToInput,
    handleManualPasteClick,
    triggerAutoPaste,
    enhanceClipboardInput,
    initClipboardInputs
} from '../../js/components/common/clipboardInputController.js';

describe('Clipboard Input Controller & Invariant Verification Suite', () => {
    let originalNavigatorDesc;
    let originalWindow;
    let originalDocument;

    function setMockNavigator(mockObj) {
        Object.defineProperty(globalThis, 'navigator', {
            value: mockObj,
            configurable: true,
            writable: true
        });
    }

    beforeEach(() => {
        originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
        originalWindow = globalThis.window;
        originalDocument = globalThis.document;
    });

    afterEach(() => {
        if (originalNavigatorDesc) {
            Object.defineProperty(globalThis, 'navigator', originalNavigatorDesc);
        } else {
            delete /** @type {any} */ (globalThis).navigator;
        }
        globalThis.window = originalWindow;
        globalThis.document = originalDocument;
    });

    describe('Global Max String Length & Invariant Constraints', () => {
        test('GLOBAL_MAX_CLIPBOARD_LENGTH is fixed to 256 characters', () => {
            assert.equal(GLOBAL_MAX_CLIPBOARD_LENGTH, 256);
        });

        test('every input field with data-clipboard-paste across templates has an explicit positive maxlength attribute', () => {
            const rootDir = process.cwd();
            const templatePaths = [
                path.join(rootDir, 'partials/modals/add-player.html'),
                path.join(rootDir, 'partials/modals/guided-setup-modal.html'),
                path.join(rootDir, 'account/index.html')
            ];

            let foundInputs = 0;
            for (const file of templatePaths) {
                if (!fs.existsSync(file)) continue;
                const html = fs.readFileSync(file, 'utf8');
                const matches = html.matchAll(/<input[^>]+data-clipboard-paste=["']([^"']+)["'][^>]*>/g);
                for (const match of matches) {
                    foundInputs++;
                    const inputTag = match[0];
                    const maxLenMatch = inputTag.match(/maxlength=["'](\d+)["']/i);
                    assert.ok(maxLenMatch, `Input with data-clipboard-paste must define maxlength attribute in ${file}`);
                    const maxLen = Number(maxLenMatch[1]) || 0;
                    assert.ok(maxLen > 0, `maxlength must be a positive integer in ${file}`);
                }
            }
            assert.ok(foundInputs >= 3, `Expected at least 3 configured clipboard input fields, found ${foundInputs}`);
        });

        test('auto-paste strictly rejects strings exceeding GLOBAL_MAX_CLIPBOARD_LENGTH even if pattern matches', () => {
            const oversizedTag = '#8PJYGUJC' + 'A'.repeat(GLOBAL_MAX_CLIPBOARD_LENGTH);
            assert.equal(oversizedTag.length > GLOBAL_MAX_CLIPBOARD_LENGTH, true);
            assert.equal(CLIPBOARD_PATTERNS['player-tag'].validate(oversizedTag), false);

            const oversizedUuid = '12345678-abcd-1234-abcd-1234567890ab' + '0'.repeat(GLOBAL_MAX_CLIPBOARD_LENGTH);
            assert.equal(oversizedUuid.length > GLOBAL_MAX_CLIPBOARD_LENGTH, true);
            assert.equal(CLIPBOARD_PATTERNS['uuid'].validate(oversizedUuid), false);
        });
    });

    describe('Pattern Resolution and Sanitization', () => {
        test('cleanUuid accurately extracts UUID from raw strings and URLs', () => {
            assert.equal(cleanUuid('  12345678-abcd-1234-abcd-1234567890ab  '), '12345678-abcd-1234-abcd-1234567890ab');
            assert.equal(cleanUuid('https://clashcalc.com/account/?userId=12345678-abcd-1234-abcd-1234567890ab'), '12345678-abcd-1234-abcd-1234567890ab');
            assert.equal(cleanUuid(''), '');
            assert.equal(cleanUuid(/** @type {any} */ (null)), '');
        });

        test('resolves player-tag predefined pattern and extracts valid tags', () => {
            const mockInput = /** @type {any} */ ({ dataset: { clipboardPaste: 'player-tag' } });
            const patternDef = resolveInputPattern(mockInput);
            assert.ok(patternDef);
            assert.equal(patternDef.validate('#8PJYGUJC'), true);
            assert.equal(patternDef.clean('#8PJYGUJC'), '8PJYGUJC');
            assert.equal(patternDef.validate('https://link.clashofclans.com/?action=OpenPlayerProfile&tag=8PJYGUJC'), true);
            assert.equal(patternDef.clean('https://link.clashofclans.com/?action=OpenPlayerProfile&tag=8PJYGUJC'), '8PJYGUJC');
            assert.equal(patternDef.validate('#INVALID!'), false);
        });

        test('resolves uuid predefined pattern and extracts userId query parameters', () => {
            const mockInput = /** @type {any} */ ({ dataset: { clipboardPaste: 'uuid' } });
            const patternDef = resolveInputPattern(mockInput);
            assert.ok(patternDef);
            assert.equal(patternDef.validate('12345678-abcd-1234-abcd-1234567890ab'), true);
            assert.equal(patternDef.clean('  12345678-abcd-1234-abcd-1234567890ab  '), '12345678-abcd-1234-abcd-1234567890ab');
            assert.equal(patternDef.validate('https://clashcalc.com/account/?userId=12345678-abcd-1234-abcd-1234567890ab'), true);
            assert.equal(patternDef.clean('https://clashcalc.com/account/?userId=12345678-abcd-1234-abcd-1234567890ab'), '12345678-abcd-1234-abcd-1234567890ab');
            assert.equal(patternDef.validate('not-a-valid-uuid'), false);
        });

        test('supports custom regex patterns via data-clipboard-pattern', () => {
            const mockInput = /** @type {any} */ ({
                dataset: { clipboardPaste: 'custom', clipboardPattern: '^PIN-\\d{4}$' }
            });
            const patternDef = resolveInputPattern(mockInput);
            assert.ok(patternDef);
            assert.equal(patternDef.validate('PIN-1234'), true);
            assert.equal(patternDef.validate('PIN-ABCD'), false);
        });

        test('returns null pattern when custom regex is invalid or missing', () => {
            const mockInput = /** @type {any} */ ({
                dataset: { clipboardPaste: 'unknown-type' }
            });
            assert.equal(resolveInputPattern(mockInput), null);
        });
    });

    describe('Auto-Paste Permission Guard & Optionality', () => {
        test('strictly disabled when data-clipboard-auto is not "true"', async () => {
            const mockInput = /** @type {any} */ ({
                dataset: { clipboardPaste: 'player-tag' },
                value: ''
            });
            const result = await triggerAutoPaste(mockInput);
            assert.equal(result, false, 'Auto-paste must not execute unless data-clipboard-auto="true"');
        });

        test('strictly disabled when data-clipboard-auto="true" but no pattern is configured', async () => {
            const mockInput = /** @type {any} */ ({
                dataset: { clipboardPaste: '', clipboardAuto: 'true' },
                value: ''
            });
            const result = await triggerAutoPaste(mockInput);
            assert.equal(result, false, 'Auto-paste must not execute without a valid pattern');
        });

        test('does not overwrite existing non-empty input content', async () => {
            const mockInput = /** @type {any} */ ({
                dataset: { clipboardPaste: 'player-tag', clipboardAuto: 'true' },
                value: 'ALREADY_FILLED'
            });
            const result = await triggerAutoPaste(mockInput);
            assert.equal(result, false, 'Auto-paste must not overwrite existing value');
        });

        test('never invokes clipboard.readText when permission state is prompt', async () => {
            let readCalled = false;
            setMockNavigator({
                clipboard: {
                    readText: async () => { readCalled = true; return '#8PJYGUJC'; }
                },
                permissions: {
                    query: async () => ({ state: 'prompt' })
                }
            });

            const mockInput = /** @type {any} */ ({
                dataset: { clipboardPaste: 'player-tag', clipboardAuto: 'true' },
                value: '',
                maxLength: 12
            });

            const result = await triggerAutoPaste(mockInput);
            assert.equal(result, false);
            assert.equal(readCalled, false, 'readText must NEVER be called when permission is prompt');
        });

        test('never invokes clipboard.readText when permission state is denied', async () => {
            let readCalled = false;
            setMockNavigator({
                clipboard: {
                    readText: async () => { readCalled = true; return '#8PJYGUJC'; }
                },
                permissions: {
                    query: async () => ({ state: 'denied' })
                }
            });

            const mockInput = /** @type {any} */ ({
                dataset: { clipboardPaste: 'player-tag', clipboardAuto: 'true' },
                value: '',
                maxLength: 12
            });

            const result = await triggerAutoPaste(mockInput);
            assert.equal(result, false);
            assert.equal(readCalled, false, 'readText must NEVER be called when permission is denied');
        });

        test('auto-pastes and dispatches input event when permission is pre-granted and pattern matches', async () => {
            setMockNavigator({
                clipboard: {
                    readText: async () => 'https://link.clashofclans.com/?action=OpenPlayerProfile&tag=8PJYGUJC'
                },
                permissions: {
                    query: async () => ({ state: 'granted' })
                }
            });

            let eventDispatched = false;
            const mockInput = /** @type {any} */ ({
                dataset: { clipboardPaste: 'player-tag', clipboardAuto: 'true' },
                value: '',
                maxLength: 12,
                dispatchEvent: (ev) => {
                    if (ev.type === 'input') eventDispatched = true;
                    return true;
                }
            });

            const result = await triggerAutoPaste(mockInput);
            assert.equal(result, true);
            assert.equal(mockInput.value, '8PJYGUJC');
            assert.equal(eventDispatched, true);
        });

        test('isClipboardReadPreGranted verifies granted state and handles missing APIs safely', async () => {
            setMockNavigator({
                permissions: {
                    query: async () => ({ state: 'granted' })
                },
                clipboard: { readText: async () => '' }
            });
            assert.equal(await isClipboardReadPreGranted(), true);

            setMockNavigator({
                permissions: {
                    query: async () => ({ state: 'prompt' })
                },
                clipboard: { readText: async () => '' }
            });
            assert.equal(await isClipboardReadPreGranted(), false);

            setMockNavigator({});
            assert.equal(await isClipboardReadPreGranted(), false);
        });

        test('triggerButtonErrorFeedback toggles is-error class and cleans up timer', () => {
            const added = [];
            const removed = [];
            const mockBtn = /** @type {any} */ ({
                classList: {
                    add: (cls) => added.push(cls),
                    remove: (cls) => removed.push(cls)
                },
                dataset: {}
            });

            triggerButtonErrorFeedback(mockBtn);
            assert.ok(added.includes('is-error'));
            assert.ok(mockBtn.dataset.errorTimeout);
            clearTimeout(Number(mockBtn.dataset.errorTimeout));
        });

        test('applyValueToInput sets value bounded by maxLength and fires events', () => {
            let inputFired = false;
            let changeFired = false;
            const mockInput = /** @type {any} */ ({
                value: '',
                maxLength: 10,
                dispatchEvent: (ev) => {
                    if (ev.type === 'input') inputFired = true;
                    if (ev.type === 'change') changeFired = true;
                    return true;
                }
            });

            applyValueToInput(mockInput, '1234567890ABCDEF');
            assert.equal(mockInput.value, '1234567890');
            assert.equal(inputFired, true);
            assert.equal(changeFired, true);
        });
    });

    describe('Manual Paste Button Operations', () => {
        test('handleManualPasteClick pastes and cleans valid player tag on explicit click', async () => {
            setMockNavigator({
                clipboard: {
                    readText: async () => '#8PJYGUJC'
                }
            });

            let focused = false;
            const mockInput = /** @type {any} */ ({
                dataset: { clipboardPaste: 'player-tag' },
                value: '',
                maxLength: 12,
                dispatchEvent: () => true,
                focus: () => { focused = true; }
            });

            const mockButton = /** @type {any} */ ({
                classList: { add: () => {}, remove: () => {} },
                dataset: {}
            });

            const success = await handleManualPasteClick(mockInput, mockButton);
            assert.equal(success, true);
            assert.equal(mockInput.value, '8PJYGUJC');
            assert.equal(focused, true);
        });

        test('handleManualPasteClick triggers shake and error feedback when permission is denied', async () => {
            setMockNavigator({
                clipboard: {
                    readText: async () => { throw new Error('NotAllowedError'); }
                }
            });

            const classes = [];
            const mockButton = /** @type {any} */ ({
                classList: {
                    add: (cls) => classes.push(cls),
                    remove: (cls) => {
                        const idx = classes.indexOf(cls);
                        if (idx > -1) classes.splice(idx, 1);
                    }
                },
                dataset: {}
            });

            const mockInput = /** @type {any} */ ({
                dataset: { clipboardPaste: 'player-tag' },
                value: '',
                maxLength: 12
            });

            const success = await handleManualPasteClick(mockInput, mockButton);
            assert.equal(success, false);
            assert.ok(classes.includes('is-error'), 'Button must receive is-error class on permission denial');
        });

        test('handleManualPasteClick rejects manual paste when clipboard contains invalid/unsupported characters for pattern', async () => {
            setMockNavigator({
                clipboard: {
                    readText: async () => 'INVALID_TAG_CHARACTERS!!'
                }
            });

            const classes = [];
            const mockButton = /** @type {any} */ ({
                classList: {
                    add: (cls) => classes.push(cls),
                    remove: () => {}
                },
                dataset: {}
            });

            const mockInput = /** @type {any} */ ({
                dataset: { clipboardPaste: 'player-tag' },
                value: '',
                maxLength: 12
            });

            const success = await handleManualPasteClick(mockInput, mockButton);
            assert.equal(success, false);
            assert.ok(classes.includes('is-error'), 'Button must receive is-error class when format is invalid');
            assert.equal(mockInput.value, '');
        });

        test('handleManualPasteClick prunes generic paste content to input.maxLength', async () => {
            setMockNavigator({
                clipboard: {
                    readText: async () => '1234567890ABCDEF'
                }
            });

            const mockInput = /** @type {any} */ ({
                dataset: {}, // no pattern
                value: '',
                maxLength: 5,
                dispatchEvent: () => true,
                focus: () => {}
            });

            const mockButton = /** @type {any} */ ({
                classList: { add: () => {}, remove: () => {} },
                dataset: {}
            });

            const success = await handleManualPasteClick(mockInput, mockButton);
            assert.equal(success, true);
            assert.equal(mockInput.value, '12345', 'Value must be pruned to input.maxLength');
        });
    });

    describe('DOM Enhancement & Registration Engine', () => {
        test('enhanceClipboardInput safely handles null or already-enhanced input', () => {
            assert.equal(enhanceClipboardInput(/** @type {any} */ (null)), null);

            const mockInput = /** @type {any} */ ({
                dataset: { clipboardEnhanced: 'true' },
                parentElement: { querySelector: () => 'existing-btn' }
            });
            assert.equal(enhanceClipboardInput(mockInput), 'existing-btn');
        });

        test('initClipboardInputs executes without error on empty or non-DOM targets', () => {
            assert.doesNotThrow(() => initClipboardInputs(/** @type {any} */ (null)));
            assert.doesNotThrow(() => initClipboardInputs(/** @type {any} */ ({})));
        });

        test('enhanceClipboardInput preserves leading input-icon sibling when enhancing input inside input-with-icon container', () => {
            /** @type {any} */
            const container = {
                children: [],
                insertBefore(newNode, refNode) {
                    const idx = this.children.indexOf(refNode);
                    if (idx > -1) {
                        this.children.splice(idx, 0, newNode);
                    } else {
                        this.children.push(newNode);
                    }
                },
                classList: {
                    contains: (cls) => cls === 'input-with-icon'
                }
            };

            const iconSpan = {
                className: 'input-icon',
                parentElement: container
            };

            const mockInput = {
                dataset: {},
                parentElement: container
            };

            container.children = [iconSpan, mockInput];

            globalThis.document = /** @type {any} */ ({
                createElement: (tag) => {
                    const el = {
                        tagName: tag.toUpperCase(),
                        className: '',
                        attributes: {},
                        setAttribute: (k, v) => { el.attributes[k] = v; },
                        children: [],
                        appendChild: (child) => {
                            child.parentElement = el;
                            el.children.push(child);
                            const oldIdx = container.children.indexOf(child);
                            if (oldIdx > -1) container.children.splice(oldIdx, 1);
                        },
                        classList: {
                            contains: (cls) => el.className.split(' ').includes(cls)
                        }
                    };
                    return el;
                }
            });

            const btn = enhanceClipboardInput(/** @type {any} */ (mockInput));
            assert.ok(btn, 'Paste button should be created');
            assert.equal(mockInput.dataset.clipboardEnhanced, 'true');
            assert.equal(container.children[0], iconSpan, 'iconSpan must remain the first child of input-with-icon container');
            assert.equal(container.children[1].className, 'clipboard-input-wrapper', 'wrapper must be inserted after iconSpan');
            assert.equal(container.children[1].children[0], mockInput, 'mockInput must be inside the wrapper');
            assert.equal(container.children[1].children[1], btn, 'btn must be inside the wrapper');
        });
    });
});
