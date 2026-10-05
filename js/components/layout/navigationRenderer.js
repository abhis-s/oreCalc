import { navigationRegistry } from '../../data/navigationRegistry.js';
import { updateNavigationBadges } from '../modals/updateModal.js';
import { renderNavigationDrawerContent } from '../common/navigationDrawerRenderer.js';
import { state } from '../../core/state.js';
import { selectActivePlayerTag, selectPlayerProfile } from '../../core/selectors.js';
import { handlePlayerSelection } from '../player/playerDropdownInputs.js';
import { showAddPlayerModal } from '../player/playerModalInputs.js';
import { navigateToTab } from './tabs.js';

import { renderBottomNavBar } from '../common/bottomNavBar.js';

/**
 * Renders and synchronizes active states across bottom navigation bar, drawer list, and update badges.
 * @param {string} activeTabId - ID of currently active tab (e.g. 'home-tab', 'income').
 */
export function renderNavigation(activeTabId) {
    renderBottomNav(activeTabId);
    renderNavigationDrawer(activeTabId);
    updateNavigationBadges();
}

function renderBottomNav(activeTabId) {
    const container = document.querySelector('.bottom-nav-bar');
    if (!container) return;

    renderBottomNavBar({
        container,
        items: navigationRegistry,
        activeTabId
    });
}

function renderNavigationDrawer(activeTabId) {
    const rawTag = selectActivePlayerTag(state);
    const playerProfile = selectPlayerProfile(state);

    const isRealPlayer = rawTag && rawTag !== 'DEFAULT0' && rawTag !== 'GUEST';
    const cleanTag = isRealPlayer ? rawTag.replace(/^#/, '') : '';

    renderNavigationDrawerContent({
        activeTool: 'ore-calculator',
        activeView: activeTabId,
        playerTag: cleanTag,
        profileData: isRealPlayer ? {
            name: playerProfile?.name,
            tag: cleanTag ? `#${cleanTag}` : '',
            townHallLevel: playerProfile?.townHallLevel || 18,
            trophies: playerProfile?.trophies,
            cachedData: playerProfile
        } : null,
        onViewSelect: (tabId) => navigateToTab(tabId),
        onAccountSwitch: (targetTag) => handlePlayerSelection(targetTag),
        onGuestLoad: () => showAddPlayerModal()
    });
}
