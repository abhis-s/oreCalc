import { getSupercellEventUrl } from '../../data/languagesData.js';
import { currencyData } from '../../data/pricingData.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import { getAddPlayerHelpContent, hideCardHelpPopover, showCardHelpPopover } from '../../utils/cardHelpPopover.js';
import { formatRegionalDate } from '../../utils/dateUtils.js';
import { updateCalculatedValue } from '../../utils/numberFormatter.js';

import { bindSelectInput } from '../common/formBindingUtils.js';
import { openBugReportModal } from '../appSettings/settingsSupportModals.js';
import { dom } from '../../dom/domElements.js';

/**
 * Initializes global income card event listeners, help popovers, and timeframe selector.
 */
export function initializeIncomeCardHandler() {
    let activeHelpBtn = null;

    const hideHelpPopover = () => {
        hideCardHelpPopover();
        activeHelpBtn = null;
    };

    const showHelpPopover = (btn, content) => {
        if (activeHelpBtn === btn) {
            hideHelpPopover();
            return;
        }

        activeHelpBtn = btn;
        showCardHelpPopover(btn, content, { isToggle: true });
    };

    const getPopoverContent = (btnOrKey) => {
        const infoKey = typeof btnOrKey === 'string' ? btnOrKey : btnOrKey.getAttribute('data-info');
        let body = '';
        let footer = null;

        if (infoKey === 'player.addPlayerHelp') {
            body = getAddPlayerHelpContent();
        } else if (infoKey === 'views.income.supercellEvents.help') {
            const currentLang = state.uiSettings?.language || 'en';
            body = translate(infoKey, { url: getSupercellEventUrl(currentLang) });
        } else if (infoKey === 'views.equipment.badgeRarityHelp' && typeof btnOrKey === 'object' && btnOrKey) {
            const rarity = btnOrKey.getAttribute('data-info-rarity') || btnOrKey.textContent.trim();
            body = translate('views.equipment.badgeRarityHelp', { rarity });
        } else {
            body = translate(infoKey);
        }

        // Allow element to supply custom footer text or translation key via data attributes
        if (typeof btnOrKey === 'object' && btnOrKey) {
            const customFooterKey = btnOrKey.getAttribute('data-info-footer-key');
            const customFooter = btnOrKey.getAttribute('data-info-footer');
            if (customFooterKey) {
                footer = translate(customFooterKey);
            } else if (customFooter) {
                footer = customFooter;
            }
        }

        // Automatic recommendation last updated date footer for rec badges
        if (!footer && infoKey && infoKey.startsWith('views.equipment.rec')) {
            const recDate = '2026-08-01';
            const formattedDate = formatRegionalDate(recDate);
            footer = translate('views.equipment.recommendationsLastUpdated', { date: formattedDate });
        }

        return { body, footer };
    };

    document.addEventListener('click', (e) => {
        const isNodeChipOrPopover = e.target.closest('.hero-journey-node-chip, .card-help-popover');
        if (isNodeChipOrPopover) return;

        const bugReportLink = e.target.closest('.open-inaccuracies-link, .open-bug-report-link');
        if (bugReportLink) {
            e.preventDefault();
            e.stopPropagation();
            hideHelpPopover();
            openBugReportModal();
            return;
        }

        const btn = e.target.closest('[data-info], .info-btn, .info-button');
        if (btn) {
            e.stopPropagation();
            const text = getPopoverContent(btn);
            showHelpPopover(btn, text);
        } else {
            hideHelpPopover();
        }
    });

    document.addEventListener('mouseover', (e) => {
        if (e.pointerType === 'touch' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        const targetBtn = /** @type {HTMLElement | null} */ (e.target)?.closest('.eq-badge[data-info], .hero-journey-upcoming-badge[data-info], .info-btn, .info-button, [data-info]');
        if (targetBtn && activeHelpBtn !== targetBtn) {
            const text = getPopoverContent(targetBtn);
            if (text) {
                showHelpPopover(targetBtn, text);
            }
        }
    });

    document.addEventListener('mouseout', (e) => {
        if (e.pointerType === 'touch' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        const targetBtn = /** @type {HTMLElement | null} */ (e.target)?.closest('.eq-badge[data-info], .hero-journey-upcoming-badge[data-info], .info-btn, .info-button, [data-info]');
        if (targetBtn && activeHelpBtn === targetBtn) {
            const related = /** @type {Node | null} */ (e.relatedTarget);
            if (!related || !targetBtn.contains(related)) {
                hideHelpPopover();
            }
        }
    });

    window.addEventListener('scroll', hideHelpPopover, { capture: true, passive: true });
    window.addEventListener('resize', hideHelpPopover, { passive: true });

    const timeframeSelect = dom.income?.home?.incomeCard?.timeframe;
    bindSelectInput(timeframeSelect, {
        onUpdate: (value) => {
            state.uiSettings.summaryTimeframe = value;
        }
    });
}

/**
 * Renders summary ore totals and currency costs in the Home income card.
 * @param {Partial<import('../../core/types.js').IncomeTimeframeRates>} [totalIncome] - Aggregated ore income totals across all sources.
 * @param {Partial<import('../../core/types.js').UISettingsState>} [uiSettings] - Active UI settings object.
 * @param {Record<string, number>} [totalMoneyCost] - Aggregated monetary and resource costs.
 */
export function renderIncomeCard(totalIncome = {}, uiSettings = {}, totalMoneyCost = {}) {
    const timeframeSelect = dom.income?.home?.incomeCard?.timeframe;

    if (!timeframeSelect) return;

    const timeframe = uiSettings?.summaryTimeframe || 'monthly';
    timeframeSelect.value = timeframe;

    const footerShiny = dom.income?.home?.incomeCard?.table?.totalRow?.shiny;
    const footerGlowy = dom.income?.home?.incomeCard?.table?.totalRow?.glowy;
    const footerStarry = dom.income?.home?.incomeCard?.table?.totalRow?.starry;

    updateCalculatedValue(footerShiny, totalIncome?.shiny || 0);
    updateCalculatedValue(footerGlowy, totalIncome?.glowy || 0);
    updateCalculatedValue(footerStarry, totalIncome?.starry || 0);

    const homeResourceElements = dom.income?.home?.incomeCard?.resources;
    if (homeResourceElements?.moneyValue) {
        const currencyCode = uiSettings?.currency?.code || 'USD';
        const selectedCurrencyKey = currencyCode.toUpperCase();
        const moneyValue = totalMoneyCost?.[selectedCurrencyKey] ?? totalMoneyCost?.USD ?? 0;
        const symbol = currencyData[currencyCode]?.symbol || '$';
        updateCalculatedValue(homeResourceElements.moneyValue, moneyValue, 2);
        if (homeResourceElements.moneySymbol && homeResourceElements.moneySymbol.textContent !== symbol) {
            homeResourceElements.moneySymbol.textContent = symbol;
        }
    }
}
