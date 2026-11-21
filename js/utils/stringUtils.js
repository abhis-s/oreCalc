/**
 * Converts a string with spaces or underscores into camelCase.
 * Example: "Giant Gauntlet" -> "giantGauntlet", "barbarian_puppet" -> "barbarianPuppet"
 * @param {string} str
 * @returns {string}
 */
export function toCamelCase(str) {
    if (!str) return '';
    const trimmed = String(str).trim();
    if (!trimmed) return '';
    if (/^[a-z][a-zA-Z0-9]*$/.test(trimmed) && /[A-Z]/.test(trimmed)) {
        return trimmed;
    }
    const separated = trimmed.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    const words = separated.toLowerCase().split(/[\s_-]+/).filter(word => word.length > 0);
    if (words.length === 0) return '';
    return words[0] + words.slice(1).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}

/**
 * Converts a string with spaces, underscores, or camelCase boundaries into kebab-case.
 * Example: "giantGauntlet" -> "giant-gauntlet", "raid_starry" -> "raid-starry"
 * @param {string} str
 * @returns {string}
 */
export function toKebabCase(str) {
    if (!str) return '';
    return String(str)
        .trim()
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();
}

/**
 * Escapes HTML special characters in a string.
 * @param {string | number | boolean | null | undefined} [str]
 * @returns {string}
 */
export function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#96;');
}

const ALLOWED_HTML_TAGS = new Set(['span', 'strong', 'em', 'code', 'br', 'p', 'b', 'i', 'a']);
const ALLOWED_HTML_CLASSES = new Set(['user-id-code', 'external-link', 'theme-link', 'open-inaccuracies-link']);
const ALLOWED_HTML_IDS = new Set([
    'auth-terms-link',
    'auth-privacy-link',
    'add-player-terms-link',
    'add-player-privacy-link',
    'bug-report-privacy-link',
    'feedback-privacy-link'
]);
const BLOCKED_HTML_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'svg', 'img', 'video', 'audio']);

/**
 * Sanitizes HTML input to allow only safe formatting elements, classes, and modal link IDs.
 * Discards dangerous elements such as script, iframe, objects, images, audio, video, etc.
 *
 * @param {string} html - The raw HTML string to sanitize.
 * @returns {string} The sanitized HTML safe for innerHTML insertion.
 */
export function sanitizeHTML(html) {
    if (!html) return '';
    try {
        if (typeof DOMParser === 'undefined' || typeof document === 'undefined') {
            let s = html.replace(/<(script|style|iframe|object|embed|svg|img|video|audio|meta|link)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '');
            s = s.replace(/<(script|style|iframe|object|embed|svg|img|video|audio|meta|link)\b[^>]*>/gi, '');
            s = s.replace(/\s*on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');
            s = s.replace(/\s+id\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s>]+))/gi, (_, q1, q2, uq) => {
                const idVal = q1 ?? q2 ?? uq ?? '';
                return ALLOWED_HTML_IDS.has(idVal) ? ` id="${idVal}"` : '';
            });
            s = s.replace(/<a\b([^>]*)>/gi, (_, attrs) => {
                let cleanAttrs = attrs;
                const hrefMatch = cleanAttrs.match(/\bhref\s*=\s*(['"])(.*?)\1/i);
                if (hrefMatch) {
                    const rawHref = hrefMatch[2].trim();
                    const isSafe = /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(rawHref) &&
                        !/^javascript:/i.test(rawHref) &&
                        !/^data:/i.test(rawHref);
                    if (!isSafe) {
                        cleanAttrs = cleanAttrs.replace(hrefMatch[0], 'href="#"');
                    }
                }
                if (!/\brel\s*=/i.test(cleanAttrs)) {
                    cleanAttrs += ' rel="noopener noreferrer"';
                }
                return `<a${cleanAttrs}>`;
            });
            return s;
        }
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        function cleanNode(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                return node.cloneNode(true);
            }
            if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName.toLowerCase();
                if (BLOCKED_HTML_TAGS.has(tagName)) {
                    return document.createDocumentFragment();
                }
                if (ALLOWED_HTML_TAGS.has(tagName)) {
                    const cleanedElement = document.createElement(tagName);
                    if (node.id && ALLOWED_HTML_IDS.has(node.id)) {
                        cleanedElement.id = node.id;
                    }
                    if (node.className) {
                        const classes = Array.from(node.classList).filter(cls => ALLOWED_HTML_CLASSES.has(cls));
                        if (classes.length > 0) {
                            cleanedElement.className = classes.join(' ');
                        }
                    }
                    if (tagName === 'a') {
                        const rawHref = (node.getAttribute('href') || '').trim();
                        const isSafe = /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(rawHref) && !/^javascript:/i.test(rawHref) && !/^data:/i.test(rawHref);
                        if (isSafe) {
                            cleanedElement.setAttribute('href', rawHref);
                        }
                        if (node.getAttribute('target') === '_blank') {
                            cleanedElement.setAttribute('target', '_blank');
                        }
                        cleanedElement.setAttribute('rel', 'noopener noreferrer');
                    }
                    for (const child of Array.from(node.childNodes)) {
                        cleanedElement.appendChild(cleanNode(child));
                    }
                    return cleanedElement;
                }
            }
            const fragment = document.createDocumentFragment();
            for (const child of Array.from(node.childNodes)) {
                fragment.appendChild(cleanNode(child));
            }
            return fragment;
        }

        const container = document.createElement('div');
        for (const child of Array.from(doc.body.childNodes)) {
            container.appendChild(cleanNode(child));
        }
        return container.innerHTML;
    } catch (_) {
        return escapeHTML(html);
    }
}
