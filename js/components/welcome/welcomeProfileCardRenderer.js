import { translate } from '../../i18n/translator.js';

import { loadPlayerData } from '../../core/localStorageManager.js';
import { isProfileOnboarded, state } from '../../core/state.js';
import { switchActivePlayer } from '../../core/stateManager.js';

import { escapeHTML } from '../../utils/stringUtils.js';
import { getSVG } from '../../utils/svgManager.js';

import { welcomeState } from './welcomeModalState.js';
import { renderProfilePreviewCard, updatePreviewArrowPosition } from './welcomeProfileDisplay.js';
import { syncWelcomeQuickSettings } from './welcomeSettingsDisplay.js';

const safeRaf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 0);

/**
 * Creates a compact profile card element for the welcome wizard profiles carousel.
 * @param {string} tag
 * @param {string|null} activeTag
 * @param {Object} [upd]
 * @param {Object} [err]
 * @param {string} [prefix='welcome-profile-']
 * @returns {HTMLDivElement}
 */
export function createCompactProfileCard(tag, activeTag, upd, err, prefix = 'welcome-profile-') {
    const card = document.createElement('div');
    card.className = 'welcome-profile-card-compact';
    card.dataset.tag = tag;
    if (tag === activeTag) card.classList.add('active');
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');

    const playerData = loadPlayerData(tag);
    /** @type {any} */
    const profile = playerData ? (playerData.playerProfile || playerData) : null;
    const name = (profile && profile.name) ? profile.name : tag;
    const thLevel = (profile && profile.townHallLevel) ? profile.townHallLevel : 1;

    const isGuest = (tag === 'DEFAULT0');
    const accessibleLabel = `${isGuest ? translate('player.guest') : name} ${isGuest ? '' : `#${tag}`}`.trim();
    card.setAttribute('aria-label', accessibleLabel);

    card.addEventListener('focus', () => {
        const list = card.parentElement;
        if (list && (list.classList.contains('welcome-profiles-list') || list.id === 'welcome-profiles-list' || list.id === 'welcome-qs-profiles-list')) {
            const pad = 24;
            if (card.offsetLeft < list.scrollLeft + pad) {
                list.scrollLeft = Math.max(0, card.offsetLeft - pad);
            } else if (card.offsetLeft + card.offsetWidth > list.scrollLeft + list.clientWidth - pad) {
                list.scrollLeft = card.offsetLeft + card.offsetWidth - list.clientWidth + pad;
            }
        }
    });

    const thImg = document.createElement('orecalc-assets-image');
    thImg.setAttribute('class', 'welcome-profile-card-th-img');
    thImg.setAttribute('src', `assets/th/th${thLevel}.png`);
    thImg.setAttribute('alt', `TH ${thLevel}`);
    thImg.setAttribute('size', 'thumbnail');

    const details = document.createElement('div');
    details.className = 'welcome-profile-card-details';

    const nameEl = document.createElement('span');
    nameEl.className = 'welcome-profile-card-name';
    nameEl.textContent = isGuest ? translate('player.guest') : name;

    const tagEl = document.createElement('span');
    tagEl.className = 'welcome-profile-card-tag';
    tagEl.textContent = isGuest ? '' : `#${tag}`;

    details.appendChild(nameEl);
    details.appendChild(tagEl);

    const statusContainer = document.createElement('div');
    statusContainer.className = 'welcome-profile-card-status';

    const isUpd = upd && upd[tag];
    const isErr = err && err[tag];

    if (isUpd) {
        statusContainer.innerHTML = `<span class="status-icon loading-spinner"></span><span class="loading-countdown"></span>`;
    } else if (isErr) {
        statusContainer.innerHTML = `
            <span class="status-icon error-icon" title="${escapeHTML(isErr)}">
                ${getSVG('sync-problem', '', 16, 16, 'var(--color-danger)')}
            </span>
        `;
    } else if (welcomeState.successProfiles && welcomeState.successProfiles[tag] === true) {
        statusContainer.innerHTML = `
            <span class="status-icon success-icon" title="${escapeHTML(translate('views.welcome.syncSuccess'))}">
                ${getSVG('sync', '', 16, 16, 'var(--color-success)')}
            </span>
        `;
    } else {
        statusContainer.innerHTML = `
            <span class="status-icon error-icon" title="${escapeHTML(translate('views.welcome.syncRequired'))}">
                ${getSVG('sync-problem', '', 16, 16, 'var(--color-danger)')}
            </span>
        `;
    }

    card.appendChild(thImg);
    card.appendChild(details);
    card.appendChild(statusContainer);

    card.addEventListener('click', () => {
        switchActivePlayer(tag);

        renderWelcomeProfilesList(welcomeState.updatingProfiles, welcomeState.errorProfiles);

        safeRaf(() => {
            const freshCard = document.querySelector(`.welcome-profile-card-compact[data-tag="${tag}"]`);
            if (freshCard && freshCard instanceof HTMLElement) {
                const list = freshCard.parentElement;
                if (list) {
                    const pad = 24;
                    if (freshCard.offsetLeft < list.scrollLeft + pad) {
                        list.scrollLeft = Math.max(0, freshCard.offsetLeft - pad);
                    } else if (freshCard.offsetLeft + freshCard.offsetWidth > list.scrollLeft + list.clientWidth - pad) {
                        list.scrollLeft = freshCard.offsetLeft + freshCard.offsetWidth - list.clientWidth + pad;
                    }
                }
            }
        });

        const activePlayer = state.allPlayersData[tag];
        if (activePlayer && (activePlayer.playerProfile || activePlayer.playerData)) {
            renderProfilePreviewCard(activePlayer.playerProfile || activePlayer.playerData);
            welcomeState.isProfileLoaded = true;
        } else {
            const previewContainer = document.getElementById('welcome-profile-preview-container');
            if (previewContainer) previewContainer.style.display = 'none';
            welcomeState.isProfileLoaded = false;
        }

        syncWelcomeQuickSettings(tag);
    });

    return card;
}

/**
 * Renders the horizontal profile cards list on Page 2 and Page 3 of the welcome modal.
 * @param {Object} [upd]
 * @param {Object} [err]
 */
export function renderWelcomeProfilesList(upd = welcomeState.updatingProfiles, err = welcomeState.errorProfiles) {
    const listContainer = document.getElementById('welcome-profiles-list');
    const fullContainer = document.getElementById('welcome-profiles-list-container');
    if (!listContainer || !fullContainer) return;

    const savedPlayers = state.savedPlayerTags.filter(tag => tag !== 'DEFAULT0');
    if (savedPlayers.length === 0) {
        fullContainer.style.display = 'none';
        const previewContainer = document.getElementById('welcome-profile-preview-container');
        if (previewContainer) previewContainer.style.display = 'none';
        welcomeState.isProfileLoaded = false;
        return;
    }

    fullContainer.style.display = 'block';

    const activeTag = (state.savedPlayerTags && state.savedPlayerTags[0] !== 'DEFAULT0' ? state.savedPlayerTags[0] : (savedPlayers[0] || null));

    listContainer.innerHTML = '';
    savedPlayers.forEach(tag => {
        const card = createCompactProfileCard(tag, activeTag, upd, err, 'welcome-profile-');
        listContainer.appendChild(card);
    });

    if (activeTag) {
        const activePlayer = state.allPlayersData[activeTag];
        if (activePlayer && (activePlayer.playerProfile || activePlayer.playerData)) {
            renderProfilePreviewCard(activePlayer.playerProfile || activePlayer.playerData);
            welcomeState.isProfileLoaded = true;
        }
    }

    updatePreviewArrowPosition();
}

/**
 * Renders the vertical profiles selection view list for multi-account setup.
 */
export function renderVerticalProfilesList() {
    const listContainer = document.getElementById('welcome-vertical-profiles-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    const tags = state.savedPlayerTags.filter(tag => state.savedPlayerTags.includes(tag));

    tags.forEach(tag => {
        const playerObj = state.allPlayersData[tag];
        if (!playerObj) return;

        const isGuest = (tag === 'DEFAULT0');
        const name = isGuest ? (translate('player.guest') || 'Guest') : (playerObj?.playerProfile?.name || playerObj?.playerData?.name || tag);
        const thLevel = playerObj?.playerProfile?.townHallLevel || playerObj?.townHallLevel || 1;

        const card = document.createElement('div');
        card.className = 'welcome-profile-card-vertical';
        card.dataset.tag = tag;

        const thImg = document.createElement('orecalc-assets-image');
        thImg.setAttribute('class', 'welcome-profile-card-th-img');
        thImg.setAttribute('src', `assets/th/th${thLevel}.png`);
        thImg.setAttribute('alt', `TH ${thLevel}`);
        thImg.setAttribute('size', 'thumbnail');

        const details = document.createElement('div');
        details.className = 'welcome-profile-card-details';

        const nameEl = document.createElement('span');
        nameEl.className = 'welcome-profile-card-name';
        nameEl.textContent = name;

        const tagEl = document.createElement('span');
        tagEl.className = 'welcome-profile-card-tag';
        tagEl.textContent = isGuest ? (translate('views.welcome.guestProfileTag') || 'Guest Profile') : `#${tag}`;

        details.appendChild(nameEl);
        details.appendChild(tagEl);

        const statusContainer = document.createElement('div');
        statusContainer.className = 'welcome-profile-card-status';

        const onboardingComplete = isProfileOnboarded(playerObj);
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        const accessibleLabel = `${name} ${isGuest ? (translate('views.welcome.guestProfileTag') || 'Guest Profile') : `#${tag}`} - ${onboardingComplete ? (translate('views.welcome.complete') || 'Complete') : (translate('views.welcome.setupRequired') || 'Setup Needed')}`;
        card.setAttribute('aria-label', accessibleLabel);

        if (welcomeState.updatingProfiles[tag]) {
            statusContainer.innerHTML = `<span class="status-icon loading-spinner"></span>`;
        } else if (onboardingComplete) {
            statusContainer.innerHTML = `
                <span class="status-icon success-icon" title="${translate('views.welcome.complete') || 'Complete'}">
                    ${getSVG('check-simple', '', 18, 18, 'var(--color-success)')}
                </span>
            `;
        } else {
            statusContainer.innerHTML = `
                <span class="status-icon warning-icon" title="${translate('views.welcome.setupRequired') || 'Setup Needed'}" style="display: flex; align-items: center; gap: 4px;">
                    ${getSVG('warning', '', 18, 18, 'var(--color-warning)')}
                    <span style="font-size: 11px; font-weight: 500; color: var(--color-warning); margin-left: 2px;" data-i18n="views.welcome.setupRequired">${translate('views.welcome.setupRequired') || 'Setup Needed'}</span>
                </span>
            `;
        }

        card.appendChild(thImg);
        card.appendChild(details);
        card.appendChild(statusContainer);

        listContainer.appendChild(card);
    });
}
