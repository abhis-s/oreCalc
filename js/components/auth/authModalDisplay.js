/**
 * Pure DOM rendering and display operations for the Authentication Modal.
 * Tier 4: UI Renderer (Zero event listeners, pure DOM manipulation).
 */

import { translate } from '../../i18n/translator.js';

/**
 * Switches the active tab view between Sign In and Register.
 *
 * @param {'signin'|'register'} mode
 */
export function setAuthMode(mode) {
    const titleEl = document.getElementById('auth-modal-title');
    const tabSignin = document.getElementById('auth-tab-signin');
    const tabRegister = document.getElementById('auth-tab-register');
    const viewSignin = document.getElementById('auth-signin-view');
    const viewRegister = document.getElementById('auth-register-view');

    if (mode === 'register') {
        tabRegister?.classList.add('active');
        tabSignin?.classList.remove('active');
        viewRegister?.classList.remove('is-hidden');
        viewSignin?.classList.add('is-hidden');
        if (viewRegister) viewRegister.style.display = 'block';
        if (viewSignin) viewSignin.style.display = 'none';
        if (titleEl) titleEl.textContent = translate('auth.createAccount');
    } else {
        tabSignin?.classList.add('active');
        tabRegister?.classList.remove('active');
        viewSignin?.classList.remove('is-hidden');
        viewRegister?.classList.add('is-hidden');
        if (viewSignin) viewSignin.style.display = 'block';
        if (viewRegister) viewRegister.style.display = 'none';
        if (titleEl) titleEl.textContent = translate('auth.signInToAccount');
    }
}

/**
 * Sets the status message for the sign in form.
 *
 * @param {string} text - Message text.
 * @param {boolean} [isError=false] - Whether message represents an error.
 */
export function setSignInStatus(text, isError = false) {
    const el = document.getElementById('auth-signin-status');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('error', isError);
    el.classList.toggle('success', !isError && Boolean(text));
}

/**
 * Sets the status message for the register form.
 *
 * @param {string} text - Message text.
 * @param {boolean} [isError=false] - Whether message represents an error.
 */
export function setRegisterStatus(text, isError = false) {
    const el = document.getElementById('auth-register-status');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('error', isError);
    el.classList.toggle('success', !isError && Boolean(text));
}

/**
 * Toggles visibility between password masking and plaintext.
 *
 * @param {HTMLInputElement} inputEl
 * @param {HTMLElement} toggleBtn
 */
export function togglePasswordVisibility(inputEl, toggleBtn) {
    if (!inputEl) return;
    const isPassword = inputEl.type === 'password';
    inputEl.type = isPassword ? 'text' : 'password';

    const onIcon = toggleBtn.querySelector('.icon-vis-on');
    const offIcon = toggleBtn.querySelector('.icon-vis-off');
    if (onIcon && offIcon) {
        onIcon.classList.toggle('is-hidden', isPassword);
        offIcon.classList.toggle('is-hidden', !isPassword);
    }
}

/**
 * Clears form inputs and status messages.
 */
export function resetAuthModalState() {
    setSignInStatus('');
    setRegisterStatus('');

    const signinUser = /** @type {HTMLInputElement|null} */ (document.getElementById('auth-signin-username'));
    const signinPass = /** @type {HTMLInputElement|null} */ (document.getElementById('auth-signin-password'));
    const regUser = /** @type {HTMLInputElement|null} */ (document.getElementById('auth-register-username'));
    const regPass = /** @type {HTMLInputElement|null} */ (document.getElementById('auth-register-password'));

    if (signinUser) signinUser.value = '';
    if (signinPass) {
        signinPass.value = '';
        signinPass.type = 'password';
    }
    if (regUser) regUser.value = '';
    if (regPass) {
        regPass.value = '';
        regPass.type = 'password';
    }

    const toggleBtns = document.querySelectorAll('.password-toggle-btn');
    toggleBtns.forEach(btn => {
        btn.querySelector('.icon-vis-on')?.classList.remove('is-hidden');
        btn.querySelector('.icon-vis-off')?.classList.add('is-hidden');
    });

    setAuthMode('signin');
}
