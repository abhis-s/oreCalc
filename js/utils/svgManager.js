/**
 * svgManager.js
 * Centralized registry for all SVG icon path data used in the application.
 * Provides a helper to generate <svg><use></use></svg> markup.
 */

const DEFAULT_VIEWBOX = '0 0 24 24';

const SVG_VIEWBOXES = {
    'github': '0 0 496 512',
    'bmc': '0 0 884 1279'
};

/**
 * Returns the SVG markup for a given icon ID.
 * @param {string} id - The icon ID.
 * @param {string} [className=''] - Optional CSS class name.
 * @param {number|string} [height=24] - Optional height (default 24).
 * @param {number|string} [width=24] - Optional width (default 24).
 * @param {string} [fill='currentColor'] - Optional fill color (default currentColor).
 * @returns {string} The SVG string.
 */
export function getSVG(id, className = '', height = 24, width = 24, fill = 'currentColor') {
    if (!id) return '';
    const viewBox = SVG_VIEWBOXES[id] || DEFAULT_VIEWBOX;

    // Use <use> tag to reference the sprite sheet defined in index.html
    return `<svg class="${className}" height="${height}" width="${width}" viewBox="${viewBox}" fill="${fill}">
        <use href="#icon-${id}" xlink:href="#icon-${id}"></use>
    </svg>`;
}

/**
 * Checks whether an SVG symbol exists in the current document's DOM.
 * @param {string} id - The symbol ID to inspect (with or without 'icon-' prefix or leading '#').
 * @returns {boolean} True if the element exists in document.
 */
export function symbolExists(id) {
    if (!id || typeof document === 'undefined') return false;
    const clean = id.startsWith('#') ? id.substring(1) : id;
    const symbolId = clean.startsWith('icon-') ? clean : `icon-${clean}`;
    return Boolean(document.getElementById(symbolId));
}

if (typeof HTMLElement !== 'undefined') {
    class OrecalcAssetsSvg extends HTMLElement {
        static get observedAttributes() {
            return ['name', 'class', 'height', 'width', 'fill'];
        }

        connectedCallback() {
            this.render();
        }

        attributeChangedCallback() {
            this.render();
        }

        render() {
            const name = this.getAttribute('name');
            const height = this.getAttribute('height') || '24';
            const width = this.getAttribute('width') || '24';
            const fill = this.getAttribute('fill') || 'currentColor';

            if (name) {
                this.innerHTML = getSVG(name, '', height, width, fill);
            }
        }
    }

    class ClashcalcAssetsSvg extends OrecalcAssetsSvg {}

    if (typeof customElements !== 'undefined') {
        if (!customElements.get('orecalc-assets-svg')) {
            customElements.define('orecalc-assets-svg', OrecalcAssetsSvg);
        }
        if (!customElements.get('clashcalc-assets-svg')) {
            customElements.define('clashcalc-assets-svg', ClashcalcAssetsSvg);
        }
    }
}
