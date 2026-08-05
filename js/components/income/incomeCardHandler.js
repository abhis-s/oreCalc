import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { translate } from '../../i18n/translator.js';
import { getSupercellEventUrl } from '../../data/languagesData.js';

import { currencyData } from '../../data/appData.js';
import { formatNumber, formatCurrency, updateCalculatedValue } from '../../utils/numberFormatter.js';

export function initializeIncomeCardHandler() {
    // 1. Card Help Popover Setup
    let helpPopover = document.getElementById('card-help-popover');
    if (!helpPopover) {
        helpPopover = document.createElement('div');
        helpPopover.id = 'card-help-popover';
        helpPopover.className = 'card-help-popover';
        document.body.appendChild(helpPopover);
    }

    let activeHelpBtn = null;

    const hideHelpPopover = () => {
        if (helpPopover) {
            helpPopover.classList.remove('show');
        }
        activeHelpBtn = null;
    };

    const showHelpPopover = (btn, content) => {
        if (activeHelpBtn === btn) {
            hideHelpPopover();
            return;
        }

        activeHelpBtn = btn;

        let bodyHtml = typeof content === 'string' ? content : (content?.body || '');
        let footerHtml = typeof content === 'object' ? (content?.footer || null) : null;

        let innerHTML = `<div class="popover-body">${bodyHtml}</div>`;
        if (footerHtml) {
            innerHTML += `<div class="popover-footer">${footerHtml}</div>`;
        }

        helpPopover.innerHTML = innerHTML;
        helpPopover.classList.add('show');

        const positionPopover = () => {
            if (activeHelpBtn !== btn) return;
            const popoverRect = helpPopover.getBoundingClientRect();
            const btnRect = btn.getBoundingClientRect();

            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;

            const spaceAbove = btnRect.top;
            const placeBelow = spaceAbove < popoverRect.height + 10;

            let top = 0;
            if (placeBelow) {
                top = btnRect.bottom + 6;
            } else {
                top = btnRect.top - popoverRect.height - 6;
            }

            let left = btnRect.left + (btnRect.width / 2) - (popoverRect.width / 2);

            if (left < 12) {
                left = 12;
            } else if (left + popoverRect.width > viewportWidth - 12) {
                left = viewportWidth - popoverRect.width - 12;
            }

            helpPopover.style.top = `${top}px`;
            helpPopover.style.left = `${left}px`;
        };

        positionPopover();
        setTimeout(positionPopover, 0);
    };

    function formatRegionalDate(isoDateStr) {
        if (!isoDateStr) return '';
        try {
            const parts = isoDateStr.split('-');
            if (parts.length !== 3) return isoDateStr;
            const [year, month, day] = parts.map(Number);
            const date = new Date(Date.UTC(year, month - 1, day));
            const lang = state.uiSettings?.language || 'en';
            return new Intl.DateTimeFormat(lang, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC'
            }).format(date);
        } catch (e) {
            return isoDateStr;
        }
    }

    const getPopoverContent = (btnOrKey) => {
        const infoKey = typeof btnOrKey === 'string' ? btnOrKey : btnOrKey.getAttribute('data-info');
        let body = '';
        let footer = null;

        if (infoKey === 'income.supercellEvents.help') {
            const currentLang = state.uiSettings?.language || 'en';
            body = translate(infoKey, { url: getSupercellEventUrl(currentLang) });
        } else if (infoKey === 'equipment.badgeRarityHelp' && typeof btnOrKey === 'object' && btnOrKey) {
            const rarity = btnOrKey.getAttribute('data-info-rarity') || btnOrKey.textContent.trim();
            body = translate('equipment.badgeRarityHelp', { rarity });
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
        if (!footer && infoKey && infoKey.startsWith('equipment.rec')) {
            const recDate = '2026-08-01';
            const formattedDate = formatRegionalDate(recDate);
            footer = translate('equipment.recommendationsLastUpdated', { date: formattedDate });
        }

        return { body, footer };
    };

    document.addEventListener('click', (e) => {
        const bugReportLink = e.target.closest('.open-inaccuracies-link, .open-bug-report-link');
        if (bugReportLink) {
            e.preventDefault();
            e.stopPropagation();
            hideHelpPopover();
            import('../appSettings/appSettings.js').then(module => {
                if (module.openBugReportModal) {
                    module.openBugReportModal();
                }
            });
            return;
        }

        const btn = e.target.closest('.info-btn, .eq-badge[data-info]');
        if (btn) {
            e.stopPropagation();
            const text = getPopoverContent(btn);
            showHelpPopover(btn, text);
        } else {
            hideHelpPopover();
        }
    });

    document.addEventListener('mouseover', (e) => {
        const badge = e.target.closest('.eq-badge[data-info]');
        if (badge && activeHelpBtn !== badge) {
            const text = getPopoverContent(badge);
            showHelpPopover(badge, text);
        }
    });

    document.addEventListener('mouseout', (e) => {
        const badge = e.target.closest('.eq-badge[data-info]');
        if (badge && activeHelpBtn === badge) {
            const related = e.relatedTarget;
            if (!related || !badge.contains(related)) {
                hideHelpPopover();
            }
        }
    });

    window.addEventListener('scroll', hideHelpPopover, { capture: true, passive: true });
    window.addEventListener('resize', hideHelpPopover, { passive: true });

    // 2. Timeframe Selection Setup
    const timeframeSelect = dom.income?.home?.incomeCard?.timeframe;

    if (!timeframeSelect) return;

    timeframeSelect.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            state.uiSettings.summaryTimeframe = e.target.value;
        });
    });
}

export function renderIncomeCard(totalIncome, uiSettings, totalMoneyCost) {
    const timeframeSelect = dom.income?.home?.incomeCard?.timeframe;

    if (!timeframeSelect) return;

    const timeframe = uiSettings.summaryTimeframe || 'monthly';
    timeframeSelect.value = timeframe;

    const footerShiny = dom.income?.home?.incomeCard?.table?.totalRow?.shiny;
    const footerGlowy = dom.income?.home?.incomeCard?.table?.totalRow?.glowy;
    const footerStarry = dom.income?.home?.incomeCard?.table?.totalRow?.starry;

    updateCalculatedValue(footerShiny, totalIncome.shiny || 0);
    updateCalculatedValue(footerGlowy, totalIncome.glowy || 0);
    updateCalculatedValue(footerStarry, totalIncome.starry || 0);

    const homeResourceElements = dom.income.home.incomeCard.resources;
    if (homeResourceElements.moneyValue) {
        const selectedCurrencyKey = uiSettings.currency.code.toUpperCase();
        const moneyValue = totalMoneyCost?.[selectedCurrencyKey] || totalMoneyCost?.USD || 0;
        const symbol = currencyData[uiSettings.currency.code]?.symbol || '';
        homeResourceElements.moneyValue.textContent = formatCurrency(moneyValue);
        homeResourceElements.moneySymbol.textContent = symbol;
    }
}
