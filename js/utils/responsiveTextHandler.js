export function initializeResponsiveTextHandler() {
    const storageTitle = document.getElementById('storage-title-text');
    const resultsTitle = document.getElementById('results-title-text');
    const homeRequiredOresTitle = document.getElementById('home-required-ores-title');
    const homeRemainingTimeTitle = document.getElementById('home-remaining-time-title');

    const mediaQuery = window.matchMedia('(max-width: 399px)');

    function handleMediaQueryChange(event) {
        if (event.matches) {
            if (storageTitle) storageTitle.textContent = 'Stored';
            if (resultsTitle) resultsTitle.textContent = 'Required';
            if (homeRequiredOresTitle) homeRequiredOresTitle.textContent = 'Ores';
            if (homeRemainingTimeTitle) homeRemainingTimeTitle.textContent = 'Time';
        } else {
            if (resultsTitle) resultsTitle.textContent = 'Required Ores';
            if (storageTitle) storageTitle.textContent = 'Stored Ores';
            if (homeRequiredOresTitle) homeRequiredOresTitle.textContent = 'Required Ores';
            if (homeRemainingTimeTitle) homeRemainingTimeTitle.textContent = 'Remaining Time';
        }
    }

    handleMediaQueryChange(mediaQuery);

    mediaQuery.addEventListener('change', handleMediaQueryChange);
}
