/**
 * Route Transition Loader.
 * Renders the signature 5-dot animation (wave jump into continuous orbital spin)
 * scoped exclusively to main content during client-side route transitions.
 * Tier 4: Common Presentation Component.
 */

/**
 * Constructs the DOM element hierarchy for the 5-dot route transition loader.
 *
 * @returns {HTMLDivElement}
 */
export function createRouteTransitionLoaderElement() {
    const loader = document.createElement('div');
    loader.className = 'route-transition-loader';
    loader.setAttribute('role', 'status');
    loader.setAttribute('aria-live', 'polite');

    const srOnly = document.createElement('span');
    srOnly.className = 'sr-only';
    srOnly.textContent = 'Loading';
    loader.appendChild(srOnly);

    const spinner = document.createElement('div');
    spinner.className = 'route-transition-loader__spinner';
    spinner.setAttribute('aria-hidden', 'true');

    for (let i = 0; i < 5; i++) {
        const dotWrapper = document.createElement('div');
        dotWrapper.className = 'route-transition-loader__dot-wrapper';

        const dot = document.createElement('span');
        dot.className = 'route-transition-loader__dot';

        dotWrapper.appendChild(dot);
        spinner.appendChild(dotWrapper);
    }

    loader.appendChild(spinner);
    return loader;
}

/**
 * Inserts the route transition loader into the specified container, replacing existing content.
 *
 * @param {HTMLElement | null} [container=document.getElementById('main-content')]
 * @returns {HTMLDivElement | null}
 */
export function showRouteTransitionLoader(container = (typeof document !== 'undefined' ? document.getElementById('main-content') : null)) {
    if (!container) return null;

    const loader = createRouteTransitionLoaderElement();
    container.replaceChildren(loader);
    return loader;
}

/**
 * Triggers departure fade-out and removes the route transition loader from the specified container.
 *
 * @param {HTMLElement | null} [container=document.getElementById('main-content')]
 */
export function hideRouteTransitionLoader(container = (typeof document !== 'undefined' ? document.getElementById('main-content') : null)) {
    if (!container) return;

    const loader = container.querySelector('.route-transition-loader');
    if (!loader) return;

    loader.classList.add('is-leaving');
    // Allow CSS fade-out animation to complete before DOM unmount
    setTimeout(() => {
        loader.remove();
    }, 180);
}
