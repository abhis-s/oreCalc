import { townHallLeagueFloors } from '../../data/incomeSources/starBonus.js';
import { leagueTiers } from '../../data/leagueTiers.js';
import { translate } from '../../i18n/translator.js';

import { syncWelcomeInertState } from './welcomeCarouselDisplay.js';
import { welcomeState } from './welcomeModalState.js';

const safeRaf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 0);

/**
 * Renders pagination dots for the Welcome Modal profile setup wizard.
 */
export function renderWizardDots() {
    const wizardDotsContainer = document.getElementById('welcome-dots');
    if (!wizardDotsContainer) return;

    wizardDotsContainer.innerHTML = '';
    welcomeState.wizardSteps.forEach((stepNum, index) => {
        const dot = document.createElement('span');
        dot.className = 'welcome-wizard-dot';
        dot.dataset.index = String(index);
        if (index === welcomeState.currentWizardStepIndex) {
            dot.classList.add('active');
        }
        wizardDotsContainer.appendChild(dot);
    });
}

/**
 * Updates step visibility, step indicator label, navigation buttons, and initial focus for active wizard step.
 */
export function updateWizardStepView() {
    const activeStep = welcomeState.wizardSteps[welcomeState.currentWizardStepIndex];

    const steps = document.querySelectorAll('.wizard-step');
    steps.forEach(step => {
        const stepNum = Number(step.dataset.step) || 0;
        if (stepNum === activeStep) {
            step.style.display = 'flex';
        } else {
            step.style.display = 'none';
        }
    });

    const indicator = document.getElementById('welcome-wizard-step-indicator');
    if (indicator) {
        indicator.textContent = translate('views.tour.step', { current: welcomeState.currentWizardStepIndex + 1, total: welcomeState.wizardSteps.length });
    }

    const dots = document.querySelectorAll('#welcome-dots .welcome-wizard-dot');
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === welcomeState.currentWizardStepIndex);
    });

    const backBtn = document.getElementById('welcome-wizard-back-btn');
    const nextBtn = document.getElementById('welcome-wizard-next-btn');

    if (backBtn) {
        backBtn.textContent = translate('views.welcome.back');
    }

    if (nextBtn) {
        if (welcomeState.currentWizardStepIndex === welcomeState.wizardSteps.length - 1) {
            nextBtn.textContent = translate('views.welcome.done');
        } else {
            nextBtn.textContent = translate('views.welcome.next');
        }
    }

    if (activeStep === 1) {
        setTimeout(() => {
            const container = document.getElementById('welcome-guest-th-list');
            if (container) {
                const activeBadge = container.querySelector('.th-badge-item.active');
                if (activeBadge) {
                    const scrollLeft = activeBadge.offsetLeft - (container.clientWidth / 2) + (activeBadge.clientWidth / 2);
                    container.scrollTo({ left: scrollLeft, behavior: 'auto' });
                }
            }
        }, 150);
    }

    syncWelcomeInertState();

    safeRaf(() => {
        const wizardView = document.getElementById('welcome-profile-setup-wizard-view');
        if (!wizardView || window.getComputedStyle(wizardView).display === 'none') return;
        const currentStepEl = wizardView.querySelector(`.wizard-step[data-step="${activeStep}"]`);
        if (!currentStepEl) return;
        const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';
        const firstControl = currentStepEl.querySelector(selector);
        if (firstControl && typeof firstControl.focus === 'function' && !firstControl.closest('[inert]')) {
            firstControl.focus();
        }
    });
}

/**
 * Rebuilds the Guest setup League tier dropdown options clamped to Town Hall floor limits.
 */
export function updateGuestLeagueDropdown() {
    const leagueSelect = document.getElementById('welcome-guest-league-select');
    const leagueIcon = document.getElementById('welcome-guest-league-icon');
    if (!leagueSelect || !leagueIcon) return;

    const currentTH = welcomeState.selectedTH;
    const floorLeagueId = townHallLeagueFloors[currentTH] || 0;
    const previouslySelected = parseInt(leagueSelect.value || welcomeState.selectedLeague, 10);

    leagueSelect.innerHTML = '';

    const unrankedLeague = leagueTiers.items.find(l => l.id === 105000000);
    if (unrankedLeague) {
        const option = document.createElement('option');
        option.value = String(unrankedLeague.id);
        const translationKey = 'entities.leagues.' + unrankedLeague.name.toLowerCase()
            .replace(/\./g, '')
            .replace(/\s(i+)$/i, (match, p1) => p1.toUpperCase())
            .replace(/\s/g, '_');
        option.textContent = translate(translationKey);
        option.dataset.i18n = translationKey;
        leagueSelect.appendChild(option);
    }

    const availableLeagues = leagueTiers.items.filter(league => {
        if (league.id === 105000000) return false;
        return league.id >= floorLeagueId;
    });

    availableLeagues.forEach(league => {
        const option = document.createElement('option');
        option.value = String(league.id);
        const translationKey = 'entities.leagues.' + league.name.toLowerCase()
            .replace(/\./g, '')
            .replace(/\s(i+)$/i, (match, p1) => p1.toUpperCase())
            .replace(/\s/g, '_');
        option.textContent = translate(translationKey);
        option.dataset.i18n = translationKey;
        leagueSelect.appendChild(option);
    });

    const isPreviousValid = availableLeagues.some(l => l.id === previouslySelected) || previouslySelected === 105000000;
    if (isPreviousValid) {
        leagueSelect.value = String(previouslySelected);
    } else {
        const highestLeague = availableLeagues[availableLeagues.length - 1];
        leagueSelect.value = highestLeague ? String(highestLeague.id) : "105000000";
    }

    const currentSelectedLeagueId = parseInt(leagueSelect.value, 10);
    welcomeState.selectedLeague = currentSelectedLeagueId;
    const currentLeagueData = leagueTiers.items.find(l => l.id === currentSelectedLeagueId);
    if (currentLeagueData && currentLeagueData.iconUrls?.small) {
        leagueIcon.src = currentLeagueData.iconUrls.small;
    }
}
