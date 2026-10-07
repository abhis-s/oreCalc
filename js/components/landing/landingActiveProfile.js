import { formatDisplayTag } from '../../core/storageKeys.js';
import { UNRANKED_LEAGUE_ID } from '../../core/constants.js';
import { heroData } from '../../data/heroData.js';
import { getEquipmentMaxLevel } from '../../data/equipmentCommonData.js';
import { getCumulativeHeroLevel, getMaxCumulativeLevelsByTH } from '../../domain/income/heroJourneyLevels.js';
import { leagueTiers } from '../../data/leagueTiers.js';
import { translate } from '../../i18n/translator.js';
import { animateValue, formatNumber } from '../../utils/numberFormatter.js';
import { renderProfileHeaderHtml, getLeagueI18nKey, formatClanRole } from '../common/profileHeaderRenderer.js';

/**
 * Extracts and normalizes equipment and hero structures from cached player data.
 * @param {any} playerData
 * @param {any} profile
 * @returns {{ ownedEquipment: Record<string, number>, ownedHeroes: Record<string, any> }}
 */
export function extractEquipmentAndHeroes(playerData, profile) {
    let ownedHeroes = profile?.ownedHeroes;
    let ownedEquipment = profile?.ownedEquipment;

    if (!ownedHeroes || !ownedEquipment || Object.keys(ownedEquipment).length === 0) {
        if (Array.isArray(profile?.heroes) || Array.isArray(profile?.heroEquipment)) {
            const homeHeroes = (profile?.heroes || []).filter(h => !h.village || h.village === 'home');
            ownedHeroes = {};
            for (const h of homeHeroes) {
                ownedHeroes[h.name] = h;
            }
            ownedEquipment = {};
            for (const eq of (profile?.heroEquipment || [])) {
                if (!eq.village || eq.village === 'home') {
                    ownedEquipment[eq.name] = eq.level;
                }
            }
        } else if (playerData?.heroes) {
            ownedHeroes = {};
            ownedEquipment = {};
            for (const heroName in playerData.heroes) {
                const heroState = playerData.heroes[heroName];
                if (heroState.enabled !== false) {
                    ownedHeroes[heroName] = { level: heroState.level || 1, maxLevel: 95 };
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
    return { ownedEquipment: ownedEquipment || {}, ownedHeroes: ownedHeroes || {} };
}

/**
 * Calculates maxed equipment count against total equipment.
 * @param {Record<string, number>} ownedEquipment
 * @returns {{ maxedCount: number, totalCount: number }}
 */
export function calculateMaxedEquipmentCount(ownedEquipment) {
    let maxedCount = 0;
    let totalCount = 0;
    for (const heroKey in heroData) {
        for (const equip of heroData[heroKey].equipment) {
            totalCount++;
            const maxLevel = getEquipmentMaxLevel(equip.type);
            const currentLevel = ownedEquipment?.[equip.name];
            if (currentLevel !== undefined && currentLevel >= maxLevel) {
                maxedCount++;
            }
        }
    }
    return { maxedCount, totalCount };
}

/**
 * Calculates Hero Journey cumulative hero levels and progress percentage.
 * @param {any} playerData
 * @param {any} profile
 * @param {number} [thLevel=18]
 * @returns {{ cumulativeLevel: number, thCap: number, overallMax: number, progressPercent: number, isThMaxed: boolean, isTrackMaxed: boolean }}
 */
export function calculateHeroJourneyProgress(playerData, profile, thLevel = 18) {
    const rawCumulative = profile?.heroJourney?.cumulativeHeroLevel ?? playerData?.heroJourney?.cumulativeHeroLevel;
    let cumulativeLevel = Number(rawCumulative);
    if (rawCumulative == null || Number.isNaN(cumulativeLevel)) {
        cumulativeLevel = getCumulativeHeroLevel({ playerProfile: profile, heroes: playerData?.heroes });
    }
    const maxLevelsByTH = getMaxCumulativeLevelsByTH();
    const thCap = maxLevelsByTH[thLevel] || 480;
    const allMaxValues = Object.values(maxLevelsByTH);
    const overallMax = allMaxValues.length > 0 ? Math.max(...allMaxValues) : 480;
    const progressPercent = Math.min(100, Math.max(0, Math.round((cumulativeLevel / thCap) * 100)));
    const isThMaxed = cumulativeLevel >= thCap;
    const isTrackMaxed = cumulativeLevel >= overallMax;
    return { cumulativeLevel, thCap, overallMax, progressPercent, isThMaxed, isTrackMaxed };
}

/**
 * Evaluates available horizontal space on the active village card and toggles collapsed mode.
 */
function updateActiveProfileLayout() {
    const card = /** @type {HTMLElement | null} */ (document.querySelector('.active-profile-card'));
    if (!card) return;

    const nameEl = /** @type {HTMLElement | null} */ (card.querySelector('.player-name'));
    const tagEl = /** @type {HTMLElement | null} */ (card.querySelector('.player-tag'));
    const clanNameEl = /** @type {HTMLElement | null} */ (card.querySelector('.clan-name-mini'));
    const roleEl = /** @type {HTMLElement | null} */ (card.querySelector('.clan-role-mini'));
    const thWrapper = /** @type {HTMLElement | null} */ (card.querySelector('.th-badge-wrapper'));
    const clanBadgeEl = /** @type {HTMLElement | null} */ (card.querySelector('.clan-badge-img-mini'));
    const leagueEl = /** @type {HTMLElement | null} */ (card.querySelector('.league-details-mini'));
    const actionsEl = /** @type {HTMLElement | null} */ (card.querySelector('.profile-meta-actions-row'));

    const avatarWidth = thWrapper?.offsetWidth || 52;
    const nameWidth = nameEl?.scrollWidth || 0;
    const tagWidth = tagEl?.scrollWidth || 0;
    const clanBadgeWidth = clanBadgeEl ? (clanBadgeEl.offsetWidth || 16) : 0;
    const clanRowWidth = clanBadgeWidth + (clanNameEl?.scrollWidth || 0) + (roleEl ? roleEl.scrollWidth + 4 : 0);
    const identityWidth = Math.max(nameWidth, tagWidth, clanRowWidth);
    const leftSideWidth = avatarWidth + 16 + identityWidth;
    const rightSideWidth = Math.max(leagueEl?.scrollWidth || 0, actionsEl?.scrollWidth || 0);
    const requiredWidth = Math.ceil(leftSideWidth + rightSideWidth + 32 + 16);

    const isCurrentlyCollapsed = card.classList.contains('is-collapsed');
    // 16px hysteresis deadband prevents scrollbar toggle thrashing
    const threshold = isCurrentlyCollapsed ? requiredWidth + 16 : requiredWidth;

    if (card.clientWidth < threshold) {
        card.classList.add('is-collapsed');
    } else {
        card.classList.remove('is-collapsed');
    }
}

/** @type {ResizeObserver | null} */
let activeProfileResizeObserver = null;

/**
 * Initializes a space-based ResizeObserver on the active village card.
 * Disconnects previous observers on re-render to avoid memory leaks.
 */
function initActiveProfileLayoutObserver() {
    const card = document.querySelector('.active-profile-card');
    if (!card || typeof ResizeObserver === 'undefined') return;

    if (activeProfileResizeObserver) {
        activeProfileResizeObserver.disconnect();
    }

    activeProfileResizeObserver = new ResizeObserver(() => {
        updateActiveProfileLayout();
    });
    activeProfileResizeObserver.observe(card);
    updateActiveProfileLayout();
}

/**
 * Renders the Active Village Showcase banner.
 * @param {import('../../core/playerStorage.js').SavedProfileSummary} summary
 * @param {any} playerData
 * @param {number} maxedCount
 * @param {number} totalCount
 */
export function renderActiveProfile(summary, playerData, maxedCount, totalCount) {
    const showcaseSection = document.getElementById('landing-active-profile');
    if (!showcaseSection) return;

    const profile = summary.cachedData || playerData?.playerProfile || playerData || {};
    const thLevel = Math.max(1, Math.min(18, Number(summary.townHallLevel || profile.townHallLevel) || 18));
    const name = summary.name || profile.name || summary.tag;
    const tag = formatDisplayTag(summary.tag || summary.cleanTag) || (summary.tag ? `#${summary.tag.replace(/^#+/, '')}` : '');
    const clanName = profile.clan?.name;
    const clanBadge = profile.clan?.badgeUrls?.small;
    const rawRole = profile.clan?.role || profile.role;
    const clanRoleDisplay = rawRole ? formatClanRole(rawRole) : '';
    const clanNameDisplay = clanName || translate('views.guidedSetup.noClan');

    const leagueId = Number(profile.leagueTier?.id || profile.league?.id);
    const canonicalLeague = leagueTiers.items.find(l => l.id === leagueId);
    const unrankedLeague = leagueTiers.items.find(l => l.id === UNRANKED_LEAGUE_ID) || leagueTiers.items[0];
    let leagueName = canonicalLeague?.name || profile.leagueTier?.name || profile.league?.name;
    if (canonicalLeague) {
        const leagueKey = 'entities.leagues.' + canonicalLeague.name.toLowerCase()
            .replace(/\./g, '')
            .replace(/\s(i+)$/i, (_, p1) => p1.toUpperCase())
            .replace(/\s/g, '_');
        leagueName = translate(leagueKey);
    }
    const leagueIcon = canonicalLeague?.iconUrls?.small || profile.leagueTier?.iconUrls?.small || profile.league?.iconUrls?.small || unrankedLeague?.iconUrls?.small;
    const trophies = summary.trophies != null ? summary.trophies : profile.trophies;

    const leagueNameText = leagueName || translate('entities.leagues.unranked');

    const existingCard = /** @type {HTMLElement | null} */ (showcaseSection.querySelector('.active-profile-card'));
    const isAlreadyVisible = showcaseSection.style.display !== 'none' && !showcaseSection.hidden;

    showcaseSection.hidden = false;
    showcaseSection.style.display = 'block';

    if (existingCard && isAlreadyVisible) {
        // In-place delta update to prevent layout flash
        const thImg = existingCard.querySelector('.th-badge-img');
        if (thImg) {
            thImg.setAttribute('src', `assets/th/th${thLevel}.png`);
            thImg.setAttribute('alt', `Town Hall ${thLevel}`);
        }
        const thOverlay = existingCard.querySelector('.th-badge-level-overlay');
        if (thOverlay) thOverlay.textContent = String(thLevel);

        const nameEl = existingCard.querySelector('.player-name');
        if (nameEl) nameEl.textContent = name;
        const tagEl = existingCard.querySelector('.player-tag');
        if (tagEl) tagEl.textContent = tag;

        const clanContainer = existingCard.querySelector('.player-clan-mini');
        if (clanContainer) {
            const clanBadgeImg = clanContainer.querySelector('.clan-badge-img-mini');
            if (clanBadge) {
                if (clanBadgeImg) {
                    clanBadgeImg.setAttribute('src', clanBadge);
                } else {
                    const newBadge = document.createElement('orecalc-assets-image');
                    newBadge.className = 'clan-badge-img-mini';
                    newBadge.setAttribute('src', clanBadge);
                    newBadge.setAttribute('alt', translate('player.clanBadge'));
                    newBadge.setAttribute('data-i18n-alt', 'player.clanBadge');
                    newBadge.setAttribute('size', 'standard');
                    clanContainer.prepend(newBadge);
                }
            } else if (clanBadgeImg) {
                clanBadgeImg.remove();
            }

            const clanNameEl = clanContainer.querySelector('.clan-name-mini');
            if (clanNameEl) clanNameEl.textContent = clanNameDisplay;

            let clanRoleEl = clanContainer.querySelector('.clan-role-mini');
            if (clanRoleDisplay) {
                if (!clanRoleEl) {
                    clanRoleEl = document.createElement('span');
                    clanRoleEl.className = 'clan-role-mini';
                    clanContainer.querySelector('.clan-info-col')?.appendChild(clanRoleEl);
                }
                clanRoleEl.textContent = clanRoleDisplay;
                if (rawRole) {
                    clanRoleEl.setAttribute('data-i18n', `player.roles.${String(rawRole).toLowerCase()}`);
                }
            } else if (clanRoleEl) {
                clanRoleEl.remove();
            }
        }

        const leagueDetails = existingCard.querySelector('.league-details-mini');
        if (leagueDetails) {
            leagueDetails.setAttribute('title', leagueNameText);
            const leagueBadgeImg = leagueDetails.querySelector('.league-badge-img-mini');
            if (leagueBadgeImg && leagueIcon) {
                leagueBadgeImg.setAttribute('src', leagueIcon);
                leagueBadgeImg.setAttribute('alt', leagueNameText);
            }
            const leagueNameEl = leagueDetails.querySelector('.league-name-mini');
            if (leagueNameEl) {
                leagueNameEl.textContent = leagueNameText;
                const leagueKey = canonicalLeague ? getLeagueI18nKey(canonicalLeague) : 'entities.leagues.unranked';
                leagueNameEl.setAttribute('data-i18n', leagueKey);
            }
        }

        const trophiesSpan = existingCard.querySelector('.player-trophies-mini span');
        if (trophiesSpan) {
            const prevTrophies = Number((trophiesSpan.textContent || '').replace(/\D/g, '')) || 0;
            const targetTrophies = Number(trophies) || 0;
            if (prevTrophies !== targetTrophies) {
                animateValue(trophiesSpan, prevTrophies, targetTrophies, 1800, val => formatNumber(Math.round(val)));
            } else {
                trophiesSpan.textContent = trophies != null ? formatNumber(targetTrophies) : '--';
            }
        }

        const maxedCountSpan = existingCard.querySelector('.maxed-count');
        if (maxedCountSpan) {
            const prevMaxed = parseInt((maxedCountSpan.textContent || '').split('/')[0], 10) || 0;
            if (prevMaxed !== maxedCount) {
                animateValue(maxedCountSpan, prevMaxed, maxedCount, 1800, val => `${Math.round(val)}/${totalCount}`);
            } else {
                maxedCountSpan.textContent = `${maxedCount}/${totalCount}`;
            }
        }

        updateActiveProfileLayout();
        return;
    }

    const actionsRowHtml = `
        <div class="player-maxed-equip-mini" title="${translate('views.home.profile.maxedEquipment')}">
            <orecalc-assets-svg name="equipment-filled" height="12" width="12" class="maxed-equip-icon-mini" aria-hidden="true"></orecalc-assets-svg>
            <span><span class="maxed-count">0/${totalCount}</span> <span data-i18n="views.home.profile.maxedEquipment">${translate('views.home.profile.maxedEquipment')}</span></span>
        </div>
    `;

    const profileData = {
        name,
        tag,
        trophies: trophies != null ? trophies : 0,
        clan: clanName ? {
            name: clanName,
            badgeUrls: clanBadge ? { small: clanBadge } : null
        } : null,
        role: rawRole,
        leagueTier: canonicalLeague || (leagueId ? { id: leagueId } : null)
    };

    showcaseSection.innerHTML = renderProfileHeaderHtml({
        profile: profileData,
        isGuest: false,
        thLevel,
        tag,
        trophies: trophies != null ? trophies : 0,
        prevTrophies: 0,
        actionsRowHtml,
        headerExtraClasses: 'active-profile-card'
    });
    showcaseSection.hidden = false;
    showcaseSection.style.display = 'block';
    initActiveProfileLayoutObserver();

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const trophiesSpan = showcaseSection.querySelector('.player-trophies-mini span');
            if (trophiesSpan && trophies != null) {
                animateValue(trophiesSpan, 0, trophies, 1800, val => formatNumber(Math.round(val)));
            } else if (trophiesSpan) {
                trophiesSpan.textContent = '--';
            }

            const maxedCountSpan = showcaseSection.querySelector('.maxed-count');
            if (maxedCountSpan && totalCount > 0) {
                animateValue(maxedCountSpan, 0, maxedCount, 1800, val => `${Math.round(val)}/${totalCount}`);
            }
        });
    });
}
