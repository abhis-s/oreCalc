import { translate } from '../../i18n/translator.js';
import { STORAGE_KEYS } from '../../core/constants.js';
import { getSVG } from '../../utils/svgManager.js';
import { buildClashCalcTargetUrl } from '../../utils/clashCalcUrl.js';

export const IS_DOMAIN_NOTICE_ACTIVE = true;

/**
 * Determines whether the permanent domain migration notice banner should be displayed.
 *
 * @param {Object} params - Evaluation parameters.
 * @param {string} params.hostname - Current browser hostname.
 * @param {string} [params.search=''] - Current window search string.
 * @param {boolean} [params.isActive=IS_DOMAIN_NOTICE_ACTIVE] - Production activation state flag.
 * @returns {boolean} True if the notice should be presented.
 */
export function shouldDisplayDomainNotice({
    hostname,
    search = '',
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

    return isLegacyDomain;
}

/**
 * Initializes and mounts the permanent domain notice banner if preconditions are satisfied.
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
    if (!shouldDisplayDomainNotice({
        hostname,
        search: window.location.search,
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

    const resolveTargetUrl = () => buildClashCalcTargetUrl({
        currentPath: window.location.pathname,
        currentSearch: window.location.search,
        userId: resolvedUserId,
        activePlayerTag: options.activePlayerTag || null
    });

    const banner = document.createElement('aside');
    banner.className = 'domain-notice';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', translate('app.domainNotice.message'));
    banner.setAttribute('data-i18n-aria-label', 'app.domainNotice.message');

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
    ctaLink.href = resolveTargetUrl();
    ctaLink.target = '_blank';
    ctaLink.rel = 'noopener noreferrer';
    ctaLink.setAttribute('data-i18n', 'app.domainNotice.cta');
    ctaLink.textContent = translate('app.domainNotice.cta');

    // Refresh href for current locale/route and flush pending cloud saves on pointer or keyboard activation
    let migrationTriggered = false;
    const handleCtaActivation = () => {
        ctaLink.href = resolveTargetUrl();
        if (migrationTriggered) return;
        migrationTriggered = true;

        if (resolvedUserId) {
            try {
                localStorage.setItem(STORAGE_KEYS.MIGRATED_TO_CLASHCALC, 'true');
                localStorage.setItem(STORAGE_KEYS.MIGRATED_USER_ID, resolvedUserId);
            } catch (_) {}
            import('../../services/apiService.js')
                .then(m => m.markUserMigrated?.(resolvedUserId))
                .catch(() => {});
        }
        import('../../services/cloudSaveService.js')
            .then(m => m.triggerCloudSave?.({ silent: true }))
            .catch(() => {});
    };

    ctaLink.addEventListener('pointerdown', handleCtaActivation, { passive: true });
    ctaLink.addEventListener('click', handleCtaActivation);

    actionWrapper.appendChild(ctaLink);

    const updateHeight = () => {
        const height = banner.offsetHeight || 0;
        document.documentElement.style.setProperty('--domain-notice-height', `${height}px`);
    };

    innerWrapper.appendChild(iconBadge);
    innerWrapper.appendChild(textEl);
    innerWrapper.appendChild(actionWrapper);

    banner.appendChild(innerWrapper);

    const targetContainer = options.container || document.body;
    if (targetContainer.firstChild) {
        targetContainer.insertBefore(banner, targetContainer.firstChild);
    } else {
        targetContainer.appendChild(banner);
    }

    updateHeight();
    window.addEventListener('resize', updateHeight, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
        const heightObserver = new ResizeObserver(updateHeight);
        heightObserver.observe(banner);
    }

    return banner;
}
