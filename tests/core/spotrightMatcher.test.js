import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildSpotrightRegistry,
    HERO_ACRONYMS,
    EQUIPMENT_ACRONYMS,
    handleSpotrightDeepLink,
    navigateToEquipment,
    navigateToHero
} from '../../js/components/spotright/spotrightRegistry.js';
import {
    extractScopePrefix,
    isSubsequence,
    scoreSpotrightItem,
    searchSpotright
} from '../../js/components/spotright/spotrightMatcher.js';
import {
    openSpotright,
    closeSpotright,
    toggleSpotright,
    initSpotright
} from '../../js/components/spotright/spotrightController.js';
import { createSpotrightDialog } from '../../js/components/spotright/spotrightDisplay.js';

describe('Spotright Search Engine & Matcher', () => {
    const registry = buildSpotrightRegistry();

    test('isSubsequence correctly verifies in-order character occurrences', () => {
        assert.equal(isSubsequence('spk', 'spiky ball'), true);
        assert.equal(isSubsequence('eb', 'earthquake boots'), true);
        assert.equal(isSubsequence('xyz', 'earthquake boots'), false);
        assert.equal(isSubsequence('sb', 'spiky ball'), true);
        assert.equal(isSubsequence('bs', 'spiky ball'), false);
    });

    test('pre-indexed registry contains all 6 heroes and 43 equipment items', () => {
        const heroes = registry.filter(i => i.entityType === 'hero');
        const equipment = registry.filter(i => i.entityType === 'epic' || i.entityType === 'common');
        const tools = registry.filter(i => i.entityType === 'nav');
        const modals = registry.filter(i => i.entityType === 'modal');

        assert.equal(heroes.length, 6, 'Must contain 6 Clash heroes');
        assert.equal(equipment.length, 43, 'Must contain all 43 equipment pieces');
        assert.ok(tools.length >= 8, 'Must contain core tools and navigation views');
        assert.ok(modals.length >= 5, 'Must contain primary modals');
    });

    test('acronym registry maps all heroes to valid 2-letter codes', () => {
        assert.equal(HERO_ACRONYMS.barbarianKing, 'bk');
        assert.equal(HERO_ACRONYMS.archerQueen, 'aq');
        assert.equal(HERO_ACRONYMS.minionPrince, 'mp');
        assert.equal(HERO_ACRONYMS.grandWarden, 'gw');
        assert.equal(HERO_ACRONYMS.royalChampion, 'rc');
        assert.equal(HERO_ACRONYMS.dragonDuke, 'dd');

        assert.equal(EQUIPMENT_ACRONYMS.electroBoots, 'eb');
        assert.equal(EQUIPMENT_ACRONYMS.earthquakeBoots, 'eb');
        assert.equal(EQUIPMENT_ACRONYMS.spikyBall, 'sb');
    });

    test('scoreSpotrightItem scores composite matches and returns 0 for non-matches', () => {
        const electroBoots = registry.find(i => i.id === 'equip-royalChampion-electroBoots');
        assert.ok(electroBoots);
        const score = scoreSpotrightItem('rc eb', electroBoots);
        assert.ok(score >= 260, 'Electro boots must receive top composite score');

        const zeroScore = scoreSpotrightItem('xyz', electroBoots);
        assert.equal(zeroScore, 0, 'Non-matching query must score 0');
    });

    test('collision tiebreaker: MP resolves Minion Prince (Hero) > Metal Pants (Common)', () => {
        const result = searchSpotright('mp', registry);
        assert.ok(result.matches.length >= 2);
        assert.equal(result.matches[0].id, 'hero-minionPrince', 'Hero must win over common equipment');
        assert.equal(result.matches[1].id, 'equip-minionPrince-metalPants');
    });

    test('collision tiebreaker: EB resolves Electro Boots (Epic) > Earthquake Boots (Common)', () => {
        const result = searchSpotright('eb', registry);
        assert.ok(result.matches.length >= 2);
        assert.equal(result.matches[0].id, 'equip-royalChampion-electroBoots', 'Epic equipment must win over common equipment');
        assert.equal(result.matches[1].id, 'equip-barbarianKing-earthquakeBoots');
    });

    test('collision tiebreaker: FB resolves Fireball (Epic) > Flame Blower (Common)', () => {
        const result = searchSpotright('fb', registry);
        assert.ok(result.matches.length >= 2);
        assert.equal(result.matches[0].id, 'equip-grandWarden-fireball', 'Fireball (Epic) must rank above Flame Blower (Common)');
        assert.equal(result.matches[1].id, 'equip-dragonDuke-flameBlower');
    });

    test('collision tiebreaker: HT resolves Heroic Torch (Epic) > Healing Tome (Common)', () => {
        const result = searchSpotright('ht', registry);
        assert.ok(result.matches.length >= 2);
        assert.equal(result.matches[0].id, 'equip-grandWarden-heroicTorch', 'Heroic Torch (Epic) must rank above Healing Tome (Common)');
        assert.equal(result.matches[1].id, 'equip-grandWarden-healingTome');
    });

    test('collision tiebreaker: SB ranks Spiky Ball & Snake Bracelet (Epics) > Stun Blaster (Common)', () => {
        const result = searchSpotright('sb', registry);
        assert.ok(result.matches.length >= 3);
        const topTwoTypes = [result.matches[0].entityType, result.matches[1].entityType];
        assert.deepEqual(topTwoTypes, ['epic', 'epic'], 'Epics must take top two slots over common');
        assert.equal(result.matches[2].id, 'equip-dragonDuke-stunBlaster');
    });

    test('composite multi-token query: "rc eb" resolves Electro Boots and filters out Earthquake Boots', () => {
        const result = searchSpotright('rc eb', registry);
        assert.ok(result.matches.length >= 1);
        assert.equal(result.matches[0].id, 'equip-royalChampion-electroBoots');

        const matchIds = result.matches.map(m => m.id);
        assert.equal(matchIds.includes('equip-barbarianKing-earthquakeBoots'), false, 'Earthquake boots must not match rc eb');
    });

    test('composite multi-token query: "bk eb" resolves Earthquake Boots', () => {
        const result = searchSpotright('bk eb', registry);
        assert.ok(result.matches.length >= 1);
        assert.equal(result.matches[0].id, 'equip-barbarianKing-earthquakeBoots');
    });

    test('compact composite query: "rceb" matches Electro Boots', () => {
        const result = searchSpotright('rceb', registry);
        assert.ok(result.matches.length >= 1);
        assert.equal(result.matches[0].id, 'equip-royalChampion-electroBoots');
    });

    test('composite words query: "aq arrow" surfaces all Archer Queen arrows', () => {
        const result = searchSpotright('aq arrow', registry);
        assert.ok(result.matches.length >= 3);
        const titles = result.matches.map(m => m.title);
        assert.ok(titles.includes('Frozen Arrow'), 'Must include Frozen Arrow');
        assert.ok(titles.includes('Monolith Arrow'), 'Must include Monolith Arrow');
        assert.ok(titles.includes('Giant Arrow'), 'Must include Giant Arrow');
    });

    test('hero expansion: searching "aq" ranks Archer Queen #1 and all her 8 equipment below', () => {
        const result = searchSpotright('aq', registry, 9);
        assert.equal(result.matches[0].id, 'hero-archerQueen', 'Hero must rank #1');
        const equipmentMatches = result.matches.slice(1);
        assert.equal(equipmentMatches.length, 8, 'Must return all 8 equipment pieces for Archer Queen');
        for (const item of equipmentMatches) {
            assert.equal(item.heroKey, 'archerQueen', 'All expanded equipment must belong to Archer Queen');
        }
    });

    test('inline autocomplete: eligible for unambiguous prefix query', () => {
        const result = searchSpotright('gia', registry);
        assert.ok(result.autocomplete !== null);
        assert.equal(result.autocomplete.fullTitle, 'Giant Gauntlet');
        assert.equal(result.autocomplete.completionText, 'nt Gauntlet');
    });

    test('inline autocomplete: suppressed on collision acronyms', () => {
        const result = searchSpotright('eb', registry);
        assert.equal(result.autocomplete, null, 'Autocomplete must be null when query does not prefix title');
    });

    test('empty query returns default navigation tools', () => {
        const result = searchSpotright('', registry);
        assert.equal(result.autocomplete, null);
        assert.ok(result.matches.length > 0);
        assert.equal(result.matches[0].entityType, 'nav');
    });

    test('all registry items define executable actions and valid metadata', () => {
        for (const item of registry) {
            assert.ok(item.id, 'Item must have an id');
            assert.ok(item.title, 'Item must have a title');
            assert.ok(item.normalizedTitle, 'Item must have a normalizedTitle');
            assert.ok(item.category, 'Item must have a category');
            assert.ok(item.subtitle, 'Item must have a subtitle');
            assert.ok(item.icon, 'Item must have an icon');
            assert.ok(item.iconType, 'Item must have an iconType');
            assert.ok(item.actionCue, 'Item must have an actionCue');
            assert.ok(typeof item.priorityTier === 'number', 'Item must have numeric priorityTier');
            assert.equal(typeof item.execute, 'function', `Item ${item.id} must define an execute function`);
        }
    });

    test('navigation helpers handle headless environment without throwing', () => {
        assert.doesNotThrow(() => navigateToEquipment('Royal Champion', 'Electro Boots', 'electroBoots'));
        assert.doesNotThrow(() => navigateToHero('Barbarian King', 'barbarianKing'));
        assert.doesNotThrow(() => handleSpotrightDeepLink());
    });

    test('handleSpotrightDeepLink parses #equip- and #hero- hashes safely', () => {
        const originalWindow = globalThis.window;
        const originalDoc = globalThis.document;

        try {
            let navigatedTarget = null;
            let tabSwitched = false;

            globalThis.document = /** @type {any} */ ({
                querySelector: (selector) => {
                    if (selector.includes('[data-tab="equipment"]')) {
                        return {
                            classList: { contains: () => false },
                            click: () => { tabSwitched = true; }
                        };
                    }
                    if (selector.includes('data-hero-name="Royal Champion"')) {
                        return {
                            querySelector: (subSelector) => {
                                if (subSelector.includes('data-equip-name="Electro Boots"')) {
                                    return {
                                        scrollIntoView: () => { navigatedTarget = 'electroBoots'; },
                                        classList: { add: () => {}, remove: () => {} },
                                        querySelector: () => ({ focus: () => {}, select: () => {}, offsetParent: {} })
                                    };
                                }
                                return null;
                            }
                        };
                    }
                    if (selector.includes('data-hero-name="Dragon Duke"')) {
                        return {
                            scrollIntoView: () => { navigatedTarget = 'dragonDuke'; },
                            classList: { add: () => {}, remove: () => {} }
                        };
                    }
                    return null;
                }
            });

            globalThis.window = /** @type {any} */ ({
                location: {
                    pathname: '/ore-calculator/',
                    hash: '#equip-electroBoots'
                },
                requestAnimationFrame: (cb) => cb(),
                setTimeout: (cb) => cb()
            });

            handleSpotrightDeepLink();
            assert.equal(tabSwitched, true, 'Equipment tab button must be clicked');
            assert.equal(navigatedTarget, 'electroBoots', 'Target equipment row must be navigated');

            // Test hero deep link
            tabSwitched = false;
            navigatedTarget = null;
            globalThis.window.location.hash = '#hero-dragonDuke';
            handleSpotrightDeepLink();
            assert.equal(tabSwitched, true, 'Equipment tab button must be clicked for hero');
            assert.equal(navigatedTarget, 'dragonDuke', 'Target hero card must be navigated');

            // Test non-matching hash
            tabSwitched = false;
            navigatedTarget = null;
            globalThis.window.location.hash = '#settings';
            handleSpotrightDeepLink();
            assert.equal(tabSwitched, false, 'Non-equip/hero hash must not trigger navigation');
            assert.equal(navigatedTarget, null);
        } finally {
            globalThis.window = originalWindow;
            globalThis.document = originalDoc;
        }
    });

    test('header trigger button state updates on openSpotright, closeSpotright, and toggleSpotright', () => {
        const originalWindow = globalThis.window;
        const originalDoc = globalThis.document;

        try {
            const buttonClasses = new Set();
            const buttonAttrs = new Map();
            const mockBtn = {
                classList: {
                    add: (cls) => buttonClasses.add(cls),
                    remove: (cls) => buttonClasses.delete(cls),
                    contains: (cls) => buttonClasses.has(cls)
                },
                setAttribute: (k, v) => buttonAttrs.set(k, String(v)),
                getAttribute: (k) => buttonAttrs.get(k) || null,
                removeAttribute: (k) => buttonAttrs.delete(k)
            };

            const dialogAttrs = new Map();
            const mockDialog = {
                hasAttribute: (k) => dialogAttrs.has(k),
                setAttribute: (k, v) => dialogAttrs.set(k, String(v)),
                removeAttribute: (k) => dialogAttrs.delete(k),
                showModal: () => dialogAttrs.set('open', ''),
                close: () => dialogAttrs.delete('open'),
                querySelector: () => ({ addEventListener: () => {}, focus: () => {}, select: () => {} }),
                addEventListener: () => {}
            };

            globalThis.document = /** @type {any} */ ({
                createElement: () => mockDialog,
                getElementById: (id) => (id === 'header-spotright-btn' ? mockBtn : null),
                querySelector: () => null,
                querySelectorAll: () => [],
                body: {
                    contains: () => true,
                    appendChild: () => {}
                },
                addEventListener: () => {}
            });

            globalThis.window = /** @type {any} */ ({
                location: { pathname: '/ore-calculator/', search: '', hash: '' },
                requestAnimationFrame: (cb) => cb(),
                addEventListener: () => {}
            });

            openSpotright();
            assert.equal(mockBtn.classList.contains('is-open'), true, 'Button must have is-open class');
            assert.equal(mockBtn.getAttribute('aria-expanded'), 'true', 'Button must have aria-expanded true');

            closeSpotright();
            assert.equal(mockBtn.classList.contains('is-open'), false, 'Button must not have is-open class');
            assert.equal(mockBtn.getAttribute('aria-expanded'), 'false', 'Button must have aria-expanded false');

            toggleSpotright();
            assert.equal(mockBtn.classList.contains('is-open'), true, 'Toggling closed dialog must open it');

            toggleSpotright();
            assert.equal(mockBtn.classList.contains('is-open'), false, 'Toggling open dialog must close it');

            assert.doesNotThrow(() => initSpotright());
        } finally {
            globalThis.window = originalWindow;
            globalThis.document = originalDoc;
        }
    });

    test('createSpotrightDialog constructs accessible feedback button in footer', () => {
        const originalDoc = globalThis.document;
        try {
            globalThis.document = /** @type {any} */ ({
                createElement: (tag) => {
                    const attrs = new Map();
                    return {
                        tagName: tag.toUpperCase(),
                        id: '',
                        className: '',
                        innerHTML: '',
                        setAttribute: (k, v) => attrs.set(k, String(v)),
                        getAttribute: (k) => attrs.get(k) || null,
                        querySelector: () => null
                    };
                }
            });

            const dialog = createSpotrightDialog();
            assert.ok(dialog.innerHTML.includes('id="spotright-feedback-btn"'), 'Dialog must include feedback button');
            assert.ok(dialog.innerHTML.includes('name="feedback"'), 'Feedback button must render feedback icon sprite');
            assert.ok(dialog.innerHTML.includes('data-i18n="views.settings.feedback.title"'), 'Feedback button must declare feedback title i18n key');
        } finally {
            globalThis.document = originalDoc;
        }
    });

    test('extractScopePrefix parses trigger commands correctly', () => {
        assert.deepEqual(extractScopePrefix('/e '), { scope: 'equipment', remainingQuery: '' });
        assert.deepEqual(extractScopePrefix('/equip '), { scope: 'equipment', remainingQuery: '' });
        assert.deepEqual(extractScopePrefix('/e boots'), { scope: 'equipment', remainingQuery: 'boots' });
        assert.deepEqual(extractScopePrefix('/h '), { scope: 'hero', remainingQuery: '' });
        assert.deepEqual(extractScopePrefix('/hero queen'), { scope: 'hero', remainingQuery: 'queen' });
        assert.deepEqual(extractScopePrefix('/t '), { scope: 'tools', remainingQuery: '' });
        assert.deepEqual(extractScopePrefix('/tool zap'), { scope: 'tools', remainingQuery: 'zap' });
        assert.deepEqual(extractScopePrefix('/s '), { scope: 'settings', remainingQuery: '' });
        assert.deepEqual(extractScopePrefix('/settings audio'), { scope: 'settings', remainingQuery: 'audio' });

        assert.equal(extractScopePrefix('regular query'), null);
        assert.equal(extractScopePrefix('/unknown query'), null);
    });

    test('scoped search restricts results strictly to specified domain', () => {
        // Equipment scope
        const equipResult = searchSpotright('boots', registry, 'equipment');
        assert.ok(equipResult.matches.length > 0);
        for (const item of equipResult.matches) {
            assert.ok(item.entityType === 'epic' || item.entityType === 'common');
        }

        // Hero scope
        const heroResult = searchSpotright('king', registry, 'hero');
        assert.ok(heroResult.matches.length > 0);
        for (const item of heroResult.matches) {
            assert.equal(item.entityType, 'hero');
        }

        // Empty query with active scope returns domain items
        const emptyHeroResult = searchSpotright('', registry, 'hero');
        assert.equal(emptyHeroResult.matches.length, 6, 'Empty query in hero scope returns all 6 heroes');

        const emptyEquipResult = searchSpotright('', registry, 'equipment');
        assert.equal(emptyEquipResult.matches.length, 43, 'Empty query in equipment scope returns all 43 equipment items');
        for (const item of emptyEquipResult.matches) {
            assert.ok(item.entityType === 'epic' || item.entityType === 'common');
        }

        // Tools scope
        const toolsResult = searchSpotright('', registry, 'tools');
        assert.ok(toolsResult.matches.length > 0);
        for (const item of toolsResult.matches) {
            assert.equal(item.entityType, 'nav');
        }

        // Settings scope
        const settingsResult = searchSpotright('', registry, 'settings');
        assert.ok(settingsResult.matches.length > 0);
        for (const item of settingsResult.matches) {
            assert.equal(item.entityType, 'modal');
        }
    });

    test('createSpotrightDialog includes scope badge and filter track with 5 chips', () => {
        const originalDoc = globalThis.document;
        try {
            globalThis.document = /** @type {any} */ ({
                createElement: (tag) => {
                    const attrs = new Map();
                    return {
                        tagName: tag.toUpperCase(),
                        id: '',
                        className: '',
                        innerHTML: '',
                        setAttribute: (k, v) => attrs.set(k, String(v)),
                        getAttribute: (k) => attrs.get(k) || null,
                        querySelector: () => null
                    };
                }
            });

            const dialog = createSpotrightDialog();
            assert.ok(dialog.innerHTML.includes('id="spotright-scope-badge"'), 'Must include scope badge');
            assert.ok(dialog.innerHTML.includes('id="spotright-scope-label"'), 'Must include scope label');
            assert.ok(dialog.innerHTML.includes('id="spotright-scope-clear"'), 'Must include scope clear button');
            assert.ok(dialog.innerHTML.includes('id="spotright-filter-track"'), 'Must include filter track');
            assert.ok(dialog.innerHTML.includes('data-scope="all"'), 'Must include all chip');
            assert.ok(dialog.innerHTML.includes('data-scope="equipment"'), 'Must include equipment chip');
            assert.ok(dialog.innerHTML.includes('data-scope="hero"'), 'Must include hero chip');
            assert.ok(dialog.innerHTML.includes('data-scope="tools"'), 'Must include tools chip');
            assert.ok(dialog.innerHTML.includes('data-scope="settings"'), 'Must include settings chip');
        } finally {
            globalThis.document = originalDoc;
        }
    });
});
