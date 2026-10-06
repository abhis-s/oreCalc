import { escapeHTML } from '../../utils/stringUtils.js';
import { formatDisplayTag } from '../../core/storageKeys.js';
import { UNRANKED_LEAGUE_ID } from '../../core/constants.js';
import { leagueTiers } from '../../data/leagueTiers.js';
import { translate } from '../../i18n/translator.js';
import { formatNumber } from '../../utils/numberFormatter.js';

/** Flag to guard singleton document click listener for delete confirmation dismissal */
let isDeleteDismissInitialized = false;

/**
 * Renders the Village Account Cards grid.
 * @param {import('../../core/playerStorage.js').SavedProfileSummary[]} savedProfiles
 * @param {string} activeTag
 * @param {(tag: string) => void} onSelectAccount
 * @param {(tag: string) => void} onDeleteAccount
 */
export function renderAccountsGrid(savedProfiles, activeTag, onSelectAccount, onDeleteAccount) {
    const section = document.getElementById('landing-saved-accounts');
    const header = section?.querySelector('.landing-accounts-header');
    const list = document.getElementById('landing-accounts-list');
    const countBadge = document.getElementById('landing-accounts-count');

    if (!section || !list) return;

    if (savedProfiles.length === 0) {
        if (header) {
            /** @type {HTMLElement} */ (header).hidden = true;
            /** @type {HTMLElement} */ (header).style.display = 'none';
        }
        list.hidden = true;
        list.style.display = 'none';
        return;
    }

    section.hidden = false;
    section.style.display = 'flex';
    if (header) {
        /** @type {HTMLElement} */ (header).hidden = false;
        /** @type {HTMLElement} */ (header).style.display = 'flex';
    }
    list.hidden = false;
    list.style.display = 'grid';
    if (countBadge) {
        countBadge.textContent = String(savedProfiles.length);
    }

    list.innerHTML = '';
    for (const profile of savedProfiles) {
        const isActive = profile.cleanTag === activeTag;
        const thLevel = Math.max(1, Math.min(18, Number(profile.townHallLevel) || 18));
        const clanName = profile.cachedData?.clan?.name;
        const clanBadge = profile.cachedData?.clan?.badgeUrls?.small;
        const trophies = profile.trophies != null ? profile.trophies : profile.cachedData?.trophies;

        const leagueId = Number(profile.cachedData?.leagueTier?.id || profile.cachedData?.league?.id);
        const canonicalLeague = leagueTiers.items.find(l => l.id === leagueId);
        const unrankedLeague = leagueTiers.items.find(l => l.id === UNRANKED_LEAGUE_ID) || leagueTiers.items[0];
        const leagueIcon = canonicalLeague?.iconUrls?.small || profile.cachedData?.leagueTier?.iconUrls?.small || unrankedLeague?.iconUrls?.small;
        let leagueName = canonicalLeague?.name || '';
        if (canonicalLeague) {
            const leagueKey = 'entities.leagues.' + canonicalLeague.name.toLowerCase()
                .replace(/\./g, '')
                .replace(/\s(i+)$/i, (_, p1) => p1.toUpperCase())
                .replace(/\s/g, '_');
            leagueName = translate(leagueKey);
        }
        const leagueNameDisplay = leagueName || translate('entities.leagues.unranked');

        const card = document.createElement('button');
        card.type = 'button';
        card.className = `landing-account-card ${isActive ? 'is-active' : ''}`;
        card.dataset.tag = profile.cleanTag;
        card.setAttribute('role', 'option');
        card.setAttribute('aria-selected', isActive ? 'true' : 'false');
        const displayTag = formatDisplayTag(profile.tag || profile.cleanTag) || (profile.tag ? `#${profile.tag.replace(/^#+/, '')}` : '');
        card.title = translate('views.landing.selectVillageAria', { name: profile.name, tag: displayTag });

        card.innerHTML = `
            <div class="account-card-th">
                <orecalc-assets-image class="th-mini-img" src="assets/th/th${thLevel}.png" alt="TH${thLevel}" size="standard"></orecalc-assets-image>
                <span class="th-mini-level">${thLevel}</span>
            </div>
            <div class="account-card-player">
                <span class="account-card-name">${escapeHTML(profile.name)}</span>
                <span class="account-card-tag">${escapeHTML(displayTag)}</span>
            </div>
            <div class="account-card-meta">
                <div class="account-card-clan">
                    ${clanBadge ? `<orecalc-assets-image class="clan-badge-img-tiny" src="${clanBadge}" alt="" size="standard"></orecalc-assets-image>` : ''}
                    <span class="clan-name-text">${escapeHTML(clanName || translate('views.guidedSetup.noClan'))}</span>
                </div>
                <div class="account-card-stats">
                    <span class="account-card-trophies">
                        <orecalc-assets-svg name="trophy" width="11" height="11" class="trophy-icon-mini trophy-icon-amber" aria-hidden="true"></orecalc-assets-svg>
                        <span>${trophies != null ? formatNumber(Number(trophies) || 0) : 0}</span>
                    </span>
                    <span class="account-card-league" title="${escapeHTML(leagueNameDisplay)}">
                        <orecalc-assets-image class="league-badge-img-tiny" src="${leagueIcon}" alt="${escapeHTML(leagueNameDisplay)}" size="standard"></orecalc-assets-image>
                    </span>
                </div>
            </div>
            <button type="button" class="account-card-delete-btn" data-tag="${profile.cleanTag}" aria-label="${translate('player.removePlayer')}: ${escapeHTML(profile.name)}" title="${translate('player.removePlayer')}">
                <orecalc-assets-svg name="trash" width="13" height="13" class="delete-icon" aria-hidden="true"></orecalc-assets-svg>
                <span class="delete-confirm-text">${translate('actions.confirm')}</span>
            </button>
        `;

        const deleteBtn = card.querySelector('.account-card-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (deleteBtn.classList.contains('is-confirming')) {
                    onDeleteAccount(profile.cleanTag);
                } else {
                    list.querySelectorAll('.account-card-delete-btn.is-confirming').forEach(b => {
                        b.classList.remove('is-confirming');
                        b.closest('.landing-account-card')?.classList.remove('is-confirming-delete');
                    });
                    deleteBtn.classList.add('is-confirming');
                    card.classList.add('is-confirming-delete');
                }
            });
        }

        card.addEventListener('click', () => {
            onSelectAccount(profile.cleanTag);
        });

        list.appendChild(card);
    }

    if (!isDeleteDismissInitialized) {
        isDeleteDismissInitialized = true;
        document.addEventListener('click', (e) => {
            if (!(/** @type {HTMLElement} */ (e.target))?.closest?.('.account-card-delete-btn')) {
                document.querySelectorAll('.account-card-delete-btn.is-confirming').forEach(b => {
                    b.classList.remove('is-confirming');
                    b.closest('.landing-account-card')?.classList.remove('is-confirming-delete');
                });
            }
        });
    }
}
