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
        placement: 'bottom',
        onEnter: async () => {
            const { openDropdown } = await import('../components/player/playerDropdown.js');
            openDropdown();
        },
        onLeave: async () => {
            const { closeDropdown } = await import('../components/player/playerDropdown.js');
            closeDropdown();
        }
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
            return isSmallScreen ? 'views.tour.fabTitle' : 'views.tour.saveTitle';
        },
        descKey: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? 'views.tour.fabDesc' : 'views.tour.saveDesc';
        },
        placement: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? 'top' : 'left';
        },
        onEnter: async () => {
            const isSmallScreen = window.innerWidth < 780;
            if (isSmallScreen) {
                const mainFab = document.getElementById('main-fab');
                const fabMenu = document.querySelector('.fab-menu');
                const overlay = document.getElementById('overlay');
                if (mainFab && fabMenu) {
                    mainFab.classList.add('active');
                    fabMenu.classList.add('show');
                    overlay?.classList.add('show');
                    document.body.classList.add('open-fab');
                }
            } else {
                const saveBtn = document.getElementById('floating-save-btn');
                if (saveBtn) {
                    saveBtn.dataset.originalDisplay = saveBtn.style.display;
                    saveBtn.style.setProperty('display', 'block', 'important');
                }
            }
        },
        onLeave: async () => {
            const isSmallScreen = window.innerWidth < 780;
            if (isSmallScreen) {
                const { closeFabMenu } = await import('../components/fab/fab.js');
                closeFabMenu();
            } else {
                const saveBtn = document.getElementById('floating-save-btn');
                if (saveBtn && saveBtn.dataset.originalDisplay !== undefined) {
                    saveBtn.style.display = saveBtn.dataset.originalDisplay;
                    delete saveBtn.dataset.originalDisplay;
                }
            }
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
        titleKey: 'views.tour.navEquipmentTitle',
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
        placement: 'bottom',
        onEnter: async () => {

            const { openEquipmentDetailsModal } = await import('../components/equipment/equipmentDetailsModal.js');
            const { state } = await import('../core/state.js');
            const playerLevel = state.heroes?.['Dragon Duke']?.equipment?.['Fire Heart']?.level || 1;
            await openEquipmentDetailsModal('Fire Heart', playerLevel);
            await new Promise(resolve => setTimeout(resolve, 300));
        },
        onLeave: async () => {
            const closeBtn = document.getElementById('close-eq-details-modal-btn');
            if (closeBtn) closeBtn.click();
            await new Promise(resolve => setTimeout(resolve, 200));
        }
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
        titleKey: 'views.tour.navIncomeTitle',
        descKey: 'views.tour.navIncomeDesc',
        placement: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? 'top' : 'bottom';
        },
        onEnter: () => {
            document.querySelectorAll('.income-card .card-title').forEach(el => {
                el.classList.add('tour-glow-title');
            });
        },
        onLeave: () => {
            document.querySelectorAll('.income-card .card-title').forEach(el => {
                el.classList.remove('tour-glow-title');
            });
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
        titleKey: 'views.tour.targetTitle',
        descKey: 'views.tour.targetDesc',
        placement: 'bottom'
    },
    {
        id: 'hero-carousel',
        setId: 'v1.0',
        order: '04.02',
        target: '.planner-hero-carousel',
        tab: 'planner',
        titleKey: 'views.tour.disableHeroEquipmentTitle',
        descKey: 'views.tour.heroCarouselDesc',
        placement: 'bottom'
    },
    {
        id: 'priority-list',
        setId: 'v1.0',
        order: '04.03',
        target: '#priority-list-card',
        tab: 'planner',
        titleKey: 'views.tour.priorityTitle',
        descKey: 'views.tour.priorityDesc',
        placement: 'bottom'
    },
    {
        id: 'calendar-planner',
        setId: 'v1.0',
        order: '04.04',
        target: '#calendar-container',
        tab: 'planner',
        titleKey: 'views.tour.calendarTitle',
        descKey: 'views.tour.calendarDesc',
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
        titleKey: 'views.tour.incomeChipsTitle',
        descKey: 'views.tour.incomeChipsDesc',
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
        titleKey: 'views.tour.navSettingsTitle',
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
        titleKey: 'views.tour.preferencesTitle',
        descKey: 'views.tour.preferencesDesc',
        placement: 'bottom'
    },
    {
        id: 'backup-sync',
        setId: 'v1.0',
        order: '05.02',
        target: '#backup-sync-card',
        tab: 'settings',
        titleKey: 'views.tour.backupSyncTitle',
        descKey: 'views.tour.backupSyncDesc',
        placement: 'bottom'
    }
];
