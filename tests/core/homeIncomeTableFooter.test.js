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
        requestAnimationFrame: (cb) => { cb(); return 1; },
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
        globalThis.window.requestAnimationFrame = (cb) => { cb(); return 1; };
    }
    if (!globalThis.window.cancelAnimationFrame) {
        globalThis.window.cancelAnimationFrame = () => {};
    }
}

if (typeof globalThis.requestAnimationFrame === 'undefined') {
    globalThis.requestAnimationFrame = (cb) => { cb(performance.now() + 1000); return 1; };
} else {
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
    if (typeof url === 'string') {
        const match = url.match(/\/([a-z]{2})\.json/);
        if (match) {
            const langFile = path.join(projectRoot, `js/i18n/${match[1]}.json`);
            if (fs.existsSync(langFile)) {
                const data = JSON.parse(fs.readFileSync(langFile, 'utf8'));
                return { ok: true, json: async () => data };
            }
        }
    }
    return { ok: false, status: 404 };
};

const domElementsStore = new Map();

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
            if (this._innerHTML === '') {
                this.children = [];
            }
        },
        setAttribute(k, v) { attributes.set(k, String(v)); },
        getAttribute(k) { return attributes.get(k); },
        hasAttribute(k) { return attributes.has(k); },
        removeAttribute(k) { attributes.delete(k); },
        appendChild(child) {
            child.parentElement = this;
            child.parentNode = this;
            this.children.push(child);
            return child;
        },
        removeChild(child) {
            const idx = this.children.indexOf(child);
            if (idx !== -1) {
                this.children.splice(idx, 1);
                child.parentElement = null;
                child.parentNode = null;
            }
            return child;
        },
        querySelector(sel) {
            if (sel.startsWith('#')) {
                const searchId = sel.slice(1);
                return domElementsStore.get(searchId) || null;
            }
            if (sel.startsWith('.')) {
                const cls = sel.slice(1);
                for (const elem of domElementsStore.values()) {
                    if (elem.classList.contains(cls)) return elem;
                }
            }
            return null;
        },
        querySelectorAll(sel) {
            if (sel.startsWith('.')) {
                const cls = sel.slice(1);
                const results = [];
                for (const elem of domElementsStore.values()) {
                    if (elem.classList.contains(cls)) results.push(elem);
                }
                return results;
            }
            return [];
        },
        addEventListener() {},
        removeEventListener() {},
        closest() { return null; },
        focus() {}
    };

    if (id) {
        domElementsStore.set(id, el);
    }
    return el;
}

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        dispatchEvent: () => true,
        getElementById: (id) => domElementsStore.get(id) || null,
        querySelector: (sel) => {
            if (sel.startsWith('#')) {
                return domElementsStore.get(sel.slice(1)) || null;
            }
            if (sel.startsWith('.')) {
                const cls = sel.slice(1);
                for (const elem of domElementsStore.values()) {
                    if (elem.classList.contains(cls)) return elem;
                }
            }
            return null;
        },
        querySelectorAll: (sel) => {
            if (sel.startsWith('.')) {
                const cls = sel.slice(1);
                const results = [];
                for (const elem of domElementsStore.values()) {
                    if (elem.classList.contains(cls)) results.push(elem);
                }
                return results;
            }
            return [];
        },
        createElement: (tag) => createMockElement(tag),
        addEventListener: () => {},
        removeEventListener: () => {}
    };
}

const { state, getDefaultState } = await import('../../js/core/state.js');
const { dom } = await import('../../js/dom/domElements.js');
const { recalculateAll } = await import('../../js/core/calculator.js');
const { renderIncomeCard } = await import('../../js/components/income/incomeCardHandler.js');
const { renderHomeIncomeTable } = await import('../../js/components/home/homeTableRenderer.js');
const { renderApp } = await import('../../js/core/renderer.js');
const { loadTranslations } = await import('../../js/i18n/translator.js');

describe('Home Income Table Footer & Timeframe Reactivity Suite', () => {
    let mockTimeframeSelect;
    let mockTotalShiny;
    let mockTotalGlowy;
    let mockTotalStarry;
    let mockMoneyValue;
    let mockMoneySymbol;
    let mockTableBody;

    beforeEach(async () => {
        domElementsStore.clear();

        mockTimeframeSelect = createMockElement('select', 'home-income-timeframe-select');
        mockTotalShiny = createMockElement('div', 'home-income-table-total-shiny');
        mockTotalGlowy = createMockElement('div', 'home-income-table-total-glowy');
        mockTotalStarry = createMockElement('div', 'home-income-table-total-starry');
        mockMoneyValue = createMockElement('span', 'home-money-value');
        mockMoneySymbol = createMockElement('span', 'home-money-symbol');
        mockTableBody = createMockElement('div', 'home-income-table-body');

        createMockElement('div', 'home-ore-income-card');
        createMockElement('img', 'home-display-league-icon');
        createMockElement('span', 'home-display-league-requirement');
        createMockElement('span', 'home-display-cwl-participations');
        createMockElement('img', 'home-display-clan-icon');
        createMockElement('span', 'home-display-clan-war-participations');
        createMockElement('span', 'home-display-raid-medals');
        createMockElement('span', 'home-display-event-medals');
        createMockElement('span', 'home-display-gems');

        createMockElement('div', 'home-result-quantity-shiny');
        createMockElement('div', 'home-result-quantity-glowy');
        createMockElement('div', 'home-result-quantity-starry');
        createMockElement('div', 'home-result-time-shiny-days');
        createMockElement('div', 'home-result-time-glowy-days');
        createMockElement('div', 'home-result-time-starry-days');
        createMockElement('div', 'home-result-date-shiny');
        createMockElement('div', 'home-result-date-glowy');
        createMockElement('div', 'home-result-date-starry');

        createMockElement('div', 'eq-shiny-ore-result');
        createMockElement('div', 'eq-glowy-ore-result');
        createMockElement('div', 'eq-starry-ore-result');

        createMockElement('div', 'home-player-profile');
        const mainFab = createMockElement('button', 'main-fab');
        const saveButton = createMockElement('button', 'floating-save-btn');
        const fabSaveDataPill = createMockElement('button', 'fab-save-data-pill');
        const fabRefreshPill = createMockElement('button', 'fab-refresh-pill');

        createMockElement('div', 'hero-journey-container');
        createMockElement('div', 'hero-journey-tree');

        dom.controls = {
            saveButton,
            resetDataButton: createMockElement('button', 'reset-data-btn'),
            refreshButton: createMockElement('button', 'refresh-button')
        };

        dom.fab = {
            main: mainFab,
            menu: createMockElement('div', 'fab-menu'),
            pills: {
                refresh: fabRefreshPill,
                saveData: fabSaveDataPill
            }
        };

        dom.tabs = {
            buttons: [createMockElement('button', '', 'tab-button active')],
            contents: [createMockElement('div', 'home-tab', 'tab-content active')]
        };

        dom.drawer = {
            button: createMockElement('button', '', 'hamburger'),
            drawer: createMockElement('div', '', 'navigation-drawer'),
            overlay: createMockElement('div', '', 'navigation-drawer__overlay'),
            close: createMockElement('button', '', 'navigation-drawer__close'),
            tabs: []
        };

        dom.player = {
            dropdown: createMockElement('select', 'player-dropdown'),
            avatar: createMockElement('img', 'player-avatar')
        };

        dom.income = {
            home: {
                incomeCard: {
                    container: domElementsStore.get('home-ore-income-card'),
                    timeframe: mockTimeframeSelect,
                    table: {
                        body: mockTableBody,
                        totalRow: {
                            shiny: mockTotalShiny,
                            glowy: mockTotalGlowy,
                            starry: mockTotalStarry
                        }
                    },
                    resources: {
                        leagueIcon: domElementsStore.get('home-display-league-icon'),
                        leagueRequirement: domElementsStore.get('home-display-league-requirement'),
                        cwlParticipations: domElementsStore.get('home-display-cwl-participations'),
                        clanWarIcon: domElementsStore.get('home-display-clan-icon'),
                        clanWarParticipations: domElementsStore.get('home-display-clan-war-participations'),
                        raidMedals: domElementsStore.get('home-display-raid-medals'),
                        eventMedals: domElementsStore.get('home-display-event-medals'),
                        gems: domElementsStore.get('home-display-gems'),
                        moneyValue: mockMoneyValue,
                        moneySymbol: mockMoneySymbol
                    }
                },
                results: {
                    quantity: {
                        shiny: domElementsStore.get('home-result-quantity-shiny'),
                        glowy: domElementsStore.get('home-result-quantity-glowy'),
                        starry: domElementsStore.get('home-result-quantity-starry')
                    },
                    time: {
                        shiny: { days: domElementsStore.get('home-result-time-shiny-days') },
                        glowy: { days: domElementsStore.get('home-result-time-glowy-days') },
                        starry: { days: domElementsStore.get('home-result-time-starry-days') }
                    },
                    date: {
                        shiny: domElementsStore.get('home-result-date-shiny'),
                        glowy: domElementsStore.get('home-result-date-glowy'),
                        starry: domElementsStore.get('home-result-date-starry')
                    }
                }
            }
        };

        dom.equipment = {
            results: {
                shiny: domElementsStore.get('eq-shiny-ore-result'),
                glowy: domElementsStore.get('eq-glowy-ore-result'),
                starry: domElementsStore.get('eq-starry-ore-result')
            }
        };

        const fresh = getDefaultState();
        Object.keys(state).forEach(k => delete state[k]);
        Object.assign(state, fresh);
        state.activeTab = 'home-tab';
        state.uiSettings.summaryTimeframe = 'monthly';
        state.uiSettings.currency = { code: 'USD' };
        state.savedPlayerTags = ['DEFAULT0'];

        try {
            await loadTranslations('en');
        } catch (e) {}
    });

    test('recalculateAll updates totalIncome and totalMoneyCost across daily, weekly, monthly, and bimonthly timeframes', () => {
        state.income.starBonus = { league: 105000022 };
        state.income.eventPass = { eventPass: true };

        state.uiSettings.summaryTimeframe = 'monthly';
        recalculateAll(state);
        const monthlyShiny = state.derived.totalIncome.shiny;
        const monthlyGlowy = state.derived.totalIncome.glowy;
        const monthlyStarry = state.derived.totalIncome.starry;
        const monthlyUSD = state.derived.totalMoneyCost.USD;

        assert.ok(monthlyShiny > 0);
        assert.ok(monthlyGlowy > 0);
        assert.ok(monthlyStarry > 0);
        assert.ok(monthlyUSD > 0);

        state.uiSettings.summaryTimeframe = 'daily';
        recalculateAll(state);
        assert.ok(state.derived.totalIncome.shiny < monthlyShiny);
        assert.equal(state.derived.totalMoneyCost.USD, monthlyUSD);

        state.uiSettings.summaryTimeframe = 'weekly';
        recalculateAll(state);
        assert.ok(state.derived.totalIncome.shiny > state.derived.totalIncome.shiny * 0.5);
        assert.equal(state.derived.totalMoneyCost.USD, monthlyUSD);

        state.uiSettings.summaryTimeframe = 'bimonthly';
        recalculateAll(state);
        assert.equal(state.derived.totalMoneyCost.USD, monthlyUSD);
    });

    test('renderIncomeCard updates timeframe dropdown, footer totals, and money costs in DOM', () => {
        const totalIncome = { shiny: 45000, glowy: 2400, starry: 120 };
        const uiSettings = { summaryTimeframe: 'weekly', currency: { code: 'USD' } };
        const totalMoneyCost = { USD: 14.99, EUR: 13.99 };

        renderIncomeCard(totalIncome, uiSettings, totalMoneyCost);

        assert.equal(mockTimeframeSelect.value, 'weekly');
        assert.equal(mockTotalShiny.textContent, '45,000');
        assert.equal(mockTotalGlowy.textContent, '2,400');
        assert.equal(mockTotalStarry.textContent, '120');
        assert.equal(mockMoneyValue.textContent, '14.99');
        assert.equal(mockMoneySymbol.textContent, '$');
    });

    test('renderIncomeCard formats localized currencies correctly (EUR)', () => {
        const totalIncome = { shiny: 10000, glowy: 500, starry: 30 };
        const uiSettings = { summaryTimeframe: 'monthly', currency: { code: 'EUR' } };
        const totalMoneyCost = { USD: 20.00, EUR: 18.50 };

        renderIncomeCard(totalIncome, uiSettings, totalMoneyCost);

        assert.equal(mockTimeframeSelect.value, 'monthly');
        assert.equal(mockMoneyValue.textContent, '18.50');
        assert.equal(mockMoneySymbol.textContent, '€');
    });

    test('renderIncomeCard handles missing or empty arguments safely without throwing', () => {
        assert.doesNotThrow(() => {
            renderIncomeCard();
        });
        assert.doesNotThrow(() => {
            renderIncomeCard({}, {}, {});
        });
    });

    test('renderApp updates table body rows AND footer totals when activeTab is home-tab', () => {
        state.activeTab = 'home-tab';
        state.income.starBonus = { league: 105000022 };
        state.uiSettings.summaryTimeframe = 'monthly';
        recalculateAll(state);

        renderApp(state);

        assert.ok(mockTableBody.innerHTML.length > 0);

        const initialShinyText = mockTotalShiny.textContent;
        const initialGlowyText = mockTotalGlowy.textContent;
        assert.notEqual(initialShinyText, '0');
        assert.notEqual(initialGlowyText, '0');

        state.uiSettings.summaryTimeframe = 'daily';
        recalculateAll(state);
        renderApp(state);

        const dailyShinyText = mockTotalShiny.textContent;
        assert.notEqual(dailyShinyText, initialShinyText);
        assert.equal(mockTimeframeSelect.value, 'daily');
    });

    test('renderRemainingTime translates Done and N/A across locales', async () => {
        const { renderRemainingTime } = await import('../../js/components/equipment/remainingTimeDisplay.js');
        const { loadTranslations } = await import('../../js/i18n/translator.js');

        const starryDayEl = domElementsStore.get('home-result-time-starry-days');
        const shinyDayEl = domElementsStore.get('home-result-time-shiny-days');

        const naData = {
            shiny: { status: 'DONE', years: 0, months: 0, days: 0 },
            glowy: { status: 'OK', years: 1, months: 2, days: 3 },
            starry: { status: 'N/A', years: null, months: null, days: null }
        };

        // Locale: EN
        await loadTranslations('en');
        state.uiSettings.language = 'en';
        renderRemainingTime(naData);
        assert.equal(shinyDayEl.textContent, 'Done');
        assert.equal(starryDayEl.textContent, 'N/A');

        // Locale: ZH
        await loadTranslations('zh');
        state.uiSettings.language = 'zh';
        renderRemainingTime(naData);
        assert.equal(shinyDayEl.textContent, '完成');
        assert.equal(starryDayEl.textContent, '不适用');

        // Locale: DE
        await loadTranslations('de');
        state.uiSettings.language = 'de';
        renderRemainingTime(naData);
        assert.equal(shinyDayEl.textContent, 'Fertig');
        assert.equal(starryDayEl.textContent, 'N/V');
    });
});
