/**
 * Spotright Pre-Indexed Search Registry for ClashCalc.
 * Pre-computes normalized titles, 2-letter acronyms, composite keys, and execution handlers.
 * Tier 4: Search Component Registry.
 */

import { heroData } from '../../data/heroData.js';
import { getLanguageFromPath } from '../../core/languageRouter.js';
import { toCamelCase } from '../../utils/stringUtils.js';
import { getSavedProfiles } from '../../core/playerStorage.js';
import { formatDisplayTag, normalizePlayerTag } from '../../core/storageKeys.js';
import { UNRANKED_LEAGUE_ID } from '../../core/constants.js';
import { leagueTiers } from '../../data/leagueTiers.js';
import { translate } from '../../i18n/translator.js';
import { switchOrLoadPlayerTag } from './spotrightClipboard.js';

/**
 * @typedef {Object} SpotrightItem
 * @property {string} id - Unique entity identifier.
 * @property {string} title - Human-readable display title.
 * @property {string} [canonicalTitle] - Lowercase English canonical title for multilingual search.
 * @property {string} [canonicalTokens] - Space-separated English fallback tokens for search.
 * @property {string} normalizedTitle - Lowercase normalized title for search.
 * @property {string} category - Category label (e.g. 'Equipment', 'Hero', 'Tools & Views', 'Modals').
 * @property {string} [subtitle] - Secondary descriptive text.
 * @property {string} [parentContext] - Parent tool context for sub-tab items (e.g. 'OreCalc', heroJourneyContext).
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
 * @property {'hero'|'epic'|'common'|'nav'|'modal'} entityType - Entity type for tiebreaking.
 * @property {number} priorityTier - Base priority score (Hero=30, Epic=20, Nav=25, Modal=15, Common=10).
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
    // Barbarian King
    barbarianPuppet: 'bp',
    rageVial: 'rv',
    earthquakeBoots: 'eb',
    vampstache: 'va',
    giantGauntlet: 'gg',
    spikyBall: 'sb',
    snakeBracelet: 'sb',
    stickHorse: 'sh',

    // Archer Queen
    archerPuppet: 'ap',
    invisibilityVial: 'iv',
    giantArrow: 'ga',
    healerPuppet: 'hp',
    frozenArrow: 'fa',
    magicMirror: 'mm',
    actionFigure: 'af',
    monolithArrow: 'ma',

    // Minion Prince
    henchmenPuppet: 'hp',
    darkOrb: 'do',
    metalPants: 'mp',
    nobleIron: 'ni',
    darkCrown: 'dc',
    meteorStaff: 'ms',
    portalPendant: 'pp',

    // Grand Warden
    eternalTome: 'et',
    lifeGem: 'lg',
    rageGem: 'rg',
    healingTome: 'ht',
    fireball: 'fb',
    lavaloonPuppet: 'lp',
    heroicTorch: 'ht',

    // Royal Champion
    royalGem: 'rg',
    seekingShield: 'ss',
    hogRiderPuppet: 'hr',
    hasteVial: 'hv',
    rocketSpear: 'rs',
    electroBoots: 'eb',
    frostFlake: 'ff',

    // Dragon Duke
    fireHeart: 'fh',
    flameBlower: 'fb',
    stunBlaster: 'sb',
    electroFangs: 'ef',
    rocketBackpack: 'rb',
    revengeDeck: 'rd'
};

/**
 * Returns localized route prefix based on active URL path.
 * @returns {string}
 */
function getRoutePrefix() {
    if (typeof window === 'undefined') return '';
    const lang = getLanguageFromPath() || 'en';
    return lang === 'en' ? '' : `/${lang}`;
}

/**
 * Handles smooth scrolling and temporary pulsing highlight on equipment card.
 * @param {string} heroName
 * @param {string} equipName
 * @param {string} equipKey
 */
export function navigateToEquipment(heroName, equipName, equipKey) {
    if (typeof window === 'undefined') return;
    const isOreCalcPage = window.location.pathname.includes('/ore-calculator');
    const prefix = getRoutePrefix();

    if (isOreCalcPage) {
        const raf = typeof window.requestAnimationFrame === 'function' ? window.requestAnimationFrame.bind(window) : (cb) => cb();
        const equipTabBtn = document.querySelector('.tab-button[data-tab="equipment"], .nav-button[data-tab="equipment"]');
        if (equipTabBtn && typeof equipTabBtn.click === 'function' && !equipTabBtn.classList?.contains('active')) {
            equipTabBtn.click();
        }

        raf(() => {
            const heroCard = document.querySelector(`[data-hero-name="${heroName}"]`);
            const equipRow = heroCard?.querySelector(`[data-equip-name="${equipName}"]`);
            const targetEl = equipRow || heroCard;

            if (targetEl && typeof targetEl.scrollIntoView === 'function') {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetEl.classList?.remove('spotright-target-pulse');
                raf(() => {
                    targetEl.classList?.add('spotright-target-pulse');
                });
                setTimeout(() => targetEl.classList?.remove('spotright-target-pulse'), 1800);

                raf(() => {
                    const input = equipRow?.querySelector('input[type="number"]');
                    if (input && typeof input.focus === 'function' && input.offsetParent !== null) {
                        input.focus();
                        if (typeof input.select === 'function') input.select();
                    }
                });
            }
        });
        return;
    }

    window.location.href = `${prefix}/ore-calculator/#equip-${equipKey}`;
}

/**
 * Handles smooth scrolling to target hero card.
 * @param {string} heroName
 * @param {string} heroKey
 */
export function navigateToHero(heroName, heroKey) {
    if (typeof window === 'undefined') return;
    const isOreCalcPage = window.location.pathname.includes('/ore-calculator');
    const prefix = getRoutePrefix();

    if (isOreCalcPage) {
        const raf = typeof window.requestAnimationFrame === 'function' ? window.requestAnimationFrame.bind(window) : (cb) => cb();
        const equipTabBtn = document.querySelector('.tab-button[data-tab="equipment"], .nav-button[data-tab="equipment"]');
        if (equipTabBtn && typeof equipTabBtn.click === 'function' && !equipTabBtn.classList?.contains('active')) {
            equipTabBtn.click();
        }

        raf(() => {
            const heroCard = document.querySelector(`[data-hero-name="${heroName}"]`);
            if (heroCard && typeof heroCard.scrollIntoView === 'function') {
                heroCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                heroCard.classList?.remove('spotright-target-pulse');
                raf(() => {
                    heroCard.classList?.add('spotright-target-pulse');
                });
                setTimeout(() => heroCard.classList?.remove('spotright-target-pulse'), 1800);
            }
        });
        return;
    }

    window.location.href = `${prefix}/ore-calculator/#hero-${heroKey}`;
}

/**
 * Resolves incoming Spotright deep-link hash on page load.
 */
export function handleSpotrightDeepLink() {
    if (typeof window === 'undefined' || !window.location.hash) return;
    const hash = window.location.hash;

    if (hash.startsWith('#equip-')) {
        const targetKey = hash.substring(7);
        for (const heroKey in heroData) {
            const hero = heroData[heroKey];
            const equip = hero.equipment.find(e => toCamelCase(e.name) === targetKey || e.key === targetKey);
            if (equip) {
                navigateToEquipment(hero.name, equip.name, targetKey);
                break;
            }
        }
    } else if (hash.startsWith('#hero-')) {
        const targetHeroKey = hash.substring(6);
        const hero = heroData[targetHeroKey];
        if (hero) {
            navigateToHero(hero.name, targetHeroKey);
        }
    }
}

/**
 * Resolves active player tag from URL parameters.
 * @returns {string}
 */
export function getActiveUrlTag() {
    if (typeof window === 'undefined') return '';
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const tagFromUrl = urlParams.get('tag');
        if (tagFromUrl) return normalizePlayerTag(tagFromUrl);
    } catch {}
    return '';
}

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
 * Builds the complete static pre-indexed Spotright registry.
 * @returns {SpotrightItem[]}
 */
export function buildSpotrightRegistry() {
    const items = [];
    const prefix = getRoutePrefix();

    const toolsCategory = resolveI18nText('nav.drawerTitle', 'Tabs & Tools');
    const settingsCategory = resolveI18nText('nav.settings', 'Settings');
    const villagesCategory = resolveI18nText('nav.views.hub.villages', 'Saved Villages');
    const heroesCategory = resolveI18nText('views.damageCalc.filters.filterHeroes', 'Heroes');
    const equipmentCategory = resolveI18nText('nav.equipment', 'Equipment');
    const heroJourneyContext = resolveI18nText('nav.context.heroJourney', 'Hero Journey');
    const hubTitle = resolveI18nText('nav.views.hub.tools', 'Progression & Tactical Tools');
    const damageCalcTitle = resolveI18nText('views.damageCalc.title', 'Equipment Damage & ZapQuake');

    // 1. Core Tools & Pages
    items.push(
        {
            id: 'tool-hub',
            title: hubTitle,
            canonicalTitle: 'progression & tactical tools',
            canonicalTokens: 'progression tactical tools hub home start overview dashboard portal',
            normalizedTitle: `${hubTitle.toLowerCase()} progression tactical tools hub home start fortschritt taktik übersicht portal`,
            category: toolsCategory,
            icon: 'home-filled',
            iconType: 'svg',
            acronym: 'pt',
            entityType: 'nav',
            priorityTier: 25,
            execute: () => {
                if (typeof window !== 'undefined' && (window.location.pathname === '/' || window.location.pathname === `${prefix}/`)) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else if (typeof window !== 'undefined') {
                    window.location.href = `${prefix}/`;
                }
            }
        },
        {
            id: 'tool-ore-calc',
            title: 'Ore & Equipment Calculator',
            normalizedTitle: 'ore & equipment calculator',
            category: toolsCategory,
            icon: 'equipment-filled',
            iconType: 'svg',
            acronym: 'oc',
            entityType: 'nav',
            priorityTier: 25,
            execute: () => {
                if (typeof window !== 'undefined' && window.location.pathname.includes('/ore-calculator')) {
                    const btn = document.querySelector('.tab-button[data-tab="equipment"], .nav-button[data-tab="equipment"]');
                    if (btn && typeof btn.click === 'function') btn.click();
                } else if (typeof window !== 'undefined') {
                    window.location.href = `${prefix}/ore-calculator/`;
                }
            }
        },
        {
            id: 'tool-planner',
            title: 'Upgrade Planner & Calendar',
            normalizedTitle: 'upgrade planner & calendar',
            category: toolsCategory,
            parentContext: 'OreCalc',
            icon: 'planner-filled',
            iconType: 'svg',
            acronym: 'up',
            entityType: 'nav',
            priorityTier: 25,
            execute: () => {
                if (typeof window !== 'undefined' && window.location.pathname.includes('/ore-calculator')) {
                    const btn = document.querySelector('.tab-button[data-tab="planner"], .nav-button[data-tab="planner"]');
                    if (btn && typeof btn.click === 'function') btn.click();
                } else if (typeof window !== 'undefined') {
                    window.location.href = `${prefix}/ore-calculator/#planner`;
                }
            }
        },
        {
            id: 'tool-income',
            title: 'Daily Ore Income Simulator',
            normalizedTitle: 'daily ore income simulator',
            category: toolsCategory,
            parentContext: 'OreCalc',
            icon: 'income-filled',
            iconType: 'svg',
            acronym: 'di',
            entityType: 'nav',
            priorityTier: 25,
            execute: () => {
                if (typeof window !== 'undefined' && window.location.pathname.includes('/ore-calculator')) {
                    const btn = document.querySelector('.tab-button[data-tab="income"], .nav-button[data-tab="income"]');
                    if (btn && typeof btn.click === 'function') btn.click();
                } else if (typeof window !== 'undefined') {
                    window.location.href = `${prefix}/ore-calculator/#income`;
                }
            }
        },
        {
            id: 'tool-hero-journey',
            title: "Hero's Journey Tracker",
            normalizedTitle: "hero's journey tracker",
            category: toolsCategory,
            icon: 'timeline',
            iconType: 'svg',
            acronym: 'hj',
            entityType: 'nav',
            priorityTier: 25,
            execute: () => {
                if (typeof window !== 'undefined' && window.location.pathname.includes('/hero-journey')) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else if (typeof window !== 'undefined') {
                    window.location.href = `${prefix}/hero-journey/`;
                }
            }
        },
        {
            id: 'tool-hj-table',
            title: 'Hero Journey Rewards Table',
            normalizedTitle: 'hero journey rewards table',
            category: toolsCategory,
            parentContext: heroJourneyContext,
            icon: 'table-view',
            iconType: 'svg',
            acronym: 'rt',
            entityType: 'nav',
            priorityTier: 25,
            execute: () => {
                if (typeof window !== 'undefined' && window.location.pathname.includes('/hero-journey')) {
                    const tableContainer = document.getElementById('hero-journey-table');
                    if (tableContainer) {
                        tableContainer.scrollIntoView({ behavior: 'smooth' });
                    } else {
                        window.location.hash = '#hero-journey-table';
                    }
                } else if (typeof window !== 'undefined') {
                    window.location.href = `${prefix}/hero-journey/#hero-journey-table`;
                }
            }
        },
        {
            id: 'tool-damage-calc',
            title: damageCalcTitle,
            canonicalTitle: 'equipment damage & zapquake',
            canonicalTokens: 'equipment damage zapquake solver spells defense',
            normalizedTitle: `${damageCalcTitle.toLowerCase()} equipment damage zapquake solver ausrüstung schaden zauber`,
            category: toolsCategory,
            icon: 'swords-filled',
            iconType: 'svg',
            acronym: 'zq',
            entityType: 'nav',
            priorityTier: 25,
            execute: () => {
                if (typeof window !== 'undefined' && window.location.pathname.includes('/damage-calculator')) {
                    const btn = document.querySelector('[data-tab="zapquake"]');
                    if (btn && typeof btn.click === 'function') btn.click();
                } else if (typeof window !== 'undefined') {
                    window.location.href = `${prefix}/damage-calculator/`;
                }
            }
        },
        {
            id: 'tool-cluster-planner',
            title: 'Cluster Defense Planner',
            normalizedTitle: 'cluster defense planner',
            category: toolsCategory,
            icon: 'bolt-planner',
            iconType: 'svg',
            acronym: 'cp',
            entityType: 'nav',
            priorityTier: 25,
            execute: () => {
                if (typeof window !== 'undefined' && window.location.pathname.includes('/damage-calculator')) {
                    const btn = document.querySelector('[data-tab="cluster_planner"]');
                    if (btn && typeof btn.click === 'function') btn.click();
                } else if (typeof window !== 'undefined') {
                    window.location.href = `${prefix}/damage-calculator/#cluster_planner`;
                }
            }
        }
    );

    // 2. Primary Modals
    const settingsTitle = resolveI18nText('nav.settings', 'Settings');
    const manageVillagesTitle = resolveI18nText('views.landing.manageVillages', 'Manage Villages');
    const addPlayerTitle = resolveI18nText('player.addPlayer', 'Add a player');
    const refreshTitle = resolveI18nText('actions.refresh', 'Refresh');
    const accountSyncTitle = resolveI18nText('views.settings.cards.accountAndSync', 'Account & Cloud Sync');
    const priorityListTitle = resolveI18nText('views.planner.priorityList', 'Priority List');
    const changelogTitle = resolveI18nText('views.changelog.title', 'Changelog');
    const projectCostsTitle = resolveI18nText('views.settings.projectCosts.title', 'Project Costs');

    items.push(
        {
            id: 'modal-settings',
            title: settingsTitle,
            canonicalTitle: 'settings',
            canonicalTokens: 'app settings options preferences',
            normalizedTitle: `${settingsTitle.toLowerCase()} optionen einstellungen`,
            category: settingsCategory,
            icon: 'settings-filled',
            iconType: 'svg',
            acronym: 'as',
            entityType: 'modal',
            priorityTier: 15,
            execute: () => {
                const tabBtn = document.querySelector('.tab-button[data-tab="settings"], .nav-button[data-tab="settings"]');
                if (tabBtn && typeof tabBtn.click === 'function') {
                    tabBtn.click();
                } else if (typeof window !== 'undefined') {
                    window.location.href = `${prefix}/ore-calculator/#settings`;
                }
            }
        },
        {
            id: 'modal-player',
            title: manageVillagesTitle,
            canonicalTitle: 'manage villages',
            canonicalTokens: 'player & village manager accounts switch profiles',
            normalizedTitle: `${manageVillagesTitle.toLowerCase()} dörfer verwalten dorf spieler konten`,
            category: settingsCategory,
            icon: 'user',
            iconType: 'svg',
            acronym: 'pm',
            entityType: 'modal',
            priorityTier: 15,
            execute: async () => {
                if (typeof document === 'undefined') return;
                const addPlayerBtn = document.getElementById('add-player-button') || document.querySelector('[data-action="add-player"]');
                if (addPlayerBtn && typeof addPlayerBtn.click === 'function') {
                    addPlayerBtn.click();
                    return;
                }
                const isOreCalc = window.location.pathname.includes('/ore-calculator');
                if (isOreCalc) {
                    const { showAddPlayerModal } = await import('../player/playerModal.js');
                    showAddPlayerModal();
                } else {
                    window.location.href = `${prefix}/ore-calculator/#player`;
                }
            }
        },
        {
            id: 'action-add-player',
            title: addPlayerTitle,
            canonicalTitle: 'add a player',
            canonicalTokens: 'add player tag village link new account',
            normalizedTitle: [addPlayerTitle.toLowerCase(), 'spieler', 'spielerkürzel', 'hinzufügen'].join(' '),
            category: settingsCategory,
            icon: 'plus',
            iconType: 'svg',
            acronym: 'ap',
            entityType: 'modal',
            priorityTier: 18,
            execute: async () => {
                if (typeof document === 'undefined') return;
                const addPlayerBtn = document.getElementById('add-player-button') || document.querySelector('[data-action="add-player"]');
                if (addPlayerBtn && typeof addPlayerBtn.click === 'function') {
                    addPlayerBtn.click();
                    return;
                }
                const modal = /** @type {HTMLDialogElement | null} */ (document.getElementById('add-player-modal'));
                if (modal && typeof modal.showModal === 'function') {
                    const { openModal } = await import('../../utils/modalHistoryManager.js');
                    openModal(modal);
                    return;
                }
                window.location.href = `${prefix}/ore-calculator/#player`;
            }
        },
        {
            id: 'action-refresh-village',
            title: refreshTitle,
            canonicalTitle: 'refresh',
            canonicalTokens: 'refresh village data sync player stats profile',
            normalizedTitle: [refreshTitle.toLowerCase(), 'aktualisieren', 'synchronisieren', 'neu laden'].join(' '),
            category: settingsCategory,
            icon: 'refresh',
            iconType: 'svg',
            acronym: 'rf',
            entityType: 'modal',
            priorityTier: 22,
            execute: async () => {
                const { refreshActivePlayerData } = await import('../player/playerRefreshController.js');
                await refreshActivePlayerData({ force: true, background: false });
            }
        },
        {
            id: 'modal-cloud-save',
            title: accountSyncTitle,
            canonicalTitle: 'account & cloud sync',
            canonicalTokens: 'cloud save passkeys sync backup security',
            normalizedTitle: `${accountSyncTitle.toLowerCase()} cloud synchronisierung passkeys konto sicherung`,
            category: settingsCategory,
            icon: 'sync-cloud',
            iconType: 'svg',
            acronym: 'cs',
            entityType: 'modal',
            priorityTier: 15,
            execute: async () => {
                const { openAuthModal } = await import('../auth/authModalInputs.js');
                openAuthModal();
            }
        },
        {
            id: 'modal-priority-list',
            title: priorityListTitle,
            canonicalTitle: 'priority list',
            canonicalTokens: 'upgrade priority list planner ranking order',
            normalizedTitle: `${priorityListTitle.toLowerCase()} upgrade prioritätenliste prioritäten-liste planner reihenfolge`,
            category: settingsCategory,
            parentContext: 'OreCalc',
            icon: 'planner-filled',
            iconType: 'svg',
            acronym: 'pl',
            entityType: 'modal',
            priorityTier: 15,
            execute: async () => {
                if (typeof window !== 'undefined' && window.location.pathname.includes('/ore-calculator')) {
                    const { openPriorityListModal } = await import('../planner/priorityListModal.js');
                    openPriorityListModal();
                } else if (typeof window !== 'undefined') {
                    window.location.href = `${prefix}/ore-calculator/#planner`;
                }
            }
        },
        {
            id: 'modal-changelog',
            title: changelogTitle,
            canonicalTitle: 'changelog',
            canonicalTokens: 'recent updates patch notes version history',
            normalizedTitle: `${changelogTitle.toLowerCase()} änderungsprotokoll updates patch notes versionen`,
            category: settingsCategory,
            icon: 'changelog',
            iconType: 'svg',
            acronym: 'cl',
            entityType: 'modal',
            priorityTier: 15,
            execute: async () => {
                if (typeof document === 'undefined') return;
                const link = document.querySelector('[data-modal-target="changelog-modal"]');
                if (link && typeof link.click === 'function') {
                    link.click();
                } else {
                    const { getChangelogHtml } = await import('../../services/changelogService.js');
                    const { showChangelogModal } = await import('../changelog/changelogModal.js');
                    const html = await getChangelogHtml();
                    showChangelogModal(html);
                }
            }
        },
        {
            id: 'modal-running-costs',
            title: projectCostsTitle,
            canonicalTitle: 'project costs',
            canonicalTokens: 'running costs transparency hosting expenses infrastructure',
            normalizedTitle: `${projectCostsTitle.toLowerCase()} laufende kosten projektkosten transparenz server hosting`,
            category: settingsCategory,
            icon: 'costs',
            iconType: 'svg',
            acronym: 'pr',
            entityType: 'modal',
            priorityTier: 15,
            execute: () => {
                if (typeof document === 'undefined') return;
                const link = document.querySelector('[data-modal-target="running-costs-modal"]');
                if (link && typeof link.click === 'function') {
                    link.click();
                } else if (typeof window !== 'undefined') {
                    window.location.href = `${prefix}/ore-calculator/#settings`;
                }
            }
        }
    );

    // 3. Saved Villages (Multi-Account Switcher)
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
            if (translatedLeague && translatedLeague !== leagueKey) {
                leagueName = translatedLeague;
            }
        }
        if (!leagueName) {
            leagueName = translate('entities.leagues.unranked') || 'Unranked';
        }

        const normalizedParts = [
            villageName.toLowerCase(),
            displayTag.toLowerCase(),
            cleanTag.toLowerCase(),
            'dorf',
            'dörfer',
            'konto'
        ];
        if (clanName) {
            normalizedParts.push(clanName.toLowerCase());
        }
        if (cleanTag.includes('0')) {
            const oTag = cleanTag.replace(/0/g, 'O').toLowerCase();
            normalizedParts.push(`#${oTag}`, oTag);
        }

        items.push({
            id: `village-${cleanTag}`,
            title: villageName,
            canonicalTitle: villageName.toLowerCase(),
            canonicalTokens: 'village account saved villages',
            normalizedTitle: normalizedParts.join(' '),
            category: villagesCategory,
            subtitle: translate('views.spotright.villageSubtitle', { tag: cleanTag, th: thLevel }),
            icon: `assets/th/th${thLevel}.png`,
            iconType: 'image',
            acronym: villageName.slice(0, 2).toLowerCase(),
            entityType: 'modal',
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

    // 4. Heroes & Equipment
    for (const heroKey in heroData) {
        const hero = heroData[heroKey];
        const canonicalHeroName = hero.name;
        const heroKeyPath = `entities.heroes.${heroKey}`;
        const translatedHero = translate(heroKeyPath);
        const localizedHeroName = (translatedHero && translatedHero !== heroKeyPath) ? translatedHero : canonicalHeroName;
        const heroAcronym = HERO_ACRONYMS[heroKey] || canonicalHeroName.slice(0, 2).toLowerCase();

        const heroSearchTokens = [localizedHeroName.toLowerCase()];

        // Register Hero Entity
        items.push({
            id: `hero-${heroKey}`,
            title: localizedHeroName,
            canonicalTitle: canonicalHeroName.toLowerCase(),
            canonicalTokens: canonicalHeroName.toLowerCase(),
            normalizedTitle: heroSearchTokens.join(' '),
            category: heroesCategory,
            icon: hero.image,
            iconType: 'image',
            acronym: heroAcronym,
            heroKey,
            heroName: localizedHeroName,
            heroAcronym,
            entityType: 'hero',
            priorityTier: 30,
            execute: () => navigateToHero(canonicalHeroName, heroKey)
        });

        // Register Hero Equipment Entities
        for (const equip of hero.equipment) {
            const equipKey = equip.key;
            const canonicalEquipName = equip.name;
            const equipKeyPath = `entities.equipment.${equipKey}`;
            const translatedEquip = translate(equipKeyPath);
            const localizedEquipName = (translatedEquip && translatedEquip !== equipKeyPath) ? translatedEquip : canonicalEquipName;
            const equipAcronym = EQUIPMENT_ACRONYMS[equipKey] || canonicalEquipName.slice(0, 2).toLowerCase();
            const rarity = equip.type || 'common';
            const priorityTier = rarity === 'epic' ? 20 : 10;

            const compositeAcronym = `${heroAcronym} ${equipAcronym}`;
            const compactComposite = `${heroAcronym}${equipAcronym}`;

            const equipSearchTokens = [localizedEquipName.toLowerCase()];
            const compositeTitle = `${localizedHeroName.toLowerCase()} ${localizedEquipName.toLowerCase()}`;
            const canonicalCompositeTitle = `${canonicalHeroName.toLowerCase()} ${canonicalEquipName.toLowerCase()}`;

            items.push({
                id: `equip-${heroKey}-${equipKey}`,
                title: localizedEquipName,
                canonicalTitle: canonicalEquipName.toLowerCase(),
                canonicalTokens: canonicalEquipName.toLowerCase(),
                normalizedTitle: equipSearchTokens.join(' '),
                category: equipmentCategory,
                icon: equip.image,
                iconType: 'image',
                acronym: equipAcronym,
                heroKey,
                heroName: localizedHeroName,
                heroAcronym,
                compositeAcronym,
                compactComposite,
                compositeTitle,
                canonicalCompositeTitle,
                entityType: rarity === 'epic' ? 'epic' : 'common',
                priorityTier,
                execute: () => navigateToEquipment(canonicalHeroName, canonicalEquipName, equipKey)
            });
        }
    }

    return items;
}
