import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

if (typeof globalThis.HTMLElement === 'undefined') {
    globalThis.HTMLElement = class {};
}
if (typeof globalThis.customElements === 'undefined') {
    globalThis.customElements = { define: () => {}, get: () => {} };
}
if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        __ENV__: { APP_VERSION: '2.1.0' },
        matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
        addEventListener: () => {},
        removeEventListener: () => {},
        scrollTo: () => {}
    };
}
if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        querySelectorAll: () => [],
        getElementById: () => null,
        addEventListener: () => {},
        removeEventListener: () => {},
        body: { appendChild: () => {}, removeChild: () => {}, contains: () => false }
    };
}

const {
    isDraggingActive,
    getDraggedChipData,
    cancelActiveDrag,
    attachChipPointerListeners
} = await import('../../js/utils/chipPointerManager.js');
const {
    highlightDropTargets,
    clearDropTargetHighlights
} = await import('../../js/utils/chipDragDropTargetValidator.js');

const { state, getDefaultState } = await import('../../js/core/state.js');

describe('Unified Chip Pointer Events Manager Suite', () => {
    let mockChip;
    let mockDayCell;

    beforeEach(() => {
        Object.assign(state, getDefaultState());

        mockDayCell = {
            dataset: { date: '2026-08-15' },
            classList: {
                classes: new Set(['day-cell']),
                add(c) { this.classes.add(c); },
                remove(c) { this.classes.delete(c); },
                contains(c) { return this.classes.has(c); }
            },
            querySelector(sel) {
                if (sel === '.chip-container') {
                    return this.chipContainer;
                }
                return null;
            }
        };

        const chipContainer = {
            classList: {
                classes: new Set(['chip-container']),
                add(c) { this.classes.add(c); },
                remove(c) { this.classes.delete(c); },
                contains(c) { return this.classes.has(c); }
            },
            closest(sel) {
                if (sel === '.day-cell') return mockDayCell;
                return null;
            }
        };
        mockDayCell.chipContainer = chipContainer;

        const listeners = {};
        mockChip = {
            id: 'clanWar-01-08-2026',
            draggable: true,
            getAttribute(attr) { return attr === 'draggable' ? 'true' : null; },
            dataset: { type: 'clanWar', instance: '1', shiny: '1200', glowy: '200', starry: '10' },
            classList: {
                classes: new Set(['income-chip']),
                add(c) { this.classes.add(c); },
                remove(c) { this.classes.delete(c); },
                contains(c) { return this.classes.has(c); }
            },
            closest(sel) {
                if (sel === '.day-cell') return mockDayCell;
                return null;
            },
            getBoundingClientRect() {
                return { left: 100, top: 200, width: 80, height: 32, right: 180, bottom: 232 };
            },
            addEventListener(ev, fn) {
                listeners[ev] = fn;
            },
            dispatchMockEvent(ev, detail) {
                if (listeners[ev]) listeners[ev](detail);
            }
        };
    });

    afterEach(() => {
        cancelActiveDrag();
    });

    test('Initial drag state is inactive', () => {
        assert.equal(isDraggingActive(), false);
        assert.equal(getDraggedChipData(), null);
    });

    test('attachChipPointerListeners binds pointerdown and dragstart listeners to draggable chip', () => {
        let dragstartPrevented = false;
        mockChip.dataset.draggable = 'true';
        attachChipPointerListeners(mockChip, { type: 'clanWar', shiny: 1200 });
        assert.equal(typeof mockChip.dispatchMockEvent, 'function');

        mockChip.dispatchMockEvent('dragstart', {
            preventDefault() { dragstartPrevented = true; }
        });
        assert.equal(dragstartPrevented, true);
    });

    test('attachChipPointerListeners skips drag if dataset.draggable is false', () => {
        mockChip.dataset.draggable = 'false';
        attachChipPointerListeners(mockChip, { type: 'clanWar', shiny: 1200 });
        mockChip.dispatchMockEvent('pointerdown', {
            button: 0,
            pointerType: 'mouse',
            pointerId: 1
        });
        assert.equal(isDraggingActive(), false);
    });

    test('cancelActiveDrag cleans up state and resets isChipDragging', () => {
        state.isChipDragging = true;
        cancelActiveDrag();
        assert.equal(state.isChipDragging, false);
        assert.equal(isDraggingActive(), false);
    });

    test('highlightDropTargets and clearDropTargetHighlights execute safely', () => {
        assert.doesNotThrow(() => {
            highlightDropTargets(mockChip, { type: 'clanWar', isCustom: true });
            clearDropTargetHighlights();
        });
    });

    test('clearDropTargetHighlights cleanly removes drag highlights', () => {
        assert.doesNotThrow(() => {
            clearDropTargetHighlights();
        });
    });
});
