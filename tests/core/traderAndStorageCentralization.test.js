import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

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
        __ENV__: { APP_VERSION: '2.1.0' },
        location: { hostname: 'localhost' }
    };
}

const domElementsStore = new Map();

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        dispatchEvent: () => true,
        getElementById: (id) => domElementsStore.get(id) || null,
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: (tag) => {
            const el = {
                tagName: tag.toUpperCase(),
                id: '',
                className: '',
                dataset: {},
                style: {},
                children: [],
                innerHTML: '',
                textContent: '',
                value: '',
                attributes: new Map(),
                setAttribute(k, v) { this.attributes.set(k, v); },
                getAttribute(k) { return this.attributes.get(k); },
                appendChild(child) {
                    this.children.push(child);
                    return child;
                },
                querySelector(sel) { return null; },
                querySelectorAll(sel) { return []; },
                addEventListener() {},
                removeEventListener() {}
            };
            return el;
        }
    };
}

if (typeof globalThis.CustomEvent === 'undefined') {
    globalThis.CustomEvent = class CustomEvent {
        constructor(type, eventInitDict) {
            this.type = type;
            this.detail = eventInitDict?.detail;
        }
    };
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

const { WAR_ORE_MAX_LIMITS, getWarOreValue } = await import('../../js/data/incomeSources/warOres.js');
const { raidMedalTraderData, gemTraderData, eventTraderData } = await import('../../js/data/incomeSources/traders.js');
const { renderWelcomeTraderRows } = await import('../../js/components/welcome/welcomeSettingsDisplay.js');

const { renderRaidMedalTraderRow } = await import('../../js/components/income/raidMedalTraderDisplay.js');
const { renderGemTraderRow } = await import('../../js/components/income/gemTraderDisplay.js');
const { renderEventTraderRow } = await import('../../js/components/income/eventTraderDisplay.js');

function registerTestContainer(id) {
    const container = globalThis.document.createElement('div');
    container.id = id;
    domElementsStore.set(id, container);
    return container;
}

beforeEach(() => {
    domElementsStore.clear();
});

test('Trader datasets contain correct normalized IDs, costs, ores, and pack limits', () => {
    const gemStarry = gemTraderData.find(o => o.starry > 0);
    const gemGlowy = gemTraderData.find(o => o.glowy > 0);
    const gemShiny = gemTraderData.find(o => o.shiny > 0);

    assert.ok(gemStarry);
    assert.equal(gemStarry.id, 'gem_starry');
    assert.equal(gemStarry.cost, 115);
    assert.equal(gemStarry.starry, 15);
    assert.equal(gemStarry.maxPacks, 10);

    assert.ok(gemGlowy);
    assert.equal(gemGlowy.id, 'gem_glowy');
    assert.equal(gemGlowy.cost, 90);
    assert.equal(gemGlowy.glowy, 60);
    assert.equal(gemGlowy.maxPacks, 10);

    assert.ok(gemShiny);
    assert.equal(gemShiny.id, 'gem_shiny');
    assert.equal(gemShiny.cost, 75);
    assert.equal(gemShiny.shiny, 300);
    assert.equal(gemShiny.maxPacks, 10);
    assert.deepEqual(gemTraderData.map(o => o.id), ['gem_starry', 'gem_glowy', 'gem_shiny']);

    assert.equal(raidMedalTraderData.length, 3);
    assert.deepEqual(raidMedalTraderData.map(o => o.id), ['raid_starry', 'raid_glowy', 'raid_shiny']);
    raidMedalTraderData.forEach(offer => {
        assert.equal(offer.currency, 'raid_medals');
        assert.equal(offer.maxPacks, 2);
    });

    const eventStarry = eventTraderData.find(o => o.starry > 0);
    const eventGlowy = eventTraderData.find(o => o.glowy > 0);
    const eventShiny = eventTraderData.find(o => o.shiny > 0);

    assert.ok(eventStarry);
    assert.equal(eventStarry.id, 'event_starry');
    assert.equal(eventStarry.cost, 320);
    assert.equal(eventStarry.starry, 10);
    assert.equal(eventStarry.maxPacks, 8);

    assert.ok(eventGlowy);
    assert.equal(eventGlowy.id, 'event_glowy');
    assert.equal(eventGlowy.cost, 280);
    assert.equal(eventGlowy.glowy, 60);
    assert.equal(eventGlowy.maxPacks, 10);

    assert.ok(eventShiny);
    assert.equal(eventShiny.id, 'event_shiny');
    assert.equal(eventShiny.cost, 325);
    assert.equal(eventShiny.shiny, 350);
    assert.equal(eventShiny.maxPacks, 40);
    assert.deepEqual(eventTraderData.map(o => o.id), ['event_starry', 'event_glowy', 'event_shiny']);
});

test('renderRaidMedalTraderRow generates checkboxes with normalized IDs and attributes', () => {
    const starryOffer = raidMedalTraderData.find(o => o.id === 'raid_starry');
    const row = renderRaidMedalTraderRow(starryOffer, 1);

    assert.equal(row.children.length, 4);
    const cb1Div = row.children[2];
    const cb1 = cb1Div.children[0];
    assert.equal(cb1.id, 'raid_starry_1');
    assert.equal(cb1.name, 'raid_starry_1');
    assert.equal(cb1.dataset.offerId, 'raid_starry');
    assert.equal(cb1.dataset.instance, '1');
    assert.equal(cb1.checked, true);

    const cb2Div = row.children[3];
    const cb2 = cb2Div.children[0];
    assert.equal(cb2.id, 'raid_starry_2');
    assert.equal(cb2.name, 'raid_starry_2');
    assert.equal(cb2.dataset.offerId, 'raid_starry');
    assert.equal(cb2.dataset.instance, '2');
    assert.equal(cb2.checked, false);
});

test('renderGemTraderRow generates input template containing normalized element ID and dataset attribute', () => {
    const glowyOffer = gemTraderData.find(o => o.id === 'gem_glowy');
    const row = renderGemTraderRow(glowyOffer, 3);

    assert.equal(row.children.length, 3);
    const inputDiv = row.children[2];
    assert.ok(inputDiv.innerHTML.includes('id="gem-trader-gem_glowy-input"'));
    assert.ok(inputDiv.innerHTML.includes('data-offer-id="gem_glowy"'));
    assert.ok(inputDiv.innerHTML.includes('value="3"'));
});

test('renderEventTraderRow generates row template containing normalized element ID and dataset attribute', () => {
    const shinyOffer = eventTraderData.find(o => o.id === 'event_shiny');
    const row = renderEventTraderRow(shinyOffer, 5);

    assert.ok(row.innerHTML.includes('id="event-trader-event_shiny-input"'));
    assert.ok(row.innerHTML.includes('data-offer-id="event_shiny"'));
    assert.ok(row.innerHTML.includes('value="5"'));
});

test('renderWelcomeTraderRows generates valid DOM structure with correct select options and IDs', () => {
    const container = registerTestContainer('test-raid-trader-container');

    renderWelcomeTraderRows(
        'test-raid-trader-container',
        raidMedalTraderData,
        'welcome-pref-raid-medals',
        'raidMedal',
        'Raid Medals',
        { starry: 'thumbs-double', glowy: 'thumbs-double' }
    );

    assert.equal(container.children.length, 3);

    const starryRow = container.children[0];
    assert.equal(starryRow.dataset.oreType, 'starry');
    assert.equal(starryRow.children.length, 3);

    const select = starryRow.children[2];
    assert.equal(select.id, 'welcome-pref-raid-medals-starry');
    assert.equal(select.children.length, 3);
    assert.equal(select.children[0].value, '0');
    assert.equal(select.children[1].value, '1');
    assert.equal(select.children[2].value, '2');
});

test('renderWelcomeTraderRows generates all 41 option elements for Event Trader Shiny', () => {
    const container = registerTestContainer('test-event-trader-container');

    renderWelcomeTraderRows(
        'test-event-trader-container',
        eventTraderData,
        'welcome-pref-event-trader',
        'eventMedal',
        'Event Medals',
        { starry: 'thumbs-double', glowy: 'thumbs-up' }
    );

    assert.equal(container.children.length, 3);

    const shinyRow = container.children[2];
    assert.equal(shinyRow.dataset.oreType, 'shiny');

    const select = shinyRow.children[2];
    assert.equal(select.id, 'welcome-pref-event-trader-shiny');
    assert.equal(select.children.length, 41);
    assert.equal(select.children[0].value, '0');
    assert.equal(select.children[40].value, '40');
});

test('WAR_ORE_MAX_LIMITS is frozen and getWarOreValue resolves clamped values safely', () => {
    assert.ok(Object.isFrozen(WAR_ORE_MAX_LIMITS));
    assert.equal(WAR_ORE_MAX_LIMITS.shiny, 1110);
    assert.equal(WAR_ORE_MAX_LIMITS.glowy, 39);
    assert.equal(WAR_ORE_MAX_LIMITS.starry, 6);

    assert.equal(getWarOreValue('shiny', 8), 380);
    assert.equal(getWarOreValue('glowy', 8), 15);
    assert.equal(getWarOreValue('starry', 8), 0);

    assert.equal(getWarOreValue('shiny', 5), 380);
    assert.equal(getWarOreValue('glowy', 1), 15);

    assert.equal(getWarOreValue('shiny', 16), 1110);
    assert.equal(getWarOreValue('glowy', 16), 39);
    assert.equal(getWarOreValue('starry', 16), 6);

    assert.equal(getWarOreValue('shiny', 17), 1110);
    assert.equal(getWarOreValue('glowy', 18), 39);
    assert.equal(getWarOreValue('starry', 20), 6);

    assert.equal(getWarOreValue('unknownOre', 16), 0);
    assert.equal(getWarOreValue('shiny', NaN), 0);
});
