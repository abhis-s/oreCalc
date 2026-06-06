/**
 * svgManager.js
 * Centralized registry for all SVG icon path data used in the application.
 * Provides a helper to generate <svg><use></use></svg> markup.
 */

const DEFAULT_VIEWBOX = '0 0 24 24';

export const SVGs = {
    'menu': {},
    'close': {},
    'dropdown': {},
    'refresh': {},
    'home-outline': {},
    'home-filled': {},
    'equipment-outline': {},
    'equipment-filled': {},
    'income-outline': {},
    'income-filled': {},
    'planner-outline': {},
    'planner-filled': {},
    'settings-outline': {},
    'settings-filled': {},
    'collapse': {},
    'expand': {},
    'trash': {},
    'trash-sweep': {},
    'copy': {},
    'qr': {},
    'paste': {},
    'camera': {},
    'github': { viewBox: '0 0 496 512' },
    'crowdin': { viewBox: '0 0 24 24' },
    'bmc': { viewBox: '0 0 884 1279' },
    'sync': {},
    'sync-disabled': {},
    'plus': {},
    'cloud-check': {},
    'check': {},
    'cloud-error': {},
    'error': {},
    'cloud-upload': {},
    'cloud-off': {},
    'import': {},
    'save-data': {},
    'arrow-up': {},
    'edit': {},
    'drag-handle': {},
    'warning': {},
    'suggestion': {},
    'changelog': {},
    'shield': {},
    'article': {},
    'gavel': {},
    'info': {},
    'library': {},
    'download': {},
    'policy': {},
    'bug': {},
    'mail': {},
    'costs': {},
    'global-pricing': {},
    'light-mode': {},
    'dark-mode': {},
    'palette': {},
    'open-in-new': {},
    'translate': {},
    'volunteer-support': {}
};

/**
 * Returns the SVG markup for a given icon ID.
 * @param {string} id - The icon ID from SVGs.
 * @param {string} className - Optional CSS class name.
 * @param {number} height - Optional height (default 24).
 * @param {number} width - Optional width (default 24).
 * @param {string} fill - Optional fill color (default currentColor).
 * @returns {string} The SVG string.
 */
export function getSVG(id, className = '', height = 24, width = 24, fill = 'currentColor') {
    const icon = SVGs[id];
    if (!icon) {
        console.warn(`Icon ${id} not found in registry.`);
        return '';
    }

    const viewBox = icon.viewBox || DEFAULT_VIEWBOX;

    // Use <use> tag to reference the sprite sheet defined in index.html
    return `<svg class="${className}" height="${height}" width="${width}" viewBox="${viewBox}" fill="${fill}">
        <use href="#icon-${id}" xlink:href="#icon-${id}"></use>
    </svg>`;
}

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
        const className = this.getAttribute('class') || '';
        const height = this.getAttribute('height') || '24';
        const width = this.getAttribute('width') || '24';
        const fill = this.getAttribute('fill') || 'currentColor';

        if (name) {
            this.innerHTML = getSVG(name, className, height, width, fill);
        }
    }
}

if (!customElements.get('orecalc-assets-svg')) {
    customElements.define('orecalc-assets-svg', OrecalcAssetsSvg);
}


