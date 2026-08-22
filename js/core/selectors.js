/**
 * selectors.js
 * Pure, zero-copy state selectors for reading state slices.
 */

/**
 * Selects the active player tag from state.
 *
 * @param {import('./types.js').AppState} state - Application state.
 * @returns {string} Active player tag.
 */
export const selectActivePlayerTag = (state) => state?.savedPlayerTags?.[0] || 'DEFAULT0';

/**
 * Selects the active player's partition data from allPlayersData.
 *
 * @param {import('./types.js').AppState} state - Application state.
 * @returns {import('./types.js').PlayerData | null} Player partition or null.
 */
export const selectActivePlayer = (state) => {
    const tag = selectActivePlayerTag(state);
    return state?.allPlayersData?.[tag] || null;
};

/**
 * Selects the active player's heroes map.
 *
 * @param {import('./types.js').AppState} state - Application state.
 * @returns {Record<string, import('./types.js').HeroItem>} Heroes map.
 */
export const selectActiveHeroes = (state) => state?.heroes || selectActivePlayer(state)?.heroes || {};

/**
 * Immutable zero ore quantity singleton.
 * @type {Readonly<import('./types.js').OreQuantity>}
 */
export const ZERO_ORES = Object.freeze({ shiny: 0, glowy: 0, starry: 0 });

/**
 * Selects the active player's stored ores inventory.
 *
 * @param {import('./types.js').AppState} state - Application state.
 * @returns {import('./types.js').OreQuantity} Stored ores quantity.
 */
export const selectStoredOres = (state) => state?.storedOres || selectActivePlayer(state)?.storedOres || ZERO_ORES;

/**
 * Selects the active player's income configuration state.
 *
 * @param {import('./types.js').AppState} state - Application state.
 * @returns {import('./types.js').IncomeSourcesState} Income settings.
 */
export const selectIncome = (state) => state?.income || selectActivePlayer(state)?.income || {};

/**
 * Selects the active player's planner state.
 *
 * @param {import('./types.js').AppState} state - Application state.
 * @returns {import('./types.js').PlannerState} Planner state.
 */
export const selectPlanner = (state) => state?.planner || selectActivePlayer(state)?.planner || {};

/**
 * Selects the active player's Supercell profile.
 *
 * @param {import('./types.js').AppState} state - Application state.
 * @returns {import('./types.js').PlayerProfile | null} Player profile or null.
 */
export const selectPlayerProfile = (state) => state?.playerProfile || selectActivePlayer(state)?.playerProfile || null;

/**
 * Selects the active player's Hero Journey progression state.
 *
 * @param {import('./types.js').AppState} state - Application state.
 * @returns {import('./types.js').HeroJourneyState | null} Hero journey state or null.
 */
export const selectHeroJourney = (state) => state?.heroJourney || selectActivePlayer(state)?.heroJourney || null;

/**
 * Selects the derived calculated output state.
 *
 * @param {import('./types.js').AppState | any} state - Application state.
 * @returns {import('./types.js').DerivedState | Record<string, any>} Derived state.
 */
export const selectDerived = (state) => state?.derived || {};

/**
 * Selects the derived income rates for a specific income source and timeframe.
 *
 * @param {import('./types.js').AppState} state - Application state.
 * @param {string} sourceId - Income source key (e.g. 'starBonus', 'raidMedalTrader').
 * @param {string} [timeframe='monthly'] - Target timeframe key ('daily', 'weekly', 'monthly', 'bimonthly', 'perEvent', 'baseDaily').
 * @returns {import('./types.js').OreQuantity} Derived ore quantity or immutable zero fallback.
 */
export const selectDerivedSourceIncome = (state, sourceId, timeframe = 'monthly') => {
    return state?.derived?.incomeSources?.[sourceId]?.[timeframe] || ZERO_ORES;
};

/**
 * Selects the global UI preferences.
 *
 * @param {import('./types.js').AppState | any} state - Application state.
 * @returns {import('./types.js').UISettingsState | Record<string, any>} UI settings state.
 */
export const selectUISettings = (state) => state?.uiSettings || {};
