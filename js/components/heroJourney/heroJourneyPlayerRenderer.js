import { translate } from '../../i18n/translator.js';
import { animateValue, formatNumber } from '../../utils/numberFormatter.js';
import { heroJourneyNodes } from '../../data/heroJourneyData.js';
import { getMaxCumulativeLevelsByTH, getNodeTownHallLevel } from '../../domain/income/heroJourneyLevels.js';
import { getQuestChestReward } from '../../domain/income/heroJourneyIncome.js';
import { resolveHeroJourneyTrack } from '../../domain/income/heroJourneyResolution.js';
import { getLanguageFromPath } from '../../core/languageRouter.js';
import { normalizePlayerTag } from '../../core/storageKeys.js';
import { hjState, buildStateFromPlayerData } from './heroJourneyState.js';
import { renderProfileHeaderHtml } from '../common/profileHeaderRenderer.js';
import { state as appGlobalState } from '../../core/state.js';
import { getAppSettings } from '../common/appSettings.js';

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
                const prevLvl = prevProg.cumulativeLevel || 0;
                const targetLvl = currProg.cumulativeLevel;
                animateValue(overallEl, prevOverall, currOverall, 1000, val => {
                    const ratio = (currOverall - prevOverall) !== 0
                        ? Math.max(0, Math.min(1, (val - prevOverall) / (currOverall - prevOverall)))
                        : 1;
                    const curLvl = ratio >= 1 ? targetLvl : Math.round(prevLvl + (targetLvl - prevLvl) * ratio);
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
                ? translate('views.heroJourney.page.unclaimedCount', { count: formatNumber(Math.round(unclaimed)) })
                : translate('views.heroJourney.page.allClaimed');
        }
    }

    const trophiesEl = container.querySelector('.player-trophies-mini span');
    if (trophiesEl && hjState.playerData?.trophies !== undefined) {
        const currentText = (trophiesEl.textContent || '').replace(/\D/g, '');
        const prevTrophies = Number(currentText) || 0;
        const targetTrophies = Number(hjState.playerData.trophies) || 0;
        if (prevTrophies !== targetTrophies) {
            animateValue(trophiesEl, prevTrophies, targetTrophies, 1800, val => formatNumber(Math.round(val)));
        } else {
            trophiesEl.textContent = formatNumber(targetTrophies);
        }
        trophiesEl.dataset.targetTrophies = String(targetTrophies);
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
        const isCollapsed = Boolean(appGlobalState.uiSettings?.hideProfileStats ?? getAppSettings().hideProfileStats);

        if (isCollapsed) {
            card.classList.add('is-stats-collapsed');
        } else {
            card.classList.remove('is-stats-collapsed');
        }

        const actionsRowHtml = `
            <a href="/" class="hj-planner-bridge-btn" title="${translate('views.heroJourney.page.backToPlannerHelp')}" aria-label="${translate('views.heroJourney.page.backToEquipmentPlanner')}">
                <orecalc-assets-svg name="planner-filled" height="13" width="13" class="planner-bridge-icon"></orecalc-assets-svg>
                <span class="planner-bridge-label" data-i18n="views.heroJourney.page.backToEquipmentPlanner">${translate('views.heroJourney.page.backToEquipmentPlanner')}</span>
            </a>
            <button id="hj-profile-collapse-btn" class="profile-collapse-toggle-btn" type="button" aria-expanded="${!isCollapsed}" aria-label="${isCollapsed ? translate('views.home.profile.expandStats') : translate('views.home.profile.collapseStats')}" title="${isCollapsed ? translate('views.home.profile.expandStats') : translate('views.home.profile.collapseStats')}">
                <orecalc-assets-svg name="${isCollapsed ? 'chevron-down' : 'chevron-up'}" height="16" width="16" class="collapse-chevron-icon"></orecalc-assets-svg>
            </button>
        `;

        const headerHtml = renderProfileHeaderHtml({
            profile: null,
            isGuest: true,
            thLevel: 16,
            trophiesHtml: '<span>---</span>',
            actionsRowHtml,
            headerExtraClasses: 'hero-journey-page__player-header'
        });

        card.style.display = 'flex';
        card.innerHTML = `
            ${headerHtml}

            <div class="home-profile-stats-container">
                <div class="home-profile-overall-progress">
                    <div class="overall-progress-header">
                        <span class="overall-progress-label-wrapper">
                            <orecalc-assets-image class="ore-icon-overall" src="assets/crown.png" alt="${translate('app.alts.crown')}"></orecalc-assets-image>
                            <span class="overall-progress-label" data-i18n="views.heroJourney.page.journeyProgress">${translate('views.heroJourney.page.journeyProgress')}</span>
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
                            <span>${translate('views.heroJourney.page.unclaimedCount', { count: '--' })}</span>
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
                            <span>${translate('views.heroJourney.page.unclaimedCount', { count: '--' })}</span>
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
                            <span>${translate('views.heroJourney.page.unclaimedCount', { count: '--' })}</span>
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
        const cleanTag = normalizePlayerTag(hjState.activeTag);
        const lang = getLanguageFromPath();
        const rootPath = (lang && lang !== 'en') ? `/${lang}/` : '/';
        const bridgeUrl = cleanTag ? `${rootPath}?tag=${encodeURIComponent(cleanTag)}` : rootPath;

        const actionsRowHtml = `
            <a href="${bridgeUrl}" class="hj-planner-bridge-btn" title="${translate('views.heroJourney.page.backToPlannerHelp')}" aria-label="${translate('views.heroJourney.page.backToEquipmentPlanner')}">
                <orecalc-assets-svg name="planner-filled" height="13" width="13" class="planner-bridge-icon"></orecalc-assets-svg>
                <span class="planner-bridge-label" data-i18n="views.heroJourney.page.backToEquipmentPlanner">${translate('views.heroJourney.page.backToEquipmentPlanner')}</span>
            </a>
            <button id="hj-unconnected-search-btn" class="accept-button unconnected-connect-btn" type="button" aria-label="${translate('views.home.profile.connectBtn')}" title="${translate('views.home.profile.connectBtn')}">
                <orecalc-assets-svg name="search" height="14" width="14"></orecalc-assets-svg>
                <span data-i18n="views.home.profile.connectBtn">${translate('views.home.profile.connectBtn')}</span>
            </button>
        `;

        card.innerHTML = renderProfileHeaderHtml({
            profile: null,
            isGuest: true,
            thLevel: hjState.thLevel || 18,
            actionsRowHtml,
            headerExtraClasses: 'hero-journey-page__player-header'
        });
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
    const currentLang = appGlobalState.uiSettings?.language || getAppSettings().language || 'en';
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

    const cleanTag = normalizePlayerTag(hjState.activeTag);
    const lang = getLanguageFromPath();
    const rootPath = (lang && lang !== 'en') ? `/${lang}/` : '/';
    const bridgeUrl = cleanTag ? `${rootPath}?tag=${encodeURIComponent(cleanTag)}` : rootPath;
    const isCollapsed = Boolean(appGlobalState.uiSettings?.hideProfileStats ?? getAppSettings().hideProfileStats);

    if (isCollapsed) {
        card.classList.add('is-stats-collapsed');
    } else {
        card.classList.remove('is-stats-collapsed');
    }

    const prevTrophies = Number((card.querySelector('.player-trophies-mini span')?.textContent || '').replace(/\D/g, '')) || 0;
    const targetTrophies = Number(player.trophies) || 0;

    const actionsRowHtml = `
        <a href="${bridgeUrl}" class="hj-planner-bridge-btn" title="${translate('views.heroJourney.page.backToPlannerHelp')}" aria-label="${translate('views.heroJourney.page.backToEquipmentPlanner')}">
            <orecalc-assets-svg name="planner-filled" height="13" width="13" class="planner-bridge-icon"></orecalc-assets-svg>
            <span class="planner-bridge-label" data-i18n="views.heroJourney.page.backToEquipmentPlanner">${translate('views.heroJourney.page.backToEquipmentPlanner')}</span>
        </a>
        <button id="hj-profile-collapse-btn" class="profile-collapse-toggle-btn" type="button" aria-expanded="${!isCollapsed}" aria-label="${isCollapsed ? translate('views.home.profile.expandStats') : translate('views.home.profile.collapseStats')}" title="${isCollapsed ? translate('views.home.profile.expandStats') : translate('views.home.profile.collapseStats')}">
            <orecalc-assets-svg name="${isCollapsed ? 'chevron-down' : 'chevron-up'}" height="16" width="16" class="collapse-chevron-icon"></orecalc-assets-svg>
        </button>
    `;

    const headerHtml = renderProfileHeaderHtml({
        profile: player,
        isGuest: false,
        thLevel,
        tag: currentTag,
        trophies: targetTrophies,
        prevTrophies,
        actionsRowHtml,
        headerExtraClasses: 'hero-journey-page__player-header'
    });

    card.innerHTML = `
        ${headerHtml}

        <div class="home-profile-stats-container">
            <div class="home-profile-overall-progress${isTrueMaxPlayer ? ' fully-maxed' : ''}">
                <div class="overall-progress-header">
                    <span class="overall-progress-label-wrapper">
                        <orecalc-assets-image class="ore-icon-overall" src="assets/crown.png" alt="${translate('app.alts.crown')}"></orecalc-assets-image>
                        <span class="overall-progress-label" data-i18n="views.heroJourney.page.journeyProgress">${translate('views.heroJourney.page.journeyProgress')}</span>
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
                        <span>${unclaimedShiny > 0 ? translate('views.heroJourney.page.unclaimedCount', { count: formatNumber(Math.round(unclaimedShiny)) }) : translate('views.heroJourney.page.allClaimed')}</span>
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
                        <span>${unclaimedGlowy > 0 ? translate('views.heroJourney.page.unclaimedCount', { count: formatNumber(Math.round(unclaimedGlowy)) }) : translate('views.heroJourney.page.allClaimed')}</span>
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
                        <span>${unclaimedStarry > 0 ? translate('views.heroJourney.page.unclaimedCount', { count: formatNumber(Math.round(unclaimedStarry)) }) : translate('views.heroJourney.page.allClaimed')}</span>
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
                    const targetLvl = metrics.cumulativeLevel;
                    animateValue(overallEl, 0, targetOverall, 2000, val => {
                        const ratio = targetOverall > 0 ? Math.max(0, Math.min(1, val / targetOverall)) : 1;
                        const curLvl = ratio >= 1 ? targetLvl : Math.round(targetLvl * ratio);
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

            const trophiesEl = container.querySelector('.player-trophies-mini span');
            if (trophiesEl && trophiesEl.dataset.targetTrophies !== undefined) {
                const prev = Number(trophiesEl.dataset.prevTrophies) || 0;
                const target = Number(trophiesEl.dataset.targetTrophies) || 0;
                if (prev !== target || prev === 0) {
                    animateValue(trophiesEl, prev, target, 1800, val => formatNumber(Math.round(val)));
                }
            }
        });
    });
}
