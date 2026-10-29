import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { updateWrappedSeparators, observeWrappedSeparators } from '../../js/components/common/appFooter.js';

describe('Wrapped Separators and Line-Break Delimiter Suppression Suite', () => {
    /**
     * Helper to create a synthetic container element with children.
     * @param {Array<{ offsetTop: number, isHidden?: boolean }>} items
     * @returns {any}
     */
    function createMockContainer(items) {
        const children = items.map((item) => {
            const classSet = new Set();
            return {
                offsetTop: item.offsetTop,
                offsetParent: item.isHidden ? null : {},
                offsetWidth: item.isHidden ? 0 : 100,
                offsetHeight: item.isHidden ? 0 : 20,
                classList: {
                    add: (cls) => classSet.add(cls),
                    remove: (cls) => classSet.delete(cls),
                    contains: (cls) => classSet.has(cls)
                }
            };
        });

        return {
            children
        };
    }

    test('updateWrappedSeparators gracefully handles null, undefined, or empty containers', () => {
        assert.doesNotThrow(() => updateWrappedSeparators(null));
        assert.doesNotThrow(() => updateWrappedSeparators(undefined));
        assert.doesNotThrow(() => updateWrappedSeparators({}));
        assert.doesNotThrow(() => updateWrappedSeparators({ children: [] }));
    });

    test('marks only the initial item as row start when all items fit on a single line', () => {
        const container = createMockContainer([
            { offsetTop: 100 },
            { offsetTop: 100 },
            { offsetTop: 100 }
        ]);

        updateWrappedSeparators(container);

        assert.equal(container.children[0].classList.contains('is-row-start'), true);
        assert.equal(container.children[1].classList.contains('is-row-start'), false);
        assert.equal(container.children[2].classList.contains('is-row-start'), false);
    });

    test('marks wrapped item as row start when overflowing onto a second line', () => {
        const container = createMockContainer([
            { offsetTop: 100 },
            { offsetTop: 100 },
            { offsetTop: 125 }
        ]);

        updateWrappedSeparators(container);

        assert.equal(container.children[0].classList.contains('is-row-start'), true);
        assert.equal(container.children[1].classList.contains('is-row-start'), false);
        assert.equal(container.children[2].classList.contains('is-row-start'), true);
    });

    test('preserves mid-row bullets between items sharing the wrapped second line', () => {
        const container = createMockContainer([
            { offsetTop: 100 },
            { offsetTop: 100 },
            { offsetTop: 125 },
            { offsetTop: 125 }
        ]);

        updateWrappedSeparators(container);

        assert.equal(container.children[0].classList.contains('is-row-start'), true);
        assert.equal(container.children[1].classList.contains('is-row-start'), false);
        assert.equal(container.children[2].classList.contains('is-row-start'), true);
        assert.equal(container.children[3].classList.contains('is-row-start'), false);
    });

    test('marks all items when every element wraps onto its own individual line', () => {
        const container = createMockContainer([
            { offsetTop: 100 },
            { offsetTop: 125 },
            { offsetTop: 150 }
        ]);

        updateWrappedSeparators(container);

        assert.equal(container.children[0].classList.contains('is-row-start'), true);
        assert.equal(container.children[1].classList.contains('is-row-start'), true);
        assert.equal(container.children[2].classList.contains('is-row-start'), true);
    });

    test('ignores hidden or display:none elements without skewing row detection', () => {
        const container = createMockContainer([
            { offsetTop: 100 },
            { offsetTop: 100 },
            { offsetTop: 125 },
            { offsetTop: 0, isHidden: true }
        ]);

        updateWrappedSeparators(container);

        assert.equal(container.children[0].classList.contains('is-row-start'), true);
        assert.equal(container.children[1].classList.contains('is-row-start'), false);
        assert.equal(container.children[2].classList.contains('is-row-start'), true);
        assert.equal(container.children[3].classList.contains('is-row-start'), false);
    });

    test('removes is-row-start class when previously wrapped item moves back onto preceding row', () => {
        const container = createMockContainer([
            { offsetTop: 100 },
            { offsetTop: 100 },
            { offsetTop: 125 }
        ]);

        updateWrappedSeparators(container);
        assert.equal(container.children[2].classList.contains('is-row-start'), true);

        // Container expands, item 2 rejoins row 1
        container.children[2].offsetTop = 100;
        updateWrappedSeparators(container);

        assert.equal(container.children[2].classList.contains('is-row-start'), false);
    });

    test('observeWrappedSeparators returns a cleanup function and handles missing ResizeObserver gracefully', () => {
        const container = createMockContainer([{ offsetTop: 100 }]);

        const cleanup = observeWrappedSeparators(container);
        assert.equal(typeof cleanup, 'function');
        assert.doesNotThrow(() => cleanup());

        assert.equal(typeof observeWrappedSeparators(null), 'function');
    });
});
