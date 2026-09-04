import { getEquipmentMaxLevel } from '../../data/equipmentCommonData.js';
import { heroData } from '../../data/heroData.js';
import { leagueTiers } from '../../data/leagueTiers.js';
import { translate } from '../../i18n/translator.js';

import { formatNumber } from '../../utils/numberFormatter.js';
import { escapeHTML } from '../../utils/stringUtils.js';

import {
    applyProgressDelta,
    renderState,
    triggerFillAnimation
} from './homeProfileAnimations.js';
import {
    buildSubData,
    calculateEquipmentProgress,
    formatClanRole,
    getOverallGradient,
    subtextHTML
} from './homeProfileCalculations.js';

/**
 * Main function to render the Home tab profile card.
 * @param {import('../../core/types.js').AppState} state - Current global application state.
 */
export function renderHomeProfile(state) {
    const cardContainer = document.getElementById('home-player-profile-card');
    if (!cardContainer) return;

    const profile = state.playerProfile;

    if (!profile || !profile.tag || profile.tag === 'DEFAULT0') {
        renderState.renderedTag = null;
        renderState.renderedLang = null;
        renderState.renderedTH = null;
        renderState.renderedClan = null;
        renderState.renderedLeague = null;
        renderState.lastProgress = null;
        renderState.isAnimating = false;
        renderState.pendingSnapshot = null;

        cardContainer.classList.add('is-stats-collapsed');
        const thLevel = profile?.townHallLevel || 18;
        const thImgUrl = `assets/th/th${thLevel}.png`;
        const leagueNameText = translate('entities.leagues.unranked');
        const unrankedIcon = leagueTiers.items.find(l => l.id === 105000000)?.iconUrls?.small || 'https://api-assets.clashofclans.com/leaguetiers/125/yyYo5DUFeFBZvmMEQh0ZxvG-1sUOZ_S3kDMB7RllXX0.png';

        cardContainer.innerHTML = `
            <div class="home-profile-header">
                <div class="profile-meta-left">
                    <div class="th-badge-wrapper">
                        <orecalc-assets-image class="th-badge-img is-silhouette" src="${thImgUrl}" alt="Town Hall" size="standard"></orecalc-assets-image>
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
                        <orecalc-assets-image class="league-badge-img-mini" src="${unrankedIcon}" alt="${escapeHTML(leagueNameText)}" size="standard"></orecalc-assets-image>
                        <div class="league-text-mini">
                            <span class="league-name-mini" data-i18n="entities.leagues.unranked">${leagueNameText}</span>
                            <div class="player-trophies-mini">
                                <orecalc-assets-svg name="trophy" height="12" width="12" class="trophy-icon-mini"></orecalc-assets-svg>
                                <span>--</span>
                            </div>
                        </div>
                    </div>
                    <div class="profile-meta-actions-row">
                        <div class="player-maxed-equip-mini" title="${translate('views.home.profile.maxedEquipment')}">
                            <orecalc-assets-svg name="equipment-filled" height="12" width="12" class="maxed-equip-icon-mini"></orecalc-assets-svg>
                            <span><span class="maxed-count">--/--</span> <span data-i18n="views.home.profile.maxedEquipment">${translate('views.home.profile.maxedEquipment')}</span></span>
                        </div>
                        <button id="home-profile-connect-btn" class="accept-button unconnected-connect-btn" type="button" aria-label="${translate('views.home.profile.connectBtn')}" title="${translate('views.home.profile.connectBtn')}">
                            <orecalc-assets-svg name="plus" height="14" width="14"></orecalc-assets-svg>
                            <span data-i18n="views.home.profile.connectBtn">${translate('views.home.profile.connectBtn')}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        cardContainer.style.display = 'flex';
        return;
    }

    let ownedHeroes = profile.ownedHeroes;
    let ownedEquipment = profile.ownedEquipment;

    const isGuest = profile.tag === 'DEFAULT0';
    if (!ownedHeroes || !ownedEquipment || Object.keys(ownedEquipment).length === 0) {
        if (Array.isArray(profile.heroes) || Array.isArray(profile.heroEquipment)) {
            const homeHeroes = (profile.heroes || []).filter(h => h.village === 'home' || !h.village);
            const homeEquip = (profile.heroEquipment || []).filter(e => e.village === 'home' || !e.village);
            ownedHeroes = Object.fromEntries(homeHeroes.map(h => [h.name, {
                level: h.level,
                maxLevel: h.maxLevel,
                equipment: h.equipment?.map(eq => ({ name: eq.name, level: eq.level })) || []
            }]));
            ownedEquipment = Object.fromEntries(homeEquip.map(e => [e.name, e.level]));
        } else if (state.heroes) {
            ownedHeroes = {};
            ownedEquipment = {};
            for (const heroName in state.heroes) {
                const heroState = state.heroes[heroName];
                if (heroState.enabled !== false) {
                    ownedHeroes[heroName] = {
                        level: heroState.level || 1,
                        maxLevel: 95
                    };
                    if (heroState.equipment) {
                        for (const equipName in heroState.equipment) {
                            const eqState = heroState.equipment[equipName];
                            if (eqState && eqState.checked !== false) {
                                ownedEquipment[equipName] = eqState.level || 1;
                            }
                        }
                    }
                }
            }
        } else {
            ownedHeroes = {};
            ownedEquipment = {};
        }
    }

    const progress = calculateEquipmentProgress(ownedEquipment, ownedHeroes);

    let maxedCount = 0;
    let totalCount = 0;
    for (const heroKey in heroData) {
        for (const equip of heroData[heroKey].equipment) {
            totalCount++;
            const maxLevel = getEquipmentMaxLevel(equip.type);
            const currentLevel = ownedEquipment[equip.name];
            if (currentLevel !== undefined && currentLevel >= maxLevel) {
                maxedCount++;
            }
        }
    }
    const subData = buildSubData(progress, state);

    const stored = state.storedOres || { shiny: 0, glowy: 0, starry: 0 };
    const shinyStoragePct = progress.shinyTotal > 0 ? ((stored.shiny || 0) / progress.shinyTotal) * 100 : 0;
    const glowyStoragePct = progress.glowyTotal > 0 ? ((stored.glowy || 0) / progress.glowyTotal) * 100 : 0;
    const starryStoragePct = progress.starryTotal > 0 ? ((stored.starry || 0) / progress.starryTotal) * 100 : 0;

    const currentLang = state.uiSettings?.language || 'en';
    const thLevel = profile.townHallLevel || 1;
    const clanName = profile.clan?.name || '';
    const leagueId = Number(profile.leagueTier?.id) || 105000000;

    const isSamePlayer = profile.tag === renderState.renderedTag;
    const isSameLang = currentLang === renderState.renderedLang;
    const isSameTH = thLevel === renderState.renderedTH;
    const isSameClan = clanName === renderState.renderedClan;
    const isSameLeague = leagueId === renderState.renderedLeague;

    // Incremental update path (same player, same lang, same th, clan, league)
    if (isSamePlayer && isSameLang && isSameTH && isSameClan && isSameLeague &&
        (renderState.lastProgress !== null || renderState.isAnimating)) {

        const ok = applyProgressDelta(
            cardContainer,
            renderState.lastProgress || progress,
            progress,
            subData,
            state,
            maxedCount,
            totalCount,
            profile
        );
        if (ok) {
            renderState.lastProgress = progress;
            return;
        }
    }

    renderState.renderedTag = profile.tag;
    renderState.renderedLang = currentLang;
    renderState.renderedTH = thLevel;
    renderState.renderedClan = clanName;
    renderState.renderedLeague = leagueId;
    renderState.lastProgress = null;
    renderState.pendingSnapshot = null;
    renderState.isAnimating = true;

    const thImgUrl = `assets/th/th${thLevel}.png`;

    let clanHtml = '';
    if (profile.clan?.name) {
        const badgeUrl = profile.clan.badgeUrls?.small || '';
        const safeBadgeUrl = escapeHTML(badgeUrl);
        const badgeImg = badgeUrl ? `<orecalc-assets-image class="clan-badge-img-mini" src="${safeBadgeUrl}" alt="Clan Badge"></orecalc-assets-image>` : '';
        const roleText = profile.role ? `<span class="clan-role-mini">${formatClanRole(profile.role)}</span>` : '';
        clanHtml = `<div class="player-clan-mini">${badgeImg}<div class="clan-info-col"><span class="clan-name-mini">${escapeHTML(profile.clan.name)}</span>${roleText}</div></div>`;
    } else {
        clanHtml = `<div class="player-clan-mini"><span class="clan-name-mini text-muted" data-i18n="views.welcome.noClan">${translate('views.welcome.noClan')}</span></div>`;
    }

    const leagueData = leagueTiers.items.find(l => l.id === leagueId);
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

    const safeTag = escapeHTML(profile.tag);
    const safePlayerName = escapeHTML(profile.name);

    const tagHtml = isGuest
        ? `<span class="player-tag-guest-badge" data-i18n="views.welcome.guestProfileTag">${translate('views.welcome.guestProfileTag')}</span>`
        : `<span class="player-tag">${safeTag}</span>`;

    const isCollapsed = Boolean(state.uiSettings?.hideProfileStats);
    if (isCollapsed) {
        cardContainer.classList.add('is-stats-collapsed');
    } else {
        cardContainer.classList.remove('is-stats-collapsed');
    }

    cardContainer.innerHTML = `
        <div class="home-profile-header${isGuest ? ' is-guest' : ''}">
            <div class="profile-meta-left">
                <div class="th-badge-wrapper">
                    <orecalc-assets-image class="th-badge-img" src="${thImgUrl}" alt="Town Hall" size="standard"></orecalc-assets-image>
                    <span class="th-badge-level-overlay">${thLevel}</span>
                </div>
                <div class="player-identity">
                    <div class="player-identity-info">
                        <h2 class="player-name">${safePlayerName}</h2>
                        ${tagHtml}
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
                            <span>${formatNumber(profile.trophies || 0)}</span>
                        </div>
                    </div>
                </div>
                <div class="profile-meta-actions-row">
                    <div class="player-maxed-equip-mini" title="${translate('views.home.profile.maxedEquipment')}">
                        <orecalc-assets-svg name="equipment-filled" height="12" width="12" class="maxed-equip-icon-mini"></orecalc-assets-svg>
                        <span><span class="maxed-count">${maxedCount}/${totalCount}</span> <span data-i18n="views.home.profile.maxedEquipment">${translate('views.home.profile.maxedEquipment')}</span></span>
                    </div>
                    <button id="home-profile-collapse-btn" class="profile-collapse-toggle-btn" type="button" aria-expanded="${!isCollapsed}" aria-label="${isCollapsed ? translate('views.home.profile.expandStats') : translate('views.home.profile.collapseStats')}" title="${isCollapsed ? translate('views.home.profile.expandStats') : translate('views.home.profile.collapseStats')}">
                        <orecalc-assets-svg name="${isCollapsed ? 'chevron-down' : 'chevron-up'}" height="16" width="16" class="collapse-chevron-icon"></orecalc-assets-svg>
                    </button>
                </div>
            </div>
        </div>

        <div class="home-profile-stats-container">
            <div class="home-profile-overall-progress${progress.overall >= 100 ? ' fully-maxed' : ''}">
                <div class="overall-progress-header">
                    <span class="overall-progress-label-wrapper">
                        <orecalc-assets-image class="ore-icon-overall" src="assets/ore_icon.png" alt="Ore"></orecalc-assets-image>
                        <span class="overall-progress-label" data-i18n="views.home.profile.overallProgress">${translate('views.home.profile.overallProgress')}</span>
                    </span>
                    <span class="overall-progress-value" data-ore-value="overall">0%</span>
                </div>
                <div class="progress-bar-overall" data-ore="overall">
                    <div class="progress-bar-fill overall-fill ${progress.overall >= 100 ? 'maxed-fill' : ''}" data-bar-width="${progress.overall}%" style="${progress.overall < 100 ? `background: ${getOverallGradient(progress)}` : ''}"></div>
                </div>
            </div>

            ${progress.overall < 100 ? `<div class="home-profile-stats-row">
                <div class="profile-stat-box progress-box">
                    <div class="stat-box-header">
                        <span class="stat-box-label-wrapper">
                            <orecalc-assets-image class="ore-icon-mini" src="assets/shiny_ore.png" alt="Shiny"></orecalc-assets-image>
                            <span class="stat-box-label" data-i18n="entities.ores.shiny">${translate('entities.ores.shiny')}</span>
                        </span>
                        <span class="stat-box-value" data-ore-value="shiny">0%</span>
                    </div>
                    <div class="progress-bar-mini" data-ore="shiny">
                        <div class="progress-bar-storage" style="width: ${shinyStoragePct}%"></div>
                        <div class="progress-bar-fill shiny-fill ${progress.shiny >= 100 ? 'maxed-fill' : ''}" data-bar-width="${progress.shiny}%"></div>
                    </div>
                    ${subtextHTML('shiny', progress.shiny, subData)}
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
                        <div class="progress-bar-storage" style="width: ${glowyStoragePct}%"></div>
                        <div class="progress-bar-fill glowy-fill ${progress.glowy >= 100 ? 'maxed-fill' : ''}" data-bar-width="${progress.glowy}%"></div>
                    </div>
                    ${subtextHTML('glowy', progress.glowy, subData)}
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
                        <div class="progress-bar-storage" style="width: ${starryStoragePct}%"></div>
                        <div class="progress-bar-fill starry-fill ${progress.starry >= 100 ? 'maxed-fill' : ''}" data-bar-width="${progress.starry}%"></div>
                    </div>
                    ${subtextHTML('starry', progress.starry, subData)}
                </div>
            </div>` : ''}
            <div class="home-profile-sync-notice${isGuest ? ' guest-notice' : ''}">
                <orecalc-assets-svg name="${isGuest ? 'info' : 'cloud-lock'}" class="sync-notice-icon" height="14" width="14"></orecalc-assets-svg>
                <span data-i18n="${isGuest ? 'views.home.profile.guestNotice' : 'views.home.profile.syncNotice'}">${isGuest ? translate('views.home.profile.guestNotice') : translate('views.home.profile.syncNotice')}</span>
            </div>
        </div>
    `;

    cardContainer.style.display = 'flex';

    const preloader = typeof document !== 'undefined' ? document.getElementById('preloader') : null;
    const isPreloaderActive = Boolean(preloader && !preloader.classList.contains('hidden') && preloader.style.display !== 'none');

    if (isPreloaderActive) {
        renderState.initialProgress = progress;
        renderState.lastProgress = progress;
    } else {
        triggerFillAnimation(cardContainer, progress, () => {
            renderState.isAnimating = false;
            renderState.lastProgress = progress;

            // Apply any update that arrived while the animation was running
            if (renderState.pendingSnapshot) {
                const { progress: pProg, subData: pSub } = renderState.pendingSnapshot;
                renderState.pendingSnapshot = null;

                const ok = applyProgressDelta(
                    cardContainer,
                    progress,
                    pProg,
                    pSub,
                    state,
                    maxedCount,
                    totalCount,
                    profile
                );
                if (ok) {
                    renderState.lastProgress = pProg;
                } else {
                    renderHomeProfile(state);
                }
            }
        });
    }
}
