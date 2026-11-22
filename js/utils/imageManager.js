/**
 * imageManager.js
 * Centralized utility for managing and rendering WebP/AVIF responsive images.
 * Provides a helper to generate HTML <picture> markup and defines the custom element <orecalc-assets-image>.
 */

import { escapeHTML } from './stringUtils.js';

/**
 * Returns the HTML <picture> markup for a given image source path.
 * Resolves standard (200px) and thumbnail (72px) versions for sub-folder assets.
 *
 * @param {string} src - The image path (e.g. "assets/equipment/barbarian_king/BK_rage_vial.png")
 * @param {string} className - Optional CSS class name to apply.
 * @param {string} size - The size tier: 'standard' or 'thumbnail'.
 * @param {string} alt - The alt text description.
 * @param {string|number|null} width - Optional width attribute.
 * @param {string|number|null} height - Optional height attribute.
 * @param {string} loading - The loading attribute ('lazy' or 'eager').
 * @param {string|null} fetchpriority - Optional fetchpriority attribute ('high', 'low', 'auto').
 * @returns {string} The HTML <picture> markup.
 */
function getImage(src, className = '', size = 'standard', alt = '', width = null, height = null, loading = 'lazy', fetchpriority = null) {
    if (!src || typeof src !== 'string') return '';

    // Disallow data URIs completely
    if (src.startsWith('data:')) {
        return '';
    }

    const defaultDimension = size === 'thumbnail' ? '100' : '200';
    const imgWidth = escapeHTML(width || defaultDimension);
    const imgHeight = escapeHTML(height || defaultDimension);

    const loadingAttr = loading === 'eager' ? 'loading="eager"' : 'loading="lazy"';
    const priorityAttr = fetchpriority ? ` fetchpriority="${escapeHTML(fetchpriority)}"` : '';
    const safeAlt = escapeHTML(alt);
    const safeClass = escapeHTML(className);

    // Handle external URLs (HTTP / HTTPS)
    if (src.startsWith('http://') || src.startsWith('https://')) {
        const safeSrc = escapeHTML(src);
        return `<img src="${safeSrc}" alt="${safeAlt}" class="${safeClass}" width="${imgWidth}" height="${imgHeight}" ${loadingAttr}${priorityAttr} decoding="async" draggable="false">`;
    }

    let base = src;
    if (src.endsWith('.png') || src.endsWith('.webp') || src.endsWith('.avif')) {
        base = src.substring(0, src.lastIndexOf('.'));
    }
    if (!base.startsWith('/')) {
        base = `/${base}`;
    }

    // In local dev run (live-server on port 8080 serving the root directory),
    // optimized WebP/AVIF copies and resized thumbnails do not exist.
    // We serve the original raw PNG file directly.
    const isDev = typeof location !== 'undefined' && location.port === '8080';
    if (isDev) {
        const pngUrl = escapeHTML(`${base}.png`);
        return `<img src="${pngUrl}" alt="${safeAlt}" class="${safeClass}" width="${imgWidth}" height="${imgHeight}" ${loadingAttr}${priorityAttr} decoding="async" draggable="false">`;
    }

    // Sub-folder assets (equipment, heroes, guardians, supercharge, etc.) are resized and get suffixes.
    // Top-level assets (like shiny_ore, crown, favicon) keep their original resolutions.
    const isSubfolderAsset = /assets\/[^/]+\//.test(base);

    const suffix = isSubfolderAsset ? (size === 'thumbnail' ? '-100' : '-200') : '';

    const avifUrl = escapeHTML(`${base}${suffix}.avif`);
    const webpUrl = escapeHTML(`${base}${suffix}.webp`);

    return `<picture class="${safeClass}">
        <source srcset="${avifUrl}" type="image/avif">
        <source srcset="${webpUrl}" type="image/webp">
        <img src="${webpUrl}" alt="${safeAlt}" class="${safeClass}" width="${imgWidth}" height="${imgHeight}" ${loadingAttr}${priorityAttr} decoding="async" draggable="false">
    </picture>`;
}

if (typeof HTMLElement !== 'undefined') {
    class OrecalcAssetsImage extends HTMLElement {
        static get observedAttributes() {
            return ['src', 'class', 'size', 'alt', 'width', 'height', 'loading', 'fetchpriority'];
        }

        get src() {
            return this.getAttribute('src');
        }

        set src(value) {
            this.setAttribute('src', value);
        }

        connectedCallback() {
            if (!this._hasRendered) {
                this.render();
            }
        }

        attributeChangedCallback(name, oldValue, newValue) {
            if (oldValue === newValue) return;
            if (this._hasRendered) {
                const existingImg = this.querySelector('img');
                if (existingImg) {
                    if (name === 'class') {
                        const nextClass = newValue || '';
                        const existingPicture = this.querySelector('picture');
                        if (existingPicture) {
                            existingPicture.className = nextClass;
                        }
                        existingImg.className = nextClass;
                        return;
                    }
                    if (name === 'alt') {
                        existingImg.alt = newValue || '';
                        return;
                    }
                }
            }
            this.render();
        }

        render() {
            this._hasRendered = true;
            const src = this.getAttribute('src');
            const className = this.getAttribute('class') || '';
            const size = this.getAttribute('size') || 'standard';
            const alt = this.getAttribute('alt') || '';
            const width = this.getAttribute('width');
            const height = this.getAttribute('height');
            const loading = this.getAttribute('loading') || 'lazy';
            const fetchpriority = this.getAttribute('fetchpriority');

            if (!src) {
                this.innerHTML = '';
                return;
            }

            this.innerHTML = getImage(src, className, size, alt, width, height, loading, fetchpriority);
        }
    }

    class ClashcalcAssetsImage extends OrecalcAssetsImage {}

    if (typeof customElements !== 'undefined') {
        if (!customElements.get('orecalc-assets-image')) {
            customElements.define('orecalc-assets-image', OrecalcAssetsImage);
        }
        if (!customElements.get('clashcalc-assets-image')) {
            customElements.define('clashcalc-assets-image', ClashcalcAssetsImage);
        }
    }
}
