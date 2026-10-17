/**
 * Spotright Pre-Indexed Search Registry for ClashCalc.
 * Pre-computes normalized titles, 2-letter acronyms, composite keys, and execution handlers.
 * Tier 4: Search Component Registry.
 */

import { heroData } from '../../data/heroData.js';
import { getLanguageFromPath } from '../../core/languageRouter.js';
import { toCamelCase } from '../../utils/stringUtils.js';
import { getSavedProfiles } from '../../core/playerStorage.js';
import { normalizePlayerTag } from '../../core/storageKeys.js';
import { translate } from '../../i18n/translator.js';
import { switchOrLoadPlayerTag } from './spotrightClipboard.js';

/**
 * @typedef {Object} SpotrightItem
 * @property {string} id - Unique entity identifier.
 * @property {string} title - Human-readable display title.
 * @property {string} normalizedTitle - Lowercase normalized title for search.
 * @property {string} category - Category label (e.g. 'Equipment', 'Hero', 'Tools & Views', 'Modals').
 * @property {string} subtitle - Secondary descriptive text.
 * @property {string} icon - Asset path or SVG symbol name.
 * @property {'image'|'svg'} iconType - Rendering type for the icon.
 * @property {string} actionCue - Action suffix verb (e.g. 'View Equipment', 'Jump to Tab').
 * @property {string} acronym - 2-letter canonical acronym.
 * @property {string} [heroKey] - Associated hero key if equipment.
 * @property {string} [heroName] - Associated hero display name if equipment.
 * @property {string} [heroAcronym] - 2-letter hero acronym if equipment.
 * @property {string} [compositeAcronym] - Space-separated hero+equipment acronym (e.g. 'rc eb').
 * @property {string} [compactComposite] - Compact hero+equipment acronym (e.g. 'rceb').
 * @property {string} [compositeTitle] - Full hero + equipment name for multi-token search.
 * @property {'hero'|'epic'|'common'|'nav'|'modal'} entityType - Entity type for tiebreaking.
 * @property {number} priorityTier - Base priority score (Hero=30, Epic=20, Nav=25, Modal=15, Common=10).
 * @property {boolean} [isAsyncAction] - Whether the action performs an asynchronous lookup before closing.
 * @property {boolean} [isLoading] - True when action is currently in flight.
 * @property {string | null} [errorMessage] - Inline error feedback to render.
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
 * Builds the complete static pre-indexed Spotright registry.
 * @returns {SpotrightItem[]}
 */
export function buildSpotrightRegistry() {
    const items = [];
    const prefix = getRoutePrefix();

    // 1. Core Tools & Pages
    items.push(
        {
            id: 'tool-hub',
            title: 'Progression Hub',
            normalizedTitle: 'progression hub',
            category: 'Tools & Views',
            subtitle: 'Home · Clash of Clans Tool Portal',
            icon: 'home-filled',
            iconType: 'svg',
            actionCue: 'Go to Hub',
            acronym: 'ph',
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
            category: 'Tools & Views',
            subtitle: 'Tool · Ore upgrades, costs, & equipment levels',
            icon: 'equipment-filled',
            iconType: 'svg',
            actionCue: 'Launch Calculator',
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
            category: 'Tools & Views',
            subtitle: 'OreCalc Tab · Schedule upgrades & time-to-max',
            icon: 'planner-filled',
            iconType: 'svg',
            actionCue: 'Jump to Planner',
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
            category: 'Tools & Views',
            subtitle: 'OreCalc Tab · Star Bonus, Clan Wars, CWL, Trader',
            icon: 'income-filled',
            iconType: 'svg',
            actionCue: 'Jump to Income',
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
            category: 'Tools & Views',
            subtitle: 'Tool · Milestone track, chest odds & rewards',
            icon: 'timeline',
            iconType: 'svg',
            actionCue: 'Explore Journey',
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
            category: 'Tools & Views',
            subtitle: 'Journey View · Detailed tabular breakdown of all chests',
            icon: 'table-view',
            iconType: 'svg',
            actionCue: 'View Rewards Table',
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
            title: 'Equipment Damage & ZapQuake',
            normalizedTitle: 'equipment damage & zapquake',
            category: 'Tools & Views',
            subtitle: 'Tool · Defense sniping thresholds & spell combos',
            icon: 'swords-filled',
            iconType: 'svg',
            actionCue: 'Launch Simulator',
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
            category: 'Tools & Views',
            subtitle: 'DamageCalc Tab · Multi-target snipe optimizer',
            icon: 'bolt-planner',
            iconType: 'svg',
            actionCue: 'Jump to Cluster Planner',
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
    items.push(
        {
            id: 'modal-settings',
            title: 'App Settings',
            normalizedTitle: 'app settings',
            category: 'Modals & Actions',
            subtitle: 'Preferences · Card layout, leagues, backup & restore',
            icon: 'settings-filled',
            iconType: 'svg',
            actionCue: 'Open Modal',
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
            title: 'Player & Village Manager',
            normalizedTitle: 'player & village manager',
            category: 'Modals & Actions',
            subtitle: 'Profiles · Switch, add or sync player tags',
            icon: 'user',
            iconType: 'svg',
            actionCue: 'Open Modal',
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
            title: translate('views.spotright.addPlayer') || 'Add Player Tag',
            normalizedTitle: 'add player tag village link new account',
            category: 'Modals & Actions',
            subtitle: translate('views.spotright.addPlayerSubtitle') || 'Accounts · Link and track a new Clash of Clans village',
            icon: 'plus',
            iconType: 'svg',
            actionCue: translate('views.landing.addVillage') || 'Add Village',
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
            id: 'modal-cloud-save',
            title: 'Cloud Save & Passkeys Sync',
            normalizedTitle: 'cloud save & passkeys sync',
            category: 'Modals & Actions',
            subtitle: 'Account · Cloud backup, passkeys, & cross-device link',
            icon: 'sync-cloud',
            iconType: 'svg',
            actionCue: 'Open Modal',
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
            title: 'Upgrade Priority List',
            normalizedTitle: 'upgrade priority list',
            category: 'Modals & Actions',
            subtitle: 'Planner · Reorder and prioritize scheduled upgrades',
            icon: 'planner-filled',
            iconType: 'svg',
            actionCue: 'Open Modal',
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
            title: 'Changelog & Recent Updates',
            normalizedTitle: 'changelog & recent updates',
            category: 'Modals & Actions',
            subtitle: 'Version history · Recent balance changes & patch notes',
            icon: 'changelog',
            iconType: 'svg',
            actionCue: 'Open Modal',
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
            title: 'Project Running Costs & Transparency',
            normalizedTitle: 'project running costs & transparency',
            category: 'Modals & Actions',
            subtitle: 'About · Hosting, API, and cloud infrastructure expenses',
            icon: 'costs',
            iconType: 'svg',
            actionCue: 'Open Modal',
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
        const villageName = profile.name || `#${cleanTag}`;
        const thLevel = profile.townHallLevel || 1;
        const isActive = Boolean(activeUrlTag && normalizePlayerTag(activeUrlTag) === cleanTag);

        items.push({
            id: `village-${cleanTag}`,
            title: villageName,
            normalizedTitle: `${villageName.toLowerCase()} #${cleanTag.toLowerCase()} ${cleanTag.toLowerCase()} village account`,
            category: 'Villages',
            subtitle: translate('views.spotright.villageSubtitle', { tag: cleanTag, th: thLevel }),
            icon: 'user',
            iconType: 'svg',
            actionCue: translate('nav.context.switchVillage'),
            acronym: villageName.slice(0, 2).toLowerCase(),
            entityType: 'modal',
            priorityTier: isActive ? 24 : 22,
            execute: () => switchOrLoadPlayerTag(cleanTag)
        });
    }

    // 4. Heroes & Equipment
    for (const heroKey in heroData) {
        const hero = heroData[heroKey];
        const heroName = hero.name;
        const heroAcronym = HERO_ACRONYMS[heroKey] || heroName.slice(0, 2).toLowerCase();

        // Register Hero Entity
        items.push({
            id: `hero-${heroKey}`,
            title: heroName,
            normalizedTitle: heroName.toLowerCase(),
            category: 'Heroes',
            subtitle: `Hero · ${hero.equipment.length} equipment items`,
            icon: hero.image,
            iconType: 'image',
            actionCue: 'View Hero Card',
            acronym: heroAcronym,
            heroKey,
            heroName,
            heroAcronym,
            entityType: 'hero',
            priorityTier: 30,
            execute: () => navigateToHero(heroName, heroKey)
        });

        // Register Hero Equipment Entities
        for (const equip of hero.equipment) {
            const equipKey = equip.key;
            const equipName = equip.name;
            const equipAcronym = EQUIPMENT_ACRONYMS[equipKey] || equipName.slice(0, 2).toLowerCase();
            const rarity = equip.type || 'common';
            const rarityLabel = rarity === 'epic' ? 'Epic' : 'Common';
            const priorityTier = rarity === 'epic' ? 20 : 10;

            const compositeAcronym = `${heroAcronym} ${equipAcronym}`;
            const compactComposite = `${heroAcronym}${equipAcronym}`;
            const compositeTitle = `${heroName.toLowerCase()} ${equipName.toLowerCase()}`;

            items.push({
                id: `equip-${heroKey}-${equipKey}`,
                title: equipName,
                normalizedTitle: equipName.toLowerCase(),
                category: 'Equipment',
                subtitle: `${heroName} · ${rarityLabel}`,
                icon: equip.image,
                iconType: 'image',
                actionCue: 'View Equipment',
                acronym: equipAcronym,
                heroKey,
                heroName,
                heroAcronym,
                compositeAcronym,
                compactComposite,
                compositeTitle,
                entityType: rarity === 'epic' ? 'epic' : 'common',
                priorityTier,
                execute: () => navigateToEquipment(heroName, equipName, equipKey)
            });
        }
    }

    return items;
}
