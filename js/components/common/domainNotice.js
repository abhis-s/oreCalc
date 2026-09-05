import { translate } from '../../i18n/translator.js';
import { STORAGE_KEYS } from '../../core/constants.js';
import { getSVG } from '../../utils/svgManager.js';

export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
export const IS_DOMAIN_NOTICE_ACTIVE = false;

/**
 * Determines whether the domain migration notice banner should be displayed.
 *
 * @param {Object} params - Evaluation parameters.
 * @param {string} params.hostname - Current browser hostname.
 * @param {string} [params.search=''] - Current window search string.
 * @param {number|null} [params.dismissedTimestamp=null] - Epoch millisecond timestamp of previous dismissal.
 * @param {number} [params.now=Date.now()] - Current epoch millisecond timestamp.
 * @param {number} [params.suppressionMs=SEVEN_DAYS_MS] - Duration to suppress notice after dismissal.
 * @param {boolean} [params.isActive=IS_DOMAIN_NOTICE_ACTIVE] - Production activation state flag.
 * @returns {boolean} True if the notice should be presented.
 */
export function shouldDisplayDomainNotice({
    hostname,
    search = '',
    dismissedTimestamp = null,
    now = Date.now(),
    suppressionMs = SEVEN_DAYS_MS,
    isActive = IS_DOMAIN_NOTICE_ACTIVE
}) {
    if (!hostname) return false;

    const isTargetDomain = hostname === 'clashcalc.com' ||
        hostname === 'www.clashcalc.com' ||
        hostname.endsWith('.clashcalc.com');

    if (isTargetDomain) return false;

    if (search) {
        try {
            const params = new URLSearchParams(search);
            if (params.get('domainNotice') === 'true' || params.get('testDomainNotice') === 'true') {
                return true;
            }
        } catch {
            // Safe URLSearchParams fallback
        }
    }

    if (!isActive) return false;

    const isLegacyDomain = hostname === 'orecalc.tech' ||
        hostname === 'www.orecalc.tech' ||
        hostname.endsWith('.orecalc.tech') ||
        hostname.includes('orecalc-domain-test');

    if (!isLegacyDomain) return false;

    if (dismissedTimestamp && (now - Number(dismissedTimestamp)) < suppressionMs) {
        return false;
    }

    return true;
}

/**
 * Builds the destination ClashCalc URL carrying active identity and tag parameters.
 *
 * @param {Object} params - Target calculation parameters.
 * @param {string} [params.currentPath='/'] - Current window pathname.
 * @param {string} [params.currentSearch=''] - Current window search string.
 * @param {string|null} [params.userId=null] - Active local or synced user ID.
 * @param {string|null} [params.activePlayerTag=null] - Active player tag.
 * @param {string} [params.targetOrigin='https://clashcalc.com'] - Destination ClashCalc origin.
 * @returns {string} Fully qualified destination URL with carryover parameters.
 */
export function buildClashCalcTargetUrl({
    currentPath = '/',
    currentSearch = '',
    userId = null,
    activePlayerTag = null,
    targetOrigin = 'https://clashcalc.com'
}) {
    const url = new URL(targetOrigin);

    const segments = currentPath.split('/').filter(Boolean);
    const knownLocales = ['de', 'tr', 'zh'];
    const hasLocale = segments.length > 0 && knownLocales.includes(segments[0].toLowerCase());
    const langPrefix = hasLocale ? `/${segments[0].toLowerCase()}` : '';
    const isHeroJourney = currentPath.includes('hero-journey');

    url.pathname = `${langPrefix}${isHeroJourney ? '/hero-journey/' : '/ore-calculator/'}`;

    const existingParams = new URLSearchParams(currentSearch);
    const paramsToExclude = new Set(['userId', 'tag', 'domainNotice', 'testDomainNotice']);
    existingParams.forEach((val, key) => {
        if (!paramsToExclude.has(key)) {
            url.searchParams.set(key, val);
        }
    });

    if (userId && typeof userId === 'string' && userId.trim()) {
        url.searchParams.set('userId', userId.trim());
    }

    const resolvedTag = activePlayerTag || existingParams.get('tag');
    if (resolvedTag && resolvedTag !== 'DEFAULT0' && resolvedTag.trim()) {
        url.searchParams.set('tag', resolvedTag.trim());
    }

    return url.toString();
}

/**
 * Initializes and mounts the domain notice banner if preconditions are satisfied.
 *
 * @param {Object} [options={}] - Configuration options.
 * @param {HTMLElement|null} [options.container=null] - Container element to prepend into.
 * @param {string|null} [options.userId=null] - Explicit user ID override.
 * @param {string|null} [options.activePlayerTag=null] - Explicit active tag override.
 * @param {boolean} [options.isActive=IS_DOMAIN_NOTICE_ACTIVE] - Production activation state flag.
 * @returns {HTMLElement|null} The mounted banner element or null if suppressed.
 */
export function initDomainNotice(options = {}) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;
    if (document.querySelector('.domain-notice')) return null;

    const hostname = window.location.hostname;
    let rawDismissed = null;
    try {
        rawDismissed = localStorage.getItem(STORAGE_KEYS.DOMAIN_NOTICE_DISMISSED);
    } catch {
        // LocalStorage access may be restricted in third-party iframe contexts
    }

    const dismissedTimestamp = rawDismissed ? Number(rawDismissed) : null;
    if (!shouldDisplayDomainNotice({
        hostname,
        search: window.location.search,
        dismissedTimestamp,
        isActive: options.isActive ?? IS_DOMAIN_NOTICE_ACTIVE
    })) {
        return null;
    }

    let resolvedUserId = options.userId || null;
    if (!resolvedUserId) {
        try {
            resolvedUserId = localStorage.getItem(STORAGE_KEYS.USER_ID);
        } catch {
            resolvedUserId = null;
        }
    }

    const targetUrl = buildClashCalcTargetUrl({
        currentPath: window.location.pathname,
        currentSearch: window.location.search,
        userId: resolvedUserId,
        activePlayerTag: options.activePlayerTag || null
    });

    const banner = document.createElement('aside');
    banner.className = 'domain-notice';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', translate('app.domainNotice.message'));

    const innerWrapper = document.createElement('div');
    innerWrapper.className = 'domain-notice-inner';

    const iconBadge = document.createElement('span');
    iconBadge.className = 'domain-notice-badge';
    iconBadge.innerHTML = getSVG('info', 'domain-notice-icon', 16, 16, 'currentColor');

    const textEl = document.createElement('p');
    textEl.className = 'domain-notice-text';
    textEl.setAttribute('data-i18n', 'app.domainNotice.message');
    textEl.textContent = translate('app.domainNotice.message');

    const actionWrapper = document.createElement('div');
    actionWrapper.className = 'domain-notice-actions';

    const ctaLink = document.createElement('a');
    ctaLink.className = 'domain-notice-cta';
    ctaLink.href = targetUrl;
    ctaLink.target = '_blank';
    ctaLink.rel = 'noopener noreferrer';
    ctaLink.setAttribute('data-i18n', 'app.domainNotice.cta');
    ctaLink.textContent = translate('app.domainNotice.cta');

    // Flush pending cloud saves when user prepares to navigate to ClashCalc
    ctaLink.addEventListener('pointerdown', () => {
        import('../../services/cloudSaveService.js')
            .then(m => m.triggerCloudSave?.({ silent: true }))
            .catch(() => {});
    }, { once: true, passive: true });

    actionWrapper.appendChild(ctaLink);

    const updateHeight = () => {
        const height = banner.offsetHeight || 0;
        document.documentElement.style.setProperty('--domain-notice-height', `${height}px`);
    };

    let isCleanedUp = false;
    const cleanup = () => {
        if (isCleanedUp) return;
        isCleanedUp = true;
        document.documentElement.style.setProperty('--domain-notice-height', '0px');
        window.removeEventListener('resize', updateHeight);
        banner.remove();
    };

    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.className = 'domain-notice-dismiss-btn';
    dismissBtn.setAttribute('aria-label', translate('app.domainNotice.dismiss'));
    dismissBtn.setAttribute('data-i18n-aria-label', 'app.domainNotice.dismiss');
    dismissBtn.innerHTML = getSVG('close', 'domain-notice-close-icon', 16, 16, 'currentColor');

    dismissBtn.addEventListener('click', () => {
        try {
            localStorage.setItem(STORAGE_KEYS.DOMAIN_NOTICE_DISMISSED, String(Date.now()));
        } catch {
            // Storage quota or restriction fallback
        }
        banner.classList.add('domain-notice--exiting');
        banner.addEventListener('transitionend', cleanup, { once: true });
        // Fallback safety timeout if transition does not fire
        setTimeout(cleanup, 400);
    });

    innerWrapper.appendChild(iconBadge);
    innerWrapper.appendChild(textEl);
    innerWrapper.appendChild(actionWrapper);
    innerWrapper.appendChild(dismissBtn);

    banner.appendChild(innerWrapper);

    const targetContainer = options.container || document.body;
    if (targetContainer.firstChild) {
        targetContainer.insertBefore(banner, targetContainer.firstChild);
    } else {
        targetContainer.appendChild(banner);
    }

    updateHeight();
    window.addEventListener('resize', updateHeight, { passive: true });

    return banner;
}
