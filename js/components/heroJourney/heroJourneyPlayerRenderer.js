import { translate } from '../../i18n/translator.js';
import { safeJsonParse } from '../../utils/jsonUtils.js';
import { animateValue, formatNumber } from '../../utils/numberFormatter.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { leagueTiers } from '../../data/leagueTiers.js';
import { heroJourneyNodes } from '../../data/heroJourneyData.js';
import { getMaxCumulativeLevelsByTH, getNodeTownHallLevel } from '../../domain/income/heroJourneyLevels.js';
import { getQuestChestReward } from '../../domain/income/heroJourneyIncome.js';
import { resolveHeroJourneyTrack } from '../../domain/income/heroJourneyResolution.js';
import { formatClanRole } from '../home/homeProfileCalculations.js';
import { getLanguageFromPath } from '../../core/languageRouter.js';
import { normalizePlayerTag } from '../../core/localStorageManager.js';
import { hjState, buildStateFromPlayerData } from './heroJourneyState.js';

/**
 * Calculates total, claimed, and unclaimed ores across all Hero Journey milestones.
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @param {number} playerTH - Player's Town Hall level.
 * @param {boolean} isAccelerated - Whether chest rewards are in accelerated mode.
 * @returns {{ claimed: { shiny: number, glowy: number, starry: number }, unclaimed: { shiny: number, glowy: number, starry: number }, total: { shiny: number, glowy: number, starry: number } }}
 */
function calculateHeroJourneyOreTotals(state, playerTH, isAccelerated) {
    const cumulativeLevel = hjState.cumulativeLevel || 0;
    const maxLevelsByTH = getMaxCumulativeLevelsByTH();
    const allMaxValues = Object.values(maxLevelsByTH);
    const overallTrueMaxLevel = allMaxValues.length > 0 ? Math.max(...allMaxValues) : 0;
    const isTrueMaxPlayer = cumulativeLevel >= overallTrueMaxLevel && overallTrueMaxLevel > 0;
    const mode = isAccelerated ? 'accelerated' : 'normal';

    let claimedShiny = 0;
    let claimedGlowy = 0;
    let claimedStarry = 0;
    let unclaimedShiny = 0;
    let unclaimedGlowy = 0;
    let unclaimedStarry = 0;

    const trackResolution = resolveHeroJourneyTrack(state);

    for (const node of heroJourneyNodes) {
        const isReached = cumulativeLevel >= node.level;
        const isClaimed = isTrueMaxPlayer || isReached;

        if (node.type === 'quest') {
            if (isClaimed) {
                const nodeTH = getNodeTownHallLevel(node.level);
                const chestReward = getQuestChestReward(nodeTH, mode);
                claimedShiny += chestReward.shiny;
                claimedGlowy += chestReward.glowy;
                claimedStarry += chestReward.starry;
            } else {
                const effectiveTH = Math.max(playerTH, getNodeTownHallLevel(node.level));
                const chestReward = getQuestChestReward(effectiveTH, mode);
                unclaimedShiny += chestReward.shiny;
                unclaimedGlowy += chestReward.glowy;
                unclaimedStarry += chestReward.starry;
            }
        } else if (node.type === 'ore') {
            const amount = node.amount || 0;
            if (isClaimed) {
                if (node.resourceType === 'shiny') claimedShiny += amount;
                else if (node.resourceType === 'glowy') claimedGlowy += amount;
                else if (node.resourceType === 'starry') claimedStarry += amount;
            } else {
                if (node.resourceType === 'shiny') unclaimedShiny += amount;
                else if (node.resourceType === 'glowy') unclaimedGlowy += amount;
                else if (node.resourceType === 'starry') unclaimedStarry += amount;
            }
        } else if (node.type === 'equipment') {
            const resolved = trackResolution[node.level];
            if (resolved?.isFallbackStarry) {
                const amount = node.fallbackStarry || 50;
                if (isClaimed) claimedStarry += amount;
                else unclaimedStarry += amount;
            }
        }
    }

    const totalShiny = claimedShiny + unclaimedShiny;
    const totalGlowy = claimedGlowy + unclaimedGlowy;
    const totalStarry = claimedStarry + unclaimedStarry;

    return {
        claimed: { shiny: claimedShiny, glowy: claimedGlowy, starry: claimedStarry },
        unclaimed: { shiny: unclaimedShiny, glowy: unclaimedGlowy, starry: unclaimedStarry },
        total: { shiny: totalShiny, glowy: totalGlowy, starry: totalStarry }
    };
}

const hjRenderState = {
    renderedTag: null,
    renderedLang: null,
    renderedTH: null,
    renderedClan: null,
    renderedLeague: null,
    renderedAccelerated: null,
    lastProgress: null
};

/**
 * Applies incremental delta updates to the Hero Journey player card without rebuilding DOM.
 * @param {HTMLElement} container - Card element.
 * @param {any} prevProg - Previous progress metrics.
 * @param {any} currProg - Current progress metrics.
 */
function applyHeroJourneyProgressDelta(container, prevProg, currProg) {
    const prevOverall = prevProg.overall || 0;
    const currOverall = currProg.overall || 0;

    if (Math.round(prevOverall) !== Math.round(currOverall)) {
        const overallEl = container.querySelector('[data-ore-value="overall"]');
        const overallBar = /** @type {HTMLElement|null} */ (container.querySelector('.progress-bar-fill.overall-fill'));
        if (overallBar) {
            overallBar.style.width = `${currOverall}%`;
        }
        if (overallEl) {
            if (currProg.isTrueMaxPlayer) {
                animateValue(overallEl, prevOverall, currOverall, 1000, val => `${Math.round(val)}%`);
            } else {
                animateValue(overallEl, prevOverall, currOverall, 1000, val => {
                    const curLvl = Math.min(currProg.cumulativeLevel, Math.round((val / 100) * currProg.overallTrueMaxLevel));
                    return `${curLvl}/${currProg.overallTrueMaxLevel} (${Math.round(val)}%)`;
                });
            }
        }
    }

    const oreKeys = [
        { key: 'shiny', unclaimed: currProg.unclaimedShiny },
        { key: 'glowy', unclaimed: currProg.unclaimedGlowy },
        { key: 'starry', unclaimed: currProg.unclaimedStarry }
    ];

    for (const { key, unclaimed } of oreKeys) {
        const prev = prevProg[key] || 0;
        const curr = currProg[key] || 0;
        const box = container.querySelector(`[data-ore="${key}"]`)?.closest('.profile-stat-box');

        if (Math.round(prev) !== Math.round(curr)) {
            const valEl = container.querySelector(`[data-ore-value="${key}"]`);
            const bar = /** @type {HTMLElement|null} */ (container.querySelector(`[data-ore="${key}"] .progress-bar-fill`));
            if (bar) {
                bar.style.width = `${curr}%`;
            }
            if (valEl) {
                animateValue(valEl, prev, curr, 1000, val => `${Math.round(val)}%`);
            }
        }

        const subEl = box?.querySelector('.stat-box-sub span');
        if (subEl) {
            subEl.textContent = unclaimed > 0
                ? translate('views.heroJourneyPage.unclaimedCount', { count: formatNumber(Math.round(unclaimed)) })
                : translate('views.heroJourneyPage.allClaimed');
        }
    }
}

/**
 * Renders the top player summary card when player data is loaded.
 */
export function renderPlayerSummary() {
    const card = document.getElementById('hj-player-card');
    if (!card) return;

    if (hjState.isLoading && !hjState.playerData) {
        hjRenderState.renderedTag = null;
        hjRenderState.lastProgress = null;
        const isCollapsed = typeof sessionStorage !== 'undefined'
            ? sessionStorage.getItem('orecalc_hj_profile_stats_collapsed') !== 'false'
            : true;

        if (isCollapsed) {
            card.classList.add('is-stats-collapsed');
        } else {
            card.classList.remove('is-stats-collapsed');
        }

        card.style.display = 'flex';
        card.innerHTML = `
            <div class="hero-journey-page__player-header home-profile-header">
                <div class="profile-meta-left">
                    <div class="th-badge-wrapper">
                        <orecalc-assets-image class="th-badge-img" src="assets/th/th16.png" alt="Town Hall --" size="standard"></orecalc-assets-image>
                        <span class="th-badge-level-overlay">--</span>
                    </div>
                    <div class="player-identity">
                        <div class="player-identity-info">
                            <h2 class="player-name">--</h2>
                            <span class="player-tag">#--------</span>
                        </div>
                        <div class="player-clan-mini">
                            <span class="clan-name-mini text-muted" data-i18n="views.welcome.noClan">${translate('views.welcome.noClan')}</span>
                        </div>
                    </div>
                </div>

                <div class="profile-meta-right">
                    <div class="league-details-mini" title="${translate('entities.leagues.unranked')}">
                        <orecalc-assets-svg name="star-badge" height="24" width="24" class="league-default-icon"></orecalc-assets-svg>
                        <div class="league-text-mini">
                            <span class="league-name-mini" data-i18n="entities.leagues.unranked">${translate('entities.leagues.unranked')}</span>
                            <div class="player-trophies-mini">
                                <orecalc-assets-svg name="trophy" height="12" width="12" class="trophy-icon-mini"></orecalc-assets-svg>
                                <span>---</span>
                            </div>
                        </div>
                    </div>
                    <div class="profile-meta-actions-row">
                        <a href="/" class="hj-planner-bridge-btn" title="${translate('views.heroJourneyPage.backToPlannerHelp')}" aria-label="${translate('views.heroJourneyPage.backToPlanner')}">
                            <orecalc-assets-svg name="planner-outline" height="13" width="13" class="planner-bridge-icon"></orecalc-assets-svg>
                            <span class="planner-bridge-label" data-i18n="views.heroJourneyPage.backToPlanner">${translate('views.heroJourneyPage.backToPlanner')}</span>
                        </a>
                        <button id="hj-profile-collapse-btn" class="profile-collapse-toggle-btn" type="button" aria-expanded="${!isCollapsed}" aria-label="${isCollapsed ? translate('views.home.profile.expandStats') : translate('views.home.profile.collapseStats')}" title="${isCollapsed ? translate('views.home.profile.expandStats') : translate('views.home.profile.collapseStats')}">
                            <orecalc-assets-svg name="${isCollapsed ? 'chevron-down' : 'chevron-up'}" height="16" width="16" class="collapse-chevron-icon"></orecalc-assets-svg>
                        </button>
                    </div>
                </div>
            </div>

            <div class="home-profile-stats-container">
                <div class="home-profile-overall-progress">
                    <div class="overall-progress-header">
                        <span class="overall-progress-label-wrapper">
                            <orecalc-assets-image class="ore-icon-overall" src="assets/crown.png" alt="${translate('alts.crown')}"></orecalc-assets-image>
                            <span class="overall-progress-label" data-i18n="views.heroJourneyPage.journeyProgress">${translate('views.heroJourneyPage.journeyProgress')}</span>
                        </span>
                        <span class="overall-progress-value">--%</span>
                    </div>
                    <div class="progress-bar-overall">
                        <div class="progress-bar-fill overall-fill" style="width: 0%;"></div>
                    </div>
                </div>

                <div class="home-profile-stats-row">
                    <div class="profile-stat-box progress-box">
                        <div class="stat-box-header">
                            <span class="stat-box-label-wrapper">
                                <orecalc-assets-image class="ore-icon-mini" src="assets/shiny_ore.png" alt="Shiny"></orecalc-assets-image>
                                <span class="stat-box-label" data-i18n="entities.ores.shiny">${translate('entities.ores.shiny')}</span>
                            </span>
                            <span class="stat-box-value">--%</span>
                        </div>
                        <div class="progress-bar-mini">
                            <div class="progress-bar-fill shiny-fill" style="width: 0%;"></div>
                        </div>
                        <div class="stat-box-sub">
                            <span>${translate('views.heroJourneyPage.unclaimedCount', { count: '--' })}</span>
                        </div>
                    </div>
                    <div class="profile-stat-box progress-box">
                        <div class="stat-box-header">
                            <span class="stat-box-label-wrapper">
                                <orecalc-assets-image class="ore-icon-mini" src="assets/glowy_ore.png" alt="Glowy"></orecalc-assets-image>
                                <span class="stat-box-label" data-i18n="entities.ores.glowy">${translate('entities.ores.glowy')}</span>
                            </span>
                            <span class="stat-box-value">--%</span>
                        </div>
                        <div class="progress-bar-mini">
                            <div class="progress-bar-fill glowy-fill" style="width: 0%;"></div>
                        </div>
                        <div class="stat-box-sub">
                            <span>${translate('views.heroJourneyPage.unclaimedCount', { count: '--' })}</span>
                        </div>
                    </div>
                    <div class="profile-stat-box progress-box">
                        <div class="stat-box-header">
                            <span class="stat-box-label-wrapper">
                                <orecalc-assets-image class="ore-icon-mini" src="assets/starry_ore.png" alt="Starry"></orecalc-assets-image>
                                <span class="stat-box-label" data-i18n="entities.ores.starry">${translate('entities.ores.starry')}</span>
                            </span>
                            <span class="stat-box-value">--%</span>
                        </div>
                        <div class="progress-bar-mini">
                            <div class="progress-bar-fill starry-fill" style="width: 0%;"></div>
                        </div>
                        <div class="stat-box-sub">
                            <span>${translate('views.heroJourneyPage.unclaimedCount', { count: '--' })}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    card.style.display = 'flex';

    if (!hjState.playerData) {
        hjRenderState.renderedTag = null;
        hjRenderState.lastProgress = null;
        card.classList.add('is-stats-collapsed');
        const thLevel = hjState.thLevel || 18;
        const thImgUrl = `assets/th/th${thLevel}.png`;
        const leagueNameText = translate('entities.leagues.unranked');
        const bridgeUrl = './';

        card.innerHTML = `
            <div class="hero-journey-page__player-header home-profile-header">
                <div class="profile-meta-left">
                    <div class="th-badge-wrapper">
                        <orecalc-assets-image class="th-badge-img is-silhouette" src="${thImgUrl}" alt="Town Hall ${thLevel}" size="standard"></orecalc-assets-image>
                        <span class="th-badge-level-overlay">${thLevel}</span>
                    </div>
                    <div class="player-identity">
                        <div class="player-identity-info">
                            <h2 class="player-name" data-i18n="views.home.profile.noProfileTitle">${translate('views.home.profile.noProfileTitle')}</h2>
                            <span class="player-tag-guest-badge" data-i18n="views.welcome.guestProfileTag">${translate('views.welcome.guestProfileTag')}</span>
                        </div>
                        <div class="player-clan-mini">
                            <span class="clan-name-mini text-muted" data-i18n="views.welcome.noClan">${translate('views.welcome.noClan')}</span>
                        </div>
                    </div>
                </div>

                <div class="profile-meta-right">
                    <div class="league-details-mini" title="${leagueNameText}">
                        <orecalc-assets-image class="league-badge-img-mini" src="https://api-assets.clashofclans.com/leaguetiers/125/yyYo5DUFeFBZvmMEQh0ZxvG-1sUOZ_S3kDMB7RllXX0.png" alt="${leagueNameText}" size="standard"></orecalc-assets-image>
                        <div class="league-text-mini">
                            <span class="league-name-mini" data-i18n="entities.leagues.unranked">${leagueNameText}</span>
                            <div class="player-trophies-mini">
                                <orecalc-assets-svg name="trophy" height="12" width="12" class="trophy-icon-mini"></orecalc-assets-svg>
                                <span>--</span>
                            </div>
                        </div>
                    </div>
                    <div class="profile-meta-actions-row">
                        <a href="${bridgeUrl}" class="hj-planner-bridge-btn" title="${translate('views.heroJourneyPage.backToPlannerHelp')}" aria-label="${translate('views.heroJourneyPage.backToPlanner')}">
                            <orecalc-assets-svg name="planner-outline" height="13" width="13" class="planner-bridge-icon"></orecalc-assets-svg>
                            <span class="planner-bridge-label" data-i18n="views.heroJourneyPage.backToPlanner">${translate('views.heroJourneyPage.backToPlanner')}</span>
                        </a>
                        <button id="hj-unconnected-search-btn" class="accept-button unconnected-connect-btn" type="button" aria-label="${translate('views.home.profile.connectBtn')}" title="${translate('views.home.profile.connectBtn')}">
                            <orecalc-assets-svg name="search" height="14" width="14"></orecalc-assets-svg>
                            <span data-i18n="views.home.profile.connectBtn">${translate('views.home.profile.connectBtn')}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        return;
    }
    const player = hjState.playerData;
    const thLevel = hjState.thLevel;
    const maxLevelsByTH = getMaxCumulativeLevelsByTH();
    const allMaxValues = Object.values(maxLevelsByTH);
    const overallTrueMaxLevel = allMaxValues.length > 0 ? Math.max(...allMaxValues) : 480;
    const isTrueMaxPlayer = hjState.cumulativeLevel >= overallTrueMaxLevel && overallTrueMaxLevel > 0;
    const overallPct = overallTrueMaxLevel > 0 ? Math.min(100, Math.round((hjState.cumulativeLevel / overallTrueMaxLevel) * 100)) : 0;

    const state = buildStateFromPlayerData(player, hjState);
    const totals = calculateHeroJourneyOreTotals(state, thLevel, hjState.isAccelerated);

    const unclaimedShiny = totals.unclaimed.shiny;
    const unclaimedGlowy = totals.unclaimed.glowy;
    const unclaimedStarry = totals.unclaimed.starry;

    const claimedShiny = totals.claimed.shiny;
    const claimedGlowy = totals.claimed.glowy;
    const claimedStarry = totals.claimed.starry;

    const shinyPct = totals.total.shiny > 0 ? Math.min(100, Math.round((claimedShiny / totals.total.shiny) * 100)) : 100;
    const glowyPct = totals.total.glowy > 0 ? Math.min(100, Math.round((claimedGlowy / totals.total.glowy) * 100)) : 100;
    const starryPct = totals.total.starry > 0 ? Math.min(100, Math.round((claimedStarry / totals.total.starry) * 100)) : 100;

    const currentTag = player.tag || hjState.activeTag;
    const currentLang = typeof localStorage !== 'undefined' ? (safeJsonParse(localStorage.getItem('oreCalc_appSettings'), {})?.language || 'en') : 'en';
    const clanName = player.clan?.name || '';
    const leagueId = player.leagueTier?.id || player.league?.id || null;

    const progress = {
        overall: overallPct,
        shiny: shinyPct,
        glowy: glowyPct,
        starry: starryPct,
        unclaimedShiny,
        unclaimedGlowy,
        unclaimedStarry,
        isTrueMaxPlayer,
        overallTrueMaxLevel,
        cumulativeLevel: hjState.cumulativeLevel
    };

    // Incremental delta check: avoid full DOM tear-down if player and core metadata have not changed
    const isSamePlayer = hjRenderState.renderedTag === currentTag;
    const isSameLang = hjRenderState.renderedLang === currentLang;
    const isSameTH = hjRenderState.renderedTH === thLevel;
    const isSameClan = hjRenderState.renderedClan === clanName;
    const isSameLeague = hjRenderState.renderedLeague === leagueId;

    if (isSamePlayer && isSameLang && isSameTH && isSameClan && isSameLeague && hjRenderState.lastProgress) {
        applyHeroJourneyProgressDelta(card, hjRenderState.lastProgress, progress);
        hjRenderState.lastProgress = progress;
        hjRenderState.renderedAccelerated = hjState.isAccelerated;
        return;
    }

    hjRenderState.renderedTag = currentTag;
    hjRenderState.renderedLang = currentLang;
    hjRenderState.renderedTH = thLevel;
    hjRenderState.renderedClan = clanName;
    hjRenderState.renderedLeague = leagueId;
    hjRenderState.renderedAccelerated = hjState.isAccelerated;
    hjRenderState.lastProgress = progress;

    const thImgUrl = `assets/th/th${thLevel}.png`;

    let clanHtml = '';
    if (player.clan?.name) {
        const badgeUrl = player.clan.badgeUrls?.small || '';
        const safeBadgeUrl = escapeHTML(badgeUrl);
        const badgeImg = badgeUrl ? `<orecalc-assets-image class="clan-badge-img-mini" src="${safeBadgeUrl}" alt="Clan Badge"></orecalc-assets-image>` : '';
        const roleText = player.role ? `<span class="clan-role-mini">${formatClanRole(player.role)}</span>` : '';
        clanHtml = `<div class="player-clan-mini">${badgeImg}<div class="clan-info-col"><span class="clan-name-mini">${escapeHTML(player.clan.name)}</span>${roleText}</div></div>`;
    } else {
        clanHtml = `<div class="player-clan-mini"><span class="clan-name-mini text-muted" data-i18n="views.welcome.noClan">${translate('views.welcome.noClan')}</span></div>`;
    }

    const leagueData = leagueTiers.items.find(l => l.id === leagueId) || (player.league?.name ? leagueTiers.items.find(l => l.name.toLowerCase() === player.league.name.toLowerCase()) : null);
    let leagueIconHtml = `<orecalc-assets-svg name="star-badge" height="24" width="24" class="league-default-icon"></orecalc-assets-svg>`;
    let leagueNameText = translate('entities.leagues.unranked');

    if (leagueData) {
        const leagueKey = 'entities.leagues.' + leagueData.name.toLowerCase()
            .replace(/\./g, '')
            .replace(/\s(i+)$/i, (_, p1) => p1.toUpperCase())
            .replace(/\s/g, '_');
        leagueNameText = translate(leagueKey);
        const imgUrl = leagueData.iconUrls?.small || '';
        if (imgUrl) leagueIconHtml = `<orecalc-assets-image class="league-badge-img-mini" src="${escapeHTML(imgUrl)}" alt="${escapeHTML(leagueNameText)}"></orecalc-assets-image>`;
    }

    const safeTag = escapeHTML(hjState.activeTag);
    const safePlayerName = escapeHTML(player.name || 'Player');
    const cleanTag = normalizePlayerTag(hjState.activeTag);
    const lang = getLanguageFromPath();
    const rootPath = (lang && lang !== 'en') ? `/${lang}/` : '/';
    const bridgeUrl = cleanTag ? `${rootPath}?tag=${encodeURIComponent(cleanTag)}` : rootPath;
    const isCollapsed = typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem('orecalc_hj_profile_stats_collapsed') !== 'false'
        : true;

    if (isCollapsed) {
        card.classList.add('is-stats-collapsed');
    } else {
        card.classList.remove('is-stats-collapsed');
    }

    card.innerHTML = `
        <div class="hero-journey-page__player-header home-profile-header">
            <div class="profile-meta-left">
                <div class="th-badge-wrapper">
                    <orecalc-assets-image class="th-badge-img" src="${thImgUrl}" alt="Town Hall ${thLevel}" size="standard"></orecalc-assets-image>
                    <span class="th-badge-level-overlay">${thLevel}</span>
                </div>
                <div class="player-identity">
                    <div class="player-identity-info">
                        <h2 class="player-name">${safePlayerName}</h2>
                        <span class="player-tag">${safeTag}</span>
                    </div>
                    ${clanHtml}
                </div>
            </div>

            <div class="profile-meta-right">
                <div class="league-details-mini" title="${leagueNameText}">
                    ${leagueIconHtml}
                    <div class="league-text-mini">
                        <span class="league-name-mini">${leagueNameText}</span>
                        <div class="player-trophies-mini">
                            <orecalc-assets-svg name="trophy" height="12" width="12" class="trophy-icon-mini"></orecalc-assets-svg>
                            <span>${formatNumber(player.trophies || 0)}</span>
                        </div>
                    </div>
                </div>
                <div class="profile-meta-actions-row">
                    <a href="${bridgeUrl}" class="hj-planner-bridge-btn" title="${translate('views.heroJourneyPage.backToPlannerHelp')}" aria-label="${translate('views.heroJourneyPage.backToPlanner')}">
                        <orecalc-assets-svg name="planner-outline" height="13" width="13" class="planner-bridge-icon"></orecalc-assets-svg>
                        <span class="planner-bridge-label" data-i18n="views.heroJourneyPage.backToPlanner">${translate('views.heroJourneyPage.backToPlanner')}</span>
                    </a>
                    <button id="hj-profile-collapse-btn" class="profile-collapse-toggle-btn" type="button" aria-expanded="${!isCollapsed}" aria-label="${isCollapsed ? translate('views.home.profile.expandStats') : translate('views.home.profile.collapseStats')}" title="${isCollapsed ? translate('views.home.profile.expandStats') : translate('views.home.profile.collapseStats')}">
                        <orecalc-assets-svg name="${isCollapsed ? 'chevron-down' : 'chevron-up'}" height="16" width="16" class="collapse-chevron-icon"></orecalc-assets-svg>
                    </button>
                </div>
            </div>
        </div>

        <div class="home-profile-stats-container">
            <div class="home-profile-overall-progress${isTrueMaxPlayer ? ' fully-maxed' : ''}">
                <div class="overall-progress-header">
                    <span class="overall-progress-label-wrapper">
                        <orecalc-assets-image class="ore-icon-overall" src="assets/crown.png" alt="${translate('alts.crown')}"></orecalc-assets-image>
                        <span class="overall-progress-label" data-i18n="views.heroJourneyPage.journeyProgress">${translate('views.heroJourneyPage.journeyProgress')}</span>
                    </span>
                    <span class="overall-progress-value" data-ore-value="overall">0%</span>
                </div>
                <div class="progress-bar-overall" data-ore="overall">
                    <div class="progress-bar-fill overall-fill ${isTrueMaxPlayer ? 'maxed-fill' : ''}" data-bar-width="${overallPct}%" style="width: 0%;"></div>
                </div>
            </div>

            ${!isTrueMaxPlayer ? `
            <div class="home-profile-stats-row">
                <div class="profile-stat-box progress-box">
                    <div class="stat-box-header">
                        <span class="stat-box-label-wrapper">
                            <orecalc-assets-image class="ore-icon-mini" src="assets/shiny_ore.png" alt="Shiny"></orecalc-assets-image>
                            <span class="stat-box-label" data-i18n="entities.ores.shiny">${translate('entities.ores.shiny')}</span>
                        </span>
                        <span class="stat-box-value" data-ore-value="shiny">0%</span>
                    </div>
                    <div class="progress-bar-mini" data-ore="shiny">
                        <div class="progress-bar-fill shiny-fill ${shinyPct >= 100 ? 'maxed-fill' : ''}" data-bar-width="${shinyPct}%" style="width: 0%;"></div>
                    </div>
                    <div class="stat-box-sub">
                        <span>${unclaimedShiny > 0 ? translate('views.heroJourneyPage.unclaimedCount', { count: formatNumber(Math.round(unclaimedShiny)) }) : translate('views.heroJourneyPage.allClaimed')}</span>
                    </div>
                </div>

                <div class="profile-stat-box progress-box">
                    <div class="stat-box-header">
                        <span class="stat-box-label-wrapper">
                            <orecalc-assets-image class="ore-icon-mini" src="assets/glowy_ore.png" alt="Glowy"></orecalc-assets-image>
                            <span class="stat-box-label" data-i18n="entities.ores.glowy">${translate('entities.ores.glowy')}</span>
                        </span>
                        <span class="stat-box-value" data-ore-value="glowy">0%</span>
                    </div>
                    <div class="progress-bar-mini" data-ore="glowy">
                        <div class="progress-bar-fill glowy-fill ${glowyPct >= 100 ? 'maxed-fill' : ''}" data-bar-width="${glowyPct}%" style="width: 0%;"></div>
                    </div>
                    <div class="stat-box-sub">
                        <span>${unclaimedGlowy > 0 ? translate('views.heroJourneyPage.unclaimedCount', { count: formatNumber(Math.round(unclaimedGlowy)) }) : translate('views.heroJourneyPage.allClaimed')}</span>
                    </div>
                </div>

                <div class="profile-stat-box progress-box">
                    <div class="stat-box-header">
                        <span class="stat-box-label-wrapper">
                            <orecalc-assets-image class="ore-icon-mini" src="assets/starry_ore.png" alt="Starry"></orecalc-assets-image>
                            <span class="stat-box-label" data-i18n="entities.ores.starry">${translate('entities.ores.starry')}</span>
                        </span>
                        <span class="stat-box-value" data-ore-value="starry">0%</span>
                    </div>
                    <div class="progress-bar-mini" data-ore="starry">
                        <div class="progress-bar-fill starry-fill ${starryPct >= 100 ? 'maxed-fill' : ''}" data-bar-width="${starryPct}%" style="width: 0%;"></div>
                    </div>
                    <div class="stat-box-sub">
                        <span>${unclaimedStarry > 0 ? translate('views.heroJourneyPage.unclaimedCount', { count: formatNumber(Math.round(unclaimedStarry)) }) : translate('views.heroJourneyPage.allClaimed')}</span>
                    </div>
                </div>
            </div>` : ''}
        </div>
    `;

    triggerHeroJourneyFillAnimation(card, {
        overall: overallPct,
        shiny: shinyPct,
        glowy: glowyPct,
        starry: starryPct,
        isTrueMaxPlayer,
        overallTrueMaxLevel,
        cumulativeLevel: hjState.cumulativeLevel
    });
}

/**
 * Triggers progress bar fill transition and number count-up animation on the Hero Journey player card.
 * @param {HTMLElement} container - Card element.
 * @param {{ overall: number, shiny: number, glowy: number, starry: number, isTrueMaxPlayer: boolean, overallTrueMaxLevel: number, cumulativeLevel: number }} metrics
 */
function triggerHeroJourneyFillAnimation(container, metrics) {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            container.querySelectorAll('.progress-bar-fill[data-bar-width]').forEach(bar => {
                const htmlBar = /** @type {HTMLElement} */ (bar);
                if (htmlBar.dataset.barWidth) {
                    htmlBar.style.width = htmlBar.dataset.barWidth;
                }
            });

            const overallEl = container.querySelector('[data-ore-value="overall"]');
            if (overallEl) {
                const targetOverall = metrics.overall || 0;
                if (metrics.isTrueMaxPlayer) {
                    animateValue(overallEl, 0, targetOverall, 2000, val => `${Math.round(val)}%`);
                } else {
                    animateValue(overallEl, 0, targetOverall, 2000, val => {
                        const curLvl = Math.min(metrics.cumulativeLevel, Math.round((val / 100) * metrics.overallTrueMaxLevel));
                        return `${curLvl}/${metrics.overallTrueMaxLevel} (${Math.round(val)}%)`;
                    });
                }
            }

            const oreKeys = ['shiny', 'glowy', 'starry'];
            for (const key of oreKeys) {
                const valEl = container.querySelector(`[data-ore-value="${key}"]`);
                if (valEl) {
                    const targetVal = metrics[key] || 0;
                    animateValue(valEl, 0, targetVal, 1800, val => `${Math.round(val)}%`);
                }
            }
        });
    });
}
