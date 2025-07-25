import { dom } from '../../dom/domElements.js';

export function initializeIncomeCardObserver() {
    const incomeCards = dom.income.allIncomeCards;

    const responsiveThreshold = 365;
    const defaultThreshold = 385;

    incomeCards.forEach(card => {
        const monthlyIncomeGrids = card.querySelectorAll('.timeframe-income .four-col-grid');

        if (monthlyIncomeGrids.length > 0) {
            const resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    const currentWidth = entry.contentRect.width;
                    if (currentWidth < responsiveThreshold) {
                        card.classList.add('income-card--responsive');
                        card.dispatchEvent(new CustomEvent('cardsizechanged', { detail: { newSize: 1 }, bubbles: true }));
                        monthlyIncomeGrids.forEach(grid => {
                            grid.classList.add('column-layout');
                        });
                    } else if (currentWidth > defaultThreshold) {
                        card.classList.remove('income-card--responsive');
                        card.dispatchEvent(new CustomEvent('cardsizechanged', { detail: { newSize: 0 }, bubbles: true }));
                        monthlyIncomeGrids.forEach(grid => {
                            grid.classList.remove('column-layout');
                        });
                    }
                }
            });
            resizeObserver.observe(card);
        }
    });
}