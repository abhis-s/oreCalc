import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import {
    syncWelcomeInertState,
    updateHeaderSkipButtonVisibility,
    updateSubmitButtonText,
    updateWelcomeContinueButtonText
} from './welcomeCarouselDisplay.js';
import { initializeGuestHeroesState } from './welcomeGuestHeroState.js';
import { welcomeState } from './welcomeModalState.js';
import { renderVerticalProfilesList } from './welcomeProfileCardRenderer.js';
import {
    renderWelcomeShopOffers,
    syncWelcomeQuickSettings
} from './welcomeSettingsDisplay.js';
import {
    renderWizardDots,
    updateGuestLeagueDropdown,
    updateWizardStepView
} from './welcomeWizardDisplay.js';
import {
    goToNextWizardStep,
    goToPrevWizardStep
} from './welcomeWizardState.js';
import { showConfirm } from '../../ui/noticeModal.js';

/**
 * Assembles and returns callback bindings for wizard lifecycle operations.
 * @returns {object} Object containing UI update and synchronization callbacks.
 */
export function getWizardCallbacks() {
    return {
        onInitializeGuestSetup: () => {
            initializeGuestSetup();
        },
        onSyncQuickSettings: (tag) => {
            syncWelcomeQuickSettings(tag);
        },
        onRenderWizardDots: () => {
            renderWizardDots();
        },
        onUpdateWizardStepView: () => {
            updateWizardStepView();
            syncWelcomeInertState();
        },
        onRenderVerticalProfilesList: () => {
            renderVerticalProfilesList();
        },
        onUpdateSubmitButtonText: () => {
            updateSubmitButtonText();
        },
        onUpdateWelcomeContinueButtonText: (page) => {
            updateWelcomeContinueButtonText(page);
        },
        onUpdateHeaderSkip: () => {
            updateHeaderSkipButtonVisibility();
        },
        onSyncInertState: () => {
            syncWelcomeInertState();
        }
    };
}

/**
 * Initializes Town Hall selection badges, horizontal scrolling, keyboard arrows, and league dropdown in Step 1.
 */
export function initializeGuestSetup() {
    const list = document.getElementById('welcome-guest-th-list');
    if (!list) return;

    list.innerHTML = '';
    for (let th = 1; th <= 18; th++) {
        const item = document.createElement('div');
        item.className = 'th-badge-item';
        if (th === welcomeState.selectedTH) item.classList.add('active');
        item.dataset.th = String(th);
        item.setAttribute('tabindex', '0');
        item.setAttribute('role', 'button');
        item.setAttribute('aria-label', `Town Hall ${th}`);
        item.setAttribute('aria-pressed', th === welcomeState.selectedTH ? 'true' : 'false');

        const img = document.createElement('orecalc-assets-image');
        img.className = 'th-badge-img';
        img.setAttribute('src', `assets/th/th${th}.png`);
        img.setAttribute('alt', `TH ${th}`);
        img.setAttribute('size', 'thumbnail');

        const span = document.createElement('span');
        span.className = 'th-badge-label';
        span.textContent = `TH ${th}`;

        item.appendChild(img);
        item.appendChild(span);

        item.addEventListener('click', () => {
            list.querySelectorAll('.th-badge-item').forEach(el => {
                el.classList.remove('active');
                el.setAttribute('aria-pressed', 'false');
            });
            item.classList.add('active');
            item.setAttribute('aria-pressed', 'true');
            welcomeState.selectedTH = th;
            updateGuestLeagueDropdown();

            const guestPlayerObj = state.allPlayersData['DEFAULT0'];
            if (guestPlayerObj) {
                if (!guestPlayerObj.playerProfile) guestPlayerObj.playerProfile = {};
                guestPlayerObj.playerProfile.townHallLevel = th;
                initializeGuestHeroesState(guestPlayerObj);
            }

            const thImgEl = document.getElementById('welcome-wizard-th-img');
            if (thImgEl) {
                thImgEl.setAttribute('src', `assets/th/th${th}.png`);
                thImgEl.setAttribute('alt', `TH ${th}`);
                if ('src' in thImgEl) {
                    thImgEl.src = `assets/th/th${th}.png`;
                }
            }

            const activeTag = welcomeState.activeWizardTag || 'DEFAULT0';
            const thLevel = (activeTag && activeTag !== 'DEFAULT0' && state.allPlayersData[activeTag]?.playerProfile?.townHallLevel)
                ? (Number(state.allPlayersData[activeTag].playerProfile.townHallLevel) || th)
                : th;
            renderWelcomeShopOffers(thLevel, welcomeState.tempShopOffersPurchases);
        });

        item.addEventListener('focus', () => {
            const pad = 28;
            if (item.offsetLeft < list.scrollLeft + pad) {
                list.scrollLeft = Math.max(0, item.offsetLeft - pad);
            } else if (item.offsetLeft + item.offsetWidth > list.scrollLeft + list.clientWidth - pad) {
                list.scrollLeft = item.offsetLeft + item.offsetWidth - list.clientWidth + pad;
            }
        });

        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                item.click();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                const next = item.nextElementSibling;
                if (next && next instanceof HTMLElement && next.classList.contains('th-badge-item')) {
                    next.focus();
                }
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                const prev = item.previousElementSibling;
                if (prev && prev instanceof HTMLElement && prev.classList.contains('th-badge-item')) {
                    prev.focus();
                }
            }
        });

        list.appendChild(item);
    }

    updateGuestLeagueDropdown();

    const leagueSelect = document.getElementById('welcome-guest-league-select');
    if (leagueSelect) {
        leagueSelect.onchange = (e) => {
            welcomeState.selectedLeague = parseInt(e.target.value, 10);
            updateGuestLeagueDropdown();
        };
    }
}

/**
 * Initializes Back and Next navigation click listeners for the setup wizard modal footer.
 */
export function initializeWizardNavigation() {
    const wizardBackBtn = document.getElementById('welcome-wizard-back-btn');
    const wizardNextBtn = document.getElementById('welcome-wizard-next-btn');

    if (wizardBackBtn) {
        wizardBackBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (welcomeState.currentWizardStepIndex === 0 && !welcomeState.wasAlreadyOnboarded) {
                const confirmed = await showConfirm(
                    translate('confirms.cancelSetup'),
                    'status.confirm',
                    'actions.confirm',
                    'actions.cancel'
                );
                if (!confirmed) return;
            }
            goToPrevWizardStep(getWizardCallbacks());
        });
    }

    if (wizardNextBtn) {
        wizardNextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            goToNextWizardStep(getWizardCallbacks());
        });
    }

    const recommendationsSwitch = document.getElementById('welcome-pref-recommendations');
    if (recommendationsSwitch) {
        recommendationsSwitch.addEventListener('change', () => {
            const wizardView = document.getElementById('welcome-profile-setup-wizard-view');
            if (wizardView) {
                wizardView.classList.toggle('show-recommendations', recommendationsSwitch.checked);
            }
        });
    }

    const wizardDotsContainer = document.getElementById('welcome-dots');
    if (wizardDotsContainer) {
        wizardDotsContainer.addEventListener('click', (e) => {
            const dot = /** @type {HTMLElement|null} */ (e.target)?.closest('.welcome-wizard-dot');
            if (!dot) return;
            const index = Number(dot.dataset.index) || 0;
            if (Math.abs(index - welcomeState.currentWizardStepIndex) > 1) return;
            welcomeState.currentWizardStepIndex = index;
            updateWizardStepView();
        });
    }
}
