import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { addValidation } from '../../js/utils/inputValidator.js';

describe('Input Validator IME & Mobile Keyboard Suite', () => {
    function createMockInput() {
        const listeners = {};
        const classes = new Set();

        return {
            tagName: 'INPUT',
            type: 'number',
            value: '5',
            min: '1',
            max: '27',
            maxLength: 2,
            dataset: {},
            classList: {
                add: (c) => classes.add(c),
                remove: (c) => classes.delete(c),
                contains: (c) => classes.has(c)
            },
            addEventListener: (event, handler) => {
                listeners[event] = listeners[event] || [];
                listeners[event].push(handler);
            },
            dispatchEvent: (event) => {
                const handlers = listeners[event.type] || [];
                handlers.forEach(h => h(event));
                return !event.defaultPrevented;
            },
            _listeners: listeners
        };
    }

    test('permits Android virtual keyboard Unidentified keydown events without preventDefault', () => {
        const input = createMockInput();
        addValidation(input);

        let defaultPrevented = false;
        const event = {
            type: 'keydown',
            key: 'Unidentified',
            keyCode: 229,
            ctrlKey: false,
            metaKey: false,
            target: input,
            preventDefault: () => {
                defaultPrevented = true;
            }
        };

        const keydownHandlers = input._listeners['keydown'];
        assert.ok(keydownHandlers && keydownHandlers.length > 0);
        keydownHandlers[0](event);

        assert.equal(defaultPrevented, false, 'Unidentified key from Android virtual keyboard should not be prevented');
    });

    test('permits IME composing keydown events without preventDefault', () => {
        const input = createMockInput();
        addValidation(input);

        let defaultPrevented = false;
        const event = {
            type: 'keydown',
            key: 'Process',
            isComposing: true,
            ctrlKey: false,
            metaKey: false,
            target: input,
            preventDefault: () => {
                defaultPrevented = true;
            }
        };

        const keydownHandlers = input._listeners['keydown'];
        keydownHandlers[0](event);

        assert.equal(defaultPrevented, false, 'Composing key should not be prevented');
    });

    test('permits numeric and navigation keys while blocking alphabetic keys', () => {
        const input = createMockInput();
        addValidation(input);

        const keydownHandler = input._listeners['keydown'][0];

        const testKey = (key, expectedPrevented) => {
            let prevented = false;
            keydownHandler({
                type: 'keydown',
                key: key,
                ctrlKey: false,
                metaKey: false,
                target: input,
                preventDefault: () => {
                    prevented = true;
                }
            });
            assert.equal(prevented, expectedPrevented, `Key "${key}" prevented status should be ${expectedPrevented}`);
        };

        testKey('1', false);
        testKey('9', false);
        testKey('Backspace', false);
        testKey('Delete', false);
        testKey('ArrowUp', false);
        testKey('ArrowDown', false);

        testKey('a', true);
        testKey('z', true);
        testKey('$', true);
        testKey('!', true);
    });
});
