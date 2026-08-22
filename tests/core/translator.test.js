import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        location: { origin: 'http://localhost' },
        addEventListener: () => {},
        removeEventListener: () => {},
        getComputedStyle: () => ({ display: 'block' }),
        matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })
    };
}
if (typeof globalThis.HTMLElement === 'undefined') {
    globalThis.HTMLElement = class {};
}
if (typeof globalThis.customElements === 'undefined') {
    globalThis.customElements = { get: () => null, define: () => {} };
}
if (typeof globalThis.Node === 'undefined') {
    globalThis.Node = { TEXT_NODE: 3 };
}
if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        querySelectorAll: () => [],
        querySelector: () => null,
        getElementById: () => null,
        addEventListener: () => {},
        removeEventListener: () => {},
        documentElement: { lang: '' },
        dispatchEvent: () => {}
    };
}

import { state } from '../../js/core/state.js';
import { translate, loadTranslations, getTranslations } from '../../js/i18n/translator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));
const deJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/de.json'), 'utf8'));

test('loadTranslations loads english and german dictionaries into translator', async () => {
    state.uiSettings = { language: 'en' };
    globalThis.fetch = async (url) => {
        if (url.includes('/en.json')) return { ok: true, json: async () => enJson };
        if (url.includes('/de.json')) return { ok: true, json: async () => deJson };
        return { ok: false, status: 404 };
    };

    await loadTranslations('en');
    await loadTranslations('de');

    const enDict = getTranslations();
    assert.ok(enDict.entities);
});

test('translate returns exact canonical translation in active language', async () => {
    state.uiSettings = { language: 'en' };
    await loadTranslations('en');

    assert.equal(translate('entities.ores.shiny'), 'Shiny Ore');
    assert.equal(translate('entities.heroes.barbarianKing'), 'Barbarian King');
    assert.equal(translate('views.income.starBonus.title'), 'Star Bonus');
    assert.equal(translate('views.income.shortcuts.starBonus'), 'SB');
});

test('translate switches translation based on selected language', async () => {
    state.uiSettings = { language: 'de' };
    await loadTranslations('de');

    assert.equal(translate('entities.ores.shiny'), 'Glanzerz');
    assert.equal(translate('entities.heroes.barbarianKing'), 'Barbarenkönig');
    assert.equal(translate('views.income.starBonus.title'), 'Sternebonus');
});

test('translate falls back to English with [EN] prefix when missing in non-English language', async () => {
    state.uiSettings = { language: 'de' };
    const tempDe = JSON.parse(JSON.stringify(deJson));
    delete tempDe.views.settings.github; // remove a key from German to simulate missing translation

    globalThis.fetch = async (url) => {
        if (url.includes('/en.json')) return { ok: true, json: async () => enJson };
        if (url.includes('/de.json')) return { ok: true, json: async () => tempDe };
        return { ok: false, status: 404 };
    };

    await loadTranslations('en');
    await loadTranslations('de');

    const result = translate('views.settings.github');
    assert.equal(result, `[EN] ${enJson.views.settings.github}`);
});

test('translate formats placeholders correctly', async () => {
    state.uiSettings = { language: 'en' };
    await loadTranslations('en');

    const result = translate('views.income.ores.moreOf', { count: 3, displayName: 'Star Bonus' });
    assert.equal(result, '3 more of Star Bonus');
});

test('translate handles parameterized apiErrors.rateLimitedWithTime', async () => {
    state.uiSettings = { language: 'en' };
    await loadTranslations('en');

    const result = translate('apiErrors.rateLimitedWithTime:180');
    assert.ok(result.includes('3'));
});

test('translate falls back to raw key when translation does not exist', async () => {
    state.uiSettings = { language: 'en' };
    const missingKey = 'nonExistent.nested.key.name';
    assert.equal(translate(missingKey), missingKey);
});

test('updateUIWithTranslations updates DOM elements with data-i18n and data-i18n-args', async () => {
    const { updateUIWithTranslations } = await import('../../js/i18n/uiTranslator.js');

    const el = {
        attributes: {
            'data-i18n': 'views.home.heroJourney.nodeLevel',
            'data-i18n-args': JSON.stringify({ level: 480 })
        },
        getAttribute(k) { return this.attributes[k] || null; },
        setAttribute(k, v) { this.attributes[k] = v; },
        childNodes: [],
        textContent: ''
    };

    const altEl = {
        attributes: {
            'data-i18n-alt': 'entities.ores.shiny'
        },
        getAttribute(k) { return this.attributes[k] || null; },
        setAttribute(k, v) { this.attributes[k] = v; }
    };

    globalThis.document = {
        querySelectorAll(sel) {
            if (sel === '[data-i18n]') return [el];
            if (sel === '[data-i18n-alt]') return [altEl];
            return [];
        },
        querySelector() { return null; },
        getElementById() { return null; },
        createElement() {
            return {
                id: '',
                style: { setProperty() {} },
                classList: { add() {}, remove() {}, contains() { return false; } },
                appendChild() {},
                setAttribute() {},
                getAttribute() { return null; }
            };
        },
        head: { appendChild() {} },
        body: { classList: { add() {}, remove() {}, contains() { return false; } }, style: { setProperty() {} } },
        documentElement: { lang: '', classList: { add() {}, remove() {}, contains() { return false; } }, style: { setProperty() {} } },
        dispatchEvent() {}
    };

    state.uiSettings = { language: 'en' };
    await loadTranslations('en');
    updateUIWithTranslations();

    assert.equal(el.textContent, 'Lvl 480');
    assert.equal(altEl.attributes['alt'], 'Shiny Ore');

    state.uiSettings = { language: 'de' };
    await loadTranslations('de');
    updateUIWithTranslations();

    assert.equal(el.textContent, 'Lvl 480');
    assert.equal(altEl.attributes['alt'], 'Glanzerz');
});
