import { dom } from '../../dom/domElements.js';
import { state, EFFECTIVE_DATE_TERMS, EFFECTIVE_DATE_PRIVACY, EFFECTIVE_DATE_WELCOME, getDefaultPlayerState } from '../../core/state.js';
import { handleStateUpdate, switchActivePlayer } from '../../core/stateManager.js';
import { loadAndProcessPlayerData, processPlayerDataResponse } from '../../services/serverResponseHandler.js';
import { fetchPlayerData } from '../../services/apiService.js';
import { translate, loadTranslations } from '../../i18n/translator.js';
import { renderApp } from '../../core/renderer.js';
import { validatePlayerTagInput } from '../../utils/playerTagValidator.js';
import { openTermsOfUseModal, openPrivacyModal } from '../appSettings/appSettings.js';
import { heroData, upgradeCosts } from '../../data/heroData.js';
import { leagueTiers, townHallLeagueFloors, shopOfferData, currencyData } from '../../data/appData.js';
import { loadPlayerData, updateSavedPlayerTags, removePlayerTag } from '../../core/localStorageManager.js';
import { showConfirm, showAlert } from '../../ui/noticeModal.js';
import { showToast } from '../../ui/toast.js';
import { warOreTownHallValues } from '../../data/incomeSources/warOres.js';
import { adjustWarRates, getPriceForTier, getCurrencySymbol } from '../../utils/incomeUtils.js';
import { registerInputPopover } from '../../utils/inputPopoverProvider.js';
import { addValidation } from '../../utils/inputValidator.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { getSVG } from '../../utils/svgManager.js';
import { closeStoredOresModal } from '../planner/priorityListModal.js';
import { isValidUUID } from '../../utils/uuidGenerator.js';

let currentPage = 1;
let cameFromSyncStartBtn = false;
let scrollTargetPage = null;
let isProfileLoaded = false;
let isInputProfileLoading = false;
let isWelcomeSyncListenersInitialized = false;
let welcomeProfilesOrder = [];
let selectedTH = 16;
let selectedLeague = 105000000;
let updatingProfiles = {};
let errorProfiles = {};
let successProfiles = {};
let activeWizardTag = null;
let wasAlreadyOnboarded = false;
let currentWizardStepIndex = 0;
let wizardSteps = [];
let tempStoredShiny = 0;
let tempStoredGlowy = 0;
let tempStoredStarry = 0;
let tempRaidMedalsBuy = false;
let tempRaidMedalsEarned = 1200;
let tempRaidMedalsStarry = 0;
let tempRaidMedalsGlowy = 0;
let tempRaidMedalsShiny = 0;
let tempGemsBuy = false;
let tempGemsStarry = 0;
let tempGemsGlowy = 0;
let tempGemsShiny = 0;
let tempShopOffersBuy = false;
let tempShopOffersPurchases = {};
let tempClanWars = false;
let tempClanWarsCount = 8;
let tempClanWarsWinrate = 70;
let tempClanWarsDrawrate = 0;
let tempCwl = false;
let tempCwlHits = 7;
let tempCwlWinrate = 50;
let tempCwlDrawrate = 0;
let tempGoldPass = false;
let tempCloudSync = true;
let tempEventPassBuy = false;
let tempEventIncludeEquipment = false;
let tempEventBonusMedals = 0;
let tempEventPurchasedMedals = 0;
let tempEventTraderBuy = false;
let tempEventTraderShiny = 0;
let tempEventTraderGlowy = 0;
let tempEventTraderStarry = 0;
let tempCurrencyCode = 'USD';



function getPageFromVisualIndex(visualIndex) {
    return visualIndex + 1;
}

function getVisualIndexFromPage(pageNumber) {
    return pageNumber - 1;
}

export function showWelcomeModal(isVisible, startTag = null) {
    const modal = document.getElementById('welcome-modal');
    if (!modal) return;

    if (isVisible) {
        modal.classList.add('show');
        if (dom.overlay) dom.overlay.classList.add('show');
        
        const carousel = document.getElementById('welcome-carousel');
        if (carousel) {
            carousel.scrollLeft = 0;
        }
        currentPage = 1;
        cameFromSyncStartBtn = false;
        scrollTargetPage = null;
        updateHeaderMinimizedState(false);

        measureHeaderHeight();

        const recommendationsSwitch = document.getElementById('welcome-pref-recommendations');
        if (recommendationsSwitch) {
            recommendationsSwitch.checked = true;
        }
        const wizardView = document.getElementById('welcome-profile-setup-wizard-view');
        if (wizardView) {
            wizardView.classList.add('show-recommendations');
        }

        // Reset visual state of pagination controls
        const continueBtn = document.getElementById('welcome-continue-btn');
        const backBtn = document.getElementById('welcome-back-btn');
        const guestBtn = document.getElementById('welcome-guest-btn');
        const submitBtn = document.getElementById('welcome-submit-btn');
        const syncDeviceStartBtn = document.getElementById('welcome-sync-device-start-btn');
        const dots = document.querySelectorAll('.welcome-dot');

        if (continueBtn) {
            continueBtn.style.display = 'block';
            updateWelcomeContinueButtonText(1);
        }
        if (backBtn) backBtn.style.display = 'none';
        if (guestBtn) guestBtn.style.display = 'none';
        if (submitBtn) submitBtn.style.display = 'none';
        if (syncDeviceStartBtn) syncDeviceStartBtn.style.display = 'block';
        
        const headerSkipBtn = document.getElementById('welcome-header-skip-btn');
        if (headerSkipBtn) headerSkipBtn.style.display = 'none';

        const actionsContainer = document.getElementById('welcome-main-actions');
        if (actionsContainer) {
            actionsContainer.classList.add('page-1');
            actionsContainer.style.flexDirection = '';
            actionsContainer.style.alignItems = '';
        }

        dots.forEach((dot, index) => {
            if (index === 0) dot.classList.add('active');
            else dot.classList.remove('active');
        });

        // Synchronize active states for preference buttons
        const currentLang = state.uiSettings.language || 'en';
        const currentTheme = state.uiSettings.theme || 'dark';

        const langSwitch = modal.querySelector('.language-switch');
        if (langSwitch) {
            const langIndex = currentLang === 'de' ? '1' : (currentLang === 'tr' ? '2' : '0');
            langSwitch.setAttribute('data-active-index', langIndex);
        }

        const themeSwitch = modal.querySelector('.theme-switch');
        if (themeSwitch) {
            themeSwitch.setAttribute('data-active-index', currentTheme === 'dark' ? '0' : '1');
        }

        modal.querySelectorAll('.language-switch .pref-btn').forEach(btn => {
            if (btn.getAttribute('data-lang') === currentLang) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        modal.querySelectorAll('.theme-switch .pref-btn').forEach(btn => {
            if (btn.getAttribute('data-theme') === currentTheme) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Synchronize active states for accent color swatches
        const currentAccent = state.uiSettings.accentColor || 'random';
        modal.querySelectorAll('#welcome-accent-picker .accent-swatch').forEach(swatch => {
            swatch.classList.toggle('active', swatch.dataset.color === currentAccent);
        });

        // Render and update saved profiles
        const savedPlayers = state.savedPlayerTags.filter(tag => tag !== 'DEFAULT0');
        if (savedPlayers.length > 0) {
            welcomeProfilesOrder = [...state.savedPlayerTags];
            // Capture the first visual-list tag before any reordering happens
            const firstDisplayTag = welcomeProfilesOrder.find(tag => tag !== 'DEFAULT0') || savedPlayers[0];
            renderWelcomeProfilesList();

            // Initial selection before sequential updates start
            setTimeout(() => {
                const el = document.querySelector(`.welcome-profile-card-compact[data-tag="${firstDisplayTag}"]`);
                if (el) el.click();
            }, 50);
            syncWelcomeQuickSettings(firstDisplayTag);

            // Sequential refresh — updateOrder: false means the list order stays stable,
            // so no need to re-assert the initial selection after completion.
            updateSavedProfilesSequentially();
        } else {
            const listContainer = document.getElementById('welcome-profiles-list-container');
            if (listContainer) listContainer.style.display = 'none';
            const previewContainer = document.getElementById('welcome-profile-preview-container');
            if (previewContainer) previewContainer.style.display = 'none';
            isProfileLoaded = false;
            syncWelcomeQuickSettings(null);
            updateLoadProfileButtonText();
        }
    } else {
        modal.classList.remove('show');
        const visibleModals = document.querySelectorAll('.modal.show');
        if (visibleModals.length === 0 && dom.overlay) {
            dom.overlay.classList.remove('show');
        }
        document.dispatchEvent(new CustomEvent('welcome:close'));

        // Auto-place income chips for all profiles once onboarding welcome modal ends
        import('../../utils/autoPlaceChips.js').then(({ autoPlaceIncomeChipsForRange }) => {
            import('../../utils/dateUtils.js').then(({ getMinDate, getMaxDate }) => {
                const { month: MIN_MONTH, year: MIN_YEAR } = getMinDate();
                const { month: MAX_MONTH, year: MAX_YEAR } = getMaxDate();

                const originalPlanner = state.planner;
                const originalHeroes = state.heroes;
                const originalIncome = state.income;
                const originalProfile = state.playerProfile;

                state.savedPlayerTags.forEach(tag => {
                    const player = state.allPlayersData[tag];
                    if (player) {
                        state.planner = player.planner;
                        state.heroes = player.heroes;
                        state.income = player.income;
                        state.playerProfile = player.playerProfile;

                        autoPlaceIncomeChipsForRange(MIN_MONTH, MIN_YEAR, MAX_MONTH, MAX_YEAR, true);
                        if (player.planner?.calendar) {
                            player.planner.calendar.isHydrated = true;
                        }
                    }
                });

                state.planner = originalPlanner;
                state.heroes = originalHeroes;
                state.income = originalIncome;
                state.playerProfile = originalProfile;

                if (state.planner?.calendar) {
                    state.planner.calendar.isHydrated = true;
                }
                handleStateUpdate(() => {}, false);
            });
        });

        // Trigger guided tour if onboarding is complete
        const welcomeTimestamp = state.uiSettings?.uiTimestamps?.welcome;
        if (welcomeTimestamp) {
            window.isTourPending = true;
            setTimeout(() => {
                import('../tour/appTour.js').then(module => {
                    module.startTour().then(started => {
                        window.isAppStartingUp = false;
                        if (!started) {
                            window.isTourPending = false;
                            document.dispatchEvent(new CustomEvent('tour:close'));
                        }
                    });
                });
            }, 400);
        } else {
            window.isAppStartingUp = false;
        }
    }
}

export function updateWelcomePage2Buttons() {
    const continueBtn = document.getElementById('welcome-continue-btn');
    const guestBtn = document.getElementById('welcome-guest-btn');
    const hasRealProfiles = state.savedPlayerTags && state.savedPlayerTags.some(tag => tag !== 'DEFAULT0');
    if (continueBtn) continueBtn.style.display = hasRealProfiles ? 'block' : 'none';
    if (guestBtn) guestBtn.style.display = hasRealProfiles ? 'none' : 'block';
}

export function updateContinueButtonDisabledState() {
    const continueBtn = document.getElementById('welcome-continue-btn');
    if (!continueBtn) return;

    if (currentPage === 2) {
        const isAnyProfileUpdating = Object.values(updatingProfiles).some(val => val === true);
        const isPending = isAnyProfileUpdating || isInputProfileLoading;
        continueBtn.disabled = isPending;
    } else {
        continueBtn.disabled = false;
    }
}


function measureHeaderHeight() {
    const modalContent = document.querySelector('.welcome-modal-content');
    const header = modalContent ? modalContent.querySelector('.welcome-header') : null;
    if (!header) return;

    // Temporarily disable all transitions to allow instantaneous layout measurement
    header.classList.add('no-transition');

    const isMinimized = modalContent.classList.contains('has-minimized-header');
    if (isMinimized) {
        modalContent.classList.remove('has-minimized-header');
    }

    // Force reflow and read the correct full height
    const height = header.getBoundingClientRect().height;

    if (isMinimized) {
        modalContent.classList.add('has-minimized-header');
    }

    // Force layout update before restoring transitions
    header.offsetHeight;
    header.classList.remove('no-transition');

    modalContent.style.setProperty('--welcome-header-height', `${height}px`);
}

export function initializeWelcomeModal() {
    const modal = document.getElementById('welcome-modal');
    const carousel = document.getElementById('welcome-carousel');
    const dots = document.querySelectorAll('.welcome-dot');

    const continueBtn = document.getElementById('welcome-continue-btn');
    const backBtn = document.getElementById('welcome-back-btn');
    const guestBtn = document.getElementById('welcome-guest-btn');
    const submitBtn = document.getElementById('welcome-submit-btn');
    const headerSkipBtn = document.getElementById('welcome-header-skip-btn');
    
    const input = document.getElementById('welcome-player-tag-input');
    const errorMsg = document.getElementById('welcome-player-tag-error');
    const termsLink = document.getElementById('welcome-terms-link');
    const privacyLink = document.getElementById('welcome-privacy-link');

    const loadProfileBtn = document.getElementById('welcome-load-btn');
    const previewContainer = document.getElementById('welcome-profile-preview-container');
    const tabBtnInfo = document.getElementById('welcome-tab-btn-info');
    const tabBtnEquipment = document.getElementById('welcome-tab-btn-equipment');
    const tabContentInfo = document.getElementById('welcome-tab-content-info');
    const tabContentEquipment = document.getElementById('welcome-tab-content-equipment');

    if (!modal) return;



    // Helper to update pagination visuals
    function updatePagination(pageNumber) {
        if (currentPage === pageNumber) return;
        
        const previousPage = currentPage;
        currentPage = pageNumber;

        if (previousPage === 4 && pageNumber !== 4) {
            cameFromSyncStartBtn = false;
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
                submitBtn.disabled = false;
            }
            const backBtn = document.getElementById('welcome-back-btn');
            if (backBtn) {
                backBtn.setAttribute('data-i18n', 'welcome.back');
                backBtn.textContent = translate('welcome.back') || 'Back';
            }
        }

        // Toggle minimized header state based on page number
        updateHeaderMinimizedState(pageNumber > 1);

        dots.forEach((dot, index) => {
            dot.classList.toggle('active', (index + 1) === pageNumber);
        });

        updateWelcomeContinueButtonText(pageNumber);



        const syncDeviceStartBtn = document.getElementById('welcome-sync-device-start-btn');
        const actionsContainer = document.getElementById('welcome-main-actions');

        // Toggle button layouts
        if (pageNumber === 1) {
            if (continueBtn) continueBtn.style.display = 'block';
            if (backBtn) backBtn.style.display = 'none';
            if (guestBtn) guestBtn.style.display = 'none';
            if (submitBtn) submitBtn.style.display = 'none';
            if (syncDeviceStartBtn) syncDeviceStartBtn.style.display = 'block';
            if (actionsContainer) {
                actionsContainer.classList.add('page-1');
                actionsContainer.style.flexDirection = '';
                actionsContainer.style.alignItems = '';
            }
        } else if (pageNumber === 2) {
            updateWelcomePage2Buttons();
            if (backBtn) backBtn.style.display = 'block';
            if (submitBtn) submitBtn.style.display = 'none';
            if (syncDeviceStartBtn) syncDeviceStartBtn.style.display = 'none';
            if (actionsContainer) {
                actionsContainer.classList.remove('page-1');
                actionsContainer.style.flexDirection = '';
                actionsContainer.style.alignItems = '';
            }
            if (input && (scrollTargetPage === null || scrollTargetPage === 2)) {
                // Focus input on page change, but wait briefly for transition/scrolling to settle
                setTimeout(() => {
                    if (currentPage === 2) {
                        input.focus();
                    }
                }, 150);
            }
        } else if (pageNumber === 3) {
            if (continueBtn) continueBtn.style.display = 'block';
            if (backBtn) backBtn.style.display = 'block';
            if (guestBtn) guestBtn.style.display = 'none';
            if (syncDeviceStartBtn) syncDeviceStartBtn.style.display = 'none';
            if (actionsContainer) {
                actionsContainer.classList.remove('page-1');
                actionsContainer.style.flexDirection = '';
                actionsContainer.style.alignItems = '';
            }
            if (submitBtn) {
                submitBtn.style.display = 'none';
            }
            renderVerticalProfilesList();
        } else if (pageNumber === 4) {
            if (continueBtn) continueBtn.style.display = 'none';
            if (backBtn) {
                backBtn.style.display = 'block';
                if (cameFromSyncStartBtn) {
                    backBtn.setAttribute('data-i18n', 'welcome.cancel');
                    backBtn.textContent = translate('welcome.cancel') || 'Cancel';
                } else {
                    backBtn.setAttribute('data-i18n', 'welcome.back');
                    backBtn.textContent = translate('welcome.back') || 'Back';
                }
            }
            if (guestBtn) guestBtn.style.display = 'none';
            if (syncDeviceStartBtn) syncDeviceStartBtn.style.display = 'none';
            if (actionsContainer) {
                actionsContainer.classList.remove('page-1');
                actionsContainer.style.flexDirection = '';
                actionsContainer.style.alignItems = '';
            }
            if (submitBtn) {
                submitBtn.style.display = 'block';
                updateSubmitButtonText();
                if (cameFromSyncStartBtn) {
                    const syncInput = document.getElementById('welcome-sync-input');
                    const val = syncInput ? syncInput.value.trim() : '';
                    const currentUserId = localStorage.getItem('oreCalc_userId');
                    submitBtn.disabled = !(isValidUUID(val) && val !== currentUserId);

                    // Focus the input when programmatic scroll transitions settle
                    setTimeout(() => {
                        if (syncInput) {
                            syncInput.focus();
                        }
                    }, 300);
                } else {
                    submitBtn.disabled = false;
                }
            }

            // Blur/disable Cloud Sync & Your Sync Code options temporarily
            // only when the user arrived via the "Link to Another Device" button on page 1.
            const cloudSyncContainer = document.getElementById('welcome-cloud-sync-container');
            const yourSyncCodeDetails = document.getElementById('welcome-your-sync-code-details');
            if (cloudSyncContainer) {
                cloudSyncContainer.classList.toggle('welcome-sync-temp-blurred', cameFromSyncStartBtn);
            }
            if (yourSyncCodeDetails) {
                yourSyncCodeDetails.classList.toggle('welcome-sync-temp-blurred', cameFromSyncStartBtn);
            }
        }

        updateHeaderSkipButtonVisibility();

        updateContinueButtonDisabledState();
    }

    // Scroll snapping detection
    if (carousel) {
        carousel.addEventListener('scroll', () => {
            const width = carousel.clientWidth;
            if (width <= 0) return;

            const scrollLeft = carousel.scrollLeft;
            const visualIndex = Math.round(scrollLeft / (width + 32));
            const page = getPageFromVisualIndex(visualIndex);

            // Block manual swiping forward from page 2 if there are pending updates.
            // scrollTargetPage !== null means a programmatic scroll is in progress
            // (e.g. "Link to Another Device" from page 1 to page 4), so we skip the
            // guard to avoid snapping it back to page 2 as it passes through.
            if (currentPage === 2 && page > 2) {
                if (scrollTargetPage === null) {
                    const isAnyProfileUpdating = Object.values(updatingProfiles).some(val => val === true);
                    if (isAnyProfileUpdating || isInputProfileLoading) {
                        carousel.scrollTo({ left: getVisualIndexFromPage(2) * (width + 32), behavior: 'auto' });
                        return;
                    }
                }
            }

            if (scrollTargetPage !== null && page === scrollTargetPage) {
                scrollTargetPage = null;
            }

            if (page !== currentPage) {
                updatePagination(page);
                updatePreviewArrowPosition();
            }
        }, { passive: true });
    }

    const welcomeList = document.getElementById('welcome-profiles-list');
    if (welcomeList) {
        welcomeList.addEventListener('scroll', updatePreviewArrowPosition, { passive: true });
    }
    const welcomeQsList = document.getElementById('welcome-qs-profiles-list');
    if (welcomeQsList) {
        welcomeQsList.addEventListener('scroll', updatePreviewArrowPosition, { passive: true });
    }
    const handleWelcomeResize = () => {
        measureHeaderHeight();
        updatePreviewArrowPosition();
        if (carousel) {
            const width = carousel.clientWidth;
            if (width <= 0) return;
            const visualIndex = getVisualIndexFromPage(currentPage);
            carousel.style.scrollBehavior = 'auto';
            carousel.scrollLeft = visualIndex * (width + 32);
            carousel.style.scrollBehavior = '';
        }
    };
    window.addEventListener('resize', handleWelcomeResize, { passive: true });

    // Button actions: Continue & Back
    if (continueBtn && carousel) {
        continueBtn.addEventListener('click', async (e) => {
            const width = carousel.clientWidth;
            if (currentPage === 2) {
                if (state.savedPlayerTags.length === 1) {
                    scrollTargetPage = 3;
                    const visualIndex = getVisualIndexFromPage(3);
                    carousel.scrollTo({ left: visualIndex * (width + 32), behavior: 'smooth' });
                    setTimeout(() => {
                        openSetupWizard(state.savedPlayerTags[0]);
                    }, 350);
                    return;
                }
            }
            if (currentPage === 3) {
                const pendingTags = state.savedPlayerTags.filter(tag => {
                    return sessionStorage.getItem(`oreCalc_onboardingComplete_${tag}`) !== 'true';
                });

                if (pendingTags.length > 0) {
                    openSetupWizard(pendingTags[0]);
                    return;
                }

                // Expand copy section (idx === 0) and collapse paste section (idx === 1)
                const welcomeSyncDetailsElements = document.querySelectorAll('.welcome-sync-details');
                welcomeSyncDetailsElements.forEach((detailsEl, idx) => {
                    if (idx === 0) {
                        if (detailsEl._welcomeAccordion) {
                            detailsEl._welcomeAccordion.open();
                        } else {
                            detailsEl.open = true;
                        }
                    } else {
                        if (detailsEl._welcomeAccordion) {
                            detailsEl._welcomeAccordion.shrink();
                        } else {
                            detailsEl.open = false;
                        }
                    }
                });
            }
            let targetPage = currentPage + 1;
            scrollTargetPage = targetPage;
            const visualIndex = getVisualIndexFromPage(targetPage);
            carousel.scrollTo({ left: visualIndex * (carousel.clientWidth + 32), behavior: 'smooth' });
        });
    }

    if (backBtn && carousel) {
        backBtn.addEventListener('click', () => {
            let targetPage;
            if (currentPage === 4 && cameFromSyncStartBtn) {
                targetPage = 1;
                cameFromSyncStartBtn = false;
            } else {
                targetPage = currentPage - 1;
            }
            scrollTargetPage = targetPage;
            const visualIndex = getVisualIndexFromPage(targetPage);
            carousel.scrollTo({ left: visualIndex * (carousel.clientWidth + 32), behavior: 'smooth' });
        });
    }

    if (headerSkipBtn && carousel) {
        headerSkipBtn.addEventListener('click', async () => {
            if (activeWizardTag) {
                // Skip only that player's setup, mark it done, and return to page 3 list
                finishWizard(true);
                return;
            }

            const pendingTags = state.savedPlayerTags.filter(tag => tag !== 'DEFAULT0').filter(tag => {
                return sessionStorage.getItem(`oreCalc_onboardingComplete_${tag}`) !== 'true';
            });

            if (pendingTags.length > 0) {
                const confirmed = await showConfirm(
                    translate('confirms.skipSetup') || 'You have not finished setting up your profile(s). Would you like to skip setup anyway?',
                    'status.confirm',
                    'actions.skipAnyway',
                    'actions.cancel'
                );
                if (!confirmed) return;

                // Mark all pending tags as onboardingComplete = true in sessionStorage
                pendingTags.forEach(tag => {
                    sessionStorage.setItem(`oreCalc_onboardingComplete_${tag}`, 'true');
                });
                renderVerticalProfilesList();
            }

            // Expand copy section (idx === 0) and collapse paste section (idx === 1)
            const welcomeSyncDetailsElements = document.querySelectorAll('.welcome-sync-details');
            welcomeSyncDetailsElements.forEach((detailsEl, idx) => {
                if (idx === 0) {
                    if (detailsEl._welcomeAccordion) {
                        detailsEl._welcomeAccordion.open();
                    } else {
                        detailsEl.open = true;
                    }
                } else {
                    if (detailsEl._welcomeAccordion) {
                        detailsEl._welcomeAccordion.shrink();
                    } else {
                        detailsEl.open = false;
                    }
                }
            });

            // Scroll to page 4
            scrollTargetPage = 4;
            const visualIndex = getVisualIndexFromPage(4);
            carousel.scrollTo({ left: visualIndex * (carousel.clientWidth + 32), behavior: 'smooth' });
        });
    }

    // Dot clicks
    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            const page = parseInt(dot.getAttribute('data-page'));
            if (currentPage === 2 && page > 2) {
                const isAnyProfileUpdating = Object.values(updatingProfiles).some(val => val === true);
                if (isAnyProfileUpdating || isInputProfileLoading) {
                    return;
                }
            }

            scrollTargetPage = page;
            const visualIndex = getVisualIndexFromPage(page);
            if (carousel) {
                carousel.scrollTo({ left: visualIndex * (carousel.clientWidth + 32), behavior: 'smooth' });
            }
        });
    });

    // Initialize preference switch listeners
    modal.querySelectorAll('.language-switch .pref-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const newLang = btn.getAttribute('data-lang');
            if (state.uiSettings.language === newLang) return;

            const langSwitch = modal.querySelector('.language-switch');
            if (langSwitch) {
                const langIndex = newLang === 'de' ? '1' : (newLang === 'tr' ? '2' : '0');
                langSwitch.setAttribute('data-active-index', langIndex);
            }

            modal.querySelectorAll('.language-switch .pref-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const header = modal.querySelector('.welcome-header');
            if (header) header.classList.add('translating-header');
            if (carousel) carousel.classList.add('translating');
            
            // Wait 150ms for the fade-out animation to complete
            await new Promise(resolve => setTimeout(resolve, 150));

            await loadTranslations(newLang);

            handleStateUpdate(() => {
                state.uiSettings.language = newLang;
            });

            document.dispatchEvent(new CustomEvent('app:translate'));
            renderApp(state);

            const event = new Event('languageChanged');
            document.dispatchEvent(event);

            if (header) header.classList.remove('translating-header');
            if (carousel) carousel.classList.remove('translating');
        });
    });

    modal.querySelectorAll('.theme-switch .pref-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const newTheme = btn.getAttribute('data-theme');
            if (state.uiSettings.theme === newTheme) return;

            const themeSwitch = modal.querySelector('.theme-switch');
            if (themeSwitch) {
                themeSwitch.setAttribute('data-active-index', newTheme === 'dark' ? '0' : '1');
            }

            modal.querySelectorAll('.theme-switch .pref-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update state theme silently to prevent click races during animation
            handleStateUpdate(() => {
                state.uiSettings.theme = newTheme;
            }, true);

            // Wait 250ms for the sliding pill animation to complete first
            await new Promise(resolve => setTimeout(resolve, 250));

            // Calculate center of the clicked button for circular reveal ripple
            const rect = btn.getBoundingClientRect();
            const origin = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };

            document.dispatchEvent(new CustomEvent('app:theme-change', { detail: { theme: newTheme, origin } }));
        });
    });

    // Initialize accent color swatches click listeners
    modal.querySelectorAll('#welcome-accent-picker .accent-swatch').forEach(swatch => {
        swatch.addEventListener('click', (e) => {
            const newAccent = swatch.dataset.color;
            // Toggle active classes immediately to match settings page behaviour
            modal.querySelectorAll('#welcome-accent-picker .accent-swatch').forEach(s => {
                s.classList.toggle('active', s.dataset.color === newAccent);
            });

            handleStateUpdate(() => {
                state.uiSettings.accentColor = newAccent;
            }, true);

            // Calculate center of clicked swatch for circular reveal ripple
            const rect = swatch.getBoundingClientRect();
            const origin = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
                isSwatchClick: true
            };
            document.dispatchEvent(new CustomEvent('app:theme-change', { detail: { theme: state.uiSettings.theme, origin } }));
        });
    });

    const randomLabel = modal.querySelector('.random-label');
    if (randomLabel) {
        randomLabel.addEventListener('click', () => {
            const swatch = randomLabel.previousElementSibling;
            if (swatch) swatch.click();
        });
    }

    // Initialize Profile Preview tab switching
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

    // Initialize Delete Button
    const deleteBtn = document.getElementById('welcome-profile-delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const activeTag = state.savedPlayerTags[0];
            if (!activeTag || activeTag === 'DEFAULT0') return;

            const confirmed = await showConfirm(
                translate('confirms.deleteProfile') || "Are you sure you want to delete this profile? This will remove all local data for this player."
            );
            if (!confirmed) return;

            removePlayerTag(activeTag);
            
            // Update the static list order
            welcomeProfilesOrder = welcomeProfilesOrder.filter(t => t !== activeTag);

            // Re-render compact card list
            renderWelcomeProfilesList(updatingProfiles, errorProfiles);

            // If another profile is available, select it, otherwise hide the preview container
            const nextTag = state.savedPlayerTags[0];
            if (nextTag) {
                const el = document.querySelector(`.welcome-profile-card-compact[data-tag="${nextTag}"]`);
                if (el) {
                    el.click();
                } else {
                    const activePlayer = state.allPlayersData[nextTag];
                    if (activePlayer && (activePlayer.playerProfile || activePlayer.playerData)) {
                        renderProfilePreviewCard(activePlayer.playerProfile || activePlayer.playerData);
                        isProfileLoaded = true;
                    } else {
                        if (previewContainer) previewContainer.style.display = 'none';
                        isProfileLoaded = false;
                    }
                }
            } else {
                if (previewContainer) previewContainer.style.display = 'none';
                isProfileLoaded = false;
            }

            updateWelcomePage2Buttons();

            renderApp(state);
        });
    }

    // Reset preview if player tag changes
    if (input) {
        input.addEventListener('input', () => {
            if (previewContainer) previewContainer.style.display = 'none';
            isProfileLoaded = false;
            
            updateWelcomePage2Buttons();

            validatePlayerTagInput(input, errorMsg);
        });
    }

    // Inline action for Load Profile
    const handleLoadProfile = async () => {
        const { cleanedTag, isValid } = validatePlayerTagInput(input, errorMsg);
        if (isValid && cleanedTag) {
            const originalText = loadProfileBtn.textContent;
            try {
                loadProfileBtn.disabled = true;
                isInputProfileLoading = true;
                updateContinueButtonDisabledState();
                loadProfileBtn.textContent = translate('actions.loading');
                if (errorMsg) {
                    errorMsg.textContent = '';
                    errorMsg.classList.remove('show');
                }
                input.classList.remove('input-error');

                const playerData = await fetchPlayerData(cleanedTag);
                if (playerData && playerData.tag) {
                    input.value = '';
                    processPlayerDataResponse(playerData);
                    const tagKey = playerData.tag.startsWith('#') ? playerData.tag.substring(1) : playerData.tag;

                    // Apply current toggle settings to the newly loaded profile
                    handleStateUpdate(() => {
                        const playerObj = state.allPlayersData[tagKey];
                        if (playerObj) {
                            applyChecklistToProfile(playerObj);
                        }
                    }, true);

                    // Immediately resolve this tag's loading state so the card shows
                    // the checkmark without waiting for any in-progress sequential refresh
                    // of the same tag to complete (which could take up to 15s).
                    successProfiles[tagKey] = true;
                    updatingProfiles[tagKey] = false;
                    delete errorProfiles[tagKey];

                    welcomeProfilesOrder = [...state.savedPlayerTags];
                    renderWelcomeProfilesList(updatingProfiles, errorProfiles);
                    setTimeout(() => {
                        const el = document.querySelector(`.welcome-profile-card-compact[data-tag="${tagKey}"]`);
                        if (el) el.click();
                    }, 50);
                    isProfileLoaded = true;
                    updateWelcomePage2Buttons();
                } else {
                    throw new Error('errors.invalidServerData');
                }
            } catch (err) {
                console.error('Failed to load player preview data:', err);
                const transMsg = translate(err.message) || err.message;
                errorMsg.textContent = translate('errors.fetchPlayerFailed', { error: transMsg });
                errorMsg.classList.add('show');
                input.classList.add('input-error');
                input.classList.remove('shake');
                void input.offsetWidth;
                input.classList.add('shake');
                isProfileLoaded = false;
            } finally {
                loadProfileBtn.disabled = false;
                isInputProfileLoading = false;
                updateContinueButtonDisabledState();
                loadProfileBtn.textContent = originalText;
            }
        }
    };

    if (loadProfileBtn) {
        loadProfileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleLoadProfile();
        });
    }

    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            const welcomeSyncInput = document.getElementById('welcome-sync-input');
            const val = welcomeSyncInput ? welcomeSyncInput.value.trim() : '';
            const currentUserId = localStorage.getItem('oreCalc_userId');

            if (cameFromSyncStartBtn && isValidUUID(val) && val !== currentUserId) {
                const originalText = submitBtn.textContent;
                try {
                    submitBtn.disabled = true;
                    submitBtn.textContent = translate('actions.processing') || 'Processing...';

                    const { importUserData } = await import('../../utils/cloudSaveHandler.js');
                    await importUserData(val);
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
                return;
            }

            handleStateUpdate(() => {
                const now = Date.now();
                if (!state.uiSettings.uiTimestamps) {
                    state.uiSettings.uiTimestamps = {};
                }
                state.uiSettings.uiTimestamps.privacy = Math.max(now, EFFECTIVE_DATE_PRIVACY + 1);
                state.uiSettings.uiTimestamps.tos = Math.max(now, EFFECTIVE_DATE_TERMS + 1);
                state.uiSettings.uiTimestamps.welcome = Math.max(now, EFFECTIVE_DATE_WELCOME + 1);

                // Stamp storedOres.lastUpdated for every player so the stored ores
                // reminder modal doesn't immediately re-trigger after the welcome flow
                // (the welcome wizard already collected that data).
                for (const tag of state.savedPlayerTags) {
                    const player = state.allPlayersData?.[tag];
                    if (player) {
                        if (!player.storedOres) player.storedOres = {};
                        player.storedOres.lastUpdated = now;
                    }
                    sessionStorage.setItem(`oreCalc_onboardingComplete_${tag}`, 'true');
                }
            });
            // Dismiss stored ores modal if it somehow opened during onboarding
            closeStoredOresModal();
            
            // Hide consent banner immediately
            const consentBanner = document.getElementById('consent-banner');
            if (consentBanner) {
                consentBanner.classList.remove('show');
            }

            showWelcomeModal(false);
        });

        // Trigger load/submit on Enter key inside tag input
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (loadProfileBtn) {
                        loadProfileBtn.click();
                    }
                }
            });
        }
    }

    // Initialize Page 3 Guest Config Selector values
    initializeGuestSetup();

    // Listen to translation changes to keep select options updated
    document.addEventListener('app:translate', () => {
        initializeGuestSetup();
        requestAnimationFrame(() => {
            measureHeaderHeight();
        });
    });

    if (guestBtn) {
        guestBtn.addEventListener('click', () => {
            // Generate Guest profile
            if (!state.savedPlayerTags.includes('DEFAULT0')) {
                const guestPlayerData = generateGuestPlayerData(selectedTH, selectedLeague);
                const guestPlayerState = {
                    ...getDefaultPlayerState(),
                    playerProfile: guestPlayerData
                };
                initializeGuestHeroesState(guestPlayerState);
                
                handleStateUpdate(() => {
                    updateSavedPlayerTags('DEFAULT0');
                    state.allPlayersData['DEFAULT0'] = guestPlayerState;
                }, true);
                sessionStorage.removeItem('oreCalc_onboardingComplete_DEFAULT0');
            }

            // Switch active player to DEFAULT0
            switchActivePlayer('DEFAULT0');
            isProfileLoaded = true;

            // Render lists
            renderVerticalProfilesList();
            
            // Scroll to page 3
            if (carousel) {
                scrollTargetPage = 3;
                const visualIndex = getVisualIndexFromPage(3);
                carousel.scrollTo({ left: visualIndex * (carousel.clientWidth + 32), behavior: 'smooth' });
            }

            // Open the setup wizard for Guest immediately
            setTimeout(() => {
                openSetupWizard('DEFAULT0');
            }, 350);
        });
    }

    const wizardBackBtn = document.getElementById('welcome-wizard-back-btn');
    const wizardNextBtn = document.getElementById('welcome-wizard-next-btn');

    if (wizardBackBtn) {
        wizardBackBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (currentWizardStepIndex === 0 && !wasAlreadyOnboarded) {
                const confirmed = await showConfirm(
                    translate('confirms.cancelSetup') || "Are you sure you want to cancel the setup? Your progress might be lost.",
                    'status.confirm',
                    'actions.confirm',
                    'actions.cancel'
                );
                if (!confirmed) return;
            }
            goToPrevWizardStep();
        });
    }

    if (wizardNextBtn) {
        wizardNextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            goToNextWizardStep();
        });
    }

    if (termsLink) {
        termsLink.addEventListener('click', (e) => {
            e.preventDefault();
            modal.classList.remove('show');
            openTermsOfUseModal();
        });
    }

    if (privacyLink) {
        privacyLink.addEventListener('click', (e) => {
            e.preventDefault();
            modal.classList.remove('show');
            openPrivacyModal();
        });
    }

    // Onboarding Quick Settings Checklist listeners
    const storedShinyInput = document.getElementById('welcome-stored-shiny');
    const storedGlowyInput = document.getElementById('welcome-stored-glowy');
    const storedStarryInput = document.getElementById('welcome-stored-starry');
    const raidMedalsBuySwitch = document.getElementById('welcome-pref-raid-medals-buy');
    const raidMedalsEarnedInput = document.getElementById('welcome-pref-raid-medals-earned');
    const raidMedalsStarryInput = document.getElementById('welcome-pref-raid-medals-starry');
    const raidMedalsGlowyInput = document.getElementById('welcome-pref-raid-medals-glowy');
    const raidMedalsShinyInput = document.getElementById('welcome-pref-raid-medals-shiny');
    const gemsBuySwitch = document.getElementById('welcome-pref-gems-buy');
    const gemsStarryInput = document.getElementById('welcome-pref-gems-starry');
    const gemsGlowyInput = document.getElementById('welcome-pref-gems-glowy');
    const gemsShinyInput = document.getElementById('welcome-pref-gems-shiny');
    const shopOffersBuySwitch = document.getElementById('welcome-pref-shop-offers-buy');
    const clanWarsBuySwitch = document.getElementById('welcome-pref-clan-wars-buy');
    const clanWarsCountInput = document.getElementById('welcome-pref-clan-wars-count');
    const clanWarsWinrateInput = document.getElementById('welcome-pref-clan-wars-winrate');
    const clanWarsDrawrateInput = document.getElementById('welcome-pref-clan-wars-drawrate');
    const cwlBuySwitch = document.getElementById('welcome-pref-cwl-buy');
    const cwlHitsInput = document.getElementById('welcome-pref-cwl-hits');
    const cwlWinrateInput = document.getElementById('welcome-pref-cwl-winrate');
    const cwlDrawrateInput = document.getElementById('welcome-pref-cwl-drawrate');
    const goldPassSwitch = document.getElementById('welcome-pref-gold-pass');
    const cloudSyncSwitch = document.getElementById('welcome-pref-cloud-sync');
    const recommendationsSwitch = document.getElementById('welcome-pref-recommendations');

    const eventPassBuySwitch = document.getElementById('welcome-pref-event-pass-buy');
    const eventIncludeEquipmentSwitch = document.getElementById('welcome-pref-event-include-equipment');
    const eventBonusMedalsInput = document.getElementById('welcome-pref-event-bonus-medals');
    const eventPurchasedMedalsInput = document.getElementById('welcome-pref-event-purchased-medals');
    const eventTraderBuySwitch = document.getElementById('welcome-pref-event-trader-buy');
    const eventTraderShinySelect = document.getElementById('welcome-pref-event-trader-shiny');
    const eventTraderGlowySelect = document.getElementById('welcome-pref-event-trader-glowy');
    const eventTraderStarrySelect = document.getElementById('welcome-pref-event-trader-starry');
    const currencySelect = document.getElementById('welcome-pref-currency');

    const handleSwitchChange = () => {
        const activeTag = activeWizardTag || state.savedPlayerTags[0];
        
        tempStoredShiny = parseInt(storedShinyInput?.value, 10) || 0;
        tempStoredGlowy = parseInt(storedGlowyInput?.value, 10) || 0;
        tempStoredStarry = parseInt(storedStarryInput?.value, 10) || 0;
        
        tempRaidMedalsBuy = raidMedalsBuySwitch?.checked || false;
        tempRaidMedalsEarned = parseInt(raidMedalsEarnedInput?.value, 10) || 1200;
        tempRaidMedalsStarry = parseInt(raidMedalsStarryInput?.value, 10) || 0;
        tempRaidMedalsGlowy = parseInt(raidMedalsGlowyInput?.value, 10) || 0;
        tempRaidMedalsShiny = parseInt(raidMedalsShinyInput?.value, 10) || 0;
        tempGemsBuy = gemsBuySwitch?.checked || false;
        tempGemsStarry = parseInt(gemsStarryInput?.value, 10) || 0;
        tempGemsGlowy = parseInt(gemsGlowyInput?.value, 10) || 0;
        tempGemsShiny = parseInt(gemsShinyInput?.value, 10) || 0;

        tempShopOffersBuy = shopOffersBuySwitch?.checked || false;
        tempClanWars = clanWarsBuySwitch?.checked || false;
        tempClanWarsCount = parseInt(clanWarsCountInput?.value, 10) || 8;
        tempClanWarsWinrate = parseInt(clanWarsWinrateInput?.value, 10) || 70;
        tempClanWarsDrawrate = parseInt(clanWarsDrawrateInput?.value, 10) || 0;
        tempCwl = cwlBuySwitch?.checked || false;
        tempCwlHits = parseInt(cwlHitsInput?.value, 10) || 7;
        tempCwlWinrate = parseInt(cwlWinrateInput?.value, 10) || 50;
        tempCwlDrawrate = parseInt(cwlDrawrateInput?.value, 10) || 0;
        tempGoldPass = goldPassSwitch?.checked || false;
        tempCloudSync = cloudSyncSwitch?.checked || false;

        tempEventPassBuy = eventPassBuySwitch?.checked || false;
        tempEventIncludeEquipment = eventIncludeEquipmentSwitch?.checked || false;
        tempEventBonusMedals = parseInt(eventBonusMedalsInput?.value, 10) || 0;
        tempEventPurchasedMedals = parseInt(eventPurchasedMedalsInput?.value, 10) || 0;
        tempEventTraderBuy = eventTraderBuySwitch?.checked || false;
        tempEventTraderShiny = parseInt(eventTraderShinySelect?.value, 10) || 0;
        tempEventTraderGlowy = parseInt(eventTraderGlowySelect?.value, 10) || 0;
        tempEventTraderStarry = parseInt(eventTraderStarrySelect?.value, 10) || 0;
        tempCurrencyCode = currencySelect?.value || 'USD';

        toggleSubpanels();

        if (activeTag) {
            handleStateUpdate(() => {
                const playerObj = state.allPlayersData[activeTag];
                if (playerObj) {
                    applyChecklistToProfile(playerObj);
                }
            }, true);

            // Re-render shop offers to update pricing currency symbols/values!
            let thLevel = selectedTH || 16;
            if (activeTag && activeTag !== 'DEFAULT0') {
                const playerObj = state.allPlayersData[activeTag];
                if (playerObj) {
                    const th = playerObj.playerProfile?.townHallLevel || playerObj.townHallLevel || 16;
                    thLevel = parseInt(th, 10);
                }
            }
            renderWelcomeShopOffers(thLevel, tempShopOffersPurchases);

            renderApp(state);
        }
    };

    const handleClanWarsRateChange = (changedType) => {
        let win = parseInt(clanWarsWinrateInput?.value, 10);
        if (isNaN(win)) win = 70;
        let draw = parseInt(clanWarsDrawrateInput?.value, 10);
        if (isNaN(draw)) draw = 0;
        const adjusted = adjustWarRates(win, draw, changedType);
        if (clanWarsWinrateInput) clanWarsWinrateInput.value = adjusted.winRate;
        if (clanWarsDrawrateInput) clanWarsDrawrateInput.value = adjusted.drawRate;
        handleSwitchChange();
    };

    const handleCwlRateChange = (changedType) => {
        let win = parseInt(cwlWinrateInput?.value, 10);
        if (isNaN(win)) win = 50;
        let draw = parseInt(cwlDrawrateInput?.value, 10);
        if (isNaN(draw)) draw = 0;
        const adjusted = adjustWarRates(win, draw, changedType);
        if (cwlWinrateInput) cwlWinrateInput.value = adjusted.winRate;
        if (cwlDrawrateInput) cwlDrawrateInput.value = adjusted.drawRate;
        handleSwitchChange();
    };

    storedShinyInput?.addEventListener('validated-input', handleSwitchChange);
    storedGlowyInput?.addEventListener('validated-input', handleSwitchChange);
    storedStarryInput?.addEventListener('validated-input', handleSwitchChange);
    
    raidMedalsBuySwitch?.addEventListener('change', handleSwitchChange);
    raidMedalsEarnedInput?.addEventListener('validated-input', handleSwitchChange);
    if (raidMedalsStarryInput) {
        const ev = raidMedalsStarryInput.tagName === 'SELECT' ? 'change' : 'validated-input';
        raidMedalsStarryInput.addEventListener(ev, handleSwitchChange);
    }
    if (raidMedalsGlowyInput) {
        const ev = raidMedalsGlowyInput.tagName === 'SELECT' ? 'change' : 'validated-input';
        raidMedalsGlowyInput.addEventListener(ev, handleSwitchChange);
    }
    if (raidMedalsShinyInput) {
        const ev = raidMedalsShinyInput.tagName === 'SELECT' ? 'change' : 'validated-input';
        raidMedalsShinyInput.addEventListener(ev, handleSwitchChange);
    }
    gemsBuySwitch?.addEventListener('change', handleSwitchChange);
    if (gemsStarryInput) {
        const ev = gemsStarryInput.tagName === 'SELECT' ? 'change' : 'validated-input';
        gemsStarryInput.addEventListener(ev, handleSwitchChange);
    }
    if (gemsGlowyInput) {
        const ev = gemsGlowyInput.tagName === 'SELECT' ? 'change' : 'validated-input';
        gemsGlowyInput.addEventListener(ev, handleSwitchChange);
    }
    if (gemsShinyInput) {
        const ev = gemsShinyInput.tagName === 'SELECT' ? 'change' : 'validated-input';
        gemsShinyInput.addEventListener(ev, handleSwitchChange);
    }

    shopOffersBuySwitch?.addEventListener('change', handleSwitchChange);
    clanWarsBuySwitch?.addEventListener('change', handleSwitchChange);
    clanWarsCountInput?.addEventListener('validated-input', handleSwitchChange);
    clanWarsWinrateInput?.addEventListener('validated-input', () => handleClanWarsRateChange('win'));
    clanWarsDrawrateInput?.addEventListener('validated-input', () => handleClanWarsRateChange('draw'));
    cwlBuySwitch?.addEventListener('change', handleSwitchChange);
    cwlHitsInput?.addEventListener('validated-input', handleSwitchChange);
    cwlWinrateInput?.addEventListener('validated-input', () => handleCwlRateChange('win'));
    cwlDrawrateInput?.addEventListener('validated-input', () => handleCwlRateChange('draw'));
    goldPassSwitch?.addEventListener('change', handleSwitchChange);
    cloudSyncSwitch?.addEventListener('change', handleSwitchChange);

    eventPassBuySwitch?.addEventListener('change', handleSwitchChange);
    eventIncludeEquipmentSwitch?.addEventListener('change', handleSwitchChange);
    eventBonusMedalsInput?.addEventListener('validated-input', handleSwitchChange);
    eventPurchasedMedalsInput?.addEventListener('validated-input', handleSwitchChange);
    eventTraderBuySwitch?.addEventListener('change', handleSwitchChange);
    eventTraderShinySelect?.addEventListener('change', handleSwitchChange);
    eventTraderGlowySelect?.addEventListener('change', handleSwitchChange);
    eventTraderStarrySelect?.addEventListener('change', handleSwitchChange);
    currencySelect?.addEventListener('change', (e) => {
        tempCurrencyCode = e.target.value;
        handleSwitchChange();
    });

    recommendationsSwitch?.addEventListener('change', () => {
        const wizardView = document.getElementById('welcome-profile-setup-wizard-view');
        if (wizardView) {
            wizardView.classList.toggle('show-recommendations', recommendationsSwitch.checked);
        }
    });

    // Initialize Validation & Popovers for Stored Ores, Raid Medals, & Clan Wars
    if (storedShinyInput) {
        addValidation(storedShinyInput, { inputName: translate('ores.shiny') || "Shiny Ore" });
        registerInputPopover(storedShinyInput, {
            title: () => translate('ores.shiny') || "Shiny Ore",
            min: 0,
            max: 50000,
            showRange: true,
            showRecommended: true,
            recommended: 0,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }
    if (storedGlowyInput) {
        addValidation(storedGlowyInput, { inputName: translate('ores.glowy') || "Glowy Ore" });
        registerInputPopover(storedGlowyInput, {
            title: () => translate('ores.glowy') || "Glowy Ore",
            min: 0,
            max: 5000,
            showRange: true,
            showRecommended: true,
            recommended: 0,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }
    if (storedStarryInput) {
        addValidation(storedStarryInput, { inputName: translate('ores.starry') || "Starry Ore" });
        registerInputPopover(storedStarryInput, {
            title: () => translate('ores.starry') || "Starry Ore",
            min: 0,
            max: 1000,
            showRange: true,
            showRecommended: true,
            recommended: 0,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }
    if (raidMedalsEarnedInput) {
        addValidation(raidMedalsEarnedInput, { inputName: translate('ores.raidMedal') || "Raid Medals" });
        registerInputPopover(raidMedalsEarnedInput, {
            title: () => translate('ores.raidMedal') || "Raid Medals",
            min: 0,
            max: 1970,
            showRange: true,
            showRecommended: true,
            recommended: 1200,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }
    if (raidMedalsShinyInput && raidMedalsShinyInput.tagName === 'INPUT') {
        addValidation(raidMedalsShinyInput, { inputName: `${translate('ores.shiny')} ${translate('shopOffers.packs') || 'Packs'}` });
        registerInputPopover(raidMedalsShinyInput, {
            title: () => `${translate('ores.shiny')} ${translate('shopOffers.packs') || 'Packs'}`,
            min: 0,
            max: 2,
            showRange: true,
            showRecommended: true,
            recommended: 0,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }
    if (raidMedalsGlowyInput && raidMedalsGlowyInput.tagName === 'INPUT') {
        addValidation(raidMedalsGlowyInput, { inputName: `${translate('ores.glowy')} ${translate('shopOffers.packs') || 'Packs'}` });
        registerInputPopover(raidMedalsGlowyInput, {
            title: () => `${translate('ores.glowy')} ${translate('shopOffers.packs') || 'Packs'}`,
            min: 0,
            max: 2,
            showRange: true,
            showRecommended: true,
            recommended: 0,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }
    if (raidMedalsStarryInput && raidMedalsStarryInput.tagName === 'INPUT') {
        addValidation(raidMedalsStarryInput, { inputName: `${translate('ores.starry')} ${translate('shopOffers.packs') || 'Packs'}` });
        registerInputPopover(raidMedalsStarryInput, {
            title: () => `${translate('ores.starry')} ${translate('shopOffers.packs') || 'Packs'}`,
            min: 0,
            max: 2,
            showRange: true,
            showRecommended: true,
            recommended: 0,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }
    if (clanWarsCountInput) {
        addValidation(clanWarsCountInput, { inputName: translate('income.clanWar.warsPerMonth') || "Wars per Month" });
        registerInputPopover(clanWarsCountInput, {
            title: () => translate('income.clanWar.warsPerMonth') || "Wars per Month",
            min: 0,
            max: 15,
            showRange: true,
            showRecommended: true,
            recommended: 8,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }
    if (clanWarsWinrateInput) {
        addValidation(clanWarsWinrateInput, { inputName: translate('income.clanWar.winRate') || "Win Rate (%)" });
        registerInputPopover(clanWarsWinrateInput, {
            title: () => translate('income.clanWar.winRate') || "Win Rate (%)",
            min: 0,
            max: 100,
            showRange: true,
            showRecommended: true,
            recommended: 70,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }
    if (cwlHitsInput) {
        addValidation(cwlHitsInput, { inputName: translate('welcome.quickSettings.cwlHits') || "Hits per Season" });
        registerInputPopover(cwlHitsInput, {
            title: () => translate('welcome.quickSettings.cwlHits') || "Hits per Season",
            min: 0,
            max: 7,
            showRange: true,
            showRecommended: true,
            recommended: 7,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }
    if (cwlWinrateInput) {
        addValidation(cwlWinrateInput, { inputName: translate('income.winRate') || "Win Rate (%)" });
        registerInputPopover(cwlWinrateInput, {
            title: () => translate('income.winRate') || "Win Rate (%)",
            min: 0,
            max: 100,
            showRange: true,
            showRecommended: true,
            recommended: 50,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }
    if (clanWarsDrawrateInput) {
        addValidation(clanWarsDrawrateInput, { inputName: translate('welcome.quickSettings.drawRate') || "Draw Rate (%)" });
        registerInputPopover(clanWarsDrawrateInput, {
            title: () => translate('welcome.quickSettings.drawRate') || "Draw Rate (%)",
            min: 0,
            max: 100,
            showRange: true,
            showRecommended: true,
            recommended: 0,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }
    if (cwlDrawrateInput) {
        addValidation(cwlDrawrateInput, { inputName: translate('welcome.quickSettings.drawRate') || "Draw Rate (%)" });
        registerInputPopover(cwlDrawrateInput, {
            title: () => translate('welcome.quickSettings.drawRate') || "Draw Rate (%)",
            min: 0,
            max: 100,
            showRange: true,
            showRecommended: true,
            recommended: 0,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }

    if (eventBonusMedalsInput) {
        addValidation(eventBonusMedalsInput, { inputName: translate('income.eventPass.bonusTrackMedals') || "Bonus Medals" });
        registerInputPopover(eventBonusMedalsInput, {
            title: () => translate('income.eventPass.bonusTrackMedals') || "Bonus Medals",
            min: 0,
            max: 2000,
            showRange: true,
            showRecommended: true,
            recommended: 0,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }
    if (eventPurchasedMedalsInput) {
        addValidation(eventPurchasedMedalsInput, { inputName: translate('income.eventPass.purchasedMedals') || "Purchased Medals" });
        registerInputPopover(eventPurchasedMedalsInput, {
            title: () => translate('income.eventPass.purchasedMedals') || "Purchased Medals",
            min: 0,
            max: 30000,
            showRange: true,
            showRecommended: true,
            recommended: 0,
            clickToFill: { min: true, max: true, recommended: true }
        });
    }

    // Setup Wizard Swipe Gesture Navigation
    const wizardView = document.getElementById('welcome-profile-setup-wizard-view');
    if (wizardView) {
        let touchStartX = 0;
        let touchStartY = 0;

        wizardView.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            if (e.touches.length > 1) return;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        wizardView.addEventListener('touchmove', (e) => {
            e.stopPropagation();
        }, { passive: true });

        wizardView.addEventListener('touchend', (e) => {
            e.stopPropagation();
            if (e.changedTouches.length === 0) return;
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;

            const diffX = touchEndX - touchStartX;
            const diffY = touchEndY - touchStartY;

            // Trigger step transitions on horizontal swipe if swipe threshold (50px) is met
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
                if (diffX < 0) {
                    goToNextWizardStep();
                } else {
                    goToPrevWizardStep();
                }
            }
        }, { passive: true });

        wizardView.addEventListener('wheel', (e) => {
            e.stopPropagation();
        }, { passive: true });
    }

    // Protect horizontally scrollable Town Hall list from swipe transitions
    const guestThList = document.getElementById('welcome-guest-th-list');
    if (guestThList) {
        guestThList.addEventListener('touchstart', (e) => {
            e.stopPropagation();
        }, { passive: true });
        guestThList.addEventListener('touchend', (e) => {
            e.stopPropagation();
        }, { passive: true });
    }

    if (!isWelcomeSyncListenersInitialized) {
        const welcomeSyncDeviceStartBtn = document.getElementById('welcome-sync-device-start-btn');
        if (welcomeSyncDeviceStartBtn) {
            welcomeSyncDeviceStartBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                cameFromSyncStartBtn = true;
                scrollTargetPage = 4;
                const visualIndex = getVisualIndexFromPage(4);
                const carousel = document.getElementById('welcome-carousel');
                if (carousel) {
                    carousel.scrollTo({ left: visualIndex * (carousel.clientWidth + 32), behavior: 'smooth' });
                } else {
                    logger.warn('[SyncStartBtn] carousel element not found!');
                }

                // Directly expand the paste section and collapse the copy section
                const welcomeSyncDetailsElements = document.querySelectorAll('.welcome-sync-details');
                welcomeSyncDetailsElements.forEach((detailsEl, idx) => {
                    if (idx === 1) {
                        if (detailsEl._welcomeAccordion) {
                            detailsEl._welcomeAccordion.open();
                        } else {
                            detailsEl.open = true;
                        }
                    } else {
                        if (detailsEl._welcomeAccordion) {
                            detailsEl._welcomeAccordion.shrink();
                        } else {
                            detailsEl.open = false;
                        }
                    }
                });

                // Auto-read from clipboard if supported
                if (navigator.clipboard && navigator.clipboard.readText) {
                    try {
                        const clipboardText = await navigator.clipboard.readText();
                        const trimmed = clipboardText.trim();
                        if (isValidUUID(trimmed)) {
                            const welcomeSyncInput = document.getElementById('welcome-sync-input');
                            const welcomeSyncStatus = document.getElementById('welcome-sync-status');
                            if (welcomeSyncInput) {
                                welcomeSyncInput.value = trimmed;
                                welcomeSyncInput.classList.remove('input-error');
                                
                                if (welcomeSyncStatus) {
                                    welcomeSyncStatus.textContent = translate('alerts.uuidDetected') || "User ID detected from clipboard";
                                    welcomeSyncStatus.classList.remove('error');
                                    welcomeSyncStatus.classList.add('success');
                                    welcomeSyncStatus.style.display = 'block';
                                    welcomeSyncStatus.classList.add('show');
                                }
                            }
                        }
                    } catch (err) {
                        console.warn('Clipboard read failed or denied:', err);
                    }
                }
            });
        }

        class WelcomeAccordion {
            constructor(el, group) {
                this.el = el;
                this.group = group;
                this.summary = el.querySelector('.welcome-sync-summary');
                this.content = el.querySelector('.welcome-sync-details-content');
                this.animation = null;
                this.isClosing = false;
                this.isExpanding = false;

                this.summary.addEventListener('click', (e) => this.onClick(e));
            }

            onClick(e) {
                e.preventDefault();
                if (this.isClosing || this.isExpanding) return;

                const isOnlyDefault = state.savedPlayerTags.length === 1 && state.savedPlayerTags[0] === 'DEFAULT0';
                if (isOnlyDefault && this.el.id === 'welcome-link-device-details' && this.el.open) {
                    return;
                }

                if (this.el.open) {
                    const openDetails = Array.from(this.group).filter(d => d.open);
                    if (openDetails.length <= 1) {
                        return;
                    }
                    this.shrink();
                } else {
                    this.open();
                }
            }

            shrink() {
                this.isClosing = true;
                
                const startHeight = `${this.el.offsetHeight}px`;
                const endHeight = `${this.summary.offsetHeight}px`;

                if (this.animation) {
                    this.animation.cancel();
                }

                this.animation = this.el.animate({
                    height: [startHeight, endHeight]
                }, {
                    duration: 220,
                    easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
                });

                this.animation.onfinish = () => {
                    this.el.open = false;
                    this.el.style.height = '';
                    this.animation = null;
                    this.isClosing = false;
                };
                this.animation.oncancel = () => {
                    this.isClosing = false;
                };
            }

            open() {
                this.group.forEach(other => {
                    if (other !== this.el && other.open) {
                        const otherAcc = other._welcomeAccordion;
                        if (otherAcc) {
                            otherAcc.shrink();
                        } else {
                            other.open = false;
                        }
                    }
                });

                this.el.style.height = `${this.el.offsetHeight}px`;
                this.el.open = true;

                window.requestAnimationFrame(() => this.expand());
            }

            expand() {
                this.isExpanding = true;
                const startHeight = `${this.el.offsetHeight}px`;
                const endHeight = `${this.summary.offsetHeight + this.content.offsetHeight}px`;

                if (this.animation) {
                    this.animation.cancel();
                }

                this.animation = this.el.animate({
                    height: [startHeight, endHeight]
                }, {
                    duration: 220,
                    easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
                });

                this.animation.onfinish = () => {
                    this.el.style.height = '';
                    this.animation = null;
                    this.isExpanding = false;

                    // Focus input when manually expanded (only if not scrolling carousel and on page 4)
                    const inputEl = this.el.querySelector('#welcome-sync-input');
                    if (inputEl && scrollTargetPage === null && currentPage === 4) {
                        inputEl.focus();
                    }
                };
                this.animation.oncancel = () => {
                    this.isExpanding = false;
                };
            }
        }

        // Accordion behavior for welcome sync details menus
        const welcomeSyncDetailsElements = document.querySelectorAll('.welcome-sync-details');
        welcomeSyncDetailsElements.forEach(detailsEl => {
            detailsEl._welcomeAccordion = new WelcomeAccordion(detailsEl, welcomeSyncDetailsElements);
        });

        const welcomeSyncUserIdDisplay = document.getElementById('welcome-sync-user-id');
        const welcomeSyncCopyBtn = document.getElementById('welcome-sync-copy-btn');
        const welcomeSyncInput = document.getElementById('welcome-sync-input');
        const welcomeSyncLinkBtn = document.getElementById('welcome-sync-link-btn');
        const welcomeSyncStatus = document.getElementById('welcome-sync-status');

        const handleWelcomeCopySyncCode = async () => {
            const userId = localStorage.getItem('oreCalc_userId');
            if (!userId) return;

            if (!navigator.clipboard || !navigator.clipboard.writeText) {
                await showAlert(translate('alerts.clipboardUnsupported') || "Clipboard operations are not supported on this browser.");
                return;
            }

            try {
                await navigator.clipboard.writeText(userId);
                
                if (welcomeSyncCopyBtn) {
                    welcomeSyncCopyBtn.classList.add('success');
                    const originalText = welcomeSyncCopyBtn.textContent;
                    welcomeSyncCopyBtn.textContent = translate('actions.copied') || 'Copied';
                    setTimeout(() => {
                        welcomeSyncCopyBtn.classList.remove('success');
                        welcomeSyncCopyBtn.textContent = originalText;
                    }, 2000);
                }

                let messageKey = '';
                if (state.uiSettings.cloudSync !== false) {
                    const { triggerCloudSave } = await import('../../utils/cloudSaveHandler.js');
                    const saveSuccess = await triggerCloudSave({ silent: true });
                    messageKey = saveSuccess ? 'alerts.copyAndSaveSuccess' : 'alerts.copySuccessSaveFailed';
                } else {
                    messageKey = 'alerts.copySuccess';
                }
                
                showToast(translate(messageKey) || "User ID copied", 'success');
            } catch (err) {
                console.error('Failed to copy sync code: ', err);
                await showAlert(translate('alerts.copiedFailed') || "Failed to copy text.");
            }
        };

        if (welcomeSyncUserIdDisplay) {
            welcomeSyncUserIdDisplay.addEventListener('click', handleWelcomeCopySyncCode);
        }
        if (welcomeSyncCopyBtn) {
            welcomeSyncCopyBtn.addEventListener('click', handleWelcomeCopySyncCode);
        }

        const updateLinkBtnText = () => {
            if (!welcomeSyncLinkBtn || !welcomeSyncInput) return;
            if (welcomeSyncInput.value.trim() === '') {
                welcomeSyncLinkBtn.textContent = translate('actions.paste') || 'Paste';
            } else {
                welcomeSyncLinkBtn.textContent = translate('actions.link') || 'Link';
            }
        };

        if (welcomeSyncLinkBtn && welcomeSyncInput) {
            welcomeSyncLinkBtn.addEventListener('click', async () => {
                const val = welcomeSyncInput.value.trim();
                if (val === '') {
                    if (!navigator.clipboard || !navigator.clipboard.readText) {
                        await showAlert(translate('alerts.clipboardUnsupported') || "Clipboard operations are not supported on this browser.");
                        return;
                    }
                    try {
                        const text = await navigator.clipboard.readText();
                        welcomeSyncInput.value = text.trim();
                        validateWelcomeInput();
                    } catch (err) {
                        console.error('Failed to read clipboard: ', err);
                        await showAlert(translate('alerts.clipboardPermissionDenied') || "Failed to read from clipboard. Please ensure clipboard permission is granted.");
                    }
                    return;
                }

                if (isValidUUID(val)) {
                    const originalText = welcomeSyncLinkBtn.textContent;
                    try {
                        welcomeSyncLinkBtn.disabled = true;
                        welcomeSyncLinkBtn.textContent = translate('actions.processing') || 'Processing...';
                        
                        const { importUserData } = await import('../../utils/cloudSaveHandler.js');
                        await importUserData(val);
                    } finally {
                        welcomeSyncLinkBtn.disabled = false;
                        welcomeSyncLinkBtn.textContent = originalText;
                    }
                } else {
                    if (welcomeSyncStatus) {
                        welcomeSyncStatus.textContent = translate('alerts.invalidUserId') || "Invalid User ID format";
                        welcomeSyncStatus.classList.remove('success');
                        welcomeSyncStatus.classList.add('error');
                        welcomeSyncStatus.style.display = 'block';
                        welcomeSyncStatus.classList.add('show');
                    }
                    welcomeSyncInput.classList.add('input-error');
                    
                    welcomeSyncInput.classList.remove('shake');
                    void welcomeSyncInput.offsetWidth;
                    welcomeSyncInput.classList.add('shake');
                }
            });
        }

        const validateWelcomeInput = () => {
            if (!welcomeSyncInput) return;
            const val = welcomeSyncInput.value.trim();
            
            updateLinkBtnText();
            
            const submitBtn = document.getElementById('welcome-submit-btn');
            if (submitBtn && cameFromSyncStartBtn) {
                const currentUserId = localStorage.getItem('oreCalc_userId');
                submitBtn.disabled = !(isValidUUID(val) && val !== currentUserId);
            }
            
            if (val === '') {
                if (welcomeSyncStatus) {
                    welcomeSyncStatus.textContent = '';
                    welcomeSyncStatus.style.display = 'none';
                    welcomeSyncStatus.classList.remove('show');
                }
                welcomeSyncInput.classList.remove('input-error');
            } else if (isValidUUID(val)) {
                const currentUserId = localStorage.getItem('oreCalc_userId');
                if (val === currentUserId) {
                    if (welcomeSyncStatus) {
                        welcomeSyncStatus.textContent = translate('alerts.sameUserId') || "Cannot link to your own active User ID.";
                        welcomeSyncStatus.classList.remove('success');
                        welcomeSyncStatus.classList.add('error');
                        welcomeSyncStatus.style.display = 'block';
                        welcomeSyncStatus.classList.add('show');
                    }
                    welcomeSyncInput.classList.add('input-error');
                } else {
                    if (welcomeSyncStatus) {
                        welcomeSyncStatus.textContent = translate('alerts.validUserId') || "User ID is valid";
                        welcomeSyncStatus.classList.remove('error');
                        welcomeSyncStatus.classList.add('success');
                        welcomeSyncStatus.style.display = 'block';
                        welcomeSyncStatus.classList.add('show');
                    }
                    welcomeSyncInput.classList.remove('input-error');
                }
            } else if (val.length < 36) {
                if (welcomeSyncStatus) {
                    welcomeSyncStatus.textContent = translate('alerts.incompleteUserId') || "Incomplete User ID format (must be 36 characters).";
                    welcomeSyncStatus.classList.remove('success');
                    welcomeSyncStatus.classList.add('error');
                    welcomeSyncStatus.style.display = 'block';
                    welcomeSyncStatus.classList.add('show');
                }
                welcomeSyncInput.classList.add('input-error');
            } else {
                if (welcomeSyncStatus) {
                    welcomeSyncStatus.textContent = translate('alerts.invalidUserId') || "Invalid User ID format.";
                    welcomeSyncStatus.classList.remove('success');
                    welcomeSyncStatus.classList.add('error');
                    welcomeSyncStatus.style.display = 'block';
                    welcomeSyncStatus.classList.add('show');
                }
                welcomeSyncInput.classList.add('input-error');
            }
        };

        if (welcomeSyncInput) {
            welcomeSyncInput.addEventListener('input', validateWelcomeInput);
            welcomeSyncInput.addEventListener('paste', () => {
                setTimeout(validateWelcomeInput, 10);
            });
        }

        updateLinkBtnText();

        isWelcomeSyncListenersInitialized = true;
    }
}

function formatClanRole(role) {
    if (!role) return '';
    const key = `roles.${role.toLowerCase()}`;
    const translated = translate(key);
    return translated !== key ? translated : role;
}

function calculateEquipmentProgress(playerData) {
    let commonSpent = { shiny: 0, glowy: 0 };
    let commonTotal = { shiny: 0, glowy: 0 };
    let epicSpent = { shiny: 0, glowy: 0, starry: 0 };
    let epicTotal = { shiny: 0, glowy: 0, starry: 0 };

    const ownedEquip = playerData.ownedEquipment || {};

    for (const heroKey in heroData) {
        const heroInfo = heroData[heroKey];
        for (const equip of heroInfo.equipment) {
            const isEpic = equip.type === 'epic';
            const currentLevel = ownedEquip[equip.name] !== undefined ? ownedEquip[equip.name] : 1;
            const maxLevel = isEpic ? 27 : 18;

            // Spent
            for (let lvl = 2; lvl <= currentLevel; lvl++) {
                if (upgradeCosts[lvl]) {
                    if (isEpic) {
                        epicSpent.shiny += upgradeCosts[lvl].shiny || 0;
                        epicSpent.glowy += upgradeCosts[lvl].glowy || 0;
                        epicSpent.starry += upgradeCosts[lvl].starry || 0;
                    } else {
                        commonSpent.shiny += upgradeCosts[lvl].shiny || 0;
                        commonSpent.glowy += upgradeCosts[lvl].glowy || 0;
                    }
                }
            }

            // Total
            for (let lvl = 2; lvl <= maxLevel; lvl++) {
                if (upgradeCosts[lvl]) {
                    if (isEpic) {
                        epicTotal.shiny += upgradeCosts[lvl].shiny || 0;
                        epicTotal.glowy += upgradeCosts[lvl].glowy || 0;
                        epicTotal.starry += upgradeCosts[lvl].starry || 0;
                    } else {
                        commonTotal.shiny += upgradeCosts[lvl].shiny || 0;
                        commonTotal.glowy += upgradeCosts[lvl].glowy || 0;
                    }
                }
            }
        }
    }

    const commonShinyPct = commonTotal.shiny > 0 ? Math.round((commonSpent.shiny / commonTotal.shiny) * 100) : 0;
    const commonGlowyPct = commonTotal.glowy > 0 ? Math.round((commonSpent.glowy / commonTotal.glowy) * 100) : 0;

    const commonTotalSpent = commonSpent.shiny + commonSpent.glowy;
    const commonTotalRequired = commonTotal.shiny + commonTotal.glowy;
    const commonAvgPct = commonTotalRequired > 0 ? Math.round((commonTotalSpent / commonTotalRequired) * 100) : 0;

    const epicShinyPct = epicTotal.shiny > 0 ? Math.round((epicSpent.shiny / epicTotal.shiny) * 100) : 0;
    const epicGlowyPct = epicTotal.glowy > 0 ? Math.round((epicSpent.glowy / epicTotal.glowy) * 100) : 0;
    const epicStarryPct = epicTotal.starry > 0 ? Math.round((epicSpent.starry / epicTotal.starry) * 100) : 0;

    const epicTotalSpent = epicSpent.shiny + epicSpent.glowy + epicSpent.starry;
    const epicTotalRequired = epicTotal.shiny + epicTotal.glowy + epicTotal.starry;
    const epicAvgPct = epicTotalRequired > 0 ? Math.round((epicTotalSpent / epicTotalRequired) * 100) : 0;

    return {
        common: {
            shiny: commonShinyPct,
            glowy: commonGlowyPct,
            avg: commonAvgPct
        },
        epic: {
            shiny: epicShinyPct,
            glowy: epicGlowyPct,
            starry: epicStarryPct,
            avg: epicAvgPct
        }
    };
}

function renderProfilePreviewCard(playerData) {
    const container = document.getElementById('welcome-profile-preview-container');
    if (!container) return;

    const deleteBtn = document.getElementById('welcome-profile-delete-btn');
    if (deleteBtn) {
        if (!playerData.tag || playerData.tag === 'DEFAULT0') {
            deleteBtn.style.display = 'none';
        } else {
            deleteBtn.style.display = 'flex';
        }
    }

    document.getElementById('welcome-profile-name').textContent = playerData.name || 'Player';
    document.getElementById('welcome-profile-tag').textContent = playerData.tag || '';
    document.getElementById('welcome-profile-th-level').textContent = playerData.townHallLevel || '1';

    const thImage = document.getElementById('welcome-profile-th-image');
    if (thImage) {
        const thLevel = playerData.townHallLevel || 1;
        thImage.src = `assets/th/th${thLevel}.png`;
    }

    const clanSection = document.getElementById('welcome-profile-clan-section');
    const clanBadge = document.getElementById('welcome-profile-clan-badge');
    const clanName = document.getElementById('welcome-profile-clan-name');
    const clanRole = document.getElementById('welcome-profile-clan-role');

    if (playerData.clan && playerData.clan.name) {
        clanName.textContent = playerData.clan.name;
        clanName.removeAttribute('data-i18n');
        if (playerData.clan.badgeUrls && playerData.clan.badgeUrls.small) {
            clanBadge.src = playerData.clan.badgeUrls.small;
            clanBadge.style.display = 'block';
        } else {
            clanBadge.style.display = 'none';
        }
        if (clanRole && playerData.role) {
            clanRole.textContent = `(${formatClanRole(playerData.role)})`;
            clanRole.style.display = 'inline-block';
        } else if (clanRole) {
            clanRole.style.display = 'none';
        }
        if (clanSection) clanSection.style.display = 'flex';
    } else {
        clanName.textContent = translate('welcome.noClan') || 'No Clan';
        clanName.setAttribute('data-i18n', 'welcome.noClan');
        clanBadge.style.display = 'none';
        if (clanRole) clanRole.style.display = 'none';
    }

    // Replace XP level with league icon and details using standard leagueTiers
    const leagueIcon = document.getElementById('welcome-profile-league-icon');
    const leagueDefaultIcon = document.getElementById('welcome-profile-league-default-icon');
    const leagueNameEl = document.getElementById('welcome-profile-league-name');

    const leagueId = parseInt(playerData.leagueTier?.id || 105000000, 10);
    const leagueData = leagueTiers.items.find(l => l.id === leagueId);

    if (leagueData) {
        if (leagueNameEl) {
            const leagueKey = 'leagues.' + leagueData.name.toLowerCase()
                .replace(/\./g, '')
                .replace(/\s(i+)$/i, (match, p1) => p1.toUpperCase())
                .replace(/\s/g, '_');
            
            leagueNameEl.textContent = translate(leagueKey);
            leagueNameEl.dataset.i18n = leagueKey;
            leagueNameEl.title = translate(leagueKey);
        }
        
        const leagueImgUrl = leagueData.iconUrls?.small || '';
        if (leagueImgUrl) {
            if (leagueIcon) {
                leagueIcon.src = leagueImgUrl;
                leagueIcon.style.display = 'block';
            }
            if (leagueDefaultIcon) leagueDefaultIcon.style.display = 'none';
        } else {
            if (leagueIcon) leagueIcon.style.display = 'none';
            if (leagueDefaultIcon) leagueDefaultIcon.style.display = 'block';
        }
    } else {
        if (leagueNameEl) {
            leagueNameEl.textContent = translate('leagues.unranked') || 'Unranked';
            leagueNameEl.dataset.i18n = 'leagues.unranked';
        }
        if (leagueIcon) leagueIcon.style.display = 'none';
        if (leagueDefaultIcon) leagueDefaultIcon.style.display = 'block';
    }

    document.getElementById('welcome-profile-trophies').textContent = playerData.trophies || '0';

    const maxedEquipEl = document.getElementById('welcome-profile-maxed-equip');
    if (maxedEquipEl) {
        let maxedCount = 0;
        let totalCount = 0;
        const ownedEquip = playerData.ownedEquipment || {};
        for (const heroKey in heroData) {
            for (const equip of heroData[heroKey].equipment) {
                totalCount++;
                const isEpic = equip.type === 'epic';
                const maxLevel = isEpic ? 27 : 18;
                const currentLevel = ownedEquip[equip.name];
                if (currentLevel !== undefined && currentLevel >= maxLevel) {
                    maxedCount++;
                }
            }
        }
        maxedEquipEl.textContent = `${maxedCount}/${totalCount}`;
    }

    // Update progress bars
    const progress = calculateEquipmentProgress(playerData);

    document.getElementById('welcome-profile-common-avg').textContent = `${progress.common.avg}%`;
    document.getElementById('welcome-profile-common-shiny-pct').textContent = `${progress.common.shiny}%`;
    document.getElementById('welcome-profile-common-shiny-fill').style.width = `${progress.common.shiny}%`;
    document.getElementById('welcome-profile-common-glowy-pct').textContent = `${progress.common.glowy}%`;
    document.getElementById('welcome-profile-common-glowy-fill').style.width = `${progress.common.glowy}%`;

    document.getElementById('welcome-profile-epic-avg').textContent = `${progress.epic.avg}%`;
    document.getElementById('welcome-profile-epic-shiny-pct').textContent = `${progress.epic.shiny}%`;
    document.getElementById('welcome-profile-epic-shiny-fill').style.width = `${progress.epic.shiny}%`;
    document.getElementById('welcome-profile-epic-glowy-pct').textContent = `${progress.epic.glowy}%`;
    document.getElementById('welcome-profile-epic-glowy-fill').style.width = `${progress.epic.glowy}%`;
    document.getElementById('welcome-profile-epic-starry-pct').textContent = `${progress.epic.starry}%`;
    document.getElementById('welcome-profile-epic-starry-fill').style.width = `${progress.epic.starry}%`;

    // Render horizontal heroes & equipment scroll list
    const equipmentListContainer = document.getElementById('welcome-profile-heroes-equipment-list');
    if (equipmentListContainer) {
        equipmentListContainer.innerHTML = '';
        
        const scrollContainer = document.createElement('div');
        scrollContainer.className = 'welcome-hero-scroll-container';

        const ownedEquip = playerData.ownedEquipment || {};
        const ownedHeroes = playerData.ownedHeroes || {};

        for (const heroKey in heroData) {
            const heroInfo = heroData[heroKey];
            if (!heroInfo.equipment || heroInfo.equipment.length === 0) continue;

            let heroLevel = 0;
            let heroMaxLevel = 0;

            if (ownedHeroes && typeof ownedHeroes === 'object' && !Array.isArray(ownedHeroes)) {
                const heroObj = ownedHeroes[heroInfo.name];
                if (heroObj) {
                    heroLevel = heroObj.level || 0;
                    heroMaxLevel = heroObj.maxLevel || 0;
                }
            } else if (Array.isArray(ownedHeroes)) {
                const found = ownedHeroes.find(h => h && (h === heroInfo.name || h.name === heroInfo.name));
                if (found) {
                    heroLevel = typeof found === 'object' ? (found.level || 0) : 1;
                    heroMaxLevel = typeof found === 'object' ? (found.maxLevel || 0) : 0;
                }
            }

            const isHeroMax = heroLevel > 0 && heroLevel >= heroMaxLevel;

            const heroGroup = document.createElement('div');
            heroGroup.className = 'welcome-hero-group';
            if (isHeroMax) {
                heroGroup.classList.add('max-level');
            }

            // Hero Badge (Sticky Left)
            const heroBadge = document.createElement('div');
            heroBadge.className = 'welcome-hero-badge';
            if (isHeroMax) {
                heroBadge.classList.add('max-level');
            }

            const heroImg = document.createElement('orecalc-assets-image');
            heroImg.setAttribute('class', 'welcome-hero-img');
            heroImg.setAttribute('src', heroInfo.image);
            heroImg.setAttribute('alt', heroInfo.name);
            heroImg.setAttribute('size', 'thumbnail');
            heroBadge.appendChild(heroImg);

            const heroName = document.createElement('span');
            heroName.className = 'welcome-hero-name';
            heroName.textContent = heroInfo.name;
            heroBadge.appendChild(heroName);

            // Add Hero Level
            const heroLevelEl = document.createElement('span');
            heroLevelEl.className = 'welcome-hero-level';
            heroLevelEl.textContent = heroLevel > 0 ? `Lvl ${heroLevel}` : 'Locked';
            if (isHeroMax) {
                heroLevelEl.classList.add('max-level-text');
            }
            heroBadge.appendChild(heroLevelEl);

            heroGroup.appendChild(heroBadge);

            // Equipment List
            const equipList = document.createElement('div');
            equipList.className = 'welcome-hero-equip-list';

             const ownedEquipItems = [];
             const lockedEquipItems = [];

             heroInfo.equipment.forEach(equip => {
                const hasEquip = ownedEquip[equip.name] !== undefined;
                const currentLevel = hasEquip ? ownedEquip[equip.name] : 1;
                const maxLevel = equip.type === 'epic' ? 27 : 18;
                const isMax = hasEquip && currentLevel >= maxLevel;

                const equipItem = document.createElement('div');
                equipItem.className = 'welcome-equip-item';
                if (!hasEquip) {
                    equipItem.classList.add('locked');
                } else if (isMax) {
                    equipItem.classList.add('max-level');
                }

                // Image Container
                const imgContainer = document.createElement('div');
                imgContainer.className = 'equipment-image-container';

                const equipImg = document.createElement('orecalc-assets-image');
                equipImg.setAttribute('src', equip.image);
                equipImg.setAttribute('alt', equip.name);
                equipImg.setAttribute('class', 'equipment-image');
                equipImg.setAttribute('size', 'thumbnail');
                imgContainer.appendChild(equipImg);

                if (hasEquip) {
                    const levelBox = document.createElement('div');
                    levelBox.className = 'equipment-level-box';
                    if (isMax) {
                        levelBox.classList.add('max-level');
                    }
                    levelBox.textContent = currentLevel;
                    imgContainer.appendChild(levelBox);
                }

                equipItem.appendChild(imgContainer);

                // Name tag
                const equipName = document.createElement('span');
                equipName.className = 'welcome-equip-name';
                equipName.textContent = equip.name;
                equipName.title = equip.name;
                equipItem.appendChild(equipName);

                if (hasEquip) {
                    ownedEquipItems.push(equipItem);
                } else {
                    lockedEquipItems.push(equipItem);
                }
            });

            // Append owned items first, then locked items
            ownedEquipItems.forEach(item => equipList.appendChild(item));
            lockedEquipItems.forEach(item => equipList.appendChild(item));

            heroGroup.appendChild(equipList);
            scrollContainer.appendChild(heroGroup);
        }

        // Prevent scroll/swipe gestures on the horizontal equipment list from bubbling to the parent carousel
        scrollContainer.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
        scrollContainer.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });
        scrollContainer.addEventListener('touchend', (e) => e.stopPropagation(), { passive: true });
        scrollContainer.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });

        equipmentListContainer.appendChild(scrollContainer);
    }

    container.style.display = 'block';

    const infoTabBtn = document.getElementById('welcome-tab-btn-info');
    if (infoTabBtn) infoTabBtn.click();

    requestAnimationFrame(() => {
        updatePreviewArrowPosition();
        measureHeaderHeight();
    });
}

export function updatePreviewArrowPosition() {
    // 1. Page 2 (Profile Preview) Arrow
    const arrow = document.getElementById('welcome-profile-anchor-arrow');
    const previewContainer = document.getElementById('welcome-profile-preview-container');
    if (arrow && previewContainer) {
        if (previewContainer.style.display === 'none') {
            arrow.style.opacity = '0';
        } else {
            const activeCard = document.querySelector('#welcome-profiles-list .welcome-profile-card-compact.active');
            if (!activeCard) {
                arrow.style.opacity = '0';
            } else {
                const cardRect = activeCard.getBoundingClientRect();
                const previewRect = previewContainer.getBoundingClientRect();

                if (cardRect.width === 0 || previewRect.width === 0) {
                    arrow.style.opacity = '0';
                } else {
                    const list = document.getElementById('welcome-profiles-list');
                    let visible = true;
                    if (list) {
                        const listRect = list.getBoundingClientRect();
                        if (cardRect.right < listRect.left || cardRect.left > listRect.right) {
                            visible = false;
                        }
                    }
                    if (!visible) {
                        arrow.style.opacity = '0';
                    } else {
                        const cardCenter = cardRect.left + (cardRect.width / 2);
                        let arrowLeft = cardCenter - previewRect.left;

                        const arrowHalfWidth = 8;
                        const minLeft = arrowHalfWidth + 16;
                        const maxLeft = previewRect.width - arrowHalfWidth - 16;
                        arrowLeft = Math.max(minLeft, Math.min(arrowLeft, maxLeft));

                        arrow.style.opacity = '1';
                        arrow.style.left = `${arrowLeft}px`;
                    }
                }
            }
        }
    }

    // 2. Page 3 (Quick Settings Checklist) Arrow
    const qsArrow = document.getElementById('welcome-qs-anchor-arrow');
    const qsContainer = document.getElementById('welcome-quick-settings-container');
    if (qsArrow && qsContainer) {
        if (qsContainer.style.display === 'none' || window.getComputedStyle(qsContainer).display === 'none') {
            qsArrow.style.opacity = '0';
        } else {
            const activeCard = document.querySelector('#welcome-qs-profiles-list .welcome-profile-card-compact.active');
            const listContainer = document.getElementById('welcome-qs-profiles-list-container');
            if (!activeCard || (listContainer && listContainer.style.display === 'none')) {
                qsArrow.style.opacity = '0';
            } else {
                const cardRect = activeCard.getBoundingClientRect();
                const qsRect = qsContainer.getBoundingClientRect();

                if (cardRect.width === 0 || qsRect.width === 0) {
                    qsArrow.style.opacity = '0';
                } else {
                    const list = document.getElementById('welcome-qs-profiles-list');
                    let visible = true;
                    if (list) {
                        const listRect = list.getBoundingClientRect();
                        if (cardRect.right < listRect.left || cardRect.left > listRect.right) {
                            visible = false;
                        }
                    }
                    if (!visible) {
                        qsArrow.style.opacity = '0';
                    } else {
                        const cardCenter = cardRect.left + (cardRect.width / 2);
                        let arrowLeft = cardCenter - qsRect.left;

                        const arrowHalfWidth = 8;
                        const minLeft = arrowHalfWidth + 16;
                        const maxLeft = qsRect.width - arrowHalfWidth - 16;
                        arrowLeft = Math.max(minLeft, Math.min(arrowLeft, maxLeft));

                        qsArrow.style.opacity = '1';
                        qsArrow.style.left = `${arrowLeft}px`;
                    }
                }
            }
        }
    }
}



function initializeGuestSetup() {
    const thList = document.getElementById('welcome-guest-th-list');
    const leagueSelect = document.getElementById('welcome-guest-league-select');
    const leagueIcon = document.getElementById('welcome-guest-league-icon');

    if (!thList || !leagueSelect || !leagueIcon) return;

    // 1. Populate Town Hall Badges
    thList.innerHTML = '';
    for (let th = 1; th <= 18; th++) {
        const thItem = document.createElement('div');
        thItem.className = 'th-badge-item';
        if (th === selectedTH) {
            thItem.classList.add('active');
        }
        thItem.dataset.th = th;

        const img = document.createElement('orecalc-assets-image');
        img.setAttribute('src', `assets/th/th${th}.png`);
        img.setAttribute('alt', `TH ${th}`);
        img.setAttribute('class', 'th-badge-img');
        img.setAttribute('size', 'thumbnail');

        const label = document.createElement('span');
        label.textContent = `TH ${th}`;
        label.className = 'th-badge-label';

        thItem.appendChild(img);
        thItem.appendChild(label);

        thItem.addEventListener('click', () => {
            if (selectedTH === th) return;
            thList.querySelectorAll('.th-badge-item').forEach(item => item.classList.remove('active'));
            thItem.classList.add('active');
            selectedTH = th;

            const guestProfile = state.allPlayersData['DEFAULT0'];
            if (guestProfile) {
                handleStateUpdate(() => {
                    const target = guestProfile.playerProfile || guestProfile;
                    target.townHallLevel = th;
                    if (state.playerProfile && state.savedPlayerTags[0] === 'DEFAULT0') {
                        state.playerProfile.townHallLevel = th;
                    }
                }, true);
            }
            syncWelcomeQuickSettings('DEFAULT0');

            // Update and filter league select options immediately
            updateGuestLeagueDropdown();

            // Update the header Town Hall image instantly
            const thImgEl = document.getElementById('welcome-wizard-th-img');
            if (thImgEl) {
                thImgEl.src = `assets/th/th${th}.png`;
                thImgEl.alt = `TH ${th}`;
            }
        });

        thList.appendChild(thItem);
    }

    // Scroll the default/active Town Hall badge into view horizontally
    const activeBadge = thList.querySelector('.th-badge-item.active');
    if (activeBadge) {
        requestAnimationFrame(() => {
            activeBadge.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
        });
    }

    // 2. Add event listener to League Select change
    const handleLeagueChange = () => {
        const leagueId = parseInt(leagueSelect.value, 10);
        selectedLeague = leagueId;

        const guestProfile = state.allPlayersData['DEFAULT0'];
        if (guestProfile) {
            handleStateUpdate(() => {
                const target = guestProfile.playerProfile || guestProfile;
                target.leagueTier = { id: leagueId };
                if (state.playerProfile && state.savedPlayerTags[0] === 'DEFAULT0') {
                    state.playerProfile.leagueTier = { id: leagueId };
                }
            }, true);
        }

        const leagueData = leagueTiers.items.find(l => l.id === leagueId);
        if (leagueData && leagueData.iconUrls?.small) {
            leagueIcon.src = leagueData.iconUrls.small;
        }
    };

    leagueSelect.removeEventListener('change', handleLeagueChange);
    leagueSelect.addEventListener('change', handleLeagueChange);

    // Initial population of the dropdown
    updateGuestLeagueDropdown();
}

function updateGuestLeagueDropdown() {
    const leagueSelect = document.getElementById('welcome-guest-league-select');
    const leagueIcon = document.getElementById('welcome-guest-league-icon');
    if (!leagueSelect || !leagueIcon) return;

    const currentTH = selectedTH;
    const floorLeagueId = townHallLeagueFloors[currentTH] || 0;
    const previouslySelected = parseInt(leagueSelect.value || selectedLeague, 10);

    leagueSelect.innerHTML = '';

    // Always add Unranked
    const unrankedLeague = leagueTiers.items.find(l => l.id === 105000000);
    if (unrankedLeague) {
        const option = document.createElement('option');
        option.value = unrankedLeague.id;
        const translationKey = 'leagues.' + unrankedLeague.name.toLowerCase()
            .replace(/\./g, '')
            .replace(/\s(i+)$/i, (match, p1) => p1.toUpperCase())
            .replace(/\s/g, '_');
        option.textContent = translate(translationKey);
        leagueSelect.appendChild(option);
    }

    // Add other leagues if they are >= floorLeagueId
    leagueTiers.items.forEach(league => {
        if (league.id !== 105000000) {
            if (floorLeagueId === 0 || league.id >= floorLeagueId) {
                const option = document.createElement('option');
                option.value = league.id;
                const translationKey = 'leagues.' + league.name.toLowerCase()
                    .replace(/\./g, '')
                    .replace(/\s(i+)$/i, (match, p1) => p1.toUpperCase())
                    .replace(/\s/g, '_');
                option.textContent = translate(translationKey);
                leagueSelect.appendChild(option);
            }
        }
    });

    // Restore selected value if still valid, otherwise fallback
    let valueToSet = previouslySelected;
    const optionsArray = Array.from(leagueSelect.options);
    const hasPrevious = optionsArray.some(opt => parseInt(opt.value, 10) === previouslySelected);
    if (!hasPrevious) {
        // Fallback: use the floor league or Unranked
        valueToSet = floorLeagueId !== 0 ? floorLeagueId : 105000000;
    }
    
    leagueSelect.value = valueToSet;
    selectedLeague = valueToSet;

    // Update league icon preview
    const leagueData = leagueTiers.items.find(l => l.id === valueToSet);
    if (leagueData && leagueData.iconUrls?.small) {
        leagueIcon.src = leagueData.iconUrls.small;
    }
}

function generateGuestPlayerData(thLevel, leagueId) {
    const playerHeroes = {};
    const playerEquipment = {};

    const heroUnlockLevels = {
        "Barbarian King": 7,
        "Archer Queen": 8,
        "Minion Prince": 9,
        "Grand Warden": 11,
        "Royal Champion": 13,
        "Dragon Duke": 15
    };

    for (const heroKey in heroData) {
        const hero = heroData[heroKey];
        const unlockTH = heroUnlockLevels[hero.name] || 1;
        if (thLevel >= unlockTH) {
            playerHeroes[hero.name] = {
                level: 1,
                maxLevel: 95 // arbitrary
            };

            // Only unlock common equipment at level 1 for this hero
            hero.equipment.forEach(eq => {
                if (eq.type === 'common') {
                    playerEquipment[eq.name] = 1;
                }
            });
        }
    }

    return {
        name: translate('player.guest'),
        tag: "DEFAULT0",
        townHallLevel: thLevel,
        clan: null,
        role: null,
        leagueTier: { id: leagueId },
        trophies: 0,
        warStars: 0,
        ownedHeroes: playerHeroes,
        ownedEquipment: playerEquipment
    };
}

function initializeGuestHeroesState(guestPlayerState) {
    if (!guestPlayerState || !guestPlayerState.playerProfile) return;
    const thLevel = guestPlayerState.playerProfile.townHallLevel;
    const heroUnlockLevels = {
        "Barbarian King": 7,
        "Archer Queen": 8,
        "Minion Prince": 9,
        "Grand Warden": 11,
        "Royal Champion": 13,
        "Dragon Duke": 15
    };

    for (const heroKey in heroData) {
        const hero = heroData[heroKey];
        const unlockTH = heroUnlockLevels[hero.name] || 1;
        const isUnlocked = thLevel >= unlockTH;
        const heroName = hero.name;

        if (!guestPlayerState.heroes[heroName]) {
            guestPlayerState.heroes[heroName] = { enabled: isUnlocked, equipment: {} };
        }
        const heroState = guestPlayerState.heroes[heroName];
        heroState.enabled = isUnlocked;

        hero.equipment.forEach(eq => {
            const equipName = eq.name;
            const isCommon = eq.type === 'common';
            const shouldBeChecked = isUnlocked && isCommon;
            if (!heroState.equipment[equipName]) {
                heroState.equipment[equipName] = { 
                    level: 1, 
                    checked: shouldBeChecked 
                };
            } else {
                if (!isUnlocked) {
                    heroState.equipment[equipName].checked = false;
                }
            }
        });
    }
}

function applyChecklistToProfile(playerObj) {
    if (!playerObj) return;

    // 1. Stored ores
    if (!playerObj.storedOres) playerObj.storedOres = {};
    playerObj.storedOres.shiny = tempStoredShiny;
    playerObj.storedOres.glowy = tempStoredGlowy;
    playerObj.storedOres.starry = tempStoredStarry;

    // 2. Raid Medal Trader
    if (!playerObj.income) playerObj.income = {};
    if (!playerObj.income.raidMedals) playerObj.income.raidMedals = { packs: {} };
    if (!playerObj.income.raidMedals.packs) playerObj.income.raidMedals.packs = {};

    playerObj.income.raidMedals.earned = tempRaidMedalsBuy ? tempRaidMedalsEarned : 0;
    if (tempRaidMedalsBuy) {
        playerObj.income.raidMedals.packs.shiny = tempRaidMedalsShiny;
        playerObj.income.raidMedals.packs.glowy = tempRaidMedalsGlowy;
        playerObj.income.raidMedals.packs.starry = tempRaidMedalsStarry;
    } else {
        playerObj.income.raidMedals.packs = {};
    }

    if (!playerObj.income.gems) playerObj.income.gems = { packs: {} };
    if (!playerObj.income.gems.packs) playerObj.income.gems.packs = {};
    if (tempGemsBuy) {
        playerObj.income.gems.packs.shiny = tempGemsShiny;
        playerObj.income.gems.packs.glowy = tempGemsGlowy;
        playerObj.income.gems.packs.starry = tempGemsStarry;
    } else {
        playerObj.income.gems.packs = {};
    }

    // 3. Shop Offers
    if (!playerObj.income.shopOffers) playerObj.income.shopOffers = {};
    const th = playerObj.playerProfile?.townHallLevel || playerObj.townHallLevel || 16;
    const thLevel = parseInt(th, 10);
    const bestSetKey = getBestMatchShopOfferSet(thLevel);
    const bestSetNum = parseInt(bestSetKey, 10);
    playerObj.income.shopOffers.selectedSet = tempShopOffersBuy ? bestSetNum : 0;
    
    if (tempShopOffersBuy) {
        if (!playerObj.income.shopOffers[bestSetNum]) playerObj.income.shopOffers[bestSetNum] = {};
        const setOffers = shopOfferData[bestSetKey] || {};
        Object.keys(setOffers).forEach(offerId => {
            if (offerId !== 'townHallLevel') {
                const count = tempShopOffersPurchases[offerId] || 0;
                if (count > 0) {
                    playerObj.income.shopOffers[bestSetNum][offerId] = count;
                } else {
                    delete playerObj.income.shopOffers[bestSetNum][offerId];
                }
            }
        });
    } else {
        playerObj.income.shopOffers[bestSetNum] = {};
    }

    // Currency Selection
    if (!playerObj.currency) {
        playerObj.currency = { code: tempCurrencyCode, globalPricing: {} };
    } else {
        playerObj.currency.code = tempCurrencyCode;
    }
    state.uiSettings.currency = { code: tempCurrencyCode };

    // 4. Clan War
    if (!playerObj.income.clanWar) playerObj.income.clanWar = { oresPerAttack: {} };
    if (!playerObj.income.clanWar.oresPerAttack) playerObj.income.clanWar.oresPerAttack = {};
    playerObj.income.clanWar.warsPerMonth = tempClanWars ? tempClanWarsCount : 0;
    playerObj.income.clanWar.winRate = tempClanWarsWinrate;
    playerObj.income.clanWar.drawRate = tempClanWarsDrawrate;

    if (tempClanWars) {
        const checkTH = Math.max(8, Math.min(16, thLevel));
        if (!playerObj.income.clanWar.oresPerAttack.shiny || playerObj.income.clanWar.oresPerAttack.shiny === 0) {
            playerObj.income.clanWar.oresPerAttack.shiny = warOreTownHallValues.shiny[checkTH] || 0;
        }
        if (!playerObj.income.clanWar.oresPerAttack.glowy || playerObj.income.clanWar.oresPerAttack.glowy === 0) {
            playerObj.income.clanWar.oresPerAttack.glowy = warOreTownHallValues.glowy[checkTH] || 0;
        }
        if (!playerObj.income.clanWar.oresPerAttack.starry || playerObj.income.clanWar.oresPerAttack.starry === 0) {
            playerObj.income.clanWar.oresPerAttack.starry = warOreTownHallValues.starry[checkTH] || 0;
        }
    }

    // 4.5. CWL
    if (!playerObj.income.cwl) playerObj.income.cwl = { oresPerAttack: {} };
    if (!playerObj.income.cwl.oresPerAttack) playerObj.income.cwl.oresPerAttack = {};
    playerObj.income.cwl.hitsPerSeason = tempCwl ? tempCwlHits : 0;
    playerObj.income.cwl.winRate = tempCwlWinrate;
    playerObj.income.cwl.drawRate = tempCwlDrawrate;

    if (tempCwl) {
        const checkTH = Math.max(8, Math.min(16, thLevel));
        if (!playerObj.income.cwl.oresPerAttack.shiny || playerObj.income.cwl.oresPerAttack.shiny === 0) {
            playerObj.income.cwl.oresPerAttack.shiny = warOreTownHallValues.shiny[checkTH] || 0;
        }
        if (!playerObj.income.cwl.oresPerAttack.glowy || playerObj.income.cwl.oresPerAttack.glowy === 0) {
            playerObj.income.cwl.oresPerAttack.glowy = warOreTownHallValues.glowy[checkTH] || 0;
        }
        if (!playerObj.income.cwl.oresPerAttack.starry || playerObj.income.cwl.oresPerAttack.starry === 0) {
            playerObj.income.cwl.oresPerAttack.starry = warOreTownHallValues.starry[checkTH] || 0;
        }
    }

    // 5. Gold Pass
    if (!playerObj.income.prospector) playerObj.income.prospector = { fromOre: 'shiny', toOre: 'glowy' };
    playerObj.income.prospector.goldPass = tempGoldPass;

    // 5.5. Event Pass & Event Trader
    if (!playerObj.income.eventPass) playerObj.income.eventPass = {};
    playerObj.income.eventPass.eventPass = tempEventPassBuy;
    playerObj.income.eventPass.includeEquipment = tempEventIncludeEquipment;
    playerObj.income.eventPass.bonusTrackMedals = tempEventBonusMedals;
    playerObj.income.eventPass.purchasedMedals = tempEventPurchasedMedals;

    if (!playerObj.income.eventTrader) playerObj.income.eventTrader = { packs: {} };
    if (!playerObj.income.eventTrader.packs) playerObj.income.eventTrader.packs = {};
    if (tempEventTraderBuy) {
        playerObj.income.eventTrader.packs.shiny = tempEventTraderShiny;
        playerObj.income.eventTrader.packs.glowy = tempEventTraderGlowy;
        playerObj.income.eventTrader.packs.starry = tempEventTraderStarry;
    } else {
        playerObj.income.eventTrader.packs = {};
    }

    // 6. Cloud Sync (Global UI setting)
    state.uiSettings.cloudSync = tempCloudSync;
}

function createCompactProfileCard(tag, activeTag, upd, err, prefix = 'welcome-profile-') {
    const playerObj = state.allPlayersData[tag];
    const isGuest = (tag === 'DEFAULT0');
    const name = isGuest ? (translate('player.guest') || 'Guest') : (playerObj?.playerProfile?.name || playerObj?.playerData?.name || tag);
    const thLevel = playerObj?.playerProfile?.townHallLevel || playerObj?.townHallLevel || playerObj?.playerData?.townHallLevel || 1;

    const card = document.createElement('div');
    card.className = 'welcome-profile-card-compact';
    if (tag === activeTag) {
        card.classList.add('active');
    }
    card.dataset.tag = tag;


    // Create TH badge inside compact card
    const thImg = document.createElement('orecalc-assets-image');
    thImg.setAttribute('class', 'welcome-profile-card-th-img');
    thImg.setAttribute('src', `assets/th/th${thLevel}.png`);
    thImg.setAttribute('alt', `TH ${thLevel}`);
    thImg.setAttribute('size', 'thumbnail');

    // Create Text details container
    const details = document.createElement('div');
    details.className = 'welcome-profile-card-details';

    const nameEl = document.createElement('span');
    nameEl.className = 'welcome-profile-card-name';
    nameEl.textContent = name;

    const tagEl = document.createElement('span');
    tagEl.className = 'welcome-profile-card-tag';
    tagEl.textContent = isGuest ? '' : `#${tag}`;

    details.appendChild(nameEl);
    details.appendChild(tagEl);

    // Status indicator
    const statusContainer = document.createElement('div');
    statusContainer.className = 'welcome-profile-card-status';

    if (upd[tag]) {
        statusContainer.innerHTML = `<span class="status-icon loading-spinner"></span><span class="loading-countdown"></span>`;
    } else if (err[tag]) {
        statusContainer.innerHTML = `
            <span class="status-icon error-icon" title="${err[tag]}">
                ${getSVG('sync-problem', '', 16, 16, 'var(--color-danger)')}
            </span>
        `;
    } else if (successProfiles[tag] === true) {
        statusContainer.innerHTML = `
            <span class="status-icon success-icon" title="${translate('welcome.syncSuccess') || 'Sync Success'}">
                ${getSVG('sync', '', 16, 16, 'var(--color-success)')}
            </span>
        `;
    } else {
        statusContainer.innerHTML = `
            <span class="status-icon error-icon" title="${translate('welcome.syncRequired') || 'Sync Required'}">
                ${getSVG('sync-problem', '', 16, 16, 'var(--color-danger)')}
            </span>
        `;
    }

    card.appendChild(thImg);
    card.appendChild(details);
    card.appendChild(statusContainer);

    card.addEventListener('click', () => {
        // Safely switch the active player in global state and localStorage
        switchActivePlayer(tag);

        // Re-render to update the active class highlight
        renderWelcomeProfilesList(updatingProfiles, errorProfiles, true);

        // After re-render, scroll the freshly created card into view horizontally
        requestAnimationFrame(() => {
            const freshCard = document.querySelector(`.welcome-profile-card-compact[data-tag="${tag}"]`);
            if (freshCard) freshCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        });

        // Render detailed preview card
        const activePlayer = state.allPlayersData[tag];
        if (activePlayer && (activePlayer.playerProfile || activePlayer.playerData)) {
            renderProfilePreviewCard(activePlayer.playerProfile || activePlayer.playerData);
            isProfileLoaded = true;
        } else {
            const previewContainer = document.getElementById('welcome-profile-preview-container');
            if (previewContainer) previewContainer.style.display = 'none';
            isProfileLoaded = false;
        }

        // Sync buttons
        updateWelcomePage2Buttons();

        // Sync quick settings switches to match the selected profile
        syncWelcomeQuickSettings(tag);
    });

    return card;
}

export function renderWelcomeProfilesList(upd = updatingProfiles, err = errorProfiles, animate = false) {
    const container = document.getElementById('welcome-profiles-list-container');
    const list = document.getElementById('welcome-profiles-list');
    const qsContainer = document.getElementById('welcome-qs-profiles-list-container');
    const qsList = document.getElementById('welcome-qs-profiles-list');

    if (welcomeProfilesOrder.length === 0 && state.savedPlayerTags.length > 0) {
        welcomeProfilesOrder = [...state.savedPlayerTags];
    }

    // Use welcomeProfilesOrder (static order captured on load / addition) for rendering
    // Defensively filter for tags that are still present in state.savedPlayerTags
    const tags = welcomeProfilesOrder.filter(tag => tag !== 'DEFAULT0' && state.savedPlayerTags.includes(tag));
    
    // For quick settings checklist, keep guest (DEFAULT0) first if present
    const qsTagsRaw = [...welcomeProfilesOrder].filter(tag => state.savedPlayerTags.includes(tag));
    const hasDefault = qsTagsRaw.includes('DEFAULT0');
    const filteredQsTags = qsTagsRaw.filter(tag => tag !== 'DEFAULT0');
    const qsTags = hasDefault ? ['DEFAULT0', ...filteredQsTags] : filteredQsTags;

    const updateDOM = () => {
        let activeTag = state.savedPlayerTags[0];
        if (tags.length > 0 && (!activeTag || activeTag === 'DEFAULT0' || !tags.includes(activeTag))) {
            activeTag = tags[0];
            switchActivePlayer(activeTag);
        }

        if (tags.length === 0) {
            if (container) container.style.display = 'none';
            const previewContainer = document.getElementById('welcome-profile-preview-container');
            if (previewContainer) previewContainer.style.display = 'none';
            isProfileLoaded = false;
        } else {
            if (container) container.style.display = 'block';
            if (list) {
                list.innerHTML = '';
                tags.forEach(tag => {
                    const card = createCompactProfileCard(tag, activeTag, upd, err, 'welcome-profile-');
                    list.appendChild(card);
                });
            }
        }

        if (qsTags.length === 0) {
            if (qsContainer) qsContainer.style.display = 'none';
        } else {
            if (qsContainer) qsContainer.style.display = 'block';
            if (qsList) {
                qsList.innerHTML = '';
                qsTags.forEach(tag => {
                    const card = createCompactProfileCard(tag, activeTag, upd, err, 'welcome-qs-profile-');
                    qsList.appendChild(card);
                });
            }
        }

        // Make sure the active tag is loaded and previewed
        if (activeTag) {
            const activePlayer = state.allPlayersData[activeTag];
            if (activePlayer && (activePlayer.playerProfile || activePlayer.playerData)) {
                renderProfilePreviewCard(activePlayer.playerProfile || activePlayer.playerData);
                isProfileLoaded = true;
            }
        } else {
            const previewContainer = document.getElementById('welcome-profile-preview-container');
            if (previewContainer) previewContainer.style.display = 'none';
            isProfileLoaded = false;
        }

        // Sync switches to active profile
        syncWelcomeQuickSettings(activeTag);

        // Update arrow position immediately
        updatePreviewArrowPosition();
    };

    updateDOM();
    renderVerticalProfilesList();
    updateSubmitButtonText();
    updateLoadProfileButtonText();
    updateContinueButtonDisabledState();
    updateWelcomeContinueButtonText(currentPage);
    updateHeaderSkipButtonVisibility();
}

function getBestMatchShopOfferSet(thLevel) {
    let bestMatchSet = '0';
    let closestTh = -1;
    for (const setKey in shopOfferData) {
        const set = shopOfferData[setKey];
        if (set.townHallLevel !== undefined && set.townHallLevel <= thLevel && set.townHallLevel > closestTh) {
            closestTh = set.townHallLevel;
            bestMatchSet = setKey;
        }
    }
    return bestMatchSet;
}

function renderWelcomeShopOffers(thLevel, purchasedOffers) {
    const container = document.getElementById('welcome-shop-offers-inputs-container');
    if (!container) return;
    container.innerHTML = '';

    const bestSetKey = getBestMatchShopOfferSet(thLevel);
    const setOffers = shopOfferData[bestSetKey];
    if (!setOffers || bestSetKey === '0') {
        const noOffersMsg = document.createElement('div');
        noOffersMsg.style.fontSize = '12px';
        noOffersMsg.style.color = 'var(--text-secondary)';
        noOffersMsg.textContent = 'No offers available for this Town Hall level.';
        container.appendChild(noOffersMsg);
        return;
    }

    const order = { 'shiny_large': 1, 'glowy': 2, 'starry': 3, 'shiny_small': 4 };

    Object.entries(setOffers)
        .filter(([id]) => id !== 'townHallLevel')
        .sort(([idA], [idB]) => (order[idA] || 99) - (order[idB] || 99))
        .forEach(([id, data]) => {
            const row = document.createElement('div');
            row.className = 'subpanel-row';
            row.style.display = 'grid';
            row.style.gridTemplateColumns = '2fr 1fr 1fr';
            row.style.alignItems = 'center';
            row.style.gap = '12px';
            row.style.background = 'color-mix(in srgb, var(--bg-surface-primary) 15%, transparent)';
            row.style.padding = '6px 10px';
            row.style.borderRadius = '8px';
            row.style.border = '1px solid color-mix(in srgb, var(--border-primary) 30%, transparent)';

            const oreType = data.shiny ? 'shiny' : data.glowy ? 'glowy' : 'starry';
            const oreValue = data.shiny || data.glowy || data.starry;

            // Column 1: Cost display
            const costDisplay = document.createElement('div');
            costDisplay.style.display = 'flex';
            costDisplay.style.alignItems = 'center';
            costDisplay.style.justifyContent = 'center';
            costDisplay.style.gap = '6px';
            costDisplay.title = 'Offer Price';

            const priceSpan = document.createElement('span');
            priceSpan.style.fontSize = '12px';
            priceSpan.style.color = 'var(--text-secondary)';
            priceSpan.style.fontWeight = '500';

            const price = getPriceForTier(data.priceTier);
            const symbol = getCurrencySymbol();
            priceSpan.textContent = `${symbol}${price.toFixed(2)}`;

            costDisplay.appendChild(priceSpan);

            if (oreType === 'starry') {
                const badge = document.createElement('span');
                badge.className = 'recommended-badge ore-row-badge';
                badge.innerHTML = '<orecalc-assets-svg name="thumbs-up" height="12" width="12" fill="currentColor"></orecalc-assets-svg>';
                costDisplay.appendChild(badge);
            }

            row.appendChild(costDisplay);

            // Column 2: Ore display (centered outer container, fixed right-aligned inner container)
            const oreDisplay = document.createElement('div');
            oreDisplay.style.display = 'flex';
            oreDisplay.style.alignItems = 'center';
            oreDisplay.style.justifyContent = 'center';
            oreDisplay.title = `${translate('ores.' + oreType) || oreType} Amount`;

            const oreInner = document.createElement('div');
            oreInner.style.display = 'flex';
            oreInner.style.alignItems = 'center';
            oreInner.style.justifyContent = 'flex-end';
            oreInner.style.gap = '6px';
            oreInner.style.width = '75px';

            const countSpan = document.createElement('span');
            countSpan.style.fontSize = '12px';
            countSpan.style.fontWeight = '600';
            countSpan.style.color = 'var(--text-primary)';
            countSpan.textContent = formatNumber(oreValue);

            const oreImg = document.createElement('orecalc-assets-image');
            oreImg.setAttribute('src', `assets/${oreType}_ore.png`);
            oreImg.setAttribute('alt', translate('ores.' + oreType) || oreType);
            oreImg.setAttribute('class', 'ore-image');
            oreImg.setAttribute('size', 'thumbnail');
            oreImg.style.width = '16px';
            oreImg.style.height = '16px';
            oreImg.style.objectFit = 'contain';

            oreInner.appendChild(countSpan);
            oreInner.appendChild(oreImg);
            oreDisplay.appendChild(oreInner);
            row.appendChild(oreDisplay);

            const select = document.createElement('select');
            select.id = `welcome-shop-offer-${id}`;
            select.className = 'welcome-select-input';
            select.style.width = '100%';
            select.style.height = '28px';
            select.style.padding = '2px 6px';
            select.style.borderRadius = '6px';
            select.style.boxSizing = 'border-box';
            select.style.backgroundColor = 'var(--bg-surface-primary)';
            select.style.color = 'var(--text-primary)';
            select.style.fontSize = '12px';
            select.style.outline = 'none';
            select.style.cursor = 'pointer';

            for (let i = 0; i <= data.maxPacks; i++) {
                const opt = document.createElement('option');
                opt.value = i.toString();
                opt.textContent = i.toString();
                select.appendChild(opt);
            }
            select.value = (purchasedOffers[id] !== undefined ? purchasedOffers[id] : 0).toString();

            select.addEventListener('change', (e) => {
                const count = parseInt(e.target.value, 10) || 0;
                purchasedOffers[id] = count;
                tempShopOffersPurchases[id] = count;
                
                const activeTag = activeWizardTag || state.savedPlayerTags[0];
                if (activeTag) {
                    handleStateUpdate(() => {
                        const playerObj = state.allPlayersData[activeTag];
                        if (playerObj) {
                            applyChecklistToProfile(playerObj);
                        }
                    }, true);
                    renderApp(state);
                }
            });

            row.appendChild(select);
            container.appendChild(row);
        });
}

export function syncWelcomeQuickSettings(tag) {
    const storedShinyInput = document.getElementById('welcome-stored-shiny');
    const storedGlowyInput = document.getElementById('welcome-stored-glowy');
    const storedStarryInput = document.getElementById('welcome-stored-starry');
    const raidMedalsBuySwitch = document.getElementById('welcome-pref-raid-medals-buy');
    const raidMedalsEarnedInput = document.getElementById('welcome-pref-raid-medals-earned');
    const raidMedalsStarryInput = document.getElementById('welcome-pref-raid-medals-starry');
    const raidMedalsGlowyInput = document.getElementById('welcome-pref-raid-medals-glowy');
    const raidMedalsShinyInput = document.getElementById('welcome-pref-raid-medals-shiny');
    const gemsBuySwitch = document.getElementById('welcome-pref-gems-buy');
    const gemsStarryInput = document.getElementById('welcome-pref-gems-starry');
    const gemsGlowyInput = document.getElementById('welcome-pref-gems-glowy');
    const gemsShinyInput = document.getElementById('welcome-pref-gems-shiny');
    const shopOffersBuySwitch = document.getElementById('welcome-pref-shop-offers-buy');
    const clanWarsBuySwitch = document.getElementById('welcome-pref-clan-wars-buy');
    const clanWarsCountInput = document.getElementById('welcome-pref-clan-wars-count');
    const clanWarsWinrateInput = document.getElementById('welcome-pref-clan-wars-winrate');
    const clanWarsDrawrateInput = document.getElementById('welcome-pref-clan-wars-drawrate');
    const cwlBuySwitch = document.getElementById('welcome-pref-cwl-buy');
    const cwlHitsInput = document.getElementById('welcome-pref-cwl-hits');
    const cwlWinrateInput = document.getElementById('welcome-pref-cwl-winrate');
    const cwlDrawrateInput = document.getElementById('welcome-pref-cwl-drawrate');
    const goldPassSwitch = document.getElementById('welcome-pref-gold-pass');
    const cloudSyncSwitch = document.getElementById('welcome-pref-cloud-sync');

    const eventPassBuySwitch = document.getElementById('welcome-pref-event-pass-buy');
    const eventIncludeEquipmentSwitch = document.getElementById('welcome-pref-event-include-equipment');
    const eventBonusMedalsInput = document.getElementById('welcome-pref-event-bonus-medals');
    const eventPurchasedMedalsInput = document.getElementById('welcome-pref-event-purchased-medals');
    const eventTraderBuySwitch = document.getElementById('welcome-pref-event-trader-buy');
    const eventTraderShinySelect = document.getElementById('welcome-pref-event-trader-shiny');
    const eventTraderGlowySelect = document.getElementById('welcome-pref-event-trader-glowy');
    const eventTraderStarrySelect = document.getElementById('welcome-pref-event-trader-starry');
    const currencySelect = document.getElementById('welcome-pref-currency');
    
    if (!storedShinyInput || !storedGlowyInput || !storedStarryInput || 
        !raidMedalsBuySwitch || !raidMedalsStarryInput || !raidMedalsGlowyInput || !raidMedalsShinyInput || 
        !gemsBuySwitch || !gemsStarryInput || !gemsGlowyInput || !gemsShinyInput || 
        !shopOffersBuySwitch || !clanWarsBuySwitch || !clanWarsCountInput || !clanWarsWinrateInput || !clanWarsDrawrateInput || 
        !cwlBuySwitch || !cwlHitsInput || !cwlWinrateInput || !cwlDrawrateInput || 
        !goldPassSwitch || !cloudSyncSwitch || 
        !eventPassBuySwitch || !eventIncludeEquipmentSwitch || 
        !eventTraderBuySwitch || !eventTraderShinySelect || !eventTraderGlowySelect || !eventTraderStarrySelect ||
        !currencySelect) return;

    // Populate currency select list dynamically
    currencySelect.innerHTML = '';
    Object.keys(currencyData).forEach(code => {
        const currency = currencyData[code];
        if (currency.enabled) {
            const option = document.createElement('option');
            option.value = code;
            option.textContent = `${currency.symbol} ${code}`;
            currencySelect.appendChild(option);
        }
    });

    if (tag) {
        const playerObj = state.allPlayersData[tag];
        if (playerObj) {
            storedShinyInput.value = playerObj.storedOres?.shiny || 0;
            storedGlowyInput.value = playerObj.storedOres?.glowy || 0;
            storedStarryInput.value = playerObj.storedOres?.starry || 0;

            const raidPacks = playerObj.income?.raidMedals?.packs || {};
            const hasRaidPacks = (raidPacks.shiny > 0 || raidPacks.glowy > 0 || raidPacks.starry > 0);
            raidMedalsBuySwitch.checked = hasRaidPacks;
            if (raidMedalsEarnedInput) raidMedalsEarnedInput.value = playerObj.income?.raidMedals?.earned ?? 1200;
            raidMedalsStarryInput.value = raidPacks.starry || 0;
            raidMedalsGlowyInput.value = raidPacks.glowy || 0;
            raidMedalsShinyInput.value = raidPacks.shiny || 0;

            const gemPacks = playerObj.income?.gems?.packs || {};
            const hasGemPacks = (gemPacks.shiny > 0 || gemPacks.glowy > 0 || gemPacks.starry > 0);
            gemsBuySwitch.checked = hasGemPacks;
            gemsStarryInput.value = gemPacks.starry || 0;
            gemsGlowyInput.value = gemPacks.glowy || 0;
            gemsShinyInput.value = gemPacks.shiny || 0;

            const th = playerObj.playerProfile?.townHallLevel || playerObj.townHallLevel || 16;
            const thLevel = parseInt(th, 10);
            const shopOffersState = playerObj.income?.shopOffers || {};
            const bestSetKey = getBestMatchShopOfferSet(thLevel);
            const bestSetNum = parseInt(bestSetKey, 10);
            const selectedSet = (shopOffersState.selectedSet !== undefined && shopOffersState.selectedSet !== null) ? shopOffersState.selectedSet : bestSetNum;
            const purchasedOffers = shopOffersState[selectedSet] || {};
            const hasShopOffers = Object.values(purchasedOffers).some(count => count > 0);
            shopOffersBuySwitch.checked = hasShopOffers;

            const clanWarState = playerObj.income?.clanWar || {};
            clanWarsBuySwitch.checked = (clanWarState.warsPerMonth > 0);
            clanWarsCountInput.value = clanWarState.warsPerMonth || 8;

            let suggestedClanWarWinRate = 70;
            let suggestedClanWarDrawRate = 0;
            const profileClanWarStats = playerObj.clanWarStats;
            if (profileClanWarStats) {
                const wins = profileClanWarStats.winsCount ?? 0;
                const ties = profileClanWarStats.drawsCount ?? 0;
                const total = profileClanWarStats.warsCount ?? 0;
                suggestedClanWarWinRate = total > 0 ? Math.round((wins / total) * 100) : (profileClanWarStats.winRate ?? 70);
                suggestedClanWarDrawRate = total > 0 ? Math.round((ties / total) * 100) : (profileClanWarStats.drawRate ?? 0);
            }
            clanWarsWinrateInput.value = clanWarState.winRate ?? suggestedClanWarWinRate;
            clanWarsDrawrateInput.value = clanWarState.drawRate ?? suggestedClanWarDrawRate;

            const cwlState = playerObj.income?.cwl || {};
            cwlBuySwitch.checked = (cwlState.hitsPerSeason > 0);

            let suggestedCwlWinRate = 50;
            let suggestedCwlDrawRate = 0;
            let suggestedCwlHits = 7;
            const cachedCwlSeasons = playerObj.cwlSeasons || [];
            if (cachedCwlSeasons.length > 0) {
                let totalWins = 0;
                let totalDraws = 0;
                let totalWars = 0;
                let sumHits = 0;
                for (const season of cachedCwlSeasons) {
                    const wars = season.warsCount || 0;
                    const wins = season.winsCount !== undefined ? season.winsCount : Math.round(((season.winRate ?? 50) * (wars || 7)) / 100);
                    const draws = season.drawsCount !== undefined ? season.drawsCount : Math.round(((season.drawRate ?? 0) * (wars || 7)) / 100);
                    totalWins += wins;
                    totalDraws += draws;
                    totalWars += wars;
                    sumHits += (season.hitsCount ?? 7);
                }
                if (totalWars > 0) {
                    suggestedCwlWinRate = Math.round((totalWins / totalWars) * 100);
                    suggestedCwlDrawRate = Math.round((totalDraws / totalWars) * 100);
                }
                suggestedCwlHits = Math.round(sumHits / cachedCwlSeasons.length);
            }

            cwlHitsInput.value = cwlState.hitsPerSeason || suggestedCwlHits;
            cwlWinrateInput.value = cwlState.winRate ?? suggestedCwlWinRate;
            cwlDrawrateInput.value = cwlState.drawRate ?? suggestedCwlDrawRate;

            const prospectorState = playerObj.income?.prospector || {};
            goldPassSwitch.checked = prospectorState.goldPass || false;

            const eventPassState = playerObj.income?.eventPass || {};
            eventPassBuySwitch.checked = eventPassState.eventPass || false;
            eventIncludeEquipmentSwitch.checked = eventPassState.includeEquipment || false;
            if (eventBonusMedalsInput) eventBonusMedalsInput.value = eventPassState.bonusTrackMedals || 0;
            if (eventPurchasedMedalsInput) eventPurchasedMedalsInput.value = eventPassState.purchasedMedals || 0;

            const eventTraderState = playerObj.income?.eventTrader || {};
            const eventTraderPacks = eventTraderState.packs || {};
            const hasEventTraderPacks = (eventTraderPacks.shiny > 0 || eventTraderPacks.glowy > 0 || eventTraderPacks.starry > 0);
            eventTraderBuySwitch.checked = hasEventTraderPacks;
            eventTraderShinySelect.value = eventTraderPacks.shiny || 0;
            eventTraderGlowySelect.value = eventTraderPacks.glowy || 0;
            eventTraderStarrySelect.value = eventTraderPacks.starry || 0;

            tempCurrencyCode = playerObj.currency?.code || state.uiSettings.currency?.code || 'USD';
            currencySelect.value = tempCurrencyCode;

            cloudSyncSwitch.checked = state.uiSettings.cloudSync ?? true;

            renderWelcomeShopOffers(thLevel, purchasedOffers);

            toggleSubpanels();
            setupDirectDeviceSyncInWizard();
            return;
        }
    }

    storedShinyInput.value = tempStoredShiny;
    storedGlowyInput.value = tempStoredGlowy;
    storedStarryInput.value = tempStoredStarry;

    raidMedalsBuySwitch.checked = tempRaidMedalsBuy;
    if (raidMedalsEarnedInput) raidMedalsEarnedInput.value = tempRaidMedalsEarned;
    raidMedalsStarryInput.value = tempRaidMedalsStarry;
    raidMedalsGlowyInput.value = tempRaidMedalsGlowy;
    raidMedalsShinyInput.value = tempRaidMedalsShiny;
    gemsBuySwitch.checked = tempGemsBuy;
    gemsStarryInput.value = tempGemsStarry;
    gemsGlowyInput.value = tempGemsGlowy;
    gemsShinyInput.value = tempGemsShiny;

    shopOffersBuySwitch.checked = tempShopOffersBuy;
    clanWarsBuySwitch.checked = tempClanWars;
    clanWarsCountInput.value = tempClanWarsCount;
    clanWarsWinrateInput.value = tempClanWarsWinrate;
    clanWarsDrawrateInput.value = tempClanWarsDrawrate;
    cwlBuySwitch.checked = tempCwl;
    cwlHitsInput.value = tempCwlHits;
    cwlWinrateInput.value = tempCwlWinrate;
    cwlDrawrateInput.value = tempCwlDrawrate;
    goldPassSwitch.checked = tempGoldPass;

    eventPassBuySwitch.checked = tempEventPassBuy;
    eventIncludeEquipmentSwitch.checked = tempEventIncludeEquipment;
    if (eventBonusMedalsInput) eventBonusMedalsInput.value = tempEventBonusMedals;
    if (eventPurchasedMedalsInput) eventPurchasedMedalsInput.value = tempEventPurchasedMedals;
    eventTraderBuySwitch.checked = tempEventTraderBuy;
    eventTraderShinySelect.value = tempEventTraderShiny;
    eventTraderGlowySelect.value = tempEventTraderGlowy;
    eventTraderStarrySelect.value = tempEventTraderStarry;

    currencySelect.value = tempCurrencyCode;
    cloudSyncSwitch.checked = tempCloudSync;

    renderWelcomeShopOffers(selectedTH || 16, tempShopOffersPurchases);

    toggleSubpanels();
    setupDirectDeviceSyncInWizard();
}

function setupDirectDeviceSyncInWizard() {
    const welcomeSyncUserIdDisplay = document.getElementById('welcome-sync-user-id');
    const welcomeSyncQrContainer = document.getElementById('welcome-sync-qr-container');
    
    let userId = localStorage.getItem('oreCalc_userId');
    if (!userId) {
        userId = crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
        localStorage.setItem('oreCalc_userId', userId);
    }
    
    if (welcomeSyncUserIdDisplay) {
        welcomeSyncUserIdDisplay.textContent = userId;
        welcomeSyncUserIdDisplay.dataset.fullId = userId;
    }
    
    if (welcomeSyncQrContainer) {
        welcomeSyncQrContainer.innerHTML = '';
        const data = window.location.origin + '?userId=' + userId;
        const textPrimaryColor = getComputedStyle(document.body).getPropertyValue('--text-primary').trim();
        if (window.QRCodeStyling) {
            try {
                const qrCode = new QRCodeStyling({
                    width: 240,
                    height: 240,
                    data: data,
                    image: 'assets/app_icon_small.png',
                    dotsOptions: {
                        color: textPrimaryColor || "#000000",
                        type: "rounded"
                    },
                    backgroundOptions: {
                        color: "transparent",
                    },
                    imageOptions: {
                        crossOrigin: "anonymous",
                        margin: 8
                    },
                    cornersSquareOptions: {
                        type: "extra-rounded",
                        color: textPrimaryColor || "#000000"
                    },
                    cornersDotOptions: {
                        type: "dot",
                        color: textPrimaryColor || "#000000"
                    }
                });
                qrCode.append(welcomeSyncQrContainer);
            } catch (err) {
                console.error('Failed to generate wizard QR code:', err);
            }
        }
    }
}

function toggleSubpanels() {
    const raidMedalsBuySwitch = document.getElementById('welcome-pref-raid-medals-buy');
    const raidMedalsPanel = document.getElementById('welcome-pref-raid-medals-panel');
    if (raidMedalsBuySwitch && raidMedalsPanel) {
        raidMedalsPanel.style.display = raidMedalsBuySwitch.checked ? 'flex' : 'none';
    }

    const gemsBuySwitch = document.getElementById('welcome-pref-gems-buy');
    const gemsPanel = document.getElementById('welcome-pref-gems-panel');
    if (gemsBuySwitch && gemsPanel) {
        gemsPanel.style.display = gemsBuySwitch.checked ? 'flex' : 'none';
    }

    const goldPassSwitch = document.getElementById('welcome-pref-gold-pass');
    if (goldPassSwitch && gemsPanel) {
        gemsPanel.classList.toggle('has-gold-pass', goldPassSwitch.checked);
    }

    const shopOffersBuySwitch = document.getElementById('welcome-pref-shop-offers-buy');
    const shopOffersPanel = document.getElementById('welcome-pref-shop-offers-panel');
    if (shopOffersBuySwitch && shopOffersPanel) {
        shopOffersPanel.style.display = shopOffersBuySwitch.checked ? 'flex' : 'none';
    }

    const clanWarsBuySwitch = document.getElementById('welcome-pref-clan-wars-buy');
    const clanWarsPanel = document.getElementById('welcome-pref-clan-wars-panel');
    if (clanWarsBuySwitch && clanWarsPanel) {
        clanWarsPanel.style.display = clanWarsBuySwitch.checked ? 'flex' : 'none';
    }

    const cwlBuySwitch = document.getElementById('welcome-pref-cwl-buy');
    const cwlPanel = document.getElementById('welcome-pref-cwl-panel');
    if (cwlBuySwitch && cwlPanel) {
        cwlPanel.style.display = cwlBuySwitch.checked ? 'flex' : 'none';
    }

    const eventPassBuySwitch = document.getElementById('welcome-pref-event-pass-buy');
    const eventPassPanel = document.getElementById('welcome-pref-event-pass-panel');
    if (eventPassBuySwitch && eventPassPanel) {
        eventPassPanel.style.display = eventPassBuySwitch.checked ? 'flex' : 'none';
    }

    const eventTraderBuySwitch = document.getElementById('welcome-pref-event-trader-buy');
    const eventTraderPanel = document.getElementById('welcome-pref-event-trader-panel');
    if (eventTraderBuySwitch && eventTraderPanel) {
        eventTraderPanel.style.display = eventTraderBuySwitch.checked ? 'flex' : 'none';
    }

    const cloudSyncSwitch = document.getElementById('welcome-pref-cloud-sync');
    const deviceSyncOverlay = document.getElementById('welcome-device-sync-overlay');
    const deviceSyncSection = document.querySelector('.welcome-device-sync-section');
    const isOnlyDefault = state.savedPlayerTags.length === 1 && state.savedPlayerTags[0] === 'DEFAULT0';
    const guestOverlay = document.getElementById('welcome-cloud-sync-guest-overlay');
    const copyAccordion = document.getElementById('welcome-your-sync-code-details');
    const pasteAccordion = document.getElementById('welcome-link-device-details');

    if (guestOverlay) {
        guestOverlay.style.display = isOnlyDefault ? 'flex' : 'none';
    }

    if (isOnlyDefault) {
        if (copyAccordion) {
            copyAccordion.style.display = 'none';
        }
        if (pasteAccordion) {
            pasteAccordion.style.display = 'block';
            if (currentPage === 4 && pasteAccordion._welcomeAccordion) {
                pasteAccordion._welcomeAccordion.open();
            } else {
                pasteAccordion.open = true;
            }
        }
        if (deviceSyncOverlay) {
            deviceSyncOverlay.style.display = 'none';
        }
        if (deviceSyncSection) {
            deviceSyncSection.classList.remove('sync-disabled');
        }
    } else {
        if (copyAccordion) {
            copyAccordion.style.display = '';
        }
        if (cloudSyncSwitch && deviceSyncOverlay && deviceSyncSection) {
            if (cloudSyncSwitch.checked) {
                deviceSyncOverlay.style.display = 'none';
                deviceSyncSection.classList.remove('sync-disabled');
            } else {
                deviceSyncOverlay.style.display = 'flex';
                deviceSyncSection.classList.add('sync-disabled');
            }
        }
    }

    updatePreviewArrowPosition();
}

export async function updateSavedProfilesSequentially() {
    const isOnlyDefault = state.savedPlayerTags.length === 1 && state.savedPlayerTags[0] === 'DEFAULT0';
    if (isOnlyDefault) {
        return;
    }

    const tags = state.savedPlayerTags.filter(tag => tag !== 'DEFAULT0');
    if (tags.length === 0) return;

    // Reset status trackers
    updatingProfiles = {};
    errorProfiles = {};
    successProfiles = {};

    // Adaptive per-player fetch timeout that escalates on consecutive network failures:
    //   0 failures → 15s  (generous; could be network latency)
    //   1 failure  →  8s  (API is struggling)
    //   2 failures →  5s  (API is likely down)
    //   3 failures → stop immediately and show an alert
    // Note: only network-level failures (timeout, 5xx, no network) count —
    // 4xx errors (404, 403, etc.) mean the API is healthy and don't increment the counter.
    const TIMEOUTS = [15000, 8000, 5000];
    const MAX_FAILURES = 3;
    let failureCount = 0;

    for (const tag of tags) {
        updatingProfiles[tag] = true;
        renderWelcomeProfilesList();
        updateContinueButtonDisabledState();

        const fetchTimeoutMs = TIMEOUTS[Math.min(failureCount, TIMEOUTS.length - 1)];

        // Live countdown: update the spinner text every second without a full re-render
        let secondsLeft = Math.ceil(fetchTimeoutMs / 1000);
        const updateCountdown = () => {
            const el = document.querySelector(`.welcome-profile-card-compact[data-tag="${tag}"] .loading-countdown`);
            if (el) el.textContent = secondsLeft > 0 ? `${secondsLeft}s` : '';
        };
        updateCountdown();
        const countdownInterval = setInterval(() => {
            secondsLeft--;
            updateCountdown();
        }, 1000);

        try {
            const result = await loadAndProcessPlayerData(tag, { timeoutMs: fetchTimeoutMs, updateOrder: false });
            if (result && result.success) {
                successProfiles[tag] = true;
                failureCount = 0; // reset streak on success
            } else {
                // Don't overwrite with an error if this tag was already manually
                // loaded successfully (e.g. via Load Profile) — a timed-out
                // background refresh should not retroactively mark it as failed.
                if (!successProfiles[tag]) {
                    errorProfiles[tag] = result?.message || 'Failed to update';
                }
                // Only count network-level failures toward the circuit-breaker.
                // A 404/403 etc. means the API is healthy — just this player had an issue.
                if (result?.isNetworkError) {
                    failureCount++;
                }
            }
        } catch (err) {
            errorProfiles[tag] = err.message || 'Failed to update';
            failureCount++;
        } finally {
            clearInterval(countdownInterval);
            updatingProfiles[tag] = false;
            renderWelcomeProfilesList();
            updateContinueButtonDisabledState();

            // If the updated tag is currently selected/active, update the detailed preview
            const activeTag = state.savedPlayerTags[0];
            if (activeTag === tag) {
                const playerObject = state.allPlayersData[tag];
                if (playerObject && (playerObject.playerProfile || playerObject.playerData)) {
                    renderProfilePreviewCard(playerObject.playerProfile || playerObject.playerData);
                    isProfileLoaded = true;
                }
            }
        }

        // Check immediately after this player's result — fire on the 3rd consecutive network failure
        if (failureCount >= MAX_FAILURES) {
            // Mark all remaining (unfetched) tags as errors
            for (const remainingTag of tags) {
                if (!successProfiles[remainingTag] && !errorProfiles[remainingTag]) {
                    errorProfiles[remainingTag] = 'apiErrors.timeout';
                    updatingProfiles[remainingTag] = false;
                }
            }
            renderWelcomeProfilesList();
            updateContinueButtonDisabledState();
            showAlert(translate('alerts.apiUnavailable') || 'The API appears to be unavailable. Player data could not be loaded. You can still continue and try again later.');
            break;
        }
    }
}

// SETUP WIZARD & SELECTION VIEW HELPERS

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

        // TH badge
        const thImg = document.createElement('orecalc-assets-image');
        thImg.setAttribute('class', 'welcome-profile-card-th-img');
        thImg.setAttribute('src', `assets/th/th${thLevel}.png`);
        thImg.setAttribute('alt', `TH ${thLevel}`);
        thImg.setAttribute('size', 'thumbnail');

        // Text details container
        const details = document.createElement('div');
        details.className = 'welcome-profile-card-details';

        const nameEl = document.createElement('span');
        nameEl.className = 'welcome-profile-card-name';
        nameEl.textContent = name;

        const tagEl = document.createElement('span');
        tagEl.className = 'welcome-profile-card-tag';
        tagEl.textContent = isGuest ? (translate('welcome.guestTitle') || 'Guest Profile') : `#${tag}`;

        details.appendChild(nameEl);
        details.appendChild(tagEl);

        // Status indicator
        const statusContainer = document.createElement('div');
        statusContainer.className = 'welcome-profile-card-status';

        const onboardingComplete = sessionStorage.getItem(`oreCalc_onboardingComplete_${tag}`) === 'true';

        if (updatingProfiles[tag]) {
            statusContainer.innerHTML = `<span class="status-icon loading-spinner"></span>`;
        } else if (onboardingComplete) {
            statusContainer.innerHTML = `
                <span class="status-icon success-icon" title="${translate('welcome.complete') || 'Setup Complete'}">
                    ${getSVG('check-simple', '', 18, 18, 'var(--color-success)')}
                </span>
            `;
        } else {
            statusContainer.innerHTML = `
                <span class="status-icon warning-icon" title="${translate('welcome.setupRequired') || 'Setup Needed'}" style="display: flex; align-items: center; gap: 4px;">
                    ${getSVG('warning', '', 18, 18, 'var(--color-warning)')}
                    <span style="font-size: 11px; font-weight: 500; color: var(--color-warning); margin-left: 2px;" data-i18n="welcome.setupRequired">Setup Needed</span>
                </span>
            `;
        }

        card.appendChild(thImg);
        card.appendChild(details);
        card.appendChild(statusContainer);

        card.addEventListener('click', () => {
            openSetupWizard(tag);
        });

        listContainer.appendChild(card);
    });
}

function openSetupWizard(tag) {
    activeWizardTag = tag;
    currentWizardStepIndex = 0;
    
    // Check if player was already onboarded before starting wizard
    wasAlreadyOnboarded = (tag === 'DEFAULT0')
        ? (sessionStorage.getItem('oreCalc_onboardingComplete_DEFAULT0') === 'true')
        : (sessionStorage.getItem(`oreCalc_onboardingComplete_${tag}`) === 'true');

    if (tag === 'DEFAULT0' && !state.allPlayersData['DEFAULT0']) {
        const guestPlayerData = generateGuestPlayerData(selectedTH, selectedLeague);
        const guestPlayerState = {
            ...getDefaultPlayerState(),
            playerProfile: guestPlayerData
        };
        initializeGuestHeroesState(guestPlayerState);
        state.allPlayersData['DEFAULT0'] = guestPlayerState;
        sessionStorage.removeItem('oreCalc_onboardingComplete_DEFAULT0');
    }

    const playerObj = state.allPlayersData[tag];
    if (!playerObj) return;

    const isGuest = (tag === 'DEFAULT0');
    if (isGuest) {
        const profile = playerObj.playerProfile || playerObj;
        selectedTH = profile.townHallLevel || 16;
        selectedLeague = profile.leagueTier?.id || 105000000;
        initializeGuestSetup();
    }
    
    // Set up step indices: step 1 is Guest TH/League (only for DEFAULT0)
    if (isGuest) {
        wizardSteps = [1, 2, 3, 4, 5, 6];
    } else {
        wizardSteps = [2, 3, 4, 5, 6];
    }

    const thLevel = playerObj?.playerProfile?.townHallLevel || playerObj?.townHallLevel || 1;

    // Populate profile details in header
    const nameEl = document.getElementById('welcome-wizard-profile-name');
    const tagEl = document.getElementById('welcome-wizard-profile-tag');
    const thImgEl = document.getElementById('welcome-wizard-th-img');

    if (nameEl) {
        nameEl.textContent = isGuest ? (translate('player.guest') || 'Guest') : (playerObj?.playerProfile?.name || playerObj?.playerData?.name || tag);
    }
    if (tagEl) {
        tagEl.textContent = isGuest ? (translate('welcome.guestProfileTag') || 'Guest Profile') : `#${tag}`;
    }
    if (thImgEl) {
        thImgEl.src = `assets/th/th${thLevel}.png`;
        thImgEl.alt = `TH ${thLevel}`;
    }

    // Sync input controls with existing profile values
    syncWelcomeQuickSettings(tag);

    // Hide selection view and show loading view first
    const selectionView = document.getElementById('welcome-profiles-selection-view');
    const wizardView = document.getElementById('welcome-profile-setup-wizard-view');
    const loadingView = document.getElementById('welcome-profile-setup-loading-view');
    const mainActions = document.getElementById('welcome-main-actions');
    const welcomeDots = document.getElementById('welcome-dots');
    const carousel = document.getElementById('welcome-carousel');

    if (selectionView) selectionView.style.display = 'none';
    if (wizardView) wizardView.style.display = 'none'; // Keep hidden initially
    if (loadingView) {
        loadingView.style.display = 'flex';
    }
    if (mainActions) mainActions.style.display = 'none';
    if (welcomeDots) welcomeDots.style.display = 'none';
    if (carousel) carousel.classList.add('no-scroll');

    // Keep header skip button hidden during loading phase
    const headerSkipBtn = document.getElementById('welcome-header-skip-btn');
    if (headerSkipBtn) headerSkipBtn.style.display = 'none';

    // Simulate 500ms loading/parsing delay
    setTimeout(() => {
        // Abort showing if wizard was exited or another profile opened in the meantime
        if (activeWizardTag !== tag) return;

        if (loadingView) loadingView.style.display = 'none';
        if (wizardView) {
            wizardView.style.display = 'flex';
        }

        // Render the wizard dots initially
        renderWizardDots();

        // Update steps visibility
        updateWizardStepView();

        // Update header skip button visibility
        updateHeaderSkipButtonVisibility();
    }, 500);
}

function updateWizardStepView() {
    const activeStep = wizardSteps[currentWizardStepIndex];
    
    // Hide all steps, show current one
    const steps = document.querySelectorAll('.wizard-step');
    steps.forEach(step => {
        const stepNum = parseInt(step.dataset.step, 10);
        if (stepNum === activeStep) {
            step.style.display = 'flex';
        } else {
            step.style.display = 'none';
        }
    });

    // Update step indicator
    const indicator = document.getElementById('welcome-wizard-step-indicator');
    if (indicator) {
        indicator.textContent = translate('tour.step', { current: currentWizardStepIndex + 1, total: wizardSteps.length }) || `Step ${currentWizardStepIndex + 1} of ${wizardSteps.length}`;
    }

    // Update active class on wizard dots
    const dots = document.querySelectorAll('#welcome-wizard-dots .welcome-dot');
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentWizardStepIndex);
    });

    // Update footer buttons
    const backBtn = document.getElementById('welcome-wizard-back-btn');
    const nextBtn = document.getElementById('welcome-wizard-next-btn');

    if (backBtn) {
        backBtn.textContent = translate('welcome.back') || 'Back';
    }

    if (nextBtn) {
        if (currentWizardStepIndex === wizardSteps.length - 1) {
            nextBtn.textContent = translate('welcome.done') || 'Done';
        } else {
            nextBtn.textContent = translate('welcome.next') || 'Next';
        }
    }

    // Scroll active Town Hall badge into view on step 1 entry (handles modal render delay)
    if (activeStep === 1) {
        setTimeout(() => {
            const container = document.getElementById('welcome-guest-th-list');
            if (container) {
                const activeBadge = container.querySelector('.th-badge-item.active');
                if (activeBadge) {
                    const scrollLeft = activeBadge.offsetLeft - (container.clientWidth / 2) + (activeBadge.clientWidth / 2);
                    container.scrollTo({ left: scrollLeft, behavior: 'auto' });
                }
            }
        }, 150);
    }
}

function goToNextWizardStep() {
    if (currentWizardStepIndex === wizardSteps.length - 1) {
        finishWizard();
    } else {
        currentWizardStepIndex++;
        updateWizardStepView();
    }
}

function goToPrevWizardStep() {
    if (currentWizardStepIndex === 0) {
        const tag = activeWizardTag;
        if (tag && !wasAlreadyOnboarded) {
            if (tag === 'DEFAULT0') {
                sessionStorage.removeItem('oreCalc_onboardingComplete_DEFAULT0');
            } else {
                sessionStorage.removeItem(`oreCalc_onboardingComplete_${tag}`);
            }
        }
        exitWizard();
    } else {
        currentWizardStepIndex--;
        updateWizardStepView();
    }
}

function exitWizard() {
    activeWizardTag = null;

    const selectionView = document.getElementById('welcome-profiles-selection-view');
    const wizardView = document.getElementById('welcome-profile-setup-wizard-view');
    const loadingView = document.getElementById('welcome-profile-setup-loading-view');
    const mainActions = document.getElementById('welcome-main-actions');

    if (selectionView) selectionView.style.display = 'flex';
    if (wizardView) wizardView.style.display = 'none';
    if (loadingView) loadingView.style.display = 'none';
    if (mainActions) mainActions.style.display = 'flex';
    
    const welcomeDots = document.getElementById('welcome-dots');
    if (welcomeDots) welcomeDots.style.display = 'flex';

    const carousel = document.getElementById('welcome-carousel');
    if (carousel) carousel.classList.remove('no-scroll');

    // Re-render and update action buttons
    renderVerticalProfilesList();
    updateSubmitButtonText();
    updateWelcomeContinueButtonText(3);
    updateHeaderSkipButtonVisibility();
}

function finishWizard(isSkipped = false) {
    if (!activeWizardTag) return;

    // Apply values to the profile
    const playerObj = state.allPlayersData[activeWizardTag];
    if (playerObj) {
        if (activeWizardTag === 'DEFAULT0') {
            if (!playerObj.playerProfile) {
                playerObj.playerProfile = {};
            }
            playerObj.playerProfile.townHallLevel = selectedTH;
            if (selectedLeague) {
                playerObj.playerProfile.leagueTier = { id: selectedLeague };
            }
            if (!isSkipped) {
                applyChecklistToProfile(playerObj);
            }
            sessionStorage.setItem('oreCalc_onboardingComplete_DEFAULT0', 'true');
            
            // Sync global references to point to the guest profile properties
            state.heroes = playerObj.heroes;
            state.storedOres = playerObj.storedOres;
            state.income = playerObj.income;
            state.planner = playerObj.planner;
            state.playerProfile = playerObj.playerProfile;
        } else {
            if (!isSkipped) {
                applyChecklistToProfile(playerObj);
            }
            sessionStorage.setItem(`oreCalc_onboardingComplete_${activeWizardTag}`, 'true');
        }
        
        // Save state
        handleStateUpdate(() => {}, false); // trigger full save and render
    }

    exitWizard();
}

function updateWelcomeContinueButtonText(pageNumber) {
    const continueBtn = document.getElementById('welcome-continue-btn');
    if (!continueBtn) return;

    if (pageNumber === 3) {
        const allComplete = state.savedPlayerTags.every(tag => {
            return sessionStorage.getItem(`oreCalc_onboardingComplete_${tag}`) === 'true';
        });

        if (allComplete && state.savedPlayerTags.length > 0) {
            continueBtn.textContent = translate('welcome.continue') || 'Continue';
            continueBtn.setAttribute('data-i18n', 'welcome.continue');
        } else {
            continueBtn.textContent = translate('welcome.setupProfiles') || 'Setup Profiles';
            continueBtn.setAttribute('data-i18n', 'welcome.setupProfiles');
        }
    } else {
        continueBtn.textContent = translate('welcome.continue') || 'Continue';
        continueBtn.setAttribute('data-i18n', 'welcome.continue');
    }
}

export function updateHeaderSkipButtonVisibility() {
    const headerSkipBtn = document.getElementById('welcome-header-skip-btn');
    if (!headerSkipBtn) return;

    if (currentPage === 3) {
        if (activeWizardTag) {
            headerSkipBtn.style.display = 'block';
        } else {
            const hasPendingSetup = state.savedPlayerTags.filter(tag => tag !== 'DEFAULT0').some(tag => {
                return sessionStorage.getItem(`oreCalc_onboardingComplete_${tag}`) !== 'true';
            });
            headerSkipBtn.style.display = hasPendingSetup ? 'block' : 'none';
        }
    } else {
        headerSkipBtn.style.display = 'none';
    }
}

function updateSubmitButtonText() {
    const submitBtn = document.getElementById('welcome-submit-btn');
    if (!submitBtn) return;
    submitBtn.textContent = translate('welcome.getStarted') || 'Get Started';
}

function updateLoadProfileButtonText() {
    const loadProfileBtn = document.getElementById('welcome-load-btn');
    if (!loadProfileBtn) return;

    const hasNonDefaultTag = state.savedPlayerTags.some(tag => tag !== 'DEFAULT0');
    if (hasNonDefaultTag) {
        loadProfileBtn.textContent = translate('welcome.loadAnotherProfile') || 'Load Another Profile';
        loadProfileBtn.setAttribute('data-i18n', 'welcome.loadAnotherProfile');
    } else {
        loadProfileBtn.textContent = translate('welcome.loadProfile') || 'Load Profile';
        loadProfileBtn.setAttribute('data-i18n', 'welcome.loadProfile');
    }
}

function renderWizardDots() {
    const wizardDotsContainer = document.getElementById('welcome-wizard-dots');
    if (!wizardDotsContainer) return;

    wizardDotsContainer.innerHTML = '';
    wizardSteps.forEach((stepNum, index) => {
        const dot = document.createElement('span');
        dot.className = 'welcome-dot';
        if (index === currentWizardStepIndex) {
            dot.classList.add('active');
        }
        dot.addEventListener('click', () => {
            if (Math.abs(index - currentWizardStepIndex) > 1) return;
            currentWizardStepIndex = index;
            updateWizardStepView();
        });
        wizardDotsContainer.appendChild(dot);
    });
}

function updateHeaderMinimizedState(shouldMinimize) {
    const modalContent = document.querySelector('.welcome-modal-content');
    if (!modalContent) return;

    const currentlyMinimized = modalContent.classList.contains('has-minimized-header');
    if (currentlyMinimized === shouldMinimize) return;

    const brand = modalContent.querySelector('.brand-name');
    
    if (brand) {
        // FLIP: First
        const firstRect = brand.getBoundingClientRect();

        // Perform Layout change
        modalContent.classList.toggle('has-minimized-header', shouldMinimize);

        // FLIP: Last
        const lastRect = brand.getBoundingClientRect();

        // FLIP: Invert
        const dx = firstRect.left - lastRect.left;
        const dy = firstRect.top - lastRect.top;
        const dw = firstRect.width / lastRect.width;
        const dh = firstRect.height / lastRect.height;

        brand.style.transition = 'none';
        brand.style.transform = `translate(${dx}px, ${dy}px) scale(${dw}, ${dh})`;
        brand.style.transformOrigin = 'top left';

        // Force layout reflow
        brand.offsetHeight;

        // FLIP: Play
        brand.style.transition = 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
        brand.style.transform = '';
    } else {
        modalContent.classList.toggle('has-minimized-header', shouldMinimize);
    }
}
