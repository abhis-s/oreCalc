import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { updateTabIndicator, renderModifierTabs } from '../../js/components/equipment/equipmentDetailsHeaderDisplay.js';

describe('Equipment Details Modifier Tab Indicator Suite', () => {

    class MockElement {
        /**
         * @param {string} tagName
         * @param {Object} [props]
         */
        constructor(tagName, props = {}) {
            this.tagName = tagName.toUpperCase();
            this.className = props.className || '';
            this._classes = new Set(this.className ? this.className.split(/\s+/) : []);
            this.style = {};
            this.dataset = { ...(props.dataset || {}) };
            this.children = [];
            this.parentNode = null;
            this.innerHTML = '';
            this.offsetLeft = props.offsetLeft || 0;
            this.offsetWidth = props.offsetWidth || 0;
            this.offsetHeight = props.offsetHeight || 0;
            this.scrollLeft = 0;
            this._eventListeners = {};

            this.classList = {
                add: (...tokens) => tokens.forEach(t => this._classes.add(t)),
                remove: (...tokens) => tokens.forEach(t => this._classes.delete(t)),
                toggle: (token, force) => {
                    if (force === undefined) {
                        if (this._classes.has(token)) {
                            this._classes.delete(token);
                            return false;
                        }
                        this._classes.add(token);
                        return true;
                    }
                    if (force) {
                        this._classes.add(token);
                        return true;
                    }
                    this._classes.delete(token);
                    return false;
                },
                contains: (token) => this._classes.has(token)
            };
        }

        querySelector(selector) {
            if (selector === '.mod-tab-indicator') {
                return this.children.find(c => c.classList.contains('mod-tab-indicator')) || null;
            }
            if (selector === '.mod-tab-btn.active') {
                return this.children.find(c => c.classList.contains('mod-tab-btn') && c.classList.contains('active')) || null;
            }
            if (selector === '.unit-level-badge') {
                if (this._badgeEl) return this._badgeEl;
                const match = this.innerHTML.match(/class="([^"]*unit-level-badge[^"]*)"[^>]*>([^<]*)/);
                if (match) {
                    this._badgeEl = new MockElement('span', { className: match[1] });
                    this._badgeEl.textContent = match[2];
                    return this._badgeEl;
                }
                return this.children.find(c => c.classList.contains('unit-level-badge')) || null;
            }
            const dataMatch = selector.match(/\.mod-tab-btn\[data-mod-key="([^"]+)"\]/);
            if (dataMatch) {
                const key = dataMatch[1];
                return this.children.find(c => c.classList.contains('mod-tab-btn') && c.dataset.modKey === key) || null;
            }
            return null;
        }

        querySelectorAll(selector) {
            if (selector === '.mod-tab-btn') {
                return this.children.filter(c => c.classList.contains('mod-tab-btn'));
            }
            if (selector === '.stat-progress-row') {
                if (this._progressRows) return this._progressRows;
                const matches = [...this.innerHTML.matchAll(/class="stat-progress-row"/g)];
                this._progressRows = matches.map(() => {
                    const row = new MockElement('div', { className: 'stat-progress-row' });
                    const val = new MockElement('span', { className: 'stat-val' });
                    row.children.push(val);
                    row.querySelector = (s) => s === '.stat-val' ? val : null;
                    return row;
                });
                return this._progressRows;
            }
            return [];
        }

        scrollIntoView() {}

        addEventListener(event, handler) {
            if (!this._eventListeners[event]) this._eventListeners[event] = [];
            this._eventListeners[event].push(handler);
        }

        removeEventListener(event, handler) {
            if (this._eventListeners[event]) {
                this._eventListeners[event] = this._eventListeners[event].filter(h => h !== handler);
            }
        }
    }

    test('updateTabIndicator handles empty or missing container gracefully', () => {
        assert.doesNotThrow(() => updateTabIndicator(null, 'standard'));
        assert.doesNotThrow(() => updateTabIndicator(/** @type {any} */ ({}), 'standard'));
    });

    test('renderModifierTabs hides and clears container when data is invalid', () => {
        const container = /** @type {any} */ (new MockElement('div'));
        renderModifierTabs(container, false, true, 'standard', () => {});
        assert.equal(container.style.display, 'none');
        assert.equal(container.innerHTML, '');
    });

    test('renderStatsProgressList only highlights stats that differ arithmetically from standard baseline', async () => {
        const { renderStatsProgressList } = await import('../../js/components/equipment/equipmentDetailsStatsDisplay.js');
        const container = new MockElement('div');

        const mockData = {
            rarity: 'common',
            statsMeta: [
                { key: 'damagePerSecondIncrease', category: 'heroBoost', valueUnit: 'number', isModifiable: true },
                { key: 'invisibilityDuration', category: 'ability', valueUnit: 'seconds' }
            ]
        };
        const levelsArray = [
            [100, 5],
            [110, 5],
            [120, 6]
        ];

        // Standard mode: unadjusted baseline
        renderStatsProgressList(/** @type {any} */ (container), mockData, levelsArray, 3, 3, 'common', 'standard');
        assert.ok(container.innerHTML.includes('120'));
        assert.ok(!container.innerHTML.includes('stat-val-modified'));

        // Legend modifier: heroBoost scaled (120 * 0.95 = 114), ability unadjusted (6 == 6)
        renderStatsProgressList(/** @type {any} */ (container), mockData, levelsArray, 3, 3, 'common', 'legend3');
        assert.ok(container.innerHTML.includes('114'));
        assert.ok(container.innerHTML.includes('stat-val-modified'));
        const match = container.innerHTML.match(/data-stat-idx="1"[\s\S]*?<\/div>/);
        assert.ok(match && !match[0].includes('stat-val-modified'));
    });

    test('renderUnitStatsView only highlights equipment-scaled spawned units on Esports downgrade, not on Legend modifiers', async () => {
        const { renderUnitStatsView } = await import('../../js/components/equipment/equipmentDetailsUnitStatsDisplay.js');
        const container = new MockElement('div');

        const mockData = {
            id: 'healer_puppet',
            rarity: 'common',
            statsMeta: [
                { key: 'summonedUnitsLevel', category: 'ability', valueUnit: 'number' }
            ],
            hasSpawnedUnits: true,
            spawnedUnits: {
                unitType: 'healer',
                scalingType: 'equipmentLevel',
                statsMeta: [
                    { key: 'healingPerSecond', valueUnit: 'number' }
                ],
                levels: {
                    '1': [36],
                    '2': [48],
                    '3': [60],
                    '4': [66],
                    '5': [72],
                    '6': [72],
                    '7': [72]
                }
            }
        };

        const levelsArray = [
            [4], [4], [5], [5], [5], [5],
            [5], [5], [6], [6], [6], [7],
            [7], [7], [7], [7], [7], [8]
        ];

        // Standard mode: level 18 baseline
        renderUnitStatsView(/** @type {any} */ (container), mockData, levelsArray, 18, 18, 'common', 'standard', 18);
        assert.ok(!container.innerHTML.includes('unit-level-badge stat-val-modified'));

        // Legend mode: multiplier only, zero level downgrade
        renderUnitStatsView(/** @type {any} */ (container), mockData, levelsArray, 18, 18, 'common', 'legend3', 18);
        assert.ok(!container.innerHTML.includes('unit-level-badge stat-val-modified'));

        // Esports mode: level downgraded from 18 to 15
        renderUnitStatsView(/** @type {any} */ (container), mockData, levelsArray, 18, 18, 'common', 'esports', 15);
        assert.ok(container.innerHTML.includes('unit-level-badge stat-val-modified'));
    });

    test('updateUnitStatsHover updates unit level badge and displays stat comparison on hover', async () => {
        const { renderUnitStatsView, updateUnitStatsHover } = await import('../../js/components/equipment/equipmentDetailsUnitStatsDisplay.js');
        const container = new MockElement('div');

        const mockData = {
            id: 'healer_puppet',
            rarity: 'common',
            statsMeta: [
                { key: 'summonedUnitsLevel', category: 'ability', valueUnit: 'number' }
            ],
            hasSpawnedUnits: true,
            spawnedUnits: {
                unitType: 'healer',
                scalingType: 'equipmentLevel',
                statsMeta: [
                    { key: 'healingPerSecond', valueUnit: 'number' }
                ],
                levels: {
                    '4': [66],
                    '7': [72],
                    '8': [76]
                }
            }
        };

        const levelsArray = [
            [4], [4], [5], [5], [5], [5],
            [5], [5], [6], [6], [6], [7],
            [7], [7], [7], [7], [7], [8]
        ];

        renderUnitStatsView(/** @type {any} */ (container), mockData, levelsArray, 18, 18, 'common', 'standard', 18);

        // Hover target level 1
        updateUnitStatsHover(/** @type {any} */ (container), mockData, levelsArray, 18, 18, 'common', 'standard', 1);

        const badge = container.querySelector('.unit-level-badge');
        assert.ok(badge && badge.textContent.includes('4'));

        // Hover reset
        updateUnitStatsHover(/** @type {any} */ (container), mockData, levelsArray, 18, 18, 'common', 'standard', null);
        assert.ok(badge && badge.textContent.includes('8'));
    });

    test('getCurrentStatsStateMap and renderStatsProgressList anchor progress percentage to true max', async () => {
        const { getCurrentStatsStateMap, renderStatsProgressList } = await import('../../js/components/equipment/equipmentDetailsStatsDisplay.js');
        const container = new MockElement('div');

        const mockData = {
            id: 'giant_gauntlet',
            rarity: 'epic',
            statsMeta: [
                { key: 'damagePerSecondIncrease', category: 'heroBoost', valueUnit: 'number' }
            ]
        };

        const levelsArray = Array.from({ length: 27 }, (_, i) => [(i + 1) * (100 / 27)]);

        // Standard max level (100%)
        const stdMap = getCurrentStatsStateMap(mockData, levelsArray, 27, 27, 'epic', 'standard');
        assert.strictEqual(stdMap.damagePerSecondIncrease.pct, 100);

        // Legend 3 multiplier 0.95 (95%)
        const l3Map = getCurrentStatsStateMap(mockData, levelsArray, 27, 27, 'epic', 'legend3');
        assert.strictEqual(l3Map.damagePerSecondIncrease.pct, 95);

        // Legend 1 multiplier 0.80 (80%)
        const l1Map = getCurrentStatsStateMap(mockData, levelsArray, 27, 27, 'epic', 'legend1');
        assert.strictEqual(l1Map.damagePerSecondIncrease.pct, 80);

        // Esports mode (0.80 multiplier + level downgrade to 21)
        const esportsMap = getCurrentStatsStateMap(mockData, levelsArray, 27, 27, 'epic', 'esports');
        assert.ok(esportsMap.damagePerSecondIncrease.pct < 80);
        assert.ok(esportsMap.damagePerSecondIncrease.pct > 50);

        // Target width DOM attribute assertion
        renderStatsProgressList(/** @type {any} */ (container), mockData, levelsArray, 27, 27, 'epic', 'legend1');
        assert.ok(container.innerHTML.includes('data-target-width="80"'));
    });
});
