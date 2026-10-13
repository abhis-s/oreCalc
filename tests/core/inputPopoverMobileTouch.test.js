import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { positionPopover } from '../../js/utils/inputPopoverPositioner.js';

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        innerWidth: 1024,
        innerHeight: 768,
        visualViewport: null
    };
}

describe('Input Popover Mobile Touch & Non-Overlapping Clamping Suite', () => {
    test('positionPopover preserves below placement clearance without occluding input element', () => {
        const popover = {
            classList: {
                contains: (cls) => cls === 'show',
                remove: () => {},
                add: () => {}
            },
            getBoundingClientRect: () => ({
                height: 165,
                width: 280
            }),
            style: {}
        };

        const inputElement = {
            getBoundingClientRect: () => ({
                top: 180,
                bottom: 210,
                left: 100,
                right: 160,
                width: 60,
                height: 30
            })
        };

        const originalVV = globalThis.window.visualViewport;
        const originalIH = globalThis.window.innerHeight;

        try {
            globalThis.window.visualViewport = {
                height: 350,
                width: 380,
                offsetTop: 0,
                offsetLeft: 0
            };
            globalThis.window.innerHeight = 350;

            positionPopover(popover, inputElement, { placement: 'force-below' });

            const popoverTop = parseFloat(popover.style.top);
            assert.ok(!isNaN(popoverTop), 'popover top should be a valid number');
            assert.ok(
                popoverTop >= 214,
                `popover top (${popoverTop}) must remain strictly below input bottom (210) to avoid occlusion`
            );
        } finally {
            globalThis.window.visualViewport = originalVV;
            globalThis.window.innerHeight = originalIH;
        }
    });

    test('positionPopover preserves above placement clearance without occluding input element', () => {
        const popover = {
            classList: {
                contains: (cls) => cls === 'show',
                remove: () => {},
                add: () => {}
            },
            getBoundingClientRect: () => ({
                height: 165,
                width: 280
            }),
            style: {}
        };

        const inputElement = {
            getBoundingClientRect: () => ({
                top: 250,
                bottom: 280,
                left: 100,
                right: 160,
                width: 60,
                height: 30
            })
        };

        const originalVV = globalThis.window.visualViewport;
        const originalIH = globalThis.window.innerHeight;

        try {
            globalThis.window.visualViewport = {
                height: 350,
                width: 380,
                offsetTop: 0,
                offsetLeft: 0
            };
            globalThis.window.innerHeight = 350;

            positionPopover(popover, inputElement, { placement: 'force-above' });

            const popoverTop = parseFloat(popover.style.top);
            assert.ok(!isNaN(popoverTop), 'popover top should be a valid number');
            assert.ok(
                popoverTop + 165 <= 250,
                `popover bottom (${popoverTop + 165}) must remain strictly above input top (250) to avoid occlusion`
            );
        } finally {
            globalThis.window.visualViewport = originalVV;
            globalThis.window.innerHeight = originalIH;
        }
    });
});
