import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getDefaultState, state } from '../../js/core/state.js';
import {
    initializePriorityEditorShell,
    renderHeroEquipmentGrid
} from '../../js/components/planner/priorityListGridRenderer.js';
import {
    getPreviousValidPriorityOrder,
    getSuggestionsHidden,
    renderSuggestionsAndErrors,
    setPreviousValidPriorityOrder,
    setSuggestionsHidden
} from '../../js/components/planner/priorityListSuggestionsRenderer.js';

class MockElement {
    /**
     * @param {string} [tagName]
     */
    constructor(tagName = 'div') {
        this.tagName = tagName.toUpperCase();
        this.className = '';
        this._classes = new Set();
        this.children = [];
        this.dataset = {};
        this.attributes = {};
        this.innerHTML = '';
        this.classList = {
            add: (...tokens) => tokens.forEach(t => this._classes.add(t)),
            remove: (...tokens) => tokens.forEach(t => this._classes.delete(t)),
            contains: (t) => this._classes.has(t)
        };
    }
    /**
     * @param {MockElement} child
     */
    appendChild(child) {
        this.children.push(child);
        return child;
    }
    /**
     * @param {string} k
     * @param {string} v
     */
    setAttribute(k, v) {
        this.attributes[k] = String(v);
    }
    /**
     * @param {string} k
     */
    getAttribute(k) {
        return this.attributes[k] || null;
    }
    hasChildNodes() {
        return this.children.length > 0;
    }
}

describe('Priority List Modal Shell, Delegation Contracts & Suggestion State', () => {
    beforeEach(() => {
        Object.assign(state, getDefaultState());
    });

    test('initializePriorityEditorShell generates required static container markup and IDs', () => {
        const mockModalBody = {
            innerHTML: '',
            querySelector: function (sel) {
                if (sel === '.hero-equipment-grid') {
                    return new MockElement('div');
                }
                if (sel === '#priority-list-editor') {
                    return new MockElement('div');
                }
                return null;
            }
        };

        const result = initializePriorityEditorShell(/** @type {any} */ (mockModalBody));
        assert.ok(mockModalBody.innerHTML.includes('id="priority-list-message-container"'), 'Shell must include #priority-list-message-container');
        assert.ok(mockModalBody.innerHTML.includes('class="hero-equipment-grid"'), 'Shell must include .hero-equipment-grid');
        assert.ok(mockModalBody.innerHTML.includes('id="priority-list-editor"'), 'Shell must include #priority-list-editor');
        assert.ok(result.gridContainer !== null, 'gridContainer should be resolved');
        assert.ok(result.editor !== null, 'editor should be resolved');
    });

    test('renderHeroEquipmentGrid produces equipment chips with required dataset bindings and accessibility attributes', () => {
        const originalDoc = globalThis.document;
        globalThis.document = {
            createElement: (tag) => new MockElement(tag)
        };

        try {
            const gridContainer = new MockElement('div');
            renderHeroEquipmentGrid(/** @type {any} */ (gridContainer), []);
            assert.ok(gridContainer.children.length > 0, 'Grid container should receive hero rows');

            let chipCount = 0;
            gridContainer.children.forEach(row => {
                const equipmentColumn = row.children.find(c => c._classes.has('equipment-chips-column'));
                if (equipmentColumn) {
                    equipmentColumn.children.forEach(chip => {
                        chipCount++;
                        assert.ok(chip.dataset.heroKey, 'Chip must have data-hero-key');
                        assert.ok(chip.dataset.equipName, 'Chip must have data-equip-name');
                        assert.ok(chip.dataset.equipKey, 'Chip must have data-equip-key');
                        assert.equal(chip.getAttribute('role'), 'button', 'Chip must have role="button"');
                        assert.equal(chip.getAttribute('tabindex'), '0', 'Chip must have tabindex="0"');
                    });
                }
            });
            assert.ok(chipCount > 0, 'Should render multiple equipment chips');
        } finally {
            globalThis.document = originalDoc;
        }
    });

    test('suggestionsHidden and previousValidPriorityOrder setters and getters maintain correct state', () => {
        setSuggestionsHidden(true);
        assert.equal(getSuggestionsHidden(), true);
        setSuggestionsHidden(false);
        assert.equal(getSuggestionsHidden(), false);

        const testOrder = [{ heroName: 'barbarianKing', equipName: 'giantGauntlet', step: '1', priorityIndex: 1 }];
        setPreviousValidPriorityOrder(testOrder);
        assert.deepEqual(getPreviousValidPriorityOrder(), testOrder);
        setPreviousValidPriorityOrder(null);
        assert.equal(getPreviousValidPriorityOrder(), null);
    });

    test('renderSuggestionsAndErrors generates fix-order-btn markup when order errors exist', () => {
        let containerHTML = '';
        const mockErrorContainer = {
            set innerHTML(val) { containerHTML = val; },
            get innerHTML() { return containerHTML; },
            style: {},
            classList: {
                add: () => {},
                remove: () => {}
            }
        };

        const originalDoc = globalThis.document;
        globalThis.document = {
            getElementById: (id) => {
                if (id === 'priority-list-message-container') return mockErrorContainer;
                return null;
            },
            querySelectorAll: () => []
        };

        try {
            const erroredList = [
                { heroName: 'Barbarian King', name: 'Giant Gauntlet', step: '2', priorityIndex: 1, targetLevel: 18 },
                { heroName: 'Barbarian King', name: 'Giant Gauntlet', step: '1', priorityIndex: 2, targetLevel: 15 }
            ];

            renderSuggestionsAndErrors(erroredList, null);
            assert.ok(containerHTML.includes('id="fix-order-btn"'), 'Error container must render #fix-order-btn');
            assert.ok(containerHTML.includes('class="fix-order-btn'), 'Error container must render .fix-order-btn');
        } finally {
            globalThis.document = originalDoc;
        }
    });

    test('renderSuggestionsAndErrors generates hide-suggestion-btn markup when suggestions exist without errors', () => {
        let containerHTML = '';
        const mockErrorContainer = {
            set innerHTML(val) { containerHTML = val; },
            get innerHTML() { return containerHTML; },
            style: {},
            classList: {
                add: () => {},
                remove: () => {}
            }
        };

        const originalDoc = globalThis.document;
        globalThis.document = {
            getElementById: (id) => {
                if (id === 'priority-list-message-container') return mockErrorContainer;
                return null;
            },
            querySelectorAll: () => []
        };

        try {
            setSuggestionsHidden(false);
            const validList = [
                { heroName: 'Barbarian King', name: 'Giant Gauntlet', step: '1', priorityIndex: 1, targetLevel: 15 }
            ];
            const suggestions = [
                { message: 'Move Giant Gauntlet up', itemToMove: { heroName: 'Barbarian King', name: 'Giant Gauntlet', step: 1 } }
            ];

            renderSuggestionsAndErrors(validList, suggestions);
            assert.ok(containerHTML.includes('id="hide-suggestion-btn"'), 'Suggestions box must render #hide-suggestion-btn');
            assert.ok(containerHTML.includes('class="hide-suggestion-btn'), 'Suggestions box must render .hide-suggestion-btn');
        } finally {
            globalThis.document = originalDoc;
        }
    });
});
