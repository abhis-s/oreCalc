/**
 * Pure DOM rendering for Passkey Management Modal.
 * Tier 4: UI Renderer.
 */

import { translate } from '../../i18n/translator.js';
import { getLanguageFromPath } from '../../core/languageRouter.js';
import { formatDate } from '../../utils/dateUtils.js';
import { escapeHTML } from '../../utils/stringUtils.js';

/**
 * Renders jumping dots loader inside the passkeys list during data fetching.
 */
export function renderPasskeysLoader() {
    const listEl = document.getElementById('passkeys-items-list');
    const emptyEl = document.getElementById('passkeys-empty-state');
    if (!listEl) return;

    if (emptyEl) {
        emptyEl.classList.add('is-hidden');
        emptyEl.style.display = 'none';
    }
    listEl.classList.remove('is-hidden');
    listEl.style.display = '';

    listEl.innerHTML = `
        <div class="passkeys-loader">
            <span class="button-loader">
                <span></span><span></span><span></span>
            </span>
        </div>
    `;
}

/**
 * Renders the list of registered passkey devices.
 *
 * @param {Array<{ credentialID: string, deviceName: string, createdAt: number }>} passkeys
 */
export function renderPasskeysList(passkeys) {
    const listEl = document.getElementById('passkeys-items-list');
    const emptyEl = document.getElementById('passkeys-empty-state');
    if (!listEl || !emptyEl) return;

    if (!Array.isArray(passkeys) || passkeys.length === 0) {
        listEl.innerHTML = '';
        listEl.classList.add('is-hidden');
        listEl.style.display = 'none';
        emptyEl.classList.remove('is-hidden');
        emptyEl.style.display = '';
        return;
    }

    emptyEl.classList.add('is-hidden');
    emptyEl.style.display = 'none';
    listEl.classList.remove('is-hidden');
    listEl.style.display = '';

    const currentLang = getLanguageFromPath() || 'en';

    listEl.innerHTML = passkeys.map(pk => {
        let dateStr = '';
        if (pk.createdAt) {
            const formatted = formatDate(new Date(pk.createdAt), { month: 'short', day: 'numeric', year: 'numeric' }, currentLang);
            dateStr = translate('auth.addedDate', { date: formatted });
        }

        const defaultName = translate('auth.defaultPasskeyName') || 'Passkey';
        const safeName = escapeHTML(pk.deviceName || defaultName);
        const safeId = escapeHTML(pk.credentialID);

        return `
            <div class="passkey-item-row" data-credential-id="${safeId}">
                <div class="passkey-info">
                    <span class="passkey-device-name">${safeName}</span>
                    <span class="passkey-created-date">${escapeHTML(dateStr)}</span>
                </div>
                <button type="button" class="passkey-delete-btn" data-credential-id="${safeId}" aria-label="${escapeHTML(translate('auth.deletePasskey'))}" title="${escapeHTML(translate('auth.deletePasskey'))}" data-i18n-aria-label="auth.deletePasskey" data-i18n-title="auth.deletePasskey">
                    <orecalc-assets-svg name="trash"></orecalc-assets-svg>
                </button>
            </div>
        `;
    }).join('');
}

/**
 * Sets status feedback for passkey operations.
 *
 * @param {string} text
 * @param {boolean} [isError=false]
 */
export function setPasskeysStatus(text, isError = false) {
    const el = document.getElementById('passkeys-status');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('error', isError);
    el.classList.toggle('success', !isError && Boolean(text));
}
