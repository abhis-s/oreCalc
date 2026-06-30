import { navigationRegistry } from '../../data/navigationRegistry.js';
import { translate } from '../../i18n/translator.js';

/**
 * Checks if an SVG symbol with the given ID exists in the DOM.
 * @param {string} id - The ID of the symbol (e.g., '#icon-home-filled').
 * @returns {boolean} - True if the symbol exists.
 */
function symbolExists(id) {
    if (!id) return false;
    const symbolId = id.startsWith('#') ? id.substring(1) : id;
    return !!document.getElementById(symbolId);
}

/**
 * Updates the coordinates and corner radius of the SVG mask cutout dynamically.
 * This is 100% robust across all engines (including Safari) by bypassing CSS SVG variable limitations.
 * @param {HTMLElement} container - The bottom-nav-bar element.
 */
function updateSvgMask(container) {
    const mask = document.getElementById('navbar-mask');
    if (!mask) return;
    
    const cutout = mask.querySelector('.mask-cutout');
    if (!cutout) return;
    
    // Get values from computed style or direct CSS variables
    const activeLeft = parseFloat(container.style.getPropertyValue('--active-left')) || 0;
    const activeWidth = parseFloat(container.style.getPropertyValue('--active-width')) || 56;
    
    const isGrabbing = container.classList.contains('grabbing');
    const isDesktop = window.innerWidth >= 500;
    
    // Determine dimensions based on state and device
    const lensScale = isGrabbing ? 1.75 : 1.0;
    const navbarHeight = isGrabbing ? (isDesktop ? 64 : 58) : (isDesktop ? 52 : 46);
    const indicatorHeight = isDesktop ? 44 : 38;
    const indicatorRadius = isDesktop ? 22 : 19;
    
    const cutoutWidth = activeWidth * lensScale;
    const cutoutHeight = indicatorHeight * lensScale;
    const cutoutRadius = indicatorRadius * lensScale;
    
    const cutoutX = activeLeft + activeWidth / 2 - cutoutWidth / 2;
    const cutoutY = (navbarHeight - cutoutHeight) / 2;
    
    cutout.setAttribute('x', cutoutX);
    cutout.setAttribute('y', cutoutY);
    cutout.setAttribute('width', cutoutWidth);
    cutout.setAttribute('height', cutoutHeight);
    cutout.setAttribute('rx', cutoutRadius);
    cutout.setAttribute('ry', cutoutRadius);
}

/**
 * Calculates and sets the width and centered left offset of the active pill
 * based on the actual size of the active tab's layout content (icon + side label).
 * @param {HTMLElement} container - The bottom-nav-bar element.
 */
function updateActiveIndicatorPosition(container) {
    const activeButton = container.querySelector('.nav-button.active');
    if (!activeButton) return;

    const contentEl = activeButton.querySelector('.nav-item-content');
    if (!contentEl) return;

    // Add breathing room padding around the layout content (icon + label)
    const padding = 24; 
    const width = contentEl.offsetWidth + padding;
    container.style.setProperty('--active-width', `${width}px`);

    // Calculate left offset relative to the container and center the pill behind content
    const containerRect = container.getBoundingClientRect();
    const activeRect = activeButton.getBoundingClientRect();
    const offsetLeft = (activeRect.left - containerRect.left) + (activeRect.width - width) / 2;
    container.style.setProperty('--active-left', `${offsetLeft}px`);

    // Update the SVG mask cutout attributes
    updateSvgMask(container);
}

// Window resize handler setup to keep the active indicator positioned correctly on resize/rotation
if (typeof window !== 'undefined' && !window.__appleNavResizeHandler) {
    window.__appleNavResizeHandler = () => {
        const container = document.querySelector('.bottom-nav-bar');
        if (container && document.body.classList.contains('platform-apple')) {
            updateActiveIndicatorPosition(container);
        }
    };
    window.addEventListener('resize', window.__appleNavResizeHandler);
}

/**
 * Renders the Liquid Glass bottom navigation bar for Apple platform users.
 * Injects CSS variables for droplet positioning and appends the active indicator container.
 * @param {string} activeTabId - The ID of the active tab.
 */
export function renderAppleNavigation(activeTabId) {
    const container = document.querySelector('.bottom-nav-bar');
    if (!container) return;

    // Check if the buttons are already rendered in the base layer
    let baseButtons = container.querySelectorAll(':scope > .nav-button');
    let overlay = container.querySelector('.active-overlay');
    let indicator = container.querySelector('.active-indicator');

    if (baseButtons.length === 0) {
        // First-time render: clear and generate all components
        container.innerHTML = '';
        
        // 1. Create base buttons (inactive layer)
        navigationRegistry.forEach(tab => {
            const isActive = activeTabId === `${tab.id}-tab` || activeTabId === tab.id;
            const activeClass = isActive ? 'active' : '';

            // Mutual Fallback
            const hasOutline = symbolExists(tab.iconOutline);
            const hasFilled = symbolExists(tab.iconFilled);

            const iconOutline = hasOutline ? tab.iconOutline : tab.iconFilled;
            const iconFilled = hasFilled ? tab.iconFilled : tab.iconOutline;

            const nameOutline = iconOutline.startsWith('#icon-') ? iconOutline.substring(6) : iconOutline;
            const nameFilled = iconFilled.startsWith('#icon-') ? iconFilled.substring(6) : iconFilled;

            const button = document.createElement('button');
            button.className = `nav-button ${activeClass}`;
            button.dataset.tab = tab.id;

            button.innerHTML = `
                <div class="nav-item-content">
                    <div class="nav-icon-wrapper">
                        <span class="icon-outline">
                            <orecalc-assets-svg name="${nameOutline}" fill="currentColor"></orecalc-assets-svg>
                        </span>
                        <span class="icon-filled">
                            <orecalc-assets-svg name="${nameFilled}" fill="currentColor"></orecalc-assets-svg>
                        </span>
                    </div>
                    <span data-i18n="${tab.i18nKey}">${translate(tab.i18nKey)}</span>
                </div>
            `;
            container.appendChild(button);
        });

        // 2. Add active indicator backdrop droplet
        indicator = document.createElement('div');
        indicator.className = 'active-indicator';
        container.appendChild(indicator);

        // 3. Add active overlay container (revealed inside the lens)
        overlay = document.createElement('div');
        overlay.className = 'active-overlay';
        
        // Clone base buttons into overlay
        const baseBtns = container.querySelectorAll(':scope > .nav-button');
        baseBtns.forEach(btn => {
            const clone = btn.cloneNode(true);
            clone.removeAttribute('id');
            overlay.appendChild(clone);
        });
        container.appendChild(overlay);
        
        // Setup dragging and snapping behavior
        setupAppleNavDrag(container, indicator, overlay);
    } else {
        // Subsequent render: just update the active class on buttons
        baseButtons.forEach(button => {
            const tabId = button.dataset.tab;
            const isActive = activeTabId === `${tabId}-tab` || activeTabId === tabId;
            button.classList.toggle('active', isActive);
        });

        if (overlay) {
            const overlayButtons = overlay.querySelectorAll('.nav-button');
            baseButtons.forEach((btn, idx) => {
                const isAct = btn.classList.contains('active');
                if (overlayButtons[idx]) {
                    overlayButtons[idx].classList.toggle('active', isAct);
                }
            });
        }
    }

    // Set layout-level custom variables
    container.style.setProperty('--tab-count', navigationRegistry.length);

    // Recalculate indicators asynchronously to measure correct layout widths
    setTimeout(() => updateActiveIndicatorPosition(container), 0);
}

/**
 * Handles grabbing and dragging behavior for the iOS 27 Liquid Glass active lens/pill.
 * Clamps dragging boundaries, dynamically morphs pill widths, and settles to close options.
 */
function setupAppleNavDrag(container, indicator, overlay) {
    if (window.__appleNavDragCleanup) {
        window.__appleNavDragCleanup();
    }
    
    let isDragging = false;
    let startX = 0;
    let startLeft = 0;
    let containerRect = null;
    let activeWidth = 0;
    let targetWidth = 0;
    let currentWidth = 0;
    let tabsInfo = [];

    const animateWidth = () => {
        if (!isDragging) return;
        
        const lerpFactor = 0.16; // Smoothness factor for liquid size morphing
        currentWidth += (targetWidth - currentWidth) * lerpFactor;
        
        if (Math.abs(targetWidth - currentWidth) < 0.1) {
            currentWidth = targetWidth;
        }
        
        container.style.setProperty('--active-width', `${currentWidth}px`);
        
        // Update mask on every animation frame for liquid resizing smooth effect!
        updateSvgMask(container);
        
        if (isDragging && currentWidth !== targetWidth) {
            requestAnimationFrame(animateWidth);
        }
    };

    const onStart = (e) => {
        // Allow dragging from anywhere in the container
        const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;

        // Prevent standard scroll or highlight during dragging
        e.preventDefault();

        isDragging = true;
        container.classList.add('grabbing');
        document.body.classList.add('grabbing-nav');
        startX = clientX;
        
        containerRect = container.getBoundingClientRect();

        // Gather metrics for all navigation buttons to calculate snap centers
        const baseButtons = Array.from(container.querySelectorAll(':scope > .nav-button'));
        tabsInfo = baseButtons.map(btn => {
            const btnRect = btn.getBoundingClientRect();
            const contentEl = btn.querySelector('.nav-item-content');
            const padding = 24;
            const widthVal = (contentEl ? contentEl.offsetWidth : btnRect.width) + padding;
            return {
                tabId: btn.dataset.tab,
                button: btn,
                center: (btnRect.left - containerRect.left) + btnRect.width / 2,
                width: widthVal
            };
        });

        // Find the closest tab to the starting coordinate and snap the pill to it instantly
        const cursorXRelative = clientX - containerRect.left;
        let closestTab = tabsInfo[0];
        let minDistance = Infinity;

        tabsInfo.forEach(tab => {
            const distance = Math.abs(tab.center - cursorXRelative);
            if (distance < minDistance) {
                minDistance = distance;
                closestTab = tab;
            }
        });

        activeWidth = closestTab.width;
        targetWidth = activeWidth;
        currentWidth = activeWidth;

        // Snap starting coordinates to the center of the grabbed tab button
        startLeft = closestTab.center - activeWidth / 2;
        const maxLeft = containerRect.width - activeWidth;
        if (startLeft < 0) startLeft = 0;
        if (startLeft > maxLeft) startLeft = maxLeft;

        container.style.setProperty('--active-left', `${startLeft}px`);
        container.style.setProperty('--active-width', `${activeWidth}px`);

        // Hide inactive copy under the lens
        baseButtons.forEach(btn => btn.classList.remove('under-lens'));
        closestTab.button.classList.add('under-lens');

        // Update the SVG mask cutout attributes instantly on grab start
        updateSvgMask(container);

        // Start width animation loop
        requestAnimationFrame(animateWidth);
    };

    const onMove = (e) => {
        if (!isDragging) return;

        const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
        const deltaX = clientX - startX;
        let newLeft = startLeft + deltaX;

        // Clamp indicator coordinates inside navbar container bounds
        const maxLeft = containerRect.width - activeWidth;
        if (newLeft < 0) newLeft = 0;
        if (newLeft > maxLeft) newLeft = maxLeft;

        container.style.setProperty('--active-left', `${newLeft}px`);

        // Dynamically locate the closest tab to morph the active indicator size during drag
        const currentCenter = newLeft + activeWidth / 2;
        let closestTab = null;
        let minDistance = Infinity;

        tabsInfo.forEach(tab => {
            const distance = Math.abs(tab.center - currentCenter);
            if (distance < minDistance) {
                minDistance = distance;
                closestTab = tab;
            }
        });

        if (closestTab) {
            const oldTargetWidth = targetWidth;
            targetWidth = closestTab.width;
            
            // Hide inactive copy under the lens dynamically
            tabsInfo.forEach(tab => tab.button.classList.remove('under-lens'));
            closestTab.button.classList.add('under-lens');
            
            // If targetWidth changed and we were not running the animation, kick it off
            if (oldTargetWidth !== targetWidth) {
                activeWidth = targetWidth; // update clamp boundary reference instantly
                requestAnimationFrame(animateWidth);
            }
        }

        // Update mask on every cursor movement
        updateSvgMask(container);
    };

    const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        container.classList.remove('grabbing');
        document.body.classList.remove('grabbing-nav');

        // Clean up under-lens hidden elements
        const baseButtons = container.querySelectorAll(':scope > .nav-button');
        baseButtons.forEach(btn => btn.classList.remove('under-lens'));

        // Locate closest target tab to settle on
        const currentLeft = parseFloat(container.style.getPropertyValue('--active-left')) || 0;
        const currentCenter = currentLeft + activeWidth / 2;
        
        let closestTab = null;
        let minDistance = Infinity;

        tabsInfo.forEach(tab => {
            const distance = Math.abs(tab.center - currentCenter);
            if (distance < minDistance) {
                minDistance = distance;
                closestTab = tab;
            }
        });

        if (closestTab) {
            // Apply the snapped coordinates immediately
            container.style.setProperty('--active-width', `${closestTab.width}px`);
            const btnRect = closestTab.button.getBoundingClientRect();
            const offsetLeft = (btnRect.left - containerRect.left) + (btnRect.width - closestTab.width) / 2;
            container.style.setProperty('--active-left', `${offsetLeft}px`);

            // Update mask for final snapped coordinates
            updateSvgMask(container);

            // Trigger click navigation
            closestTab.button.click();
        }
    };

    container.addEventListener('mousedown', onStart, { passive: false });
    container.addEventListener('touchstart', onStart, { passive: false });

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchend', onEnd);

    window.__appleNavDragCleanup = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('mouseup', onEnd);
        window.removeEventListener('touchend', onEnd);
    };
}
