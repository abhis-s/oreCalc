/**
 * OreCalc — Standalone Legal & Policy Page Client Controller
 * Manages dark/light theme switching, button accessibility states, and iframe message sync.
 */
document.addEventListener('DOMContentLoaded', () => {
    const themeBtn = document.getElementById('theme-toggle-btn');

    /**
     * Retrieves the active data-theme from the html root element.
     * @returns {string} 'dark' | 'light'
     */
    function getTheme() {
        return document.documentElement.getAttribute('data-theme') || 'dark';
    }

    /**
     * Updates document theme and syncs toggle button presentation.
     * @param {string} newTheme - 'dark' | 'light'
     */
    function updateTheme(newTheme) {
        document.documentElement.setAttribute('data-theme', newTheme);
        if (themeBtn) {
            const isLight = newTheme === 'light';
            themeBtn.innerHTML = isLight ? '🌙' : '☀️';
            themeBtn.setAttribute('aria-label', isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode');
        }
    }

    // Sync button initial state with active theme
    updateTheme(getTheme());

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const currentTheme = getTheme();
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            updateTheme(newTheme);
        });
    }

    // Listen for theme change messages from host window when embedded in settings modal iframe
    window.addEventListener('message', (event) => {
        if (event.data && typeof event.data === 'object' && (event.data.type === 'theme-toggle' || event.data.type === 'theme-change') && event.data.theme) {
            updateTheme(event.data.theme);
        } else if (event.data && typeof event.data === 'string' && (event.data === 'dark' || event.data === 'light')) {
            updateTheme(event.data);
        }
    });
});
