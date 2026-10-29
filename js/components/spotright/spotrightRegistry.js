/**
 * Spotright Pre-Indexed Search Registry for ClashCalc.
 * Pre-computes normalized titles, 2-letter acronyms, composite keys, and declarative item definitions.
 * Tier 4: Search Component Registry.
 */

import { heroData } from '../../data/heroData.js';
import { getSavedProfiles } from '../../core/playerStorage.js';
import { formatDisplayTag, normalizePlayerTag } from '../../core/storageKeys.js';
import { UNRANKED_LEAGUE_ID } from '../../core/constants.js';
import { leagueTiers } from '../../data/leagueTiers.js';
import { translate } from '../../i18n/translator.js';
import { switchOrLoadPlayerTag } from './spotrightClipboard.js';
import {
    dispatchEquipmentAction,
    executeAccountSyncAction,
    executeAddPlayerAction,
    executeManageVillagesAction,
    executeRefreshVillageAction,
    executeSettingsAction,
    getActiveUrlTag,
    getCurrentRouteContext,
    isSelfTarget,
    navigateToHero,
    navigateToTarget
} from './spotrightNavigator.js';

/**
 * @typedef {Object} SpotrightItem
 * @property {string} id - Canonical '<type>-<canonical-name>' entity identifier.
 * @property {import('./spotrightNavigator.js').SpotrightItemType} type - Structural archetype of the item.
 * @property {import('./spotrightMatcher.js').SpotrightScope[]} [scopes] - Filter scopes where this item is included.
 * @property {import('./spotrightNavigator.js').SpotrightParent} [parent] - Primary owning parent context.
 * @property {import('./spotrightNavigator.js').SpotrightParent[]} [parents] - Ordered list of owning parent contexts for multi-parent items.
 * @property {'epic' | 'common'} [rarity] - Equipment rarity tier (strictly for type === 'equipment').
 * @property {string} [defaultTab] - Default active tab identifier for a parent page item.
 * @property {string[]} [defaultTabs] - Set of tab identifiers considered equivalent to the home view of a parent page.
 * @property {string} [tabId] - Target sub-tab identifier for type === 'tab'.
 * @property {string} [sectionId] - Target DOM section ID for type === 'section'.
 * @property {'always' | 'parent-only'} [visibility] - Visibility rule across parent pages.
 * @property {string} [damageEquipKey] - Mapped snake_case key in Damage Calculator if registered.
 * @property {string} title - Human-readable display title.
 * @property {string} [canonicalTitle] - Lowercase English canonical title for multilingual search.
 * @property {string} [canonicalTokens] - Space-separated English fallback tokens for search.
 * @property {string} normalizedTitle - Lowercase normalized title for search.
 * @property {string} category - Category label (e.g. 'Equipment', 'Heroes', 'Tabs & Tools', 'Settings').
 * @property {string} [subtitle] - Secondary descriptive text.
 * @property {string} [parentContext] - Parent tool context badge (e.g. 'OreCalc', 'DamageCalc', heroJourneyContext).
 * @property {string} icon - Asset path or SVG symbol name.
 * @property {'image'|'svg'} iconType - Rendering type for the icon.
 * @property {string} acronym - 2-letter canonical acronym.
 * @property {string} [heroKey] - Associated hero key if equipment.
 * @property {string} [heroName] - Associated hero display name if equipment.
 * @property {string} [heroAcronym] - 2-letter hero acronym if equipment.
 * @property {string} [compositeAcronym] - Space-separated hero+equipment acronym (e.g. 'rc eb').
 * @property {string} [compactComposite] - Compact hero+equipment acronym (e.g. 'rceb').
 * @property {string} [compositeTitle] - Full hero + equipment name for multi-token search.
 * @property {string} [canonicalCompositeTitle] - Full canonical hero + equipment name for multi-token search.
 * @property {number} priorityTier - Base priority score (Hero=30, Nav=25, Epic=20, Modal/Action=15-22, Common=10).
 * @property {boolean} [isAsyncAction] - Whether the action performs an asynchronous lookup before closing.
 * @property {boolean} [isLoading] - True when action is currently in flight.
 * @property {string | null} [errorMessage] - Inline error feedback to render.
 * @property {boolean} [isVillage] - Whether entity is a saved multi-account village.
 * @property {boolean} [isActiveVillage] - Whether this village is the currently active player tag.
 * @property {string} [cleanTag] - Normalized player tag without hash.
 * @property {string} [displayTag] - Formatted player tag with leading hash.
 * @property {number} [thLevel] - Town hall level (1-18).
 * @property {number} [trophies] - Formatted player trophy count.
 * @property {boolean} [hasTrophies] - Whether trophies are defined for this village.
 * @property {string} [clanName] - Clan name if member of a clan.
 * @property {string} [clanBadge] - URL of the small clan badge image.
 * @property {string} [leagueName] - Localized name of current league.
 * @property {string} [leagueIcon] - URL of the small league crest icon.
 * @property {boolean} [isRecent] - Whether item is being rendered from recent searches history.
 * @property {boolean} [isScopeSuggestion] - Whether item is a category scope suggestion.
 * @property {import('./spotrightMatcher.js').SpotrightScope} [targetScope] - Target category domain scope to filter.
 * @property {string} [command] - Scope command prefix string (e.g. '/equipment').
 * @property {() => void | Promise<any>} execute - Action callback executed on activation.
 */

/** @type {Record<string, string>} Canonical 2-letter Hero Acronyms */
export const HERO_ACRONYMS = {
    barbarianKing: 'bk',
    archerQueen: 'aq',
    minionPrince: 'mp',
    grandWarden: 'gw',
    royalChampion: 'rc',
    dragonDuke: 'dd'
};

/** @type {Record<string, string>} Canonical 2-letter Equipment Acronyms */
export const EQUIPMENT_ACRONYMS = {
    barbarianPuppet: 'bp', rageVial: 'rv', earthquakeBoots: 'eb', vampstache: 'va',
    giantGauntlet: 'gg', spikyBall: 'sb', snakeBracelet: 'sb', stickHorse: 'sh',
    archerPuppet: 'ap', invisibilityVial: 'iv', giantArrow: 'ga', healerPuppet: 'hp',
    frozenArrow: 'fa', magicMirror: 'mm', actionFigure: 'af', monolithArrow: 'ma',
    henchmenPuppet: 'hp', darkOrb: 'do', metalPants: 'mp', nobleIron: 'ni',
    darkCrown: 'dc', meteorStaff: 'ms', portalPendant: 'pp',
    eternalTome: 'et', lifeGem: 'lg', rageGem: 'rg', healingTome: 'ht',
    fireball: 'fb', lavaloonPuppet: 'lp', heroicTorch: 'ht',
    royalGem: 'rg', seekingShield: 'ss', hogRiderPuppet: 'hr', hasteVial: 'hv',
    rocketSpear: 'rs', electroBoots: 'eb', frostFlake: 'ff',
    fireHeart: 'fh', flameBlower: 'fb', stunBlaster: 'sb', electroFangs: 'ef',
    rocketBackpack: 'rb', revengeDeck: 'rd'
};

/** @type {Readonly<Record<string, string>>} Mapping of heroData equipment keys to equipmentDamageData keys */
export const DAMAGE_EQUIPMENT_MAP = Object.freeze({
    giantArrow: 'giant_arrow',
    fireball: 'fireball',
    spikyBall: 'spiky_ball',
    seekingShield: 'seeking_shield',
    earthquakeBoots: 'earthquake_boots',
    flameBlower: 'flame_blower',
    rocketBackpack: 'rocket_backpack'
});

/**
 * Safely resolves translation with fallback if key is uninitialized or missing.
 * @param {string} key
 * @param {string} fallback
 * @returns {string}
 */
function resolveI18nText(key, fallback) {
    const val = translate(key);
    return (val && val !== key) ? val : fallback;
}

/**
 * Builds the saved village items from local storage profiles.
 * @param {string} villagesCategory
 * @returns {SpotrightItem[]}
 */
function buildSavedVillageItems(villagesCategory) {
    /** @type {SpotrightItem[]} */
    const villageItems = [];
    const activeUrlTag = getActiveUrlTag();
    const savedProfiles = typeof getSavedProfiles === 'function' ? getSavedProfiles() : [];

    for (const profile of savedProfiles) {
        if (!profile?.cleanTag || profile.cleanTag === 'DEFAULT0') continue;
        const cleanTag = profile.cleanTag;
        const displayTag = formatDisplayTag(profile.tag || cleanTag) || `#${cleanTag}`;
        const villageName = profile.name || displayTag;
        const thLevel = Math.max(1, Math.min(18, Number(profile.townHallLevel) || 18));
        const isActive = Boolean(activeUrlTag && normalizePlayerTag(activeUrlTag) === cleanTag);

        const clanName = profile.cachedData?.clan?.name || '';
        const clanBadge = profile.cachedData?.clan?.badgeUrls?.small || '';
        const trophies = profile.trophies != null ? profile.trophies : profile.cachedData?.trophies;

        const leagueId = Number(profile.cachedData?.leagueTier?.id || profile.cachedData?.league?.id);
        const canonicalLeague = leagueTiers.items.find(l => l.id === leagueId);
        const unrankedLeague = leagueTiers.items.find(l => l.id === UNRANKED_LEAGUE_ID) || leagueTiers.items[0];
        const leagueIcon = canonicalLeague?.iconUrls?.small || profile.cachedData?.leagueTier?.iconUrls?.small || unrankedLeague?.iconUrls?.small || '';
        let leagueName = canonicalLeague?.name || '';
        if (canonicalLeague) {
            const leagueKey = 'entities.leagues.' + canonicalLeague.name.toLowerCase()
                .replace(/\./g, '')
                .replace(/\s(i+)$/i, (_, p1) => p1.toUpperCase())
                .replace(/\s/g, '_');
            const translatedLeague = translate(leagueKey);
            if (translatedLeague && translatedLeague !== leagueKey) leagueName = translatedLeague;
        }
        if (!leagueName) leagueName = translate('entities.leagues.unranked') || 'Unranked';

        const normalizedParts = [
            villageName.toLowerCase(),
            displayTag.toLowerCase(),
            cleanTag.toLowerCase(),
            'dorf',
            'dörfer',
            'konto'
        ];
        if (clanName) normalizedParts.push(clanName.toLowerCase());
        if (cleanTag.includes('0')) {
            const oTag = cleanTag.replace(/0/g, 'O').toLowerCase();
            normalizedParts.push(`#${oTag}`, oTag);
        }

        villageItems.push({
            id: `village-${cleanTag}`,
            type: 'village',
            scopes: ['villages'],
            parent: 'global',
            title: villageName,
            canonicalTitle: villageName.toLowerCase(),
            canonicalTokens: 'village account saved villages',
            normalizedTitle: normalizedParts.join(' '),
            category: villagesCategory,
            subtitle: translate('views.spotright.villageSubtitle', { tag: cleanTag, th: thLevel }),
            icon: `assets/th/th${thLevel}.png`,
            iconType: 'image',
            acronym: villageName.slice(0, 2).toLowerCase(),
            priorityTier: isActive ? 24 : 22,
            isVillage: true,
            isActiveVillage: isActive,
            cleanTag,
            displayTag,
            thLevel,
            trophies: Number(trophies) || 0,
            hasTrophies: trophies != null,
            clanName,
            clanBadge,
            leagueName,
            leagueIcon,
            execute: () => switchOrLoadPlayerTag(cleanTag)
        });
    }

    return villageItems;
}

/**
 * Builds the complete pre-indexed Spotright registry filtered for the active route topology.
 * @returns {SpotrightItem[]}
 */
export function buildSpotrightRegistry() {
    const routeCtx = getCurrentRouteContext();

    const toolsCategory = resolveI18nText('nav.drawerTitle', 'Tabs & Tools');
    const settingsCategory = resolveI18nText('nav.settings', 'Settings');
    const villagesCategory = resolveI18nText('nav.views.hub.villages', 'Saved Villages');
    const heroesCategory = resolveI18nText('views.damageCalc.filters.filterHeroes', 'Heroes');
    const equipmentCategory = resolveI18nText('nav.equipment', 'Equipment');
    const heroJourneyContext = resolveI18nText('nav.context.heroJourney', 'Hero Journey');
    const hubTitle = resolveI18nText('nav.views.hub.tools', 'Progression & Tactical Tools');
    const damageCalcTitle = resolveI18nText('views.damageCalc.title', 'Equipment Damage & ZapQuake');
    const priorityListTitle = resolveI18nText('views.planner.priorityList', 'Priority List');
    const settingsTitle = resolveI18nText('nav.settings', 'Settings');
    const manageVillagesTitle = resolveI18nText('views.landing.manageVillages', 'Manage Villages');
    const addPlayerTitle = resolveI18nText('player.addPlayer', 'Add a player');
    const refreshTitle = resolveI18nText('actions.refresh', 'Refresh');
    const accountSyncTitle = resolveI18nText('views.settings.cards.accountAndSync', 'Account & Cloud Sync');
    const changelogTitle = resolveI18nText('views.changelog.title', 'Changelog');
    const projectCostsTitle = resolveI18nText('views.settings.projectCosts.title', 'Project Costs');
    const toggleThemeTitle = resolveI18nText('actions.toggleTheme', 'Toggle Theme');

    /** @type {SpotrightItem[]} */
    const items = [
        {
            id: 'page-hub', type: 'page', parent: 'hub', scopes: ['tools'],
            title: hubTitle, canonicalTitle: 'progression & tactical tools',
            canonicalTokens: 'progression tactical tools hub home start overview dashboard portal',
            normalizedTitle: `${hubTitle.toLowerCase()} progression tactical tools hub home start fortschritt taktik übersicht portal`,
            category: toolsCategory, icon: 'home-filled', iconType: 'svg', acronym: 'pt', priorityTier: 25,
            execute: () => navigateToTarget({ parent: 'hub' })
        },
        {
            id: 'page-orecalc', type: 'page', parent: 'orecalc', defaultTab: 'home', defaultTabs: ['home', 'equipment'], scopes: ['tools'],
            title: 'Ore & Equipment Calculator', normalizedTitle: 'ore & equipment calculator',
            category: toolsCategory, icon: 'equipment-filled', iconType: 'svg', acronym: 'oc', priorityTier: 25,
            execute: () => navigateToTarget({ parent: 'orecalc', defaultTab: 'home' })
        },
        {
            id: 'tab-planner', type: 'tab', parent: 'orecalc', defaultTab: 'home', tabId: 'planner', scopes: ['tools'],
            parentContext: 'OreCalc', title: 'Upgrade Planner & Calendar', normalizedTitle: 'upgrade planner & calendar',
            category: toolsCategory, icon: 'planner-filled', iconType: 'svg', acronym: 'up', priorityTier: 25,
            execute: () => navigateToTarget({ parent: 'orecalc', defaultTab: 'home', tabId: 'planner' })
        },
        {
            id: 'modal-priority-list', type: 'modal', parent: 'orecalc', visibility: 'parent-only', scopes: ['tools'],
            parentContext: 'OreCalc', title: priorityListTitle, canonicalTitle: 'priority list',
            canonicalTokens: 'upgrade priority list planner ranking order',
            normalizedTitle: `${priorityListTitle.toLowerCase()} upgrade prioritätenliste prioritäten-liste planner reihenfolge`,
            category: toolsCategory, icon: 'planner-filled', iconType: 'svg', acronym: 'pl', priorityTier: 22,
            execute: async () => {
                const { openPriorityListModal } = await import('../planner/priorityListModalInputs.js');
                openPriorityListModal();
            }
        },
        {
            id: 'tab-income', type: 'tab', parent: 'orecalc', defaultTab: 'home', tabId: 'income', scopes: ['tools'],
            parentContext: 'OreCalc', title: 'Daily Ore Income Simulator', normalizedTitle: 'daily ore income simulator',
            category: toolsCategory, icon: 'income-filled', iconType: 'svg', acronym: 'di', priorityTier: 25,
            execute: () => navigateToTarget({ parent: 'orecalc', defaultTab: 'home', tabId: 'income' })
        },
        {
            id: 'page-hero-journey', type: 'page', parent: 'hero-journey', scopes: ['tools'],
            title: "Hero's Journey Tracker", normalizedTitle: "hero's journey tracker",
            category: toolsCategory, icon: 'timeline', iconType: 'svg', acronym: 'hj', priorityTier: 25,
            execute: () => navigateToTarget({ parent: 'hero-journey' })
        },
        {
            id: 'section-hero-journey-table', type: 'section', parent: 'hero-journey', sectionId: 'hero-journey-table', scopes: ['tools'],
            parentContext: heroJourneyContext, title: 'Hero Journey Rewards Table', normalizedTitle: 'hero journey rewards table',
            category: toolsCategory, icon: 'table-view', iconType: 'svg', acronym: 'rt', priorityTier: 25,
            execute: () => navigateToTarget({ parent: 'hero-journey', sectionId: 'hero-journey-table' })
        },
        {
            id: 'page-damagecalc', type: 'page', parent: 'damagecalc', defaultTab: 'zapquake', scopes: ['tools'],
            parentContext: 'DamageCalc', title: damageCalcTitle, canonicalTitle: 'equipment damage & zapquake',
            canonicalTokens: 'equipment damage zapquake solver spells defense',
            normalizedTitle: `${damageCalcTitle.toLowerCase()} equipment damage zapquake solver ausrüstung schaden zauber`,
            category: toolsCategory, icon: 'swords-filled', iconType: 'svg', acronym: 'zq', priorityTier: 25,
            execute: () => navigateToTarget({ parent: 'damagecalc', defaultTab: 'zapquake' })
        },
        {
            id: 'tab-cluster-planner', type: 'tab', parent: 'damagecalc', defaultTab: 'zapquake', tabId: 'cluster-planner', scopes: ['tools'],
            parentContext: 'DamageCalc', title: 'Cluster Defense Planner', normalizedTitle: 'cluster defense planner',
            category: toolsCategory, icon: 'bolt-planner', iconType: 'svg', acronym: 'cp', priorityTier: 25,
            execute: () => navigateToTarget({ parent: 'damagecalc', defaultTab: 'zapquake', tabId: 'cluster-planner' })
        },
        {
            id: 'action-settings', type: 'action', parent: 'global', scopes: ['settings'],
            title: settingsTitle, canonicalTitle: 'settings', canonicalTokens: 'app settings options preferences',
            normalizedTitle: `${settingsTitle.toLowerCase()} optionen einstellungen`,
            category: settingsCategory, icon: 'settings-filled', iconType: 'svg', acronym: 'as', priorityTier: 15,
            execute: executeSettingsAction
        },
        {
            id: 'action-manage-villages', type: 'action', parent: 'global', scopes: ['settings'],
            title: manageVillagesTitle, canonicalTitle: 'manage villages',
            canonicalTokens: 'player & village manager accounts switch profiles',
            normalizedTitle: `${manageVillagesTitle.toLowerCase()} dörfer verwalten dorf spieler konten`,
            category: settingsCategory, icon: 'user-filled', iconType: 'svg', acronym: 'pm', priorityTier: 15,
            execute: executeManageVillagesAction
        },
        {
            id: 'action-add-player', type: 'action', parent: 'global', scopes: ['villages'],
            title: addPlayerTitle, canonicalTitle: 'add a player',
            canonicalTokens: 'add player tag village link new account',
            normalizedTitle: [addPlayerTitle.toLowerCase(), 'spieler', 'spielerkürzel', 'hinzufügen'].join(' '),
            category: settingsCategory, icon: 'plus', iconType: 'svg', acronym: 'ap', priorityTier: 18,
            execute: executeAddPlayerAction
        },
        {
            id: 'action-toggle-theme', type: 'action', parent: 'global', scopes: ['settings'],
            title: toggleThemeTitle, canonicalTitle: 'toggle theme',
            canonicalTokens: 'toggle theme dark light mode appearance color scheme farbschema umschalten',
            normalizedTitle: `${toggleThemeTitle.toLowerCase()} toggle theme dark light mode appearance farbschema umschalten hell dunkel farbmodus`,
            category: settingsCategory,
            icon: (typeof document !== 'undefined' && (document.documentElement?.classList?.contains('light-mode') || document.body?.classList?.contains('light-mode')))
                ? 'dark-mode'
                : 'light-mode',
            iconType: 'svg', acronym: 'tt', priorityTier: 21,
            execute: () => {
                import('../common/appSettings.js').then(({ toggleAppTheme }) => toggleAppTheme()).catch(() => {});
            }
        },
        {
            id: 'action-refresh-village', type: 'action', parent: 'global', scopes: ['settings'],
            title: refreshTitle, canonicalTitle: 'refresh',
            canonicalTokens: 'refresh village data sync player stats profile',
            normalizedTitle: [refreshTitle.toLowerCase(), 'aktualisieren', 'synchronisieren', 'neu laden'].join(' '),
            category: settingsCategory, icon: 'refresh', iconType: 'svg', acronym: 'rf', priorityTier: 22,
            execute: executeRefreshVillageAction
        },
        {
            id: 'modal-account-sync', type: 'modal', parent: 'global', scopes: ['settings'],
            title: accountSyncTitle, canonicalTitle: 'account & cloud sync',
            canonicalTokens: 'cloud save passkeys sync backup security',
            normalizedTitle: `${accountSyncTitle.toLowerCase()} cloud synchronisierung passkeys konto sicherung`,
            category: settingsCategory, icon: 'sync-cloud', iconType: 'svg', acronym: 'cs', priorityTier: 15,
            execute: executeAccountSyncAction
        },
        {
            id: 'modal-changelog', type: 'modal', parent: 'global', scopes: ['settings'],
            title: changelogTitle, canonicalTitle: 'changelog',
            canonicalTokens: 'recent updates patch notes version history',
            normalizedTitle: `${changelogTitle.toLowerCase()} änderungsprotokoll updates patch notes versionen`,
            category: settingsCategory, icon: 'changelog', iconType: 'svg', acronym: 'cl', priorityTier: 15,
            execute: async () => {
                if (typeof document === 'undefined') return;
                const link = /** @type {HTMLElement | null} */ (document.querySelector('[data-modal-target="changelog-modal"]'));
                if (link && typeof link.click === 'function') {
                    link.click();
                } else {
                    const { getChangelogHtml } = await import('../../services/changelogService.js');
                    const { showChangelogModal } = await import('../changelog/changelogModal.js');
                    showChangelogModal(await getChangelogHtml());
                }
            }
        },
        {
            id: 'modal-project-costs', type: 'modal', parent: 'global', scopes: ['settings'],
            title: projectCostsTitle, canonicalTitle: 'project costs',
            canonicalTokens: 'running costs transparency hosting expenses infrastructure',
            normalizedTitle: `${projectCostsTitle.toLowerCase()} laufende kosten projektkosten transparenz server hosting`,
            category: settingsCategory, icon: 'costs', iconType: 'svg', acronym: 'pr', priorityTier: 15,
            execute: async () => {
                if (typeof document === 'undefined') return;
                const { openRunningCostsModal } = await import('../appSettings/settingsSupportModals.js');
                openRunningCostsModal();
            }
        },
        ...buildSavedVillageItems(villagesCategory)
    ];

    for (const heroKey in heroData) {
        const hero = heroData[heroKey];
        const canonicalHeroName = hero.name;
        const heroKeyPath = `entities.heroes.${heroKey}`;
        const translatedHero = translate(heroKeyPath);
        const localizedHeroName = (translatedHero && translatedHero !== heroKeyPath) ? translatedHero : canonicalHeroName;
        const heroAcronym = HERO_ACRONYMS[heroKey] || canonicalHeroName.slice(0, 2).toLowerCase();

        items.push({
            id: `hero-${heroKey}`,
            type: 'hero',
            scopes: ['hero'],
            parent: 'orecalc',
            parents: ['orecalc'],
            title: localizedHeroName,
            canonicalTitle: canonicalHeroName.toLowerCase(),
            canonicalTokens: canonicalHeroName.toLowerCase(),
            normalizedTitle: localizedHeroName.toLowerCase(),
            category: heroesCategory,
            icon: hero.image,
            iconType: 'image',
            acronym: heroAcronym,
            heroKey,
            heroName: localizedHeroName,
            heroAcronym,
            priorityTier: 30,
            execute: () => navigateToHero(canonicalHeroName, heroKey)
        });

        for (const equip of hero.equipment) {
            const equipKey = equip.key;
            const canonicalEquipName = equip.name;
            const equipKeyPath = `entities.equipment.${equipKey}`;
            const translatedEquip = translate(equipKeyPath);
            const localizedEquipName = (translatedEquip && translatedEquip !== equipKeyPath) ? translatedEquip : canonicalEquipName;
            const equipAcronym = EQUIPMENT_ACRONYMS[equipKey] || canonicalEquipName.slice(0, 2).toLowerCase();
            const rarity = equip.type === 'epic' ? 'epic' : 'common';
            const damageEquipKey = DAMAGE_EQUIPMENT_MAP[equipKey];
            /** @type {import('./spotrightNavigator.js').SpotrightParent[]} */
            const parents = damageEquipKey ? ['damagecalc', 'orecalc'] : ['orecalc'];
            const priorityTier = (routeCtx.page === 'damagecalc' && damageEquipKey)
                ? (rarity === 'epic' ? 35 : 32)
                : (rarity === 'epic' ? 20 : 10);

            items.push({
                id: `equip-${heroKey}-${equipKey}`,
                type: 'equipment',
                rarity,
                scopes: ['equipment'],
                parent: parents[0],
                parents,
                damageEquipKey,
                title: localizedEquipName,
                canonicalTitle: canonicalEquipName.toLowerCase(),
                canonicalTokens: canonicalEquipName.toLowerCase(),
                normalizedTitle: localizedEquipName.toLowerCase(),
                category: equipmentCategory,
                icon: equip.image,
                iconType: 'image',
                acronym: equipAcronym,
                heroKey,
                heroName: localizedHeroName,
                heroAcronym,
                compositeAcronym: `${heroAcronym} ${equipAcronym}`,
                compactComposite: `${heroAcronym}${equipAcronym}`,
                compositeTitle: `${localizedHeroName.toLowerCase()} ${localizedEquipName.toLowerCase()}`,
                canonicalCompositeTitle: `${canonicalHeroName.toLowerCase()} ${canonicalEquipName.toLowerCase()}`,
                priorityTier,
                execute: () => dispatchEquipmentAction({
                    heroName: canonicalHeroName,
                    equipName: canonicalEquipName,
                    equipKey,
                    damageEquipKey,
                    parents
                })
            });
        }
    }

    return items.filter(item => !isSelfTarget(item, routeCtx));
}
