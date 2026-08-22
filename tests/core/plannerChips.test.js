import { describe, test, beforeEach } from 'node:test';
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
        location: { hostname: 'localhost', href: 'http://localhost/' },
        matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
        addEventListener: () => {},
        removeEventListener: () => {},
        scrollTo: () => {},
        getComputedStyle: () => ({ display: 'block' }),
        requestAnimationFrame: (cb) => { cb(); return 1; },
        cancelAnimationFrame: () => {}
    };
}

const mockStorage = new Map();

const storageMock = {
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, String(val)),
    removeItem: (key) => mockStorage.delete(key),
    clear: () => mockStorage.clear()
};

globalThis.localStorage = storageMock;
if (globalThis.window) {
    globalThis.window.localStorage = storageMock;
}

class MockElement {
    constructor(tagName = 'div') {
        this.tagName = tagName.toUpperCase();
        this.id = '';
        this.className = '';
        this.children = [];
        this.dataset = {};
        this.style = {};
        this.offsetWidth = 400;
        this.offsetHeight = 300;
        this._classes = new Set();
        this.classList = {
            add: (...cls) => cls.forEach(c => this._classes.add(c)),
            remove: (...cls) => cls.forEach(c => this._classes.delete(c)),
            contains: (c) => this._classes.has(c)
        };
        this.attributes = new Map();
    }
    setAttribute(name, val) { this.attributes.set(name, String(val)); }
    removeAttribute(name) { this.attributes.delete(name); }
    getAttribute(name) { return this.attributes.get(name); }
    appendChild(child) {
        this.children.push(child);
        return child;
    }
    addEventListener() {}
    removeEventListener() {}
    querySelectorAll() { return []; }
}

const mockDomElements = new Map();

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        getElementById: (id) => mockDomElements.get(id) || null,
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: (tag) => new MockElement(tag),
        body: new MockElement('body'),
        addEventListener: () => {},
        removeEventListener: () => {}
    };
}

const { CANONICAL_CHIP_PRIORITY_ORDER } = await import('../../js/data/incomeSourceRegistry.js');
const { renderIncomeChipsLegend } = await import('../../js/utils/chipFactory.js');
const { showDayOverviewPopover, hideDayOverviewPopover } = await import('../../js/components/planner/dayOverviewPopover.js');
const { clearMonthCalendarChips } = await import('../../js/utils/chipManager.js');
const { handleChipDropOnCalendar } = await import('../../js/components/planner/calendarDragDrop.js');
const { performAutoPlacementForMonth, syncAutoPlacedChipsForMonth } = await import('../../js/utils/autoPlaceChips.js');
const { handleChipDropOnContainer } = await import('../../js/components/planner/incomeChipsInputs.js');

const { state, getDefaultState } = await import('../../js/core/state.js');

describe('Planner Chips Subsystem & Drag/Drop Integrity Tests', () => {
    beforeEach(() => {
        Object.assign(state, getDefaultState());
    });

    test('CANONICAL_CHIP_PRIORITY_ORDER enforces deterministic stacking order', () => {
        assert.ok(Array.isArray(CANONICAL_CHIP_PRIORITY_ORDER));

        const sb4xIdx = CANONICAL_CHIP_PRIORITY_ORDER.indexOf('starBonus4x');
        const sbIdx = CANONICAL_CHIP_PRIORITY_ORDER.indexOf('starBonus');
        const prosIdx = CANONICAL_CHIP_PRIORITY_ORDER.indexOf('prospector');
        const cwlIdx = CANONICAL_CHIP_PRIORITY_ORDER.indexOf('cwl');
        const warIdx = CANONICAL_CHIP_PRIORITY_ORDER.indexOf('clanWar');
        const raidIdx = CANONICAL_CHIP_PRIORITY_ORDER.indexOf('raidMedalTrader');
        const gemIdx = CANONICAL_CHIP_PRIORITY_ORDER.indexOf('gemTrader');
        const passIdx = CANONICAL_CHIP_PRIORITY_ORDER.indexOf('eventPass');
        const trdIdx = CANONICAL_CHIP_PRIORITY_ORDER.indexOf('eventTrader');
        const shopIdx = CANONICAL_CHIP_PRIORITY_ORDER.indexOf('shopOffers');
        const scIdx = CANONICAL_CHIP_PRIORITY_ORDER.indexOf('supercellEvents');
        const customIdx = CANONICAL_CHIP_PRIORITY_ORDER.indexOf('custom');

        assert.ok(sb4xIdx < sbIdx);
        assert.ok(sbIdx < prosIdx);
        assert.ok(prosIdx < cwlIdx);
        assert.ok(cwlIdx < warIdx);
        assert.ok(warIdx < raidIdx);
        assert.ok(raidIdx < gemIdx);
        assert.ok(gemIdx < passIdx);
        assert.ok(passIdx < trdIdx);
        assert.ok(trdIdx < shopIdx);
        assert.ok(shopIdx < scIdx);
        assert.ok(scIdx < customIdx);
    });

    test('renderIncomeChipsLegend renders items in strict canonical priority order', () => {
        const legendContainer = new MockElement('div');
        renderIncomeChipsLegend(legendContainer);

        assert.ok(legendContainer.children.length > 0);
        const renderedClassNames = legendContainer.children.map(child => {
            const colorBox = child.children.find(c => c._classes.has('color-box'));
            return colorBox ? [...colorBox._classes].filter(c => c !== 'color-box')[0] : null;
        }).filter(Boolean);

        const sbIndex = renderedClassNames.findIndex(c => c.includes('star-bonus'));
        const prosIndex = renderedClassNames.findIndex(c => c.includes('prospector'));
        const cwlIndex = renderedClassNames.findIndex(c => c.includes('cwl'));
        const warIndex = renderedClassNames.findIndex(c => c.includes('clan'));
        const raidIndex = renderedClassNames.findIndex(c => c.includes('raid'));
        const gemIndex = renderedClassNames.findIndex(c => c.includes('gem'));
        const passIndex = renderedClassNames.findIndex(c => c.includes('event-pass'));
        const traderIndex = renderedClassNames.findIndex(c => c.includes('event-trader'));
        const shopIndex = renderedClassNames.findIndex(c => c.includes('shop'));
        const scIndex = renderedClassNames.findIndex(c => c.includes('supercell'));
        const customIndex = renderedClassNames.findIndex(c => c.includes('custom'));

        assert.ok(sbIndex < prosIndex);
        assert.ok(prosIndex < cwlIndex);
        assert.ok(cwlIndex < warIndex);
        assert.ok(warIndex < raidIndex);
        assert.ok(raidIndex < gemIndex);
        assert.ok(gemIndex < passIndex);
        assert.ok(passIndex < traderIndex);
        assert.ok(traderIndex < shopIndex);
        assert.ok(shopIndex < scIndex);
        assert.ok(scIndex < customIndex);
    });

    test('clearMonthCalendarChips moves custom and extras chips to container while clearing calendar days', () => {
        state.planner.calendar.customChips = [];
        state.planner.calendar.dates['2026-08'] = {
            '01': ['starBonus-01-2026-08-cal-auto', 'clanWar-01-2026-08-cal'],
            '15': ['custom-starBonus2x-1718000000000-0-cal', 'starBonus-15-2026-08-cal-auto'],
            '20': ['extras-boost-cal']
        };
        state.planner.calendar.customChipData = {
            'custom-starBonus2x-1718000000000-0-cal': { customType: 'starBonus2x', shiny: 1000, multiplier: '2x' },
            'extras-boost-cal': { customType: 'extras', glowy: 50 }
        };

        clearMonthCalendarChips('2026-08');

        assert.equal(state.planner.calendar.dates['2026-08'], undefined);
        assert.equal(state.planner.calendar.customChips.length, 2);

        const starBonusChip = state.planner.calendar.customChips.find(c => c.id === 'custom-starBonus2x-1718000000000-0');
        assert.ok(starBonusChip);
        assert.equal(starBonusChip.shiny, 1000);
        assert.equal(starBonusChip.multiplier, '2x');
        assert.equal(starBonusChip.isCustom, true);

        const extrasChip = state.planner.calendar.customChips.find(c => c.id === 'extras-boost');
        assert.ok(extrasChip);
        assert.equal(extrasChip.glowy, 50);
        assert.equal(extrasChip.type, 'extras');

        assert.equal(state.planner.calendar.customChipData['custom-starBonus2x-1718000000000-0-cal'], undefined);
        assert.equal(state.planner.calendar.customChipData['extras-boost-cal'], undefined);
    });

    test('handleChipDropOnCalendar overwrites existing weekly chips across Tuesday-to-Monday week window', () => {
        // ISO week boundary initialization (2026-08-04 to 2026-08-10)
        state.planner.calendar.dates['2026-08'] = {
            '04': ['raidMedalTrader-01-2026-08-cal-auto'],
            '07': ['clanWar-07-2026-08-cal']
        };

        const dayCell = new MockElement('div');
        dayCell.classList.add('day-cell');
        dayCell.dataset = { date: '2026-08-07' };

        const chipContainer = new MockElement('div');
        chipContainer.classList.add('chip-container', 'valid-drop-range');
        chipContainer.closest = (selector) => (selector === '.day-cell' ? dayCell : null);
        dayCell.appendChild(chipContainer);

        const customRaidChip = {
            id: 'custom-123456789',
            type: 'custom-raidMedalTrader',
            customType: 'raidMedalTrader',
            isCustom: true,
            shiny: 500,
            glowy: 200,
            starry: 10
        };
        state.planner.calendar.customChips = [customRaidChip];

        handleChipDropOnCalendar(customRaidChip, chipContainer);

        // Auto-placed chip eviction in conflicting ISO week window
        const day4Chips = state.planner.calendar.dates['2026-08']['04'] || [];
        const hasRaidDay4 = day4Chips.some(id => id.startsWith('raidMedalTrader'));
        assert.equal(
            hasRaidDay4,
            false
        );

        // Custom chip insertion and existing event preservation
        const day7Chips = state.planner.calendar.dates['2026-08']['07'];
        assert.ok(day7Chips.includes('custom-123456789-cal'));
        assert.ok(day7Chips.includes('clanWar-07-2026-08-cal'));
    });

    test('performAutoPlacementForMonth drops weekly auto chip when custom chip is placed anywhere in that week', () => {
        // Multi-week calendar matrix setup
        const calendarDates = {
            '2026-08': {
                '07': ['custom-123456789-cal']
            }
        };
        state.planner.calendar.customChipData = {
            'custom-123456789-cal': { customType: 'raidMedalTrader', shiny: 500 }
        };

        performAutoPlacementForMonth('08', '2026', calendarDates);

        // Week 1 conflict suppression
        const day4Chips = calendarDates['2026-08']['04'] || [];
        const hasAutoRaidDay4 = day4Chips.some(id => id.startsWith('raidMedalTrader') && id.endsWith('-auto'));
        assert.equal(hasAutoRaidDay4, false);

        // Week 2 vacancy auto-generation
        const day11Chips = calendarDates['2026-08']['11'] || [];
        const hasAutoRaidDay11 = day11Chips.some(id => id.startsWith('raidMedalTrader') && id.endsWith('-auto'));
        assert.equal(hasAutoRaidDay11, true);
    });

    test('removing custom weekly chip from calendar restores Tuesday auto-placed chip', () => {
        // Initial custom placement state
        state.planner.calendar.view = { month: '2026-08' };
        state.planner.calendar.dates['2026-08'] = {
            '07': ['custom-999-0-cal']
        };
        state.planner.calendar.customChipData = {
            'custom-999-0-cal': { customType: 'raidMedalTrader', shiny: 500 }
        };

        syncAutoPlacedChipsForMonth('08', '2026');
        assert.equal((state.planner.calendar.dates['2026-08']['04'] || []).some(id => id.startsWith('raidMedalTrader')), false);

        // Container drop trigger
        const customChipToRemove = {
            id: 'custom-999-0',
            type: 'custom-raidMedalTrader',
            customType: 'raidMedalTrader'
        };
        handleChipDropOnContainer(customChipToRemove);

        // Auto-placed recurring chip recovery
        const restoredDay4Chips = state.planner.calendar.dates['2026-08']['04'] || [];
        const hasRestoredRaid = restoredDay4Chips.some(id => id.startsWith('raidMedalTrader') && id.endsWith('-auto'));
        assert.equal(hasRestoredRaid, true);
    });

    test('showDayOverviewPopover and hideDayOverviewPopover lifecycle handles absence of DOM gracefully', () => {
        assert.doesNotThrow(() => {
            hideDayOverviewPopover();
        });
        assert.doesNotThrow(() => {
            showDayOverviewPopover(null, new Date(), state.planner, null);
        });
    });

    test('auto-placer preserves manual Star Bonus chips and does not overwrite or delete them', () => {
        const currentYearStr = '2026';
        const currentMonthStr = '08';
        const monthKey = '2026-08';

        const newCalendarDates = {
            [monthKey]: {
                '20': ['starBonus2x-01-2026-08']
            }
        };

        performAutoPlacementForMonth(currentMonthStr, currentYearStr, newCalendarDates);

        const placedChips = newCalendarDates[monthKey]['20'];
        assert.ok(placedChips.includes('starBonus2x-01-2026-08'));
    });
});
