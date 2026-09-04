import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { heroJourneyNodes, oreChestRewardsNormal, oreChestRewardsAccelerated, heroMaxLevelsPerTH } from '../../js/data/heroJourneyData.js';
import { getMaxCumulativeLevelsByTH, getNodeTownHallLevel } from '../../js/domain/income/heroJourneyLevels.js';
import { getQuestChestReward } from '../../js/domain/income/heroJourneyIncome.js';

if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, val) => store.set(key, String(val)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
        key: (index) => Array.from(store.keys())[index] ?? null,
        get length() { return store.size; }
    };
}

describe('Standalone Hero Journey Data & Domain Contract Suite', () => {
    test('verifies heroJourneyNodes are properly ordered by level and contain required schema fields', () => {
        assert.ok(Array.isArray(heroJourneyNodes));
        assert.ok(heroJourneyNodes.length > 50, 'Track should have over 50 milestone nodes');

        let prevLevel = 0;
        for (const node of heroJourneyNodes) {
            assert.ok(typeof node.level === 'number', 'Node level must be numeric');
            assert.ok(node.level >= prevLevel, 'Nodes must be sorted by level');
            assert.ok(typeof node.type === 'string', 'Node type must be a string');
            assert.ok(['quest', 'ore', 'magicItem', 'resource', 'equipment', 'skin'].includes(node.type), `Unexpected type: ${node.type}`);
            prevLevel = node.level;
        }
    });

    test('verifies getNodeTownHallLevel maps levels to correct Town Hall thresholds', () => {
        assert.equal(getNodeTownHallLevel(2), 7);
        assert.equal(getNodeTownHallLevel(10), 7);
        assert.equal(getNodeTownHallLevel(11), 8);
        assert.equal(getNodeTownHallLevel(30), 8);
        assert.equal(getNodeTownHallLevel(31), 9);
        assert.equal(getNodeTownHallLevel(70), 9);
        assert.equal(getNodeTownHallLevel(71), 10);
        assert.equal(getNodeTownHallLevel(150), 11);
        assert.equal(getNodeTownHallLevel(151), 12);
        assert.equal(getNodeTownHallLevel(250), 13);
        assert.equal(getNodeTownHallLevel(350), 15);
    });

    test('verifies oreChestRewardsNormal and oreChestRewardsAccelerated cover TH8 through TH18', () => {
        for (let th = 8; th <= 18; th++) {
            assert.ok(oreChestRewardsNormal[th], `Normal rewards should exist for TH${th}`);
            assert.ok(oreChestRewardsAccelerated[th], `Accelerated rewards should exist for TH${th}`);

            const normal = oreChestRewardsNormal[th];
            const accelerated = oreChestRewardsAccelerated[th];

            assert.ok(normal.shiny.avg > 0, 'Normal shiny avg should be > 0');
            assert.ok(normal.glowy.avg > 0, 'Normal glowy avg should be > 0');
            assert.ok(normal.starry.avg > 0, 'Normal starry avg should be > 0');

            assert.ok(accelerated.shiny.avg >= normal.shiny.avg, 'Accelerated shiny should be >= normal');
            assert.ok(accelerated.glowy.avg >= normal.glowy.avg, 'Accelerated glowy should be >= normal');
        }
    });

    test('verifies getQuestChestReward returns non-zero reward objects for normal and accelerated modes', () => {
        const rewardNormal = getQuestChestReward(16, false);
        assert.ok(rewardNormal.shiny >= 1000);
        assert.ok(rewardNormal.glowy >= 50);
        assert.ok(rewardNormal.starry >= 20);

        const rewardAccelerated = getQuestChestReward(16, true);
        assert.ok(rewardAccelerated.shiny >= rewardNormal.shiny);
        assert.ok(rewardAccelerated.glowy >= rewardNormal.glowy);
        assert.ok(rewardAccelerated.starry >= rewardNormal.starry);
    });

    test('verifies getMaxCumulativeLevelsByTH generates strictly monotonically increasing caps', () => {
        const maxLevels = getMaxCumulativeLevelsByTH();
        let lastCap = 0;
        for (let th = 8; th <= 18; th++) {
            assert.ok(maxLevels[th] > lastCap, `TH${th} cap (${maxLevels[th]}) should be greater than TH${th - 1} cap (${lastCap})`);
            lastCap = maxLevels[th];
        }
    });

    test('verifies every heroJourneyNode resolves valid display metadata without throwing errors or undefined properties', async () => {
        const { heroData } = await import('../../js/data/heroData.js');

        for (const node of heroJourneyNodes) {
            assert.ok(typeof node.level === 'number', 'Node level must be numeric');
            assert.ok(typeof node.type === 'string', 'Node type must be a string');

            if (node.type === 'ore') {
                const resourceType = node.resourceType || node.oreType;
                assert.ok(resourceType, `Ore node at level ${node.level} must have resourceType`);
                assert.ok(['shiny', 'glowy', 'starry'].includes(resourceType), `Invalid ore resourceType: ${resourceType}`);
                assert.ok(typeof node.amount === 'number' && node.amount > 0, 'Ore amount must be positive');
            } else if (node.type === 'resource') {
                assert.ok(node.resourceType, `Resource node at level ${node.level} must have resourceType`);
                assert.ok(typeof node.amount === 'number' && node.amount > 0, 'Resource amount must be positive');
            } else if (node.type === 'magicItem') {
                assert.ok(node.itemKey, `Magic item node at level ${node.level} must have itemKey`);
            } else if (node.type === 'equipment') {
                if (node.hero) {
                    assert.ok(heroData[node.hero], `Equipment node at level ${node.level} specifies unknown hero: ${node.hero}`);
                }
            } else if (node.type === 'quest') {
                if (node.hero) {
                    assert.ok(heroData[node.hero], `Quest node at level ${node.level} specifies unknown hero: ${node.hero}`);
                }
            }
        }
    });

    test('verifies hero-journey.html static image assets exist in the project directory', async () => {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const html = fs.readFileSync(path.join(process.cwd(), 'hero-journey.html'), 'utf8');

        const srcMatches = [...html.matchAll(/src="([^"?]+)(?:\?[^"]*)?"/g)].map(m => m[1]);
        for (const src of srcMatches) {
            if (src.startsWith('http') || src.endsWith('.js')) continue;
            const cleanSrc = src.startsWith('/') ? src.substring(1) : src;
            const fullPath = path.join(process.cwd(), cleanSrc);
            assert.ok(fs.existsSync(fullPath), `Asset in hero-journey.html does not exist on disk: ${src} -> ${fullPath}`);
        }
    });

    test('verifies translation keys for saved profiles exist in en.json and de.json', async () => {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const en = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'js/i18n/en.json'), 'utf8'));
        const de = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'js/i18n/de.json'), 'utf8'));

        assert.ok(en.views?.heroJourneyPage?.savedProfiles, 'en.json must have views.heroJourneyPage.savedProfiles');
        assert.ok(en.views?.heroJourneyPage?.noSavedProfiles, 'en.json must have views.heroJourneyPage.noSavedProfiles');
        assert.ok(de.views?.heroJourneyPage?.savedProfiles, 'de.json must have views.heroJourneyPage.savedProfiles');
        assert.ok(de.views?.heroJourneyPage?.noSavedProfiles, 'de.json must have views.heroJourneyPage.noSavedProfiles');
    });

    test('verifies getCurrentSettings returns sanitized defaults when storage is empty', async () => {
        const { getCurrentSettings } = await import('../../js/components/heroJourney/heroJourneySettings.js');
        const settings = getCurrentSettings();
        assert.ok(settings, 'getCurrentSettings must return an object');
        assert.ok(['dark', 'light'].includes(settings.theme), 'theme must be dark or light');
        assert.ok(typeof settings.accentColor === 'string', 'accentColor must be a string');
        assert.ok(typeof settings.language === 'string', 'language must be a string');
    });

    test('verifies calculateHeroJourneyUpcomingOres correctly handles TH8 player with 0 heroes', async () => {
        const { calculateHeroJourneyUpcomingOres } = await import('../../js/domain/income/heroJourneyIncome.js');
        const { buildStateFromPlayerData } = await import('../../js/components/heroJourney/heroJourneyState.js');

        const th8ZeroHeroPlayer = {
            tag: '#2PP',
            name: 'Morgil',
            townHallLevel: 8,
            heroes: [],
            heroEquipment: []
        };

        const state = buildStateFromPlayerData(th8ZeroHeroPlayer, { isAccelerated: false });
        const upcoming = calculateHeroJourneyUpcomingOres(state);

        assert.ok(upcoming.shiny > 0, 'TH8 player should have unclaimed shiny ore');
        assert.ok(upcoming.glowy > 0, 'TH8 player should have unclaimed glowy ore');
        assert.ok(upcoming.starry > 0, 'TH8 player should have unclaimed starry ore');
    });

    test('verifies syncPlayerToStorage updates heroJourney partition and records recent searches without modifying player tags', async () => {
        const { syncPlayerToStorage, buildStateFromPlayerData } = await import('../../js/components/heroJourney/heroJourneyState.js');
        const { PLAYER_TAGS_KEY, PLAYER_PREFIX } = await import('../../js/core/localStorageManager.js');
        const { getRecentSearches } = await import('../../js/core/recentSearchesManager.js');

        const mockPlayer = {
            tag: '#TESTSYNC1',
            name: 'SyncMaster',
            townHallLevel: 16,
            heroes: [{ name: 'Barbarian King', level: 95 }],
            heroEquipment: [{ name: 'Giant Gauntlet', level: 27 }]
        };

        const mockState = {
            isAccelerated: true,
            revealBeyondTH: true,
            typeFilter: 'quest',
            unclaimedOnly: true
        };

        syncPlayerToStorage(mockPlayer, mockState);

        const partitionStr = localStorage.getItem(`${PLAYER_PREFIX}TESTSYNC1`);
        assert.ok(partitionStr, 'Player partition must be written to localStorage');
        const partition = JSON.parse(partitionStr);
        assert.strictEqual(partition.heroJourney.acceleratedRewards, true);
        assert.strictEqual(partition.heroJourney.revealBeyondTH, true);
        assert.strictEqual(partition.heroJourney.unclaimedOnly, undefined);

        // Verify permanent player tags in main app were NOT modified
        const tags = localStorage.getItem(PLAYER_TAGS_KEY);
        assert.strictEqual(tags, null, 'Ephemeral journey lookup must not pollute PLAYER_TAGS_KEY');

        // Verify recent searches recorded the lookup
        const recents = getRecentSearches();
        assert.ok(recents.some(r => r.cleanTag === 'TESTSYNC1'), 'Lookup must be recorded in recent searches');

        const stateSlice = buildStateFromPlayerData(mockPlayer, mockState);
        assert.strictEqual(stateSlice.heroJourney.acceleratedRewards, true);

        // Cleanup
        localStorage.removeItem(`${PLAYER_PREFIX}TESTSYNC1`);
    });

    test('verifies getTagFromUrl and updateUrlTag clean leading hashes and prevent %23 in URL', async () => {
        const { getTagFromUrl, updateUrlTag } = await import('../../js/components/heroJourney/heroJourneyState.js');

        const originalWindow = globalThis.window;
        try {
            // Test getTagFromUrl stripping leading hashes
            globalThis.window = {
                location: {
                    search: '?tag=%238PJYGUJC',
                    hash: ''
                }
            };
            assert.equal(getTagFromUrl(), '8PJYGUJC');

            globalThis.window.location.search = '?tag=##TESTTAG1';
            assert.equal(getTagFromUrl(), 'TESTTAG1');

            // Test updateUrlTag sets clean tag without %23
            let replacedUrl = '';
            globalThis.window = {
                location: {
                    href: 'https://orecalc.tech/hero-journey?tag=%238PJYGUJC',
                    pathname: '/hero-journey',
                    search: '?tag=%238PJYGUJC',
                    hash: ''
                },
                history: {
                    replaceState: (_state, _title, url) => {
                        replacedUrl = url;
                    }
                }
            };

            updateUrlTag('#8PJYGUJC');
            assert.equal(replacedUrl, '/hero-journey/?tag=8PJYGUJC');
            assert.ok(!replacedUrl.includes('%23'), 'URL must not contain %23');
        } finally {
            globalThis.window = originalWindow;
        }
    });

    test('verifies standalone dropdown partitions active non-saved player at the top', async () => {
        const { getSavedProfiles } = await import('../../js/components/heroJourney/heroJourneyState.js');
        const { PLAYER_TAGS_KEY } = await import('../../js/core/localStorageManager.js');
        const { getRecentSearches, RECENT_SEARCHES_KEY } = await import('../../js/core/recentSearchesManager.js');

        // Setup saved profiles and recent searches
        localStorage.setItem(PLAYER_TAGS_KEY, JSON.stringify(['#SAVED1', '#SAVED2']));
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([
            { tag: '#R2J0LUYP9', cleanTag: 'R2J0LUYP9', name: 'Active NonSaved', townHallLevel: 17, timestamp: Date.now() },
            { tag: '#OTHERREC', cleanTag: 'OTHERREC', name: 'Other Recent', townHallLevel: 15, timestamp: Date.now() }
        ]));

        const saved = getSavedProfiles();
        assert.equal(saved.length, 2);

        const recents = getRecentSearches();
        assert.equal(recents.length, 2);

        const cleanSavedSet = new Set(saved.map(p => p.cleanTag));
        assert.equal(cleanSavedSet.has('R2J0LUYP9'), false, 'Active non-saved player must not be in saved set');

        // Cleanup
        localStorage.removeItem(PLAYER_TAGS_KEY);
        localStorage.removeItem(RECENT_SEARCHES_KEY);
    });

    test('verifies dismiss X on inactive recent search removes item while preserving active tag', async () => {
        const { removeRecentSearch, getRecentSearches, RECENT_SEARCHES_KEY } = await import('../../js/core/recentSearchesManager.js');

        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([
            { tag: '#ACTIVE1', cleanTag: 'ACTIVE1', name: 'Active Player', townHallLevel: 17 },
            { tag: '#INACTIVE1', cleanTag: 'INACTIVE1', name: 'Inactive Player', townHallLevel: 15 }
        ]));

        removeRecentSearch('INACTIVE1');

        const remaining = getRecentSearches();
        assert.equal(remaining.length, 1);
        assert.equal(remaining[0].cleanTag, 'ACTIVE1');

        // Cleanup
        localStorage.removeItem(RECENT_SEARCHES_KEY);
    });

    test('verifies dismiss X on active player purges storage and removes ?tag= from URL', async () => {
        const { getPlayerStorageKey } = await import('../../js/core/localStorageManager.js');
        const { removeRecentSearch, getRecentSearches, RECENT_SEARCHES_KEY } = await import('../../js/core/recentSearchesManager.js');
        const { updateUrlTag } = await import('../../js/components/heroJourney/heroJourneyState.js');

        const testTag = 'ACTIVEPURGE1';
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([
            { tag: `#${testTag}`, cleanTag: testTag, name: 'Active Purge', townHallLevel: 16 }
        ]));
        localStorage.setItem(getPlayerStorageKey(testTag), JSON.stringify({ playerProfile: { name: 'Active Purge' } }));

        let replacedUrl = '';
        const originalWindow = globalThis.window;
        try {
            globalThis.window = {
                location: {
                    href: `https://orecalc.tech/hero-journey/?tag=${testTag}`,
                    pathname: '/hero-journey/',
                    search: `?tag=${testTag}`,
                    hash: ''
                },
                history: {
                    replaceState: (_state, _title, url) => {
                        replacedUrl = url;
                    }
                }
            };

            // Dismiss active player
            removeRecentSearch(testTag);
            localStorage.removeItem(getPlayerStorageKey(testTag));
            updateUrlTag(null);

            assert.equal(getRecentSearches().length, 0, 'Recent searches must be empty after dismissing active');
            assert.equal(localStorage.getItem(getPlayerStorageKey(testTag)), null, 'Ephemeral partition must be deleted');
            assert.equal(replacedUrl, '/hero-journey/', 'URL must have ?tag= removed and retain trailing slash');
        } finally {
            globalThis.window = originalWindow;
            localStorage.removeItem(RECENT_SEARCHES_KEY);
            localStorage.removeItem(getPlayerStorageKey(testTag));
        }
    });

    test('verifies apiErrors.invalidTag exists in en.json and de.json', async () => {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const en = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'js/i18n/en.json'), 'utf8'));
        const de = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'js/i18n/de.json'), 'utf8'));

        assert.ok(en.apiErrors?.invalidTag, 'en.json must define apiErrors.invalidTag');
        assert.ok(de.apiErrors?.invalidTag, 'de.json must define apiErrors.invalidTag');
        assert.match(en.apiErrors.invalidTag, /Invalid player tag/i);
        assert.match(de.apiErrors.invalidTag, /Ungültiges Spieler-Kürzel/i);
    });

    test('verifies renderHeroJourneyDropdownMarkup generates accessible markup with collapsible header and ARIA semantics', async () => {
        const { renderHeroJourneyDropdownMarkup } = await import('../../js/components/heroJourney/heroJourneyHeaderDisplay.js');

        const savedProfiles = [
            { tag: '#ABC1234', cleanTag: 'ABC1234', name: 'Alpha Chief', townHallLevel: 16 }
        ];
        const recentSearches = [
            { tag: '#XYZ5678', cleanTag: 'XYZ5678', name: 'Beta Raider', townHallLevel: 15 }
        ];

        const html = renderHeroJourneyDropdownMarkup({
            savedProfiles,
            recentSearches,
            activeCleanTag: 'ABC1234',
            isFiltering: false,
            cleanQuery: '',
            activeDropdownIndex: 0,
            isJourneyRecentCollapsed: false
        });

        assert.ok(html.includes('class="hj-dropdown-item'), 'Dropdown markup must include item entries');
        assert.ok(html.includes('id="hj-dropdown-item-0"'), 'Dropdown items must have id attribute');
        assert.ok(html.includes('role="option"'), 'Dropdown items must have role="option"');
        assert.ok(html.includes('aria-selected="true"'), 'Active item must have aria-selected="true"');
        assert.ok(html.includes('hj-dropdown-header--collapsible'), 'Dropdown markup must include collapsible header');
        assert.ok(html.includes('role="button"'), 'Collapsible header must have role="button"');
        assert.ok(html.includes('aria-expanded="true"'), 'Collapsible header must reflect expanded state');
    });

    test('verifies workbox-config.js completely decouples hero-journey from Service Worker caching', async () => {
        const { default: workboxConfig } = await import('../../workbox-config.js');

        assert.ok(Array.isArray(workboxConfig.globIgnores), 'workbox-config.js must define globIgnores array');
        assert.ok(workboxConfig.globIgnores.includes('**/hero-journey/**'), 'workbox-config.js must exclude **/hero-journey/** from precache manifest');
        assert.ok(workboxConfig.globIgnores.includes('**/js/heroJourneyApp.js'), 'workbox-config.js must exclude **/js/heroJourneyApp.js from precache manifest');
    });

    test('verifies updateHeaderLoadButton transitions correctly between focused, active player TH badge, and disabled states', async () => {
        const { updateHeaderLoadButton } = await import('../../js/components/heroJourney/heroJourneyHeaderInputs.js');
        const { hjState } = await import('../../js/components/heroJourney/heroJourneyState.js');

        const mockElements = new Map();
        const createElement = (tag, id, className = '') => {
            const el = {
                tagName: tag.toUpperCase(),
                id,
                className,
                classList: {
                    _classes: new Set(className.split(' ').filter(Boolean)),
                    add(...tokens) { tokens.forEach(t => this._classes.add(t)); },
                    remove(...tokens) { tokens.forEach(t => this._classes.delete(t)); },
                    contains(token) { return this._classes.has(token); },
                    toggle(token, force) {
                        if (force !== undefined) {
                            if (force) this._classes.add(token);
                            else this._classes.delete(token);
                            return force;
                        }
                        if (this._classes.has(token)) {
                            this._classes.delete(token);
                            return false;
                        }
                        this._classes.add(token);
                        return true;
                    }
                },
                style: {},
                disabled: false,
                attributes: new Map(),
                setAttribute(k, v) { this.attributes.set(k, String(v)); },
                getAttribute(k) { return this.attributes.get(k); }
            };
            mockElements.set(id, el);
            return el;
        };

        const loadBtn = createElement('button', 'hj-load-btn');
        const loadBtnText = createElement('span', 'hj-load-btn-text');
        const loadBtnTh = createElement('orecalc-assets-image', 'hj-load-btn-th');
        const searchInput = createElement('input', 'hj-search-input');

        const origDoc = globalThis.document;
        globalThis.document = {
            getElementById: (id) => mockElements.get(id) || null,
            querySelector: (sel) => {
                if (sel === '.hj-track-btn') return loadBtn;
                return null;
            },
            activeElement: null
        };

        try {
            // Case 1: Unfocused & No active player -> disabled Load button
            hjState.playerData = null;
            hjState.thLevel = 16;
            updateHeaderLoadButton(false);
            assert.strictEqual(loadBtn.disabled, true);
            assert.strictEqual(loadBtn.classList.contains('has-th-badge'), false);
            assert.strictEqual(loadBtnText.style.display, '');
            assert.strictEqual(loadBtnTh.style.display, 'none');

            // Case 2: Focused input -> enabled Load button
            updateHeaderLoadButton(true);
            assert.strictEqual(loadBtn.disabled, false);
            assert.strictEqual(loadBtn.classList.contains('has-th-badge'), false);
            assert.strictEqual(loadBtnText.style.display, '');
            assert.strictEqual(loadBtnTh.style.display, 'none');

            // Case 3: Unfocused with active player -> enabled TH badge button
            hjState.playerData = { name: 'Champion', townHallLevel: 17 };
            hjState.thLevel = 17;
            updateHeaderLoadButton(false);
            assert.strictEqual(loadBtn.disabled, false, 'TH badge button must be enabled and clickable');
            assert.strictEqual(loadBtn.classList.contains('has-th-badge'), true);
            assert.strictEqual(loadBtnText.style.display, 'none');
            assert.strictEqual(loadBtnTh.style.display, 'block');
            assert.strictEqual(loadBtnTh.getAttribute('src'), 'assets/th/th17.png');

            // Case 4: Defensive TH level clamping for boundary values (TH0 -> TH1, TH99 -> TH18)
            hjState.playerData = { name: 'LowTH', townHallLevel: 0 };
            hjState.thLevel = 0;
            updateHeaderLoadButton(false);
            assert.strictEqual(loadBtnTh.getAttribute('src'), 'assets/th/th1.png');

            hjState.playerData = { name: 'HighTH', townHallLevel: 99 };
            hjState.thLevel = 99;
            updateHeaderLoadButton(false);
            assert.strictEqual(loadBtnTh.getAttribute('src'), 'assets/th/th18.png');
        } finally {
            globalThis.document = origDoc;
            hjState.playerData = null;
            hjState.thLevel = 18;
        }
    });

    test('verifies _headers enforces 6-month static asset caching and zero-stale dynamic revalidation', async () => {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const headersFile = fs.readFileSync(path.join(process.cwd(), '_headers'), 'utf8');

        assert.match(headersFile, /\/assets\/\*[\s\S]*?Cache-Control:\s*public,\s*max-age=15552000,\s*immutable/, '_headers must set 6-month immutable cache for /assets/*');
        assert.match(headersFile, /\/\*\.html[\s\S]*?Cache-Control:\s*public,\s*max-age=0,\s*must-revalidate/, '_headers must revalidate HTML fresh');
        assert.match(headersFile, /\/service-worker\.js[\s\S]*?Cache-Control:\s*no-cache,\s*no-store,\s*must-revalidate/, '_headers must prevent caching service-worker.js');
    });
});
