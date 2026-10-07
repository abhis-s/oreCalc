import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
    triggerHaptic,
    initializeGlobalHaptics,
    resetGlobalHapticsForTesting
} from '../../js/services/hapticService.js';

describe('Global Micro-Haptics Service Suite', () => {
    let originalDescriptor;
    let vibrateCalls;

    beforeEach(() => {
        vibrateCalls = [];
        originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
        Object.defineProperty(globalThis, 'navigator', {
            value: {
                vibrate: (pattern) => {
                    vibrateCalls.push(pattern);
                    return true;
                }
            },
            configurable: true,
            writable: true
        });
        resetGlobalHapticsForTesting();
    });

    afterEach(() => {
        if (originalDescriptor) {
            Object.defineProperty(globalThis, 'navigator', originalDescriptor);
        } else {
            delete globalThis.navigator;
        }
        resetGlobalHapticsForTesting();
    });

    test('triggerHaptic delivers calibrated LRA micro-pulses for all supported interaction types', () => {
        triggerHaptic('click');
        assert.deepEqual(vibrateCalls[0], 6);

        triggerHaptic('tap');
        assert.deepEqual(vibrateCalls[1], 6);

        triggerHaptic('light');
        assert.deepEqual(vibrateCalls[2], 6);

        triggerHaptic('toggle');
        assert.deepEqual(vibrateCalls[3], 10);

        triggerHaptic('select');
        assert.deepEqual(vibrateCalls[4], 10);

        triggerHaptic('selection');
        assert.deepEqual(vibrateCalls[5], 10);

        triggerHaptic('medium');
        assert.deepEqual(vibrateCalls[6], 10);

        triggerHaptic('success');
        assert.deepEqual(vibrateCalls[7], [8, 25, 8]);

        triggerHaptic('warning');
        assert.deepEqual(vibrateCalls[8], [16, 35, 16]);

        triggerHaptic('error');
        assert.deepEqual(vibrateCalls[9], [16, 35, 16]);

        triggerHaptic('bump');
        assert.deepEqual(vibrateCalls[10], [10, 30, 5]);

        triggerHaptic();
        assert.deepEqual(vibrateCalls[11], 6);
    });

    test('triggerHaptic handles unsupported or throwing environments gracefully', () => {
        Object.defineProperty(globalThis, 'navigator', {
            value: undefined,
            configurable: true,
            writable: true
        });
        assert.doesNotThrow(() => triggerHaptic('click'));

        Object.defineProperty(globalThis, 'navigator', {
            value: {},
            configurable: true,
            writable: true
        });
        assert.doesNotThrow(() => triggerHaptic('click'));

        Object.defineProperty(globalThis, 'navigator', {
            value: {
                vibrate: () => {
                    throw new Error('SecurityError: Permission denied');
                }
            },
            configurable: true,
            writable: true
        });
        assert.doesNotThrow(() => triggerHaptic('click'));
    });

    test('initializeGlobalHaptics delegates pointerdown interactions and enforces idempotency', () => {
        const listeners = [];
        const originalDoc = globalThis.document;

        globalThis.document = {
            addEventListener: (event, handler, options) => {
                listeners.push({ event, handler, options });
            }
        };

        initializeGlobalHaptics();
        assert.equal(listeners.length, 1);
        assert.equal(listeners[0].event, 'pointerdown');

        // Calling again must be a no-op due to idempotency guard
        initializeGlobalHaptics();
        assert.equal(listeners.length, 1);

        const pointerHandler = listeners[0].handler;

        const createTarget = ({ tag, classes = [], attrs = {}, disabled = false }) => {
            const classSet = new Set(classes);
            return {
                tagName: tag.toUpperCase(),
                disabled,
                classList: {
                    contains: (c) => classSet.has(c)
                },
                getAttribute: (attr) => attrs[attr] || null,
                closest: function(selector) {
                    const selParts = selector.split(',').map(s => s.trim());
                    for (const part of selParts) {
                        if (part === tag) return this;
                        if (part.startsWith('.') && classSet.has(part.slice(1))) return this;
                        if (part.startsWith('[role="') && attrs.role === part.slice(7, -2)) return this;
                        if (part === '[data-tab]' && attrs['data-tab'] !== undefined) return this;
                        if (part.startsWith('input[type="') && tag === 'input' && attrs.type === part.slice(12, -2)) return this;
                        if (part.startsWith('a.') && tag === 'a' && classSet.has(part.slice(2))) return this;
                    }
                    return null;
                },
                matches: function(selector) {
                    const selParts = selector.split(',').map(s => s.trim());
                    for (const part of selParts) {
                        if (part === tag) return true;
                        if (part.startsWith('.') && classSet.has(part.slice(1))) return true;
                        if (part.startsWith('[role="') && attrs.role === part.slice(7, -2)) return true;
                        if (part === '[data-tab]' && attrs['data-tab'] !== undefined) return true;
                        if (part.startsWith('input[type="') && tag === 'input' && attrs.type === part.slice(12, -2)) return true;
                    }
                    return false;
                }
            };
        };

        // Standard button click -> 6ms
        vibrateCalls = [];
        pointerHandler({ target: createTarget({ tag: 'button' }) });
        assert.deepEqual(vibrateCalls, [6]);

        // Tab button -> 10ms (toggle)
        vibrateCalls = [];
        pointerHandler({ target: createTarget({ tag: 'button', classes: ['tab-button'] }) });
        assert.deepEqual(vibrateCalls, [10]);

        // Role tab -> 10ms (toggle)
        vibrateCalls = [];
        pointerHandler({ target: createTarget({ tag: 'div', attrs: { role: 'tab' } }) });
        assert.deepEqual(vibrateCalls, [10]);

        // Checkbox -> 10ms (toggle)
        vibrateCalls = [];
        pointerHandler({ target: createTarget({ tag: 'input', attrs: { type: 'checkbox' } }) });
        assert.deepEqual(vibrateCalls, [10]);

        // Anchor styled as button -> 6ms (click)
        vibrateCalls = [];
        pointerHandler({ target: createTarget({ tag: 'a', classes: ['btn'] }) });
        assert.deepEqual(vibrateCalls, [6]);

        // Summary element -> 6ms (click)
        vibrateCalls = [];
        pointerHandler({ target: createTarget({ tag: 'summary' }) });
        assert.deepEqual(vibrateCalls, [6]);

        // Disabled button -> ignored
        vibrateCalls = [];
        pointerHandler({ target: createTarget({ tag: 'button', disabled: true }) });
        assert.deepEqual(vibrateCalls, []);

        // Element with .disabled class -> ignored
        vibrateCalls = [];
        pointerHandler({ target: createTarget({ tag: 'button', classes: ['disabled'] }) });
        assert.deepEqual(vibrateCalls, []);

        // Element with aria-disabled="true" -> ignored
        vibrateCalls = [];
        pointerHandler({ target: createTarget({ tag: 'button', attrs: { 'aria-disabled': 'true' } }) });
        assert.deepEqual(vibrateCalls, []);

        // Non-interactive container -> ignored
        vibrateCalls = [];
        pointerHandler({ target: createTarget({ tag: 'div' }) });
        assert.deepEqual(vibrateCalls, []);

        globalThis.document = originalDoc;
    });
});
