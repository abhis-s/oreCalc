/**
 * Standard Town Hall Badge Renderer Module.
 * Provides unified, accessible DOM construction for Town Hall badges across all pages.
 */

const SIZE_CLASSES = {
    xs: 'th-badge--xs',
    sm: 'th-badge--sm',
    md: 'th-badge--md',
    lg: 'th-badge--lg'
};

/**
 * Renders standardized HTML markup for a Town Hall badge.
 * @param {object} options
 * @param {number|string} options.thLevel Town Hall level (1–18+)
 * @param {'xs'|'sm'|'md'|'lg'} [options.size='md'] Size modifier ('xs', 'sm', 'md', 'lg')
 * @param {string} [options.className=''] Contextual layout class hook
 * @param {string} [options.id=''] Optional DOM id attribute
 * @param {boolean} [options.showLevel=true] Whether to render the overlay level badge
 * @param {boolean} [options.isSilhouette=false] Whether to render in silhouette state
 * @param {string} [options.imgSrc=''] Custom image source override
 * @param {string} [options.imgAlt=''] Custom image alt text override
 * @returns {string} Standardized HTML markup string
 */
export function renderTownHallBadge({
    thLevel,
    size = 'md',
    className = '',
    id = '',
    showLevel = true,
    isSilhouette = false,
    imgSrc = '',
    imgAlt = ''
}) {
    const levelNum = Number(thLevel) || 1;
    const src = imgSrc || `assets/th/th${levelNum}.png`;
    const alt = imgAlt || `Town Hall ${levelNum}`;
    const sizeModifier = SIZE_CLASSES[size] || 'th-badge--md';
    const silhouetteClass = isSilhouette ? ' is-silhouette' : '';
    const extraClass = className ? ` ${className}` : '';
    const idAttr = id ? ` id="${id}"` : '';

    return `<div${idAttr} class="th-badge ${sizeModifier}${extraClass}">
        <clashcalc-assets-image class="th-badge__img${silhouetteClass}" src="${src}" alt="${alt}" size="standard"></clashcalc-assets-image>
        ${showLevel ? `<span class="th-badge__level">${levelNum}</span>` : ''}
    </div>`.trim();
}
