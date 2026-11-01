/**
 * Calendar module façade re-exporting display, input handling, and scheduler components.
 */

export {
    getMidnightUTCTime,
    getHeroColor,
    getEquipmentSchedule,
    getWeeksInMonth,
    getCurrentView,
    setCurrentView
} from './calendarScheduler.js';

export {
    setAnimateNextRender,
    renderCalendar,
    positionTrackAtIndex
} from './calendarDisplay.js';

export {
    updateHeader,
    renderMonthChips,
    updateActiveChip
} from './calendarMonthChipsDisplay.js';

export {
    createDayCell,
    generateMonthGrid,
    generateWeekGrid
} from './calendarGridDisplay.js';

export {
    handleEquipmentBadgeMouseEnter,
    handleEquipmentBadgeMouseLeave,
    handleDayCellMouseEnter,
    handleDayCellMouseLeave
} from './calendarMilestonesDisplay.js';

export {
    shiftNext,
    shiftPrev,
    snapBack,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleWheel,
    handleMediaQueryChange
} from './calendarGestures.js';

export {
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleChipDropOnCalendar
} from './calendarDragDrop.js';

export {
    handleMonthChipClick,
    handleWeekChipClick,
    initializeCalendarEventListeners
} from './calendarInputs.js';
