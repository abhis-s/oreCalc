export function initializeSettingsCardObserver() {
    const settingsCards = document.querySelectorAll('.settings-card');

    const responsiveThreshold = 365;
    const defaultThreshold = 410;

    settingsCards.forEach(card => {
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const currentWidth = entry.contentRect.width;
                if (currentWidth < responsiveThreshold) {
                    card.classList.add('settings-card--responsive');
                } else if (currentWidth > defaultThreshold) {
                    card.classList.remove('settings-card--responsive');
                }
            }
        });
        resizeObserver.observe(card);
    });
}
