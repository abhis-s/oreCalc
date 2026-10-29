import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildSpotrightRegistry,
    HERO_ACRONYMS,
    EQUIPMENT_ACRONYMS,
    DAMAGE_EQUIPMENT_MAP
} from '../../js/components/spotright/spotrightRegistry.js';
import {
    buildSpotrightUrl,
    getCurrentRouteContext,
    getRoutePrefix,
    handleSpotrightDeepLink,
    isSelfTarget,
    navigateToEquipment,
    navigateToHero,
    openDamageCalcEquipment
} from '../../js/components/spotright/spotrightNavigator.js';
import {
    extractScopePrefix,
    getScopeSuggestions,
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
import { createSpotrightDialog, highlightMatch, renderSpotrightResults } from '../../js/components/spotright/spotrightDisplay.js';

describe('Spotright Search Engine & Matcher', () => {
    const registry = buildSpotrightRegistry();

    test('isSubsequence correctly verifies in-order character occurrences', () => {
        assert.equal(isSubsequence('spk', 'spiky ball'), true);
        assert.equal(isSubsequence('eb', 'earthquake boots'), true);
        assert.equal(isSubsequence('xyz', 'earthquake boots'), false);
        assert.equal(isSubsequence('sb', 'spiky ball'), true);
        assert.equal(isSubsequence('bs', 'spiky ball'), false);
    });

    test('pre-indexed registry contains all 6 heroes and 43 equipment items with orthogonal taxonomy', () => {
        const heroes = registry.filter(i => i.type === 'hero');
        const equipment = registry.filter(i => i.type === 'equipment' && (i.rarity === 'epic' || i.rarity === 'common'));
        const tools = registry.filter(i => i.scopes?.includes('tools'));
        const settingsAndModals = registry.filter(i => i.scopes?.includes('settings'));

        assert.equal(heroes.length, 6, 'Must contain 6 Clash heroes');
        assert.equal(equipment.length, 43, 'Must contain all 43 equipment pieces');
        assert.ok(tools.length >= 7, 'Must contain core tools and navigation views');
        assert.ok(settingsAndModals.length >= 5, 'Must contain primary settings actions and modals');
        assert.equal(Object.keys(DAMAGE_EQUIPMENT_MAP).length, 7, 'Must map all 7 damaging equipment pieces');
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
        const topTwoRarities = [result.matches[0].rarity, result.matches[1].rarity];
        assert.deepEqual(topTwoRarities, ['epic', 'epic'], 'Epics must take top two slots over common');
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
        assert.equal(result.matches[0].scopes?.includes('tools'), true);
    });

    test('all registry items define executable actions and valid metadata', () => {
        for (const item of registry) {
            assert.ok(item.id, 'Item must have an id');
            assert.ok(item.type, 'Item must have a type');
            assert.ok(Array.isArray(item.scopes), 'Item must have a scopes array');
            assert.ok(item.parent, 'Item must have a parent');
            assert.ok(item.title, 'Item must have a title');
            assert.ok(item.normalizedTitle, 'Item must have a normalizedTitle');
            assert.ok(item.category, 'Item must have a category');
            if (item.subtitle) {
                assert.equal(typeof item.subtitle, 'string', 'Item subtitle must be a string');
            }
            if (item.parentContext) {
                assert.equal(typeof item.parentContext, 'string', 'Item parentContext must be a string');
            }
            assert.ok(item.icon, 'Item must have an icon');
            assert.ok(item.iconType, 'Item must have an iconType');
            assert.ok(typeof item.priorityTier === 'number', 'Item must have numeric priorityTier');
            assert.equal(typeof item.execute, 'function', `Item ${item.id} must define an execute function`);
        }
    });

    test('navigation helpers handle headless environment without throwing', () => {
        assert.doesNotThrow(() => navigateToEquipment('Royal Champion', 'Electro Boots', 'electroBoots'));
        assert.doesNotThrow(() => navigateToHero('Barbarian King', 'barbarianKing'));
        assert.doesNotThrow(() => handleSpotrightDeepLink());
        assert.doesNotThrow(() => openDamageCalcEquipment('fireball'));
        assert.equal(getRoutePrefix(), '');
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
        assert.deepEqual(extractScopePrefix('/v '), { scope: 'villages', remainingQuery: '' });
        assert.deepEqual(extractScopePrefix('/village '), { scope: 'villages', remainingQuery: '' });
        assert.deepEqual(extractScopePrefix('/villages main'), { scope: 'villages', remainingQuery: 'main' });
        assert.deepEqual(extractScopePrefix('/e '), { scope: 'equipment', remainingQuery: '' });
        assert.deepEqual(extractScopePrefix('/equip '), { scope: 'equipment', remainingQuery: '' });
        assert.deepEqual(extractScopePrefix('/e boots'), { scope: 'equipment', remainingQuery: 'boots' });
        assert.deepEqual(extractScopePrefix('/h '), { scope: 'hero', remainingQuery: '' });
        assert.deepEqual(extractScopePrefix('/hero queen'), { scope: 'hero', remainingQuery: 'queen' });
        assert.deepEqual(extractScopePrefix('/heroes queen'), { scope: 'hero', remainingQuery: 'queen' });
        assert.deepEqual(extractScopePrefix('/t '), { scope: 'tools', remainingQuery: '' });
        assert.deepEqual(extractScopePrefix('/tool zap'), { scope: 'tools', remainingQuery: 'zap' });
        assert.deepEqual(extractScopePrefix('/tools zap'), { scope: 'tools', remainingQuery: 'zap' });
        assert.deepEqual(extractScopePrefix('/s '), { scope: 'settings', remainingQuery: '' });
        assert.deepEqual(extractScopePrefix('/setting '), { scope: 'settings', remainingQuery: '' });
        assert.deepEqual(extractScopePrefix('/settings audio'), { scope: 'settings', remainingQuery: 'audio' });

        assert.equal(extractScopePrefix('regular query'), null);
        assert.equal(extractScopePrefix('/unknown query'), null);
    });

    test('scoped search restricts results strictly to specified domain', () => {
        // Equipment scope
        const equipResult = searchSpotright('boots', registry, 'equipment');
        assert.ok(equipResult.matches.length > 0);
        for (const item of equipResult.matches) {
            assert.equal(item.type, 'equipment');
            assert.ok(item.rarity === 'epic' || item.rarity === 'common');
        }

        // Hero scope
        const heroResult = searchSpotright('king', registry, 'hero');
        assert.ok(heroResult.matches.length > 0);
        for (const item of heroResult.matches) {
            assert.equal(item.type, 'hero');
        }

        // Empty query with active scope returns domain items
        const emptyHeroResult = searchSpotright('', registry, 'hero');
        assert.equal(emptyHeroResult.matches.length, 6, 'Empty query in hero scope returns all 6 heroes');

        const emptyEquipResult = searchSpotright('', registry, 'equipment');
        assert.equal(emptyEquipResult.matches.length, 43, 'Empty query in equipment scope returns all 43 equipment items');
        for (const item of emptyEquipResult.matches) {
            assert.equal(item.type, 'equipment');
            assert.ok(item.rarity === 'epic' || item.rarity === 'common');
        }

        // Tools scope
        const toolsResult = searchSpotright('', registry, 'tools');
        assert.ok(toolsResult.matches.length > 0);
        for (const item of toolsResult.matches) {
            assert.equal(item.scopes?.includes('tools'), true);
        }

        // Settings scope
        const settingsResult = searchSpotright('', registry, 'settings');
        assert.ok(settingsResult.matches.length > 0);
        for (const item of settingsResult.matches) {
            assert.equal(item.scopes?.includes('settings'), true);
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

    test('highlightMatch safely escapes and highlights substrings', () => {
        // Empty query
        assert.equal(highlightMatch('Progression Hub', ''), 'Progression Hub');
        assert.equal(highlightMatch('Progression Hub', '   '), 'Progression Hub');

        // Full exact match
        assert.equal(
            highlightMatch('Ore Calculator', 'ore'),
            '<mark class="spotright-match-highlight">Ore</mark> Calculator'
        );

        // Substring match
        assert.equal(
            highlightMatch('Giant Gauntlet', 'gaunt'),
            'Giant <mark class="spotright-match-highlight">Gaunt</mark>let'
        );

        // Multi-token match
        assert.equal(
            highlightMatch('Barbarian King', 'barb king'),
            '<mark class="spotright-match-highlight">Barb</mark>arian <mark class="spotright-match-highlight">King</mark>'
        );

        // Special characters and XSS escaping
        assert.equal(
            highlightMatch('Test <tag> & "quote"', 'test'),
            '<mark class="spotright-match-highlight">Test</mark> &lt;tag&gt; &amp; &quot;quote&quot;'
        );

        // Hash character in player tags
        assert.equal(
            highlightMatch('Load Player #8PJYGUJC', '#8pj'),
            'Load Player <mark class="spotright-match-highlight">#8PJ</mark>YGUJC'
        );

        // Leading '/' command trigger stripping in highlightMatch
        assert.equal(
            highlightMatch('Hero Equipment', '/equip'),
            'Hero <mark class="spotright-match-highlight">Equip</mark>ment'
        );

        // Leading '@' mention trigger stripping in highlightMatch
        assert.equal(
            highlightMatch('Chief Base', '@chief'),
            '<mark class="spotright-match-highlight">Chief</mark> Base'
        );
    });

    test('scope suggestions: typing "/" returns all 5 canonical scope suggestions in exact chip track order', () => {
        const result = searchSpotright('/', registry);
        assert.equal(result.autocomplete, null);
        assert.equal(result.matches.length, 5, 'Must return all 5 scope suggestions');

        const scopes = result.matches.map(m => m.targetScope);
        assert.deepEqual(scopes, ['villages', 'equipment', 'hero', 'tools', 'settings'], 'Must match filter track chip order exactly');

        for (const item of result.matches) {
            assert.equal(item.isScopeSuggestion, true);
            assert.ok(item.command.startsWith('/'));
            assert.ok(item.title);
            assert.equal(item.subtitle, undefined, 'Scope suggestions must have zero subtitle');
            assert.ok(item.icon);
        }

        const heroItem = result.matches.find(m => m.targetScope === 'hero');
        assert.ok(heroItem);
        assert.equal(heroItem.command, '/heroes', 'Hero scope command must be /heroes');
    });

    test('scope suggestions: typing "/e" or "/eq" narrows down to equipment', () => {
        const result = searchSpotright('/e', registry);
        assert.ok(result.matches.length >= 1);
        assert.equal(result.matches[0].targetScope, 'equipment');
        assert.equal(result.matches[0].command, '/equipment');
    });

    test('scope suggestions: typing "/v", "/h", "/t", "/s" narrows to respective scopes', () => {
        assert.equal(searchSpotright('/v', registry).matches[0].targetScope, 'villages');
        assert.equal(searchSpotright('/h', registry).matches[0].targetScope, 'hero');
        assert.equal(searchSpotright('/t', registry).matches[0].targetScope, 'tools');
        assert.equal(searchSpotright('/s', registry).matches[0].targetScope, 'settings');
    });

    test('scope suggestions: typing "/hero" or "/heroes" resolves to hero scope', () => {
        assert.equal(searchSpotright('/hero', registry).matches[0].targetScope, 'hero');
        assert.equal(searchSpotright('/heroes', registry).matches[0].targetScope, 'hero');
    });

    test('scope suggestions: strict slash command isolation prevents non-command items from appearing', () => {
        const unknownResult = searchSpotright('/xyz', registry);
        assert.equal(unknownResult.matches.length, 0, 'Must return 0 results for unknown command');
        assert.equal(unknownResult.autocomplete, null);

        const unknownMultiWord = searchSpotright('/unknown command', registry);
        assert.equal(unknownMultiWord.matches.length, 0, 'Must return 0 results for unhandled slash input');
    });

    test('instant village switcher: typing "@" returns saved villages and add-player action', () => {
        const result = searchSpotright('@', registry);
        assert.equal(result.autocomplete, null);
        assert.ok(result.matches.length >= 1);

        const hasVillageOrAdd = result.matches.every(m => m.isVillage || m.id === 'action-add-player');
        assert.ok(hasVillageOrAdd, 'All results under @ must be villages or add-player action');
    });

    test('instant village switcher: typing "@#8PJYGUJC" synthesizes direct tag action', () => {
        const result = searchSpotright('@#8PJYGUJC', registry);
        assert.ok(result.matches.length >= 1);
        const directTagItem = result.matches.find(m => m.id === 'action-direct-tag-8PJYGUJC');
        assert.ok(directTagItem, 'Must synthesize direct tag candidate');
        assert.equal(directTagItem.type, 'action');
    });

    test('renderSpotrightResults renders command pill, Tab keycap, and zero subtitle for scope suggestions', () => {
        const suggestions = getScopeSuggestions('/');
        assert.ok(suggestions.length > 0);
        assert.equal(suggestions[0].id, 'scope-villages');
        assert.equal(suggestions[0].type, 'scope');

        const container = { innerHTML: '' };
        // @ts-ignore
        renderSpotrightResults(container, [suggestions[0]], 0, '/');

        assert.ok(container.innerHTML.includes('spotright-command-pill'), 'Must render command pill');
        assert.ok(container.innerHTML.includes('/villages'), 'Must contain villages command text');
        assert.ok(container.innerHTML.includes('spotright-action-tab'), 'Must render Tab keycap');
        assert.ok(container.innerHTML.includes('name="keyboard-tab"'), 'Must include keyboard-tab SVG');
        assert.equal(container.innerHTML.includes('spotright-item-subtitle'), false, 'Scope suggestion must have zero subtitle');
    });

    test('scope suggestions: single suggestion space auto-complete resolution conditions', () => {
        const heMatches = searchSpotright('/he', registry).matches;
        assert.equal(heMatches.length, 1, 'Query /he must have strictly 1 suggestion');
        assert.equal(heMatches[0].targetScope, 'hero');

        const toMatches = searchSpotright('/to', registry).matches;
        assert.equal(toMatches.length, 1, 'Query /to must have strictly 1 suggestion');
        assert.equal(toMatches[0].targetScope, 'tools');

        const vMatches = searchSpotright('/v', registry).matches;
        assert.equal(vMatches.length, 1, 'Query /v must have strictly 1 suggestion');
        assert.equal(vMatches[0].targetScope, 'villages');

        const tMatches = searchSpotright('/t', registry).matches;
        assert.equal(tMatches.length, 1, 'Query /t must have strictly 1 suggestion');
        assert.equal(tMatches[0].targetScope, 'tools');

        const hMatches = searchSpotright('/h', registry).matches;
        assert.equal(hMatches.length, 1, 'Query /h must have strictly 1 suggestion');
        assert.equal(hMatches[0].targetScope, 'hero');

        const rootMatches = searchSpotright('/', registry).matches;
        assert.equal(rootMatches.length, 5, 'Query / has 5 suggestions (space must not auto-complete)');

        const sMatches = searchSpotright('/s', registry).matches;
        assert.equal(sMatches.length, 2, 'Query /s has 2 suggestions (settings and villages, space must not auto-complete)');
    });

    test('createSpotrightDialog includes search clear button with canonical i18n attribute', () => {
        const originalDoc = globalThis.document;
        try {
            const attrs = new Map();
            globalThis.document = /** @type {any} */ ({
                createElement: (tag) => ({
                    tagName: tag.toUpperCase(),
                    id: '',
                    className: '',
                    innerHTML: '',
                    setAttribute: (k, v) => attrs.set(k, String(v)),
                    getAttribute: (k) => attrs.get(k) || null,
                    querySelector: () => null
                })
            });

            const dialog = createSpotrightDialog();
            const html = dialog.innerHTML;
            assert.match(html, /id="spotright-clear-btn"/, 'Must contain spotright-clear-btn');
            assert.match(html, /data-i18n-aria-label="views\.heroJourney\.page\.clearSearch"/, 'Must use canonical clearSearch i18n key');
            assert.match(html, /data-i18n-title="views\.heroJourney\.page\.clearSearch"/, 'Must bind title to canonical clearSearch');
            assert.match(html, /<clashcalc-assets-svg name="close" width="12" height="12"/, 'Must render close SVG icon');
        } finally {
            globalThis.document = originalDoc;
        }
    });

    test('renderSpotrightResults empty state renders reset filters button with canonical i18n key', () => {
        const container = { innerHTML: '' };
        // @ts-ignore
        renderSpotrightResults(container, [], 0, 'xyzabc');
        assert.match(container.innerHTML, /id="spotright-empty-reset-btn"/, 'Must contain spotright-empty-reset-btn');
        assert.match(container.innerHTML, /data-i18n="views\.damageCalc\.filters\.resetFiltersBtn"/, 'Must use canonical resetFiltersBtn i18n key');
        assert.match(container.innerHTML, /<clashcalc-assets-svg name="close" width="12" height="12"/, 'Must render close SVG icon');
    });

    test('page-hub is omitted on landing page and included on tool pages', () => {
        const originalWindow = globalThis.window;
        try {
            globalThis.window = /** @type {any} */ ({ location: { pathname: '/', search: '' } });
            const hubRegistry = buildSpotrightRegistry();
            assert.equal(hubRegistry.some(i => i.id === 'page-hub'), false, 'page-hub must be omitted on Landing page');

            globalThis.window = /** @type {any} */ ({ location: { pathname: '/ore-calculator/', search: '' } });
            const oreCalcRegistry = buildSpotrightRegistry();
            assert.equal(oreCalcRegistry.some(i => i.id === 'page-hub'), true, 'page-hub must be included on OreCalc page');
        } finally {
            globalThis.window = originalWindow;
        }
    });

    test('modal-priority-list is only included on ore-calculator page via parent-only visibility', () => {
        const originalWindow = globalThis.window;
        try {
            globalThis.window = /** @type {any} */ ({ location: { pathname: '/', search: '' } });
            const hubRegistry = buildSpotrightRegistry();
            assert.equal(hubRegistry.some(i => i.id === 'modal-priority-list'), false, 'modal-priority-list must be omitted on Hub');

            globalThis.window = /** @type {any} */ ({ location: { pathname: '/hero-journey/', search: '' } });
            const hjRegistry = buildSpotrightRegistry();
            assert.equal(hjRegistry.some(i => i.id === 'modal-priority-list'), false, 'modal-priority-list must be omitted on Hero Journey');

            globalThis.window = /** @type {any} */ ({ location: { pathname: '/ore-calculator/', search: '' } });
            const ocRegistry = buildSpotrightRegistry();
            const priorityItem = ocRegistry.find(i => i.id === 'modal-priority-list');
            assert.ok(priorityItem, 'modal-priority-list must be included on OreCalc');
            assert.equal(priorityItem.type, 'modal');
            assert.equal(priorityItem.parent, 'orecalc');
            assert.equal(priorityItem.visibility, 'parent-only');
            assert.deepEqual(priorityItem.scopes, ['tools']);

            const toolsScoped = searchSpotright('', ocRegistry, 'tools');
            assert.equal(toolsScoped.matches.some(i => i.id === 'modal-priority-list'), true, 'modal-priority-list must be included in tools scope');

            const settingsScoped = searchSpotright('', ocRegistry, 'settings');
            assert.equal(settingsScoped.matches.some(i => i.id === 'modal-priority-list'), false, 'modal-priority-list must be strictly excluded from settings scope');
        } finally {
            globalThis.window = originalWindow;
        }
    });

    test('action-toggle-theme is registered across all pages and uses canonical i18n title', () => {
        const originalWindow = globalThis.window;
        try {
            globalThis.window = /** @type {any} */ ({ location: { pathname: '/', search: '' } });
            const reg = buildSpotrightRegistry();
            const themeItem = reg.find(i => i.id === 'action-toggle-theme');
            assert.ok(themeItem, 'Must register action-toggle-theme');
            assert.equal(themeItem.type, 'action');
            assert.equal(themeItem.canonicalTitle, 'toggle theme');
            assert.equal(typeof themeItem.execute, 'function');
        } finally {
            globalThis.window = originalWindow;
        }
    });

    test('unified page and tab topology: isSelfTarget hides active tab and surfaces default home tab when on sub-tab', () => {
        const originalWindow = globalThis.window;
        try {
            globalThis.window = /** @type {any} */ ({ location: { pathname: '/ore-calculator/', search: '', hash: '' } });
            assert.deepEqual(getCurrentRouteContext(), { page: 'orecalc', activeTab: 'home' });
            const ocHomeReg = buildSpotrightRegistry();
            assert.equal(ocHomeReg.some(i => i.id === 'page-orecalc'), false, 'page-orecalc must be hidden on OreCalc home tab');
            assert.equal(ocHomeReg.some(i => i.id === 'tab-planner'), true, 'tab-planner must be shown on OreCalc home tab');
            assert.equal(ocHomeReg.some(i => i.id === 'tab-income'), true, 'tab-income must be shown on OreCalc home tab');

            globalThis.window = /** @type {any} */ ({ location: { pathname: '/ore-calculator/', search: '?tab=planner', hash: '' } });
            assert.deepEqual(getCurrentRouteContext(), { page: 'orecalc', activeTab: 'planner' });
            const ocPlannerReg = buildSpotrightRegistry();
            assert.equal(ocPlannerReg.some(i => i.id === 'tab-planner'), false, 'tab-planner must be hidden when already on ?tab=planner');
            assert.equal(ocPlannerReg.some(i => i.id === 'page-orecalc'), true, 'page-orecalc must be shown when on ?tab=planner sub-tab');
            assert.equal(ocPlannerReg.some(i => i.id === 'tab-income'), true, 'tab-income must be shown when on ?tab=planner');

            // Legacy hash check
            globalThis.window = /** @type {any} */ ({ location: { pathname: '/ore-calculator/', search: '', hash: '#planner' } });
            assert.deepEqual(getCurrentRouteContext(), { page: 'orecalc', activeTab: 'planner' });

            globalThis.window = /** @type {any} */ ({ location: { pathname: '/damage-calculator/', search: '', hash: '' } });
            assert.deepEqual(getCurrentRouteContext(), { page: 'damagecalc', activeTab: 'zapquake' });
            const dcZapReg = buildSpotrightRegistry();
            assert.equal(dcZapReg.some(i => i.id === 'page-damagecalc'), false, 'page-damagecalc must be hidden on ZapQuake default tab');
            assert.equal(dcZapReg.some(i => i.id === 'tab-cluster-planner'), true, 'tab-cluster-planner must be shown on ZapQuake tab');

            globalThis.window = /** @type {any} */ ({ location: { pathname: '/damage-calculator/', search: '?tab=cluster-planner', hash: '' } });
            assert.deepEqual(getCurrentRouteContext(), { page: 'damagecalc', activeTab: 'cluster-planner' });
            const dcClusterReg = buildSpotrightRegistry();
            assert.equal(dcClusterReg.some(i => i.id === 'tab-cluster-planner'), false, 'tab-cluster-planner must be hidden when already on ?tab=cluster-planner');
            assert.equal(dcClusterReg.some(i => i.id === 'page-damagecalc'), true, 'page-damagecalc must be shown when on ?tab=cluster-planner sub-tab');

            // Legacy hash check
            globalThis.window = /** @type {any} */ ({ location: { pathname: '/damage-calculator/', search: '', hash: '#cluster_planner' } });
            assert.deepEqual(getCurrentRouteContext(), { page: 'damagecalc', activeTab: 'cluster-planner' });
            assert.equal(isSelfTarget(null), false);
        } finally {
            globalThis.window = originalWindow;
        }
    });

    test('multi-parent equipment ranking: DamageCalc registered equipment ranks higher on /damage-calculator/', () => {
        const originalWindow = globalThis.window;
        try {
            globalThis.window = /** @type {any} */ ({ location: { pathname: '/damage-calculator/', search: '', hash: '' } });
            const dcReg = buildSpotrightRegistry();

            const fireball = dcReg.find(i => i.id === 'equip-grandWarden-fireball');
            const eternalTome = dcReg.find(i => i.id === 'equip-grandWarden-eternalTome');
            assert.ok(fireball && eternalTome);
            assert.deepEqual(fireball.parents, ['damagecalc', 'orecalc']);
            assert.deepEqual(eternalTome.parents, ['orecalc']);
            assert.equal(fireball.priorityTier, 35, 'Registered epic on DamageCalc receives priorityTier 35');
            assert.equal(eternalTome.priorityTier, 10, 'Unregistered common on DamageCalc retains priorityTier 10');

            // Acronym collision on DamageCalc: 'eb' ranks Earthquake Boots (DamageCalc-registered, 32) above Electro Boots (OreCalc-only, 20)
            const ebSearch = searchSpotright('eb', dcReg);
            assert.equal(ebSearch.matches[0].id, 'equip-barbarianKing-earthquakeBoots', 'Registered Earthquake Boots must rank #1 for eb on DamageCalc');

            // Empty query in equipment scope on DamageCalc surfaces all 7 DamageCalc equipment items first
            const emptyEquipOnDc = searchSpotright('', dcReg, 'equipment');
            const topSeven = emptyEquipOnDc.matches.slice(0, 7);
            for (const item of topSeven) {
                assert.equal(item.parents?.includes('damagecalc'), true, `Top 7 equipment on DamageCalc must be registered on DamageCalc (${item.id})`);
            }
        } finally {
            globalThis.window = originalWindow;
        }
    });

    test('page-hub and buildSpotrightUrl preserve active tag on navigation', () => {
        const originalWindow = globalThis.window;
        try {
            globalThis.window = /** @type {any} */ ({
                location: {
                    pathname: '/ore-calculator/',
                    search: '?tag=8PJYGUJC',
                    href: ''
                }
            });
            assert.equal(buildSpotrightUrl('hub'), '/?tag=8PJYGUJC');
            assert.equal(buildSpotrightUrl('damagecalc', { tab: 'cluster-planner' }), '/damage-calculator/?tag=8PJYGUJC&tab=cluster-planner');
            assert.equal(buildSpotrightUrl('damagecalc', { hash: 'custom-anchor' }), '/damage-calculator/?tag=8PJYGUJC#custom-anchor');

            const reg = buildSpotrightRegistry();
            const hubItem = reg.find(i => i.id === 'page-hub');
            assert.ok(hubItem);
            hubItem.execute();
            assert.equal(globalThis.window.location.href, '/?tag=8PJYGUJC');
        } finally {
            globalThis.window = originalWindow;
        }
    });

    test('action-settings triggers header account popover directly without navigation', () => {
        const originalDocument = globalThis.document;
        const originalWindow = globalThis.window;
        try {
            let accountBtnClicked = false;
            const fakePrefs = { open: false };
            const fakeAccountBtn = {
                click: () => { accountBtnClicked = true; }
            };
            globalThis.document = /** @type {any} */ ({
                getElementById: (id) => {
                    if (id === 'header-account-btn') return fakeAccountBtn;
                    if (id === 'account-popover-prefs-details') return fakePrefs;
                    return null;
                }
            });
            globalThis.window = /** @type {any} */ ({
                location: { pathname: '/ore-calculator/', search: '' }
            });
            const reg = buildSpotrightRegistry();
            const settingsItem = reg.find(i => i.id === 'action-settings');
            assert.ok(settingsItem);
            settingsItem.execute();
            assert.equal(accountBtnClicked, true);
            assert.equal(fakePrefs.open, true);
        } finally {
            globalThis.document = originalDocument;
            globalThis.window = originalWindow;
        }
    });

    test('action-manage-villages triggers player-dropdown-button on non-landing pages', async () => {
        const originalDocument = globalThis.document;
        const originalWindow = globalThis.window;
        try {
            let dropdownClicked = false;
            const fakeDropdownBtn = {
                click: () => { dropdownClicked = true; }
            };
            globalThis.document = /** @type {any} */ ({
                getElementById: (id) => {
                    if (id === 'player-dropdown-button') return fakeDropdownBtn;
                    return null;
                }
            });
            globalThis.window = /** @type {any} */ ({
                location: { pathname: '/ore-calculator/', search: '' }
            });
            const reg = buildSpotrightRegistry();
            const playerItem = reg.find(i => i.id === 'action-manage-villages');
            assert.ok(playerItem);
            await playerItem.execute();
            assert.equal(dropdownClicked, true);
        } finally {
            globalThis.document = originalDocument;
            globalThis.window = originalWindow;
        }
    });

    test('modal-account-sync opens header account popover when signed in and auth-modal when logged out', async () => {
        const originalDocument = globalThis.document;
        const originalWindow = globalThis.window;
        const originalLocalStorage = globalThis.localStorage;
        try {
            let accountBtnClicked = false;
            let authModalOpened = false;
            const fakePrefs = { open: true };
            const fakeAccountBtn = {
                classList: { contains: () => false },
                click: () => { accountBtnClicked = true; }
            };
            const fakeAuthModal = {
                open: false,
                classList: { add: () => {}, remove: () => {}, contains: () => false },
                showModal: () => { authModalOpened = true; },
                querySelector: () => null,
                querySelectorAll: () => [],
                addEventListener: () => {}
            };
            const store = new Map();
            globalThis.localStorage = /** @type {any} */ ({
                getItem: (k) => store.get(k) || null,
                setItem: (k, v) => store.set(k, String(v)),
                removeItem: (k) => store.delete(k)
            });
            globalThis.document = /** @type {any} */ ({
                getElementById: (id) => {
                    if (id === 'header-account-btn') return fakeAccountBtn;
                    if (id === 'account-popover-prefs-details') return fakePrefs;
                    if (id === 'auth-modal') return fakeAuthModal;
                    return null;
                },
                querySelectorAll: () => []
            });
            globalThis.window = /** @type {any} */ ({
                location: { pathname: '/ore-calculator/', search: '' }
            });

            const reg = buildSpotrightRegistry();
            const syncItem = reg.find(i => i.id === 'modal-account-sync');
            assert.ok(syncItem);

            await syncItem.execute();
            assert.equal(accountBtnClicked, false);
            assert.equal(authModalOpened, true);

            authModalOpened = false;
            store.set('clashCalc_authToken', 'mock-token');
            store.set('clashCalc_username', 'Chief');
            await syncItem.execute();
            assert.equal(accountBtnClicked, true);
            assert.equal(fakePrefs.open, false);
            assert.equal(authModalOpened, false);
        } finally {
            globalThis.document = originalDocument;
            globalThis.window = originalWindow;
            globalThis.localStorage = originalLocalStorage;
        }
    });
});
