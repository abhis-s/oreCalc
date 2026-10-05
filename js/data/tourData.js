export const tourSets = [
    {
        id: 'v1.0',
        releasedAt: 0, // 0 ensures all existing users get the full tour on first run
        label: 'Initial Release'
    },
    {
        id: 'v2.0-equipment-details',
        releasedAt: 1786060800000, // August 7, 2026 00:00 UTC
        label: 'Equipment Details Modal'
    },
    {
        id: 'v2.0-hero-journey',
        releasedAt: 1786492800000, // August 12, 2026 00:00 UTC
        label: "Hero's Journey Track"
    }
];

export const tourSteps = [
    {
        id: 'profile-dropdown',
        setId: 'v1.0',
        order: '01.01',
        target: '.player-dropdown-container',
        tab: 'home',
        titleKey: 'views.tour.profileTitle',
        descKey: 'views.tour.profileDesc',
        placement: 'bottom'
    },
    {
        id: 'player-profile-card',
        setId: 'v1.0',
        order: '01.02',
        target: '#home-player-profile-card',
        tab: 'home',
        titleKey: 'views.tour.profileCardTitle',
        descKey: 'views.tour.profileCardDesc',
        placement: 'bottom'
    },
    {
        id: 'hero-journey-card',
        setId: 'v2.0-hero-journey',
        order: '01.03',
        target: '#home-hj-card',
        tab: 'home',
        titleKey: 'views.tour.heroJourneyTitle',
        descKey: 'views.tour.heroJourneyDesc',
        placement: 'bottom'
    },
    {
        id: 'action-sync',
        setId: 'v1.0',
        order: '01.10',
        target: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? '.fab-container' : '#floating-save-btn';
        },
        tab: 'home',
        titleKey: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? 'actions.actionsMenu' : 'views.tour.saveTitle';
        },
        descKey: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? 'views.tour.fabDesc' : 'views.tour.saveDesc';
        },
        placement: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? 'top' : 'left';
        }
    },
    {
        // Navigates to Equipment, then highlights the tab button
        id: 'nav-equipment',
        setId: 'v1.0',
        order: '02',
        target: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? '.nav-button[data-tab="equipment"]' : '.tab-button[data-tab="equipment"]';
        },
        tab: 'equipment',
        titleKey: 'nav.equipment',
        descKey: 'views.tour.navEquipmentDesc',
        placement: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? 'top' : 'bottom';
        }
    },
    {
        id: 'eq-details-card',
        setId: 'v2.0-equipment-details',
        order: '02.01',
        target: () => {
            return document.querySelector('#heroes-container .equipment-image, .hero-equipment-card .equipment-image, .equipment-card .equipment-image') || document.querySelector('.equipment-image') || '#heroes-container';
        },
        tab: 'equipment',
        titleKey: 'views.tour.eqDetailsCardTitle',
        descKey: 'views.tour.eqDetailsCardDesc',
        placement: 'bottom'
    },
    {
        id: 'eq-details-modal',
        setId: 'v2.0-equipment-details',
        order: '02.01.01',
        target: () => {
            return document.querySelector('#equipment-details-modal .eq-details-modal-container') || document.querySelector('#equipment-details-modal .modal-content') || '#equipment-details-modal';
        },
        tab: 'equipment',
        titleKey: 'views.tour.eqDetailsModalTitle',
        descKey: 'views.tour.eqDetailsModalDesc',
        placement: 'bottom'
    },
    {
        id: 'eq-settings',
        setId: 'v1.0',
        order: '02.02',
        target: '#eq-settings-container-card',
        tab: 'equipment',
        titleKey: 'views.tour.eqSettingsTitle',
        descKey: 'views.tour.eqSettingsDesc',
        placement: 'bottom'
    },
    {
        id: 'ore-storage',
        setId: 'v1.0',
        order: '02.03',
        target: '#eq-storage-container-card',
        tab: 'equipment',
        titleKey: 'views.tour.oresTitle',
        descKey: 'views.tour.oresDesc',
        placement: 'bottom'
    },
    {
        // Navigates to Income, highlights the tab button, and glows all income card titles
        id: 'nav-income',
        setId: 'v1.0',
        order: '03',
        target: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? '.nav-button[data-tab="income"]' : '.tab-button[data-tab="income"]';
        },
        tab: 'income',
        titleKey: 'nav.income',
        descKey: 'views.tour.navIncomeDesc',
        placement: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? 'top' : 'bottom';
        }
    },
    {
        // Navigates to Planner, highlights the tab button
        id: 'nav-planner',
        setId: 'v1.0',
        order: '04',
        target: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? '.nav-button[data-tab="planner"]' : '.tab-button[data-tab="planner"]';
        },
        tab: 'planner',
        titleKey: 'views.tour.navPlannerTitle',
        descKey: 'views.tour.navPlannerDesc',
        placement: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? 'top' : 'bottom';
        }
    },
    {
        id: 'target-levels',
        setId: 'v1.0',
        order: '04.01',
        target: '#planner-max-levels-card',
        tab: 'planner',
        titleKey: 'views.planner.customMaxLevel',
        descKey: 'views.planner.customMaxLevelHelp',
        placement: 'bottom'
    },
    {
        id: 'hero-carousel',
        setId: 'v1.0',
        order: '04.02',
        target: '.planner-hero-carousel',
        tab: 'planner',
        titleKey: 'views.tour.disableHeroEquipmentTitle',
        descKey: 'views.planner.heroCarouselHelp',
        placement: 'bottom'
    },
    {
        id: 'priority-list',
        setId: 'v1.0',
        order: '04.03',
        target: '#priority-list-card',
        tab: 'planner',
        titleKey: 'views.planner.priorityList',
        descKey: 'views.planner.priorityListHelp',
        placement: 'bottom'
    },
    {
        id: 'calendar-planner',
        setId: 'v1.0',
        order: '04.04',
        target: '#calendar-container',
        tab: 'planner',
        titleKey: 'views.planner.calendarTitle',
        descKey: 'views.planner.calendarHelp',
        placement: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? 'bottom' : 'top';
        }
    },
    {
        id: 'income-chips',
        setId: 'v1.0',
        order: '04.05',
        target: '#income-chips-card',
        tab: 'planner',
        titleKey: 'views.income.chipsTitle',
        descKey: 'views.planner.incomeChipsHelp',
        placement: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? 'bottom' : 'top';
        }
    },

    {
        // Navigates to Settings, highlights the tab button
        id: 'nav-settings',
        setId: 'v1.0',
        order: '05',
        target: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? '.nav-button[data-tab="settings"]' : '.tab-button[data-tab="settings"]';
        },
        tab: 'settings',
        titleKey: 'nav.settings',
        descKey: 'views.tour.navSettingsDesc',
        placement: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? 'top' : 'bottom';
        }
    },
    {
        id: 'preferences',
        setId: 'v1.0',
        order: '05.01',
        target: '#preferences-card',
        tab: 'settings',
        titleKey: 'views.settings.cards.preferences',
        descKey: 'views.tour.preferencesDesc',
        placement: 'bottom'
    },
    {
        id: 'backup-sync',
        setId: 'v1.0',
        order: '05.02',
        target: '#account-card',
        tab: 'settings',
        titleKey: 'views.settings.cards.accountAndSync',
        descKey: 'views.tour.backupSyncDesc',
        placement: 'bottom'
    }
];
