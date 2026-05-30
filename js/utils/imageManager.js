/**
 * imageManager.js
 * Centralized utility for managing and rendering WebP/AVIF responsive images.
 * Provides a helper to generate HTML <picture> markup and defines the custom element <orecalc-assets-image>.
 */

/**
 * Returns the HTML <picture> markup for a given image source path.
 * Resolves standard (200px) and thumbnail (72px) versions for sub-folder assets.
 * 
 * @param {string} src - The image path (e.g. "assets/equipment/barbarian_king/BK_rage_vial.png")
 * @param {string} className - Optional CSS class name to apply.
 * @param {string} size - The size tier: 'standard' or 'thumbnail'.
 * @param {string} alt - The alt text description.
 * @returns {string} The HTML <picture> markup.
 */
export function getImage(src, className = '', size = 'standard', alt = '') {
    if (!src) return '';
    
    // Handle external URLs or data URIs directly without optimization
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
        return `<img src="${src}" alt="${alt}" class="${className}" loading="lazy" decoding="async" draggable="false">`;
    }
    
    // Normalize path by removing extensions if present
    let base = src;
    if (src.endsWith('.png') || src.endsWith('.webp') || src.endsWith('.avif')) {
        base = src.substring(0, src.lastIndexOf('.'));
    }
    
    // In local dev run (live-server on port 8080 serving the root directory),
    // optimized WebP/AVIF copies and resized thumbnails do not exist.
    // We serve the original raw PNG file directly.
    const isDev = typeof location !== 'undefined' && location.port === '8080';
    if (isDev) {
        const pngUrl = `${base}.png`;
        return `<img src="${pngUrl}" alt="${alt}" class="${className}" loading="lazy" decoding="async" draggable="false">`;
    }

    // Sub-folder assets (equipment, heroes, resources) are resized and get suffixes.
    // Top-level assets (like shiny_ore, crown, favicon) keep their original resolutions.
    const isSubfolderAsset = base.includes('assets/equipment/') || 
                             base.includes('assets/heroes/') || 
                             base.includes('assets/resources/');
                             
    const suffix = isSubfolderAsset ? (size === 'thumbnail' ? '-72' : '-200') : '';
    
    const avifUrl = `${base}${suffix}.avif`;
    const webpUrl = `${base}${suffix}.webp`;
    
    return `<picture class="${className}">
        <source srcset="${avifUrl}" type="image/avif">
        <source srcset="${webpUrl}" type="image/webp">
        <img src="${webpUrl}" alt="${alt}" class="${className}" loading="lazy" decoding="async" draggable="false">
    </picture>`;
}

class OrecalcAssetsImage extends HTMLElement {
    static get observedAttributes() {
        return ['src', 'class', 'size', 'alt'];
    }

    get src() {
        return this.getAttribute('src');
    }

    set src(value) {
        this.setAttribute('src', value);
    }

    connectedCallback() {
        this.render();
    }

    attributeChangedCallback() {
        this.render();
    }

    render() {
        const src = this.getAttribute('src');
        const className = this.getAttribute('class') || '';
        const size = this.getAttribute('size') || 'standard';
        const alt = this.getAttribute('alt') || '';

        if (src) {
            this.innerHTML = getImage(src, className, size, alt);
        }
    }
}

if (!customElements.get('orecalc-assets-image')) {
    customElements.define('orecalc-assets-image', OrecalcAssetsImage);
}
