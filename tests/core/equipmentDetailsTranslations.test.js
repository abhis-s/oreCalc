import { test, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        innerWidth: 1024,
        addEventListener: () => {},
        removeEventListener: () => {},
        getComputedStyle: () => ({ display: 'block' }),
        requestAnimationFrame: (cb) => { cb(); return 1; },
        cancelAnimationFrame: () => {}
    };
}
if (typeof globalThis.HTMLElement === 'undefined') {
    globalThis.HTMLElement = class {};
}
if (typeof globalThis.customElements === 'undefined') {
    globalThis.customElements = { get: () => null, define: () => {} };
}
if (typeof globalThis.requestAnimationFrame === 'undefined') {
    globalThis.requestAnimationFrame = (cb) => { cb(); return 1; };
}

const domStore = new Map();

class ClassList {
    constructor(cls = '') {
        this._set = new Set(cls ? cls.split(/\s+/).filter(Boolean) : []);
    }
    add(...args) { args.forEach(c => { if (c) this._set.add(c); }); }
    remove(...args) { args.forEach(c => this._set.delete(c)); }
    contains(c) { return this._set.has(c); }
    toggle(c, force) {
        if (typeof force === 'boolean') {
            if (force) this.add(c);
            else this.remove(c);
            return force;
        }
        if (this._set.has(c)) { this.remove(c); return false; }
        this.add(c); return true;
    }
    toString() { return Array.from(this._set).join(' '); }
}

function createMockElement(tag = 'div', id = '', className = '') {
    const el = {
        tagName: tag.toUpperCase(),
        id,
        classList: new ClassList(className),
        style: {},
        children: [],
        parentElement: null,
        attributes: {},
        dataset: {},
        _textContent: '',
        _innerHTML: '',
        get className() { return this.classList.toString(); },
        set className(val) { this.classList = new ClassList(val); },
        get textContent() { return this._textContent; },
        set textContent(val) { this._textContent = String(val); },
        get innerHTML() { return this._innerHTML; },
        set innerHTML(val) {
            this._innerHTML = String(val);
            if (!this._textContent) this._textContent = String(val).replace(/<[^>]*>/g, '');
        },
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
            return child;
        },
        querySelector(sel) {
            if (sel.startsWith('#')) return domStore.get(sel.slice(1)) || null;
            if (sel.startsWith('.')) {
                const cls = sel.slice(1);
                return el.children.find(c => c.classList.contains(cls)) || null;
            }
            return null;
        },
        querySelectorAll(sel) {
            if (sel.startsWith('.')) {
                const cls = sel.slice(1);
                return el.children.filter(c => c.classList.contains(cls));
            }
            return [];
        },
        getBoundingClientRect: () => ({ top: 0, left: 0, bottom: 40, right: 100, width: 100, height: 40, x: 0, y: 0 })
    };
    if (id) domStore.set(id, el);
    return el;
}

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        createElement: (tag) => createMockElement(tag),
        getElementById: (id) => domStore.get(id) || null,
        querySelector: (sel) => {
            if (sel.startsWith('#')) return domStore.get(sel.slice(1)) || null;
            if (sel.startsWith('.')) {
                const cls = sel.slice(1);
                for (const el of domStore.values()) {
                    if (el.classList.contains(cls)) return el;
                }
            }
            return null;
        },
        querySelectorAll: (sel) => {
            if (sel.startsWith('.')) {
                const cls = sel.slice(1);
                const results = [];
                for (const el of domStore.values()) {
                    if (el.classList.contains(cls)) results.push(el);
                }
                return results;
            }
            return [];
        }
    };
}

const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));
const deJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/de.json'), 'utf8'));

globalThis.fetch = async (url) => {
    if (url.includes('/en.json')) return { ok: true, json: async () => enJson };
    if (url.includes('/de.json')) return { ok: true, json: async () => deJson };
    return { ok: false, status: 404 };
};

const { state } = await import('../../js/core/state.js');
const { loadTranslations } = await import('../../js/i18n/translator.js');
const { renderModalHeader, renderEmptyState } = await import('../../js/components/equipment/equipmentDetailsHeaderDisplay.js');
const { renderLevelTable } = await import('../../js/components/equipment/equipmentDetailsTableDisplay.js');

describe('Equipment Details Modal Translation & Declarative Binding Suite', () => {
    let mockModal;

    beforeEach(async () => {
        domStore.clear();
        state.uiSettings = { language: 'en' };
        await loadTranslations('en');
        await loadTranslations('de');

        mockModal = createMockElement('div', 'equipment-details-modal');

        createMockElement('img', 'eq-details-hero-emblem');
        createMockElement('img', 'eq-details-item-img');
        createMockElement('span', 'eq-details-title');
        createMockElement('span', 'eq-details-desc');
        createMockElement('span', 'eq-details-type-badge');
        createMockElement('span', 'eq-details-rarity-badge');
        createMockElement('div', 'eq-details-empty-state-container');
        createMockElement('div', 'eq-details-content-wrapper');
        createMockElement('div', 'eq-details-modifier-tabs');
        createMockElement('div', 'eq-details-props-grid');
        createMockElement('div', 'eq-details-rec-banner-container');
        createMockElement('div', 'eq-details-static-stats-content');
        createMockElement('div', 'eq-details-unit-stats-content');
        createMockElement('button', 'eq-unit-stats-toggle-btn');
        createMockElement('div', 'eq-details-static-box');
        createMockElement('span', 'eq-details-lvl-header-label');
        createMockElement('span', 'eq-details-current-lvl-text');
        createMockElement('span', 'eq-details-max-lvl-text');
        createMockElement('div', 'eq-details-stats-progress-list');
        createMockElement('div', 'eq-details-rec-badge');
    });

    describe('renderModalHeader localization', () => {
        test('renders English Common and Active badges with valid help keys', () => {
            state.uiSettings.language = 'en';

            const modalData = {
                id: 'giant_gauntlet',
                rarity: 'Common',
                type: 'Active',
                heroImage: 'assets/king.png',
                equipmentImage: 'assets/gauntlet.png'
            };

            renderModalHeader(mockModal, modalData, 'Giant Gauntlet', null, null, 'Common', 'Active');

            const rarityBadge = domStore.get('eq-details-rarity-badge');
            const typeBadge = domStore.get('eq-details-type-badge');

            assert.equal(rarityBadge.textContent, 'Common');
            assert.notEqual(rarityBadge.textContent, 'entities.equipment.common');
            assert.equal(rarityBadge.getAttribute('data-info-rarity'), 'Common');
            assert.equal(rarityBadge.getAttribute('data-info'), 'views.equipment.badgeRarityHelp');

            assert.equal(typeBadge.textContent, 'Active');
            assert.notEqual(typeBadge.textContent, 'entities.equipment.active');
            assert.equal(typeBadge.getAttribute('data-info'), 'views.equipment.badgeActiveHelp');
        });

        test('renders English Epic and Passive badges', () => {
            state.uiSettings.language = 'en';

            const modalData = {
                id: 'spiky_ball',
                rarity: 'Epic',
                type: 'Passive',
                heroImage: 'assets/king.png',
                equipmentImage: 'assets/spiky_ball.png'
            };

            renderModalHeader(mockModal, modalData, 'Spiky Ball', null, null, 'Epic', 'Passive');

            const rarityBadge = domStore.get('eq-details-rarity-badge');
            const typeBadge = domStore.get('eq-details-type-badge');

            assert.equal(rarityBadge.textContent, 'Epic');
            assert.notEqual(rarityBadge.textContent, 'entities.equipment.epic');
            assert.equal(rarityBadge.getAttribute('data-info-rarity'), 'Epic');

            assert.equal(typeBadge.textContent, 'Passive');
            assert.notEqual(typeBadge.textContent, 'entities.equipment.passive');
            assert.equal(typeBadge.getAttribute('data-info'), 'views.equipment.badgePassiveHelp');
        });

        test('renders German localized Common/Epic and Active/Passive badges', () => {
            state.uiSettings.language = 'de';

            const modalData = {
                id: 'giant_gauntlet',
                rarity: 'Common',
                type: 'Active',
                heroImage: 'assets/king.png',
                equipmentImage: 'assets/gauntlet.png'
            };

            renderModalHeader(mockModal, modalData, 'Giant Gauntlet', null, null, 'Common', 'Active');

            const rarityBadge = domStore.get('eq-details-rarity-badge');
            const typeBadge = domStore.get('eq-details-type-badge');

            assert.equal(rarityBadge.textContent, 'Gewöhnlich');
            assert.equal(rarityBadge.getAttribute('data-info-rarity'), 'Gewöhnlich');

            assert.equal(typeBadge.textContent, 'Aktiv');
            assert.equal(typeBadge.getAttribute('data-info'), 'views.equipment.badgeActiveHelp');

            const epicData = {
                id: 'spiky_ball',
                rarity: 'Epic',
                type: 'Passive'
            };
            renderModalHeader(mockModal, epicData, 'Spiky Ball', null, null, 'Epic', 'Passive');

            assert.equal(rarityBadge.textContent, 'Episch');
            assert.equal(rarityBadge.getAttribute('data-info-rarity'), 'Episch');
            assert.equal(typeBadge.textContent, 'Passiv');
            assert.equal(typeBadge.getAttribute('data-info'), 'views.equipment.badgePassiveHelp');
        });
    });

    describe('renderEmptyState localization and declarative attributes', () => {
        test('renders localized empty state with declarative data-i18n keys', () => {
            state.uiSettings.language = 'en';
            renderEmptyState(mockModal, 'Unreleased Equipment', 'Epic', 'Active', 1, null);

            const emptyContainer = domStore.get('eq-details-empty-state-container');
            const emptyHTML = emptyContainer.innerHTML;

            assert.ok(emptyHTML.includes('data-i18n="views.equipment.dataNotAvailable"'));
            assert.ok(emptyHTML.includes('data-i18n="views.equipment.detailsNotAvailableDesc"'));
            assert.ok(emptyHTML.includes('data-i18n="views.equipment.contributeMissingData"'));

            const rarityBadge = domStore.get('eq-details-rarity-badge');
            assert.equal(rarityBadge.textContent, 'Epic');
            assert.equal(rarityBadge.getAttribute('data-info-rarity'), 'Epic');

            state.uiSettings.language = 'de';
            renderEmptyState(mockModal, 'Unreleased Equipment', 'Common', 'Active', 1, null);
            assert.equal(rarityBadge.textContent, 'Gewöhnlich');
            assert.equal(rarityBadge.getAttribute('data-info-rarity'), 'Gewöhnlich');
        });
    });

    describe('renderLevelTable super-headers and declarative bindings', () => {
        test('renders localized super-headers and declarative data-i18n in English', () => {
            state.uiSettings.language = 'en';

            const tableHead = createMockElement('thead', 'eq-table-head');
            const tableBody = createMockElement('tbody', 'eq-table-body');

            const mockData = {
                rarity: 'Epic',
                statsMeta: [
                    { key: 'dps', category: 'generalStats' },
                    { key: 'hitpoints', category: 'heroBoost' },
                    { key: 'ability_damage', category: 'ability' }
                ]
            };

            renderLevelTable(tableHead, tableBody, mockData, [], 1, 27, 'Epic', 'barbarian_king', 16, 'standard', null, () => {}, () => {});

            const innerHTML = tableHead.innerHTML;

            assert.ok(innerHTML.includes('data-i18n="views.equipment.generalStats"'));
            assert.ok(innerHTML.includes('data-i18n="views.equipment.heroBoost"'));
            assert.ok(innerHTML.includes('data-i18n="views.equipment.ability"'));
            assert.ok(innerHTML.includes('data-i18n="views.equipment.cost"'));
            assert.ok(innerHTML.includes('data-i18n="validation.level"'));
            assert.ok(innerHTML.includes('data-i18n="views.equipment.requiredTownHall"'));
            assert.ok(innerHTML.includes('data-i18n="entities.ores.shiny"'));
            assert.ok(innerHTML.includes('data-i18n="entities.ores.glowy"'));
            assert.ok(innerHTML.includes('data-i18n="entities.ores.starry"'));
        });

        test('renders localized super-headers and declarative data-i18n in German', () => {
            state.uiSettings.language = 'de';

            const tableHead = createMockElement('thead', 'eq-table-head');
            const tableBody = createMockElement('tbody', 'eq-table-body');

            const mockData = {
                rarity: 'Common',
                statsMeta: [
                    { key: 'dps', category: 'generalStats' },
                    { key: 'hitpoints', category: 'heroBoost' },
                    { key: 'ability_damage', category: 'ability' }
                ]
            };

            renderLevelTable(tableHead, tableBody, mockData, [], 1, 18, 'Common', 'barbarian_king', 16, 'standard', null, () => {}, () => {});

            const innerHTML = tableHead.innerHTML;

            assert.ok(innerHTML.includes('Allgemeine Werte'));
            assert.ok(innerHTML.includes('Helden-Boost'));
            assert.ok(innerHTML.includes('Fähigkeit'));
            assert.ok(innerHTML.includes('Kosten'));
            assert.ok(innerHTML.includes('data-i18n="views.equipment.cost"'));
        });
    });
});
