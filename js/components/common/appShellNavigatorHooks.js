/**
 * ClashCalc Navigator UI Lifecycle Hooks.
 * Tier 4: Common Presentation Subsystem.
 * Bridges persistent app shell navigation with interactive UI subsystems.
 */

import { registerNavigatorUiHooks } from '../../core/appShellNavigator.js';
import { closeDrawerInternal } from './navigationDrawer.js';
import { renderNavigationDrawerContent } from './navigationDrawerRenderer.js';
import { showRouteTransitionLoader } from './routeTransitionLoader.js';
import { resetPlayerDropdownState } from '../player/playerDropdownInputs.js';
import { resetPlayerModalState } from '../player/playerModalInputs.js';

/**
 * Initializes and wires UI presentation hooks into the persistent app shell navigator.
 */
export function setupNavigatorUiHooks() {
    registerNavigatorUiHooks({
        onResetPlayerDropdown: () => {
            resetPlayerDropdownState();
        },
        onResetPlayerModal: () => {
            resetPlayerModalState();
        },
        onShowLoader: (mainEl) => {
            showRouteTransitionLoader(mainEl);
        },
        onUpdateDrawer: ({ activeTool }) => {
            renderNavigationDrawerContent({ activeTool });
        },
        onCloseDrawer: (drawerEl) => {
            closeDrawerInternal(drawerEl);
        }
    });
}
