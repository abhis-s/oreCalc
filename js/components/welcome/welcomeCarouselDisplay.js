import { translate } from '../../i18n/translator.js';

import { isProfileOnboarded, state } from '../../core/state.js';

import { welcomeState } from './welcomeModalState.js';
import { renderVerticalProfilesList } from './welcomeProfileCardRenderer.js';
import { renderWelcomeSyncQr } from './welcomeSyncDisplay.js';

const safeRaf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 0);

/**
 * Converts a 0-indexed carousel visual index to a 1-indexed page number.
 * @param {number} visualIndex - 0-indexed visual slide position.
 * @returns {number} 1-indexed page number.
 */
export function getPageFromVisualIndex(visualIndex) {
    return visualIndex + 1;
}

/**
 * Converts a 1-indexed page number to a 0-indexed carousel visual index.
 * @param {number} pageNumber - 1-indexed page number.
 * @returns {number} 0-indexed visual slide position.
 */
export function getVisualIndexFromPage(pageNumber) {
    return pageNumber - 1;
}

/**
 * Updates visibility of Continue and Guest buttons on Welcome Modal Page 2 based on saved profiles.
 */
export function updateWelcomePage2Buttons() {
    const continueBtn = document.getElementById('welcome-continue-btn');
    const guestBtn = document.getElementById('welcome-guest-btn');
    const hasRealProfiles = state.savedPlayerTags && state.savedPlayerTags.some(tag => tag !== 'DEFAULT0');
    if (continueBtn) continueBtn.style.display = hasRealProfiles ? 'block' : 'none';
    if (guestBtn) guestBtn.style.display = hasRealProfiles ? 'none' : 'block';
}

/**
 * Updates disabled state of the Welcome Modal Continue button during profile fetches.
 */
export function updateContinueButtonDisabledState() {
    const continueBtn = document.getElementById('welcome-continue-btn');
    if (!continueBtn) return;

    if (welcomeState.currentPage === 2) {
        const isAnyProfileUpdating = Object.values(welcomeState.updatingProfiles).some(Boolean);
        const isPending = isAnyProfileUpdating || welcomeState.isInputProfileLoading;
        continueBtn.disabled = isPending;
    } else {
        continueBtn.disabled = false;
    }
}

/**
 * Measures the un-minimized height of the welcome modal header and stores it in CSS custom property.
 */
export function measureHeaderHeight() {
    const modalContent = document.querySelector('.welcome-modal-content');
    const header = modalContent ? modalContent.querySelector('.welcome-header') : null;
    if (!header) return;

    header.classList.add('no-transition');

    const isMinimized = modalContent.classList.contains('has-minimized-header');
    if (isMinimized) {
        modalContent.classList.remove('has-minimized-header');
    }

    const height = header.getBoundingClientRect().height;

    if (isMinimized) {
        modalContent.classList.add('has-minimized-header');
    }

    header.offsetHeight;
    header.classList.remove('no-transition');

    modalContent.style.setProperty('--welcome-header-height', `${height}px`);
}

/**
 * Toggles the minimized presentation state of the welcome modal header with FLIP animation.
 * @param {boolean} shouldMinimize - True if header should be minimized.
 */
export function updateHeaderMinimizedState(shouldMinimize) {
    const modalContent = document.querySelector('.welcome-modal-content');
    if (!modalContent) return;

    const currentlyMinimized = modalContent.classList.contains('has-minimized-header');
    if (currentlyMinimized === shouldMinimize) return;

    const brand = modalContent.querySelector('.brand-name');

    if (brand) {
        const firstRect = brand.getBoundingClientRect();
        modalContent.classList.toggle('has-minimized-header', shouldMinimize);
        const lastRect = brand.getBoundingClientRect();

        const dx = firstRect.left - lastRect.left;
        const dy = firstRect.top - lastRect.top;
        const dw = firstRect.width / lastRect.width;
        const dh = firstRect.height / lastRect.height;

        brand.style.transition = 'none';
        brand.style.transform = `translate(${dx}px, ${dy}px) scale(${dw}, ${dh})`;
        brand.style.transformOrigin = 'top left';

        brand.offsetHeight;

        brand.style.transition = 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
        brand.style.transform = '';
    } else {
        modalContent.classList.toggle('has-minimized-header', shouldMinimize);
    }
}

/**
 * Synchronizes the `inert` accessibility attribute across inactive carousel slides and wizard steps.
 */
export function syncWelcomeInertState() {
    const modal = document.getElementById('welcome-modal');
    if (!modal) return;

    const wizardView = document.getElementById('welcome-profile-setup-wizard-view');
    const isWizardOpen = wizardView && window.getComputedStyle(wizardView).display !== 'none';

    const carousel = document.getElementById('welcome-carousel');
    const dots = document.getElementById('welcome-dots');
    const mainActions = document.getElementById('welcome-main-actions');

    if (isWizardOpen) {
        if (carousel) carousel.setAttribute('inert', '');
        if (dots) dots.removeAttribute('inert');
        if (mainActions) mainActions.removeAttribute('inert');
        if (wizardView) wizardView.removeAttribute('inert');

        const activeStep = welcomeState.wizardSteps && welcomeState.wizardSteps.length > 0
            ? welcomeState.wizardSteps[welcomeState.currentWizardStepIndex]
            : 1;
        const allSteps = wizardView.querySelectorAll('.wizard-step');
        allSteps.forEach(stepEl => {
            const stepNum = parseInt(stepEl.getAttribute('data-step') || '0', 10);
            if (stepNum === activeStep) {
                stepEl.removeAttribute('inert');
            } else {
                stepEl.setAttribute('inert', '');
            }
        });
    } else {
        if (carousel) carousel.removeAttribute('inert');
        if (dots) dots.removeAttribute('inert');
        if (mainActions) mainActions.removeAttribute('inert');
        if (wizardView) wizardView.setAttribute('inert', '');

        const currentPage = welcomeState.currentPage || 1;
        const isFromInApp = welcomeState.entrySource === 'playerModal' || welcomeState.entrySource === 'inApp';
        for (let p = 1; p <= 4; p++) {
            const pageEl = document.getElementById(`welcome-page-${p}`);
            if (pageEl) {
                if (p === 1 && isFromInApp) {
                    pageEl.setAttribute('inert', '');
                } else if (p === currentPage) {
                    pageEl.removeAttribute('inert');
                } else {
                    pageEl.setAttribute('inert', '');
                }
            }
        }
    }
}

/**
 * Updates active pagination state, slide visibility, button controls, and focus trapping for the specified page.
 * @param {number} pageNumber - Target page number (1-4).
 * @param {boolean} [force=false] - Force update even if pageNumber matches currentPage.
 */
export function updatePagination(pageNumber, force = false) {
    if (welcomeState.currentPage === pageNumber && !force) return;

    const previousPage = welcomeState.currentPage;
    welcomeState.currentPage = pageNumber;

    if (previousPage === 4 && pageNumber !== 4) {
        welcomeState.cameFromSyncStartBtn = false;
    }

    if (pageNumber !== 4) {
        const cloudSyncContainer = document.getElementById('welcome-cloud-sync-container');
        const yourSyncCodeDetails = document.getElementById('welcome-your-sync-code-details');
        if (cloudSyncContainer) {
            cloudSyncContainer.classList.remove('welcome-sync-temp-blurred');
        }
        if (yourSyncCodeDetails) {
            yourSyncCodeDetails.classList.remove('welcome-sync-temp-blurred');
        }
        const submitBtn = document.getElementById('welcome-submit-btn');
        if (submitBtn) {
            submitBtn.textContent = translate('views.welcome.getStarted');
        }
    }

    updateHeaderMinimizedState(pageNumber > 1);

    const continueBtn = document.getElementById('welcome-continue-btn');
    const backBtn = document.getElementById('welcome-back-btn');
    const guestBtn = document.getElementById('welcome-guest-btn');
    const submitBtn = document.getElementById('welcome-submit-btn');
    const syncDeviceStartBtn = document.getElementById('welcome-sync-device-start-btn');
    const wizardNextBtn = document.getElementById('welcome-wizard-next-btn');
    const wizardBackBtn = document.getElementById('welcome-wizard-back-btn');
    const actionsContainer = document.getElementById('welcome-main-actions');

    if (wizardNextBtn) wizardNextBtn.style.display = 'none';
    if (wizardBackBtn) wizardBackBtn.style.display = 'none';

    if (actionsContainer) {
        actionsContainer.className = 'modal-actions welcome-actions';
        actionsContainer.classList.add(`page-${pageNumber}`);
        actionsContainer.style.flexDirection = '';
        actionsContainer.style.alignItems = '';
    }

    if (pageNumber === 1) {
        if (continueBtn) continueBtn.style.display = 'inline-flex';
        if (backBtn) backBtn.style.display = 'none';
        if (guestBtn) guestBtn.style.display = 'none';
        if (submitBtn) submitBtn.style.display = 'none';
        if (syncDeviceStartBtn) syncDeviceStartBtn.style.display = 'inline-flex';
    } else if (pageNumber === 2) {
        updateWelcomePage2Buttons();
        if (backBtn) {
            backBtn.style.display = 'inline-flex';
            if (welcomeState.entrySource === 'playerModal' || welcomeState.entrySource === 'inApp') {
                backBtn.textContent = translate('views.welcome.cancelSetup');
                backBtn.setAttribute('data-i18n', 'views.welcome.cancelSetup');
            } else {
                backBtn.textContent = translate('views.welcome.back');
                backBtn.setAttribute('data-i18n', 'views.welcome.back');
            }
        }
        if (submitBtn) submitBtn.style.display = 'none';
        if (syncDeviceStartBtn) syncDeviceStartBtn.style.display = 'none';
    } else if (pageNumber === 3) {
        if (continueBtn) continueBtn.style.display = 'inline-flex';
        if (backBtn) {
            backBtn.style.display = 'inline-flex';
            backBtn.textContent = translate('views.welcome.back');
            backBtn.setAttribute('data-i18n', 'views.welcome.back');
        }
        if (guestBtn) guestBtn.style.display = 'none';
        if (submitBtn) submitBtn.style.display = 'none';
        if (syncDeviceStartBtn) syncDeviceStartBtn.style.display = 'none';
        renderVerticalProfilesList();
    } else if (pageNumber === 4) {
        if (continueBtn) continueBtn.style.display = 'none';
        if (backBtn) {
            backBtn.style.display = 'inline-flex';
            backBtn.textContent = translate('views.welcome.back');
            backBtn.setAttribute('data-i18n', 'views.welcome.back');
        }
        if (guestBtn) guestBtn.style.display = 'none';
        if (submitBtn) submitBtn.style.display = 'inline-flex';
        if (syncDeviceStartBtn) syncDeviceStartBtn.style.display = 'none';
        renderWelcomeSyncQr();
    }

    updateWelcomeContinueButtonText(pageNumber);
    updateHeaderSkipButtonVisibility();

    const dotsContainer = document.getElementById('welcome-dots');
    if (dotsContainer) {
        if (!dotsContainer.querySelector('.welcome-dot')) {
            dotsContainer.innerHTML = `
                <span class="welcome-dot" data-page="1"></span>
                <span class="welcome-dot" data-page="2"></span>
                <span class="welcome-dot" data-page="3"></span>
                <span class="welcome-dot" data-page="4"></span>
            `;
        }
        const isFromInApp = welcomeState.entrySource === 'playerModal' || welcomeState.entrySource === 'inApp';
        const dot1 = dotsContainer.querySelector('.welcome-dot[data-page="1"]');
        if (dot1 && dot1.style) {
            dot1.style.display = isFromInApp ? 'none' : '';
        }
        const dots = dotsContainer.querySelectorAll('.welcome-dot');
        dots.forEach((dot) => {
            const dotPage = parseInt(dot.getAttribute('data-page') || '0', 10);
            dot.classList.toggle('active', dotPage === pageNumber);
        });
    }

    updateContinueButtonDisabledState();
    syncWelcomeInertState();

    safeRaf(() => {
        const modal = document.getElementById('welcome-modal');
        if (!modal) return;
        let targetEl = null;
        if (pageNumber === 1) {
            targetEl = document.getElementById('welcome-language-select');
        } else if (pageNumber === 2) {
            targetEl = document.getElementById('welcome-player-tag-input');
        } else if (pageNumber === 3) {
            const allComplete = state.savedPlayerTags && state.savedPlayerTags.length > 0 && state.savedPlayerTags.every(tag => isProfileOnboarded(state.allPlayersData[tag]));
            targetEl = allComplete ? document.getElementById('welcome-continue-btn') : (modal.querySelector('#welcome-vertical-profiles-list .welcome-profile-card-vertical') || document.getElementById('welcome-continue-btn'));
        } else if (pageNumber === 4) {
            targetEl = document.getElementById('welcome-pref-cloud-sync');
        }
        if (targetEl && typeof targetEl.focus === 'function' && !targetEl.closest('[inert]')) {
            targetEl.focus({ preventScroll: true });
        }
    });
}

/**
 * Updates the localized label on the Welcome Modal Continue button according to active page and setup progress.
 * @param {number} pageNumber - Active page number.
 */
export function updateWelcomeContinueButtonText(pageNumber) {
    const continueBtn = document.getElementById('welcome-continue-btn');
    if (!continueBtn) return;

    if (pageNumber === 3) {
        const allComplete = state.savedPlayerTags.every(tag => {
            return isProfileOnboarded(state.allPlayersData[tag]);
        });

        if (allComplete && state.savedPlayerTags.length > 0) {
            continueBtn.textContent = translate('views.welcome.continue');
            continueBtn.setAttribute('data-i18n', 'views.welcome.continue');
        } else {
            continueBtn.textContent = translate('views.welcome.setupProfiles');
            continueBtn.setAttribute('data-i18n', 'views.welcome.setupProfiles');
        }
    } else {
        continueBtn.textContent = translate('views.welcome.continue');
        continueBtn.setAttribute('data-i18n', 'views.welcome.continue');
    }
}

/**
 * Updates the visibility of the Header Skip button on Welcome Modal Page 3.
 */
export function updateHeaderSkipButtonVisibility() {
    const headerSkipBtn = document.getElementById('welcome-header-skip-btn');
    if (!headerSkipBtn) return;

    if (welcomeState.currentPage === 3) {
        if (welcomeState.activeWizardTag) {
            headerSkipBtn.style.display = 'block';
        } else {
            const hasPendingSetup = state.savedPlayerTags.filter(tag => tag !== 'DEFAULT0').some(tag => {
                return !isProfileOnboarded(state.allPlayersData[tag]);
            });
            headerSkipBtn.style.display = hasPendingSetup ? 'block' : 'none';
        }
    } else {
        headerSkipBtn.style.display = 'none';
    }
}

/**
 * Updates the localized label on the Welcome Modal Submit / Get Started button.
 */
export function updateSubmitButtonText() {
    const submitBtn = document.getElementById('welcome-submit-btn');
    if (!submitBtn) return;
    submitBtn.textContent = translate('views.welcome.getStarted');
}

/**
 * Updates the localized label on the Load Profile button in Page 2.
 */
export function updateLoadProfileButtonText() {
    const loadProfileBtn = document.getElementById('welcome-load-btn');
    if (!loadProfileBtn) return;

    const hasNonDefaultTag = state.savedPlayerTags.some(tag => tag !== 'DEFAULT0');
    if (hasNonDefaultTag) {
        loadProfileBtn.textContent = translate('views.welcome.loadAnotherProfile');
        loadProfileBtn.setAttribute('data-i18n', 'views.welcome.loadAnotherProfile');
    } else {
        loadProfileBtn.textContent = translate('views.welcome.loadProfile');
        loadProfileBtn.setAttribute('data-i18n', 'views.welcome.loadProfile');
    }
}
