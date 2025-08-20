export const incomeData = {
    shopOffers: {
        name: 'Shop Offers',
        type: 'shopOffers',
        color: '#FFD700',
        className: 'shop-offer',
        schedule: {
            type: 'monthly',
            dateStart: 24,
            dateEnd: 28,
        },
        getIncome: (state) => state.derived.incomeSources.shopOffers?.monthly || { shiny: 0, glowy: 0, starry: 0 },
    },
    starBonus: {
        name: 'Star Bonus',
        type: 'starBonus',
        color: '#ADD8E6',
        className: 'star-bonus',
        schedule: {
            type: 'daily',
            dateStart: 1,
            availableTillEndOfMonth: true,
        },
        getIncome: (state) => state.derived.incomeSources.starBonus?.daily || { shiny: 0, glowy: 0, starry: 0 },
    },
    raidMedalTrader: {
        name: 'Raid Medal Trader',
        type: 'raidMedalTrader',
        color: '#8B4513',
        className: 'raid-medal-trader',
        schedule: {
            type: 'weekly',
            dateStart: 2, // Tuesday
            dateEnd: 1, // Monday
        },
        getIncome: (state) => state.derived.incomeSources.raidMedalTrader?.weekly || { shiny: 0, glowy: 0, starry: 0 },
    },
    gemTrader: {
        name: 'Gem Trader',
        type: 'gemTrader',
        color: '#00BFFF',
        className: 'gem-trader',
        schedule: {
            type: 'weekly',
            dateStart: 2, // Tuesday
            dateEnd: 1, // Monday
        },
        getIncome: (state) => state.derived.incomeSources.gemTrader?.weekly || { shiny: 0, glowy: 0, starry: 0 },
    },
    eventPass: {
        name: 'Event Pass',
        type: 'eventPass',
        color: '#9932CC',
        className: 'event-pass',
        schedule: {
            type: 'bimonthly',
            dateStart: 8,
            dateEnd: 28,
            availableMonths: {
                2025: [8, 10, 12], // August, October, December
            },
        },
        getIncome: (state) => state.derived.incomeSources.eventPass?.bimonthly || { shiny: 0, glowy: 0, starry: 0 },
    },
    eventTrader: {
        name: 'Event Trader',
        type: 'eventTrader',
        color: '#FF4500',
        className: 'event-trader',
        schedule: {
            type: 'bimonthly',
            dateStart: 8,
            dateEnd: 28,
            availableMonths: {
                2025: [8, 10, 12], // August, October, December
            },
        },
        getIncome: (state) => state.derived.incomeSources.eventTrader?.bimonthly || { shiny: 0, glowy: 0, starry: 0 },
    },
    clanWar: {
        name: 'Clan War',
        type: 'clanWar',
        color: '#228B22',
        className: 'clan-war',
        schedule: {
            type: 'custom',
            dateStart: 3,
            availableTillEndOfMonth: true,
        },
        getIncome: (state) => state.derived.incomeSources.clanWar?.perEvent || { shiny: 0, glowy: 0, starry: 0 },
        getCount: (state) => state.income.clanWar.warsPerMonth,
    },
    cwl: {
        name: 'CWL',
        type: 'cwl',
        color: '#4682B4',
        className: 'cwl',
        schedule: {
            type: 'custom',
            dateStart: 2,
            dateEnd: 11,
        },
        getIncome: (state) => state.derived.incomeSources.cwl?.perEvent || { shiny: 0, glowy: 0, starry: 0 },
        getCount: (state) => state.income.cwl.hitsPerSeason,
    },
};