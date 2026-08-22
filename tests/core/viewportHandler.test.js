import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    isTouchDevice,
    calculateToastKeyboardOffset
} from '../../js/utils/viewportHandler.js';

function mockGlobal(prop, value) {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, prop);
    Object.defineProperty(globalThis, prop, {
        value,
        configurable: true,
        writable: true
    });
    return () => {
        if (originalDescriptor) {
            Object.defineProperty(globalThis, prop, originalDescriptor);
        } else {
            // @ts-ignore
            delete globalThis[prop];
        }
    };
}

describe('Viewport & Virtual Keyboard Handler Tests', () => {

    describe('isTouchDevice detection', () => {
        test('returns false in non-browser or non-touch desktop environment', () => {
            const restoreWindow = mockGlobal('window', {});
            const restoreNav = mockGlobal('navigator', { maxTouchPoints: 0 });

            try {
                assert.equal(isTouchDevice(), false);
            } finally {
                restoreWindow();
                restoreNav();
            }
        });

        test('returns true when ontouchstart is present in window', () => {
            const restoreWindow = mockGlobal('window', { ontouchstart: null });
            const restoreNav = mockGlobal('navigator', { maxTouchPoints: 0 });

            try {
                assert.equal(isTouchDevice(), true);
            } finally {
                restoreWindow();
                restoreNav();
            }
        });

        test('returns true when navigator.maxTouchPoints > 0', () => {
            const restoreWindow = mockGlobal('window', {});
            const restoreNav = mockGlobal('navigator', { maxTouchPoints: 5 });

            try {
                assert.equal(isTouchDevice(), true);
            } finally {
                restoreWindow();
                restoreNav();
            }
        });
    });

    describe('calculateToastKeyboardOffset calculation', () => {
        test('returns 0 on desktop devices even if input is focused and screenDiff is large', () => {
            const offset = calculateToastKeyboardOffset({
                isInputFocused: true,
                isTouch: false,
                layoutHeight: 700,
                vvHeight: 700,
                vvTop: 0,
                screenHeight: 1080
            });
            assert.equal(offset, 0);
        });

        test('returns 0 on desktop devices when page is scrolled while input is focused', () => {
            const offset = calculateToastKeyboardOffset({
                isInputFocused: true,
                isTouch: false,
                layoutHeight: 700,
                vvHeight: 500,
                vvTop: 0,
                screenHeight: 1080
            });
            assert.equal(offset, 0);
        });

        test('returns 0 on touch devices when no input element has focus', () => {
            const offset = calculateToastKeyboardOffset({
                isInputFocused: false,
                isTouch: true,
                layoutHeight: 800,
                vvHeight: 500,
                vvTop: 0,
                screenHeight: 800
            });
            assert.equal(offset, 0);
        });

        test('returns 0 on touch devices when viewport difference is <= 50px (e.g. browser toolbar collapse)', () => {
            const offset = calculateToastKeyboardOffset({
                isInputFocused: true,
                isTouch: true,
                layoutHeight: 800,
                vvHeight: 760,
                vvTop: 0,
                screenHeight: 800
            });
            assert.equal(offset, 0);
        });

        test('calculates correct offset on mobile touch devices when virtual keyboard appears', () => {
            const offset = calculateToastKeyboardOffset({
                isInputFocused: true,
                isTouch: true,
                layoutHeight: 800,
                vvHeight: 500,
                vvTop: 0,
                screenHeight: 800
            });
            assert.equal(offset, 310);
        });

        test('accounts for visualViewport.offsetTop in mobile keyboard calculation', () => {
            const offset = calculateToastKeyboardOffset({
                isInputFocused: true,
                isTouch: true,
                layoutHeight: 844,
                vvHeight: 450,
                vvTop: 50,
                screenHeight: 844
            });
            assert.equal(offset, 354);
        });

        test('applies iPadOS Safari fallback on touch devices when layoutHeight shrinks alongside visualViewport', () => {
            const offset = calculateToastKeyboardOffset({
                isInputFocused: true,
                isTouch: true,
                layoutHeight: 650,
                vvHeight: 650,
                vvTop: 0,
                screenHeight: 1024
            });
            assert.equal(offset, 384);
        });

        test('clamps iPadOS Safari fallback to max 400px keyboard height', () => {
            const offset = calculateToastKeyboardOffset({
                isInputFocused: true,
                isTouch: true,
                layoutHeight: 500,
                vvHeight: 500,
                vvTop: 0,
                screenHeight: 1366
            });
            assert.equal(offset, 410);
        });

        test('handles missing or zero parameters safely', () => {
            assert.equal(calculateToastKeyboardOffset({
                isInputFocused: false,
                isTouch: false,
                layoutHeight: 0,
                vvHeight: 0,
                vvTop: 0
            }), 0);
        });
    });
});
