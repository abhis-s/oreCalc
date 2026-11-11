import { getEquipmentMaxLevel } from '../../data/equipmentCommonData.js';
import { heroData } from '../../data/heroData.js';
import { translate } from '../../i18n/translator.js';
import { renderProfileHeaderHtml } from '../common/profileHeaderDisplay.js';
import { renderProfileStatsHtml } from '../common/profileStatsDisplay.js';

import {
    applyProgressDelta,
    renderState,
    triggerFillAnimation
} from './homeProfileAnimations.js';
import {
    buildSubData,
    subtextHTML
} from './homeProfileCalculations.js';
import {
    calculateEquipmentProgress,
    getOverallGradient
} from '../../domain/equipment/equipmentProgressDomain.js';
import { normalizePlayerTag } from '../../core/storageKeys.js';

/**
 * Main function to render the Home tab profile card.
 * @param {import('../../core/types.js').AppState} state - Current global application state.
 */
export function renderHomeProfile(state) {
    const cardContainer = document.getElementById('orecalc-home-player-card');
    if (!cardContainer) return;

    cardContainer.removeAttribute('hidden');
    cardContainer.hidden = false;

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

        cardContainer.classList.remove('is-max-progress');
        cardContainer.innerHTML = renderProfileHeaderHtml({
            profile: null,
            isGuest: true,
            thLevel,
            maxEquipment: true
        });
        cardContainer.removeAttribute('hidden');
        cardContainer.hidden = false;
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

    const hasHeader = Boolean(cardContainer.querySelector('.home-profile-header'));

    // Incremental update path (same player, same lang, same th, clan, league, and populated DOM)
    if (hasHeader && isSamePlayer && isSameLang && isSameTH && isSameClan && isSameLeague &&
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
            cacheHomeUiSnapshot(state);
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

    const isCollapsed = Boolean(state.uiSettings?.hideProfileStats);
    if (isCollapsed) {
        cardContainer.classList.add('is-stats-collapsed');
    } else {
        cardContainer.classList.remove('is-stats-collapsed');
    }
    cardContainer.classList.toggle('is-max-progress', progress.overall >= 100);

    const prevTrophies = Number((cardContainer.querySelector('.player-trophies-mini span')?.textContent || '').replace(/\D/g, '')) || 0;
    const prevMaxed = parseInt((cardContainer.querySelector('.maxed-count')?.textContent || '').split('/')[0], 10) || 0;
    const targetTrophies = Number(profile.trophies) || 0;

    const headerHtml = renderProfileHeaderHtml({
        profile,
        isGuest,
        thLevel,
        tag: profile.tag,
        trophies: targetTrophies,
        prevTrophies,
        maxEquipment: {
            current: maxedCount,
            total: totalCount,
            prev: prevMaxed
        },
        hasCollapsibleStats: true,
        isCollapsed
    });

    const syncNoticeHtml = `
        <div class="home-profile-sync-notice${isGuest ? ' guest-notice' : ''}">
            <clashcalc-assets-svg name="${isGuest ? 'info' : 'cloud-lock'}" class="sync-notice-icon" height="14" width="14"></clashcalc-assets-svg>
            <span data-i18n="${isGuest ? 'views.home.profile.guestNotice' : 'views.home.profile.syncNotice'}">${isGuest ? translate('views.home.profile.guestNotice') : translate('views.home.profile.syncNotice')}</span>
        </div>
    `;

    const statsHtml = renderProfileStatsHtml({
        overall: {
            label: translate('views.home.profile.overallProgress'),
            labelKey: 'views.home.profile.overallProgress',
            icon: 'assets/ore_icon.png',
            alt: 'Ore',
            percentage: progress.overall,
            percentageText: '0%',
            gradient: progress.overall < 100 ? getOverallGradient(progress) : '',
            isMaxed: progress.overall >= 100
        },
        ores: [
            {
                type: 'shiny',
                label: translate('entities.ores.shiny'),
                labelKey: 'entities.ores.shiny',
                icon: 'assets/shiny_ore.png',
                alt: 'Shiny',
                percentage: progress.shiny,
                percentageText: '0%',
                storagePct: shinyStoragePct,
                subtextHtml: subtextHTML('shiny', progress.shiny, subData)
            },
            {
                type: 'glowy',
                label: translate('entities.ores.glowy'),
                labelKey: 'entities.ores.glowy',
                icon: 'assets/glowy_ore.png',
                alt: 'Glowy',
                percentage: progress.glowy,
                percentageText: '0%',
                storagePct: glowyStoragePct,
                subtextHtml: subtextHTML('glowy', progress.glowy, subData)
            },
            {
                type: 'starry',
                label: translate('entities.ores.starry'),
                labelKey: 'entities.ores.starry',
                icon: 'assets/starry_ore.png',
                alt: 'Starry',
                percentage: progress.starry,
                percentageText: '0%',
                storagePct: starryStoragePct,
                subtextHtml: subtextHTML('starry', progress.starry, subData)
            }
        ],
        footerHtml: syncNoticeHtml
    });

    cardContainer.innerHTML = `
        ${headerHtml}
        ${statsHtml}
    `;

    cardContainer.removeAttribute('hidden');
    cardContainer.hidden = false;
    cardContainer.style.display = 'flex';

    cacheHomeUiSnapshot(state);

    const preloader = typeof document !== 'undefined' ? document.getElementById('preloader') : null;
    const isPreloaderActive = Boolean(preloader && !preloader.classList.contains('is-hidden') && preloader.style.display !== 'none');

    if (isPreloaderActive) {
        renderState.initialProgress = progress;
        renderState.lastProgress = progress;
        cacheHomeUiSnapshot(state);
    } else {
        triggerFillAnimation(cardContainer, progress, () => {
            renderState.isAnimating = false;
            renderState.lastProgress = progress;
            cacheHomeUiSnapshot(state);

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
                    cacheHomeUiSnapshot(state);
                } else {
                    renderHomeProfile(state);
                }
            }
        });
    }
}

/**
 * Persists a lightweight HTML and metric snapshot of the Home tab to localStorage.
 * Enables instant zero-skeleton synchronous pre-hydration on cold startup.
 * @param {import('../../core/types.js').AppState} state
 */
export function cacheHomeUiSnapshot(state) {
    const profile = state?.playerProfile;
    if (!profile?.tag || profile.tag === 'DEFAULT0') return;

    try {
        const cleanTag = normalizePlayerTag(profile.tag);
        const cardContainer = document.getElementById('orecalc-home-player-card');
        if (cardContainer && cardContainer.innerHTML) {
            localStorage.setItem(`clashCalc_cachedHomeProfile_${cleanTag}`, cardContainer.innerHTML);
        }
        if (profile.name) {
            localStorage.setItem(`clashCalc_cachedPlayerName_${cleanTag}`, profile.name);
        }

        const ores = state.derived?.requiredOres;
        const time = state.derived?.remainingTime;
        if (ores && time) {
            const oresSnapshot = {
                shiny: Math.round(ores.shiny || 0),
                glowy: Math.round(ores.glowy || 0),
                starry: Math.round(ores.starry || 0),
                timeShinyYears: String(time.shiny?.years ?? 0),
                timeShinyMonths: String(time.shiny?.months ?? 0),
                timeShinyDays: String(time.shiny?.days ?? 0),
                dateShiny: document.getElementById('home-result-date-shiny')?.textContent || '',
                timeGlowyYears: String(time.glowy?.years ?? 0),
                timeGlowyMonths: String(time.glowy?.months ?? 0),
                timeGlowyDays: String(time.glowy?.days ?? 0),
                dateGlowy: document.getElementById('home-result-date-glowy')?.textContent || '',
                timeStarryYears: String(time.starry?.years ?? 0),
                timeStarryMonths: String(time.starry?.months ?? 0),
                timeStarryDays: String(time.starry?.days ?? 0),
                dateStarry: document.getElementById('home-result-date-starry')?.textContent || ''
            };
            localStorage.setItem(`clashCalc_cachedHomeOres_${cleanTag}`, JSON.stringify(oresSnapshot));
        }
    } catch (_) {}
}
