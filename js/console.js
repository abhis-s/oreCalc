import { state } from './core/state.js';
import { handleStateUpdate } from './core/stateManager.js';

if (typeof window !== 'undefined') {
    /**
     * Resets the tour completion timestamp and initiates the interactive onboarding tour.
     * When invoked outside the Ore Calculator page, safely resets the tour timestamp in persistent state
     * and advises navigating to /ore-calculator/.
     * @param {string} [setId] - Optional tour set identifier to run a specific tour cohort.
     * @returns {Promise<string>} Status message describing the tour initiation outcome.
     */
    window.startTour = async (setId) => {
        const isOreCalc = typeof window.location?.pathname === 'string' &&
            window.location.pathname.includes('/ore-calculator');

        if (!isOreCalc) {
            handleStateUpdate(() => {
                if (state.uiSettings?.uiTimestamps) {
                    delete state.uiSettings.uiTimestamps.tour;
                }
            });
            return 'Tour is designed for the Ore Calculator page (/ore-calculator/). The tour completion timestamp has been reset, so it will start when you navigate to the Ore Calculator.';
        }

        const module = await import('./components/tour/appTour.js');
        if (!setId) {
            handleStateUpdate(() => {
                if (state.uiSettings?.uiTimestamps) {
                    delete state.uiSettings.uiTimestamps.tour;
                }
            });
        }
        await module.startTour(setId);
        return setId ? `Tour started for set: ${setId}` : 'Tour reset and started from the beginning.';
    };

    /**
     * Resets the tour completion timestamp so the onboarding tour triggers on next visit or invocation.
     * @returns {string} Status message confirming the tour timestamp reset.
     */
    window.resetTour = () => {
        handleStateUpdate(() => {
            if (state.uiSettings?.uiTimestamps) {
                delete state.uiSettings.uiTimestamps.tour;
            }
        });
        return 'Tour timestamp reset. Navigate to or reload the Ore Calculator page (/ore-calculator/) to start the tour.';
    };

    console.info(
        '%c ClashCalc Console Commands:\n\n' +
        '%c  startTour(setId):       %c[Ore Calculator] %cResets and starts tour from beginning (or optionally for a specific set, e.g., \'v1.0\').\n' +
        '%c  resetTour():            %c[Ore Calculator] %cResets the tour completion state so it triggers again.\n\n' +
        '%c For more information, refer to the documentation.',
        'color: #4facfe; font-weight: bold;',
        'color: #a5d6a7; font-weight: bold;', 'color: #ffb74d; font-weight: 600;', 'color: #e3e2e6;',
        'color: #a5d6a7; font-weight: bold;', 'color: #ffb74d; font-weight: 600;', 'color: #e3e2e6;',
        'color: #bdc1c6; font-style: italic;'
    );
}
