import { formatCurrency } from '../utils/numberFormatter.js';
import { getSupercellEventsForYear, isStarBonusEventMonth, getStarBonus2xWindow } from '../utils/dateUtils.js';
import { translate } from '../i18n/translator.js';
import { getProspectorIncomeForDate } from '../incomeCalculations/prospectorManager.js';

import { leagueTiers, supercellEventsData, currencyData } from './appData.js';

export const incomeData = {
    starBonus: {
        id: 'starBonus',
        nameI18nKey: 'income.starBonus.title',
        showInHomeTable: true,
        autoGenerateInCalendar: true,
        allowManualCreation: true,
        name: 'Star Bonus',
        type: 'starBonus',
        className: 'star-bonus',
        schedule: {
            type: 'daily',
            dateStart: 1,
            availableTillEndOfMonth: true,
        },
        getIncome: (state) => state.derived.incomeSources.starBonus?.daily || { shiny: 0, glowy: 0, starry: 0 },
        // Added specialized base income getter for Planner to avoid double-counting with event chips
        getBaseIncome: (state) => state.derived.incomeSources.starBonus?.baseDaily || { shiny: 0, glowy: 0, starry: 0 },
        getSVGUrl: (state) => state.derived.incomeSources.starBonus?.iconUrl || '',
        getResourceString: (state) => {
            const leagueId = parseInt(state.income.starBonus?.league || 105000000, 10);
            const leagueData = leagueTiers.items.find(l => l.id === leagueId);
            const leagueName = leagueData ? leagueData.name : 'Unranked';
            const leagueKey = 'leagues.' + leagueName.toLowerCase()
                .replace(/\./g, '')
                .replace(/\s(i+)$/i, (match, p1) => p1.toUpperCase())
                .replace(/\s/g, '_');
            return translate(leagueKey);
        },
        subCategories: [
            {
                id: 'starBonus2x',
                nameI18nKey: 'income.starBonus.event2x',
                type: 'starBonus2x',
                className: 'star-bonus-2x',
                schedule: { type: 'custom' },
                getSVGUrl: (state) => state.derived.incomeSources.starBonus?.iconUrl || '',
                getCount: (state, month, year) => {
                    if (month === undefined || year === undefined) return 0;
                    const isEventMonth = isStarBonusEventMonth(
                        month, 
                        year, 
                        state.income.starBonus?.eventFrequency || 2,
                        state.income.starBonus?.lastEventMonth,
                        state.income.starBonus?.lastEventYear
                    );
                    return isEventMonth ? (state.income.starBonus?.eventDuration || 0) : 0;
                },
                getIncome: (state) => {
                    const base = state.derived.incomeSources.starBonus?.baseDaily || { shiny: 0, glowy: 0, starry: 0 };
                    // Full income for 2x
                    return { shiny: base.shiny * 2, glowy: base.glowy * 2, starry: base.starry * 2 };
                },
                isValidDate: (day, month, year) => {
                    const window = getStarBonus2xWindow(month, year);
                    const targetDate = new Date(Date.UTC(year, month, day));
                    return targetDate >= window.start && targetDate <= window.end;
                }
            },
            {
                id: 'starBonus4x',
                nameI18nKey: 'income.starBonus.event4x',
                type: 'starBonus4x',
                className: 'star-bonus-4x',
                schedule: { type: 'custom' },
                getSVGUrl: (state) => state.derived.incomeSources.starBonus?.iconUrl || '',
                getCount: (state, month, year) => {
                    if (month === undefined || year === undefined) return 0;
                    const upgrades = state.income.starBonus?.thUpgrades || {};
                    const isUpgradeMonth = Object.values(upgrades).some(u => u.month === month && u.year === year);
                    return isUpgradeMonth ? 6 : 0;
                },
                getIncome: (state) => {
                    const base = state.derived.incomeSources.starBonus?.baseDaily || { shiny: 0, glowy: 0, starry: 0 };
                    // Full income for 4x
                    return { shiny: base.shiny * 4, glowy: base.glowy * 4, starry: base.starry * 4 };
                },
                isValidDate: (day, month, year) => true // Whole month is valid
            }
        ]
    },
    shopOffers: {
        id: 'shopOffers',
        nameI18nKey: 'income.shopOffers.title',
        showInHomeTable: true,
        allowManualCreation: true,
        name: 'Shop Offers',
        type: 'shopOffers',
        className: 'shop-offer',
        iconUrl: 'assets/resources/shopOffers.png',
        isSingleEvent: true,
        schedule: {
            type: 'monthly',
            dateStart: 26,
            dateEnd: 28,
        },
        getIncome: (state) => state.derived.incomeSources.shopOffers?.monthly || { shiny: 0, glowy: 0, starry: 0 },
        getResourceString: (state) => {
            const selected = Object.keys(state.income.shopOffers)[0] || '0';
            if (!selected || selected === '0') return '';
            
            const selectedCurrencyKey = state.uiSettings.currency.code.toUpperCase();
            const cost = state.derived.incomeSources.shopOffers?.monthly?.[selectedCurrencyKey] || state.derived.incomeSources.shopOffers?.monthly?.USD || 0;
            const symbol = currencyData[state.uiSettings.currency.code]?.symbol || '';
            return `${symbol} ${formatCurrency(cost)}`;
        }
    },
    raidMedalTrader: {
        id: 'raidMedalTrader',
        nameI18nKey: 'income.raidMedalTrader.title',
        showInHomeTable: true,
        name: 'Raid Medal Trader',
        type: 'raidMedalTrader',
        className: 'raid-medal-trader',
        iconUrl: 'assets/resources/raidMedal.png',
        schedule: {
            type: 'weekly',
            dateStart: 2, 
            dateEnd: 1, 
        },
        getIncome: (state) => state.derived.incomeSources.raidMedalTrader?.weekly || { shiny: 0, glowy: 0, starry: 0 },
        getResourceString: (state) => translate('income.raidMedalTrader.perWeek', { count: state.derived.incomeSources.raidMedalTrader?.cost || 0 })
    },
    gemTrader: {
        id: 'gemTrader',
        nameI18nKey: 'income.gemTrader.title',
        showInHomeTable: true,
        allowManualCreation: true,
        name: 'Gem Trader',
        type: 'gemTrader',
        className: 'gem-trader',
        iconUrl: 'assets/resources/gem.png',
        schedule: {
            type: 'weekly',
            dateStart: 2, 
            dateEnd: 1, 
        },
        getIncome: (state) => state.derived.incomeSources.gemTrader?.weekly || { shiny: 0, glowy: 0, starry: 0 },
        getResourceString: (state) => translate('income.gemTrader.perWeek', { count: state.derived.incomeSources.gemTrader?.cost || 0 })
    },
    eventPass: {
        id: 'eventPass',
        nameI18nKey: 'income.eventPass.title',
        showInHomeTable: true,
        name: 'Event Pass',
        type: 'eventPass',
        className: 'event-pass',
        iconUrl: 'assets/resources/eventPass.png',
        isSingleEvent: true,
        schedule: {
            type: 'bimonthly',
            dateStart: 8,
            dateEnd: 28,
            availableMonths: {
                2026: [4, 6, 8, 10, 12],
            },
        },
        getIncome: (state) => state.derived.incomeSources.eventPass?.bimonthly || { shiny: 0, glowy: 0, starry: 0 },
        getResourceString: (state) => {
            const hasPass = state.income.eventPass?.eventPass || false;
            if (hasPass) {
                const selectedCurrencyKey = state.uiSettings.currency.code.toUpperCase();
                const cost = state.derived.incomeSources.eventPass?.monthly?.[selectedCurrencyKey] || state.derived.incomeSources.eventPass?.monthly?.USD || 0;
                const symbol = currencyData[state.uiSettings.currency.code]?.symbol || '';
                return `${translate('income.eventPass.title')} (${symbol}${formatCurrency(cost)})`;
            }
            return translate('income.eventPass.free');
        }
    },
    eventTrader: {
        id: 'eventTrader',
        nameI18nKey: 'income.eventTrader.title',
        showInHomeTable: true,
        allowManualCreation: true,
        name: 'Event Trader',
        type: 'eventTrader',
        className: 'event-trader',
        iconUrl: 'assets/resources/eventMedal.png',
        isSingleEvent: true,
        schedule: {
            type: 'bimonthly',
            dateStart: 8,
            dateEnd: 28,
            availableMonths: {
                2026: [4, 6, 8, 10, 12],
            },
        },
        getIncome: (state) => state.derived.incomeSources.eventTrader?.bimonthly || { shiny: 0, glowy: 0, starry: 0 },
        getResourceString: (state) => translate('income.eventPass.medalsResource', { count: state.derived.incomeSources.eventTrader?.cost || 0 })
    },
    clanWar: {
        id: 'clanWar',
        nameI18nKey: 'income.clanWar.title',
        showInHomeTable: true,
        allowManualCreation: true,
        name: 'Clan War',
        type: 'clanWar',
        className: 'clan-war',
        iconUrl: 'assets/resources/clanWar.png',
        schedule: {
            type: 'custom',
            dateStart: 4,
            availableTillEndOfMonth: true,
        },
        getIncome: (state) => state.derived.incomeSources.clanWar?.perEvent || { shiny: 0, glowy: 0, starry: 0 },
        getCount: (state) => state.income.clanWar?.warsPerMonth || 0,
        minReoccurrenceDays: 2,
        getResourceString: (state) => {
            const wars = state.income.clanWar?.warsPerMonth || 0;
            const winRate = state.income.clanWar?.winRate ?? 50;
            return wars > 0 ? translate('income.clanWar.resource', { count: wars, winRate: winRate }) : translate('income.clanWar.none');
        }
    },
    cwl: {
        id: 'cwl',
        nameI18nKey: 'income.cwl.title',
        showInHomeTable: true,
        allowManualCreation: true,
        name: 'CWL',
        type: 'cwl',
        className: 'cwl',
        iconUrl: 'assets/resources/cwl.png',
        schedule: {
            type: 'custom',
            dateStart: 3,
            dateEnd: 11,
        },
        getIncome: (state) => state.derived.incomeSources.cwl?.perEvent || { shiny: 0, glowy: 0, starry: 0 },
        getCount: (state) => state.income.cwl?.hitsPerSeason || 0,
        getResourceString: (state) => {
            const hits = state.income.cwl?.hitsPerSeason || 0;
            const winRate = state.income.cwl?.winRate ?? 50;
            return hits > 0 ? translate('income.cwl.resource', { count: hits, winRate: winRate }) : translate('income.cwl.none');
        }
    },
    supercellEvents: {
        id: 'supercellEvents',
        nameI18nKey: 'income.supercellEvents.title',
        showInHomeTable: true,
        autoGenerateInCalendar: true,
        allowManualCreation: true,
        name: 'Supercell Events',
        type: 'supercellEvents',
        className: 'supercell-events',
        iconUrl: 'assets/resources/supercellEvents.png',
        getResourceString: () => 'event.supercell.com',
        getAutomaticSchedule: (date, state) => {
            if (!state.income.supercellEvents || !state.income.supercellEvents.worldChampionship) return null;
            
            const displayYear = date.getUTCFullYear();
            const supercellEvents = getSupercellEventsForYear(displayYear, supercellEventsData);
            
            let foundEvent = null;
            supercellEvents.forEach((event, index) => {
                const startDate = new Date(event.start);
                const endDate = new Date(event.end);
                
                const startUTC = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
                const endUTC = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

                const diffDays = Math.round((endUTC - startUTC) / (1000 * 60 * 60 * 24));
                const middleDayOffset = Math.floor(diffDays / 2);
                const middleDateUTC = new Date(startUTC);
                middleDateUTC.setUTCDate(startUTC.getUTCDate() + middleDayOffset);

                const dateUTC = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

                if (dateUTC.getTime() === middleDateUTC.getTime()) {
                    let rewardType = 'otherEvents';
                    if (event.name === 'Monthly Finals') rewardType = 'monthlyQualifiers';
                    else if (event.name === 'Last Chance Qualifier') rewardType = 'lastChanceQualifiers';
                    else if (event.name === 'World Finals') rewardType = 'worldChampionships';

                    let rewardsYear = displayYear;
                    if (!supercellEventsData.rewards[rewardsYear]) rewardsYear = displayYear - 1;
                    if (!supercellEventsData.rewards[rewardsYear]) {
                        const availableYears = Object.keys(supercellEventsData.rewards).map(Number).sort((a, b) => b - a);
                        rewardsYear = availableYears[0] || 2025;
                    }
                    const rewards = (supercellEventsData.rewards[rewardsYear] && supercellEventsData.rewards[rewardsYear][rewardType]) || { shiny: 0, glowy: 0, starry: 0 };
                    
                    foundEvent = {
                        instance: index + 1,
                        income: rewards
                    };
                }
            });
            return foundEvent;
        }
    },
    prospector: {
        id: 'prospector',
        nameI18nKey: 'income.prospector.title',
        showInHomeTable: true,
        autoGenerateInCalendar: true,
        allowManualCreation: true,
        name: 'Prospector',
        type: 'prospector',
        className: 'prospector',
        iconUrl: 'assets/resources/prospector.png',
        schedule: {
            type: 'daily',
            dateStart: 1,
            availableTillEndOfMonth: true,
        },
        getIncome: (state) => state.derived.incomeSources.prospector?.daily || { shiny: 0, glowy: 0, starry: 0 },
        getResourceString: (state) => {
            if (state.income.prospector?.goldPass) {
                const selectedCurrencyKey = state.uiSettings.currency.code.toUpperCase();
                const cost = state.derived.incomeSources.prospector?.monthly?.[selectedCurrencyKey] || state.derived.incomeSources.prospector?.monthly?.USD || 0;
                const symbol = currencyData[state.uiSettings.currency.code]?.symbol || '';
                return `${translate('income.prospector.goldPass')} (${symbol}${formatCurrency(cost)})`;
            }
            return translate('income.prospector.silverPass');
        },
        getAutomaticSchedule: (date, state) => {
            if (state.income.prospector?.goldPass) {
                const income = getProspectorIncomeForDate(date, state);
                if (income.shiny === 0 && income.glowy === 0 && income.starry === 0) {
                    return null;
                }
                return {
                    instance: date.getUTCDate(),
                    income: income
                };
            }
            return null;
        }
    },
};

/**
 * Finds an income source (or subcategory) by its ID.
 * @param {string} id 
 * @returns {Object|null}
 */
export function getSourceById(id) {
    if (incomeData[id]) return incomeData[id];

    for (const key in incomeData) {
        if (incomeData[key].subCategories) {
            const found = incomeData[key].subCategories.find(sub => sub.id === id);
            if (found) return found;
        }
    }

    if (id && id.startsWith('starBonus') && id.length > 9) {
        const multiplierStr = id.substring(9); // e.g. "3x"
        const mult = parseInt(multiplierStr.replace('x', ''), 10);
        if (!isNaN(mult)) {
            return {
                id: id,
                nameI18nKey: `income.starBonus.event${multiplierStr}`,
                type: id,
                className: `star-bonus-${multiplierStr}`,
                schedule: { type: 'custom' },
                getSVGUrl: (state) => incomeData.starBonus.getSVGUrl(state),
                getIncome: (state) => {
                    const base = state.derived?.incomeSources?.starBonus?.baseDaily || { shiny: 0, glowy: 0, starry: 0 };
                    return { shiny: base.shiny * mult, glowy: base.glowy * mult, starry: base.starry * mult };
                },
                isValidDate: (day, month, year) => true
            };
        }
    }

    return null;
}
