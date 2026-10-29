import { leagueTiers } from '../../data/leagueTiers.js';
import { translate } from '../../i18n/translator.js';
import { UNRANKED_LEAGUE_ID } from '../../core/constants.js';
import { formatDisplayTag } from '../../core/storageKeys.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { getMaxTownHallLevel } from '../../domain/income/heroJourneyLevels.js';

/**
 * js/components/common/profileHeaderRenderer.js
 * Single source of truth for rendering the standardized .home-profile-header markup across
 * OreCalc Home tab, Hero Journey, and Landing portal profile cards.
 */

/**
 * Formats the clan role for localization.
 *
 * @param {string} role - Clan role enum value.
 * @returns {string} Localized clan role string.
 */
export function formatClanRole(role) {
    if (!role) return '';
    const key = `player.roles.${role.toLowerCase()}`;
    const translated = translate(key);
    return translated !== key ? translated : role;
}

/**
 * Resolves canonical i18n translation key for a Clash of Clans league tier.
 *
 * @param {Object|null} leagueData - League tier object from leagueTiers.
 * @returns {string} Dot-notated translation path in entities.leagues.*.
 */
export function getLeagueI18nKey(leagueData) {
    if (!leagueData || !leagueData.name) {
        return 'entities.leagues.unranked';
    }
    return 'entities.leagues.' + leagueData.name.toLowerCase()
        .replace(/\./g, '')
        .replace(/\s(i+)$/i, (_, p1) => p1.toUpperCase())
        .replace(/\s/g, '_');
}

/**
 * Renders the standardized Connect Profile button markup.
 *
 * @param {Object} [options]
 * @param {string} [options.id='home-profile-connect-btn'] - Button element ID.
 * @param {string} [options.extraClass=''] - Additional class names.
 * @returns {string} Rendered button HTML.
 */
export function renderConnectProfileButtonHtml({ id = 'home-profile-connect-btn', extraClass = '' } = {}) {
    const connectLabel = translate('views.home.profile.connectBtn');
    const safeId = escapeHTML(id);
    const extraClassStr = extraClass ? ` ${escapeHTML(extraClass)}` : '';
    return `
        <button id="${safeId}" class="unconnected-connect-btn${extraClassStr}" type="button" aria-label="${connectLabel}" title="${connectLabel}" data-i18n-aria-label="views.home.profile.connectBtn" data-i18n-title="views.home.profile.connectBtn">
            <clashcalc-assets-svg name="plus" height="14" width="14"></clashcalc-assets-svg>
            <span data-i18n="views.home.profile.connectBtn">${connectLabel}</span>
        </button>
    `.trim();
}

/**
 * Renders the standardized .home-profile-header HTML markup.
 *
 * @param {Object} options
 * @param {Object|null} [options.profile] - Player data object from API or storage.
 * @param {boolean} [options.isGuest=false] - Whether this profile is a guest / unconnected baseline.
 * @param {number} [options.thLevel] - Town Hall level (defaults to profile.townHallLevel or 18).
 * @param {string} [options.tag] - Player tag string (defaults to profile.tag).
 * @param {number|null} [options.trophies] - Target trophies count.
 * @param {number} [options.prevTrophies=0] - Previous trophies count for animations.
 * @param {string} [options.trophiesHtml] - Optional custom HTML for trophies counter.
 * @param {Object|boolean|null} [options.maxEquipment=null] - Programmatic max equipment count options ({ current, total, prev }).
 * @param {Object|string|boolean|null} [options.plannerBridge=null] - Programmatic bridge link options ({ url }).
 * @param {boolean} [options.hasCollapsibleStats=false] - Whether this card supports collapsible stats (renders chevron if connected).
 * @param {boolean} [options.isCollapsed=false] - Initial state for the collapse chevron button.
 * @param {string} [options.actionsRowHtml=''] - Optional supplementary action controls.
 * @param {string} [options.headerExtraClasses=''] - Additional CSS classes for the header container.
 * @returns {string} Rendered HTML string.
 */
export function renderProfileHeaderHtml({
    profile = null,
    isGuest = false,
    thLevel = null,
    tag = '',
    trophies = null,
    prevTrophies = 0,
    trophiesHtml = '',
    maxEquipment = null,
    plannerBridge = null,
    hasCollapsibleStats = false,
    isCollapsed = false,
    actionsRowHtml = '',
    headerExtraClasses = ''
} = {}) {
    const activeTh = Number(thLevel || profile?.townHallLevel || getMaxTownHallLevel());
    const thImgUrl = `assets/th/th${activeTh}.png`;

    const leagueId = Number(profile?.leagueTier?.id || profile?.league?.id || UNRANKED_LEAGUE_ID);
    const leagueData = leagueTiers.items.find(l => l.id === leagueId)
        || (profile?.league?.name ? leagueTiers.items.find(l => l.name.toLowerCase() === profile.league.name.toLowerCase()) : null)
        || (profile?.leagueTier?.name ? leagueTiers.items.find(l => l.name.toLowerCase() === profile.leagueTier.name.toLowerCase()) : null);
    const unrankedLeague = leagueTiers.items.find(l => l.id === UNRANKED_LEAGUE_ID) || leagueTiers.items[0];

    const leagueKey = getLeagueI18nKey(leagueData);
    const leagueNameText = translate(leagueKey);
    const safeLeagueName = escapeHTML(leagueNameText);

    const leagueIconUrl = leagueData?.iconUrls?.small || unrankedLeague?.iconUrls?.small || 'https://api-assets.clashofclans.com/leaguetiers/125/yyYo5DUFeFBZvmMEQh0ZxvG-1sUOZ_S3kDMB7RllXX0.png';
    const safeLeagueIconUrl = escapeHTML(leagueIconUrl);
    const leagueIconHtml = `<clashcalc-assets-image class="league-badge-img-mini" src="${safeLeagueIconUrl}" alt="${safeLeagueName}" size="standard"></clashcalc-assets-image>`;

    const targetTrophies = trophies !== null ? trophies : (Number(profile?.trophies) || 0);
    const resolvedTrophiesHtml = trophiesHtml || (isGuest
        ? '<span>--</span>'
        : `<span data-target-trophies="${targetTrophies}" data-prev-trophies="${prevTrophies}">${formatNumber(prevTrophies)}</span>`);

    let identityHtml = '';
    let clanHtml = '';

    if (isGuest || !profile) {
        identityHtml = `
            <div class="player-identity-info">
                <h2 class="player-name" data-i18n="views.home.profile.noProfileTitle">${translate('views.home.profile.noProfileTitle')}</h2>
                <span class="player-tag-guest-badge" data-i18n="views.guidedSetup.guestProfileTag">${translate('views.guidedSetup.guestProfileTag')}</span>
            </div>
        `;
        clanHtml = `
            <div class="player-clan-mini">
                <span class="clan-name-mini text-muted" data-i18n="views.guidedSetup.noClan">${translate('views.guidedSetup.noClan')}</span>
            </div>
        `;
    } else {
        const rawTag = tag || profile.tag || '';
        const displayTag = formatDisplayTag(rawTag) || (rawTag ? `#${rawTag.replace(/^#+/, '')}` : '');
        const safeTag = escapeHTML(displayTag);
        const safePlayerName = escapeHTML(profile.name || 'Player');

        identityHtml = `
            <div class="player-identity-info">
                <h2 class="player-name">${safePlayerName}</h2>
                <span class="player-tag">${safeTag}</span>
            </div>
        `;

        if (profile.clan?.name) {
            const badgeUrl = profile.clan.badgeUrls?.small || '';
            const safeBadgeUrl = escapeHTML(badgeUrl);
            const badgeImg = badgeUrl ? `<clashcalc-assets-image class="clan-badge-img-mini" src="${safeBadgeUrl}" alt="${escapeHTML(translate('player.clanBadge'))}" data-i18n-alt="player.clanBadge"></clashcalc-assets-image>` : '';

            let roleHtml = '';
            if (profile.role) {
                const roleKey = `player.roles.${String(profile.role).toLowerCase()}`;
                const roleText = formatClanRole(profile.role);
                roleHtml = `<span class="clan-role-mini" data-i18n="${roleKey}">${escapeHTML(roleText)}</span>`;
            }

            clanHtml = `
                <div class="player-clan-mini">
                    ${badgeImg}
                    <div class="clan-info-col">
                        <span class="clan-name-mini">${escapeHTML(profile.clan.name)}</span>
                        ${roleHtml}
                    </div>
                </div>
            `;
        } else {
            clanHtml = `
                <div class="player-clan-mini">
                    <span class="clan-name-mini text-muted" data-i18n="views.guidedSetup.noClan">${translate('views.guidedSetup.noClan')}</span>
                </div>
            `;
        }
    }

    let resolvedActionsHtml = '';

    if (maxEquipment) {
        const isGuestMode = isGuest || !profile;
        const totalCount = isGuestMode ? '--' : (maxEquipment.total !== undefined ? maxEquipment.total : '--');
        const displayCount = isGuestMode ? '--' : (maxEquipment.prev !== undefined ? maxEquipment.prev : (maxEquipment.current !== undefined ? maxEquipment.current : '--'));
        const targetAttr = !isGuestMode && maxEquipment.current !== undefined ? ` data-target-maxed="${maxEquipment.current}"` : '';
        const prevAttr = !isGuestMode && maxEquipment.prev !== undefined ? ` data-prev-maxed="${maxEquipment.prev}"` : '';
        const totalAttr = !isGuestMode && maxEquipment.total !== undefined ? ` data-total-equip="${maxEquipment.total}"` : '';

        resolvedActionsHtml += `
            <div class="player-maxed-equip-mini" title="${translate('views.home.profile.maxedEquipment')}">
                <clashcalc-assets-svg name="equipment-filled" height="12" width="12" class="maxed-equip-icon-mini" aria-hidden="true"></clashcalc-assets-svg>
                <span><span class="maxed-count"${targetAttr}${prevAttr}${totalAttr}>${displayCount}/${totalCount}</span> <span data-i18n="views.home.profile.maxedEquipment">${translate('views.home.profile.maxedEquipment')}</span></span>
            </div>
        `;
    }

    if (plannerBridge) {
        const bridgeUrl = typeof plannerBridge === 'string' ? plannerBridge : (plannerBridge.url || '/ore-calculator/');
        const safeBridgeUrl = escapeHTML(bridgeUrl);
        const bridgeTitle = translate('views.heroJourney.page.backToPlannerHelp');
        const bridgeLabel = translate('views.heroJourney.page.backToEquipmentPlanner');
        resolvedActionsHtml += `
            <a href="${safeBridgeUrl}" class="hj-planner-bridge-btn" title="${bridgeTitle}" aria-label="${bridgeLabel}" data-i18n-title="views.heroJourney.page.backToPlannerHelp" data-i18n-aria-label="views.heroJourney.page.backToEquipmentPlanner">
                <clashcalc-assets-svg name="planner-filled" height="14" width="14" class="planner-bridge-icon"></clashcalc-assets-svg>
                <span class="planner-bridge-label" data-i18n="views.heroJourney.page.backToEquipmentPlanner">${bridgeLabel}</span>
            </a>
        `;
    }

    if (actionsRowHtml) {
        resolvedActionsHtml += actionsRowHtml;
    }

    if (isGuest || !profile || profile.tag === 'DEFAULT0') {
        if (!resolvedActionsHtml.includes('unconnected-connect-btn')) {
            resolvedActionsHtml += renderConnectProfileButtonHtml();
        }
    } else if (hasCollapsibleStats) {
        if (!resolvedActionsHtml.includes('profile-collapse-toggle-btn')) {
            const collapseLabel = isCollapsed ? translate('views.home.profile.expandStats') : translate('views.home.profile.collapseStats');
            const chevronIcon = isCollapsed ? 'chevron-down' : 'chevron-up';
            resolvedActionsHtml += `
                <button id="home-profile-collapse-btn" class="profile-collapse-toggle-btn" type="button" aria-expanded="${!isCollapsed}" aria-label="${collapseLabel}" title="${collapseLabel}">
                    <clashcalc-assets-svg name="${chevronIcon}" height="16" width="16" class="collapse-chevron-icon"></clashcalc-assets-svg>
                </button>
            `;
        }
    }

    const extraClassStr = headerExtraClasses ? ` ${headerExtraClasses}` : '';
    const guestClassStr = isGuest ? ' is-guest' : '';
    const silhouetteClassStr = isGuest ? ' is-silhouette' : '';
    const leagueDetailsTitleAttr = isGuest
        ? `title="${safeLeagueName}" data-i18n-title="entities.leagues.unranked"`
        : `title="${safeLeagueName}"`;

    return `
        <div class="home-profile-header${extraClassStr}${guestClassStr}">
            <div class="profile-meta-left">
                <div class="th-badge-wrapper">
                    <clashcalc-assets-image class="th-badge-img${silhouetteClassStr}" src="${thImgUrl}" alt="Town Hall ${activeTh}" size="standard"></clashcalc-assets-image>
                    <span class="th-badge-level-overlay">${activeTh}</span>
                </div>
                <div class="player-identity">
                    ${identityHtml}
                    ${clanHtml}
                </div>
            </div>

            <div class="profile-meta-right">
                <div class="league-details-mini" ${leagueDetailsTitleAttr}>
                    ${leagueIconHtml}
                    <div class="league-text-mini">
                        <span class="league-name-mini" data-i18n="${leagueKey}">${safeLeagueName}</span>
                        <div class="player-trophies-mini">
                            <clashcalc-assets-svg name="trophy" height="12" width="12" class="trophy-icon-mini"></clashcalc-assets-svg>
                            ${resolvedTrophiesHtml}
                        </div>
                    </div>
                </div>
                ${resolvedActionsHtml ? `
                    <div class="profile-meta-actions-row">
                        ${resolvedActionsHtml}
                    </div>
                ` : ''}
            </div>
        </div>
    `.trim();
}
