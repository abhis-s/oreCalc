import { state } from './state.js';

import { easeInOutCubic, interpolateColor } from '../utils/colorUtils.js';

import { dom } from '../dom/domElements.js';

export const availableAccents = ['blue', 'gold', 'purple', 'green', 'red'];

let themeRenderCallback = null;

/**
 * Registers application render callback for theme animations.
 * @param {(stateObj: any) => void} cb
 */
export function setThemeRenderCallback(cb) {
    themeRenderCallback = cb;
}

let sessionRandomAccent = (typeof window !== 'undefined' && window.sessionRandomAccent) || null;
let lastAppliedAccentColor = null;
let currentAppliedColors = null;
let activeColorAnimationId = null;

export const THEME_PALETTE = {
    blue: {
        dark: {
            primary: '#8ab4f8', hover: '#aecbfa', soft: 'rgba(138, 180, 248, 0.1)',
            bgApp: '#0f131a', bgPrimary: '#1a1f2b', bgSecondary: '#252c3d', bgTertiary: '#2e374d'
        },
        light: {
            primary: '#1a73e8', hover: '#1967d2', soft: 'rgba(26, 115, 232, 0.12)',
            bgApp: '#f4f8ff', bgPrimary: '#ffffff', bgSecondary: '#e9f2ff', bgTertiary: '#d9e8ff'
        }
    },
    gold: {
        dark: {
            primary: '#fde293', hover: '#feefc3', soft: 'rgba(253, 226, 147, 0.1)',
            bgApp: '#1a180f', bgPrimary: '#262215', bgSecondary: '#362f1d', bgTertiary: '#423b1f'
        },
        light: {
            primary: '#f9ab00', hover: '#f29900', soft: 'rgba(249, 171, 0, 0.12)',
            bgApp: '#fffbf0', bgPrimary: '#ffffff', bgSecondary: '#fff4e1', bgTertiary: '#ffecd1'
        }
    },
    purple: {
        dark: {
            primary: '#ce93d8', hover: '#e1bee7', soft: 'rgba(206, 147, 216, 0.1)',
            bgApp: '#16111a', bgPrimary: '#211a26', bgSecondary: '#2d2236', bgTertiary: '#3b2a47'
        },
        light: {
            primary: '#9c27b0', hover: '#8e24aa', soft: 'rgba(156, 39, 176, 0.12)',
            bgApp: '#fbf5ff', bgPrimary: '#ffffff', bgSecondary: '#f3e8ff', bgTertiary: '#ebd9ff'
        }
    },
    green: {
        dark: {
            primary: '#a8dab5', hover: '#ceead6', soft: 'rgba(168, 218, 181, 0.1)',
            bgApp: '#0f1a14', bgPrimary: '#16261d', bgSecondary: '#1d3627', bgTertiary: '#264230'
        },
        light: {
            primary: '#34a853', hover: '#1e8e3e', soft: 'rgba(52, 168, 83, 0.12)',
            bgApp: '#f0fff4', bgPrimary: '#ffffff', bgSecondary: '#e2fbe9', bgTertiary: '#cff9de'
        }
    },
    red: {
        dark: {
            primary: '#f8b4ae', hover: '#fad2cf', soft: 'rgba(248, 180, 174, 0.1)',
            bgApp: '#1a0f0f', bgPrimary: '#261515', bgSecondary: '#361d1d', bgTertiary: '#421f1f'
        },
        light: {
            primary: '#ee675c', hover: '#ea4335', soft: 'rgba(238, 103, 92, 0.12)',
            bgApp: '#fff5f5', bgPrimary: '#ffffff', bgSecondary: '#ffe3e3', bgTertiary: '#ffd1d1'
        }
    }
};

const DARK_TYPOGRAPHY_AND_BORDERS = {
    textPrimary: '#ffffff',
    textSecondary: '#dee2e6',
    textMuted: '#bdc1c6',
    borderPrimary: '#5f6368',
    borderSecondary: '#3c4043'
};

const LIGHT_TYPOGRAPHY_AND_BORDERS = {
    textPrimary: '#2d3139',
    textSecondary: '#494d55',
    textMuted: '#686c75',
    borderPrimary: '#bdc1c6',
    borderSecondary: '#dee2e6'
};

/**
 * Applies target colors immediately to CSS custom properties.
 * @param {Record<string, string>} colors
 */
function applyTargetColorsImmediately(colors) {
    const targets = [document.documentElement, document.body].filter(Boolean);
    targets.forEach(target => {
        target.style.setProperty('--accent-primary', colors.primary);
        target.style.setProperty('--accent-primary-hover', colors.hover);
        target.style.setProperty('--accent-primary-active', colors.primary);
        target.style.setProperty('--accent-primary-soft', colors.soft);
        target.style.setProperty('--accent-hover', colors.hover);
        target.style.setProperty('--accent-soft', colors.soft);

        target.style.setProperty('--bg-app', colors.bgApp);
        target.style.setProperty('--bg-surface-primary', colors.bgPrimary);
        target.style.setProperty('--bg-surface-secondary', colors.bgSecondary);
        target.style.setProperty('--bg-surface-tertiary', colors.bgTertiary);

        if (colors.textPrimary) target.style.setProperty('--text-primary', colors.textPrimary);
        if (colors.textSecondary) target.style.setProperty('--text-secondary', colors.textSecondary);
        if (colors.textMuted) target.style.setProperty('--text-muted', colors.textMuted);
        if (colors.borderPrimary) target.style.setProperty('--border-primary', colors.borderPrimary);
        if (colors.borderSecondary) target.style.setProperty('--border-secondary', colors.borderSecondary);
    });

    currentAppliedColors = { ...colors };

    let metaThemeColor = /** @type {HTMLMetaElement|null} */ (document.querySelector('meta[name="theme-color"]'));
    if (!metaThemeColor) {
        metaThemeColor = document.createElement('meta');
        metaThemeColor.name = 'theme-color';
        document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', colors.bgApp);
}

/**
 * Gets currently computed colors on document.body.
 * @param {Record<string, string>} fallback
 * @returns {Record<string, string>}
 */
function getCurrentBodyColors(fallback) {
    const body = document.body;
    if (!body || typeof getComputedStyle !== 'function') return fallback;
    const computed = getComputedStyle(body);
    return {
        primary: computed.getPropertyValue('--accent-primary').trim() || fallback.primary,
        hover: computed.getPropertyValue('--accent-primary-hover').trim() || fallback.hover,
        soft: computed.getPropertyValue('--accent-primary-soft').trim() || fallback.soft,
        bgApp: computed.getPropertyValue('--bg-app').trim() || fallback.bgApp,
        bgPrimary: computed.getPropertyValue('--bg-surface-primary').trim() || fallback.bgPrimary,
        bgSecondary: computed.getPropertyValue('--bg-surface-secondary').trim() || fallback.bgSecondary,
        bgTertiary: computed.getPropertyValue('--bg-surface-tertiary').trim() || fallback.bgTertiary,
        textPrimary: computed.getPropertyValue('--text-primary').trim() || fallback.textPrimary || '#ffffff',
        textSecondary: computed.getPropertyValue('--text-secondary').trim() || fallback.textSecondary || '#dee2e6',
        textMuted: computed.getPropertyValue('--text-muted').trim() || fallback.textMuted || '#bdc1c6',
        borderPrimary: computed.getPropertyValue('--border-primary').trim() || fallback.borderPrimary || '#5f6368',
        borderSecondary: computed.getPropertyValue('--border-secondary').trim() || fallback.borderSecondary || '#3c4043'
    };
}

/**
 * Smoothly morphs theme CSS variables from current color channels to target over durationMs.
 * @param {Record<string, string>} targetColors
 * @param {number} [durationMs=2000]
 * @param {(() => void)|null} [onComplete=null]
 * @param {Record<string, string>|null} [explicitStartColors=null]
 */
function animateThemeColors(targetColors, durationMs = 2000, onComplete = null, explicitStartColors = null) {
    if (typeof requestAnimationFrame !== 'function') {
        applyTargetColorsImmediately(targetColors);
        if (onComplete) onComplete();
        return;
    }

    if (activeColorAnimationId) {
        cancelAnimationFrame(activeColorAnimationId);
        activeColorAnimationId = null;
    }

    const startColors = explicitStartColors || currentAppliedColors || getCurrentBodyColors(targetColors);
    const startTime = performance.now();

    const frame = (now) => {
        const elapsed = now - startTime;
        const rawProgress = Math.min(1, elapsed / durationMs);
        const easedProgress = easeInOutCubic(rawProgress);

        const intermediateColors = {
            primary: interpolateColor(startColors.primary, targetColors.primary, easedProgress),
            hover: interpolateColor(startColors.hover, targetColors.hover, easedProgress),
            soft: interpolateColor(startColors.soft, targetColors.soft, easedProgress),
            bgApp: interpolateColor(startColors.bgApp, targetColors.bgApp, easedProgress),
            bgPrimary: interpolateColor(startColors.bgPrimary, targetColors.bgPrimary, easedProgress),
            bgSecondary: interpolateColor(startColors.bgSecondary, targetColors.bgSecondary, easedProgress),
            bgTertiary: interpolateColor(startColors.bgTertiary, targetColors.bgTertiary, easedProgress),
            textPrimary: interpolateColor(startColors.textPrimary || '#ffffff', targetColors.textPrimary, easedProgress),
            textSecondary: interpolateColor(startColors.textSecondary || '#dee2e6', targetColors.textSecondary, easedProgress),
            textMuted: interpolateColor(startColors.textMuted || '#bdc1c6', targetColors.textMuted, easedProgress),
            borderPrimary: interpolateColor(startColors.borderPrimary || '#5f6368', targetColors.borderPrimary, easedProgress),
            borderSecondary: interpolateColor(startColors.borderSecondary || '#3c4043', targetColors.borderSecondary, easedProgress)
        };

        applyTargetColorsImmediately(intermediateColors);

        if (rawProgress < 1) {
            activeColorAnimationId = requestAnimationFrame(frame);
        } else {
            activeColorAnimationId = null;
            applyTargetColorsImmediately(targetColors);
            currentAppliedColors = { ...targetColors };
            if (onComplete) onComplete();
        }
    };

    activeColorAnimationId = requestAnimationFrame(frame);
}

/**
 * Applies theme and accent colors to document and styles.
 * @param {string} theme - 'light' or 'dark'
 * @param {string} accentColor - 'blue', 'gold', 'purple', 'green', 'red', or 'random'
 * @param {{ isSwatchClick?: boolean }|string|null} [origin=null]
 */
export function applyThemeSettings(theme, accentColor, origin = null) {
    let effectiveAccentColor = accentColor;
    if (accentColor === 'random') {
        if (!sessionRandomAccent || (origin && typeof origin === 'object' && origin.isSwatchClick)) {
            const remainingAccents = lastAppliedAccentColor
                ? availableAccents.filter(color => color !== lastAppliedAccentColor)
                : availableAccents;
            sessionRandomAccent = remainingAccents[Math.floor(Math.random() * remainingAccents.length)];
        }
        effectiveAccentColor = sessionRandomAccent;
    }

    const startColors = currentAppliedColors ? { ...currentAppliedColors } : getCurrentBodyColors({
        primary: '#8ab4f8', hover: '#aecbfa', soft: 'rgba(138, 180, 248, 0.1)',
        bgApp: '#0f131a', bgPrimary: '#1a1f2b', bgSecondary: '#252c3d', bgTertiary: '#2e374d',
        textPrimary: '#ffffff', textSecondary: '#dee2e6', textMuted: '#bdc1c6',
        borderPrimary: '#5f6368', borderSecondary: '#3c4043'
    });

    if (theme === 'light') {
        document.body.classList.add('light-mode');
        document.body.classList.remove('dark-mode');
        document.documentElement.classList.add('light-mode');
        document.documentElement.classList.remove('dark-mode');
        document.documentElement.style.setProperty('color-scheme', 'light');
        document.body.style.setProperty('color-scheme', 'light');
    } else {
        document.body.classList.add('dark-mode');
        document.body.classList.remove('light-mode');
        document.documentElement.classList.add('dark-mode');
        document.documentElement.classList.remove('light-mode');
        document.documentElement.style.setProperty('color-scheme', 'dark');
        document.body.style.setProperty('color-scheme', 'dark');
    }

    const themePalette = THEME_PALETTE[effectiveAccentColor] || THEME_PALETTE.blue;
    const baseColors = theme === 'light' ? themePalette.light : themePalette.dark;
    const typographyAndBorders = theme === 'light' ? LIGHT_TYPOGRAPHY_AND_BORDERS : DARK_TYPOGRAPHY_AND_BORDERS;
    const colors = { ...baseColors, ...typographyAndBorders };

    const welcomeModal = document.getElementById('welcome-modal');
    if (welcomeModal && welcomeModal.classList.contains('show')) {
        const currentAccent = state?.uiSettings?.accentColor || 'random';
        welcomeModal.querySelectorAll('#welcome-accent-picker .accent-swatch').forEach(s => {
            s.classList.toggle('active', /** @type {HTMLElement} */ (s).dataset.color === currentAccent);
        });
    }

    lastAppliedAccentColor = effectiveAccentColor;

    if (origin) {
        animateThemeColors(colors, 2000, () => {
            if (themeRenderCallback) {
                themeRenderCallback(state);
            }
        }, startColors);
    } else {
        applyTargetColorsImmediately(colors);
    }
}

/**
 * Convenience method for applying theme with default accent.
 * @param {string} theme
 * @param {any} [origin=null]
 */
export function applyTheme(theme, origin = null) {
    applyThemeSettings(theme, state.uiSettings.accentColor || 'random', origin || 'manual-toggle');
}

/**
 * Animates preloader background color on startup.
 * @param {string} targetBgColor
 * @param {number} [durationMs=1100]
 */
export function animatePreloaderBackground(targetBgColor, durationMs = 1100) {
    const preloader = dom.preloader || document.getElementById('preloader');
    if (!preloader) return;

    const isLight = preloader.getAttribute('data-theme') === 'light' ||
        document.documentElement.classList.contains('light-mode');
    const startBg = isLight ? '#ffffff' : '#121212';
    const startTime = performance.now();

    const frame = (now) => {
        const elapsed = now - startTime;
        const rawProgress = Math.min(1, elapsed / durationMs);
        const easedProgress = easeInOutCubic(rawProgress);
        const currentHex = interpolateColor(startBg, targetBgColor, easedProgress);
        preloader.style.backgroundColor = currentHex;

        if (rawProgress < 1 && preloader.style.display !== 'none') {
            requestAnimationFrame(frame);
        } else {
            preloader.style.backgroundColor = targetBgColor;
        }
    };

    requestAnimationFrame(frame);
}
