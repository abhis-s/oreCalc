export const tourSets = [
    {
        id: 'v1.0',
        releasedAt: 0, // 0 ensures all existing users get the full tour on first run
        label: 'Initial Release'
    }
];

export const tourSteps = [
    {
        id: 'profile-dropdown',
        setId: 'v1.0',
        order: 1,
        target: '.player-dropdown-container',
        tab: 'home',
        titleKey: 'tour.profileTitle',
        descKey: 'tour.profileDesc',
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
        id: 'action-sync',
        setId: 'v1.0',
        order: 2,
        target: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? '.fab-container' : '#floating-save-btn';
        },
        tab: 'home',
        titleKey: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? 'tour.fabTitle' : 'tour.saveTitle';
        },
        descKey: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? 'tour.fabDesc' : 'tour.saveDesc';
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
                if (mainFab && fabMenu && !mainFab.classList.contains('active')) {
                    mainFab.click();
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
        order: 3,
        target: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? '.nav-button[data-tab="equipment"]' : '.tab-button[data-tab="equipment"]';
        },
        tab: 'equipment',
        titleKey: 'tour.navEquipmentTitle',
        descKey: 'tour.navEquipmentDesc',
        placement: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? 'top' : 'bottom';
        }
    },
    {
        id: 'eq-settings',
        setId: 'v1.0',
        order: 4,
        target: '#eq-settings-container-card',
        tab: 'equipment',
        titleKey: 'tour.eqSettingsTitle',
        descKey: 'tour.eqSettingsDesc',
        placement: 'bottom'
    },
    {
        id: 'ore-storage',
        setId: 'v1.0',
        order: 5,
        target: '#eq-storage-container-card',
        tab: 'equipment',
        titleKey: 'tour.oresTitle',
        descKey: 'tour.oresDesc',
        placement: 'bottom'
    },
    {
        // Navigates to Income, highlights the tab button, and glows all income card titles
        id: 'nav-income',
        setId: 'v1.0',
        order: 6,
        target: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? '.nav-button[data-tab="income"]' : '.tab-button[data-tab="income"]';
        },
        tab: 'income',
        titleKey: 'tour.navIncomeTitle',
        descKey: 'tour.navIncomeDesc',
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
        order: 7,
        target: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? '.nav-button[data-tab="planner"]' : '.tab-button[data-tab="planner"]';
        },
        tab: 'planner',
        titleKey: 'tour.navPlannerTitle',
        descKey: 'tour.navPlannerDesc',
        placement: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? 'top' : 'bottom';
        }
    },
    {
        id: 'target-levels',
        setId: 'v1.0',
        order: 8,
        target: '.max-level-card-header',
        tab: 'planner',
        titleKey: 'tour.targetTitle',
        descKey: 'tour.targetDesc',
        placement: 'bottom'
    },
    {
        id: 'hero-carousel',
        setId: 'v1.0',
        order: 9,
        target: '.planner-hero-carousel',
        tab: 'planner',
        titleKey: 'tour.heroCarouselTitle',
        descKey: 'tour.heroCarouselDesc',
        placement: 'bottom'
    },
    {
        id: 'priority-list',
        setId: 'v1.0',
        order: 10,
        target: '#priority-list-card',
        tab: 'planner',
        titleKey: 'tour.priorityTitle',
        descKey: 'tour.priorityDesc',
        placement: 'bottom'
    },
    {
        id: 'calendar-planner',
        setId: 'v1.0',
        order: 11,
        target: '#calendar-container',
        tab: 'planner',
        titleKey: 'tour.calendarTitle',
        descKey: 'tour.calendarDesc',
        placement: 'top'
    },
    {
        id: 'income-chips',
        setId: 'v1.0',
        order: 12,
        target: '#income-chips-card',
        tab: 'planner',
        titleKey: 'tour.incomeChipsTitle',
        descKey: 'tour.incomeChipsDesc',
        placement: 'top'
    },
    {
        // Navigates to Settings, highlights the tab button
        id: 'nav-settings',
        setId: 'v1.0',
        order: 13,
        target: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? '.nav-button[data-tab="settings"]' : '.tab-button[data-tab="settings"]';
        },
        tab: 'settings',
        titleKey: 'tour.navSettingsTitle',
        descKey: 'tour.navSettingsDesc',
        placement: () => {
            const isSmallScreen = window.innerWidth < 780;
            return isSmallScreen ? 'top' : 'bottom';
        }
    },
    {
        id: 'preferences',
        setId: 'v1.0',
        order: 14,
        target: '#preferences-card',
        tab: 'settings',
        titleKey: 'tour.preferencesTitle',
        descKey: 'tour.preferencesDesc',
        placement: 'bottom'
    },
    {
        id: 'backup-sync',
        setId: 'v1.0',
        order: 15,
        target: '#backup-sync-card',
        tab: 'settings',
        titleKey: 'tour.backupSyncTitle',
        descKey: 'tour.backupSyncDesc',
        placement: 'bottom'
    }
];
