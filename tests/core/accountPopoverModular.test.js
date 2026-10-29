import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Mock window and document environment for Node.js test runner
if (typeof globalThis.history === 'undefined') {
    globalThis.history = {
        replaceState: () => {}
    };
}

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        location: {
            hostname: 'localhost',
            origin: 'http://localhost:8080',
            pathname: '/ore-calculator/',
            search: '',
            hash: '',
            href: 'http://localhost:8080/ore-calculator/'
        },
        history: globalThis.history
    };
}

describe('Account Popover Modularity & Pre-Rendered Panels Domain Suite', () => {
    let elements;
    let panelsMap;
    let queryListeners;
    let configureAccountPopover;
    let togglePopoverPanel;
    let initializeSettingsAccount;

    function createMockElement(id, tagName = 'div', attributes = {}) {
        const classList = new Set();
        const attrs = new Map(Object.entries(attributes));
        const listeners = new Map();
        let innerHtml = '';

        const el = {
            id,
            tagName: tagName.toUpperCase(),
            classList: {
                add: (c) => classList.add(c),
                remove: (c) => classList.delete(c),
                contains: (c) => classList.has(c),
                toggle: (c, force) => {
                    const add = force !== undefined ? force : !classList.has(c);
                    if (add) classList.add(c);
                    else classList.delete(c);
                    return add;
                }
            },
            setAttribute: (k, v) => attrs.set(k, String(v)),
            getAttribute: (k) => attrs.get(k) ?? null,
            removeAttribute: (k) => attrs.delete(k),
            hasAttribute: (k) => attrs.has(k),
            addEventListener: (ev, cb) => {
                if (!listeners.has(ev)) listeners.set(ev, []);
                listeners.get(ev).push(cb);
            },
            dispatchEvent: (event) => {
                const arr = listeners.get(event.type) || [];
                arr.forEach(cb => cb(event));
            },
            querySelector: (sel) => {
                if (sel === '.account-popover-panel-summary') {
                    return elements.get(`${id}-summary`) || null;
                }
                return null;
            },
            querySelectorAll: () => [],
            appendChild: (child) => {
                if (child.id) elements.set(child.id, child);
                return child;
            },
            get innerHTML() { return innerHtml; },
            set innerHTML(html) { innerHtml = html; },
            style: {}
        };

        elements.set(id, el);
        return el;
    }

    beforeEach(async () => {
        elements = new Map();
        panelsMap = new Map();
        queryListeners = new Map();

        // Standard popover DOM elements
        createMockElement('app-account-popover');
        createMockElement('account-popover-manage-btn', 'a', { href: '/account/', 'data-popover-option': 'account-sync' });
        createMockElement('account-popover-avatar-btn', 'a', { href: '/account/' });
        createMockElement('account-popover-install-btn', 'button', { 'data-popover-option': 'install' });
        createMockElement('account-popover-guest-install-btn', 'button', { 'data-popover-option': 'install' });
        createMockElement('account-popover-logout-btn', 'button', { 'data-popover-option': 'logout' });
        createMockElement('account-popover-panel-divider', 'hr');
        createMockElement('account-popover-panels', 'div');

        // Settings built-in panel
        const settingsPanel = createMockElement('account-popover-prefs-details', 'div', { 'data-popover-panel': 'settings' });
        const settingsSummary = createMockElement('account-popover-prefs-details-summary', 'button', {
            'aria-expanded': 'false',
            id: 'account-popover-prefs-summary'
        });
        elements.set('account-popover-prefs-summary', settingsSummary);
        panelsMap.set('settings', settingsPanel);

        // Header button and account profile card elements
        createMockElement('header-account-btn', 'button');
        createMockElement('header-account-icon-wrapper', 'span');
        createMockElement('header-account-avatar-img', 'img');
        createMockElement('account-popover-username', 'span');
        createMockElement('account-popover-avatar-img', 'img');
        createMockElement('account-popover-auth-section', 'div');
        createMockElement('account-popover-guest-section', 'div');

        globalThis.document = {
            getElementById: (id) => elements.get(id) || null,
            querySelector: (sel) => {
                if (sel === '[data-popover-panel="settings"]') return panelsMap.get('settings');
                const panelMatch = sel.match(/\[data-popover-panel="([^"]+)"\]/);
                if (panelMatch) return panelsMap.get(panelMatch[1]) || null;
                return null;
            },
            querySelectorAll: (sel) => {
                if (sel === '[data-popover-panel]') return Array.from(panelsMap.values());
                return [];
            },
            createElement: (tag) => {
                const dummyId = `mock-${Date.now()}-${Math.random()}`;
                return createMockElement(dummyId, tag);
            },
            addEventListener: (event, cb) => {
                if (!queryListeners.has(event)) queryListeners.set(event, []);
                queryListeners.get(event).push(cb);
            },
            removeEventListener: () => {}
        };

        // Attach querySelectorAll on app-account-popover mock
        const popoverEl = elements.get('app-account-popover');
        popoverEl.querySelectorAll = (sel) => {
            if (sel === '[data-popover-panel]') return Array.from(panelsMap.values());
            return [];
        };

        const displayModule = await import('../../js/components/appSettings/settingsAccountDisplay.js');
        const inputsModule = await import('../../js/components/appSettings/settingsAccountInputs.js');

        configureAccountPopover = displayModule.configureAccountPopover;
        togglePopoverPanel = displayModule.togglePopoverPanel;
        initializeSettingsAccount = inputsModule.initializeSettingsAccount;
    });

    it('verifies default popover options preserve standard navigation and collapsed panels', () => {
        initializeSettingsAccount();

        const manageBtn = elements.get('account-popover-manage-btn');
        const avatarBtn = elements.get('account-popover-avatar-btn');
        const logoutBtn = elements.get('account-popover-logout-btn');
        const settingsPanel = panelsMap.get('settings');
        const settingsSummary = elements.get('account-popover-prefs-summary');

        // Manage button is visible and links to /account/
        assert.ok(!manageBtn.classList.contains('is-hidden'), 'Manage button must be visible by default');
        assert.ok(!manageBtn.hasAttribute('hidden'), 'Manage button must not declare hidden attribute');

        // Avatar button is clickable and links to /account/
        assert.equal(avatarBtn.getAttribute('href'), '/account/');
        assert.ok(!avatarBtn.classList.contains('is-static'), 'Avatar must not have is-static by default');
        assert.equal(avatarBtn.getAttribute('role'), null);

        // Sign out button is always present (hardcoded invariant)
        assert.ok(logoutBtn, 'Sign out button must always be present');
        assert.ok(!logoutBtn.classList.contains('is-hidden'), 'Sign out button must not be hidden');

        // Settings panel is present and collapsed by default
        assert.ok(!settingsPanel.classList.contains('is-hidden'), 'Settings panel must be visible by default');
        assert.ok(!settingsPanel.classList.contains('is-expanded'), 'Settings panel must be collapsed by default');
        assert.equal(settingsSummary.getAttribute('aria-expanded'), 'false');
    });

    it('verifies account page options omit Account & Sync and disable avatar clicking', () => {
        initializeSettingsAccount({
            hasAccountSync: false,
            hasClickableAvatar: false
        });

        const manageBtn = elements.get('account-popover-manage-btn');
        const avatarBtn = elements.get('account-popover-avatar-btn');
        const logoutBtn = elements.get('account-popover-logout-btn');

        // Manage button is hidden
        assert.ok(manageBtn.classList.contains('is-hidden'), 'Manage button must be hidden on account page');
        assert.ok(manageBtn.hasAttribute('hidden'), 'Manage button must declare hidden attribute');

        // Avatar is unclickable presentation element
        assert.equal(avatarBtn.getAttribute('href'), null, 'Avatar link href must be removed');
        assert.equal(avatarBtn.getAttribute('role'), 'img', 'Avatar must declare role="img"');
        assert.equal(avatarBtn.getAttribute('tabindex'), '-1', 'Avatar must declare tabindex="-1"');
        assert.equal(avatarBtn.getAttribute('aria-disabled'), 'true', 'Avatar must declare aria-disabled="true"');
        assert.ok(avatarBtn.classList.contains('is-static'), 'Avatar must have is-static class');

        // Sign out remains present and non-removable
        assert.ok(logoutBtn, 'Sign out button must remain present');
        assert.ok(!logoutBtn.classList.contains('is-hidden'), 'Sign out button must not be hidden');

        // Dynamic re-configuration via configureAccountPopover restores options
        configureAccountPopover({
            hasAccountSync: true,
            hasClickableAvatar: true
        });
        assert.ok(!manageBtn.classList.contains('is-hidden'), 'Manage button must become visible after re-configuration');
        assert.equal(avatarBtn.getAttribute('href'), '/account/', 'Avatar href must be restored after re-configuration');
    });

    it('supports explicit panel expansion on a panel-by-panel basis', () => {
        initializeSettingsAccount({
            expandedPanels: ['settings']
        });

        const settingsPanel = panelsMap.get('settings');
        const settingsSummary = elements.get('account-popover-prefs-summary');

        assert.ok(settingsPanel.classList.contains('is-expanded'), 'Settings panel must be expanded when requested');
        assert.equal(settingsSummary.getAttribute('aria-expanded'), 'true');

        // Toggle via function
        togglePopoverPanel('settings', false);
        assert.ok(!settingsPanel.classList.contains('is-expanded'), 'Settings panel must collapse when toggled');
        assert.equal(settingsSummary.getAttribute('aria-expanded'), 'false');
    });

    it('supports disabling built-in settings panel in whole and hides divider when no panels remain', () => {
        initializeSettingsAccount({
            hasSettingsPanel: false
        });

        const settingsPanel = panelsMap.get('settings');
        const divider = elements.get('account-popover-panel-divider');

        assert.ok(settingsPanel.classList.contains('is-hidden'), 'Settings panel must be hidden in whole');
        assert.ok(settingsPanel.hasAttribute('hidden'));

        // Since no visible panels remain, divider must also be hidden
        assert.ok(divider.classList.contains('is-hidden'), 'Divider must be hidden when all panels are disabled');
        assert.ok(divider.hasAttribute('hidden'));
    });

    it('ensures backward compatibility for spotright open property setter/getter on settings panel', () => {
        initializeSettingsAccount();

        const settingsPanel = elements.get('account-popover-prefs-details');
        assert.ok(settingsPanel, '#account-popover-prefs-details must exist for spotright');

        // Initial state is closed
        assert.equal(settingsPanel.open, false);

        // Spotright opens settings
        settingsPanel.open = true;
        assert.equal(settingsPanel.open, true);
        assert.ok(settingsPanel.classList.contains('is-expanded'));

        // Spotright closes settings
        settingsPanel.open = false;
        assert.equal(settingsPanel.open, false);
        assert.ok(!settingsPanel.classList.contains('is-expanded'));
    });

    it('guards against duplicate click listener binding on persistent header account button', () => {
        const headerBtn = elements.get('header-account-btn');
        let clickListenerCount = 0;
        const originalAddEventListener = headerBtn.addEventListener;
        headerBtn.addEventListener = (ev, cb) => {
            if (ev === 'click') clickListenerCount++;
            originalAddEventListener(ev, cb);
        };

        // Reset initialized state on mock
        headerBtn.removeAttribute('data-account-initialized');

        initializeSettingsAccount();
        assert.equal(clickListenerCount, 1, 'First initialization must bind click listener');

        // Subsequent route transition calls must not attach duplicate listeners
        initializeSettingsAccount();
        initializeSettingsAccount();
        assert.equal(clickListenerCount, 1, 'Subsequent initializations must not bind duplicate click listeners');
    });

    it('manages PWA install button visibility with progressive capability disclosure', () => {
        const installBtn = elements.get('account-popover-install-btn');
        const guestInstallBtn = elements.get('account-popover-guest-install-btn');
        const setUserAgent = (ua) => {
            Object.defineProperty(globalThis.navigator, 'userAgent', { value: ua, configurable: true, writable: true });
        };

        globalThis.window.matchMedia = () => ({ matches: false });
        setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0');
        configureAccountPopover();
        assert.ok(installBtn.classList.contains('is-hidden'), 'Install button must remain hidden on unsupported browsers');
        assert.equal(installBtn.hasAttribute('hidden'), true);

        setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1');
        configureAccountPopover();
        assert.ok(!installBtn.classList.contains('is-hidden'), 'Install button must be revealed on iOS Safari');
        assert.equal(installBtn.hasAttribute('hidden'), false);

        setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15');
        Object.defineProperty(globalThis.navigator, 'maxTouchPoints', { value: 0, configurable: true, writable: true });
        configureAccountPopover();
        assert.ok(!installBtn.classList.contains('is-hidden'), 'Install button must be revealed on macOS Safari 17+');
        assert.equal(installBtn.hasAttribute('hidden'), false);

        setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15');
        Object.defineProperty(globalThis.navigator, 'maxTouchPoints', { value: 5, configurable: true, writable: true });
        configureAccountPopover();
        assert.ok(!installBtn.classList.contains('is-hidden'), 'Install button must be revealed on iPadOS Safari');
        assert.equal(installBtn.hasAttribute('hidden'), false);

        setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1 Brave/1.62');
        configureAccountPopover();
        assert.ok(installBtn.classList.contains('is-hidden'), 'Install button must be hidden on Brave iOS');
        assert.equal(installBtn.hasAttribute('hidden'), true);

        globalThis.window.matchMedia = (q) => ({ matches: q.includes('standalone') });
        setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1');
        configureAccountPopover();
        assert.ok(installBtn.classList.contains('is-hidden'), 'Install button must be hidden when already in standalone mode');
        assert.equal(installBtn.hasAttribute('hidden'), true);
        assert.ok(guestInstallBtn.classList.contains('is-hidden'));
        assert.equal(guestInstallBtn.hasAttribute('hidden'), true);
    });
});
