import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

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

const domStore = new Map();

class ClassList {
    constructor() { this.classes = new Set(); }
    add(...args) { args.forEach(c => this.classes.add(c)); }
    remove(...args) { args.forEach(c => this.classes.delete(c)); }
    contains(c) { return this.classes.has(c); }
    toggle(c, force) {
        if (force === undefined) {
            if (this.classes.has(c)) { this.classes.delete(c); return false; }
            this.classes.add(c); return true;
        }
        if (force) { this.classes.add(c); return true; }
        this.classes.delete(c); return false;
    }
}

function createMockElement(tag = 'div', id = '', className = '') {
    const el = {
        tagName: tag.toUpperCase(),
        id,
        className,
        classList: new ClassList(),
        style: { setProperty() {} },
        children: [],
        parentElement: null,
        childNodes: [],
        attributes: {},
        dataset: {},
        textContent: '',
        innerHTML: '',
        setAttribute(k, v) {
            this.attributes[k] = v;
            if (k.startsWith('data-')) {
                const camel = k.slice(5).replace(/-([a-z])/g, (_, g) => g.toUpperCase());
                this.dataset[camel] = v;
            }
        },
        getAttribute(k) {
            return this.attributes[k] !== undefined ? this.attributes[k] : null;
        },
        appendChild(child) {
            child.parentElement = el;
            el.children.push(child);
            el.childNodes.push(child);
            return child;
        },
        querySelector(sel) {
            if (sel.startsWith('.')) {
                const cls = sel.slice(1);
                return el.children.find(c => c.classList.contains(cls)) || null;
            }
            if (sel.startsWith('#')) {
                const searchId = sel.slice(1);
                return el.children.find(c => c.id === searchId) || null;
            }
            return null;
        },
        querySelectorAll(sel) {
            if (sel.startsWith('.')) {
                const cls = sel.slice(1);
                return el.children.filter(c => c.classList.contains(cls));
            }
            return [];
        }
    };
    if (className) {
        className.split(/\s+/).forEach(c => el.classList.add(c));
    }
    if (id) {
        domStore.set(id, el);
    }
    return el;
}

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        createElement: (tag) => createMockElement(tag),
        getElementById: (id) => domStore.get(id) || null,
        querySelector: () => null,
        querySelectorAll: (sel) => {
            const all = Array.from(domStore.values());
            if (sel === '[data-i18n]') {
                return all.filter(el => el.getAttribute('data-i18n') !== null);
            }
            if (sel === '[data-i18n-alt]') {
                return all.filter(el => el.getAttribute('data-i18n-alt') !== null);
            }
            return [];
        },
        head: { appendChild: () => {} },
        body: { classList: new ClassList(), style: { setProperty() {} } },
        documentElement: { lang: 'en', classList: new ClassList(), style: { setProperty() {} } },
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {}
    };
}

const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));
const deJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/de.json'), 'utf8'));
const zhJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/zh.json'), 'utf8'));
const trJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/tr.json'), 'utf8'));

globalThis.fetch = async (url) => {
    if (url.includes('/en.json')) return { ok: true, json: async () => enJson };
    if (url.includes('/de.json')) return { ok: true, json: async () => deJson };
    if (url.includes('/zh.json')) return { ok: true, json: async () => zhJson };
    if (url.includes('/tr.json')) return { ok: true, json: async () => trJson };
    return { ok: false, status: 404 };
};

const { state } = await import('../../js/core/state.js');
const { loadTranslations, translate } = await import('../../js/i18n/translator.js');
const { updateUIWithTranslations } = await import('../../js/i18n/uiTranslator.js');

describe('In-Session Declarative Translation Diff Suite', () => {
    test('updateUIWithTranslations translates 100% of data-i18n and data-i18n-args in-place across all 4 locales', async () => {
        domStore.clear();

        await loadTranslations('en');
        await loadTranslations('de');
        await loadTranslations('zh');
        await loadTranslations('tr');

        // DOM fixture initialization
        const levelPill = createMockElement('div', 'test-level-pill', 'node-level-pill');
        levelPill.setAttribute('data-i18n', 'views.home.heroJourney.nodeLevel');
        levelPill.setAttribute('data-i18n-args', JSON.stringify({ level: 480 }));

        const thDivider = createMockElement('span', 'test-th-divider', 'th-max-tag');
        thDivider.setAttribute('data-i18n', 'views.home.heroJourney.thStartTag');
        thDivider.setAttribute('data-i18n-args', JSON.stringify({ th: 16 }));

        const oreHeader = createMockElement('th', 'test-ore-header', 'ore-header');
        oreHeader.setAttribute('data-i18n', 'entities.ores.shiny');

        const modBtn = createMockElement('button', 'test-mod-btn', 'mod-tab-btn');
        modBtn.setAttribute('data-i18n', 'views.equipment.modifiers.standard');

        const optionEl = createMockElement('option', 'test-league-opt');
        optionEl.setAttribute('data-i18n', 'views.income.shopOffers.th16Set');

        const badgeImg = createMockElement('img', 'test-badge-img', 'badge-img');
        badgeImg.setAttribute('data-i18n-alt', 'views.home.heroJourney.questBadgeAlt');

        // Locale transition: EN
        state.uiSettings = { language: 'en' };
        updateUIWithTranslations();

        assert.strictEqual(levelPill.textContent, translate('views.home.heroJourney.nodeLevel', { level: 480 }));
        assert.strictEqual(thDivider.textContent, translate('views.home.heroJourney.thStartTag', { th: 16 }));
        assert.strictEqual(oreHeader.textContent, translate('entities.ores.shiny'));
        assert.strictEqual(modBtn.textContent, translate('views.equipment.modifiers.standard'));
        assert.strictEqual(optionEl.textContent, translate('views.income.shopOffers.th16Set'));
        assert.strictEqual(badgeImg.getAttribute('alt'), translate('views.home.heroJourney.questBadgeAlt'));

        // Locale transition: DE
        state.uiSettings = { language: 'de' };
        updateUIWithTranslations();

        assert.strictEqual(levelPill.textContent, translate('views.home.heroJourney.nodeLevel', { level: 480 }));
        assert.strictEqual(thDivider.textContent, translate('views.home.heroJourney.thStartTag', { th: 16 }));
        assert.strictEqual(oreHeader.textContent, translate('entities.ores.shiny'));
        assert.strictEqual(modBtn.textContent, translate('views.equipment.modifiers.standard'));
        assert.strictEqual(optionEl.textContent, translate('views.income.shopOffers.th16Set'));

        // Locale transition: ZH
        state.uiSettings = { language: 'zh' };
        updateUIWithTranslations();

        assert.strictEqual(levelPill.textContent, translate('views.home.heroJourney.nodeLevel', { level: 480 }));
        assert.strictEqual(thDivider.textContent, translate('views.home.heroJourney.thStartTag', { th: 16 }));
        assert.strictEqual(oreHeader.textContent, translate('entities.ores.shiny'));
        assert.strictEqual(modBtn.textContent, translate('views.equipment.modifiers.standard'));
        assert.strictEqual(optionEl.textContent, translate('views.income.shopOffers.th16Set'));

        // Locale transition: TR
        state.uiSettings = { language: 'tr' };
        updateUIWithTranslations();

        assert.strictEqual(levelPill.textContent, translate('views.home.heroJourney.nodeLevel', { level: 480 }));
        assert.strictEqual(thDivider.textContent, translate('views.home.heroJourney.thStartTag', { th: 16 }));
        assert.strictEqual(oreHeader.textContent, translate('entities.ores.shiny'));
        assert.strictEqual(modBtn.textContent, translate('views.equipment.modifiers.standard'));
        assert.strictEqual(optionEl.textContent, translate('views.income.shopOffers.th16Set'));
    });

    test('updateUIWithTranslations smoothly renders [EN] fallback when community language misses a string', async () => {
        domStore.clear();

        const tempTr = JSON.parse(JSON.stringify(trJson));
        delete tempTr.entities.ores.shiny; // simulate missing translation in Turkish

        globalThis.fetch = async (url) => {
            if (url.includes('/en.json')) return { ok: true, json: async () => enJson };
            if (url.includes('/tr.json')) return { ok: true, json: async () => tempTr };
            return { ok: false, status: 404 };
        };

        await loadTranslations('en');
        await loadTranslations('tr');

        const testOre = createMockElement('span', 'test-missing-ore');
        testOre.setAttribute('data-i18n', 'entities.ores.shiny');

        state.uiSettings = { language: 'tr' };
        updateUIWithTranslations();

        assert.strictEqual(testOre.textContent, `[EN] ${enJson.entities.ores.shiny}`);

        // Fallback recovery: EN
        state.uiSettings = { language: 'en' };
        updateUIWithTranslations();
        assert.strictEqual(testOre.textContent, enJson.entities.ores.shiny);
    });

    test('updateUIWithTranslations safely ignores non-existent keys and preserves element attributes', async () => {
        domStore.clear();

        const safeEl = createMockElement('span', 'safe-test-el');
        safeEl.setAttribute('data-i18n', 'non.existent.key.name');

        state.uiSettings = { language: 'en' };
        updateUIWithTranslations();

        assert.strictEqual(safeEl.textContent, 'non.existent.key.name');
    });
});
