/**
 * @file Pure color parsing, easing, and channel interpolation utilities.
 */

/**
 * Parses hex or rgba string into numeric color channels.
 * @param {string} colorStr
 * @returns {{ r: number, g: number, b: number, a: number }}
 */
function parseColor(colorStr) {
    if (!colorStr || typeof colorStr !== 'string') {
        return { r: 0, g: 0, b: 0, a: 1 };
    }
    const clean = colorStr.trim();
    if (clean.startsWith('#')) {
        let hex = clean.substring(1);
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }
        const num = parseInt(hex, 16);
        return {
            r: (num >> 16) & 255,
            g: (num >> 8) & 255,
            b: num & 255,
            a: 1
        };
    }
    const rgbaMatch = clean.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
    if (rgbaMatch) {
        return {
            r: parseInt(rgbaMatch[1], 10),
            g: parseInt(rgbaMatch[2], 10),
            b: parseInt(rgbaMatch[3], 10),
            a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1
        };
    }
    return { r: 0, g: 0, b: 0, a: 1 };
}

/**
 * Interpolates smoothly between two colors based on progress (0 to 1).
 * @param {string|{ r: number, g: number, b: number, a: number }} fromColor
 * @param {string|{ r: number, g: number, b: number, a: number }} toColor
 * @param {number} progress
 * @returns {string}
 */
export function interpolateColor(fromColor, toColor, progress) {
    const c1 = typeof fromColor === 'string' ? parseColor(fromColor) : fromColor;
    const c2 = typeof toColor === 'string' ? parseColor(toColor) : toColor;
    const p = Math.max(0, Math.min(1, progress));

    const r = Math.round(c1.r + (c2.r - c1.r) * p);
    const g = Math.round(c1.g + (c2.g - c1.g) * p);
    const b = Math.round(c1.b + (c2.b - c1.b) * p);
    const a = c1.a + (c2.a - c1.a) * p;

    if (c1.a < 0.999 || c2.a < 0.999 || a < 0.999) {
        return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`;
    }
    const toHex = (n) => Math.min(255, Math.max(0, n)).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Standard cubic ease-in-out curve.
 * @param {number} t
 * @returns {number}
 */
export function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
