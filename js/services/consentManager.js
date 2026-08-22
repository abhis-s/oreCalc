import { translate } from '../i18n/translator.js';

import { EFFECTIVE_DATE_PRIVACY, EFFECTIVE_DATE_TERMS, EFFECTIVE_DATE_WELCOME, state } from '../core/state.js';
import { handleStateUpdate } from '../core/stateManager.js';

import { closeModalAnimated, openModal } from '../utils/modalHistoryManager.js';

import { openPrivacyModal, openTermsOfUseModal } from '../components/appSettings/settingsModals.js';
import { showWelcomeModal } from '../components/welcome/welcomeModal.js';
import { dom } from '../dom/domElements.js';

let isConsentListenersBound = false;

/**
 * Resolves the translation key for the consent banner text based on pending legal requirements.
 *
 * @param {boolean} needsTerms - Whether Terms of Service consent is pending.
 * @param {boolean} needsPrivacy - Whether Privacy Policy consent is pending.
 * @returns {string} Translation key ('legal.bannerTextTerms' | 'legal.bannerTextPrivacy' | 'legal.bannerTextBoth').
 */
export function getConsentBannerTextKey(needsTerms, needsPrivacy) {
    if (needsTerms && !needsPrivacy) {
        return 'legal.bannerTextTerms';
    }
    if (needsPrivacy && !needsTerms) {
        return 'legal.bannerTextPrivacy';
    }
    return 'legal.bannerTextBoth';
}

/**
 * Evaluates current consent status against effective legal dates and refreshes banner/modal display.
 */
export function refreshConsentModalStatus() {
    const privacyTimestamp = state.uiSettings?.uiTimestamps?.privacy;
    const tosTimestamp = state.uiSettings?.uiTimestamps?.tos;

    const privacyAccepted = privacyTimestamp && privacyTimestamp >= EFFECTIVE_DATE_PRIVACY;
    const tosAccepted = tosTimestamp && tosTimestamp >= EFFECTIVE_DATE_TERMS;

    const consentBanner = document.getElementById('consent-banner');
    const consentModal = document.getElementById('consent-modal');

    if (privacyAccepted && tosAccepted) {
        if (consentBanner) consentBanner.classList.remove('show');
        if (consentModal) closeModalAnimated(consentModal);
        return;
    }

    const needsPrivacy = !privacyAccepted;
    const needsTerms = !tosAccepted;

    const termsRow = document.getElementById('consent-terms-row');
    const privacyRow = document.getElementById('consent-privacy-row');
    if (termsRow) termsRow.style.display = needsTerms ? 'flex' : 'none';
    if (privacyRow) privacyRow.style.display = needsPrivacy ? 'flex' : 'none';

    const bannerTextElem = document.getElementById('consent-banner-text');
    if (bannerTextElem) {
        const key = getConsentBannerTextKey(needsTerms, needsPrivacy);
        bannerTextElem.setAttribute('data-i18n', key);
        bannerTextElem.textContent = translate(key);
    }
}

/**
 * Checks legal consent timestamps for Terms of Service and Privacy Policy, showing prompt if outdated.
 */
export function checkLegalConsent() {
    if (sessionStorage.getItem('oreCalc_justSyncedFromQr') === 'true') {
        return;
    }

    const privacyTimestamp = state.uiSettings?.uiTimestamps?.privacy;
    const tosTimestamp = state.uiSettings?.uiTimestamps?.tos;
    const welcomeTimestamp = state.uiSettings?.uiTimestamps?.welcome;

    const isNewUser = !privacyTimestamp && !tosTimestamp;
    const needsWelcome = !welcomeTimestamp || welcomeTimestamp < EFFECTIVE_DATE_WELCOME;

    if (isNewUser || needsWelcome) {
        showWelcomeModal(true);
        return;
    }

    const consentBanner = document.getElementById('consent-banner');
    const consentModal = document.getElementById('consent-modal');
    if (!consentBanner || !consentModal) return;

    const needsPrivacy = !privacyTimestamp || privacyTimestamp < EFFECTIVE_DATE_PRIVACY;
    const needsTerms = !tosTimestamp || tosTimestamp < EFFECTIVE_DATE_TERMS;

    if (!needsPrivacy && !needsTerms) {
        consentBanner.classList.remove('show');
        consentModal.classList.remove('show');
        return;
    }

    const termsRow = document.getElementById('consent-terms-row');
    const privacyRow = document.getElementById('consent-privacy-row');
    if (termsRow) termsRow.style.display = needsTerms ? 'flex' : 'none';
    if (privacyRow) privacyRow.style.display = needsPrivacy ? 'flex' : 'none';

    function formatVersionBadge(timestamp) {
        if (!timestamp) return '';
        const d = new Date(timestamp);
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        return `(v${yyyy}-${mm}-${dd})`;
    }

    const termsBadge = document.getElementById('consent-terms-version-badge');
    if (termsBadge) termsBadge.textContent = formatVersionBadge(EFFECTIVE_DATE_TERMS);

    const privacyBadge = document.getElementById('consent-privacy-version-badge');
    if (privacyBadge) privacyBadge.textContent = formatVersionBadge(EFFECTIVE_DATE_PRIVACY);

    const bannerTextElem = document.getElementById('consent-banner-text');
    if (bannerTextElem) {
        const key = getConsentBannerTextKey(needsTerms, needsPrivacy);
        bannerTextElem.setAttribute('data-i18n', key);
        bannerTextElem.textContent = translate(key);
    }

    const bannerViewBtn = document.getElementById('consent-banner-view-btn');
    const bannerCloseBtn = document.getElementById('consent-banner-close-btn');
    const viewTermsBtn = document.getElementById('consent-view-terms-btn');
    const viewPrivacyBtn = document.getElementById('consent-view-privacy-btn');
    const acceptBtn = document.getElementById('confirm-consent-btn');
    const closeConsentModalBtn = document.getElementById('close-consent-modal-btn');

    refreshConsentModalStatus();

    if (!isConsentListenersBound) {
        isConsentListenersBound = true;

        if (bannerViewBtn) {
            bannerViewBtn.addEventListener('click', (e) => {
                e.preventDefault();
                consentBanner.classList.remove('show');
                openModal(consentModal);
            });
        }

        if (bannerCloseBtn) {
            bannerCloseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                handleStateUpdate(() => {
                    const now = Date.now();
                    if (!state.uiSettings.uiTimestamps) {
                        state.uiSettings.uiTimestamps = {};
                    }
                    state.uiSettings.uiTimestamps.privacy = Math.max(now, EFFECTIVE_DATE_PRIVACY + 1);
                    state.uiSettings.uiTimestamps.tos = Math.max(now, EFFECTIVE_DATE_TERMS + 1);
                });

                consentBanner.classList.remove('show');
                closeModalAnimated(consentModal);
            });
        }

        if (viewTermsBtn) {
            viewTermsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const termsModal = document.getElementById('terms-modal');
                if (termsModal) termsModal.classList.add('modal-top');
                closeModalAnimated(consentModal, () => {
                    openTermsOfUseModal();
                });
            });
        }

        if (viewPrivacyBtn) {
            viewPrivacyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const privacyModal = document.getElementById('privacy-modal');
                if (privacyModal) privacyModal.classList.add('modal-top');
                closeModalAnimated(consentModal, () => {
                    openPrivacyModal();
                });
            });
        }

        if (acceptBtn) {
            acceptBtn.addEventListener('click', (e) => {
                e.preventDefault();
                handleStateUpdate(() => {
                    const now = Date.now();
                    if (!state.uiSettings.uiTimestamps) {
                        state.uiSettings.uiTimestamps = {};
                    }
                    state.uiSettings.uiTimestamps.privacy = Math.max(now, EFFECTIVE_DATE_PRIVACY + 1);
                    state.uiSettings.uiTimestamps.tos = Math.max(now, EFFECTIVE_DATE_TERMS + 1);
                });

                consentBanner.classList.remove('show');
                closeModalAnimated(consentModal);
            });
        }

        if (closeConsentModalBtn) {
            closeConsentModalBtn.addEventListener('click', (e) => {
                e.preventDefault();
                closeModalAnimated(consentModal, () => {
                    consentBanner.classList.add('show');
                });
            });
        }

        const termsHeaderClose = document.getElementById('close-terms-header-btn');
        const termsFooterClose = document.getElementById('close-terms-modal-btn');
        const termsAcceptBtn = document.getElementById('accept-terms-modal-btn');
        const privacyHeaderClose = document.getElementById('close-privacy-header-btn');
        const privacyFooterClose = document.getElementById('close-privacy-modal-btn');
        const privacyAcceptBtn = document.getElementById('accept-privacy-modal-btn');

        const reShowConsentModal = () => {
            const privacyTimestamp = state.uiSettings?.uiTimestamps?.privacy;
            const tosTimestamp = state.uiSettings?.uiTimestamps?.tos;
            const needsPrivacy = !privacyTimestamp || privacyTimestamp < EFFECTIVE_DATE_PRIVACY;
            const needsTerms = !tosTimestamp || tosTimestamp < EFFECTIVE_DATE_TERMS;
            if (needsPrivacy || needsTerms) {
                const modal = document.getElementById('consent-modal');
                if (modal) {
                    openModal(modal);
                }
            }
        };

        if (termsHeaderClose) termsHeaderClose.addEventListener('click', reShowConsentModal);
        if (termsFooterClose) termsFooterClose.addEventListener('click', reShowConsentModal);
        if (termsAcceptBtn) termsAcceptBtn.addEventListener('click', reShowConsentModal);
        if (privacyHeaderClose) privacyHeaderClose.addEventListener('click', reShowConsentModal);
        if (privacyFooterClose) privacyFooterClose.addEventListener('click', reShowConsentModal);
        if (privacyAcceptBtn) privacyAcceptBtn.addEventListener('click', reShowConsentModal);
    }

    consentBanner.classList.add('show');
}
