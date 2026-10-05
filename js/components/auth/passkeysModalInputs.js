/**
 * Interaction and event handling for the Passkey Management Modal.
 * Tier 4: Interaction Engine.
 */

import { translate } from '../../i18n/translator.js';
import { openModal, closeModalAnimated } from '../../utils/modalHistoryManager.js';
import {
    fetchPasskeys,
    addPasskey,
    deletePasskey,
    getSuggestedPasskeyName
} from '../../services/authClientService.js';
import { showConfirm } from '../../ui/noticeModal.js';
import { resolveErrorMessage } from './authModalInputs.js';
import { renderPasskeysList, renderPasskeysLoader, setPasskeysStatus } from './passkeysModalDisplay.js';

let isLoading = false;
/** @type {Array<{ credentialID: string, deviceName: string, createdAt: number }>} */
let currentPasskeys = [];
let currentDetectedPasskeyName = '';

const MIN_LOADER_DURATION_MS = 400;

/**
 * Loads and renders the list of registered passkey authenticators.
 *
 * @param {number} [minDurationMs=MIN_LOADER_DURATION_MS] - Minimum display time to prevent loader flickering.
 */
async function loadPasskeysList(minDurationMs = MIN_LOADER_DURATION_MS) {
    isLoading = true;
    renderPasskeysLoader();

    const startTime = Date.now();
    try {
        const passkeys = await fetchPasskeys();
        const elapsed = Date.now() - startTime;
        if (minDurationMs > 0 && elapsed < minDurationMs) {
            await new Promise(resolve => setTimeout(resolve, minDurationMs - elapsed));
        }
        currentPasskeys = Array.isArray(passkeys) ? passkeys : [];
        renderPasskeysList(currentPasskeys);
    } catch (err) {
        const elapsed = Date.now() - startTime;
        if (minDurationMs > 0 && elapsed < minDurationMs) {
            await new Promise(resolve => setTimeout(resolve, minDurationMs - elapsed));
        }
        setPasskeysStatus(resolveErrorMessage(err), true);
    } finally {
        isLoading = false;
    }
}

/**
 * Opens the Passkey Management Modal, suggests a passkey name, and hydrates passkeys list.
 */
export async function openPasskeysModal() {
    setPasskeysStatus('');
    openModal('passkeys-modal');

    const input = /** @type {HTMLInputElement|null} */ (
        document.getElementById('add-passkey-name') || document.getElementById('add-passkey-device-name')
    );
    currentDetectedPasskeyName = getSuggestedPasskeyName();

    if (input) {
        input.value = '';
        if (currentDetectedPasskeyName) {
            input.placeholder = currentDetectedPasskeyName;
        } else {
            input.placeholder = translate('auth.passkeyNamePlaceholder');
        }
        requestAnimationFrame(() => {
            input.focus();
        });
    }

    await loadPasskeysList();
}

/**
 * Handles registering an additional passkey authenticator.
 */
async function handleAddPasskeyClick() {
    if (isLoading) return;

    const input = /** @type {HTMLInputElement|null} */ (
        document.getElementById('add-passkey-name') || document.getElementById('add-passkey-device-name')
    );
    const manualName = input?.value?.trim() || '';

    if (manualName) {
        const isDuplicate = currentPasskeys.some(
            pk => (pk.deviceName || '').trim().toLowerCase() === manualName.toLowerCase()
        );
        if (isDuplicate) {
            setPasskeysStatus(translate('apiErrors.duplicateDeviceName'), true);
            return;
        }
    }

    isLoading = true;
    setPasskeysStatus(translate('actions.loading'), false);

    try {
        await addPasskey(manualName, currentPasskeys);
        if (input) input.value = '';
        setPasskeysStatus('');
        await loadPasskeysList();
    } catch (err) {
        if (err.message !== 'passkeyCancelled') {
            setPasskeysStatus(resolveErrorMessage(err), true);
        } else {
            setPasskeysStatus('');
        }
    } finally {
        isLoading = false;
    }
}

/**
 * Handles deleting a registered passkey.
 *
 * @param {string} credentialId
 */
export async function handleDeletePasskey(credentialId) {
    if (isLoading || !credentialId) return;

    isLoading = true;
    setPasskeysStatus(translate('actions.loading'), false);

    try {
        await deletePasskey(credentialId);
        setPasskeysStatus('');
        await loadPasskeysList();
    } catch (err) {
        if (err?.message === 'passkeyNotFound' || err?.message?.includes('passkeyNotFound')) {
            // Self-healing ghost prevention:
            // If the passkey was already removed (on another device, in another tab, or server purge),
            // clear status and re-fetch to synchronize the UI with the true server state.
            setPasskeysStatus('');
            await loadPasskeysList();
        } else {
            setPasskeysStatus(resolveErrorMessage(err), true);
        }
    } finally {
        isLoading = false;
    }
}

/**
 * Initializes event listeners for the Passkey Management Modal.
 */
export function initializePasskeysModal() {
    const modal = document.getElementById('passkeys-modal');
    if (!modal) return;

    const closeBtn = document.getElementById('close-passkeys-modal-btn');
    const bottomCloseBtn = document.getElementById('close-passkeys-btn');
    closeBtn?.addEventListener('click', () => closeModalAnimated(modal));
    bottomCloseBtn?.addEventListener('click', () => closeModalAnimated(modal));

    const addBtn = document.getElementById('register-new-passkey-btn');
    addBtn?.addEventListener('click', handleAddPasskeyClick);

    const nameInput = /** @type {HTMLInputElement|null} */ (
        document.getElementById('add-passkey-name') || document.getElementById('add-passkey-device-name')
    );
    nameInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddPasskeyClick();
        }
    });

    const listEl = document.getElementById('passkeys-items-list');
    listEl?.addEventListener('click', async (e) => {
        const target = /** @type {HTMLElement|null} */ (e.target);
        const delBtn = target?.closest('.passkey-delete-btn');
        if (delBtn) {
            const credentialId = delBtn.getAttribute('data-credential-id') || '';
            const confirmed = await showConfirm(
                translate('auth.confirmDeletePasskey'),
                'actions.confirm',
                'actions.delete',
                'actions.cancel'
            );
            if (confirmed) {
                handleDeletePasskey(credentialId);
            }
        }
    });
}
