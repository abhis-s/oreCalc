import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    isTouchDevice,
    calculateToastKeyboardOffset,
    detectSoftwareKeyboardOpen,
    calculateHeaderViewportOffset,
    calculateVisualRectOcclusion
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

    describe('detectSoftwareKeyboardOpen detection', () => {
        test('returns false when desktop or no input focused', () => {
            assert.equal(detectSoftwareKeyboardOpen({
                isTouch: false,
                isInputFocused: true,
                layoutHeight: 800,
                vvHeight: 500,
                vvTop: 0,
                baselineVvHeight: 800
            }), false);
            assert.equal(detectSoftwareKeyboardOpen({
                isTouch: true,
                isInputFocused: false,
                layoutHeight: 800,
                vvHeight: 500,
                vvTop: 0,
                baselineVvHeight: 800
            }), false);
        });

        test('returns false for iPad Stage Manager window or external hardware keyboard', () => {
            assert.equal(detectSoftwareKeyboardOpen({
                isTouch: true,
                isInputFocused: true,
                layoutHeight: 700,
                vvHeight: 700,
                vvTop: 0,
                baselineVvHeight: 700,
                screenHeight: 1366
            }), false);
        });

        test('returns true when virtual keyboard shrinks viewport even when scrolled down to bottom', () => {
            assert.equal(detectSoftwareKeyboardOpen({
                isTouch: true,
                isInputFocused: true,
                layoutHeight: 1180,
                vvHeight: 780,
                vvTop: 400,
                baselineVvHeight: 1180,
                screenHeight: 1180
            }), true);
        });
    });

    describe('calculateHeaderViewportOffset iOS visual viewport pinning', () => {
        test('tracks non-zero vvOffsetTop unconditionally on iOS even after blur during keyboard dismiss', () => {
            assert.equal(calculateHeaderViewportOffset({
                isIOS: true,
                vvOffsetTop: 184.42,
                vvScale: 1,
                isModalOpen: false
            }), 184.4);
        });

        test('returns 0 when not iOS, when modal is open, when pinch-zoomed, or when offsetTop <= 0.5', () => {
            assert.equal(calculateHeaderViewportOffset({ isIOS: false, vvOffsetTop: 150, vvScale: 1, isModalOpen: false }), 0);
            assert.equal(calculateHeaderViewportOffset({ isIOS: true, vvOffsetTop: 150, vvScale: 1, isModalOpen: true }), 0);
            assert.equal(calculateHeaderViewportOffset({ isIOS: true, vvOffsetTop: 150, vvScale: 1.5, isModalOpen: false }), 0);
            assert.equal(calculateHeaderViewportOffset({ isIOS: true, vvOffsetTop: -12, vvScale: 1, isModalOpen: false }), 0);
            assert.equal(calculateHeaderViewportOffset({ isIOS: true, vvOffsetTop: 0.4, vvScale: 1, isModalOpen: false }), 0);
        });
    });

    describe('calculateVisualRectOcclusion coordinate checks', () => {
        test('accounts for visualViewport offsetTop so scrolled inputs visible above keyboard are not re-scrolled', () => {
            assert.equal(calculateVisualRectOcclusion({
                rectTop: 320,
                rectBottom: 360,
                vvTop: 200,
                vvHeight: 450,
                topThreshold: 84,
                bottomThreshold: 36
            }), false);
        });

        test('detects occlusion when visibleTop enters header band or visibleBottom enters keyboard band', () => {
            assert.equal(calculateVisualRectOcclusion({
                rectTop: 240,
                rectBottom: 280,
                vvTop: 200,
                vvHeight: 450,
                topThreshold: 84,
                bottomThreshold: 36
            }), true);
            assert.equal(calculateVisualRectOcclusion({
                rectTop: 600,
                rectBottom: 640,
                vvTop: 200,
                vvHeight: 450,
                topThreshold: 84,
                bottomThreshold: 36
            }), true);
        });
    });
});
