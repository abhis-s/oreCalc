import { fetchPlayerData } from '../../services/apiService.js';
import { processPlayerDataResponse } from '../../services/serverResponseHandler.js';
import { sanitizeHTML } from '../../ui/noticeModal.js';
import { logger } from '../../utils/logger.js';
import { validatePlayerTagInput } from '../../utils/playerTagValidator.js';
import { translate } from '../../i18n/translator.js';
import { escapeHTML } from '../../utils/stringUtils.js';

import { formatDisplayTag, normalizePlayerTag } from '../../core/storageKeys.js';
import { sanitizePlayerProfile } from '../../core/playerStorageSanitizer.js';
import { getSavedProfiles } from '../../core/playerStorage.js';
import { state } from '../../core/state.js';
import { UNRANKED_LEAGUE_ID } from '../../core/constants.js';
import { leagueTiers } from '../../data/leagueTiers.js';
import { formatNumber } from '../../utils/numberFormatter.js';

import { guidedSetupState, syncPreferencesFromProfile } from './guidedSetupState.js';
import { renderProfilePreviewCard } from './guidedSetupProfileDisplay.js';
import { syncGuidedSetupQuickSettings } from './guidedSetupStepsDisplay.js';

const safeRaf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 0);

let currentIdentityCompleteCallback = null;

/**
 * Renders stored village profiles list into Guided Setup Step 1.
 * @param {() => void} [onSelectProfile] - Optional callback triggered when a profile is selected.
 */
export function renderSavedProfilesList(onSelectProfile) {
    const container = document.getElementById('guided-setup-saved-profiles-container');
    const list = document.getElementById('guided-setup-saved-profiles-list');
    if (!container || !list) return;

    const input = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-player-tag-input'));
    if (input && input.value.trim().length > 0) {
        container.style.display = 'none';
        return;
    }

    const profiles = getSavedProfiles();
    if (!profiles || profiles.length === 0) {
        container.style.display = 'none';
        list.innerHTML = '';
        return;
    }

    const previewContainer = document.getElementById('guided-setup-profile-preview-container');
    const activeTag = normalizePlayerTag(state.savedPlayerTags?.[0] || '');
    const callback = onSelectProfile || currentIdentityCompleteCallback;

    list.innerHTML = '';
    for (const profile of profiles) {
        const cleanTag = profile.cleanTag;
        const displayTag = profile.tag || formatDisplayTag(cleanTag);
        const isActive = cleanTag === activeTag;
        const thLevel = profile.townHallLevel || 1;

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
        card.className = `guided-setup-saved-profile-card landing-account-card${isActive ? ' is-active' : ''}`;
        card.dataset.tag = cleanTag;
        card.setAttribute('role', 'option');
        card.setAttribute('aria-selected', String(isActive));
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', translate('views.landing.selectVillageAria', { name: profile.name, tag: displayTag }));

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
        `;

        const selectCard = () => {
            if (input) {
                input.value = cleanTag;
                input.classList.remove('input-error');
            }
            container.style.display = 'none';

            const existingPlayer = state.allPlayersData?.[cleanTag];
            guidedSetupState.activeTag = cleanTag;
            guidedSetupState.isProfileLoaded = true;

            const selectedTH = existingPlayer?.playerProfile?.townHallLevel || profile.townHallLevel || 16;
            const selectedLeague = existingPlayer?.playerProfile?.leagueTier?.id || 105000000;
            guidedSetupState.selectedTH = selectedTH;
            guidedSetupState.selectedLeague = selectedLeague;

            syncPreferencesFromProfile(cleanTag);
            syncGuidedSetupQuickSettings(cleanTag);

            const profileToRender = existingPlayer?.playerProfile || profile.cachedData || {
                name: profile.name,
                tag: displayTag,
                townHallLevel: selectedTH
            };
            renderProfilePreviewCard(profileToRender);

            if (previewContainer) {
                previewContainer.style.display = 'block';
            }

            const nextBtn = document.getElementById('guided-setup-next-btn');
            if (nextBtn && guidedSetupState.currentStep === 1) {
                nextBtn.style.display = 'inline-flex';
                safeRaf(() => {
                    if (typeof nextBtn.focus === 'function') nextBtn.focus();
                });
            }

            if (typeof callback === 'function') {
                callback();
            }
        };

        card.addEventListener('click', (e) => {
            e.preventDefault();
            selectCard();
        });

        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectCard();
            }
        });

        list.appendChild(card);
    }

    container.style.display = 'block';
}

/**
 * Initializes Step 1 (Village Identity) event listeners for player tag input and profile loading.
 * @param {HTMLElement} modal - The Guided Setup modal root element.
 * @param {() => void} [onIdentityComplete] - Optional callback triggered when profile is successfully loaded.
 */
export function initializeGuidedSetupIdentityInputs(modal, onIdentityComplete) {
    if (!modal) return;
    currentIdentityCompleteCallback = onIdentityComplete || null;

    const input = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-player-tag-input'));
    const errorMsg = document.getElementById('guided-setup-player-tag-error');
    const loadBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('guided-setup-load-btn'));
    const previewContainer = document.getElementById('guided-setup-profile-preview-container');

    const tabBtnInfo = document.getElementById('guided-setup-tab-btn-info');
    const tabBtnEquipment = document.getElementById('guided-setup-tab-btn-equipment');
    const tabContentInfo = document.getElementById('guided-setup-tab-content-info');
    const tabContentEquipment = document.getElementById('guided-setup-tab-content-equipment');

    // Preview Card tab switching
    if (tabBtnInfo && tabBtnEquipment && tabContentInfo && tabContentEquipment) {
        tabBtnInfo.addEventListener('click', (e) => {
            e.preventDefault();
            tabBtnInfo.classList.add('active');
            tabBtnEquipment.classList.remove('active');
            tabContentInfo.style.display = 'block';
            tabContentEquipment.style.display = 'none';
        });

        tabBtnEquipment.addEventListener('click', (e) => {
            e.preventDefault();
            tabBtnEquipment.classList.add('active');
            tabBtnInfo.classList.remove('active');
            tabContentEquipment.style.display = 'block';
            tabContentInfo.style.display = 'none';
        });
    }

    // Load Profile via API
    const handleLoadProfile = async () => {
        if (!input) return;
        const { cleanedTag, isValid } = validatePlayerTagInput(input, errorMsg);
        if (isValid && cleanedTag) {
            const originalText = loadBtn?.textContent || 'Load';
            try {
                if (loadBtn) {
                    loadBtn.disabled = true;
                    loadBtn.textContent = translate('actions.loading') || 'Loading...';
                }
                guidedSetupState.isInputProfileLoading = true;
                if (errorMsg) {
                    errorMsg.textContent = '';
                    errorMsg.classList.remove('show');
                }
                input.classList.remove('input-error');

                const playerData = await fetchPlayerData(cleanedTag);
                if (playerData && playerData.tag) {
                    processPlayerDataResponse(playerData);
                    const tagKey = normalizePlayerTag(playerData.tag);

                    guidedSetupState.activeTag = tagKey;
                    guidedSetupState.isProfileLoaded = true;
                    guidedSetupState.selectedTH = playerData.townHallLevel || 16;
                    guidedSetupState.selectedLeague = playerData.leagueTier?.id || 105000000;

                    syncPreferencesFromProfile(tagKey);
                    syncGuidedSetupQuickSettings(tagKey);
                    const profileToRender = state.allPlayersData[tagKey]?.playerProfile || sanitizePlayerProfile(playerData) || playerData;
                    renderProfilePreviewCard(profileToRender);

                    if (previewContainer) {
                        previewContainer.style.display = 'block';
                    }

                    const savedProfilesContainer = document.getElementById('guided-setup-saved-profiles-container');
                    if (savedProfilesContainer) {
                        savedProfilesContainer.style.display = 'none';
                    }

                    const nextBtn = document.getElementById('guided-setup-next-btn');
                    if (nextBtn && guidedSetupState.currentStep === 1) {
                        nextBtn.style.display = 'inline-flex';
                        safeRaf(() => {
                            if (typeof nextBtn.focus === 'function') nextBtn.focus();
                        });
                    }

                    if (typeof onIdentityComplete === 'function') {
                        onIdentityComplete();
                    }
                } else {
                    throw new Error('errors.invalidServerData');
                }
            } catch (err) {
                logger.error('Failed to load player in guided setup:', err);
                let errKey = /** @type {any} */ (err).message;
                if (/** @type {any} */ (err).name === 'TypeError' || errKey === 'Failed to fetch' || (typeof errKey === 'string' && errKey.includes('Failed to fetch'))) {
                    errKey = 'apiErrors.serverOffline';
                }
                const transMsg = translate(errKey);
                if (errorMsg) {
                    errorMsg.innerHTML = sanitizeHTML(translate('errors.fetchPlayerFailed', { error: transMsg }));
                    errorMsg.classList.add('show');
                }
                input.classList.add('input-error');
                input.classList.remove('shake');
                void input.offsetWidth;
                input.classList.add('shake');
                guidedSetupState.isProfileLoaded = false;
                const nextBtn = document.getElementById('guided-setup-next-btn');
                if (nextBtn && guidedSetupState.currentStep === 1) {
                    nextBtn.style.display = 'none';
                }
            } finally {
                if (loadBtn) {
                    loadBtn.disabled = false;
                    loadBtn.textContent = originalText;
                }
                guidedSetupState.isInputProfileLoading = false;
            }
        }
    };

    if (loadBtn) {
        loadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleLoadProfile();
        });
    }

    if (input) {
        input.addEventListener('input', () => {
            guidedSetupState.isProfileLoaded = false;
            guidedSetupState.activeTag = null;
            if (previewContainer) {
                previewContainer.style.display = 'none';
            }
            const nextBtn = document.getElementById('guided-setup-next-btn');
            if (nextBtn && guidedSetupState.currentStep === 1) {
                nextBtn.style.display = 'none';
            }
            if (errorMsg) {
                errorMsg.textContent = '';
                errorMsg.classList.remove('show');
            }
            input.classList.remove('input-error');

            const val = input.value.trim();
            const savedContainer = document.getElementById('guided-setup-saved-profiles-container');
            if (val.length > 0) {
                if (savedContainer) savedContainer.style.display = 'none';
            } else {
                renderSavedProfilesList(onIdentityComplete);
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleLoadProfile();
            }
        });
    }
}
