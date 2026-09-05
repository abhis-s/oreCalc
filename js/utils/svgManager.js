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
