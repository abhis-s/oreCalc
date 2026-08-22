import { translate } from '../../i18n/translator.js';

import { CALENDAR_SETTINGS_DEFAULTS } from '../../core/constants.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { autoPlaceIncomeChips } from '../../utils/autoPlaceChips.js';
import { clearMonthCalendarChips } from '../../utils/chipManager.js';
import { getISOWeekNumber } from '../../utils/dateUtils.js';
import { closeModalAnimated, openModal } from '../../utils/modalHistoryManager.js';

import { handleChipDropOnCalendar, handleDragLeave, handleDragOver, handleDrop } from './calendarDragDrop.js';
import { positionTrackAtIndex, renderCalendar, setAnimateNextRender } from './calendarDisplay.js';
import {
    handleMediaQueryChange,
    handleTouchEnd,
    handleTouchMove,
    handleTouchStart,
    handleWheel
} from './calendarGestures.js';
import { renderMonthChips } from './calendarMonthChipsRenderer.js';
import { getCurrentView, getEquipmentSchedule } from './calendarScheduler.js';
import { showDayOverviewPopover } from './dayOverviewPopover.js';
import { renderIncomeChips } from './incomeChipsDisplay.js';
import { showConfirm } from '../../ui/noticeModal.js';

/**
 * Handles click interactions on month chips to navigate the calendar to the target month.
 * @param {MouseEvent|KeyboardEvent|any} e - Native click or keydown event.
 */
export function handleMonthChipClick(e) {
    const chip = e.target?.closest?.('.month-chip') || e.currentTarget;
    if (!chip || !chip.dataset) return;
    const year = chip.dataset.year;
    const month = chip.dataset.month;
    if (!year || !month) return;
    const newMonth = `${year}-${month}`;

    if (state.planner.calendar.view.month !== newMonth) {
        handleStateUpdate(() => {
            state.planner.calendar.view.month = newMonth;
            const firstDayOfMonth = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, 1));
            const [firstWeekYear, firstWeekNumber] = getISOWeekNumber(firstDayOfMonth);
            state.planner.calendar.view.week = `${firstWeekYear}-${String(firstWeekNumber).padStart(2, '0')}`;
        });
        setAnimateNextRender(true);
        renderCalendar(state.planner);
    }
}

/**
 * Handles click interactions on week chips to navigate the calendar to the target week.
 * @param {MouseEvent|KeyboardEvent|any} e - Native click or keydown event.
 */
export function handleWeekChipClick(e) {
    e.stopPropagation?.();
    const chip = e.target?.closest?.('.week-chip') || e.currentTarget;
    if (!chip || !chip.dataset) return;
    const year = chip.dataset.year;
    const week = chip.dataset.week;
    if (!year || !week) return;
    const newWeek = `${year}-${String(week).padStart(2, '0')}`;

    if (state.planner.calendar.view.week !== newWeek) {
        handleStateUpdate(() => {
            state.planner.calendar.view.week = newWeek;
        });
        setAnimateNextRender(true);
        renderCalendar(state.planner);
    }
}

const mediaQuery = window.matchMedia('(max-width: 630px)');

/**
 * Initializes calendar container touch gestures, drag-and-drop listeners, and settings modal handlers.
 */
export function initializeCalendarEventListeners() {
    const calendarContainer = document.getElementById('calendar-container');
    const calendarTrack = document.getElementById('calendar-track');
    const deleteCurrentMonthChipsBtn = document.getElementById('delete-current-month-chips-btn');
    const deleteAllChipsBtn = document.getElementById('delete-all-chips-btn');
    const calendarSettingsBtn = document.getElementById('calendar-settings-btn');
    const autoPlaceChipsBtn = document.getElementById('auto-place-chips-btn');

    const calendarSettingsModal = document.getElementById('calendar-settings-modal');
    const closeCalendarSettingsModalBtn = document.getElementById('close-calendar-settings-modal-btn');
    const cancelCalendarSettingsBtn = document.getElementById('cancel-calendar-settings-btn');
    const saveCalendarSettingsBtn = document.getElementById('save-calendar-settings-btn');
    const firstDaySelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('calendar-first-day-select'));
    const showIconsSwitch = /** @type {HTMLInputElement|null} */ (document.getElementById('calendar-show-icons-switch'));
    const showEquipmentMilestonesSwitch = /** @type {HTMLInputElement|null} */ (document.getElementById('calendar-show-equipment-milestones-switch'));
    const highlightUpgradeRangesSwitch = /** @type {HTMLInputElement|null} */ (document.getElementById('calendar-highlight-upgrade-ranges-switch'));
    const autoPlaceScopeSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('calendar-auto-place-scope-select'));

    if (calendarContainer) {
        calendarContainer.addEventListener('wheel', handleWheel, { passive: false });
        calendarContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
        calendarContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
        calendarContainer.addEventListener('touchend', handleTouchEnd, { passive: true });
        calendarContainer.addEventListener('touchcancel', handleTouchEnd, { passive: true });
        calendarContainer.addEventListener('dragover', handleDragOver);
        calendarContainer.addEventListener('dragleave', handleDragLeave);
        calendarContainer.addEventListener('drop', handleDrop);
        calendarContainer.addEventListener('click', (e) => {
            if (state.isChipDragging) return;
            const target = /** @type {HTMLElement} */ (e.target);
            if (target?.closest?.('.calendar-equipment-badge')) return;
            const dayCell = /** @type {HTMLElement|null} */ (target?.closest?.('.day-cell'));
            if (!dayCell) return;

            const hasChips = dayCell.querySelector('.income-chip');
            const isSpecialDay = dayCell.classList.contains('equipment-completion-day') || dayCell.classList.contains('equipment-accumulating');
            if (hasChips || isSpecialDay) {
                const dateStr = dayCell.dataset.date;
                if (dateStr) {
                    const [y, m, d] = dateStr.split('-').map(Number);
                    const date = new Date(Date.UTC(y, m - 1, d));
                    const schedule = getEquipmentSchedule();
                    showDayOverviewPopover(dayCell, date, state.planner, schedule);
                }
            }
        });
    }

    const monthChipContainer = document.getElementById('month-chip-container');
    if (monthChipContainer) {
        monthChipContainer.addEventListener('click', (e) => {
            const weekChip = e.target?.closest?.('.week-chip');
            if (weekChip) {
                handleWeekChipClick(e);
                return;
            }
            const monthChip = e.target?.closest?.('.month-chip');
            if (monthChip) {
                handleMonthChipClick(e);
            }
        });
        monthChipContainer.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const weekChip = e.target?.closest?.('.week-chip');
                if (weekChip) {
                    e.preventDefault();
                    handleWeekChipClick(e);
                    return;
                }
                const monthChip = e.target?.closest?.('.month-chip');
                if (monthChip) {
                    e.preventDefault();
                    handleMonthChipClick(e);
                }
            }
        });
    }

    mediaQuery.addEventListener('change', handleMediaQueryChange);
    handleMediaQueryChange(mediaQuery);

    window.addEventListener('resize', () => {
        const currentView = getCurrentView();
        if (currentView === 'monthly' || currentView === 'weekly') {
            if (calendarTrack) {
                const activeIndex = Math.max(0, calendarTrack.children.length - 2);
                positionTrackAtIndex(activeIndex);
            }
        }
    });

    if (deleteCurrentMonthChipsBtn) {
        deleteCurrentMonthChipsBtn.addEventListener('click', async () => {
            const confirm = await showConfirm(translate('views.planner.confirmDeleteMonth'));
            if (!confirm) return;
            handleStateUpdate(() => {
                if (!state.planner?.calendar?.view?.month) return;
                const [year, month] = state.planner.calendar.view.month.split('-');
                const monthYearKey = `${year}-${month}`;
                clearMonthCalendarChips(monthYearKey);
            });
            setAnimateNextRender(true);
            renderCalendar(state.planner);
            if (state.planner?.calendar?.view?.month) {
                const [yearStr, monthStr] = state.planner.calendar.view.month.split('-');
                renderIncomeChips(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1);
            }
        });
    }

    if (deleteAllChipsBtn) {
        deleteAllChipsBtn.addEventListener('click', async () => {
            const confirm = await showConfirm(translate('views.planner.confirmDeleteAll'));
            if (!confirm) return;
            handleStateUpdate(() => {
                state.planner.calendar.dates = {};
                state.planner.calendar.customChips = [];
                state.planner.calendar.customChipData = {};
            });
            setAnimateNextRender(true);
            renderCalendar(state.planner);
            if (state.planner?.calendar?.view?.month) {
                const [yearStr, monthStr] = state.planner.calendar.view.month.split('-');
                renderIncomeChips(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1);
            }
        });
    }

    if (autoPlaceChipsBtn) {
        autoPlaceChipsBtn.addEventListener('click', () => {
            const [yearStr, monthStr] = state.planner.calendar.view.month.split('-');
            setAnimateNextRender('auto-placed');
            autoPlaceIncomeChips(monthStr, yearStr);
        });
    }

    if (calendarSettingsBtn) {
        calendarSettingsBtn.addEventListener('click', () => {
            const settings = state.planner.calendar.settings;
            if (firstDaySelect) firstDaySelect.value = settings.firstDayOfWeek;
            if (showIconsSwitch) showIconsSwitch.checked = settings.showChipIcons;
            if (showEquipmentMilestonesSwitch) showEquipmentMilestonesSwitch.checked = settings.showEquipmentMilestones !== false;
            if (highlightUpgradeRangesSwitch) highlightUpgradeRangesSwitch.checked = settings.highlightUpgradeRanges !== false;
            if (autoPlaceScopeSelect) autoPlaceScopeSelect.value = settings.autoPlaceScope;
            if (calendarSettingsModal) openModal(calendarSettingsModal);
        });
    }

    if (closeCalendarSettingsModalBtn) {
        closeCalendarSettingsModalBtn.addEventListener('click', () => {
            if (calendarSettingsModal) closeModalAnimated(calendarSettingsModal);
        });
    }

    if (cancelCalendarSettingsBtn) {
        cancelCalendarSettingsBtn.addEventListener('click', () => {
            if (calendarSettingsModal) closeModalAnimated(calendarSettingsModal);
        });
    }

    if (saveCalendarSettingsBtn) {
        saveCalendarSettingsBtn.addEventListener('click', () => {
            handleStateUpdate(() => {
                state.planner.calendar.settings = {
                    firstDayOfWeek: firstDaySelect ? firstDaySelect.value : CALENDAR_SETTINGS_DEFAULTS.firstDayOfWeek,
                    showChipIcons: showIconsSwitch ? showIconsSwitch.checked : CALENDAR_SETTINGS_DEFAULTS.showChipIcons,
                    showEquipmentMilestones: showEquipmentMilestonesSwitch ? showEquipmentMilestonesSwitch.checked : CALENDAR_SETTINGS_DEFAULTS.showEquipmentMilestones,
                    highlightUpgradeRanges: highlightUpgradeRangesSwitch ? highlightUpgradeRangesSwitch.checked : CALENDAR_SETTINGS_DEFAULTS.highlightUpgradeRanges,
                    autoPlaceScope: autoPlaceScopeSelect ? autoPlaceScopeSelect.value : CALENDAR_SETTINGS_DEFAULTS.autoPlaceScope
                };
            });
            if (calendarSettingsModal) {
                closeModalAnimated(calendarSettingsModal, () => {
                    setAnimateNextRender(true);
                    renderCalendar(state.planner);
                });
            } else {
                setAnimateNextRender(true);
                renderCalendar(state.planner);
            }
        });
    }

    document.addEventListener('languageChanged', () => {
        setAnimateNextRender(true);
        renderCalendar(state.planner);
        renderMonthChips();
    });

    document.addEventListener('chipDropOnCalendar', (e) => {
        const customEv = /** @type {CustomEvent} */ (e);
        const { incomeChipData, chipContainer } = customEv.detail || {};
        if (incomeChipData && chipContainer) {
            handleChipDropOnCalendar(incomeChipData, chipContainer);
        }
    });

    document.addEventListener('calendarChipsPlaced', () => {
        renderCalendar(state.planner);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initializeCalendarEventListeners();
});
