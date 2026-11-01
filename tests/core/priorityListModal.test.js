import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDefaultState, state } from '../../js/core/state.js';
import { loadTranslations, translate } from '../../js/i18n/translator.js';
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
import { renderDraggableList } from '../../js/components/planner/priorityListModalDisplay.js';
import { hideCardHelpPopover } from '../../js/utils/cardHelpPopover.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));

class MockElement {
    /**
     * @param {string} [tagName]
     * @param {string} [id]
     */
    constructor(tagName = 'div', id = '') {
        this.tagName = tagName.toUpperCase();
        this.id = id;
        this.className = '';
        this._classes = new Set();
        this.children = [];
        this.dataset = {};
        this.attributes = {};
        this.style = {};
        this._innerHTML = '';
        this.textContent = '';
        this.eventListeners = new Map();
        this.classList = {
            add: (...tokens) => tokens.forEach(t => { if (t) this._classes.add(t); }),
            remove: (...tokens) => tokens.forEach(t => this._classes.delete(t)),
            contains: (t) => this._classes.has(t)
        };
    }

    get innerHTML() {
        return this._innerHTML;
    }

    set innerHTML(val) {
        this._innerHTML = String(val || '');
        this.children = [];
        const oresMatch = this._innerHTML.match(/<div class="priority-item-ores"([^>]*)>/);
        if (oresMatch) {
            const oresEl = new MockElement('div');
            oresEl.classList.add('priority-item-ores');
            const attrStr = oresMatch[1];
            for (const attr of ['role', 'tabindex', 'aria-label']) {
                const m = attrStr.match(new RegExp(`${attr}="([^"]*)"`));
                if (m) oresEl.setAttribute(attr, m[1]);
            }
            this.appendChild(oresEl);
        }
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

    /**
     * @param {string} k
     */
    removeAttribute(k) {
        delete this.attributes[k];
    }

    /**
     * @param {string} k
     */
    hasAttribute(k) {
        return Object.prototype.hasOwnProperty.call(this.attributes, k);
    }

    hasChildNodes() {
        return this.children.length > 0;
    }

    /**
     * @param {string} sel
     * @returns {MockElement|null}
     */
    querySelector(sel) {
        const cls = sel.startsWith('.') ? sel.slice(1) : '';
        for (const child of this.children) {
            if (cls && child._classes.has(cls)) return child;
            const nested = child.querySelector(sel);
            if (nested) return nested;
        }
        return null;
    }

    /**
     * @param {string} sel
     * @returns {MockElement[]}
     */
    querySelectorAll(sel) {
        const cls = sel.startsWith('.') ? sel.slice(1) : '';
        const matches = [];
        for (const child of this.children) {
            if (cls && child._classes.has(cls)) matches.push(child);
            matches.push(...child.querySelectorAll(sel));
        }
        return matches;
    }

    /**
     * @param {string} event
     * @param {Function} handler
     */
    addEventListener(event, handler) {
        if (!this.eventListeners.has(event)) this.eventListeners.set(event, []);
        this.eventListeners.get(event).push(handler);
    }

    /**
     * @param {any} evt
     */
    dispatchEvent(evt) {
        const type = typeof evt === 'string' ? evt : evt.type;
        const handlers = this.eventListeners.get(type) || [];
        handlers.forEach(fn => fn(evt));
        return true;
    }

    click() {
        this.dispatchEvent({
            type: 'click',
            target: this,
            preventDefault: () => {},
            stopPropagation: () => {}
        });
    }

    getBoundingClientRect() {
        return { top: 100, left: 100, bottom: 140, right: 200, width: 100, height: 40 };
    }
}

describe('Priority List Modal Shell, Delegation Contracts & Suggestion State', () => {
    beforeEach(async () => {
        Object.assign(state, getDefaultState());
        globalThis.fetch = async (url) => {
            if (typeof url === 'string' && url.includes('/en.json')) return { ok: true, json: async () => enJson };
            return { ok: false, status: 404 };
        };
        await loadTranslations('en');
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
        globalThis.document = /** @type {any} */ ({
            createElement: (tag) => new MockElement(tag)
        });

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
        globalThis.document = /** @type {any} */ ({
            getElementById: (id) => {
                if (id === 'priority-list-message-container') return mockErrorContainer;
                return null;
            },
            querySelectorAll: () => []
        });

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
        globalThis.document = /** @type {any} */ ({
            getElementById: (id) => {
                if (id === 'priority-list-message-container') return mockErrorContainer;
                return null;
            },
            querySelectorAll: () => []
        });

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

    describe('Priority List Step Ores Popover & Edge Cases', () => {
        /** @type {MockElement} */
        let editorElement;
        /** @type {MockElement} */
        let popoverElement;
        /** @type {any} */
        let originalDoc;
        /** @type {any} */
        let originalWin;

        beforeEach(() => {
            originalDoc = globalThis.document;
            originalWin = globalThis.window;

            editorElement = new MockElement('div', 'priority-list-editor');
            popoverElement = new MockElement('div', 'card-help-popover');
            const resetBtn = new MockElement('button', 'reset-priority-list-modal-btn');
            const infoBtn = new MockElement('button', 'priority-list-modal-info-btn');
            const msgContainer = new MockElement('div', 'priority-list-message-container');

            const byId = {
                'priority-list-editor': editorElement,
                'card-help-popover': popoverElement,
                'reset-priority-list-modal-btn': resetBtn,
                'priority-list-modal-info-btn': infoBtn,
                'priority-list-message-container': msgContainer
            };

            globalThis.window = /** @type {any} */ ({
                innerWidth: 1024,
                innerHeight: 768
            });

            globalThis.document = /** @type {any} */ ({
                body: new MockElement('body'),
                getElementById: (id) => byId[id] || null,
                createElement: (tag) => new MockElement(tag),
                querySelectorAll: () => [],
                addEventListener: () => {}
            });

            state.heroes = {
                'Barbarian King': {
                    level: 95,
                    equipment: {
                        giantGauntlet: {
                            name: 'Giant Gauntlet',
                            level: 1,
                            type: 'epic',
                            upgradePlan: {
                                '1': { targetLevel: 18, enabled: true, priorityIndex: 1 }
                            }
                        }
                    }
                }
            };
        });

        test('renders .priority-item-ores pill and opens/toggles breakdown popover via click, keyboard, and pointer hover', () => {
            try {
                const mockList = [
                    {
                        heroName: 'Barbarian King',
                        name: 'Giant Gauntlet',
                        step: 1,
                        targetLevel: 18,
                        image: 'assets/giant_gauntlet.png',
                        completionDate: new Date('2026-09-01'),
                        oresPreCompletion: { shiny: 1200, glowy: 400, starry: 50 },
                        requiredOres: { shiny: 15000, glowy: 1920, starry: 120 },
                        bottleneckOre: 'glowy'
                    }
                ];

                renderDraggableList(mockList, []);

                const item = editorElement.querySelector('.priority-list-editor-item');
                assert.ok(item);

                const oresPill = item.querySelector('.priority-item-ores');
                assert.ok(oresPill);
                assert.equal(oresPill.getAttribute('role'), 'button');
                assert.equal(oresPill.getAttribute('tabindex'), '0');
                assert.equal(oresPill.getAttribute('aria-label'), translate('views.income.ores.storedTitle'));

                // Click opens popover with breakdown
                oresPill.click();
                assert.ok(popoverElement.classList.contains('show'));
                assert.ok(popoverElement.innerHTML.includes('Giant Gauntlet'));
                assert.ok(popoverElement.innerHTML.includes('1 &rarr; 18'));
                assert.ok(popoverElement.innerHTML.includes(`${translate('views.income.ores.bottleneckLabel')}: <span class="ore-text-glowy">${translate('entities.ores.glowy')}</span>`));
                assert.ok(popoverElement.innerHTML.includes('15,000') && popoverElement.innerHTML.includes('1,920') && popoverElement.innerHTML.includes('120'));

                // Second click toggles popover off
                oresPill.click();
                assert.equal(popoverElement.classList.contains('show'), false);

                // Keyboard Enter and Space open popover
                let prevented = false;
                oresPill.dispatchEvent({
                    type: 'keydown',
                    key: 'Enter',
                    preventDefault: () => { prevented = true; },
                    stopPropagation: () => {}
                });
                assert.ok(prevented);
                assert.ok(popoverElement.classList.contains('show'));

                hideCardHelpPopover();
                assert.equal(popoverElement.classList.contains('show'), false);

                prevented = false;
                oresPill.dispatchEvent({
                    type: 'keydown',
                    key: ' ',
                    preventDefault: () => { prevented = true; },
                    stopPropagation: () => {}
                });
                assert.ok(prevented);
                assert.ok(popoverElement.classList.contains('show'));
                hideCardHelpPopover();

                // Pointer hover opens on mouse, ignores touch
                oresPill.dispatchEvent({ type: 'pointerenter', pointerType: 'mouse' });
                assert.ok(popoverElement.classList.contains('show'));
                oresPill.dispatchEvent({ type: 'pointerleave', pointerType: 'mouse' });
                assert.equal(popoverElement.classList.contains('show'), false);

                oresPill.dispatchEvent({ type: 'pointerenter', pointerType: 'touch' });
                assert.equal(popoverElement.classList.contains('show'), false);
            } finally {
                globalThis.document = originalDoc;
                globalThis.window = originalWin;
            }
        });

        test('omits .priority-item-ores when step has order error or missing ore breakdown properties', () => {
            try {
                renderDraggableList([
                    {
                        heroName: 'Barbarian King',
                        name: 'Giant Gauntlet',
                        step: 2,
                        targetLevel: 18,
                        image: 'assets/giant_gauntlet.png',
                        error: true,
                        message: 'Order error'
                    }
                ], []);
                assert.equal(editorElement.querySelector('.priority-item-ores'), null);

                assert.doesNotThrow(() => {
                    renderDraggableList([
                        {
                            heroName: 'Barbarian King',
                            name: 'Giant Gauntlet',
                            step: 1,
                            targetLevel: 18,
                            image: 'assets/giant_gauntlet.png',
                            completionDate: new Date('2026-09-01')
                        }
                    ], []);
                });
                assert.equal(editorElement.querySelector('.priority-item-ores'), null);
            } finally {
                globalThis.document = originalDoc;
                globalThis.window = originalWin;
            }
        });
    });
});
