import { translate } from '../../i18n/translator.js';

import { EFFECTIVE_DATE_PROFILE_ONBOARDING, isProfileOnboarded, state } from '../../core/state.js';

import { closeModalAnimated } from '../../utils/modalHistoryManager.js';

import {
    getPageFromVisualIndex,
    getVisualIndexFromPage,
    measureHeaderHeight,
    updateHeaderSkipButtonVisibility,
    updatePagination,
    updateWelcomeContinueButtonText
} from './welcomeCarouselDisplay.js';
import { welcomeState } from './welcomeModalState.js';
import { renderVerticalProfilesList } from './welcomeProfileCardRenderer.js';
import { updatePreviewArrowPosition } from './welcomeProfileDisplay.js';
import { updateWelcomeSyncState } from './welcomeSyncDisplay.js';
import { getWizardCallbacks } from './welcomeWizardInputs.js';
import { finishWizard, openSetupWizard } from './welcomeWizardState.js';
import { showConfirm } from '../../ui/noticeModal.js';

const safeRaf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 0);

/**
 * Initializes Carousel gesture navigation, scroll snapping, and main pagination button handlers.
 *
 * @param {HTMLElement} modal - The Welcome modal root element.
 * @param {HTMLElement|null} carousel - The Welcome modal carousel element.
 * @param {(() => void)|null} [onClose=null] - Callback to close welcome modal.
 */
export function initializeWelcomeCarouselInputs(modal, carousel, onClose = null) {
    if (!modal) return;

    const continueBtn = document.getElementById('welcome-continue-btn');
    const backBtn = document.getElementById('welcome-back-btn');
    const headerSkipBtn = document.getElementById('welcome-header-skip-btn');

    // Touch / Swipe Gestures on Carousel
    let touchStartX = 0;
    let touchStartY = 0;
    let isSwiping = false;

    if (carousel) {
        carousel.addEventListener('touchstart', (e) => {
            welcomeState.scrollTargetPage = null;
            if (e.target.closest('#welcome-profile-setup-wizard-view')) return;
            if (e.target.closest('#welcome-guest-th-list')) return;

            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isSwiping = true;
        }, { passive: true });

        carousel.addEventListener('touchmove', (e) => {
            if (!isSwiping) return;
            if (e.target.closest('#welcome-profile-setup-wizard-view')) return;
            if (e.target.closest('#welcome-guest-th-list')) return;

            const touchCurrentX = e.touches[0].clientX;
            const touchCurrentY = e.touches[0].clientY;
            const diffX = touchStartX - touchCurrentX;
            const diffY = touchStartY - touchCurrentY;

            if (welcomeState.currentPage === 2 && diffX > 0) {
                const isAnyProfileUpdating = Object.values(welcomeState.updatingProfiles).some(Boolean);
                if (isAnyProfileUpdating || welcomeState.isInputProfileLoading) {
                    return;
                }
            }

            if (Math.abs(diffX) > Math.abs(diffY)) {
                if (e.cancelable) e.preventDefault();
            }
        }, { passive: false });

        carousel.addEventListener('touchend', (e) => {
            if (!isSwiping) return;
            isSwiping = false;
            if (e.target.closest('#welcome-profile-setup-wizard-view')) return;
            if (e.target.closest('#welcome-guest-th-list')) return;

            const touchEndX = e.changedTouches[0].clientX;
            const diffX = touchStartX - touchEndX;

            if (welcomeState.currentPage === 2 && diffX > 30) {
                const isAnyProfileUpdating = Object.values(welcomeState.updatingProfiles).some(Boolean);
                if (isAnyProfileUpdating || welcomeState.isInputProfileLoading) {
                    return;
                }
            }

            const width = carousel.clientWidth;
            if (width <= 0) return;

            const minPage = (welcomeState.entrySource === 'playerModal' || welcomeState.entrySource === 'inApp') ? 2 : 1;
            if (Math.abs(diffX) > 50) {
                if (diffX > 0 && welcomeState.currentPage < 4) {
                    const targetPage = welcomeState.currentPage + 1;
                    welcomeState.scrollTargetPage = targetPage;
                    const visualIndex = getVisualIndexFromPage(targetPage);
                    updatePagination(targetPage);
                    carousel.scrollTo({ left: visualIndex * width, behavior: 'smooth' });
                } else if (diffX < 0 && welcomeState.currentPage > minPage) {
                    let targetPage = welcomeState.currentPage - 1;
                    if (welcomeState.currentPage === 4 && welcomeState.cameFromSyncStartBtn) {
                        targetPage = minPage;
                        welcomeState.cameFromSyncStartBtn = false;
                    }
                    welcomeState.scrollTargetPage = targetPage;
                    const visualIndex = getVisualIndexFromPage(targetPage);
                    updatePagination(targetPage);
                    carousel.scrollTo({ left: visualIndex * width, behavior: 'smooth' });
                }
            }
        }, { passive: true });

        // Mouse Drag Navigation
        let isMouseDown = false;
        let mouseStartX = 0;

        carousel.addEventListener('mousedown', (e) => {
            welcomeState.scrollTargetPage = null;
            if (e.target.closest('button, input, select, a, .accent-swatch, .welcome-profile-card-compact, .info-btn, .th-badge-item, .welcome-shop-offer-item, #welcome-profile-setup-wizard-view')) return;
            isMouseDown = true;
            mouseStartX = e.clientX;
            carousel.style.cursor = 'grabbing';
            carousel.style.userSelect = 'none';
        });

        window.addEventListener('mouseup', (e) => {
            if (!isMouseDown) return;
            isMouseDown = false;
            carousel.style.cursor = '';
            carousel.style.userSelect = '';

            const mouseEndX = e.clientX;
            const diffX = mouseStartX - mouseEndX;
            const width = carousel.clientWidth;
            if (width <= 0) return;

            const minPage = (welcomeState.entrySource === 'playerModal' || welcomeState.entrySource === 'inApp') ? 2 : 1;
            if (Math.abs(diffX) > 50) {
                if (diffX > 0 && welcomeState.currentPage < 4) {
                    const targetPage = welcomeState.currentPage + 1;
                    welcomeState.scrollTargetPage = targetPage;
                    const visualIndex = getVisualIndexFromPage(targetPage);
                    updatePagination(targetPage);
                    carousel.scrollTo({ left: visualIndex * width, behavior: 'smooth' });
                } else if (diffX < 0 && welcomeState.currentPage > minPage) {
                    let targetPage = welcomeState.currentPage - 1;
                    if (welcomeState.currentPage === 4 && welcomeState.cameFromSyncStartBtn) {
                        targetPage = minPage;
                        welcomeState.cameFromSyncStartBtn = false;
                    }
                    welcomeState.scrollTargetPage = targetPage;
                    const visualIndex = getVisualIndexFromPage(targetPage);
                    updatePagination(targetPage);
                    carousel.scrollTo({ left: visualIndex * width, behavior: 'smooth' });
                }
            }
        });

        // Keyboard Arrow Navigation
        window.addEventListener('keydown', (e) => {
            if (!modal.classList.contains('show')) return;
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
            if (e.target.closest('#welcome-profile-setup-wizard-view')) return;

            const width = carousel.clientWidth;
            if (width <= 0) return;

            const minPage = (welcomeState.entrySource === 'playerModal' || welcomeState.entrySource === 'inApp') ? 2 : 1;
            if (e.key === 'ArrowRight' && welcomeState.currentPage < 4) {
                if (welcomeState.currentPage === 2) {
                    const isAnyProfileUpdating = Object.values(welcomeState.updatingProfiles).some(Boolean);
                    if (isAnyProfileUpdating || welcomeState.isInputProfileLoading) return;
                }
                const targetPage = welcomeState.currentPage + 1;
                welcomeState.scrollTargetPage = targetPage;
                const visualIndex = getVisualIndexFromPage(targetPage);
                updatePagination(targetPage);
                carousel.scrollTo({ left: visualIndex * width, behavior: 'smooth' });
            } else if (e.key === 'ArrowLeft' && welcomeState.currentPage > minPage) {
                let targetPage = welcomeState.currentPage - 1;
                if (welcomeState.currentPage === 4 && welcomeState.cameFromSyncStartBtn) {
                    targetPage = minPage;
                    welcomeState.cameFromSyncStartBtn = false;
                }
                welcomeState.scrollTargetPage = targetPage;
                const visualIndex = getVisualIndexFromPage(targetPage);
                updatePagination(targetPage);
                carousel.scrollTo({ left: visualIndex * width, behavior: 'smooth' });
            }
        });

        // Scroll snapping detection
        carousel.addEventListener('scroll', () => {
            const width = carousel.clientWidth;
            if (width <= 0) return;

            const minPage = (welcomeState.entrySource === 'playerModal' || welcomeState.entrySource === 'inApp') ? 2 : 1;
            const scrollLeft = carousel.scrollLeft;
            const visualIndex = Math.round(scrollLeft / width);
            const page = getPageFromVisualIndex(visualIndex);

            if (page < minPage) {
                carousel.scrollTo({ left: getVisualIndexFromPage(minPage) * width, behavior: 'auto' });
                return;
            }

            if (welcomeState.currentPage === 2 && page > 2) {
                if (welcomeState.scrollTargetPage === null) {
                    const isAnyProfileUpdating = Object.values(welcomeState.updatingProfiles).some(Boolean);
                    if (isAnyProfileUpdating || welcomeState.isInputProfileLoading) {
                        carousel.scrollTo({ left: getVisualIndexFromPage(2) * width, behavior: 'auto' });
                        return;
                    }
                }
            }

            if (welcomeState.scrollTargetPage !== null) {
                const targetLeft = getVisualIndexFromPage(welcomeState.scrollTargetPage) * width;
                if (Math.abs(scrollLeft - targetLeft) <= 4) {
                    welcomeState.scrollTargetPage = null;
                } else {
                    return;
                }
            }

            if (page !== welcomeState.currentPage) {
                updatePagination(page);
                updatePreviewArrowPosition();
            }
        }, { passive: true });
    }

    const handleWelcomeResize = () => {
        if (!modal.classList.contains('show')) return;
        measureHeaderHeight();
        if (carousel) {
            const width = carousel.clientWidth;
            if (width <= 0) return;
            const activePage = welcomeState.scrollTargetPage !== null ? welcomeState.scrollTargetPage : welcomeState.currentPage;
            const visualIndex = getVisualIndexFromPage(activePage);
            carousel.style.scrollSnapType = 'none';
            carousel.style.scrollBehavior = 'auto';
            carousel.scrollLeft = visualIndex * width;
            safeRaf(() => {
                if (carousel) {
                    carousel.style.scrollSnapType = '';
                    carousel.style.scrollBehavior = '';
                }
            });
        }
    };
    window.addEventListener('resize', handleWelcomeResize, { passive: true });

    // Automatic scroll-into-view on focus
    modal.addEventListener('focusin', (e) => {
        const target = e.target;
        if (!target || !(target instanceof HTMLElement)) return;

        if (target.id === 'welcome-modal' || target.classList.contains('welcome-modal-content') || target.classList.contains('welcome-page')) {
            return;
        }

        const vScrollContainer = target.closest('.welcome-page, .welcome-wizard-steps-container');
        if (vScrollContainer && vScrollContainer instanceof HTMLElement) {
            const containerRect = vScrollContainer.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();

            if (targetRect.bottom > containerRect.bottom - 24) {
                const diff = targetRect.bottom - containerRect.bottom + 36;
                vScrollContainer.scrollBy({ top: diff, behavior: 'smooth' });
            } else if (targetRect.top < containerRect.top + 24) {
                const diff = containerRect.top - targetRect.top + 36;
                vScrollContainer.scrollBy({ top: -diff, behavior: 'smooth' });
            }
        }

        const hScrollContainer = target.closest('#welcome-guest-th-list, #welcome-profiles-list, #welcome-qs-profiles-list, .welcome-hero-scroll-container');
        if (hScrollContainer && hScrollContainer instanceof HTMLElement) {
            let directChild = target;
            while (directChild && directChild.parentElement !== hScrollContainer) {
                directChild = directChild.parentElement;
            }
            if (directChild && directChild instanceof HTMLElement) {
                const pad = 28;
                if (directChild.offsetLeft < hScrollContainer.scrollLeft + pad) {
                    hScrollContainer.scrollLeft = Math.max(0, directChild.offsetLeft - pad);
                } else if (directChild.offsetLeft + directChild.offsetWidth > hScrollContainer.scrollLeft + hScrollContainer.clientWidth - pad) {
                    hScrollContainer.scrollLeft = directChild.offsetLeft + directChild.offsetWidth - hScrollContainer.clientWidth + pad;
                }
            }
        }
    });

    // Universal Accessible Focus Trap for Welcome Modal
    modal.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;

        const wizardView = document.getElementById('welcome-profile-setup-wizard-view');
        const isWizardOpen = wizardView && window.getComputedStyle(wizardView).display !== 'none';

        const scope = isWizardOpen ? wizardView : modal;
        const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled]), summary';

        const tabbables = Array.from(scope.querySelectorAll(selector)).filter(el => {
            if (el.closest('[inert]')) return false;
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && (el.offsetWidth > 0 || el.offsetHeight > 0);
        });

        const headerSkipBtn = document.getElementById('welcome-header-skip-btn');
        if (headerSkipBtn && window.getComputedStyle(headerSkipBtn).display !== 'none' && !headerSkipBtn.closest('[inert]')) {
            if (!tabbables.includes(headerSkipBtn)) {
                tabbables.unshift(headerSkipBtn);
            }
        }

        if (tabbables.length === 0) {
            e.preventDefault();
            return;
        }

        const firstTabbable = tabbables[0];
        const lastTabbable = tabbables[tabbables.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === firstTabbable || !modal.contains(document.activeElement)) {
                e.preventDefault();
                lastTabbable.focus();
            }
        } else {
            if (document.activeElement === lastTabbable || !modal.contains(document.activeElement)) {
                e.preventDefault();
                firstTabbable.focus();
            }
        }
    });

    if (continueBtn && carousel) {
        continueBtn.addEventListener('click', async () => {
            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                document.activeElement.blur();
            }
            const width = carousel.clientWidth;
            if (width <= 0) return;

            if (welcomeState.currentPage === 3) {
                const pendingTags = state.savedPlayerTags.filter(tag => {
                    return !isProfileOnboarded(state.allPlayersData[tag]);
                });

                if (pendingTags.length > 0) {
                    openSetupWizard(pendingTags[0], getWizardCallbacks());
                    return;
                }

                updateWelcomeSyncState();
            }

            if (welcomeState.currentPage < 4) {
                const targetPage = welcomeState.currentPage + 1;
                welcomeState.scrollTargetPage = targetPage;
                const visualIndex = getVisualIndexFromPage(targetPage);
                updatePagination(targetPage);
                carousel.scrollTo({ left: visualIndex * width, behavior: 'smooth' });
            }
        });
    }

    if (backBtn && carousel) {
        backBtn.addEventListener('click', () => {
            if (welcomeState.currentPage === 2 && (welcomeState.entrySource === 'playerModal' || welcomeState.entrySource === 'inApp')) {
                if (onClose) {
                    onClose();
                } else {
                    closeModalAnimated(modal);
                }
                return;
            }

            const minPage = (welcomeState.entrySource === 'playerModal' || welcomeState.entrySource === 'inApp') ? 2 : 1;
            const width = carousel.clientWidth;
            if (width <= 0) return;

            if (welcomeState.currentPage > minPage) {
                let targetPage = welcomeState.currentPage - 1;
                if (welcomeState.currentPage === 4 && welcomeState.cameFromSyncStartBtn) {
                    targetPage = minPage;
                    welcomeState.cameFromSyncStartBtn = false;
                }
                welcomeState.scrollTargetPage = targetPage;
                const visualIndex = getVisualIndexFromPage(targetPage);
                updatePagination(targetPage);
                carousel.scrollTo({ left: visualIndex * width, behavior: 'smooth' });
            }
        });
    }

    if (headerSkipBtn && carousel) {
        headerSkipBtn.addEventListener('click', async () => {
            if (welcomeState.activeWizardTag) {
                finishWizard(true, getWizardCallbacks());
                return;
            }

            const pendingTags = state.savedPlayerTags.filter(tag => tag !== 'DEFAULT0').filter(tag => {
                return !isProfileOnboarded(state.allPlayersData[tag]);
            });

            if (pendingTags.length > 0) {
                const confirmed = await showConfirm(
                    translate('confirms.skipSetup'),
                    'status.confirm',
                    'actions.skipAnyway',
                    'actions.cancel'
                );
                if (!confirmed) return;

                pendingTags.forEach(tag => {
                    const playerObj = state.allPlayersData[tag];
                    if (playerObj) {
                        playerObj.onboardingTimestamp = Math.max(Date.now(), EFFECTIVE_DATE_PROFILE_ONBOARDING + 1);
                    }
                });
                renderVerticalProfilesList();
                updateWelcomeContinueButtonText(3);
                updateHeaderSkipButtonVisibility();
            }

            updateWelcomeSyncState();

            welcomeState.scrollTargetPage = 4;
            const visualIndex = getVisualIndexFromPage(4);
            updatePagination(4);
            carousel.scrollTo({ left: visualIndex * carousel.clientWidth, behavior: 'smooth' });
        });
    }

    const dotsContainer = document.getElementById('welcome-dots');
    if (dotsContainer) {
        dotsContainer.addEventListener('click', (e) => {
            const target = /** @type {HTMLElement|null} */ (e.target);
            const dot = target ? target.closest('.welcome-dot') : null;
            if (!dot) return;

            const pageAttr = dot.getAttribute('data-page');
            if (!pageAttr) return;
            const page = Number(pageAttr) || 0;
            const minPage = (welcomeState.entrySource === 'playerModal' || welcomeState.entrySource === 'inApp') ? 2 : 1;
            if (page < minPage) return;
            if (welcomeState.currentPage === 2 && page > 2) {
                const isAnyProfileUpdating = Object.values(welcomeState.updatingProfiles).some(Boolean);
                if (isAnyProfileUpdating || welcomeState.isInputProfileLoading) {
                    return;
                }
            }

            welcomeState.scrollTargetPage = page;
            const visualIndex = getVisualIndexFromPage(page);
            updatePagination(page);
            if (carousel) {
                carousel.scrollTo({ left: visualIndex * carousel.clientWidth, behavior: 'smooth' });
            }
        });
    }
}
