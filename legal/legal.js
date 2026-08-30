// Standalone Legal & Policy Page Client Controller
// Manages dark/light theme switching, button accessibility states, and iframe message sync.
document.addEventListener('DOMContentLoaded', () => {
    const themeBtn = document.getElementById('theme-toggle-btn');

    /**
     * Retrieves the active data-theme from the html root element.
     * @returns {string} 'dark' | 'light'
     */
    function getTheme() {
        return document.documentElement.getAttribute('data-theme') || 'dark';
    }

    const MOON_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
    const SUN_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';

    /**
     * Updates document theme and syncs toggle button presentation.
     * @param {string} newTheme - 'dark' | 'light'
     */
    function updateTheme(newTheme) {
        document.documentElement.setAttribute('data-theme', newTheme);
        if (themeBtn) {
            const isLight = newTheme === 'light';
            themeBtn.innerHTML = isLight ? MOON_ICON : SUN_ICON;
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

    // Referrer-aware and opener-aware back navigation
    const backLink = document.querySelector('.back-link');
    if (backLink) {
        backLink.addEventListener('click', (e) => {
            // Restore focus to opener tab when spawned from in-app link
            if (window.opener && !window.opener.closed) {
                e.preventDefault();
                try {
                    window.opener.focus();
                } catch (_) {}
                window.close();
                setTimeout(() => {
                    if (!document.hidden) window.location.href = '/';
                }, 300);
                return;
            }

            // Return to previous page when internal history exists on the same origin
            if (window.history.length > 1 && document.referrer) {
                try {
                    const referrerUrl = new URL(document.referrer);
                    if (referrerUrl.origin === window.location.origin) {
                        e.preventDefault();
                        window.history.back();
                        return;
                    }
                } catch (_) {}
            }

            // Close tab on standalone launch or fall back to home route
            if (window.history.length <= 1) {
                e.preventDefault();
                window.close();
                setTimeout(() => {
                    if (!document.hidden) window.location.href = '/';
                }, 300);
            }
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
