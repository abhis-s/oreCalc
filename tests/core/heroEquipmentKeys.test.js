import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { heroData } from '../../js/data/heroData.js';
import { getEquipLevel } from '../../js/components/equipment/equipmentDetailsModalData.js';
import { state } from '../../js/core/state.js';

class MockElement {
    constructor(tagName = 'div') {
        this.tagName = tagName.toUpperCase();
        this.id = '';
        this.className = '';
        this.children = [];
        this.dataset = {};
        this.style = {};
        this.attributes = new Map();
        this._classes = new Set();
        this.classList = {
            add: (...cls) => cls.forEach(c => this._classes.add(c)),
            remove: (...cls) => cls.forEach(c => this._classes.delete(c)),
            contains: (c) => this._classes.has(c),
            toggle: (c, force) => {
                if (force === undefined) {
                    if (this._classes.has(c)) this._classes.delete(c);
                    else this._classes.add(c);
                } else if (force) {
                    this._classes.add(c);
                } else {
                    this._classes.delete(c);
                }
            }
        };
    }

    setAttribute(name, val) {
        this.attributes.set(name, String(val));
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    getAttribute(name) {
        return this.attributes.get(name) || null;
    }

    appendChild(child) {
        this.children.push(child);
        return child;
    }

    querySelector() {
        return null;
    }

    querySelectorAll() {
        return [];
    }

    addEventListener() {}
    removeEventListener() {}
}

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        createElement: (tag) => new MockElement(tag),
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => []
    };
}

const { createEquipmentItem, createHeroCard, createHeroIcon } = await import('../../js/components/common/heroDisplayFactory.js');

describe('Hero and Equipment Key Standardization Suite', () => {
    test('heroData registry provides valid invariant keys for all heroes and equipment', () => {
        const heroKeys = Object.keys(heroData);
        assert.ok(heroKeys.length >= 6, 'Must define at least 6 canonical heroes');

        heroKeys.forEach(hKey => {
            const hero = heroData[hKey];
            assert.ok(typeof hero.key === 'string' && hero.key.length > 0, `Hero ${hKey} must have a non-empty key`);
            assert.equal(hero.key, hKey, `Hero key must match heroData object key`);
            assert.ok(typeof hero.name === 'string' && hero.name.length > 0, `Hero ${hKey} must have a non-empty canonical name`);
            assert.ok(Array.isArray(hero.equipment) && hero.equipment.length > 0, `Hero ${hKey} must have an equipment array`);

            hero.equipment.forEach(eq => {
                assert.ok(typeof eq.key === 'string' && eq.key.length > 0, `Equipment in ${hKey} must have a non-empty key`);
                assert.ok(typeof eq.name === 'string' && eq.name.length > 0, `Equipment in ${hKey} must have a non-empty canonical name`);
                assert.ok(typeof eq.type === 'string', `Equipment in ${hKey} must have a type`);
            });
        });
    });

    test('createEquipmentItem stamps dataset.equipKey and dataset.equipName', () => {
        const item = createEquipmentItem({
            equip: { key: 'giantGauntlet', name: 'Giant Gauntlet', type: 'epic', image: 'assets/gauntlet.png' },
            equipState: { level: 17, checked: true },
            mode: 'interactive'
        });

        assert.equal(item.dataset.equipKey, 'giantGauntlet');
        assert.equal(item.dataset.equipName, 'Giant Gauntlet');
        assert.equal(item.dataset.equipType, 'epic');
    });

    test('createHeroCard stamps dataset.heroKey and dataset.heroName', () => {
        const hero = heroData.barbarianKing;
        const heroCard = createHeroCard({
            hero,
            heroState: { level: 95, enabled: true, equipment: {} },
            heroKey: 'barbarianKing',
            mode: 'interactive'
        });

        assert.equal(heroCard.dataset.heroKey, 'barbarianKing');
        assert.equal(heroCard.dataset.heroName, 'Barbarian King');
    });

    test('createHeroIcon attaches alt text and i18n attribute matching hero.key', () => {
        const hero = heroData.archerQueen;
        const icon = createHeroIcon(hero);

        assert.ok(icon.attributes.get('alt')?.length > 0);
        assert.equal(icon.dataset.i18nAlt, 'entities.heroes.archerQueen');
    });

    test('getEquipLevel resolves levels by key or name regardless of case or hero specification', () => {
        const prevHeroes = state.heroes;
        try {
            state.heroes = {
                'Barbarian King': {
                    equipment: {
                        'Giant Gauntlet': { level: 27 },
                        'Spiky Ball': { level: 18 }
                    }
                },
                'Dragon Duke': {
                    equipment: {
                        'Fire Heart': { level: 15 }
                    }
                }
            };

            assert.equal(getEquipLevel('Giant Gauntlet', 'Barbarian King'), 27);
            assert.equal(getEquipLevel('giantGauntlet', 'Barbarian King'), 27);
            assert.equal(getEquipLevel('giantGauntlet', null, 'barbarianKing'), 27);
            assert.equal(getEquipLevel('giant_gauntlet', 'barbarian_king'), 27);
            assert.equal(getEquipLevel('fireHeart', 'Dragon Duke'), 15);
            assert.equal(getEquipLevel('fireHeart', null, 'dragonDuke'), 15);
            assert.equal(getEquipLevel('fireHeart'), 15);
        } finally {
            state.heroes = prevHeroes;
        }
    });

    test('card layout container resolution supports both heroKey and heroName orders without duplicates', () => {
        const bkCard = new MockElement();
        bkCard.dataset.heroKey = 'barbarianKing';
        bkCard.dataset.heroName = 'Barbarian King';

        const aqCard = new MockElement();
        aqCard.dataset.heroKey = 'archerQueen';
        aqCard.dataset.heroName = 'Archer Queen';

        const containers = [bkCard, aqCard];
        const containerMap = new Map();
        containers.forEach(container => {
            if (container.dataset.heroKey) containerMap.set(container.dataset.heroKey, container);
            if (container.dataset.heroName) containerMap.set(container.dataset.heroName, container);
        });

        // Test with key order
        const keyOrder = ['archerQueen', 'barbarianKing'];
        const placedByKey = [];
        const placedSetKey = new Set();
        keyOrder.forEach(id => {
            const el = containerMap.get(id);
            if (el && !placedSetKey.has(el)) {
                placedByKey.push(el);
                placedSetKey.add(el);
            }
        });
        assert.deepEqual(placedByKey, [aqCard, bkCard]);

        // Test with name order
        const nameOrder = ['Archer Queen', 'Barbarian King'];
        const placedByName = [];
        const placedSetName = new Set();
        nameOrder.forEach(id => {
            const el = containerMap.get(id);
            if (el && !placedSetName.has(el)) {
                placedByName.push(el);
                placedSetName.add(el);
            }
        });
        assert.deepEqual(placedByName, [aqCard, bkCard]);
    });
});
