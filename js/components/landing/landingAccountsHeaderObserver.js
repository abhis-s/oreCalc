/**
 * Saved Accounts Header Adaptive Layout & Compaction Observer.
 * Progressively collapses button labels from left to right as width constrains:
 *   Tier 0 (Full): [Refresh] [Manage] [Add Village]
 *   Tier 1 (Leftmost hides first): [Refresh-Icon] [Manage] [Add Village]
 *   Tier 2 (Middle hides second): [Refresh-Icon] [Manage-Icon] [Add Village]
 *   Tier 3 (Rightmost hides last): [Refresh-Icon] [Manage-Icon] [Add-Icon]
 * Tier 4: UI Layout Controller.
 */

/**
 * @typedef {Object} HeaderLayoutMetrics
 * @property {number} tier0Req
 * @property {number} tier1Req
 * @property {number} tier2Req
 */

/**
 * Measures the unconstrained required widths for all 3 compaction tiers.
 *
 * @param {HTMLElement} headerEl
 * @param {HTMLElement} titleGroup
 * @param {HTMLElement} refreshBtn
 * @param {HTMLElement} manageBtn
 * @param {HTMLElement} addBtn
 * @returns {HeaderLayoutMetrics | null}
 */
function measureHeaderMetrics(headerEl, titleGroup, refreshBtn, manageBtn, addBtn) {
    if (!headerEl || !titleGroup || !refreshBtn || !manageBtn || !addBtn) {
        return null;
    }

    const hadCompactRefresh = headerEl.classList.contains('has-compact-refresh');
    const hadCompactManage = headerEl.classList.contains('has-compact-manage');
    const hadCompactAdd = headerEl.classList.contains('has-compact-add');

    // Temporarily clear compact classes to measure full natural unconstrained widths
    headerEl.classList.remove('has-compact-refresh', 'has-compact-manage', 'has-compact-add');

    const titleWidth = titleGroup.getBoundingClientRect().width;
    const refreshFull = refreshBtn.getBoundingClientRect().width;
    const manageFull = manageBtn.getBoundingClientRect().width;
    const addFull = addBtn.getBoundingClientRect().width;

    // Apply compact classes to measure icon-only button widths
    headerEl.classList.add('has-compact-refresh', 'has-compact-manage', 'has-compact-add');
    const refreshIcon = refreshBtn.getBoundingClientRect().width || 32;
    const manageIcon = manageBtn.getBoundingClientRect().width || 32;

    // Restore classes
    headerEl.classList.toggle('has-compact-refresh', hadCompactRefresh);
    headerEl.classList.toggle('has-compact-manage', hadCompactManage);
    headerEl.classList.toggle('has-compact-add', hadCompactAdd);

    // If elements aren't rendered or visible, avoid caching zero
    if (titleWidth === 0 || refreshFull === 0) {
        return null;
    }

    // Exact computed styles from the DOM
    const headerStyle = window.getComputedStyle(headerEl);
    const colGap = parseFloat(headerStyle.columnGap) || 8;
    const pad = (parseFloat(headerStyle.paddingLeft) || 0) + (parseFloat(headerStyle.paddingRight) || 0);

    const actions = headerEl.querySelector('.landing-accounts-actions');
    const actionsStyle = actions ? window.getComputedStyle(actions) : null;
    const actionGap = actionsStyle ? (parseFloat(actionsStyle.gap) || 4) : 4;

    // Safety buffer for subpixel rounding (1px)
    const subpixelBuffer = 1;

    return {
        tier0Req: titleWidth + colGap + pad + refreshFull + manageFull + addFull + (2 * actionGap) + subpixelBuffer,
        tier1Req: titleWidth + colGap + pad + refreshIcon + manageFull + addFull + (2 * actionGap) + subpixelBuffer,
        tier2Req: titleWidth + colGap + pad + refreshIcon + manageIcon + addFull + (2 * actionGap) + subpixelBuffer
    };
}

/**
 * Initializes a content-aware ResizeObserver on the saved accounts header.
 *
 * @param {HTMLElement} headerEl
 * @returns {() => void} Teardown function
 */
export function initAccountsHeaderLayoutObserver(headerEl) {
    if (!headerEl || typeof ResizeObserver === 'undefined') {
        return () => {};
    }

    const titleGroup = headerEl.querySelector('.landing-accounts-title-group');
    const actionsEl = headerEl.querySelector('.landing-accounts-actions');
    const refreshBtn = /** @type {HTMLElement | null} */ (headerEl.querySelector('#landing-refresh-accounts-btn'));
    const manageBtn = /** @type {HTMLElement | null} */ (headerEl.querySelector('#landing-manage-accounts-btn'));
    const addBtn = /** @type {HTMLElement | null} */ (headerEl.querySelector('#landing-toggle-add-btn'));

    if (!titleGroup || !actionsEl || !refreshBtn || !manageBtn || !addBtn) {
        return () => {};
    }

    /** @type {HeaderLayoutMetrics | null} */
    let cachedMetrics = null;

    /**
     * Applies compaction tier classes based on available header width.
     * @param {number} width
     */
    const updateCompaction = (width) => {
        if (width <= 0) return;

        if (!cachedMetrics) {
            cachedMetrics = measureHeaderMetrics(
                headerEl,
                /** @type {HTMLElement} */ (titleGroup),
                refreshBtn,
                manageBtn,
                addBtn
            );
        }

        if (!cachedMetrics) return;

        const isTier1 = width < cachedMetrics.tier0Req; // Hide Refresh
        const isTier2 = width < cachedMetrics.tier1Req; // Hide Manage
        const isTier3 = width < cachedMetrics.tier2Req; // Hide Add Village

        headerEl.classList.toggle('has-compact-refresh', isTier1);
        headerEl.classList.toggle('has-compact-manage', isTier2);
        headerEl.classList.toggle('has-compact-add', isTier3);

        // Empirical anti-wrap guarantee: if flexbox still wrapped due to fonts or zoom, compact next tier
        if (actionsEl.offsetTop > titleGroup.offsetTop + 4) {
            if (!headerEl.classList.contains('has-compact-refresh')) {
                headerEl.classList.add('has-compact-refresh');
            }
            if (actionsEl.offsetTop > titleGroup.offsetTop + 4 && !headerEl.classList.contains('has-compact-manage')) {
                headerEl.classList.add('has-compact-manage');
            }
            if (actionsEl.offsetTop > titleGroup.offsetTop + 4 && !headerEl.classList.contains('has-compact-add')) {
                headerEl.classList.add('has-compact-add');
            }
        }
    };

    const observer = new ResizeObserver(() => {
        if (headerEl.clientWidth > 0) {
            updateCompaction(headerEl.clientWidth);
        }
    });

    observer.observe(headerEl);

    // Initial check if already rendered
    if (headerEl.clientWidth > 0) {
        updateCompaction(headerEl.clientWidth);
    }

    // Invalidate cached measurements on language change or web font completion
    const handleMetricsInvalidation = () => {
        cachedMetrics = null;
        if (headerEl.clientWidth > 0) {
            updateCompaction(headerEl.clientWidth);
        }
    };

    if (typeof document !== 'undefined' && document.fonts?.ready) {
        document.fonts.ready.then(handleMetricsInvalidation).catch(() => {});
    }

    document.addEventListener('languageChanged', handleMetricsInvalidation);
    document.addEventListener('app:translate', handleMetricsInvalidation);
    window.addEventListener('languageChanged', handleMetricsInvalidation);

    return () => {
        observer.disconnect();
        document.removeEventListener('languageChanged', handleMetricsInvalidation);
        document.removeEventListener('app:translate', handleMetricsInvalidation);
        window.removeEventListener('languageChanged', handleMetricsInvalidation);
    };
}
