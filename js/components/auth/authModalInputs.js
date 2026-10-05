/**
 * Event handling, form validation, and gesture engine for Authentication Modal.
 * Tier 4: Interaction Engine.
 */

import { translate } from '../../i18n/translator.js';
import { openModal, closeModalAnimated } from '../../utils/modalHistoryManager.js';
import {
    loginWithPassword,
    loginWithPasskey,
    registerWithPassword,
    registerWithPasskey,
    authenticateWithPasskeyAutofill,
    cancelWebAuthnCeremony
} from '../../services/authClientService.js';
import { initializeAppData, triggerCloudSave } from '../../services/cloudSaveService.js';
import { syncPlayerTagToUrl } from '../../core/playerUrlRouter.js';
import { showAddPlayerModal } from '../player/playerModalInputs.js';
import { initializeState, state } from '../../core/state.js';
import { saveState } from '../../core/localStorageManager.js';
import { cleanupOrphanedPlayerPartitions } from '../../core/stateCleanup.js';
import { normalizePlayerTag } from '../../core/storageKeys.js';
import {
    setAuthMode,
    setSignInStatus,
    setRegisterStatus,
    togglePasswordVisibility,
    resetAuthModalState
} from './authModalDisplay.js';
import {
    fetchTurnstileConfig,
    renderTurnstileWidget,
    resetTurnstileWidget,
    removeTurnstileWidget
} from '../../services/turnstileClientService.js';

let isSubmitting = false;
/** @type {string|null} */
let signinWidgetId = null;
/** @type {string|null} */
let registerWidgetId = null;
let signinToken = '';
let registerToken = '';

/**
 * Retrieves the current Turnstile token for the sign-in widget.
 *
 * @returns {string}
 */
function getSigninToken() {
    if (typeof window !== 'undefined' && /** @type {any} */ (window).turnstile && signinWidgetId) {
        try {
            const res = /** @type {any} */ (window).turnstile.getResponse(signinWidgetId);
            if (res) return res;
        } catch {
            // Silently fall back to cached token
        }
    }
    return signinToken;
}

/**
 * Retrieves the current Turnstile token for the register widget.
 *
 * @returns {string}
 */
function getRegisterToken() {
    if (typeof window !== 'undefined' && /** @type {any} */ (window).turnstile && registerWidgetId) {
        try {
            const res = /** @type {any} */ (window).turnstile.getResponse(registerWidgetId);
            if (res) return res;
        } catch {
            // Silently fall back to cached token
        }
    }
    return registerToken;
}

/**
 * Unmounts and cleans up all active Turnstile widgets.
 */
function cleanupTurnstileWidgets() {
    if (signinWidgetId) {
        removeTurnstileWidget(signinWidgetId);
        signinWidgetId = null;
    }
    if (registerWidgetId) {
        removeTurnstileWidget(registerWidgetId);
        registerWidgetId = null;
    }
    signinToken = '';
    registerToken = '';
    const signinContainer = document.getElementById('auth-signin-turnstile');
    if (signinContainer) signinContainer.innerHTML = '';
    const registerContainer = document.getElementById('auth-register-turnstile');
    if (registerContainer) registerContainer.innerHTML = '';
}

/**
 * Ensures Turnstile widget is rendered for the specified mode if enabled.
 *
 * @param {'signin'|'register'} mode
 */
async function ensureTurnstileWidget(mode) {
    try {
        const config = await fetchTurnstileConfig();
        if (!config.enabled || !config.siteKey) {
            return;
        }

        if (mode === 'signin') {
            const container = document.getElementById('auth-signin-turnstile');
            if (container && (!signinWidgetId || !container.hasChildNodes())) {
                signinToken = '';
                signinWidgetId = await renderTurnstileWidget(container, {
                    onVerify: (token) => { signinToken = token; },
                    onExpire: () => { signinToken = ''; },
                    onError: () => { signinToken = ''; }
                });
            }
        } else if (mode === 'register') {
            const container = document.getElementById('auth-register-turnstile');
            if (container && (!registerWidgetId || !container.hasChildNodes())) {
                registerToken = '';
                registerWidgetId = await renderTurnstileWidget(container, {
                    onVerify: (token) => { registerToken = token; },
                    onExpire: () => { registerToken = ''; },
                    onError: () => { registerToken = ''; }
                });
            }
        }
    } catch {
        // Non-blocking if Turnstile service is unreachable
    }
}

/**
 * Adopts synced account state, synchronizes active URL parameters, and notifies
 * application subsystems via event emission.
 *
 * @param {any} syncedState
 */
async function applySyncedAccountState(syncedState) {
    initializeState(syncedState || null);
    cleanupOrphanedPlayerPartitions(state);
    saveState(state, true);

    const activeTag = state.savedPlayerTags?.find(t => t && normalizePlayerTag(t) !== 'DEFAULT0') || null;
    syncPlayerTagToUrl(activeTag);

    if (typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent('app:accountSynced', { detail: { syncedState: state } }));
        document.dispatchEvent(new CustomEvent('app:playerDropdownSync'));
    }
}

/**
 * Initiates WebAuthn conditional mediation (passkey autofill) if supported.
 */
async function initConditionalAutofill() {
    try {
        const user = await authenticateWithPasskeyAutofill();
        if (user) {
            const modal = document.getElementById('auth-modal');
            if (modal) closeModalAnimated(modal);
            const syncedState = await initializeAppData();
            await applySyncedAccountState(syncedState);
        }
    } catch {
        // Silently ignore cancellation or abort
    }
}

/**
 * Resolves user-friendly error message from server or client error.
 *
 * @param {any} err
 * @returns {string}
 */
export function resolveErrorMessage(err) {
    if (!err) return translate('apiErrors.unknown');
    const msg = err.message || '';
    if (msg.startsWith('apiErrors.')) {
        return translate(msg);
    }
    const candidate = `apiErrors.${msg}`;
    const translated = translate(candidate);
    if (translated && translated !== candidate) {
        return translated;
    }
    return err.serverMessage || translate('apiErrors.unknown');
}

/**
 * Opens the Authentication Modal in the requested mode.
 *
 * @param {'signin'|'register'} [defaultMode='signin']
 */
export function openAuthModal(defaultMode = 'signin') {
    cleanupTurnstileWidgets();
    resetAuthModalState();
    setAuthMode(defaultMode);
    openModal('auth-modal');
    ensureTurnstileWidget(defaultMode);

    if (defaultMode === 'signin') {
        initConditionalAutofill();
    }
}

/**
 * Handles password login form submission.
 *
 * @param {SubmitEvent} e
 */
async function handleSignInSubmit(e) {
    e.preventDefault();
    if (isSubmitting) return;

    const usernameInput = /** @type {HTMLInputElement|null} */ (document.getElementById('auth-signin-username'));
    const passwordInput = /** @type {HTMLInputElement|null} */ (document.getElementById('auth-signin-password'));
    const username = usernameInput?.value?.trim() || '';
    const password = passwordInput?.value || '';

    if (!username || !password) {
        setSignInStatus(translate('apiErrors.invalidCredentials'), true);
        return;
    }

    const config = await fetchTurnstileConfig();
    const token = getSigninToken();
    if (config.enabled && config.siteKey && !token) {
        setSignInStatus(translate('apiErrors.captchaRequired') || 'Security check required. Please complete the CAPTCHA.', true);
        return;
    }

    isSubmitting = true;
    setSignInStatus(translate('actions.loading'), false);

    try {
        await loginWithPassword(username, password, token);
        cleanupTurnstileWidgets();
        const modal = document.getElementById('auth-modal');
        if (modal) closeModalAnimated(modal);
        const syncedState = await initializeAppData();
        await applySyncedAccountState(syncedState);
    } catch (err) {
        setSignInStatus(resolveErrorMessage(err), true);
        resetTurnstileWidget(signinWidgetId);
        signinToken = '';
    } finally {
        isSubmitting = false;
    }
}

/**
 * Handles passkey 1-tap sign-in click.
 */
async function handlePasskeyLoginClick() {
    if (isSubmitting) return;

    const usernameInput = /** @type {HTMLInputElement|null} */ (document.getElementById('auth-signin-username'));
    const username = usernameInput?.value?.trim() || '';

    isSubmitting = true;
    setSignInStatus(translate('actions.loading'), false);

    try {
        await loginWithPasskey(username);
        const modal = document.getElementById('auth-modal');
        if (modal) closeModalAnimated(modal);
        const syncedState = await initializeAppData();
        await applySyncedAccountState(syncedState);
    } catch (err) {
        if (err.message !== 'passkeyCancelled') {
            setSignInStatus(resolveErrorMessage(err), true);
        } else {
            setSignInStatus('');
        }
    } finally {
        isSubmitting = false;
    }
}

/**
 * Handles passkey account creation click.
 */
async function handlePasskeyRegisterClick() {
    if (isSubmitting) return;

    const usernameInput = /** @type {HTMLInputElement|null} */ (document.getElementById('auth-register-username'));
    const username = usernameInput?.value?.trim() || '';

    if (!username || username.length < 3 || username.length > 20) {
        setRegisterStatus(translate('apiErrors.invalidUsername') || 'Username must be 3-20 characters.', true);
        return;
    }

    const config = await fetchTurnstileConfig();
    const token = getRegisterToken();
    if (config.enabled && config.siteKey && !token) {
        setRegisterStatus(translate('apiErrors.captchaRequired') || 'Security check required. Please complete the CAPTCHA.', true);
        return;
    }

    isSubmitting = true;
    setRegisterStatus(translate('actions.loading'), false);

    try {
        const hadRealTags = Boolean(state.savedPlayerTags?.some(t => t && normalizePlayerTag(t) !== 'DEFAULT0'));
        await registerWithPasskey(username, '', token);
        cleanupTurnstileWidgets();
        const modal = document.getElementById('auth-modal');
        if (modal) closeModalAnimated(modal);

        if (hadRealTags) {
            await triggerCloudSave({ silent: true });
        } else {
            showAddPlayerModal();
        }
    } catch (err) {
        if (err.message !== 'passkeyCancelled') {
            setRegisterStatus(resolveErrorMessage(err), true);
            resetTurnstileWidget(registerWidgetId);
            registerToken = '';
        } else {
            setRegisterStatus('');
        }
    } finally {
        isSubmitting = false;
    }
}

/**
 * Handles password account creation form submission.
 *
 * @param {SubmitEvent} e
 */
async function handlePasswordRegisterSubmit(e) {
    e.preventDefault();
    if (isSubmitting) return;

    const usernameInput = /** @type {HTMLInputElement|null} */ (document.getElementById('auth-register-username'));
    const passwordInput = /** @type {HTMLInputElement|null} */ (document.getElementById('auth-register-password'));
    const username = usernameInput?.value?.trim() || '';
    const password = passwordInput?.value || '';

    if (!username || username.length < 3 || username.length > 20) {
        setRegisterStatus(translate('apiErrors.invalidUsername') || 'Username must be 3-20 characters.', true);
        return;
    }
    if (!password || password.length < 6 || password.length > 72) {
        setRegisterStatus(translate('apiErrors.invalidPassword') || 'Password must be at least 6 characters long.', true);
        return;
    }

    const config = await fetchTurnstileConfig();
    const token = getRegisterToken();
    if (config.enabled && config.siteKey && !token) {
        setRegisterStatus(translate('apiErrors.captchaRequired') || 'Security check required. Please complete the CAPTCHA.', true);
        return;
    }

    isSubmitting = true;
    setRegisterStatus(translate('actions.loading'), false);

    try {
        const hadRealTags = Boolean(state.savedPlayerTags?.some(t => t && normalizePlayerTag(t) !== 'DEFAULT0'));
        await registerWithPassword(username, password, token);
        cleanupTurnstileWidgets();
        const modal = document.getElementById('auth-modal');
        if (modal) closeModalAnimated(modal);

        if (hadRealTags) {
            await triggerCloudSave({ silent: true });
        } else {
            showAddPlayerModal();
        }
    } catch (err) {
        setRegisterStatus(resolveErrorMessage(err), true);
        resetTurnstileWidget(registerWidgetId);
        registerToken = '';
    } finally {
        isSubmitting = false;
    }
}

/**
 * Initializes all event listeners for the authentication modal.
 */
export function initializeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;

    const closeBtn = document.getElementById('close-auth-modal-btn');
    closeBtn?.addEventListener('click', () => {
        cancelWebAuthnCeremony();
        cleanupTurnstileWidgets();
        closeModalAnimated(modal);
    });
    modal.addEventListener('close', () => {
        cancelWebAuthnCeremony();
        cleanupTurnstileWidgets();
    });

    // Tab buttons
    const tabSignin = document.getElementById('auth-tab-signin');
    const tabRegister = document.getElementById('auth-tab-register');
    tabSignin?.addEventListener('click', () => {
        setAuthMode('signin');
        ensureTurnstileWidget('signin');
        initConditionalAutofill();
    });
    tabRegister?.addEventListener('click', () => {
        cancelWebAuthnCeremony();
        setAuthMode('register');
        ensureTurnstileWidget('register');
    });

    // Password peek buttons
    modal.querySelectorAll('.password-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.parentElement?.querySelector('input');
            if (input) togglePasswordVisibility(input, /** @type {HTMLElement} */ (btn));
        });
    });

    // Form submits and passkey buttons
    const signinForm = document.getElementById('auth-signin-form');
    signinForm?.addEventListener('submit', handleSignInSubmit);

    const passkeyLoginBtn = document.getElementById('auth-passkey-login-btn');
    passkeyLoginBtn?.addEventListener('click', handlePasskeyLoginClick);

    const passkeyRegisterBtn = document.getElementById('auth-register-passkey-btn');
    passkeyRegisterBtn?.addEventListener('click', handlePasskeyRegisterClick);

    const registerPasswordForm = document.getElementById('auth-register-password-form');
    registerPasswordForm?.addEventListener('submit', handlePasswordRegisterSubmit);

    modal.addEventListener('click', (event) => {
        const target = /** @type {HTMLElement|null} */ (event.target);
        const termsLink = target?.closest('#auth-terms-link');
        const privacyLink = target?.closest('#auth-privacy-link');

        if (termsLink) {
            event.preventDefault();
            import('../appSettings/settingsLegalModals.js').then(m => m.openTermsOfUseModal());
            return;
        }

        if (privacyLink) {
            event.preventDefault();
            import('../appSettings/settingsLegalModals.js').then(m => m.openPrivacyModal());
        }
    });
}
