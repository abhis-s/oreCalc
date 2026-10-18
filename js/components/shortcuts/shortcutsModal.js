/**
 * Pure DOM presentation and controller subsystem for the Keyboard Shortcuts Cheatsheet.
 * Tier 4: Component Subsystem (Dialog presentation, input suppression, OS-adaptive keys).
 */

import { translate } from '../../i18n/translator.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { openModal, closeModalAnimated } from '../../utils/modalHistoryManager.js';

/** @type {HTMLDialogElement | null} */
let modalEl = null;

/** @type {boolean} Guard preventing duplicate global event listener attachment */
let isListenerInitialized = false;

/**
 * Detects whether the current client environment is an Apple platform (macOS / iOS / iPadOS).
 *
 * @param {string} [customUa] - Optional userAgent string for testing.
 * @returns {boolean}
 */
export function isApplePlatform(customUa) {
    if (typeof customUa === 'string') {
        return /Mac|iPhone|iPad|iPod/i.test(customUa);
    }
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const platform = /** @type {any} */ (navigator).userAgentData?.platform || navigator.platform || '';
    return /Mac|iPhone|iPad|iPod/i.test(ua) || /Mac/i.test(platform);
}

/**
 * Checks whether user focus is currently located inside an interactive text input.
 * Used as an input-suppression guard to prevent shortcut modal triggers during typing.
 *
 * @returns {boolean}
 */
export function isInputFocused() {
    if (typeof document === 'undefined') return false;
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName ? active.tagName.toUpperCase() : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (active.isContentEditable || active.getAttribute('contenteditable') === 'true') return true;
    return false;
}

/**
 * Builds and returns the modal dialog element for the shortcuts cheatsheet.
 *
 * @param {boolean} [isMacOverride] - Optional boolean override for testing OS key layouts.
 * @returns {HTMLDialogElement}
 */
export function createShortcutsModalDialog(isMacOverride) {
    const isMac = typeof isMacOverride === 'boolean' ? isMacOverride : isApplePlatform();

    const dialog = document.createElement('dialog');
    dialog.id = 'shortcuts-cheatsheet-modal';
    dialog.className = 'modal shortcuts-modal';
    dialog.setAttribute('aria-labelledby', 'shortcuts-modal-title');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    dialog.innerHTML = `
        <div class="modal-content modal-expanded shortcuts-modal-content" id="shortcuts-card" role="document">
            <div class="modal-header">
                <h2 id="shortcuts-modal-title" data-i18n="views.shortcuts.title">${escapeHTML(translate('views.shortcuts.title'))}</h2>
                <div class="modal-header-actions">
                    <button type="button" id="close-shortcuts-modal-btn" class="close-button" data-i18n-aria-label="actions.close" aria-label="${escapeHTML(translate('actions.close'))}">
                        <clashcalc-assets-svg name="close"></clashcalc-assets-svg>
                    </button>
                </div>
            </div>
            <div class="modal-body shortcuts-modal-body">
                <div class="shortcuts-group">
                    <h3 class="shortcuts-group__title" data-i18n="views.shortcuts.categories.global">${escapeHTML(translate('views.shortcuts.categories.global'))}</h3>
                    <div class="shortcuts-card-table">
                        <div class="shortcuts-row">
                            <span class="shortcuts-row__desc" data-i18n="views.shortcuts.descriptions.openSpotright">${escapeHTML(translate('views.shortcuts.descriptions.openSpotright'))}</span>
                            <span class="shortcuts-row__keys">
                                ${isMac ? `<kbd class="shortcuts-kbd shortcuts-kbd--icon" aria-label="${escapeHTML(translate('views.shortcuts.keys.keyboardCommand'))}"><clashcalc-assets-svg name="keyboard-command" width="12" height="12"></clashcalc-assets-svg></kbd>` : `<kbd class="shortcuts-kbd"><span class="shortcuts-kbd-text" data-i18n="views.shortcuts.keys.keyboardCtrl">${escapeHTML(translate('views.shortcuts.keys.keyboardCtrl'))}</span></kbd>`}
                                <kbd class="shortcuts-kbd">K</kbd>
                            </span>
                        </div>
                        <div class="shortcuts-row">
                            <span class="shortcuts-row__desc" data-i18n="views.shortcuts.descriptions.openCheatsheet">${escapeHTML(translate('views.shortcuts.descriptions.openCheatsheet'))}</span>
                            <span class="shortcuts-row__keys">
                                <kbd class="shortcuts-kbd">?</kbd>
                            </span>
                        </div>
                        <div class="shortcuts-row">
                            <span class="shortcuts-row__desc" data-i18n="views.shortcuts.descriptions.closeActive">${escapeHTML(translate('views.shortcuts.descriptions.closeActive'))}</span>
                            <span class="shortcuts-row__keys">
                                <kbd class="shortcuts-kbd"><span class="shortcuts-kbd-text" data-i18n="views.shortcuts.keys.keyboardEsc">${escapeHTML(translate('views.shortcuts.keys.keyboardEsc'))}</span></kbd>
                            </span>
                        </div>
                    </div>
                </div>

                <div class="shortcuts-group">
                    <h3 class="shortcuts-group__title" data-i18n="views.shortcuts.categories.spotright">${escapeHTML(translate('views.shortcuts.categories.spotright'))}</h3>
                    <div class="shortcuts-card-table">
                        <div class="shortcuts-row">
                            <span class="shortcuts-row__desc" data-i18n="views.shortcuts.descriptions.cycleResults">${escapeHTML(translate('views.shortcuts.descriptions.cycleResults'))}</span>
                            <span class="shortcuts-row__keys">
                                <kbd class="shortcuts-kbd"><span class="shortcuts-kbd-text" data-i18n="views.shortcuts.keys.keyboardUp">${escapeHTML(translate('views.shortcuts.keys.keyboardUp'))}</span> <clashcalc-assets-svg name="chevron-up" width="12" height="12" aria-hidden="true"></clashcalc-assets-svg></kbd>
                                <span class="shortcuts-key-separator">/</span>
                                <kbd class="shortcuts-kbd"><span class="shortcuts-kbd-text" data-i18n="views.shortcuts.keys.keyboardDown">${escapeHTML(translate('views.shortcuts.keys.keyboardDown'))}</span> <clashcalc-assets-svg name="chevron-down" width="12" height="12" aria-hidden="true"></clashcalc-assets-svg></kbd>
                            </span>
                        </div>
                        <div class="shortcuts-row">
                            <span class="shortcuts-row__desc" data-i18n="views.shortcuts.descriptions.executeAction">${escapeHTML(translate('views.shortcuts.descriptions.executeAction'))}</span>
                            <span class="shortcuts-row__keys">
                                <kbd class="shortcuts-kbd shortcuts-kbd--icon" aria-label="${escapeHTML(translate('views.shortcuts.keys.keyboardEnter'))}"><clashcalc-assets-svg name="keyboard-return" width="12" height="12"></clashcalc-assets-svg></kbd>
                            </span>
                        </div>
                        <div class="shortcuts-row">
                            <span class="shortcuts-row__desc" data-i18n="views.shortcuts.descriptions.spotrightAccept">${escapeHTML(translate('views.shortcuts.descriptions.spotrightAccept'))}</span>
                            <span class="shortcuts-row__keys">
                                <kbd class="shortcuts-kbd"><span class="shortcuts-kbd-text" data-i18n="views.shortcuts.keys.keyboardTab">${escapeHTML(translate('views.shortcuts.keys.keyboardTab'))}</span> <clashcalc-assets-svg name="keyboard-tab" width="12" height="12" aria-hidden="true"></clashcalc-assets-svg></kbd>
                            </span>
                        </div>
                        <div class="shortcuts-row">
                            <span class="shortcuts-row__desc" data-i18n="views.shortcuts.descriptions.spotrightClearScope">${escapeHTML(translate('views.shortcuts.descriptions.spotrightClearScope'))}</span>
                            <span class="shortcuts-row__keys">
                                <kbd class="shortcuts-kbd shortcuts-kbd--icon" aria-label="${escapeHTML(translate('views.shortcuts.keys.keyboardBackspace'))}"><clashcalc-assets-svg name="keyboard-backspace" width="14" height="14"></clashcalc-assets-svg></kbd>
                            </span>
                        </div>
                        <div class="shortcuts-row">
                            <span class="shortcuts-row__desc" data-i18n="views.shortcuts.descriptions.scopePrefix">${escapeHTML(translate('views.shortcuts.descriptions.scopePrefix'))}</span>
                            <span class="shortcuts-row__keys">
                                <kbd class="shortcuts-kbd shortcuts-kbd--code">/v</kbd>
                                <kbd class="shortcuts-kbd shortcuts-kbd--code">/e</kbd>
                                <kbd class="shortcuts-kbd shortcuts-kbd--code">/h</kbd>
                                <kbd class="shortcuts-kbd shortcuts-kbd--code">/t</kbd>
                                <kbd class="shortcuts-kbd shortcuts-kbd--code">/s</kbd>
                            </span>
                        </div>
                    </div>
                </div>

                <div class="shortcuts-group">
                    <h3 class="shortcuts-group__title" data-i18n="views.shortcuts.categories.dialogs">${escapeHTML(translate('views.shortcuts.categories.dialogs'))}</h3>
                    <div class="shortcuts-card-table">
                        <div class="shortcuts-row">
                            <span class="shortcuts-row__desc" data-i18n="views.shortcuts.descriptions.cycleFocus">${escapeHTML(translate('views.shortcuts.descriptions.cycleFocus'))}</span>
                            <span class="shortcuts-row__keys">
                                <kbd class="shortcuts-kbd"><span class="shortcuts-kbd-text" data-i18n="views.shortcuts.keys.keyboardTab">${escapeHTML(translate('views.shortcuts.keys.keyboardTab'))}</span> <clashcalc-assets-svg name="keyboard-tab" width="12" height="12" aria-hidden="true"></clashcalc-assets-svg></kbd>
                                <span class="shortcuts-key-separator">/</span>
                                <kbd class="shortcuts-kbd"><span class="shortcuts-kbd-text" data-i18n="views.shortcuts.keys.keyboardShift">${escapeHTML(translate('views.shortcuts.keys.keyboardShift'))}</span> <clashcalc-assets-svg name="keyboard-shift" width="12" height="12" aria-hidden="true"></clashcalc-assets-svg></kbd>
                                <kbd class="shortcuts-kbd"><span class="shortcuts-kbd-text" data-i18n="views.shortcuts.keys.keyboardTab">${escapeHTML(translate('views.shortcuts.keys.keyboardTab'))}</span> <clashcalc-assets-svg name="keyboard-tab" width="12" height="12" aria-hidden="true"></clashcalc-assets-svg></kbd>
                            </span>
                        </div>
                        <div class="shortcuts-row">
                            <span class="shortcuts-row__desc" data-i18n="views.shortcuts.descriptions.activateItem">${escapeHTML(translate('views.shortcuts.descriptions.activateItem'))}</span>
                            <span class="shortcuts-row__keys">
                                <kbd class="shortcuts-kbd shortcuts-kbd--icon" aria-label="${escapeHTML(translate('views.shortcuts.keys.keyboardEnter'))}"><clashcalc-assets-svg name="keyboard-return" width="12" height="12"></clashcalc-assets-svg></kbd>
                                <span class="shortcuts-key-separator">/</span>
                                <kbd class="shortcuts-kbd"><span class="shortcuts-kbd-text" data-i18n="views.shortcuts.keys.keyboardSpace">${escapeHTML(translate('views.shortcuts.keys.keyboardSpace'))}</span> <clashcalc-assets-svg name="keyboard-space" width="12" height="12" aria-hidden="true"></clashcalc-assets-svg></kbd>
                            </span>
                        </div>
                        <div class="shortcuts-row">
                            <span class="shortcuts-row__desc" data-i18n="views.shortcuts.descriptions.horizontalNav">${escapeHTML(translate('views.shortcuts.descriptions.horizontalNav'))}</span>
                            <span class="shortcuts-row__keys">
                                <kbd class="shortcuts-kbd"><clashcalc-assets-svg name="chevron-up" class="shortcuts-chevron--left" width="12" height="12" aria-hidden="true"></clashcalc-assets-svg> <span class="shortcuts-kbd-text" data-i18n="views.shortcuts.keys.keyboardLeft">${escapeHTML(translate('views.shortcuts.keys.keyboardLeft'))}</span></kbd>
                                <span class="shortcuts-key-separator">/</span>
                                <kbd class="shortcuts-kbd"><span class="shortcuts-kbd-text" data-i18n="views.shortcuts.keys.keyboardRight">${escapeHTML(translate('views.shortcuts.keys.keyboardRight'))}</span> <clashcalc-assets-svg name="chevron-up" class="shortcuts-chevron--right" width="12" height="12" aria-hidden="true"></clashcalc-assets-svg></kbd>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" id="shortcuts-modal-footer-close-btn" class="btn-secondary reject-button" data-i18n="actions.close">${escapeHTML(translate('actions.close'))}</button>
            </div>
        </div>
    `;

    return dialog;
}

/**
 * Ensures shortcuts modal element is mounted to the document body.
 */
function ensureMounted() {
    if (modalEl && document.body.contains(modalEl)) return;

    modalEl = createShortcutsModalDialog();
    document.body.appendChild(modalEl);

    const closeBtn = modalEl.querySelector('#close-shortcuts-modal-btn');
    closeBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        closeShortcutsModal();
    });

    const footerCloseBtn = modalEl.querySelector('#shortcuts-modal-footer-close-btn');
    footerCloseBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        closeShortcutsModal();
    });

    modalEl.addEventListener('click', (event) => {
        const card = modalEl?.querySelector('#shortcuts-card');
        if (card && !card.contains(/** @type {Node} */ (event.target))) {
            closeShortcutsModal();
        }
    });

    modalEl.addEventListener('cancel', (event) => {
        event.preventDefault();
        closeShortcutsModal();
    });
}

/**
 * Programmatically opens the Keyboard Shortcuts Cheatsheet modal.
 */
export function openShortcutsModal() {
    ensureMounted();
    if (!modalEl) return;
    openModal(modalEl);
}

/**
 * Programmatically closes the Keyboard Shortcuts Cheatsheet modal.
 */
function closeShortcutsModal() {
    if (!modalEl) return;
    closeModalAnimated(modalEl);
}

/**
 * Handles global keydown events, opening the cheatsheet upon typing '?'.
 *
 * @param {KeyboardEvent} event
 */
function handleGlobalKeydown(event) {
    if (event.isComposing) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key !== '?') return;

    if (isInputFocused()) return;

    event.preventDefault();
    openShortcutsModal();
}

/**
 * Initializes global '?' keyboard listener for the cheatsheet modal.
 */
export function initShortcutsModalListener() {
    if (isListenerInitialized || typeof window === 'undefined') return;
    isListenerInitialized = true;
    window.addEventListener('keydown', handleGlobalKeydown);
}
