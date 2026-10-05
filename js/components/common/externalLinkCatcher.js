import { translate } from '../../i18n/translator.js';
import { showConfirm } from '../../ui/noticeModal.js';

/**
 * Initializes external link interception for a document or root container.
 * Prompts user confirmation before navigating away from the application.
 *
 * @param {Document|HTMLElement} [root=document] - Root element to attach delegated listener to.
 * @returns {() => void} Cleanup unbind function.
 */
export function initExternalLinkCatcher(root = document) {
    if (!root || typeof root.addEventListener !== 'function') {
        return () => {};
    }

    const handleClick = async (e) => {
        const link = /** @type {HTMLElement} */ (e.target).closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href) return;

        // Skip internal in-page anchors and void scripts
        if (href.startsWith('#') || href.startsWith('javascript:')) return;

        // Skip domain migration banner navigation between legacy and current domain
        if (link.classList.contains('domain-notice-cta') || link.closest('.domain-notice')) return;

        const isMailto = href.startsWith('mailto:');
        if (isMailto) {
            e.preventDefault();
            const confirmed = await showConfirm(translate('confirms.mailtoLink'));
            if (confirmed) {
                window.location.href = href;
            }
            return;
        }

        const currentHost = typeof window !== 'undefined' ? window.location.host : '';
        const isHttpExternal = (href.startsWith('http://') || href.startsWith('https://')) && !href.includes(currentHost);

        if (isHttpExternal) {
            e.preventDefault();
            const confirmed = await showConfirm(
                `${translate('confirms.externalLink')}<br><code class="external-link-display">${href}</code><br><br>${translate('confirms.externalLinkConfirm')}`
            );
            if (confirmed) {
                window.open(href, '_blank', 'noopener,noreferrer');
            }
        }
    };

    root.addEventListener('click', handleClick);
    return () => {
        root.removeEventListener('click', handleClick);
    };
}
