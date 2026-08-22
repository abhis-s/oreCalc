import { test, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));

if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (key) => store.get(key) || null,
        setItem: (key, val) => store.set(key, String(val)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
        get length() { return store.size; }
    };
}

if (typeof globalThis.sessionStorage === 'undefined') {
    const sessionStore = new Map();
    globalThis.sessionStorage = {
        getItem: (key) => sessionStore.get(key) || null,
        setItem: (key, val) => sessionStore.set(key, String(val)),
        removeItem: (key) => sessionStore.delete(key),
        clear: () => sessionStore.clear(),
        get length() { return sessionStore.size; }
    };
}

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        addEventListener: () => {},
        removeEventListener: () => {},
        requestAnimationFrame: (cb) => { cb(performance.now() + 1000); return 1; },
        cancelAnimationFrame: () => {},
        getComputedStyle: () => ({ display: 'block', getPropertyValue: () => '' }),
        matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
        __ENV__: { APP_VERSION: '2.1.0' },
        location: { hostname: 'localhost' }
    };
} else {
    if (!globalThis.window.matchMedia) {
        globalThis.window.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
    }
    if (!globalThis.window.getComputedStyle) {
        globalThis.window.getComputedStyle = () => ({ display: 'block', getPropertyValue: () => '' });
    }
    if (!globalThis.window.requestAnimationFrame) {
        globalThis.window.requestAnimationFrame = (cb) => { cb(performance.now() + 1000); return 1; };
    }
    if (!globalThis.window.cancelAnimationFrame) {
        globalThis.window.cancelAnimationFrame = () => {};
    }
}

if (typeof globalThis.requestAnimationFrame === 'undefined') {
    globalThis.requestAnimationFrame = (cb) => { cb(performance.now() + 1000); return 1; };
}

if (typeof globalThis.cancelAnimationFrame === 'undefined') {
    globalThis.cancelAnimationFrame = () => {};
}

if (typeof globalThis.HTMLElement === 'undefined') {
    globalThis.HTMLElement = class {};
}

if (typeof globalThis.customElements === 'undefined') {
    globalThis.customElements = {
        get: () => null,
        define: () => {}
    };
}

globalThis.fetch = async (url) => {
    if (typeof url === 'string' && url.includes('en.json')) {
        return { ok: true, json: async () => enJson };
    }
    return { ok: false, status: 404 };
};

const domStore = new Map();

function createMockElement(tagName = 'div', id = '', className = '') {
    const attributes = new Map();
    const classListSet = new Set(className ? className.split(/\s+/).filter(Boolean) : []);

    const el = {
        tagName: tagName.toUpperCase(),
        id,
        className,
        isConnected: true,
        classList: {
            add: (...tokens) => tokens.forEach(t => classListSet.add(t)),
            remove: (...tokens) => tokens.forEach(t => classListSet.delete(t)),
            contains: (t) => classListSet.has(t),
            toggle: (t, force) => {
                if (typeof force === 'boolean') {
                    if (force) classListSet.add(t);
                    else classListSet.delete(t);
                    return force;
                }
                if (classListSet.has(t)) {
                    classListSet.delete(t);
                    return false;
                }
                classListSet.add(t);
                return true;
            }
        },
        children: [],
        parentElement: null,
        parentNode: null,
        style: {},
        dataset: {},
        textContent: '',
        value: '',
        checked: false,
        disabled: false,
        _innerHTML: '',
        get innerHTML() {
            return this._innerHTML;
        },
        set innerHTML(val) {
            this._innerHTML = String(val || '');
            this.children = [];
            if (this._innerHTML) {
                const rowMatches = this._innerHTML.match(/<div class="income-table-row"[^>]*>[\s\S]*?<\/div>\s*<\/div>/g)
                    || this._innerHTML.match(/<div class="income-table-row"[^>]*>[\s\S]*?<\/div>/g);
                if (rowMatches) {
                    rowMatches.forEach(rowHtml => {
                        const rowEl = createMockElement('div', '', 'income-table-row');
                        const sourceMatch = rowHtml.match(/data-source="([^"]+)"/);
                        if (sourceMatch) {
                            rowEl.dataset.source = sourceMatch[1];
                            rowEl.setAttribute('data-source', sourceMatch[1]);
                        }
                        const cellMatches = rowHtml.match(/<div class="income-table-cell[^"]*"[^>]*>[\s\S]*?<\/div>/g);
                        if (cellMatches) {
                            cellMatches.forEach(cellHtml => {
                                const oreMatch = cellHtml.match(/data-ore="([^"]+)"/);
                                const i18nMatch = cellHtml.match(/data-i18n="([^"]+)"/);
                                const cellEl = createMockElement('div', '', 'income-table-cell');
                                if (oreMatch) {
                                    cellEl.dataset.ore = oreMatch[1];
                                    cellEl.setAttribute('data-ore', oreMatch[1]);
                                }
                                if (i18nMatch) {
                                    cellEl.dataset.i18n = i18nMatch[1];
                                    cellEl.setAttribute('data-i18n', i18nMatch[1]);
                                }
                                const valMatch = cellHtml.match(/<span[^>]*class="[^"]*income-table-value[^"]*"[^>]*>([^<]*)<\/span>/);
                                if (valMatch) {
                                    const valSpan = createMockElement('span', '', 'income-table-value calculated');
                                    valSpan.textContent = valMatch[1];
                                    if (oreMatch) {
                                        valSpan.dataset.ore = oreMatch[1];
                                        valSpan.setAttribute('data-ore', oreMatch[1]);
                                    }
                                    cellEl.appendChild(valSpan);
                                } else {
                                    const textMatch = cellHtml.match(/>([^<]+)</);
                                    if (textMatch) cellEl.textContent = textMatch[1].trim();
                                }
                                rowEl.appendChild(cellEl);
                            });
                        }
                        this.appendChild(rowEl);
                    });
                }
            }
        },
        setAttribute: (k, v) => {
            attributes.set(k, String(v));
            if (k.startsWith('data-')) {
                const dataKey = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
                el.dataset[dataKey] = String(v);
            }
        },
        getAttribute: (k) => attributes.get(k) ?? null,
        hasAttribute: (k) => attributes.has(k),
        removeAttribute: (k) => {
            attributes.delete(k);
            if (k.startsWith('data-')) {
                const dataKey = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
                delete el.dataset[dataKey];
            }
        },
        appendChild: (child) => {
            el.children.push(child);
            child.parentElement = el;
            child.parentNode = el;
            return child;
        },
        removeChild: (child) => {
            const idx = el.children.indexOf(child);
            if (idx !== -1) {
                el.children.splice(idx, 1);
                child.parentElement = null;
                child.parentNode = null;
            }
            return child;
        },
        querySelector: (sel) => {
            if (sel.startsWith('#')) {
                const searchId = sel.slice(1);
                return domStore.get(searchId) || null;
            }
            if (sel.includes('[data-ore="')) {
                const match = sel.match(/\[data-ore="([^"]+)"\]/);
                const ore = match ? match[1] : '';
                const findIn = (node) => {
                    if (node.dataset && node.dataset.ore === ore) return node;
                    for (const c of node.children) {
                        const found = findIn(c);
                        if (found) return found;
                    }
                    return null;
                };
                return findIn(el);
            }
            if (sel.startsWith('.')) {
                const cls = sel.slice(1);
                const findIn = (node) => {
                    if (node.classList && node.classList.contains(cls)) return node;
                    for (const c of node.children) {
                        const found = findIn(c);
                        if (found) return found;
                    }
                    return null;
                };
                return findIn(el);
            }
            return null;
        },
        querySelectorAll: (sel) => {
            const results = [];
            const collect = (node) => {
                if (sel.startsWith('.')) {
                    const cls = sel.slice(1);
                    if (node.classList && node.classList.contains(cls)) results.push(node);
                } else if (sel === 'option') {
                    if (node.tagName === 'OPTION') results.push(node);
                }
                for (const c of node.children) {
                    collect(c);
                }
            };
            collect(el);
            return results;
        },
        getBoundingClientRect: () => ({
            top: 100, bottom: 200, left: 100, right: 300, width: 200, height: 100
        }),
        addEventListener: () => {},
        removeEventListener: () => {}
    };

    if (id) domStore.set(id, el);
    return el;
}

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        getElementById: (id) => domStore.get(id) || null,
        querySelector: (sel) => {
            if (sel.startsWith('#')) return domStore.get(sel.slice(1)) || null;
            return null;
        },
        querySelectorAll: () => [],
        createElement: (tag) => createMockElement(tag),
        addEventListener: () => {},
        removeEventListener: () => {}
    };
}

const { state, getDefaultState } = await import('../../js/core/state.js');
const { dom } = await import('../../js/dom/domElements.js');
const { recalculateAll } = await import('../../js/core/calculator.js');
const { renderHomeIncomeTable } = await import('../../js/components/home/homeTableRenderer.js');
const { renderHomeResourcesFooter } = await import('../../js/components/home/homeResourcesRenderer.js');
const { renderIncomeCard } = await import('../../js/components/income/incomeCardHandler.js');
const { renderRunningCostsData } = await import('../../js/components/appSettings/settingsModals.js');
const { updatePerChipRewardsPreview } = await import('../../js/components/planner/createCustomChipsModalDisplay.js');
const { updateHeroJourneyUpcomingBadges } = await import('../../js/components/home/heroJourneyDisplay.js');
const { updateCalculatedValue } = await import('../../js/utils/numberFormatter.js');
const { loadTranslations } = await import('../../js/i18n/translator.js');

describe('Home Income Table & Number Animation Suite', () => {
    let mockTableBody;
    let mockTotalShiny;
    let mockTotalGlowy;
    let mockTotalStarry;
    let mockMoneyValue;
    let mockMoneySymbol;
    let mockCwlVal;
    let mockWarVal;
    let mockRaidMedalsVal;
    let mockEventMedalsVal;
    let mockGemsVal;

    beforeEach(async () => {
        domStore.clear();

        mockTableBody = createMockElement('div', 'home-income-table-body');
        mockTotalShiny = createMockElement('div', 'home-income-table-total-shiny');
        mockTotalGlowy = createMockElement('div', 'home-income-table-total-glowy');
        mockTotalStarry = createMockElement('div', 'home-income-table-total-starry');
        mockMoneyValue = createMockElement('span', 'home-money-value');
        mockMoneySymbol = createMockElement('span', 'home-money-symbol');

        mockCwlVal = createMockElement('span', 'home-display-cwl-participations');
        mockWarVal = createMockElement('span', 'home-display-clan-war-participations');
        mockRaidMedalsVal = createMockElement('span', 'home-display-raid-medals');
        mockEventMedalsVal = createMockElement('span', 'home-display-event-medals');
        mockGemsVal = createMockElement('span', 'home-display-gems');

        createMockElement('img', 'home-display-league-icon');
        createMockElement('span', 'home-display-league-requirement');
        createMockElement('img', 'home-display-clan-icon');
        createMockElement('select', 'home-income-timeframe-select');
        createMockElement('div', 'home-ore-income-card');

        dom.income = {
            home: {
                incomeCard: {
                    container: domStore.get('home-ore-income-card'),
                    timeframe: domStore.get('home-income-timeframe-select'),
                    table: {
                        body: mockTableBody,
                        totalRow: {
                            shiny: mockTotalShiny,
                            glowy: mockTotalGlowy,
                            starry: mockTotalStarry
                        }
                    },
                    resources: {
                        leagueIcon: domStore.get('home-display-league-icon'),
                        leagueRequirement: domStore.get('home-display-league-requirement'),
                        cwlParticipations: mockCwlVal,
                        clanWarIcon: domStore.get('home-display-clan-icon'),
                        clanWarParticipations: mockWarVal,
                        raidMedals: mockRaidMedalsVal,
                        eventMedals: mockEventMedalsVal,
                        gems: mockGemsVal,
                        moneyValue: mockMoneyValue,
                        moneySymbol: mockMoneySymbol
                    }
                }
            }
        };

        const fresh = getDefaultState();
        Object.keys(state).forEach(k => delete state[k]);
        Object.assign(state, fresh);
        state.activeTab = 'home-tab';
        state.uiSettings.summaryTimeframe = 'monthly';
        state.uiSettings.currency = { code: 'USD' };

        try {
            await loadTranslations('en');
        } catch (e) {}
    });

    describe('1. Home Income Table Granular Cell Animation & DOM Row Persistence', () => {
        test('creates persistent DOM rows on initial render with data-source and data-ore attributes', () => {
            state.income.starBonus = { league: 105000022 };
            recalculateAll(state);

            renderHomeIncomeTable(state);

            const rows = mockTableBody.children;
            assert.equal(rows.length, 10);

            const firstRow = rows[0];
            assert.equal(firstRow.dataset.source, 'starBonus');
            assert.equal(firstRow.children.length, 5);

            const shinyCell = firstRow.children[1];
            const glowyCell = firstRow.children[2];
            const starryCell = firstRow.children[3];
            assert.equal(shinyCell.dataset.ore, 'shiny');
            assert.equal(glowyCell.dataset.ore, 'glowy');
            assert.equal(starryCell.dataset.ore, 'starry');
        });

        test('retains persistent DOM row nodes without recreation on subsequent renders and timeframe switches', () => {
            state.income.starBonus = { league: 105000022 };
            recalculateAll(state);

            renderHomeIncomeTable(state);
            const initialRowInstances = [...mockTableBody.children];

            state.uiSettings.summaryTimeframe = 'daily';
            recalculateAll(state);
            renderHomeIncomeTable(state);

            const secondRowInstances = [...mockTableBody.children];
            assert.equal(initialRowInstances.length, secondRowInstances.length);
            for (let i = 0; i < initialRowInstances.length; i++) {
                assert.strictEqual(initialRowInstances[i], secondRowInstances[i], `Row node ${i} must remain identical in DOM`);
            }
        });

        test('animates numeric ore cells smoothly when timeframe changes from monthly to daily', () => {
            state.income.starBonus = { league: 105000022 };
            state.uiSettings.summaryTimeframe = 'monthly';
            recalculateAll(state);
            renderHomeIncomeTable(state);

            const starBonusRow = mockTableBody.children[0];
            const shinyCell = starBonusRow.children[1];
            const monthlyShinyText = shinyCell.textContent;
            assert.ok(parseInt(monthlyShinyText.replace(/,/g, ''), 10) > 0);

            state.uiSettings.summaryTimeframe = 'daily';
            recalculateAll(state);
            renderHomeIncomeTable(state);

            const dailyShinyText = shinyCell.textContent;
            assert.ok(parseInt(dailyShinyText.replace(/,/g, ''), 10) < parseInt(monthlyShinyText.replace(/,/g, ''), 10));
        });

        test('preserves dynamic localization data-i18n attributes on row title cells', () => {
            renderHomeIncomeTable(state);
            const starBonusRow = mockTableBody.children[0];
            const nameCell = starBonusRow.children[0];
            assert.equal(nameCell.dataset.i18n, 'views.income.starBonus.title');
        });
    });

    describe('2. Home Resources Footer Animation & 2-Decimal Currency Formatting', () => {
        test('animates numeric counts for CWL, Clan War, Raid Medals, Event Medals, and Gems', () => {
            state.income.cwl = { hitsPerSeason: 7 };
            state.income.clanWar = { warsPerMonth: 15 };
            state.derived.incomeSources = {
                raidMedalTrader: { cost: 1200 },
                eventTrader: { cost: 3100 },
                gemTrader: { cost: 500 }
            };

            renderHomeResourcesFooter(state);

            assert.equal(mockCwlVal.textContent, '7');
            assert.equal(mockWarVal.textContent, '15');
            assert.equal(mockRaidMedalsVal.textContent, '1,200');
            assert.equal(mockEventMedalsVal.textContent, '3,100');
            assert.equal(mockGemsVal.textContent, '500');
        });

        test('animates home money value with 2 decimal places and currency symbol', () => {
            const totalIncome = { shiny: 10000, glowy: 500, starry: 50 };
            const uiSettings = { summaryTimeframe: 'monthly', currency: { code: 'USD' } };
            const totalMoneyCost = { USD: 19.99 };

            renderIncomeCard(totalIncome, uiSettings, totalMoneyCost);

            assert.equal(mockMoneyValue.textContent, '19.99');
            assert.equal(mockMoneySymbol.textContent, '$');

            const updatedMoneyCost = { USD: 29.5 };
            renderIncomeCard(totalIncome, uiSettings, updatedMoneyCost);
            assert.equal(mockMoneyValue.textContent, '29.50');
        });
    });

    describe('3. High-Delight Secondary Number Animations', () => {
        test('renderRunningCostsData animates hero total with currency prefix and 2 decimal places', () => {
            const modal = createMockElement('div', 'running-costs-modal');
            const totalValue = createMockElement('span', 'running-costs-total-value');
            const historyContainer = createMockElement('div', 'running-costs-history-container');
            const updateDate = createMockElement('span', 'running-costs-update-date');

            const payload = {
                isMock: false,
                totalCostTillDate: 78.45,
                lastUpdated: '2026-08-01T12:00:00Z',
                breakdown: []
            };

            renderRunningCostsData(modal, payload, totalValue, historyContainer, updateDate);
            assert.equal(totalValue.textContent, '$78.45');

            payload.totalCostTillDate = 95.0;
            renderRunningCostsData(modal, payload, totalValue, historyContainer, updateDate);
            assert.equal(totalValue.textContent, '$95.00');
        });

        test('updatePerChipRewardsPreview animates signed custom chip rewards preview', () => {
            const previewContainer = createMockElement('div', 'custom-chip-rewards-preview');
            const typeSelect = createMockElement('select', 'custom-chip-type-select');
            typeSelect.value = 'starBonus';

            const starBonusMultiplier = createMockElement('select', 'custom-chip-starBonus-multiplier');
            starBonusMultiplier.value = '2x';

            const previewShiny = createMockElement('span', 'custom-chip-preview-shiny');
            const previewGlowy = createMockElement('span', 'custom-chip-preview-glowy');
            const previewStarry = createMockElement('span', 'custom-chip-preview-starry');

            state.derived.incomeSources = {
                starBonus: {
                    baseDaily: { shiny: 1000, glowy: 54, starry: 6 }
                }
            };

            updatePerChipRewardsPreview();

            assert.equal(previewShiny.textContent, '+2,000');
            assert.equal(previewGlowy.textContent, '+108');
            assert.equal(previewStarry.textContent, '+12');
            assert.equal(previewShiny.style.color, 'var(--color-success)');
        });

        test('updateHeroJourneyUpcomingBadges animates and displays green badges when synced', () => {
            const shinyBadge = createMockElement('span', 'eq-shiny-hero-journey-badge');
            const glowyBadge = createMockElement('span', 'eq-glowy-hero-journey-badge');
            const starryBadge = createMockElement('span', 'eq-starry-hero-journey-badge');

            state.savedPlayerTags = ['#PLAYER123'];
            state.playerProfile = {
                tag: '#PLAYER123',
                townHallLevel: 16,
                ownedHeroes: {
                    'Barbarian King': { level: 20 },
                    'Archer Queen': { level: 20 },
                    'Grand Warden': { level: 10 },
                    'Royal Champion': { level: 5 }
                }
            };

            updateHeroJourneyUpcomingBadges(state);

            assert.ok(shinyBadge.textContent.startsWith('+'), 'Shiny badge must start with +');
            assert.equal(shinyBadge.style.display, 'inline-flex');
        });
    });

    describe('4. Number Formatter & updateCalculatedValue Precision', () => {
        test('updateCalculatedValue parses float previous text without dropping decimals', () => {
            const el = createMockElement('span');
            el.textContent = '14.99';

            updateCalculatedValue(el, 24.99, 2);
            assert.equal(el.textContent, '24.99');
        });

        test('handles missing or undefined elements gracefully without throwing', () => {
            assert.doesNotThrow(() => {
                updateCalculatedValue(null, 100);
            });
            assert.doesNotThrow(() => {
                renderHomeIncomeTable(null);
            });
            assert.doesNotThrow(() => {
                renderHomeResourcesFooter(null);
            });
        });
    });
});
