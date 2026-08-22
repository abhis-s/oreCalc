import { supercellEventsData } from './incomeSources/supercellEvents.js';
import { leagueTiers } from './leagueTiers.js';
import { currencyData } from './pricingData.js';
import { translate } from '../i18n/translator.js';

import { selectDerivedSourceIncome, ZERO_ORES } from '../core/selectors.js';

import { getProspectorIncomeForDate } from '../domain/income/prospectorManager.js';
import { getStarBonus2xWindow, getSupercellEventsForYear, isStarBonusEventMonth } from '../utils/dateUtils.js';
import { formatCurrency } from '../utils/numberFormatter.js';

export const CANONICAL_CHIP_PRIORITY_ORDER = [
    'starBonus2x',
    'starBonus3x',
    'starBonus4x',
    'starBonus5x',
    'starBonus6x',
    'starBonus7x',
    'starBonus',
    'prospector',
    'cwl',
    'clanWar',
    'raidMedalTrader',
    'gemTrader',
    'eventPass',
    'eventTrader',
    'shopOffers',
    'supercellEvents',
    'custom',
    'extras'
];

const SUPERCELL_EVENT_REWARD_MAP = {
    'Monthly Finals': 'monthlyQualifiers',
    'Last Chance Qualifier': 'lastChanceQualifiers',
    'World Finals': 'worldChampionships'
};

/**
 * Multiplies an ore quantity by a constant factor.
 * @param {import('../core/types.js').OreQuantity} ores
 * @param {number} factor
 * @returns {import('../core/types.js').OreQuantity}
 */
const multiplyOres = (ores, factor) => ({
    shiny: (ores.shiny || 0) * factor,
    glowy: (ores.glowy || 0) * factor,
    starry: (ores.starry || 0) * factor
});

/**
 * Formats the localized cost for a given income source based on active currency settings.
 * @param {import('../core/types.js').AppState} state
 * @param {string} sourceId
 * @returns {string}
 */
function getCostString(state, sourceId) {
    const code = state.uiSettings?.currency?.code || 'USD';
    const cost = state.derived?.incomeSources?.[sourceId]?.monthly?.[code.toUpperCase()] || state.derived?.incomeSources?.[sourceId]?.monthly?.USD || 0;
    return (currencyData[code]?.symbol || '') + formatCurrency(cost);
}

/**
 * Formats resource string for attack-based war events.
 * @param {number} count
 * @param {number | undefined} winRate
 * @param {string} i18nKey
 * @returns {string}
 */
const formatWarResource = (count, winRate, i18nKey) => (
    count > 0
        ? translate(i18nKey, { count, winRate: winRate ?? 50 })
        : translate(i18nKey.replace('.resource', '.none'))
);

export const incomeData = {
    starBonus: {
        id: 'starBonus',
        nameI18nKey: 'views.income.starBonus.title',
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
        getIncome: (state) => selectDerivedSourceIncome(state, 'starBonus', 'daily'),
        getBaseIncome: (state) => selectDerivedSourceIncome(state, 'starBonus', 'baseDaily'),
        getSVGUrl: (state) => state.derived.incomeSources.starBonus?.iconUrl || '',
        getResourceString: (state) => {
            const leagueId = parseInt(state.income.starBonus?.league || 105000000, 10);
            const leagueData = leagueTiers.items.find(l => l.id === leagueId);
            const leagueName = leagueData ? leagueData.name : 'Unranked';
            const leagueKey = 'entities.leagues.' + leagueName.toLowerCase()
                .replace(/\./g, '')
                .replace(/\s(i+)$/i, (match, p1) => p1.toUpperCase())
                .replace(/\s/g, '_');
            return translate(leagueKey);
        },
        subCategories: [
            {
                id: 'starBonus2x',
                nameI18nKey: 'views.income.starBonus.event2x',
                type: 'starBonus2x',
                className: 'star-bonus-2x',
                schedule: { type: 'custom' },
                getSVGUrl: (state) => state.derived.incomeSources.starBonus?.iconUrl || '',
                getCount: (state, month, year) => {
                    if (month === undefined || year === undefined) return 0;
                    let lastMonth, lastYear;
                    const lastEventStr = state.income.starBonus?.["2x"]?.lastEvent;
                    if (lastEventStr) {
                        const [yr, mo] = lastEventStr.split('-').map(Number);
                        lastYear = yr;
                        lastMonth = mo - 1;
                    }
                    const frequency = state.income.starBonus?.["2x"]?.frequency || 2;
                    const duration = state.income.starBonus?.["2x"]?.duration || 0;
                    return isStarBonusEventMonth(month, year, frequency, lastMonth, lastYear) ? duration : 0;
                },
                getIncome: (state) => multiplyOres(selectDerivedSourceIncome(state, 'starBonus', 'baseDaily'), 2),
                isValidDate: (day, month, year) => {
                    const window = getStarBonus2xWindow(month, year);
                    const targetDate = new Date(Date.UTC(year, month, day));
                    return targetDate >= window.start && targetDate <= window.end;
                }
            },
            {
                id: 'starBonus4x',
                nameI18nKey: 'views.income.starBonus.event4x',
                type: 'starBonus4x',
                className: 'star-bonus-4x',
                schedule: { type: 'custom' },
                getSVGUrl: (state) => state.derived.incomeSources.starBonus?.iconUrl || '',
                getCount: (state, month, year) => {
                    if (month === undefined || year === undefined) return 0;
                    const upgrades = state.income.starBonus?.thUpgrades || {};
                    const targetStr = `${year}-${String(month + 1).padStart(2, '0')}`;
                    return Object.values(upgrades).some(u => u === targetStr) ? 6 : 0;
                },
                getIncome: (state) => multiplyOres(selectDerivedSourceIncome(state, 'starBonus', 'baseDaily'), 4),
                isValidDate: () => true
            }
        ]
    },
    shopOffers: {
        id: 'shopOffers',
        nameI18nKey: 'views.income.shopOffers.title',
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
        getIncome: (state) => selectDerivedSourceIncome(state, 'shopOffers', 'monthly'),
        getResourceString: (state) => {
            const selected = state.income.shopOffers?.selectedSet;
            if (!selected) return '';
            const symbol = currencyData[state.uiSettings.currency.code]?.symbol || '';
            const cost = state.derived.incomeSources.shopOffers?.monthly?.[state.uiSettings.currency.code.toUpperCase()] || state.derived.incomeSources.shopOffers?.monthly?.USD || 0;
            return `${symbol} ${formatCurrency(cost)}`;
        }
    },
    raidMedalTrader: {
        id: 'raidMedalTrader',
        nameI18nKey: 'views.income.raidMedalTrader.title',
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
        getIncome: (state) => selectDerivedSourceIncome(state, 'raidMedalTrader', 'weekly'),
        getResourceString: (state) => translate('views.income.raidMedalTrader.perWeek', { count: state.derived.incomeSources.raidMedalTrader?.cost || 0 })
    },
    gemTrader: {
        id: 'gemTrader',
        nameI18nKey: 'views.income.gemTrader.title',
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
        getIncome: (state) => selectDerivedSourceIncome(state, 'gemTrader', 'weekly'),
        getResourceString: (state) => translate('views.income.gemTrader.perWeek', { count: state.derived.incomeSources.gemTrader?.cost || 0 })
    },
    eventPass: {
        id: 'eventPass',
        nameI18nKey: 'views.income.eventPass.title',
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
        getIncome: (state) => selectDerivedSourceIncome(state, 'eventPass', 'bimonthly'),
        getResourceString: (state) => (
            state.income.eventPass?.eventPass
                ? `${translate('views.income.eventPass.title')} (${getCostString(state, 'eventPass')})`
                : translate('views.income.eventPass.free')
        )
    },
    eventTrader: {
        id: 'eventTrader',
        nameI18nKey: 'views.income.eventTrader.title',
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
        getIncome: (state) => selectDerivedSourceIncome(state, 'eventTrader', 'bimonthly'),
        getResourceString: (state) => translate('views.income.eventPass.medalsResource', { count: state.derived.incomeSources.eventTrader?.cost || 0 })
    },
    clanWar: {
        id: 'clanWar',
        nameI18nKey: 'views.income.clanWar.title',
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
        getIncome: (state) => selectDerivedSourceIncome(state, 'clanWar', 'perEvent'),
        getCount: (state) => state.income.clanWar?.warsPerMonth || 0,
        minReoccurrenceDays: 2,
        getResourceString: (state) => formatWarResource(state.income.clanWar?.warsPerMonth || 0, state.income.clanWar?.winRate, 'views.income.clanWar.resource')
    },
    cwl: {
        id: 'cwl',
        nameI18nKey: 'views.income.cwl.title',
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
        getIncome: (state) => selectDerivedSourceIncome(state, 'cwl', 'perEvent'),
        getCount: (state) => state.income.cwl?.hitsPerSeason || 0,
        getResourceString: (state) => formatWarResource(state.income.cwl?.hitsPerSeason || 0, state.income.cwl?.winRate, 'views.income.cwl.resource')
    },
    supercellEvents: {
        id: 'supercellEvents',
        nameI18nKey: 'views.income.supercellEvents.title',
        showInHomeTable: true,
        autoGenerateInCalendar: true,
        allowManualCreation: true,
        name: 'Supercell Events',
        type: 'supercellEvents',
        className: 'supercell-events',
        iconUrl: 'assets/resources/supercellEvents.png',
        getResourceString: () => 'event.supercell.com',
        getAutomaticSchedule: (date, state) => {
            if (!state.income.supercellEvents?.worldChampionship) return null;

            const displayYear = date.getUTCFullYear();
            const supercellEvents = getSupercellEventsForYear(displayYear, supercellEventsData);
            const targetUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

            for (let i = 0; i < supercellEvents.length; i++) {
                const event = supercellEvents[i];
                const s = new Date(event.start);
                const e = new Date(event.end);
                const startUtc = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
                const endUtc = Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate());
                const middleUtc = startUtc + Math.floor(Math.round((endUtc - startUtc) / 86400000) / 2) * 86400000;

                if (targetUtc === middleUtc) {
                    const rewardType = SUPERCELL_EVENT_REWARD_MAP[event.name] || 'otherEvents';
                    const availableYears = Object.keys(supercellEventsData.rewards).map(Number).sort((a, b) => b - a);
                    const rewardsYear = supercellEventsData.rewards[displayYear] ? displayYear : (supercellEventsData.rewards[displayYear - 1] ? displayYear - 1 : (availableYears[0] || 2025));
                    const income = supercellEventsData.rewards[rewardsYear]?.[rewardType] || ZERO_ORES;

                    return { instance: i + 1, income };
                }
            }
            return null;
        }
    },
    prospector: {
        id: 'prospector',
        nameI18nKey: 'views.income.prospector.title',
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
        getIncome: (state) => selectDerivedSourceIncome(state, 'prospector', 'daily'),
        getResourceString: (state) => (
            state.income.prospector?.goldPass
                ? `${translate('views.income.prospector.goldPass')} (${getCostString(state, 'prospector')})`
                : translate('views.income.prospector.silverPass')
        ),
        getAutomaticSchedule: (date, state) => {
            if (!state.income.prospector?.goldPass) return null;
            const income = getProspectorIncomeForDate(date, state);
            return (!income.shiny && !income.glowy && !income.starry) ? null : { instance: date.getUTCDate(), income };
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
        const multiplierStr = id.substring(9);
        const mult = parseInt(multiplierStr.replace('x', ''), 10);
        if (!isNaN(mult)) {
            return {
                id: id,
                nameI18nKey: `views.income.starBonus.event${multiplierStr}`,
                type: id,
                className: `star-bonus-${multiplierStr}`,
                schedule: { type: 'custom' },
                getSVGUrl: (state) => incomeData.starBonus.getSVGUrl(state),
                getIncome: (state) => multiplyOres(selectDerivedSourceIncome(state, 'starBonus', 'baseDaily'), mult),
                isValidDate: () => true
            };
        }
    }

    return null;
}
