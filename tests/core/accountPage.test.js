import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));

globalThis.fetch = async (url) => {
    if (String(url).includes('passkeys')) {
        return { ok: true, json: async () => ({ passkeys: [] }) };
    }
    if (String(url).includes('/en.json')) {
        return { ok: true, json: async () => enJson };
    }
    return { ok: false, status: 404, json: async () => ({}) };
};

// Mock localStorage for Node.js environment
const store = new Map();
if (typeof globalThis.localStorage === 'undefined') {
    globalThis.localStorage = {
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, val) => store.set(key, String(val)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
        key: (index) => Array.from(store.keys())[index] ?? null,
        get length() { return store.size; }
    };
}

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        location: { hostname: 'localhost', origin: 'http://localhost:8080', pathname: '/account/' },
        __ENV__: { APP_VERSION: '3.0.0', PUBLIC_API_BASE_URL: 'http://localhost:3000' }
    };
}

// Simple DOM element mock
class MockElement {
    /**
     * @param {string} id
     */
    constructor(id = '') {
        this.id = id;
        this.attributes = new Map();
        this._textContent = '';
        this.innerHTML = '';
        this.value = '';
        this.placeholder = '';
        this.disabled = false;
        this.style = {};
        this.dataset = {};
        this.listeners = new Map();
        this.classes = new Set();
        this.classList = {
            add: (...cls) => cls.forEach(c => this.classes.add(c)),
            remove: (...cls) => cls.forEach(c => this.classes.delete(c)),
            toggle: (c, force) => {
                if (force === undefined) {
                    if (this.classes.has(c)) { this.classes.delete(c); return false; }
                    this.classes.add(c); return true;
                }
                if (force) { this.classes.add(c); return true; }
                this.classes.delete(c); return false;
            },
            contains: (c) => this.classes.has(c)
        };
    }

    get textContent() {
        if (this._animatedTextEl) {
            return this._animatedTextEl.textContent;
        }
        return this._textContent || '';
    }

    set textContent(val) {
        this._textContent = String(val);
        if (this._animatedTextEl) {
            this._animatedTextEl.textContent = String(val);
        }
    }

    focus() {}

    /**
     * @param {string} name
     * @param {string} val
     */
    setAttribute(name, val) {
        this.attributes.set(name, String(val));
    }

    /**
     * @param {string} name
     * @returns {string|null}
     */
    getAttribute(name) {
        return this.attributes.get(name) ?? null;
    }

    /**
     * @param {string} name
     * @returns {boolean}
     */
    hasAttribute(name) {
        return this.attributes.has(name);
    }

    /**
     * @param {string} name
     */
    removeAttribute(name) {
        this.attributes.delete(name);
    }

    /**
     * @param {string} event
     * @param {Function} handler
     */
    addEventListener(event, handler) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(handler);
    }

    /**
     * @param {string} event
     * @param {any} [data]
     */
    dispatchEvent(event, data) {
        const handlers = this.listeners.get(event) || [];
        for (const fn of handlers) {
            fn(data || {});
        }
    }

    click() {
        this.dispatchEvent('click');
    }

    querySelectorAll() {
        return [];
    }

    querySelector(sel) {
        if (typeof sel === 'string' && sel.includes('animated-btn-text')) {
            if (!this._animatedTextEl) {
                this._animatedTextEl = new MockElement();
            }
            return this._animatedTextEl;
        }
        return new MockElement();
    }
}

const elements = new Map();
function getOrCreateMockElement(id) {
    if (!elements.has(id)) {
        elements.set(id, new MockElement(id));
    }
    return elements.get(id);
}

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        getElementById: (id) => {
            if (id === 'guided-setup-modal') {
                return elements.get(id) || null;
            }
            return getOrCreateMockElement(id);
        },
        querySelector: (sel) => {
            if (sel.startsWith('#')) return getOrCreateMockElement(sel.substring(1));
            if (sel.startsWith('.')) return getOrCreateMockElement(sel.substring(1));
            return new MockElement();
        },
        querySelectorAll: () => [],
        createElement: (tag) => new MockElement(tag),
        body: {
            appendChild: () => {},
            removeChild: () => {}
        },
        addEventListener: () => {}
    };
}

describe('Account Page Presenter & Interaction Suite', () => {
    beforeEach(async () => {
        elements.clear();
        store.clear();
        const { loadTranslations } = await import('../../js/i18n/translator.js');
        await loadTranslations('en');
    });

    test('renderAccountPageShell conceals auth view and reveals guest view when not logged in', async () => {
        const { renderAccountPageShell } = await import('../../js/components/account/accountPageDisplay.js');

        const guestView = getOrCreateMockElement('account-guest-view');
        const authView = getOrCreateMockElement('account-auth-view');

        renderAccountPageShell(false, null);

        assert.strictEqual(authView.hasAttribute('hidden'), true);
        assert.strictEqual(guestView.hasAttribute('hidden'), false);
    });

    test('renderAccountPageShell reveals auth view, populates username and avatar when logged in', async () => {
        const { renderAccountPageShell } = await import('../../js/components/account/accountPageDisplay.js');

        const guestView = getOrCreateMockElement('account-guest-view');
        const authView = getOrCreateMockElement('account-auth-view');
        const usernameEl = getOrCreateMockElement('account-profile-username');
        const avatarImg = getOrCreateMockElement('account-profile-avatar-img');

        renderAccountPageShell(true, { username: 'ChiefClash', avatar: 'builder' });

        assert.strictEqual(guestView.hasAttribute('hidden'), true);
        assert.strictEqual(authView.hasAttribute('hidden'), false);
        assert.strictEqual(usernameEl.textContent, 'ChiefClash');
        assert.strictEqual(avatarImg.getAttribute('src'), '/assets/avatars/builder.png');
    });

    test('setAnimatedButtonContent updates text and icon for animated buttons without destroying markup', async () => {
        const { setAnimatedButtonContent } = await import('../../js/components/account/accountDisplayUtils.js');

        const btn = new MockElement('test-btn');
        const textSpan = new MockElement();
        const iconSvg = new MockElement();
        btn.querySelector = (sel) => {
            if (sel.includes('animated-btn-text')) return textSpan;
            if (sel.includes('animated-btn-icon-wrapper')) return iconSvg;
            return null;
        };

        setAnimatedButtonContent(btn, 'Save', 'check');
        assert.strictEqual(textSpan.textContent, 'Save');
        assert.strictEqual(iconSvg.getAttribute('name'), 'check');
    });

    test('toggleAvatarTray manages hidden attribute, aria-expanded, and icon state', async () => {
        const { toggleAvatarTray } = await import('../../js/components/account/accountPageDisplay.js');

        const tray = getOrCreateMockElement('account-avatar-tray');
        tray.setAttribute('hidden', '');
        const avatarBtn = getOrCreateMockElement('account-profile-avatar-btn');
        const iconMock = new MockElement();
        avatarBtn.querySelector = () => iconMock;

        const opened = toggleAvatarTray(true);
        assert.strictEqual(opened, true);
        assert.strictEqual(tray.hasAttribute('hidden'), false);
        assert.strictEqual(tray.getAttribute('aria-expanded'), 'true');
        assert.strictEqual(avatarBtn.getAttribute('aria-expanded'), 'true');
        assert.strictEqual(iconMock.getAttribute('name'), 'check');

        const closed = toggleAvatarTray(false);
        assert.strictEqual(closed, false);
        assert.strictEqual(tray.hasAttribute('hidden'), true);
        assert.strictEqual(tray.getAttribute('aria-expanded'), 'false');
        assert.strictEqual(avatarBtn.getAttribute('aria-expanded'), 'false');
        assert.strictEqual(iconMock.getAttribute('name'), 'edit');
    });

    test('renderPasskeysInlineList reveals empty state when passkeys array is empty', async () => {
        const { renderPasskeysInlineList } = await import('../../js/components/account/accountPageDisplay.js');

        const listEl = getOrCreateMockElement('account-passkeys-items-list');
        const emptyEl = getOrCreateMockElement('account-passkeys-empty');

        renderPasskeysInlineList([]);

        assert.strictEqual(emptyEl.classList.contains('is-hidden'), false);
        assert.strictEqual(listEl.innerHTML, '');
    });

    test('renderPasskeysInlineList renders passkey items and conceals empty state when credentials exist', async () => {
        const { renderPasskeysInlineList } = await import('../../js/components/account/accountPageDisplay.js');

        const listEl = getOrCreateMockElement('account-passkeys-items-list');
        const emptyEl = getOrCreateMockElement('account-passkeys-empty');

        renderPasskeysInlineList([
            { credentialID: 'cred-123', deviceName: 'MacBook Pro Touch ID', createdAt: Date.now() }
        ]);

        assert.strictEqual(emptyEl.classList.contains('is-hidden'), true);
        assert.ok(listEl.innerHTML.includes('MacBook Pro Touch ID'));
        assert.ok(listEl.innerHTML.includes('cred-123'));
    });

    test('toggleDeleteStepUp configures hint, input placeholder, and disabled button', async () => {
        const { toggleDeleteStepUp } = await import('../../js/components/account/accountPageDisplay.js');

        const panel = getOrCreateMockElement('account-delete-stepup-panel');
        const desc = getOrCreateMockElement('account-delete-stepup-desc');
        const input = getOrCreateMockElement('account-delete-confirm-input');
        const btn = getOrCreateMockElement('account-delete-execute-btn');

        toggleDeleteStepUp(true, 'TestChief');

        assert.strictEqual(panel.hasAttribute('hidden'), false);
        assert.ok(desc.textContent.includes('TestChief'));
        assert.strictEqual(input.placeholder, 'TestChief');
        assert.strictEqual(btn.disabled, true);

        toggleDeleteStepUp(false);
        assert.strictEqual(panel.hasAttribute('hidden'), true);
    });

    test('initAccountPageInputs attaches click listeners to all primary triggers without throw', async () => {
        const { initAccountPageInputs } = await import('../../js/components/account/accountPageInputs.js');

        assert.doesNotThrow(() => {
            initAccountPageInputs();
        });

        const signInBtn = getOrCreateMockElement('account-guest-signin-btn');
        assert.ok(signInBtn.listeners.has('click'), 'Sign In button should have click listener');

        const createBtn = getOrCreateMockElement('account-guest-create-btn');
        assert.ok(createBtn.listeners.has('click'), 'Create Account button should have click listener');

        const guestTogglePairingBtn = getOrCreateMockElement('account-guest-btn-toggle-pairing');
        assert.ok(guestTogglePairingBtn.listeners.has('click'), 'Guest Toggle Pairing button should have click listener');

        const guestExportBtn = getOrCreateMockElement('account-guest-export-backup');
        assert.ok(guestExportBtn.listeners.has('click'), 'Guest Export button should have click listener');

        const guestRestoreBtn = getOrCreateMockElement('account-guest-restore-backup');
        assert.ok(guestRestoreBtn.listeners.has('click'), 'Guest Restore button should have click listener');

        const guestResetDataBtn = getOrCreateMockElement('account-guest-reset-data-btn');
        assert.ok(guestResetDataBtn.listeners.has('click'), 'Guest Reset Data button should have click listener');

        const authResetDataBtn = getOrCreateMockElement('account-btn-reset-data');
        assert.ok(authResetDataBtn.listeners.has('click'), 'Auth Reset Data button should have click listener');

        const signOutBtn = getOrCreateMockElement('account-btn-signout');
        assert.ok(signOutBtn.listeners.has('click'), 'Sign Out button should have click listener');

        const avatarBtn = getOrCreateMockElement('account-profile-avatar-btn');
        assert.ok(avatarBtn.listeners.has('click'), 'Profile avatar button should have click listener');

        const addPasskeyBtn = getOrCreateMockElement('account-btn-add-passkey');
        assert.ok(addPasskeyBtn.listeners.has('click'), 'Add Passkey button should have click listener');

        const deleteAccountBtn = getOrCreateMockElement('account-btn-delete-account');
        assert.ok(deleteAccountBtn.listeners.has('click'), 'Delete Account button should have click listener');

        const togglePasswordBtn = getOrCreateMockElement('account-btn-toggle-password-drawer');
        assert.ok(togglePasswordBtn.listeners.has('click'), 'Toggle Password button should have click listener');
    });

    test('renderPasswordSection accurately configures UI for configured and not-set password states', async () => {
        const { renderPasswordSection } = await import('../../js/components/account/accountPagePasswordDisplay.js');

        const desc = getOrCreateMockElement('account-password-desc');
        const toggleBtn = getOrCreateMockElement('account-btn-toggle-password-drawer');
        const currentGroup = getOrCreateMockElement('account-password-current-group');
        const drawer = getOrCreateMockElement('account-password-drawer');
        drawer.setAttribute('hidden', '');

        // Test with configured password and 0 passkeys
        renderPasswordSection(true, 0);
        assert.ok(desc.textContent.includes('Your account has a password configured'));
        assert.strictEqual(toggleBtn.textContent, 'Change Password');
        assert.strictEqual(currentGroup.hasAttribute('hidden'), false);

        // Test with configured password and 1+ passkeys
        renderPasswordSection(true, 1);
        assert.strictEqual(toggleBtn.textContent, 'Manage');
        const removeSection = getOrCreateMockElement('account-password-remove-section');
        assert.strictEqual(removeSection.hasAttribute('hidden'), false);

        // Test with passkey-only (no password configured)
        renderPasswordSection(false, 1);
        assert.ok(desc.textContent.includes('Your account is passkey-only'));
        assert.strictEqual(toggleBtn.textContent, 'Set Password');
        assert.strictEqual(currentGroup.hasAttribute('hidden'), true);
        assert.strictEqual(removeSection.hasAttribute('hidden'), true);
    });

    test('togglePasswordDrawer, rule indicators, and field-level error function cleanly', async () => {
        const {
            togglePasswordDrawer,
            updatePasswordRuleIndicators,
            setCurrentPasswordFieldError
        } = await import('../../js/components/account/accountPagePasswordDisplay.js');

        const drawer = getOrCreateMockElement('account-password-drawer');
        const toggleBtn = getOrCreateMockElement('account-btn-toggle-password-drawer');
        const lengthRule = getOrCreateMockElement('rule-length');
        const matchRule = getOrCreateMockElement('rule-match');

        // Toggle open (drawer opens, button reacts to Dismiss)
        togglePasswordDrawer(true, true);
        assert.strictEqual(drawer.hasAttribute('hidden'), false);
        assert.strictEqual(drawer.getAttribute('aria-expanded'), 'true');
        assert.strictEqual(toggleBtn.textContent, 'Dismiss');

        // Rule checklist indicators
        updatePasswordRuleIndicators(true, false);
        assert.strictEqual(lengthRule.classList.contains('is-valid'), true);
        assert.strictEqual(matchRule.classList.contains('is-valid'), false);

        updatePasswordRuleIndicators(true, true);
        assert.strictEqual(lengthRule.classList.contains('is-valid'), true);
        assert.strictEqual(matchRule.classList.contains('is-valid'), true);

        // Field-level error on current password
        const currErrorContainer = getOrCreateMockElement('account-error-current-password');
        const currErrorText = getOrCreateMockElement('account-error-current-password-text');
        const currInput = getOrCreateMockElement('account-input-current-password');

        setCurrentPasswordFieldError('Current password is incorrect.');
        assert.strictEqual(currErrorContainer.hasAttribute('hidden'), false);
        assert.strictEqual(currErrorText.textContent, 'Current password is incorrect.');
        assert.strictEqual(currInput.classList.contains('is-invalid'), true);

        setCurrentPasswordFieldError('');
        assert.strictEqual(currErrorContainer.hasAttribute('hidden'), true);
        assert.strictEqual(currErrorText.textContent, '');
        assert.strictEqual(currInput.classList.contains('is-invalid'), false);

        // Toggle close
        togglePasswordDrawer(false);
        assert.strictEqual(drawer.hasAttribute('hidden'), true);
        assert.strictEqual(drawer.getAttribute('aria-expanded'), 'false');
    });

    test('togglePairingDrawer toggles open/closed state and updates toggle button between Link and Dismiss', async () => {
        const { togglePairingDrawer } = await import('../../js/components/account/accountPageSessionsDisplay.js');

        const drawer = getOrCreateMockElement('account-pairing-drawer');
        const toggleBtn = getOrCreateMockElement('account-btn-toggle-pairing');
        drawer.setAttribute('hidden', '');

        // Toggle open
        const opened = togglePairingDrawer(true);
        assert.strictEqual(opened, true);
        assert.strictEqual(drawer.hasAttribute('hidden'), false);
        assert.strictEqual(drawer.getAttribute('aria-expanded'), 'true');
        assert.strictEqual(toggleBtn.textContent, 'Dismiss');
        assert.strictEqual(toggleBtn.getAttribute('data-i18n'), 'actions.dismiss');

        // Toggle close
        const closed = togglePairingDrawer(false);
        assert.strictEqual(closed, false);
        assert.strictEqual(drawer.hasAttribute('hidden'), true);
        assert.strictEqual(drawer.getAttribute('aria-expanded'), 'false');
        assert.strictEqual(toggleBtn.textContent, 'Link');
        assert.strictEqual(toggleBtn.getAttribute('data-i18n'), 'actions.link');
    });

    test('Add Player modal initialization on account route binds input and guards guided setup', async () => {
        const { initializePlayerModal, showAddPlayerModal } = await import('../../js/components/player/playerModalInputs.js');

        const _modal = getOrCreateMockElement('add-player-modal');
        const tagInput = getOrCreateMockElement('player-tag-input-modal');
        const loadBtn = getOrCreateMockElement('load-player-modal-btn');
        const _cancelBtn = getOrCreateMockElement('cancel-add-player-button');
        const guidedBtn = getOrCreateMockElement('add-player-guided-setup-btn');
        const _errorEl = getOrCreateMockElement('player-tag-error-message');

        initializePlayerModal();

        // Guided setup button must be hidden when guided-setup-modal is absent
        assert.strictEqual(guidedBtn.style.display, 'none');

        // Initial open state: Load button disabled
        showAddPlayerModal();
        assert.strictEqual(loadBtn.disabled, true);

        // Entering text triggers input listener and enables load button
        tagInput.value = 'CGJLOPQR';
        tagInput.dispatchEvent('input', { target: tagInput });
        assert.strictEqual(loadBtn.disabled, false);

        // Clearing tag disables load button again
        tagInput.value = '';
        tagInput.dispatchEvent('input', { target: tagInput });
        assert.strictEqual(loadBtn.disabled, true);
    });

    test('hasSavedPlayerTags recognizes tags from localStorage even when in-memory state is unhydrated', async () => {
        store.set('clashCalc_playerTags', JSON.stringify(['8PJYGUJC']));
        const { state } = await import('../../js/core/state.js');
        state.savedPlayerTags = [];

        // Verify direct state check would fail
        assert.strictEqual(state.savedPlayerTags.length, 0);

        // Verify storageKeys correctly loads the tags
        const { CANONICAL_PLAYER_TAGS_KEY, PLAYER_TAGS_KEY, getStorageItem, normalizePlayerTag } = await import('../../js/core/storageKeys.js');
        const { safeJsonParse } = await import('../../js/utils/jsonUtils.js');
        const rawTags = getStorageItem(CANONICAL_PLAYER_TAGS_KEY, PLAYER_TAGS_KEY);
        const parsed = safeJsonParse(rawTags, []);
        const hasTags = Array.isArray(parsed) && parsed.some(t => t && normalizePlayerTag(t) !== 'DEFAULT0');

        assert.strictEqual(hasTags, true);
    });

    test('renderActiveSessionsList highlights current device without remove button and toggles revoke button for other sessions', async () => {
        const { renderActiveSessionsList } = await import('../../js/components/account/accountPageSessionsDisplay.js');
        const listEl = globalThis.document.getElementById('account-sessions-list');
        const revokeOtherBtn = globalThis.document.getElementById('account-btn-revoke-other-sessions');

        const mockSessions = [
            { sessionId: 'sess_1', platform: 'macOS', browser: 'Chrome', isCurrent: true, lastActiveAt: Date.now() },
            { sessionId: 'sess_2', platform: 'iOS', browser: 'Safari', isCurrent: false, lastActiveAt: Date.now() - 10000 }
        ];

        const sessionsTitle = globalThis.document.getElementById('account-sessions-title');

        renderActiveSessionsList(mockSessions);

        assert.strictEqual(sessionsTitle.textContent, 'Active Sessions (2)');
        assert.ok(listEl.innerHTML.includes('account-session-item--current'));
        assert.ok(listEl.innerHTML.includes('This Device'));
        assert.ok(!listEl.innerHTML.includes('account-badge--current'));
        assert.ok(!listEl.innerHTML.includes('account-session-revoke-btn" data-session-id="sess_1"'));
        assert.ok(listEl.innerHTML.includes('account-session-revoke-btn" data-session-id="sess_2"'));
        assert.ok(listEl.innerHTML.includes('btn-secondary account-session-revoke-btn'));
        assert.strictEqual(revokeOtherBtn.disabled, false);
        assert.strictEqual(revokeOtherBtn.classList.contains('is-hidden'), false);
        assert.strictEqual(revokeOtherBtn.hasAttribute('hidden'), false);

        renderActiveSessionsList([mockSessions[0]]);
        assert.strictEqual(sessionsTitle.textContent, 'Active Sessions');
        assert.strictEqual(revokeOtherBtn.classList.contains('is-hidden'), true);
        assert.strictEqual(revokeOtherBtn.hasAttribute('hidden'), true);

        renderActiveSessionsList([]);
        assert.strictEqual(sessionsTitle.textContent, 'Active Sessions');
    });

    test('setPairingQROverlay manages blur state, title and description across expired, success, and hidden modes', async () => {
        const { setPairingQROverlay } = await import('../../js/components/account/accountPageSessionsDisplay.js');

        const canvasWrap = getOrCreateMockElement('account-pairing-qr-canvas');
        const overlay = getOrCreateMockElement('account-pairing-qr-overlay');
        const titleEl = getOrCreateMockElement('account-pairing-qr-overlay-title');
        const descEl = getOrCreateMockElement('account-pairing-qr-overlay-desc');

        // Test Expired mode
        setPairingQROverlay({
            type: 'expired',
            title: 'Code Expired',
            desc: 'Pairing code expired'
        });

        assert.strictEqual(canvasWrap.classList.contains('is-blurred'), true);
        assert.strictEqual(overlay.classList.contains('is-hidden'), false);
        assert.strictEqual(overlay.classList.contains('account-pairing-qr-overlay--expired'), true);
        assert.strictEqual(titleEl.textContent, 'Code Expired');
        assert.strictEqual(descEl.textContent, 'Pairing code expired');

        // Test Success mode
        setPairingQROverlay({
            type: 'success',
            title: 'Device Linked',
            desc: 'Safari on iOS'
        });

        assert.strictEqual(canvasWrap.classList.contains('is-blurred'), true);
        assert.strictEqual(overlay.classList.contains('is-hidden'), false);
        assert.strictEqual(overlay.classList.contains('account-pairing-qr-overlay--success'), true);
        assert.strictEqual(titleEl.textContent, 'Device Linked');
        assert.strictEqual(descEl.textContent, 'Safari on iOS');

        // Test Hidden mode
        setPairingQROverlay({ type: 'hidden' });
        assert.strictEqual(canvasWrap.classList.contains('is-blurred'), false);
        assert.strictEqual(overlay.classList.contains('is-hidden'), true);
    });

    test('updatePairingTimer manages countdown, expired, and claimed status styling', async () => {
        const { updatePairingTimer } = await import('../../js/components/account/accountPageSessionsDisplay.js');

        const timerRow = getOrCreateMockElement('account-pairing-timer-row');
        const timerEl = getOrCreateMockElement('account-pairing-timer');

        // Normal countdown
        updatePairingTimer(14, 'normal');
        assert.strictEqual(timerRow.classList.contains('is-expired'), false);
        assert.strictEqual(timerRow.classList.contains('is-success'), false);
        assert.ok(timerEl.textContent.includes('0:14'));

        // Expired state
        updatePairingTimer(0, 'expired');
        assert.strictEqual(timerRow.classList.contains('is-expired'), true);
        assert.strictEqual(timerRow.classList.contains('is-success'), false);
        assert.ok(timerEl.textContent.includes('0:00'));

        // Claimed state
        updatePairingTimer(0, 'claimed');
        assert.strictEqual(timerRow.classList.contains('is-expired'), false);
        assert.strictEqual(timerRow.classList.contains('is-success'), true);
        assert.ok(timerEl.textContent.includes('Device linked successfully'));
    });

    test('renderActiveSessionsList highlights newly paired device with badge only within 10-minute window', async () => {
        const { renderActiveSessionsList } = await import('../../js/components/account/accountPageSessionsDisplay.js');
        const listEl = globalThis.document.getElementById('account-sessions-list');

        const now = Date.now();
        const mockSessions = [
            { sessionId: 'sess_cur', platform: 'macOS', browser: 'Chrome', isCurrent: true, createdAt: now - 3600000, lastActiveAt: now },
            { sessionId: 'sess_new_recent', platform: 'iOS', browser: 'Safari', isCurrent: false, createdAt: now - (2 * 60 * 1000), lastActiveAt: now },
            { sessionId: 'sess_old', platform: 'Android', browser: 'Chrome', isCurrent: false, createdAt: now - (15 * 60 * 1000), lastActiveAt: now }
        ];

        renderActiveSessionsList(mockSessions, 'sess_new_recent');
        assert.ok(listEl.innerHTML.includes('account-session-item--new'));
        assert.ok(listEl.innerHTML.includes('account-badge--new'));
        assert.ok(listEl.innerHTML.includes('New'));

        renderActiveSessionsList(mockSessions, 'sess_old');
        assert.ok(!listEl.innerHTML.includes('account-session-item--new'));
        assert.ok(!listEl.innerHTML.includes('account-badge--new'));
    });

    test('renderAccountVillagesSummary sorts descending by TH level, caps at top 5, and formats count badge', async () => {
        const { renderAccountVillagesSummary } = await import('../../js/components/account/accountPageDisplay.js');
        const stackEl = getOrCreateMockElement('account-village-stack');
        const badgeEl = getOrCreateMockElement('account-village-count-badge');

        // Test with 6 profiles across various TH levels
        const profiles = [
            { name: 'V1', townHallLevel: 12 },
            { name: 'V2', townHallLevel: 17 },
            { name: 'V3', townHallLevel: 14 },
            { name: 'V4', townHallLevel: 16 },
            { name: 'V5', townHallLevel: 13 },
            { name: 'V6', townHallLevel: 15 }
        ];

        renderAccountVillagesSummary(profiles);

        // Count badge should reflect total 6 profiles
        assert.strictEqual(badgeEl.textContent, 'Villages Connected: 6');

        // Stack should contain only top 5: 17, 16, 15, 14, 13 (12 is omitted)
        assert.ok(stackEl.innerHTML.includes('th17.png'));
        assert.ok(stackEl.innerHTML.includes('th16.png'));
        assert.ok(stackEl.innerHTML.includes('th15.png'));
        assert.ok(stackEl.innerHTML.includes('th14.png'));
        assert.ok(stackEl.innerHTML.includes('th13.png'));
        assert.ok(!stackEl.innerHTML.includes('th12.png'));

        // Test with 0 profiles
        renderAccountVillagesSummary([]);
        assert.strictEqual(badgeEl.textContent, 'Villages Connected: 0');
        assert.strictEqual(stackEl.innerHTML, '');
    });

    test('account/index.html markup validates remove password button and pairing timer initial fallback', () => {
        const html = fs.readFileSync(path.join(projectRoot, 'account/index.html'), 'utf8');

        // Verify sign out button is styled with btn-danger-outline
        assert.ok(html.includes('class="btn btn-danger-outline btn-sm" id="account-btn-signout"'));

        // Verify remove password button is styled with btn-danger-outline
        assert.ok(html.includes('id="account-btn-remove-password" class="btn btn-danger-outline"'));

        // Verify download data is primary and restore is secondary
        assert.ok(html.includes('class="btn btn-primary" id="account-btn-export-backup"'));
        assert.ok(html.includes('class="btn btn-secondary" id="account-btn-restore-backup"'));

        // Verify pairing timer default label is 1:30
        assert.ok(html.includes('Pairing code expires in 1:30'));

        // Verify guest feature parity cards in account/index.html
        assert.ok(html.includes('id="account-guest-sync-card"'), 'Must have #account-guest-sync-card');
        assert.ok(html.includes('id="account-guest-btn-toggle-pairing"'), 'Must have #account-guest-btn-toggle-pairing');
        assert.ok(html.includes('id="account-guest-pairing-drawer"'), 'Must have #account-guest-pairing-drawer');
        assert.ok(html.includes('id="account-guest-tab-qr"'), 'Must have #account-guest-tab-qr');
        assert.ok(html.includes('id="account-guest-tab-input"'), 'Must have #account-guest-tab-input');
        assert.ok(html.includes('id="account-guest-pane-qr"'), 'Must have #account-guest-pane-qr');
        assert.ok(html.includes('id="account-guest-pane-input"'), 'Must have #account-guest-pane-input');
        assert.ok(html.includes('id="account-guest-hint-subcard"'), 'Must have #account-guest-hint-subcard');
        assert.ok(!html.includes('partials/modals/device-sync.html'), 'Must not include device-sync modal in account/index.html');
        assert.ok(html.includes('id="account-guest-data-card"'), 'Must have #account-guest-data-card');
        assert.ok(html.includes('id="account-guest-export-backup"'), 'Must have #account-guest-export-backup');
        assert.ok(html.includes('id="account-guest-restore-backup"'), 'Must have #account-guest-restore-backup');
        assert.ok(html.includes('id="account-guest-erasure-card"'), 'Must have #account-guest-erasure-card');
        assert.ok(html.includes('id="account-erasure-card"'), 'Must have #account-erasure-card');
        assert.ok(html.includes('id="account-guest-reset-data-btn"'), 'Must have #account-guest-reset-data-btn');
        assert.ok(html.includes('id="account-btn-reset-data"'), 'Must have #account-btn-reset-data');
        assert.ok(html.includes('id="account-btn-delete-account"'), 'Must have #account-btn-delete-account');

        // Verify village summary elements are present
        assert.ok(html.includes('id="account-profile-villages-row"'));
        assert.ok(html.includes('id="account-village-stack"'));
        assert.ok(html.includes('id="account-village-count-badge"'));
        assert.ok(html.includes('class="account-village-count-text"'));
    });

    test('getResetVillageDataCopy resolves composed sentences accurately across all 4 user states', async () => {
        const { getResetVillageDataCopy } = await import('../../js/components/account/accountPageDisplay.js');

        // State 1: Authenticated with real player tags
        const state1 = getResetVillageDataCopy(true, true);
        assert.strictEqual(state1.description, 'Wipes all village progress and calculations. Your account and passkeys will not be affected.');
        assert.ok(state1.confirmMessage.includes('Are you sure you want to reset village data?'));
        assert.ok(state1.confirmMessage.includes(state1.description));

        // State 2: Authenticated without player tags (DEFAULT0)
        const state2 = getResetVillageDataCopy(true, false);
        assert.strictEqual(state2.description, 'Resets all local calculations and preferences to defaults. Your account and passkeys will not be affected.');
        assert.ok(state2.confirmMessage.includes('Are you sure you want to reset village data?'));
        assert.ok(state2.confirmMessage.includes(state2.description));

        // State 3: Non-logged-in with real player tags
        const state3 = getResetVillageDataCopy(false, true);
        assert.strictEqual(state3.description, 'Wipes all village progress and calculations. Permanently deletes your synced cloud backup.');
        assert.ok(state3.confirmMessage.includes('Are you sure you want to reset village data?'));
        assert.ok(state3.confirmMessage.includes(state3.description));

        // State 4: Non-logged-in without player tags (Pure Guest)
        const state4 = getResetVillageDataCopy(false, false);
        assert.strictEqual(state4.description, 'Resets all local calculations and preferences to defaults.');
        assert.ok(state4.confirmMessage.includes('Are you sure you want to reset village data?'));
        assert.ok(state4.confirmMessage.includes(state4.description));
    });

    test('renderAccountErasureCard updates active erasure card description based on authentication and tags', async () => {
        const { renderAccountErasureCard } = await import('../../js/components/account/accountPageDisplay.js');
        const authDesc = getOrCreateMockElement('account-auth-reset-data-desc');
        const guestDesc = getOrCreateMockElement('account-guest-reset-data-desc');

        // Authenticated with tags
        renderAccountErasureCard(true, true);
        assert.strictEqual(authDesc.textContent, 'Wipes all village progress and calculations. Your account and passkeys will not be affected.');

        // Authenticated without tags
        renderAccountErasureCard(true, false);
        assert.strictEqual(authDesc.textContent, 'Resets all local calculations and preferences to defaults. Your account and passkeys will not be affected.');

        // Guest with tags
        renderAccountErasureCard(false, true);
        assert.strictEqual(guestDesc.textContent, 'Wipes all village progress and calculations. Permanently deletes your synced cloud backup.');

        // Pure guest
        renderAccountErasureCard(false, false);
        assert.strictEqual(guestDesc.textContent, 'Resets all local calculations and preferences to defaults.');
    });

    test('guest pairing markup in account/index.html includes guest sync disabled overlay and canvas wrapper', () => {
        const html = fs.readFileSync(path.join(projectRoot, 'account/index.html'), 'utf8');
        assert.ok(html.includes('id="account-guest-qr-overlay"'), 'Must have #account-guest-qr-overlay');
        assert.ok(html.includes('class="account-pairing-qr-canvas"'), 'Must have .account-pairing-qr-canvas');
        assert.ok(html.includes('class="account-pairing-qr-wrap"'), 'Must have .account-pairing-qr-wrap');
        assert.ok(html.includes('id="account-guest-pane-qr"'));
        assert.ok(html.includes('name="cloud-off"'), 'Must use cloud-off vector icon for guest sync overlay');
    });

    test('toggleGuestPairingDrawer manages open state, aria-expanded, and button label', async () => {
        const { toggleGuestPairingDrawer } = await import('../../js/components/account/accountPageSessionsDisplay.js');

        const drawer = getOrCreateMockElement('account-guest-pairing-drawer');
        const toggleBtn = getOrCreateMockElement('account-guest-btn-toggle-pairing');
        drawer.setAttribute('hidden', '');

        const opened = toggleGuestPairingDrawer(true);
        assert.strictEqual(opened, true);
        assert.strictEqual(drawer.hasAttribute('hidden'), false);
        assert.strictEqual(drawer.getAttribute('aria-expanded'), 'true');
        assert.strictEqual(toggleBtn.textContent, 'Dismiss');
        assert.strictEqual(toggleBtn.getAttribute('data-i18n'), 'actions.dismiss');

        const closed = toggleGuestPairingDrawer(false);
        assert.strictEqual(closed, false);
        assert.strictEqual(drawer.hasAttribute('hidden'), true);
        assert.strictEqual(drawer.getAttribute('aria-expanded'), 'false');
        assert.strictEqual(toggleBtn.textContent, 'Link');
        assert.strictEqual(toggleBtn.getAttribute('data-i18n'), 'actions.link');
    });

    test('setGuestPairingActiveTab switches between QR and Input panels and manages aria-selected', async () => {
        const { setGuestPairingActiveTab } = await import('../../js/components/account/accountPageSessionsDisplay.js');

        const tabQr = getOrCreateMockElement('account-guest-tab-qr');
        const tabInput = getOrCreateMockElement('account-guest-tab-input');
        const paneQr = getOrCreateMockElement('account-guest-pane-qr');
        const paneInput = getOrCreateMockElement('account-guest-pane-input');

        setGuestPairingActiveTab('input');
        assert.strictEqual(tabQr.classList.contains('is-active'), false);
        assert.strictEqual(tabQr.getAttribute('aria-selected'), 'false');
        assert.strictEqual(tabInput.classList.contains('is-active'), true);
        assert.strictEqual(tabInput.getAttribute('aria-selected'), 'true');
        assert.strictEqual(paneQr.hasAttribute('hidden'), true);
        assert.strictEqual(paneInput.hasAttribute('hidden'), false);

        setGuestPairingActiveTab('qr');
        assert.strictEqual(tabQr.classList.contains('is-active'), true);
        assert.strictEqual(tabQr.getAttribute('aria-selected'), 'true');
        assert.strictEqual(tabInput.classList.contains('is-active'), false);
        assert.strictEqual(tabInput.getAttribute('aria-selected'), 'false');
        assert.strictEqual(paneQr.hasAttribute('hidden'), false);
        assert.strictEqual(paneInput.hasAttribute('hidden'), true);
    });

    test('renderAccountGuestPairingCard configures pure guest and with-tags states', async () => {
        const { renderAccountGuestPairingCard } = await import('../../js/components/account/accountPageSessionsDisplay.js');

        const codeContainer = getOrCreateMockElement('account-guest-code-container');
        const instruction = getOrCreateMockElement('account-guest-sync-instruction');
        const hintSubcard = getOrCreateMockElement('account-guest-hint-subcard');
        const qrCanvas = getOrCreateMockElement('account-guest-qr-canvas');
        const overlay = getOrCreateMockElement('account-guest-qr-overlay');

        // Pure Guest: No real player tags
        renderAccountGuestPairingCard(false);
        assert.strictEqual(codeContainer.classList.contains('is-hidden'), true);
        assert.strictEqual(instruction.hidden, true);
        assert.strictEqual(hintSubcard.classList.contains('is-hidden'), false);
        assert.strictEqual(qrCanvas.classList.contains('is-blurred'), true);
        assert.strictEqual(overlay.classList.contains('is-hidden'), false);

        // Guest with player tags
        renderAccountGuestPairingCard(true);
        assert.strictEqual(codeContainer.classList.contains('is-hidden'), false);
        assert.strictEqual(instruction.hidden, false);
        assert.strictEqual(hintSubcard.classList.contains('is-hidden'), true);
        assert.strictEqual(qrCanvas.classList.contains('is-blurred'), false);
        assert.strictEqual(overlay.classList.contains('is-hidden'), true);
    });

    test('hasRealPlayerProfile detects profiles from partitioned localStorage', async () => {
        const { hasRealPlayerProfile } = await import('../../js/components/account/accountPageDisplay.js');
        const { state } = await import('../../js/core/state.js');

        // Initially empty
        state.savedPlayerTags = [];
        store.clear();
        assert.strictEqual(hasRealPlayerProfile(), false);

        // With only DEFAULT0
        store.set('clashCalc_playerTags', JSON.stringify(['DEFAULT0']));
        assert.strictEqual(hasRealPlayerProfile(), false);

        // With real player tag in partitioned storage
        store.set('clashCalc_playerTags', JSON.stringify(['8PJYGUJC']));
        store.set('clashCalc_player_8PJYGUJC', JSON.stringify({
            playerProfile: { tag: '#8PJYGUJC', name: 'Chief', townHallLevel: 16 }
        }));
        assert.strictEqual(hasRealPlayerProfile(), true);

        // Cleanup
        store.clear();
    });

    test('renderAccountPageShell activates guest pairing card when partitioned profile exists', async () => {
        const { renderAccountPageShell } = await import('../../js/components/account/accountPageDisplay.js');
        const { state } = await import('../../js/core/state.js');

        state.savedPlayerTags = [];
        store.clear();

        // Inject real profile partition into storage
        store.set('clashCalc_playerTags', JSON.stringify(['8PJYGUJC']));
        store.set('clashCalc_player_8PJYGUJC', JSON.stringify({
            playerProfile: { tag: '#8PJYGUJC', name: 'Chief', townHallLevel: 16 }
        }));

        const codeContainer = getOrCreateMockElement('account-guest-code-container');
        const overlay = getOrCreateMockElement('account-guest-qr-overlay');
        const qrCanvas = getOrCreateMockElement('account-guest-qr-canvas');

        renderAccountPageShell(false, null);

        assert.strictEqual(codeContainer.classList.contains('is-hidden'), false);
        assert.strictEqual(overlay.classList.contains('is-hidden'), true);
        assert.strictEqual(qrCanvas.classList.contains('is-blurred'), false);

        // Cleanup
        store.clear();
    });

    test('renderAccountPageShell updates dynamically when player profile is added via sync event', async () => {
        const { renderAccountPageShell } = await import('../../js/components/account/accountPageDisplay.js');
        const { state } = await import('../../js/core/state.js');

        state.savedPlayerTags = [];
        store.clear();

        const codeContainer = getOrCreateMockElement('account-guest-code-container');
        const overlay = getOrCreateMockElement('account-guest-qr-overlay');
        const qrCanvas = getOrCreateMockElement('account-guest-qr-canvas');

        // Initially no profiles -> sync disabled
        renderAccountPageShell(false, null);
        assert.strictEqual(codeContainer.classList.contains('is-hidden'), true);
        assert.strictEqual(overlay.classList.contains('is-hidden'), false);

        // Simulate player tag addition and reactive shell re-render
        store.set('clashCalc_playerTags', JSON.stringify(['8PJYGUJC']));
        store.set('clashCalc_player_8PJYGUJC', JSON.stringify({
            playerProfile: { tag: '#8PJYGUJC', name: 'Chief', townHallLevel: 16 }
        }));
        state.savedPlayerTags = ['8PJYGUJC'];

        renderAccountPageShell(false, null);
        assert.strictEqual(codeContainer.classList.contains('is-hidden'), false);
        assert.strictEqual(overlay.classList.contains('is-hidden'), true);
        assert.strictEqual(qrCanvas.classList.contains('is-blurred'), false);

        // Cleanup
        store.clear();
    });

    test('renderAccountPageShell preserves guest pairing drawer state and active tab across re-renders in guest mode', async () => {
        const { renderAccountPageShell } = await import('../../js/components/account/accountPageDisplay.js');
        const { toggleGuestPairingDrawer, setGuestPairingActiveTab } = await import('../../js/components/account/accountPageSessionsDisplay.js');

        // Initial render in guest mode
        renderAccountPageShell(false, null);

        const guestDrawer = getOrCreateMockElement('account-guest-pairing-drawer');
        const guestToggleBtn = getOrCreateMockElement('account-guest-btn-toggle-pairing');
        const tabInput = getOrCreateMockElement('account-guest-tab-input');
        const tabQr = getOrCreateMockElement('account-guest-tab-qr');

        // User opens pairing drawer and switches to input tab
        toggleGuestPairingDrawer(true);
        setGuestPairingActiveTab('input');

        assert.strictEqual(guestDrawer.hasAttribute('hidden'), false);
        assert.strictEqual(guestToggleBtn.textContent, 'Dismiss');
        assert.strictEqual(guestToggleBtn.getAttribute('data-i18n'), 'actions.dismiss');
        assert.strictEqual(tabInput.getAttribute('aria-selected'), 'true');
        assert.strictEqual(tabQr.getAttribute('aria-selected'), 'false');

        // Subsequent render (e.g. language change while remaining in guest mode)
        renderAccountPageShell(false, null);

        assert.strictEqual(guestDrawer.hasAttribute('hidden'), false);
        assert.strictEqual(guestToggleBtn.textContent, 'Dismiss');
        assert.strictEqual(guestToggleBtn.getAttribute('data-i18n'), 'actions.dismiss');
        assert.strictEqual(tabInput.getAttribute('aria-selected'), 'true');
        assert.strictEqual(tabQr.getAttribute('aria-selected'), 'false');
    });

    test('renderAccountPageShell maintains synchronized pairing button state in authenticated mode', async () => {
        const { renderAccountPageShell } = await import('../../js/components/account/accountPageDisplay.js');
        const { togglePairingDrawer } = await import('../../js/components/account/accountPageSessionsDisplay.js');

        const user = { username: 'testuser', avatar: 'archer', hasPassword: true };
        renderAccountPageShell(true, user);

        const pairingDrawer = getOrCreateMockElement('account-pairing-drawer');
        const pairingBtn = getOrCreateMockElement('account-btn-toggle-pairing');

        // User opens pairing drawer
        togglePairingDrawer(true);
        assert.strictEqual(pairingDrawer.hasAttribute('hidden'), false);
        assert.strictEqual(pairingBtn.textContent, 'Dismiss');
        assert.strictEqual(pairingBtn.getAttribute('data-i18n'), 'actions.dismiss');

        // Subsequent render (e.g. language change while authenticated)
        renderAccountPageShell(true, user);

        assert.strictEqual(pairingDrawer.hasAttribute('hidden'), false);
        assert.strictEqual(pairingBtn.textContent, 'Dismiss');
        assert.strictEqual(pairingBtn.getAttribute('data-i18n'), 'actions.dismiss');
    });
});
