import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { state } from '../../js/core/state.js';
import { loadTranslations } from '../../js/i18n/translator.js';
import { buildSpotrightRegistry } from '../../js/components/spotright/spotrightRegistry.js';
import { createSpotrightDialog, renderSpotrightResults, SCOPE_TRANSLATION_KEYS } from '../../js/components/spotright/spotrightDisplay.js';
import { createClipboardSpotrightItem } from '../../js/components/spotright/spotrightClipboard.js';
import { searchSpotright, scoreSpotrightItem, extractScopePrefix } from '../../js/components/spotright/spotrightMatcher.js';
import { initSpotrightHeaderTrigger } from '../../js/components/spotright/spotrightController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));
const deJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/de.json'), 'utf8'));

describe('Spotright Canonical i18n Parity & String Minimization Suite', () => {
    /** @type {any} */
    let originalFetch;
    /** @type {any} */
    let originalDocument;

    beforeEach(async () => {
        originalFetch = globalThis.fetch;
        originalDocument = globalThis.document;

        // @ts-ignore
        globalThis.fetch = async (url) => {
            const urlStr = String(url);
            if (urlStr.includes('/en.json')) return { ok: true, json: async () => enJson };
            if (urlStr.includes('/de.json')) return { ok: true, json: async () => deJson };
            return { ok: false, status: 404 };
        };

        state.uiSettings = { language: 'en' };
        await loadTranslations('en');
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        globalThis.document = originalDocument;
    });

    test('verifies redundant Spotright keys are completely pruned and canonical keys exist', () => {
        // Assert pruned keys do not exist in en.json
        assert.equal(enJson.views.spotright.scopes, undefined, 'views.spotright.scopes must be pruned');
        assert.equal(enJson.views.spotright.addPlayer, undefined, 'views.spotright.addPlayer must be pruned');
        assert.equal(enJson.views.spotright.loadDirectTag, undefined, 'views.spotright.loadDirectTag must be pruned');

        // Assert pruned keys do not exist in de.json
        assert.equal(deJson.views.spotright.scopes, undefined, 'views.spotright.scopes must be pruned from de.json');
        assert.equal(deJson.views.spotright.addPlayer, undefined, 'views.spotright.addPlayer must be pruned from de.json');
        assert.equal(deJson.views.spotright.loadDirectTag, undefined, 'views.spotright.loadDirectTag must be pruned from de.json');

        // Assert unified canonical keys exist
        assert.equal(typeof enJson.views.spotright.loadVillageTag, 'string');
        assert.equal(typeof deJson.views.spotright.loadVillageTag, 'string');
        assert.equal(enJson.views.spotright.loadVillageTag, 'Load Village #{tag}');
        assert.equal(deJson.views.spotright.loadVillageTag, 'Dorf #{tag} laden');

        // Assert shared canonical primitives exist in both locales
        assert.equal(enJson.nav.views.hub.villages, 'Saved Villages');
        assert.equal(deJson.nav.views.hub.villages, 'Gespeicherte Dörfer');

        assert.equal(enJson.nav.drawerTitle, 'Tabs & Tools');
        assert.equal(deJson.nav.drawerTitle, 'Tabs & Tools');

        assert.equal(enJson.nav.settings, 'Settings');
        assert.equal(deJson.nav.settings, 'Einstellungen');

        assert.equal(enJson.views.damageCalc.filters.filterHeroes, 'Heroes');
        assert.equal(deJson.views.damageCalc.filters.filterHeroes, 'Helden');

        assert.equal(enJson.nav.equipment, 'Equipment');
        assert.equal(deJson.nav.equipment, 'Ausrüstung');

        assert.equal(enJson.player.tag, 'Player Tag');
        assert.equal(deJson.player.tag, 'Spielerkürzel');

        assert.equal(enJson.player.addPlayer, 'Add a player');
        assert.equal(deJson.player.addPlayer, 'Spieler hinzufügen');

        assert.equal(enJson.actions.refresh, 'Refresh');
        assert.equal(deJson.actions.refresh, 'Aktualisieren');

        // Assert scope suggestions heading exists in both locales
        assert.equal(enJson.views.spotright.scopesHeading, 'Filter Scopes');
        assert.equal(deJson.views.spotright.scopesHeading, 'Suchbereiche');

        // Assert scope descriptions and repetitive commands dictionaries are completely pruned
        assert.equal(enJson.views.spotright.scopeDescriptions, undefined, 'scopeDescriptions must be pruned from en.json');
        assert.equal(deJson.views.spotright.scopeDescriptions, undefined, 'scopeDescriptions must be pruned from de.json');
        assert.equal(enJson.views.spotright.commands, undefined, 'commands must be pruned from en.json');
        assert.equal(deJson.views.spotright.commands, undefined, 'commands must be pruned from de.json');
    });

    test('buildSpotrightRegistry binds canonical category strings in English and German', async () => {
        // 1. English verification
        state.uiSettings.language = 'en';
        await loadTranslations('en');

        const enItems = buildSpotrightRegistry();
        const enAddPlayer = enItems.find((item) => item.id === 'action-add-player');
        const enRefresh = enItems.find((item) => item.id === 'action-refresh-village');
        const enHub = enItems.find((item) => item.id === 'tool-hub');
        const enHero = enItems.find((item) => item.id === 'hero-barbarianKing');
        const enEquip = enItems.find((item) => item.id === 'equip-barbarianKing-giantGauntlet');
        const enHjTable = enItems.find((item) => item.id === 'tool-hj-table');

        const enDamageCalc = enItems.find((item) => item.id === 'tool-damage-calc');
        const enClusterPlanner = enItems.find((item) => item.id === 'tool-cluster-planner');
        const enPlanner = enItems.find((item) => item.id === 'tool-planner');
        const enIncome = enItems.find((item) => item.id === 'tool-income');
        const enPriorityList = enItems.find((item) => item.id === 'modal-priority-list');

        assert.ok(enAddPlayer, 'action-add-player item must exist');
        assert.equal(enAddPlayer.title, 'Add a player');
        assert.equal(enAddPlayer.category, 'Settings');

        assert.ok(enRefresh, 'action-refresh-village item must exist');
        assert.equal(enRefresh.title, 'Refresh');
        assert.equal(enRefresh.category, 'Settings');

        assert.ok(enHub, 'tool-hub item must exist');
        assert.equal(enHub.title, 'Progression & Tactical Tools', 'tool-hub title in English must resolve nav.views.hub.tools');
        assert.equal(enHub.category, 'Tabs & Tools');

        assert.ok(enDamageCalc, 'tool-damage-calc item must exist');
        assert.equal(enDamageCalc.title, 'Equipment Damage & ZapQuake', 'tool-damage-calc title in English must resolve views.damageCalc.title');

        assert.ok(enClusterPlanner, 'tool-cluster-planner item must exist');
        assert.equal(enClusterPlanner.parentContext, undefined, 'DamageCalc breadcrumb must be removed from tool-cluster-planner');

        assert.ok(enPlanner);
        assert.equal(enPlanner.parentContext, 'OreCalc', 'tool-planner must retain untranslated OreCalc branding');
        assert.ok(enIncome);
        assert.equal(enIncome.parentContext, 'OreCalc', 'tool-income must retain untranslated OreCalc branding');
        assert.ok(enPriorityList);
        assert.equal(enPriorityList.parentContext, 'OreCalc', 'modal-priority-list must retain untranslated OreCalc branding');

        assert.ok(enHjTable, 'tool-hj-table item must exist');
        assert.equal(enHjTable.parentContext, 'Hero Journey', 'parentContext in English must resolve to Hero Journey');

        assert.ok(enHero, 'hero item must exist');
        assert.equal(enHero.title, 'Barbarian King');
        assert.equal(enHero.category, 'Heroes');

        assert.ok(enEquip, 'equipment item must exist');
        assert.equal(enEquip.title, 'Giant Gauntlet');
        assert.equal(enEquip.category, 'Equipment');

        // 2. German verification
        state.uiSettings.language = 'de';
        await loadTranslations('de');

        const deItems = buildSpotrightRegistry();
        const deAddPlayer = deItems.find((item) => item.id === 'action-add-player');
        const deRefresh = deItems.find((item) => item.id === 'action-refresh-village');
        const deHub = deItems.find((item) => item.id === 'tool-hub');
        const deDamageCalc = deItems.find((item) => item.id === 'tool-damage-calc');
        const deClusterPlanner = deItems.find((item) => item.id === 'tool-cluster-planner');
        const dePlanner = deItems.find((item) => item.id === 'tool-planner');
        const deIncome = deItems.find((item) => item.id === 'tool-income');
        const dePriorityList = deItems.find((item) => item.id === 'modal-priority-list');
        const deHero = deItems.find((item) => item.id === 'hero-barbarianKing');
        const deEquip = deItems.find((item) => item.id === 'equip-barbarianKing-giantGauntlet');
        const deHjTable = deItems.find((item) => item.id === 'tool-hj-table');

        assert.ok(deAddPlayer);
        assert.equal(deAddPlayer.title, 'Spieler hinzufügen');
        assert.equal(deAddPlayer.category, 'Einstellungen');

        assert.ok(deRefresh);
        assert.equal(deRefresh.title, 'Aktualisieren');
        assert.equal(deRefresh.category, 'Einstellungen');

        assert.ok(deHub);
        assert.equal(deHub.title, 'Fortschritts- & Taktik-Tools', 'tool-hub title in German must resolve nav.views.hub.tools');
        assert.equal(deHub.category, 'Tabs & Tools');

        assert.ok(deDamageCalc);
        assert.equal(deDamageCalc.title, 'Ausrüstungsschaden & ZapQuake', 'tool-damage-calc title in German must resolve views.damageCalc.title');

        assert.ok(deClusterPlanner);
        assert.equal(deClusterPlanner.parentContext, undefined, 'DamageCalc breadcrumb must be removed from tool-cluster-planner');

        assert.ok(dePlanner);
        assert.equal(dePlanner.parentContext, 'OreCalc', 'tool-planner must retain untranslated OreCalc branding in German');
        assert.ok(deIncome);
        assert.equal(deIncome.parentContext, 'OreCalc', 'tool-income must retain untranslated OreCalc branding in German');
        assert.ok(dePriorityList);
        assert.equal(dePriorityList.parentContext, 'OreCalc', 'modal-priority-list must retain untranslated OreCalc branding in German');

        assert.ok(deHjTable);
        assert.equal(deHjTable.parentContext, 'Heldenreise', 'parentContext in German must resolve to Heldenreise');

        assert.ok(deHero);
        assert.equal(deHero.title, 'Barbarenkönig');
        assert.equal(deHero.category, 'Helden');

        assert.ok(deEquip);
        assert.equal(deEquip.title, 'Riesenhandschuh');
        assert.equal(deEquip.category, 'Ausrüstung');
    });

    test('direct tag search item and clipboard item use canonical loadVillageTag and Player Tag category', async () => {
        // English verification
        state.uiSettings.language = 'en';
        await loadTranslations('en');

        const clipboardItemEn = createClipboardSpotrightItem('88LV892');
        assert.equal(clipboardItemEn.title, 'Load Village #88LV892');
        assert.equal(clipboardItemEn.category, 'Player Tag');

        const searchResultsEn = searchSpotright('88LV892', { activeTag: null });
        const directItemEn = searchResultsEn.matches.find((item) => item.id === 'direct-tag-88LV892');
        assert.ok(directItemEn);
        assert.equal(directItemEn.title, 'Load Village #88LV892');
        assert.equal(directItemEn.category, 'Player Tag');

        // German verification
        state.uiSettings.language = 'de';
        await loadTranslations('de');

        const clipboardItemDe = createClipboardSpotrightItem('88LV892');
        assert.equal(clipboardItemDe.title, 'Dorf #88LV892 laden');
        assert.equal(clipboardItemDe.category, 'Spielerkürzel');

        const searchResultsDe = searchSpotright('88LV892', { activeTag: null });
        const directItemDe = searchResultsDe.matches.find((item) => item.id === 'direct-tag-88LV892');
        assert.ok(directItemDe);
        assert.equal(directItemDe.title, 'Dorf #88LV892 laden');
        assert.equal(directItemDe.category, 'Spielerkürzel');
    });

    test('SCOPE_TRANSLATION_KEYS and filter track chip bindings use canonical keys', () => {
        assert.equal(SCOPE_TRANSLATION_KEYS.villages, 'nav.views.hub.villages');
        assert.equal(SCOPE_TRANSLATION_KEYS.tools, 'nav.drawerTitle');

        /** @type {Record<string, any>} */
        const mockDialog = {
            id: '',
            className: '',
            innerHTML: '',
            setAttribute(name, value) {
                this[name] = value;
            }
        };

        // @ts-ignore
        globalThis.document = {
            createElement(tag) {
                if (tag === 'dialog') return mockDialog;
                return {};
            }
        };

        const dialog = createSpotrightDialog();
        const html = dialog.innerHTML;

        assert.match(html, /data-i18n="nav\.views\.hub\.villages"/, 'Villages chip must bind to nav.views.hub.villages');
        assert.match(html, /data-i18n="nav\.drawerTitle"/, 'Tools chip must bind to nav.drawerTitle');
        assert.match(html, /data-i18n="views\.shortcuts\.keys\.keyboardEsc"/, 'Search bar ESC keycap must bind to views.shortcuts.keys.keyboardEsc');
        assert.match(html, /id="spotright-clear-btn"/, 'Must contain spotright-clear-btn');
        assert.match(html, /data-i18n-aria-label="views\.heroJourney\.page\.clearSearch"/, 'Clear button must bind to views.heroJourney.page.clearSearch');
        assert.match(html, /aria-label="Filter by type"/, 'Filter track must have accessible label');

        // Rule 3: Zero prohibited dingbats or emojis
        const prohibitedPattern = /[\u2190-\u21FF\u2500-\u257F\u25A0-\u25FF\u2600-\u26FF\u2700-\u27BF\u2022]/u;
        assert.equal(prohibitedPattern.test(html), false, 'Spotright dialog markup must contain zero prohibited dingbats');
    });

    test('multilingual hero and equipment search operates across both English and German locales', async () => {
        state.uiSettings.language = 'de';
        await loadTranslations('de');

        const deRegistry = buildSpotrightRegistry();

        // Search by German localized name
        const matchGermanEquip = searchSpotright('Riesenhandschuh', deRegistry);
        assert.ok(matchGermanEquip.matches.some(item => item.id === 'equip-barbarianKing-giantGauntlet'), 'German query must match Giant Gauntlet');

        // Search by English canonical name while in German locale
        const matchEnglishEquip = searchSpotright('Giant Gauntlet', deRegistry);
        assert.ok(matchEnglishEquip.matches.some(item => item.id === 'equip-barbarianKing-giantGauntlet'), 'English query in German locale must match Giant Gauntlet');

        // Search by German localized hero name
        const matchGermanHero = searchSpotright('Barbarenkönig', deRegistry);
        assert.ok(matchGermanHero.matches.some(item => item.id === 'hero-barbarianKing'), 'German query must match Barbarian King');

        // Search by English canonical hero name while in German locale
        const matchEnglishHero = searchSpotright('Barbarian King', deRegistry);
        assert.ok(matchEnglishHero.matches.some(item => item.id === 'hero-barbarianKing'), 'English query in German locale must match Barbarian King');
    });

    test('renderSpotrightResults localizes Town Hall alt text and enter keycap aria-label', async () => {
        /** @type {any} */
        const mockVillageItem = {
            id: 'village-TEST',
            title: 'My Base',
            category: 'Saved Villages',
            isVillage: true,
            isActiveVillage: false,
            cleanTag: 'TEST',
            thLevel: 17,
            icon: 'assets/th/th17.png',
            trophies: 5000
        };

        /** @type {any} */
        const mockActionItem = {
            id: 'action-sample',
            title: 'Sample Action',
            category: 'Tabs & Tools',
            isVillage: false,
            icon: 'plus',
            iconType: 'svg'
        };

        // 1. English verification
        state.uiSettings.language = 'en';
        await loadTranslations('en');

        const containerEn = { innerHTML: '' };
        renderSpotrightResults(containerEn, [mockVillageItem, mockActionItem], 0);
        assert.match(containerEn.innerHTML, /alt="Town Hall 17"/, 'Town Hall image must have English alt text');
        assert.match(containerEn.innerHTML, /aria-label="Enter"/, 'Enter keycap must have English aria-label');

        const emptyEn = { innerHTML: '' };
        renderSpotrightResults(emptyEn, [], 0, 'xyz');
        assert.match(emptyEn.innerHTML, /id="spotright-empty-reset-btn"/, 'Empty state must contain spotright-empty-reset-btn');
        assert.match(emptyEn.innerHTML, />Reset Filters</, 'Empty state reset button must display English text');

        // 2. German verification
        state.uiSettings.language = 'de';
        await loadTranslations('de');

        const containerDe = { innerHTML: '' };
        renderSpotrightResults(containerDe, [mockVillageItem, mockActionItem], 0);
        assert.match(containerDe.innerHTML, /alt="Rathaus 17"/, 'Town Hall image must have German alt text');
        assert.match(containerDe.innerHTML, /aria-label="Eingabe"/, 'Enter keycap must have German aria-label');

        const emptyDe = { innerHTML: '' };
        renderSpotrightResults(emptyDe, [], 0, 'xyz');
        assert.match(emptyDe.innerHTML, /id="spotright-empty-reset-btn"/, 'Empty state must contain spotright-empty-reset-btn');
        assert.match(emptyDe.innerHTML, />Filter zurücksetzen</, 'Empty state reset button must display German text');
    });

    test('initSpotrightHeaderTrigger dynamically localizes trigger button title', async () => {
        /** @type {Record<string, any>} */
        const elements = {
            'header-spotright-mod-key': { className: '', innerHTML: '', textContent: '' },
            'header-spotright-btn': { title: '' }
        };

        // @ts-ignore
        globalThis.document = {
            getElementById(id) {
                return elements[id] || null;
            }
        };

        // 1. English verification
        state.uiSettings.language = 'en';
        await loadTranslations('en');

        initSpotrightHeaderTrigger(true);
        assert.equal(elements['header-spotright-btn'].title, 'Search & Command Palette (⌘K)');

        initSpotrightHeaderTrigger(false);
        assert.equal(elements['header-spotright-mod-key'].textContent, 'Ctrl', 'English non-Mac must render Ctrl');
        assert.equal(elements['header-spotright-btn'].title, 'Search & Command Palette (Ctrl+K)');

        // 2. German verification
        state.uiSettings.language = 'de';
        await loadTranslations('de');

        initSpotrightHeaderTrigger(true);
        assert.equal(elements['header-spotright-btn'].title, 'Suche & Befehlspalette (⌘K)');

        initSpotrightHeaderTrigger(false);
        assert.equal(elements['header-spotright-mod-key'].textContent, 'Strg', 'German non-Mac must render Strg');
        assert.equal(elements['header-spotright-btn'].title, 'Suche & Befehlspalette (Strg+K)');
    });

    test('localizes primary modal titles and applies 15-point discount penalty for English fallback matches in German', async () => {
        // 1. English verification of modal titles
        state.uiSettings.language = 'en';
        await loadTranslations('en');

        const enItems = buildSpotrightRegistry();
        const enSettings = enItems.find(i => i.id === 'modal-settings');
        const enPlayer = enItems.find(i => i.id === 'modal-player');
        const enCloud = enItems.find(i => i.id === 'modal-cloud-save');
        const enPriority = enItems.find(i => i.id === 'modal-priority-list');
        const enChangelog = enItems.find(i => i.id === 'modal-changelog');
        const enCosts = enItems.find(i => i.id === 'modal-running-costs');

        assert.ok(enSettings && enPlayer && enCloud && enPriority && enChangelog && enCosts);
        assert.equal(enSettings.title, 'Settings');
        assert.equal(enPlayer.title, 'Manage Villages');
        assert.equal(enCloud.title, 'Account & Cloud Sync');
        assert.equal(enPriority.title, 'Priority List');
        assert.equal(enChangelog.title, 'Changelog');
        assert.equal(enCosts.title, 'Project Costs');

        // Zero penalty in English locale
        const enSettingsScore = scoreSpotrightItem('settings', enSettings);
        assert.equal(enSettingsScore, 165, 'Exact title match in English receives full score (150 + 15)');

        // 2. German verification of modal titles
        state.uiSettings.language = 'de';
        await loadTranslations('de');

        const deItems = buildSpotrightRegistry();
        const deSettings = deItems.find(i => i.id === 'modal-settings');
        const dePlayer = deItems.find(i => i.id === 'modal-player');
        const deCloud = deItems.find(i => i.id === 'modal-cloud-save');
        const dePriority = deItems.find(i => i.id === 'modal-priority-list');
        const deChangelog = deItems.find(i => i.id === 'modal-changelog');
        const deCosts = deItems.find(i => i.id === 'modal-running-costs');

        assert.ok(deSettings && dePlayer && deCloud && dePriority && deChangelog && deCosts);
        assert.equal(deSettings.title, 'Einstellungen');
        assert.equal(dePlayer.title, 'Dörfer verwalten');
        assert.equal(deCloud.title, 'Konto & Cloud-Synchronisierung');
        assert.equal(dePriority.title, 'Prioritäten-Liste');
        assert.equal(deChangelog.title, 'Änderungsprotokoll');
        assert.equal(deCosts.title, 'Projektkosten');

        // Modal scoring in German: native 'Einstellungen' vs English fallback 'settings'
        const deNativeScore = scoreSpotrightItem('einstellungen', deSettings);
        const deEnglishFallbackScore = scoreSpotrightItem('settings', deSettings);
        assert.equal(deNativeScore, 165, 'Native German exact match receives full score (150 + 15)');
        assert.equal(deEnglishFallbackScore, 150, 'English fallback exact match in German receives 15-point discount (135 + 15)');
        assert.ok(deNativeScore > deEnglishFallbackScore, 'Native German query must score higher than English query in German locale');

        // Saved Village scoring in German: native 'dorf' vs English fallback 'village'
        const mockVillage = {
            id: 'village-88LV892',
            title: 'My Base',
            canonicalTitle: 'my base',
            canonicalTokens: 'village account saved villages',
            normalizedTitle: 'my base #88lv892 88lv892 dorf dörfer konto',
            isVillage: true,
            priorityTier: 22
        };
        const dorfScore = scoreSpotrightItem('dorf', mockVillage);
        const villageScore = scoreSpotrightItem('village', mockVillage);
        assert.ok(dorfScore > 0, 'Dorf query must match');
        assert.ok(villageScore > 0, 'Village query must match');
        assert.ok(dorfScore > villageScore, 'German dorf query (77) must score higher than English village fallback (62) in German locale');
        assert.equal(dorfScore - villageScore, 15, 'Discount difference must be exactly 15 points');

        // Hero and equipment bilingual search in German
        const deGauntlet = deItems.find(i => i.id === 'equip-barbarianKing-giantGauntlet');
        assert.ok(deGauntlet);
        const riesenScore = scoreSpotrightItem('riesen', deGauntlet);
        const giantScore = scoreSpotrightItem('giant', deGauntlet);
        assert.ok(riesenScore > giantScore, 'Native German prefix (Riesen) must score higher than English prefix (Giant) in German');

        // Universal canonical prefix commands operate universally across all locales
        assert.deepEqual(extractScopePrefix('/v '), { scope: 'villages', remainingQuery: '' });
        assert.deepEqual(extractScopePrefix('/village '), { scope: 'villages', remainingQuery: '' });
        assert.deepEqual(extractScopePrefix('/villages chief'), { scope: 'villages', remainingQuery: 'chief' });
        assert.deepEqual(extractScopePrefix('/e '), { scope: 'equipment', remainingQuery: '' });
        assert.deepEqual(extractScopePrefix('/equip '), { scope: 'equipment', remainingQuery: '' });
        assert.deepEqual(extractScopePrefix('/equipment boots'), { scope: 'equipment', remainingQuery: 'boots' });
        assert.deepEqual(extractScopePrefix('/h '), { scope: 'hero', remainingQuery: '' });
        assert.deepEqual(extractScopePrefix('/hero '), { scope: 'hero', remainingQuery: '' });
        assert.deepEqual(extractScopePrefix('/heroes queen'), { scope: 'hero', remainingQuery: 'queen' });
        assert.deepEqual(extractScopePrefix('/t '), { scope: 'tools', remainingQuery: '' });
        assert.deepEqual(extractScopePrefix('/tool '), { scope: 'tools', remainingQuery: '' });
        assert.deepEqual(extractScopePrefix('/tools '), { scope: 'tools', remainingQuery: '' });
        assert.deepEqual(extractScopePrefix('/s '), { scope: 'settings', remainingQuery: '' });
        assert.deepEqual(extractScopePrefix('/setting '), { scope: 'settings', remainingQuery: '' });
        assert.deepEqual(extractScopePrefix('/settings audio'), { scope: 'settings', remainingQuery: 'audio' });

        // Scope suggestions in German follow filter track order with zero subtitles
        const deSuggestions = searchSpotright('/', deItems);
        assert.equal(deSuggestions.matches.length, 5);
        assert.deepEqual(
            deSuggestions.matches.map(m => m.targetScope),
            ['villages', 'equipment', 'hero', 'tools', 'settings'],
            'German scope suggestions must match filter chip track order exactly'
        );
        assert.equal(deSuggestions.matches[0].category, 'Suchbereiche');

        const deEquip = deSuggestions.matches.find(m => m.targetScope === 'equipment');
        assert.ok(deEquip);
        assert.equal(deEquip.title, 'Ausrüstung');
        assert.equal(deEquip.subtitle, undefined, 'Scope suggestions must have zero subtitle');
        assert.equal(deEquip.command, '/equipment');

        const deHero = deSuggestions.matches.find(m => m.targetScope === 'hero');
        assert.ok(deHero);
        assert.equal(deHero.title, 'Helden');
        assert.equal(deHero.subtitle, undefined);
        assert.equal(deHero.command, '/heroes', 'Hero command must be /heroes');

        // Dynamic localized prefix narrowing in German ranks best match at index 0
        const deAusResult = searchSpotright('/aus', deItems);
        assert.equal(deAusResult.matches.length, 1);
        assert.equal(deAusResult.matches[0].targetScope, 'equipment');

        const deAuResult = searchSpotright('/au', deItems);
        assert.equal(deAuResult.matches.length, 1);
        assert.equal(deAuResult.matches[0].targetScope, 'equipment');

        const deDorfResult = searchSpotright('/dorf', deItems);
        assert.equal(deDorfResult.matches.length, 1);
        assert.equal(deDorfResult.matches[0].targetScope, 'villages');

        const deHeldResult = searchSpotright('/held', deItems);
        assert.equal(deHeldResult.matches.length, 1);
        assert.equal(deHeldResult.matches[0].targetScope, 'hero');

        const deToResult = searchSpotright('/to', deItems);
        assert.equal(deToResult.matches.length, 1);
        assert.equal(deToResult.matches[0].targetScope, 'tools');

        // Ambiguous prefix /e matches equipment (110) > settings (100)
        const deEResult = searchSpotright('/e', deItems);
        assert.equal(deEResult.matches.length, 2);
        assert.equal(deEResult.matches[0].targetScope, 'equipment');
        assert.equal(deEResult.matches[1].targetScope, 'settings');

        // Unrecognized slash command returns zero matches and zero non-command items
        const deUnknown = searchSpotright('/xyz', deItems);
        assert.equal(deUnknown.matches.length, 0);
    });
});
