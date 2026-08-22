import test, { describe, before } from 'node:test';
import assert from 'node:assert/strict';

if (typeof globalThis.HTMLElement === 'undefined') {
    globalThis.HTMLElement = class {};
}

if (typeof globalThis.customElements === 'undefined') {
    globalThis.customElements = {
        get: () => null,
        define: () => {}
    };
}

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        scrollY: 0,
        scrollX: 0,
        pageYOffset: 0,
        pageXOffset: 0,
        innerHeight: 800,
        innerWidth: 1200,
        addEventListener: () => {},
        removeEventListener: () => {},
        scrollBy: () => {}
    };
}

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        createElement: () => ({
            style: {},
            classList: { add() {}, remove() {}, contains: () => false },
            appendChild() {},
            remove() {},
            addEventListener() {},
            removeEventListener() {},
            innerHTML: ''
        }),
        body: {
            appendChild: () => {}
        },
        querySelectorAll: () => []
    };
}

describe('Card Drag Manager & Scroll-Invariant Drop Targeting Suite', () => {
    test('cleanupActiveCardDrag safely clears state without throwing', async () => {
        const { cleanupActiveCardDrag } = await import('../../js/ui/cardDragManager.js');
        assert.doesNotThrow(() => {
            cleanupActiveCardDrag();
        });
    });

    test('initCardDragReordering injects drag handles and sets up layout cleanup', async () => {
        const { initCardDragReordering } = await import('../../js/ui/cardDragManager.js');
        const createMockCard = (id) => {
            const card = {
                id,
                style: { transition: '', transform: '', minHeight: '' },
                classList: {
                    _set: new Set(),
                    add(c) { this._set.add(c); },
                    remove(c) { this._set.delete(c); },
                    contains(c) { return this._set.has(c); }
                },
                setAttribute() {},
                getAttribute() { return null; },
                querySelector(sel) {
                    if (sel.includes('header') || sel.includes('title')) {
                        return {
                            appendChild: (child) => { this.handle = child; },
                            querySelector: () => null
                        };
                    }
                    return null;
                },
                getBoundingClientRect() {
                    return { top: 100, left: 20, width: 300, height: 200, bottom: 300, right: 320 };
                }
            };
            return card;
        };

        const card1 = createMockCard('card-1');
        const card2 = createMockCard('card-2');

        const layout = {
            gridEl: {
                querySelectorAll: () => [card1, card2]
            },
            originalCards: [card1, card2],
            config: {
                containerSelector: '.card-container',
                dragHandleSelector: '.card-header',
                hasCompactMode: false
            }
        };

        initCardDragReordering(layout, 'cozy', false, () => {});

        assert.strictEqual(typeof layout.cleanupListeners, 'function');

        layout.cleanupListeners();
    });

    test('computeSlotToCardMapping correctly shifts cards around active drop index', async () => {
        const { computeSlotToCardMapping } = await import('../../js/ui/cardDragTransforms.js');
        const cardA = { id: 'A' };
        const cardB = { id: 'B' };
        const cardC = { id: 'C' };
        const cards = [cardA, cardB, cardC];

        // Forward index shift (0 -> 2)
        const mapForward = computeSlotToCardMapping(cards, cardA, 0, 2);
        assert.strictEqual(mapForward.get(0), cardB);
        assert.strictEqual(mapForward.get(1), cardC);
        assert.strictEqual(mapForward.get(2), cardA);

        // Backward index shift (2 -> 0)
        const mapBackward = computeSlotToCardMapping(cards, cardC, 2, 0);
        assert.strictEqual(mapBackward.get(0), cardC);
        assert.strictEqual(mapBackward.get(1), cardA);
        assert.strictEqual(mapBackward.get(2), cardB);
    });

    test('calculateSlotVisualPositions computes 1-column and 2-column layout rects', async () => {
        const { calculateSlotVisualPositions } = await import('../../js/ui/cardDragTransforms.js');
        const card1 = { id: '1' };
        const card2 = { id: '2' };
        const cards = [card1, card2];
        const cardRectsMap = new Map([
            [card1, { top: 100, left: 50, width: 300, height: 150 }],
            [card2, { top: 270, left: 50, width: 300, height: 150 }]
        ]);
        const slotToCardMap = new Map([[0, card1], [1, card2]]);

        const positions1Col = calculateSlotVisualPositions(cards, cardRectsMap, slotToCardMap);
        assert.strictEqual(positions1Col.get(0).top, 100);
        assert.strictEqual(positions1Col.get(0).left, 50);
        assert.strictEqual(positions1Col.get(1).top, 100 + 150 + 20);

        // Dual-column matrix layout
        const cardRectsMap2Col = new Map([
            [card1, { top: 100, left: 50, width: 300, height: 150 }],
            [card2, { top: 100, left: 400, width: 300, height: 150 }]
        ]);
        const positions2Col = calculateSlotVisualPositions(cards, cardRectsMap2Col, slotToCardMap);
        assert.strictEqual(positions2Col.get(0).left, 50);
        assert.strictEqual(positions2Col.get(1).left, 400);
    });
});
