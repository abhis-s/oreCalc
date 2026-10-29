import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));

globalThis.fetch = async (url) => {
    if (String(url).includes('/en.json')) {
        return { ok: true, json: async () => enJson };
    }
    return { ok: false, status: 404, json: async () => ({}) };
};

const store = new Map();
if (typeof globalThis.localStorage === 'undefined') {
    globalThis.localStorage = {
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, val) => store.set(key, String(val)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
        key: (index) => Array.from(store.keys())[index] ?? null,
        get length() { return store.size; }
    };
}

import {
    getDefaultEquipmentUnlockLevel,
    shouldApplyHeroJourneyAutoLevel,
    getAssignedEquipmentTrackNode,
    resolveHeroJourneyTrack,
    isHeroJourneyFutureOrUnclaimedEquipment
} from '../../js/domain/income/heroJourneyResolution.js';
import { loadTranslations, translate } from '../../js/i18n/translator.js';
import { processPlayerDataResponse } from '../../js/services/serverResponseHandler.js';
import { state, getDefaultPlayerState } from '../../js/core/state.js';
import { dom } from '../../js/dom/domElements.js';

await loadTranslations('en');

class MockElement {
    constructor(tagName = 'div') {
        this.tagName = tagName.toUpperCase();
        this.id = '';
        this.children = [];
        this.parentElement = null;
        this.dataset = {};
        this.style = {};
        this.hidden = false;
        this.attributes = new Map();
        this._classes = new Set();
        this.textContent = '';
        this.value = '';
        this.innerHTML = '';
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

    get className() {
        return Array.from(this._classes).join(' ');
    }

    set className(val) {
        this._classes = new Set(String(val).split(/\s+/).filter(Boolean));
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

    hasAttribute(name) {
        return this.attributes.has(name);
    }

    appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        return child;
    }

    closest(selector) {
        let curr = this;
        while (curr) {
            if (curr._matches && curr._matches(curr, selector)) return curr;
            curr = curr.parentElement;
        }
        return null;
    }

    querySelector(selector) {
        return this._findChild(selector);
    }

    querySelectorAll(selector) {
        const results = [];
        this._findAllChildren(selector, results);
        return results;
    }

    _findChild(selector) {
        for (const child of this.children) {
            if (this._matches(child, selector)) return child;
            const nested = child._findChild ? child._findChild(selector) : null;
            if (nested) return nested;
        }
        return null;
    }

    _findAllChildren(selector, results) {
        for (const child of this.children) {
            if (this._matches(child, selector)) results.push(child);
            if (child._findAllChildren) child._findAllChildren(selector, results);
        }
    }

    _matches(elem, selector) {
        if (!elem) return false;
        if (selector.startsWith('.')) {
            const cls = selector.slice(1);
            return elem.classList && elem.classList.contains(cls);
        }
        if (selector.startsWith('#')) {
            const id = selector.slice(1);
            return elem.id === id;
        }
        if (selector.startsWith('[') && selector.endsWith(']')) {
            const attr = selector.slice(1, -1);
            if (attr.includes('=')) {
                const [name, val] = attr.split('=').map(s => s.replace(/['"]/g, ''));
                if (name.startsWith('data-')) {
                    const camelName = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
                    return elem.dataset?.[camelName] === val;
                }
                return elem.getAttribute(name) === val;
            }
            return elem.hasAttribute(attr);
        }
        return elem.tagName === selector.toUpperCase();
    }
}

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        createElement: (tag) => new MockElement(tag),
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => []
    };
}

const { createEquipmentItem } = await import('../../js/components/common/heroDisplayFactory.js');
const { renderHeroCards } = await import('../../js/components/equipment/heroCardDisplay.js');

describe('Hero Journey Pre-Leveling and Contextual Info Button Suite', () => {
    describe('Domain Logic & Resolution Tests', () => {
        test('unowned equipment on missed node defaults to level 1 and is not marked as future or auto-leveled', () => {
            const syncedState = {
                savedPlayerTags: ['#MISSED_USER'],
                playerProfile: {
                    tag: '#MISSED_USER',
                    townHallLevel: 18,
                    ownedHeroes: {
                        'Barbarian King': { level: 110 },
                        'Archer Queen': { level: 110 },
                        'Grand Warden': { level: 85 },
                        'Royal Champion': { level: 55 },
                        'Minion Prince': { level: 95 }
                    },
                    ownedEquipment: {
                        'Giant Gauntlet': 27,
                        'Spiky Ball': 27
                    }
                }
            };

            const trackRes = resolveHeroJourneyTrack(syncedState);
            const snakeOpt = trackRes[452]?.poolOptions?.find(opt => opt.key === 'snakeBracelet');
            assert.equal(snakeOpt?.status, 'missed', 'Snake bracelet must be recognized as missed');

            const unlockLevel = getDefaultEquipmentUnlockLevel('barbarianKing', 'snakeBracelet', syncedState);
            assert.equal(unlockLevel, 1, 'Missed equipment must resolve to default level 1 instead of node level');

            const isFuture = isHeroJourneyFutureOrUnclaimedEquipment('barbarianKing', 'snakeBracelet', syncedState);
            assert.equal(isFuture, false, 'Missed equipment must not be marked as future');

            const autoLevel = shouldApplyHeroJourneyAutoLevel('Barbarian King', 'Snake Bracelet', syncedState);
            assert.equal(autoLevel, false, 'Missed equipment must not have auto-level adjustment');
        });

        test('unowned equipment on future unreached node is pre-leveled to milestone unlock level', () => {
            const syncedState = {
                savedPlayerTags: ['#FUTURE_USER'],
                playerProfile: {
                    tag: '#FUTURE_USER',
                    townHallLevel: 14,
                    ownedHeroes: {
                        'Barbarian King': { level: 25 },
                        'Archer Queen': { level: 25 }
                    },
                    ownedEquipment: {
                        'Spiky Ball': 15
                    }
                }
            };

            const unlockLevel = getDefaultEquipmentUnlockLevel('barbarianKing', 'giantGauntlet', syncedState);
            assert.equal(unlockLevel, 12, 'Future rescheduled equipment must resolve to future node unlock level');

            const isFuture = isHeroJourneyFutureOrUnclaimedEquipment('barbarianKing', 'giantGauntlet', syncedState);
            assert.equal(isFuture, true, 'Future unreached equipment must be marked as future');

            const autoLevel = shouldApplyHeroJourneyAutoLevel('Barbarian King', 'Giant Gauntlet', syncedState);
            assert.equal(autoLevel, true, 'Future unreached equipment must have auto-level enabled');
        });

        test('assigned track node correctly yields Town Hall and node level for future award', () => {
            const syncedState = {
                savedPlayerTags: ['#TRACK_USER'],
                playerProfile: {
                    tag: '#TRACK_USER',
                    townHallLevel: 14,
                    ownedHeroes: {
                        'Barbarian King': { level: 50 },
                        'Archer Queen': { level: 50 },
                        'Grand Warden': { level: 35 },
                        'Minion Prince': { level: 15 }
                    },
                    ownedEquipment: {
                        'Meteor Staff': 15
                    }
                }
            };

            const trackRes = resolveHeroJourneyTrack(syncedState);
            const assignedNode = getAssignedEquipmentTrackNode('darkCrown', 'Dark Crown', trackRes, syncedState);
            assert.ok(assignedNode, 'Must find assigned future node for Dark Crown');
            assert.equal(assignedNode.node.level, 302, 'Dark Crown must be assigned to Node 302');
            assert.equal(assignedNode.nodeTH, 14, 'Dark Crown milestone must correspond to TH14');
            assert.equal(assignedNode.equipmentLevel, 15, 'Dark Crown unlock level at TH14 must be 15');
        });
    });

    describe('Server Response Ingestion Tests', () => {
        test('processPlayerDataResponse assigns level 1 to unowned missed equipment rather than static unlock level', () => {
            const defaultState = getDefaultPlayerState();
            defaultState.heroes.barbarianKing = {
                enabled: true,
                level: 110,
                equipment: {
                    giantGauntlet: { level: 27, checked: true },
                    spikyBall: { level: 27, checked: true },
                    snakeBracelet: { level: 18, checked: true }
                }
            };

            state.allPlayersData = {
                TEST_INGEST: defaultState
            };
            state.savedPlayerTags = ['#TEST_INGEST'];

            const serverData = {
                tag: '#TEST_INGEST',
                townHallLevel: 18,
                heroes: [
                    { name: 'Barbarian King', level: 110, maxLevel: 110, village: 'home' },
                    { name: 'Archer Queen', level: 110, maxLevel: 110, village: 'home' },
                    { name: 'Grand Warden', level: 85, maxLevel: 85, village: 'home' },
                    { name: 'Royal Champion', level: 55, maxLevel: 55, village: 'home' },
                    { name: 'Minion Prince', level: 95, maxLevel: 95, village: 'home' }
                ],
                heroEquipment: [
                    { name: 'Giant Gauntlet', level: 27, village: 'home' },
                    { name: 'Spiky Ball', level: 27, village: 'home' }
                ]
            };

            processPlayerDataResponse(serverData, { updateOrder: true });
            const snakeState = state.allPlayersData.TEST_INGEST.heroes.barbarianKing.equipment.snakeBracelet;
            assert.equal(snakeState.level, 1, 'Unowned missed equipment must be set to level 1 on server ingest');
        });
    });

    describe('Hero Display Component & Pre-Level Info Button Tests', () => {
        test('createEquipmentItem creates .equipment-level-controls with .equipment-prelevel-info-btn', () => {
            const item = createEquipmentItem({
                equip: { key: 'darkCrown', name: 'Dark Crown', type: 'epic', image: 'assets/dark_crown.png' },
                equipState: { level: 15, checked: false },
                mode: 'interactive',
                uiSettings: { enableLevelInput: false }
            });

            const levelControls = item.querySelector('.equipment-level-controls');
            assert.ok(levelControls, 'Must render .equipment-level-controls container');

            const infoBtn = levelControls.querySelector('.equipment-prelevel-info-btn');
            assert.ok(infoBtn, 'Must render .equipment-prelevel-info-btn inside level controls');
            assert.equal(infoBtn.hidden, true, 'Info button must be initially hidden on factory creation');
            assert.equal(infoBtn.getAttribute('aria-label'), translate('actions.showInfo'));
        });

        test('renderHeroCards configures info button for future unowned equipment and suppresses for missed/owned/guest', () => {
            const container = new MockElement('div');
            container.id = 'heroes-container';
            dom.equipment = { heroesContainer: container };

            const heroCard = new MockElement('div');
            heroCard.classList.add('hero-card');
            heroCard.dataset.heroKey = 'minionPrince';
            heroCard.dataset.heroName = 'Minion Prince';

            const equipItem = createEquipmentItem({
                equip: { key: 'darkCrown', name: 'Dark Crown', type: 'epic', image: 'assets/dark_crown.png' },
                equipState: { level: 15, checked: false },
                mode: 'interactive',
                uiSettings: { enableLevelInput: false }
            });
            heroCard.appendChild(equipItem);
            container.appendChild(heroCard);

            const prelevelBtn = equipItem.querySelector('.equipment-prelevel-info-btn');
            assert.ok(prelevelBtn, 'Button must exist in DOM tree');

            // Scenario A: Connected player where Dark Crown is on future unreached node (cumulative level 150 < 302)
            state.savedPlayerTags = ['#PLAYER_FUTURE'];
            state.playerProfile = {
                tag: '#PLAYER_FUTURE',
                townHallLevel: 14,
                ownedHeroes: {
                    'Barbarian King': { level: 50 },
                    'Archer Queen': { level: 50 },
                    'Grand Warden': { level: 35 },
                    'Minion Prince': { level: 15 }
                },
                ownedEquipment: {
                    'Meteor Staff': 15
                }
            };
            const heroesStateFuture = {
                minionPrince: {
                    level: 15,
                    enabled: true,
                    equipment: {
                        darkCrown: { level: 15, checked: false }
                    }
                }
            };

            renderHeroCards(heroesStateFuture, { enableLevelInput: false });

            assert.equal(prelevelBtn.hidden, false, 'Pre-level info button must be visible for future unreached unowned equipment');
            assert.equal(prelevelBtn.getAttribute('data-info'), 'views.equipment.heroJourneyPreLevelInfo');
            assert.equal(prelevelBtn.getAttribute('data-info-th'), '14');
            assert.equal(prelevelBtn.getAttribute('data-info-node'), '302');
            assert.equal(prelevelBtn.getAttribute('data-info-level'), '15');

            // Scenario B: User manually checks/enables the equipment card
            heroesStateFuture.minionPrince.equipment.darkCrown.checked = true;
            renderHeroCards(heroesStateFuture, { enableLevelInput: false });
            assert.equal(prelevelBtn.hidden, false, 'Info button must remain visible when user enables the unowned pre-leveled card');

            // Scenario C: Player already owns the equipment on the server
            state.playerProfile.ownedEquipment['Dark Crown'] = 15;
            renderHeroCards(heroesStateFuture, { enableLevelInput: false });
            assert.equal(prelevelBtn.hidden, true, 'Info button must be hidden when player already owns the equipment on server');

            // Scenario D: Default/Guest player profile (DEFAULT0)
            delete state.playerProfile.ownedEquipment['Dark Crown'];
            state.savedPlayerTags = ['DEFAULT0'];
            state.playerProfile.tag = 'DEFAULT0';
            renderHeroCards(heroesStateFuture, { enableLevelInput: false });
            assert.equal(prelevelBtn.hidden, true, 'Info button must never be shown for DEFAULT0 guest accounts');
        });

        test('renderHeroCards resets missed equipment level to 1 and hides info button', () => {
            const container = new MockElement('div');
            container.id = 'heroes-container';
            dom.equipment = { heroesContainer: container };

            const heroCard = new MockElement('div');
            heroCard.classList.add('hero-card');
            heroCard.dataset.heroKey = 'barbarianKing';
            heroCard.dataset.heroName = 'Barbarian King';

            const equipItem = createEquipmentItem({
                equip: { key: 'snakeBracelet', name: 'Snake Bracelet', type: 'epic', image: 'assets/snake.png' },
                equipState: { level: 18, checked: false },
                mode: 'interactive',
                uiSettings: { enableLevelInput: false }
            });
            heroCard.appendChild(equipItem);
            container.appendChild(heroCard);

            const prelevelBtn = equipItem.querySelector('.equipment-prelevel-info-btn');
            const levelDisplay = equipItem.querySelector('.level-display');

            state.savedPlayerTags = ['#MAX_PLAYER'];
            state.playerProfile = {
                tag: '#MAX_PLAYER',
                townHallLevel: 18,
                ownedHeroes: {
                    'Barbarian King': { level: 110 },
                    'Archer Queen': { level: 110 },
                    'Grand Warden': { level: 85 },
                    'Royal Champion': { level: 55 },
                    'Minion Prince': { level: 95 }
                },
                ownedEquipment: {
                    'Giant Gauntlet': 27,
                    'Spiky Ball': 27
                }
            };
            const heroesStateMissed = {
                barbarianKing: {
                    level: 110,
                    enabled: true,
                    equipment: {
                        snakeBracelet: { level: 18, checked: false }
                    }
                }
            };

            renderHeroCards(heroesStateMissed, { enableLevelInput: false });

            assert.equal(prelevelBtn.hidden, true, 'Info button must be hidden for missed equipment nodes');
            assert.equal(heroesStateMissed.barbarianKing.equipment.snakeBracelet.level, 1, 'State level must be reset to 1 for missed equipment');
            assert.equal(levelDisplay.textContent, '1', 'UI display level must be 1 for missed equipment');
        });
    });

    describe('i18n Translation & Interpolation Tests', () => {
        test('views.equipment.heroJourneyPreLevelInfo correctly interpolates {th}, {node}, and {level} in English', () => {
            const interpolated = translate('views.equipment.heroJourneyPreLevelInfo', {
                th: 14,
                node: 302,
                level: 15
            });

            assert.equal(
                interpolated,
                "Unlocks from Hero's Journey at Town Hall 14 (Node 302), already upgraded to Level 15.",
                'English string must match expected wording with dynamic variables'
            );
        });
    });
});
