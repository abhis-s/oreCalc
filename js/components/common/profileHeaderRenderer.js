import { leagueTiers } from '../../data/leagueTiers.js';
import { translate } from '../../i18n/translator.js';
import { UNRANKED_LEAGUE_ID } from '../../core/constants.js';
import { formatDisplayTag } from '../../core/storageKeys.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { escapeHTML } from '../../utils/stringUtils.js';

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
 * @param {string} [options.actionsRowHtml=''] - Page-specific action controls injected into the right metadata column.
 * @param {string} [options.headerExtraClasses=''] - Additional CSS classes for the header container.
 * @returns {string} Rendered HTML string.
 */
export function renderProfileHeaderHtml({
    profile = null,
    isGuest = false,
    thLevel = 18,
    tag = '',
    trophies = null,
    prevTrophies = 0,
    trophiesHtml = '',
    actionsRowHtml = '',
    headerExtraClasses = ''
} = {}) {
    const activeTh = Number(thLevel || profile?.townHallLevel || 18);
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
    const leagueIconHtml = `<orecalc-assets-image class="league-badge-img-mini" src="${safeLeagueIconUrl}" alt="${safeLeagueName}" size="standard"></orecalc-assets-image>`;

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
            const badgeImg = badgeUrl ? `<orecalc-assets-image class="clan-badge-img-mini" src="${safeBadgeUrl}" alt="${escapeHTML(translate('player.clanBadge'))}" data-i18n-alt="player.clanBadge"></orecalc-assets-image>` : '';

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
                    <orecalc-assets-image class="th-badge-img${silhouetteClassStr}" src="${thImgUrl}" alt="Town Hall ${activeTh}" size="standard"></orecalc-assets-image>
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
                            <orecalc-assets-svg name="trophy" height="12" width="12" class="trophy-icon-mini"></orecalc-assets-svg>
                            ${resolvedTrophiesHtml}
                        </div>
                    </div>
                </div>
                ${actionsRowHtml ? `
                    <div class="profile-meta-actions-row">
                        ${actionsRowHtml}
                    </div>
                ` : ''}
            </div>
        </div>
    `.trim();
}
