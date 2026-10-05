import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { heroJourneyNodes, oreChestRewardsNormal, oreChestRewardsAccelerated } from '../../js/data/heroJourneyData.js';
import { getMaxCumulativeLevelsByTH, getNodeTownHallLevel, isTrueMaxCumulativeLevel } from '../../js/domain/income/heroJourneyLevels.js';
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

    test('verifies hero-journey/index.html static image assets exist in the project directory', async () => {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const html = fs.readFileSync(path.join(process.cwd(), 'hero-journey/index.html'), 'utf8');

        const srcMatches = [...html.matchAll(/src="([^"?]+)(?:\?[^"]*)?"/g)].map(m => m[1]);
        for (const src of srcMatches) {
            if (src.startsWith('http') || src.endsWith('.js')) continue;
            const cleanSrc = src.startsWith('/') ? src.substring(1) : src;
            const fullPath = path.join(process.cwd(), cleanSrc);
            assert.ok(fs.existsSync(fullPath), `Asset in hero-journey/index.html does not exist on disk: ${src} -> ${fullPath}`);
        }
    });

    test('verifies translation keys for saved profiles exist in en.json and de.json', async () => {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const en = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'js/i18n/en.json'), 'utf8'));
        const de = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'js/i18n/de.json'), 'utf8'));

        assert.ok(en.player?.savedProfiles, 'en.json must have player.savedProfiles');
        assert.ok(de.player?.savedProfiles, 'de.json must have player.savedProfiles');
    });

    test('verifies getAppSettings returns sanitized defaults when storage is empty', async () => {
        const { getAppSettings } = await import('../../js/components/common/appSettings.js');
        const settings = getAppSettings();
        assert.ok(settings, 'getAppSettings must return an object');
        assert.ok(['dark', 'light'].includes(settings.theme), 'theme must be dark or light');
        assert.ok(typeof settings.accentColor === 'string', 'accentColor must be a string');
        assert.ok(typeof settings.language === 'string', 'language must be a string');
    });

    test('verifies calculateHeroJourneyUpcomingOres correctly handles TH8 player with 0 heroes', async () => {
        const { calculateHeroJourneyUpcomingOres } = await import('../../js/domain/income/heroJourneyIncome.js');
        const { buildStateFromPlayerData } = await import('../../js/components/heroJourney/heroJourneyState.js');

        const th8ZeroHeroPlayer = {
            tag: '#8PJYGUJC',
            name: 'Chief',
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

    test('verifies syncPlayerToStorage updates heroJourney partition and creates saved profile immediately', async () => {
        const { syncPlayerToStorage, buildStateFromPlayerData } = await import('../../js/components/heroJourney/heroJourneyState.js');
        const { PLAYER_TAGS_KEY, getPlayerStorageKey } = await import('../../js/core/storageKeys.js');

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

        const storageKey = getPlayerStorageKey('TESTSYNC1');
        const partitionStr = localStorage.getItem(storageKey);
        assert.ok(partitionStr, 'Player partition must be written to localStorage');
        const partition = JSON.parse(partitionStr);
        assert.strictEqual(partition.heroJourney.acceleratedRewards, true);
        assert.strictEqual(partition.heroJourney.revealBeyondTH, true);
        assert.strictEqual(partition.heroJourney.unclaimedOnly, undefined);

        // Verify permanent player tags in main app were updated with saved profile
        const tagsStr = localStorage.getItem(PLAYER_TAGS_KEY);
        assert.ok(tagsStr, 'PLAYER_TAGS_KEY must be created in storage');
        const tags = JSON.parse(tagsStr);
        assert.ok(Array.isArray(tags) && tags.includes('TESTSYNC1'), 'Player tag must be persisted to saved profiles');

        const stateSlice = buildStateFromPlayerData(mockPlayer, mockState);
        assert.strictEqual(stateSlice.heroJourney.acceleratedRewards, true);

        // Cleanup
        localStorage.removeItem(storageKey);
        localStorage.removeItem(PLAYER_TAGS_KEY);
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

            globalThis.window.location = {
                search: '',
                hash: '#hero-journey-table'
            };
            assert.equal(getTagFromUrl(), '', 'Anchor hashes must not be treated as player tags');

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

    test('verifies renderHeroJourneyDropdownMarkup generates standardized player dropdown markup with ARIA semantics', async () => {
        const { renderHeroJourneyDropdownMarkup } = await import('../../js/components/heroJourney/heroJourneyHeaderDisplay.js');

        const savedProfiles = [
            { tag: '#ABC1234', cleanTag: 'ABC1234', name: 'Alpha Chief', townHallLevel: 16 },
            { tag: '#XYZ5678', cleanTag: 'XYZ5678', name: 'Beta Raider', townHallLevel: 15 }
        ];

        const html = renderHeroJourneyDropdownMarkup({
            savedProfiles,
            activeCleanTag: 'ABC1234'
        });

        assert.ok(html.includes('class="player-dropdown-item active is-active"'), 'Dropdown markup must include active item entry');
        assert.ok(html.includes('id="hj-dropdown-item-0"'), 'Dropdown items must have indexed id attribute');
        assert.ok(html.includes('role="option"'), 'Dropdown items must have role="option"');
        assert.ok(html.includes('aria-selected="true"'), 'Active item must have aria-selected="true"');
        assert.ok(html.includes('player-dropdown-section-header'), 'Dropdown markup must include section header');
        assert.ok(html.includes('delete-player-button'), 'Dropdown markup must include delete player button');
    });

    test('verifies renderHeroJourneyPlayerDropdown updates selected player and container markup', async () => {
        const { renderHeroJourneyPlayerDropdown } = await import('../../js/components/heroJourney/heroJourneyHeaderDisplay.js');
        const { initHeroJourneyAddPlayerModal } = await import('../../js/components/heroJourney/heroJourneyHeaderInputs.js');
        const { hjState } = await import('../../js/components/heroJourney/heroJourneyState.js');

        const mockElements = new Map();
        const createElement = (tag, id, className = '') => {
            const listeners = new Map();
            const el = {
                tagName: tag.toUpperCase(),
                id,
                className,
                textContent: '',
                innerHTML: '',
                value: '',
                classList: {
                    _classes: new Set(className.split(' ').filter(Boolean)),
                    add(...tokens) { tokens.forEach(t => this._classes.add(t)); },
                    remove(...tokens) { tokens.forEach(t => this._classes.delete(t)); },
                    contains(token) { return this._classes.has(token); }
                },
                style: {},
                disabled: false,
                open: false,
                showModal() { this.open = true; },
                close() { this.open = false; },
                focus() {},
                addEventListener(event, fn) {
                    if (!listeners.has(event)) listeners.set(event, []);
                    listeners.get(event).push(fn);
                },
                removeEventListener(event, fn) {
                    if (!listeners.has(event)) return;
                    listeners.set(event, listeners.get(event).filter(cb => cb !== fn));
                },
                hasAttribute() { return false; },
                getAttribute() { return null; },
                setAttribute() {},
                removeAttribute() {},
                querySelectorAll() { return []; },
                querySelector() { return null; },
                dispatchEvent(event) {
                    const type = typeof event === 'string' ? event : event?.type;
                    const cbs = listeners.get(type) || [];
                    cbs.forEach(cb => cb(event));
                    return true;
                }
            };
            mockElements.set(id, el);
            return el;
        };

        const selectedName = createElement('span', 'selected-player-name');
        createElement('div', 'player-items-container');
        const addPlayerModal = createElement('dialog', 'add-player-modal');
        const playerTagInput = createElement('input', 'player-tag-input-modal');
        createElement('button', 'load-player-modal-btn');
        createElement('button', 'cancel-add-player-button');
        createElement('button', 'close-add-player-modal-btn');
        const playerTagError = createElement('div', 'player-tag-error-message');

        const origDoc = globalThis.document;
        globalThis.document = {
            getElementById: (id) => mockElements.get(id) || null,
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener: () => {},
            removeEventListener: () => {},
            body: {
                classList: {
                    add() {},
                    remove() {},
                    contains() { return false; }
                }
            },
            activeElement: null
        };

        try {
            // Case 1: Active player with profile data
            hjState.activeTag = '8PJYGUJC';
            hjState.playerData = { name: 'Chief', townHallLevel: 17 };
            renderHeroJourneyPlayerDropdown('8PJYGUJC');
            assert.strictEqual(selectedName.textContent, 'Chief');

            // Case 2: Guest / no active tag
            hjState.activeTag = '';
            hjState.playerData = null;
            renderHeroJourneyPlayerDropdown('');
            assert.ok(selectedName.textContent.length > 0);

            // Case 3: Modal controller initialization & open/close cycle
            const modalControls = initHeroJourneyAddPlayerModal({ onLoadPlayer: () => {} });
            assert.strictEqual(typeof modalControls.openAddPlayerModal, 'function');
            assert.strictEqual(typeof modalControls.closeAddPlayerModal, 'function');

            modalControls.openAddPlayerModal();
            assert.strictEqual(addPlayerModal.open, true);
            assert.strictEqual(addPlayerModal.classList.contains('show'), true);

            // Case 4: Invalid character input ("H") must display error and keep .show class
            playerTagInput.value = 'H';
            playerTagInput.dispatchEvent({ type: 'input', target: playerTagInput });
            assert.ok(playerTagError.textContent.length > 0, 'Error message must be populated on invalid character');
            assert.ok(playerTagError.textContent.includes('H') || playerTagError.textContent.includes('errors.invalidChar'), 'Error message must mention invalid character H or error key');
            assert.strictEqual(playerTagError.classList.contains('show'), true, 'Error message element must retain .show class');
            assert.strictEqual(playerTagInput.classList.contains('input-error'), true, 'Input element must have .input-error class');

            // Case 5: Valid character input clears error
            playerTagInput.value = '8PJYGUJC';
            playerTagInput.dispatchEvent({ type: 'input', target: playerTagInput });
            assert.strictEqual(playerTagError.textContent, '', 'Error message must clear on valid tag input');
            assert.strictEqual(playerTagError.classList.contains('show'), false, 'Error message element must not have .show class');
            assert.strictEqual(playerTagInput.classList.contains('input-error'), false, 'Input element must remove .input-error class');

            modalControls.closeAddPlayerModal();
            assert.strictEqual(addPlayerModal.classList.contains('closing'), true);
            await new Promise(r => setTimeout(r, 250));
            assert.strictEqual(addPlayerModal.open, false);
        } finally {
            globalThis.document = origDoc;
            hjState.activeTag = '';
            hjState.playerData = null;
        }
    });

    test('verifies initHeroJourneyPlayerDropdown supports hover, focus, and scroll dismissal', async () => {
        const { initHeroJourneyPlayerDropdown } = await import('../../js/components/heroJourney/heroJourneyHeaderInputs.js');

        const mockElements = new Map();
        const createElement = (tag, id, className = '') => {
            const listeners = new Map();
            const el = {
                tagName: tag.toUpperCase(),
                id,
                className,
                textContent: '',
                innerHTML: '',
                value: '',
                classList: {
                    _classes: new Set(className.split(' ').filter(Boolean)),
                    add(...tokens) { tokens.forEach(t => this._classes.add(t)); },
                    remove(...tokens) { tokens.forEach(t => this._classes.delete(t)); },
                    contains(token) { return this._classes.has(token); }
                },
                style: {},
                addEventListener(event, fn) {
                    if (!listeners.has(event)) listeners.set(event, []);
                    listeners.get(event).push(fn);
                },
                removeEventListener(event, fn) {
                    if (!listeners.has(event)) return;
                    listeners.set(event, listeners.get(event).filter(cb => cb !== fn));
                },
                dispatchEvent(event) {
                    const fns = listeners.get(event.type) || [];
                    fns.forEach(fn => fn(event));
                },
                querySelector(sel) {
                    if (sel === '.dropdown-arrow') return arrow;
                    return null;
                },
                querySelectorAll() { return []; },
                setAttribute(attr, val) { this[attr] = val; },
                getAttribute(attr) { return this[attr] || null; },
                focus() { this.isFocused = true; },
                contains(target) { return target === this; }
            };
            if (id) mockElements.set(id, el);
            return el;
        };

        const arrow = { setAttribute(k, v) { this[k] = v; }, name: 'chevron-down' };
        const dropdownBtn = createElement('button', 'player-dropdown-button', 'player-dropdown-button');
        const dropdownList = createElement('div', 'player-dropdown-list', 'player-dropdown-list');
        createElement('div', 'player-items-container');
        createElement('span', 'selected-player-name');
        createElement('button', 'add-player-button');
        const container = createElement('div', 'player-dropdown-container-el', 'player-dropdown-container');

        const origDoc = globalThis.document;
        const origWin = globalThis.window;
        const docListeners = new Map();
        const winListeners = new Map();

        globalThis.document = {
            getElementById: (id) => mockElements.get(id) || null,
            querySelector: (sel) => {
                if (sel === '.player-dropdown-container') return container;
                if (sel === '.modal.show') return null;
                return null;
            },
            querySelectorAll: () => [],
            addEventListener: (ev, fn) => {
                if (!docListeners.has(ev)) docListeners.set(ev, []);
                docListeners.get(ev).push(fn);
            }
        };

        globalThis.window = {
            matchMedia: () => ({ matches: true }),
            addEventListener: (ev, fn) => {
                if (!winListeners.has(ev)) winListeners.set(ev, []);
                winListeners.get(ev).push(fn);
            }
        };

        try {
            initHeroJourneyPlayerDropdown({
                getActivePlayerTag: () => '8PJYGUJC',
                onSelectPlayer: () => {},
                onDeletePlayer: () => {},
                onAddPlayer: () => {}
            });

            container.dispatchEvent({ type: 'mouseenter' });
            assert.strictEqual(dropdownList.classList.contains('show'), true, 'Dropdown list must receive .show on mouseenter');
            assert.strictEqual(dropdownBtn.classList.contains('open'), true, 'Dropdown button must receive .open on mouseenter');
            assert.strictEqual(arrow.name, 'chevron-up', 'Dropdown chevron must flip up on open');

            // While open, subsequent focusin must keep dropdown open and not destroy items
            container.dispatchEvent({ type: 'focusin' });
            assert.strictEqual(dropdownList.classList.contains('show'), true, 'Dropdown must remain open on focusin');

            container.dispatchEvent({ type: 'mouseleave' });
            assert.strictEqual(dropdownList.classList.contains('show'), false, 'Dropdown list must remove .show on mouseleave');
            assert.strictEqual(dropdownBtn.classList.contains('open'), false, 'Dropdown button must remove .open on mouseleave');
            assert.strictEqual(arrow.name, 'chevron-down', 'Dropdown chevron must reset down on close');

            container.dispatchEvent({ type: 'focusin' });
            assert.strictEqual(dropdownList.classList.contains('show'), true, 'Dropdown must open on focusin when closed');

            const scrollFns = winListeners.get('scroll') || [];
            scrollFns.forEach(fn => fn());
            assert.strictEqual(dropdownList.classList.contains('show'), false, 'Dropdown must close on window scroll');
        } finally {
            globalThis.document = origDoc;
            globalThis.window = origWin;
        }
    });

    test('verifies isTrueMaxCumulativeLevel matches only players reaching max hero levels for the max Town Hall', () => {
        const maxLevels = getMaxCumulativeLevelsByTH();
        const overallMax = Math.max(...Object.values(maxLevels));
        assert.ok(overallMax > 400, 'Max TH cumulative cap must be defined');

        // Below max levels -> not true max
        assert.strictEqual(isTrueMaxCumulativeLevel(0), false);
        assert.strictEqual(isTrueMaxCumulativeLevel(100), false);
        assert.strictEqual(isTrueMaxCumulativeLevel(maxLevels[17]), false, 'TH17 maxed player is not true max');
        assert.strictEqual(isTrueMaxCumulativeLevel(overallMax - 1), false);

        // At or above overall max -> true max
        assert.strictEqual(isTrueMaxCumulativeLevel(overallMax), true, 'True max at overall cap');
        assert.strictEqual(isTrueMaxCumulativeLevel(overallMax + 5), true, 'True max above overall cap');
    });

    test('verifies hero-journey-progress-track is removed for true max player and restored when switching to non-max player', async () => {
        const { renderHeroJourneyDisplay } = await import('../../js/components/home/heroJourneyDisplay.js');

        const trackElement = {
            style: { display: '' }
        };
        const cardElement = {
            classList: {
                _classes: new Set(),
                toggle(cls, force) {
                    if (force) this._classes.add(cls);
                    else this._classes.delete(cls);
                },
                contains(cls) {
                    return this._classes.has(cls);
                }
            }
        };

        const origDoc = globalThis.document;
        const origRaf = globalThis.requestAnimationFrame;
        const origRo = globalThis.ResizeObserver;
        globalThis.requestAnimationFrame = (cb) => { if (typeof cb === 'function') cb(); };
        globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
        globalThis.document = {
            getElementById(id) {
                if (id === 'home-hj-card') return cardElement;
                return null;
            },
            querySelector(sel) {
                if (sel === '.hero-journey-card' || sel === '#home-hj-card') return cardElement;
                if (sel === '.hero-journey-progress-track') return trackElement;
                return null;
            },
            querySelectorAll(sel) {
                if (sel === '.hero-journey-progress-track') return [trackElement];
                return [];
            }
        };

        try {
            // State for Player 1: True Max (e.g. TH18 with overall max hero levels)
            const trueMaxState = {
                heroJourney: {},
                playerProfile: {
                    tag: '#TRUE_MAX',
                    townHallLevel: 18,
                    heroes: [
                        { name: 'Barbarian King', level: 110, village: 'home' },
                        { name: 'Archer Queen', level: 110, village: 'home' },
                        { name: 'Minion Prince', level: 95, village: 'home' },
                        { name: 'Grand Warden', level: 85, village: 'home' },
                        { name: 'Royal Champion', level: 55, village: 'home' },
                        { name: 'Dragon Duke', level: 25, village: 'home' }
                    ]
                }
            };

            renderHeroJourneyDisplay(trueMaxState);
            assert.strictEqual(trackElement.style.display, 'none', 'Progress track must be hidden for true max player');
            assert.strictEqual(cardElement.classList.contains('is-true-max'), true, 'Card must have is-true-max class');

            // State for Player 2: TH17 max player (not true max)
            const nonMaxState = {
                heroJourney: {},
                playerProfile: {
                    tag: '#NOT_TRUE_MAX',
                    townHallLevel: 17,
                    heroes: [
                        { name: 'Barbarian King', level: 100, village: 'home' },
                        { name: 'Archer Queen', level: 100, village: 'home' },
                        { name: 'Minion Prince', level: 90, village: 'home' },
                        { name: 'Grand Warden', level: 75, village: 'home' },
                        { name: 'Royal Champion', level: 50, village: 'home' },
                        { name: 'Dragon Duke', level: 20, village: 'home' }
                    ]
                }
            };

            renderHeroJourneyDisplay(nonMaxState);
            assert.strictEqual(trackElement.style.display, '', 'Progress track must be restored when switching to non-max player');
            assert.strictEqual(cardElement.classList.contains('is-true-max'), false, 'Card must not have is-true-max class');
        } finally {
            globalThis.document = origDoc;
            globalThis.requestAnimationFrame = origRaf;
            globalThis.ResizeObserver = origRo;
        }
    });

    test('verifies computePlayerCumulativeLevel accurately sums levels across all data shapes', async () => {
        const { computePlayerCumulativeLevel } = await import('../../js/components/heroJourney/heroJourneyState.js');
        const { getPlayerStorageKey } = await import('../../js/core/storageKeys.js');

        // 1. Raw API response with heroes array (ignoring non-home heroes like Battle Machine)
        const apiPayload = {
            tag: '#API_TEST',
            heroes: [
                { name: 'Barbarian King', level: 46, village: 'home' },
                { name: 'Archer Queen', level: 59, village: 'home' },
                { name: 'Grand Warden', level: 32, village: 'home' },
                { name: 'Royal Champion', level: 20, village: 'home' },
                { name: 'Minion Prince', level: 46, village: 'home' },
                { name: 'Dragon Duke', level: 9, village: 'home' },
                { name: 'Battle Machine', level: 11, village: 'builderBase' },
                { name: 'Battle Copter', level: 1, village: 'builderBase' }
            ]
        };
        assert.strictEqual(computePlayerCumulativeLevel(apiPayload), 212, 'API payload must sum only active home heroes');

        // 2. Normalized playerProfile with ownedHeroes map
        const storedProfile = {
            tag: '#STORED_TEST',
            name: 'Chief',
            townHallLevel: 16,
            ownedHeroes: {
                'Barbarian King': { level: 46, maxLevel: 110 },
                'Archer Queen': { level: 59, maxLevel: 110 },
                'Grand Warden': { level: 32, maxLevel: 85 },
                'Royal Champion': { level: 20, maxLevel: 55 },
                'Minion Prince': { level: 46, maxLevel: 95 },
                'Dragon Duke': { level: 9, maxLevel: 25 }
            }
        };
        assert.strictEqual(computePlayerCumulativeLevel(storedProfile), 212, 'Stored playerProfile with ownedHeroes map must compute exact cumulative level');

        // 3. Storage partition with heroes dictionary
        const partitionPayload = {
            heroes: {
                'Barbarian King': { level: 46, maxLevel: 110 },
                'Archer Queen': { level: 59, maxLevel: 110 },
                'Grand Warden': { level: 32, maxLevel: 85 },
                'Royal Champion': { level: 20, maxLevel: 55 },
                'Minion Prince': { level: 46, maxLevel: 95 },
                'Dragon Duke': { level: 9, maxLevel: 25 }
            }
        };
        assert.strictEqual(computePlayerCumulativeLevel(partitionPayload), 212, 'Partition payload with heroes map must compute exact cumulative level');

        // 4. LocalStorage partition fallback via tag
        const testKey = getPlayerStorageKey('FALLBACK_TAG');
        try {
            localStorage.setItem(testKey, JSON.stringify({
                playerProfile: storedProfile,
                heroes: partitionPayload.heroes
            }));
            const minimalTagPayload = { tag: '#FALLBACK_TAG' };
            assert.strictEqual(computePlayerCumulativeLevel(minimalTagPayload), 212, 'Fallback to storage partition by tag must compute exact cumulative level');
        } finally {
            localStorage.removeItem(testKey);
        }

        // 5. Empty / null / guest
        assert.strictEqual(computePlayerCumulativeLevel(null), 0, 'Null payload must return 0');
        assert.strictEqual(computePlayerCumulativeLevel({}), 0, 'Empty payload must return 0');
        assert.strictEqual(computePlayerCumulativeLevel({ tag: 'DEFAULT0' }), 0, 'Guest tag must return 0');
    });

    test('verifies buildStateFromPlayerData constructs complete ownedHeroes and ownedEquipment from cached profiles', async () => {
        const { buildStateFromPlayerData } = await import('../../js/components/heroJourney/heroJourneyState.js');

        const cachedProfile = {
            tag: '#BUILD_TEST',
            name: 'Chief',
            townHallLevel: 16,
            ownedHeroes: {
                'Barbarian King': { level: 46, maxLevel: 110, equipment: [{ name: 'Spiky Ball', level: 22 }] },
                'Archer Queen': { level: 59, maxLevel: 110, equipment: [{ name: 'Magic Mirror', level: 15 }] }
            },
            ownedEquipment: {
                'Spiky Ball': 22,
                'Magic Mirror': 15,
                'Giant Gauntlet': 12
            }
        };

        const stateSlice = buildStateFromPlayerData(cachedProfile, { isAccelerated: true, revealBeyondTH: false });
        assert.ok(stateSlice.heroes, 'heroes object must be defined');
        assert.strictEqual(stateSlice.heroes['Barbarian King']?.level, 46, 'Barbarian King level must match ownedHeroes');
        assert.strictEqual(stateSlice.heroes['Archer Queen']?.level, 59, 'Archer Queen level must match ownedHeroes');
        assert.ok(stateSlice.equipment, 'equipment object must be defined');
        assert.strictEqual(stateSlice.equipment['Spiky Ball'], 22, 'Spiky Ball level must match ownedEquipment');
        assert.strictEqual(stateSlice.equipment['Giant Gauntlet'], 12, 'Giant Gauntlet level must match ownedEquipment');
        assert.strictEqual(stateSlice.townHall, 16, 'Town hall level must resolve to 16');
        assert.strictEqual(stateSlice.playerProfile?.tag, 'BUILD_TEST', 'Player profile tag must be normalized');
    });
});
