import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';

import { addValidation } from '../../utils/inputValidator.js';
import { adjustWarRates } from '../../utils/incomeUtils.js';
import { registerInputPopover } from '../../utils/inputPopoverProvider.js';
import { translate } from '../../i18n/translator.js';
import { warOreTownHallValues } from '../../data/incomeSources/warOres.js';
import { logger } from '../../utils/logger.js';

let calculatedCwlStats = {
    clanTag: null,
    winRate: 50,
    drawRate: 0,
    hitsCount: 7,
    hasCalculated: false,
    isFetching: false
};

function updateCalculatedStatsFromCache() {
    const cachedSeasons = state.playerProfile?.cwlSeasons || [];
    
    if (cachedSeasons.length === 0) {
        calculatedCwlStats.winRate = 50;
        calculatedCwlStats.drawRate = 0;
        calculatedCwlStats.hitsCount = 7;
        calculatedCwlStats.hasCalculated = false;
        return;
    }
    
    let totalWins = 0;
    let totalDraws = 0;
    let totalWars = 0;
    let sumHits = 0;
    
    for (const season of cachedSeasons) {
        const wars = season.warsCount || 0;
        const wins = season.winsCount !== undefined ? season.winsCount : Math.round(((season.winRate ?? 50) * (wars || 7)) / 100);
        const draws = season.drawsCount !== undefined ? season.drawsCount : Math.round(((season.drawRate ?? 0) * (wars || 7)) / 100);
        
        totalWins += wins;
        totalDraws += draws;
        totalWars += wars;
        sumHits += (season.hitsCount ?? 7);
    }
    
    if (totalWars === 0) {
        calculatedCwlStats.winRate = 50;
        calculatedCwlStats.drawRate = 0;
        calculatedCwlStats.hitsCount = 7;
    } else {
        calculatedCwlStats.winRate = Math.round((totalWins / totalWars) * 100);
        calculatedCwlStats.drawRate = Math.round((totalDraws / totalWars) * 100);
        calculatedCwlStats.hitsCount = Math.round(sumHits / cachedSeasons.length);
    }
    calculatedCwlStats.hasCalculated = true;
}

function getRecommendedLabel() {
    const cachedSeasons = state.playerProfile?.cwlSeasons || [];
    
    if (!calculatedCwlStats.hasCalculated || cachedSeasons.length === 0) {
        return translate('planner.recommended');
    }
    
    const currentSeason = cachedSeasons[0];
    if (currentSeason && currentSeason.inProgress && cachedSeasons.length === 1) {
        return translate('income.cwl.currentCwlHits', { count: calculatedCwlStats.hitsCount });
    }
    
    if (cachedSeasons.length === 1) {
        return translate('income.cwl.cwl1SeasonHits', { count: calculatedCwlStats.hitsCount });
    }
    
    return translate('income.cwl.cwl2SeasonsHits', { count: calculatedCwlStats.hitsCount });
}

function compileCwlSeasonsFromWars(warsList, activePlayerTag, cleanClanTag) {
    if (!warsList || warsList.length === 0) return [];

    // Group wars by season
    const seasonsMap = new Map();
    const cleanPlayerTag = activePlayerTag ? (activePlayerTag.startsWith('#') ? activePlayerTag : `#${activePlayerTag}`) : null;

    for (const cachedWar of warsList) {
        const war = cachedWar.warData;
        if (!war) continue;

        const season = cachedWar.season;
        if (!seasonsMap.has(season)) {
            seasonsMap.set(season, []);
        }
        seasonsMap.get(season).push(war);
    }

    const compiledSeasons = [];

    for (const [season, wars] of seasonsMap.entries()) {
        let wins = 0;
        let draws = 0;
        let totalWars = 0;
        let playerHits = 0;
        let isSeasonInProgress = false;

        for (const war of wars) {
            const isClan = war.clan?.tag === cleanClanTag;
            const isOpponent = war.opponent?.tag === cleanClanTag;
            if (!isClan && !isOpponent) continue;

            const ourTeam = isClan ? war.clan : war.opponent;
            const oppTeam = isClan ? war.opponent : war.clan;

            if (war.state === 'warEnded' && ourTeam && oppTeam) {
                totalWars++;
                const ourStars = ourTeam.stars ?? 0;
                const oppStars = oppTeam.stars ?? 0;

                if (ourStars > oppStars) {
                    wins++;
                } else if (ourStars === oppStars) {
                    const ourDest = ourTeam.destructionPercentage ?? 0;
                    const oppDest = oppTeam.destructionPercentage ?? 0;
                    if (ourDest > oppDest) {
                        wins++;
                    } else if (ourDest === oppDest) {
                        draws++;
                    }
                }
            } else if (war.state === 'inWar' && ourTeam && oppTeam) {
                const totalPossibleAttacks = war.teamSize ?? 15;
                const ourAttacks = ourTeam.attacks ?? 0;
                const oppAttacks = oppTeam.attacks ?? 0;

                if (ourAttacks >= 0.5 * totalPossibleAttacks && oppAttacks >= 0.5 * totalPossibleAttacks) {
                    totalWars++;
                    const predictedOurStars = Math.min(3 * totalPossibleAttacks, Math.round((ourTeam.stars / ourAttacks) * totalPossibleAttacks));
                    const predictedOppStars = Math.min(3 * totalPossibleAttacks, Math.round((oppTeam.stars / oppAttacks) * totalPossibleAttacks));
                    const predictedOurDest = Math.min(100, (ourTeam.destructionPercentage / ourAttacks) * totalPossibleAttacks);
                    const predictedOppDest = Math.min(100, (oppTeam.destructionPercentage / oppAttacks) * totalPossibleAttacks);

                    if (predictedOurStars > predictedOppStars) {
                        wins++;
                    } else if (predictedOurStars === predictedOppStars) {
                        if (predictedOurDest > predictedOppDest) {
                            wins++;
                        } else if (predictedOurDest === predictedOppDest) {
                            draws++;
                        }
                    }
                } else {
                    isSeasonInProgress = true;
                }
            } else if (war.state === 'preparation') {
                isSeasonInProgress = true;
            }

            if ((war.state === 'warEnded' || war.state === 'inWar') && cleanPlayerTag && ourTeam?.members) {
                const member = ourTeam.members.find(m => m.tag === cleanPlayerTag);
                if (member && member.attacks && member.attacks.length > 0) {
                    playerHits += member.attacks.length;
                }
            }
        }

        compiledSeasons.push({
            season: season,
            winsCount: wins,
            drawsCount: draws,
            hitsCount: Math.min(7, playerHits),
            warsCount: totalWars,
            inProgress: isSeasonInProgress
        });
    }

    compiledSeasons.sort((a, b) => b.season.localeCompare(a.season));
    return compiledSeasons.slice(0, 2);
}

const lastCwlFetchTimes = new Map(); // clanTag -> timestamp

export async function triggerCwlLogFetch(clanTag) {
    if (calculatedCwlStats.isFetching) return;

    // Cooldown check!
    const now = Date.now();
    let lastFetch = lastCwlFetchTimes.get(clanTag) || 0;
    if (lastFetch === 0 && state.playerProfile?.lastCwlFetchTime) {
        lastFetch = new Date(state.playerProfile.lastCwlFetchTime).getTime();
        lastCwlFetchTimes.set(clanTag, lastFetch);
    }
    const cachedSeasons = state.playerProfile?.cwlSeasons || [];
    const currentSeason = cachedSeasons[0];

    let isCooldownActive = false;
    if (currentSeason && currentSeason.inProgress) {
        if (now - lastFetch < 3600000) { // 1 hour cooldown for active CWL
            isCooldownActive = true;
        }
    } else {
        if (now - lastFetch < 86400000) { // 24 hours cooldown otherwise (ended/no CWL)
            isCooldownActive = true;
        }
    }

    if (isCooldownActive) {
        logger.debug(`CWL fetch cooldown active for clan ${clanTag}. Last fetch: ${state.playerProfile?.lastCwlFetchTime}`);
        return;
    }

    calculatedCwlStats.isFetching = true;
    try {
        const { fetchCwlLeagueGroup, fetchCwlWar, fetchCwlWarsFromServer } = await import('../../services/apiService.js');
        const cleanClanTag = clanTag.startsWith('#') ? clanTag : `#${clanTag}`;

        // Fetch server cached wars and live group data concurrently
        const [serverWars, groupData] = await Promise.all([
            fetchCwlWarsFromServer(clanTag).catch(e => {
                logger.error("Failed to fetch CWL wars from server:", e);
                return [];
            }),
            fetchCwlLeagueGroup(clanTag).catch(e => {
                logger.warn("Live CWL group fetch failed (likely not in CWL):", e.message);
                return null;
            })
        ]);

        // Update last fetch time
        lastCwlFetchTimes.set(clanTag, now);
        if (state.playerProfile) {
            state.playerProfile.lastCwlFetchTime = new Date(now).toISOString();
        }

        const warsMap = new Map();
        const cachedWarTags = new Set();

        // Load server wars into map
        for (const cachedWar of serverWars) {
            if (cachedWar.warTag && cachedWar.warData) {
                warsMap.set(cachedWar.warTag, {
                    warTag: cachedWar.warTag,
                    season: cachedWar.season,
                    warData: cachedWar.warData
                });
                cachedWarTags.add(cachedWar.warTag);
            }
        }

        // If live groupData is available, determine which wars to fetch
        if (groupData && groupData.rounds) {
            const rounds = groupData.rounds || [];
            const warTagsToFetch = [];

            // Map cached war tags to their round index
            const roundIndexMap = new Map(); // warTag -> roundIndex
            rounds.forEach((round, roundIdx) => {
                const tags = round.warTags || [];
                tags.forEach(tag => {
                    roundIndexMap.set(tag, roundIdx);
                });
            });

            // Find which rounds already have a cached ended war
            const roundsWithEndedWar = new Set();
            for (const cachedWar of serverWars) {
                if (cachedWar.warTag && cachedWar.warData) {
                    const roundIdx = roundIndexMap.get(cachedWar.warTag);
                    if (roundIdx !== undefined && cachedWar.warData.state === 'warEnded') {
                        roundsWithEndedWar.add(roundIdx);
                    }
                }
            }

            // Decide which war tags we need to fetch live
            rounds.forEach((round, roundIdx) => {
                // If we already have an ended war cached for this round, we don't fetch anything for this round
                if (roundsWithEndedWar.has(roundIdx)) {
                    return;
                }

                // Otherwise, check if we have a cached in-progress/preparation war for this round
                const tags = round.warTags || [];
                let hasInProgressCached = false;
                let inProgressTag = null;

                for (const tag of tags) {
                    if (cachedWarTags.has(tag)) {
                        hasInProgressCached = true;
                        inProgressTag = tag;
                        break;
                    }
                }

                if (hasInProgressCached && inProgressTag) {
                    // Only fetch the in-progress war tag to update its live state
                    warTagsToFetch.push(inProgressTag);
                } else {
                    // Fetch all tags for this round to discover which one is ours
                    tags.forEach(tag => {
                        if (tag && tag !== '#NoWar' && tag !== '0' && tag !== '#0') {
                            warTagsToFetch.push(tag);
                        }
                    });
                }
            });

            if (warTagsToFetch.length > 0) {
                const liveWars = await Promise.all(
                    warTagsToFetch.map(tag => fetchCwlWar(tag).catch(e => null))
                );

                for (let i = 0; i < liveWars.length; i++) {
                    const war = liveWars[i];
                    const tag = warTagsToFetch[i];
                    if (war && tag) {
                        warsMap.set(tag, {
                            warTag: tag,
                            season: groupData.season,
                            warData: war
                        });
                    }
                }
            }
        }

        // Compile up to 2 seasons of cwl data from combined wars
        const activePlayerTag = state.playerProfile?.tag;
        const compiledSeasons = compileCwlSeasonsFromWars(Array.from(warsMap.values()), activePlayerTag, cleanClanTag);

        if (state.playerProfile) {
            state.playerProfile.cwlSeasons = compiledSeasons;
        }

        updateCalculatedStatsFromCache();

    } catch (error) {
        logger.error("Failed to fetch CWL log for recommended values:", error);

        // Update last fetch time even on failure so we don't spam the API
        lastCwlFetchTimes.set(clanTag, Date.now());
        if (state.playerProfile) {
            state.playerProfile.lastCwlFetchTime = new Date().toISOString();
        }

        const errorMsg = error.message || '';
        const is404 = errorMsg.includes('404') || errorMsg.includes('notFound');

        if (is404 && state.playerProfile && state.playerProfile.cwlSeasons) {
            // Mark any in-progress season as ended
            let modified = false;
            for (const s of state.playerProfile.cwlSeasons) {
                if (s.inProgress) {
                    s.inProgress = false;
                    modified = true;
                }
            }
            if (modified) {
                updateCalculatedStatsFromCache();
            }
        }

        if (state.playerProfile?.cwlSeasons && state.playerProfile.cwlSeasons.length > 0) {
            updateCalculatedStatsFromCache();
        } else {
            calculatedCwlStats.winRate = 50;
            calculatedCwlStats.drawRate = 0;
            calculatedCwlStats.hitsCount = 7;
        }
    } finally {
        calculatedCwlStats.hasCalculated = true;
        calculatedCwlStats.isFetching = false;
        handleStateUpdate(() => {}, true);
    }
}

function setupWarInputPopover(oreType, input) {
    registerInputPopover(input, {
        title: () => translate('validation.amount'),
        min: 0,
        showRecommended: true,
        recommended: () => {
            const playerTH = parseInt(state.playerProfile?.townHallLevel || 16, 10);
            let checkTH = playerTH;
            if (checkTH < 8) checkTH = 8;
            else if (checkTH > 16) checkTH = 16;
            return warOreTownHallValues[oreType][checkTH] !== undefined ? warOreTownHallValues[oreType][checkTH] : 0;
        },
        recommendedLabel: () => {
            const playerTH = parseInt(state.playerProfile?.townHallLevel || 16, 10);
            return `TH ${playerTH}`;
        },
        hideRecommendedIfHigher: false,
        clickToFill: {
            max: true,
            recommended: true
        }
    });
}

function handleInputChange(e, key, oreType = null) {
    const value = e.detail.value;

    handleStateUpdate(() => {
        if (!state.income.cwl) state.income.cwl = { oresPerAttack: {} };
        if (!state.income.cwl.oresPerAttack) state.income.cwl.oresPerAttack = {};

        if (oreType) {
            state.income.cwl.oresPerAttack[oreType] = value;
        } else if (key === 'winRate' || key === 'drawRate') {
            const newWinRate = key === 'winRate' ? value : (state.income.cwl.winRate ?? 50);
            const newDrawRate = key === 'drawRate' ? value : (state.income.cwl.drawRate || 0);
            const changedRate = key === 'winRate' ? 'win' : 'draw';
            const adjusted = adjustWarRates(newWinRate, newDrawRate, changedRate);
            state.income.cwl.winRate = adjusted.winRate;
            state.income.cwl.drawRate = adjusted.drawRate;
        } else {
            state.income.cwl[key] = value;
        }
    });
}

export function initializeCwlInputs() {
    const inputs = dom.income?.cwl;
    if (!inputs) return;

    addValidation(inputs.hitsPerSeasonInput, { inputName: translate('income.cwl.hitsPerSeason') });
    registerInputPopover(inputs.hitsPerSeasonInput, {
        title: () => translate('income.cwl.hitsPerSeason'),
        min: 0,
        max: 7,
        showRecommended: true,
        recommended: () => calculatedCwlStats.hitsCount,
        recommendedLabel: () => getRecommendedLabel(),
        clickToFill: {
            min: true,
            max: true,
            recommended: true
        }
    });
    inputs.hitsPerSeasonInput?.addEventListener('validated-input', (e) => handleInputChange(e, 'hitsPerSeason'));

    addValidation(inputs.warResults.winRateInput, { inputName: translate('income.winRate') });
    registerInputPopover(inputs.warResults.winRateInput, {
        title: () => translate('income.winRate'),
        min: 0,
        max: 100,
        showRange: true,
        showRecommended: true,
        recommended: () => calculatedCwlStats.winRate,
        recommendedLabel: () => getRecommendedLabel(),
        clickToFill: {
            min: true,
            max: true,
            recommended: true
        }
    });
    inputs.warResults.winRateInput?.addEventListener('validated-input', (e) => handleInputChange(e, 'winRate'));

    addValidation(inputs.warResults.drawRateInput, { inputName: translate('income.drawRate') });
    registerInputPopover(inputs.warResults.drawRateInput, {
        title: () => translate('income.drawRate'),
        min: 0,
        max: 100,
        showRange: true,
        showRecommended: true,
        recommended: () => calculatedCwlStats.drawRate,
        recommendedLabel: () => getRecommendedLabel(),
        clickToFill: {
            min: true,
            max: true,
            recommended: true
        }
    });
    inputs.warResults.drawRateInput?.addEventListener('validated-input', (e) => handleInputChange(e, 'drawRate'));

    addValidation(inputs.oresPerAttack.shinyInput, { inputName: translate('ores.shiny') });
    setupWarInputPopover('shiny', inputs.oresPerAttack.shinyInput);
    inputs.oresPerAttack.shinyInput?.addEventListener('validated-input', (e) => handleInputChange(e, null, 'shiny'));

    addValidation(inputs.oresPerAttack.glowyInput, { inputName: translate('ores.glowy') });
    setupWarInputPopover('glowy', inputs.oresPerAttack.glowyInput);
    inputs.oresPerAttack.glowyInput?.addEventListener('validated-input', (e) => handleInputChange(e, null, 'glowy'));

    addValidation(inputs.oresPerAttack.starryInput, { inputName: translate('ores.starry') });
    setupWarInputPopover('starry', inputs.oresPerAttack.starryInput);
    inputs.oresPerAttack.starryInput?.addEventListener('validated-input', (e) => handleInputChange(e, null, 'starry'));
}

export function renderCwlInputs(cwlState) {
    const inputs = dom.income?.cwl;
    if (!inputs) return;

    const safeState = cwlState || { oresPerAttack: {} };

    if (inputs.hitsPerSeasonInput) inputs.hitsPerSeasonInput.value = safeState.hitsPerSeason || 0;
    if (inputs.warResults.winRateInput) inputs.warResults.winRateInput.value = safeState.winRate ?? 50;
    if (inputs.warResults.drawRateInput) inputs.warResults.drawRateInput.value = safeState.drawRate || 0;
    if (inputs.oresPerAttack.shinyInput) inputs.oresPerAttack.shinyInput.value = safeState.oresPerAttack?.shiny || 0;
    if (inputs.oresPerAttack.glowyInput) inputs.oresPerAttack.glowyInput.value = safeState.oresPerAttack?.glowy || 0;
    if (inputs.oresPerAttack.starryInput) inputs.oresPerAttack.starryInput.value = safeState.oresPerAttack?.starry || 0;

    const currentClanTag = state.playerProfile?.clan?.tag || (state.playerProfile?.cwlSeasons?.length > 0 ? "unknown-clan" : undefined);
    
    if (!currentClanTag) {
        if (calculatedCwlStats.clanTag !== null) {
            calculatedCwlStats.clanTag = null;
            calculatedCwlStats.winRate = 50;
            calculatedCwlStats.drawRate = 0;
            calculatedCwlStats.hitsCount = 7;
            calculatedCwlStats.hasCalculated = true;
        }
    } else {
        const cachedSeasons = state.playerProfile?.cwlSeasons || [];
        
        if (currentClanTag !== calculatedCwlStats.clanTag || cachedSeasons.length === 0) {
            calculatedCwlStats.clanTag = currentClanTag;
            if (cachedSeasons.length > 0) {
                updateCalculatedStatsFromCache();
            } else {
                calculatedCwlStats.winRate = 50;
                calculatedCwlStats.drawRate = 0;
                calculatedCwlStats.hitsCount = 7;
                calculatedCwlStats.hasCalculated = false;
            }
            if (currentClanTag !== "unknown-clan") {
                triggerCwlLogFetch(currentClanTag);
            }
        } else {
            calculatedCwlStats.clanTag = currentClanTag;
            updateCalculatedStatsFromCache();
            if (currentClanTag !== "unknown-clan") {
                triggerCwlLogFetch(currentClanTag);
            }
        }
    }
}